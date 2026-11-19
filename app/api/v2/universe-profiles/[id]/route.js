import { withTenantContext, checkUniverseManagerAccess } from '../../../../../lib/auth.js';
import { getUniverseProfile, getUniverseCharacters, getUniverseLocations, updateUniverseProfile, archiveUniverseProfile, getUniverseEpisodes, getUniverseProfileBySlug, dbRun } from '../../../../../lib/db.js';
import { getApprovedReferenceAssetsForUniverse } from '../../../../../lib/reference-asset-repository.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:read');
  if (denied) return denied;

  const { id } = await params;
  const profile = await getUniverseProfile(id);
  if (!profile) {
    return new Response(JSON.stringify({ success: false, error_code: 'OWNER_NOT_FOUND', error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
  const characters = await getUniverseCharacters(id);
  const locations = await getUniverseLocations(id);
  const approvedAssets = await getApprovedReferenceAssetsForUniverse(id, user?.tenantId || profile.tenant_id).catch(() => []);

  const enrichedCharacters = (characters || []).map(char => {
    const identityAsset = approvedAssets.find(
      a => a.owner_type === 'character' && a.owner_id === char.id && a.asset_role === 'identity'
    );
    const sheetAsset = approvedAssets.find(
      a => a.owner_type === 'character' && a.owner_id === char.id && a.asset_role === 'character_sheet'
    );
    return {
      ...char,
      approved_assets: {
        identity: identityAsset
          ? {
              asset_id: identityAsset.id,
              version: identityAsset.version,
              sha256: identityAsset.sha256,
              public_path: identityAsset.public_path,
              source: 'approved_asset'
            }
          : (char.reference_image_path
              ? { public_path: char.reference_image_path, source: 'legacy_path' }
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
    };
  });

  return new Response(JSON.stringify({
    success: true,
    tenant_id: user?.tenantId || profile.tenant_id || null,
    data: {
      ...profile,
      characters: enrichedCharacters,
      locations,
      characterCount: enrichedCharacters.length,
      locationCount: (locations || []).length
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const profile = await getUniverseProfile(id);

  if (!profile) {
    return new Response(JSON.stringify({ success: false, error_code: 'OWNER_NOT_FOUND', error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (body.slug && body.slug !== profile.slug) {
    const existing = await getUniverseProfileBySlug(body.slug);
    if (existing) {
      return new Response(JSON.stringify({ success: false, error_code: 'SLUG_EXISTS', error: 'Slug already exists.' }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  await updateUniverseProfile(id, body);

  try {
    const manifests = await import('../../../../../lib/universe-manifests.js');
    if (manifests.refreshManifestCache) {
      await manifests.refreshManifestCache({ tenantId: user?.tenantId || profile.tenant_id, universeId: id });
    }
  } catch (e) {
    // Ignore if module or function doesn't exist yet
  }

  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, message: 'Universe Profile updated' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

export const DELETE = withTenantContext(async (req, { params }, user) => {
  const denied = checkUniverseManagerAccess(user, 'content:create');
  if (denied) return denied;

  const { id } = await params;
  const profile = await getUniverseProfile(id);

  if (!profile) {
    return new Response(JSON.stringify({ success: false, error_code: 'OWNER_NOT_FOUND', error: 'Universe Profile not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  const episodes = await getUniverseEpisodes(id);
  if (episodes && episodes.length > 0) {
    await archiveUniverseProfile(id);
  } else {
    await dbRun('DELETE FROM universe_profiles WHERE id = ?', [id]);
  }

  try {
    const manifests = await import('../../../../../lib/universe-manifests.js');
    if (manifests.refreshManifestCache) {
      await manifests.refreshManifestCache({ tenantId: user?.tenantId || profile.tenant_id, universeId: id });
    }
  } catch {}

  return new Response(JSON.stringify({ success: true, tenant_id: user?.tenantId || null, message: 'Universe Profile deleted/archived' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});
