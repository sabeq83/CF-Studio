import { withTenantContext, checkUniverseManagerAccess } from '../../../../lib/auth.js';
import { getAllUniverseProfiles, createUniverseProfile, getUniverseProfileBySlug } from '../../../../lib/db.js';
import { buildCreateUniverseProfilePayload } from '../../../../lib/universe-route-validation.js';
import { refreshManifestCache } from '../../../../lib/universe-manifests.js';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  const profiles = await getAllUniverseProfiles();
  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, data: profiles }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const body = await req.json();
  if (!body || !body.name || !body.slug) {
    return new Response(JSON.stringify({ success: false, error_code: 'VALIDATION_ERROR', error: 'Name and slug are required.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const existing = await getUniverseProfileBySlug(body.slug);
  if (existing) {
    return new Response(JSON.stringify({ success: false, error_code: 'SLUG_EXISTS', error: 'Slug already exists.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' }
    });
  }

  const id = uuidv4();
  const payload = buildCreateUniverseProfilePayload(body, id);
  await createUniverseProfile(payload);
  await refreshManifestCache({ tenantId: user?.tenantId, universeId: id }).catch(() => {});

  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, id }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
