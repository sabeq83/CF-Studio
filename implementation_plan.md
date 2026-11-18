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
- [ ] Buat helper penyimpanan foto riset `saveResearchImage()` di `lib/product-research-image-storage.js` (`public/uploads/product-research/<tenant>/<batch>/`, validasi MIME & maks 5 MB)
- [ ] Buat `app/api/operator/v2/product-research/batches/route.js` (`authenticateOperator(request, 'product_research:ingest')`, `runAsOperatorTenant`, idempotent upsert, maks 100 kandidat/batch)
- [ ] Perbarui dokumentasi kredensial operator untuk scope `product_research:ingest`

### Tahap 4 — Halaman Radar Produk & Izin Menu (Pintu Berhenti 2 🛑)
- [ ] Daftarkan kunci izin `product_research` di `lib/schema/user-schema.js` dan navigasi `/product-radar` di `lib/sidebar-nav.js`
- [ ] Buat API web: `GET /api/v2/product-research/candidates`, `GET/PATCH /api/v2/product-research/candidates/[id]`, `POST /api/v2/product-research/candidates/[id]/archive`, dan route foto terotorisasi tenant
- [ ] Buat halaman `app/product-radar/page.js` beserta panel detail sesuai mockup yang disetujui
- [ ] Verifikasi & deploy ke **Dev** (`http://100.95.245.55:5020/product-radar`)
- [ ] **🛑 Berhenti:** Laporkan tautan Dev + daftar cek ke pengguna

### Tahap 5 — Promosi ke Database Produk (Pintu Berhenti 3 🛑)
- [ ] Tambahkan unit test sebelum refaktor untuk `normalizeUrl` & kontrak `POST /api/v2/products/scrape`
- [ ] Ekstrak `lib/product-url-normalizer.js` (T2) dan `enqueueProductScrape()` di `lib/product-catalog-service.js` (T3), lalu pakai di scrape route, scheduler processor, dan Radar
- [ ] Buat `POST /api/v2/product-research/candidates/[id]/promote` dan `GET /api/v2/product-research/candidates/[id]/status` (tolak `nearest`/`not_found`/`not_researched`, cek duplikat URL, link existing, klaim atomik `reserved_product_id`, pemulihan `needs_review`)
- [ ] Lengkapi seluruh 10 skenario test di `tests/product-research/` + `npm run build` + lint
- [ ] Buat kartu menu `sot/menus/kartu/product-radar.md`, perbarui `sot/menus/_PETA_MENU.md`, dan perbarui `sot/menus/kartu/products.md`
- [ ] Deploy ke **Dev** & laporkan hasil verifikasi
- [ ] **🛑 Berhenti:** Tunggu persetujuan pengguna

### Tahap 6 — Migrasi 1 Batch & Adapter TeleRadar (Pintu Berhenti 4 🛑)
- [ ] Susun rencana terpisah sebelum menyentuh kode di Mac Mini (`~/.claude/skills/teleradar/`) dan minta persetujuan eksplisit pengguna

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
