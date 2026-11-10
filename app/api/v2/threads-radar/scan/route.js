import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { executeRadarScanCycle } from '@/lib/threads-radar-scheduler';

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
    console.log(`[API Threads Scan Trigger] Memulai pemindaian manual untuk tenant: ${tenantId}`);

    const result = await executeRadarScanCycle(tenantId);
    return NextResponse.json({
      success: true,
      message: `Pemindaian selesai: ${result.keywordsChecked} kata kunci, ${result.postsFound} post baru, ${result.draftsCreated} draf AI`,
      data: result
    });
  } catch (err) {
    console.error('[API Threads Scan POST Error]:', err);
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}

