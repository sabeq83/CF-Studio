import { getCurrentUser } from '../../../../../lib/auth.js';
import { pgQuery } from '../../../../../lib/db-pg.js';
import { getSetting } from '../../../../../lib/db.js';
import { getReplizCredentials } from '../../../../../lib/metrics-collector.js';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function GET(req) {
  try {
    const tenantId = getTenantId(req);

    // 1. Cek kredensial (tanpa membocorkan secret)
    const replizCreds = await getReplizCredentials(tenantId);
    const replizConfigured = Boolean(replizCreds.accessKey && replizCreds.secretKey);

    // 2. Ambil semua akun publishing
    const acctRes = await pgQuery(`
      SELECT id, platform, display_name, provider,
             insights_status, insights_checked_at, status
      FROM publishing_accounts
      WHERE tenant_id = $1
      ORDER BY platform ASC, display_name ASC
    `, [tenantId]);

    const accounts = acctRes.rows;
    let availableCount = 0;
    let permissionMissingCount = 0;
    let unsupportedCount = 0;
    let unknownCount = 0;
    let metaFbCount = 0;

    for (const a of accounts) {
      if (a.provider === 'meta' && a.platform === 'facebook') metaFbCount++;
      const s = a.insights_status || 'unknown';
      if (s === 'available') availableCount++;
      else if (s === 'permission_missing') permissionMissingCount++;
      else if (s === 'unsupported') unsupportedCount++;
      else unknownCount++;
    }

    // 3. Status scheduler
    const collectorActive = (await getSetting('analytics_collector_active')) === 'true';
    const collectorHour = (await getSetting('analytics_collector_hour')) || '3';
    const lastRunDate = (await getSetting('analytics_collector_last_run_date')) || null;
    const lastRunAt = (await getSetting('analytics_collector_last_run_at')) || null;

    // 4. Statistik database baris tersimpan
    const statsRes = await pgQuery(`
      SELECT
        (SELECT COUNT(*)::bigint FROM account_metric_daily WHERE tenant_id = $1) as account_metrics_count,
        (SELECT COUNT(*)::bigint FROM post_metric_snapshots WHERE tenant_id = $1) as post_snapshots_count,
        (SELECT MAX(metric_date) FROM account_metric_daily WHERE tenant_id = $1) as latest_metric_date,
        (SELECT MAX(captured_at) FROM post_metric_snapshots WHERE tenant_id = $1) as latest_snapshot_at
    `, [tenantId]);
    const dbStats = statsRes.rows[0] || {};

    return Response.json({
      success: true,
      data: {
        tenantId,
        credentials: {
          repliz: {
            configured: replizConfigured,
            apiUrl: replizCreds.apiUrl || 'https://api.repliz.com'
          },
          meta: {
            connectedPagesCount: metaFbCount
          }
        },
        scheduler: {
          active: collectorActive,
          targetHourWib: parseInt(collectorHour, 10),
          lastRunDate,
          lastRunAt
        },
        accounts: {
          total: accounts.length,
          insightsAvailable: availableCount,
          permissionMissing: permissionMissingCount,
          unsupported: unsupportedCount,
          unknown: unknownCount,
          list: accounts.map(a => ({
            id: a.id,
            displayName: a.display_name,
            platform: a.platform,
            provider: a.provider,
            status: a.status,
            insightsStatus: a.insights_status || 'unknown',
            insightsCheckedAt: a.insights_checked_at
          }))
        },
        storage: {
          accountDailyRows: Number(dbStats.account_metrics_count || 0),
          postSnapshotsRows: Number(dbStats.post_snapshots_count || 0),
          latestMetricDate: dbStats.latest_metric_date || null,
          latestSnapshotAt: dbStats.latest_snapshot_at || null
        }
      }
    });
  } catch (err) {
    console.error('[API Analytics Health GET Error]:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
