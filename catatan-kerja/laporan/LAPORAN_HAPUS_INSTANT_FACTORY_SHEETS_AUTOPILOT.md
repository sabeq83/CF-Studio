# Laporan Pelaksanaan: Penghapusan Fitur Instant Factory & Sheets Autopilot

**Tanggal**: 17 November 2026  
**Dokumen Acuan**: [antigravity_hapus_instant_factory_sheets_autopilot_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_hapus_instant_factory_sheets_autopilot_instructions.md)  
**Branch**: `fitur/hapus-instant-sheets` · **Target Uji**: Server Dev (`http://100.95.245.55:5020`)

---

## 1. Ringkasan Eksekutif

Seluruh kode fitur **Instant Factory** dan **Sheets Autopilot** — meliputi halaman web (`/instant-factory`, `/sheets-autopilot`), 17 endpoint API, worker background (`lib/sheets-autopilot-worker.js`), processor `processInstant*`, tick loop scheduler, serta entri pada matriks model AI — telah dihapus dari codebase CF Studio (sekitar **14.030 baris** kode lama dibersihkan) tanpa menghapus tabel maupun data database apa pun.

Seluruh sambungan pada fitur aktif (**Video Studio**, **ContentFlow Hub**, **TTS Studio**, **Affiliate Studio**, **Users & Tenants**, **Pillar/RE Campaign**, dan **Campaign Scheduler**) telah dibersihkan agar bekerja normal tanpa ketergantungan ke kedua fitur tersebut. Fungsi utilitas Google Sheets murni yang masih dipakai oleh fitur aktif (`getColumnLetter`, `updateCell`, `ensureTabAndAppendRows`) diekstrak ke modul terpisah [google-sheets-helper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/google-sheets-helper.js). Fitur aktif dipastikan berjalan normal di server **Dev**, sementara permintaan render untuk `video_source_type: 'instant_factory'` kini ditolak secara eksplisit dengan status **HTTP 400**.

---

## 2. Hasil Cek Ulang Data Database (3 Schema — Read-Only `SELECT`)

Sebelum penghapusan kode dilakukan, telah dijalankan query read-only terhadap ketiga schema PostgreSQL (`dev`, `staging`, `public`) pada database `maknaflow_db`, serta disiapkan skrip dry-run permanen [report-legacy-tables.mjs](file:///Users/sabeqmmursyid/_cfstudio/scripts/report-legacy-tables.mjs):

| Objek Database yang Dicek | `dev` | `staging` | `public` |
|---|---|---|---|
| `instant_campaigns` | 0 baris | 0 baris | 0 baris |
| `instant_campaign_items` | 0 baris | 0 baris | 0 baris |
| `instant_campaign_outputs` | 0 baris | 0 baris | 0 baris |
| `instant_campaign_configs` | 0 baris | 0 baris | 0 baris |
| `sheets_campaigns` | 0 baris | 0 baris | 0 baris |
| `sheets_jobs` | 0 baris | 0 baris | 0 baris |
| `pipeline_assets` | 0 baris | 0 baris | 0 baris |
| `scheduler_jobs` (antrean `%instant%` / `%sheets%`) | 0 baris | 0 baris | 0 baris |
| `settings` & `tenant_settings` (kunci `*instant*` / `*sheets*`) | 0 baris | 0 baris | 0 baris |
| `content_flow_items.source_type` | `opc`: 903, `re`: 126, `multiplier`: 13, `strategic`: 6, `bridge`: 4, `recipe`: 2 (**tidak ada instant/sheets**) | `opc`: 4137, `re`: 702, `multiplier`: 168, `strategic`: 6, `recipe`: 4 (**tidak ada instant/sheets**) | `null`: 11, `opc`: 5 (**tidak ada instant/sheets**) |

---

## 3. Daftar File Dihapus, Diubah, & Sisa `git grep`

### A. Dihapus & Diarsipkan (Tahap 1)
- **Halaman Web (4 file dihapus)**:
  - `app/instant-factory/page.js`, `app/instant-factory/[id]/page.js`
  - `app/sheets-autopilot/page.js`, `app/sheets-autopilot/[id]/page.js`
- **API Endpoints (17 file dihapus)**:
  - Seluruh folder `app/api/v2/instant-factory/**` (10 route: `route.js`, `bulk/route.js`, `bulk/upload/route.js`, `regenerate/route.js`, `history/route.js`, `items/[itemId]/trigger/route.js`, `items/[itemId]/update-creative/route.js`, `[id]/route.js`, `[id]/export-markdown/route.js`, `[id]/run/route.js`)
  - Seluruh folder `app/api/sheets-autopilot/**` (7 route: `route.js`, `upload-existing/route.js`, `retry/route.js`, `sync-worker/route.js`, `repair-clip/route.js`, `batch-repair-storyboard/route.js`, `repair-storyboard-clip/route.js`)
- **Worker & Scheduler**:
  - `lib/sheets-autopilot-worker.js` dihapus (tiga helper Google Sheets murni dipindahkan ke `lib/google-sheets-helper.js`).
  - Blok processor `processInstant*` & `overrideInstantCampaignIfMassProd` dihapus dari [scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
  - Tick loop Instant Factory & Sheets Autopilot, `isInstantItemFinished`, serta cabang `instant_` dihapus dari [campaign-scheduler.js](file:///Users/sabeqmmursyid/_cfstudio/lib/campaign-scheduler.js).
  - Helper sinkronisasi `syncIfcCampaignAssetsToDrive`, `syncIfcCampaignAssetsToNextcloud`, dan `getIfcBatchId` dihapus dari [drive-sync-helper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/drive-sync-helper.js), [nextcloud-sync-helper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/nextcloud-sync-helper.js), dan [naming-helper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/naming-helper.js).
- **Database CRUD & Dokumen**:
  - Fungsi CRUD `createInstantCampaign*`, `getInstantCampaign*`, `updateInstantCampaign*`, `deleteInstantCampaign`, `getNextPendingInstant*`, `createSheetsCampaign*`, `getSheetsCampaign*`, `updateSheets*`, `deleteSheetsCampaign` dihapus dari [db.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js) (**tabel & DDL `CREATE TABLE` dibiarkan**).
  - `'sheets_campaigns'` dihapus dari array migrasi kolom Visual Identity di [db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L2022) (DDL `ALTER TABLE` di baris 393 tetap dibiarkan).
  - Dokumen SOT dipindahkan ke [arsip/instant-factory.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/arsip/instant-factory.md) dan [arsip/sheets-autopilot.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/arsip/sheets-autopilot.md).

### B. Dibersihkan & Ditambahkan (Tahap 2 & Tahap 3)
- **Video Studio**: [app/video-studio/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/video-studio/page.js), [campaign-videos/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/video-studio/campaign-videos/route.js), [render/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/video-studio/render/route.js) (menolak `'instant_factory'` dengan HTTP 400), [FinishingPanel.jsx](file:///Users/sabeqmmursyid/_cfstudio/app/components/video-studio/FinishingPanel.jsx), [video-studio-finishing-source.js](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-finishing-source.js) (menambahkan `validateVideoStudioSourceType`), [render-slot.js](file:///Users/sabeqmmursyid/_cfstudio/lib/render-slot.js).
- **ContentFlow & TTS Studio**: [app/content-flow/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/content-flow/page.js) (filter `instant` dihapus; badge menjadi `Pipeline v5.4`), [contentflow-ingest.js](file:///Users/sabeqmmursyid/_cfstudio/lib/contentflow-ingest.js) (label & `source_type` untuk `pipeline_assets` dinetralkan menjadi `pipeline` / `Pipeline v5.4`), [app/api/tts-studio/campaign-data/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/tts-studio/campaign-data/route.js), [app/tts-studio/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/tts-studio/page.js).
- **Beranda, Pillar, Terms, & RBAC**: [app/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/page.js), [app/terms/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/terms/page.js), [app/pillar-campaigns/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js), [user-schema.js](file:///Users/sabeqmmursyid/_cfstudio/lib/schema/user-schema.js) (menghapus `sheets_autopilot` & `instant_campaign` dari `ALL_MENU_KEYS` tanpa menyentuh tabel DB `user_menu_permissions`).
- **Affiliate Studio & Sistem/AI**: [affiliate-studio-launch-adapter.js](file:///Users/sabeqmmursyid/_cfstudio/lib/affiliate-studio-launch-adapter.js), [affiliate-studio-production-adapter.js](file:///Users/sabeqmmursyid/_cfstudio/lib/affiliate-studio-production-adapter.js), [affiliate-studio-recommendation-adapter.js](file:///Users/sabeqmmursyid/_cfstudio/lib/affiliate-studio-recommendation-adapter.js), [gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js) (hapus `INSTANT_FACTORY` & `SHEETS_AUTOPILOT` dari `MODULE_MODEL_MATRIX`), [scheduler.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler.js), [control/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/scheduler/control/route.js), [system-logs/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/system-logs/route.js), [console-hook.js](file:///Users/sabeqmmursyid/_cfstudio/lib/console-hook.js), [google-sheets-helper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/google-sheets-helper.js).
- **Tes, Skrip & Kartu Menu SOT**: [video-studio-finishing-source.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/video-studio-finishing-source.test.mjs), [render-slot.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/render-slot.test.js), [base64-image-reference.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/base64-image-reference.test.js), [find-campaign.js](file:///Users/sabeqmmursyid/_cfstudio/scripts/find-campaign.js), [test-product-pipeline.js](file:///Users/sabeqmmursyid/_cfstudio/scripts/test-product-pipeline.js), [report-legacy-tables.mjs](file:///Users/sabeqmmursyid/_cfstudio/scripts/report-legacy-tables.mjs), [_PETA_MENU.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/_PETA_MENU.md), serta kartu menu ([video-studio.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/video-studio.md), [content-flow.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/content-flow.md), [tts-studio.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/tts-studio.md), [users-tenants.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/users-tenants.md)).

### C. Sisa Hasil `git grep` & Penjelasan
Hasil `git grep -niE "instant[-_ ]?factory|instantFactory|instant_campaign|sheets[-_ ]?autopilot|sheetsAutopilot|sheets_campaigns|sheets_jobs|runSyncWorker" -- app lib apps scripts tests` (di luar `lib/db.sqlite-backup.js` dan mockup visual lama):
1. `app/api/video-studio/render/route.js:128` & `tests/video-studio-finishing-source.test.mjs:26,36` — penjaga penolakan HTTP 400 dan skenario uji otomatis apabila request lama mengirimkan `video_source_type: 'instant_factory'`.
2. `lib/db-pg.js:393` (`ALTER TABLE sheets_campaigns`) — perintah migrasi DDL lama yang sengaja dibiarkan sesuai aturan Tahap 3.
3. Skrip setup/arsip historis (`scripts/arsip-scratch/check_errors.js:12`, `scripts/local-staging/setup.js:101`, `scripts/update-schema-phase2.js:44`) — referensi skema tabel/setup historis.

---

## 4. Temuan `pipeline-v54` (Untuk Keputusan Pengguna)

Berdasarkan hasil pemeriksaan codebase:
- Halaman **[app/pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pipeline/page.js)** (`/pipeline`) masih secara aktif memanggil endpoint `/api/pipeline-v54` dan `/api/pipeline-v54/[id]` (`GET`, `POST`, `DELETE`).
- [lib/product-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js#L100) membersihkan entri di tabel `pipeline_assets` ketika produk dihapus.
- Di ketiga schema PostgreSQL, jumlah baris `pipeline_assets` saat ini adalah **0**.
- Sesuai instruksi, `app/api/pipeline-v54/**` dan fungsi `*PipelineAsset*` tidak dihapus; label pemindaiannya di `lib/contentflow-ingest.js` hanya diganti dari `"Instant Factory Pipeline"` menjadi netral (`"Pipeline v5.4"`). Pengguna dapat memutuskan secara terpisah apakah `/pipeline` & `pipeline-v54` juga akan dihapus atau dipertahankan.

---

## 5. Hasil Build, Pengujian, & Verifikasi Dev

### Pengujian Otomatis
- **Unit Tests Terkait**: `node --test tests/video-studio-finishing-source.test.mjs tests/render-slot.test.js tests/base64-image-reference.test.js` → **14/14 PASS** (mencakup test baru penolakan `video_source_type: 'instant_factory'` → status 400 dengan pesan jelas).
- **MCP Tests**: `npm run test:mcp` → **11/11 PASS**.
- **Product Catalog Contract**: `npm run test:product-catalog` → **PASS**.
- **Next.js Production Build**: `npm run build` selesai dengan kode keluar **0**; rute `/instant-factory` dan `/sheets-autopilot` tidak lagi ada di manifest rute build.

### Verifikasi Server Dev (`http://100.95.245.55:5020`)
- Proses PM2 `maknaflow-dev-ui` (PID 65527) dan `maknaflow-dev-api` (PID 65528) aktif (`online`).
- `GET http://100.95.245.55:5020/` → **HTTP 200** (Beranda tampil normal tanpa kartu *Sheets Autopilot*).
- `GET http://100.95.245.55:7020/health` → **HTTP 200**.
- **Inspeksi Log `dev-ui.err.log` & `dev-ui.out.log`**: Setelah memperbaiki deklarasi `const now = Date.now()` yang sempat ikut terpotong di `lib/campaign-scheduler.js` (commit `66e7da4`), tick scheduler dan Publishing Worker berjalan normal tanpa `ReferenceError` maupun error scheduler.

### Checklist Uji Manual UI di Dev (`http://100.95.245.55:5020`)
- [x] Beranda tampil normal tanpa kartu Sheets Autopilot *(terverifikasi dari respons HTML `GET /`)*.
- [x] Scheduler berjalan beberapa tick tanpa error di `dev-ui.err.log` *(terverifikasi melalui inspeksi log PM2 Dev)*.
- [ ] Video Studio (`http://100.95.245.55:5020/video-studio`): buka & cek daftar sumber video RE Campaign, render, dan panel finishing *(untuk diuji langsung oleh pengguna di browser)*.
- [ ] ContentFlow (`http://100.95.245.55:5020/content-flow`): cek filter sumber tanpa opsi Instant dan proses sinkronisasi.
- [ ] TTS Studio (`http://100.95.245.55:5020/tts-studio`): cek daftar kampanye tampil normal.
- [ ] Users & Tenants (`http://100.95.245.55:5020/settings/users`): cek halaman izin menu pengguna terbuka tanpa error.
- [ ] Affiliate Studio: cek rekomendasi engine tampil tanpa Instant.

---

## 6. Metadata Git & Deployment

- **Branch**: `fitur/hapus-instant-sheets`
- **Commit Kode Aktif di Server Dev**: `66e7da47c7224a9976a58f6c8fb439ded079b339`
- **Commit Checklist Terbaru**: `138a214ee5c3d2f40b5323f75fb5a8f2fe7ff2c9` (sebelum penambahan laporan ini)
- **Tautan Aplikasi Dev**: [http://100.95.245.55:5020](http://100.95.245.55:5020)

---

## 7. Langkah Berikutnya & Permintaan Izin

1. Setelah pengujian manual di server **Dev** dinyatakan lolos, **bolehkah branch `fitur/hapus-instant-sheets` digabungkan ke `main`, dirilis, dan dideploy ke Staging**?
2. **Pengingat Tahap 3 (Database)**: Penghapusan ketujuh tabel database legacy (`instant_campaigns`, `instant_campaign_items`, `instant_campaign_outputs`, `instant_campaign_configs`, `sheets_campaigns`, `sheets_jobs`, serta keputusan untuk `pipeline_assets`) merupakan pekerjaan terpisah yang hanya akan dilakukan paling cepat 1 minggu setelah rilis ini stabil di Staging dan setelah izin eksplisit dari pengguna.
