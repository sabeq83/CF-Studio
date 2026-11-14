# Laporan Perbaikan Pipeline Karakter 3D & Multi-Voice Dialog (`v2.48.6`)

**Tanggal:** 14 November 2026  
**Versi Rilis:** `v2.48.6` (`21ce2b10deae6a8944aaf05febae24c16478fca5`)  
**Target Deploy:** Staging Mac Mini (`http://100.95.245.55:5010`) — **Production tidak disentuh**  
**Status Uji Kampanye Live:** **Ditahan (belum dijalankan)** sesuai instruksi pengguna untuk membuat laporan `.md` terlebih dahulu sebelum melakukan uji Staging berikutnya (yang akan dibatasi berhenti hingga tahap *Start Frame*).

---

## 1. Ringkasan Akar Masalah (`opc_d0_kawanrumah_261114` / Item `#2175`)

Saat kampanye uji awal `opc_d0_kawanrumah_261114` dihentikan paksa oleh pengguna pada item `#2175`, inspeksi start frame (`opc_start_frame_2175_clip_1_r1_a5df8b5d.jpg`, `clip_3_r1_5fe5697e.jpg`) dan payload menunjukkan dua kegagalan inti:

1. **Visual 3D Karakter Tertimpa Aturan Live-Action Faceless Manusia (POV Tangan):**
   - Pengecekan karakter kartun/3D sebelumnya hanya memeriksa `content_world === 'cartoon_universe'`.
   - Visual Identity `Kawan Rumah (Si Wajan)` (`vi_mwfzpljm_bf15cfe9`) memakai Schema V2 `stylized_3d_character` (`subject.kind = 'stylized_3d_character'`, `face_visibility = 'allowed'`, `wardrobe.preset_key = 'not_applicable'`), bukan `content_world = 'cartoon_universe'`.
   - Akibatnya, karena flag `planner_scene_director = 'on'` aktif di `default_tenant`, pipeline mengaktifkan Scene Director live-action, `applyPromptReplacements`, `buildOpcStartFrameRequest`, serta menyuntikkan framing `Strict chest-down POV` / `Strict neck-down POV`, `modest clothing`, `wrists covered`, dan negative prompt anti-wajah (`human face, facial features, eyes, nose, mouth`).
   - Selain itu, `lib/visual-language-catalog.js` sempat memuat frasa `blank faceless character design` di definisi `stylized_3d_character`, dan `lib/visual-override-resolver.js` mengubah `wardrobe.preset_key === 'not_applicable'` menjadi pakaian manusia default serta `legacy.character_concept = 'faceless'`.

2. **Naskah Keluar sebagai Monolog Tunggal (Tanpa `voice_segments`):**
   - Nilai `enable_audio_segment` dari PostgreSQL berbentuk string `'1'`, sedangkan `lib/prompts.js` memeriksa `enable_audio_segment === true || enable_audio_segment === 1` (`false` untuk string `'1'`).
   - Akibatnya `MULTI-CHARACTER DIALOG MANDATE` tidak aktif, contoh JSON `"voiceover"` di `buildOrganicPillarPrompt` tidak menampilkan field `"voice_segments"`, dan aturan `UNIVERSAL_ZERO_TESTIMONY_MANDATE` tetap melarang penggunaan kata ganti orang pertama dalam dialog karakter.

---

## 2. Daftar Perbaikan yang Diterapkan (`v2.48.6`)

| File | Perubahan Utama |
|---|---|
| `lib/visual-identity-contract.js` | Menambahkan dan mengekspor helper tunggal `isStylizedCharacterVisualConfig({ campaign, row, visualOverrides })` untuk mendeteksi konfigurasi karakter 3D/kartun lintas Schema V2 (`stylized_3d_character`, `cozy_claymation`, `3d_claymation_cozy`, `stylized_cartoon_character`, `mascot_object`, `animal`, `universe_slug`, `cartoon_face`). |
| `lib/visual-language-catalog.js` | Menghapus frasa kontaminasi `blank faceless character design` dari preset gaya `stylized_3d_character`. |
| `lib/visual-override-resolver.js` | Menangani `wardrobe.preset_key === 'not_applicable'` tanpa pakaian manusia (`natural character surface finish only, no human clothing`), mengembalikan `legacy.character_concept = 'stylized_3d'` untuk gaya stylized 3D/kartun, dan mendukung objek Schema V2 inline (`subject` / `visual_language`) saat melewati `resolveVisualIdentitySnapshot`. |
| `lib/visual-identity-allocator.js` | Menggunakan deteksi stylized 3D sebelum menentukan `isSceneDirectorMode`, `isFacelessMandate`, aturan lengan (`wrists covered`), serta mengganti arahan metaphor/live-action menjadi arahan interaksi karakter animasi 3D ekspresif saat mode stylized 3D aktif. |
| `lib/prompts.js` | Memakai `isPromptFlagEnabled` agar string `'1'` / `'true'` pada `enable_audio_segment` terbaca aktif di OPC, RE, Custom Storyboard, dan Strategic; menyertakan contoh array `"voice_segments"` di skema JSON `"voiceover"`; menonaktifkan Scene Director/Metaphor/Faceless POV dan fallback *symbolic surrealism* saat `isStylizedCharacter` aktif; mengizinkan dialog orang pertama antar karakter maskot saat multi-voice/stylized character aktif. |
| `lib/opc-start-frame-request.js` | Melewati attachment `wardrobe_fabric_hands_ref`, melewati injeksi `applyModestPresenceAndWardrobe` & `Wardrobe Lock Priority`, menonaktifkan `isFacelessCampaign` POV framing lock, dan memakai `cartoonNegativePrompt` (tanpa memblokir `eyes, nose, mouth`) untuk config `isStylizedOrCartoon`. |
| `lib/start-frame-visual-qc.js` | Melewati Vision QC khusus faceless manusia (`inspectStartFrameFile` dan `evaluateBatchStartFramesQc`) dengan status `{ skipped: true, mode: 'skipped_stylized_3d' }` untuk kampanye `isStylizedCharacterVisualConfig`. |
| `lib/scheduler-processors.js` | Memastikan `processPillarGenerator` tidak mengaktifkan Scene Director maupun Metaphor Kit untuk `isStylizedCharPre`/`Post`, serta memastikan `applyPromptReplacements` tidak menimpa prompt dengan `[CAMERA FRAMING: Strict neck-down POV ...]` atau pakaian sopan manusia. |
| `tests/stylized-3d-dialog-d0.test.js` | Menambahkan 4 unit test regresi untuk memverifikasi deteksi stylized 3D, resolver tanpa kontaminasi `modest clothing`/`faceless`, prompt multi-voice dengan DB string `'1'`, serta bypass POV/negatives/QC pada start frame request. |

---

## 3. Verifikasi Build, Unit Test, & Deployment Staging

1. **Unit Test Lokal** (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev node --test tests/stylized-3d-dialog-d0.test.js tests/k7.1-fixes.test.js tests/vo-v0-compliance-and-flags.test.mjs tests/vo-k1-k4-koreksi.test.mjs`):
   - **Hasil:** **19/19 lulus (`0 failed`, `0 skipped`)**:
     - `tests/stylized-3d-dialog-d0.test.js`: 4 passed
     - `tests/k7.1-fixes.test.js`: 4 passed
     - `tests/vo-v0-compliance-and-flags.test.mjs`: 3 passed
     - `tests/vo-k1-k4-koreksi.test.mjs`: 8 passed
2. **Next.js Production Build Lokal** (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`):
   - **Hasil:** Selesai dengan exit code `0`.
3. **Git Release & Staging Atomic Deploy:**
   - Versi dirilis: `v2.48.6` (tag `v2.48.6`, commit SHA `21ce2b10deae6a8944aaf05febae24c16478fca5`, branch `main`).
   - Deploy atomic Staging (`npm run deploy:staging -- --ref 21ce2b10deae6a8944aaf05febae24c16478fca5 --apply --confirm-staging`):
     - `deployment_success=true`
     - `release_id=20261114T132143Z-21ce2b10deae`
     - `current=/Users/masbenu/maknaflow-staging-atomic/releases/20261114T132143Z-21ce2b10deae`
     - Proses PM2 aktif (`online`): `maknaflow-staging-ui`, `maknaflow-staging-api`, `maknaflow-staging-mcp`.
     - Cek HTTP Staging `http://100.95.245.55:5010/login`: `200`.

---

## 4. Rencana Langkah Uji Berikutnya (Menunggu Konfirmasi Pengguna)

Sesuai arahan untuk **tidak menjalankan uji dulu** sekarang dan **berhenti di tahap Start Frame** jika uji nanti dijalankan:

1. **Penyiapan Preset Bersih di Staging (`kawan_rumah_3d_dialog`):**
   - Menambahkan preset operator `stylized_3d_character` + `vi_mwfzpljm_bf15cfe9` + `face_visibility: 'cartoon_face'` + `enable_audio_segment: true` + `voice_provider: 'minimax'` + `clip_duration: 8` + `target_clips_count: 5` + `enable_social_post: false`.
2. **Uji Terbatas Berhenti di Start Frame (`execution_mode` bertahap / stop sebelum Veo I2V):**
   - Membuat 1 kampanye uji bersih baru di Staging (tidak memakai item kotor `#2175`/`#2176`).
   - Menjalankan fase generasi storyboard + naskah `voice_segments` + **pembuatan Start Frame T2I saja**, lalu **BERHENTI sebelum render video Veo I2V** agar pengguna bisa menginspeksi:
     - Apakah gambar Start Frame sudah benar menampilkan objek rumah tangga 3D Pixar ekspresif (tanpa tangan manusia POV)?
     - Apakah `result_json.voiceover` sudah memuat array `voice_segments` 2 karakter per klip?
3. Setelah pengguna menyetujui hasil Start Frame dan naskah `voice_segments`, barulah tahap render TTS multi-voice, Veo I2V, dan laporan lengkap Uji D-0 dilanjutkan.

