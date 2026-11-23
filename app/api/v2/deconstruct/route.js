import { NextResponse } from 'next/server';
import {
  createSavedDeconstructAssets,
  listDeconstructAssets,
  getDb
} from '@/lib/db';
import { pgQuery } from '@/lib/db-pg';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = getActiveTenantId();

    // Mode legacy: list completed assets untuk consumer Labs (mendukung q, niche, brand_id, promo_role, limit)
    if (searchParams.get('assets') === 'true') {
      const q = searchParams.get('q') || '';
      const niche = searchParams.get('niche') || '';
      const rawBrandId = searchParams.get('brand_id') || '';
      const rawPromoRole = searchParams.get('promo_role') || '';
      const promoRole = ['alat_dapur', 'bahan_resep'].includes(rawPromoRole) ? rawPromoRole : '';
      const includeMatches = searchParams.get('include_matches') !== 'false';
      const limit = Number(searchParams.get('limit') || 20);

      let resolvedBrandId = rawBrandId && rawBrandId !== 'all' ? rawBrandId : '';
      if (resolvedBrandId) {
        try {
          const bRes = await pgQuery(
            `SELECT id FROM brand_profiles WHERE tenant_id = $1 AND (id = $2 OR LOWER(brand_name) = LOWER($2)) LIMIT 1`,
            [tenantId, resolvedBrandId]
          );
          if (bRes.rows[0]?.id) resolvedBrandId = bRes.rows[0].id;
        } catch (_) {}
      }

      const db = getDb();
      let query = "SELECT id, batch_id, source_url, original_caption, niche, tags, created_at, viral_pattern_summary, product_ideas_json, original_storyboard_json, core_problem, core_solution, target_audience_pain_point FROM re_deconstructed_assets WHERE status = 'deconstructed' AND tenant_id = ?";
      const params = [tenantId];

      if (niche) {
        query += " AND niche = ?";
        params.push(niche);
      }

      if (q) {
        query += " AND (source_url ILIKE ? OR niche ILIKE ? OR tags ILIKE ? OR original_caption ILIKE ? OR viral_pattern_summary ILIKE ? OR product_ideas_json ILIKE ? OR core_problem ILIKE ? OR core_solution ILIKE ?)";
        const likeQ = `%${q}%`;
        params.push(likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ, likeQ);
      }

      if (resolvedBrandId) {
        if (promoRole) {
          query += " AND EXISTS (SELECT 1 FROM blueprint_product_matches bpm WHERE bpm.deconstruct_asset_id = re_deconstructed_assets.id AND bpm.tenant_id = re_deconstructed_assets.tenant_id AND bpm.brand_profile_id = ? AND bpm.promo_role = ? AND bpm.is_food_safe = TRUE)";
          params.push(resolvedBrandId, promoRole);
        } else {
          query += " AND EXISTS (SELECT 1 FROM blueprint_product_matches bpm WHERE bpm.deconstruct_asset_id = re_deconstructed_assets.id AND bpm.tenant_id = re_deconstructed_assets.tenant_id AND bpm.brand_profile_id = ? AND bpm.is_food_safe = TRUE)";
          params.push(resolvedBrandId);
        }
      } else if (promoRole) {
        query += " AND EXISTS (SELECT 1 FROM blueprint_product_matches bpm WHERE bpm.deconstruct_asset_id = re_deconstructed_assets.id AND bpm.tenant_id = re_deconstructed_assets.tenant_id AND bpm.promo_role = ? AND bpm.is_food_safe = TRUE)";
        params.push(promoRole);
      }

      query += " ORDER BY created_at DESC LIMIT ?";
      params.push(limit);

      const rows = await db.prepare(query).all(...params);

      let matchesByAsset = new Map();
      if (includeMatches && rows.length > 0) {
        try {
          const assetIds = rows.map(r => r.id);
          const mParams = [tenantId, assetIds];
          let mWhere = 'm.tenant_id = $1 AND m.deconstruct_asset_id = ANY($2::text[])';
          if (resolvedBrandId) {
            mParams.push(resolvedBrandId);
            mWhere += ` AND m.brand_profile_id = $${mParams.length}`;
          }
          if (promoRole) {
            mParams.push(promoRole);
            mWhere += ` AND m.promo_role = $${mParams.length}`;
          }
          const mRes = await pgQuery(
            `SELECT m.deconstruct_asset_id, m.brand_profile_id, b.brand_name, m.product_id, m.promo_role,
                    m.match_score, m.match_reason, m.is_food_safe, p.product_name
             FROM blueprint_product_matches m
             JOIN product_extractions p ON p.id = m.product_id AND p.tenant_id = m.tenant_id
             LEFT JOIN brand_profiles b ON b.id = m.brand_profile_id AND b.tenant_id = m.tenant_id
             WHERE ${mWhere}
             ORDER BY m.match_score DESC`,
            mParams
          );
          for (const mr of mRes.rows) {
            if (!matchesByAsset.has(mr.deconstruct_asset_id)) {
              matchesByAsset.set(mr.deconstruct_asset_id, { is_food_safe: mr.is_food_safe, brands: {}, top_products: [] });
            }
            const bucket = matchesByAsset.get(mr.deconstruct_asset_id);
            const brandKey = mr.brand_name || mr.brand_profile_id;
            if (!bucket.brands[brandKey]) {
              bucket.brands[brandKey] = { brand_profile_id: mr.brand_profile_id, alat_dapur: 0, bahan_resep: 0 };
            }
            if (mr.promo_role === 'alat_dapur') bucket.brands[brandKey].alat_dapur += 1;
            if (mr.promo_role === 'bahan_resep') bucket.brands[brandKey].bahan_resep += 1;
            if (bucket.top_products.length < 6) {
              bucket.top_products.push({
                product_id: mr.product_id,
                product_name: mr.product_name,
                brand_id: mr.brand_profile_id,
                brand_name: mr.brand_name || brandKey,
                promo_role: mr.promo_role,
                match_score: mr.match_score,
                match_reason: mr.match_reason,
              });
            }
          }
        } catch (mErr) {
          console.warn('[Deconstruct API] match enrichment skipped:', mErr.message);
        }
      }
      
      const assets = rows.map(row => {
        let scene_count = 0;
        try {
          scene_count = JSON.parse(row.original_storyboard_json || '[]').length;
        } catch(_) {}

        let recommended_products = [];
        try {
          const ideas = JSON.parse(row.product_ideas_json || '[]');
          recommended_products = Array.isArray(ideas) ? ideas : [];
        } catch(_) {}

        const matchBucket = matchesByAsset.get(row.id);

        return {
          id: row.id,
          batch_id: row.batch_id,
          source_url: row.source_url,
          original_caption: row.original_caption,
          niche: row.niche,
          tags: row.tags,
          deconstructed_at: row.created_at,
          viral_pattern_summary: row.viral_pattern_summary,
          original_storyboard_json: row.original_storyboard_json,
          product_ideas_json: row.product_ideas_json,
          core_problem: row.core_problem || '',
          core_solution: row.core_solution || '',
          target_audience_pain_point: row.target_audience_pain_point || '',
          scene_count,
          recommended_products,
          is_food_safe: matchBucket ? matchBucket.is_food_safe : !/(skincare|home\s*care)/i.test(row.niche || ''),
          match_summary: matchBucket ? matchBucket.brands : {},
          top_products: matchBucket ? matchBucket.top_products : []
        };
      });

      return NextResponse.json({ success: true, assets });
    }

    const q = searchParams.get('q') || '';
    const niche = searchParams.get('niche') || '';
    const status = searchParams.get('status') || '';
    const brandId = searchParams.get('brand_id') || '';
    const promoRole = searchParams.get('promo_role') || '';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 25);

    const result = await listDeconstructAssets({ q, niche, status, brandId, promoRole, page, limit }, tenantId);
    return NextResponse.json({
      success: true,
      assets: result.assets,
      niches: result.niches,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[Deconstruct API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const { niche } = body;
    const tenantId = getActiveTenantId();

    const nicheVal = (niche && niche.trim()) ? niche.trim() : 'Auto-Detect';
    const defaultPageSource = (body.page_source && body.page_source.trim()) ? body.page_source.trim() : 'Siasat Sehat';

    let items = [];

    if (body.csv_data && Array.isArray(body.csv_data)) {
      items = body.csv_data
        .filter(row => row.url && row.url.trim())
        .map(row => ({
          url: row.url.trim(),
          page_source: (row.page_source && row.page_source.trim()) ? row.page_source.trim() : defaultPageSource,
          caption: (row.caption || '').trim() || null,
        }));
    } else if (body.urls) {
      const urls = body.urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const captions = body.captions
        ? body.captions.split('\n').map(c => c.trim())
        : [];

      items = urls.map((url, i) => ({
        url,
        page_source: defaultPageSource,
        caption: captions[i] || null,
      }));
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Setidaknya satu URL video wajib diisi' }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 URL per batch' }, { status: 400 });
    }

    // URL validation
    for (const item of items) {
      try {
        new URL(item.url);
      } catch {
        return NextResponse.json({ success: false, error: `URL tidak valid: ${item.url}` }, { status: 400 });
      }
    }

    const { savedCount, duplicateCount, savedIds } = await createSavedDeconstructAssets(
      items,
      nicheVal,
      tenantId
    );

    return NextResponse.json({
      success: true,
      saved_count: savedCount,
      duplicate_count: duplicateCount,
      saved_ids: savedIds
    });

  } catch (error) {
    console.error('[Deconstruct API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
