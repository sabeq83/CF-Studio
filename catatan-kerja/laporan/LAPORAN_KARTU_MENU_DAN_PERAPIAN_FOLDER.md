# Laporan Pelaksanaan: Kartu Menu & Perapian Folder Proyek

Tanggal: 17 November 2026  
Versi Rilis: **v2.50.1** (Commit Tag `v2.50.1`, SHA: `de3621a`)  
Pelaksana: Antigravity  
Reviewer/Planner: Claude  
Dasar Instruksi: `catatan-kerja/instruksi-agent/antigravity_kartu_menu_dan_rapikan_folder_instructions.md`

---

## 1. Daftar 19 Kartu Menu Baru (+ 3 Kartu Contoh) & Jumlah Baris

Semua kartu menu disimpan di `sot/menus/kartu/`. Tidak ada kartu yang melebihi batas 60 baris.

| No | Menu | Nama File | Baris | Kategori |
|---|---|---|---|---|
| 1 | Dashboard | `dashboard.md` | 29 | SYSTEM |
| 2 | Content Planner | `content-planner.md` | 35 | PLANNING |
| 3 | Product Database | `products.md` | 34 | PLANNING |
| 4 | Recipe Library | `recipe-library.md` | 31 | PLANNING |
| 5 | Deconstruct Lab | `deconstruct.md` | 33 | PLANNING |
| 6 | Preset Manager | `presets.md` | 32 | PLANNING |
| 7 | Visual Identity | `visual-identities.md` | 33 | PLANNING |
| 8 | Universe Manager | `universes.md` | 34 | PLANNING |
| 9 | Brand Profile Manager | `brand-profiles.md` | 32 | PLANNING |
| 10 | Auto Pipeline *(sudah ada)* | `auto-pipeline.md` | 55 | WORKFLOW |
| 11 | Threads Labs | `threads-labs.md` | 33 | WORKFLOW |
| 12 | RE Campaign | `re-campaigns.md` | 35 | WORKFLOW |
| 13 | Pillar Campaign | `pillar-campaigns.md` | 34 | WORKFLOW |
| 14 | Recipe Labs | `recipe-labs.md` | 32 | WORKFLOW |
| 15 | Multiplier Labs *(sudah ada)* | `multiplier-lab.md` | 45 | WORKFLOW |
| 16 | Product Bridging | `product-bridge-inject.md` | 31 | WORKFLOW |
| 17 | ContentFlow Hub | `content-flow.md` | 34 | PUBLISHING |
| 18 | Recipe Exporter | `recipe-exporter.md` | 35 | PUBLISHING |
| 19 | Video Studio *(sudah ada)* | `video-studio.md` | 49 | TOOLS |
| 20 | TTS Studio | `tts-studio.md` | 36 | TOOLS |
| 21 | Settings | `settings.md` | 33 | SYSTEM |
| 22 | User & Tenant Management | `users-tenants.md` | 34 | SYSTEM |

*Total baris seluruh kartu:* 779 baris (rata-rata 35 baris/kartu).  
*Verifikasi jalur file:* 100% jalur file kode (`app/`, `lib/`, `sot/`, `docs/`, `kb/`) yang dirujuk kartu terverifikasi ada.  
*Pengecekan rahasia (Zero Secret Exposure):* Bersih (tidak ada `AIza`, password hardcoded, atau token).

---

## 2. Dokumen Lama di `sot/menus/` yang Ditemukan Usang

Selama verifikasi kode, ditemukan beberapa ketidaksesuaian antara dokumen lama di `sot/menus/` dengan kondisi kode nyata:

1. **`sot/menus/products.md`**:
   - *Bagian usang:* Bagian 1 & 2 masih menyebut basis data **SQLite** (`better-sqlite3`, `db.sqlite`).
   - *Kondisi kode saat ini:* Database produk sudah sepenuhnya termigrasi ke **PostgreSQL multi-tenant** (tabel `product_extractions` di skema `dev`/`staging`/`public`).
2. **`sot/menus/tts-studio.md`**:
   - *Bagian usang:* Bagian 2 masih mencantumkan skema tabel SQLite lokal.
   - *Kondisi kode saat ini:* Data batch dan klip TTS tersimpan di PostgreSQL (`tts_studio_batches` & `tts_studio_clips`).
3. **`sot/menus/multiplier-lab.md`**:
   - *Bagian usang:* Masih mencantumkan URL lama `/re-multiplier` dan arsitektur SQLite awal.
   - *Kondisi kode saat ini:* URL aktif adalah `/multiplier-lab` dengan backend PostgreSQL.
4. **`sot/menus/contentflow-studio.md`**:
   - *Kondisi:* Dokumen ini membahas arsitektur batch single-use planner dan ledger slot. Halaman publik saat ini adalah `/content-flow` (ContentFlow Hub) yang bertindak sebagai antarmuka kalender posting dan staging.

---

## 3. Tabel Jalur Lama → Jalur Baru File yang Dipindahkan

### A. Subfolder `sot/menus/rencana/`
File-file rencana implementasi dan roadmap YouTube Studio serta Affiliate Studio dipindahkan dari `sot/menus/`:
- `sot/menus/affiliate-studio-roadmap.md` → `sot/menus/rencana/affiliate-studio-roadmap.md`
- `sot/menus/youtube-studio-blueprint-script-implementation-plan.md` → `sot/menus/rencana/youtube-studio-blueprint-script-implementation-plan.md`
- `sot/menus/youtube-studio-channel-character-voice-registry-ai-agent-instructions.md` → `sot/menus/rencana/youtube-studio-channel-character-voice-registry-ai-agent-instructions.md`
- `sot/menus/youtube-studio-channel-character-voice-registry-implementation-plan.md` → `sot/menus/rencana/youtube-studio-channel-character-voice-registry-implementation-plan.md`
- `sot/menus/youtube-studio-duration-generation-profile-implementation-plan.md` → `sot/menus/rencana/youtube-studio-duration-generation-profile-implementation-plan.md`
- `sot/menus/youtube-studio-editorial-ui-refinement-implementation-plan.md` → `sot/menus/rencana/youtube-studio-editorial-ui-refinement-implementation-plan.md`
- `sot/menus/youtube-studio-editorial-workflow-implementation-plan.md` → `sot/menus/rencana/youtube-studio-editorial-workflow-implementation-plan.md`
- `sot/menus/youtube-studio-hybrid-api-smoke-implementation-plan.md` → `sot/menus/rencana/youtube-studio-hybrid-api-smoke-implementation-plan.md`
- `sot/menus/youtube-studio-hybrid-production-implementation-plan.md` → `sot/menus/rencana/youtube-studio-hybrid-production-implementation-plan.md`
- `sot/menus/youtube-studio-implementation-plan.md` → `sot/menus/rencana/youtube-studio-implementation-plan.md`
- `sot/menus/youtube-studio-information-architecture-ui-implementation-plan.md` → `sot/menus/rencana/youtube-studio-information-architecture-ui-implementation-plan.md`
- `sot/menus/youtube-studio-kb-foundation-implementation-plan.md` → `sot/menus/rencana/youtube-studio-kb-foundation-implementation-plan.md`
- `sot/menus/youtube-studio-multi-speaker-narrative-blueprint.md` → `sot/menus/rencana/youtube-studio-multi-speaker-narrative-blueprint.md`
- `sot/menus/youtube-studio-multi-speaker-narrative-implementation-plan.md` → `sot/menus/rencana/youtube-studio-multi-speaker-narrative-implementation-plan.md`
- `sot/menus/youtube-studio-mvp.md` → `sot/menus/rencana/youtube-studio-mvp.md`
- `sot/menus/youtube-studio-production-factory-implementation-plan.md` → `sot/menus/rencana/youtube-studio-production-factory-implementation-plan.md`
- `sot/menus/youtube-studio-production-orchestration-implementation-plan.md` → `sot/menus/rencana/youtube-studio-production-orchestration-implementation-plan.md`
- `sot/menus/youtube-studio-roadmap.md` → `sot/menus/rencana/youtube-studio-roadmap.md`

### B. Subfolder `catatan-kerja/usulan/`
- `ANALISA_TENANT_MCP_MACMINI.md` → `catatan-kerja/usulan/ANALISA_TENANT_MCP_MACMINI.md`
- `USULAN_ANALITIK_MINGGUAN_CFA.md` → `catatan-kerja/usulan/USULAN_ANALITIK_MINGGUAN_CFA.md`
- `USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md` → `catatan-kerja/usulan/USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md`
- `USULAN_AUTOPIPELINE_VERSI_CLAUDE.md` → `catatan-kerja/usulan/USULAN_AUTOPIPELINE_VERSI_CLAUDE.md`
- `USULAN_FINISHING_VIDEO_CFSTUDIO.md` → `catatan-kerja/usulan/USULAN_FINISHING_VIDEO_CFSTUDIO.md`
- `USULAN_JADWAL_CLAUDE_DESKTOP_MACMINI.md` → `catatan-kerja/usulan/USULAN_JADWAL_CLAUDE_DESKTOP_MACMINI.md`
- `USULAN_JALUR_FLEKSIBEL_CFA.md` → `catatan-kerja/usulan/USULAN_JALUR_FLEKSIBEL_CFA.md`
- `USULAN_LINK_AFFILIATE_KOMENTAR_YOUTUBE.md` → `catatan-kerja/usulan/USULAN_LINK_AFFILIATE_KOMENTAR_YOUTUBE.md`
- `USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md` → `catatan-kerja/usulan/USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md`
- `USULAN_PERBAIKAN_PRESET_BRIDGING_AUTOPIPELINE.md` → `catatan-kerja/usulan/USULAN_PERBAIKAN_PRESET_BRIDGING_AUTOPIPELINE.md`
- `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` → `catatan-kerja/usulan/USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md`
- `USULAN_RENDER_FINISHING_VIDEO_STUDIO.md` → `catatan-kerja/usulan/USULAN_RENDER_FINISHING_VIDEO_STUDIO.md`
- `USULAN_RISET_PRODUK_MINGGUAN_CFA.md` → `catatan-kerja/usulan/USULAN_RISET_PRODUK_MINGGUAN_CFA.md`
- `USULAN_SOP_KARTU_KONTEKS_MENU.md` → `catatan-kerja/usulan/USULAN_SOP_KARTU_KONTEKS_MENU.md`
- `USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md` → `catatan-kerja/usulan/USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md`
- `USULAN_TEMPLATE_FINISHING_TAMBAHAN.md` → `catatan-kerja/usulan/USULAN_TEMPLATE_FINISHING_TAMBAHAN.md`
- `audit_produk_db_usulan.md` → `catatan-kerja/usulan/audit_produk_db_usulan.md`

### C. Subfolder `catatan-kerja/instruksi-agent/`
- `HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md` → `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md`
- `HANDOFF_ANTIGRAVITY_FIX_TOPICCOMPLIANCE_CUSTOM_STORYBOARD.md` → `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_FIX_TOPICCOMPLIANCE_CUSTOM_STORYBOARD.md`
- `HANDOFF_ANTIGRAVITY_MULTIPLIER_LOKASI_PER_KLIP.md` → `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_MULTIPLIER_LOKASI_PER_KLIP.md`
- `INSTRUKSI_PERBAIKAN_JADWAL_CFA_MACMINI.md` → `catatan-kerja/instruksi-agent/INSTRUKSI_PERBAIKAN_JADWAL_CFA_MACMINI.md`
- `PETUNJUK_CFA_JADWAL_TELEGRAM_HEMAT_TOKEN.md` → `catatan-kerja/instruksi-agent/PETUNJUK_CFA_JADWAL_TELEGRAM_HEMAT_TOKEN.md`
- `antigravity_agent_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_agent_instructions.md`
- `antigravity_analitik_mingguan_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_analitik_mingguan_instructions.md`
- `antigravity_finishing_pass_cek_ulang.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_pass_cek_ulang.md`
- `antigravity_finishing_pass_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_pass_instructions.md`
- `antigravity_finishing_pass_revisi_01.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_01.md`
- `antigravity_finishing_pass_revisi_02.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_02.md`
- `antigravity_finishing_pass_revisi_03.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_03.md`
- `antigravity_finishing_satu_fokus_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_finishing_satu_fokus_instructions.md`
- `antigravity_kartu_menu_dan_rapikan_folder_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_kartu_menu_dan_rapikan_folder_instructions.md`
- `antigravity_multiplier_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_multiplier_instructions.md`
- `antigravity_planner_metafor_kb_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_planner_metafor_kb_instructions.md`
- `antigravity_scraper_foto_produk_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_instructions.md`
- `antigravity_scraper_foto_produk_revisi_01.md` → `catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_01.md`
- `antigravity_uji_insight_2_halaman.md` → `catatan-kerja/instruksi-agent/antigravity_uji_insight_2_halaman.md`
- `antigravity_video_studio_finishing_render_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_video_studio_finishing_render_instructions.md`
- `antigravity_video_studio_sumber_kampanye_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_video_studio_sumber_kampanye_instructions.md`
- `antigravity_vo_narasi_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_vo_narasi_instructions.md`
- `antigravity_vo_narasi_koreksi_v2451.md` → `catatan-kerja/instruksi-agent/antigravity_vo_narasi_koreksi_v2451.md`
- `antigravity_youtube_studio_blueprint_script_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_blueprint_script_instructions.md`
- `antigravity_youtube_studio_duration_generation_profile_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_duration_generation_profile_instructions.md`
- `antigravity_youtube_studio_editorial_ui_refinement_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_editorial_ui_refinement_instructions.md`
- `antigravity_youtube_studio_editorial_workflow_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_editorial_workflow_instructions.md`
- `antigravity_youtube_studio_hybrid_api_smoke_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_hybrid_api_smoke_instructions.md`
- `antigravity_youtube_studio_hybrid_production_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_hybrid_production_instructions.md`
- `antigravity_youtube_studio_information_architecture_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_information_architecture_instructions.md`
- `antigravity_youtube_studio_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_instructions.md`
- `antigravity_youtube_studio_kb_foundation_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_kb_foundation_instructions.md`
- `antigravity_youtube_studio_multi_speaker_narrative_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_multi_speaker_narrative_instructions.md`
- `antigravity_youtube_studio_production_factory_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_production_factory_instructions.md`
- `antigravity_youtube_studio_production_orchestration_instructions.md` → `catatan-kerja/instruksi-agent/antigravity_youtube_studio_production_orchestration_instructions.md`
- `instruksi_kartun.md` → `catatan-kerja/instruksi-agent/instruksi_kartun.md`
- `kartun_tahap1.md` → `catatan-kerja/instruksi-agent/kartun_tahap1.md`

### D. Subfolder `catatan-kerja/rencana/`
- `analitik_mingguan_implementation_plan.md` → `catatan-kerja/rencana/analitik_mingguan_implementation_plan.md`
- `deconstruct_lab_implementation_plan.md` → `catatan-kerja/rencana/deconstruct_lab_implementation_plan.md`
- `finishing_pass_implementation_plan.md` → `catatan-kerja/rencana/finishing_pass_implementation_plan.md`
- `finishing_satu_fokus_implementation_plan.md` → `catatan-kerja/rencana/finishing_satu_fokus_implementation_plan.md`
- `implementation_plan_video_studio_finishing.md` → `catatan-kerja/rencana/implementation_plan_video_studio_finishing.md`
- `multiplier_lab_implementation_plan.md` → `catatan-kerja/rencana/multiplier_lab_implementation_plan.md`
- `rencana_penjadwalan_cocoa.md` → `catatan-kerja/rencana/rencana_penjadwalan_cocoa.md`
- `rencana_penjadwalan_rolled_oat.md` → `catatan-kerja/rencana/rencana_penjadwalan_rolled_oat.md`
- `scraper_foto_produk_implementation_plan.md` → `catatan-kerja/rencana/scraper_foto_produk_implementation_plan.md`
- `scraper_foto_produk_revisi_01_plan.md` → `catatan-kerja/rencana/scraper_foto_produk_revisi_01_plan.md`
- `vo_narasi_implementation_plan.md` → `catatan-kerja/rencana/vo_narasi_implementation_plan.md`

### E. Subfolder `catatan-kerja/laporan/`
- `LAPORAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` → `catatan-kerja/laporan/LAPORAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md`
- `LAPORAN_RILIS_DAN_DEPLOY_SCRAPER_FOTO_PRODUK.md` → `catatan-kerja/laporan/LAPORAN_RILIS_DAN_DEPLOY_SCRAPER_FOTO_PRODUK.md`
- `maknagrid_published_facebook_videos.md` → `catatan-kerja/laporan/maknagrid_published_facebook_videos.md`

### F. Subfolder `catatan-kerja/konten/`
- `naskah.md` → `catatan-kerja/konten/naskah.md`
- `resep-multiplier.md` → `catatan-kerja/konten/resep-multiplier.md`

### G. Subfolder `catatan-kerja/arsip-keluaran/`
- `diff.txt` → `catatan-kerja/arsip-keluaran/diff.txt`
- `diff_wsl.txt` → `catatan-kerja/arsip-keluaran/diff_wsl.txt`
- `diff_wsl_utf8.txt` → `catatan-kerja/arsip-keluaran/diff_wsl_utf8.txt`
- `inspect_output.txt` → `catatan-kerja/arsip-keluaran/inspect_output.txt`
- `prompt_output.txt` → `catatan-kerja/arsip-keluaran/prompt_output.txt`

### H. Subfolder `docs/mockups/`
- `mockup_caption_styles.html` → `docs/mockups/mockup_caption_styles.html`
- `mockup_finishing_preview.html` → `docs/mockups/mockup_finishing_preview.html`
- `mockup_finishing_templates_v3.html` → `docs/mockups/mockup_finishing_templates_v3.html`

### I. Subfolder `scripts/arsip-scratch/`
- `scratch-align-english-assets.mjs` → `scripts/arsip-scratch/scratch-align-english-assets.mjs`
- `scratch-check-gemini.mjs` → `scripts/arsip-scratch/scratch-check-gemini.mjs`
- `scratch-check-model-properties.mjs` → `scripts/arsip-scratch/scratch-check-model-properties.mjs`
- `scratch-check-opc.mjs` → `scripts/arsip-scratch/scratch-check-opc.mjs`
- `scratch-check-re-campaigns-columns.mjs` → `scripts/arsip-scratch/scratch-check-re-campaigns-columns.mjs`
- `scratch-check-settings.mjs` → `scripts/arsip-scratch/scratch-check-settings.mjs`
- `scratch-check-tenant-settings.mjs` → `scripts/arsip-scratch/scratch-check-tenant-settings.mjs`
- `scratch-check-users.mjs` → `scripts/arsip-scratch/scratch-check-users.mjs`
- `scratch-fix-vo-assets.mjs` → `scripts/arsip-scratch/scratch-fix-vo-assets.mjs`
- `scratch-localize-channel-and-strategy.mjs` → `scripts/arsip-scratch/scratch-localize-channel-and-strategy.mjs`
- `scratch-map-insert-fields.mjs` → `scripts/arsip-scratch/scratch-map-insert-fields.mjs`
- `scratch-print-keys.mjs` → `scripts/arsip-scratch/scratch-print-keys.mjs`
- `scratch-run-en-localization.mjs` → `scripts/arsip-scratch/scratch-run-en-localization.mjs`
- `scratch-sync-plan-json.mjs` → `scripts/arsip-scratch/scratch-sync-plan-json.mjs`
- `scratch-test-db-insert.mjs` → `scripts/arsip-scratch/scratch-test-db-insert.mjs`
- `scratch-test-gemini-connection.mjs` → `scripts/arsip-scratch/scratch-test-gemini-connection.mjs`
- `scratch-test-insert-regex.mjs` → `scripts/arsip-scratch/scratch-test-insert-regex.mjs`
- `scratch-test-suggest-route.mjs` → `scripts/arsip-scratch/scratch-test-suggest-route.mjs`
- `check-tables.js` → `scripts/arsip-scratch/check-tables.js`
- `check_errors.js` → `scripts/arsip-scratch/check_errors.js`
- `check_errors.sh` → `scripts/arsip-scratch/check_errors.sh`
- `inspect_scheduler_config.mjs` → `scripts/arsip-scratch/inspect_scheduler_config.mjs`

---

## 4. File yang Sengaja Tidak Dipindahkan

Sesuai aturan keselamatan di B2, file-file berikut tetap berada di folder root proyek:
1. `README.md`, `CLAUDE.md`, `AGENTS.md` (dibaca otomatis oleh agen/perangkat bantu).
2. `implementation_plan.md` (rencana pengerjaan aktif; nama ini dirujuk aturan SOP di `AGENTS.md`).
3. `package.json`, `package-lock.json`, `next.config.mjs`, `jsconfig.json`, `middleware.js`, `instrumentation.js` (konfigurasi Next.js dan Node.js).
4. `ecosystem.config.js`, `ecosystem.macmini.config.cjs`, `ecosystem.macmini-prod.config.cjs`, `ecosystem.staging.config.cjs` (konfigurasi PM2 yang dirujuk skrip deployment dan pengujian server multi-node).
5. `db.sqlite` (file database fallback yang dirujuk `scripts/local-staging/setup.js`).
6. Seluruh direktori proyek yang sudah ada (`app`, `apps`, `lib`, `kb`, `docs`, `plans`, `sot`, `skills`, `scripts`, `tests`, `public`, `templates`, `remotion`, `plugins`, `foods_n_drink`, `uji-kertas-claude`, `operator-reviews`, `brain`, `data`, `scratch`).

---

## 5. Tautan / Rujukan yang Diperbarui

Pembaruan rujukan jalur file dilakukan secara presisi:
1. `lib/word-alignment-engine.js`: baris 148 diperbarui dari `mockup_finishing_templates_v3.html` → `docs/mockups/mockup_finishing_templates_v3.html`.
2. `templates/finishing/shared-layers.js`: baris 741 diperbarui dari `mockup_caption_styles.html:303` → `docs/mockups/mockup_caption_styles.html:303`.
3. `uji-kertas-claude/LAPORAN_UJI_KERTAS.md`: baris 185 diperbarui dari `../USULAN_AUTOPIPELINE_VERSI_CLAUDE.md` → `../catatan-kerja/usulan/USULAN_AUTOPIPELINE_VERSI_CLAUDE.md`.
4. Rujukan file roadmap dan plan di dalam `sot/menus/affiliate-studio/*.md`: seluruh link `sot/menus/affiliate-studio-roadmap.md` diperbarui mengarah ke `sot/menus/rencana/affiliate-studio-roadmap.md`.
5. Rujukan `sot/menus/youtube-studio-*.md` di dalam file-file `sot/menus/rencana/`: diperbarui agar mengarah ke subfolder `rencana/`.
6. `AGENTS.md`: ditambahkan seksi aturan baru `# SOP Lokasi File Dokumen Kerja`.

---

## 6. Hasil Verifikasi Build & Pengujian

### Build Next.js
Perintah: `DISABLE_AUTO_MIGRATIONS=true npm run build`  
Hasil: **Berhasil 100% (Exit Code 0)**. Seluruh 176 rute statis dan dinamis berhasil di-generate tanpa error import yang putus.

### Test Suite
Perintah: `PG_SEARCH_PATH=dev node --test tests/video-studio-finishing.test.mjs tests/video-studio-audio-modes.test.mjs tests/video-studio-finishing-source.test.mjs tests/video-studio-finishing-fase2.test.mjs tests/video-studio-finishing-plan-ai.test.mjs tests/render-slot.test.js`  
Hasil: **28 dari 28 tes lulus (100% pass, 0 fail)**.

---

## 7. Catatan Rilis Git

* **Commit A (Bagian A)**: `040c964`  
  Pesan: `docs(menus): lengkapi kartu konteks 22 menu dan peta menu`
* **Commit B (Bagian B)**: `16369cf`  
  Pesan: `chore(repo): rapikan dokumen kerja dan skrip scratch ke dalam folder`
* **Commit Rilis Patch**: `de3621a`  
  Pesan: `release: v2.50.1 — Kartu Konteks Menu & Perapian Folder`  
  Tag: `v2.50.1`  
  Remote: Terunggah sempurna ke `https://github.com/sabeq83/CF-Studio.git` (branch `main`).
