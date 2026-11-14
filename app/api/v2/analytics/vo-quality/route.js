import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { aggregateVoQualityRows } from '@/lib/vo-quality-validator';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const tenantId = user?.tenantId || 'default_tenant';
    const url = new URL(request.url);
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 7)));
    const brandFilter = String(url.searchParams.get('brand') || '').trim().toLowerCase();

    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const db = getDb();

    const opcRows = await db.prepare(`
      SELECT
        i.id,
        i.vo_quality_status,
        i.vo_quality_score_json,
        i.updated_at,
        COALESCE(NULLIF(c.account_name, ''), NULLIF(bp.brand_name, ''), 'Unassigned') AS brand_name
      FROM pillar_campaign_items i
      JOIN pillar_campaigns c ON c.id = i.campaign_id
      LEFT JOIN brand_profiles bp ON bp.id = c.brand_profile_id
      WHERE i.tenant_id = ?
        AND (i.vo_quality_score_json IS NOT NULL OR (i.vo_quality_status IS NOT NULL AND i.vo_quality_status != 'skipped'))
        AND i.updated_at >= ?
    `).all(tenantId, sinceIso);

    const mulRows = await db.prepare(`
      SELECT
        id,
        vo_quality_status,
        vo_quality_score_json,
        created_at,
        COALESCE(NULLIF(account_name, ''), 'Multiplier') AS brand_name
      FROM re_multiplier_tasks
      WHERE tenant_id = ?
        AND (vo_quality_score_json IS NOT NULL OR (vo_quality_status IS NOT NULL AND vo_quality_status != 'skipped'))
        AND created_at >= ?
    `).all(tenantId, sinceIso);

    let combined = [...(opcRows || []), ...(mulRows || [])];
    if (brandFilter) {
      combined = combined.filter(r => String(r.brand_name || '').toLowerCase().includes(brandFilter));
    }

    const report = aggregateVoQualityRows(combined);
    return NextResponse.json({
      success: true,
      period_days: days,
      since: sinceIso,
      ...report
    });
  } catch (err) {
    console.error('[API /v2/analytics/vo-quality GET Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
