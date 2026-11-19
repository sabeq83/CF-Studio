import { withTenantContext } from '../../../../lib/auth.js';
import { getAllUniverseProfiles, createUniverseProfile, getUniverseProfileBySlug } from '../../../../lib/db.js';
import { buildCreateUniverseProfilePayload } from '../../../../lib/universe-route-validation.js';
import { refreshManifestCache } from '../../../../lib/universe-manifests.js';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, ...rest) => {
  const profiles = await getAllUniverseProfiles();
  return new Response(JSON.stringify({ success: true, data: profiles }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, ...rest) => {
  const user = rest[rest.length - 1];
  const body = await req.json();
  if (!body || !body.name || !body.slug) {
    return new Response(JSON.stringify({ success: false, error: 'Name and slug are required.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const existing = await getUniverseProfileBySlug(body.slug);
  if (existing) {
    return new Response(JSON.stringify({ success: false, error: 'Slug already exists.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' }
    });
  }

  const id = uuidv4();
  const payload = buildCreateUniverseProfilePayload(body, id);
  await createUniverseProfile(payload);
  await refreshManifestCache({ tenantId: user?.tenantId, universeId: id }).catch(() => {});

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
