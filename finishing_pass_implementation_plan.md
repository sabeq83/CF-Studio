# Finishing Pass Implementation Plan & Execution Tracker (`v2.45.x`) — `(Revisi 02)`

Dokumen ini adalah rencana teknis & tracker eksekusi bertahap untuk mengimplementasikan seluruh usulan di [`USULAN_FINISHING_VIDEO_CFSTUDIO.md`](file:///Users/sabeqmmursyid/_cfstudio/USULAN_FINISHING_VIDEO_CFSTUDIO.md), [`USULAN_TEMPLATE_FINISHING_TAMBAHAN.md`](file:///Users/sabeqmmursyid/_cfstudio/USULAN_TEMPLATE_FINISHING_TAMBAHAN.md), dan [`antigravity_finishing_pass_instructions.md`](file:///Users/sabeqmmursyid/_cfstudio/antigravity_finishing_pass_instructions.md), yang telah diselaraskan penuh dengan [`antigravity_finishing_pass_revisi_01.md`](file:///Users/sabeqmmursyid/_cfstudio/antigravity_finishing_pass_revisi_01.md) (`R1`–`R8`), [`antigravity_finishing_pass_revisi_02.md`](file:///Users/sabeqmmursyid/_cfstudio/antigravity_finishing_pass_revisi_02.md) (`R9`–`R13`), [`antigravity_finishing_pass_cek_ulang.md`](file:///Users/sabeqmmursyid/_cfstudio/antigravity_finishing_pass_cek_ulang.md), [`mockup_finishing_preview.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_preview.html), [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html), dan bundel referensi [`plans/finishing-pass-reference/`](file:///Users/sabeqmmursyid/_cfstudio/plans/finishing-pass-reference/overlay.html).

> Setiap seksi atau butir task yang diubah/ditambahkan dari revisi ditandai jelas dengan **`(Revisi 01)`** atau **`(Revisi 02)`**. Fase 0, Fase 1, dan Fase 2 telah **selesai & dirilis** (`v2.44.4` → `v2.44.6`).

---

## 0. Hasil Audit Awal & Audit Ulang (`v2.44.3` / `d5a2793`) — `(Revisi 01)`

Audit codebase, schema DB PostgreSQL (`staging` & `public`), Nextcloud bundle, dan runtime host Mac Mini Staging (`100.95.245.55`):

1. **Status Git Lokal (`HEAD`: `v2.44.3` / `d5a2793`)**:
   - [`lib/tts-text-sanitizer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js) memiliki modifikasi lokal trailing newline — **dipertahankan**.
   - **Tugas dokumen (`antigravity_finishing_pass_cek_ulang.md`)**: belum ada perubahan kode, migrasi DB, rilis, maupun deploy.

2. **Audit Bug Tag `<#1.0#>` di `mul_261113_qt67yl`**:
   - Pada `staging.tts_studio_clips` (`batch_id = 'multiplier_tts_mul_261113_qt67yl'`, `clip_index = '4'`), `source_text` tercatat mengandung `<#1.0#>` karena dirender sebelum perbaikan `v2.44.3`.
   - Saat ini [`stripTtsMarkupTags()`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js#L28-L36) sudah dipanggil di [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js#L71), namun Fase 0 menambahkan `sanitizeOverlayTextStrict()` + `hasLeakedOverlayMarkup()` + QA guard pre-render untuk menangkap bentuk escaped (`&lt;#...#&gt;`), tag `[...]`/interjeksi, serta unit test regresi.

3. **Audit Sumber Hook & Kategori Herbal Sebelum FFmpeg (`R1` — `(Revisi 01)`)**:
   - **Data Staging aktual**:
     - `opc_2117`: `row_creative_payload.custom_hook = "Hasil lab kolesterol naik lagi padahal sudah jaga makan?"` (56 karakter, mengandung kata `"kolesterol"`), `result_json.yt_title = "Hasil Lab Kolesterol Naik Terus? Ini Cara Alami Jaga Kebugaran Harian! #Shorts"`.
     - `mul_261113_qt67yl`: `re_multiplier_tasks.yt_title = "Bikin Brownies Tanpa Gula Cuma 3 Bahan Lembut Banget #Shorts"` (52 karakter setelah `#Shorts` dibuang), `bridging_config_json.angleTitle = "Trik Kilat Sarapan Sehat Tanpa Tepung Terigu"`.
   - **Ketersediaan flag herbal (`isHerbalProduct`) di DB**:
     - `product_extractions.category` berisi nilai seperti `"Kesehatan & Minuman Herbal"`, `"Bumbu Dapur & Minuman Herbal"`, `"Health & Wellness / Herbal Tea"`, `"Kesehatan & Suplemen Makanan"`, `"Makanan & Minuman / Madu & Suplemen Kesehatan"`, `"Minuman Kesehatan"`, `"Peralatan Dapur"`.
     - **Gap yang ditemukan saat audit**: banyak item di `content_flow_items` memiliki `product_id = NULL` (hanya `509/3978` OPC, `3/138` Multiplier, dan `0/702` RE yang punya `content_flow_items.product_id`, meski sebagian `pillar_campaigns.target_product_id` atau `nama_produk` terisi). Oleh karena itu aturan **`R1.4`** wajib berlaku: jika kategori produk tidak dapat dipastikan non-herbal, **`isHerbalProduct` default `true` (konservatif)**.

4. **Audit Audio Tempo & Timing (`R2` — `(Revisi 01)`)**:
   - [`runSmartSyncMux()`](file:///Users/sabeqmmursyid/_cfstudio/lib/smart-sync-engine.js#L76-L150) (dipanggil oleh [`processTtsStudioMuxing()`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L604-L903) untuk OPC, RE, dan Multiplier) hanya menerapkan `[0:v]setpts=${speedFactor}*PTS[v]` pada **stream video**; stream **VO audio** (`-map 1:a:0`) **tidak** dikenai `atempo` atau stretch.
   - `atempo` hanya ada di [`processYouTubeTimelineMux()`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L1005-L1175) pada [`lib/video-studio-processor.js:1168`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L1168) (jalur YouTube Studio, bukan OPC/RE/Multiplier).
   - Kesimpulan audit: timestamp kata relatif terhadap klip audio tetap valid di timeline muxed untuk jalur OPC/RE/Multiplier tanpa penskalaan tempo. Offset global dihitung dari waktu mulai klip pada video gabungan (termasuk penyesuaian durasi `xfade` untuk campaign lama).

5. **Audit Runtime Mac Mini Staging (`100.95.245.55`) & Bundel Referensi (`R3`, `R4` — `(Revisi 01)`)**:
   - **Playwright Chromium Staging**: terverifikasi **terpasang dan ada** via `playwright` (`chromium.executablePath() -> .../chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, `exists: true`).
   - **Font host & emoji**: Mac Mini Staging memiliki `/System/Library/Fonts/Apple Color Emoji.ttc`, namun belum memiliki `Anton`, `Montserrat`, maupun `Inter` di `public/fonts/`. Di Linux VPS nanti perlu verifikasi Chromium + `Noto Color Emoji` (dengan fallback teks/SVG untuk emoji).
   - **FFmpeg & Whisper**: FFmpeg memiliki `loudnorm` & `zoompan`, tidak memiliki `ass`/`subtitles`/`drawtext`. Biner `whisper-cli` belum terpasang di Staging, sehingga Tier 3 (`silencedetect=noise=-35dB:d=0.08` + bobot `norm(w).length + 1.6` + split tanda baca) adalah jalur cadangan utama sejak **Fase 0**.
   - **Bundel referensi**: [`plans/finishing-pass-reference/`](file:///Users/sabeqmmursyid/_cfstudio/plans/finishing-pass-reference/overlay.html) sudah menyediakan referensi kontrak `window.renderAt(t)`, `derive()`, Chromium capture (`capture.cjs`), serta 3x upscale `zoompan` + audio ducking + `loudnorm` (`compose.py` / `filter.txt` / `meta.json`).

6. **Audit Nextcloud Bundle, `content_flow_items`, & Repliz Scheduler (`R7` — `(Revisi 01)`)**:
   - Distribusi `staging.content_flow_items`: `opc` (`3978`, `1808` punya `nextcloud_url`), `re` (`702`, `668` punya `nextcloud_url`), `multiplier` (`138`, `138` punya `nextcloud_url`), `strategic` (`6`, `0` punya `nextcloud_url`), `recipe` / Recipe Labs (`4`, `4` punya `nextcloud_url`).
   - **Temuan bundel Nextcloud per tipe**:
     - **OPC** ([`lib/scheduler-processors.js:7482-7556`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L7482-L7556)): mengunggah `${filePrefix}_video_final.mp4`, `${filePrefix}_video_clip_{i}.mp4`, `${filePrefix}_start_frame_{i}.png`, `${filePrefix}_audio_clip_{i}.mp3`, `${filePrefix}_naskah.md`, dan `naskah.md` (catatan: hanya jalan jika `storage_provider === 'nextcloud'`).
     - **RE** ([`lib/scheduler-processors.js:3123-3182`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L3123-L3182), [`4194-4271`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L4194-L4271)): mengunggah `${filePrefix}_video_final.mp4`, `${filePrefix}_video_clip_{i}.mp4`, `${filePrefix}_start_frame_{i}.png`, `${filePrefix}_audio_clip_{i}.mp3`, dan `${filePrefix}_naskah.md` (untuk RE variant & RE item).
     - **Multiplier** ([`lib/re-multiplier-worker.js:1456-1525`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L1456-L1525)): mengunggah `{videoId}_final.mp4`, `{videoId}_vo_final.mp3`, `{videoId}_scene_c{XX}.mp4`, `{videoId}_vo_c{XX}.mp3`, `{videoId}_naskah_baru.md`, `{videoId}_naskah.md`, dan T2I images.
     - **Recipe Labs (`source_type = 'recipe'`)** ([`lib/contentflow-ingest.js:931-967`](file:///Users/sabeqmmursyid/_cfstudio/lib/contentflow-ingest.js#L931-L967)): `url_asset` adalah gambar poster (`05_GRID_POSTER.jpg`), **bukan video MP4** → **dikecualikan** dari batch re-finishing.
   - **Gap helper & URL Nextcloud**: `content_flow_items.nextcloud_url` menyimpan **public share URL** (`http://.../index.php/s/...`), bukan path WebDAV langsung; sedangkan [`lib/nextcloud-helper.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/nextcloud-helper.js) baru punya fungsi upload (`uploadFileToNextcloud`, `uploadBufferToNextcloud`) dan belum punya `downloadFileFromNextcloud`, `copyFileInNextcloud`, maupun resolver folder WebDAV dari item/campaign.
   - **Repliz scheduler (`lib/auto-pipeline-scheduler-runner.js:404-420`)**: saat ini memilih item `pipeline_status = 'Completed'` tanpa memeriksa `finishing_status = 'processing'`.

7. **Audit Jalur Propagasi Preset & Transition (`R8.3` — `(Revisi 01)`)**:
   - Seluruh jalur `video_transition`, `enable_motion_text`, `motion_text_style` teridentifikasi di:
     1. [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js) (5 preset bawaan: `brand_editorial_campaign:98`, `product_campaign:180`, `recipe_campaign:262`, `multiplier_deconstruct_remix:344`, `recipe_labs_editorial_food:474`) + `tenant_settings` key `'operator_presets_json'`.
     2. [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js#L144-L278) (`mapPresetToGlobals`, `resolveAutonomousDefaults`, Product `565-574`, Editorial `775-785`, Multiplier `891-900, 1045-1105`).
     3. [`lib/auto-pipeline-scheduler-runner.js:152-158`](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js#L152-L158) (scheduler overrides).
     4. [`lib/custom-storyboard-pipeline.js:254-265, 448-456`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js#L254-L265) dan [`lib/recipe-campaign-ingest.js:118-123`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js#L118-L123).
     5. [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L503-L860) (`cf_create_preset`, `cf_update_preset`, `cf_get_preset_detail`, `cf_submit_custom_storyboard` line 793; sedangkan `cf_create_product_video`, `cf_create_editorial_video`, `cf_create_recipe_video`, `cf_create_multiplier_video` belum mengekspos `finishing_template`/`caption_mode`/`loudness_target`).
     6. [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js#L87-L288) (`DEFAULT_FORM`, `mapPresetToForm`, `mapFormToPayload`, UI lines 1445–1525).
     7. [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js#L178-L212) (`178-212, 1715-2025, 3169-3245`), [`lib/pillar-campaign-approval.js:93-141`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-approval.js#L93-L141), dan [`app/api/v2/pillar-campaigns/items/[itemId]/voiceover/route.js:13-52`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/items/[itemId]/voiceover/route.js#L13-L52).
     - **Gap yang ditemukan**: tabel `re_campaigns` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) saat ini **tidak memiliki** kolom `video_transition`, `enable_motion_text`, `motion_text_style`, `finishing_template`, `caption_mode`, maupun `loudness_target`. *(Sudah dimigrasikan pada Fase 1 `v2.44.5`.)*

8. **Audit R10, R11, & R12 (Pasca-Rilis Fase 2 `v2.44.6`) — `(Revisi 02)`**:
   - **Audit Tipe Kolom `clip_index` PostgreSQL (`dev`, `staging`, `public`)**:
     - Hasil kueri langsung ke `information_schema.columns` (`100.78.186.123:5432/maknaflow_db`) menunjukkan kolom `tts_studio_clips.clip_index` dan `glabs_tasks.clip_index` pada **ketiga schema (`dev`, `staging`, `public`) bertipe `bigint` (`int8`)**, bukan `text`/`varchar`. Artinya `ORDER BY clip_index ASC` di PostgreSQL sudah mengurutkan secara numerik.
     - Kueri utama `processTtsStudioMuxing()` ([`lib/db.js:2029,2048`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2029)) sudah memakai `ORDER BY clip_index ASC`, namun beberapa kueri sync cloud ([`lib/scheduler-processors.js:3196,3311,3343,4136,4292,4355,4396,9059,9107`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L3196), [`lib/drive-sync-helper.js:103,208,324,440`](file:///Users/sabeqmmursyid/_cfstudio/lib/drive-sync-helper.js#L103), [`lib/nextcloud-sync-helper.js:106,192,298,394`](file:///Users/sabeqmmursyid/_cfstudio/lib/nextcloud-sync-helper.js#L106)) belum menyertakan `ORDER BY clip_index ASC`. Tetap diwajibkan sort numerik defensif `ORDER BY clip_index::int ASC` / `Number(clip.clip_index)` di layer JS & validasi indeks eksplisit pada `processTtsStudioMuxing()`.
   - **Audit Asal Urutan `visual_clip_paths` di Semua Pipeline (`R10`)**:
     - **OPC / Pillar (`lib/scheduler-processors.js:6667-6685`)**: inisialisasi array fixed-slot `localPaths = Array(taskIds.length).fill(null)` lalu pengisian per slot indeks `i` (`localPaths[i]`).
     - **RE Campaign (`lib/scheduler-processors.js:3416-3436`)**: sama, fixed-slot `Array(taskIds.length).fill(null)` berdasarkan urutan `visual_tasks_json`.
     - **Multiplier (`lib/re-multiplier-worker.js:1273-1301`)**: iterasi `for (let i = 0; i < prompts.length; i++)` membangun `mult_clip_${task.id}_${i}.mp4` terurut.
     - **Sheets Autopilot (`lib/sheets-autopilot-worker.js:1992`)**: mengambil `glabs_tasks ... ORDER BY clip_index ASC`.
     - **Celah Bug Pasca-Concat / Mux**: [`processTtsStudioMuxing()`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L884-L887) saat ini **hanya memeriksa `videoPaths.length !== completedClips.length`**, belum memeriksa kesesuaian nomor klip pada nama file (jika video/audio memakai akhiran nomor klip seperti `*_clip_01.mp4` vs `clip_11.mp3`), belum mencocokkan panjang audio probed vs metadata durasi (`±0.3s`), dan langsung melempar exception gagal total alih-alih jatuh aman ke render tanpa finishing pass. Referensi [`plans/finishing-pass-reference/build_base.py:8`](file:///Users/sabeqmmursyid/_cfstudio/plans/finishing-pass-reference/build_base.py#L8) juga membuktikan regex `(\d+)\.(?:mp3|mp4)$` wajib mengecualikan angka ekstensi (`3`/`4` pada `.mp3`/`.mp4`).
   - **Audit Duplikasi Hardcoded Template IDs (`R11`)**:
     - Daftar template saat ini masih tersebar di **5 lokasi terpisah**:
       1. [`lib/finishing-overlay-renderer.js:8-20`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js#L8-L20) (`resolveFinishingTemplatePath` `if/else` manual).
       2. [`lib/video-studio-processor.js:988`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L988) (`isRichTemplate = resolvedTemplate === 'calm_wellness' || resolvedTemplate === 'recipe_pop'`).
       3. [`lib/finishing-data-extractor.js:386-406`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js#L386-L406) (`suggestFinishingTemplate` masih memaksa default fallback `'calm_wellness'` untuk kategori umum di line 405!).
       4. [`app/settings/presets/page.js:1559-1561, 1596, 1613`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js#L1559-L1561) (`<option>` hardcoded).
       5. [`apps/mcp/tools.mjs:519, 591, 616, 674, 807`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L519) (`z.enum(['none', 'calm_wellness', 'recipe_pop'])`).
     - Diperbaiki menjadi satu registry terpusat [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) pada **Fase 2c-0**.
   - **Audit Kolom `brand_profiles` & Tier-3 Timing (`R12.1`–`R12.4`)**:
     - Kolom aktual `brand_profiles` saat ini (`dev`/`staging`/`public`): `id`, `brand_name`, `tone_of_voice`, `visual_signature`, `color_palette`, `forbidden_elements`, `brand_slogan_or_cta`, `raw_guideline_text`, `guideline_filename`, `created_at`, `storage_provider`, `nextcloud_target_folder`, `drive_target_folder`, `drive_glabs_folder_id`, `webhook_host`, `webhook_port`, `webhook_api_key`, `tenant_id`, `nextcloud_parent_folder`, `drive_parent_folder`, `editorial_brand_context`, `editorial_content_goal`, `editorial_content_pillars_json`. Belum memiliki field logo transparan, warna merek (`brand_color`), tagline, CTA default per platform, teks safety/disclaimer, nama presenter/tim, maupun lokasi opsional (`R12.1`).
     - [`lib/word-alignment-engine.js:145-230`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js#L145-L230) sudah memetakan jeda hening, namun logika fallback-nya belum menerapkan snap tanda baca (`, . ? ! :`) eksplisit dengan batas jarak `< 0.9s` seperti fungsi `derive()` pada [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html) (`R12.3`).
     - Untuk cacat teks render AI video (`opc_2107` klip 4 `"Solusi Tinemal ID mark"`), mekanisme tambal merek [`R12.4`] memakai input eksplisit `brandPatch` (`clipIndex` + area/gaya `x-patch`) tanpa OCR otomatis.

---

## Execution Task List (Tracker Resmi) — `(Revisi 02)`

> **Aturan Kontrol (`R5`, `R9`–`R13`)**: Kerjakan **satu fase/sub-fase per rilis** (`Fase 0 ✅ → Fase 1 ✅ → Fase 2 ✅ → Fase 2c-0 → Fase 2c-1 → Fase 2c-2 → Fase 2c-3 → Fase 2c-4 → Fase 2c-5 → Fase 2c-6 → Fase 3`). **Fase 2b dibatalkan (`R9`)**. Dilarang menggabungkan fase/sub-fase atau mencentang task sebelum verifikasi selesai.

### Tracker Fase 0 — Perbaikan Cepat Sharp/SVG + Safety Hook + Tier-3 Alignment `(Revisi 01)` (Target Rilis #1)
- [x] **F0-T1**: Pasang font OFL lokal (`Anton-Regular.ttf`, `Montserrat-Black.ttf`, `Montserrat-ExtraBold.ttf`, `Inter-Bold.ttf`) di `public/fonts/` + buat `public/fonts/fonts.conf` & [`lib/motion-font-loader.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-font-loader.js) (`FONTCONFIG_FILE`), verifikasi Sharp/librsvg merender Anton & Montserrat nyata.
- [x] **F0-T2 `(Revisi 01)`**: Perbarui [`lib/tts-text-sanitizer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js) (`sanitizeOverlayTextStrict`, `hasLeakedOverlayMarkup`), **DAN** pindahkan penambahan **`isHerbalMedicalClaimPhrase(text)` + resolver `isHerbalProduct` (`default true` bila kategori tidak dapat dipastikan)** di [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) ke **Fase 0** (sebelum Hook Card dirender).
- [x] **F0-T3 `(Revisi 01)`**: Perbarui [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) + [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) (**Tier 3 runtime saja, tanpa kolom DB**):
  - Gunakan FPS video target (bukan `15` fps).
  - Hitung word timing saat render dari **`ffmpeg silencedetect=noise=-35dB:d=0.08` + pembobotan `norm(w).length + 1.6` + split segmen di jendela hening dekat tanda baca**, lalu petakan ke timeline global (`clipStartInBaseVideo + wordStartInClip`).
  - Potong subtitle **2–4 kata** (`<= ~15` huruf atau putus di `[,.?!]$`), ukuran `6.6cqw`, Montserrat Black, stroke hitam tebal `0.55cqw`, QA guard markup wajib lulus.
  - Tambah **`fitHookCard(text, { isHerbalProduct })`**: buang `#Shorts`, blokir via `isHerbalMedicalClaimPhrase` jika `isHerbalProduct === true`, ukur lebar teks memakai metrik font Anton OFL nyata (maks `<= 88cqw`, skala turun l1 `13cqw -> 8cqw` & l2 `15cqw -> 10cqw`, maksimal **2 baris**, maks ~34 huruf), kembalikan `null` jika masih >2 baris atau terpotong. Prioritas Hook Fase 0: `custom_hook` / `yt_title` via `fitHookCard` → `null` (video mulai langsung dengan subtitle tanpa Hook Card paksaan).
- [x] **F0-T4**: Perbarui [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (`processTtsStudioMuxing()`):
  - Probe FPS video dasar (`getVideoStreamInfo`), pindahkan render overlay Sharp/SVG **setelah concat/xfade** di timeline global (hilangkan ghosting untuk campaign lama yang bernilai `'fade'`).
  - Render Hook Card `0`–`1.75s` hanya bila `fitHookCard(...) !== null`.
  - Terapkan `loudnorm=I=-14:TP=-1.0:LRA=11` di encode audio final.
- [x] **F0-T5 `(Revisi 01)`**: Ubah fallback default `video_transition` ke `'cut'` **khusus campaign baru & default preset baru** di [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2243), [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js#L147), [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js#L98), [`lib/custom-storyboard-pipeline.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js#L259), [`lib/recipe-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js#L121), [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L793), serta [`app/api/v2/recipes/autonomous-pipeline/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/autonomous-pipeline/route.js#L309); teruskan `hookTitle` dan `isHerbalProduct` dari [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) & [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) ke `processTtsStudioMuxing()`. (Pertahankan preset `recipe_campaign` / `multiplier_deconstruct_remix` jika user menginginkan tetap `'slideleft'` — atau konfirmasi sebelum rilis.)
- [x] **F0-T6 `(Revisi 01)`**: Verifikasi Fase 0: unit test `fitHookCard()` untuk `opc_2117` (mengembalikan `null`) & `mul_261113_qt67yl` (maks 2 baris atau `null`), regresi `<#1.0#>`, Tier-3 `silencedetect` grouping, render font Anton/Montserrat OFL nyata, `node --check`, `npm run build`, lalu deploy Staging & smoke test `opc_2117` (`9.12s`, `-13.62 LUFS`) + `mul_261113_qt67yl` (`9.34s`, `-13.39 LUFS`) (`-14 ± 1 LUFS`, contact sheet `0.5s`, zero ghosting, subtitle width guard <= `88%` canvas, sinkronisasi subtitle audio).
- [x] **F0-T7**: Jalankan rilis `npm run release-non-interactive` khusus **Fase 0** (`v2.44.4`).

### Tracker Fase 1 — DB Word Timestamps + `finishing_plan` + Renderer Playwright v1 `(Revisi 01)` (Target Rilis #2)
- [x] **F1-T1**: Tambah migration PostgreSQL (`dev`, `staging`, `public` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js)) dan helper [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js):
  - Kolom `tts_studio_clips.word_timings_json` & `tts_studio_clips.word_timings_source`.
  - Kolom `caption_mode` (`NULL` untuk campaign lama = fallback `'full'`, `'hybrid'` untuk baru), `finishing_template` (default `'none'`), dan `loudness_target` (default `-14`) pada `pillar_campaigns` & `re_campaigns` (plus kolom `video_transition`, `enable_motion_text`, `motion_text_style`, `motion_text_position` pada `re_campaigns` yang sebelumnya belum ada).
- [x] **F1-T2**: Perbarui [`lib/elevenlabs-tts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/elevenlabs-tts.js) ke `/v1/text-to-speech/{voice_id}/with-timestamps` dan lengkapi [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) untuk mendukung Tier 1 (ElevenLabs), Tier 2 (`whisper-cli` opsional jika tersedia di host), dan Tier 3 (`silencedetect`, sudah aktif dari Fase 0) serta **backfill on-demand** ke `tts_studio_clips.word_timings_json`.
- [x] **F1-T3**: Buat [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) (validasi substring persis VO bersih, maks 2 punch/klip, blokir klaim herbal pada punch & `finishing_plan.hook` via `isHerbalMedicalClaimPhrase`, gagal -> skip layer + warning tanpa menggagalkan render).
- [x] **F1-T4**: Tambah opsional `"finishing_plan"` pada schema output di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildMultiplierPhase2Prompt`, `buildOrganicPillarPrompt`, `buildReverseEngineeringPrompt`, `buildReverseEngineeringBridgePrompt`) tanpa mengubah bagian prompt lain; simpan hasil tervalidasi di worker. Prioritas sumber Hook mulai Fase 1: `finishing_plan.hook` → fallback `custom_hook`/`yt_title` via `fitHookCard` → `null`.
- [x] **F1-T5 `(Revisi 01)`**: Bangun modul renderer **Playwright HTML** [`lib/finishing-overlay-renderer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js) + template HTML v1 [`templates/finishing/base-caption.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/base-caption.html) (kontrak `window.loadTimeline(timelineJson)` & `window.renderAt(t)`, pure deterministic function tanpa `requestAnimationFrame`/CSS transitions/`Date.now()`, `@font-face` lokal, 1 browser per job yang selalu `close()` di `finally`) untuk Hook Card, Subtitle Hybrid (`2–4` kata, sembunyi saat punch aktif), Keyword Punch (`Anton 16cqw`, shrink hingga `11cqw`, warna per `type`), & Progress Bar (`0.9cqw`), lalu overlay ke `base.mp4` via ffmpeg + SFX `pop.wav` & `whoosh.wav` (`sidechaincompress` / mix teredam di bawah VO). Fallback otomatis ke renderer Sharp/SVG Fase 0 bila Playwright error. Log durasi **capture** dan **composite** per video. (Opsional UI: kontrol `caption_mode` di Campaign Detail.)
- [x] **F1-T6**: Verifikasi Fase 1 (unit test compliance herbal punch & hook blocker, invalid `finishing_plan` skip-layer, campaign lama `caption_mode` NULL -> `'full'`, fallback Playwright -> Sharp/SVG, akurasi punch ±0.15s di Staging `opc_2117` & `mul_261113_qt67yl`) → Rilis **Fase 1** (`v2.44.5`).

### Tracker Fase 2 — Ekstraktor Data + Template HTML Parameterized (`calm_wellness`, `recipe_pop`) + 3x Camera Zoompan + Preset Workflow `(Revisi 01)` (Target Rilis #3)
- [x] **F2-T1 `(Revisi 01)`**: Buat [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js) (hulu pra-FFmpeg, tanpa mengarang teks, terapkan guardrail `R6.3` & `R6.4`):
  - **Resep (`recipe_pop`)**: parse `📋 BAHAN-BAHAN:` / `👩‍🍳 LANGKAH PEMBUATAN:` (`re_multiplier_tasks.new_caption`, `recipe_items`, `pillar_campaign_items`). Maksimal **4 chip bahan** (`"+n bahan lain"` bila lebih), label `<= 22` karakter (potong batas kata + `…`), badge langkah `<= 16` karakter, support **3–8+ klip** dinamis. Jika resep kosong → `ingredients: []`, `steps: []`, slot disembunyikan.
  - **Produk (`ProductCard`)**: foto bersih + nama + deskripsi faktual + badge kategori produk/disclaimer terparameter (tidak hardcoded `"Pangan olahan, bukan obat"` / `"BPOM TR..."`; produk herbal membaca disclaimer standar, produk non-herbal memakai catatan faktual netral dari data produk).
  - **CTA platform**: dukung variasi label (`LINK DI BIO` / `CEK KERANJANG KUNING` / dari naskah).
  - **Template hint UI**: export `suggestFinishingTemplate(item)` (hanya hint UI, `product_hard_sell` di luar cakupan fase ini dan fallback ke `calm_wellness` / `'none'`).
- [x] **F2-T2 `(Revisi 01)`**: Buat [`lib/camera-motion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/camera-motion-engine.js) menggunakan **`ffmpeg` 3x upscale zoompan setelah concat** (sesuai `plans/finishing-pass-reference/compose.py`: `scale=2160:3840:flags=lanczos` → ekspresi `zoompan` `1.00 -> 1.045` per klip, goyang pembuka `0.35s`, punch-in `+0.07` pada tiap `punch.s`, output kembali ke `720:1280` / resolusi target), flash putih antar klip (`0.12s`), serta SFX `public/sfx/tick.wav`.
- [x] **F2-T3 `(Revisi 01)`**: Implementasikan template HTML **generik & terparameter penuh** di [`templates/finishing/calm-wellness.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/calm-wellness.html) dan [`templates/finishing/recipe-pop.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/recipe-pop.html) (**TIDAK menggunakan Sharp/SVG** untuk layer data):
  - Terapkan pemisahan 3 layer (`Template HTML`, `Brand/Video Config`, `Video Data`) — semua 11 item pada tabel **`R6.2`** diparameterisasi (zero hardcoded string merek/produk/resep).
  - Terapkan prioritas anti-tumpuk & TikTok/Reels safe zones **`R6.4`** (`Keyword Punch > Product Card / Step Badge > Save Prompt / Caption > Hook Card`, bebas top `10cqh`, bottom `82cqh`, kanan `>= 86cqw` untuk elemen utama).
- [x] **F2-T4 `(Revisi 01)`**: Tambahkan `finishing_template`, `caption_mode`, `loudness_target` pada **`preset.workflow`** di [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js), seluruh 7 jalur propagasi **`R8.3`** (termasuk MCP tools `cf_create_*` / `cf_*_preset` & DB `re_campaigns`), dan UI [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js) (ikuti SOP mockup HTML Staging & `app/theme.css`, plus peringatan hint bila preset `finishing_template` tidak cocok dengan `campaign_kinds`). Jangan simpan `accentColor`, teks label, CTA, maupun flag herbal di preset.
- [x] **F2-T5 `(Revisi 01)`**: Verifikasi Fase 2: unit test variasi **4 / 6 / 8 klip**, resep **8 bahan** (maks 4 chip + `"+4 bahan lain"`), resep kosong, grep `templates/finishing/` bersih dari string terlarang **`R6.6`**, test propagasi preset `override -> preset -> default`, build Next.js, deploy Staging, smoke test **`opc_2117`**, **`mul_261113_qt67yl`**, dan **minimal 1 video ke-3 dari akun/produk berbeda** (mis. `sasyahouse` / `nutribake` / `solusi thermal id`). Catat durasi capture + composite → Rilis **Fase 2**.

### Tracker Fase 2b — Batch Re-Finishing Video Lama `(Revisi 02)`
Fase 2b dibatalkan (Revisi 02, R9). Seluruh task `F2b-T1`–`F2b-T6`, [`lib/contentflow-refinish-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/contentflow-refinish-service.js), tool MCP `cf_refinish_content_flow`, kolom `content_flow_items.finishing_*`, helper download/copy Nextcloud batch, dan filter `finishing_status` di scheduler tidak dikerjakan (`R7` & `R8.6` gugur).

### Tracker Fase 2c-0 — Pengaman Urutan & Pasangan Klip (`R10`) + Registry Template Terpusat (`R11`) `(Revisi 02)` (Target Rilis #4 — Wajib Sebelum Template Baru)
- [x] **F2c0-T1 (`R10`)**: Tambahkan sort numerik defensif di seluruh pembacaan klip audio ([`lib/db.js:2029,2048`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2029), [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), [`lib/drive-sync-helper.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/drive-sync-helper.js), [`lib/nextcloud-sync-helper.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/nextcloud-sync-helper.js)) dan helper ekstraksi nomor klip aman dari nama file (`parseClipNumberFromPath` dengan regex mengecualikan ekstensi seperti `/(\d+)\.(?:mp3|mp4|wav|mov)$/i`).
- [x] **F2c0-T2 (`R10`)**: Tambahkan pre-check & safety guard pasangan klip di [`processTtsStudioMuxing()`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L860-L920):
  - Pastikan jumlah video == jumlah klip TTS == jumlah naskah VO.
  - Jika path video/audio mencantumkan nomor klip (`clip_01`, `scene_c01`, `vo_c01`, dll.), cocokkan pasangan indeks klip sebelum muxing.
  - Verifikasi durasi audio terukur (`getMediaDuration`) terhadap metadata durasi TTS dalam toleransi `±0.3s` bila tersedia.
  - **Aturan Fail-Safe (`R10`)**: bila ditemukan ketidakcocokan apa pun, **batalkan tahap finishing pass (lanjut render base video tanpa finishing + catat log warning detail pasangan mana yang tidak cocok)** — jangan pernah membiarkan video ter-render dengan subtitle salah klip dan jangan gagal total.
- [x] **F2c0-T3 (`R11`)**: Buat satu registry terpusat [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) sebagai single source of truth (`id`, `file`, `label`, `description`, `layers`, `finishingPlanFields`, `suggestFor`, `compliance`), lalu ubah seluruh konsumen agar membaca langsung dari registry tanpa daftar hardcoded:
  - [`lib/finishing-overlay-renderer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js) (`resolveFinishingTemplatePath`)
  - [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L988) (`isRichTemplate` / layer routing)
  - [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js#L386-L406) (`suggestFinishingTemplate` diperbaiki: kembalikan `null` jika tidak ada template yang cocok, tidak lagi fallback paksa ke `'calm_wellness'`)
  - [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js#L1559) (opsi `<select>` & hint dinamis dari registry)
  - [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L519) (`z.enum(TEMPLATE_IDS)` dinamis)
- [x] **F2c0-T4 (`R10`, `R11`)**: Unit test lengkap untuk 10+ klip (`*_audio_clip_01.mp3`, `*_audio_clip_11.mp3`, `*_audio_clip_21.mp3`, `*_video_clip_1.mp4`..`10.mp4`, `*_scene_c01.mp4`, `*_vo_c01.mp3`), mismatch trigger skip finishing (render sukses tanpa finishing), test menambah 1 entri dummy ke [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) otomatis muncul di UI presets & MCP schema tanpa menyentuh file lain, `npm run build` → Rilis **Fase 2c-0** (`1` rilis).

### Tracker Fase 2c-1 — Shared Brand Layers (`R12.1`), Speech-Interval Timing (`R12.3`), & Brand Patch (`R12.4`) `(Revisi 02)` (Target Rilis #5)
- [x] **F2c1-T1 (`R12.1`)**: Tambah kolom/field Brand Profile di `brand_profiles` ([`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js), [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js), API & UI Brand Settings jika diperlukan): `logo_url` (logo transparan), `brand_color` (aksen merek), `brand_tagline`, `default_cta_tiktok`, `default_cta_facebook`, `default_cta_youtube`, `safety_notice_text` (disclaimer), `presenter_name`, `presenter_role`, `brand_location` (opsional), + teruskan ke `timeline.brand` dari `resolvePreRenderFinishingMeta`.
- [x] **F2c1-T2 (`R12.1`, `R12.4`)**: Buat modul shared HTML/CSS/JS [`templates/finishing/shared-layers.js`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/shared-layers.js) & token CSS bersama untuk `x-wm` (watermark pojok), `x-end` (brand end card 1.5–2s), `x-lower` (lower-third nama/peran tim/presenter), `x-patch` (patch penutup teks AI rusak seperti `opc_2107` klip 4 via parameter eksplisit operator/`finishing_plan` per klip & area, bukan OCR otomatis), serta tabel label terlokalisasi (`target_language`: `'id'` / `'en'`, misal `BEFORE`/`AFTER` atau `MYTH`/`FACT` vs `SEBELUM`/`SESUDAH` atau `MITOS`/`FAKTA` mengikuti [`USULAN_TEMPLATE_FINISHING_TAMBAHAN.md`](file:///Users/sabeqmmursyid/_cfstudio/USULAN_TEMPLATE_FINISHING_TAMBAHAN.md) & [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html)). Catatan audit `R6.6`: nol hardcoded string merek/produk di `templates/finishing/`.
- [x] **F2c1-T3 (`R12.3`)**: Perbarui fallback Tier 3 pada [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) agar menyelaraskan algoritma `derive()` dari [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html): distribusi bobot kata hanya di atas interval bicara aktif `sp` (`silencedetect`, skip segmen hening), serta snap batas kalimat/klausa (`,`, `.`, `?`, `!`, `:`) ke jeda hening terdekat bila jaraknya `< 0.9s`. Pertahankan Tier 1 & Tier 2 tetap prioritas pertama.
- [x] **F2c1-T4**: Verifikasi Fase 2c-1: unit test shared layers (`x-wm`, `x-end`, `x-lower`, `x-patch`, label `id`/`en`), unit test Tier 3 speech-interval + `< 0.9s` punctuation snap, uji regresi memastikan output `calm_wellness` & `recipe_pop` tetap identik saat tidak memakai shared extensions, `npm run build` → Rilis **Fase 2c-1** (`1` rilis).

### Tracker Fase 2c-2 — Template #1 `tips_listicle` (Sasyahouse) `(Revisi 02)` (Target Rilis #6)
- [x] **F2c2-T1 (`R12.1`, `R12.2`)**: Tambah [`templates/finishing/tips-listicle.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/tips-listicle.html) (`x-tip` slide-in kiri bawah bebas safe zone, `x-recap` daftar poin di akhir video, `x-loc` label lokasi opsional, `x-end`, punch aksen maksimal 10% kata).
- [x] **F2c2-T2 (`R12.2`)**: Tambah dukungan `finishing_plan.tips` & `finishing_plan.punch_display` di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (**khusus preset yang memakai template `tips_listicle`**) + validator `tips` (≤6 kata per tip) & `R6.6` guard di [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) + daftarkan di [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js).
- [ ] **F2c2-T3 (`R12.5`)**: Verifikasi Fase 2c-2: unit test validator (`tips` valid + `tips` invalid diskip aman), regresi `calm_wellness`/`recipe_pop`, `R6.6` grep bersih, deploy Staging, render video Sasyahouse nyata, contact sheet `0.5s` vs tab `Tips` mockup v3, dan cek sinkronisasi audio manual ≥5 titik (`±0.2s`) → Rilis **Fase 2c-2** (`1` rilis).

### Tracker Fase 2c-3 — Template #2 `ramuan_ritual` (Siasat Sehat, Nutriblend, Dapur Botani Herbal) `(Revisi 02)` (Target Rilis #7)
- [ ] **F2c3-T1 (`R12.1`, `R12.2`)**: Tambah [`templates/finishing/ramuan-ritual.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/ramuan-ritual.html) (`x-time` timing badges mis. `SEBELUM TIDUR`/`PAGI PERUT KOSONG`/`DIAMKAN ...`, chip bahan + takaran faktual dari `new_caption`/VO, `ProductCard` opsional non-klaim, disclaimer wajib `x-notice`, dan `x-end`).
- [ ] **F2c3-T2 (`R12.2`, `R12.1`)**: Tambah dukungan `finishing_plan.timing_badges` (**khusus preset `ramuan_ritual`**) di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) & [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js); aktifkan **strictest claim block pada hook & punch template ini terlepas dari `category` produk** (blokir: `lemak`, `metabolisme`, `detoks`, `ginjal`, `gula darah`, `kolesterol`, `visceral`, dll. via `isHerbalMedicalClaimPhrase`), lalu daftarkan di registry.
- [ ] **F2c3-T3 (`R12.5`)**: Verifikasi Fase 2c-3: unit test strict claim block pada `ramuan_ritual` meskipun `isHerbalProduct=false` + test `timing_badges` invalid diskip, `R6.6` grep bersih, regresi `calm_wellness`/`recipe_pop`, deploy Staging & render video akun herbal nyata + contact sheet `0.5s` + cek sinkronisasi ≥5 titik (`±0.2s`) → Rilis **Fase 2c-3** (`1` rilis).

### Tracker Fase 2c-4 — Template #3 `problem_solution` (Ruang Akustik ID) `(Revisi 02)` (Target Rilis #8)
- [ ] **F2c4-T1 (`R12.1`, `R12.2`)**: Tambah [`templates/finishing/problem-solution.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/problem-solution.html) (`x-chapter` pill fase `MASALAH`/`PENYEBAB`/`SOLUSI`/`HASIL` + `x-chapter-track`, `x-callout` label titik masalah dengan leader line, `x-lower` presenter, CTA konsultasi dari brand profile, `x-end`).
- [ ] **F2c4-T2 (`R12.2`)**: Tambah `finishing_plan.chapters` & `finishing_plan.callouts` (**khusus preset `problem_solution`**) di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) & validator skip-layer di [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) + daftarkan di registry.
- [ ] **F2c4-T3 (`R12.5`)**: Verifikasi Fase 2c-4: unit test `chapters`/`callouts` + regresi `calm_wellness`/`recipe_pop` + `R6.6` grep bersih, deploy Staging, render video Ruang Akustik ID nyata + contact sheet `0.5s` vs tab `Problem -> Solusi` mockup v3 + cek sinkronisasi ≥5 titik (`±0.2s`) → Rilis **Fase 2c-4** (`1` rilis).

### Tracker Fase 2c-5 — Template #4 `angka_banding` (Solusi Thermal ID) `(Revisi 02)` (Target Rilis #9)
- [ ] **F2c5-T1 (`R12.1`, `R12.2`)**: Tambah [`templates/finishing/angka-banding.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/angka-banding.html) (counter/meter angka hanya jika angka nyata terdeteksi di VO atau data produk — dilarang mengarang metrik/dB/persen/°C; `x-compare` split card kiri vs kanan, `x-chips` + foot label, CTA daftar harga, `x-patch` eksplisit, `x-end`).
- [ ] **F2c5-T2 (`R12.2`)**: Tambah `finishing_plan.compare` & `finishing_plan.numbers` (**khusus preset `angka_banding`**) dengan guard ketat anti-angka palsu (verifikasi angka benar-benar ada di VO bersih atau data produk) di [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) + `lib/prompts.js` + daftarkan di registry.
- [ ] **F2c5-T3 (`R12.5`)**: Verifikasi Fase 2c-5: unit test penolakan angka/klaim fiktif (`numbers` tanpa dasar di VO/produk ditolak & diskip) + regresi `calm_wellness`/`recipe_pop` + `R6.6` grep bersih, deploy Staging, render video Solusi Thermal ID nyata + contact sheet `0.5s` vs tab `Angka & Banding` mockup v3 + cek sinkronisasi ≥5 titik (`±0.2s`) → Rilis **Fase 2c-5** (`1` rilis).

### Tracker Fase 2c-6 — Template #5 `mitos_fakta` (Siasat Sehat, Dapur Botani, Ruang Akustik ID) `(Revisi 02)` (Target Rilis #10)
- [ ] **F2c6-T1 (`R12.1`, `R12.2`)**: Tambah [`templates/finishing/mitos-fakta.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/mitos-fakta.html) (hook pertanyaan `hook.question`, stempel `x-stamp` `MITOS ❌` / `FAKTA ✅` atau i18n sesuai `target_language`, bar alasan `KENAPA?`, CTA + `x-end`).
- [ ] **F2c6-T2 (`R12.2`)**: Tambah `finishing_plan.myth_fact` (**khusus preset `mitos_fakta`**) di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) & validator [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) (**klaim kesehatan di `FAKTA` wajib lulus `isHerbalMedicalClaimPhrase`** — tidak boleh lolos sebagai penjelasan alasan) + daftarkan di registry.
- [ ] **F2c6-T3 (`R12.5`)**: Verifikasi Fase 2c-6: unit test `myth_fact` & compliance claim block pada `FAKTA` + regresi `calm_wellness`/`recipe_pop` + `R6.6` grep bersih, deploy Staging, render video akun nyata + contact sheet `0.5s` vs tab `Mitos vs Fakta` mockup v3 + cek sinkronisasi ≥5 titik (`±0.2s`) → Rilis **Fase 2c-6** (`1` rilis).

### Tracker Fase 3 — Preview UI Seluruh 7 Template + Pengukuran Performa + Finalisasi `(Revisi 02)` (Target Rilis #11, Setelah Fase 2c)
- [ ] **F3-T1 `(Revisi 02)`**: Finalisasi ke-7 template HTML terdaftar di [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) (`calm_wellness`, `recipe_pop`, `tips_listicle`, `ramuan_ritual`, `problem_solution`, `angka_banding`, `mitos_fakta`) dengan audit konsistensi token visual, bahasa (`id`/`en`), dan TikTok/Reels safe zones (`R6.2`–`R6.4`). **Tidak membangun jalur Remotion `FinishingPass.jsx` kecuali laporan benchmark membuktikan kebutuhan.**
- [ ] **F3-T2 `(Revisi 02)`**: Buat komponen **UI Live Preview** di halaman Campaign Detail ([`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js)) / Preset ([`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js)) yang membaca daftar dari registry untuk memuat **seluruh 7 template HTML** secara langsung (via iframe terisolasi memanggil `loadTimeline()` + scrubber `renderAt(t)`), lengkap dengan override form `finishing_template`, `caption_mode`, `loudness_target` pada detail campaign (dibuatkan mockup HTML Staging & pakai token `app/theme.css` terlebih dahulu).
- [ ] **F3-T3 `(Revisi 02)`**: Audit performa menyeluruh pada Staging Mac Mini mencakup **ketujuh template** (terutama template terberat: **`tips_listicle` dengan recap** dan **`problem_solution` dengan callout** pada sampel 4, 6, dan 8 klip / ~24s, ~36s, ~48s).
  - **Aturan Keputusan (`R3.3`)**: Jika rata-rata render finishing > **3× durasi video**, laporkan hasil benchmark & usulan Remotion/optimasi ke user terlebih dahulu sebelum menulis kode Remotion apa pun.
- [ ] **F3-T4 `(Revisi 02)`**: Verifikasi Fase 3 (`npm run build`, smoke test UI preview seluruh 7 template + override + benchmark durasi render multi-template + audit LUFS `-14 ± 1`) → Rilis **Fase 3**.

---

## Rincian Perubahan Kode (Code Sebelum & Code Sesudah per Fase)

---

### FASE 0 — Code Sebelum & Code Sesudah `(Revisi 01)`

#### 1. [`lib/tts-text-sanitizer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js) (QA Guard Pre-Render)
**Code Sebelum (`lib/tts-text-sanitizer.js:28-36` pada HEAD `v2.44.3`):**
```js
export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```
**Code Sesudah:**
```js
const ESCAPED_MINIMAX_PAUSE_TAG_RE = /&lt;#\s*\d+(?:\.\d+)?s?\s*#&gt;/gi;
const RESIDUAL_ANGLE_HASH_TAG_RE = /<#|#>|&lt;#|#&gt;|‹#|#›/gi;
const SQUARE_BRACKET_STAGE_NOTE_RE = /\[[^\]\n]{1,60}\]/g;

export function hasLeakedOverlayMarkup(text) {
  if (typeof text !== 'string' || !text) return false;
  return (
    /<#|#>|&lt;#|#&gt;|\[|\]/i.test(text) ||
    new RegExp(MINIMAX_INTERJECTION_TAG_RE.source, 'i').test(text)
  );
}

export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(ESCAPED_MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeOverlayTextStrict(text) {
  const base = stripTtsMarkupTags(String(text || ''));
  return base
    .replace(RESIDUAL_ANGLE_HASH_TAG_RE, ' ')
    .replace(SQUARE_BRACKET_STAGE_NOTE_RE, ' ')
    .replace(/[[\]]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

#### 2. [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) (`(Revisi 01)`: Dipindah ke Fase 0!)
**Code Sebelum (`lib/tiktok-compliance-service.js:9-20`):**
```js
const FORBIDDEN_LEXICON_BLOCKERS = [
  { pattern: /menyembuhkan/i, category: 'Hard Block: Disease Cure', risk: 'HIGH', suggestion: 'Ganti dengan "membantu menjaga kesehatan"' },
  { pattern: /mengobati/i, category: 'Hard Block: Disease Treatment', risk: 'HIGH', suggestion: 'Ganti dengan "mendukung pemulihan tubuh"' },
  ...
  { pattern: /menurunkan\s+kolesterol|menurunkan\s+gula\s+darah|mencegah\s+kanker|mengatasi\s+diabetes|menghilangkan\s+nyeri\s+sendi/i, ... }
];
```
**Code Sesudah (`(Revisi 01)`):**
```js
const HERBAL_MEDICAL_CLAIM_TOKENS_RE = /\b(kolesterol|kolestrol|jantung|gula\s+darah|diabetes|diabet|hipertensi|darah\s+tinggi|asam\s+urat|kanker|tumor|stroke|wasir|ambeien|maag|lambung\s+akut|obat|mengobati|menyembuhkan|terapi\s+penyakit|diagnosa|resep\s+dokter)\b/i;

export function isHerbalMedicalClaimPhrase(text) {
  if (!text || typeof text !== 'string') return false;
  return HERBAL_MEDICAL_CLAIM_TOKENS_RE.test(text);
}

export function resolveIsHerbalProduct({ category = '', tags = '', productName = '', isHerbalExplicit = null } = {}) {
  if (typeof isHerbalExplicit === 'boolean') return isHerbalExplicit;
  const raw = `${category} ${tags} ${productName}`.trim();
  // R1.4: Jika kategori/identitas produk tidak tersedia, default konservatif TRUE
  if (!raw) return true;
  if (/herbal|jamu|suplemen|madu|minyak\s+balur|essential|kesehatan|wellness|rempah|apotek|sehat/i.test(raw)) return true;
  if (/peralatan\s+dapur|baking|cookware|alat\s+masak|panci|wajan|cetakan|pisau|elektronik/i.test(raw)) return false;
  return true;
}
```

#### 3. `public/fonts/` + [`lib/motion-font-loader.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-font-loader.js)
- Font OFL lokal (`Anton-Regular.ttf`, `Montserrat-Black.ttf`, `Montserrat-ExtraBold.ttf`, `Inter-Bold.ttf`) + generator `fonts.conf` absolut + loader `FONTCONFIG_FILE` sebelum `sharp()` memproses SVG.

#### 4. [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) — **Tier 3 Aktif Sejak Fase 0 `(Revisi 01)`**
- Modul baru yang di Fase 0 dijalankan langsung pada runtime `processTtsStudioMuxing()` (tanpa butuh kolom DB dulu):
  - Ekstrak interval hening (`silence_start`, `silence_end`) via `ffmpeg -i <clipAudio> -af silencedetect=noise=-35dB:d=0.08 -f null -`.
  - Pecah teks klip bersih di tanda baca bila ada jeda hening yang bersesuaian, lalu bagi durasi segmen bicara berdasarkan bobot **`norm(w).length + 1.6`** (`norm = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')`, identik dengan `plans/finishing-pass-reference/overlay.html`).
  - Kembalikan array `[{ w, s, e, clipIndex }]` yang kemudian digeser ke timeline global (`clipOffsetInBase + word.s`).

#### 5. [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) — **Termasuk `fitHookCard` & Chunk 2–4 Kata `(Revisi 01)`**
**Code Sebelum (`lib/motion-text-engine.js:1-106` pada HEAD `v2.44.3`):**
```js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { stripTtsMarkupTags } from './tts-text-sanitizer.js';
...
export async function generateMotionTextFrames(options) {
  const {
    outputDir, text = '', role = 'story', style = 'floating_white_yellow',
    effect = 'typewriter', videoWidth = 1080, videoHeight = 1920,
    duration = 5.0, fps = 15, tag = 'HOOK', brand = '', position = 'bottom'
  } = options;
  ...
  const cleanText = stripTtsMarkupTags(text);
  ...
  const speechDuration = Math.max(duration * 0.75, 1.2);
  const totalFrames = Math.max(Math.round(speechDuration * fps), 15);
  const fontSize = Math.round(overlayWidth * (style === 'minimal_white' ? 0.038 : 0.048));
```
**Code Sesudah (`(Revisi 01)`):**
- Tambah `chunkCaptionWords(words)`: pecah per **2–4 kata** (`[,.?!]$`, `>=4` kata, atau `>=2` kata & `>15` huruf, atau pindah klip).
- Tambah **`fitHookCard(rawText, { isHerbalProduct = true, width = 720, height = 1280 })`**:
  1. Bersihkan markup + buang `#Shorts`. Jika kosong → `null`.
  2. Jika `isHerbalProduct && isHerbalMedicalClaimPhrase(cleaned)` → kembalikan **`null`** (diblokir).
  3. Ukur lebar piksel menggunakan **metrik font Anton OFL nyata** (`canvas` / Sharp SVG bbox atau Chromium Playwright measureText satu kali) pada maksimal **2 baris** dengan batas lebar **88cqw**: coba skala ukuran line 1 (`13cqw -> 8cqw`) dan line 2 (`15cqw -> 10cqw`). Jika tetap >2 baris atau >~34 karakter / tidak muat di `88cqw` pada ukuran minimum → kembalikan **`null`** (skip Hook Card).
- Tambah `renderGlobalSubtitleAndHookOverlay(...)` berbasis Sharp/SVG (juga menjadi fallback permanen untuk Fase 1+): ukuran subtitle `6.6cqw`, Montserrat Black, stroke `0.55cqw * 2`, FPS sama dengan video dasar (`fps`), dipetakan ke word timings dari Tier 3 `word-alignment-engine.js`, dengan QA guard `sanitizeOverlayTextStrict` + `hasLeakedOverlayMarkup`.

#### 6. [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (`loudnorm`, Pasca-Concat Global Timeline, Hook Guard)
**Code Sebelum (`lib/video-studio-processor.js:604-890`):**
- Merender motion text overlay per klip *sebelum* concat/xfade (`15` fps), lalu encode final tanpa `loudnorm`.
**Code Sesudah (`(Revisi 01)`):**
- Mux video+audio tiap klip bersih (tanpa teks), lalu concat/xfade menjadi `baseVideoPath` + catat waktu mulai absolut masing-masing klip di `baseVideoPath` (memperhitungkan overlap `xfade` untuk campaign lama).
- Probe FPS aktual `baseVideoPath`, jalankan Tier 3 `alignClipWords` pada tiap audio klip, konversi ke timeline global.
- Jika `fitHookCard(hookTitle, { isHerbalProduct })` mengembalikan hasil valid → overlay statis `0..1.75s` (bila `null`, lewati Hook Card dan mulai video langsung dengan subtitle).
- Encode final wajib dengan `loudnorm=I=-14:TP=-1.0:LRA=11` + `-ar 48000 -ac 2 -b:a 192k -movflags +faststart`.

#### 7. Default `video_transition: 'cut'` & Teruskan `hookTitle` / `isHerbalProduct` `(Revisi 01)`
**Lokasi `Code Sebelum` pada HEAD `v2.44.3`:**
- [`lib/db.js:2243`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2243): `video_transition: campaign.video_transition || 'fade',`
- [`lib/autonomous-engine.js:147,187,258,568,778,897`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js#L147): fallback `'fade'`
- [`lib/operator-presets.js:98,180,474`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js#L98): `video_transition: 'fade'` (sedangkan `recipe_campaign:262` & `multiplier_deconstruct_remix:344` bernilai `'slideleft'`)
- [`lib/custom-storyboard-pipeline.js:259`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js#L259), [`lib/recipe-campaign-ingest.js:121`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js#L121), [`apps/mcp/tools.mjs:793`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L793), [`app/api/v2/recipes/autonomous-pipeline/route.js:309`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/autonomous-pipeline/route.js#L309): fallback `'fade'`.
- [`lib/scheduler-processors.js:3088,4164,7441,8888`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L7441) & [`lib/re-multiplier-worker.js:1310`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L1310): belum meneruskan `hookTitle` / `isHerbalProduct`.

**Code Sesudah (`(Revisi 01)`):**
- Ubah fallback default `video_transition` untuk campaign baru & preset non-slide menjadi `'cut'` (campaign lama yang sudah menyimpan `'fade'` atau `'slideleft'` di DB tetap dihormati dan tidak ghosting).
- Teruskan `hookTitle` + `isHerbalProduct` (`resolveIsHerbalProduct(...)`) dari worker OPC/RE/Multiplier ke `processTtsStudioMuxing()`.

---

### FASE 1 — Code Sebelum & Code Sesudah `(Revisi 01)`

#### 1. [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) & [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js)
- Tambah kolom idempoten (`dev`, `staging`, `public`):
  - `tts_studio_clips`: `word_timings_json TEXT`, `word_timings_source TEXT`
  - `pillar_campaigns`: `caption_mode TEXT`, `finishing_template TEXT DEFAULT 'none'`, `loudness_target DOUBLE PRECISION DEFAULT -14`
  - `re_campaigns`: `caption_mode TEXT`, `finishing_template TEXT DEFAULT 'none'`, `loudness_target DOUBLE PRECISION DEFAULT -14`, serta kolom yang belum ada di `re_campaigns`: `enable_motion_text INTEGER DEFAULT 1`, `motion_text_style TEXT DEFAULT 'floating_white_yellow'`, `motion_text_position TEXT DEFAULT 'bottom'`, `video_transition TEXT DEFAULT 'cut'`, `transition_duration DOUBLE PRECISION DEFAULT 0.5`.
- Campaign baru memakai `caption_mode = 'hybrid'`; campaign lama (`caption_mode IS NULL`) tetap berperilaku `'full'`.

#### 2. [`lib/elevenlabs-tts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/elevenlabs-tts.js) & [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js)
- Endpoint ElevenLabs `/v1/text-to-speech/${voiceId}/with-timestamps` (konversi `alignment.characters` + `character_start_times_seconds` + `character_end_times_seconds` ke kata `[{ w, s, e }]`, fallback mulus ke endpoint biasa bila error/non-JSON).
- `alignClipWords()` merutekan Tier 1 (ElevenLabs) → Tier 2 (`whisper-cli` bila tersedia) → Tier 3 (`silencedetect` dari Fase 0) + backfill on-demand ke `tts_studio_clips.word_timings_json`.

#### 3. [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) & [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js)
- Tambah `"finishing_plan"` opsional di schema output: `buildReverseEngineeringPrompt` ([`lib/prompts.js:1208-1220`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L1208)), `buildReverseEngineeringBridgePrompt` ([`lib/prompts.js:1600-1623`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L1600)), `buildOrganicPillarPrompt` ([`lib/prompts.js:3006-3013`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L3006)), dan `buildMultiplierPhase2Prompt` ([`lib/prompts.js:3835-3845`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L3835)) **tanpa menyentuh prompt utama storyboard**.
- Validasi ketat `validateFinishingPlan`: substring persis VO bersih, maks 2 punch/klip, blokir `isHerbalMedicalClaimPhrase` pada punch & `finishing_plan.hook`, gagal -> skip layer + warning.

#### 4. [`lib/finishing-overlay-renderer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js) & [`templates/finishing/base-caption.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/base-caption.html) — **Renderer Playwright HTML `(Revisi 01)`**
- **Menggantikan Sharp/SVG** mulai Fase 1 untuk overlay timeline:
  - HTML template transparan (`background: transparent`) dengan `@font-face` lokal (`Anton`, `Montserrat`, `Inter`), mengimplementasikan kontrak wajib **`window.loadTimeline(json)`** dan **`window.renderAt(t)`** (pure function dari `t`, zero `requestAnimationFrame`, zero CSS `transition`/`animation`, zero `Date.now()`).
  - [`lib/finishing-overlay-renderer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js) membuka **1 Playwright Chromium instance per job**, membuka 1 page (`720x1280` atau ukuran video), menunggu `document.fonts.ready`, melakukan loop `renderAt(t)` per frame video, capture PNG transparan (`omitBackground: true`), dan **wajib menutup `browser.close()` di blok `finally`**.
  - Menangani Hook Card (prioritas: `finishing_plan.hook` → fallback `fitHookCard(custom_hook / yt_title)` → `null`), Subtitle Hybrid (`caption_mode: 'hybrid' | 'keyword_only' | 'full'`), Keyword Punch (`16cqw -> 11cqw` shrink), Progress Bar (`0.9cqw`), dan pencampuran SFX `pop.wav` + `whoosh.wav` via ffmpeg `adelay`.
  - **Fallback**: bila Playwright gagal di runtime, catat warning dan otomatis fallback ke renderer Sharp/SVG Fase 0 agar job tidak gagal. Log durasi **capture Playwright** dan **composite ffmpeg** per video.

---

### FASE 2 — Code Sebelum & Code Sesudah `(Revisi 01)`

#### 1. [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js) — **Ekstraktor Hulu + Guardrail `R6.3` & `R6.5` `(Revisi 01)`**
- Mengekstrak bahan & langkah resep nyata dari `new_caption` / `recipe_items` / `pillar_campaign_items` tanpa mengarang kata:
  - Potong maksimal **4 chip** di `IngredientStack` (jika >4, tampilkan 3–4 chip + badge `"+n bahan lain"`), label chip `<= 22` karakter (potong batas kata + `…`), step badge `<= 16` karakter, support **3–8+ klip** secara dinamis; bila resep kosong, hasilkan `ingredients: []`, `steps: []` dan sembunyikan slot.
  - Siapkan `productCard` dari data produk nyata + disclaimer terparameter.
  - Sediakan `suggestFinishingTemplate(item)` sebagai **UI hint** (`product_hard_sell` di luar cakupan, fallback `calm_wellness` / `'none'`).

#### 2. [`lib/camera-motion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/camera-motion-engine.js) — **3x Upscale Zoompan + Flash `(Revisi 01)`**
- Diubah dari crop/zoompan mentah menjadi **3x upscale `zoompan` pasca-concat** (mengikuti [`plans/finishing-pass-reference/compose.py`](file:///Users/sabeqmmursyid/_cfstudio/plans/finishing-pass-reference/compose.py)):
  - Scale `base.mp4` ke `2160x3840:flags=lanczos` → `zoompan` (`1.00 -> 1.045` per klip + shake pembuka `0.35s` + punch-in `+0.07` pada timestamp `punch.s`) → hasil `720x1280` → flash putih `0.12s` di cut + SFX `tick.wav`.

#### 3. [`templates/finishing/calm-wellness.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/calm-wellness.html) & [`templates/finishing/recipe-pop.html`](file:///Users/sabeqmmursyid/_cfstudio/templates/finishing/recipe-pop.html) — **Template HTML Generik & Terparameter `(Revisi 01)`**
- Implementasi penuh seluruh layer (`IngredientStack`, `StepBadge`, `SavePrompt`, `ProductCard`, `CtaArrow`, plus layer Fase 1) dalam HTML/CSS Playwright (**bukan Sharp/SVG**), mematuhi pemisahan 3 layer & `R6.2`:

| Nilai Referensi `overlay.html` (`R6.2`) | Sumber / Parameter Konfigurasi Baru |
|---|---|
| `#f2b632` (aksen highlight & progress bar) | `timeline.config.accentColor` (dari brand/video config; default fallback netral per template) |
| `#fff066` (kata aktif subtitle) | `timeline.config.activeWordColor` (fallback `#fff066`) |
| `"Minyak Balur Herbal"` (nama produk) | `timeline.productCard.name` (dari `product_extractions` / `nama_produk`) |
| `"Botol Kaca 100ml · BPOM TR..."` | `timeline.productCard.specLine` (fakta produk nyata dari katalog/deskripsi, kosong bila tak ada) |
| `"Pangan olahan, bukan obat"` | `timeline.productCard.disclaimer` (diisi hanya bila `isHerbalProduct === true` atau aturan kategori) |
| `"LINK DI BIO"` / CTA arrow | `timeline.cta.text` & `timeline.cta.arrowDir` (dari platform target `cta_tiktok` / `cta_facebook` / config) |
| `"Bahan & racikan lengkap ada di caption ⬇️"` | `timeline.savePrompt.subtitleText` (terparameter; bila tak ada resep, sesuaikan konteks) |
| `"Simpan & Bagikan Resep Ini"` | `timeline.savePrompt.titleText` |
| Badge `"BAHAN 4/4"` & `"LANGKAH 4/4"` | `BAHAN ${i}/${total}`, `LANGKAH ${i}/${total}` dinamis untuk **3–8+ klip** & **N bahan** |
| `#d8a648` (dot bahan ✓) | `timeline.config.accentColor` / token CSS turunan `--accent-soft` |
| Font family | Parameter CSS `--font-display`, `--font-body` memakai `@font-face` lokal OFL |

- Terapkan prioritas anti-tumpuk & safe zone TikTok/Reels (`R6.4`): `Keyword Punch > Product Card / Step Badge > Save Prompt / Caption > Hook Card`, di luar top `<= 10cqh`, bottom `>= 82cqh`, dan kanan `>= 86cqw`.

#### 4. [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js), [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js), & 7 Jalur Propagasi `R8.3` `(Revisi 01)`
- Tambah pada `preset.workflow` seluruh 5 preset bawaan:
  - `finishing_template`: `'none'` (default aman untuk preset existing, `'none' | 'calm_wellness' | 'recipe_pop'`),
  - `caption_mode`: `'hybrid'` (untuk preset video aktif; `'full'` tetap menjadi fallback kompatibilitas campaign lama yang NULL),
  - `loudness_target`: `-14`.
- Propagasi berjenjang `override -> preset -> default` pada ke-7 jalur `R8.3`: `operator-presets.js`, `autonomous-engine.js`, `auto-pipeline-scheduler-runner.js`, `custom-storyboard-pipeline.js` + `recipe-campaign-ingest.js`, `apps/mcp/tools.mjs` (`cf_create_product_video`, `cf_create_editorial_video`, `cf_create_recipe_video`, `cf_create_multiplier_video`, `cf_submit_custom_storyboard`), `app/settings/presets/page.js` (mockup HTML terlebih dahulu + token `app/theme.css` + peringatan hint bila template tak sesuai `campaign_kinds`), dan campaign workers/storage (`pillar_campaigns`, `re_campaigns`).
- **Dilarang** menyimpan `accentColor`, teks label, CTA, atau `isHerbalProduct` di `preset.workflow`.

---

### FASE 2b — DIBATALKAN `(Revisi 02, R9)`

> **Fase 2b dibatalkan (Revisi 02, R9).** `R7` dan `R8.6` sudah tidak berlaku; tidak ada migrasi `content_flow_items.finishing_*`, tidak ada `lib/contentflow-refinish-service.js`, dan tidak ada `cf_refinish_content_flow`.

---

### FASE 2c-0 — Code Sebelum & Code Sesudah `(Revisi 02)` — Pengaman Urutan Klip (`R10`) + Registry Template Terpusat (`R11`)

#### 1. Pengaman Urutan & Pasangan Klip di [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) & Kueri Klip
**Code Sebelum (`lib/video-studio-processor.js:879-890`):**
```js
  const completedClips = batchData.clips.filter(c => c.status === 'completed');
  if (completedClips.length === 0) {
    throw new Error(`Batch TTS Studio '${batchId}' tidak memiliki klip berstatus 'completed'.`);
  }

  if (videoPaths.length !== completedClips.length) {
    throw new Error(`Jumlah video (${videoPaths.length}) tidak sama dengan audio TTS (${completedClips.length}) untuk batch '${batchId}'.`);
  }
  const pairCount = videoPaths.length;
```
**Code Sesudah (`(Revisi 02, R10)`):**
- Sort numerik eksplisit di JS & kueri DB (`completedClips.sort((a, b) => Number(a.clip_index) - Number(b.clip_index))`, ditambah `ORDER BY clip_index ASC` di [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), [`lib/drive-sync-helper.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/drive-sync-helper.js), [`lib/nextcloud-sync-helper.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/nextcloud-sync-helper.js)).
- Tambah helper `parseClipNumberFromPath(filePath)` memakai regex mengecualikan ekstensi (mis. `/(\d+)\.(?:mp3|mp4|wav|mov)$/i`, serta pola `_clip_(\d+)`, `_c(\d+)`) agar `clip_01.mp4` vs `clip_11.mp3` vs `clip_21.mp3` tidak tertukar dengan angka ekstensi `.mp3`/`.mp4`.
- Jalankan `verifyClipPairIntegrity({ videoPaths, completedClips, resolveLocalPath, getMediaDuration })` **sebelum muxing & finishing**:
  1. Cek jumlah `videoPaths.length === completedClips.length` dan tiap klip memiliki teks VO (`source_text` non-kosong bila finishing aktif).
  2. Bila pasangan path video & audio sama-sama mengandung nomor klip, pastikan nomor/urutannya selaras per indeks pasangan.
  3. Bila metadata durasi audio TTS tersedia pada record klip, verifikasi terhadap `getMediaDuration(audioPath)` dalam batas **`±0.3s`**.
  4. Bila terjadi ketidakcocokan, **batalkan overlay finishing (`finishingGuardReason = ...`) + cetak `console.warn` detail pasangan bermasalah**, lalu render video bersih **tanpa overlay finishing** (tidak menggagalkan job secara total).

#### 2. Registry Template Terpusat [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) (`R11`)
**Code Sebelum (`v2.44.6`, tersebar di 4+ file):**
- [`lib/finishing-overlay-renderer.js:8-20`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-overlay-renderer.js#L8-L20): `resolveFinishingTemplatePath()` mengecek `'calm_wellness'` dan `'recipe_pop'` dengan `if`.
- [`lib/video-studio-processor.js:988`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js#L988): `const isRichTemplate = resolvedTemplate === 'calm_wellness' || resolvedTemplate === 'recipe_pop';`
- [`lib/finishing-data-extractor.js:386-406`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js#L386-L406): `suggestFinishingTemplate()` mengembalikan `'calm_wellness'` secara paksa di baris 405 saat kategori tidak dikenali.
- [`app/settings/presets/page.js:1559-1561`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js#L1559-L1561) & [`apps/mcp/tools.mjs:519,591,616,674,807`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs#L519): `<option>` dan `z.enum(['none', 'calm_wellness', 'recipe_pop'])` hardcoded.

**Code Sesudah (`(Revisi 02, R11)`):**
```js
// lib/finishing-template-registry.js (single source of truth)
export const FINISHING_TEMPLATE_REGISTRY = [
  {
    id: 'none',
    file: 'base-caption.html',
    label: 'None — Legacy / Caption Dasar',
    description: 'Subtitle & Hook Card dasar tanpa overlay template khusus.',
    layers: { recipe: false, product: false, cameraMotion: false, sharedBrand: false },
    finishingPlanFields: ['hook', 'punches'],
    suggestFor: [],
    compliance: { strictHerbalBlock: false }
  },
  {
    id: 'calm_wellness',
    file: 'calm-wellness.html',
    label: 'Calm Wellness — Editorial Serif & Product Card',
    // ...
  },
  {
    id: 'recipe_pop',
    file: 'recipe-pop.html',
    label: 'Recipe Pop — Chips Bahan + Step Cards + Tick SFX',
    // ...
  }
];
export const FINISHING_TEMPLATE_IDS = FINISHING_TEMPLATE_REGISTRY.map(t => t.id);
export function getFinishingTemplateMeta(id) { ... }
export function suggestFinishingTemplate(record = {}) {
  // Jika cocok pattern niche -> return template.id; jika tidak ada yang cocok -> return null!
}
```
- Seluruh 5 file konsumen di atas membaca langsung dari [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) tanpa daftar template hardcoded tambahan.

---

### FASE 2c-1 s/d 2c-6 — Code Sebelum & Code Sesudah `(Revisi 02)` — Shared Layer & 5 Template Baru (`R12`)

#### 1. Shared Brand Layers, Brand Profile Fields (`R12.1`), Tier-3 Speech-Interval Timing (`R12.3`), & Brand Patch (`R12.4`) — **Fase 2c-1**
- **Migrasi Kolom `brand_profiles` ([`lib/db-pg.js:870-896`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L870-L896))**:
  - Tambah idempoten: `logo_url TEXT`, `brand_color TEXT`, `brand_tagline TEXT`, `default_cta_tiktok TEXT`, `default_cta_facebook TEXT`, `default_cta_youtube TEXT`, `safety_notice_text TEXT`, `presenter_name TEXT`, `presenter_role TEXT`, `brand_location TEXT`.
  - Di [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) (`resolvePreRenderFinishingMeta`), isi `finishingMeta.brand` dari `brand_profiles` agar template menerima logo, warna, tagline, CTA platform, safety notice, presenter, dan lokasi secara generik.
- **Shared HTML Layer (`templates/finishing/shared-layers.js`)**:
  - Komponen CSS/DOM selaras [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html): `x-wm` (watermark pojok), `x-end` (end card merek 1.5–2s), `x-lower` (lower-third nama/peran tim/presenter), `x-patch` (patch penutup teks AI rusak per `clipIndex` & area eksplisit operator/`finishing_plan`), serta helper i18n label berdasarkan `target_language` (`'id'`/`'en'`, misal `BEFORE`/`AFTER`, `MYTH`/`FACT`, `WHY?`, `RECAP` untuk Bahasa Inggris vs Bahasa Indonesia).
- **Tier-3 Speech-Interval + Punctuation Snap [`lib/word-alignment-engine.js:145-230`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js#L145-L230) (`R12.3`)**:
  - **Code Sebelum**: membagi kata per klausa bila jumlah klausa == jumlah speech island; jika tidak cocok, meratakan bobot kata di sepanjang speech island tanpa snap tanda baca eksplisit.
  - **Code Sesudah**: mengadopsi algoritma `derive()` pada [`mockup_finishing_templates_v3.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_templates_v3.html): distribusi bobot hanya di dalam interval bicara `sp` (skip keheningan), dan untuk setiap batas tanda baca (`,`, `.`, `?`, `!`, `:`), lakukan snap ke batas akhir jeda `sp` terdekat apabila selisih waktunya `< 0.9s`.

#### 2. Perluasan Opsional `finishing_plan` per Template (`R12.2`) & 5 Template Baru — **Fase 2c-2 s/d 2c-6**
Setiap field tambahan pada `finishing_plan` **HANYA** diinjeksikan ke prompt [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) jika preset campaign memakai template terkait, dan seluruhnya melewati validator ketat di [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) (invalid → skip layer + warning):

| Fase | Template ID (`file`) | Target Akun / Domain | Field Opsional `finishing_plan` (`R12.2`) | Guardrail Wajib (`R6.6`, `R12.1`) |
|---|---|---|---|---|
| **2c-2** | `tips_listicle` (`tips-listicle.html`) | Sasyahouse | `tips` (`<= 6` kata/tip, recap akhir), `punch_display`, opsional `brand_patch` | Bebas safe zone; total kata dengan punch maksimal `10%` |
| **2c-3** | `ramuan_ritual` (`ramuan-ritual.html`) | Siasat Sehat, Nutriblend, Dapur Botani Herbal | `timing_badges` (`SEBELUM TIDUR`, `PAGI PERUT KOSONG`, `DIAMKAN ...`) | **Strictest claim block** pada hook & punch terlepas dari `category` produk (`lemak`, `metabolisme`, `detoks`, `ginjal`, `gula darah`, `kolesterol`, `visceral`, dll.) + `x-notice` wajib |
| **2c-4** | `problem_solution` (`problem-solution.html`) | Ruang Akustik ID | `chapters` (`MASALAH`, `PENYEBAB`, `SOLUSI`, `HASIL`), `callouts` (`label`, titik fokus) | Track progres fase + callout leader line bebas safe zone + CTA konsultasi |
| **2c-5** | `angka_banding` (`angka-banding.html`) | Solusi Thermal ID | `compare` (VS 2 sisi), `numbers` (counter/meter) | `numbers` **ditolak otomatis** bila angka tidak ditemukan di VO bersih atau data produk nyata (`anti fake metrics`) |
| **2c-6** | `mitos_fakta` (`mitos-fakta.html`) | Siasat Sehat, Dapur Botani, Ruang Akustik ID | `myth_fact` (`question`, `myth`, `fact`, `why`) | Klaim kesehatan pada bagian `fact`/`why` **wajib lulus `isHerbalMedicalClaimPhrase`** |

---

### FASE 3 — Code Sebelum & Code Sesudah `(Revisi 02)` — Live Preview UI 7 Template & Benchmark

1. **Preview UI Interaktif (`app/pillar-campaigns/[id]/page.js`, `app/settings/presets/page.js`) (`R13`)**:
   - Tambahkan kontrol override per campaign (`finishing_template`, `caption_mode`, `loudness_target`) + komponen Preview interaktif berbasis iframe yang memuat daftar template langsung dari [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js) untuk **seluruh 7 template** (`window.loadTimeline` + scrubber `window.renderAt(t)`). Buat mockup HTML Staging + token `app/theme.css` terlebih dahulu sebelum edit React.
2. **Audit Performa Menyeluruh 7 Template (`R3.3`, `R13`)**:
   - Catat durasi total render Playwright + 3x zoompan + ffmpeg composite pada video uji 4, 6, dan 8 klip untuk ketujuh template, termasuk template terberat (**`tips_listicle` dengan recap** dan **`problem_solution` dengan callout**). Jika rasio rata-rata > **3× durasi video**, hentikan dan laporkan data benchmark beserta opsi Remotion ke pengguna. **Tidak membuat** `FinishingPass.jsx` / `renderFinishingPassVideo()` pada tahap ini.

---

## Kriteria Verifikasi Minimum per Rilis — `(Revisi 02)`

| Verifikasi | Fase 0 ✅ | Fase 1 ✅ | Fase 2 ✅ | Fase 2b | Fase 2c-0 | Fase 2c-1..6 (per template) | Fase 3 |
|---|---|---|---|---|---|---|---|
| Render ulang `opc_2117` & `mul_261113_qt67yl` + contact sheet `0.5s` | Wajib ✅ | Wajib ✅ | Wajib ✅ | Batal | — | Regresi `calm_wellness` & `recipe_pop` | Wajib |
| Test 10+ klip numbering (`01/11/21`, `.mp3`/`.mp4` guard) & skip-finishing on mismatch | — | — | — | Batal | Wajib | — | — |
| Test tambah dummy template ke registry -> muncul otomatis di UI & MCP | — | — | — | Batal | Wajib | — | — |
| Video nyata dari akun target + contact sheet `0.5s` vs tab `mockup_finishing_templates_v3.html` | — | — | Wajib ✅ | Batal | — | Wajib (per template) | Wajib (7 template) |
| Cek manual sinkronisasi audio min. `5` titik (`±0.2s` lip/voice vs overlay) | — | — | — | Batal | — | Wajib (per template) | Wajib |
| Loudness output `-14 ± 1 LUFS` | Wajib ✅ | Wajib ✅ | Wajib ✅ | Batal | Wajib | Wajib | Wajib |
| Zero tag markup (`<#`, `#>`, `[...]`, `(breath)`) | Wajib ✅ | Wajib ✅ | Wajib ✅ | Batal | Wajib | Wajib | Wajib |
| Unit test compliance (`fitHookCard`, herbal claim block, `ramuan_ritual` strict, `angka_banding` anti-angka fiktif, `mitos_fakta`) + invalid skip-layer | Wajib ✅ | Wajib ✅ | Wajib ✅ | Batal | — | Wajib (per template) | — |
| Grep `templates/finishing/` bersih string hardcoded merek/produk (`R6.6`) | — | — | Wajib ✅ | Batal | — | Wajib | Wajib |
| Playwright HTML lifecycle (`browser.close()` di `finally`) + fallback Sharp/SVG | — | Wajib ✅ | Wajib ✅ | Batal | Wajib | Wajib | Wajib |
| Preview UI memuat seluruh 7 template dari registry + benchmark terberat (`tips_listicle` recap, `problem_solution` callout) rasio ≤ `3×` | — | — | — | Batal | — | — | Wajib |
| `npm run build` + smoke test Staging | Wajib ✅ | Wajib ✅ | Wajib ✅ | Batal | Wajib | Wajib | Wajib |
