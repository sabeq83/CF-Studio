# Implementation Plan — Tahap 7.1: Bulk Approval Radar Produk

Tanggal: 19 November 2026  
Branch: `fitur/radar-bulk-approval` (bercabang dari `fitur/radar-produk`)  
Sumber Instruksi: [antigravity_radar_produk_teleradar_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_radar_produk_teleradar_instructions.md) (§6 Butir 7.1)

---

## Ringkasan Fitur (7.1 Bulk Approval)

Menambahkan kemampuan memilih banyak kandidat sekaligus di halaman **Radar Produk** (`/product-radar`), menampilkan **ringkasan terklasifikasi** (Valid / Duplikat / Tertahan) sebelum eksekusi, dan mengeksekusi promosi **melalui layanan promosi yang sama dengan Tahap 5** (`promoteResearchCandidate()` — klaim atomik per kandidat dengan `reserved_product_id` dan `enqueueProductScrape`), sambil:
1. Menahan kandidat yang tidak valid (`Terdekat`, `Tidak ditemukan`, `Belum diriset` tanpa pilihan URL, atau sudah masuk/antre/diproses) agar **tidak ikut terkirim**.
2. Memastikan tiap job `product_scraper` berisi maksimal 1 produk per klaim/job (atau antrean bertahap) sehingga batas `QUEUE_CONCURRENCY.product_scraper = 1` di `lib/scheduler.js` selalu dihormati tanpa membebani browser/worker.
3. Memberi batas aman seleksi per batch eksekusi (mis. maks 25 atau 50 kandidat per permintaan) dan laporan hasil per kandidat (`queued`, `linked`, `skipped_blocked`, `conflict`, `failed`).

---

## Execution Task List

### Langkah 1 — Mockup HTML Interaktif (Pintu Review UI 🛑)
- [x] Siapkan branch `fitur/radar-bulk-approval` dari `fitur/radar-produk`
- [x] Buat `public/mockup_radar_bulk_approval.html` mandiri (semantic CSS tokens dari `app/theme.css`, toggle Light/Dark) yang menyimulasikan:
  - Checkbox multi-pilih + quick-select ("Pilih yang Siap di Halaman Ini" / "Pilih Campuran Uji" / "Bersihkan")
  - Bilah aksi massal mengambang/lengket dengan ringkasan cepat (`X Valid`, `Y Duplikat`, `Z Tertahan`)
  - Dialog Konfirmasi Bulk Approval dengan rincian 3 kelompok (**Valid · Scrape Baru**, **Duplikat · Hubungkan**, **Tertahan · Tidak Ikut Terkirim**)
  - Panel Antrean Langsung (*1-per-1 slot aktif*) yang menyimulasikan eksekusi bertahap (`Antre` → `Diproses (1/1 slot)` → `Masuk katalog` + simulasi retry aman)
- [x] Sinkronkan ke Mac Mini (`~/maknaflow-staging-atomic/current/public/mockup_radar_bulk_approval.html`); catatan: Next.js 16 production (`maknaflow-staging-ui`) meng-cache `public/` saat boot (return 404 sebelum reload)
- [ ] **🛑 Berhenti:** Laporkan mockup ke pengguna & tunggu persetujuan tampilan/alur sebelum menulis kode React/API

### Langkah 2 — Backend Bulk Preview & Bulk Promote API
- [ ] Buat helper `previewBulkResearchPromotion(candidateIds)` & `promoteResearchCandidatesBulk(candidateIds, { requestedBy })` di `lib/product-research-promotion-service.js` (memanggil ulang `promoteResearchCandidate()` secara atomik per kandidat, menolak/melewati kandidat tertahan tanpa mengirim job, mengembalikan hasil per kandidat + status antrean `product_scraper`)
- [ ] Buat `POST /api/v2/product-research/candidates/bulk-promote` (`withProductResearchAccess`, mendukung `mode: 'preview' | 'execute'`, batas maks 50 ID per request)
- [ ] Tambahkan unit & integration test di `tests/product-research/bulk-promote.test.js` (klasifikasi valid/duplikat/tertahan, kandidat tertahan tidak terkirim, klaim atomik per kandidat, isolasi tenant, batas `product_scraper` 1 job berjalan sekaligus)

### Langkah 3 — UI Bulk Approval di `/product-radar` & Deploy Dev (Pintu Berhenti 🛑)
- [ ] Tambahkan checkbox multi-pilih, bilah aksi massal, dialog ringkasan Valid/Duplikat/Tertahan, dan panel pantauan antrean bertahap di `app/product-radar/page.js` & `product-radar.module.css`
- [ ] Perbarui `sot/menus/kartu/product-radar.md` untuk mencatat fitur Bulk Approval & batasannya
- [ ] Jalankan seluruh test suite (`tests/product-research/*.test.js`), push branch, deploy ke **Dev**, dan verifikasi
- [ ] **🛑 Berhenti:** Laporkan tautan Dev + daftar cek ke pengguna

---

## Rancangan Perubahan File (Code Sebelum & Sesudah)

### Langkah 1 — File Baru: `public/mockup_radar_bulk_approval.html`

**Code Sebelum (Current/Before):**
```text
(Mockup khusus alur Bulk Approval Tahap 7.1 + simulasi antrean 1-per-1 belum ada)
```

**Code Sesudah (Proposed/After):**
```html
<!-- File baru: public/mockup_radar_bulk_approval.html -->
<!-- Mockup standalone interaktif Tahap 7.1 Bulk Approval:
     - Token semantik tertanam dari app/theme.css (Light/Dark mode)
     - Multi-select checkboxes + tombol cepat pilih siap / campuran uji
     - Bilah aksi massal dengan rincian real-time Valid / Duplikat / Tertahan
     - Dialog konfirmasi 3 kelompok (kandidat tertahan jelas ditandai tidak ikut terkirim)
     - Simulasi antrean product_scraper 1-per-1 (1 slot aktif, sisanya antre) + retry idempotent
-->
```

*(Potongan kode Sebelum/Sesudah untuk Langkah 2–3 akan dilengkapi setelah pengguna meninjau mockup Tahap 7.1.)*
