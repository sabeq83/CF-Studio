import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../../../lib/auth.js';
import { getDb } from '../../../../../../lib/db.js';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
    const typeFilter = searchParams.get('type') || 'all';
    const db = getDb();

    // 1. Fetch Pillar Campaigns (Recipe, Product, Editorial)
    let opcRows = [];
    try {
      opcRows = await db.prepare(`
        SELECT 
          c.id, c.campaign_name, c.status, c.created_at, c.brand_profile_id,
          c.content_pillar, c.visual_identity_preset_id, c.target_clips_count, c.clip_duration, c.video_model,
          bp.brand_name
        FROM pillar_campaigns c
        LEFT JOIN brand_profiles bp ON c.brand_profile_id = bp.id
        ORDER BY c.created_at DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.warn('[Batches API] Error querying pillar_campaigns:', e.message);
    }

    // 2. Fetch Multiplier Tasks
    let mulRows = [];
    try {
      mulRows = await db.prepare(`
        SELECT 
          t.id, t.campaign_name, t.status, t.created_at, t.brand_profile_id, t.account_name,
          t.vso_config_json, t.nextcloud_video_url, bp.brand_name
        FROM re_multiplier_tasks t
        LEFT JOIN brand_profiles bp ON t.brand_profile_id = bp.id
        ORDER BY t.created_at DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.warn('[Batches API] Error querying re_multiplier_tasks:', e.message);
    }

    // 3. Fetch Recipe Campaigns (Recipe Labs)
    let rcpRows = [];
    try {
      rcpRows = await db.prepare(`
        SELECT 
          r.id, r.visual_style, r.status, r.created_at, r.brand_profile_id, r.target_recipe_count, r.images_per_recipe,
          bp.brand_name
        FROM recipe_campaigns r
        LEFT JOIN brand_profiles bp ON r.brand_profile_id = bp.id
        ORDER BY r.created_at DESC LIMIT ?
      `).all(limit);
    } catch (e) {
      console.warn('[Batches API] Error querying recipe_campaigns:', e.message);
    }

    // 4. Normalisasi dan Gabungkan Riwayat
    const unified = [
      ...opcRows.map(c => {
        let type = 'product_campaign';
        let badge = '📦 Promosi Produk';
        if (c.content_pillar === 'Recipe Campaign' || (c.campaign_name && c.campaign_name.includes('Recipe'))) {
          type = 'recipe_campaign';
          badge = '🍲 Video Resep';
        } else if (c.content_pillar === 'brand_editorial' || (c.campaign_name && c.campaign_name.includes('Editorial'))) {
          type = 'editorial_campaign';
          badge = '📰 Brand Editorial';
        }
        return {
          id: c.id,
          campaign_type: type,
          type_badge: badge,
          campaign_name: c.campaign_name || 'OPC Batch Campaign',
          brand_name: c.brand_name || 'Brand Profile',
          brand_profile_id: c.brand_profile_id || null,
          visual_identity_preset_id: c.visual_identity_preset_id || 'vi_default',
          format_klip: `${c.target_clips_count || 8} Klip @ ${c.clip_duration || 4}s (${c.video_model || 'omni_flash'})`,
          status: c.status || 'running',
          total_items: 1,
          target_detail_url: '/pillar-campaigns',
          detail_label: 'Detail OPC ↗',
          video_url: null,
          created_at: c.created_at
        };
      }),
      ...mulRows.map(m => {
        let vso = {};
        try { vso = typeof m.vso_config_json === 'string' ? JSON.parse(m.vso_config_json) : (m.vso_config_json || {}); } catch(_) {}
        const clipDur = vso.clip_duration || vso.clipDuration || 8;
        return {
          id: m.id,
          campaign_type: 'multiplier_campaign',
          type_badge: '⚡ Multiplier',
          campaign_name: m.campaign_name || `Multiplier: ${m.id}`,
          brand_name: m.brand_name || m.account_name || 'Brand Profile',
          brand_profile_id: m.brand_profile_id || null,
          visual_identity_preset_id: vso.visual_style_preset || vso.visualStyle || 'Macrophotography',
          format_klip: `3 Klip @ ${clipDur}s (Veo Omni Flash)`,
          status: m.status || 'completed',
          total_items: 1,
          target_detail_url: '/multiplier-lab',
          detail_label: 'Detail Multiplier ↗',
          video_url: m.nextcloud_video_url || null,
          created_at: m.created_at
        };
      }),
      ...rcpRows.map(r => ({
        id: r.id,
        campaign_type: 'recipe_labs',
        type_badge: '📸 Recipe Labs',
        campaign_name: `Resep Labs: ${r.id}`,
        brand_name: r.brand_name || 'Brand Profile',
        brand_profile_id: r.brand_profile_id || null,
        visual_identity_preset_id: r.visual_style || 'Food Porn',
        format_klip: `${r.images_per_recipe || 4} Foto Carousel Split Grid`,
        status: r.status || 'completed',
        total_items: r.target_recipe_count || 1,
        target_detail_url: '/recipe-labs',
        detail_label: 'Detail Labs ↗',
        video_url: null,
        created_at: r.created_at
      }))
    ];

    // Urutkan kronologis terbaru (created_at DESC)
    unified.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter opsional berdasarkan tipe
    let filtered = unified;
    if (typeFilter && typeFilter !== 'all') {
      filtered = unified.filter(item => 
        item.campaign_type === typeFilter || 
        (typeFilter === 'multiplier' && item.campaign_type === 'multiplier_campaign') ||
        (typeFilter === 'recipe' && item.campaign_type === 'recipe_campaign') ||
        (typeFilter === 'product' && item.campaign_type === 'product_campaign') ||
        (typeFilter === 'editorial' && item.campaign_type === 'editorial_campaign') ||
        (typeFilter === 'recipelabs' && item.campaign_type === 'recipe_labs')
      );
    }

    const finalData = filtered.slice(0, limit);

    return NextResponse.json({
      success: true,
      count: finalData.length,
      total_found: filtered.length,
      data: finalData
    });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline/batches Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

