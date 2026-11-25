# Analisa & Usulan Perbaikan (Hotfix): Konsistensi Wardrobe Lock, Kehilangan Audio & Text Overlay pada Kampanye Multiplier (`mul_261125_scjc0u` / `syd_admin`)

**Tanggal:** 25 November 2026  
**Basis Pemeriksaan:** Database PostgreSQL `staging` (`re_multiplier_tasks`, `tts_studio_batches`, `tts_studio_clips`, `visual_identity_presets`), inspeksi file & log PM2 Mac Mini Staging, hasil `ffprobe`, serta audit kode [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js), [lib/metaphor-policy.js](file:///Users/sabeqmmursyid/_cfstudio/lib/metaphor-policy.js), [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js), [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js), [lib/video-studio-processor.js](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js), [update-creative/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/update-creative/route.js), dan [page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js).

---

## Bagian A — Warna Baju Berubah-Ubah Antar-Klip

### 1. Jawaban Singkat
1. **Apakah sudah dikunci dalam Visual Identity (VI)?**  
   **Sudah disiapkan daftar palet di VI, tetapi belum mengunci 1 warna solid pada level kampanye/prompt.**  
   Kampanye `mul_261125_scjc0u` (tenant `tnt_sy-dodot_4ba27b` / `syd_admin`) memakai VI `vi_mwvkcoc3_24215939` (*"NutriBlend — Brand Identity Card v3 Male (Urban Active Drinks)"*):
   - `wardrobe.mode`: `"stable_random"`, `wardrobe.preset_key`: `"custom"`, `primary_color` & `secondary_color`: `""`
   - `wardrobe.palette`: `["Charcoal Slate", "Deep Navy", "Olive Drab", "Warm Sand Beige", "Crisp Off-White", "Forest Pine"]`
   - `wardrobe.custom_description`: `"Single plain unprinted casual male cotton/linen shirt with neatly rolled sleeves or clean minimalist athletic top per video, no logos or text"`
2. **Kenapa warna baju berubah-ubah antar-klip (dan apakah perbaikan membatasi 1 warna untuk semua video)?**  
   - **Penyebab:** Karena `resolveVisualIdentitySnapshot` mengabaikan `wardrobe.palette` saat `preset_key === 'custom'`, `re-multiplier-worker.js` tidak mengirim `stable_seed`, dan `buildMultiplierPhase2Prompt` serta `buildMultiplierStartFrameRequest` tidak mengunci warna solid tunggal maupun membersihkan frasa *"or plain athletic top / or clean minimalist athletic top"*. Akibatnya tiap klip digenerate tanpa warna tertentu.
   - **Bukan 1 warna untuk selamanya:** Penguncian memakai seed deterministik per baris kampanye (`batch_id:task.id`). **Semua klip di dalam 1 video/baris memakai 1 warna solid yang persis sama**, sedangkan **antar-video/baris berbeda tetap bebas berganti warna** sesuai `wardrobe.palette` (`stable_random`).

### 2. Usulan Perbaikan Wardrobe Lock (Hotfix)
1. **`lib/visual-override-resolver.js`**:
   - Teruskan `itemIndex` & `stableSeed` melalui `resolveVisualIdentitySubmission` → `resolveVisualIdentity` → `resolveVisualIdentitySnapshot`.
   - Ketika `wardrobe.palette` terisi dan `primary_color` kosong (termasuk `preset_key === 'custom'`), pilih 1 warna deterministik (`stableIndex` untuk `stable_random`/`random`, `itemIndex % len` untuk `sequential`, `palette[0]` untuk `fixed`), hilangkan opsi ganda `"or ... athletic top"`, sematkan warna solid terpilih ke `wardrobe_prompt`, dan kembalikan `resolved.wardrobe_color_label` / `resolved_wardrobe_color`.
2. **`lib/re-multiplier-worker.js` (`handleStoryboardRemake`)**:
   - Kirim `stable_seed: "${task.batch_id}:${task.id}"` dan `item_index: rowIndex` ke `resolveVisualIdentitySubmission`.
   - Simpan `resolved_wardrobe_color` dan `resolved_wardrobe_prompt` ke `vso_config_json` agar tersedia juga di tahap `generating_t2i` & tombol UI *Regenerate Start Frame*.
3. **`lib/prompts.js` (`buildMultiplierPhase2Prompt`)**:
   - Pastikan `vsoSection`, `targetAnchorInstruction`, dan `targetWardrobeInstruction` mencantumkan warna solid terkunci yang sama tanpa frasa ganda `"or ... athletic top"`, serta dukungan fallback `resolveVideoVariety` jika VI membawa `palette` tanpa `resolved_wardrobe_color`.
4. **`lib/multiplier-start-frame-request.js` (`buildMultiplierStartFrameRequest`)**:
   - Untuk klip non-3D/non-`environment_object_only`, bersihkan frasa ganda `"or ... athletic top"` dan injeksikan `[WARDROBE LOCK: strictly uniform solid <lockedColor> garment color ...]` pada prompt T2I. *(Catatan hotfix: klip bridging tetap mempertahankan foto referensi produk sebagai prioritas tunggal agar Product Identity Lock tidak terdilusi.)*

---

## Bagian B — Audio Hilang & Motion Text Tidak Tampil (Jatuh ke Silent Concat Fallback)

### 1. Bukti Pemeriksaan di Staging
- **TTS TIDAK gagal:**
  - Log `staging-ui.out.log` (`10:43:14`–`10:43:30`) mencatat batch `multiplier_tts_mul_261125_scjc0u` (6 klip di tabel `tts_studio_batches` / `tts_studio_clips`) dan file `tts_clip_mult_mul_261125_scjc0u_0..5.mp3` + `tts_multiplier_combined_mul_261125_scjc0u.mp3` (228.984 bytes; `ffprobe`: valid MP3 `37.895750s`, `48000` bps) berhasil dibuat di disk.
- **Video final tanpa audio & tanpa text overlay:**
  - `ffprobe` pada `mul_261125_scjc0u_final.mp4` hanya berisi 1 stream (`h264` video `47.72s`) dan **0 stream audio** (`audio:0KiB`).
  - `staging-ui.out.log` (`10:47:16`) mencatat worker masuk ke jalur: `[Multiplier Worker] Merging video clips without voiceover (fallback)...` (`ffmpeg -f concat -c copy` dari `mult_list_mul_261125_scjc0u.txt`).
  - Karena worker melewati tahap `ffmpeg_muxing` (`handleFFmpegMuxing` → `processTtsStudioMuxing`), **baik suara VO maupun render motion text (`enable_motion_text: 1`, `floating_black_on_white`) dan transisi `slideleft` ikut terlewati**.

### 2. Akar Masalah
1. Pada [lib/re-multiplier-worker.js:1524](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L1524), syarat masuk ke `ffmpeg_muxing` adalah `hasFfmpeg && (audioConfig.combined_audio_path || isTtsOptionalMux)`. Saat 6 klip Veo selesai diunduh (`10:47:16`), field `combined_audio_path` **hilang dari kolom `audio_config_json` di PostgreSQL** dan worker tidak mengecek file fisik `/temp/tts_multiplier_combined_${task.id}.mp3` di disk, sehingga jatuh ke cabang fallback bisu.
2. Struktur `audio_config_json` `mul_261125_scjc0u` di DB berakhir tepat dengan 11 key camelCase keluaran `normalizeAudioConfig()` tanpa `combined_audio_path`. Ini cocok dengan penimpaan oleh `POST /api/v2/multiplier/[id]/update-creative`: di UI ([page.js:335-338](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js#L335-L338)), state `editedAudioConfigs[t.id]` hanya diinisialisasi sekali saat halaman dibuka dan tidak mensinkronkan `combined_audio_path` baru dari polling `fetchTasks()`. Saat pengguna beraktivitas di halaman UI selama `generating_visuals` (`10:44:50`–`10:46:56` memicu *Regenerate T2I*) lalu menyimpan perubahan, state browser menimpa seluruh `audio_config_json` di DB dan menghapus `combined_audio_path`.

### 3. Usulan Perbaikan Audio & Text Overlay (Hotfix)
1. **Proteksi Server-Side di [update-creative/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/update-creative/route.js):**  
   Pertahankan field runtime server (`combined_audio_path`, `tts_skipped_reason`) dari `task.audio_config_json` saat `update-creative` menyimpan pembaruan dari UI apabila tidak ada di payload masuk.
2. **Sinkronisasi State Polling di [page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js):**  
   Saat `fetchTasks()` menerima pembaruan task dari server, tetap lindungi field editan user via `if (prev[t.id])`, namun sinkronkan `combined_audio_path` & `tts_skipped_reason` terbaru dari server agar state UI tidak mengirim payload usang.
3. **Self-Healing Fallback Check di [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) (`handleVisualGeneration`):**  
   Sebelum jatuh ke cabang silent concat (`else`), jika `hasFfmpeg && !isTtsOptionalMux && !audioConfig.combined_audio_path`, periksa file fisik `public/temp/tts_multiplier_combined_${task.id}.mp3` (atau `.wav`) di disk. Bila ada & non-kosong, pulihkan `audioConfig.combined_audio_path`, simpan ke DB, dan teruskan ke stage `ffmpeg_muxing`.
4. **Render Ulang `mul_261125_scjc0u` di Staging (`ffmpeg_muxing`):**  
   Setelah hotfix dideploy ke Staging, pulihkan `combined_audio_path: "/temp/tts_multiplier_combined_mul_261125_scjc0u.mp3"` pada `mul_261125_scjc0u` (dan pastikan `ffmpeg_muxing` dijalankan ulang lewat endpoint `/retry` `{ stage: "ffmpeg" }` tanpa mengulang Gemini/G-Labs) sehingga `processTtsStudioMuxing` me-render ulang video final dengan **audio VO + Motion Text (`enable_motion_text: 1`, `source_text` dari `tts_studio_clips`) + transisi `slideleft`**, lalu mengunggah ulang ke Nextcloud.

---

## Ringkasan Kriteria Uji Hotfix
- Satu baris kampanye Multiplier (`mul_*`) mengunci **1 warna baju solid + 1 potongan baju** konsisten dari Klip 1 hingga Klip terakhir; baris/video berbeda tetap dapat memperoleh warna berbeda dari `wardrobe.palette`.
- Simpan perubahan kreatif saat worker berjalan tidak menghapus `combined_audio_path`; `handleVisualGeneration` otomatis memulihkan path audio dari disk bila file gabungan sudah ada sehingga `ffmpeg_muxing` selalu mengeksekusi VO + Motion Text.
- Video `mul_261125_scjc0u_final.mp4` di Staging setelah render ulang terverifikasi memiliki stream `video` + stream `audio` dan menampilkan motion text.
