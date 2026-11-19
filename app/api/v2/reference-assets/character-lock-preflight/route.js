import { withTenantContext, checkUniverseManagerAccess } from '../../../../../lib/auth.js';
import { getVisualIdentity } from '../../../../../lib/visual-identity-repository.js';
import { getUniverseProfile } from '../../../../../lib/db.js';
import { getReferenceAsset } from '../../../../../lib/reference-asset-repository.js';
import { runCharacterLockPreflight } from '../../../../../lib/character-lock-preflight.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  const tenantId = user?.tenantId || null;
  try {
    const body = await req.json();
    const result = await runCharacterLockPreflight({
      visualIdentityId: body?.visual_identity_id,
      mode: body?.mode || 'advisory',
      samplePrompt: body?.sample_prompt || null,
      tenantId,
      deps: {
        getVisualIdentityFn: getVisualIdentity,
        getUniverseProfileFn: getUniverseProfile,
        getReferenceAssetFn: getReferenceAsset
      }
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      tenant_id: tenantId,
      error_code: err.error_code || err.code || 'PREFLIGHT_FAILED',
      error: err.message
    }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
