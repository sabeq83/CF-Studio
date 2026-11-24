# Audit & Usulan Perbaikan: Smart Resume Retry pada Pipeline Video Multiplier

**Tanggal:** 24 November 2026  
**Konteks Kasus:** Task Multiplier `mul_261124_2t1hwy` (preset `multiplier_home_living_no_vo_asmr`) di server Dev  
**Status:** Usulan Analisa (Menunggu Persetujuan Implementasi)

---

## 1. Latar Belakang Masalah

Pada pengujian task `mul_261124_2t1hwy`:
1. Kelima video klip hasil G-Labs sudah selesai diunduh ke disk (`public/temp/mult_clip_mul_261124_2t1hwy_0..4.mp4`), kelima start frame (`t2i_images_json`) tersimpan, dan `glabs_task_ids` (`["e85d8d6a","7f3d0d98","a068cb89","4f7a7656","215ed8e2"]`) lengkap.
2. Saat task sempat gagal di tahap lanjutan (`generating_audio` lalu `ffmpeg_muxing`) dan pengguna menekan tombol **`🔄 Retry Baris`**, pipeline tidak langsung melanjutkan tahap yang gagal (mis. `ffmpeg_muxing`), melainkan **mengulang dari tahap paling awal (`pending_resolution` → `resolving_product` → `remaking` Gemini → `generating_t2i` G-Labs)** — sehingga membuang waktu ~4–5 menit serta membakar ulang kuota Gemini dan T2I.

---

## 2. Hasil Audit Menyeluruh Jalur Retry Video Multiplier

Audit dilakukan terhadap seluruh komponen yang menangani video jenis Multiplier (`re_multiplier_tasks`, `/multiplier-lab`, `/api/v2/multiplier/*`, Auto Pipeline, MCP `cf_retry_multiplier_task`) serta pembandingnya di Pillar Campaign dan RE Campaign:

### Temuan 1 (Akar Masalah Utama): `retry_task` Selalu Mereset Status ke `pending_resolution`
- **UI Detail (`app/multiplier-lab/[id]/page.js:558-578, 1170-1188`)**: Tombol **`🔄 Retry Baris`** memanggil `handleRetryTask(task.id)` → `PATCH /api/v2/multiplier` dengan payload `{ action: 'retry_task', taskId }`.
- **MCP (`apps/mcp/tools.mjs:2352-2360`)**: Tool `cf_retry_multiplier_task` juga memanggil endpoint yang sama (`action: 'retry_task'`).
- **Backend API (`app/api/v2/multiplier/route.js:127-143`)**: Selalu mengeksekusi query statis:
  ```sql
  UPDATE re_multiplier_tasks
  SET status = 'pending_resolution', error_message = NULL
  WHERE id = ? AND status = 'failed'
  ```
  Endpoint ini **tidak pernah mengecek** artefak tahap apa saja yang sudah sukses tersimpan.

### Temuan 2: Worker Tidak Idempoten Saat Mengulang Stage Awal (`lib/re-multiplier-worker.js`)
Begitu `status` berubah menjadi `pending_resolution`, *chain loop* di `processSingleMultiplierTask` (`lib/re-multiplier-worker.js:118-151`) mengeksekusi ulang semua stage awal tanpa penjagaan aset yang sudah ada:
1. `handleProductResolution` → menimpa `resolvedDNA` dan memaksa `status = 'remaking'`.
2. `handleStoryboardRemake` (`lines 370-940`) → memanggil Gemini ulang, menimpa `remake_storyboard_json` dan `t2i_i2v_prompts_json`, lalu memaksa `status = 'generating_t2i'` (untuk autopilot).
3. `handleT2iGeneration` (`lines 943-1057`) → menginisialisasi `let t2iImages = []` kosong tanpa membaca `task.t2i_images_json`, sehingga men-generate ulang seluruh 5 start frame T2I dari nol.
4. Hanya `handleVisualGeneration` (`lines 1301-1334`) yang punya mekanisme `reuseCompletedTask` berdasarkan `glabs_task_ids`, namun tidak sempat menyelamatkan tahap-tahap sebelumnya karena tahap awal sudah dijalankan ulang.

### Temuan 3: Stepper UI (`getStageStatus`) Salah Mendeteksi Tahap Gagal & Memakai Kolom yang Tidak Ada
Di `app/multiplier-lab/[id]/page.js:621-650`:
1. **Salah anggap TTS gagal di Mode `no_vo` / `native_veo` (`lines 634-642`):**
   ```js
   const audioConfig = JSON.parse(task.audio_config_json || '{}');
   hasAudio = !!audioConfig.combined_audio_path;
   if (!hasAudio) activeStage = 'tts_failed';
   ```
   Pada mode `no_vo` / `native_veo` (atau `enable_tts === 0`), `combined_audio_path` memang tidak pernah dibuat. Akibatnya task yang gagal di `visuals` atau `ffmpeg_muxing` tampil di UI sebagai **`✗ TTS Audio (Gagal)`**.
2. **Mengecek kolom DB yang tidak ada (`line 642`):**
   ```js
   } else if (!task.video_paths_json || task.video_paths_json === '[]') {
     activeStage = 'visuals_failed';
   ```
   Tabel `re_multiplier_tasks` (`lib/db-pg.js:2143-2190`) **tidak punya kolom `video_paths_json`**. Kolom yang ada hanyalah `glabs_task_ids` + file klip lokal `public/temp/mult_clip_<taskId>_<i>.mp4`. Karena bug ini, tahap **`FFmpeg Muxing`** dan **`Nextcloud Cloud`** tidak pernah terdeteksi sebagai `danger` (gagal) pada UI.

### Temuan 4: Endpoint Retry Per-Stage (`POST /api/v2/multiplier/[id]/retry`) Punya Celah `cloud` & Validasi
- Di `app/api/v2/multiplier/[id]/retry/route.js:17-29`, pemetaan `stage` hanya menangani `'remaking'`, `'t2i'`, `'tts'`, `'visuals'`, `'ffmpeg'`.
- Jika user menekan tombol `🔄 Retry` pada tahap **`Nextcloud Cloud`** (`stage === 'cloud'`), nilainya tidak cocok dengan `if/else` mana pun dan jatuh ke default **`nextStatus = 'pending_resolution'`** (kembali mengulang dari awal!).
- Selain itu, tombol `🔄 Retry` per-tahap di UI (`app/multiplier-lab/[id]/page.js:719`) hanya muncul untuk step yang berstatus `'success'` atau `'danger'`—dan akibat Temuan 3, **`FFmpeg Muxing`** tertutupi sebagai `'pending'` sehingga tombol Retry khusus FFmpeg sering tidak tampil saat dibutuhkan.

### Temuan 5: Status `uploading_assets` Tidak Dikenali Worker & Query Scheduler
- `handleFFmpegMuxing` (`lib/re-multiplier-worker.js:1643-1652`) mengubah status ke `'uploading_assets'` lalu menjalankan `uploadCompletedTaskToNextcloud`.
- Jika proses upload ke Nextcloud gagal / timeout, baik `getPendingMultiplierTasks` / `getEligibleFase2MultiplierTasks` (`lib/db.js:3343, 3361, 3391`) maupun `processSingleMultiplierTask` (`lib/re-multiplier-worker.js:121-135`) tidak memproses status `'uploading_assets'`.

### Temuan 6: Kontras dengan Jenis Kampanye Lain
- **Pillar Campaign (`pillar_campaigns`, termasuk `campaign_multiplier`)**: Sudah memisahkan status per tahap dan tombol granular (`app/api/v2/pillar-campaigns/items/[itemId]/trigger/route.js:115-175`), di mana `step === 'ffmpeg'` hanya mereset `ffmpeg_status = 'pending'` tanpa menyentuh `visual_clip_paths` maupun TTS.
- **RE Campaign (`re_campaigns`)**: `retryReCampaignItem` (`lib/db.js:3532-3557`) mendeteksi kolom status mana yang `'failed'` dan hanya mereset tahap gagal tersebut (catatan kecil: saat `visual_status === 'failed'`, `visual_tasks_json` masih diset `null`).
- **Multiplier Labs (`re_multiplier_tasks`)**: Satu-satunya arsitektur yang memakai **1 kolom `status` tunggal** tanpa menyimpan `failed_stage` / `last_completed_stage`, ditambah `retry_task` selalu mereset paksa ke `'pending_resolution'`.

---

## 3. Usulan Perbaikan Terstruktur

### Tahap A — Smart Resume pada Retry Multiplier & Penyimpanan `failed_stage` (Prioritas Utama)
1. **Simpan jejak tahap gagal sebelum status berubah ke `'failed'`:**
   - Di `processSingleMultiplierTask` (`lib/re-multiplier-worker.js:152-156`), simpan nama stage aktif (misal ke `error_stage` atau metadata dalam `audio_config_json` / kolom baru ringan `failed_stage TEXT` pada `re_multiplier_tasks`) tepat sebelum `status` diubah menjadi `'failed'`.
   - Sebagai *fallback* (termasuk untuk task lama yang belum punya `failed_stage`), buat helper terpusat **`resolveMultiplierResumeStage(task)`** di `lib/re-multiplier-worker.js` atau modul helper khusus dengan urutan pengecekan artefak dari belakang ke depan:
     1. **Sudah ada `ffmpeg_output_path` di disk & belum ada `nextcloud_video_url`** → resume ke `'uploading_assets'`.
     2. **Semua file klip `.mp4` (`public/temp/mult_clip_<task.id>_0..N-1.mp4`) ada di disk dan berukuran > 0** (atau `failed_stage === 'ffmpeg_muxing'` + `glabs_task_ids` lengkap) → langsung resume ke **`'ffmpeg_muxing'`**!
     3. **Audio beres** (`audio_engine_mode` adalah `'no_vo'` / `'native_veo'` / `enable_tts === 0`, ATAU `combined_audio_path` ada di disk) **dan** start frame tersedia (atau `visual_mode === 'pure_t2v'` / `glabs_task_ids` sudah terisi) → resume ke **`'generating_visuals'`** (yang otomatis me-reuse klip selesai di `glabs_tasks`).
     4. **`t2i_images_json` lengkap** (semua non-null sesuai jumlah `t2i_i2v_prompts_json`, atau mode `'pure_t2v'`) → resume ke **`'generating_audio'`**.
     5. **`remake_storyboard_json` dan `t2i_i2v_prompts_json` terisi valid** → resume ke **`'generating_t2i'`**.
     6. **Belum ada storyboard / masih tahap awal** → `'pending_resolution'`.

2. **Perbarui `PATCH /api/v2/multiplier` (`action: 'retry_task'`) & MCP `cf_retry_multiplier_task`:**
   - Default (`mode = 'smart_resume'`): memanggil `resolveMultiplierResumeStage(task)` lalu mengupdate `status` langsung ke stage tersebut (contoh: kasus `mul_261124_2t1hwy` langsung masuk `'ffmpeg_muxing'`, 0 token Gemini, 0 regenerasi T2I, 0 regenerasi G-Labs!).
   - Kembalikan `resumed_stage` di response API agar UI Toast & MCP menampilkan pesan akurat (mis. *"Melanjutkan baris mul_xxx langsung dari tahap FFmpeg Muxing (5 klip .mp4 siap)"*).
   - Sediakan opsi eksplisit `mode: 'restart_from_beginning'` bila pengguna memang ingin mengulang total dari awal.

3. **Lengkapi `uploading_assets` & `POST /api/v2/multiplier/[id]/retry`:**
   - Tambah `else if (stage === 'cloud') nextStatus = 'uploading_assets';` di [app/api/v2/multiplier/[id]/retry/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/retry/route.js#L17-L23).
   - Tambahkan handler `uploading_assets` di `processSingleMultiplierTask` (jalankan `uploadCompletedTaskToNextcloud` + sync ContentFlow + set `status = 'completed'`) dan masukkan `'uploading_assets'` ke query `getEligibleFase2MultiplierTasks` / `getPendingMultiplierTasks` (hanya bila dipicu manual atau tidak sedang aktif diproses).
   - Tambahkan validasi prasyarat ringan pada `retry/route.js` jika user memilih stage `'ffmpeg'` sementara klip G-Labs belum selesai sama sekali (beri error jelas, bukan gagal di tengah jalan).

### Tahap B — Idempotency Per-Klip di Worker `generating_t2i` & `generating_audio`
Sebagai pengaman lapis kedua (bila user memicu `generating_t2i` misalnya karena 1 dari 5 start frame gagal/null):
1. **`handleT2iGeneration` (`lib/re-multiplier-worker.js:969-1050`):**
   - Baca `existingImages = safeParse(task.t2i_images_json, [])`.
   - Pada loop klip `i`, bila `existingImages[i]` masih non-null dan file fisiknya ada di disk (`public/...`) + bukan mode *force regenerate*, **pakai ulang start frame tersebut tanpa memanggil G-Labs** dan hanya men-generate indeks klip yang masih `null`/hilang.
   - Beri opsi `{ force: true }` bila dipanggil dari tombol eksplisit **Regenerasi Semua Start Frame**.
2. **`handleAudioGeneration` (`lib/re-multiplier-worker.js:1062`):**
   - Bila bukan `no_vo`/`native_veo`, pertahankan perilaku *generate* saat stage `'tts'` diretry eksplisit, namun saat *smart resume* lewat `resolveMultiplierResumeStage` stage TTS akan langsung dilewati bila file `combined_audio_path` sudah valid di disk.

### Tahap C — Perbaikan UI Detail Multiplier Labs (`app/multiplier-lab/[id]/page.js`)
1. **Perbaiki `getStageStatus` (`lines 621-650`):**
   - Gunakan `failed_stage` (jika tersedia) dan deteksi kondisi nyata sebagai fallback:
     - Akui `audio_engine_mode === 'no_vo' || audio_engine_mode === 'native_veo' || enable_tts === 0` sebagai TTS tidak wajib (`ttsDone = true`).
     - Ganti pengecekan kolom hantu `task.video_paths_json` dengan `Boolean(task.has_visual_clips)` (dikembalikan oleh `GET /api/v2/multiplier` / `GET /api/v2/multiplier/[id]` dengan mengecek keberadaan `public/temp/mult_clip_<id>_*.mp4` atau status `glabs_tasks`) dan `glabs_task_ids`.
   - Dengan begitu, saat gagal di FFmpeg, kartu status di UI benar-benar menandai **`✗ FFmpeg Muxing (Gagal)`** (bukan `✗ TTS Audio`), dan tombol **`🔄 Retry`** muncul tepat di tahap FFmpeg!
2. **Label Tombol Lebih Jelas di Daftar Baris & Header Detail:**
   - Tombol utama pada baris gagal: **`▶️ Lanjutkan (<stage_tujuan>)`** (Smart Resume — misal `▶️ Lanjutkan (FFmpeg Muxing)`).
   - Tambah tombol/opsi terpisah **`🔁 Ulang dari Awal`** dengan konfirmasi, agar operator sadar kapan hanya melanjutkan vs kapan mereset total dari Gemini + T2I.

---

## 4. Ringkasan Dampak & Risiko

| Aspek | Sebelum Perbaikan | Sesudah Perbaikan |
|---|---|---|
| Klik **Retry Baris** saat gagal di FFmpeg | Reset ke `pending_resolution` → ulang Gemini + 5× T2I + TTS + I2V (~5–15 menit, boros kuota) | Langsung masuk `ffmpeg_muxing` memakai 5× `.mp4` yang sudah ada (~15–30 detik) |
| Gagal 1 klip saat T2I lalu retry `t2i` | Mengulang kelima start frame dari klip 1 | Hanya men-generate ulang klip yang `null`/hilang |
| Status stage gagal di UI untuk mode No-VO | Selalu salah tampil `✗ TTS Audio (Gagal)` | Akurat menampilkan `✗ FFmpeg Muxing (Gagal)` / `✗ Visual G-Labs (Gagal)` |
| Klik Retry tahap `Nextcloud Cloud` | Jatuh ke `pending_resolution` (mengulang semua!) | Resume bersih di `uploading_assets` tanpa render ulang video |
| Perubahan DB | — | Opsional 1 kolom aman `failed_stage TEXT` (`ADD COLUMN IF NOT EXISTS`) pada `re_multiplier_tasks` (tanpa breaking change) |

---

## 5. Rencana Eksekusi (Menunggu Persetujuan)
1. **Tahap 1 (Mockup UI Ringkas):** Simulasikan tampilan tombol **`▶️ Lanjutkan (FFmpeg Muxing)`**, badge stage gagal yang akurat pada mode No-VO, dan opsi **`🔁 Ulang dari Awal`** di `public/mockup_*.html` via server mockup lokal.
2. **Tahap 2 (Backend Smart Resume & Worker Idempotency):** Implementasi `failed_stage` + `resolveMultiplierResumeStage`, perbarui `PATCH /api/v2/multiplier`, `POST /api/v2/multiplier/[id]/retry`, `lib/re-multiplier-worker.js`, `lib/db.js`, dan `apps/mcp/tools.mjs`.
3. **Tahap 3 (UI Detail Multiplier Labs):** Perbarui `app/multiplier-lab/[id]/page.js` dan API read task untuk menyertakan info kesiapan artefak (`has_visual_clips`, `has_final_video`).
4. **Tahap 4 (Uji & Deploy Dev):** Tambahkan unit test skenario resume `ffmpeg_muxing` / `generating_visuals` / `generating_t2i` parsial + uji `npm run build` (`PG_SEARCH_PATH=dev`), lalu deploy ke server **Dev (`5020/7020`)**.
