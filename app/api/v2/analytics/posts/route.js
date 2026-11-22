import { getCurrentUser } from '../../../../../lib/auth.js';
import { pgQuery } from '../../../../../lib/db-pg.js';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

const ALLOWED_SORT_COLUMNS = new Map([
  ['engagement_score', 'engagement_score'],
  ['views', 'pms.views'],
  ['reach', 'pms.reach'],
  ['likes', 'pms.likes'],
  ['comments', 'pms.comments'],
  ['shares', 'pms.shares'],
  ['saves', 'pms.saves'],
  ['avg_watch_sec', 'pms.avg_watch_sec'],
  ['post_created_at', 'pms.post_created_at'],
  ['captured_at', 'pms.captured_at']
]);

export async function GET(req) {
  try {
    const tenantId = getTenantId(req);
    const { searchParams } = new URL(req.url);

    const brandId = searchParams.get('brandId') || null;
    const platform = searchParams.get('platform') || null;
    const tag = searchParams.get('tag') || 'latest';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const sortBy = searchParams.get('sortBy') || 'engagement_score';
    const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const insightAvailable = searchParams.get('insightAvailable');

    const sortExpr = ALLOWED_SORT_COLUMNS.get(sortBy) || 'engagement_score';

    // 1. Ambil brand profiles untuk pencocokan nama brand
    const bpRes = await pgQuery(`SELECT id, brand_name FROM brand_profiles WHERE tenant_id = $1`, [tenantId]);
    const brands = bpRes.rows;

    const resolveBrand = (displayName, title = '') => {
      const combined = `${displayName || ''} ${title || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const b of brands) {
        const bClean = String(b.brand_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (combined.includes(bClean) || bClean.includes(combined)) {
          return { brandId: b.id, brandName: b.brand_name };
        }
      }
      return { brandId: null, brandName: displayName || 'Tanpa Brand' };
    };

    const whereConditions = ['pms.tenant_id = $1'];
    const params = [tenantId];

    if (tag && ['h24', 'h72', 'd7', 'latest'].includes(tag)) {
      params.push(tag);
      whereConditions.push(`pms.snapshot_tag = $${params.length}`);
    }

    if (platform) {
      params.push(platform.toLowerCase());
      whereConditions.push(`pms.platform = $${params.length}`);
    }

    if (insightAvailable === 'true') {
      whereConditions.push(`pms.insight_available = TRUE`);
    } else if (insightAvailable === 'false') {
      whereConditions.push(`pms.insight_available = FALSE`);
    }

    const whereSql = whereConditions.join(' AND ');

    // 2. Ambil total count untuk pagination
    const countRes = await pgQuery(`
      SELECT COUNT(*)::bigint as total
      FROM post_metric_snapshots pms
      JOIN publishing_accounts pa ON pms.publishing_account_id = pa.id
      WHERE ${whereSql}
    `, params);
    const total = Number(countRes.rows[0]?.total || 0);

    // 3. Query data
    const querySql = `
      SELECT pms.id, pms.publishing_job_id, pms.publishing_account_id,
             pms.platform, pms.external_post_id, pms.permalink,
             pms.post_created_at, pms.snapshot_tag, pms.source, pms.age_hours,
             pms.views, pms.reach, pms.clicks, pms.reactions,
             pms.likes, pms.comments, pms.shares, pms.saves,
             pms.avg_watch_sec, pms.total_watch_sec, pms.view_pct,
             pms.full_watch_rate, pms.skip_rate, pms.insight_available,
             pms.captured_at,
             (
               COALESCE(pms.likes, 0) * 1 +
               COALESCE(pms.comments, 0) * 3 +
               COALESCE(pms.shares, 0) * 5 +
               COALESCE(pms.saves, 0) * 4 +
               COALESCE(pms.clicks, 0) * 2
             ) AS engagement_score,
             pa.display_name as account_display_name,
             COALESCE(pj.title_snapshot, '(Tanpa Judul)') as title,
             pj.is_ai_generated,
             pj.media_url_snapshot as video_url
      FROM post_metric_snapshots pms
      JOIN publishing_accounts pa ON pms.publishing_account_id = pa.id
      LEFT JOIN publishing_jobs pj ON pms.publishing_job_id = pj.id
      WHERE ${whereSql}
      ORDER BY ${sortExpr} ${order} NULLS LAST, pms.captured_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await pgQuery(querySql, dataParams);

    let posts = dataRes.rows.map(row => {
      const rb = resolveBrand(row.account_display_name, row.title);
      return {
        id: row.id,
        publishingJobId: row.publishing_job_id,
        publishingAccountId: row.publishing_account_id,
        accountDisplayName: row.account_display_name,
        brandId: rb.brandId,
        brandName: rb.brandName,
        title: row.title,
        isAiGenerated: Boolean(row.is_ai_generated),
        videoUrl: row.video_url || null,
        platform: row.platform,
        externalPostId: row.external_post_id,
        permalink: row.permalink,
        postCreatedAt: row.post_created_at,
        snapshotTag: row.snapshot_tag,
        source: row.source,
        ageHours: row.age_hours != null ? Number(row.age_hours) : null,
        views: row.views != null ? Number(row.views) : null,
        reach: row.reach != null ? Number(row.reach) : null,
        clicks: row.clicks != null ? Number(row.clicks) : null,
        reactions: row.reactions != null ? Number(row.reactions) : null,
        likes: row.likes != null ? Number(row.likes) : null,
        comments: row.comments != null ? Number(row.comments) : null,
        shares: row.shares != null ? Number(row.shares) : null,
        saves: row.saves != null ? Number(row.saves) : null,
        avgWatchSec: row.avg_watch_sec != null ? Number(row.avg_watch_sec) : null,
        totalWatchSec: row.total_watch_sec != null ? Number(row.total_watch_sec) : null,
        viewPct: row.view_pct != null ? Number(row.view_pct) : null,
        fullWatchRate: row.full_watch_rate != null ? Number(row.full_watch_rate) : null,
        skipRate: row.skip_rate != null ? Number(row.skip_rate) : null,
        insightAvailable: Boolean(row.insight_available),
        engagementScore: Number(row.engagement_score || 0),
        capturedAt: row.captured_at
      };
    });

    if (brandId) {
      posts = posts.filter(p => p.brandId === brandId);
    }

    return Response.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + posts.length < total
        }
      }
    });
  } catch (err) {
    console.error('[API Analytics Posts GET Error]:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
