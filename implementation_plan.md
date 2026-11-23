# Implementation Plan: Hotfix Normalisasi VO Multiplier (Typo Key AI & Sinkronisasi Simpan UI)

**Branch**: `hotfix/multiplier-vo-typo-and-save`  
**Dasar Usulan**: [USULAN_PERBAIKAN_VO_MULTIPLIER_TYPO_DAN_SIMPAN.md](catatan-kerja/usulan/USULAN_PERBAIKAN_VO_MULTIPLIER_TYPO_DAN_SIMPAN.md)

---

## Execution Task List

- [x] Buat branch `hotfix/multiplier-vo-typo-and-save` dari `main` terbaru
- [x] Susun `implementation_plan.md` dengan `Code Sebelum` & `Code Sesudah`
- [x] Tambahkan `extractSceneVoText` dan `normalizeStoryboardVoFields` di `lib/tts-text-sanitizer.js`
- [x] Sinkronkan VO pada `app/api/v2/multiplier/[id]/update-creative/route.js` & `app/multiplier-lab/[id]/page.js`
- [x] Normalisasi output Gemini & gunakan `extractSceneVoText` + guard VO kosong di `lib/re-multiplier-worker.js`
- [x] Tambahkan unit test regresi di `tests/tts-text-sanitizer.test.mjs` dan perbarui `sot/menus/kartu/multiplier-lab.md`
- [x] Jalankan unit test & `npm run build` verifikasi lokal

---

## Perubahan Kode (Before & After)

### 1. `lib/tts-text-sanitizer.js`

**Code Sebelum (Current/Before):**
```js
export function sanitizeVoiceoverItems(items = [], opts = {}) {
  ...
    for (const key of ['narration', 'narration_transcript', 'voiceover', 'voice_over', 'new_vo']) {
```

**Code Sesudah (Proposed/After):**
Menambahkan `extractSceneVoText(entry, { preferEdited })` dan `normalizeStoryboardVoFields(items, { preferEdited })` yang menangani alias & typo AI (`narrating_transcript`, `narration_transcript`, `narration`, `voiceover`, `voice_over`, dll.) serta menyertakan `'narrating_transcript'` pada `sanitizeVoiceoverItems`.

### 2. `app/api/v2/multiplier/[id]/update-creative/route.js`

**Code Sebelum (Current/Before):**
```js
    const prompts = (storyboard || []).map((s, idx) => ({ ... }));
    ...
    JSON.stringify(storyboard || []),
```

**Code Sesudah (Proposed/After):**
Menjalankan `normalizeStoryboardVoFields(storyboard, { preferEdited: true })` sebelum menyusun `prompts` dan menyimpan `remake_storyboard_json` agar `narration_transcript` & `narration` selalu sinkron.

### 3. `app/multiplier-lab/[id]/page.js`

**Code Sebelum (Current/Before):**
```js
narration: scene.narration_transcript || scene.voiceover || scene.narration || '',
...
updated[cidx].narration = e.target.value;
```

**Code Sesudah (Proposed/After):**
Memakai `extractSceneVoText(scene, { preferEdited: true })` saat memuat storyboard, dan saat edit memperbarui `narration` sekaligus `narration_transcript`.

### 4. `lib/re-multiplier-worker.js`

**Code Sebelum (Current/Before):**
```js
const rawText = storyboard[c].narration_transcript || storyboard[c].voiceover || '';
```

**Code Sesudah (Proposed/After):**
Menjalankan `normalizeStoryboardVoFields` setelah sanitasi output Gemini, menggunakan `extractSceneVoText(..., { preferEdited: true })` di TTS (`1107`), claim filter (`1063`), Native Veo (`1290`), dan Markdown export (`1631`), serta guard error informatif bila VO adegan kosong sebelum memanggil TTS API.
