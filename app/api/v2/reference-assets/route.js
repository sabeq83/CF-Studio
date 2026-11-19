import { withTenantContext, checkUniverseManagerAccess } from '../../../../lib/auth.js';
import { listReferenceAssets } from '../../../../lib/reference-asset-repository.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const owner_type = url.searchParams.get('owner_type');
    const owner_id = url.searchParams.get('owner_id');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    const data = await listReferenceAssets({ owner_type, owner_id, role, status });
    return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error_code: err.error_code || err.code || 'INTERNAL_ERROR',
      error: err.message
    }), {
      status: err.status || 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
