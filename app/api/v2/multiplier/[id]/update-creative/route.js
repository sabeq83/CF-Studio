import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { normalizeAudioConfig } from '@/lib/multiplier-audio-config';
import { normalizeBridgePayload } from '@/lib/bridging/bridge-plan';
import { normalizeStoryboardVoFields } from '@/lib/tts-text-sanitizer';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { storyboard, vsoConfig, bridgingConfig, audioConfig, newCaption, ytTitle } = body;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    const normalizedStoryboard = normalizeStoryboardVoFields(Array.isArray(storyboard) ? storyboard : [], { preferEdited: true });

    // Map storyboard to prompts structure
    const prompts = normalizedStoryboard.map((s, idx) => ({
      clip: s.scene || (idx + 1),
      t2i_prompt: s.t2i_prompt || '',
      i2v_prompt: s.i2v_prompt || '',
      t2v_prompt: s.t2v_prompt || s.i2v_prompt || '',
      prompt: s.i2v_prompt || ''
    }));

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
    const targetClipsCount = normalizedStoryboard.length > 0 ? normalizedStoryboard.length : null;
    const bridgeNorm = normalizeBridgePayload(bridgingConfig || {}, vsoConfig || {}, {
      targetClips: targetClipsCount,
      defaultActive: bridgingConfig?.campaign_type !== 'pure_storytelling' && bridgingConfig?.is_bridging_active !== false
    });
    if (bridgeNorm.active && bridgeNorm.errors.length > 0) {
      return NextResponse.json({ success: false, error: bridgeNorm.errors[0] }, { status: 400 });
    }
    const normalizedBridging = {
      ...(bridgingConfig || {}),
      is_bridging_active: bridgeNorm.active,
      bridge_at_clip: bridgeNorm.legacy.bridge_at_clip,
      bridge_duration_clips: bridgeNorm.legacy.bridge_duration_clips,
      ...(bridgeNorm.active ? { bridge_segments: bridgeNorm.segments } : {})
    };
    if (!bridgeNorm.active) delete normalizedBridging.bridge_segments;

    await dbRun(`
      UPDATE re_multiplier_tasks
      SET remake_storyboard_json = ?,
          t2i_i2v_prompts_json = ?,
          vso_config_json = ?,
          bridging_config_json = ?,
          audio_config_json = ?,
          new_caption = ?,
          yt_title = COALESCE(?, yt_title)
      WHERE id = ?
    `, [
      JSON.stringify(normalizedStoryboard),
      JSON.stringify(prompts),
      JSON.stringify(vsoConfig || {}),
      JSON.stringify(normalizedBridging),
      JSON.stringify(normalizedAudio),
      newCaption || '',
      ytTitle !== undefined ? ytTitle : null,
      id
    ]);

    return NextResponse.json({ success: true, message: 'Storyboard dan konfigurasi berhasil disimpan.' });

  } catch (error) {
    console.error('[Update Creative Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
