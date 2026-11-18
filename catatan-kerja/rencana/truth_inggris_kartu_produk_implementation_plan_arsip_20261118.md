# Implementation Plan: Truth Berbahasa Inggris (A) & Kartu Produk + Jendela Banding (B)

> Referensi tugas: [antigravity_kartu_produk_enrich_foto_truth_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_kartu_produk_enrich_foto_truth_instructions.md)  
> Mockup disetujui: [mockup_kartu_produk_foto_enrich.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_kartu_produk_foto_enrich.html)  
> Branch sumber: `hotfix/truth-bahasa-inggris` & `hotfix/kartu-produk-foto-enrich`  
> Target rilis: `main` -> Staging (`5010`/`7010`)

## Ringkasan Tujuan

1. **Bagian A — Truth Berbahasa Inggris**:
   - Memastikan Product Truth (3–4 kalimat) & Geometric Truth (2–3 kalimat) selalu dihasilkan dalam bahasa Inggris untuk stabilitas video DNA AI.
   - Menyediakan penjaga bahasa `ensureEnglishProductTruths` di worker pipeline serta skrip `scripts/translate-product-truths.mjs` (dry-run ready).
   - Menambahkan teks panduan bahasa Inggris di modal detail produk.
2. **Bagian B — Kartu Produk, Jendela Banding & Penyimpanan Foto Sebelumnya (B1–B6)**:
   - Tombol `🧠 Enrich AI` / `Enriching…` / `🧠 Coba lagi` di kartu produk + pesan error ringkas.
   - Default thumbnail foto bersih (`resolveDefaultCardPhotoTab`), badge pojok status foto, dan sakelar `Asli | Hasil AI`.
   - Jendela Banding foto Asli vs Hasil AI berdampingan, metadata provider & `updated_at`, klik zoom, serta aksi `Setujui`, `Ganti Foto`, `Ulangi Generate`.
   - Kolom database `previous_clean_photo_url`, snapshot foto clean lama sebelum ditimpa, dan tombol `↩️ Tolak, pakai foto sebelumnya` (`action: 'revert_previous'`).
   - Pratinjau hanya-baca foto Asli & Hasil AI di tab Foto & AI modal produk.

---

## Execution Task List

### Bagian A — `hotfix/truth-bahasa-inggris`
- [x] **A1 (Prompt & Konstanta Bersama)**: Pindahkan definisi baku Product Truth & Geometric Truth ke bahasa Inggris di `lib/prompts.js` & `lib/product-bulk-worker.js`.
- [x] **A2 (Penjaga Bahasa)**: Buat `lib/product-truth-language.js` dan integrasikan ke `lib/product-bulk-worker.js`.
- [x] **A3 (Skrip Data Lama)**: Buat skrip dry-run/apply `scripts/translate-product-truths.mjs`.
- [x] **A4 (Keterangan Form Modal)**: Tambahkan keterangan panduan bahasa Inggris di `app/products/ProductDatabaseModal.js`.
- [x] **A5 (Unit Test & Verifikasi)**: Buat `tests/product-truth-language.test.js` (3/3 pass).
- [x] **A6 (Uji Dev & Dry-Run Staging)**: Uji live enrichment di Dev (English Truth terverifikasi) dan jalankan dry-run Staging (281 baris diperiksa, 0 write).

### Bagian B — `hotfix/kartu-produk-foto-enrich`
- [x] **B0 (Mockup HTML)**: Buat `public/mockup_kartu_produk_foto_enrich.html` dan sinkronkan ke Mac Mini untuk review pengguna.
- [x] **B1 (Tombol Enrich AI di Kartu)**: Tombol `🧠 Enrich AI` / `Enriching…` / `🧠 Coba lagi` di footer kartu + `enrichment_retryable` di API.
- [x] **B2 (Thumbnail & Sakelar)**: Default foto bersih, badge pojok status foto, sakelar `Asli | Hasil AI`, dan klik thumbnail membuka Jendela Banding.
- [x] **B3 (Jendela Banding)**: Modal review 2 kolom Asli vs Hasil AI, metadata sumber/waktu, klik zoom, aksi Setujui, Ganti Foto, dan Ulangi Generate.
- [x] **B4 (Pratinjau di Modal Detail)**: Tampilkan foto Asli & Hasil AI read-only (+ zoom) di tab Foto & AI.
- [x] **B5 (Penyimpanan Foto Clean Sebelumnya)**: Kolom `previous_clean_photo_url` di `lib/db-pg.js` & `lib/product-repository.js`, snapshot di `lib/product-bulk-worker.js`, API revert di `photo-review`, dan tombol `↩️ Tolak, pakai foto sebelumnya`.
- [x] **B6 (Unit Test & Deploy Dev)**: Tambah `tests/product-card-photo-view.test.js` (6/6 pass), jalankan seluruh tes produk (37/37 pass), verifikasi build & deploy ke Dev (`release_id=20261117T134452Z-a810fc6ec69b`).
