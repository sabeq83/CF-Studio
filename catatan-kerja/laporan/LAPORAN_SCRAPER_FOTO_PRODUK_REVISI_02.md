# Laporan Pelaksanaan: Scraper Foto Produk E-Commerce (Revisi 02)

**Tanggal**: 17 November 2026  
**Dokumen Acuan**: [antigravity_scraper_foto_produk_revisi_02.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_02.md)  
**Status Eksekusi**: Selesai Penuh (Bagian A di Staging `v2.50.4`, Bagian B di Dev)  

---

## 1. Ringkasan Eksekutif

Pekerjaan perbaikan dan penyempurnaan scraper foto produk e-commerce (Shopee & Tokopedia) tahap Revisi 02 telah selesai dilaksanakan dengan membagi alur kerja ke dalam dua jalur terpisah sesuai **SOP Alur Branch Dev vs Staging**:

1. **Jalur Hotfix Staging (Bagian A - Rilis `v2.50.4`)**:
   - Memperbaiki bug fatal sistemik sejak v2.49.2 di mana variabel `processCleanInputPath` tidak terdefinisi (`ReferenceError`), menyebabkan foto clean gagal terpotong (*crop*) dan gagal dibersihkan (*rembg*) untuk seluruh produk baru.
   - Menghentikan proses AI Search Grounding pada tautan Tokopedia yang mengarah ke halaman 404/produk tidak ada ("*Waduh, tujuanmu nggak ada!*") agar tidak menghasilkan data produk halusinasi.
   - Memvalidasi URL kandidat gambar untuk menolak domain kosongan (seperti `https://images.tokopedia.net` tanpa path) dan menormalkan entitas HTML query string (`&amp;` → `&`).
   - Meneruskan `tenant_id` aktif dari sesi MCP ke job scheduler antrean scraper dan mengisolasi pencarian produk eksisting agar data tidak bocor antar-tenant.
   - Memperbarui database Staging: menandai status produk 404 Tokopedia **Texania** (`pe_1794894490699_828`) menjadi `enrichment_status: 'failed'` dan `photo_error: 'sumber produk 404'`, serta mempertahankan produk **Cuculemon** (`pe_1794900810596_563`) di tenant default.
   - Telah digabung ke branch `main`, dirilis sebagai patch **`v2.50.4`**, dan aktif berjalan di server **Staging Mac Mini** (`http://100.95.245.55:5010`).

2. **Jalur Fitur Baru (Bagian B - Branch `fitur/scraper-foto-galeri-r02` di Dev)**:
   - **S5 (Galeri Lengkap)**: Browser Playwright kini berinteraksi aktif mengklik/meng-hover thumbnail galeri (hingga 8 gambar) untuk memicu pemuatan gambar resolusi tinggi bertanda tangan sah (*currentSrc*); varian ukuran CDN (:700:0, :1200:0, /cache/900/) diverifikasi via Sharp; gambar < 600px disaring bila kandidat ≥ 600px mencukupi (≥ 2).
   - **S6 (Rubrik Picker Lebih Longgar)**: Skema penilaian AI ditambah parameter `text_area_pct` dan `is_collage`. Label ukuran ("750ml", "1000ML"), kode model, dan latar polos sederhana tidak lagi menggugurkan produk utuh. Penolakan hanya berlaku jika ada wajah/orang/model, kolase multi-panel, atau infografis dominan (>30% area).
   - **S7 (Penanganan Kandidat Ditolak)**: Bila seluruh kandidat tertolak di rubrik ketat namun terdapat foto produk tanpa orang dengan skor ≥ 70, sistem tetap membuat foto clean dan menandainya dengan status `needs_review` (*"dipilih otomatis, perlu ditinjau"*). Operator cukup meninjau dan menekan tombol *Setujui Foto*. Jika semua foto memuat orang atau skor < 70, sistem menyimpan foto mentah saja (*raw*) tanpa proses clean.
   - **S8 (Margin Crop 10% & Bypass Rembg Latar Putih)**: Margin crop diperluas dari 6% menjadi 10% agar objek produk tidak mepet ke tepi bingkai. Ditambahkan fungsi cerdas `isPlainWhiteBackground()` yang mendeteksi latar putih polos (≥95% strip tepi); jika latar sudah putih, proses rembg dilewati agar kemasan berwarna putih tidak terhapus bolong (seperti pada kasus kotak Habarlic).
   - **S9 (Enrichment Gagal Kuota Jelas & Retryable)**: Error kuota Gemini (429/Resource Exhausted) ditandai dengan awalan `QUOTA_EXHAUSTED (dapat diulang)` dan endpoint detail produk menyertakan field turunan `enrichment_retryable: true`. Mockup simulasi UI tombol ulangi antrean dibuat dan disinkronkan ke Staging.
   - **Perbaikan Kecil**: Label trace AI untuk crop dan final check dialihkan ke panggung `product_photo_crop` dan `product_photo_final_check` agar pencatatan penggunaan token terpisah dari `start_frame_visual_qc`.
   - Telah teruji dengan 48 unit test, lolos build Next.js, dan aktif dideploy di server **Dev Mac Mini** (`http://100.95.245.55:5020`).

---

## 2. Tabel Rincian Status Perubahan (S1 – S9)

| Kode | Area | Keterangan Perubahan | Lokasi File Utama | Status & Lokasi Rilis |
|---|---|---|---|---|
| **S1** | Fatal Error Foto Clean | Deklarasi `let processCleanInputPath = null;` dan integrasi fungsi tunggal `processProductPhotoFromRaw()`. Alasan error foto digabungkan (`reasons.join('; ')`). | `lib/scheduler-processors.js`, `lib/product-photo-picker.js` | **SELESAI** (Staging `v2.50.4`) |
| **S2** | Deteksi 404 & Status Scraping | Playwright mengembalikan status HTTP; fungsi murni `detectNotFoundPage()` mengenali halaman produk kosong/404 Tokopedia; cegat grounding halusinasi; endpoint `GET /api/v2/products/scrape/jobs/[jobId]` & MCP tool `cf_get_scrape_status`. | `lib/playwright-scraper.js`, `lib/url-scraper.js`, `app/api/v2/products/scrape/jobs/[jobId]/route.js`, `apps/mcp/tools.mjs` | **SELESAI** (Staging `v2.50.4`) |
| **S3** | Validasi URL & Decode HTML | `isValidProductImageUrl()` menolak URL domain tanpa path; regex scraper men-decode `&amp;` menjadi `&`. | `lib/url-scraper.js` | **SELESAI** (Staging `v2.50.4`) |
| **S4** | Tenant Isolation MCP & DB | Payload job `product_scraper` dan `product_photo_replace` menyertakan `tenant_id: activeTenant`; query produk eksisting dibatasi per tenant (`WHERE tenant_id = ?`). | `app/api/v2/products/scrape/route.js`, `app/api/v2/products/[id]/photo-replace/route.js`, `lib/scheduler-processors.js` | **SELESAI** (Staging `v2.50.4`) |
| **S5** | Galeri Lengkap ≥ 5 Foto ≥ 600px | Playwright mengklik/meng-hover hingga 8 thumbnail galeri untuk memicu foto utama berganti ke URL resolusi tinggi bertanda tangan sah; varian ukuran diuji kelayakannya; saring kandidat < 600px bila kandidat resolusi tinggi memadai. | `lib/playwright-scraper.js`, `lib/product-photo-picker.js` | **SELESAI** (Dev 5020) |
| **S6** | Rubrik Picker E-Commerce Longgar | Skema AI ditambah `text_area_pct` dan `is_collage`. Label kapasitas ("1000ML"), garis dimensi, logo kecil, dan latar polos tidak menggugurkan produk utuh. Tolak hanya bila ada orang, kolase, atau infografis dominan (>30%). | `lib/product-photo-picker.js`, `tests/fixtures/photo_picker_cuculemon_eval.json` | **SELESAI** (Dev 5020) |
| **S7** | Fallback Clean Foto Needs Review | Bila semua kandidat tertolak di rubrik ketat namun ada foto tanpa orang skor ≥ 70, foto clean tetap dibuat dan berstatus `needs_review` (*"dipilih otomatis, perlu ditinjau"*). Jika semua memuat orang/skor < 70, simpan raw tanpa clean. | `lib/product-photo-picker.js`, `lib/scheduler-processors.js` | **SELESAI** (Dev 5020) |
| **S8** | Margin Crop 10% & Bypass Rembg | Padding crop dinaikkan ke 10% di `computeCropBox()`. Fungsi `isPlainWhiteBackground()` mendeteksi latar putih polos (≥95% piksel tepi) untuk mem-bypass rembg, melindungi kemasan putih agar tidak bolong. | `lib/product-photo-picker.js`, `lib/bg-remover.js` | **SELESAI** (Dev 5020) |
| **S9** | Kuota AI Retryable & Mockup UI | Error kuota ditandai `QUOTA_EXHAUSTED (dapat diulang)`; respons API produk menambahkan `enrichment_retryable: true` dan hint retry; verifikasi antrean `/api/v2/products/re-enrich`; mockup interaktif tombol retry disinkronkan ke Staging. | `lib/product-bulk-worker.js`, `app/api/v2/products/[id]/route.js`, `public/mockup_foto_produk_review.html` | **SELESAI** (Dev 5020 & Mockup Staging) |
| **Kecil** | Trace Context Stage | Parameter `stage: 'product_photo_crop'` dan `stage: 'product_photo_final_check'` diteruskan ke Gemini Vision. | `lib/product-photo-picker.js` | **SELESAI** (Dev 5020) |

---

## 3. Hasil Pengujian & Verifikasi Kualitas

Semua modul telah melalui uji otomatis menyeluruh dan kompilasi sistem sebelum dideploy:

1. **Rangkaian Unit Test (Node.js Test Runner)**:
   - `tests/product-photo-crop-rembg.test.js`: Verifikasi perhitungan margin 10%, deteksi latar putih polos, dan bypass rembg. (Lolos)
   - `tests/product-photo-rubric.test.js`: Verifikasi kasus Cuculemon lolos tanpa `needsReview`, kasus Habarlic banner orang tertolak, dan dua cabang fallback S7. (Lolos)
   - `tests/product-enrichment-retryable.test.js`: Verifikasi format error kuota dan dekorasi field retryable. (Lolos)
   - `tests/product-photo-flow.test.js`: Verifikasi eksekusi crop, clean, dan final check tanpa ReferenceError. (Lolos)
   - `tests/product-photo-picker.test.js`: Verifikasi varian resolusi S5, deteksi kolase/infografis, dan status foto. (Lolos)
   - `tests/url-scraper-not-found.test.js`: Verifikasi deteksi halaman 404 Tokopedia pada 4 fixture berbeda. (Lolos)
   - `tests/url-scraper-tokopedia-images.test.js`: Verifikasi ekstraksi CDN Tokopedia, dedup hash, dan decode `&amp;`. (Lolos)
   - `tests/product-scraper-tenant.test.js`: Verifikasi isolasi AsyncLocalStorage dan pemisahan tenant. (Lolos)
   - **Total**: **48 dari 48 Unit Tests Lulus (100% Pass)**.

2. **Pengujian Kontrak Katalog & MCP Server**:
   - `npm run test:product-catalog`: Kontrak API katalog produk lulus tanpa regresi.
   - `npm run test:mcp`: 11 dari 11 skenario pengujian MCP (discovery, autopipeline, product database, visual identities, operator preset, review/publishing) lulus dengan respon cepat.

3. **Kompilasi & Build Produksi Next.js**:
   - `next build --webpack` lokal dan remote Mac Mini berhasil tanpa error (`Exit Code: 0`).
   - Seluruh rute API baru (`/api/v2/products/scrape/jobs/[jobId]`, rute re-enrich, rute katalog) terkompilasi dalam mode dinamis (*Dynamic Route*).

4. **Audit Database Staging**:
   - Skrip audit `node scripts/flag-not-found-products.mjs --schema staging --apply` berhasil dijalankan.
   - Produk Texania (`pe_1794894490699_828`) yang bersumber dari tautan 404 telah ditandai statusnya menjadi `enrichment_status: 'failed'`, `photo_status: 'needs_review'`, dan `photo_error: 'sumber produk 404'`.
   - Produk Cuculemon (`pe_1794900810596_563`) tetap berada di tenant default.

---

## 4. Lingkungan Deployment & Tautan Akses

### A. Server Staging (Lingkungan Aktif Produksi Konten)
- **Status Layanan**: Online / HTTP 200 (PM2 UI PID 86063, API PID 86064, MCP PID 86065)
- **Versi Aplikasi**: **`v2.50.4`**
- **Branch**: `main`
- **Git Commit SHA**: `b73ebd2750ea075be26370d56417795c1964152a`
- **Alamat UI Staging**: `http://100.95.245.55:5010`
- **Alamat API Staging**: `http://100.95.245.55:7010`
- **Simulasi Mockup HTML UI**: [http://100.95.245.55:5010/mockup_foto_produk_review.html](http://100.95.245.55:5010/mockup_foto_produk_review.html)

### B. Server Dev (Lingkungan Pengujian Fitur Baru)
- **Status Layanan**: Online / HTTP 200 (PM2 UI PID 96421, API PID 96422)
- **Versi Aplikasi**: `v2.50.4-dev`
- **Branch**: `fitur/scraper-foto-galeri-r02`
- **Git Commit SHA**: `8e2effc7ca7bdaed3363845df71f9f88502f4fd7` (update checklist commit: `c454477`)
- **Alamat UI Dev**: [http://100.95.245.55:5020](http://100.95.245.55:5020)
- **Alamat API Dev**: `http://100.95.245.55:7020/health`

---

## 5. Panduan Singkat Uji Coba untuk Pengguna / QA (di Dev `:5020`)

1. **Uji Kasus Cuculemon (Galeri Lengkap & Rubrik Longgar)**:
   - Buka menu Katalog Produk Dev: [http://100.95.245.55:5020/products](http://100.95.245.55:5020/products).
   - Masukkan URL Tokopedia produk Cuculemon Tumbler.
   - *Hasil yang Diharapkan*: Terkumpul minimal 5 kandidat foto beresolusi ≥ 600px. Foto produk dengan label kapasitas kecil ("1000ML") otomatis terpilih dan langsung berstatus disetujui (tanpa `needs_review`), serta foto clean terpotong rapi dengan margin 10%.
2. **Uji Kasus Kemasan Berlatar Putih (Bypass Rembg)**:
   - Lakukan refresh foto pada produk dengan kemasan putih/kotak berlatar putih (misal Habarlic atau produk suplemen sejenis).
   - *Hasil yang Diharapkan*: Sistem mendeteksi `isPlainWhiteBackground = true` sehingga rembg dilewati. Sisi putih kemasan kotak tidak tergerus/bolong dan foto clean tersimpan dalam kanvas putih studio yang utuh.
3. **Uji Badge & Retry Kuota Enrichment**:
   - Buka mockup UI di Staging: [http://100.95.245.55:5010/mockup_foto_produk_review.html](http://100.95.245.55:5010/mockup_foto_produk_review.html).
   - Perhatikan kartu produk Cuculemon yang menampilkan badge kuning/merah *"⚠️ Enrichment gagal (kuota) · Ulangi"*.
   - Klik badge tersebut: sistem akan mengantrekan ulang proses AI Enrichment (`/api/v2/products/re-enrich`) dan badge berganti menjadi *"⏳ Mengantrekan..."*.
