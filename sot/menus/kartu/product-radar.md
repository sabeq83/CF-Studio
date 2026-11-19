# Kartu Menu: Radar Produk

Terakhir dicek: 19 November 2026 · Versi aplikasi: v2.55.0+fitur/radar-produk
Alamat: `/product-radar` · Kelompok: PLANNING · Kunci izin menu: `product_research`

## Fungsi
Menjadi pintu kurasi hasil riset produk dari TeleRadar sebelum masuk ke katalog utama `Product Database`. Memisahkan kandidat mentah dari `product_extractions` agar pemilih produk kampanye dan Auto Pipeline hanya menerima produk yang sudah diverifikasi kurator.

## Alur pakai
1. TeleRadar mengirim batch kandidat + foto pengenal melalui API ingest (`POST /api/operator/v2/product-research/batches`, scope `product_research:ingest`).
2. Kurator membuka **PLANNING → Radar Produk**, menyaring kandidat menurut batch, kategori, tren, status URL, status kurasi, atau status katalog.
3. Klik baris untuk membuka panel detail: bandingkan screenshot sumber dengan listing tujuan, perbaiki URL/nama/deskripsi/USP di kolom **Edit Kurator** (aman dari sinkron ulang).
4. Untuk kandidat berstatus URL **Terdekat** atau **Tidak ditemukan**, tombol **Masukkan** dinonaktifkan sampai kurator memverifikasi URL listing yang tepat.
5. Tekan **Masukkan ke Database Produk** (atau **Hubungkan** jika URL sudah ada di katalog) untuk menjadwalkan scraping produk baru atau menautkan ke produk eksisting tanpa menimpa data katalog.

## Terhubung dengan
- Sumber data: TeleRadar (`POST /api/operator/v2/product-research/batches`).
- Terhubung ke: **Product Database** (`/products`, memakai layanan `enqueueProductScrape` dan `getProductScrapeJobStatus`).
- Aksi pemulihan (`needs_review`): memanggil endpoint pemulihan produk yang sudah ada (`/api/v2/products/regenerate-photos` dan `/api/v2/products/re-enrich`) tanpa scrape ulang.

## Lokasi (untuk agent)
- Halaman & UI: `app/product-radar/page.js`, `app/product-radar/CandidateDetailDrawer.js`, `app/product-radar/radar-labels.js`, `app/product-radar/product-radar.module.css`
- Layanan & Repository: `lib/product-research-repository.js`, `lib/product-research-ingest-service.js`, `lib/product-research-promotion-service.js`, `lib/product-research-image-storage.js`, `lib/product-url-normalizer.js`
- API Web: `app/api/v2/product-research/candidates/` (`route.js`, `[id]/route.js`, `[id]/archive/route.js`, `[id]/image/route.js`, `[id]/promote/route.js`, `[id]/status/route.js`)
- API Operator: `app/api/operator/v2/product-research/batches/route.js`
- Tabel data: `product_research_batches`, `product_research_candidates`, `product_research_imports` (migrasi via `scripts/migrate-product-research.mjs`)

## Aturan penting & jebakan
1. Semua angka terjual/komisi/tren berasal dari tanggal pengamatan screenshot TeleRadar, bukan data marketplace real-time.
2. Kandidat riset **tidak** muncul di pemilih produk kampanye maupun Auto Pipeline sampai dipromosikan ke `product_extractions`.
3. Sinkron ulang batch hanya memperbarui `research_data`; `curated_data`, `curation_status`, `process_status`, `cf_product_id`, dan URL pilihan kurator tidak tertimpa.
4. Token dengan scope `product_research:ingest` hanya boleh mengirim batch riset dan dilarang mengakses endpoint kurasi/promosi web.
5. Klaim promosi memakai *partial unique index* di `product_research_imports` dan mencadangkan `reserved_product_id` agar klik ganda atau retry tidak membuat produk ganda.
6. Aksi arsip kandidat hanya menyembunyikan kandidat riset dan tidak menghapus produk di `product_extractions`.

## Belum ada / batasan
- Promosi dilakukan per satu kandidat; *bulk approval*, perbandingan tren lintas minggu, skor peluang, serta perintah bot lengkap direncanakan pada tahap lanjutan.

## Dokumen lengkap
[USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md)
