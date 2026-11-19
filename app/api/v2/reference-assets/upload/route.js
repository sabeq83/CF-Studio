import { withTenantContext, checkUniverseManagerAccess } from '../../../../../lib/auth.js';
import { uploadReferenceAsset } from '../../../../../lib/reference-asset-service.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const owner_type = formData.get('owner_type');
    const owner_id = formData.get('owner_id');
    const role = formData.get('role');
    const universe_id = formData.get('universe_id') || null;

    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ success: false, error_code: 'VALIDATION_ERROR', error: 'No file uploaded' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadReferenceAsset({
      owner_type,
      owner_id,
      role,
      universe_id
    }, fileBuffer, user?.id || user?.email || 'user');

    return new Response(JSON.stringify({
      success: true,
      tenant_id: user?.tenantId || null,
      deduplicated: Boolean(result?.deduplicated),
      data: result
    }), {
      status: result?.deduplicated ? 200 : 201,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error_code: err.error_code || err.code || 'UPLOAD_FAILED',
      error: err.message
    }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
