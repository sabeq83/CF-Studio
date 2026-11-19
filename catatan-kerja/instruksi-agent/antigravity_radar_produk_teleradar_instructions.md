# Instruksi Antigravity — Menu Radar Produk (hasil TeleRadar masuk CF Studio untuk dikurasi)

Tanggal: 19 November 2026
Sumber usulan: `catatan-kerja/usulan/USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md` (wajib dibaca utuh sebelum mulai)
Penyusun instruksi: Claude (reviewer/planner). Eksekutor: Antigravity.

---

## 0. Ringkasan untuk Agent

Bangun menu baru **Radar Produk** (`/product-radar`, kelompok PLANNING, kunci izin `product_research`). Hasil riset TeleRadar masuk ke **tabel riset terpisah**, bukan ke `product_extractions`. Produk baru masuk katalog **hanya** ketika pengguna menekan **Masukkan ke Database Produk**. Kandidat riset **tidak boleh** muncul di pemilih produk kampanye maupun Auto Pipeline.

Pekerjaan dibagi menjadi **tahap dengan pintu berhenti**. Di setiap pintu 🛑, laporkan ke pengguna dan **tunggu persetujuan eksplisit** sebelum lanjut.

---

## 1. Aturan Wajib (dari AGENTS.md — jangan dilanggar)

1. **Branch**: `git checkout main && git pull && git checkout -b fitur/radar-produk`. Semua kerja di branch ini. **Tanpa** `npm run release`. Jangan merge ke `main` tanpa pernyataan pengguna bahwa fitur lolos uji Dev.
2. **Mockup dulu**: sebelum menulis React/Next.js, buat `public/mockup_radar_produk.html`, sinkronkan ke Staging 5010, dan tunggu review pengguna (Tahap 1).
3. **Semantic CSS tokens** dari `app/theme.css` saja; tidak ada warna hex/rgb hardcoded. Light & dark mode wajib rapi.
4. **Zero secret**: tidak ada kredensial/API key/password DB di kode, skrip, mockup, atau dokumen. Token operator TeleRadar disimpan di `.env` Mac Mini, bukan di repo.
5. **Next.js versi proyek berbeda dari data latih**: baca panduan di `node_modules/next/dist/docs/` untuk route handler & halaman sebelum menulis kode.
6. **Migrasi DB**: Dev/Staging berjalan dengan `DISABLE_AUTO_MIGRATIONS=true`. Tabel baru dibuat lewat skrip migrasi eksplisit (lihat §4), dijalankan manual per schema. Migrasi ke `staging` **wajib** diberitahukan ke pengguna sebelum naik Staging.
7. **Deploy Dev**: `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev` (SHA sudah ter-push). **Dilarang** deploy Staging dari branch fitur. **Dilarang** deploy Production.
8. **Implementation plan**: tulis `implementation_plan.md` di root dengan seksi `## Execution Task List` (checkbox, diperbarui real-time) dan potongan kode *Sebelum/Sesudah* untuk setiap file yang diubah.
9. **Kartu menu**: buat `sot/menus/kartu/product-radar.md`, tambahkan baris di `sot/menus/_PETA_MENU.md`, dan tambahkan 1 butir di kartu `products.md` (Radar Produk sebagai pintu masuk baru) — dalam commit fitur.
10. Kode TeleRadar di Mac Mini (`~/.claude/skills/teleradar/`) **berada di luar repo**. Jangan diubah sebelum Tahap 6 dan persetujuan pengguna.

---

## 2. Temuan Reviewer dari Kode (wajib diperhatikan, melengkapi usulan Codex)

| # | Temuan | Konsekuensi untuk implementasi |
|---|---|---|
| T1 | `createJob()` di `lib/db.js:1228` hanya `INSERT INTO scheduler_jobs` — **tidak ada idempotency key**. | Idempotensi promosi harus dijamin di tabel `product_research_imports` (unique index + klaim atomik), **bukan** mengandalkan antrean. |
| T2 | `normalizeUrl` ditulis dua kali secara inline: `app/api/v2/products/scrape/route.js:43` dan `lib/scheduler-processors.js:9246`. | Ekstrak ke helper bersama (mis. `lib/product-url-normalizer.js`), pakai di tiga tempat (scrape route, processor, Radar). Perilaku lama tidak boleh berubah — tambahkan unit test sebelum refaktor. |
| T3 | Logika scrape (cek duplikat, `reserved_ids`, `createJob('product_scraper', …)`) tertanam di route handler `POST /api/v2/products/scrape`. | Jangan memanggil route lewat HTTP dari Radar. Ekstrak inti enqueue ke fungsi layanan (mis. `enqueueProductScrape()` di `lib/product-catalog-service.js`) yang dipakai route lama **dan** Radar. Respons route lama harus tetap identik. |
| T4 | Untuk 1 URL, route membuat `reserved_ids` (`pe_<timestamp>_<rand>`) — ID produk dicadangkan sebelum job jalan. | Radar menyimpan `reserved_product_id` di tabel import saat klaim, lalu meneruskannya sebagai `reserved_ids`. Retry memakai ID yang sama → tidak ada produk ganda. |
| T5 | Sudah ada endpoint `/api/operator/v2/research-tasks` (riset CFA, bukan produk). | Gunakan nama `product-research` secara konsisten; jangan menggabungkan atau mengubah `research-tasks`. |
| T6 | `lib/operator-auth.js:20` `authenticateOperator(request, requiredScope)` memvalidasi scope; tenant diambil dari kredensial. | Scope baru: `product_research:ingest` untuk TeleRadar. Promosi ke katalog **tidak** boleh lewat scope ingest — hanya lewat sesi pengguna web yang punya izin menu `product_research` (dan, bila nanti bot butuh, scope terpisah `product_research:promote`). |
| T7 | Izin menu didaftarkan di `lib/schema/user-schema.js:10` dan dipetakan di `lib/sidebar-nav.js:8`. | Tambahkan `{ key: 'product_research', label: 'Radar Produk', category: 'PLANNING' }` dan `'/product-radar': 'product_research'`. Cek juga tempat menu sidebar dirender. |
| T8 | Penyimpanan foto produk ada di `lib/product-image-storage.js` (`detectImageMime`, `sha256Hex`, `saveRawProductImage`). | Buat fungsi serupa `saveResearchImage()` yang menyimpan ke `public/uploads/product-research/<tenant>/<batch>/…` (folder `public/uploads` sudah berada di `shared/`). Validasi MIME & ukuran (maks 5 MB). Foto riset **tidak pernah** disalin ke kolom foto `product_extractions`. |

---

## 3. Tahapan & Pintu Berhenti

### Tahap 1 — Mockup HTML 🛑
- Buat `public/mockup_radar_produk.html` mandiri (token semantik tertanam, toggle light/dark).
- Isi: tabel kandidat (foto kecil, nama, kategori, terjual/minggu, tren, komisi, harga, kecocokan URL, status kurasi, status proses, aksi), filter (batch/tanggal, kategori, tren, status URL, status kurasi, status katalog), panel detail (screenshot sumber vs listing tujuan, riset asli vs edit kurator, riwayat proses), dialog konfirmasi promosi (ringkasan valid/duplikat/tertahan).
- Pakai data contoh fiktif yang meniru 45 kandidat (6 Naik / 28 Stabil / 11 Menurun; campuran Resmi/Listing/Terdekat/Tidak ditemukan).
- Tampilkan label "Angka dari screenshot per tanggal X, bukan data real-time".
- Label **Terdekat** = belum terbukti produk sama → tombol Masukkan dinonaktifkan sampai pengguna memilih listing.
- Sinkronkan ke Staging, berikan tautan `http://100.95.245.55:5010/mockup_radar_produk.html`.
- **🛑 Berhenti. Tunggu pengguna menyetujui tampilan & alur.**

### Tahap 2 — Skema DB & Repository
- Skrip `scripts/migrate-product-research.mjs` (idempotent, `CREATE TABLE IF NOT EXISTS`, `pg_advisory_lock`, menerima `--schema dev|staging`, default dry-run, `--apply` untuk menjalankan). Jangan menyentuh `public`.
- Tabel (semua punya `tenant_id TEXT NOT NULL`, indeks per tenant):
  - `product_research_batches`: `id`, `tenant_id`, `source` ('teleradar'), `external_batch_id`, `observed_at`, `synced_at`, `metadata JSONB`. **UNIQUE** `(tenant_id, source, external_batch_id)`.
  - `product_research_candidates`: `id`, `tenant_id`, `batch_id`, `external_candidate_id`, `research_data JSONB` (data asli, ditimpa saat sinkron ulang), `curated_data JSONB` (edit kurator, **tidak pernah** ditimpa ingest), `source_url`, `url_status` (official/listing/nearest/not_found/user/not_researched), `normalized_url`, `screenshot_path`, `thumb_path`, `curation_status` (new/needs_info/ready/archived), `process_status` (not_sent/queued/processing/in_catalog/needs_review/failed), `cf_product_id`, `revision INT`, timestamps. **UNIQUE** `(tenant_id, batch_id, external_candidate_id)`.
  - `product_research_imports`: `id`, `tenant_id`, `candidate_id`, `action` (promote/link/archive/retry), `requested_by`, `reserved_product_id`, `job_id`, `status`, `error`, timestamps. **Partial UNIQUE** `(tenant_id, candidate_id) WHERE status IN ('claimed','queued','processing')` → klik ganda/retry paralel tidak bisa membuat dua job (T1).
- Repository `lib/product-research-repository.js`; setiap query **wajib** `WHERE tenant_id = ?`.
- Jalankan migrasi **hanya** ke schema `dev` untuk uji.

### Tahap 3 — API Ingest (untuk TeleRadar)
- `POST /api/operator/v2/product-research/batches` — `authenticateOperator(request, 'product_research:ingest')`, jalankan dalam `runAsOperatorTenant`.
- Payload: batch + daftar kandidat + foto (base64 atau multipart). `tenant_id` di payload **diabaikan**.
- Upsert idempotent: sinkron ulang memperbarui `research_data`, tidak mengubah `curated_data`, `curation_status`, `process_status`, `cf_product_id`.
- Batas: maks 100 kandidat/batch, foto maks 5 MB, tipe jpg/png/webp.
- Respons: jumlah dibuat/diperbarui/dilewati per kandidat (bukan sekadar "OK").
- Tambahkan scope `product_research:ingest` ke dokumentasi kredensial operator. **Ingest tidak pernah menyentuh `product_extractions`.**

### Tahap 4 — Halaman Radar Produk (React)
- `app/product-radar/page.js` sesuai mockup yang disetujui. API web: `GET /api/v2/product-research/candidates` (filter + paginasi), `GET/PATCH /api/v2/product-research/candidates/[id]` (edit URL/deskripsi/USP ke `curated_data`, cek `revision` untuk mencegah tabrakan edit), `POST …/[id]/archive`.
- Daftarkan izin & sidebar (T7). Pastikan pemilih produk kampanye/Auto Pipeline tetap hanya membaca `product_extractions`.
- Foto disajikan lewat route yang memeriksa tenant (jangan link Nextcloud atau path lokal Mac).
- **🛑 Deploy ke Dev, laporkan tautan `http://100.95.245.55:5020/product-radar` + daftar cek. Tunggu pengguna.**

### Tahap 5 — Promosi ke Database Produk
- Refaktor T2 & T3 dulu (dengan test yang membuktikan route scrape lama tetap sama).
- `POST /api/v2/product-research/candidates/[id]/promote`:
  1. Tolak bila `url_status` ∈ nearest/not_found/not_researched dan pengguna belum memilih listing (`curated_data.target_url`).
  2. Cek duplikat via `normalized_url` dalam tenant terhadap `product_extractions` (input_source/source_url). Nama mirip = **saran** saja.
  3. Jika produk sudah ada → aksi **Hubungkan** (isi `cf_product_id`, `process_status=in_catalog`), **tanpa** menimpa deskripsi, foto, atau link afiliasi produk.
  4. Jika baru → transaksi: insert `product_research_imports` status `claimed` + `reserved_product_id` (partial unique mencegah ganda) → `enqueueProductScrape({ urls:[url], reserved_ids })` → simpan `job_id`, status `queued`. Bila enqueue gagal setelah klaim, tandai `failed` dengan error agar bisa di-retry dengan `reserved_product_id` yang sama.
  5. Pelacakan: `GET …/[id]/status` membaca status job via `scrape/jobs/[jobId]` logic dan keberadaan produk. **`job_id` bukan bukti selesai**; `in_catalog` hanya bila baris `product_extractions` dengan ID tersebut ada. Foto/enrichment gagal → `needs_review` + tombol pemulihan yang memakai aksi produk yang sudah ada (bukan scrape ulang).
  6. Kandidat yang sudah punya `cf_product_id` tidak boleh di-scrape ulang.
- Teks hasil scrape tidak menimpa `curated_data`; tampilkan perbedaannya di panel detail. Aturan Product/Geometric Truth (Bahasa Inggris) tetap berlaku di katalog.
- Bulk promotion **di luar cakupan tahap ini** (lihat Tahap 7.1).
- **🛑 Deploy ke Dev, laporkan. Tunggu pengguna.**

### Tahap 6 — Migrasi 1 Batch & Adapter TeleRadar 🛑 (perlu persetujuan terpisah)
- Sebelum menyentuh Mac Mini: tulis rencana di `implementation_plan.md` dan minta persetujuan.
- Skrip impor satu batch lama (`~/riset-produk/2026-11-17/data.json`) ke **Dev**: persetujuan lama **tidak** memicu promosi; `cf_product_id` lama disimpan sebagai referensi historis (tidak dicocokkan ke Staging dari Dev).
- Adapter TeleRadar (di folder skill, luar repo): kirim batch ke API ingest; simpan JSON lokal sebagai buffer bila CF Studio tidak tersedia (status `unsynced`, kirim ulang nanti).
- Perintah bot (`/top`, `/produk`, `/status`, `/url`) dan penghentian Sheets sebagai sumber persetujuan = **Tahap 7 (7.4 & 7.5)**, jangan dikerjakan sekarang. Selama belum dialihkan, jangan menjalankan dua konsumen promosi (Sheets Fase B dan Radar) untuk batch yang sama.

---

## 4. Verifikasi Wajib (sebelum lapor tiap tahap terkait)

Buat test di `tests/product-research/` (API key/token dari env, mock string netral):

1. Ingest 45 kandidat → jumlah baris `product_extractions` tidak berubah.
2. Ingest ulang batch yang sama → tidak ada duplikat; `curated_data` dan status tidak berubah.
3. Kandidat `nearest`/`not_found` tanpa listing pilihan → promote ditolak (HTTP 422, pesan jelas).
4. Dua request promote paralel untuk kandidat yang sama → tepat 1 job `product_scraper`.
5. Retry setelah enqueue gagal → memakai `reserved_product_id` yang sama, tidak ada produk ganda.
6. Tenant B tidak bisa membaca, mengedit, atau mempromosikan kandidat tenant A (API web & operator).
7. Kandidat dengan URL yang sudah ada di katalog → dihubungkan, produk tidak diubah, tidak ada job baru.
8. Route `POST /api/v2/products/scrape` lama → respons & perilaku identik sebelum/sesudah refaktor.
9. Pemilih produk kampanye/Auto Pipeline tidak menampilkan kandidat riset.
10. Arsip kandidat tidak menghapus produk katalog.

Jalankan `npm run build` dan lint sebelum push.

---

## 5. Format Laporan ke Pengguna

Pengguna adalah marketer — laporan dalam Bahasa Indonesia sederhana, tanpa detail teknis berlebihan:
- Apa yang sudah bisa dicoba, tautannya, dan 3–6 langkah cek.
- Apa yang belum dikerjakan.
- Peringatan bila ada perubahan database (tabel baru = perlu dijalankan di Staging sebelum naik; rollback aplikasi tidak menghapus tabel).

---

## 6. Pengembangan Selanjutnya (Tahap 7 — setelah Tahap 6 selesai & disetujui)

**Jangan dikerjakan sebelum Tahap 6 selesai dan pengguna memberi lampu hijau.** Setiap butir dikerjakan sebagai branch `fitur/*` sendiri (satu branch = satu fitur), dengan mockup dulu bila menyentuh UI, dan pintu berhenti 🛑 setelah deploy Dev.

| # | Fitur | Catatan wajib |
|---|---|---|
| 7.1 | **Bulk approval** | Pilih banyak kandidat → tampilkan ringkasan valid / duplikat / tertahan sebelum eksekusi. Wajib memakai layanan promosi yang sama dengan Tahap 5 (klaim atomik per kandidat). Kandidat yang tertahan tidak ikut terkirim. Hormati batas antrean `product_scraper` (1 job berjalan sekaligus). |
| 7.2 | **Perbandingan tren lintas minggu** | Cocokkan kandidat antarbatch (via `normalized_url`/`cf_product_id`; nama mirip hanya saran). Tiap minggu tetap disimpan sebagai pengamatan terpisah, tidak ditimpa. Tampilkan tanggal pengamatan di setiap angka. |
| 7.3 | **Skor peluang** | Rumus transparan dan tertulis di kartu menu (mis. penjualan, tren, komisi, harga, kecocokan URL). Tampilkan rincian skor, bukan angka saja. Skor hanya bantuan urutan, bukan pemicu promosi otomatis. |
| 7.4 | **Perintah bot lengkap** | Arahkan `/top`, `/produk`, `/status`, `/url`, `/kirim` ke API Radar. Bila `/kirim` menyetujui lewat bot, wajib scope terpisah `product_research:promote`, identitas pengguna Telegram yang terdaftar per tenant, dan layanan promosi yang sama. Kode bot berada di Mac Mini (luar repo) — minta persetujuan sebelum mengubah. |
| 7.5 | **Penghentian Google Sheets/Excel** | Tetapkan waktu perpindahan bersama pengguna. Tarik edit Sheet terakhir dulu, impor ke Radar, lalu matikan `sheet_sync.py pull` dan Fase B lama. Sheets/Excel boleh tetap ada sebagai **ekspor satu arah** opsional. Tidak boleh ada dua konsumen promosi berjalan bersamaan. |
| 7.6 | **Perubahan `cf_add_product`** | Tinjau ulang perintah MCP `cf_add_product` agar tidak menjadi jalan pintas yang melewati Radar untuk produk hasil riset (mis. tambah perintah MCP Radar: lihat kandidat, ajukan, cek status). Perilaku lama untuk input manual tetap berjalan; perubahan wajib dicatat di kartu `products.md` dan dokumentasi MCP. |

## 7. Di Luar Cakupan (semua tahap)

Perubahan importer ZIP, deployment Staging tanpa persetujuan, dan deployment Production.
