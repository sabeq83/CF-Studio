# Implementation Plan (Hotfix): Perbaikan Camera Framing VI & Positive Faceless Crop Lock Multiplier (`mul_261125_78w443`)

**Sumber Usulan:** [USULAN_PERBAIKAN_FACELESS_CAMERA_MULTIPLIER.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_PERBAIKAN_FACELESS_CAMERA_MULTIPLIER.md)  
**Target Branch Kerja:** `hotfix/multiplier-faceless-camera-framing` (dibuat dari `main` saat eksekusi dimulai, sesuai SOP Alur 2 Hotfix Staging)  
**Catatan Arsitektur & Keamanan:**
- **Hotfix-only, tanpa migrasi schema DB & tanpa perubahan UI:** Seluruh perubahan fokus pada penerjemahan `camera` Visual Identity di `buildMultiplierPhase2Prompt`, positive faceless framing lock yang kebal terhadap `sanitizeImagePrompt` & `sanitizeI2vPrompt`, penyelarasan `vi_mwvkcoc3_24215939`, dan unit test regresi.
- **Kompatibilitas Penuh Test Existing:**
  - `sanitizeImagePrompt` (`lib/webhook-client.js`) tidak diubah perilaku penghapusan negasinya agar `tests/metaphor-f21-anti-hallucination.test.js` dan `tests/recipe-bridging-nonproduct-guard.test.js` tetap 100% hijau; sebagai gantinya seluruh framing lock baru memakai **positive-framing wording** tanpa `strictly`, `no`, atau `omitting`.
  - Kontrak `cam.framing === 'hands_closeup'` (`eye-level close-up on hands and the action, room context visible behind`) yang diuji pada `tests/multiplier-location-per-clip.test.js` tetap dipertahankan.

---

## Execution Task List

### Tahap 0 — Persiapan Branch Hotfix
- [x] Buat dan checkout branch baru `hotfix/multiplier-faceless-camera-framing` dari `main` terbaru (`git checkout main && git pull && git checkout -b hotfix/multiplier-faceless-camera-framing`)

### Tahap 1 — Perbaikan Penerjemahan Camera Framing VI & Aturan Aksi Faceless (`lib/prompts.js`)
- [x] Perbarui logika `opticsFromVI` dan `vsoSection` pada `buildMultiplierPhase2Prompt` di [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) agar:
  - `forearms_and_hands`, `crop_below_neck`, `camera.perspective === 'first_person'`, serta mode faceless (`face_visibility !== 'allowed'`) tidak pernah jatuh ke `'eye-level medium shot showing the room context'`
  - Tetap menampilkan konteks ruangan di latar belakang untuk VI `planner_driven`, namun dengan kamera condong ke bawah (*angled-down chest-down tabletop close-up* / *first-person POV*) terpotong di bawah bahu/klavikula
  - Melarang aksi pemicu wajah (*"cheerful toast"*, *"raising glass toward face"*, *"eye-level portrait"*) pada mode faceless `hands_only`

### Tahap 2 — Positive Faceless Crop Lock pada T2I & I2V Worker (`lib/multiplier-start-frame-request.js`, `lib/re-multiplier-worker.js`)
- [x] Tambahkan helper/guard positive framing lock di [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js) (mengubah sisa `eye-level medium shot showing the room context` & `cheerful toast`, lalu menyematkan `(Framing Lock: chest-down close-up composition cropped below collarbones ...)` yang kebal `sanitizeImagePrompt`, dikecualikan untuk klip `3D CGI` & `environment_object_only`)
- [x] Teruskan metadata `guardrails_face_visibility`, `faceless_mode`, serta `camera` pada `vso_config_json` saat `handleStoryboardRemake` dan tambahkan positive camera lock pada `handleVisualGeneration` (I2V `finalPrompt`) di [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)

### Tahap 3 — Penyelarasan Konfigurasi VI `vi_mwvkcoc3_24215939` (DB Staging & Dev)
- [x] Perbarui `config_json.camera.perspective` pada `vi_mwvkcoc3_24215939` (`nutriblend_identity_v3_male`) dari `"third_person"` menjadi `"first_person"` di database (`staging` & `dev`) agar konsisten dengan `subject.faceless_mode: "hands_only"` dan `subject.custom_description` (*POV close-up framing*)

### Tahap 4 — Unit Test, Build Aman, Rilis Patch & Deploy Staging
- [x] Tambahkan skenario pengujian di [tests/multiplier-faceless-camera-framing.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/multiplier-faceless-camera-framing.test.js) untuk memverifikasi `forearms_and_hands` + `first_person`/`third_person` faceless tidak memancarkan `eye-level medium shot`, positive crop lock bertahan melewati `sanitizeImagePrompt` & `sanitizeI2vPrompt`, dan klip `3D CGI` / `tests/multiplier-location-per-clip.test.js` tetap aman
- [x] Jalankan seluruh unit test relevan (`PG_SEARCH_PATH=dev node --test ...` — 12 suite 39/39 lulus) dan syntax check JS (`node --check`, dilanjut build penuh pada atomic deploy Staging)
- [x] Perbarui [sot/menus/kartu/multiplier-lab.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/multiplier-lab.md)
- [x] Atas persetujuan pengguna (SOP Alur 2 Hotfix): merge ke `main`, rilis patch (`npm run release-non-interactive -- --type patch ...`), deploy SHA rilis `main` ke **Staging** (`npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`), hapus branch hotfix, serta regenerasi ulang `mul_261125_78w443` di Staging bila diminta

---

## Detail Perubahan Kode (Before & After)

### 1. [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildMultiplierPhase2Prompt`)

**Code Sebelum (Current/Before):**
```js
    const rawTargetCharacter = (vso.subjectDemographicCustom || vso.subject_demographic_custom || vso.resolved?.subject_prompt)
      ? (vso.subjectDemographicCustom || vso.subject_demographic_custom || vso.resolved?.subject_prompt)
      : (DEMOGRAPHIC_PRESETS[subjectDemo] || subjectDemo || "a graceful Muslimah");
    targetCharacter = lockedWardrobeColor && !isEnvironmentOnly
      ? rawTargetCharacter.replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '').trim()
      : rawTargetCharacter;
```
```js
- WARDROBE CONSISTENCY: The color, texture, and style of the wardrobe must be IDENTICAL across all visual prompts${lockedWardrobeColor ? ` (MANDATORY LOCKED COLOR FOR THIS ENTIRE VIDEO: strictly "${lockedWardrobeColor}" only — never switch shirt colors or garment cuts between clips)` : ''}.
${locationConsistencyMandate}
```
```js
  const cam = vso?.structured?.camera || {};
  const opticsFromVI = cam.lens_look
    ? `(Angle: ${cam.framing === 'hands_closeup' ? 'eye-level close-up on hands and the action, room context visible behind' : 'eye-level medium shot showing the room context'}), (Lens: ${cam.lens_look.replace(/_/g, ' ')}, ${cam.depth_of_field || 'medium'} depth of field)`
    : null;
  const targetOpticsInstruction = (vso?.opticsPrompt || vso?.optics_prompt || vso?.resolved?.optics_prompt)
    || (envPolicy === 'planner_driven' ? opticsFromVI : null)
    || '(Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing), (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field)';
```

**Code Sesudah (Proposed/After):**
```js
    const facelessMode = vso?.structured?.subject?.faceless_mode || '';
    const faceVisibilityPolicy = vso?.structured?.guardrails?.face_visibility || '';
    const isFacelessGuarded = !isEnvironmentOnly && (
      targetConcept === 'faceless' ||
      faceVisibilityPolicy === 'prohibited' ||
      facelessMode === 'hands_only' ||
      facelessMode === 'back_view'
    );
    const facelessActionRule = isFacelessGuarded
      ? `- FACELESS CROP & GESTURE RULE: Frame every live-action shot strictly chest-down from mid-torso/forearms to hands on the tabletop with upper frame edge below collarbones (never head/neck/face height). FORBIDDEN actions that pull faces into frame: "toast", "cheerful toast", "drinking to camera", or raising glasses toward face height — keep glasses/jars at tabletop level.`
      : '';
```
```js
- WARDROBE CONSISTENCY: The color, texture, and style of the wardrobe must be IDENTICAL across all visual prompts${lockedWardrobeColor ? ` (MANDATORY LOCKED COLOR FOR THIS ENTIRE VIDEO: strictly "${lockedWardrobeColor}" only — never switch shirt colors or garment cuts between clips)` : ''}.
${facelessActionRule ? `${facelessActionRule}\n` : ''}${locationConsistencyMandate}
```
```js
  const cam = vso?.structured?.camera || {};
  const camFaceProhibited = !isEnvironmentOnly && (
    vso?.structured?.guardrails?.face_visibility === 'prohibited' ||
    vso?.structured?.subject?.faceless_mode === 'hands_only' ||
    vso?.structured?.subject?.faceless_mode === 'back_view' ||
    (vso?.characterConcept || vso?.character_concept || 'faceless') === 'faceless'
  );
  const resolveOpticsAngle = () => {
    if (cam.framing === 'hands_closeup') {
      return cam.perspective === 'first_person'
        ? 'first-person POV close-up angled downward at hands and tabletop action, blurred room context visible ahead'
        : 'eye-level close-up on hands and the action, room context visible behind';
    }
    if (cam.framing === 'back_view' || cam.framing === 'over_shoulder_faceless' || vso?.structured?.subject?.faceless_mode === 'back_view') {
      return 'rear 180-degree over-the-shoulder shot positioned directly behind the subject facing away toward the workspace, room context visible ahead';
    }
    if (cam.perspective === 'first_person') {
      return 'first-person POV angled-down close-up looking from chest height down at hands working on the tabletop, blurred room context visible behind the counter';
    }
    if (cam.framing === 'forearms_and_hands' || cam.framing === 'crop_below_neck' || camFaceProhibited) {
      return 'angled-down chest-down tabletop close-up focused on forearms and hands working on the counter, blurred room context visible behind the tabletop, upper frame cropped below collarbones';
    }
    return 'eye-level medium shot showing the room context';
  };
  const opticsFromVI = cam.lens_look
    ? `(Angle: ${resolveOpticsAngle()}), (Lens: ${cam.lens_look.replace(/_/g, ' ')}, ${cam.depth_of_field || 'medium'} depth of field)`
    : null;
  const targetOpticsInstruction = (vso?.opticsPrompt || vso?.optics_prompt || vso?.resolved?.optics_prompt)
    || (envPolicy === 'planner_driven' ? opticsFromVI : null)
    || '(Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing), (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field)';
```

---

### 2. [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js)

**Code Sebelum (Current/Before):**
```js
  if (lockedWardrobeColor && !isEnvOnly && !is3dOrCellularPrompt) {
    effectivePrompt = effectivePrompt
      .replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '')
      .trim();
    if (!/\[WARDROBE LOCK:/i.test(effectivePrompt)) {
      effectivePrompt = `${effectivePrompt} [WARDROBE LOCK: strictly uniform solid ${lockedWardrobeColor} garment color across all live-action scenes${lockedWardrobePrompt ? ` (${lockedWardrobePrompt})` : ''}, identical shirt color and fabric, no color change]`;
    }
  }

  return {
```

**Code Sesudah (Proposed/After):**
```js
  if (lockedWardrobeColor && !isEnvOnly && !is3dOrCellularPrompt) {
    effectivePrompt = effectivePrompt
      .replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '')
      .trim();
    if (!/\[WARDROBE LOCK:/i.test(effectivePrompt)) {
      effectivePrompt = `${effectivePrompt} [WARDROBE LOCK: strictly uniform solid ${lockedWardrobeColor} garment color across all live-action scenes${lockedWardrobePrompt ? ` (${lockedWardrobePrompt})` : ''}, identical shirt color and fabric, no color change]`;
    }
  }

  const isCartoonOrAllowedFace = aesthetics?.characterConcept === 'stylized_3d'
    || aesthetics?.character_concept === 'stylized_3d'
    || aesthetics?.structured?.guardrails?.face_visibility === 'allowed'
    || aesthetics?.guardrails_face_visibility === 'allowed';
  const hasHumanOrHandsCue = /\b(?:hands?|forearms?|sleeves?|wearing|shirt|gamis|tunic|\(Anchor:)\b/i.test(effectivePrompt)
    && !/\b(?:unattended standalone still-life|nobody in scene|zero hands)\b/i.test(effectivePrompt);
  const isFacelessCropped = !isEnvOnly && !is3dOrCellularPrompt && !isCartoonOrAllowedFace && hasHumanOrHandsCue && (
    (aesthetics?.characterConcept || aesthetics?.character_concept || 'faceless') === 'faceless' ||
    aesthetics?.structured?.guardrails?.face_visibility === 'prohibited' ||
    aesthetics?.guardrails_face_visibility === 'prohibited' ||
    aesthetics?.faceless_mode === 'hands_only'
  );

  if (isFacelessCropped) {
    effectivePrompt = effectivePrompt
      .replace(/eye-level medium shot showing the room context/gi, 'angled-down chest-down tabletop close-up focused on hands and workspace with blurred room context behind')
      .replace(/\bin a cheerful toast\b/gi, 'resting at tabletop height')
      .replace(/\btoward camera in toast\b/gi, 'gently over the tabletop');
    if (!/\(Framing Lock:/i.test(effectivePrompt)) {
      effectivePrompt = `${effectivePrompt} (Framing Lock: chest-down tabletop close-up framing cropped cleanly below collarbones, upper frame edge below shoulders, camera tilted downward focusing solely on hands and table objects)`;
    }
  }

  return {
```

---

### 3. [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)

#### A. Simpan Metadata Guardrails Faceless di `vso_config_json` (`handleStoryboardRemake`)

**Code Sebelum (Current/Before):**
```js
      resolvedVso = {
        ...aesthetics,
        ...resolvedSnapshot.legacy,
        ...resolvedSnapshot.resolved,
        ...
        resolved_wardrobe_color: lockedColorLabel,
        resolvedWardrobeColor: lockedColorLabel,
        resolved_wardrobe_prompt: lockedWardrobeDesc,
```
```js
  const persistedVsoConfig = (() => {
    try {
      const base = JSON.parse(task.vso_config_json || '{}') || {};
      if (resolvedVso?.resolved_wardrobe_color || resolvedVso?.resolved_wardrobe_prompt) {
        return {
          ...base,
          ...(resolvedVso.resolved_wardrobe_color ? { resolved_wardrobe_color: resolvedVso.resolved_wardrobe_color } : {}),
          ...(resolvedVso.resolved_wardrobe_prompt ? { resolved_wardrobe_prompt: resolvedVso.resolved_wardrobe_prompt } : {})
        };
      }
    } catch (_) {}
    return null;
  })();
```

**Code Sesudah (Proposed/After):**
```js
      resolvedVso = {
        ...aesthetics,
        ...resolvedSnapshot.legacy,
        ...resolvedSnapshot.resolved,
        ...
        resolved_wardrobe_color: lockedColorLabel,
        resolvedWardrobeColor: lockedColorLabel,
        resolved_wardrobe_prompt: lockedWardrobeDesc,
        guardrails_face_visibility: resolvedSnapshot.structured?.guardrails?.face_visibility || '',
        faceless_mode: resolvedSnapshot.structured?.subject?.faceless_mode || '',
```
```js
  const persistedVsoConfig = (() => {
    try {
      const base = JSON.parse(task.vso_config_json || '{}') || {};
      const next = {
        ...base,
        ...(resolvedVso?.resolved_wardrobe_color ? { resolved_wardrobe_color: resolvedVso.resolved_wardrobe_color } : {}),
        ...(resolvedVso?.resolved_wardrobe_prompt ? { resolved_wardrobe_prompt: resolvedVso.resolved_wardrobe_prompt } : {}),
        ...(resolvedVso?.guardrails_face_visibility ? { guardrails_face_visibility: resolvedVso.guardrails_face_visibility } : {}),
        ...(resolvedVso?.faceless_mode ? { faceless_mode: resolvedVso.faceless_mode } : {})
      };
      return next;
    } catch (_) {}
    return null;
  })();
```

#### B. Tambah Positive Framing Lock pada Prompt I2V (`handleVisualGeneration`)

**Code Sebelum (Current/Before):**
```js
      logToMultiplier(`[Multiplier Worker] 🎬 Submitting ${hasStartFrame ? 'I2V (Start Frame)' : 'T2V'} video task for clip ${c}/${prompts.length}${isNoVo ? ` (🔇 No-VO: ${noVoAudioBed})` : (isNativeVeo ? ' (🔊 Native Veo Audio)' : '')}...`);
      const videoResult = await generateVideo({
        prompt: finalPrompt,
```

**Code Sesudah (Proposed/After):**
```js
      const is3dClipI2v = /\b3d\s*(?:bio-cellular|biomedical|cellular|cgi|simulation)\b/i.test(finalPrompt);
      const hasHumanOrHandsI2vCue = /\b(?:hands?|forearms?|sleeves?|wearing|shirt|gamis|tunic|\(Anchor:)\b/i.test(finalPrompt)
        && !/\b(?:unattended standalone still-life|nobody in scene|zero hands)\b/i.test(finalPrompt);
      const isFacelessI2v = (aesthetics.characterConcept || aesthetics.character_concept || 'faceless') === 'faceless'
        && aesthetics.guardrails_face_visibility !== 'allowed'
        && hasHumanOrHandsI2vCue;
      if (isFacelessI2v && !is3dClipI2v) {
        finalPrompt = finalPrompt
          .replace(/\bin a cheerful toast\b/gi, 'over the tabletop')
          .replace(/\btoward camera in toast\b/gi, 'gently over the tabletop');
        if (!/\(Camera Lock:/i.test(finalPrompt)) {
          finalPrompt = `${finalPrompt} (Camera Lock: steady chest-down tabletop framing cropped below collarbones, downward camera angle focused on hands and objects throughout motion)`;
        }
      }

      logToMultiplier(`[Multiplier Worker] 🎬 Submitting ${hasStartFrame ? 'I2V (Start Frame)' : 'T2V'} video task for clip ${c}/${prompts.length}${isNoVo ? ` (🔇 No-VO: ${noVoAudioBed})` : (isNativeVeo ? ' (🔊 Native Veo Audio)' : '')}...`);
      const videoResult = await generateVideo({
        prompt: finalPrompt,
```

---

### 4. Konfigurasi Database VI `vi_mwvkcoc3_24215939` (`visual_identity_presets`)

**Sebelum:**
```json
"camera": {
  "framing": "forearms_and_hands",
  "movement": "subtle_handheld",
  "lens_look": "natural_50mm",
  "perspective": "third_person",
  "depth_of_field": "shallow"
}
```

**Sesudah:**
```json
"camera": {
  "framing": "forearms_and_hands",
  "movement": "subtle_handheld",
  "lens_look": "natural_50mm",
  "perspective": "first_person",
  "depth_of_field": "shallow"
}
```
