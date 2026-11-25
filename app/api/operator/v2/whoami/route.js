import { NextResponse } from 'next/server';
import { authenticateOperator } from '@/lib/operator-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const identity = await authenticateOperator(request, 'automation:read');
    return NextResponse.json({
      success: true,
      operator: {
        id: identity.actor,
        name: identity.name,
        tenant_id: identity.tenantId,
        default_tenant_id: identity.defaultTenantId || identity.tenantId,
        is_master: Boolean(identity.isMaster),
        allowed_tenant_ids: Array.isArray(identity.allowedTenantIds) ? identity.allowedTenantIds : [identity.tenantId],
        allowed_tools: Array.isArray(identity.allowedTools) ? identity.allowedTools : null,
        expires_at: identity.expiresAt || null,
        scopes: identity.scopes
      }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
}
