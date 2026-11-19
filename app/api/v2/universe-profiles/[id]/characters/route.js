import { withTenantContext, checkUniverseManagerAccess } from '../../../../../../lib/auth.js';
import { getUniverseCharacters, createUniverseCharacter, getUniverseProfile } from '../../../../../../lib/db.js';
import {
  validateCharacterKey,
  buildCreateUniverseCharacterPayload,
  isCharacterKeyConflictError
} from '../../../../../../lib/universe-route-validation.js';
import { refreshManifestCache } from '../../../../../../lib/universe-manifests.js';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  const { id } = await params;
  const characters = await getUniverseCharacters(id);
  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, data: characters }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const POST = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();

  if (!body || !body.name || !body.character_key || !body.canonical_prompt) {
    return new Response(JSON.stringify({ success: false, error_code: 'VALIDATION_ERROR', error: 'Name, character_key, and canonical_prompt are required.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (!validateCharacterKey(body.character_key)) {
    return new Response(JSON.stringify({
      success: false,
      error_code: 'INVALID_CHARACTER_KEY',
      error: 'character_key must match /^[a-z0-9_]{2,64}$/.'
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const universe = await getUniverseProfile(id);
  if (!universe) {
    return new Response(JSON.stringify({ success: false, error_code: 'OWNER_NOT_FOUND', error: 'Universe not found.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const existingChars = await getUniverseCharacters(id);
  if ((existingChars || []).some(c => c.character_key === body.character_key)) {
    return new Response(JSON.stringify({
      success: false,
      error_code: 'CHARACTER_KEY_EXISTS',
      error: 'Character key already exists in this universe.'
    }), {
      status: 409,
      headers: { 'content-type': 'application/json' }
    });
  }

  const charId = uuidv4();
  const payload = buildCreateUniverseCharacterPayload(body, charId, id);
  try {
    await createUniverseCharacter(payload);
  } catch (err) {
    if (isCharacterKeyConflictError(err)) {
      return new Response(JSON.stringify({
        success: false,
        error_code: 'CHARACTER_KEY_EXISTS',
        error: 'Character key already exists in this universe.'
      }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      });
    }
    throw err;
  }

  await refreshManifestCache({
    tenantId: user?.tenantId || universe.tenant_id,
    universeId: id
  }).catch(() => {});

  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, id: charId }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
});
