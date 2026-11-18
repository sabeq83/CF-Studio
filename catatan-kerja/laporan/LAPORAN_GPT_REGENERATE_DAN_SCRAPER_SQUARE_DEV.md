# Laporan Pelaksanaan: Foto Scraper Square (Bagian A) & Tombol GPT Image 2 Manual di Jendela Banding (Bagian B)

- **Tanggal:** 18 November 2026 (Asia/Jakarta)
- **Instruksi Sumber:** [antigravity_gpt_regenerate_scraper_square_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_gpt_regenerate_scraper_square_instructions.md)
- **Rencana Sumber:** [implementation_plan.md](file:///Users/sabeqmmursyid/_cfstudio/implementation_plan.md)
- **Status Rilis:** Kedua fitur baru berjalan di **Dev (`http://100.95.245.55:5020`)** — belum di-merge ke `main` dan belum rilis/deploy ke Staging (menunggu keputusan gate 1 hari & hasil uji Dev). Versi `main` / Staging saat ini masih `v2.52.0`.

---

## 1. Tahap Persiapan (Pengecekan G-Labs Worker)

- **Model Nano Banana:** Di dokumentasi integrasi G-Labs v5.0.8+ ([WEBHOOK_INTEGRATION.en.md](file:///Users/sabeqmmursyid/_cfstudio/docs/WEBHOOK_INTEGRATION.en.md)) dan [lib/webhook-client.js](file:///Users/sabeqmmursyid/_cfstudio/lib/webhook-client.js#L298-L304), ID resmi hanya `nano_banana_pro`, `nano_banana_2`, dan `nano_banana_2_lite` (ID selain itu jatuh ke `nano_banana_2`). Endpoint `/api/models` tidak tersedia (`404`) dan SSH langsung ke PC worker Windows (`vibe-server`) timeout. Sesuai rencana default, Bagian A memakai **`nano_banana_2`**.
- **Endpoint GPT Image 2 (`POST /api/openai/generate`):** Terkonfirmasi aktif di `http://100.64.70.61:8765` (diuji aman dengan payload kosong → HTTP `202` task `91c4e81f`, lalu gagal wajar karena `prompt` kosong, tanpa memakai kuota generate).

---

## 2. Bagian A — `fitur/scraper-foto-square` (Lolos Uji Dev)

- **Branch & Commit:** `fitur/scraper-foto-square` · Full SHA `cfa760916fab2c505be775a9f9020fede6950635`
- **Yang Berubah:**
  - [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L9468-L9495): tahap *Generative Polish* scraper diubah dari `nano_banana_pro` rasio `9:16` menjadi `nano_banana_2` rasio `1:1` (square), beserta log `[Product Scraper Job] Sending request to G-Labs Generative Polish (model: nano_banana_2, 1:1)...`.
  - [sot/menus/kartu/products.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/products.md#L28): mencatat perubahan scraper ke Nano Banana 2 rasio `1:1`.
- **Audit Tampilan & Pipeline:**
  - Thumbnail kartu di `/products` (`92×92` px) dan `/content-flow` (`90×90` px) sudah berbentuk 1:1; Jendela Banding memakai `objectFit: 'contain'`; start frame video tetap memakai `aspect_ratio: '9:16'` dengan foto produk sebagai referensi.
- **Verifikasi & Status:**
  - Unit test terkait (`product-scraper-tenant.test.js`, `product-card-photo-view.test.js`, `product-photo-flow.test.js`): **10/10 lulus**.
  - Dideploy ke Dev dan terverifikasi sehat (`maknaflow-dev-ui` & `maknaflow-dev-api` online, `PG_SEARCH_PATH: dev`, `PGPOOL_MAX: 3`, HTTP 200 `/login` & `/health`).
  - Pengguna sudah menyatakan Bagian A **lolos uji di Dev**. Menunggu konfirmasi apakah boleh dipercepat naik Staging sekarang atau menunggu masa uji 1 hari.

---

## 3. Bagian B — `fitur/gpt-regenerate-manual` (Aktif di Dev, Masa Uji Dimulai 18 Nov 2026)

### 3.1 Tahap Mockup (Disetujui Pengguna)
- Mockup mandiri dibuat di [mockup_tombol_gpt_banding_produk.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_tombol_gpt_banding_produk.html) (commit `75025b7`), memakai token CSS light/dark dari `app/theme.css`.
- Disinkronkan ke runtime public Staging dan diverifikasi `HTTP 200 OK` di `http://100.95.245.55:5010/mockup_tombol_gpt_banding_produk.html`. Mockup disetujui pengguna sebelum perubahan kode `app/**`.

### 3.2 Perubahan Implementasi (`8f60f8e43f002a176a4e14d8e1d7728ce7437484`)
1. **Migrasi DB ([lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L1188-L1192)):** Menambah 3 kolom pada `product_extractions` dengan `ADD COLUMN IF NOT EXISTS`:
   - `photo_engine_request TEXT` (permintaan sekali pakai `'gpt_image_2'` atau `NULL`)
   - `photo_model TEXT` (model pembuat foto clean aktif)
   - `previous_photo_model TEXT` (model foto clean sebelumnya untuk label banding)
2. **API Regenerate ([regenerate-photos/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/regenerate-photos/route.js)):**
   - Menerima `engine` (`undefined | null | 'gpt_image_2'`; selain itu HTTP `400`).
   - Menolak `engine: 'gpt_image_2'` jika `ids.length !== 1` (`400`).
   - Menolak produk yang sedang `pending`/`processing` (`409` untuk 1 produk, `skipped` untuk batch).
   - Menandai `skipped` dengan alasan jelas jika `engine === 'gpt_image_2'` dan `raw_photo_url` bukan file lokal `/uploads...`.
   - Tombol biasa selalu mengosongkan `photo_engine_request = NULL`.
3. **Helper OpenAI & Provider G-Labs ([lib/webhook-client.js](file:///Users/sabeqmmursyid/_cfstudio/lib/webhook-client.js#L429-L471), [lib/product-photo-providers/glabs.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-providers/glabs.js)):**
   - Menambah `generateProductPhotoWithOpenAI` langsung ke `POST /api/openai/generate` (`aspect_ratio: '1:1'`, `quality: 'high'`, `prompt_mode: 'direct'`, `reasoning: 'none'`, `web_search: false`, tanpa field `model`, tanpa `sanitizeImagePrompt`, tanpa BullMQ, tanpa fallback ke Nano Banana, menyimpan rute task via `saveGlabsTaskRoute`, dan memakai `applyRandomDelay('image')`).
   - Memperbaiki `pollGlabsPhotoTask`: `getFileUrl(imageFile, taskId)`, pola file `/\.(png|jpe?g|webp)$/i`, dan meneruskan pesan error asli G-Labs.
4. **Prompt & Worker ([lib/product-photo-service.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-service.js#L15-L21), [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js)):**
   - Menambah `buildGptProductPrompt(product)` (pengunci identitas + detail `clean_photo_t2i_prompt` berprioritas lebih rendah dari gambar referensi).
   - Worker membaca `photo_engine_request`, mengirim GPT saat diminta, menulis `photo_model` & `previous_photo_model` saat sukses lalu mengosongkan `photo_engine_request`. Bila gagal, foto lama tetap utuh, `photo_error` diisi pesan asli G-Labs, dan `photo_engine_request` dikosongkan.
5. **File Pendukung Revert & Kontrak Kolom:**
   - [lib/product-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js#L18) & [photo-review/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/photo-review/route.js#L37-L49): memulihkan `photo_model` dari `previous_photo_model` dan mengosongkan `previous_photo_model` saat aksi `revert_previous` dijalankan.
6. **UI & Kartu Menu ([app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js), [sot/menus/kartu/products.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/products.md#L36)):**
   - Jendela Banding: tab `Foto Lama | Foto Asli` di panel kiri saat ada `previous_clean_photo_url`, label model di bawah foto (disembunyikan bila kosong), tombol `🧠 Ulangi dengan GPT` (konfirmasi kuota ChatGPT, nonaktif jika foto mentah belum tersimpan di server, catatan tombol massal tetap Nano Banana), dan status kartu `⏳ Sedang dibuat dengan GPT…` — seluruhnya memakai CSS design tokens `app/theme.css`.

### 3.3 Hasil Tes & Build
- [tests/product-photo-gpt-manual.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-photo-gpt-manual.test.js) (mock server HTTP lokal + DB `dev` terisolasi): **6/6 lulus** (validasi `400`/`409`/`skipped`, isolasi tenant, tombol biasa ke Nano Banana, GPT ke `/api/openai/generate` + prompt verbatim + model tracking + revert, GPT gagal tanpa fallback, dan `getFileUrl(..., taskId)`).
- Unit test produk lain (`product-card-photo-view`, `product-photo-flow`, `product-scraper-tenant`, `product-active-photo-contract`, `product-photo-revisi`, `product-photo-picker`): **32/32 lulus**.
- Integrasi & kontrak (`scripts/test-product-pipeline.js`, `npm run test:product-catalog`): **lulus** (`npm run test:product-import` tidak dijalankan karena membutuhkan `.env.staging.local`).
- Build & Deploy Atomik Dev (`npm run deploy:dev:atomic -- --ref 8f60f8e43f002a176a4e14d8e1d7728ce7437484 --apply --confirm-dev`): **`deployment_success=true`**, `maknaflow-dev-ui` & `maknaflow-dev-api` `online`, `PG_SEARCH_PATH: dev`, `PGPOOL_MAX: 3`, UI `/login` & API `/health` HTTP `200`, dan 3 kolom baru terverifikasi terbentuk di schema `dev`.

### 3.4 Hasil Uji Live di Dev (1 Produk + 1 Start Frame)
Uji dilakukan pada **`FUKUMI Beras Porang Box Sachet`** (`pe_1788318714093_526`):
1. **Nano Banana Pro (`a07b78bd`):** menghasilkan `1024×1024` JPEG (`photo_model: nano_banana_pro`). Teks kecil pada kemasan masih banyak terbaca acak.
2. **GPT Image 2 (`6c90599c`):** akun ChatGPT di G-Labs aktif dan menghasilkan `1254×1254` PNG (~1,57 MP, latar putih bersih 1:1, `photo_model: gpt_image_2`, `previous_photo_model: nano_banana_pro`).
   - **Perbandingan:** bentuk kotak, logo `FUKUMI`, warna hijau/putih, maskot porang, logo Halal MUI, dan teks kemasan (`BPOM RI MD 232937001874`, `PT. Asia Prima Konjac, Madiun 63154 - Indonesia`, `280g (7 Sachet @40g)`) tajam dan terbaca benar.
   - **Keterbatasan yang dicatat:** karena `clean_photo_t2i_prompt` bawaan produk menyebut *"One single sachet is neatly positioned next to the main box"*, GPT ikut menggambar 1 sachet `40g` di samping kotak (walau foto mentahnya hanya kotak), dan huruf sangat kecil di sachet sedikit kurang seragam.
3. **1 Start Frame 9:16 dari foto GPT (`57bbf2f1`, `nano_banana_2`):** menghasilkan `768×1376` JPEG adegan meja dapur — kotak dan sachet `FUKUMI` terbaca jelas tanpa perlu upscale.

---

## 4. Mekanisme Migrasi & Pemberitahuan Sebelum Naik Staging

- **Cara migrasi berjalan di Dev & Staging:** Saat build (`next build`), script atomic memakai `DISABLE_AUTO_MIGRATIONS=true` sehingga migrasi dilewati. Saat aplikasi runtime PM2 menyala (`.env.local` Dev dan Staging tidak menyetel `DISABLE_AUTO_MIGRATIONS`), `migrateProductPhotoPipeline()` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) otomatis menjalankan `ALTER TABLE product_extractions ADD COLUMN IF NOT EXISTS ...` pada schema target (`dev` atau `staging`) dengan `pg_advisory_lock`.
- **Pemberitahuan wajib sebelum Staging:** Penambahan 3 kolom bersifat *additive* (kolom baru kosong, data lama tidak berubah). Jika nantinya perlu **rollback kode** ke versi sebelumnya, rollback kode **tidak menghapus ketiga kolom tersebut**, dan kolom kosong aman diabaikan oleh kode versi lama.

---

## 5. Daftar Cek Uji Manual & Langkah Berikutnya

- **Link Dev:** `http://100.95.245.55:5020/products`
- **Tanggal mulai masa uji Dev Bagian B:** **18 November 2026**
- **Cek manual di browser Dev:**
  1. Buka Jendela Banding pada **`FUKUMI Beras Porang Box Sachet`** → cek foto lama & foto baru beserta label **`Foto lama: Nano Banana Pro`** dan **`Foto baru: GPT Image 2`**.
  2. Uji **`↩️ Tolak, pakai foto sebelumnya`** → foto & label model kembali ke Nano Banana.
  3. Uji **`✨ Ulangi Generate`** biasa → tetap ke Nano Banana.
  4. Cek produk tanpa foto mentah lokal → tombol GPT nonaktif dengan keterangan *"Foto mentah belum tersimpan di server"*.
  5. Cek tampilan light mode & dark mode.
- **Menunggu konfirmasi pengguna:**
  1. Apakah **Bagian A (`fitur/scraper-foto-square`)** dipercepat naik Staging sekarang atau menunggu genap 1 hari.
  2. Hasil uji **Bagian B (`fitur/gpt-regenerate-manual`)** di Dev sebelum rilis ke Staging (setelah melewati gate 1 hari atau izin percepatan).
