# Implementation Plan: Visual Identity Tanpa Manusia (`environment_object_only`) & Mode Video Tanpa VO (`no_vo`)

**Sumber Usulan:** [/Users/sabeqmmursyid/cf-autopipeline/usulan-cf-studio-home-living-no-human-no-vo.md](file:///Users/sabeqmmursyid/cf-autopipeline/usulan-cf-studio-home-living-no-human-no-vo.md)  
**Target Branch Kerja:** `fitur/home-living-no-human-no-vo` (dibuat dari `main` setelah mockup HTML disetujui)  
**Mockup HTML Pra-Eksekusi:** [public/mockup_home_living_no_human_no_vo.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_home_living_no_human_no_vo.html)

---

## Execution Task List

### Tahap 0 — Persiapan & Review Mockup
- [x] Review mockup interaktif [public/mockup_home_living_no_human_no_vo.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_home_living_no_human_no_vo.html) oleh pengguna
- [x] Buat branch `fitur/home-living-no-human-no-vo` dari `main` terbaru

### Tahap 1 — Fondasi Backend & Kontrak Visual Identity (`environment_object_only`)
- [x] Tambah enum `'environment_object_only'`, `POPULATION_MODES: 'none'`, `WARDROBE_MODES: 'not_applicable'`, `CAMERA_FRAMINGS` interior/still life, aturan normalisasi, dan `isEnvironmentObjectOnlyVisualConfig` di [lib/visual-identity-contract.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-contract.js)
- [x] Tambah cabang resolver Zero-Human (`subject_prompt`, `wardrobe_prompt = ''`, anti-human/hand negatives, `legacy.character_concept`) di [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js)
- [x] Tambah mandat ke-3 `ZERO-HUMAN / SPACE & OBJECT ONLY` & sembunyikan blok wardrobe/sleeve di [lib/visual-identity-allocator.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-allocator.js)
- [x] Perbarui [lib/start-frame-visual-qc.js](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js) agar `environment_object_only` wajib `hand_count === 0` dan me-skip penalti `wardrobe_color_match` / `exposed_forearm`

### Tahap 2 — Fondasi Backend Mode Tanpa VO (`no_vo`) & FFmpeg Pipeline
- [x] Tambah `compileVeoAmbientOnlyPrompt` (foley/ambience tanpa dialog & tanpa musik) di [lib/veo-native-audio.js](file:///Users/sabeqmmursyid/_cfstudio/lib/veo-native-audio.js)
- [x] Perbaiki guard skip FFmpeg di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) (baris ~4178 & ~8444) agar `audio_engine_mode` bernilai `'native_veo'` atau `'no_vo'` tetap lanjut ke FFmpeg muxing
- [x] Tambah cabang `isNoVoMode` dan dukungan `no_vo_audio_bed` (`native_sfx_ambience`, `bgm_only`, `native_sfx_plus_bgm`, `silent`) serta `scene.on_screen_text` di [lib/video-studio-processor.js](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js)
- [x] Izinkan konfigurasi `audio_engine_mode`, `no_vo_audio_bed`, `on_screen_text_mode`, `ffmpegSfxVolume`, dan `ffmpegBgmVolume` di [lib/multiplier-audio-config.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-audio-config.js)
- [x] Perbarui [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) & [lib/autonomous-engine.js](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js) untuk memisahkan `no_vo` vs `native_veo`, meneruskan `enable_tts = 0`, `no_vo_audio_bed`, dan `compileVeoAmbientOnlyPrompt`
- [x] Longgarkan validasi `voiceover_text` saat `audio_engine_mode === 'no_vo'` di [lib/custom-storyboard-pipeline.js](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js)
- [x] Tambah aturan *Action Translation (Zero-Human)* dan *No-VO Visual Storytelling* di [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildReverseEngineeringPrompt`, `buildOrganicPillarPrompt`, `buildCustomStoryboardPromptEngineerPrompt`, `buildMultiplierPhase2Prompt`)

### Tahap 3 — Preset Sistem, UI & Skema MCP
- [x] Tambah preset sistem VI `home_living_serene_interior` dan `home_living_product_still_life` di [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js)
- [x] Tambah dukungan `no_vo` & preset `multiplier_home_living_no_vo_asmr` di [lib/operator-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js)
- [x] Perbarui UI [app/settings/visual-identities/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/visual-identities/page.js) & [app/components/AiVisualIdentityBuilderModal.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/AiVisualIdentityBuilderModal.js) untuk `environment_object_only`
- [x] Perbarui UI [app/settings/presets/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js) dengan opsi `🔇 Mode 3: Tanpa VO`, audio bed, dan filter chip
- [x] Tambah override `audio_engine_mode`, `no_vo_audio_bed`, dan `on_screen_text_mode` di [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js) & [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js)
- [x] Ganti kontrol `enable_tts` menjadi selector 3 mode di [PillarConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/PillarConfigurationForm.js), [MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js), [app/pillar-campaigns/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js), dan [app/pillar-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/%5Bid%5D/page.js)
- [x] Perbarui skema tool MCP di [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) (`cf_run_auto_pipeline`, `cf_create_schedule`, `cf_update_schedule`, `cf_submit_custom_storyboard`, `cf_create_multiplier_video`, `cf_create_product_video`, `cf_create_visual_identity`)

### Tahap 4 — Verifikasi Unit Test, Build & Deploy Dev
- [x] Tambah dan jalankan unit test VI `environment_object_only` & mode `no_vo` (`PG_SEARCH_PATH=dev node --test ...`)
- [x] Jalankan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`
- [ ] Push branch `fitur/home-living-no-human-no-vo`, deploy ke **Dev (`5020/7020`)**, dan uji E2E 1 kampanye Home Living

---

## Rincian Perubahan Kode (Code Sebelum & Sesudah)

### 1. [lib/visual-identity-contract.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-contract.js)

**Code Sebelum (Current/Before):**
```js
export const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object', 'stylized_3d_character', 'stylized_cartoon_character'];
...
export const POPULATION_MODES = ['single', 'group', 'crowd', 'single_group_or_crowd'];
...
export const WARDROBE_MODES = ['fixed', 'sequential', 'stable_random', 'custom'];
...
export const CAMERA_FRAMINGS = [
  'hands_closeup',
  'forearms_and_hands',
  'crop_below_neck',
  'back_view',
  'full_body_blank_face',
  'object_or_animal',
  'editorial_wide',
  'environmental_wide',
  'isometric',
  'top_down_system',
  'silhouette_profile',
  'over_shoulder_faceless',
  'extreme_scale_metaphor'
];
```
*(Serta `validateAndNormalizeVisualIdentity` baris 331–390 yang memaksa `character_count >= 1`, `wardrobe.sleeve_policy = 'wrists_covered'`, dan `camera.framing = 'forearms_and_hands'`.)*

**Code Sesudah (Proposed/After):**
```js
export const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object', 'stylized_3d_character', 'stylized_cartoon_character', 'environment_object_only'];
export const POPULATION_MODES = ['single', 'group', 'crowd', 'single_group_or_crowd', 'none'];
export const WARDROBE_MODES = ['fixed', 'sequential', 'stable_random', 'custom', 'not_applicable'];
export const CAMERA_FRAMINGS = [
  'hands_closeup', 'forearms_and_hands', 'crop_below_neck', 'back_view',
  'full_body_blank_face', 'object_or_animal', 'editorial_wide', 'environmental_wide',
  'interior_showcase', 'product_still_life', 'top_down_flatlay', 'before_after_frame',
  'isometric', 'top_down_system', 'silhouette_profile', 'over_shoulder_faceless', 'extreme_scale_metaphor'
];

// Dalam validateAndNormalizeVisualIdentity:
if (result.subject.kind === 'environment_object_only') {
  result.subject.faceless_mode = 'not_applicable';
  result.subject.demographic_key = 'not_applicable';
  result.subject.character_count = 0;
  result.subject.population_mode = 'none';
  result.wardrobe = {
    mode: 'not_applicable',
    preset_key: 'not_applicable',
    sleeve_policy: 'not_applicable',
    custom_description: '',
    accessories: [],
    palette: []
  };
  result.metaphor_engine.hands_policy = 'zero_hands';
  result.guardrails = {
    ...result.guardrails,
    human_presence: 'prohibited',
    hands_visibility: 'prohibited',
    face_visibility: 'prohibited',
    reflection_face: 'prohibited',
    unintended_people: 'prohibited',
    extra_people: 'prohibited',
    intentional_crowd: 'prohibited',
    wardrobe_drift: 'not_applicable'
  };
  const humanOnlyFramings = ['forearms_and_hands', 'hands_closeup', 'back_view', 'crop_below_neck'];
  if (!result.camera.framing || humanOnlyFramings.includes(result.camera.framing)) {
    result.camera.framing = result.camera.lens_look === 'macro_closeup' ? 'object_or_animal' : 'environmental_wide';
  }
}

export function isEnvironmentObjectOnlyVisualConfig({ campaign = null, row = null, visualOverrides = null, structured = null } = {}) {
  const resolvedStructured = structured || safeParseVoJson(visualOverrides)?.structured || safeParseVoJson(visualOverrides)
    || safeParseVoJson(campaign?.visual_overrides_json)?.structured || safeParseVoJson(row?.visual_overrides_json)?.structured || null;
  return String(resolvedStructured?.subject?.kind || '').trim().toLowerCase() === 'environment_object_only';
}
```

---

### 2. [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js)

**Code Sebelum (Current/Before):**
```js
  // 3. Resolve Wardrobe Prompt
  let wardrobePrompt = 'wearing clean attire';
  if (config.wardrobe?.preset_key === 'not_applicable') {
    wardrobePrompt = (config.wardrobe.custom_description && config.wardrobe.custom_description.trim())
      ? config.wardrobe.custom_description.trim()
      : 'not applicable (natural character surface finish only, no human clothing)';
  } ...
  // 6. Resolve Camera Prompt
  let defaultFraming = 'forearms_and_hands';
  ...
  // 8. Resolve Negative Prompt
  const defaultNegatives = (isFaceAllowed || isCartoonOrStylized)
    ? ['photorealistic human face', ...]
    : isMascot
      ? ['ugly', 'deformed', ...]
      : ['visible human face', 'eyes', 'nose', 'mouth', 'human portrait', 'unintended people'];
  ...
  const legacy = {
    character_concept: isMascot ? 'mascot' : (isCartoonOrStylized ? 'stylized_3d' : 'faceless'),
```

**Code Sesudah (Proposed/After):**
```js
  const isEnvironmentOnly = config.subject?.kind === 'environment_object_only';
  if (isEnvironmentOnly) {
    const customDesc = config.subject?.custom_description?.trim();
    subjectPrompt = customDesc
      ? `Strictly zero humans, zero people, zero hands, zero fingers, zero arms, zero human silhouettes. Pure architectural space and physical object cinematography: ${customDesc}`
      : 'Strictly zero humans, zero people, zero hands, zero fingers, zero arms, zero human silhouettes. Focus 100% on calm interior rooms, furniture, surfaces, and physical home-living objects/products in place.';
  }
  ...
  if (isEnvironmentOnly) {
    wardrobePrompt = '';
  }
  ...
  if (isEnvironmentOnly) {
    defaultFraming = config.camera?.framing || 'environmental_wide';
    defaultPerspective = config.camera?.perspective || 'third_person';
  }
  ...
  const defaultNegatives = isEnvironmentOnly
    ? ['human', 'person', 'people', 'hands', 'hand', 'fingers', 'arms', 'forearms', 'wrists', 'body parts', 'human silhouette', 'shadow of person', 'face', 'eyes', 'portrait', 'clothing', 'sleeves', 'mannequin', 'reflected person']
    : ((isFaceAllowed || isCartoonOrStylized) ? [...] : isMascot ? [...] : [...]);
  ...
  character_concept: isEnvironmentOnly ? 'environment_object_only' : (isMascot ? 'mascot' : (isCartoonOrStylized ? 'stylized_3d' : 'faceless')),
```

---

### 3. [lib/visual-identity-allocator.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-allocator.js)

**Code Sebelum (Current/Before):**
```js
  const isStylizedChar = ...;
  const isFacelessMandate = !isStylizedChar;
  ...
  const wardrobeDesc = (!isFacelessMandate || wardrobe.preset_key === 'not_applicable')
    ? (wardrobe.custom_description || 'natural character surface finish only (no human clothing)')
    : ...;
  const charConceptDesc = isFacelessMandate
    ? 'STRICTLY FACELESS (Semua figur manusia tampil tanpa mata/hidung/mulut, atau dari sudut belakang/siluet/potong siku ke bawah).'
    : 'FULL 3D STYLIZED ANIMATED CHARACTER (...)';
```

**Code Sesudah (Proposed/After):**
```js
  const isEnvironmentOnly = subjectKindLower === 'environment_object_only';
  const isStylizedChar = !isEnvironmentOnly && (...);
  const isFacelessMandate = !isStylizedChar && !isEnvironmentOnly;
  ...
  const wardrobeDesc = isEnvironmentOnly
    ? ''
    : ((!isFacelessMandate || wardrobe.preset_key === 'not_applicable') ? ... : ...);
  const charConceptDesc = isEnvironmentOnly
    ? 'ZERO-HUMAN / SPACE & OBJECT ONLY MANDATE (Dilarang memunculkan manusia, bagian tubuh, tangan, jari, lengan, punggung, siluet, maupun bayangan orang di seluruh klip T2I/I2V/T2V).'
    : (isFacelessMandate ? 'STRICTLY FACELESS (...)' : 'FULL 3D STYLIZED ANIMATED CHARACTER (...)');
```

---

### 4. [lib/start-frame-visual-qc.js](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js)

**Code Sebelum (Current/Before):**
```js
  const handRule = expectsObjectOnly
    ? 'Opening hook frame MUST have 0 human hands, fingers, or arms (hand_count MUST be 0). Flag exposed_forearm=true or reasons if any hand/arm appears.'
    : ...;
  const wardrobeRule = (handsPolicy === 'modest_hands_active' && !expectsObjectOnly)
    ? `Expected solid plain sleeves ...`
    : 'Object-only or no locked wardrobe: set wardrobe_color_match=true.';
```

**Code Sesudah (Proposed/After):**
```js
  const isEnvOnly = Boolean(environmentOnly) || isEnvironmentObjectOnlyVisualConfig({ campaign, row });
  const handRule = isEnvOnly
    ? 'ZERO-HUMAN VISUAL IDENTITY: EVERY frame MUST have 0 humans, 0 hands, 0 fingers, 0 arms, and 0 human silhouettes (hand_count MUST be 0). Fail immediately if any human/body part is detected with hint: "Remove all humans, hands, arms, and body parts; show only the empty interior room and physical product/objects."'
    : (expectsObjectOnly ? ... : ...);
  const wardrobeRule = isEnvOnly
    ? 'Environment/object only VI: no humans or wardrobe expected; set wardrobe_color_match=true and skip exposed_forearm/wardrobe checks.'
    : ...;
```

---

### 5. [lib/veo-native-audio.js](file:///Users/sabeqmmursyid/_cfstudio/lib/veo-native-audio.js)

**Code Sebelum (Current/Before):**
```js
export function compileVeoNativeAudioPrompt({
  basePrompt,
  narrationText = '',
  persona = 'Kore',
  language = 'id-ID',
  withSfx = true,
  withAmbience = true,
  antiMusic = true
}) { ... }
```

**Code Sesudah (Proposed/After):**
```js
export function compileVeoAmbientOnlyPrompt({
  basePrompt,
  sfxCue = '',
  withSfx = true,
  withAmbience = true,
  antiMusic = true
}) {
  if (!basePrompt) return '';
  const cleanBase = basePrompt.replace(/\s*Audio direction:[\s\S]*$/i, '').trim();
  const cueText = String(sfxCue || '').trim();
  const directives = [
    `AUDIO DIRECTION: Pure natural room ambience and tactile object foley only${cueText ? ` (${cueText})` : ''}. STRICTLY ZERO spoken words, ZERO voiceover, ZERO narration, ZERO human speech${antiMusic ? ', ZERO background music' : ''}.`
  ];
  if (withSfx && cueText) directives.push(`[SFX] Subtle physical room/object sound event: ${cueText}.`);
  if (withAmbience) directives.push('[AMBIENCE] Quiet natural residential room tone without human voices.');
  return `${cleanBase}\n\nAudio direction:\n${directives.join('\n')}`;
}
```

---

### 6. [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js)

**Code Sebelum (Current/Before — baris ~4178 & ~8444):**
```js
  if (campaign.enable_glabs === 0 || campaign.enable_tts === 0) {
    updateReCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      social_post_status: finalSocialPostStatus
    });
    return { processed: true, item_id: item.id, message: `Workflow dependencies (G-Labs/TTS) are inactive. Skipped FFmpeg stage. Social posting set to ${finalSocialPostStatus}.` };
  }
```
*(Sama pada baris 8444 untuk `updatePillarCampaignItem`.)*

**Code Sesudah (Proposed/After — diekstrak ke helper atau kondisi seragam di kedua fungsi):**
```js
  const isTtsOptionalMode = ['native_veo', 'no_vo'].includes(campaign.audio_engine_mode);
  if (campaign.enable_glabs === 0 || (campaign.enable_tts === 0 && !isTtsOptionalMode)) {
    updateReCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      social_post_status: finalSocialPostStatus
    });
    return { processed: true, item_id: item.id, message: `Workflow dependencies (G-Labs/TTS) are inactive. Skipped FFmpeg stage. Social posting set to ${finalSocialPostStatus}.` };
  }
```
*(Demikian pula untuk cabang Pillar Campaign pada baris 8444; serta pastikan stage TTS di processor RE & Pillar men-skip TTS saat `audio_engine_mode === 'no_vo'` tanpa error.)*

---

### 7. [lib/video-studio-processor.js](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js)

**Code Sebelum (Current/Before):**
```js
  const isNativeVeoAudio = Boolean(jobConfig.audioEngineMode === 'native_veo' || jobConfig.isNativeVeo || (!hasAudioFile && anyVideoHasAudio));
```

**Code Sesudah (Proposed/After):**
```js
  const isNoVoMode = jobConfig.audioEngineMode === 'no_vo';
  const noVoAudioBed = jobConfig.noVoAudioBed || 'native_sfx_ambience';
  const useVeoVideoAudio = isNoVoMode
    ? ['native_sfx_ambience', 'native_sfx_plus_bgm'].includes(noVoAudioBed) && anyVideoHasAudio
    : Boolean(jobConfig.audioEngineMode === 'native_veo' || jobConfig.isNativeVeo || (!hasAudioFile && anyVideoHasAudio));
  // Ketika isNoVoMode === true:
  // - Nonaktifkan speed-stretch berbasis panjang TTS (smart_sync)
  // - silent / bgm_only (tanpa BGM file): fallback anullsrc + mix BGM sesuai ffmpegBgmVolume jika ada
  // - native_sfx_ambience / native_sfx_plus_bgm: pakai stream audio klip Veo + BGM bila tersedia
  // - Overlay motion text: baca dari scene.on_screen_text ketika onScreenTextMode !== 'off'
```

---

### 8. [lib/multiplier-audio-config.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-audio-config.js)

**Code Sebelum (Current/Before):**
```js
  const enableTts = raw.enable_tts !== undefined ? Boolean(raw.enable_tts) : (raw.enableTts !== undefined ? Boolean(raw.enableTts) : true);
  ...
  const ffmpegSfxVolume = 0.00;
  const ffmpegBgmVolume = 0.00;
```

**Code Sesudah (Proposed/After):**
```js
  const audioEngineMode = raw.audio_engine_mode || raw.audioEngineMode || 'minimax_tts';
  const noVoAudioBed = raw.no_vo_audio_bed || raw.noVoAudioBed || 'native_sfx_ambience';
  const onScreenTextMode = raw.on_screen_text_mode || raw.onScreenTextMode || 'short_caption_overlay';
  const enableTts = audioEngineMode === 'no_vo' || audioEngineMode === 'native_veo'
    ? false
    : (raw.enable_tts !== undefined ? Boolean(raw.enable_tts) : (raw.enableTts !== undefined ? Boolean(raw.enableTts) : true));
  const ffmpegSfxVolume = raw.ffmpeg_sfx_volume !== undefined ? Number(raw.ffmpeg_sfx_volume) : (raw.ffmpegSfxVolume !== undefined ? Number(raw.ffmpegSfxVolume) : 0.00);
  const ffmpegBgmVolume = raw.ffmpeg_bgm_volume !== undefined ? Number(raw.ffmpeg_bgm_volume) : (raw.ffmpegBgmVolume !== undefined ? Number(raw.ffmpegBgmVolume) : 0.00);
```

---

### 9. [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) & [lib/autonomous-engine.js](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js)

**Code Sebelum (Current/Before — `lib/re-multiplier-worker.js` baris ~1066 & ~1319):**
```js
  const isNativeVeo = audioConfig.audio_engine_mode === 'native_veo' || vsoConfig.audio_engine_mode === 'native_veo' || audioConfig.enableTts === 0 || audioConfig.enable_tts === false;
  ...
  const isNativeVeo = audioConfig.audio_engine_mode === 'native_veo' || aesthetics.audio_engine_mode === 'native_veo';
  if (isNativeVeo) { ... compileVeoNativeAudioPrompt(...); }
```

**Code Sesudah (Proposed/After — `lib/re-multiplier-worker.js`):**
```js
  const audioMode = audioConfig.audio_engine_mode || vsoConfig.audio_engine_mode || 'minimax_tts';
  const isNoVo = audioMode === 'no_vo';
  const isNativeVeo = audioMode === 'native_veo';
  if (isNoVo || isNativeVeo || audioConfig.enableTts === 0 || audioConfig.enable_tts === false) {
    // Skip TTS eksternal; tandai skipped atau generating_visuals
  }
  ...
  const noVoBed = audioConfig.no_vo_audio_bed || aesthetics.no_vo_audio_bed || 'native_sfx_ambience';
  const wantVeoAudio = isNativeVeo || (isNoVo && ['native_sfx_ambience', 'native_sfx_plus_bgm'].includes(noVoBed));
  if (isNoVo && wantVeoAudio) {
    const { compileVeoAmbientOnlyPrompt } = await import('./veo-native-audio.js');
    finalPrompt = compileVeoAmbientOnlyPrompt({
      basePrompt: expectedPrompt,
      sfxCue: storyboard[c - 1]?.ambient_sfx_cue || '',
      withSfx: true,
      withAmbience: true,
      antiMusic: audioConfig.anti_music_guardrail !== undefined ? Boolean(audioConfig.anti_music_guardrail) : true
    });
  } else if (isNativeVeo && clipNarration) {
    finalPrompt = compileVeoNativeAudioPrompt(...);
  }
  // Kirim noSoundOverride: wantVeoAudio
```

**Code Sebelum (Current/Before — `lib/autonomous-engine.js` baris ~1239–1240):**
```js
  const effectiveAudioEngineMode = overrides?.audio_engine_mode || overrides?.audio?.audio_engine_mode || presetConfig?.workflow?.audio_engine_mode || presetConfig?.basic_strategy?.audio_engine_mode || 'minimax_tts';
  const isMultiplierNativeVeo = effectiveAudioEngineMode === 'native_veo';
  ...
    enableTts: isMultiplierNativeVeo ? 0 : 1,
    enable_tts: !isMultiplierNativeVeo,
```

**Code Sesudah (Proposed/After — `lib/autonomous-engine.js` di seluruh jalur product, editorial, & multiplier):**
```js
  const effectiveAudioEngineMode = overrides?.audio_engine_mode || overrides?.audio?.audio_engine_mode || presetConfig?.workflow?.audio_engine_mode || presetConfig?.basic_strategy?.audio_engine_mode || 'minimax_tts';
  const isNoVo = effectiveAudioEngineMode === 'no_vo';
  const isMultiplierNativeVeo = effectiveAudioEngineMode === 'native_veo';
  const noVoAudioBed = overrides?.no_vo_audio_bed || presetConfig?.workflow?.no_vo_audio_bed || 'native_sfx_ambience';
  const onScreenTextMode = overrides?.on_screen_text_mode || presetConfig?.workflow?.on_screen_text_mode || 'short_caption_overlay';
  const shouldDisableTts = isMultiplierNativeVeo || isNoVo || presetConfig?.workflow?.enable_tts === false;
  ...
    enableTts: shouldDisableTts ? 0 : 1,
    enable_tts: !shouldDisableTts,
    no_vo_audio_bed: noVoAudioBed,
    on_screen_text_mode: onScreenTextMode,
```

---

### 10. [lib/custom-storyboard-pipeline.js](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js)

**Code Sebelum (Current/Before):**
```js
  for (let i = 0; i < rawScenes.length; i++) {
    const s = rawScenes[i] || {};
    if (!String(s.voiceover_text || '').trim()) {
      throw new Error(`Scene #${i + 1} wajib mengisi voiceover_text.`);
    }
    ...
  }
  ...
  const enableTts = isNativeVeo ? 0 : (pWorkflow.enable_tts !== undefined ? (pWorkflow.enable_tts ? 1 : 0) : 1);
```

**Code Sesudah (Proposed/After):**
```js
  const requestedAudioMode = storyboard.audio_engine_mode || rawDna.audio_engine_mode || pWorkflow.audio_engine_mode || pBasic.audio_engine_mode || 'minimax_tts';
  const isNoVo = requestedAudioMode === 'no_vo';
  for (let i = 0; i < rawScenes.length; i++) {
    const s = rawScenes[i] || {};
    if (!isNoVo && !String(s.voiceover_text || '').trim()) {
      throw new Error(`Scene #${i + 1} wajib mengisi voiceover_text.`);
    }
    ...
  }
  ...
  const enableTts = (isNativeVeo || isNoVo) ? 0 : (pWorkflow.enable_tts !== undefined ? (pWorkflow.enable_tts ? 1 : 0) : 1);
  // Simpan on_screen_text & ambient_sfx_cue pada normalisasi scenes
```

---

### 11. [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js)

**Code Sebelum (Current/Before):**
```js
// buildReverseEngineeringPrompt (baris 1175-1179) & buildMultiplierPhase2Prompt (baris 3997-4056):
1. Konsep Karakter  : ${targetConcept} ...
2. Demografi Subjek : ${targetCharacter}
3. Pakaian / Wardrobe: ${targetWardrobe}
4. Pencahayaan / Light: ${targetLighting}
5. KONSISTENSI WARDROBE WAJIB ...
```

**Code Sesudah (Proposed/After):**
```js
// Bila isEnvironmentOnly === true (environment_object_only):
// - Sembunyikan baris Wardrobe & WARDROBE CONSISTENCY.
// - Suntikkan blok ZERO-HUMAN ACTION TRANSLATION RULE (Deconstruct -> Zero-Human):
//   • Tangan menata/merapikan -> Before-After kontras ruang statis / slow pan
//   • Tangan memegang produk -> Hero Product Staging + camera push-in
//   • Tangan mengoperasikan alat -> gerak mekanis/lingkungan mandiri (tanpa "a hand picks up" / "holding")
// Bila audio_engine_mode === 'no_vo':
// - Ganti aturan WPC/Breathless Syntax dengan NO-VO VISUAL STORYTELLING CONTRACT:
//   • Isi new_vo / narration_transcript = ""
//   • Outputkan on_screen_text (maks 3-7 kata) & ambient_sfx_cue (foley ruangan bahasa Inggris)
```

---

### 12. [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js) & [lib/operator-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js)

**Code Sebelum (Current/Before):**
- `lib/visual-identity-system-presets.js` belum memiliki preset `subject.kind: 'environment_object_only'`.
- `lib/operator-presets.js` belum memiliki preset `multiplier_home_living_no_vo_asmr`.

**Code Sesudah (Proposed/After):**
- Tambah `home_living_serene_interior` dan `home_living_product_still_life` di `SYSTEM_VISUAL_IDENTITIES` dengan `subject.kind: 'environment_object_only'` dan `wardrobe.mode: 'not_applicable'`.
- Tambah `multiplier_home_living_no_vo_asmr` (`campaign_kinds: ['multiplier_campaign', 'product_campaign']`, `audio_engine_mode: 'no_vo'`, `no_vo_audio_bed: 'native_sfx_ambience'`, `visual_identity_preset_id: 'home_living_serene_interior'`) di `OPERATOR_PRESETS`.

---

### 13. UI & MCP (`app/settings/*`, `app/auto-pipeline/page.js`, `app/components/campaign-forms/*`, `app/pillar-campaigns/*`, `apps/mcp/tools.mjs`)

**Code Sebelum (Current/Before):**
- [app/settings/visual-identities/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/visual-identities/page.js) & `AiVisualIdentityBuilderModal.js`: selalu merender field demographic & wardrobe.
- [app/settings/presets/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js) baris 1249–1301: grid 2 kartu `minimax_tts` vs `native_veo`; filter chip hanya `native_veo`.
- [PillarConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/PillarConfigurationForm.js) baris 389 & 642: `enable_tts: true` / checkbox tunggal.
- [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) baris 1106: `voiceover_text: z.string().trim().min(1)`.

**Code Sesudah (Proposed/After):**
- Form VI menyembunyikan section *Demographic / Faceless Mode / Wardrobe / Sleeve Policy / Character Lock* ketika `subject.kind === 'environment_object_only'`.
- Form Preset Manager menjadi grid 3 kartu termasuk **`🔇 Mode 3: Tanpa VO (Visual / ASMR)`** + sub-opsi `no_vo_audio_bed` & `on_screen_text_mode` + filter chip `🔇 Tanpa VO`.
- Auto Pipeline (1-Click & Schedule Modal), `PillarConfigurationForm.js`, `MultiplierConfigurationForm.js`, dan `app/pillar-campaigns/[id]/page.js` memakai selector 3 mode `audio_engine_mode` + badge `🔇 Tanpa VO` / status `Dilewati (Mode Tanpa VO)`.
- [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js) meneruskan `audio_engine_mode`, `no_vo_audio_bed`, dan `on_screen_text_mode` dari `pipeline_config_json` ke `autonomous-engine.js`.
- [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) menerima `voiceover_text` kosong bila `audio_engine_mode === 'no_vo'` serta menambahkan parameter `audio_engine_mode`, `no_vo_audio_bed`, dan `on_screen_text_mode` pada tool pipeline/schedule/campaign.
