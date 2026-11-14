import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem, updatePillarCampaign } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { buildVoiceoverSaveUpdates } from '@/lib/vo-status-ui';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const db = getDb();
    const item = await db.prepare('SELECT id, campaign_id, result_json, new_video_plan_json, visual_status, visual_clip_paths FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item kampanye tidak ditemukan.' }, { status: 404 });
    }
    const campaign = await db.prepare('SELECT enable_motion_text, motion_text_style, video_transition FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
    const resultJson = JSON.parse(item.result_json || '{}');
    const voiceover = resultJson.voiceover || [];
    return NextResponse.json({
      success: true,
      item_id: itemId,
      voiceover,
      visual_status: item.visual_status,
      enable_motion_text: campaign?.enable_motion_text !== undefined ? campaign.enable_motion_text : 1,
      motion_text_style: campaign?.motion_text_style || 'floating_white_yellow',
      video_transition: campaign?.video_transition || 'cut'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PATCH = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { voiceover, auto_trigger_remux, motion_text_style, video_transition, enable_motion_text } = body;

    if (!Array.isArray(voiceover) || voiceover.length === 0) {
      return NextResponse.json({ success: false, error: 'Array voiceover tidak valid.' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item kampanye tidak ditemukan.' }, { status: 404 });
    }

    // Update motion text & transition on campaign if provided
    if (motion_text_style || video_transition || enable_motion_text !== undefined) {
      const campUpdates = {};
      if (motion_text_style) campUpdates.motion_text_style = motion_text_style;
      if (video_transition) campUpdates.video_transition = video_transition;
      if (enable_motion_text !== undefined) campUpdates.enable_motion_text = enable_motion_text ? 1 : 0;
      await updatePillarCampaign(item.campaign_id, campUpdates);
    }

    if (auto_trigger_remux) {
      let visualPaths = [];
      try { visualPaths = JSON.parse(item.visual_clip_paths || '[]'); } catch (_) {}
      if (item.visual_status !== 'completed' || !Array.isArray(visualPaths) || visualPaths.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Video G-Labs belum lengkap. Re-mux otomatis hanya dapat dijalankan jika visual berstatus completed.'
        }, { status: 409 });
      }
    }

    const { updateFields, resultJson } = buildVoiceoverSaveUpdates(item, { voiceover, auto_trigger_remux });

    await updatePillarCampaignItem(itemId, updateFields);

    return NextResponse.json({
      success: true,
      message: auto_trigger_remux
        ? 'Naskah voiceover berhasil diperbarui dan proses TTS Re-mux telah dijadwalkan!'
        : 'Naskah voiceover berhasil disimpan.',
      voiceover: resultJson.voiceover
    });
  } catch (error) {
    console.error('[QuickEditVoiceover API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

