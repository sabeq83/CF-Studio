# Implementation Plan — Hapus Fitur Instant Factory & Sheets Autopilot

Tanggal: 17 November 2026 · Branch: `fitur/hapus-instant-sheets` · Basis: `main` (`v2.50.4`)  
Dokumen Panduan: [antigravity_hapus_instant_factory_sheets_autopilot_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_hapus_instant_factory_sheets_autopilot_instructions.md)

---

## 1. Ringkasan Tujuan

Menghapus seluruh halaman, API route, worker, tick scheduler, dan integrasi UI/backend dari **Instant Factory** dan **Sheets Autopilot**, tanpa menghapus tabel database yang sudah ada dan tanpa mengganggu fitur aktif (Video Studio, ContentFlow, TTS Studio, Affiliate Studio, Scheduler, dan `pipeline-v54`).

### Hasil Cek Database Awal (3 Schema: `dev`, `staging`, `public` — Read-Only)
- `instant_campaigns`, `instant_campaign_items`, `instant_campaign_outputs`, `instant_campaign_configs`, `sheets_campaigns`, `sheets_jobs`, `pipeline_assets`: **0 baris** di ketiga schema.
- `scheduler_jobs` (antrean `instant%` / `%sheets%`): **0 baris** di ketiga schema.
- `settings` & `tenant_settings` (kunci `*instant*` / `*sheets*`): **0 baris** di ketiga schema.
- `content_flow_items.source_type`: Tidak ada tipe `instant` maupun `sheets` di ketiga schema (`dev`: opc 903, re 126, multiplier 13, strategic 6, bridge 4, recipe 2; `staging`: opc 4137, re 702, multiplier 168, strategic 6, recipe 4; `public`: null 11, opc 5).

### Temuan `pipeline-v54`
- `app/pipeline/page.js` masih memanggil `/api/pipeline-v54/*`, dan `lib/product-repository.js` membersihkan `pipeline_assets` saat produk dihapus.
- Oleh karena itu `app/api/pipeline-v54/**` dan fungsi `*PipelineAsset*` dipertahankan; label "Instant Factory Pipeline" di `lib/contentflow-ingest.js` diubah menjadi netral (`Pipeline v5.4`).

---

## 2. Before & After Code Snippets (Tahap 1 & Tahap 2)

### 2.1. `lib/campaign-scheduler.js` (Hapus Tick Instant & Sheets Autopilot)

#### Sebelum (Current/Before):
```javascript
import { getDb, listReCampaignItems, listPillarCampaignItems, getSetting, updateReCampaignItem, updatePillarCampaignItem, updateInstantCampaignItem, listInstantCampaignItems } from './db.js';
import {
  ...,
  processInstantRowProductSourcing,
  processInstantGenerator,
  processInstantTts,
  processInstantGlabs,
  processInstantFfmpeg,
  processInstantSocialPoster,
  ...
} from './scheduler-processors.js';
import { runSyncWorker } from './sheets-autopilot-worker.js';
// ...
  // --- INSTANT CAMPAIGN TICKING ENGINE (v9.0) ---
  const instantCampaigns = await db.prepare("SELECT * FROM instant_campaigns ...").all();
  // ... (baris 921-1107)
  // --- SHEETS AUTOPILOT SCHEDULER TICK (v10.5) ---
  const isSchedulerActive = await getSetting('sheets_autopilot_scheduler_active') === 'true';
  // ... (baris 1109-1130)
```

#### Sesudah (Proposed/After):
```javascript
import { getDb, listReCampaignItems, listPillarCampaignItems, getSetting, updateReCampaignItem, updatePillarCampaignItem } from './db.js';
// Impor processor Instant & runSyncWorker dihapus
// State lastSheetsSyncTime, isSheetsSyncRunning, dan tick loop Instant/Sheets dihapus
```

### 2.2. `lib/gemini.js` (Bersihkan Entri Model Matrix)

#### Sebelum (Current/Before):
```javascript
  INSTANT_FACTORY: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  MULTIPLIER_LAB: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  BRIDGE_INJECT: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  SHEETS_AUTOPILOT: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
```

#### Sesudah (Proposed/After):
```javascript
  MULTIPLIER_LAB: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  BRIDGE_INJECT: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
```

### 2.3. `app/api/video-studio/render/route.js` & `lib/video-studio-finishing-source.js`

#### Sebelum (Current/Before):
```javascript
// render/route.js: memproses cabang video_source_type === 'instant_factory'
// video-studio-finishing-source.js: mendukung 're_campaign' | 'instant_factory'
```

#### Sesudah (Proposed/After):
```javascript
// render/route.js: menolak eksplisit video_source_type === 'instant_factory' dengan status 400
if (video_source_type === 'instant_factory') {
  return NextResponse.json(
    { success: false, error: 'Sumber video instant_factory sudah tidak didukung dan telah dihapus.' },
    { status: 400 }
  );
}
// video-studio-finishing-source.js: hanya mendukung 're_campaign' (dan sumber aktif lain)
```

### 2.4. `lib/db-pg.js` (Pertahankan Migrasi, Hapus Daftar CRUD `sheets_campaigns`)

#### Sebelum (Current/Before):
```javascript
const tables = ['re_campaigns', 'pillar_campaigns', 'sheets_campaigns'];
```

#### Sesudah (Proposed/After):
```javascript
const tables = ['re_campaigns', 'pillar_campaigns'];
```

---

## 3. Execution Task List

- [x] **Task 1: Hapus Halaman, API, Worker, dan Dokumen Fitur Instant Factory & Sheets Autopilot (Tahap 1)**
  - [x] Hapus `app/instant-factory/` dan `app/api/v2/instant-factory/`
  - [x] Hapus `app/sheets-autopilot/` dan `app/api/sheets-autopilot/`
  - [x] Hapus `lib/sheets-autopilot-worker.js`
  - [x] Pindahkan `sot/menus/instant-factory.md` & `sot/menus/sheets-autopilot.md` ke `sot/menus/arsip/`
  - [x] Hapus processor Instant & helper khusus Instant di `lib/scheduler-processors.js` (setelah audit pemakaian via `git grep`)
  - [x] Hapus loop tick Instant & Sheets Autopilot di `lib/campaign-scheduler.js`
  - [x] Bersihkan fungsi CRUD khusus `instant_campaign*` & `sheets_campaigns`/`sheets_jobs` di `lib/db.js` dan `lib/db-pg.js` (tanpa menghapus `CREATE/ALTER TABLE`)

- [x] **Task 2: Bersihkan Sambungan di Fitur Aktif (Tahap 2)**
  - [x] Video Studio: bersihkan `app/video-studio/page.js`, `app/api/video-studio/campaign-videos/route.js`, `app/api/video-studio/render/route.js` (return 400 untuk `instant_factory`), `app/components/video-studio/FinishingPanel.jsx`, `lib/video-studio-finishing-source.js`, `lib/render-slot.js`
  - [x] ContentFlow: bersihkan `app/content-flow/page.js` dan ubah label netral di `lib/contentflow-ingest.js` (`Pipeline v5.4`)
  - [x] TTS Studio: bersihkan `app/api/tts-studio/campaign-data/route.js` dan `app/tts-studio/page.js`
  - [x] Beranda & Pillar: bersihkan `app/page.js`, `app/terms/page.js`, periksa `app/pillar-campaigns/page.js`
  - [x] Izin Menu & Users: bersihkan `lib/schema/user-schema.js` (pastikan UI izin toleran terhadap key lama)
  - [x] Affiliate Studio: bersihkan `lib/affiliate-studio-production-adapter.js`, `lib/affiliate-studio-recommendation-adapter.js`, `lib/affiliate-studio-launch-adapter.js`
  - [x] Logs, Scheduler, Naming & Gemini: bersihkan `lib/scheduler.js`, `app/api/scheduler/control/route.js`, `app/api/system-logs/route.js`, `lib/console-hook.js`, `lib/naming-helper.js`, `lib/gemini.js`
  - [x] Perbarui tes & skrip: `tests/video-studio-finishing-source.test.mjs`, `tests/render-slot.test.js`, `tests/base64-image-reference.test.js`, `scripts/find-campaign.js`, `scripts/test-product-pipeline.js`
  - [x] Perbarui SOT & Kartu Menu: `sot/menus/_PETA_MENU.md`, `sot/menus/kartu/video-studio.md`, `sot/menus/kartu/content-flow.md`, `sot/menus/kartu/tts-studio.md`, `sot/menus/kartu/users-tenants.md`

- [x] **Task 3: Buat Skrip Dry-Run Tabel Legacy (Tahap 3)**
  - [x] Buat `scripts/report-legacy-tables.mjs` dengan dukungan `--schema dev|staging|public` (read-only `SELECT COUNT`)

- [x] **Task 4: Verifikasi Audit `git grep` & Pengujian Otomatis**
  - [x] Jalankan `git grep` akhir dan pastikan hanya sisa yang diizinkan
  - [x] Buat & jalankan unit test baru penolakan `video_source_type: 'instant_factory'` (status 400)
  - [x] Jalankan `npm run build`, `npm run test:mcp`, `npm run test:product-catalog`, serta tes unit terkait

- [x] **Task 5: Deploy ke Server Dev Mac Mini & Uji Manual**
  - [x] Commit dan push branch `fitur/hapus-instant-sheets`
  - [x] Deploy atomic ke Dev (`100.95.245.55:5020`)
  - [x] Verifikasi log `dev-ui.err.log` (bersih dari error scheduler tick) & cek beranda Dev (siap untuk klik uji manual pengguna di UI)
  - [x] Sajikan laporan akhir untuk pengguna
