import { getCurrentUser } from '../../../../../lib/auth.js';
import { collectMetrics } from '../../../../../lib/metrics-collector.js';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function POST(req) {
  try {
    const tenantId = getTenantId(req);
    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      // Body kosong diperbolehkan
    }

    const dryRun = Boolean(body?.dryRun);
    const accountId = body?.accountId ? String(body.accountId).trim() : null;

    console.log(`[API Analytics Collect] Memulai pengumpulan analitik (tenant: ${tenantId}, dryRun: ${dryRun}, accountId: ${accountId || 'all'})`);

    const result = await collectMetrics({
      tenantId,
      now: new Date(),
      dryRun,
      accountId
    });

    return Response.json({
      success: true,
      message: dryRun
        ? `Simulasi selesai: ${result.accountsProcessed} akun diperiksa, ${result.apiCallsMade} panggilan API.`
        : `Pengumpulan selesai: ${result.accountsProcessed} akun, ${result.dailyMetricRowsUpserted} baris harian, ${result.postSnapshotsUpserted} snapshot postingan.`,
      data: result
    });
  } catch (err) {
    console.error('[API Analytics Collect Error]:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
