import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../../../lib/auth.js';
import { getDb } from '../../../../../../lib/db.js';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');
    const db = getDb();

    let campaign = null;
    if (campaignId) {
      campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
    } else {
      campaign = await db.prepare(
        "SELECT * FROM pillar_campaigns WHERE (content_pillar = 'Recipe Campaign' OR id LIKE 'opc_%' OR campaign_name LIKE '%Recipe%') ORDER BY created_at DESC LIMIT 1"
      ).get();
    }

    if (!campaign) {
      return NextResponse.json({
        success: true,
        campaign: null,
        stages: null,
        is_completed: false,
        telemetry: {
          timestamp: new Date().toLocaleTimeString('id-ID'),
          message: 'Belum ada kampanye aktif.'
        }
      });
    }

    const items = await db.prepare(
      'SELECT * FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC'
    ).all(campaign.id);

    const primaryItem = (items && items.length > 0) ? items[0] : null;

    // Ekstrak judul resep dari row_creative_payload atau result_json
    let itemTopic = campaign.campaign_name;
    try {
      if (primaryItem?.row_creative_payload) {
        const payload = typeof primaryItem.row_creative_payload === 'string'
          ? JSON.parse(primaryItem.row_creative_payload)
          : primaryItem.row_creative_payload;
        itemTopic = payload?.title || payload?.topic || payload?.recipe_name || itemTopic;
      } else if (primaryItem?.result_json) {
        const resObj = typeof primaryItem.result_json === 'string'
          ? JSON.parse(primaryItem.result_json)
          : primaryItem.result_json;
        itemTopic = resObj?.title || resObj?.recipe_name || itemTopic;
      }
    } catch (_) {}

    // Hitung total klip dari new_video_plan_json
    let totalClips = 8;
    try {
      if (primaryItem?.new_video_plan_json) {
        const plan = typeof primaryItem.new_video_plan_json === 'string'
          ? JSON.parse(primaryItem.new_video_plan_json)
          : primaryItem.new_video_plan_json;
        if (Array.isArray(plan) && plan.length > 0) totalClips = plan.length;
      }
    } catch (_) {}

    // Hitung start frames yang selesai
    const expectedFrames = Number(primaryItem?.start_frame_expected_count || totalClips);
    const completedFrames = Number(primaryItem?.start_frame_completed_count || (primaryItem?.start_frame_status === 'completed' ? expectedFrames : 0));

    // Hitung visual clips Veo yang selesai
    let completedVisualClips = 0;
    try {
      if (primaryItem?.visual_clip_paths) {
        const clips = typeof primaryItem.visual_clip_paths === 'string'
          ? JSON.parse(primaryItem.visual_clip_paths)
          : primaryItem.visual_clip_paths;
        if (Array.isArray(clips)) completedVisualClips = clips.filter(Boolean).length;
      }
    } catch (_) {
      completedVisualClips = primaryItem?.visual_status === 'completed' ? totalClips : 0;
    }
    if (primaryItem?.visual_status === 'completed') {
      completedVisualClips = totalClips;
    }

    // Hitung TTS clips yang selesai
    let completedTtsClips = 0;
    if (primaryItem?.tts_batch_id) {
      try {
        const ttsCount = await db.prepare(
          'SELECT COUNT(*)::int as cnt FROM tts_studio_clips WHERE batch_id = ? AND audio_path IS NOT NULL'
        ).get(primaryItem.tts_batch_id);
        completedTtsClips = ttsCount?.cnt || (primaryItem.tts_status === 'completed' ? totalClips : 0);
      } catch (_) {
        completedTtsClips = primaryItem.tts_status === 'completed' ? totalClips : 0;
      }
    } else if (primaryItem?.tts_status === 'completed') {
      completedTtsClips = totalClips;
    }

    // Cek ContentFlow Hub sync
    let hubSynced = false;
    if (primaryItem) {
      if (primaryItem.contentflow_sync_status === 'completed' || primaryItem.contentflow_sync_status === 'synced' || primaryItem.contentflow_item_id) {
        hubSynced = true;
      } else {
        try {
          const hubItem = await db.prepare(
            "SELECT id, pipeline_status FROM content_flow_items WHERE source_item_id = ? OR source_campaign_id = ? LIMIT 1"
          ).get(String(primaryItem.id), campaign.id);
          if (hubItem) hubSynced = true;
        } catch (_) {}
      }
    }

    // 1. Tahap 1: Planner Creation
    const s1 = {
      step: 1,
      status: 'completed',
      title: 'Planner Creation',
      desc: 'Container & brand kategori',
      badge: `✓ ${campaign.source_planner_id || campaign.planner_id || 'pln_ready'}`
    };

    // 2. Tahap 2: Storyboard Creation
    const isS2Done = primaryItem && primaryItem.generation_status === 'completed';
    const isS2Failed = primaryItem && primaryItem.generation_status === 'failed';
    const s2 = {
      step: 2,
      status: isS2Done ? 'completed' : (isS2Failed ? 'failed' : 'processing'),
      title: 'Storyboard Creation',
      desc: 'Gemini AI 1-Pass & 8 adegan',
      badge: isS2Done ? `✓ ${totalClips} Klip Siap` : (isS2Failed ? 'Gagal Naskah' : 'Menyusun Naskah...')
    };

    // 3. Tahap 3: Start Frame Generation
    const isS3Done = primaryItem && (primaryItem.start_frame_status === 'completed' || primaryItem.start_frame_status === 'skipped');
    const isS3Processing = primaryItem && primaryItem.start_frame_status === 'processing';
    const isS3Failed = primaryItem && primaryItem.start_frame_status === 'failed';
    const s3 = {
      step: 3,
      status: isS3Done ? 'completed' : (isS3Failed ? 'failed' : (isS3Processing ? 'processing' : (isS2Done ? 'processing' : 'idle'))),
      title: 'Start Frame Generation',
      desc: 'Gambar acuan continuity',
      badge: isS3Done ? `✓ ${expectedFrames}/${expectedFrames} Frame` : (isS3Processing ? `Memproses ${completedFrames}/${expectedFrames}` : (isS2Done ? 'Antrean Frame' : 'Menunggu'))
    };

    // 4. Tahap 4: TTS Generation
    const isS4Done = primaryItem && primaryItem.tts_status === 'completed';
    const isS4Processing = primaryItem && (primaryItem.tts_status === 'processing' || (isS3Done && primaryItem.tts_status === 'pending'));
    const isS4Failed = primaryItem && primaryItem.tts_status === 'failed';
    const s4 = {
      step: 4,
      status: isS4Done ? 'completed' : (isS4Failed ? 'failed' : (isS4Processing ? 'processing' : 'idle')),
      title: 'TTS Generation',
      desc: 'Minimax expressive audio',
      badge: isS4Done ? `✓ ${totalClips}/${totalClips} Audio` : (isS4Processing ? `Sintesis ${completedTtsClips}/${totalClips}` : (isS4Failed ? 'Gagal TTS' : 'Menunggu'))
    };

    // 5. Tahap 5: Video Generation
    const isS5Done = primaryItem && primaryItem.visual_status === 'completed';
    const isS5Processing = primaryItem && (primaryItem.visual_status === 'processing' || (isS4Done && primaryItem.visual_status === 'pending'));
    const isS5Failed = primaryItem && primaryItem.visual_status === 'failed';
    const s5 = {
      step: 5,
      status: isS5Done ? 'completed' : (isS5Failed ? 'failed' : (isS5Processing ? 'processing' : 'idle')),
      title: 'Video Generation',
      desc: 'Google Veo Omni Flash @ 4s',
      badge: isS5Done ? `✓ ${totalClips}/${totalClips} Video` : (isS5Processing ? `Veo ${completedVisualClips}/${totalClips}` : (isS5Failed ? 'Gagal Render' : 'Menunggu'))
    };

    // 6. Tahap 6: FFmpeg Processing
    const isS6Done = primaryItem && primaryItem.ffmpeg_status === 'completed' && Boolean(primaryItem.ffmpeg_output_path);
    const isS6Processing = primaryItem && (primaryItem.ffmpeg_status === 'processing' || (isS5Done && primaryItem.ffmpeg_status === 'pending'));
    const isS6Failed = primaryItem && primaryItem.ffmpeg_status === 'failed';
    const s6 = {
      step: 6,
      status: isS6Done ? 'completed' : (isS6Failed ? 'failed' : (isS6Processing ? 'processing' : 'idle')),
      title: 'FFmpeg Processing',
      desc: 'Muxing 8 klip + VO + BGM',
      badge: isS6Done ? '✓ MP4 Final' : (isS6Processing ? 'Muxing MP4...' : (isS6Failed ? 'Gagal Muxing' : 'Menunggu'))
    };

    // 7. Tahap 7: Cloud & Sync
    const isCloudDone = Boolean(primaryItem?.drive_link);
    const isS7Done = isCloudDone && hubSynced;
    const isS7Processing = isS6Done && !isS7Done;
    const s7 = {
      step: 7,
      status: isS7Done ? 'completed' : (isS7Processing ? 'processing' : 'idle'),
      title: 'Cloud & Sync',
      desc: 'Nextcloud & Hub ContentFlow',
      badge: isS7Done ? '✓ Nextcloud + Hub' : (isCloudDone ? 'Syncing Hub...' : (isS7Processing ? 'Uploading Nextcloud...' : 'Menunggu'))
    };

    // Generate telemetry log message
    let telemetryMsg = 'Pipeline idle/menunggu...';
    if (isS7Done) {
      telemetryMsg = `✓ Video final tersimpan di Nextcloud dan tersinkron ke ContentFlow Hub 🚀`;
    } else if (isCloudDone && !hubSynced) {
      telemetryMsg = `Video berhasil diunggah ke Nextcloud. Menyinkronkan metadata ke ContentFlow Hub...`;
    } else if (isS6Processing) {
      telemetryMsg = `Menjalankan muxing FFmpeg untuk 8 klip video + audio VO narasi + background music...`;
    } else if (isS5Processing) {
      telemetryMsg = `Sedang merender klip video #${Math.min(completedVisualClips + 1, totalClips)} dari ${totalClips} via Google Veo Omni Flash...`;
    } else if (isS4Processing) {
      telemetryMsg = `Sedang mensintesis audio voice-over Minimax klip #${Math.min(completedTtsClips + 1, totalClips)} dari ${totalClips}...`;
    } else if (isS3Processing) {
      telemetryMsg = `Sedang memproses gambar acuan start-frame kontinuitas visual 8 adegan...`;
    } else if (!isS2Done) {
      telemetryMsg = `Gemini AI sedang menyusun ideasi, resep, dan naskah 8 klip storyboard...`;
    }

    const now = new Date();
    const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.campaign_name,
        topic: itemTopic,
        status: campaign.status,
        item_id: primaryItem?.id || null,
        drive_link: primaryItem?.drive_link || null,
        contentflow_hub_synced: hubSynced
      },
      stages: { s1, s2, s3, s4, s5, s6, s7 },
      is_completed: isS7Done,
      telemetry: {
        timestamp: timeStr,
        message: telemetryMsg
      }
    });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline/status Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

