/**
 * Shared helpers for Pillar & Multiplier VO block status classification,
 * semantic badge styling, and Quick Edit VO recovery updates.
 */

export function isPillarItemBlocked(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    item.review_state === 'vo_claim_blocked' ||
    item.tts_status === 'paused_compliance' ||
    item.review_state === 'vo_quality_blocked'
  );
}

export function getPillarItemBlockInfo(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.review_state === 'vo_claim_blocked' || item.tts_status === 'paused_compliance') {
    return {
      kind: 'claim',
      text: '🚫 Diblokir: klaim kesehatan',
      shortLabel: 'Diblokir Klaim',
      title: 'Klaim kesehatan/medis terdeteksi pada VO — edit naskah lalu simpan atau approve untuk melanjutkan TTS.',
      color: 'var(--status-danger)',
      bg: 'var(--status-danger-soft)',
      border: 'var(--status-danger)'
    };
  }
  if (item.review_state === 'vo_quality_blocked') {
    return {
      kind: 'quality',
      text: '⚠️ VO di bawah standar',
      shortLabel: 'VO Di Bawah Standar',
      title: 'VO diblokir VO Quality Gate — perbaiki otomatis atau edit naskah lalu simpan/approve.',
      color: 'var(--status-warning)',
      bg: 'var(--status-warning-soft)',
      border: 'var(--status-warning)'
    };
  }
  return null;
}

export function getPillarItemStatusInfo(item = {}, campaign = null, batchRegeneratingSF = {}) {
  let text = 'Fase 1 : Pending';
  let color = 'var(--text-muted)';
  let bg = 'var(--surface-interactive)';
  let pulse = false;

  const blockInfo = getPillarItemBlockInfo(item);
  if (blockInfo) {
    return {
      text: blockInfo.text,
      color: blockInfo.color,
      bg: blockInfo.bg,
      border: blockInfo.border,
      pulse: false,
      isBlocked: true,
      blockKind: blockInfo.kind
    };
  }

  const pauseAt = campaign?.scheduler_pause_at;

  // 1. Errors
  if (
    item.generation_status === 'failed' ||
    item.tts_status === 'failed' ||
    item.visual_status === 'failed' ||
    item.ffmpeg_status === 'failed' ||
    item.upload_status === 'failed' ||
    item.social_post_status === 'failed'
  ) {
    text = '⚠️ Error / Failed';
    color = 'var(--status-danger)';
    bg = 'var(--status-danger-soft)';
  }
  // 2. Pause states
  else if (pauseAt === 'tts' && item.generation_status === 'completed' && item.tts_status === 'pending' && item.workflow_status === 'ready_for_review') {
    text = '⏸️ Fase 2 : Paused (Review Script)';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
  } else if (pauseAt === 'visuals' && item.tts_status === 'completed' && item.visual_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Review Prompts)';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
  } else if (pauseAt === 'ffmpeg' && item.visual_status === 'completed' && item.ffmpeg_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Review Clips)';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
  } else if (pauseAt === 'social' && item.ffmpeg_status === 'completed' && item.social_post_status === 'pending') {
    text = '⏸️ Fase 2 : Paused (Ready to Post)';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
  }
  // 2.5 Start Frame Generation (Batch / Single)
  else if (
    item.workflow_status === 'start_frames_processing' ||
    item.start_frame_status === 'processing' ||
    ['queued', 'running'].includes(item.regenerate_start_frames_status) ||
    batchRegeneratingSF[item.id]
  ) {
    text = item.regenerate_start_frames_progress
      ? `⚡ Fase 1 : Generate Start Frame (${item.regenerate_start_frames_progress})`
      : '⚡ Fase 1 : Generate Start Frame';
    color = 'var(--status-success)';
    bg = 'var(--status-success-soft)';
    pulse = true;
  }
  // 3. Active processing states
  else if (item.generation_status === 'processing') {
    text = item.generation_progress ? `⚡ Fase 1 : ${item.generation_progress}` : '⚡ Fase 1 : AI Generation';
    color = 'var(--accent-light)';
    bg = 'var(--status-info-soft)';
    pulse = true;
  } else if (item.generation_status === 'pending_sourcing') {
    text = '⚡ Fase 1 : JIT Product Sourcing';
    color = 'var(--status-neutral)';
    bg = 'var(--surface-subtle)';
    pulse = true;
  } else if (item.generation_status === 'pending') {
    text = '⏳ Fase 1 : Queue for Generation';
    color = 'var(--text-muted)';
  } else if (item.tts_status === 'processing') {
    text = '⚡ Fase 2 : Generate TTS';
    color = 'var(--accent-light)';
    bg = 'var(--status-info-soft)';
    pulse = true;
  } else if (item.tts_status === 'pending' && item.generation_status === 'completed' && item.workflow_status === 'production_processing') {
    text = '⏳ Fase 2 : Queue for TTS';
    color = 'var(--text-muted)';
  } else if (item.visual_status === 'processing') {
    text = '⚡ Fase 2 : Generate Video';
    color = 'var(--status-neutral)';
    bg = 'var(--surface-subtle)';
    pulse = true;
  } else if (item.visual_status === 'pending' && item.tts_status === 'completed') {
    text = '⏳ Fase 2 : Queue for Video';
    color = 'var(--text-muted)';
  } else if (item.ffmpeg_status === 'processing') {
    text = '⚡ Fase 2 : FFMPEG Process';
    color = 'var(--status-info)';
    bg = 'var(--status-info-soft)';
    pulse = true;
  } else if (item.ffmpeg_status === 'pending' && item.visual_status === 'completed') {
    text = '⏳ Fase 2 : Queue for FFmpeg';
    color = 'var(--text-muted)';
  } else if (item.upload_status === 'uploading') {
    text = '⚡ Fase 2 : Uploading Assets';
    color = 'var(--status-info)';
    bg = 'var(--status-info-soft)';
    pulse = true;
  } else if (item.social_post_status === 'processing') {
    text = '⚡ Fase 2 : Social Posting';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
    pulse = true;
  }
  // 3.5 Paused Review
  else if (item.workflow_status === 'ready_for_review') {
    text = '⏸️ Fase 2 : Paused (Ready for Review)';
    color = 'var(--status-warning)';
    bg = 'var(--status-warning-soft)';
  }
  // 4. Completed states
  else if (item.social_post_status === 'completed' || item.upload_status === 'completed') {
    text = '✅ Fase 2 : Completed';
    color = 'var(--success)';
    bg = 'var(--status-success-soft)';
  } else if (item.generation_status === 'completed') {
    text = '✅ Fase 1 : Completed';
    color = 'var(--success)';
    bg = 'var(--status-success-soft)';
  }

  return {
    text,
    color,
    bg,
    pulse,
    isBlocked: false,
    blockKind: null
  };
}

export function getMultiplierWaitingBadge(task = {}) {
  const errMsg = String(task?.error_message || '').trim();
  if (!errMsg) return null;
  if (/klaim medis|herbal|paused_compliance/i.test(errMsg)) {
    return {
      text: '🚫 Diblokir: klaim kesehatan',
      color: 'var(--status-danger)',
      bg: 'var(--status-danger-soft)',
      border: 'var(--status-danger)',
      isPulse: false,
      isBlocked: true,
      blockKind: 'claim'
    };
  }
  if (/VO Quality Gate|VO di bawah standar|vo_quality|anchor|skor/i.test(errMsg)) {
    return {
      text: '⚠️ VO di bawah standar',
      color: 'var(--status-warning)',
      bg: 'var(--status-warning-soft)',
      border: 'var(--status-warning)',
      isPulse: false,
      isBlocked: true,
      blockKind: 'quality'
    };
  }
  return {
    text: '⚠️ Perlu Review VO / Storyboard',
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-soft)',
    border: 'var(--status-warning)',
    isPulse: false,
    isBlocked: true,
    blockKind: 'other'
  };
}

/**
 * Computes normalized database updates when saving Quick Edit VO on a Pillar Campaign item.
 * Ensures claim-blocked (`paused_compliance` / `vo_claim_blocked`) and quality-blocked (`vo_quality_blocked`)
 * items reset `tts_status` to `'pending'`, clear `review_state`/`review_reason`, and transition cleanly
 * back into `production_processing` or `ready_for_review`.
 */
export function buildVoiceoverSaveUpdates(item = {}, { voiceover = [], auto_trigger_remux = false } = {}) {
  const resultJson = JSON.parse(item?.result_json || '{}');
  resultJson.voiceover = (Array.isArray(voiceover) ? voiceover : []).map(v => ({
    scene: Number(v.scene),
    narration: String(v.narration || '').trim()
  }));

  let planJson = [];
  try {
    planJson = JSON.parse(item?.new_video_plan_json || '[]');
  } catch (_) {}
  if (Array.isArray(planJson) && planJson.length > 0) {
    planJson = planJson.map((p, idx) => {
      const match = resultJson.voiceover.find(v => Number(v.scene) === Number(p.clip_index || idx + 1));
      return {
        ...p,
        new_vo: match ? match.narration : (p.new_vo || '')
      };
    });
  }

  const updateFields = {
    result_json: JSON.stringify(resultJson),
    new_video_plan_json: planJson.length > 0 ? JSON.stringify(planJson) : (item?.new_video_plan_json ?? null)
  };

  const wasBlocked = isPillarItemBlocked(item);
  const wasWaitingApproval = item?.workflow_status === 'waiting_approval';

  if (auto_trigger_remux) {
    updateFields.workflow_status = 'production_processing';
    updateFields.tts_status = 'pending';
    updateFields.tts_batch_id = null;
    updateFields.ffmpeg_status = 'pending';
    updateFields.ffmpeg_output_path = null;
    updateFields.upload_status = 'pending';
    updateFields.drive_link = null;
    updateFields.social_post_status = 'pending';
    updateFields.social_links_json = null;
    updateFields.retry_count = 0;
    if (wasBlocked || wasWaitingApproval) {
      updateFields.review_state = 'approved';
      updateFields.review_reason = null;
    }
  } else if (wasBlocked || wasWaitingApproval) {
    updateFields.tts_status = 'pending';
    updateFields.review_state = null;
    updateFields.review_reason = null;
    updateFields.workflow_status = item?.tts_status === 'paused_compliance'
      ? 'production_processing'
      : 'ready_for_review';
  }

  return { updateFields, resultJson, planJson };
}

