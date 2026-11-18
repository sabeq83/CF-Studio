import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/video-studio/campaign-videos
 * 
 * Mengembalikan daftar video yang tersedia dari sumber:
 * RE Campaign — dua level:
 *    a. Klip per-scene dari G-Labs (visual_clip_paths) — jika visual_status = 'completed'
 *    b. Video final FFmpeg (ffmpeg_output_path) — jika ffmpeg_status = 'completed'
 */
export async function GET() {
  try {
    const db = getDb();

    // ─────────────────────────────────────────
    // 1. RE Campaign: ambil semua item yang punya klip visual (per-scene)
    // ─────────────────────────────────────────
    const reItems = await db.prepare(`
      SELECT 
        i.id AS item_id,
        i.source_url,
        i.visual_clip_paths,
        i.visual_status,
        i.ffmpeg_output_path,
        i.ffmpeg_status,
        i.result_json,
        c.id AS campaign_id,
        c.campaign_name
      FROM re_campaign_items i
      JOIN re_campaigns c ON i.campaign_id = c.id
      WHERE i.visual_status = 'completed'
        AND i.visual_clip_paths IS NOT NULL
        AND i.visual_clip_paths != '[]'
        AND i.visual_clip_paths != ''
      ORDER BY c.created_at DESC, i.id DESC
    `).all();

    const reCampaignVideos = [];

    for (const row of reItems) {
      // Parse t2v_prompts untuk mendapatkan label per-scene
      let sceneLabels = [];
      try {
        const resultJson = JSON.parse(row.result_json || '{}');
        const prompts = resultJson.t2v_prompts || [];
        sceneLabels = prompts.map((p, i) => {
          // t2v_prompts bisa berupa string atau objek {visual, audio}
          if (typeof p === 'string') return `Scene ${i + 1}`;
          return p.scene_label || p.label || `Scene ${i + 1}`;
        });
      } catch {}

      // Parse visual_clip_paths
      let clipPaths = [];
      try {
        clipPaths = JSON.parse(row.visual_clip_paths || '[]');
      } catch {
        continue;
      }

      // Expose klip per-scene
      for (let i = 0; i < clipPaths.length; i++) {
        const relPath = clipPaths[i]; // e.g. "/temp/re_glabs_25_clip_0.mp4"
        const absPath = path.join(process.cwd(), 'public', relPath);
        if (!fs.existsSync(absPath)) continue;

        const sceneLabel = sceneLabels[i] || `Scene ${i + 1}`;
        const sourceLabel = row.source_url?.split('/').pop() || `item_${row.item_id}`;

        reCampaignVideos.push({
          id: `re::${row.item_id}::clip${i}`,
          label: `${row.campaign_name} › ${sourceLabel} › ${sceneLabel}`,
          campaign_name: row.campaign_name,
          campaign_id: row.campaign_id,
          item_id: row.item_id,
          scene_index: i,
          scene_label: sceneLabel,
          source_url: row.source_url,
          fs_path: relPath,        // path relatif ke /public
          abs_path: absPath,
          source: 're_campaign',
          clip_type: 'scene'       // bisa "scene" atau "final"
        });
      }

      // Juga expose video final FFmpeg jika ada
      if (row.ffmpeg_status === 'completed' && row.ffmpeg_output_path) {
        const absPath = path.join(process.cwd(), 'public', row.ffmpeg_output_path);
        if (fs.existsSync(absPath)) {
          const sourceLabel = row.source_url?.split('/').pop() || `item_${row.item_id}`;
          reCampaignVideos.push({
            id: `re::${row.item_id}::final`,
            label: `${row.campaign_name} › ${sourceLabel} › ★ Final (Merged)`,
            campaign_name: row.campaign_name,
            campaign_id: row.campaign_id,
            item_id: row.item_id,
            scene_index: -1,
            scene_label: 'Final (Merged)',
            source_url: row.source_url,
            fs_path: row.ffmpeg_output_path,
            abs_path: absPath,
            source: 're_campaign',
            clip_type: 'final'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        re_campaign: reCampaignVideos
      }
    });

  } catch (error) {
    console.error('[Campaign Videos API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
