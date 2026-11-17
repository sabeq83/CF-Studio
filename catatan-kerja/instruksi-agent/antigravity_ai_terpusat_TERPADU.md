# Instruksi Terpadu Antigravity: Model AI Terpusat di Settings

> Satu dokumen ini cukup untuk mulai bekerja. Detail teknis lengkap (nomor baris, bukti) ada di `antigravity_model_ai_terpusat_instructions.md`. Pakai sebagai referensi bila perlu; jika bertentangan, **dokumen ini yang berlaku**.

## Tujuan (satu kalimat)

Semua pemanggilan Gemini (teks & vision) mengambil model dari **menu Settings tenant**, dan selalu punya **model cadangan** bila model utama sibuk.

## Kenapa

- Fitur seperti scraper dan enrichment produk mengabaikan Settings, karena tertimpa daftar model di kode (`MODULE_MODEL_MATRIX` di `lib/gemini.js`, "smart routing").
- Tenant berbayar (Mas Ibnu) diarahkan ke `gemini-1.5-flash-8b`, model yang sudah mati.
- Enrichment produk tanpa model cadangan, sehingga gagal saat model sibuk (503) dan pesannya keliru "kuota habis".
- Masih ada nama model tertulis langsung di beberapa file.

## Langkah 0: Siapkan branch (5 menit)

1. Amankan perubahan dokumen yang belum di-commit di folder kerja (`catatan-kerja/**`). Commit ke branch yang sedang aktif atau stash. **Jangan dibuang.**
2. Buat branch **`fitur/model-ai-terpusat` dari `fitur/hapus-instant-sheets`** (bukan dari `main`). Alasannya: penghapusan Instant Factory/Sheets belum masuk `main`, dan dengan cara ini pengguna cukup menguji **satu kali di Dev** untuk keduanya. Nanti keduanya digabung ke `main` bersamaan.

## Langkah 1: Satu sumber model

Di `lib/gemini.js`, buat satu fungsi pemilih model, misalnya `resolveModelChain({ role, taskType })`. Fungsi ini mengembalikan model pertama + daftar cadangan.

| Role | Dipakai untuk | Diambil dari Settings |
|---|---|---|
| `primary` | tugas kreatif (storyboard, naskah, OPC, RE, Multiplier, Recipe, Threads, YouTube Studio, builder Universe/VI) | `gemini_model_primary` |
| `light` | tugas kecil (scraper, enrichment produk, OCR, compliance, deconstruct, ekstraksi brand) | `gemini_model_light` (**baru**). Kosong atau Smart Routing **off** → pakai primary |
| `vision` | pemeriksa gambar (start-frame QC, pemilih/crop/cek foto produk) | `start_frame_visual_qc_model`. Kosong → light → primary |

Cadangan = model role → `gemini_model_fallback` → `gemini_model_primary` → daftar cascade (tanpa duplikat).

Lalu:
- `MODULE_MODEL_MATRIX`: buang semua **nama model**. Sisakan pemetaan tugas → role dan flag `useKB`.
- Hapus `gemini-1.5-flash-8b` dan `gemini-1.5-flash` dari semua daftar.
- `resolveModelForTask` dan `getResolvedGeminiModels` tetap ada (banyak pemanggil), tetapi isinya memanggil fungsi baru.
- Perbaiki `getResolvedGeminiModels('compliance_audit')`, yang memakai string, bukan `{ taskType }`.

## Langkah 2: Pakai di semua tempat

Ganti setiap `genAI.getGenerativeModel({ model: '…' })` polos dan setiap nama model tertulis langsung dengan fungsi di Langkah 1, **plus pembungkus cadangan** (`makeModelResilient` atau `generateContentFlexible`). Lokasi yang sudah diketahui (cari ulang dengan `git grep`):

- `lib/product-bulk-worker.js` (enrichment produk): role `light`
- `app/api/v2/brand-profiles/extract/route.js`: `light`
- `lib/threads-series-generator.js` (cadangan tertulis `gemini-2.5-flash`): `primary`
- `lib/re-recomm-engine.js` (REST + grounding, pakai `GEMINI_MODELS.PRIMARY`): `primary`, dicoba berurutan sesuai cadangan
- `lib/universe-ai-builder.js`, `lib/visual-identity-ai-builder.js`, `lib/universe-ai-repository.js`: metadata `model` = model yang **benar-benar** dipakai
- `lib/tenant-admin.js`: hapus key mati `gemini_model`. Tenant baru menyalin pengaturan model dari `default_tenant`
- Default `|| 'gemini-3.6-flash'` di `lib/scheduler-processors.js` (rem kuota), `app/api/keys/route.js`, `lib/db.js` (`DEFAULT_POOL_MODEL`): ambil dari fungsi baru

**Di luar lingkup (jangan disentuh):** model TTS, model pembuat gambar (`lib/product-photo-providers/gemini.js`), dan embedding.

## Langkah 3: Pencatatan kuota dan pesan error

- `executeWithKeyPool` mencatat kuota key untuk **model yang benar-benar dipanggil**, bukan model utama tenant.
- Semua percobaan 503 → error `MODEL_BUSY (dapat diulang): model <x> sedang sibuk`. Hanya 429 harian yang boleh berbunyi `QUOTA_EXHAUSTED`.
- `enrichment_retryable` di detail produk juga mengenali `MODEL_BUSY`.

## Langkah 4: Settings (UI kecil)

- Tambah satu dropdown **"Model ringan (tugas kecil)"** di bagian model Gemini `app/settings/page.js`. Opsi kosong = "Sama dengan model utama". Simpan per tenant lewat `app/api/settings/route.js`.
- Ganti keterangan saklar Smart Routing: *"Aktif: tugas kecil memakai Model ringan. Mati: semua memakai Model utama."*
- Buang model mati dari dropdown.
- Sesuai SOP: buat mockup `public/mockup_settings_model_ai.html` dulu, kirim linknya, dan **lanjutkan backend sambil menunggu**. Pasang UI setelah pengguna setuju. Hanya token CSS semantik.

## Langkah 5: Tes & bukti

Tes otomatis (wajib lulus):
1. Pemilih model: smart routing on/off, light kosong/terisi, vision kosong, tier paid tidak pernah menghasilkan model mati, cadangan tanpa duplikat.
2. Enrichment: model pertama 503 → berhasil di cadangan. Semua 503 → `MODEL_BUSY`.
3. Pencatatan kuota memakai model yang benar-benar dipanggil.
4. Penjaga: `git grep -nE "['\"\`]gemini-[0-9]" -- lib app` hanya menemukan `lib/gemini.js`, daftar model dropdown, TTS, dan provider gambar.
5. `npm run build`, `npm run test:mcp`, `npm run test:product-catalog`, tes produk/scraper yang ada.

Bukti untuk pengguna:
- Skrip dry-run `scripts/report-effective-gemini-models.mjs --schema staging`: tabel per tenant × tugas, model **sebelum** dan **sesudah**. Hanya baca, tanpa mengubah data.
- Deploy branch ke **Dev** (`npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`).
- Di Dev: enrichment satu produk berhasil, dan log `[GEMINI_CALL]` menunjukkan model dari Settings Dev. Ganti model di Settings Dev → model di log ikut berubah.

## Larangan

- Jangan mengubah `tenant_settings`, API key, pool, atau kuota di staging/production. Pengguna sendiri yang mengisi "Model ringan" lewat Settings.
- Jangan mengubah isi prompt.
- Jangan merge ke `main`, rilis, atau deploy staging tanpa izin pengguna. Production dilarang.
- Akses staging hanya baca.

## Laporan balik (singkat, Bahasa Indonesia sederhana)

1. 3–5 kalimat: apa yang berubah untuk pengguna di Settings.
2. Tabel model sebelum → sesudah per tenant (tandai yang berubah, terutama Mas Ibnu).
3. Hasil tes dan uji Dev. Link mockup Settings.
4. Branch, SHA, dan link Dev, plus daftar cek uji Dev **gabungan**: penghapusan Instant/Sheets + model AI terpusat.
5. Pertanyaan: *"Boleh kedua branch digabung ke main dan naik ke staging?"*
