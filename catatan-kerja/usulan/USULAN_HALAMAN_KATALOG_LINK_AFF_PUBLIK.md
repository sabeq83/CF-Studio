# Usulan: Halaman Publik Katalog Link Affiliate (Tanpa Login, Mobile-First)

**Tanggal**: 26 November 2026  
**Status**: Usulan (Menunggu Review & Keputusan Pengguna)  
**Target Branch (jika disetujui)**: `fitur/public-affiliate-catalog`

---

## 1. Ringkasan & Kelayakan Teknis

**Kesimpulan: Sangat bisa dibuat tanpa mengubah struktur data inti.**

Seluruh data yang dibutuhkan sudah tersedia di database PostgreSQL CF Studio:
1. **Nama produk** → `product_extractions.product_name` (serta opsional `brand_products.product_name_override`).
2. **Foto produk thumbnail** → resolver `resolveActiveProductPhotoPath()` di `lib/product-photo-policy.js` (`active_photo` → `clean_photo_url` → `cleaned_photo_url` → `generated_photo_url` → `raw_photo_url` → `photo_url`).
3. **Link Affiliate per Brand** → `brand_products.affiliate_link` (`is_active = TRUE`) yang berelasi ke `brand_profiles` (`id`, `brand_name`), serta fallback global `product_extractions.affiliate_link`.
4. **Filter Brand Profile** → tabel `brand_profiles` dan `brand_products`.
5. **Akses Front-End Tanpa Login** → `middleware.js` sudah mendukung daftar rute publik (seperti `/`, `/home`, `/privacy`, `/terms`, `/login`).

---

## 2. Temuan Arsitektur & Celah yang Perlu Ditangani

Berdasarkan pemeriksaan kode saat ini, ada **3 poin teknis penting** agar halaman publik ini aman dan bekerja lancar di Dev/Staging/Production:

### A. Akses Foto Produk Tanpa Login
- Saat ini `lib/product-catalog-service.js` dan `app/api/v2/products/route.js` membungkus path foto lokal menjadi `/api/v2/products/image?path=...`.
- Endpoint `/api/v2/products/image` saat ini dibungkus `withTenantContext`, sehingga **mengembalikan `401 Unauthorized`** jika diakses tanpa cookie sesi login.
- Di Next.js production (`next start`), file baru yang diunggah saat runtime ke `public/uploads/products/` tidak selalu otomatis dilayani oleh static handler Next.js, sehingga tetap perlu route handler pembaca disk.
- **Solusi Usulan**: Tambahkan endpoint publik read-only khusus (misal `GET /api/public/affiliate-catalog/image?path=...&t=...`) yang:
  - Didaftarkan di whitelist `middleware.js`.
  - Memvalidasi path secara ketat hanya di dalam `public/uploads/products/<tenant_id>/` (anti path-traversal).
  - Hanya melayani gambar milik tenant yang akses katalog publiknya aktif.

### B. Isolasi Multi-Tenant & Keamanan Data Tanpa Login
- Database CF Studio menggunakan isolasi `tenant_id` (`default_tenant`, tenant lain, dll.). Halaman tanpa login tetap harus mengetahui **tenant mana** yang sedang dibuka tanpa membocorkan data tenant lain maupun data internal produk (`product_truth`, `geometric_truth`, `raw_response`, `notes`, dll.).
- **Solusi Usulan (Pilih salah satu mekanisme URL)**:
  - **Opsi 1 (Direkomendasikan — URL dengan Slug/Token Publik)**: Halaman diakses melalui `/aff/[token_atau_slug]` (contoh: `https://.../aff/makna-id` atau token acak seperti `/aff/k8x9m2...`). Token/slug dapat diatur/disalin dari menu **Product Database** atau **Settings**, dan bisa di-nonaktifkan/di-reset kapan saja.
  - **Opsi 2 (URL Tunggal Simpel)**: Halaman diakses langsung di `/aff` (atau `/katalog-aff`) dan membaca 1 tenant default (misal `default_tenant`) atau `brand_id` via query string (`?brand=...`), cocok jika dipakai hanya untuk 1 organisasi internal tanpa kekhawatiran URL ditebak.
- **Keamanan DTO Publik**: API publik (`GET /api/public/affiliate-catalog`) **hanya** mengirim field minimal yang dibutuhkan UI:
  - `id`, `product_name`, `thumbnail_url`
  - `brand_links`: daftar `{ brand_profile_id, brand_name, affiliate_link }`
  - `source_url` (hanya jika tombol "Salin Link Produk" ikut diaktifkan)

### C. Penanganan Produk Multi-Brand & Legacy Global Link
- Di tabel `brand_products`, **1 produk bisa terhubung ke lebih dari 1 Brand Profile** dengan `affiliate_link` yang berbeda-beda (contoh: satu produk punya link khusus `NUTRIBAKE ID` dan link berbeda untuk `DAPUR BOTANI`).
- Perilaku yang diusulkan pada halaman publik:
  - **Saat filter 1 Brand Profile dipilih** (misal `NUTRIBAKE ID`):
    - Hanya tampilkan produk yang punya `affiliate_link` aktif untuk `NUTRIBAKE ID`.
    - Badge menampilkan `NUTRIBAKE ID` dan tombol **Salin Link Aff** langsung menyalin link milik `NUTRIBAKE ID`.
  - **Saat filter "Semua Brand" dipilih**:
    - Produk dengan 1 brand menampilkan 1 badge brand + 1 tombol **Salin Link Aff**.
    - Produk multi-brand dapat memilih salah satu pendekatan berikut:
      - *Pendekatan A (Rekomendasi — paling anti-keliru)*: Tampilkan **1 tombol `Salin Link Aff (<Nama Brand>)` per brand** pada kartu tersebut, atau chip pemilih brand di dalam kartu sebelum menyalin.
      - *Pendekatan B*: Tampilkan kartu terpisah per relasi `(Produk + Brand)` sehingga setiap kartu selalu identik 1 badge + 1 tombol seperti contoh gambar.
  - **Link Legacy (`product_extractions.affiliate_link` tanpa relasi `brand_products`)**:
    - Default: hanya tampilkan produk yang sudah terhubung ke Brand Profile (agar jelas afiliasi akun mana), atau tampilkan di "Semua Brand" dengan badge `Umum` jika diaktifkan lewat opsi query/pengaturan.

---

## 3. Usulan Desain UI Mobile-First

Mengacu pada gambar referensi yang diberikan (kartu gelap vertikal, badge brand di bawah nama, tombol penuh selebar kartu) dan ditambah kebutuhan **foto produk thumbnail**:

### Struktur Tata Letak (Mobile `≤ 480px` sampai Desktop)
1. **Header Sticky Ringkas (Tanpa Sidebar CF Studio)**:
   - Judul halaman singkat (misal `Link Affiliate Produk`) + jumlah produk tampil (`24 produk`).
   - **Kotak Pencarian Cepat** (`Cari nama produk...`) agar operator/tim di HP tidak perlu scroll panjang.
   - **Filter Brand Profile**:
     - *Horizontal scrollable pill chips* (`Semua Brand`, `NUTRIBAKE ID`, `DAPUR BOTANI`, dst.) yang mudah digeser dan diketuk dengan jempol di HP, sinkron dengan query parameter `?brand=...` (sehingga link yang sudah terfilter brand tertentu bisa langsung di-bookmark atau dibagikan ke grup tim).
2. **Kartu Produk (1 Kolom di HP, Grid 2–3 Kolom di Tablet/Desktop)**:
   - **Baris Atas Kartu (Header Produk + Thumbnail)**:
     - Kiri: **Thumbnail Foto Produk** ukuran `64×64px` (atau `72×72px`), sudut membulat (`8px`), rasio 1:1 dengan latar netral (`object-fit: contain`) agar kemasan produk terlihat utuh dan jelas tanpa memakan tinggi layar HP. Klik thumbnail opsional bisa memperbesar pratinjau foto (lightbox ringan).
     - Kanan: **Nama Produk** (tebal, mudah dibaca, maksimal 2–3 baris) + **Pill Badge Brand Profile** di bawahnya (contoh: `NUTRIBAKE ID`).
   - **Baris Bawah Kartu (Tombol Aksi Ramah Jempol)**:
     - Tombol penuh (`width: 100%`, tinggi minimal `44px`): **`Salin Link Aff`** (warna aksen utama).
     - *(Opsional — perlu konfirmasi pengguna)*: Tombol kedua di bawahnya seperti pada gambar contoh: **`Salin Link Produk`** (menyalin `source_url` toko asal).
   - **Feedback Interaksi Instan**:
     - Saat tombol diketuk: teks & ikon tombol langsung berubah sementara (2 detik) menjadi **`✓ Link Aff Tersalin!`** + toast mengambang di bawah layar, dengan fallback `document.execCommand('copy')` untuk browser HP/WebView (misal in-app browser Telegram/WhatsApp).
3. **Kepatuhan Theme**:
   - 100% memakai **Semantic CSS Tokens** dari `app/theme.css` (`--canvas`, `--surface`, `--surface-raised`, `--border-subtle`, `--text-primary`, `--action-primary`, `--status-info-soft`, dll.) sehingga mendukung Dark Mode (seperti contoh gambar) dan Light Mode secara konsisten.

---

## 4. Rencana Implementasi Bertahap (Jika Usulan Disetujui)

1. **Persiapan Branch**: Buat branch `fitur/public-affiliate-catalog` dari `main`.
2. **Tahap 1 — Mockup HTML (Wajib sebelum edit kode utama)**:
   - Buat `public/mockup_public_affiliate_catalog.html` dan sajikan via `npm run mockup:serve` (`http://127.0.0.1:4199/mockup_public_affiliate_catalog.html`) untuk review tampilan mobile, ukuran thumbnail, filter pill brand, dan tombol salin.
3. **Tahap 2 — Backend & Middleware**:
   - Tambah endpoint publik `GET /api/public/affiliate-catalog` dan `GET /api/public/affiliate-catalog/image`.
   - Daftarkan rute halaman publik dan endpoint publik di `middleware.js`.
   - (Jika memakai Opsi 1 token/slug) Tambah pengaturan token/toggle publik di `tenant_settings` + tombol salin link halaman publik di menu **Product Database** atau **Settings**.
4. **Tahap 3 — Halaman Front-End Next.js**:
   - Buat halaman baru (tanpa `<Sidebar />`, responsif mobile-first) di `app/aff/...` atau `app/katalog-aff/page.js`.
5. **Tahap 4 — Verifikasi & Deploy ke Dev (`5020`)**:
   - Unit test API publik (isolasi tenant, filter brand, DTO tanpa kebocoran field sensitif, validasi path image).
   - Push branch & deploy ke Dev untuk uji langsung dari HP pengguna.

---

## 5. Poin Keputusan Sebelum Masuk Tahap Mockup

Mohon konfirmasi 4 hal singkat berikut agar mockup dan implementasinya tepat sesuai kebutuhan:
1. **Akses URL & Keamanan**: Pilih **Opsi 1** (URL dengan slug/token publik seperti `/aff/<token>` yang bisa di-ON/OFF-kan) atau **Opsi 2** (URL langsung `/aff` tanpa token untuk `default_tenant`)?
2. **Tombol Kedua**: Selain tombol **`Salin Link Aff`**, apakah tombol **`Salin Link Produk`** (`source_url`) seperti di gambar contoh juga perlu ditampilkan, atau cukup **`Salin Link Aff`** saja?
3. **Produk Multi-Brand di "Semua Brand"**: Saat filter berada di "Semua Brand" dan 1 produk punya link untuk 2+ brand, lebih suka tampil **1 kartu dengan beberapa tombol brand** atau **dipisah per brand (1 kartu = 1 brand)**?
4. **Posisi Thumbnail**: Apakah thumbnail kotak `64×64px` di sebelah kiri nama produk (hemat tinggi layar HP) sudah sesuai, atau lebih suka foto banner lebih besar di atas nama produk?
