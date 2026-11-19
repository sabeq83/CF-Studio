import { withTenantContext, checkUniverseManagerAccess } from '../../../../../lib/auth.js';
import { getReferenceAsset, archiveReferenceAsset } from '../../../../../lib/reference-asset-repository.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  try {
    const { id } = await params;
    const asset = await getReferenceAsset(id);
    if (!asset) {
      return new Response(JSON.stringify({ success: false, error_code: 'OWNER_NOT_FOUND', error: 'Asset not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, data: asset }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error_code: err.error_code || err.code || 'INTERNAL_ERROR', error: err.message }), {
      status: err.status || 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:approve');
  if (denied) return denied;

  try {
    const { id } = await params;
    const result = await archiveReferenceAsset(id, user?.id || user?.email || 'user');
    return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, data: result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error_code: err.error_code || err.code || 'ARCHIVE_FAILED', error: err.message }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
