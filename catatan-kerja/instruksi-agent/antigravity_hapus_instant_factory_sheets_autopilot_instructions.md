# Instruksi Antigravity: Hapus Fitur Instant Factory & Sheets Autopilot

## Mandat

Pengguna memutuskan **Instant Factory** dan **Sheets Autopilot** tidak dipakai lagi dan minta **kodenya dihapus**. Hapus semua halaman, API, worker, dan antrean kedua fitur, lalu bersihkan sambungannya di fitur lain **tanpa merusak fitur yang masih aktif** (Video Studio, ContentFlow, TTS Studio, scheduler, Affiliate Studio).

**Tabel database tidak dihapus** dalam pekerjaan ini (lihat Tahap 3).

## Bukti tidak dipakai (dicek 17 Nov 2026, hanya baca)

| Cek | dev | staging | public (production) |
|---|---|---|---|
| `instant_campaigns` | 0 baris | 0 | 0 |
| `instant_campaign_items` | (staging) 0 | | |
| `sheets_campaigns` | 0 | 0 | 0 |
| `sheets_jobs` | (staging) 0 | | |
| `scheduler_jobs` antrean `instant%` / `%sheets%` | (staging) tidak ada | | |
| Setting `sheets_autopilot_scheduler_active` / `*instant*` di `settings` & `tenant_settings` | (staging) tidak ada | | |
| `content_flow_items.source_type` | staging: opc 4137, re 702, multiplier 168, strategic 6, recipe 4, kosong 11. **Tidak ada instant/sheets.** | | public: opc 5 |

Menu keduanya sudah tidak muncul di sidebar (`app/components/Sidebar.js` ~95 tidak memuat `/instant-factory` atau `/sheets-autopilot`).

**Sebelum menghapus, ulangi cek ini di ketiga schema** (dev, staging, public; hanya `SELECT`). Jika ada data baru, **berhenti dan laporkan**.

## Tahap 1: Hapus milik kedua fitur

### Instant Factory
- Halaman: `app/instant-factory/page.js`, `app/instant-factory/[id]/page.js`
- API: seluruh `app/api/v2/instant-factory/**` (`route.js`, `[id]/route.js`, `[id]/run`, `[id]/export-markdown`, `bulk`, `bulk/upload`, `history`, `items/[itemId]/trigger`, `items/[itemId]/update-creative`, `regenerate`)
- Processor di `lib/scheduler-processors.js`: `processInstantRowProductSourcing` (~9082), `processInstantGenerator` (~9149), `processInstantTts` (~9446), `processInstantGlabs` (~9584), `processInstantFfmpeg` (~10029), `processInstantSocialPoster` (~10277), beserta helper yang **hanya** dipakai oleh fungsi-fungsi itu. Cek dengan `git grep` sebelum menghapus helper.
- Loop tick Instant di `lib/campaign-scheduler.js` (~920–1000: `instant_sourcing`, `instant_generator`, `instant_tts`, `instant_glabs`, `instant_glabs_poll`, `instant_ffmpeg`, `instant_social_poster`, log `instant_factory_logs_*.txt`) dan import processor-nya.
- Fungsi DB khusus `instant_campaign*` di `lib/db.js` / `lib/db-pg.js` (query/CRUD) yang tidak dipakai di tempat lain. **Jangan** menghapus `CREATE TABLE`/migrasi (lihat Tahap 3).
- Dokumen: `sot/menus/instant-factory.md` → pindah ke `sot/menus/arsip/`.

### Sheets Autopilot
- Halaman: `app/sheets-autopilot/page.js`, `app/sheets-autopilot/[id]/page.js`
- API: seluruh `app/api/sheets-autopilot/**` (`route.js`, `batch-repair-storyboard`, `repair-clip`, `repair-storyboard-clip`, `retry`, `sync-worker`, `upload-existing`)
- Worker: `lib/sheets-autopilot-worker.js`
- Tick di `lib/campaign-scheduler.js` (~1109–1125: `sheets_autopilot_scheduler_active`, `runSyncWorker`) dan import di baris ~28.
- Fungsi DB khusus `sheets_campaigns`/`sheets_jobs` yang tidak dipakai di tempat lain. Perhatikan `lib/db-pg.js` ~2022 (`const tables = ['re_campaigns', 'pillar_campaigns', 'sheets_campaigns']`): hapus `sheets_campaigns` dari daftar itu tanpa mengubah perilaku dua tabel lainnya. Jangan menghapus `ALTER/CREATE TABLE` (~393).
- Dokumen: `sot/menus/sheets-autopilot.md` → `sot/menus/arsip/`.

## Tahap 2: Bersihkan sambungan di fitur aktif (wajib hati-hati)

| Lokasi | Yang dibersihkan | Syarat |
|---|---|---|
| `app/video-studio/page.js` (~289, 336, 375, 792–793, 939, 1491) | Tab/sumber video "Instant Factory" | Sumber RE Campaign dan lainnya tetap jalan, dan tidak ada tab kosong |
| `app/api/video-studio/campaign-videos/route.js` (~17, 118–164) | Blok pengambilan klip Instant | Respons sumber lain tidak berubah. Jika klien membaca key `instant_factory`, hapus juga pemakaiannya |
| `app/api/video-studio/render/route.js` (~128) | Cabang `video_source_type === 'instant_factory'` | Nilai itu kini ditolak dengan pesan jelas (400), bukan crash |
| `app/components/video-studio/FinishingPanel.jsx` (~46) | Kondisi `'instant_factory'` | Finishing RE tetap tampil |
| `lib/video-studio-finishing-source.js` (~7–10, 143–165) | Cabang `instant_factory` | Perbarui `tests/video-studio-finishing-source.test.mjs` |
| `lib/render-slot.js` (~46) | Tipe `'instant_factory'` di komentar/validasi | Perbarui `tests/render-slot.test.js` bila terkait |
| `app/content-flow/page.js` (~764, ~1284) | Label & opsi filter "Instant Factory" | Filter lain tetap berfungsi |
| `lib/contentflow-ingest.js` (~507–547) | Blok "Scan Pipeline Assets (Instant Factory)" | **Lihat catatan `pipeline_assets` di bawah** |
| `app/api/tts-studio/campaign-data/route.js` (~44) | Bagian "Fetch and format Instant Factory Campaigns" | Data kampanye lain di TTS Studio tetap tampil |
| `app/page.js` (~546) | Kartu "Sheets Autopilot & Ingestion" di beranda | Tata letak beranda tetap rapi |
| `lib/schema/user-schema.js` (~23, ~25) | Izin menu `sheets_autopilot` dan `instant_campaign` | Baris lama di `user_menu_permissions` dibiarkan (tidak dihapus dari DB). Pastikan UI izin tidak error karena key yang sudah tidak dikenal |
| `lib/affiliate-studio-production-adapter.js` (~249), `lib/affiliate-studio-recommendation-adapter.js` (~61) | Engine `instant` (link & rekomendasi) | Rekomendasi Affiliate Studio tidak lagi menyarankan Instant. Engine lain tetap |
| `lib/scheduler.js` (~280–281), `app/api/scheduler/control/route.js` (~16), `app/api/system-logs/route.js`, `lib/console-hook.js` | File log `instant_factory_logs_*` dan antrean `instant_` | Log fitur lain tidak berubah |
| `lib/scheduler-processors.js` (~9496 `source_type: 'instant_campaign'`, ~10083 `type: 'instant_factory'`) | Ikut terhapus bersama processor Instant | Pastikan tidak ada pemanggil lain |
| `lib/gemini.js` (~181, ~184, ~216, ~219) | Entri `INSTANT_FACTORY` dan `SHEETS_AUTOPILOT` di `MODULE_MODEL_MATRIX` & daftar tugas kreatif | Selaras dengan instruksi model AI terpusat |
| `app/terms/page.js` | Teks yang menyebut kedua fitur | Hanya teks |
| `app/pillar-campaigns/page.js` (~1660) | Cek apakah teks "OPC Massal" merujuk Sheets Autopilot. Ubah teksnya saja bila perlu | Fitur OPC massal jangan diubah |
| `tests/base64-image-reference.test.js`, `scripts/test-product-pipeline.js` | Kasus uji/skrip yang memanggil kode yang dihapus | Hapus kasusnya, jangan seluruh file bila menguji hal lain |
| Mockup lama (`public/mockup_*.html`, `public/mockups/*.html`, `docs/mockups/maknaflow-theme-preview.html`) | **Biarkan** | Hanya arsip visual |
| `sot/menus/_PETA_MENU.md` (~58) | Hapus sebutan `instant-factory` (dan sheets jika ada) | Perbarui juga kartu menu yang menyebut kedua fitur (mis. `sot/menus/kartu/video-studio.md`, `content-flow.md`, `tts-studio.md`, `users-tenants.md`) sesuai SOP Konteks Menu |

### Catatan `pipeline_assets` (jangan ikut dihapus otomatis)
Tabel `pipeline_assets` dan fungsi `createPipelineAsset`/`updatePipelineAsset`/`getPipelineAsset`/`getAllPipelineAssets` (`lib/db.js` ~761–785) **dipakai oleh `app/api/pipeline-v54/**`**, bukan oleh Instant Factory. `lib/contentflow-ingest.js` hanya memberi label "Instant Factory Pipeline" saat memindai tabel itu.
- Ganti label itu menjadi netral ("Pipeline v5.4") atau hapus blok pemindaiannya **hanya jika** terbukti pipeline-v54 juga tidak dipakai. Tabelnya kosong di ketiga schema, tetapi status pipeline-v54 belum diputuskan pengguna.
- **Jangan** menghapus `app/api/pipeline-v54/**` dalam pekerjaan ini. Laporkan apakah ada halaman/klien yang masih memanggilnya, agar pengguna bisa memutuskan terpisah.

### Cek akhir
- `git grep -niE "instant[-_ ]?factory|instantFactory|instant_campaign|sheets[-_ ]?autopilot|sheetsAutopilot|sheets_campaigns|sheets_jobs|runSyncWorker" -- app lib apps scripts tests` hanya menyisakan: migrasi tabel di `lib/db-pg.js`/`lib/db.js` (Tahap 3), mockup lama, dan `lib/db.sqlite-backup.js` (cadangan lama, biarkan). Setiap sisa lain harus dijelaskan di laporan.
- `next build` tanpa import yang hilang. Rute `/instant-factory` dan `/sheets-autopilot` mengembalikan 404 biasa.

## Tahap 3: Tabel database (TIDAK dikerjakan sekarang)

- Jangan `DROP TABLE` dan jangan menghapus `CREATE TABLE`/`ALTER TABLE` untuk `instant_campaigns`, `instant_campaign_items`, `instant_campaign_outputs`, `instant_campaign_configs`, `sheets_campaigns`, `sheets_jobs`, `pipeline_assets`.
- Cukup siapkan skrip **dry-run** `scripts/report-legacy-tables.mjs --schema dev|staging|public` yang mencetak jumlah baris tiap tabel di atas. Penghapusan tabel menjadi pekerjaan terpisah, hanya atas izin pengguna dan paling cepat seminggu setelah rilis ini stabil di staging.

## Branch dan alur (SOP `AGENTS.md`)

1. Pastikan folder kerja bersih dan di `main` (lihat catatan folder kerja laptop di `antigravity_mcp_tenant_default_instructions.md`). Buat `fitur/hapus-instant-sheets` dari `main`.
2. **Urutan dengan instruksi lain:** kerjakan ini **sebelum** `antigravity_model_ai_terpusat_instructions.md`, agar lokasi model di kedua fitur ini tidak perlu dipusatkan (baris 1–6 di tabel 2b instruksi itu otomatis gugur).
3. Commit dan push branch, deploy ke **Dev**, lalu laporkan. Naik ke staging hanya setelah pengguna menyatakan lolos uji Dev (pintu 1 hari).

## Uji wajib

Otomatis:
- `npm run build`, `npm run test:mcp`, `npm run test:product-catalog`, serta tes yang disentuh (`tests/video-studio-finishing-source.test.mjs`, `tests/render-slot.test.js`, `tests/base64-image-reference.test.js`).
- Tes baru kecil: render Video Studio dengan `video_source_type: 'instant_factory'` → 400 dengan pesan jelas.

Manual di Dev (5020), sebutkan hasilnya di laporan:
- [ ] Beranda tampil normal tanpa kartu Sheets Autopilot.
- [ ] Video Studio: daftar sumber video, pilih video RE, render, panel finishing → normal.
- [ ] ContentFlow: filter sumber dan sinkronisasi → normal, tanpa opsi Instant.
- [ ] TTS Studio: daftar kampanye tampil.
- [ ] Scheduler berjalan beberapa tick tanpa error di `dev-ui.err.log` (cek sekali, jangan polling).
- [ ] Halaman izin menu pengguna (Users & Tenants) terbuka tanpa error.
- [ ] Affiliate Studio: rekomendasi engine tampil tanpa Instant.

## Larangan

- Jangan menghapus tabel, kolom, atau baris database (termasuk `user_menu_permissions`).
- Jangan menghapus `app/api/pipeline-v54/**` atau fungsi `*PipelineAsset*`.
- Jangan mengubah perilaku fitur aktif selain menghapus sambungan ke dua fitur ini.
- Jangan merge ke `main`, rilis, atau deploy staging tanpa izin eksplisit pengguna. Production dilarang.
- Jangan menghapus mockup lama atau `lib/db.sqlite-backup.js`.

## Format laporan balik

Bahasa Indonesia sederhana untuk marketer:
1. Ringkasan 3–5 kalimat: apa yang dihapus dan fitur mana yang dipastikan tetap normal.
2. Hasil cek ulang data (tabel 3 schema) sebelum menghapus.
3. Daftar file dihapus/diubah (ringkas, per kelompok) dan sisa hasil `git grep` beserta alasannya.
4. Temuan `pipeline-v54`: masih dipakai atau tidak (untuk keputusan pengguna).
5. Hasil build, tes, dan checklist manual Dev.
6. Branch, commit, SHA, dan link Dev.
7. Pertanyaan izin: *"Boleh naik ke staging?"*, plus pengingat bahwa penghapusan tabel database adalah langkah terpisah.
