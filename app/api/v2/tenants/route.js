import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const isMaster = user.role === 'superadmin' || 
      (user.scopes && (user.scopes.includes('tenant:superadmin') || user.scopes.includes('system:admin')));

    let sql;
    let params = [];

    if (isMaster) {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE status = 'active' 
        ORDER BY name ASC
      `;
    } else {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE id = $1 AND status = 'active'
      `;
      params = [user.tenantId];
    }

    const res = await pgQuery(sql, params);
    return NextResponse.json({
      success: true,
      active_tenant: user.tenantId,
      is_master: isMaster,
      tenants: res.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
