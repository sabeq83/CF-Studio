# Kartu Menu: Product Database

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.51.0
Alamat: `/products` · Kelompok: PLANNING · Kunci izin menu: `product_database`

## Fungsi
Gudang data "DNA" produk jualan. Menyimpan info terstruktur (USP, target audiens, pain point, klaim, foto studio AI) hasil scraping e-commerce atau input manual. Data ini dipakai semua mesin kampanye sebagai bahan baku konten.

## Alur pakai
1. Tambah produk: tempel URL Shopee/Tokopedia atau isi form manual.
2. Sistem scrapes → AI ekstraksi → foto produk diproses (crop, hapus latar, generative polish).
3. Tinjau dan lengkapi data produk yang belum sempurna.
4. Produk siap dipilih di pipeline kampanye (Auto Pipeline, RE Campaign, Pillar Campaign, dll.).

## Terhubung dengan
- Dipakai oleh: hampir semua menu kampanye.
- Perintah MCP: `cf_add_product`, `cf_upload_product_photo`, `cf_regenerate_product_photo`, `cf_enrich_product`, `cf_get_product_detail`, `cf_update_product`, `cf_scrape_product_url`, `cf_get_scrape_status`.

## Lokasi (untuk agent)
- Halaman: `app/products/page.js`, `app/products/ProductDatabaseModal.js`, `app/products/[id]/page.js`
- API: `app/api/v2/products/` (route, [id], export, export-sheets, image, import, import-csv, re-enrich, regenerate-photos, scrape, scrape/jobs/[jobId])
- Tabel data: `product_extractions` (PostgreSQL, tenant-isolated)

## Aturan penting & jebakan
1. Dokumen `sot/menus/products.md` masih menyebut **SQLite** dan `better-sqlite3` — sudah usang. Database sekarang PostgreSQL.
2. Foto produk tersimpan lokal di `public/uploads/products/`; jalur relatif tersimpan di DB.
3. Generative polish membutuhkan G-Labs API aktif (cek `tenant_settings`).
4. Import CSV memiliki format kolom wajib — gunakan template export dulu sebelum import massal.
5. Scraper Tokopedia mendeteksi halaman 404 / "Waduh, tujuanmu nggak ada!" dan membatalkan pipeline ekstraksi tanpa fallback grounding halusinasi.
6. Scheduler scraping mengisolasi produk dan foto per tenant (`tenant_id`).
7. Enrichment AI produk memakai `resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' })` dari Settings tenant dengan cadangan penuh; bila semua model sibuk (503) menghasilkan `MODEL_BUSY (dapat diulang)` (`enrichment_retryable: true` di detail produk).

## Belum ada / batasan
- Scraper Playwright membutuhkan Chromium terinstall di server.

## Dokumen lengkap
`sot/menus/products.md` — ⚠️ sebagian sudah usang (menyebut SQLite); gunakan hanya untuk memahami alur AI ekstraksi dan konsep foto.
