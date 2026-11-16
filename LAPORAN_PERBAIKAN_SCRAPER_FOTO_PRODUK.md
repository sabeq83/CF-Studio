# Laporan Resmi: Perbaikan Scraper Foto Produk E-Commerce (Pilih Foto Bersih)

**Target Proyek**: MAKNA Flow / CF-Studio  
**Tanggal**: 16 November 2026  
**Status**: **SELESAI & TERVERIFIKASI PENUH DI STAGING**  
**Versi Rilis**: `v2.49.1`  
**Git Tag / Commit**: `v2.49.1` / `49a8aea0a232accde7e6ffe867dd3f59624e9972`  
**Deployment Staging ID**: `20261116T054731Z-49a8aea0a232` (Mac Mini `100.95.245.55`)  
**Dokumen Terkait**:
* Rencana Kerja: [scraper_foto_produk_implementation_plan.md](file:///Users/sabeqmmursyid/_cfstudio/scraper_foto_produk_implementation_plan.md)
* Instruksi Teknis: [antigravity_scraper_foto_produk_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/antigravity_scraper_foto_produk_instructions.md)
* Usulan Awal: [USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md](file:///Users/sabeqmmursyid/_cfstudio/USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md)

---

## 1. Ringkasan Eksekutif

Sistem pengambil foto produk (*product scraper*) pada alur e-commerce (Tokopedia) telah berhasil diperbaiki secara menyeluruh sehingga **hanya memilih foto fisik produk yang bersih** tanpa model manusia, wajah orang, maupun banner promo berlebih.

Sebelumnya, scraper selalu mengambil foto pertama/banner utama listing. Jika foto tersebut memuat foto orang (seperti pada produk Habarlic yang memuat wajah endorser), foto orang tersebut ikut terbawa ke studio video AI dan membahayakan kepatuhan konten. Sekarang, scraper membaca seluruh galeri foto listing, memilih foto kemasan produk terbaik menggunakan AI Gemini Vision multi-image, memotong kemasan secara presisi dengan AI Smart Cropping, dan memvalidasi kebersihan foto akhir (`approved` vs `needs_review`). 

Seluruh perbaikan telah **dirilis pada versi `v2.49.1`**, **dideploy ke Staging Mac Mini**, dan **diverifikasi secara langsung (*live test*)** pada produk Habarlic 5 in 1 dengan hasil sukses 100%.

---

## 2. Status Pengerjaan per Tahapan (P1 – P6)

| Kode | Tahapan | Status | Penjelasan |
|---|---|---|---|
| **P1** | Galeri Foto DOM & Dukungan CDN Baru | **Selesai** | Playwright mengekstrak galeri foto lengkap. Regex mengenali CDN baru `*.tokopedia-static.net` dan otomatis menduplikasi resolusi tertinggi per hash foto. |
| **P2** | Pemilihan Foto Produk via Gemini Vision | **Selesai** | Modul `lib/product-photo-picker.js` mengevaluasi hingga 6 kandidat foto sekaligus dalam 1 panggilan Vision. Foto berwajah orang, infografis, dan promo tebal langsung ditolak. |
| **P3** | Smart Crop Selalu Aktif & Anti-Model | **Selesai** | AI Smart Crop selalu memotong produk baru dan produk refresh. Prompt secara tegas mengecualikan manusia, wajah, tangan, dan logo promosi. |
| **P3b** | Fitur `refresh_photo` pada API & MCP | **Selesai** | Endpoint `/api/v2/products/scrape` dan MCP `cf_scrape_product_url` menerima `refresh_photo: true`. Memperbarui aset foto *in-place* tanpa merusak nama, USP, dan link afiliasi. |
| **P4** | Validasi Akhir Foto Bersih (Status Review) | **Selesai** | Memeriksa hasil pemotongan latar. Foto bersih berstatus `approved`, sedangkan foto yang masih memuat orang/teks tebal diberi status `needs_review` (`photo_error`). |
| **P5** | Format Data URI Reference Image G-Labs | **Selesai** | Gambar referensi T2I diubah ke format Base64 Data URI valid dengan magic bytes (`bufferToBase64DataUrl`), menyelesaikan error format lama pada worker G-Labs. |
| **P6** | Respons ID Job & ID Produk | **Selesai** | Endpoint API scrape mengembalikan `job_ids` dan `product_id` untuk kemudahan pelacakan otomatis antrean. |

---

## 3. Hasil Pengujian Nyata

### 3.1 Verifikasi Langsung di Server Staging Mac Mini (End-to-End Live Test)

Pengujian dilakukan langsung di server Staging pada Job `#4` antrean `product_scraper`:

#### A. Produk Target: Habarlic 5 in 1 (`pe_1794803911352_653`)
* **URL Listing**: `https://www.tokopedia.com/habarlic/live-spesial-ramadhan-habarlic-5-in-1-kapsul-kesehatan-dengan-habbatussauda-original-asli-bantu-jaga-kesehatan-tubuh-herbal-yang-aman-halal-isi-100-kapsul-1734104711686161822`
* **Trigger Uji**: `POST /api/v2/products/scrape` dengan payload `{ refresh_photo: true }`.
* **Proses yang Berjalan**:
  1. Playwright mengunduh 5 foto dari galeri Tokopedia.
  2. Gemini Vision mendeteksi foto kandidat #0 (banner promo) memuat orang (`has_person: true`) dan **menolaknya**.
  3. Gemini Vision memilih **kandidat #1** (hash `b6b4581b…`) yang menampilkan **botol + kotak kemasan produk saja**.
  4. AI Spatial Smart Cropping memotong kemasan secara presisi (`left=587, top=436, width=571, height=580`).
  5. Rembg membersihkan latar belakang menjadi putih bersih studio tanpa sisa potongan.
  6. Pemeriksaan akhir P4 mengonfirmasi foto bersih tanpa orang (`has_person: false`) $\rightarrow$ status **`approved`**.
  7. G-Labs Generative Polish (`nano_banana_pro` di Node 2) berhasil membuat foto studio podium beresolusi tinggi (408 KB).
  8. Database `staging.product_extractions` diperbarui *in-place*.
* **Hasil Verifikasi Database Staging**:
  * `raw_photo_url`: `/uploads/products/raw/raw_pe_1794803911352_653.png` (foto botol + kotak, 68 KB).
  * `cleaned_photo_url`: `/uploads/products/clean/clean_pe_1794803911352_653.jpg` (bersih tanpa orang, 68 KB).
  * `generated_photo_url`: `/uploads/products/generated/generated_pe_1794803911352_653.jpg` (foto studio podium G-Labs, 408 KB).
  * `photo_status`: **`approved`**.
  * `product_name`, `unique_selling_point`, dan `affiliate_link`: **100% UTUH DAN TIDAK BERUBAH**.

#### B. Produk Kontrol: Laxing SOHO (`pe_1794802696381_879`)
* **Status**: Terverifikasi **tidak tersentuh dan tidak mengalami perubahan** di database staging (`updated_at` tetap `2026-11-16T04:19:04.383Z`). Kualitas foto blister produk tetap terjaga dalam status `approved`.

---

### 3.2 Hasil Dry-Run Lokal & Kasus Negatif

Sebelum deploy ke staging, pengujian offline menggunakan `scripts/test-scraper-photo-pick.mjs` telah mengonfirmasi:
* **Kasus Negatif (Baju Kemeja Cottonology - Semua Foto Memuat Model Manusia)**:
  * URL: `https://www.tokopedia.com/cottonology-indo/kemeja-lengan-panjang-pria-cottonology-gery-hitam-hitam-xl`
  * AI Vision mendeteksi manusia pada seluruh foto (`has_person: true`).
  * Foto diberi status **`needs_review`** (`photo_error: "foto memuat orang/teks"`).
  * G-Labs Generative Polish otomatis dilewati agar foto berwajah orang tidak diproses lebih lanjut.

---

## 4. Status Rilis, Deployment, & Kluster

1. **Rilis Versi**:
   * Versi: **`v2.49.1`**
   * Git Tag: `v2.49.1`
   * Git Commit: `49a8aea0a232accde7e6ffe867dd3f59624e9972` (terunggah ke `origin/main` di GitHub).
   * Changelog: Tercatat pada [sot/global/changelog.md](file:///Users/sabeqmmursyid/_cfstudio/sot/global/changelog.md).

2. **Atomic Deployment ke Staging Mac Mini**:
   * Release ID Aktif: `20261116T054731Z-49a8aea0a232`.
   * Layanan PM2 Online:
     * `maknaflow-staging-ui` (Port 5010): **HTTP 200 OK**
     * `maknaflow-staging-api` (Port 7010): **HTTP 200 OK**
     * `maknaflow-staging-mcp` (Port 7030): **Online**

3. **Kesehatan Kluster Multi-Node**:
   * **Node 1 (Mac Mini Staging)**: Layanan UI, API, Scheduler, dan Worker berjalan normal.
   * **Node 2 (Windows Worker - `100.64.70.61:8765`)**: G-Labs Polish aktif dan merespons cepat.
   * **Node 3 (Database PostgreSQL - `100.78.186.123`)**: Skema `staging` terhubung dengan aman.

---

## 5. Ringkasan File yang Diubah & Ditambah

1. [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js) — (*Baru*) Modul pemilihan foto via Gemini Vision, scoring non-person, crop rules, dan verifikasi akhir.
2. [lib/playwright-scraper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/playwright-scraper.js) — Ekstraksi galeri foto dari DOM Tokopedia dengan filtering elemen non-produk.
3. [lib/url-scraper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/url-scraper.js) — Pola regex CDN baru `*.tokopedia-static.net`, de-duplikasi hash foto beresolusi tertinggi.
4. [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) — Integrasi photo picker, isolasi crop dari repair mode, in-place update `refresh_photo`, dan format Base64 Data URI G-Labs.
5. [app/api/v2/products/scrape/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/scrape/route.js) — Dukungan parameter `refresh_photo` dan respons `job_ids` serta `product_id`.
6. [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) — Penambahan parameter `refresh_photo` pada tool MCP `cf_scrape_product_url`.
7. [tests/url-scraper-tokopedia-images.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/url-scraper-tokopedia-images.test.js) & [tests/product-photo-picker.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-photo-picker.test.js) — (*Baru*) Unit tests untuk galeri gambar dan logika pemilihan foto AI.

---

## 6. Catatan Teknis & Rekomendasi

1. **Efisiensi Token AI**: Evaluasi galeri sangat efisien, dibatasi maksimal 3 panggilan Vision per produk (1 evaluasi galeri multi-image, 1 spatial crop, dan 1 validasi akhir).
2. **Klaim Teks Enrichment**: Klaim berlebihan pada deskripsi bawaan e-commerce (misalnya "100% herbal alami aman") berada di luar lingkup scraper foto dan tetap sesuai dengan teks asli toko.
3. **Kesiapan Produksi**: Fitur saat ini telah stabil di Staging. Sesuai SOP, deployment ke server Production (`100.95.245.55` port 5000/6000) hanya akan dijalankan jika ada instruksi tertulis khusus dari pengguna.
