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

function calcGrowth(curr, prev) {
  if (prev == null || prev === 0) {
    return curr > 0 ? 100 : 0;
  }
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

export async function GET(req) {
  try {
    const tenantId = getTenantId(req);
    const { searchParams } = new URL(req.url);

    const brandId = searchParams.get('brandId') || null;
    const platform = searchParams.get('platform') || null;
    const accountId = searchParams.get('accountId') || null;
    const period = searchParams.get('period') || '7d';

    const periodDays = period === '30d' ? 30 : (period === '14d' ? 14 : 7);

    // 1. Ambil brand profiles untuk pencocokan nama brand
    const bpRes = await pgQuery(`SELECT id, brand_name FROM brand_profiles WHERE tenant_id = $1`, [tenantId]);
    const brands = bpRes.rows;

    const resolveBrand = (displayName) => {
      const clean = String(displayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const b of brands) {
        const bClean = String(b.brand_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.includes(bClean) || bClean.includes(clean)) {
          return { brandId: b.id, brandName: b.brand_name };
        }
      }
      return { brandId: null, brandName: displayName || 'Tanpa Brand' };
    };

    // 2. Ambil akun-akun yang sesuai filter
    let acctSql = `
      SELECT pa.id, pa.platform, pa.display_name, pa.provider,
             pa.insights_status, pa.insights_checked_at
      FROM publishing_accounts pa
      WHERE pa.tenant_id = $1 AND pa.status = 'active'
    `;
    const acctParams = [tenantId];

    if (accountId) {
      acctParams.push(accountId);
      acctSql += ` AND pa.id = $${acctParams.length}`;
    }
    if (platform) {
      acctParams.push(platform.toLowerCase());
      acctSql += ` AND pa.platform = $${acctParams.length}`;
    }

    acctSql += ` ORDER BY pa.platform ASC, pa.display_name ASC`;
    const acctRes = await pgQuery(acctSql, acctParams);
    let accounts = acctRes.rows;

    if (brandId) {
      accounts = accounts.filter(acc => {
        const rb = resolveBrand(acc.display_name);
        return rb.brandId === brandId;
      });
    }

    if (accounts.length === 0) {
      return Response.json({
        success: true,
        data: {
          period,
          periodDays,
          summary: {
            totalAccounts: 0,
            views: 0,
            reach: 0,
            engagement: 0,
            netFollows: 0,
            viewsGrowth: 0,
            reachGrowth: 0,
            engagementGrowth: 0,
            netFollowsGrowth: 0
          },
          accounts: []
        }
      });
    }

    const accountIds = accounts.map(a => a.id);

    // 2. Ambil agregat metrik periode saat ini (current)
    const currRes = await pgQuery(`
      SELECT publishing_account_id,
             COALESCE(SUM(views), 0)::bigint as total_views,
             COALESCE(SUM(reach), 0)::bigint as total_reach,
             COALESCE(SUM(engagement), 0)::bigint as total_engagement,
             COALESCE(SUM(video_views), 0)::bigint as total_video_views,
             COALESCE(SUM(profile_views), 0)::bigint as total_profile_views,
             COALESCE(SUM(new_follows), 0)::bigint as total_new_follows,
             COALESCE(SUM(unfollows), 0)::bigint as total_unfollows
      FROM account_metric_daily
      WHERE tenant_id = $1
        AND publishing_account_id = ANY($2::text[])
        AND metric_date >= CURRENT_DATE - ($3 || ' days')::interval
      GROUP BY publishing_account_id
    `, [tenantId, accountIds, periodDays]);

    const currMap = new Map();
    for (const r of currRes.rows) currMap.set(r.publishing_account_id, r);

    // 3. Ambil agregat metrik periode sebelumnya (previous)
    const prevRes = await pgQuery(`
      SELECT publishing_account_id,
             COALESCE(SUM(views), 0)::bigint as total_views,
             COALESCE(SUM(reach), 0)::bigint as total_reach,
             COALESCE(SUM(engagement), 0)::bigint as total_engagement,
             COALESCE(SUM(video_views), 0)::bigint as total_video_views,
             COALESCE(SUM(profile_views), 0)::bigint as total_profile_views,
             COALESCE(SUM(new_follows), 0)::bigint as total_new_follows,
             COALESCE(SUM(unfollows), 0)::bigint as total_unfollows
      FROM account_metric_daily
      WHERE tenant_id = $1
        AND publishing_account_id = ANY($2::text[])
        AND metric_date >= CURRENT_DATE - ($3 || ' days')::interval
        AND metric_date < CURRENT_DATE - ($4 || ' days')::interval
      GROUP BY publishing_account_id
    `, [tenantId, accountIds, periodDays * 2, periodDays]);

    const prevMap = new Map();
    for (const r of prevRes.rows) prevMap.set(r.publishing_account_id, r);

    // 4. Ambil followers_total terbaru per akun
    const latestFollowersRes = await pgQuery(`
      SELECT DISTINCT ON (publishing_account_id) publishing_account_id, followers_total, metric_date
      FROM account_metric_daily
      WHERE tenant_id = $1 AND publishing_account_id = ANY($2::text[]) AND followers_total IS NOT NULL
      ORDER BY publishing_account_id, metric_date DESC
    `, [tenantId, accountIds]);

    const followersMap = new Map();
    for (const r of latestFollowersRes.rows) followersMap.set(r.publishing_account_id, Number(r.followers_total));

    // 5. Gabungkan metrik per akun dan hitung total lapis atas
    let sumCurrViews = 0;
    let sumCurrReach = 0;
    let sumCurrEng = 0;
    let sumCurrNetFollows = 0;

    let sumPrevViews = 0;
    let sumPrevReach = 0;
    let sumPrevEng = 0;
    let sumPrevNetFollows = 0;

    const accountList = accounts.map(acc => {
      const c = currMap.get(acc.id) || {};
      const p = prevMap.get(acc.id) || {};

      const cViews = Number(c.total_views || 0);
      const cReach = Number(c.total_reach || 0);
      const cEng = Number(c.total_engagement || 0);
      const cVidViews = Number(c.total_video_views || 0);
      const cProfViews = Number(c.total_profile_views || 0);
      const cNewFollows = Number(c.total_new_follows || 0);
      const cUnfollows = Number(c.total_unfollows || 0);
      const cNetFollows = cNewFollows - cUnfollows;

      const pViews = Number(p.total_views || 0);
      const pReach = Number(p.total_reach || 0);
      const pEng = Number(p.total_engagement || 0);
      const pNetFollows = Number(p.total_new_follows || 0) - Number(p.total_unfollows || 0);

      sumCurrViews += cViews;
      sumCurrReach += cReach;
      sumCurrEng += cEng;
      sumCurrNetFollows += cNetFollows;

      sumPrevViews += pViews;
      sumPrevReach += pReach;
      sumPrevEng += pEng;
      sumPrevNetFollows += pNetFollows;

      const rb = resolveBrand(acc.display_name);

      return {
        id: acc.id,
        displayName: acc.display_name,
        platform: acc.platform,
        provider: acc.provider,
        brandId: rb.brandId,
        brandName: rb.brandName,
        insightsStatus: acc.insights_status || 'unknown',
        insightsCheckedAt: acc.insights_checked_at,
        followersTotal: followersMap.get(acc.id) ?? null,
        metrics: {
          views: cViews,
          reach: cReach,
          engagement: cEng,
          videoViews: cVidViews,
          profileViews: cProfViews,
          newFollows: cNewFollows,
          unfollows: cUnfollows,
          netFollows: cNetFollows
        },
        growth: {
          viewsPct: calcGrowth(cViews, pViews),
          reachPct: calcGrowth(cReach, pReach),
          engagementPct: calcGrowth(cEng, pEng),
          netFollowsPct: calcGrowth(cNetFollows, pNetFollows)
        }
      };
    });

    return Response.json({
      success: true,
      data: {
        period,
        periodDays,
        summary: {
          totalAccounts: accounts.length,
          views: sumCurrViews,
          reach: sumCurrReach,
          engagement: sumCurrEng,
          netFollows: sumCurrNetFollows,
          viewsGrowth: calcGrowth(sumCurrViews, sumPrevViews),
          reachGrowth: calcGrowth(sumCurrReach, sumPrevReach),
          engagementGrowth: calcGrowth(sumCurrEng, sumPrevEng),
          netFollowsGrowth: calcGrowth(sumCurrNetFollows, sumPrevNetFollows)
        },
        accounts: accountList
      }
    });
  } catch (err) {
    console.error('[API Analytics Accounts GET Error]:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
