# Laporan Tahap Gambar Karakter & Pengujian Start Frame Kawan Rumah (Part E.4 – E.5)

**Lingkungan Uji:** Staging Mac Mini (`http://100.95.245.55:5010`, DB schema `staging,public`)  
**Rilis Staging Aktif:** `v2.48.12` (commit `0364584991a197c669df39313524abd82224d3b9`, `release_id=20261114T224643Z-0364584991a1`)  
**Kampanye Uji:** `opc_261115_0b9qkd` (Item `#2183`, Planner `pln_2757cc4f`)  
**Brand:** Kawan Rumah (`7ee48659-637c-4eac-ab83-9e138b3035fd`)  
**Preset & VI:** `kawan_rumah_3d_dialog` + `vi_mwfzpljm_bf15cfe9` (snapshot `v4`, `enable_audio_segment = '1'`, `target_clips_count = '5'`, `clip_duration = 8`, `approval_mode = 'storyboard'`)  
**Pilar Konten:** *Si Wajan, Sponge, dan Sapu: Drama Dapur Bersih Kilat Setelah Masak*

---

## 1. Status Sidebar (`Universe Manager` & `Multiplier Labs`)

- Navigasi sidebar di [`lib/sidebar-nav.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/sidebar-nav.js) sudah memulihkan menu **Universe Manager** (`/settings/universes`) dan mengubah label menjadi **Multiplier Labs**.
- **Verifikasi Kode & Unit Test:** Test `Part A: Sidebar nav restores Universe Manager and renames Multiplier Labs` pada [`tests/reference-asset-and-sidebar-d.test.js`](file:///Users/sabeqmmursyid/_cfstudio/tests/reference-asset-and-sidebar-d.test.js) lulus (`tests 16, pass 16, fail 0, cancelled 0, skipped 0`).
- **Catatan Screenshot Browser:**
  - Subagent browser (`ed331541-818c-4b1f-8d37-f8260659e995`) gagal dijalankan karena error lingkungan Chrome (`DevToolsActivePort` missing).
  - Pemeriksaan menggunakan headless Playwright Chrome ke [`http://100.95.245.55:5010/settings/universes`](http://100.95.245.55:5010/settings/universes) otomatis ter-redirect ke [`http://100.95.245.55:5010/login`](http://100.95.245.55:5010/login) karena halaman dilindungi autentikasi (tidak di-bypass). Pengguna dapat memverifikasi tampilan sidebar secara langsung setelah login di Staging.

---

## 2. Variasi Karakter (`v1`–`v3`) & Referensi VI Lineup yang Disetujui

Seluruh 3 karakter dan 1 VI Lineup sudah memiliki masing-masing 3 variasi (`v1`–`v3`), dengan versi **`v3` disetujui dan aktif**:

- **Contact Sheet Semua Variasi (`12` gambar Part C):** [kawan_rumah_ref_variations_grid.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/kawan_rumah_ref_variations_grid.png)
- **Contact Sheet Referensi `v3` Disetujui (`4` aset aktif):** [kawan_rumah_v3_references_grid.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/kawan_rumah_v3_references_grid.png)

| Aset | Entity ID | Variasi `v1` | Variasi `v2` | `v3` Disetujui & Aktif | File `v3` di Staging (`public/uploads/...`) |
| --- | --- | --- | --- | --- | --- |
| **Si Wajan** | `14bf5c57-8172-45d6-9612-dcc4817b3102` | `ref_mwgijsy8_1b1e91fe` | `ref_mwgik3th_31c99aab` | `ref_mwgikk3n_6466b70a` | `/uploads/reference-assets/default_tenant/character/14bf5c57-8172-45d6-9612-dcc4817b3102/character_sheet/v3/aad470f88333eeca.jpg` |
| **Sponge** | `2a26c594-10bc-4955-8527-34bbbfd1e951` | `ref_mwgikzkx_1427b858` | `ref_mwgil9nh_86c710db` | `ref_mwgilnky_93228098` | `/uploads/reference-assets/default_tenant/character/2a26c594-10bc-4955-8527-34bbbfd1e951/character_sheet/v3/fc01be405ebce12a.jpg` |
| **Sapu** | `4c0f8efc-ed35-4cad-aa61-6447035023c3` | `ref_mwgilz74_b0e00bed` | `ref_mwgimd4n_9958a83e` | `ref_mwgimqar_306be520` | `/uploads/reference-assets/default_tenant/character/4c0f8efc-ed35-4cad-aa61-6447035023c3/character_sheet/v3/3beda6b3f9227f96.jpg` |
| **VI Lineup (`Kawan Rumah`)** | `vi_mwfzpljm_bf15cfe9` | `ref_mwgin15k_720b0eff` | `ref_mwgincrt_650b744b` | `ref_mwginnm9_6e7e7d65` | `/uploads/reference-assets/default_tenant/visual_identity/vi_mwfzpljm_bf15cfe9/character_sheet/v3/09b876f841ad841f.jpg` |

---

## 3. Contact Sheet Start Frame & Referensi Karakter per Klip

- **Contact Sheet Start Frame (`5/5` klip selesai):** [start_frame_kawan_rumah_e4.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/start_frame_kawan_rumah_e4.png)
- **Visual Mode:** Seluruh `5/5` klip berjalan dengan `visual_mode = 'stylized_3d_character'`.
- **Status Gerbang Veo:** Berhenti sesuai ketentuan sebelum submit ke Veo (`visual_status = 'pending'`, `visual_tasks_json = null`, log Staging: `⛔ [Campaign Scheduler] Paused before G-Labs for OPC item #2183`, dan status kampanye `opc_261115_0b9qkd` diset ke `'paused'`).

| Klip | Pembicara Dialog | Naskah Dialog | Log `[CharacterLock Async]` (Staging) | Task & File Start Frame |
| --- | --- | --- | --- | --- |
| **Clip 1** | `["si_wajan", "sponge"]` | *"SI WAJAN: Capek malam-malam harus menggosok wajan berminyak sampai pegal? SPONGE: Padahal baru aja selesai makan malam yang enak."* | `[CharacterLock Async] Clip 1: characters=si_wajan,sponge,sapu refs=3` | Task `fb3a5b8f` — [opc_start_frame_2183_clip_1_r1_fb3a5b8f.jpg](http://100.95.245.55:5010/uploads/start_frames/opc_start_frame_2183_clip_1_r1_fb3a5b8f.jpg) |
| **Clip 2** | `["sapu", "si_wajan"]` | *"SAPU: Masalahnya sisa bumbu tebal bikin tangan pegal kalau dibiarkan lama. SI WAJAN: Betul banget, rasanya pengen langsung istirahat."* | `[CharacterLock Async] Clip 2: characters=sapu,si_wajan,sponge refs=3` | Task `0c4342c1` — [opc_start_frame_2183_clip_2_r1_0c4342c1.jpg](http://100.95.245.55:5010/uploads/start_frames/opc_start_frame_2183_clip_2_r1_0c4342c1.jpg) |
| **Clip 3** | `["sponge", "sapu"]` | *"SPONGE: Nah, daripada harus capek menggosok terlalu lama setiap malam. SAPU: Mending kita pakai cara yang lebih praktis dan cepat."* | `[CharacterLock Async] Clip 3: characters=sponge,sapu,si_wajan refs=3` | Task `61da52fe` — [opc_start_frame_2183_clip_3_r1_61da52fe.jpg](http://100.95.245.55:5010/uploads/start_frames/opc_start_frame_2183_clip_3_r1_61da52fe.jpg) |
| **Clip 4** | `["si_wajan", "sponge"]` | *"SI WAJAN: Lihat nih permukaanku jadi bersih seketika tanpa drama. SPONGE: Noda minyak langsung terangkat dengan mudah dan ringan."* | `[CharacterLock Async] Clip 4: characters=si_wajan,sponge,sapu refs=3` | Task `b9233274` — [opc_start_frame_2183_clip_4_r1_b9233274.jpg](http://100.95.245.55:5010/uploads/start_frames/opc_start_frame_2183_clip_4_r1_b9233274.jpg) |
| **Clip 5** | `["sapu", "si_wajan"]` | *"SAPU: Makanya malam ini bisa tidur nyenyak tanpa beban cucian. SI WAJAN: Coba sekarang sebelum kehabisan ya."* | `[CharacterLock Async] Clip 5: characters=sapu,si_wajan,sponge refs=3` | Task `8139af9b` — [opc_start_frame_2183_clip_5_r1_8139af9b.jpg](http://100.95.245.55:5010/uploads/start_frames/opc_start_frame_2183_clip_5_r1_8139af9b.jpg) |

---

## 4. Pemakaian API G-Labs, Gemini, & Sampel Audio TTS (3–5 Detik)

### A. Jumlah Pemanggilan G-Labs & Gemini API
- **G-Labs (`nano_banana_2`):**
  - Start Frame kampanye `opc_261115_0b9qkd`: **5** gambar (`5/5` selesai).
  - Generasi referensi Part C (3 variasi × 3 karakter + 3 variasi VI Lineup): **12** gambar.
  - **Total G-Labs Image (Part C + Part E.4):** **17** gambar.
  - **Render Video Veo:** **0**.
- **Gemini API (`staging.ai_token_usage_ledger`):**
  - `BRAND_EDITORIAL_CREATIVE`: **1** call (`id=1112`, model `gemini-3.5-flash-lite`, `prompt_tokens=10866`, `candidates_tokens=4728`, `total_tokens=15594`, estimasi biaya `$0.006263`).
  - Content Planner upstream `general_ai`: **2** call (`id=1110` = `8163` tokens, `id=1111` = `79386` tokens).
  - **Total Gemini API:** **3** call (`103,143` tokens), dengan **0** call Gemini pada tahap Compliance (Zero-Token Lexicon Pass), Start Frame, maupun TTS.

### B. Sampel Audio TTS Multi-Voice per Karakter (`3–5` Detik)
- Status TTS: `tts_status = 'completed'`, `tts_batch_id = 'ttsb_opc_2183_1794696553679'`.
- Total **10** segmen suara MiniMax disintesis dan digabungkan menjadi **5** MP3 klip (contoh Clip 0 tergabung berdurasi `7.884000` detik: [tts_opc_ttsb_opc_2183_1794696553679_clip_0.mp3](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/scratch/e4_audio/tts_opc_ttsb_opc_2183_1794696553679_clip_0.mp3)).

| Karakter | Voice ID (MiniMax) | Durasi (`afinfo`) | Sampel Staging (HTTP) | Salinan Lokal |
| --- | --- | --- | --- | --- |
| **Si Wajan** | `Indonesian_energetic_streamer_vv2` | `3.636000 sec` (segmen `c3_0` juga `5.004000 sec`) | [seg_opc_ttsb_opc_2183_1794696553679_c0_0_si_wajan.mp3](http://100.95.245.55:5010/temp/seg_opc_ttsb_opc_2183_1794696553679_c0_0_si_wajan.mp3) | [seg_opc_ttsb_opc_2183_1794696553679_c0_0_si_wajan.mp3](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/scratch/e4_audio/seg_opc_ttsb_opc_2183_1794696553679_c0_0_si_wajan.mp3) |
| **Sponge** | `Indonesian_intellectual_commentator_vv2` | `4.896000 sec` | [seg_opc_ttsb_opc_2183_1794696553679_c2_0_sponge.mp3](http://100.95.245.55:5010/temp/seg_opc_ttsb_opc_2183_1794696553679_c2_0_sponge.mp3) | [seg_opc_ttsb_opc_2183_1794696553679_c2_0_sponge.mp3](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/scratch/e4_audio/seg_opc_ttsb_opc_2183_1794696553679_c2_0_sponge.mp3) |
| **Sapu** | `Indonesian_crisp_reporter_vv2` | `3.852000 sec` | [seg_opc_ttsb_opc_2183_1794696553679_c1_0_sapu.mp3](http://100.95.245.55:5010/temp/seg_opc_ttsb_opc_2183_1794696553679_c1_0_sapu.mp3) | [seg_opc_ttsb_opc_2183_1794696553679_c1_0_sapu.mp3](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/scratch/e4_audio/seg_opc_ttsb_opc_2183_1794696553679_c1_0_sapu.mp3) |

---

## 5. Perbandingan Visual vs Referensi `v3` & Bug Pipeline yang Diperbaiki

### A. Evaluasi Visual Start Frame (`5/5` Klip) vs Referensi `v3`
- **Konsistensi Desain Karakter:** Ketiga karakter tampil konsisten dengan sheet `v3` yang disetujui:
  - **Si Wajan:** wajan bulat hitam matte, gagang kayu terakota, mata besar, pipi kemerahan.
  - **Sponge:** spons kuning dengan lapisan gosok hijau sage, mata dan senyum ekspresif.
  - **Sapu:** sapu ijuk Indonesia bergagang hijau sage, ikatan tali, alis tebal, dan senyum jahil.
- **Komposisi & Latar:** `5/5` klip menampilkan adegan multi-karakter dalam latar wastafel dapur Indonesia bergaya Pixar 3D yang konsisten.
- **Tanpa Tangan Manusia:** **0 tangan manusia** muncul di seluruh 5 Start Frame.
- **Catatan Minor:** Pada **Clip 5**, karakter **Sapu** ter-render dalam posisi terbalik (bulu sapu menghadap ke atas), walaupun material dan wajahnya tetap konsisten dengan referensi `v3`.

### B. Ringkasan Bug yang Ditemukan & Diperbaiki Selama Pengujian E.4
1. **`v2.48.10` (`828b52ba32b8d0be436be4287ff07c5fa8d1a47e`):** Memperbaiki hidrasi preset pada [`app/api/v2/recipes/autonomous-pipeline/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/autonomous-pipeline/route.js), [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js) (`buildPresetHydratedGlobalFields`), [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js), dan [`lib/pillar-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js) agar parameter `visual_identity_preset_id` yang kosong tidak menimpa VI bawaan preset. *(Dua kampanye uji awal yang sempat salah terhidrasi — `opc_261115_cpcq6i` item `#2181` dan `opc_261115_74sel0` item `#2182` — sudah diset ke `status = 'paused'`).*
2. **`v2.48.11` (`53b97e2cfac017adfaeebde9ab8aec58cdf0ac56`):**
   - Menambahkan `deferStartFrames` di [`lib/pillar-start-frame-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-start-frame-service.js) dan [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) agar fase review storyboard tidak menandai `start_frame_status = 'failed'`.
   - Memperbaiki [`lib/pillar-campaign-approval.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-approval.js) untuk menjaga `voice_segments` pada `voiceover[index]` serta mempertahankan pause gate pasca-storyboard (`scheduler_pause_at`).
   - Menambahkan `lockAllClipsToStylizedPrimary` pada [`lib/visual-identity-allocator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-allocator.js) agar VI karakter 3D merutekan `5/5` klip ke `stylized_3d_character`.
3. **`v2.48.12` (`0364584991a197c669df39313524abd82224d3b9`):** Menambahkan guard `alreadyApproved` pada [`lib/pillar-start-frame-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-start-frame-service.js) agar checkpoint Start Frame yang selesai tidak mengembalikan item yang sudah di-approve menjadi `ready_for_review`/`ready`.
