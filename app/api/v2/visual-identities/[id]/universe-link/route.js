import { withTenantContext, checkUniverseManagerAccess } from '../../../../../../lib/auth.js';
import { getVisualIdentity, updateVisualIdentity } from '../../../../../../lib/visual-identity-repository.js';
import { getUniverseProfile, getUniverseCharacters } from '../../../../../../lib/db.js';
import { pgQuery } from '../../../../../../lib/db-pg.js';
import { linkVisualIdentityToUniverse } from '../../../../../../lib/visual-identity-universe-link.js';

export const dynamic = 'force-dynamic';

async function findActiveSchedulesForVi(visualIdentityId, tenantId) {
  const res = await pgQuery(
    `SELECT id, name FROM content_automation_schedules
     WHERE tenant_id = $1 AND status = 'active'
       AND (pipeline_config::text LIKE $2 OR config_json::text LIKE $2)
     LIMIT 20`,
    [tenantId, `%${visualIdentityId}%`]
  );
  return res.rows || [];
}

export const POST = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:approve');
  if (denied) return denied;

  const tenantId = user?.tenantId || null;
  try {
    const { id } = await params;
    const body = await req.json();

    const result = await linkVisualIdentityToUniverse({
      visualIdentityId: id,
      universeId: body?.universe_id,
      characterKeys: body?.character_keys,
      characterLockMode: body?.character_lock_mode,
      dryRun: body?.dry_run !== undefined ? Boolean(body.dry_run) : true,
      tenantId,
      actor: user?.id || user?.email || 'user',
      deps: {
        getVisualIdentityFn: getVisualIdentity,
        updateVisualIdentityFn: updateVisualIdentity,
        getUniverseProfileFn: getUniverseProfile,
        getUniverseCharactersFn: getUniverseCharacters,
        findActiveSchedulesForViFn: findActiveSchedulesForVi
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
      error_code: err.error_code || err.code || 'LINK_FAILED',
      error: err.message
    }), {
      status: err.status || 400,
      headers: { 'content-type': 'application/json' }
    });
  }
});
