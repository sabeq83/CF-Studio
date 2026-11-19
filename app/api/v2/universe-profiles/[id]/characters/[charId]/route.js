import fs from 'fs';
import path from 'path';
import { withTenantContext, checkUniverseManagerAccess } from '../../../../../../../lib/auth.js';
import {
  getUniverseCharacter,
  getUniverseCharacters,
  updateUniverseCharacter,
  deleteUniverseCharacter,
  getUniverseProfile
} from '../../../../../../../lib/db.js';
import { pgQuery } from '../../../../../../../lib/db-pg.js';
import { getApprovedReferenceAssets } from '../../../../../../../lib/reference-asset-repository.js';
import {
  ALLOWED_UNIVERSE_CHARACTER_FIELDS,
  pickAllowedFields,
  validateCharacterKey,
  isCharacterKeyConflictError
} from '../../../../../../../lib/universe-route-validation.js';
import { refreshManifestCache } from '../../../../../../../lib/universe-manifests.js';

export const dynamic = 'force-dynamic';

function jsonResp(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function timestampsMatch(expected, actual) {
  if (!expected) return true;
  if (!actual) return false;
  const expStr = String(expected).trim();
  const actStr = actual instanceof Date ? actual.toISOString() : String(actual).trim();
  if (expStr === actStr) return true;
  const expMs = Date.parse(expStr);
  const actMs = Date.parse(actStr);
  if (Number.isFinite(expMs) && Number.isFinite(actMs)) {
    return expMs === actMs;
  }
  return false;
}

async function isCharacterKeyUsedByVisualIdentity(tenantId, universeId, universeSlug, characterKey) {
  const res = await pgQuery(
    `SELECT id, label, config_json FROM visual_identity_presets
     WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId]
  );
  for (const row of res.rows || []) {
    let cfg = row.config_json;
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch { cfg = null; }
    }
    const subj = cfg?.subject;
    if (!subj || !Array.isArray(subj.character_keys)) continue;
    const sameUniverse = (subj.universe_profile_id && subj.universe_profile_id === universeId)
      || (universeSlug && subj.universe_slug && subj.universe_slug.toLowerCase() === universeSlug.toLowerCase());
    if (sameUniverse && subj.character_keys.includes(characterKey)) {
      return { id: row.id, label: row.label };
    }
  }
  return null;
}

export const GET = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  const { id: universeId, charId } = await params;
  const character = await getUniverseCharacter(charId);
  if (!character || character.universe_id !== universeId) {
    return jsonResp({
      success: false,
      tenant_id: user?.tenantId || null,
      error_code: 'OWNER_NOT_FOUND',
      error: 'Character not found in this universe.'
    }, 404);
  }

  const assets = await getApprovedReferenceAssets('character', charId, ['identity', 'character_sheet']).catch(() => []);
  const identityAsset = assets.find(a => a.asset_role === 'identity') || null;
  const sheetAsset = assets.find(a => a.asset_role === 'character_sheet') || null;

  return jsonResp({
    success: true,
    tenant_id: user?.tenantId || character.tenant_id || null,
    data: {
      ...character,
      approved_assets: {
        identity: identityAsset
          ? {
              asset_id: identityAsset.id,
              version: identityAsset.version,
              sha256: identityAsset.sha256,
              public_path: identityAsset.public_path,
              source: 'approved_asset'
            }
          : (character.reference_image_path
              ? { public_path: character.reference_image_path, source: 'legacy_path' }
              : null),
        character_sheet: sheetAsset
          ? {
              asset_id: sheetAsset.id,
              version: sheetAsset.version,
              sha256: sheetAsset.sha256,
              public_path: sheetAsset.public_path,
              source: 'approved_asset'
            }
          : null
      }
    }
  }, 200);
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const { id: universeId, charId } = await params;
  const tenantId = user?.tenantId || null;

  const existingChar = await getUniverseCharacter(charId);
  if (!existingChar || existingChar.universe_id !== universeId) {
    return jsonResp({
      success: false,
      tenant_id: tenantId,
      error_code: 'OWNER_NOT_FOUND',
      error: 'Character not found in this universe.'
    }, 404);
  }

  const contentType = req.headers.get('content-type') || '';
  let body = {};

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('reference_image');
    for (const [key, value] of formData.entries()) {
      if (key !== 'reference_image') body[key] = value;
    }

    if (file && typeof file !== 'string' && file.size > 0) {
      const charKey = body.character_key || existingChar.character_key;
      const version = body.version || existingChar.version || 1;
      const ext = path.extname(file.name) || '.jpg';
      const dirPath = path.join(process.cwd(), 'public', 'uploads', 'universe-assets', universeId, 'characters', charKey, `v${version}`);
      fs.mkdirSync(dirPath, { recursive: true });
      const filePath = path.join(dirPath, `identity-anchor${ext}`);
      const arrayBuffer = await file.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      body.reference_image_path = `/uploads/universe-assets/${universeId}/characters/${charKey}/v${version}/identity-anchor${ext}`;
    }
  } else {
    body = await req.json();
  }

  if (body?.expected_updated_at && !timestampsMatch(body.expected_updated_at, existingChar.updated_at)) {
    return jsonResp({
      success: false,
      tenant_id: tenantId,
      error_code: 'REVISION_CONFLICT',
      error: 'Character has been modified since expected_updated_at.'
    }, 409);
  }

  const safePatch = pickAllowedFields(body, ALLOWED_UNIVERSE_CHARACTER_FIELDS);

  if (safePatch.character_key !== undefined && safePatch.character_key !== existingChar.character_key) {
    if (!validateCharacterKey(safePatch.character_key)) {
      return jsonResp({
        success: false,
        tenant_id: tenantId,
        error_code: 'INVALID_CHARACTER_KEY',
        error: 'character_key must match /^[a-z0-9_]{2,64}$/.'
      }, 400);
    }

    const universe = await getUniverseProfile(universeId);
    const inUseVi = await isCharacterKeyUsedByVisualIdentity(
      tenantId || existingChar.tenant_id,
      universeId,
      universe?.slug || null,
      existingChar.character_key
    );
    if (inUseVi) {
      return jsonResp({
        success: false,
        tenant_id: tenantId,
        error_code: 'CHARACTER_KEY_IN_USE',
        error: `Cannot change character_key "${existingChar.character_key}" because it is referenced by Visual Identity "${inUseVi.label}" (${inUseVi.id}).`
      }, 409);
    }

    const existingChars = await getUniverseCharacters(universeId);
    if ((existingChars || []).some(c => c.id !== charId && c.character_key === safePatch.character_key)) {
      return jsonResp({
        success: false,
        tenant_id: tenantId,
        error_code: 'CHARACTER_KEY_EXISTS',
        error: 'Character key already exists in this universe.'
      }, 409);
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return jsonResp({
      success: false,
      tenant_id: tenantId,
      error_code: 'VALIDATION_ERROR',
      error: 'No valid updatable fields provided.'
    }, 400);
  }

  try {
    await updateUniverseCharacter(charId, safePatch);
  } catch (err) {
    if (isCharacterKeyConflictError(err)) {
      return jsonResp({
        success: false,
        tenant_id: tenantId,
        error_code: 'CHARACTER_KEY_EXISTS',
        error: 'Character key already exists in this universe.'
      }, 409);
    }
    throw err;
  }

  await refreshManifestCache({
    tenantId: tenantId || existingChar.tenant_id,
    universeId
  }).catch(() => {});

  const updated = await getUniverseCharacter(charId);
  return jsonResp({
    success: true,
    tenant_id: tenantId,
    data: updated || { ...existingChar, ...safePatch },
    message: 'Character updated'
  }, 200);
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const { id: universeId, charId } = await params;
  const tenantId = user?.tenantId || null;

  const existingChar = await getUniverseCharacter(charId);
  if (!existingChar || existingChar.universe_id !== universeId) {
    return jsonResp({
      success: false,
      tenant_id: tenantId,
      error_code: 'OWNER_NOT_FOUND',
      error: 'Character not found in this universe.'
    }, 404);
  }

  await deleteUniverseCharacter(charId);
  await refreshManifestCache({
    tenantId: tenantId || existingChar.tenant_id,
    universeId
  }).catch(() => {});

  return jsonResp({
    success: true,
    tenant_id: tenantId,
    message: 'Character deleted'
  }, 200);
});
