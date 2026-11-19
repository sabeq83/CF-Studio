# Implementation Plan — Menu Radar Produk (Hasil TeleRadar Masuk CF Studio)

Tanggal: 19 November 2026  
Branch: `fitur/radar-produk`  
Sumber Instruksi: [antigravity_radar_produk_teleradar_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_radar_produk_teleradar_instructions.md)  
Sumber Usulan: [USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md)

---

## Ringkasan Arsitektur

Membangun menu baru **Radar Produk** (`/product-radar`, kelompok `PLANNING`, kunci izin `product_research`) sebagai pintu kurasi kandidat riset TeleRadar sebelum masuk ke katalog utama `product_extractions`.

Prinsip kunci:
1. Kandidat riset disimpan terpisah di `product_research_batches`, `product_research_candidates`, dan `product_research_imports` (terisolasi `tenant_id`).
2. Pemilih produk kampanye dan Auto Pipeline tetap membaca `product_extractions` saja.
3. Promosi ke katalog hanya terjadi saat pengguna menekan **Masukkan ke Database Produk**, dengan klaim atomik di `product_research_imports` (partial unique index) + pemakaian ulang normalizer URL dan `enqueueProductScrape()`.
4. Pengerjaan dibagi bertahap dengan pintu berhenti (🛑) untuk review pengguna.

---

## Execution Task List

### Tahap 1 — Mockup HTML Interaktif (Pintu Berhenti 1 🛑)
- [x] Siapkan branch `fitur/radar-produk` dari `main` terbaru
- [x] Buat `public/mockup_radar_produk.html` mandiri (semantic CSS tokens dari `app/theme.css`, toggle Light/Dark, 45 kandidat fiktif: 6 Naik / 28 Stabil / 11 Menurun, campuran URL Resmi/Listing/Terdekat/Tidak ditemukan/Dari pengguna)
- [x] Sinkronkan `public/mockup_radar_produk.html` ke server Staging Mac Mini (`~/maknaflow-staging-atomic/current/public/mockup_radar_produk.html`); catatan: Next.js 16 production (`maknaflow-staging-ui`) meng-cache daftar `public/` saat boot dan sedang menjalankan `[Campaign Scheduler] Already running.` sehingga belum di-restart sepihak (return 404 sebelum reload)
- [x] **🛑 Berhenti:** Laporkan tautan mockup ke pengguna & tunggu persetujuan tampilan/alur

### Tahap 2 — Skema DB & Repository
- [x] Buat skrip migrasi idempotent `scripts/migrate-product-research.mjs` (`--schema dev|staging`, default dry-run, `--apply`, advisory lock, tabel `product_research_batches`, `product_research_candidates`, `product_research_imports`)
- [x] Jalankan migrasi ke schema `dev` saja
- [x] Buat `lib/product-research-repository.js` dengan isolasi `WHERE tenant_id = $1` di semua query dan klaim atomik (termasuk `lib/product-url-normalizer.js` & unit/integration test Tahap 2)

### Tahap 3 — API Ingest Operator (untuk TeleRadar)
- [x] Buat helper penyimpanan foto riset `saveResearchImage()` di `lib/product-research-image-storage.js` (`public/uploads/product-research/<tenant>/<batch>/`, validasi MIME & maks 5 MB)
- [x] Buat `app/api/operator/v2/product-research/batches/route.js` (`authenticateOperator(request, 'product_research:ingest')`, `runAsOperatorTenant`, idempotent upsert, maks 100 kandidat/batch)
- [x] Perbarui dokumentasi kredensial operator untuk scope `product_research:ingest` (`sot/global/operator-api.md`) & verifikasi test ingest API (10/10 lolos)

### Tahap 4 — Halaman Radar Produk & Izin Menu (Pintu Berhenti 2 🛑)
- [x] Daftarkan kunci izin `product_research` di `lib/schema/user-schema.js` dan navigasi `/product-radar` di `lib/sidebar-nav.js` (serta `withProductResearchAccess` di `lib/auth.js`)
- [x] Buat API web: `GET /api/v2/product-research/candidates`, `GET/PATCH /api/v2/product-research/candidates/[id]`, `POST /api/v2/product-research/candidates/[id]/archive`, dan route foto terotorisasi tenant
- [x] Buat halaman `app/product-radar/page.js` beserta panel detail sesuai mockup yang disetujui
- [x] Verifikasi & deploy ke **Dev** (`http://100.95.245.55:5020/product-radar`, SHA `f30bb38bbc5859440cd767e381df255432795e88`, release `20261118T233905Z-f30bb38bbc58`)
- [ ] **🛑 Berhenti:** Laporkan tautan Dev + daftar cek ke pengguna

### Tahap 5 — Promosi ke Database Produk (Pintu Berhenti 3 🛑)
- [x] Tambahkan unit test sebelum refaktor untuk `normalizeUrl` & kontrak `POST /api/v2/products/scrape`
- [x] Ekstrak `lib/product-url-normalizer.js` (T2) dan `enqueueProductScrape()` + `getProductScrapeJobStatus()` di `lib/product-catalog-service.js` (T3), lalu pakai di scrape route, scheduler processor, dan Radar
- [x] Buat `POST /api/v2/product-research/candidates/[id]/promote` dan `GET /api/v2/product-research/candidates/[id]/status` (tolak `nearest`/`not_found`/`not_researched`, cek duplikat URL, link existing, klaim atomik `reserved_product_id`, pemulihan `needs_review`)
- [x] Lengkapi seluruh 10 skenario test di `tests/product-research/` (22/22 test lolos) + `npm run build`
- [x] Buat kartu menu `sot/menus/kartu/product-radar.md`, perbarui `sot/menus/_PETA_MENU.md`, dan perbarui `sot/menus/kartu/products.md`
- [x] Deploy ke **Dev** & laporkan hasil verifikasi (SHA `5d3b52c2f30c961060a9c0f667f90aba37c149e2`, release `20261119T000919Z-5d3b52c2f30c`)
- [ ] **🛑 Berhenti:** Tunggu persetujuan pengguna

### Tahap 6 — Migrasi 1 Batch & Adapter TeleRadar (Pintu Berhenti 4 🛑)
- [x] Inspeksi read-only `~/riset-produk/2026-11-17/data.json` dan `~/.claude/skills/teleradar/scripts/` serta susun rencana Tahap 6 di `implementation_plan.md`
- [x] Buat skrip `scripts/import-teleradar-batch-to-dev.mjs` + mapper `lib/teleradar-batch-mapper.js` + test, dan impor 1 batch lama (`~/riset-produk/2026-11-17/data.json`: 45 kandidat + 45 foto) ke schema `dev` (persetujuan lama tidak memicu promosi; `cf_product_id` lama hanya referensi historis)
- [x] Buat adapter `~/.claude/skills/teleradar/scripts/radar_sync.py` + pembaruan `SKILL.md` Fase A untuk kirim batch ke `POST /api/operator/v2/product-research/batches` dengan buffer lokal status `unsynced` (teruji offline `unsynced` → `retry` `synced`; tanpa mengubah bot `/top`, `/produk`, `/status`, `/url` dan tanpa mematikan Sheets)

---

## Rancangan Perubahan File (Code Sebelum & Sesudah)

### Tahap 1 — File Baru: `public/mockup_radar_produk.html`

**Code Sebelum (Current/Before):**
```text
(File belum ada di public/mockup_radar_produk.html)
```

**Code Sesudah (Proposed/After):**
```html
<!-- File baru: public/mockup_radar_produk.html -->
<!-- Mockup standalone interaktif Radar Produk:
     - Token semantik tertanam dari app/theme.css (Light/Dark toggle)
     - 45 kandidat fiktif (6 Naik / 28 Stabil / 11 Menurun; 22 Resmi / 6 Listing / 14 Terdekat / 2 Tidak ditemukan / 1 Dari pengguna)
     - Label pengamatan: "Angka dari screenshot per tanggal 17 Nov 2026, bukan data real-time"
     - Filter batch, kategori, tren, status URL, status kurasi, status katalog
     - Panel detail: screenshot sumber vs listing tujuan, riset asli vs edit kurator, riwayat proses
     - Tombol Masukkan dinonaktifkan untuk status Terdekat/Tidak ditemukan sampai listing dipilih
     - Dialog konfirmasi promosi (ringkasan valid / duplikat / tertahan)
-->
```

*(Potongan kode Sebelum/Sesudah untuk Tahap 2: Skema DB, Skrip Migrasi, Normalizer URL, dan Repository)*

### Tahap 2 — File Baru: `lib/product-url-normalizer.js`

**Code Sebelum (Current/Before):**
```text
(Helper terpusat belum ada; normalizeUrl masih inline di app/api/v2/products/scrape/route.js dan lib/scheduler-processors.js)
```

**Code Sesudah (Proposed/After):**
```js
// lib/product-url-normalizer.js
export function normalizeProductUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let normalized = parsed.toString().trim();
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    normalized = normalized.replace('://www.', '://');
    return normalized;
  } catch {
    let cleaned = url.trim().split('?')[0].split('#')[0];
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  }
}
```

### Tahap 2 — File Baru: `scripts/migrate-product-research.mjs`

**Code Sebelum (Current/Before):**
```text
(Tabel product_research_batches, product_research_candidates, dan product_research_imports belum ada di database)
```

**Code Sesudah (Proposed/After):**
```js
// scripts/migrate-product-research.mjs
// - Memvalidasi --schema dev|staging (menolak 'public')
// - Default dry-run; eksekusi DDL hanya jika --apply disertakan
// - Menggunakan pg_advisory_lock(hashtext('makna_product_research_v1')) + CREATE TABLE/INDEX IF NOT EXISTS
// - Membuat partial unique index uq_pri_active_claim ON product_research_imports(tenant_id, candidate_id)
//   WHERE status IN ('claimed','queued','processing')
```

### Tahap 2 — File Baru: `lib/product-research-repository.js`

**Code Sebelum (Current/Before):**
```text
(Repository terisolasi tenant untuk Radar Produk belum ada)
```

**Code Sesudah (Proposed/After):**
```js
// lib/product-research-repository.js
// - Semua query mewajibkan WHERE tenant_id = $... via getActiveTenantId()
// - upsertResearchCandidates: hanya memperbarui research_data (tidak pernah menimpa curated_data, curation_status, process_status, cf_product_id)
// - updateResearchCandidateCuration: optimistic locking dengan revision
// - claimCandidatePromotion: transaksi + FOR UPDATE + klaim atomik di product_research_imports + reuse reserved_product_id saat retry
```

### Tahap 3 — File Baru: `lib/product-research-image-storage.js`

**Code Sebelum (Current/Before):**
```text
(Penyimpanan foto riset terisolasi dari product_extractions belum ada)
```

**Code Sesudah (Proposed/After):**
```js
// lib/product-research-image-storage.js
// - Menggunakan ulang detectImageMime & sha256Hex dari lib/product-image-storage.js
// - Batas ukuran 5 MB, hanya image/jpeg, image/png, image/webp
// - Menyimpan ke public/uploads/product-research/<tenant>/<batch>/<candidate>_<kind>_<sha12>.<ext>
// - Tidak pernah menyentuh tabel atau kolom foto product_extractions
```

### Tahap 3 — File Baru: `lib/product-research-ingest-service.js` & `app/api/operator/v2/product-research/batches/route.js`

**Code Sebelum (Current/Before):**
```text
(Endpoint POST /api/operator/v2/product-research/batches belum ada)
```

**Code Sesudah (Proposed/After):**
```js
// app/api/operator/v2/product-research/batches/route.js
// - authenticateOperator(request, 'product_research:ingest')
// - runAsOperatorTenant(identity, ...) -> tenant_id di payload diabaikan total
// - Mendukung application/json (base64) dan multipart/form-data
// - Validasi maks 100 kandidat/batch, foto maks 5 MB, jpg/png/webp
// - Mengembalikan summary (created/updated/skipped) dan status per kandidat
```

### Tahap 3 — Pembaruan Dokumentasi: `sot/global/operator-api.md`

**Code Sebelum (Current/Before):**
```markdown
- Operator v2 mendukung research callback, status runs, dan exact revision approval untuk publishing.
```

**Code Sesudah (Proposed/After):**
```markdown
- Operator v2 mendukung research callback, status runs, exact revision approval untuk publishing, serta ingest kandidat Radar Produk (`product_research:ingest`).
```
*(Ditambah seksi dokumentasi scope `product_research:ingest` dan kontrak `POST /api/operator/v2/product-research/batches`.)*

### Tahap 4 — Izin Menu & Sidebar (`lib/schema/user-schema.js`, `lib/sidebar-nav.js`, `lib/auth.js`)

**Code Sebelum (Current/Before):**
```js
// lib/schema/user-schema.js
  { key: 'content_planner', label: 'Content Planner Calendar', category: 'PLANNING' },
  { key: 'product_database', label: 'Product Database', category: 'PLANNING' },

// lib/sidebar-nav.js
  '/products': 'product_database',
```

**Code Sesudah (Proposed/After):**
```js
// lib/schema/user-schema.js
  { key: 'content_planner', label: 'Content Planner Calendar', category: 'PLANNING' },
  { key: 'product_research', label: 'Radar Produk', category: 'PLANNING' },
  { key: 'product_database', label: 'Product Database', category: 'PLANNING' },

// lib/sidebar-nav.js
  '/product-radar': 'product_research',
  '/products': 'product_database',
// + entri navItems PLANNING & PLANNING_SECTION_HREFS + helper withProductResearchAccess di lib/auth.js
```

### Tahap 4 — Web API & Halaman React (`/product-radar`)

**Code Sebelum (Current/Before):**
```text
(Halaman app/product-radar/page.js dan API /api/v2/product-research/candidates/* belum ada)
```

**Code Sesudah (Proposed/After):**
```text
- app/api/v2/product-research/candidates/route.js (GET daftar kandidat terfilter, paginasi, batch list, ringkasan KPI, info duplikat katalog read-only)
- app/api/v2/product-research/candidates/[id]/route.js (GET detail + riwayat, PATCH edit kurator & target_url dengan revision check)
- app/api/v2/product-research/candidates/[id]/archive/route.js (POST arsip/batal arsip tanpa menyentuh katalog)
- app/api/v2/product-research/candidates/[id]/image/route.js (GET foto riset terotorisasi tenant)
- app/product-radar/page.js + CandidateDetailDrawer.js + product-radar.module.css (100% semantic CSS tokens, sesuai mockup yang disetujui; tombol Masukkan disiapkan dengan status Tahap 5 atau info siap)
```

### Tahap 5 — Refaktor T2 & T3 (`lib/product-catalog-service.js`, `app/api/v2/products/scrape/route.js`, `app/api/v2/products/scrape/jobs/[jobId]/route.js`, `lib/scheduler-processors.js`)

**Code Sebelum (Current/Before):**
```js
// app/api/v2/products/scrape/route.js
function normalizeUrl(url) { /* duplikat inline */ }
export const POST = withTenantContext(async (req) => {
  /* cek duplikat, reserved_ids, createJob('product_scraper', ...) inline */
});

// lib/scheduler-processors.js:9246
const normalizeUrl = (url) => { /* duplikat inline kedua */ };
```

**Code Sesudah (Proposed/After):**
```js
// lib/product-catalog-service.js
export async function enqueueProductScrape(input, deps = {}) { /* inti cek duplikat + reserved_ids + createJob */ }
export async function getProductScrapeJobStatus(jobId) { /* baca status scheduler_jobs per tenant */ }

// app/api/v2/products/scrape/route.js & lib/scheduler-processors.js
import { normalizeProductUrl } from '@/lib/product-url-normalizer'; // satu helper bersama
```

### Tahap 5 — Promosi & Pelacakan Radar Produk (`lib/product-research-promotion-service.js`, `.../promote/route.js`, `.../status/route.js`)

**Code Sebelum (Current/Before):**
```text
(Promosi dari Radar Produk hanya placeholder UI; belum ada endpoint promote/status)
```

**Code Sesudah (Proposed/After):**
```js
// POST /api/v2/product-research/candidates/[id]/promote
// 1. Tolak url_status nearest/not_found/not_researched tanpa curated_data.target_url (HTTP 422)
// 2. Tolak kandidat yang sudah punya cf_product_id (HTTP 409)
// 3. Cek duplikat via normalized_url terhadap product_extractions tenant -> jika ada, Hubungkan tanpa menimpa produk
// 4. Jika baru -> claimCandidatePromotion() (partial unique + reserved_product_id) -> enqueueProductScrape() -> markPromotionQueued() / markPromotionFailed()

// GET /api/v2/product-research/candidates/[id]/status
// - Membaca status job via getProductScrapeJobStatus() + verifikasi baris product_extractions
// - in_catalog hanya jika baris product_extractions benar-benar ada
// - photo_status/enrichment_status gagal -> needs_review dengan aksi pemulihan produk (tanpa scrape ulang)
```

---

### Tahap 6 — Rencana Impor 1 Batch Lama ke Dev & Adapter TeleRadar di Mac Mini (Menunggu Persetujuan Sebelum Menyentuh Mac Mini)

#### 6A. Skrip Impor 1 Batch Lama (`scripts/import-teleradar-batch-to-dev.mjs` — di repo)
- **Sumber data:** salinan/bacaan `~/riset-produk/2026-11-17/data.json` (45 item `produk`) + foto `~/riset-produk/2026-11-17/foto/<no>.jpg`.
- **Aturan keamanan:**
  - Wajib hanya menargetkan schema **`dev`** (menolak `staging` dan `public`). Default `--dry-run`, perlu `--apply --confirm-dev` untuk menulis.
  - Persetujuan lama (`disetujui: true`) **tidak pernah** memicu promosi atau membuat job `product_scraper`.
  - `cf_product_id` lama dari Staging disimpan sebagai referensi historis di `research_data.legacy_staging_cf_product_id` dan `research_data.legacy_cf_status` (**tidak** diisi ke `product_research_candidates.cf_product_id` dan **tidak** dicocokkan terhadap Staging dari Dev).
  - Pemetaan field TeleRadar → Radar Produk:
    - `tren`: `Naik` → `up`, `Stabil` → `stable`, `Menurun` → `down`
    - `status_url`: `Resmi` → `official`, `Listing` → `listing`, `Terdekat` → `nearest`, `Tidak ditemukan` → `not_found`, `Dari pengguna` → `user`
    - `komisi` → `commission_rp`, `terjual` → `sold_per_week`, `toko` → `brand`, `no` → `external_candidate_id`
    - `foto` lokal (`<no>.jpg`) diunggah lewat `saveResearchImage()` ke `public/uploads/product-research/<tenant>/2026-11-17/...` (dan disinkronkan ke `~/maknaflow-dev-atomic/shared/public/uploads/product-research/...`).

#### 6B. Adapter TeleRadar di Mac Mini (`~/.claude/skills/teleradar/` — luar repo, **BELUM DISENTUH**)

**Code Sebelum (Current/Before di `~/.claude/skills/teleradar/SKILL.md` Fase A):**
```text
- Fase A hanya menulis data.json lokal, potong_foto.py, nextcloud_foto.py, buat_excel.py, lalu sheet_sync.py push.
- Belum ada pengiriman batch ke API Radar Produk CF Studio maupun status buffer lokal unsynced.
```

**Code Sesudah (Proposed/After di `~/.claude/skills/teleradar/`):**
```text
1. Cadangkan ~/.claude/skills/teleradar/ ke backup sebelum edit.
2. Tambah ~/.claude/skills/teleradar/scripts/radar_sync.py:
   - Membaca token & base URL dari env/konfigurasi lokal Mac Mini (~/.claude/skills/teleradar/.env atau $TG_CONF, TANPA menyimpan token di repo).
   - Mengirim batch + 1..100 kandidat + thumbnail foto (base64/multipart) ke POST /api/operator/v2/product-research/batches (header Authorization: Bearer <token> dengan scope product_research:ingest).
   - Menyimpan status sinkron lokal di data.json / radar_sync_state.json: jika CF Studio unreachable / HTTP >= 500 / timeout, tandai batch status "unsynced" agar bisa dikirim ulang saat run berikutnya (`radar_sync.py retry`) tanpa kehilangan data atau membuat duplikat.
   - Tidak menyentuh teleradar_bot.py (/top, /produk, /status, /url = Tahap 7.4) dan tidak mematikan Sheets (Tahap 7.5).
   - Aturan guard: jangan menjalankan dua konsumen promosi (Sheets Fase B dan Radar) bersamaan untuk batch yang sama.
```
