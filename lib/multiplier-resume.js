/**
 * lib/multiplier-resume.js
 *
 * Helper murni (kompatibel client Next.js & Node worker/API) untuk menentukan
 * stage gagal aktual dan target Smart Resume pada `re_multiplier_tasks`.
 */

export const STAGE_TO_FAILED_CODE = {
  pending_resolution: 'resolving',
  resolving_product: 'resolving',
  remaking: 'remaking',
  generating_t2i: 't2i',
  generating_audio: 'tts',
  generating_visuals: 'visuals',
  ffmpeg_muxing: 'ffmpeg',
  uploading_assets: 'cloud',
};

export const FAILED_CODE_TO_WORKER_STATUS = {
  resolving: 'pending_resolution',
  remaking: 'remaking',
  t2i: 'generating_t2i',
  tts: 'generating_audio',
  visuals: 'generating_visuals',
  ffmpeg: 'ffmpeg_muxing',
  cloud: 'uploading_assets',
};

export const MULTIPLIER_STAGE_LABELS = {
  pending_resolution: 'Resolving Produk',
  resolving_product: 'Resolving Produk',
  remaking: 'Storyboard',
  generating_t2i: 'T2I Start Frame',
  generating_audio: 'TTS Audio',
  generating_visuals: 'Visual G-Labs',
  ffmpeg_muxing: 'FFmpeg Muxing',
  uploading_assets: 'Upload Cloud',
};

export const MULTIPLIER_SHORT_LABELS = {
  pending_resolution: 'Dari Awal',
  resolving_product: 'Dari Awal',
  remaking: 'Storyboard',
  generating_t2i: 'Start Frame',
  generating_audio: 'TTS Audio',
  generating_visuals: 'Visual Video',
  ffmpeg_muxing: 'FFmpeg',
  uploading_assets: 'Upload Cloud',
};

export function parseJsonSafe(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function isMultiplierTtsOptional(audioConfig = {}, vsoConfig = {}) {
  const mode = String(audioConfig?.audio_engine_mode || vsoConfig?.audio_engine_mode || 'minimax_tts').trim().toLowerCase();
  if (mode === 'no_vo' || mode === 'native_veo') return true;
  if (audioConfig?.enableTts === 0 || audioConfig?.enable_tts === false) return true;
  if (audioConfig?.tts_skipped_reason) return true;
  return false;
}

export function getMultiplierAudioEngineMode(task = {}) {
  const audioConfig = parseJsonSafe(task.audio_config_json, {}) || {};
  const vsoConfig = parseJsonSafe(task.vso_config_json, {}) || {};
  return String(audioConfig.audio_engine_mode || vsoConfig.audio_engine_mode || 'minimax_tts').trim().toLowerCase();
}

/**
 * Menentukan stage worker yang tepat untuk Smart Resume dari artefak yang sudah tersimpan.
 *
 * @param {Object} task
 * @param {Object} [artifacts={}]
 * @returns {string} status target untuk worker
 */
export function resolveMultiplierResumeStage(task = {}, artifacts = {}) {
  const art = artifacts || task?.artifacts || {};

  // 0. Jika eksplisit gagal di ffmpeg_muxing dan klip visual lengkap -> tetap ke ffmpeg_muxing
  if (task?.failed_stage === 'ffmpeg' && art.has_visual_clips) {
    return 'ffmpeg_muxing';
  }

  // 1. Master video hasil FFmpeg sudah ada -> tinggal upload Cloud + ContentFlow
  if (art.has_final_video && !task.nextcloud_video_url) {
    return 'uploading_assets';
  }

  // 2. Seluruh klip video G-Labs / .mp4 lokal sudah lengkap -> langsung FFmpeg Muxing
  if (art.has_visual_clips) {
    return 'ffmpeg_muxing';
  }

  const storyboard = parseJsonSafe(task.remake_storyboard_json, []);
  const prompts = parseJsonSafe(task.t2i_i2v_prompts_json, []);
  const bridgingCfg = parseJsonSafe(task.bridging_config_json, {}) || {};
  const vsoCfg = parseJsonSafe(task.vso_config_json, {}) || {};
  const audioCfg = parseJsonSafe(task.audio_config_json, {}) || {};
  const glabsIds = parseJsonSafe(task.glabs_task_ids, []);

  const hasStoryboard = Array.isArray(storyboard) && storyboard.length > 0;
  const hasPrompts = Array.isArray(prompts) && prompts.length > 0;
  if (!hasStoryboard || !hasPrompts) {
    return 'pending_resolution';
  }

  const visualMode = String(bridgingCfg.visualMode || bridgingCfg.visual_mode || vsoCfg.visualMode || vsoCfg.visual_mode || 'pure_t2v').trim().toLowerCase();
  const isPureT2v = visualMode === 'pure_t2v';
  const ttsOptional = isMultiplierTtsOptional(audioCfg, vsoCfg);
  const audioReady = ttsOptional || (Boolean(audioCfg.combined_audio_path) && art.has_combined_audio !== false);

  const t2iArr = parseJsonSafe(task.t2i_images_json, []);
  const t2iCountValid = Array.isArray(t2iArr) && t2iArr.length >= prompts.length && t2iArr.every(Boolean);
  const allT2iReady = art.has_all_t2i_images !== undefined ? Boolean(art.has_all_t2i_images) : t2iCountValid;
  const hasGlabsIds = Array.isArray(glabsIds) && glabsIds.length > 0;

  // 3. Jika audio siap dan visual siap disubmit/dilanjutkan -> generating_visuals
  if (audioReady && (isPureT2v || allT2iReady || hasGlabsIds)) {
    return 'generating_visuals';
  }

  // 4. Jika semua start frame T2I sudah lengkap (atau pure_t2v) -> generating_audio
  if (isPureT2v || allT2iReady) {
    return 'generating_audio';
  }

  // 5. Storyboard + prompts sudah ada, tetapi start frame belum lengkap -> generating_t2i
  return 'generating_t2i';
}

/**
 * Menentukan stage gagal (`resolving` | `remaking` | `t2i` | `tts` | `visuals` | `ffmpeg` | `cloud`)
 * untuk UI stepper. Memprioritaskan `task.failed_stage` jika tersedia.
 */
export function resolveMultiplierFailedStage(task = {}, artifacts = null) {
  const explicit = String(task?.failed_stage || '').trim().toLowerCase();
  if (explicit && FAILED_CODE_TO_WORKER_STATUS[explicit]) {
    return explicit;
  }

  const art = artifacts || task?.artifacts || {};
  if (art.has_final_video && !task?.nextcloud_video_url) {
    return 'cloud';
  }
  if (art.has_visual_clips) {
    return 'ffmpeg';
  }

  const storyboard = parseJsonSafe(task?.remake_storyboard_json, []);
  const prompts = parseJsonSafe(task?.t2i_i2v_prompts_json, []);
  if (!Array.isArray(storyboard) || storyboard.length === 0 || !Array.isArray(prompts) || prompts.length === 0) {
    return 'remaking';
  }

  const bridgingCfg = parseJsonSafe(task?.bridging_config_json, {}) || {};
  const vsoCfg = parseJsonSafe(task?.vso_config_json, {}) || {};
  const audioCfg = parseJsonSafe(task?.audio_config_json, {}) || {};
  const visualMode = String(bridgingCfg.visualMode || bridgingCfg.visual_mode || vsoCfg.visualMode || vsoCfg.visual_mode || 'pure_t2v').trim().toLowerCase();
  const isPureT2v = visualMode === 'pure_t2v';
  const ttsOptional = isMultiplierTtsOptional(audioCfg, vsoCfg);
  const audioReady = ttsOptional || (Boolean(audioCfg.combined_audio_path) && art.has_combined_audio !== false);
  const glabsIds = parseJsonSafe(task?.glabs_task_ids, []);
  const hasGlabsStarted = Array.isArray(glabsIds) && glabsIds.length > 0;
  const t2iArr = parseJsonSafe(task?.t2i_images_json, []);
  const hasAnyT2i = art.has_any_t2i_images !== undefined
    ? Boolean(art.has_any_t2i_images)
    : (Array.isArray(t2iArr) && t2iArr.some(Boolean));

  if (task?.ffmpeg_output_path) {
    return 'cloud';
  }
  if (hasGlabsStarted) {
    const glabsList = Array.isArray(task?.glabs_tasks) ? task.glabs_tasks : [];
    const allGlabsCompleted = glabsList.length >= prompts.length && glabsList.every((g) => g?.status === 'completed');
    return allGlabsCompleted ? 'ffmpeg' : 'visuals';
  }
  if (!isPureT2v && !hasAnyT2i) {
    return 't2i';
  }
  if (!audioReady) {
    return 'tts';
  }
  return 'visuals';
}

export function getMultiplierResumeInfo(task = {}, artifacts = null) {
  const art = artifacts || task?.artifacts || {};
  const stage = art.recommended_resume_stage || resolveMultiplierResumeStage(task, art);
  return {
    stage,
    label: art.recommended_resume_label || MULTIPLIER_STAGE_LABELS[stage] || stage,
    shortLabel: MULTIPLIER_SHORT_LABELS[stage] || stage,
  };
}
