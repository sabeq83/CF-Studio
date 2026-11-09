# Rencana Implementasi: Penyelarasan Aliran 100% Parameter Preset pada 4 Tipe Video Auto Pipeline

## Latar Belakang & Tujuan
Menjamin bahwa seluruh konfigurasi yang telah disimpan oleh pengguna di dalam Operator Preset (Strategi Suara & Naskah, Mesin Visual, Bridging Produk, Visual Identity V2, serta Finishing Subtitel & Transisi) mengalir 100% tanpa ada satu pun parameter yang tercecer, di-drop, atau diganti sepihak oleh sistem di ke-4 tipe video Auto Pipeline (`recipe_campaign`, `product_campaign`, `editorial_campaign`, dan `multiplier_campaign`).

Kasus kegagalan pada `mul_261109_r0a20o` (di mana visual menghasilkan tangan wanita bergamis syari di dapur marmer putih padahal preset memakai `multiplier_siasatsehat` yang bertema biohacking klinis 3D) diatasi secara permanen melalui arsitektur terpadu ini.

---

## Execution Task List
- [x] Task 1: Pembuatan Simulasi UI Standalone Mockup (`public/mockup_auto_pipeline_preset_audit.html`)
- [x] Task 2: Refaktorisasi `lib/autonomous-engine.js` (Aliran Penuh 5 Gerbong Preset untuk 4 Tipe Video)
- [x] Task 3: Pembaruan `lib/re-multiplier-worker.js` (Failsafe Auto-Healing VI & Injeksi Finishing Subtitel/Transisi ke FFmpeg)
- [x] Task 4: Perbaikan Forwarding Parameter di `app/api/v2/recipes/autonomous-pipeline/route.js` & `lib/auto-pipeline-scheduler-runner.js`
- [x] Task 5: Sinkronisasi Modal 1-Klik & Modal Schedule di `app/auto-pipeline/page.js`
- [x] Task 6: Pembuatan & Eksekusi Unit Test Verifikasi (`tests/test-autonomous-preset-pipeline.test.js`)
- [x] Task 7: Prosedur Rilis Non-Interaktif & Auto Git Sync

---

## Detailed Before & After Code Snippets

### 1. `lib/autonomous-engine.js` (Multiplier Engine & VI / Workflow Resolution)

#### Code Sebelum (Current/Before):
```javascript
// Baris 746-754:
  let presetConfig = null;
  if (presetKey) {
    try {
      const { resolveOperatorPreset } = await import('./operator-presets.js');
      presetConfig = resolveOperatorPreset(presetKey, {}, tenantId);
    } catch (err) {
      console.warn(`[Autonomous Multiplier Pipeline] Warning resolving preset ${presetKey}:`, err.message);
    }
  }

// Baris 867-883:
  const vsoConfig = {
    is_vso_active: true,
    character_concept: 'faceless',
    visual_style_preset: effectiveVisualStyle,
    visualStyle: effectiveVisualStyle,
    execution_mode: executionMode,
    approval_mode: executionMode === 'full_autopilot' ? 'auto' : 'manual',
    clip_duration: effectiveClipDuration,
    clipDuration: effectiveClipDuration,
    narrative_mode: effectiveNarrativeMode,
    narrativeMode: effectiveNarrativeMode,
    words_per_clip: effectiveWordsPerClip,
    wordsPerClip: effectiveWordsPerClip,
    mandatoryOutroLine: effectiveMandatoryOutro,
    preset_key: presetKey,
    ...overrides.vso
  };
```

#### Code Sesudah (Proposed/After):
```javascript
  // 1b. Resolve Operator Preset Async (Tenant-Safe & Reliable)
  let presetConfig = null;
  if (presetKey) {
    try {
      const { getOperatorPresetConfigAsync, getOperatorPresetConfig } = await import('./operator-presets.js');
      presetConfig = await getOperatorPresetConfigAsync(presetKey, tenantId);
      if (!presetConfig) presetConfig = getOperatorPresetConfig(presetKey, tenantId);
    } catch (err) {
      console.warn(`[Autonomous Multiplier Pipeline] Warning resolving preset ${presetKey}:`, err.message);
    }
  }

  // Resolusi Visual Identity Otoritatif
  let selectedVi = overrides?.visual_identity_preset_id;
  const presetViId = presetConfig?.visual_swap?.visual_identity_preset_id;
  if (!selectedVi && presetViId) {
    selectedVi = presetViId;
  }
  if (!selectedVi && brand?.id) {
    try {
      const { listVisualIdentityPresetsForBrand } = await import('./visual-override-resolver.js');
      const brandVis = await listVisualIdentityPresetsForBrand(brand.id);
      if (brandVis?.length > 0) selectedVi = brandVis[0].id;
    } catch (_) {}
  }

  // Resolusi Workflow Finishing (Subtitel & Transisi)
  const effectiveEnableMotionText = overrides?.enable_motion_text !== undefined
    ? (overrides.enable_motion_text ? 1 : 0)
    : (presetConfig?.workflow?.enable_motion_text !== undefined ? (presetConfig.workflow.enable_motion_text ? 1 : 0) : 1);
  const effectiveMotionTextStyle = overrides?.motion_text_style || presetConfig?.workflow?.motion_text_style || 'floating_white_yellow';
  const effectiveMotionTextPosition = overrides?.motion_text_position || presetConfig?.workflow?.motion_text_position || 'bottom';
  const effectiveVideoTransition = overrides?.video_transition || presetConfig?.workflow?.video_transition || 'fade';
  const effectiveTransitionDuration = Number(
    overrides?.transition_duration !== undefined ? overrides.transition_duration : (presetConfig?.workflow?.transition_duration !== undefined ? presetConfig.workflow.transition_duration : 0.5)
  );

  const vsoConfig = {
    is_vso_active: true,
    visual_identity_preset_id: selectedVi,
    character_concept: 'faceless',
    visual_style_preset: effectiveVisualStyle,
    visualStyle: effectiveVisualStyle,
    execution_mode: executionMode,
    approval_mode: executionMode === 'full_autopilot' ? 'auto' : 'manual',
    clip_duration: effectiveClipDuration,
    clipDuration: effectiveClipDuration,
    narrative_mode: effectiveNarrativeMode,
    narrativeMode: effectiveNarrativeMode,
    words_per_clip: effectiveWordsPerClip,
    wordsPerClip: effectiveWordsPerClip,
    mandatoryOutroLine: effectiveMandatoryOutro,
    preset_key: presetKey,
    enable_motion_text: effectiveEnableMotionText,
    motion_text_style: effectiveMotionTextStyle,
    motion_text_position: effectiveMotionTextPosition,
    video_transition: effectiveVideoTransition,
    transition_duration: effectiveTransitionDuration,
    ...overrides.vso
  };
```

---

### 2. `lib/re-multiplier-worker.js` (Failsafe Auto-Healing & Finishing Muxing)

#### Code Sebelum (Current/Before):
```javascript
// Baris 363:
  const targetPresetId = aesthetics.visual_identity_preset_id || aesthetics.visualIdentity?.preset_id;

// Baris 1202-1215:
  await processTtsStudioMuxing({
    id: `multiplier_${task.id}`,
    batchId: task.tts_batch_id || task.id,
    videoPath: JSON.stringify(glabsVideoUrls),
    syncOption: audioConfig.ffmpegSyncOption || audioConfig.ffmpeg_sync_option || 'smart_sync',
    bgmPath: audioConfig.ffmpegBgmPath || audioConfig.ffmpeg_bgm_path || null,
    bgmVolume: audioConfig.ffmpegBgmVolume !== undefined ? audioConfig.ffmpegBgmVolume : (audioConfig.ffmpeg_bgm_volume !== undefined ? audioConfig.ffmpeg_bgm_volume : 0.00),
    sfxVolume: audioConfig.ffmpegSfxVolume !== undefined ? audioConfig.ffmpegSfxVolume : (audioConfig.ffmpeg_sfx_volume !== undefined ? audioConfig.ffmpeg_sfx_volume : 0.00),
    videoScale: audioConfig.ffmpegVideoScale !== undefined ? audioConfig.ffmpegVideoScale : (audioConfig.ffmpeg_video_scale !== undefined ? audioConfig.ffmpeg_video_scale : 1.1),
    outputPath: finalOutputDiskPath,
    brandName: task.account_name || 'Brand'
  });
```

#### Code Sesudah (Proposed/After):
```javascript
  // Auto-healing VI lookup jika targetPresetId kosong
  let targetPresetId = aesthetics.visual_identity_preset_id || aesthetics.visualIdentity?.preset_id;
  if (!targetPresetId && aesthetics.preset_key) {
    try {
      const { getOperatorPresetConfigAsync } = await import('./operator-presets.js');
      const pCfg = await getOperatorPresetConfigAsync(aesthetics.preset_key, task.tenant_id);
      if (pCfg?.visual_swap?.visual_identity_preset_id) {
        targetPresetId = pCfg.visual_swap.visual_identity_preset_id;
      }
    } catch (_) {}
  }
  if (!targetPresetId && effectiveBrandId) {
    try {
      const { listVisualIdentityPresetsForBrand } = await import('./visual-override-resolver.js');
      const bVis = await listVisualIdentityPresetsForBrand(effectiveBrandId);
      if (bVis?.length > 0) targetPresetId = bVis[0].id;
    } catch (_) {}
  }

  // Forwarding Motion Text & Video Transition ke FFmpeg Muxing
  await processTtsStudioMuxing({
    id: `multiplier_${task.id}`,
    batchId: task.tts_batch_id || task.id,
    videoPath: JSON.stringify(glabsVideoUrls),
    syncOption: audioConfig.ffmpegSyncOption || audioConfig.ffmpeg_sync_option || 'smart_sync',
    bgmPath: audioConfig.ffmpegBgmPath || audioConfig.ffmpeg_bgm_path || null,
    bgmVolume: audioConfig.ffmpegBgmVolume !== undefined ? audioConfig.ffmpegBgmVolume : (audioConfig.ffmpeg_bgm_volume !== undefined ? audioConfig.ffmpeg_bgm_volume : 0.00),
    sfxVolume: audioConfig.ffmpegSfxVolume !== undefined ? audioConfig.ffmpegSfxVolume : (audioConfig.ffmpeg_sfx_volume !== undefined ? audioConfig.ffmpeg_sfx_volume : 0.00),
    videoScale: audioConfig.ffmpegVideoScale !== undefined ? audioConfig.ffmpegVideoScale : (audioConfig.ffmpeg_video_scale !== undefined ? audioConfig.ffmpeg_video_scale : 1.0),
    enableMotionText: audioConfig.enable_motion_text !== undefined ? audioConfig.enable_motion_text : (aesthetics.enable_motion_text !== undefined ? aesthetics.enable_motion_text : 1),
    motionTextStyle: audioConfig.motion_text_style || aesthetics.motion_text_style || 'floating_white_yellow',
    motionTextPosition: audioConfig.motion_text_position || aesthetics.motion_text_position || 'bottom',
    videoTransition: audioConfig.video_transition || aesthetics.video_transition || 'fade',
    transitionDuration: Number(audioConfig.transition_duration !== undefined ? audioConfig.transition_duration : (aesthetics.transition_duration !== undefined ? aesthetics.transition_duration : 0.5)),
    outputPath: finalOutputDiskPath,
    brandName: task.account_name || 'Brand'
  });
```

---

### 3. `app/api/v2/recipes/autonomous-pipeline/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 194-198:
        overrides: {
          ...affiliateOverride,
          ...recipeOverride,
          ...(body.overrides || {})
        }
```

#### Code Sesudah (Proposed/After):
```javascript
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          enable_motion_text: body.enable_motion_text,
          motion_text_style: body.motion_text_style,
          video_transition: body.video_transition,
          ...affiliateOverride,
          ...recipeOverride,
          ...(body.overrides || {})
        }
```

---

### 4. `lib/auto-pipeline-scheduler-runner.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 131-134:
      overrides: {
        generate_recipe: cfg.generate_recipe !== undefined ? Boolean(cfg.generate_recipe) : undefined,
        ...(cfg.overrides || {})
      }
```

#### Code Sesudah (Proposed/After):
```javascript
      overrides: {
        visual_identity_preset_id: cfg.visual_identity_preset_id || null,
        generate_recipe: cfg.generate_recipe !== undefined ? Boolean(cfg.generate_recipe) : undefined,
        enable_motion_text: cfg.enable_motion_text,
        motion_text_style: cfg.motion_text_style,
        video_transition: cfg.video_transition,
        ...(cfg.overrides || {})
      }
```

---

### 5. `app/auto-pipeline/page.js` (Penyelarasan Modal Schedule & Inspector)

#### Code Sebelum (Current/Before):
```javascript
// Baris 1250:
: (schedCampaignType === 'multiplier_campaign'
    ? { blueprint_id: targetId, execution_mode: 'full_autopilot', generate_recipe: schedGenerateRecipe }
    : ...)
```

#### Code Sesudah (Proposed/After):
```javascript
: (schedCampaignType === 'multiplier_campaign'
    ? { 
        blueprint_id: targetId, 
        execution_mode: 'full_autopilot', 
        generate_recipe: schedGenerateRecipe,
        visual_identity_preset_id: selectedPresetId || activePresetConfig?.visual_swap?.visual_identity_preset_id || null
      }
    : ...)
```

---

## Verifikasi & Validasi
1. Menjalankan unit test `tests/test-autonomous-preset-pipeline.test.js` untuk menguji:
   - Resolusi preset asinkron untuk ke-4 tipe video.
   - Keberadaan `visual_identity_preset_id` dan properti finishing (`motion_text`, `video_transition`) pada `vso_config_json` dan `audio_config_json`.
   - Auto-healing pada Multiplier Worker saat menerima task tanpa VI eksplisit.
2. Memverifikasi mockup simulasi HTML di browser (`public/mockup_auto_pipeline_preset_audit.html`).
3. Melakukan rilis non-interaktif dan sinkronisasi Git otomatis sesuai SOP.
