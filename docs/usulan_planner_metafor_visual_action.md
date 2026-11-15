# Usulan: Visual Action Hook Planner Tidak Mengikuti Gaya "Metafora"

**Kasus:** Content Planner `pln_7d6363e0` (staging) — "dapurbotani - 20261114 - Garlibee Madu - hipertensi"
**Tanggal periksa:** 15 Nov 2026 · Versi staging: `b67beec` (v2.48.8, sama dengan `main`)

---

## 1. Temuan di data

Pengaturan planner tersimpan dengan benar:

| Field | Nilai |
|---|---|
| `visual_style` | `metaphoric_faceless` ✅ |
| `hook_visual_mode` | `problem_first` |
| `planner_focus` | `product_campaign` |

Artinya pilihan "Metafora" **sampai ke mesin**. Masalahnya ada pada hasil AI-nya:

| # | Hook (teks) | Visual Action (hasil) | Metafora? |
|---|---|---|---|
| 1 | "Saat saluran sempit ini terhambat…" | Tensi meter angka tinggi di ruang keluarga, tangan cemas | ❌ adegan realis |
| 2 | "Mesin sekuat ini bisa mendadak mogok…" | Studio botani, tangan ambil bawang lanang dalam madu | ❌ adegan bahan |
| 3 | "Cairan yang mengental lambat…" | Sendok kayu angkat madu menetes | ❌ adegan bahan |
| 4 | "Waktu tiga bulan mengubah sifat keras…" | Toples Garlibee berjejer di rak | ❌ produk di klip 1 |
| 5 | "Ketenangan di hari tua…" | Jar Garlibee + air hangat di nakas | ❌ produk di klip 1 |
| 6 | "Satu langkah kecil setiap hari…" | Tangan buka tutup jar Garlibee | ❌ produk di klip 1 |

Dua hal mencolok:
- **Teks hook** baris 1–3 adalah **salinan persis** contoh di prompt. Jadi AI hanya "menyontek" contoh untuk hook, tapi tidak menerjemahkan analoginya ke visual (pipa berkerak, cairan keruh, dll).
- **0 dari 6** visual action berupa analogi benda. Baris 4–6 bahkan menampilkan produk di detik pertama, padahal mode `problem_first` melarang itu.

---

## 2. Penyebab (di `lib/content-planner-engine.js`, pemanggilan AI ke-2 "Creative")

**A. Aturan metafora saling bertabrakan dengan aturan lain di prompt yang sama**
- Aturan metafora poin 2 (baris ~970): visual action = analogi benda.
- Aturan metafora poin 3 (baris ~971): "SANGAT DIPERBOLEHKAN" studio botani, madu, sendok kayu untuk adegan solusi/konsumsi. Satu baris planner = satu video, dan visual action-nya adalah **adegan hook**, tapi aturan ini tidak membatasi bahwa izin studio botani **bukan** untuk hook. AI memakainya untuk semua baris (baris 2, 3, 6).
- Kontrak Visual Action umum (baris ~1013–1016) untuk `problem_first` berkata: *"fokuskan visual pada ekspresi frustrasi, situasi dilema nyata sehari-hari…"* — ini justru mendorong adegan realis (baris 1: tensi meter di ruang keluarga). Kontrak ini **tidak punya cabang khusus metafora**.

**B. Arahan metafora tenggelam oleh Knowledge Base realis**
`getCreativeGeneratorKB()` (`lib/kb-loader.js:134`) selalu memuat `REALIST_VIRAL_NARRATIVE` dan `VISUAL_STYLE_GUIDE` untuk dunia nyata. Teks ini sangat panjang dan diletakkan **setelah** arahan metafora, sehingga arahan metafora yang pendek kalah bobot.

**C. Contoh hook ditulis sebagai kalimat jadi, tanpa pasangan visualnya**
Prompt memberi 3 contoh hook lengkap, tanpa contoh visual analoginya. AI menyalin kalimatnya, tapi tidak tahu "pipa berkerak" adalah visual untuk "saluran sempit terhambat".

**D. Tidak ada pemeriksaan setelah AI menjawab**
Setelah hasil keluar (baris ~1160), tidak ada cek apakah visual action benar-benar metafora atau apakah produk muncul di klip 1. Hasil yang melenceng langsung disimpan dengan status `pass`.

---

## 3. Usulan Perbaikan

### U1 — Pisahkan tegas "adegan hook" vs "adegan solusi" (prioritas tinggi)
Ubah aturan metafora menjadi:
- Field `visual_action` = **adegan hook (klip 1) saja** → WAJIB analogi fisik benda nyata yang mewakili kondisi tubuh (contoh: pipa transparan berkerak, cairan merah mengental di selang, mesin berkarat tersendat, filter kopi tersumbat).
- DILARANG di `visual_action`: tensi meter/alat medis, wajah/ekspresi orang, bahan produk (madu, bawang), kemasan produk.
- Izin studio botani/madu/sendok kayu **dipindah** ke catatan "untuk klip solusi di tahap storyboard", bukan untuk field ini.

### U2 — Beri cabang khusus metafora di Kontrak Visual Action
Bila gaya = metafora, kalimat `problem_first` tentang "ekspresi frustrasi, situasi nyata sehari-hari" **diganti** dengan: *"Klip 1 = analogi benda; masalah ditunjukkan lewat perilaku benda, bukan lewat manusia atau alat medis."*

### U3 — Ganti contoh hook menjadi pasangan Hook + Visual, dan larang menyalin
Contoh:
- Hook: "Saat saluran sempit terhambat, seluruh aliran ikut terhenti perlahan!" → Visual: *makro pipa kaca bening, kerak kuning menebal di dinding pipa, aliran cairan merah melambat lalu tersendat.*
Tambahkan aturan: *"Contoh hanya pola. DILARANG menyalin kalimat contoh; setiap baris wajib memakai benda analogi yang berbeda."*

### U4 — Kurangi bobot KB realis saat gaya metafora
Saat `metaphoric_faceless`, jangan muat `REALIST_VIRAL_NARRATIVE` (atau muat versi ringkas), dan pindahkan arahan metafora ke **bagian paling akhir** prompt (dekat format output) agar paling diingat AI.

### U5 — Tambah pemeriksa otomatis + 1x perbaikan ulang
Setelah AI menjawab, cek tiap baris bila gaya metafora:
- Visual action mengandung kata produk/bahan (nama produk, "jar", "toples", "madu", "bawang") → gagal.
- Mengandung alat medis/wajah ("tensi", "dokter", "wajah", "ekspresi") → gagal.
- Hook sama persis dengan contoh di prompt → gagal.
Baris yang gagal di-generate ulang satu kali hanya untuk field `visual_action` (fungsi regenerasi per-field sudah ada di baris ~1588). Jika tetap gagal, tandai `validation_status = 'warning'` agar terlihat di UI, bukan `pass`.

### U6 — Samakan juga di fitur "Regenerate Visual Action" per baris
Fungsi regenerasi (baris ~1509–1600) memakai arahan metafora yang sama, jadi U1–U3 harus diterapkan juga di sana supaya tombol regenerate tidak menghasilkan masalah yang sama.

---

## 4. Langkah sementara untuk planner `pln_7d6363e0`
Sebelum perbaikan kode: pakai tombol **Regenerate Visual Action** per baris dengan instruksi tambahan seperti *"buat analogi benda (pipa/cairan/mesin), tanpa produk, tanpa orang"*. Catatan: hasilnya masih belum dijamin karena masalah A–C juga ada di fungsi regenerasi.

---

## 5. Cara uji setelah perbaikan
1. Buat planner baru dengan produk & pengaturan yang sama (Metafora + Problem-First), 6 baris.
2. Lulus bila: 6/6 visual action berupa analogi benda, 0 produk/bahan/alat medis di visual action, tidak ada hook yang sama persis dengan contoh, dan tiap baris memakai benda analogi berbeda.
3. Uji pembanding gaya "Investigasi" dan "Cinematic" untuk memastikan tidak ikut berubah.
4. Tambah unit test di `tests/` untuk pemeriksa U5.

## 5b. Lampiran: Peta KB (dicek 15 Nov 2026, versi b67beec)

**Planner (`lib/content-planner-engine.js`, panggilan langsung ke Gemini, tanpa cache):**
| Tahap | KB |
|---|---|
| Call 1 Strategic Skeleton | STRATEGIC_FRAMEWORKS (15 KB), STRATEGIC_DECISION_TREE (3 KB), + KB domain bila ada |
| Call 2 Creative (hook + visual) & Regenerate per baris | NARRATIVE_STRUCTURE (12 KB), **REALIST_VIRAL_NARRATIVE (49 KB)**, **VISUAL_STYLE_GUIDE (33 KB)**, BRAND_VOICE (3 KB), PLATFORM_COPYWRITING (8.5 KB), COMPLIANCE (19 KB), **PROMPT_SYSTEM (140 KB)**, + KB domain bila ada |
| Catatan | Total Call 2 ±265 KB (±65 ribu token), sama untuk semua gaya non-kartun. **OBJECT_METAPHOR_STORYTELLING_KB tidak dimuat** walau gaya = Metafora. `getReviewerKB` diimpor tapi tidak dipakai. |

**Storyboard (Strategic Generator → `buildPillarSharedPromptContext` di `lib/prompts.js`):**
| Jenis | KB |
|---|---|
| product_campaign / brand_editorial / custom_storyboard / Visual Identity v2 (termasuk planner ini) | Micro-KB: Dynamic Story Curve (dibuat otomatis) + OBJECT_METAPHOR_STORYTELLING_KB (bila Metafora) atau INVESTIGATION_NARRATIVE_KB (bila Investigasi) + brand voice dari profil (≤1000 karakter) + Food KB (≤1200, bila kuliner) + COMPLIANCE (≤1000). **Tanpa REALIST & VISUAL_STYLE.** |
| Pillar campaign lama (tanpa jenis) | STRATEGIC_FRAMEWORKS, PROMPT_SYSTEM, NARRATIVE_STRUCTURE, BRAND_VOICE, PLATFORM_COPYWRITING, COMPLIANCE + (REALIST + VISUAL_STYLE) atau (Metafora KB + VISUAL_STYLE) atau (Investigasi KB + VISUAL_STYLE) |
| Cache master KB Gemini | Hanya untuk tugas `useKB: true` (mis. PILLAR_CAMPAIGN, SHEETS_AUTOPILOT, INSTANT_FACTORY, YOUTUBE_STUDIO) di tenant paid + caching on. Isinya seluruh 12 KB termasuk REALIST & VISUAL_STYLE. Storyboard planner (PRODUCT_CAMPAIGN_CREATIVE) tidak memakainya. |

**Proses lain yang masih memuat REALIST/VISUAL_STYLE:** Narration Agent & Visual Agent (alur 4-tahap lama), Reverse Engineering + Bridge (viral deconstruct), Instant Factory (3 route), Sheets Autopilot, Multiplier Angle Generator.

**Draf versi ringan:** `docs/kb-lite-draft/REALIST_VIRAL_NARRATIVE_LITE.md` dan `docs/kb-lite-draft/VISUAL_STYLE_GUIDE_LITE.md` (khusus planner, belum dipakai kode).

## 6. File yang tersentuh
- `lib/content-planner-engine.js` (arahan metafora ±baris 962–975 dan 1519+, kontrak visual action ±1010–1017, validasi pasca-AI ±1160)
- `lib/kb-loader.js` (`getCreativeGeneratorKB` — opsi tanpa KB realis untuk metafora)
- `tests/` (tes baru untuk validasi metafora)

---

# BAGIAN 2 — Arah Lanjutan (diskusi 15 Nov 2026)

## 7. Kapan storyboard, VO, dan aksi visual lengkap disusun?
**Keputusan usulan:** tetap disusun di tahap OPC (setelah ingest dari planner), tetapi planner tahap 2 menghasilkan **brief kreatif yang dikunci** dan wajib dipatuhi OPC.

Alasan tidak dipindah ke planner:
- Hemat: tidak semua baris planner diproduksi; storyboard lengkap untuk semua baris membuang biaya AI dan waktu.
- Pengaturan produksi (jumlah klip, durasi, suara VO, bridging, visual identity) baru diputuskan di OPC.
- Mesin storyboard (Single-Pass Engine, KB metafora, QC) sudah matang di OPC.
- Revisi baris planner ringan; revisi storyboard lengkap berat.

Isi brief kreatif yang dikunci per baris (memanfaatkan kolom `content_contract_json` / `content_payload_json` yang sudah ada):
- Hook (kalimat VO pembuka)
- Adegan pembuka + benda metafora (bila gaya Metafora)
- Alur 3 babak singkat: masalah → kenapa penting → solusi
- Klip kemunculan produk
- Gaya visual terpilih

OPC wajib membaca brief ini sebagai input terkunci, bukan menafsir ulang.

## 8. Penyederhanaan KB + Prompt System untuk Planner Tahap 2
**Target:** 1 KB planner baru ±10–15 KB menggantikan ±265 KB sekarang.

Isi KB planner baru:
- Aturan hook & aksi visual (basis: draf `docs/kb-lite-draft/*_LITE.md`)
- 1 blok per gaya visual (Metafora, Investigasi, Cinematic, Produk)
- Ringkasan compliance (larangan klaim & testimoni)
- Brand voice

Yang dikeluarkan dari planner: PROMPT_SYSTEM (140 KB, untuk prompt video, bukan untuk hook), REALIST & VISUAL_STYLE versi penuh, PLATFORM_COPYWRITING penuh.
KB gaya dimuat sesuai pilihan (Metafora → OBJECT_METAPHOR_STORYTELLING_KB; Investigasi → INVESTIGATION_NARRATIVE_KB).

Penyesuaian dengan panduan Gemini API (cek ulang ke dokumentasi resmi sebelum implementasi):
1. Aturan dikirim lewat kolom `systemInstruction`, bukan digabung dengan data di pesan user (sekarang `callGeminiJson` menggabungkan keduanya).
2. Format output dikunci dengan `responseSchema` (structured output), bukan dijelaskan dengan teks.
3. Instruksi pendek & lugas; kurangi huruf kapital, "WAJIB", "ZERO TOLERANCE" berulang.
4. Urutan: referensi di depan; tugas & aturan terpenting (gaya visual) di akhir.
5. Contoh berupa pasangan hook + visual, dengan larangan menyalin.
6. Temperature disesuaikan rekomendasi model yang dipakai.

Uji: planner yang sama (produk & pengaturan seperti `pln_7d6363e0`) dijalankan dengan KB lama vs baru di staging, lalu dibandingkan.

## 9. Penyederhanaan KB untuk Semua Kampanye (Modular)
Struktur usulan:
- **KB inti kecil** (dipakai semua proses): compliance ringkas, brand voice, aturan bahasa.
- **Modul per tugas:** Planner, Storyboard (struktur cerita + VO), Prompt Video (potongan PROMPT_SYSTEM yang benar-benar dirujuk), Deconstruct, Multiplier.
- **Modul per gaya visual:** Metafora, Investigasi, Realis, Kartun — hanya yang dipilih yang dimuat.

Catatan:
- Storyboard dari planner sudah memakai pola mirip (micro-KB + KB gaya) → jadi acuan.
- Deconstruct (Reverse Engineering + Bridge) masih memuat REALIST, PROMPT_SYSTEM, STRATEGIC_FRAMEWORKS penuh.
- Multiplier Angle Generator membaca file REALIST langsung (tidak lewat kb-loader) → perlu dirapikan dulu.
- PROMPT_SYSTEM tidak dibuang dari tahap prompt video; dipecah karena banyak "Mandate" bernomor dirujuk kode.
- Isi prompt Deconstruct & Multiplier belum dibaca detail; perlu audit sebelum menulis modulnya.

Urutan pengerjaan:
1. Planner tahap 2
2. Cache KB master Gemini (`lib/kb-stitcher.js` — saat ini membawa seluruh 12 KB untuk tugas `useKB: true` di tenant paid + caching on)
3. Deconstruct & Multiplier
4. Pemecahan PROMPT_SYSTEM untuk storyboard (paling akhir, paling hati-hati)

Setiap tahap: uji perbandingan KB lama vs baru di staging sebelum diganti.

## 10. Rencana Penghapusan Instant Factory & Sheets Autopilot
Status data (cek 15 Nov 2026): `instant_campaigns` = 0 baris di staging & production. Setting `sheets_autopilot_scheduler_active` tidak ada di staging & production.

### 10a. Instant Factory — aman dihapus, dengan beberapa titik yang ikut dibersihkan
Dihapus utuh: `app/instant-factory/**`, `app/api/v2/instant-factory/**`.

Titik di luar fitur yang menyentuhnya (wajib ikut dibersihkan agar tidak error):
| File | Hubungan |
|---|---|
| `lib/campaign-scheduler.js` | Mesin tick Instant (`instant_sourcing` … `instant_social_poster`) + log file |
| `lib/scheduler-processors.js` | Fungsi `processInstant*` |
| `lib/db.js` | Fungsi DB instant_campaigns / items |
| `lib/affiliate-studio-launch-adapter.js`, `-production-adapter.js`, `-recommendation-adapter.js`, `-contract.js` | Affiliate Studio bisa meluncurkan & merekomendasikan engine `instant` (BOFU) → ganti rekomendasi ke engine lain |
| `app/video-studio/page.js`, `app/api/video-studio/campaign-videos/route.js`, `render/route.js` | Tab sumber video "Instant Factory" |
| `app/api/tts-studio/campaign-data/route.js` | Daftar kampanye instant di TTS Studio |
| `lib/naming-helper.js`, `lib/drive-sync-helper.js`, `lib/nextcloud-sync-helper.js` | Penamaan & sinkron file instant |
| `lib/gemini.js` | Entri `INSTANT_FACTORY` di MODULE_MODEL_MATRIX |
| `lib/scheduler.js`, `app/api/scheduler/control/route.js`, `app/api/system-logs/route.js`, `lib/console-hook.js` | Log `instant_factory_logs` |
| `lib/schema/user-schema.js` | Izin fitur |
| `scripts/find-campaign.js`, `scripts/update-schema-phase2.js`, `scripts/local-staging/setup.js` | Skrip pendukung |

Tidak terpengaruh: halaman Auto Pipeline (variabel `instant*` di sana hanya nama form "jalankan sekarang", tidak memanggil Instant Factory).
Tabel database `instant_campaigns` / `instant_campaign_items`: biarkan dulu (kosong), hapus terpisah setelah kode bersih.

### 10b. Sheets Autopilot — JANGAN hapus file worker utuh
`lib/sheets-autopilot-worker.js` berisi fungsi bantu Google Sheets yang dipakai fitur lain:
| Fungsi | Dipakai oleh |
|---|---|
| `updateCell`, `ensureTabAndAppendRows`, `getColumnLetter` | RE Analyzer, RE FFmpeg, Pillar/OPC Generator, Pillar FFmpeg, Recipe Exporter (`lib/scheduler-processors.js`) — untuk menulis hasil ke Google Sheet |
| `resolveProductImagePath`, `resolveProductReferenceImage` | `scripts/test-product-pipeline.js` (dan perlu dicek pemakaian lain) |

Langkah aman:
1. Pindahkan fungsi bantu di atas ke file baru (mis. `lib/google-sheets-helpers.js`), arahkan semua import ke file baru.
2. Baru hapus: `app/sheets-autopilot/**`, `app/api/sheets-autopilot/**`, `runSyncWorker` + sisa worker, tick scheduler Sheets di `lib/campaign-scheduler.js`, entri `SHEETS_AUTOPILOT` di `lib/gemini.js`, izin di `lib/schema/user-schema.js`.
3. Uji setelah hapus: OPC/Pillar, RE, dan Recipe Exporter masih bisa menulis ke Google Sheet.

### 10c. Dampak ke rencana KB
Instant Factory & Sheets Autopilot keluar dari daftar penyederhanaan KB (bagian 9) karena akan dihapus.

---

# BAGIAN 3 — Visual Style Preset vs Planner (cek 15 Nov 2026)

## 11. Temuan

### 11a. Daftar pilihan tidak sama
| Tempat | Pilihan Visual Style |
|---|---|
| Content Planner (`PlannerConfigurationForm.js`) | Cinematic, **Metafora Faceless**, **Investigasi Faceless**, UGC, Macrophotography |
| Form OPC (`PillarConfigurationForm.js`) | sama dengan Planner |
| Menu Presets → 2. Aesthetics & Visual (`app/settings/presets/page.js:989`) | Cinematic, UGC, Macrophotography saja |

Nilai yang ada di data preset tapi tidak ada di dropdown preset: `investigative_faceless` (preset "Garlibee Pin Board"), `Food Porn`, `photorealistic_culinary`, `Realistic`, `Explainer 2D Motion`. Saat preset seperti ini dibuka, dropdown tampil "Cinematic", padahal nilai tersimpannya berbeda (menyesatkan).

### 11b. Saat ingest, gaya visual planner TIDAK dipakai
`lib/pillar-campaign-ingest.js:208`:
```js
const ingestVisualStyle = globalSettings.visual_style || (isRecipeCampaign ? 'photorealistic_culinary' : 'Cinematic');
```
- `globalSettings` diisi dari preset (Import Planner Modal, ContentFlow Studio, Autonomous Engine, Operator Worker).
- `planner.visual_style` tidak dibaca sama sekali.
- Payload per baris (`row_creative_payload`) juga tidak membawa `visual_style`.

Hanya form OPC yang mengisi gaya dari planner (`PillarConfigurationForm.js:516`), tapi bila preset dipilih setelahnya, gaya ditimpa preset (`:249`) tanpa peringatan.

### 11c. Dampak ke storyboard — YA, berpengaruh
Storyboard menentukan mode metafora dari `campaign.visual_style`, `rowPayload.visual_style`, `metaphor_kit_key`, atau environment Visual Identity (`lib/prompts.js` ±baris 1950). Jika kampanye tersimpan "Cinematic":
- KB `OBJECT_METAPHOR_STORYTELLING_KB` tidak dimuat.
- Mandat metafora (objek klip 1, presence truth, dll.) tidak aktif.
- Hook metafora dari planner hanya terbawa sebagai teks, visualnya digarap sebagai Cinematic biasa.

### 11d. Bukti di data staging
| Gaya planner | Gaya kampanye OPC | Jumlah |
|---|---|---|
| metaphoric_faceless | metaphoric_faceless | 4 (dibuat lewat form OPC, dipilih manual) |
| metaphoric_faceless | **Cinematic** | 1 — `opc_261108_hllhah` dari `pln_5873d99a` |
| UGC | Cinematic | 1 |

Catatan:
- `pln_7d6363e0` belum di-ingest. Jika di-ingest lewat Import Modal + preset sekarang, storyboard-nya akan jalan sebagai Cinematic.
- Preset "Dapurbotani Garlibee MetaforF1F2 - Reveal 2x" tersimpan dengan Visual Style **Cinematic** walau namanya "Metafor".

## 12. Usulan Tambahan

### U7 — Pisahkan dua konsep yang sekarang tercampur dalam satu field (rekomendasi utama)
"Visual Style" saat ini mencampur dua hal berbeda:
| Konsep baru | Isi | Pemilik |
|---|---|---|
| `creative_approach` (Pendekatan Kreatif) | standar / metafora_faceless / investigasi_faceless | **Planner** (karena menentukan cara menulis hook & alur) |
| `visual_look` (Tampilan Visual) | Cinematic / UGC / Macrophotography / Food Porn / photorealistic_culinary / dll. | **Preset** (karena soal produksi/render) |

Dengan begitu planner dan preset tidak lagi saling menimpa: metafora + tampilan Macrophotography bisa jalan bersamaan.
Kompatibilitas: nilai lama `metaphoric_faceless` / `investigative_faceless` dipetakan ke `creative_approach`, sisanya ke `visual_look`.

### U8 — Perbaikan cepat (sebelum U7): aturan prioritas saat ingest
Urutan: pilihan manual pengguna di form ingest → **gaya planner bila metafora/investigasi** → gaya preset → default.
- Bawa `visual_style` ke payload per baris (`row_creative_payload`), karena storyboard sudah membaca `rowPayload.visual_style` lebih dulu (row-first).
- Berlaku untuk semua jalur ingest: Import Planner Modal, form OPC, ContentFlow Studio, Autonomous Engine, Operator Worker.

### U9 — Satu katalog Visual Style untuk semua dropdown
Buat satu sumber daftar (mis. `lib/visual-style-catalog.js`) yang dipakai: form Planner, form OPC, menu Presets, dan validasi ingest. Bila nilai tersimpan tidak dikenal, tampilkan apa adanya ("Nilai lama: Food Porn"), jangan diam-diam tampil "Cinematic".

### U10 — Peringatan di layar saat ada konflik
Di Import Planner Modal dan form OPC: bila gaya planner ≠ gaya preset, tampilkan info "Planner memakai Metafora, preset memakai Cinematic — yang dipakai: Metafora". Di form OPC, memilih preset tidak boleh diam-diam menimpa gaya metafora/investigasi dari planner.

### U11 — Rapikan data yang sudah ada (tanpa ubah kode)
- Cek ulang preset "Dapurbotani Garlibee MetaforF1F2 - Reveal 2x" (nama Metafor, gaya Cinematic).
- `opc_261108_hllhah`: storyboard-nya dibuat sebagai Cinematic; regenerate bila memang ingin metafora.
- Sementara U8 belum jadi: ingest planner metafora lewat form OPC dan pastikan pilihan Visual Style tetap "Metafora" setelah memilih preset.

### Uji
1. Ingest planner metafora lewat Import Modal dengan preset Cinematic → kampanye & payload baris harus `metaphoric_faceless`, storyboard memuat KB metafora.
2. Sama, lewat form OPC dengan urutan pilih planner lalu preset, dan sebaliknya.
3. Planner Cinematic + preset Macrophotography → tetap Macrophotography (perilaku lama tidak berubah).
4. Buka preset "Garlibee Pin Board" di menu Presets → dropdown menampilkan Investigasi, bukan Cinematic.

### File terkait
`app/settings/presets/page.js`, `app/components/ImportPlannerModal.js`, `app/components/campaign-forms/PillarConfigurationForm.js`, `app/components/campaign-forms/PlannerConfigurationForm.js`, `lib/pillar-campaign-ingest.js`, `lib/contentflow-studio-adapters.js`, `lib/autonomous-engine.js`, `lib/operator-content-worker.js`, `lib/prompts.js` (deteksi metafora).

---

# BAGIAN 4 — Penyederhanaan Prompt System (15 Nov 2026)

Seluruh `kb/PROMPT_SYSTEM_v47.9.md` (2.379 baris) sudah dibaca dan dipetakan. Hasil di `docs/kb-lite-draft/`:
- `PROMPT_SYSTEM_INVENTORY.md`: peta setiap aturan → modul tujuan / alasan dibuang, daftar konflik, dan usulan modul per proses.
- `VIDEO_PROMPT_CORE_LITE.md` (±7 KB), `VOICE_AUDIO_LITE.md` (±5 KB), `METAPHOR_PHYSICS_LIBRARY_LITE.md` (±4 KB), `MANDATE_GLOSSARY_LITE.md` (±3 KB).
- Total ±19 KB menggantikan 140 KB, dan tidak pernah dimuat sekaligus.

Temuan penting:
1. **Mandate 2 ("No abstract/surreal metaphors") ikut terkirim ke planner tahap 2** dan bertentangan dengan gaya Metafora. Ini menambah penyebab di bagian 2 dokumen ini.
2. Kode hanya merujuk 11 nomor mandate dari KB, kebanyakan sebagai label. Mandate 92–97 ditulis langsung di kode.
3. Kode sudah membatalkan Mandate 74 & 79 secara eksplisit.
4. Beberapa aturan bertentangan dengan kode yang berlaku (Mandate 34 vs 94, Mandate 67 vs "siku ke bawah", Block 2 negative "hands" vs mode modest hands, Mandate 71 vs `words_per_clip`).
5. Template JSON (II.A–II.F), grid 3x3/triptych, reverse angle, Nano Banana, dan fitur batch variabel tidak dipakai lagi oleh kode.

Langkah lanjut ada di instruksi Antigravity fase P7 (sudah diperbarui).
