# Implementation Plan: Pengaman Auto-Repair VO Kosong & Fallback Key Dinamis Multiplier

**Branch**: `hotfix/multiplier-vo-auto-repair`  
**Dasar**: Lanjutan pengaman dari `v2.57.12` agar VO klip kosong di tahap `remaking` otomatis diperbaiki sebelum masuk T2I/TTS.

---

## Execution Task List

- [x] Buat branch `hotfix/multiplier-vo-auto-repair` dari `main` terbaru
- [x] Susun `implementation_plan.md` dengan `Code Sebelum` & `Code Sesudah`
- [x] Tambah fallback regex pencocokan key dinamis di `extractSceneVoText()` dan helper `repairMissingSceneVoiceovers()` di `lib/tts-text-sanitizer.js`
- [x] Pasang auto-repair 1x di tahap `remaking` & guard `waiting_approval` bila VO masih kosong di `lib/re-multiplier-worker.js`
- [x] Tambah unit test di `tests/tts-text-sanitizer.test.mjs` dan perbarui `sot/menus/kartu/multiplier-lab.md`
- [x] Jalankan `PG_SEARCH_PATH=dev node --test tests/tts-text-sanitizer.test.mjs` & `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`
- [x] Merge ke `main`, rilis patch `v2.57.13`, dan deploy ke Staging

---

## Perubahan Kode (Before & After)

### 1. `lib/tts-text-sanitizer.js`

**Code Sebelum (Current/Before):**
`extractSceneVoText()` hanya memeriksa daftar key statis `SCENE_VO_KEYS_DEFAULT` / `SCENE_VO_KEYS_EDITED`.

**Code Sesudah (Proposed/After):**
1. Menambahkan fallback pencocokan key dinamis (`FUZZY_VO_KEY_RE` dengan `FUZZY_VO_EXCLUDE_RE`) jika semua key eksplisit kosong.
2. Menambahkan `repairMissingSceneVoiceovers()` untuk mendeteksi adegan yang VO-nya kosong, menjalankan 1x repair ke Gemini, dan melaporkan `repairedIndices` serta `stillMissingScenes`.

### 2. `lib/re-multiplier-worker.js`

**Code Sebelum (Current/Before):**
Setelah `parseGeminiJSON`, `voiceover` langsung masuk ke audit compliance tanpa mengecek apakah ada adegan yang VO-nya kosong, dan `nextStatus` langsung menuju `generating_t2i` / `generating_audio`.

**Code Sesudah (Proposed/After):**
1. Menjalankan `repairMissingSceneVoiceovers()` bila terdeteksi adegan VO kosong saat TTS aktif sebelum audit compliance.
2. Jika masih ada adegan yang kosong setelah repair, mengeset `auditNeedsManualReview = true` dengan pesan jelas sehingga task tertahan di `waiting_approval` sebelum membuang kuota T2I/TTS.
