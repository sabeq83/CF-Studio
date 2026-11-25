# Implementation Plan (Hotfix): Wardrobe Lock Multiplier, Proteksi Audio `combined_audio_path` & Render Ulang Text Overlay (`mul_261125_scjc0u`)

**Sumber Usulan:** [USULAN_PERBAIKAN_WARDROBE_LOCK_MULTIPLIER.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_PERBAIKAN_WARDROBE_LOCK_MULTIPLIER.md)  
**Target Branch Kerja:** `hotfix/multiplier-wardrobe-audio-lock` (dibuat dari `main` saat eksekusi dimulai, sesuai SOP Alur 2 Hotfix Staging)  
**Lingkup & Catatan Arsitektur:**
- **Hotfix-only (tanpa migrasi DB & tanpa perubahan layout UI):** Seluruh perubahan bersifat backward-compatible dan hanya menyentuh resolver Visual Identity, prompt builder Multiplier, worker Multiplier, proteksi `update-creative`, dan sinkronisasi field runtime audio di state polling UI.
- **Tidak perlu Mockup HTML:** Tidak ada penambahan atau perubahan komponen visual UI (hanya sinkronisasi state non-visual `combined_audio_path` / `tts_skipped_reason` pada `fetchTasks()`).
- **Perilaku Wardrobe Lock:** 1 video/baris Multiplier (`batch_id:task.id`) mengunci **1 warna solid tunggal** dan **1 potongan pakaian** dari Klip 1 sampai Klip terakhir, sementara video/baris lain dengan `task.id` berbeda tetap dapat memutar warna dari `wardrobe.palette` VI (`stable_random`).

---

## Execution Task List

### Tahap 0 — Persiapan Branch Hotfix
- [x] Buat dan checkout branch baru `hotfix/multiplier-wardrobe-audio-lock` dari `main` terbaru (`git checkout main && git pull && git checkout -b hotfix/multiplier-wardrobe-audio-lock`)

### Tahap 1 — Perbaikan Wardrobe Lock Deterministik Per Baris Multiplier
- [x] Tambahkan helper `resolvePaletteColorChoice` & perbarui `resolveVisualIdentitySnapshot`, `resolveVisualIdentity`, dan `resolveVisualIdentitySubmission` di [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js) untuk memilih 1 warna deterministik dari `wardrobe.palette` (termasuk `preset_key === 'custom'`), membersihkan opsi baju ganda (`or ... athletic top`), dan menyertakan `wardrobe_color_label` / `resolved_wardrobe_color` pada snapshot
- [x] Teruskan `stable_seed` (`${task.batch_id}:${task.id}`) & `item_index` ke `resolveVisualIdentitySubmission`, serta simpan `resolved_wardrobe_color` & `resolved_wardrobe_prompt` ke `vso_config_json` pada `handleStoryboardRemake` di [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)
- [x] Perbarui `buildMultiplierPhase2Prompt` di [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) agar menyuntikkan warna solid terkunci ke `targetCharacter`/`targetWardrobe` + `vsoSection` (`WARDROBE LOCK`) serta mendukung fallback `resolveVideoVariety` untuk `wardrobe.palette`
- [x] Perbarui `buildMultiplierStartFrameRequest` di [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js) untuk membersihkan frasa baju ganda dan menyuntikkan `[WARDROBE LOCK: ...]` pada klip non-3D/non-`environment_object_only`

### Tahap 2 — Perbaikan Proteksi Audio `combined_audio_path` & Jalur `ffmpeg_muxing` (Audio + Text)
- [x] Pertahankan field runtime `combined_audio_path` dan `tts_skipped_reason` dari `task.audio_config_json` saat menyimpan via `POST /api/v2/multiplier/[id]/update-creative` di [app/api/v2/multiplier/[id]/update-creative/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/update-creative/route.js)
- [x] Sinkronkan `combined_audio_path` & `tts_skipped_reason` terbaru dari server saat polling `fetchTasks()` di [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js) agar `editedAudioConfigs` tidak mengirim state usang tanpa path audio
- [x] Tambahkan self-healing check file fisik `public/temp/tts_multiplier_combined_${task.id}.mp3` (atau `.wav`) pada `handleVisualGeneration` di [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) sebelum masuk cabang silent concat fallback

### Tahap 3 — Unit Test, Build Aman, Merge/Rilis `main` & Deploy Hotfix ke Staging
- [x] Perbarui [tests/multiplier-audio-config-sync.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/multiplier-audio-config-sync.test.js) dan tambahkan [tests/multiplier-wardrobe-lock-hotfix.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/multiplier-wardrobe-lock-hotfix.test.js) untuk menguji konsistensi warna per baris, rotasi antar baris, proteksi `combined_audio_path` di `update-creative`/UI, dan self-healing disk check di worker
- [x] Jalankan unit test (`PG_SEARCH_PATH=dev node --test ...`) dan build lokal aman (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`)
- [x] Perbarui [sot/menus/kartu/multiplier-lab.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/multiplier-lab.md)
- [x] Atas persetujuan pengguna (SOP Alur 2 Hotfix): merge ke `main`, jalankan `npm run release-non-interactive -- --type patch ...`, lalu deploy SHA rilis `main` ke **Staging** (`npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`) dan hapus branch hotfix

### Tahap 4 — Render Ulang `mul_261125_scjc0u` (Audio + Text Overlay) & Verifikasi Staging
- [x] Trigger ulang stage `ffmpeg_muxing` untuk `mul_261125_scjc0u` di Staging (`POST /api/v2/multiplier/mul_261125_scjc0u/retry` `{ "stage": "ffmpeg" }`, dengan verifikasi `audio_config_json.combined_audio_path` pulih oleh worker atau disetel ke `/temp/tts_multiplier_combined_mul_261125_scjc0u.mp3`)
- [x] Tunggu proses `ffmpeg_muxing` → `uploading_assets` → `completed` selesai, lalu verifikasi `ffprobe` pada `mul_261125_scjc0u_final.mp4` (wajib memiliki stream `video` + stream `audio`, durasi & overlay aktif, dan terunggah ke Nextcloud)

---

## Detail Perubahan Kode (Before & After)

### 1. [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js)

**Code Sebelum (Current/Before):**
```js
function stableIndex(seed, length) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  return digest.readUInt32BE(0) % length;
}

export function resolveWardrobe({ mode, subjectDemographic, itemIndex = 0, stableSeed = '', rowOverride = '' }) {
  ...
```
```js
  // 2. Resolve Subject Prompt ...
  if (basePreset) {
    subjectPrompt = basePreset;
    if (config.subject.custom_description) {
      subjectPrompt = `${subjectPrompt}, ${config.subject.custom_description}`;
    }
  }
```
```js
  // 3. Resolve Wardrobe Prompt
  let wardrobePrompt = 'wearing clean attire';
  if (isEnvironmentOnly) {
    wardrobePrompt = '';
  } else if (config.wardrobe?.preset_key === 'not_applicable') {
    wardrobePrompt = (config.wardrobe.custom_description && config.wardrobe.custom_description.trim())
      ? config.wardrobe.custom_description.trim()
      : 'not applicable (natural character surface finish only, no human clothing)';
  } else if (config.wardrobe?.mode === 'custom' || config.wardrobe?.preset_key === 'custom') {
    wardrobePrompt = config.wardrobe.custom_description || 'wearing clean attire';
  } else if (config.wardrobe) {
    const resolvedW = resolveWardrobe({
      mode: config.wardrobe.mode === 'fixed' ? config.wardrobe.preset_key : config.wardrobe.mode,
      subjectDemographic: config.subject.demographic_key,
      itemIndex,
      stableSeed,
      rowOverride
    });
    wardrobePrompt = resolvedW.description || (config.wardrobe.custom_description || 'wearing clean attire');
  }
  if (config.wardrobe?.primary_color && !isEnvironmentOnly && !wardrobePrompt.includes(config.wardrobe.primary_color)) {
    wardrobePrompt = `${wardrobePrompt}, primary color ${config.wardrobe.primary_color}`;
  }
  if (config.wardrobe?.secondary_color && !isEnvironmentOnly && !wardrobePrompt.includes(config.wardrobe.secondary_color)) {
    wardrobePrompt = `${wardrobePrompt}, secondary color ${config.wardrobe.secondary_color}`;
  }
```
```js
  const resolved = {
    subject_prompt: subjectPrompt,
    wardrobe_prompt: wardrobePrompt,
    environment_prompt: environmentPrompt,
    lighting_prompt: lightingPrompt,
    camera_prompt: cameraPrompt,
    style_prompt: stylePrompt,
    active_visual_mode: activeStyleKey,
    narrative_function: narrativeFunction || 'default',
    visual_language_prompt: stylePrompt,
    mode_prompt: styleDefinition.prompt,
    rendering_prompt: renderingPrompt,
    composition_prompt: compositionPrompt,
    metaphor_prompt: metaphorPrompt,
    negative_prompt: negativePrompt
  };
...
export async function resolveVisualIdentitySubmission({ preset_id, inline_config, legacy_overrides_json, narrative_function }) {
  ...
  const snapshot = await resolveVisualIdentity({
    presetRef: preset_id && preset_id !== 'inline' && preset_id !== 'custom' ? preset_id : null,
    inlineConfig: preset_id === 'inline' ? inline_config : null,
    legacyOverrides: (preset_id === 'custom' || !preset_id) ? parsedLegacy : null,
    itemContext: { narrativeFunction: narrative_function }
  });
```

**Code Sesudah (Proposed/After):**
```js
function stableIndex(seed, length) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  return digest.readUInt32BE(0) % length;
}

function sanitizeAmbiguousWardrobeChoice(text = '') {
  return String(text || '')
    .replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function resolvePaletteColorChoice({ wardrobe = {}, itemIndex = 0, stableSeed = '', fallbackLabel = '' } = {}) {
  const primary = String(wardrobe?.primary_color || '').trim();
  if (primary) return primary;
  const palette = Array.isArray(wardrobe?.palette)
    ? wardrobe.palette.map(c => String(c || '').trim()).filter(Boolean)
    : [];
  if (palette.length === 0) return '';
  const mode = String(wardrobe?.mode || 'stable_random').trim().toLowerCase();
  if (mode === 'fixed') return palette[0];
  if (mode === 'sequential') return palette[Math.max(0, Number(itemIndex) || 0) % palette.length];
  const seed = String(stableSeed || fallbackLabel || 'default');
  return palette[stableIndex(seed, palette.length)];
}
```
```js
  // 3. Resolve Wardrobe Prompt
  let wardrobePrompt = 'wearing clean attire';
  let resolvedWardrobeColor = '';
  if (isEnvironmentOnly) {
    wardrobePrompt = '';
  } else if (config.wardrobe?.preset_key === 'not_applicable') {
    wardrobePrompt = (config.wardrobe.custom_description && config.wardrobe.custom_description.trim())
      ? config.wardrobe.custom_description.trim()
      : 'not applicable (natural character surface finish only, no human clothing)';
  } else if (config.wardrobe?.mode === 'custom' || config.wardrobe?.preset_key === 'custom') {
    const baseCustom = sanitizeAmbiguousWardrobeChoice(config.wardrobe.custom_description || 'wearing clean attire');
    resolvedWardrobeColor = resolvePaletteColorChoice({
      wardrobe: config.wardrobe,
      itemIndex,
      stableSeed,
      fallbackLabel: config.label || activeSnapshot?.identity_ref?.key || ''
    });
    if (resolvedWardrobeColor) {
      const hasColor = baseCustom.toLowerCase().includes(resolvedWardrobeColor.toLowerCase());
      wardrobePrompt = hasColor
        ? `${baseCustom}, single uniform solid ${resolvedWardrobeColor} color across all scenes`
        : `solid plain ${resolvedWardrobeColor} color — ${baseCustom}, strictly identical ${resolvedWardrobeColor} garment color across all scenes, no color change`;
    } else {
      wardrobePrompt = baseCustom;
    }
  } else if (config.wardrobe) {
    const resolvedW = resolveWardrobe({
      mode: config.wardrobe.mode === 'fixed' ? config.wardrobe.preset_key : config.wardrobe.mode,
      subjectDemographic: config.subject.demographic_key,
      itemIndex,
      stableSeed,
      rowOverride
    });
    wardrobePrompt = resolvedW.description || (config.wardrobe.custom_description || 'wearing clean attire');
    resolvedWardrobeColor = resolvePaletteColorChoice({
      wardrobe: config.wardrobe,
      itemIndex,
      stableSeed,
      fallbackLabel: resolvedW.key || ''
    });
  }
  if (resolvedWardrobeColor && !isEnvironmentOnly && config.wardrobe?.preset_key !== 'not_applicable') {
    subjectPrompt = sanitizeAmbiguousWardrobeChoice(subjectPrompt);
  }
  if (config.wardrobe?.primary_color && !isEnvironmentOnly && !wardrobePrompt.includes(config.wardrobe.primary_color)) {
    wardrobePrompt = `${wardrobePrompt}, primary color ${config.wardrobe.primary_color}`;
  }
  if (config.wardrobe?.secondary_color && !isEnvironmentOnly && !wardrobePrompt.includes(config.wardrobe.secondary_color)) {
    wardrobePrompt = `${wardrobePrompt}, secondary color ${config.wardrobe.secondary_color}`;
  }
```
```js
  const resolved = {
    subject_prompt: subjectPrompt,
    wardrobe_prompt: wardrobePrompt,
    wardrobe_color_label: resolvedWardrobeColor,
    ...
  };
  return {
    ...snapshot,
    resolved,
    legacy,
    ...legacy,
    wardrobe_mode: config.wardrobe?.mode,
    wardrobe_resolved_key: config.wardrobe?.preset_key,
    resolved_wardrobe_color: resolvedWardrobeColor
  };
...
export async function resolveVisualIdentitySubmission({ preset_id, inline_config, legacy_overrides_json, narrative_function, item_index = 0, stable_seed = '' }) {
  ...
  const snapshot = await resolveVisualIdentity({
    presetRef: preset_id && preset_id !== 'inline' && preset_id !== 'custom' ? preset_id : null,
    inlineConfig: preset_id === 'inline' ? inline_config : null,
    legacyOverrides: (preset_id === 'custom' || !preset_id) ? parsedLegacy : null,
    itemContext: {
      narrativeFunction: narrative_function,
      itemIndex: item_index,
      stableSeed: stable_seed
    }
  });
```

---

### 2. [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)

#### A. Wardrobe Seed Propagation (`handleStoryboardRemake`)

**Code Sebelum (Current/Before):**
```js
    if (targetPresetId && targetPresetId !== 'custom') {
      const submission = await resolveVisualIdentitySubmission({
        preset_id: targetPresetId,
        inline_config: aesthetics.visual_identity_inline_config || aesthetics.visualIdentity?.inline_config,
        narrative_function: 'hook'
      });
      const resolvedSnapshot = submission.snapshot;
...
      resolvedVso = {
        ...aesthetics,
        ...resolvedSnapshot.legacy,
        ...resolvedSnapshot.resolved,
        structured: resolvedSnapshot.structured,
        resolved: resolvedSnapshot.resolved,
        mechanismSnapshot: mechanismSnapshot?.resolved || null,
        visualSignature: brandVisualSignature || resolvedSnapshot.structured?.description || '',
        isVsoActive: aesthetics.isVsoActive !== undefined ? aesthetics.isVsoActive : true,
        characterConcept: resolvedSnapshot.legacy?.character_concept || 'faceless',
        subjectDemographic: resolvedSnapshot.legacy?.subject_demographic || 'custom',
        subjectDemographicCustom: resolvedSnapshot.legacy?.subject_demographic_custom || resolvedSnapshot.resolved?.subject_prompt || '',
        wardrobeStyle: 'custom',
        wardrobeStyleCustom: resolvedSnapshot.legacy?.wardrobe_style_custom || resolvedSnapshot.resolved?.wardrobe_prompt || '',
        lightingStyle: 'custom',
        lightingStyleCustom: resolvedSnapshot.legacy?.lighting_style_custom || resolvedSnapshot.resolved?.lighting_prompt || '',
        environmentPrompt: resolvedSnapshot.resolved?.environment_prompt || '',
        negativePrompt: resolvedSnapshot.resolved?.negative_prompt || ''
      };
    }
```
```js
  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    ...
    t2i_i2v_prompts_json: JSON.stringify(parsed.prompts || []),
    bridging_config_json: JSON.stringify(bridging),
```

**Code Sesudah (Proposed/After):**
```js
    const multiplierWardrobeSeed = `${task.batch_id || 'multiplier'}:${task.id || rowIndex}`;
    if (targetPresetId && targetPresetId !== 'custom') {
      const submission = await resolveVisualIdentitySubmission({
        preset_id: targetPresetId,
        inline_config: aesthetics.visual_identity_inline_config || aesthetics.visualIdentity?.inline_config,
        narrative_function: 'hook',
        item_index: rowIndex,
        stable_seed: multiplierWardrobeSeed
      });
      const resolvedSnapshot = submission.snapshot;
...
      const lockedColorLabel = resolvedSnapshot.resolved?.wardrobe_color_label || resolvedSnapshot.resolved_wardrobe_color || '';
      const lockedWardrobeDesc = resolvedSnapshot.legacy?.wardrobe_style_custom || resolvedSnapshot.resolved?.wardrobe_prompt || '';
      resolvedVso = {
        ...aesthetics,
        ...resolvedSnapshot.legacy,
        ...resolvedSnapshot.resolved,
        structured: resolvedSnapshot.structured,
        resolved: resolvedSnapshot.resolved,
        mechanismSnapshot: mechanismSnapshot?.resolved || null,
        visualSignature: brandVisualSignature || resolvedSnapshot.structured?.description || '',
        isVsoActive: aesthetics.isVsoActive !== undefined ? aesthetics.isVsoActive : true,
        characterConcept: resolvedSnapshot.legacy?.character_concept || 'faceless',
        subjectDemographic: resolvedSnapshot.legacy?.subject_demographic || 'custom',
        subjectDemographicCustom: resolvedSnapshot.legacy?.subject_demographic_custom || resolvedSnapshot.resolved?.subject_prompt || '',
        wardrobeStyle: 'custom',
        wardrobeStyleCustom: lockedWardrobeDesc,
        resolved_wardrobe_color: lockedColorLabel,
        resolvedWardrobeColor: lockedColorLabel,
        resolved_wardrobe_prompt: lockedWardrobeDesc,
        lightingStyle: 'custom',
        lightingStyleCustom: resolvedSnapshot.legacy?.lighting_style_custom || resolvedSnapshot.resolved?.lighting_prompt || '',
        environmentPrompt: resolvedSnapshot.resolved?.environment_prompt || '',
        negativePrompt: resolvedSnapshot.resolved?.negative_prompt || ''
      };
    }
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

  await updateMultiplierTask(task.id, {
    remake_storyboard_json: JSON.stringify(safeVoiceover),
    ...
    t2i_i2v_prompts_json: JSON.stringify(parsed.prompts || []),
    bridging_config_json: JSON.stringify(bridging),
    ...(persistedVsoConfig ? { vso_config_json: JSON.stringify(persistedVsoConfig) } : {}),
```

#### B. Self-Healing Audio Disk Recovery (`handleVisualGeneration`)

**Code Sebelum (Current/Before):**
```js
      const hasFfmpeg = audioConfig.enableFfmpeg === 1 || audioConfig.enableFfmpeg === true || audioConfig.enable_ffmpeg === true;
      const muxAudioMode = audioConfig.audio_engine_mode || aesthetics.audio_engine_mode || 'minimax_tts';
      const isTtsOptionalMux = muxAudioMode === 'no_vo' || muxAudioMode === 'native_veo';
      if (hasFfmpeg && (audioConfig.combined_audio_path || isTtsOptionalMux)) {
        // Alihkan task ke stage ffmpeg_muxing agar dieksekusi oleh handleFFmpegMuxing & processTtsStudioMuxing
        await updateMultiplierTask(task.id, { 
          status: 'ffmpeg_muxing'
        });
      } else {
```

**Code Sesudah (Proposed/After):**
```js
      const hasFfmpeg = audioConfig.enableFfmpeg === 1 || audioConfig.enableFfmpeg === true || audioConfig.enable_ffmpeg === true;
      const muxAudioMode = audioConfig.audio_engine_mode || aesthetics.audio_engine_mode || 'minimax_tts';
      const isTtsOptionalMux = muxAudioMode === 'no_vo' || muxAudioMode === 'native_veo';

      if (hasFfmpeg && !isTtsOptionalMux && !audioConfig.combined_audio_path) {
        const recoveredCandidate = [`tts_multiplier_combined_${task.id}.mp3`, `tts_multiplier_combined_${task.id}.wav`]
          .find((fname) => {
            const fp = path.join(tempDir, fname);
            return fs.existsSync(fp) && fs.statSync(fp).size > 0;
          });
        if (recoveredCandidate) {
          audioConfig.combined_audio_path = `/temp/${recoveredCandidate}`;
          await updateMultiplierTask(task.id, {
            audio_config_json: JSON.stringify(audioConfig)
          });
          logToMultiplier(`[Multiplier Worker] Recovered missing combined_audio_path from disk for task ${task.id}: ${audioConfig.combined_audio_path}`);
        }
      }

      if (hasFfmpeg && (audioConfig.combined_audio_path || isTtsOptionalMux)) {
        // Alihkan task ke stage ffmpeg_muxing agar dieksekusi oleh handleFFmpegMuxing & processTtsStudioMuxing
        await updateMultiplierTask(task.id, { 
          status: 'ffmpeg_muxing'
        });
      } else {
```

---

### 3. [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildMultiplierPhase2Prompt`)

**Code Sebelum (Current/Before):**
```js
  if (vso?.isVsoActive) {
    const targetConcept = isEnvironmentOnly ? 'environment_object_only' : (vso.characterConcept || vso.character_concept || "faceless");
    const subjectDemo = vso.subjectDemographic || vso.subject_demographic || "syari_classic";

    const customWardrobe = vso.wardrobeStyleCustom || vso.wardrobe_style_custom || vso.resolved?.wardrobe_prompt;
    if ((vso.wardrobe_style === "custom" || vso.wardrobeStyle === "custom" || customWardrobe) && customWardrobe) {
      targetWardrobe = customWardrobe;
    } else {
      ...
    }
```
```js
    targetCharacter = (vso.subjectDemographicCustom || vso.subject_demographic_custom || vso.resolved?.subject_prompt)
      ? (vso.subjectDemographicCustom || vso.subject_demographic_custom || vso.resolved?.subject_prompt)
      : (DEMOGRAPHIC_PRESETS[subjectDemo] || subjectDemo || "a graceful Muslimah");
```
```js
- WARDROBE CONSISTENCY: The color, texture, and style of the wardrobe must be IDENTICAL across all visual prompts.
```

**Code Sesudah (Proposed/After):**
```js
  if (vso?.isVsoActive) {
    const targetConcept = isEnvironmentOnly ? 'environment_object_only' : (vso.characterConcept || vso.character_concept || "faceless");
    const subjectDemo = vso.subjectDemographic || vso.subject_demographic || "syari_classic";

    const structuredWardrobe = vso.structured?.wardrobe || null;
    const preResolvedColor = vso.resolvedWardrobeColor || vso.resolved_wardrobe_color || vso.resolved?.wardrobe_color_label || '';
    const customWardrobe = vso.wardrobeStyleCustom || vso.wardrobe_style_custom || vso.resolved?.wardrobe_prompt;
    let lockedWardrobeColor = preResolvedColor;

    if ((vso.wardrobe_style === "custom" || vso.wardrobeStyle === "custom" || customWardrobe) && customWardrobe) {
      targetWardrobe = customWardrobe;
      if (!lockedWardrobeColor && !isEnvironmentOnly && Array.isArray(structuredWardrobe?.palette) && structuredWardrobe.palette.length > 0) {
        const seed = vso.stable_seed || `${aesthetics?.campaign_id || bridging?.targetProductId || 'mult'}:${rowIndex}`;
        const picked = resolveVideoVariety(seed, {
          paletteEntries: structuredWardrobe.palette,
          sleevePolicy: structuredWardrobe.sleeve_policy || 'wrists_covered'
        });
        lockedWardrobeColor = picked.wardrobeColorLabel || '';
        if (lockedWardrobeColor && !targetWardrobe.toLowerCase().includes(lockedWardrobeColor.toLowerCase())) {
          const cleaned = targetWardrobe.replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '').trim();
          targetWardrobe = `solid plain ${lockedWardrobeColor} color — ${cleaned}, strictly identical ${lockedWardrobeColor} garment color across all scenes`;
        }
      }
    } else {
      ...
    }
```
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
```

---

### 4. [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js)

**Code Sebelum (Current/Before):**
```js
  return {
    isBridgeClip,
    providerRequest: {
      prompt: effectivePrompt,
      model: imageModel || 'nano_banana_pro',
      aspect_ratio,
      reference_images: references,
      expected_reference_sha256s: expectedReferenceSha256s,
      webhookOverride: webhookOverride || undefined
    },
```

**Code Sesudah (Proposed/After):**
```js
  const isEnvOnly = aesthetics?.characterConcept === 'environment_object_only'
    || aesthetics?.character_concept === 'environment_object_only'
    || aesthetics?.structured?.subject?.kind === 'environment_object_only';
  const is3dOrCellularPrompt = /\b3d\s*(?:bio-cellular|biomedical|cellular|cgi|simulation)\b/i.test(effectivePrompt)
    || /\(Presence Truth:\s*Zero Humans/i.test(effectivePrompt);
  const lockedWardrobeColor = String(
    aesthetics?.resolved_wardrobe_color ||
    aesthetics?.resolvedWardrobeColor ||
    aesthetics?.resolved?.wardrobe_color_label ||
    ''
  ).trim();
  const lockedWardrobePrompt = String(
    aesthetics?.resolved_wardrobe_prompt ||
    aesthetics?.wardrobeStyleCustom ||
    aesthetics?.wardrobe_style_custom ||
    aesthetics?.resolved?.wardrobe_prompt ||
    ''
  ).trim();

  if (lockedWardrobeColor && !isEnvOnly && !is3dOrCellularPrompt) {
    effectivePrompt = effectivePrompt
      .replace(/\s+or\s+(?:a\s+)?(?:clean\s+minimalist\s+|plain\s+)?athletic\s+top\b/gi, '')
      .trim();
    if (!/\[WARDROBE LOCK:/i.test(effectivePrompt)) {
      effectivePrompt = `${effectivePrompt} [WARDROBE LOCK: strictly uniform solid ${lockedWardrobeColor} garment color across all live-action scenes${lockedWardrobePrompt ? ` (${lockedWardrobePrompt})` : ''}, identical shirt color and fabric, no color change]`;
    }
  }

  return {
    isBridgeClip,
    providerRequest: {
      prompt: effectivePrompt,
      model: imageModel || 'nano_banana_pro',
      aspect_ratio,
      reference_images: references,
      expected_reference_sha256s: expectedReferenceSha256s,
      webhookOverride: webhookOverride || undefined
    },
```

---

### 5. [app/api/v2/multiplier/[id]/update-creative/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/update-creative/route.js)

**Code Sebelum (Current/Before):**
```js
    const normalizedAudio = normalizeAudioConfig(audioConfig || {});
```

**Code Sesudah (Proposed/After):**
```js
    const existingAudio = (() => {
      try {
        return typeof task.audio_config_json === 'string'
          ? JSON.parse(task.audio_config_json || '{}')
          : (task.audio_config_json || {});
      } catch (_) {
        return {};
      }
    })();
    const normalizedAudio = normalizeAudioConfig(audioConfig || {});
    if (!normalizedAudio.combined_audio_path && existingAudio.combined_audio_path) {
      normalizedAudio.combined_audio_path = existingAudio.combined_audio_path;
    }
    if (!normalizedAudio.tts_skipped_reason && existingAudio.tts_skipped_reason) {
      normalizedAudio.tts_skipped_reason = existingAudio.tts_skipped_reason;
    }
```

---

### 6. [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js)

**Code Sebelum (Current/Before):**
```js
          setEditedAudioConfigs(prev => {
            if (prev[t.id]) return prev;
            return { ...prev, [t.id]: normalizeAudioConfig(t.audio_config_json) };
          });
```

**Code Sesudah (Proposed/After):**
```js
          setEditedAudioConfigs(prev => {
            if (prev[t.id]) {
              const serverAudio = normalizeAudioConfig(t.audio_config_json);
              const nextCombined = serverAudio.combined_audio_path || prev[t.id].combined_audio_path;
              const nextSkipped = serverAudio.tts_skipped_reason || prev[t.id].tts_skipped_reason;
              if (
                nextCombined !== prev[t.id].combined_audio_path ||
                nextSkipped !== prev[t.id].tts_skipped_reason
              ) {
                return {
                  ...prev,
                  [t.id]: {
                    ...prev[t.id],
                    ...(nextCombined ? { combined_audio_path: nextCombined } : {}),
                    ...(nextSkipped ? { tts_skipped_reason: nextSkipped } : {})
                  }
                };
              }
              return prev;
            }
            return { ...prev, [t.id]: normalizeAudioConfig(t.audio_config_json) };
          });
```
