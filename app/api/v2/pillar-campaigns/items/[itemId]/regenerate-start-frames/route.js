import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { queueStartFrameRevision } from '@/lib/pillar-start-frame-service';
import { buildOpcStartFrameRequest } from '@/lib/opc-start-frame-request';

function parseJson(value, fallback = []) { try { return JSON.parse(value || ''); } catch { return fallback; } }

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    if (!itemId) return NextResponse.json({ success: false, error: 'itemId is required' }, { status: 400 });
    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
    if (!item) return NextResponse.json({ success: false, error: 'Campaign item not found' }, { status: 404 });
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    if (['queued', 'running'].includes(item.regenerate_start_frames_status)) {
      return NextResponse.json({ success: false, error: 'Regenerasi start frame sedang berjalan.' }, { status: 409 });
    }
    const body = await request.json().catch(() => ({}));
    let plan = parseJson(item.new_video_plan_json).filter(clip => clip.clip_index && clip.t2i_prompt);
    if (!plan.length) return NextResponse.json({ success: false, error: 'Tidak ada prompt T2I pada item ini.' }, { status: 400 });
    // Hotfix 18 Nov 2026: only_missing=true -> hanya klip yang belum punya start frame yang dibuat ulang
    // (klip yang sudah jadi dibawa ke revisi baru lewat carryForwardCompleted). Tanpa opsi ini perilaku lama tetap.
    if (body?.only_missing === true) {
      const currentPaths = parseJson(item.t2i_images_json, []);
      plan = plan.filter(clip => !currentPaths[Number(clip.clip_index) - 1]);
      if (!plan.length) {
        return NextResponse.json({ success: true, message: 'Semua start frame sudah lengkap; tidak ada yang dibuat ulang.', itemId: Number(item.id), queued: 0 });
      }
    }
    const clips = plan.map(clip => ({
      clip_index: Number(clip.clip_index),
      context: {
        campaignId: campaign.id,
        itemId: item.id,
        clipIndex: Number(clip.clip_index),
        prompt: clip.t2i_prompt,
        origin: 'bulk_regen'
      }
    }));
    for (const clip of clips) {
      await buildOpcStartFrameRequest({ campaign, item, clipIndex: clip.context.clipIndex, prompt: clip.context.prompt, origin: 'bulk_regen_preflight' });
    }
    const queued = await queueStartFrameRevision(itemId, clips, { expectedCount: Number(campaign.target_clips_count || clips.length), carryForwardCompleted: true });
    return NextResponse.json({ success: true, message: 'Regenerasi start frame masuk antrean durable.', ...queued }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
