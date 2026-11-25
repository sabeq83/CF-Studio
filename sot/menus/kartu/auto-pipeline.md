# Kartu Menu: Auto Pipeline

Terakhir dicek: 25 November 2026 · Versi aplikasi: v2.62.0
Alamat: `/auto-pipeline` · Kelompok: WORKFLOW · Kunci izin menu: `auto_pipeline`

## Fungsi
Pabrik konten otomatis. Dari satu masukan (produk, topik, resep, atau blueprint), sistem membuat konten sampai jadi tanpa langkah manual di tengah. Bisa dijalankan sekali klik atau dijadwalkan berulang, lalu otomatis ditayangkan ke akun media sosial.

## Dua tab di halaman
- **Pipeline** — jalankan sekarang, lihat antrean dan hasil per batch.
- **Schedules** — jadwal berulang (hari, jam, akun tujuan, jeda/aktif).

## Jenis pipeline (6)
| Kode | Hasil |
|---|---|
| `recipe_campaign` (bawaan) | Video resep |
| `product_campaign` | Video promosi produk |
| `editorial_campaign` | Video editorial/cerita brand |
| `multiplier_campaign` | Video dari blueprint viral (lihat kartu Multiplier Labs) |
| `recipe_labs` | Artikel resep + foto grid |
| `threads_series` | Seri utas Threads |

## Alur pakai
1. Pilih jenis pipeline, brand, preset, dan Visual Identity.
2. Isi bahan: produk / topik / resep / blueprint.
3. Jalankan sekarang, atau simpan sebagai jadwal dengan akun tujuan.
4. Pantau antrean; hasil masuk ContentFlow Hub dan (jika publish otomatis aktif) dijadwalkan tayang.

## Terhubung dengan
- Butuh data dari: Brand Profile Manager, Preset Manager, Visual Identity, Product Database, Recipe Library, Deconstruct Lab (blueprint).
- Hasilnya dipakai oleh: ContentFlow Hub dan penjadwal publish (akun Repliz).
- Perintah MCP: `cf_run_auto_pipeline`, `cf_create_product_video`, `cf_create_editorial_video`, `cf_create_recipe_video`, `cf_create_multiplier_video`, `cf_create_recipe_labs_post`, `cf_create_threads_series`, `cf_get_pipeline_queue`, `cf_cancel_pipeline_job`, `cf_get_job_status`, dan keluarga jadwal `cf_list/create/update/delete_schedule`, `cf_toggle_schedule_pause`, `cf_trigger_schedule_now`.

## Lokasi (untuk agent)
- Halaman: `app/auto-pipeline/page.js` (± 9.200 baris — **jangan dibaca utuh**, cari dengan kata kunci), `app/auto-pipeline/ThreadsSeriesForm.js`
- API jalankan/antrean: `app/api/v2/recipes/autonomous-pipeline/` (`route`, `queue`, `batches`, `status`)
- API jadwal: `app/api/v2/recipes/auto-pipeline-schedules/` (`route`, `[id]`)
- Logika inti: `lib/auto-pipeline-scheduler-runner.js` (pemilih jenis pipeline), `lib/auto-pipeline-schedules-repository.js`, `lib/auto-pipeline-queue-repository.js`, `lib/autonomous-engine.js`, `lib/autonomous-recipe-engine.js`
- Tabel data: `auto_pipeline_schedules`, `auto_pipeline_jobs`

## Aturan penting & jebakan
1. **Alamat API memakai kata `recipes`** walau melayani semua jenis pipeline. Ini warisan nama lama, bukan salah alamat.
2. Jadwal tanpa jenis pipeline dianggap `recipe_campaign`.
3. **Publish otomatis aktif secara bawaan** pada jadwal baru (`auto_publish_enabled`). Matikan jika ingin tinjau dulu.
4. Status antrean: `queued` → `processing` → `completed` / `failed` / `cancelled`. Status jadwal: `active`, `paused`, `archived`.
5. Jadwal CF Autopipeline (CFA) versi skill Claude adalah sistem **terpisah** dari tab Schedules di menu ini; jangan dicampur saat menganalisa.
6. Dropdown preset Video Multiplier (`multiplier_campaign`) hanya menampilkan preset dengan `campaign_kinds` memuat `multiplier_campaign` (bisa ditambah dengan meng-clone atau mencentang `Campaign Multiplier` di Preset Manager).
7. Mode jadwal `selection_mode: 'auto_smart_match'` pada `multiplier_campaign` otomatis memilih pasangan `(blueprint, product)` dari `blueprint_product_matches` sesuai `target_promo_role` (`alat_dapur` / `bahan_resep`) sambil menghindari pengulangan blueprint 14 hari & produk 4 hari (`pickNextSmartMatchPair`), serta tersedia aksi `setup_multiplier_2plus2_quota` pada `POST /api/v2/recipes/auto-pipeline-schedules`.
8. Eksekusi 1-klik (`POST /api/v2/recipes/autonomous-pipeline`) melakukan isolasi tenant yang konsisten pada aset blueprint Multiplier, menampilkan feedback validasi inline saat prasyarat belum lengkap, dan polling progress `recipe_labs` dilayani oleh `GET /api/v2/recipes/autonomous-pipeline/status`.
9. Pemilihan produk Video Multiplier di tab Pipeline & Schedule menampilkan thumbnail foto aktif sesuai `active_photo` (`resolveCampaignProductPhotoPath`), status tinjauan (`photo_status`), serta kartu pratinjau `BridgingProductReferenceCard` beserta tautan cepat ke Product Database.
10. Tab Pipeline & Schedule meneruskan konfigurasi `audio_engine_mode` (`minimax_tts` / `no_vo`), `no_vo_audio_bed`, dan `on_screen_text_mode` untuk mode produksi tanpa voice-over serta mendukung Visual Identity `zero_human`.
11. Penjadwalan mendukung pemisahan tanggal produksi (`target_date` / alias `generation_date`) dan tanggal publish (`publish_date` pada mode `specific_date`, atau `publish_day_offset` H+0 s.d. H+14 pada mode `recurring`), dengan penguncian `last_run_target_date` agar render lintas tengah malam tidak menggeser jadwal tayang.

## Belum ada / batasan
- Jumlah dan isi jadwal aktif berubah-ubah; jangan mengutip daftar jadwal dari dokumen, cek langsung lewat `cf_list_schedules`.

## Dokumen lengkap
`docs/cf-studio-mcp-autopipeline-runbook.md`
- Bagian 2 — katalog perintah MCP
- Bagian 3 — cara menjalankan jadwal secara manual
- Bagian 4 — daftar jadwal (bisa sudah basi)
