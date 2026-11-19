# Kartu Menu: Radar Produk

Terakhir dicek: 19 November 2026 · Versi aplikasi: v2.55.0+fitur/radar-trends-and-score
Alamat: `/product-radar` · Kelompok: PLANNING · Kunci izin menu: `product_research`

## Fungsi
Menjadi pintu kurasi hasil riset produk dari TeleRadar sebelum masuk ke katalog utama `Product Database`. Memisahkan kandidat mentah dari `product_extractions` agar pemilih produk kampanye dan Auto Pipeline hanya menerima produk yang sudah diverifikasi kurator.

## Alur pakai
1. TeleRadar mengirim batch kandidat + foto pengenal melalui API ingest (`POST /api/operator/v2/product-research/batches`, scope `product_research:ingest`).
2. Kurator membuka **PLANNING → Radar Produk**, menyaring kandidat menurut batch, kategori, tren, status URL, status kurasi, atau status katalog, serta mengurutkan menurut *Ranking Riset*, *Skor Peluang Tertinggi*, atau *Kenaikan Terjual Lintas Minggu*.
3. Klik baris untuk membuka panel detail: bandingkan screenshot sumber dengan listing tujuan, perbaiki URL/nama/deskripsi/USP di kolom **Edit Kurator** (aman dari sinkron ulang), serta tinjau **Perbandingan Tren Lintas Minggu** (pengamatan terpisah per tanggal batch) dan **Rincian Skor Peluang**.
4. Untuk kandidat berstatus URL **Terdekat** atau **Tidak ditemukan**, tombol **Masukkan** dinonaktifkan sampai kurator memverifikasi URL listing yang tepat.
5. Tekan **Masukkan ke Database Produk** (satuan) atau centang banyak kandidat untuk **Bulk Approval** (menampilkan ringkasan *Valid / Duplikat / Tertahan* sebelum eksekusi; kandidat tertahan tidak ikut terkirim dan antrean `product_scraper` berjalan 1 job sekaligus).

## Terhubung dengan
- Sumber data: TeleRadar (`POST /api/operator/v2/product-research/batches`).
- Terhubung ke: **Product Database** (`/products`, memakai layanan `enqueueProductScrape` dan `getProductScrapeJobStatus`).
- Aksi pemulihan (`needs_review`): memanggil endpoint pemulihan produk yang sudah ada (`/api/v2/products/regenerate-photos` dan `/api/v2/products/re-enrich`) tanpa scrape ulang.

## Lokasi (untuk agent)
- Halaman & UI: `app/product-radar/page.js`, `app/product-radar/CandidateDetailDrawer.js`, `app/product-radar/radar-labels.js`, `app/product-radar/product-radar.module.css`
- Layanan & Repository: `lib/product-research-repository.js`, `lib/product-research-opportunity-score.js`, `lib/product-research-ingest-service.js`, `lib/product-research-promotion-service.js`, `lib/product-research-image-storage.js`, `lib/product-url-normalizer.js`
- API Web: `app/api/v2/product-research/candidates/` (`route.js`, `bulk-promote/route.js`, `[id]/route.js`, `[id]/archive/route.js`, `[id]/image/route.js`, `[id]/promote/route.js`, `[id]/status/route.js`)
- API Operator: `app/api/operator/v2/product-research/batches/route.js`
- Tabel data: `product_research_batches`, `product_research_candidates`, `product_research_imports` (migrasi via `scripts/migrate-product-research.mjs`)

## Aturan penting & jebakan
1. Semua angka terjual/komisi/tren berasal dari tanggal pengamatan screenshot TeleRadar, bukan data marketplace real-time.
2. Kandidat riset **tidak** muncul di pemilih produk kampanye maupun Auto Pipeline sampai dipromosikan ke `product_extractions`.
3. Sinkron ulang batch hanya memperbarui `research_data`; `curated_data`, `curation_status`, `process_status`, `cf_product_id`, dan URL pilihan kurator tidak tertimpa.
4. Token dengan scope `product_research:ingest` hanya boleh mengirim batch riset dan dilarang mengakses endpoint kurasi/promosi web.
5. Klaim promosi memakai *partial unique index* di `product_research_imports` dan mencadangkan `reserved_product_id` agar klik ganda atau retry tidak membuat produk ganda.
6. Aksi arsip kandidat hanya menyembunyikan kandidat riset dan tidak menghapus produk di `product_extractions`.
7. **Perbandingan Lintas Minggu**: Setiap batch mingguan tetap disimpan terpisah (tidak saling menimpa). Pencocokan otomatis antarbatch hanya memakai `cf_product_id` atau `normalized_url` terverifikasi (`official`/`listing`/`user`). Kemiripan nama hanya ditampilkan sebagai saran terpisah dan tidak digabung otomatis.
8. **Rumus Skor Peluang (v1 · Total 100 Poin)**: Hanya membantu urutan kurasi dan **tidak pernah memicu promosi otomatis**:
   - **Penjualan/minggu (maks 30)**: `≥1.000` (30), `500–999` (24), `200–499` (18), `50–199` (12), `1–49` (6).
   - **Arah tren (maks 20)**: `up` (20), `stable` (12), `down` (4).
   - **Komisi/produk (maks 20)**: `≥Rp25.000` (20), `Rp15.000–24.999` (16), `Rp8.000–14.999` (12), `Rp3.000–7.999` (8), `1–2.999` (4).
   - **Zona harga (maks 15)**: `Rp35.000–250.000` (15), `Rp20.000–34.999` / `Rp250.001–500.000` (11), tepi `<20rb`/`500rb–1jt` (7), `>1jt` (4).
   - **Kesiapan URL (maks 15)**: `official` (15), `user` (14), `listing` (12), `nearest` (4), `not_found`/`not_researched` (0).
   - Label tingkat: `≥80` **Prioritas Tinggi**, `60–79` **Potensial**, `<60` **Perlu Tinjau**.

## Belum ada / batasan
- Bulk approval dibatasi maksimal 50 kandidat per permintaan dan selalu menjalankan klaim atomik per kandidat (antrean `product_scraper` berjalan 1 job sekaligus).
- Perintah bot Telegram lengkap, cutover/penghentian sinkronisasi Google Sheets Fase B, dan peninjauan `cf_add_product` masih direncanakan pada tahap berikutnya (7.4–7.6).

## Dokumen lengkap
[USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md)
