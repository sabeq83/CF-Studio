import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const db = getDb();
    const item = await db.prepare('SELECT id, result_json, new_video_plan_json, visual_status, visual_clip_paths FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item kampanye tidak ditemukan.' }, { status: 404 });
    }
    const resultJson = JSON.parse(item.result_json || '{}');
    const voiceover = resultJson.voiceover || [];
    return NextResponse.json({
      success: true,
      item_id: itemId,
      voiceover,
      visual_status: item.visual_status
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PATCH = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { voiceover, auto_trigger_remux } = body;

    if (!Array.isArray(voiceover) || voiceover.length === 0) {
      return NextResponse.json({ success: false, error: 'Array voiceover tidak valid.' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item kampanye tidak ditemukan.' }, { status: 404 });
    }

    let resultJson = JSON.parse(item.result_json || '{}');
    resultJson.voiceover = voiceover.map(v => ({
      scene: Number(v.scene),
      narration: String(v.narration || '').trim()
    }));

    let planJson = [];
    try { planJson = JSON.parse(item.new_video_plan_json || '[]'); } catch (_) {}
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
      new_video_plan_json: planJson.length > 0 ? JSON.stringify(planJson) : item.new_video_plan_json
    };

    if (auto_trigger_remux) {
      let visualPaths = [];
      try { visualPaths = JSON.parse(item.visual_clip_paths || '[]'); } catch (_) {}
      if (item.visual_status !== 'completed' || !Array.isArray(visualPaths) || visualPaths.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Video G-Labs belum lengkap. Re-mux otomatis hanya dapat dijalankan jika visual berstatus completed.'
        }, { status: 409 });
      }

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
    }

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
