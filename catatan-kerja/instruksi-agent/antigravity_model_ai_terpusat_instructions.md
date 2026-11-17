# Instruksi Antigravity: Model AI Gemini Terpusat di Settings

> **Pakai `antigravity_ai_terpusat_TERPADU.md` sebagai instruksi kerja.** Dokumen ini hanya referensi detail (bukti, nomor baris). Jika bertentangan, dokumen terpadu yang berlaku.

## Mandat

Pengguna ingin **semua pilihan model Gemini mengikuti menu Settings** (per tenant), bukan daftar model yang tertanam di kode. Saat ini ada beberapa sumber pilihan model yang saling menimpa. Akibatnya model di Settings diabaikan untuk sebagian tugas, ada tugas yang memakai model yang sudah tidak ada, dan enrichment produk gagal tanpa model cadangan.

Tujuan akhir:
1. Settings menjadi **satu-satunya sumber** pilihan model teks/vision Gemini.
2. Setiap tugas punya **rantai cadangan** (model utama → cadangan → model lain), termasuk enrichment produk.
3. Pesan error membedakan **model sibuk (503)** dari **kuota habis (429 harian)**.

Di luar lingkup (jangan diubah): model TTS (`gemini-2.5-flash-preview-tts`, `lib/gemini-tts-batch.js`, `lib/gemini-8s-tts.js`), model generasi gambar (`lib/product-photo-providers/gemini.js` `DEFAULT_IMAGE_MODEL`), embedding, isi prompt, data API key/pool.

## Bukti masalah (dicek 17 Nov 2026, staging, hanya baca)

**Pengaturan per tenant (`staging.tenant_settings`):**

| Tenant | tier | primary | fallback | smart routing |
|---|---|---|---|---|
| `default_tenant` | free | gemini-3.5-flash-lite | gemini-3.6-flash | on |
| `tnt_mas-ibnu_e0eb25` | **paid** | gemini-3.8-flash | gemini-3.6-flash | on |
| `tnt_pt-gim-sosmed_62d0d9` | free | gemini-2.5-flash | gemini-3.5-flash-lite | on |
| `tnt_sy-benu_415f99` | free | gemini-3.6-flash | gemini-3.6-flash | on |
| `tnt_sy-dodot_4ba27b` | free | gemini-3.6-flash | gemini-3.6-flash | on |

`default_tenant` juga punya `start_frame_visual_qc_model = gemini-3.1-flash-lite` (dari panel Eksperimen).

**Temuan di kode (`lib/gemini.js`):**
1. `MODULE_MODEL_MATRIX` (~baris 169) menanam model per tugas. Jika `gemini_smart_routing` menyala (default `on`), tugas `SCRAPER`, `OCR_EXTRACTION`, `COMPLIANCE`, `DECONSTRUCT` **mengabaikan Settings** (`resolveModelForTask` ~231, `getResolvedGeminiModels` ~285).
2. Untuk tier `paid`, `SCRAPER` dan `OCR_EXTRACTION` diarahkan ke **`gemini-1.5-flash-8b`**, model yang sudah tidak tersedia. Ini juga muncul di `GEMINI_MODELS.SCRAPER` (~197), di return `getResolvedGeminiModels` (~294), dan di `GEMINI_CASCADE_ORDER_PAID`. **Dampak: tenant Mas Ibnu (paid) besar kemungkinan gagal di scraper dan enrichment produk.** Verifikasi di log Dev/staging dan laporkan.
3. Enrichment produk (`lib/product-bulk-worker.js` ~141–151) memanggil `genAI.getGenerativeModel({ model: resolvedPrimary })` **langsung**, tanpa `makeModelResilient`/waterfall, sehingga tidak ada model cadangan. Hal yang sama ada di `lib/sheets-autopilot-worker.js` ~689.
4. `executeWithKeyPool` menghitung kuota key per model berdasarkan `targetModel` = `options.modelName || gemini_model_primary`, **bukan model yang benar-benar dipanggil**. Bukti: enrichment Cuculemon (17 Nov 14:34) gagal 503 di 5 key (AISKey_13/14/16/17/18). Log mencatat `model=gemini-3.5-flash-lite` (primary tenant), padahal yang dipanggil adalah model dari matriks (`gemini-3.6-flash` untuk free). Error akhirnya berbunyi "QUOTA_EXHAUSTED", padahal kuota masih ada; modelnya yang sibuk.
5. `resolveStartFrameQcModel` (~1245) memanggil `getResolvedGeminiModels('compliance_audit')` dengan **string**, padahal fungsi itu menerima objek `{ taskType }`. Argumennya diabaikan.
6. **Model tertanam di luar `lib/gemini.js`.** Semua lokasi sudah dicek, dan **semuanya memanggil API Gemini sungguhan, tanpa model cadangan**, mengabaikan Settings. Daftar lengkap dan tindakannya ada di bagian **Desain → 2b**.

## Desain yang diminta

### 1. Satu resolver
Di `lib/gemini.js`, buat satu fungsi publik, misalnya:
```js
resolveModelChain({ role, taskType, modelOverride }) → { model, chain: [model, ...cadangan] }
```
- `role` ∈ `'primary' | 'light' | 'vision'`. Pemetaan tugas → role ditulis sebagai tabel **tanpa nama model**:
  - `light`: `SCRAPER`, `OCR_EXTRACTION`, `COMPLIANCE`, `DECONSTRUCT`, `PRODUCT_ENRICHMENT` (baru)
  - `vision`: pemeriksa gambar (start frame QC, photo picker, crop, final check foto produk)
  - `primary`: semua tugas kreatif (yang sudah ada di daftar `isCreativeTask`)
- Sumber model, semuanya dari Settings tenant aktif:
  - `primary` → `gemini_model_primary`
  - `light` → setting baru `gemini_model_light`. Jika kosong **atau** `gemini_smart_routing = off` → pakai `gemini_model_primary`.
  - `vision` → `start_frame_visual_qc_model`. Jika kosong → `gemini_model_light` → `gemini_model_primary`.
- `chain` = [model role] → `gemini_model_fallback` → `gemini_model_primary` → sisa `GEMINI_CASCADE_ORDER_*`, tanpa duplikat.
- Satu daftar model yang dikenal (`KNOWN_GEMINI_MODELS`) dipakai bersama oleh resolver dan dropdown Settings. Model yang tidak ada di daftar dilewati dengan peringatan di log.
- `modelOverride` eksplisit dari pemanggil tetap dihormati (dipakai panel Eksperimen).

### 2. Bersihkan sumber lama
- `MODULE_MODEL_MATRIX`: hapus nama model, sisakan hanya flag non-model (`useKB`) dan role.
- Hapus `gemini-1.5-flash-8b` dan `gemini-1.5-flash` dari semua daftar cascade dan konstanta.
- `GEMINI_MODELS.PRIMARY/SCRAPER/COMPLIANCE/FALLBACK_*`: ganti pemakaiannya dengan resolver. `GEMINI_MODELS.TTS` dibiarkan.
- `resolveModelForTask` dan `getResolvedGeminiModels`: pertahankan nama dan bentuk keluarannya (banyak pemanggil), tetapi isinya memanggil resolver baru, supaya pemanggil lama tidak rusak.
- Perbaiki pemanggilan string di `resolveStartFrameQcModel`.
### 2b. Pusatkan semua model tertanam ke Settings (wajib, tanpa pengecualian)

**Aturan:** tidak boleh ada lagi nama model Gemini teks/vision tertulis langsung di luar `lib/gemini.js` (dan daftar model bersama untuk dropdown). Setiap pemanggilan Gemini wajib:
1. mengambil model lewat `resolveModelChain({ role, taskType })`;
2. memakai rantai cadangan (`makeModelResilient` atau `generateContentFlexible`), bukan `genAI.getGenerativeModel({ model: '…' })` polos;
3. mengirim `modelName` yang benar-benar dipakai ke `executeWithKeyPool` (lihat bagian 4).

Hasilnya: kalau pengguna mengganti model di Settings, **semua** fitur di tabel ini ikut berubah.

> **Catatan urutan:** Instant Factory dan Sheets Autopilot akan dihapus lewat `antigravity_hapus_instant_factory_sheets_autopilot_instructions.md`. Kerjakan instruksi itu **lebih dulu**. Setelah itu baris 1–6 di tabel ini (dan `lib/sheets-autopilot-worker.js`) gugur sendiri, tidak perlu dipusatkan. Jika penghapusan belum terjadi, tetap pusatkan semua baris.

| # | Lokasi (`main`) | Fitur | Sekarang | Role & taskType baru |
|---|---|---|---|---|
| 1 | `app/api/v2/instant-factory/route.js` ~96 | Instant Factory: ekstraksi produk dari URL | `'gemini-2.5-flash'`, tanpa cadangan | `light` / `SCRAPER` |
| 2 | `app/api/v2/instant-factory/route.js` ~355 | Instant Factory: generate konten (master prompt) | `'gemini-2.5-flash'`, tanpa cadangan | `primary` / `INSTANT_FACTORY` |
| 3 | `app/api/v2/instant-factory/regenerate/route.js` ~111 | Instant Factory: regenerate | `'gemini-2.5-flash'`, tanpa cadangan | `primary` / `INSTANT_FACTORY` |
| 4 | `app/api/v2/instant-factory/[id]/run/route.js` ~212 | Instant Factory: run | `'gemini-2.5-flash'`, tanpa cadangan | `primary` / `INSTANT_FACTORY` |
| 5 | `app/api/sheets-autopilot/repair-storyboard-clip/route.js` ~108 | Sheets Autopilot: ekstraksi data produk | `'gemini-2.5-flash'`, tanpa cadangan | `light` / `SCRAPER` |
| 6 | `app/api/sheets-autopilot/repair-storyboard-clip/route.js` ~230 | Sheets Autopilot: perbaikan klip storyboard | `'gemini-2.5-flash'`, tanpa cadangan | `primary` / `SHEETS_AUTOPILOT` |
| 7 | `app/api/v2/brand-profiles/extract/route.js` ~65 | Brand Profile: ekstraksi brand dari dokumen/URL | `'gemini-2.5-flash'`, tanpa cadangan | `light` / `BRAND_EXTRACTION` (baru) |
| 8 | `lib/threads-series-generator.js` ~92 | Threads Labs: cadangan saat model utama gagal | cadangan tertulis `'gemini-2.5-flash'` | `primary` / `THREADS_SERIES`; ganti blok try/catch manual dengan rantai dari resolver |
| 9 | `lib/re-recomm-engine.js` ~40 | RE: analisa video + Google Search grounding (REST langsung) | `GEMINI_MODELS.PRIMARY` (konstanta) | `primary` / `RE_CAMPAIGN`. REST tetap boleh dipakai (grounding), tetapi model dari resolver dan dicoba berurutan sesuai `chain` saat 503/404 |
| 10 | `lib/universe-ai-builder.js` ~115, `lib/visual-identity-ai-builder.js` ~355, ~396, `lib/universe-ai-repository.js` ~36 | Universe & Visual Identity builder: metadata `model` | konstanta `GEMINI_MODELS.PRIMARY` / `'gemini-3.6-flash'`, yang belum tentu model sebenarnya | Isi dengan **model yang benar-benar dipakai** (dari hasil pemanggilan/trace). Pastikan pemanggilan Gemini di builder itu sendiri juga lewat resolver |
| 11 | `lib/tenant-admin.js` ~40 | Pembuatan tenant baru | menyimpan `gemini_model: 'gemini-2.5-flash'`, key yang **tidak dibaca di mana pun** | Hapus key mati itu. Tenant baru disalin dari pengaturan model `default_tenant` (`gemini_model_primary`, `gemini_model_fallback`, `gemini_model_light`, `gemini_smart_routing`), tanpa nama model tertulis |
| 12 | `lib/scheduler-processors.js` ~5316, `app/api/keys/route.js` ~9, `lib/db.js` ~937 (`DEFAULT_POOL_MODEL`) | Rem kuota pool, halaman API Keys, default pool | `|| 'gemini-3.6-flash'` | Ambil dari resolver (`role: 'primary'`). Satu konstanta default saja di `lib/gemini.js`, dipakai bila Settings benar-benar kosong |

Selain tabel di atas: cari semua `getGenerativeModel(` di `lib/` dan `app/` (temuan sebelumnya: `lib/product-bulk-worker.js` ~141, `lib/sheets-autopilot-worker.js` ~689). **Semua** yang memanggil Gemini teks/vision dipindah ke resolver + rantai cadangan, kecuali TTS, generasi gambar, dan embedding (di luar lingkup). Daftar lengkap hasil pencarian beserta tindakannya masuk laporan.

**Halaman Settings:** taskType baru (`PRODUCT_ENRICHMENT`, `BRAND_EXTRACTION`, `THREADS_SERIES`) cukup masuk tabel pemetaan role. Tidak perlu dropdown per fitur: pengguna hanya mengatur Model utama, Model cadangan, Model ringan, dan Model pemeriksa.

### 3. Enrichment dan pemakai langsung `getGenerativeModel` mendapat cadangan
- `lib/product-bulk-worker.js` (enrichment) dan `lib/sheets-autopilot-worker.js` ~689: pakai `makeModelResilient` (seperti scraper di `lib/scheduler-processors.js` ~10565) atau `generateContentFlexible`, dengan `chain` dari resolver dan `taskType: 'PRODUCT_ENRICHMENT'`.
- Cari pemakaian `getGenerativeModel(` lain yang tidak dibungkus resilient. Daftarkan di laporan, dan ubah hanya yang memakai pilihan model dari matriks/konstanta.

### 4. Kuota key per model yang benar
- `executeWithKeyPool` menerima `options.modelName` = model yang benar-benar dipanggil (dari resolver). Saat waterfall berpindah model di tengah jalan, `poolCtx.lastModel` harus berisi model aktif (cek `recordGeminiHttpCall`).
- Error akhir dibedakan:
  - semua percobaan 503 → `MODEL_BUSY (dapat diulang): model <x> sedang sibuk`;
  - 429 harian → `QUOTA_EXHAUSTED: ...` (tetap).
- Pemeriksaan "dapat diulang" di `lib/product-bulk-worker.js` (Revisi 02 S9) dan `enrichment_retryable` di `GET /api/v2/products/[id]` juga mengenali `MODEL_BUSY`.

### 5. UI Settings
- Tambah dropdown **"Model ringan (tugas kecil: scraper, enrichment, OCR, compliance)"** di bagian model Gemini `app/settings/page.js`, di samping Primary/Fallback. Opsi kosong = "Sama dengan model utama".
- Saklar Smart Routing tetap ada. Ganti keterangannya: *"Jika aktif, tugas kecil memakai Model ringan. Jika mati, semua tugas memakai Model utama."*
- "Model Pemeriksa" di panel Eksperimen dibiarkan, tapi tambahkan teks kecil bahwa jika kosong ia mengikuti Model ringan.
- Hapus opsi model mati (`gemini-1.5-flash-8b`, `gemini-1.5-flash`) dari dropdown.
- Sesuai SOP: **mockup HTML dulu** (`public/mockup_settings_model_ai.html`), sinkronkan hanya file itu ke staging untuk review, dan **tunggu persetujuan** sebelum mengubah UI. Hanya token CSS semantik.
- Simpan setting baru lewat `app/api/settings/route.js` (per tenant, seperti setting Gemini lain).

### 6. Migrasi aman (tanpa mengubah data otomatis)
- **Jangan** mengisi atau mengubah `tenant_settings` di staging. Tenant tanpa `gemini_model_light` otomatis mengikuti model utama.
- Buat skrip **dry-run** `scripts/report-effective-gemini-models.mjs --schema dev|staging` yang mencetak tabel: per tenant × per tugas (scraper, enrichment, compliance, deconstruct, vision, storyboard) → model **sebelum** (logika lama) dan **sesudah** (resolver baru). Sertakan hasilnya di laporan agar pengguna tahu dampaknya per tenant, terutama Mas Ibnu (paid) dan `default_tenant` (primary `gemini-3.5-flash-lite`).

## Branch dan alur (SOP `AGENTS.md`)

- Ini perubahan lintas fitur (mempengaruhi semua produksi konten): branch **`fitur/model-ai-terpusat`** dari `main` terbaru, deploy ke **Dev** dulu.
- Jika saat audit terbukti tenant Mas Ibnu memang gagal karena `gemini-1.5-flash-8b`, perbaikan minimal (ganti entri `paid` matriks ke model aktif) boleh diusulkan sebagai **hotfix terpisah** `hotfix/model-scraper-paid`. Itu pun hanya setelah melaporkan bukti dan mendapat izin pengguna.
- Naik ke staging hanya setelah pengguna menyatakan lolos uji di Dev.

## Tes yang wajib

1. `tests/gemini-model-resolver.test.js` (getSetting di-mock per tenant):
   - smart routing on + `gemini_model_light` kosong → tugas `light` memakai primary;
   - smart routing on + light terisi → tugas `light` memakai light, tugas kreatif memakai primary;
   - smart routing off → semua tugas memakai primary;
   - `vision` kosong → light → primary;
   - tier paid **tidak pernah** menghasilkan `gemini-1.5-flash-8b`/`gemini-1.5-flash`;
   - `chain` tanpa duplikat dan diawali model role;
   - `modelOverride` menang.
2. Enrichment: model pertama dilempar 503 → berhasil di model cadangan (generator di-mock). Semua model 503 → error `MODEL_BUSY` dan `enrichment_retryable = true`.
3. `executeWithKeyPool`: `incrementKeyUsage`/`markKeyExhausted` dipanggil dengan model yang benar-benar dipakai.
4. **Instant Factory, Brand extraction, Sheets Autopilot repair, Threads, RE:** untuk tiap lokasi di tabel 2b, satu tes dengan Settings tenant di-mock (mis. primary `gemini-3.6-flash`, light `gemini-3.5-flash-lite`). Model yang dipanggil harus sesuai role. Saat model pertama 503, harus pindah ke cadangan.
5. **Tenant baru** (`lib/tenant-admin.js`): pengaturan model disalin dari `default_tenant`, dan tidak ada key `gemini_model`.
6. **Tes penjaga:** pindai `lib/` dan `app/` (kecuali `lib/gemini.js`, daftar model bersama, file TTS, dan provider gambar). Gagal jika ada literal `'gemini-<angka>…'` baru, agar model tidak tertanam lagi.
7. Jalankan juga: `npm run test:product-catalog`, `npm run test:mcp`, tes produk/scraper yang ada (`tests/product-*.test.js`, `tests/url-scraper-*.test.js`), dan `npm run build`.

## Kriteria selesai

Dev (5020):
- [ ] Tabel model efektif sebelum/sesudah (dry-run skrip) untuk schema `dev` dan `staging` ada di laporan.
- [ ] Enrichment satu produk uji di Dev berhasil. Log `[GEMINI_CALL]` mencatat model yang sesuai Settings, dan pool mencatat model yang sama.
- [ ] Simulasi 503 (atau saat model memang sibuk) berpindah ke model cadangan, bukan gagal.
- [ ] Mengubah model di Settings Dev langsung mengubah model scraper/enrichment (dibuktikan lewat log).
- [ ] Mockup Settings disetujui pengguna, lalu UI terpasang di Dev.
- [ ] Tidak ada regresi di OPC/RE/Multiplier/Recipe (uji satu storyboard di Dev dan bandingkan model di log).
- [ ] Uji nyata di Dev minimal satu kali untuk Instant Factory, ekstraksi Brand Profile, dan Threads series. Log `[GEMINI_CALL]` menunjukkan model dari Settings Dev, bukan `gemini-2.5-flash` tertulis.
- [ ] `git grep -nE "['\"\`]gemini-[0-9]" -- lib app` hanya menemukan file yang dikecualikan (lib/gemini.js, daftar model bersama, TTS, provider gambar).

## Larangan

- Jangan mengubah `tenant_settings`, `gemini_key_pool`, API key, atau kuota di staging/production.
- Jangan merge ke `main`, rilis, atau deploy staging tanpa izin eksplisit pengguna. Production dilarang.
- Jangan mengubah isi prompt atau logika di luar pemilihan model dan cadangan.
- Jangan menyentuh model TTS, model generasi gambar, atau embedding.
- Jangan menulis API key asli di kode, tes, atau mockup.
- Akses staging hanya baca (`SELECT`, log). Jangan polling SSH berulang.

## Format laporan balik

Bahasa Indonesia sederhana untuk marketer:
1. Ringkasan 3–5 kalimat: apa yang sekarang dipusatkan, apa yang berubah untuk pengguna di menu Settings.
2. Tabel model efektif per tenant × tugas, sebelum/sesudah, **termasuk Instant Factory, Brand extraction, Sheets Autopilot, Threads, RE**. Tandai baris yang berubah. Contoh: tenant PT GIM sebelumnya selalu `gemini-2.5-flash` di Instant Factory, sesudahnya mengikuti Settings.
3. Temuan tenant Mas Ibnu (paid): terbukti gagal atau tidak, dengan potongan log.
4. Daftar file yang diubah dan daftar pemakaian `getGenerativeModel` langsung yang ditemukan (diubah/dibiarkan + alasan).
5. Hasil tes, build, dan uji Dev. Link mockup dan status persetujuannya.
6. Branch, commit, SHA, dan link Dev.
7. Pertanyaan izin: *"Boleh naik ke staging?"*, plus usulan isi `gemini_model_light` per tenant (diisi pengguna sendiri lewat Settings, bukan oleh agen).
