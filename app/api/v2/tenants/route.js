import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { listAccessibleTenantsForUser } from '@/lib/operator-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_request, _ctx, user) => {
  try {
    const payload = await listAccessibleTenantsForUser(user);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

