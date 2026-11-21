# Usulan Pemolesan Layout Mobile CF Studio — Tahap 2 (Prioritas 1 & 2)

Tanggal: 21 November 2026 · Penyusun: Antigravity  
Acuan Skill: `antislop-layoutmobile` + `antislop` (Mode DURING)  
Lingkup Halaman:
- **Prioritas 1**:
  1. Dashboard (`/dashboard`)
  2. Auto Pipeline (`/auto-pipeline`)
- **Prioritas 2**:
  3. ContentFlow Hub (`/content-flow`)
  4. Radar Produk (`/product-radar`)
  5. Product Database (`/products`)

---

## 1. Latar Belakang & Masalah Tiap Halaman di Layar HP

Setelah Tahap 1 (Fondasi Bersama) berhasil memasang navigasi `MobileNav` (Bilah Atas 52px + Drawer 100dvh + Bilah Bawah 56px), halaman-halaman kerja utama kini memerlukan pemolesan tata letak interior agar tidak sekadar "desktop yang dipaksa sempit":

### 1.1 Dashboard (`/dashboard`)
- **Masalah**: Kontainer utama memakai inline style `padding: '32px 36px'`, sehingga di layar HP 360px ruang tersisa hanya ~290px. Tombol header `Public Home` & `Refresh Stats` memakan ruang horizontal yang tinggi.
- **Solusi Mobile**:
  - Ganti inline padding dengan CSS semantik `--page-padding` (16px di HP).
  - Kartu metrik eksekutif (4 buah) diatur menjadi 2x2 grid padat di HP dengan angka besar yang mudah dipindai.
  - Quick Action Launchpad: tombol aksi cepat berukuran sentuh minimal 44px dengan icon yang jelas.
  - Global Brand Overview: kartu akun brand dengan pill metrik TikTok, FB, IG yang pas tanpa overflow.
  - 5 Konten Siap Publish Terbaru & Progress Publikasi: ditumpuk menjadi 1 kolom vertikal yang rapi.

### 1.2 Auto Pipeline (`/auto-pipeline`)
- **Masalah**: Halaman wizard 9,000+ baris memiliki stepper horizontal yang rentan terpotong di layar sempit. Form pembuatan kampanye memiliki inline grid yang membutuhkan penyelarasan.
- **Solusi Mobile**:
  - Stepper langkah (Step 1 s/d 5) dibuat menjadi baris gulir mendatar (*horizontal scroll snap*) dengan indikator langkah aktif yang mencolok.
  - Form kontrol, dropdown preset, dan slider durasi dioptimalkan untuk sentuhan jempol ($\ge 44\text{px}$, font input 16px).
  - Antrean batch & riwayat video terakhir ditampilkan sebagai kartu ringkas (*summary card*) yang bisa dibuka detailnya.

### 1.3 ContentFlow Hub (`/content-flow`)
- **Masalah**: Tabel publikasi memiliki banyak kolom (ID, Judul Hook, Akun, Format, Status TikTok, Status FB, Status IG, Aksi), yang di HP menuntut geser samping terlalu jauh. Sub-tab filter akun brand juga menumpuk.
- **Solusi Mobile**:
  - Filter Bar & Sub-tab Akun Brand diubah menjadi *horizontal scrolling chip bar* yang mulus.
  - Penyajian Item Konten Adaptif: di HP ($\le 640\text{px}$), setiap konten disajikan dalam format **Mobile Feed Card**:
    - Kartu mandiri dengan thumbnail video (jika ada) / icon format.
    - Hook / Judul yang mudah dibaca.
    - Status pill masing-masing platform (TikTok, FB, IG) yang dapat langsung diketuk untuk ubah status.
    - Tombol aksi utama (Publish / Download / Detail) berukuran $\ge 44\text{px}$.
  - Bilah tindakan massal (*bulk action bar*) diatur menempel di atas Bilah Bawah Mobile (posisi `bottom: calc(var(--bottom-nav-h) + 8px)`) agar tidak saling menimpa.

### 1.4 Radar Produk (`/product-radar`)
- **Masalah**: Tabel kurasi TeleRadar lebar dan kartu kandidat di layar sempit membutuhkan area pratinjau foto produk dan metrik viralitas yang efisien. Drawer detail kandidat perlu menjadi modal bottom-sheet.
- **Solusi Mobile**:
  - Filter pencarian dan filter status disajikan dalam bilah filter ringkas dengan chip yang bisa digeser mendatar.
  - Kartu Kandidat Produk di HP: foto produk persegi (1:1), judul & skor viralitas di samping foto, badge estimasi omset/penjualan, serta tombol aksi Kurasi/Verifikasi berukuran penuh di bawahnya.
  - CandidateDetailDrawer otomatis bertransformasi menjadi *bottom sheet* penuh (`max-height: 92dvh`) dengan tombol aksi "Promosikan ke Katalog" yang menempel di bawah (*sticky footer*).

### 1.5 Product Database (`/products`)
- **Masalah**: Katalog produk memiliki kartu produk yang di desktop menampilkan opsi perbandingan foto Clean vs Raw berdampingan, serta modal Ganti Foto / Enrich yang luas.
- **Solusi Mobile**:
  - Kartu Produk di HP: gambar produk di bagian atas dengan tombol toggle cepat "Clean / Raw" berukuran sentuh 44px.
  - Informasi SKU, Kategori, dan USP disajikan dalam daftar tagar yang rapi.
  - Tombol aksi produk (Enrich AI, Ganti Foto, Edit Data) berjarak lega dan tidak berdesakan.
  - Modal Tambah/Edit Produk dan Modal Ganti Foto otomatis menggunakan format *bottom sheet* mobile.

---

## 2. Alur Pelaksanaan & Mockup Mandiri

Sesuai aturan SOP Mockup, seluruh usulan tata letak untuk ke-5 halaman di atas disajikan dalam satu file mockup interaktif: `public/mockup_layout_mobile_tahap2.html`.
Mockup ini memungkinkan penguji beralih antar halaman (Dashboard, Auto Pipeline, ContentFlow Hub, Radar Produk, Product Database) dan mencoba langsung interaksi sentuh, filter, dan bottom sheet di layar HP.
