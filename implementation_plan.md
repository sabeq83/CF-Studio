# Implementation Plan — Kartu Menu & Perapian Folder

Tanggal: 17 November 2026 | Versi: v2.50.0 (`550cc67`)
Instruksi sumber: `antigravity_kartu_menu_dan_rapikan_folder_instructions.md`

> [!IMPORTANT]
> Dua commit terpisah. Tidak ada perubahan perilaku aplikasi. Tidak perlu deploy.

---

## Execution Task List

### Bagian A — Kartu Menu
- [x] **A1** — Tulis 19 kartu menu baru di `sot/menus/kartu/` (maks 60 baris per kartu)
- [x] **A2** — Pindahkan file `sot/menus/rencana/` via `git mv` (youtube-studio-*-implementation-plan.md, roadmap, mvp, dll)
- [x] **A3** — Perbarui `sot/menus/_PETA_MENU.md` (ganti "belum" → tautan kartu, perbaiki fungsi singkat, hapus peringatan)
- [x] **A4** — Verifikasi: `wc -l sot/menus/kartu/*.md` ≤ 60, `ls` jalur file di kartu ada semua
- [x] **A5** — Commit A: `docs(menus): lengkapi kartu konteks 22 menu dan peta menu`

### Bagian B — Perapian Folder
- [x] **B1** — Buat struktur folder `catatan-kerja/` (usulan, instruksi-agent, rencana, laporan, konten, arsip-keluaran)
- [x] **B2** — `git mv` file-file ke `catatan-kerja/` sesuai tabel B3
- [x] **B3** — `git mv` mockup ke `docs/mockups/`
- [x] **B4** — `git mv` scratch-*.mjs + check-* + inspect_* ke `scripts/arsip-scratch/`
- [x] **B5** — Perbarui komentar `lib/word-alignment-engine.js` baris ± 148 (jalur mockup baru)
- [x] **B6** — Buat `catatan-kerja/_DAFTAR_ISI.md`
- [x] **B7** — Tambah SOP Lokasi File Dokumen Kerja ke `AGENTS.md` (tidak di-commit)
- [x] **B8** — `npm run build` (DISABLE_AUTO_MIGRATIONS=true) → harus berhasil
- [x] **B9** — Commit B: `chore(repo): rapikan dokumen kerja dan skrip scratch ke dalam folder`

### Rilis
- [ ] **R1** — `npm run release-non-interactive` patch
- [ ] **R2** — Tulis `catatan-kerja/laporan/LAPORAN_KARTU_MENU_DAN_PERAPIAN_FOLDER.md`

---

## Tabel B: Jalur Lama → Jalur Baru

### catatan-kerja/usulan/
| Lama | Baru |
|---|---|
| `USULAN_ANALITIK_MINGGUAN_CFA.md` | `catatan-kerja/usulan/USULAN_ANALITIK_MINGGUAN_CFA.md` |
| `USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md` | `catatan-kerja/usulan/USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md` |
| `USULAN_AUTOPIPELINE_VERSI_CLAUDE.md` | `catatan-kerja/usulan/USULAN_AUTOPIPELINE_VERSI_CLAUDE.md` |
| `USULAN_FINISHING_VIDEO_CFSTUDIO.md` | `catatan-kerja/usulan/USULAN_FINISHING_VIDEO_CFSTUDIO.md` |
| `USULAN_JADWAL_CLAUDE_DESKTOP_MACMINI.md` | `catatan-kerja/usulan/USULAN_JADWAL_CLAUDE_DESKTOP_MACMINI.md` |
| `USULAN_JALUR_FLEKSIBEL_CFA.md` | `catatan-kerja/usulan/USULAN_JALUR_FLEKSIBEL_CFA.md` |
| `USULAN_LINK_AFFILIATE_KOMENTAR_YOUTUBE.md` | `catatan-kerja/usulan/USULAN_LINK_AFFILIATE_KOMENTAR_YOUTUBE.md` |
| `USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md` | `catatan-kerja/usulan/USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md` |
| `USULAN_PERBAIKAN_PRESET_BRIDGING_AUTOPIPELINE.md` | `catatan-kerja/usulan/USULAN_PERBAIKAN_PRESET_BRIDGING_AUTOPIPELINE.md` |
| `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` | `catatan-kerja/usulan/USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` |
| `USULAN_RENDER_FINISHING_VIDEO_STUDIO.md` | `catatan-kerja/usulan/USULAN_RENDER_FINISHING_VIDEO_STUDIO.md` |
| `USULAN_RISET_PRODUK_MINGGUAN_CFA.md` | `catatan-kerja/usulan/USULAN_RISET_PRODUK_MINGGUAN_CFA.md` |
| `USULAN_SOP_KARTU_KONTEKS_MENU.md` | `catatan-kerja/usulan/USULAN_SOP_KARTU_KONTEKS_MENU.md` |
| `USULAN_TEMPLATE_FINISHING_TAMBAHAN.md` | `catatan-kerja/usulan/USULAN_TEMPLATE_FINISHING_TAMBAHAN.md` |
| `USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md` | `catatan-kerja/usulan/USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md` |
| `ANALISA_TENANT_MCP_MACMINI.md` | `catatan-kerja/usulan/ANALISA_TENANT_MCP_MACMINI.md` |
| `audit_produk_db_usulan.md` | `catatan-kerja/usulan/audit_produk_db_usulan.md` |

### catatan-kerja/instruksi-agent/
| Lama | Baru |
|---|---|
| `antigravity_agent_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_agent_instructions.md` |
| `antigravity_analitik_mingguan_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_analitik_mingguan_instructions.md` |
| `antigravity_finishing_pass_cek_ulang.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_pass_cek_ulang.md` |
| `antigravity_finishing_pass_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_pass_instructions.md` |
| `antigravity_finishing_pass_revisi_01.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_01.md` |
| `antigravity_finishing_pass_revisi_02.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_02.md` |
| `antigravity_finishing_pass_revisi_03.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_pass_revisi_03.md` |
| `antigravity_finishing_satu_fokus_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_finishing_satu_fokus_instructions.md` |
| `antigravity_kartu_menu_dan_rapikan_folder_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_kartu_menu_dan_rapikan_folder_instructions.md` |
| `antigravity_multiplier_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_multiplier_instructions.md` |
| `antigravity_planner_metafor_kb_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_planner_metafor_kb_instructions.md` |
| `antigravity_scraper_foto_produk_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_instructions.md` |
| `antigravity_scraper_foto_produk_revisi_01.md` | `catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_01.md` |
| `antigravity_uji_insight_2_halaman.md` | `catatan-kerja/instruksi-agent/antigravity_uji_insight_2_halaman.md` |
| `antigravity_video_studio_finishing_render_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_video_studio_finishing_render_instructions.md` |
| `antigravity_vo_narasi_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_vo_narasi_instructions.md` |
| `antigravity_vo_narasi_koreksi_v2451.md` | `catatan-kerja/instruksi-agent/antigravity_vo_narasi_koreksi_v2451.md` |
| `antigravity_youtube_studio_blueprint_script_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_blueprint_script_instructions.md` |
| `antigravity_youtube_studio_duration_generation_profile_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_duration_generation_profile_instructions.md` |
| `antigravity_youtube_studio_editorial_ui_refinement_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_editorial_ui_refinement_instructions.md` |
| `antigravity_youtube_studio_editorial_workflow_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_editorial_workflow_instructions.md` |
| `antigravity_youtube_studio_hybrid_api_smoke_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_hybrid_api_smoke_instructions.md` |
| `antigravity_youtube_studio_hybrid_production_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_hybrid_production_instructions.md` |
| `antigravity_youtube_studio_information_architecture_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_information_architecture_instructions.md` |
| `antigravity_youtube_studio_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_instructions.md` |
| `antigravity_youtube_studio_kb_foundation_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_kb_foundation_instructions.md` |
| `antigravity_youtube_studio_multi_speaker_narrative_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_multi_speaker_narrative_instructions.md` |
| `antigravity_youtube_studio_production_factory_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_production_factory_instructions.md` |
| `antigravity_youtube_studio_production_orchestration_instructions.md` | `catatan-kerja/instruksi-agent/antigravity_youtube_studio_production_orchestration_instructions.md` |
| `HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md` | `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md` |
| `HANDOFF_ANTIGRAVITY_FIX_TOPICCOMPLIANCE_CUSTOM_STORYBOARD.md` | `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_FIX_TOPICCOMPLIANCE_CUSTOM_STORYBOARD.md` |
| `HANDOFF_ANTIGRAVITY_MULTIPLIER_LOKASI_PER_KLIP.md` | `catatan-kerja/instruksi-agent/HANDOFF_ANTIGRAVITY_MULTIPLIER_LOKASI_PER_KLIP.md` |
| `INSTRUKSI_PERBAIKAN_JADWAL_CFA_MACMINI.md` | `catatan-kerja/instruksi-agent/INSTRUKSI_PERBAIKAN_JADWAL_CFA_MACMINI.md` |
| `PETUNJUK_CFA_JADWAL_TELEGRAM_HEMAT_TOKEN.md` | `catatan-kerja/instruksi-agent/PETUNJUK_CFA_JADWAL_TELEGRAM_HEMAT_TOKEN.md` |
| `instruksi_kartun.md` | `catatan-kerja/instruksi-agent/instruksi_kartun.md` |
| `kartun_tahap1.md` | `catatan-kerja/instruksi-agent/kartun_tahap1.md` |

### catatan-kerja/rencana/
| Lama | Baru |
|---|---|
| `analitik_mingguan_implementation_plan.md` | `catatan-kerja/rencana/analitik_mingguan_implementation_plan.md` |
| `deconstruct_lab_implementation_plan.md` | `catatan-kerja/rencana/deconstruct_lab_implementation_plan.md` |
| `finishing_pass_implementation_plan.md` | `catatan-kerja/rencana/finishing_pass_implementation_plan.md` |
| `finishing_satu_fokus_implementation_plan.md` | `catatan-kerja/rencana/finishing_satu_fokus_implementation_plan.md` |
| `implementation_plan_video_studio_finishing.md` | `catatan-kerja/rencana/implementation_plan_video_studio_finishing.md` |
| `multiplier_lab_implementation_plan.md` | `catatan-kerja/rencana/multiplier_lab_implementation_plan.md` |
| `scraper_foto_produk_implementation_plan.md` | `catatan-kerja/rencana/scraper_foto_produk_implementation_plan.md` |
| `scraper_foto_produk_revisi_01_plan.md` | `catatan-kerja/rencana/scraper_foto_produk_revisi_01_plan.md` |
| `vo_narasi_implementation_plan.md` | `catatan-kerja/rencana/vo_narasi_implementation_plan.md` |
| `rencana_penjadwalan_cocoa.md` | `catatan-kerja/rencana/rencana_penjadwalan_cocoa.md` |
| `rencana_penjadwalan_rolled_oat.md` | `catatan-kerja/rencana/rencana_penjadwalan_rolled_oat.md` |

### catatan-kerja/laporan/
| Lama | Baru |
|---|---|
| `LAPORAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` | `catatan-kerja/laporan/LAPORAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` |
| `LAPORAN_RILIS_DAN_DEPLOY_SCRAPER_FOTO_PRODUK.md` | `catatan-kerja/laporan/LAPORAN_RILIS_DAN_DEPLOY_SCRAPER_FOTO_PRODUK.md` |
| `maknagrid_published_facebook_videos.md` | `catatan-kerja/laporan/maknagrid_published_facebook_videos.md` |

### catatan-kerja/konten/
| Lama | Baru |
|---|---|
| `naskah.md` | `catatan-kerja/konten/naskah.md` ⚠️ Perlu cek kode dulu |
| `resep-multiplier.md` | `catatan-kerja/konten/resep-multiplier.md` |

### docs/mockups/
| Lama | Baru |
|---|---|
| `mockup_caption_styles.html` | `docs/mockups/mockup_caption_styles.html` |
| `mockup_finishing_preview.html` | `docs/mockups/mockup_finishing_preview.html` |
| `mockup_finishing_templates_v3.html` | `docs/mockups/mockup_finishing_templates_v3.html` |

### catatan-kerja/arsip-keluaran/
| Lama | Baru |
|---|---|
| `diff.txt` | `catatan-kerja/arsip-keluaran/diff.txt` |
| `diff_wsl.txt` | `catatan-kerja/arsip-keluaran/diff_wsl.txt` |
| `diff_wsl_utf8.txt` | `catatan-kerja/arsip-keluaran/diff_wsl_utf8.txt` |
| `inspect_output.txt` | `catatan-kerja/arsip-keluaran/inspect_output.txt` |
| `prompt_output.txt` | `catatan-kerja/arsip-keluaran/prompt_output.txt` |

### scripts/arsip-scratch/
| Lama | Baru |
|---|---|
| `scratch-*.mjs` (18 file) | `scripts/arsip-scratch/scratch-*.mjs` |
| `check-tables.js` | `scripts/arsip-scratch/check-tables.js` |
| `check_errors.js` | `scripts/arsip-scratch/check_errors.js` |
| `check_errors.sh` | `scripts/arsip-scratch/check_errors.sh` |
| `inspect_scheduler_config.mjs` | `scripts/arsip-scratch/inspect_scheduler_config.mjs` |

### File TIDAK dipindah
| File | Alasan |
|---|---|
| `README.md`, `CLAUDE.md`, `AGENTS.md` | Dibaca otomatis agen/alat |
| `implementation_plan.md` | Rencana aktif ini |
| `package.json`, `package-lock.json`, `next.config.mjs`, `jsconfig.json`, `middleware.js`, `instrumentation.js` | Konfigurasi aplikasi |
| `ecosystem.*.js/cjs` | Dirujuk deploy script |
| `naskah.md` | ⚠️ Dikonfirmasi: nama file di kode (`drive-sync-helper.js`, `scheduler-processors.js`) adalah nama file keluaran dinamis bukan membaca file ini — AMAN dipindah |
| `db.sqlite` | Dirujuk `scripts/local-staging/setup.js` |
