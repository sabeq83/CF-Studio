import { withTenantContext, checkUniverseManagerAccess } from '../../../../../../lib/auth.js';
import { approveReferenceAssetVersion } from '../../../../../../lib/reference-asset-service.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:approve');
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const result = await approveReferenceAssetVersion(id, body, user?.id || user?.email || 'user');

    return new Response(JSON.stringify({
      success: true,
      tenant_id: user?.tenantId || null,
      data: result
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error_code: err.error_code || err.code || 'APPROVAL_FAILED',
      error: err.message
    }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
