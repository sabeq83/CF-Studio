# Kartu Menu: Product Database

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.52.0
Alamat: `/products` · Kelompok: PLANNING · Kunci izin menu: `product_database`

## Fungsi
Gudang data "DNA" produk jualan. Menyimpan info terstruktur (USP, target audiens, pain point, klaim, foto studio AI) hasil scraping e-commerce atau input manual. Data ini dipakai semua mesin kampanye sebagai bahan baku konten.

## Alur pakai
1. Tambah produk: tempel URL Shopee/Tokopedia atau isi form manual.
2. Sistem scrapes → AI ekstraksi → foto produk diproses (crop, hapus latar, generative polish).
3. Tinjau dan lengkapi data produk yang belum sempurna lewat Jendela Banding foto berdampingan dan tombol Enrich AI.
4. Produk siap dipilih di pipeline kampanye (Auto Pipeline, RE Campaign, Pillar Campaign, dll.).

## Terhubung dengan
- Dipakai oleh: hampir semua menu kampanye.
- Perintah MCP: `cf_add_product`, `cf_upload_product_photo`, `cf_regenerate_product_photo`, `cf_enrich_product`, `cf_get_product_detail`, `cf_update_product`, `cf_scrape_product_url`, `cf_get_scrape_status`.

## Lokasi (untuk agent)
- Halaman: `app/products/page.js`, `app/products/ProductDatabaseModal.js`, `app/products/[id]/page.js`
- Helper & view logic: `lib/product-card-photo-view.js`, `lib/product-truth-language.js`
- API: `app/api/v2/products/` (route, [id], [id]/photo-review, export, export-sheets, image, import, import-csv, re-enrich, regenerate-photos, scrape, scrape/jobs/[jobId])
- Tabel data: `product_extractions` (PostgreSQL, tenant-isolated; kolom foto mencakup `raw_photo_url`, `clean_photo_url`, `cleaned_photo_url`, `previous_clean_photo_url`)

## Aturan penting & jebakan
1. Dokumen `sot/menus/products.md` masih menyebut **SQLite** dan `better-sqlite3` — sudah usang. Database sekarang PostgreSQL.
2. Foto produk tersimpan lokal di `public/uploads/products/`; jalur relatif tersimpan di DB.
3. Generative polish scraper memakai Nano Banana 2, rasio 1:1 (sejak pasca-v2.52.0), dan membutuhkan G-Labs API aktif (cek `tenant_settings`).
4. Import CSV memiliki format kolom wajib — gunakan template export dulu sebelum import massal.
5. Scraper Tokopedia mendeteksi halaman 404 / "Waduh, tujuanmu nggak ada!" dan membatalkan pipeline ekstraksi tanpa fallback grounding halusinasi.
6. Scheduler scraping mengisolasi produk dan foto per tenant (`tenant_id`).
7. Enrichment AI produk memakai `resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' })` dari Settings tenant dengan cadangan penuh; bila semua model sibuk (503) menghasilkan `MODEL_BUSY (dapat diulang)` (`enrichment_retryable: true` di listing & detail produk).
8. Product Truth dan Geometric Truth wajib ditulis dalam Bahasa Inggris (3–4 kalimat Product Truth, 2–3 kalimat Geometric Truth) agar kompatibel dengan model video DNA AI, sementara USP dan Kategori tetap Bahasa Indonesia. Terdapat penjaga `ensureEnglishProductTruths` di worker pipeline.
9. Kartu produk default menampilkan foto bersih Studio (Hasil AI) sebagai thumbnail. Sakelar "Asli | Hasil AI" bersifat lokal tanpa write database. Klik thumbnail membuka Jendela Banding foto Asli vs Hasil AI berdampingan dengan aksi Setujui, Ganti Foto, dan Ulangi Generate.
10. Jika produk pernah digenerate ulang, versi clean sebelumnya disimpan di `previous_clean_photo_url` dan dapat dipulihkan lewat tombol "↩️ Tolak, pakai foto sebelumnya" (`POST /api/v2/products/[id]/photo-review` dengan `{ action: 'revert_previous' }`).

## Belum ada / batasan
- Scraper Playwright membutuhkan Chromium terinstall di server.

## Dokumen lengkap
`sot/menus/products.md` — ⚠️ sebagian sudah usang (menyebut SQLite); gunakan hanya untuk memahami alur AI ekstraksi dan konsep foto.
