# Implementation Plan — Hotfix Scraper Foto Produk (Revisi 02 Bagian A) — SELESAI

Tanggal: 17 November 2026 · Branch: `hotfix/scraper-foto-r02` · Basis: `main` (`8370981`) -> Merge ke `main` & Rilis `v2.50.4`
Dokumen Panduan: [antigravity_scraper_foto_produk_revisi_02.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_02.md)

---

## 1. Ringkasan Tujuan (Selesai di v2.50.4)

Menyelesaikan perbaikan bug pada scraper foto produk di server Staging (S1–S4):
- **S1 (FATAL)**: Memperbaiki `ReferenceError: processCleanInputPath is not defined` yang menyebabkan crop dan penghapusan latar belakang selalu gagal pada produk baru sejak v2.49.2. Mengintegrasikan kembali pipeline foto ke `processProductPhotoFromRaw()` serta menggabungkan seluruh alasan ke `photo_error` di `decidePhotoStatus()`.
- **S2**: Mengembalikan HTTP status dari Playwright, mendeteksi halaman 404/produk tidak ditemukan dengan fungsi murni `detectNotFoundPage()`, menolak fallback AI Search Grounding jika halaman 404, tidak menyimpan produk 404 ke database, menambahkan ringkasan status job (`status_summary`), membuat endpoint `GET /api/v2/products/scrape/jobs/[jobId]`, dan menyediakan tool MCP `cf_get_scrape_status`. Menandai produk 404 staging (Texania).
- **S3**: Memvalidasi URL kandidat gambar (menolak domain-only seperti `https://images.tokopedia.net` tanpa path gambar yang sah) serta men-decode entitas HTML (`&amp;` -> `&`) pada URL regex.
- **S4**: Menyertakan `tenant_id: getActiveTenantId()` pada seluruh payload `createJob('product_scraper', ...)` dan `createJob('product_photo_replace', ...)`, serta memastikan query produk lama dibatasi pada tenant aktif (`WHERE tenant_id = ?`).

---

## 2. Status Pelaksanaan
Semua task Bagian A telah lolos verifikasi, digabung ke `main`, dirilis sebagai tag `v2.50.4`, dan berhasil dideploy secara atomic ke Mac Mini Staging (port 5010 & 7010).
