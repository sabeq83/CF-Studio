import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listOpportunitiesWithProducts } from '@/lib/threads-affiliate-repository';

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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const items = await listOpportunitiesWithProducts(tenantId, { status, limit });

    const counts = {
      all: items.length,
      ready: items.filter(i => i.draft_status === 'draft' || i.draft_status === 'pending_review').length,
      posted: items.filter(i => i.draft_status === 'posted').length,
      skipped: items.filter(i => i.draft_status === 'skipped').length
    };

    return NextResponse.json({
      success: true,
      data: items,
      counts
    });
  } catch (err) {
    console.error('[API Threads Opportunities GET Error]:', err);
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}

