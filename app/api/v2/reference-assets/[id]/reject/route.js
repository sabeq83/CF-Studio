import { withTenantContext, checkUniverseManagerAccess } from '../../../../../../lib/auth.js';
import { rejectReferenceAsset, getReferenceAsset } from '../../../../../../lib/reference-asset-repository.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:approve');
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const notes = body?.reason || body?.notes || null;
    const result = await rejectReferenceAsset(id, { ...body, notes }, user?.id || user?.email || 'user');

    if (!result) {
      const existing = await getReferenceAsset(id);
      if (!existing) {
        return new Response(JSON.stringify({
          success: false,
          error_code: 'OWNER_NOT_FOUND',
          error: 'Reference asset not found.'
        }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        success: false,
        error_code: 'REVISION_CONFLICT',
        error: `Only draft assets can be rejected (current status: ${existing.status}).`
      }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      });
    }

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
      error_code: err.error_code || err.code || 'REJECT_FAILED',
      error: err.message
    }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
