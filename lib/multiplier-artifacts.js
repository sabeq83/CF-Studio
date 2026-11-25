/**
 * lib/multiplier-artifacts.js
 *
 * Server-side inspector untuk memverifikasi kelengkapan file artefak Multiplier
 * pada disk (`public/temp`, `public/uploads/start_frames`) + status `glabs_tasks`.
 */

import fs from 'fs';
import path from 'path';
import {
  FAILED_CODE_TO_WORKER_STATUS,
  MULTIPLIER_STAGE_LABELS,
  parseJsonSafe,
  resolveMultiplierResumeStage,
} from './multiplier-resume.js';

function resolveExistingPublicFile(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return false;
  const rel = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
  const fullPath = path.join(process.cwd(), 'public', rel);
  try {
    if (!fs.existsSync(fullPath)) return false;
    return fs.statSync(fullPath).size > 0;
  } catch {
    return false;
  }
}

export function inspectMultiplierTaskArtifacts(task = {}, dbGlabsTasks = null) {
  const prompts = parseJsonSafe(task.t2i_i2v_prompts_json, []);
  const storyboard = parseJsonSafe(task.remake_storyboard_json, []);
  const audioCfg = parseJsonSafe(task.audio_config_json, {}) || {};
  const t2iImages = parseJsonSafe(task.t2i_images_json, []);
  const glabsIds = parseJsonSafe(task.glabs_task_ids, []);

  const clipCount = (Array.isArray(prompts) && prompts.length > 0)
    ? prompts.length
    : (Array.isArray(storyboard) ? storyboard.length : 0);

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  let localVisualClipsCount = 0;
  for (let i = 0; i < clipCount; i++) {
    const clipPath = path.join(tempDir, `mult_clip_${task.id}_${i}.mp4`);
    try {
      if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
        localVisualClipsCount++;
      }
    } catch {}
  }

  const glabsList = Array.isArray(dbGlabsTasks)
    ? dbGlabsTasks
    : (Array.isArray(task.glabs_tasks) ? task.glabs_tasks : []);
  let completedGlabsCount = 0;
  if (Array.isArray(glabsIds) && glabsIds.length > 0 && glabsList.length > 0) {
    const byTaskId = new Map(glabsList.map((g) => [g.task_id, g]));
    for (const gid of glabsIds) {
      const rec = byTaskId.get(gid);
      if (rec && rec.status === 'completed' && rec.video_url) {
        completedGlabsCount++;
      }
    }
  }

  const hasLocalVisualClips = clipCount > 0 && localVisualClipsCount === clipCount;
  const hasCompletedGlabs = clipCount > 0 && Array.isArray(glabsIds) && glabsIds.length >= clipCount && completedGlabsCount === clipCount;
  const hasVisualClips = hasLocalVisualClips || hasCompletedGlabs;

  let t2iExistingCount = 0;
  if (Array.isArray(t2iImages)) {
    for (const imgPath of t2iImages) {
      if (typeof imgPath === 'string' && resolveExistingPublicFile(imgPath)) {
        t2iExistingCount++;
      }
    }
  }
  const hasAnyT2iImages = t2iExistingCount > 0;
  const hasAllT2iImages = clipCount > 0 && t2iExistingCount >= clipCount;

  const hasCombinedAudio = Boolean(audioCfg.combined_audio_path && resolveExistingPublicFile(audioCfg.combined_audio_path));
  const hasFinalVideo = Boolean(task.ffmpeg_output_path && resolveExistingPublicFile(task.ffmpeg_output_path));

  const artifacts = {
    clip_count: clipCount,
    visual_clips_count: hasLocalVisualClips ? localVisualClipsCount : completedGlabsCount,
    local_visual_clips_count: localVisualClipsCount,
    completed_glabs_count: completedGlabsCount,
    has_local_visual_clips: hasLocalVisualClips,
    has_completed_glabs: hasCompletedGlabs,
    has_visual_clips: hasVisualClips,
    t2i_images_count: t2iExistingCount,
    has_any_t2i_images: hasAnyT2iImages,
    has_all_t2i_images: hasAllT2iImages,
    has_combined_audio: hasCombinedAudio,
    has_final_video: hasFinalVideo,
  };

  const recommendedStage = resolveMultiplierResumeStage(task, artifacts);
  artifacts.recommended_resume_stage = recommendedStage;
  artifacts.recommended_resume_label = MULTIPLIER_STAGE_LABELS[recommendedStage] || recommendedStage;

  return artifacts;
}

export const VALID_RETRY_STAGES = new Set(['remaking', 't2i', 'tts', 'visuals', 'ffmpeg', 'cloud']);

export const IN_PROGRESS_STUCK_STATUSES = new Set([
  'pending_resolution',
  'resolving_product',
  'remaking',
  'generating_t2i',
  'generating_audio',
  'generating_visuals',
  'ffmpeg_muxing',
  'uploading_assets',
]);

/**
 * Memetakan `stage` retry eksplisit menjadi status worker berikutnya beserta validasi artefak.
 */
export function resolveMultiplierStageRetryTarget(task = {}, stage, dbGlabsTasks = null) {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  if (!VALID_RETRY_STAGES.has(normalizedStage)) {
    return {
      ok: false,
      statusCode: 400,
      error: `Stage retry '${stage}' tidak valid. Pilihan: remaking, t2i, tts, visuals, ffmpeg, cloud.`,
    };
  }

  const artifacts = inspectMultiplierTaskArtifacts(task, dbGlabsTasks);
  if (normalizedStage === 'ffmpeg' && !artifacts.has_visual_clips) {
    return {
      ok: false,
      statusCode: 409,
      error: 'Klip video G-Labs belum lengkap untuk langsung menjalankan FFmpeg Muxing. Gunakan Lanjutkan / Visuals terlebih dahulu.',
      artifacts,
    };
  }
  if (normalizedStage === 'cloud' && !artifacts.has_final_video) {
    return {
      ok: false,
      statusCode: 409,
      error: 'File video master hasil FFmpeg belum ditemukan di disk; jalankan FFmpeg Muxing terlebih dahulu.',
      artifacts,
    };
  }

  const nextStatus = FAILED_CODE_TO_WORKER_STATUS[normalizedStage] || 'pending_resolution';
  return {
    ok: true,
    stage: normalizedStage,
    nextStatus,
    label: MULTIPLIER_STAGE_LABELS[nextStatus] || nextStatus,
    artifacts,
  };
}
