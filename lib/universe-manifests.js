/**
 * Universe Manifests - Hybrid loader with DB-backed cache and static fallback.
 * Tahap 3: Reads universe profiles, characters, and locations from PostgreSQL.
 * Falls back to static PawVille manifest if DB is not ready.
 *
 * All 7 consumers (cartoon-reference-resolver, pillar-campaign-ingest,
 * scheduler-processors, manifest API, regenerate routes, test script)
 * retain the same function signatures.
 */

import { getActiveTenantId, tenantContext } from './tenant-context.js';

// ═══════════════════════════════════════════════════════════
// Static Fallback Data (preserved for boot-time compatibility)
// ═══════════════════════════════════════════════════════════

const STATIC_CHARACTER_NAME_MAP = {
  'mochi': 'mochi',
  'dr. paw': 'dr_paw',
  'dr paw': 'dr_paw',
  'coco': 'coco',
  'boba': 'boba',
  'tofu': 'tofu'
};

const PAWVILLE_STATIC_FALLBACK = {
  universe_profile: "pawville",
  version: 1,
  style_reference_path: "/universe-assets/pawville/style/visual-style-reference.png",
  characters: {
    mochi: {
      character_id: "pawville_mochi_v1",
      display_name: "Mochi",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/mochi/v1/identity-anchor.png",
      canonical_description: "Grey British Shorthair cat, round compact body, short legs, thick soft grey fur, large amber eyes, small pink nose, forest-green scarf",
      forbidden_changes: [
        "no fur color change",
        "no fur pattern",
        "no eye color change",
        "no missing green scarf",
        "no body proportion change"
      ]
    },
    dr_paw: {
      character_id: "pawville_dr_paw_v1",
      display_name: "Dr. Paw",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/dr-paw/v1/identity-anchor.png",
      canonical_description: "Tan Shiba Inu, compact body, wearing a small white coat and carrying a small brown medical bag",
      forbidden_changes: [
        "no species change",
        "no fur color change",
        "no missing white coat",
        "no medical bag redesign",
        "no body proportion change"
      ]
    },
    coco: {
      character_id: "pawville_coco_v1",
      display_name: "Coco",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/coco/v1/identity-anchor.png",
      canonical_description: "Brown-and-white Corgi dog, small compact body, tiny brown sling bag, happy smile",
      forbidden_changes: [
        "no species change",
        "no fur color change",
        "no missing sling bag",
        "no body proportion change"
      ]
    }
  }
};

// ═══════════════════════════════════════════════════════════
// In-Memory Cache (Tenant-Isolated)
// ═══════════════════════════════════════════════════════════

let _manifestCache = null;         // { '<tenantId>:<slug>': manifest }
let _manifestById = new Map();     // Map<universeId, { tenantId, slug, cacheKey, manifest }>
let _characterNameMap = new Map(); // Map<tenantId, { '<name>': '<character_key>' }>
let _cacheReady = false;
let _cacheLoadPromise = null;
let _testDbAdapter = null;

function normalizeTenantId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '__none__') return null;
  return trimmed;
}

function makeCacheKey(tenantId, slug) {
  const cleanTenant = normalizeTenantId(tenantId) || 'default_tenant';
  const cleanSlug = String(slug || '').trim().toLowerCase();
  return `${cleanTenant}:${cleanSlug}`;
}

function resolveSyncTenantId(explicitTenantId = null) {
  const explicit = normalizeTenantId(explicitTenantId);
  if (explicit) return explicit;
  const store = tenantContext.getStore();
  if (store === '__none__') return null;
  return normalizeTenantId(store) || 'default_tenant';
}

function getDefaultDbAdapter() {
  return {
    async queryAllActiveProfiles() {
      const { pgQuery } = await import('./db-pg.js');
      const res = await pgQuery("SELECT * FROM universe_profiles WHERE status = 'active' ORDER BY name ASC", []);
      return res.rows || [];
    },
    async queryProfileById(universeId, tenantId) {
      const { pgQuery } = await import('./db-pg.js');
      if (tenantId) {
        const res = await pgQuery(
          'SELECT * FROM universe_profiles WHERE id = $1 AND tenant_id = $2 LIMIT 1',
          [universeId, tenantId]
        );
        return res.rows[0] || null;
      }
      const res = await pgQuery(
        'SELECT * FROM universe_profiles WHERE id = $1 LIMIT 1',
        [universeId]
      );
      return res.rows[0] || null;
    },
    async queryProfileBySlug(slug, tenantId) {
      if (!tenantId) return null;
      const { pgQuery } = await import('./db-pg.js');
      const res = await pgQuery(
        'SELECT * FROM universe_profiles WHERE slug = $1 AND tenant_id = $2 LIMIT 1',
        [slug, tenantId]
      );
      return res.rows[0] || null;
    },
    async queryCharacters(universeId, tenantId) {
      const { pgQuery } = await import('./db-pg.js');
      const res = await pgQuery(
        'SELECT * FROM universe_characters WHERE universe_id = $1 AND tenant_id = $2 ORDER BY name ASC',
        [universeId, tenantId]
      );
      return res.rows || [];
    },
    async queryLocations(universeId, tenantId) {
      const { pgQuery } = await import('./db-pg.js');
      const res = await pgQuery(
        'SELECT * FROM universe_locations WHERE universe_id = $1 AND tenant_id = $2 ORDER BY name ASC',
        [universeId, tenantId]
      );
      return res.rows || [];
    },
    async queryApprovedAssets(universeId, tenantId) {
      const { getApprovedReferenceAssetsForUniverse } = await import('./reference-asset-repository.js');
      return await getApprovedReferenceAssetsForUniverse(universeId, tenantId);
    }
  };
}

function getDbAdapter() {
  return _testDbAdapter || getDefaultDbAdapter();
}

export function __setUniverseManifestDbAdapterForTest(adapter) {
  _testDbAdapter = adapter || null;
  _manifestCache = null;
  _manifestById = new Map();
  _characterNameMap = new Map();
  _cacheReady = false;
  _cacheLoadPromise = null;
}

/**
 * Build manifest shape from DB rows (same shape as PAWVILLE_STATIC_FALLBACK)
 */
function buildManifestFromDb(profile, characters, locations, approvedAssets = []) {
  const approvedStyle = approvedAssets.find(
    a => a.owner_type === 'universe' && a.owner_id === profile.id && a.asset_role === 'visual_style'
  );

  const manifest = {
    universe_profile: profile.slug,
    version: profile.version || 1,
    style_reference_path: approvedStyle ? approvedStyle.public_path : (profile.style_reference_path || null),
    universe_type: profile.universe_type || 'animal',
    depiction_policy: profile.depiction_policy || null,
    historical_period: profile.historical_period || null,
    human_presence: profile.human_presence || 'none',
    characters: {},
    locations: []
  };

  if (approvedStyle) {
    manifest.style_reference = {
      asset_id: approvedStyle.id,
      version: approvedStyle.version,
      public_path: approvedStyle.public_path,
      sha256: approvedStyle.sha256
    };
  }

  for (const char of characters) {
    const charIdentityAsset = approvedAssets.find(
      a => a.owner_type === 'character' && a.owner_id === char.id && a.asset_role === 'identity'
    );
    const charSheetAsset = approvedAssets.find(
      a => a.owner_type === 'character' && a.owner_id === char.id && a.asset_role === 'character_sheet'
    );
    const charAsset = charIdentityAsset || charSheetAsset || null;
    const fabricatedPath = `/universe-assets/${profile.slug}/characters/${char.character_key}/v${char.version || 1}/identity-anchor.png`;
    const identityAsset = charIdentityAsset
      ? {
          asset_id: charIdentityAsset.id,
          version: charIdentityAsset.version,
          sha256: charIdentityAsset.sha256,
          public_path: charIdentityAsset.public_path,
          source: 'approved_asset'
        }
      : (char.reference_image_path
          ? {
              public_path: char.reference_image_path,
              source: 'legacy_path'
            }
          : {
              public_path: fabricatedPath,
              source: 'fabricated_path'
            });

    manifest.characters[char.character_key] = {
      character_id: `${profile.slug}_${char.character_key}_v${char.version || 1}`,
      display_name: char.name,
      version: char.version || 1,
      identity_reference_path: charAsset ? charAsset.public_path : (char.reference_image_path || fabricatedPath),
      identity_asset: identityAsset,
      character_sheet_reference_path: charSheetAsset ? charSheetAsset.public_path : null,
      canonical_description: char.canonical_prompt,
      forbidden_changes: (() => {
        try {
          const json = typeof char.forbidden_changes_json === 'string'
            ? JSON.parse(char.forbidden_changes_json) : char.forbidden_changes_json;
          return Array.isArray(json) ? json : [];
        } catch { return []; }
      })(),
      species: char.species,
      breed: char.breed,
      role: char.role,
      relative_size: char.relative_size,
      depiction_mode: char.depiction_mode || 'normal',
      reference_type: char.reference_type || 'identity',
      historical_period: char.historical_period || null
    };

    if (charAsset) {
      manifest.characters[char.character_key].identity_reference = {
        asset_id: charAsset.id,
        version: charAsset.version,
        public_path: charAsset.public_path,
        sha256: charAsset.sha256
      };
    }
  }

  for (const loc of locations) {
    const locAsset = approvedAssets.find(
      a => a.owner_type === 'location' && a.owner_id === loc.id && a.asset_role === 'location'
    );

    const entry = {
      location_key: loc.location_key,
      name: loc.name,
      visual_description: loc.visual_description,
      lighting_default: loc.lighting_default,
      props: loc.props,
      reference_image_path: locAsset ? locAsset.public_path : loc.reference_image_path,
      historical_period: loc.historical_period || null,
      reference_type: loc.reference_type || 'location'
    };

    if (locAsset) {
      entry.location_reference = {
        asset_id: locAsset.id,
        version: locAsset.version,
        public_path: locAsset.public_path,
        sha256: locAsset.sha256
      };
    }

    manifest.locations.push(entry);
  }

  return manifest;
}

/**
 * Build character name map for a single tenant from its characters
 */
function buildCharacterNameMap(tenantCharacters) {
  const map = { ...STATIC_CHARACTER_NAME_MAP };

  for (const char of tenantCharacters) {
    const key = char.character_key;
    if (!key) continue;
    if (char.name) {
      map[char.name.toLowerCase()] = key;
    }
    map[key] = key;
    if (key.includes('_')) {
      map[key.replace(/_/g, ' ')] = key;
      map[key.replace(/_/g, '. ')] = key;
    }
  }

  return map;
}

/**
 * Rebuild character name map for one tenant from all cached manifests of that tenant
 */
function rebuildTenantCharacterNameMap(tenantId) {
  const cleanTenant = normalizeTenantId(tenantId);
  if (!cleanTenant) return;

  const chars = [];
  for (const entry of _manifestById.values()) {
    if (entry.tenantId !== cleanTenant) continue;
    for (const [key, charObj] of Object.entries(entry.manifest?.characters || {})) {
      chars.push({ character_key: key, name: charObj?.display_name || key });
    }
  }

  if (chars.length > 0) {
    _characterNameMap.set(cleanTenant, buildCharacterNameMap(chars));
  } else {
    _characterNameMap.delete(cleanTenant);
  }
}

function storeManifestInCache(profile, manifest) {
  const pTenantId = normalizeTenantId(profile.tenant_id) || 'default_tenant';
  const pSlug = String(profile.slug || manifest?.universe_profile || '').trim().toLowerCase();
  const cacheKey = makeCacheKey(pTenantId, pSlug);

  if (!_manifestCache) _manifestCache = {};
  // Clean up stale slug key if this universeId changed slug
  const prev = _manifestById.get(profile.id);
  if (prev && prev.cacheKey !== cacheKey) {
    delete _manifestCache[prev.cacheKey];
  }

  _manifestCache[cacheKey] = manifest;
  _manifestById.set(profile.id, {
    tenantId: pTenantId,
    slug: pSlug,
    cacheKey,
    manifest
  });
  rebuildTenantCharacterNameMap(pTenantId);
}

/**
 * Load all universe manifests from database into tenant-isolated cache.
 */
async function loadManifestsFromDb() {
  try {
    const dbAdapter = getDbAdapter();
    const profiles = await dbAdapter.queryAllActiveProfiles();
    if (!profiles || profiles.length === 0) {
      console.log('[UniverseManifests] No DB profiles found, using static fallback.');
      return false;
    }

    const manifests = {};
    const byId = new Map();
    const charsByTenant = new Map();

    for (const profile of profiles) {
      const pTenantId = normalizeTenantId(profile.tenant_id) || 'default_tenant';
      const pSlug = String(profile.slug || '').trim().toLowerCase();
      const cacheKey = makeCacheKey(pTenantId, pSlug);

      const characters = await dbAdapter.queryCharacters(profile.id, pTenantId);
      const locations = await dbAdapter.queryLocations(profile.id, pTenantId);
      const approvedAssets = await dbAdapter.queryApprovedAssets(profile.id, pTenantId);

      const manifest = buildManifestFromDb(profile, characters || [], locations || [], approvedAssets || []);
      manifests[cacheKey] = manifest;
      byId.set(profile.id, {
        tenantId: pTenantId,
        slug: pSlug,
        cacheKey,
        manifest
      });

      if (!charsByTenant.has(pTenantId)) {
        charsByTenant.set(pTenantId, []);
      }
      charsByTenant.get(pTenantId).push(...(characters || []));
    }

    const nameMaps = new Map();
    for (const [tId, chars] of charsByTenant.entries()) {
      nameMaps.set(tId, buildCharacterNameMap(chars));
    }

    _manifestCache = manifests;
    _manifestById = byId;
    _characterNameMap = nameMaps;
    _cacheReady = true;

    console.log(`[UniverseManifests] Loaded ${Object.keys(manifests).length} universe(s) from DB: ${Object.keys(manifests).join(', ')}`);
    return true;
  } catch (err) {
    console.warn('[UniverseManifests] DB load failed, using static fallback:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Public API (tenant-isolated, backward-compatible signatures)
// ═══════════════════════════════════════════════════════════

/**
 * Exported for backward compatibility — consumers that import CHARACTER_NAME_MAP directly.
 * Delegates to the active tenant's map when available.
 */
export const CHARACTER_NAME_MAP = new Proxy(STATIC_CHARACTER_NAME_MAP, {
  get(target, prop) {
    const activeTenant = resolveSyncTenantId();
    const tenantMap = activeTenant ? _characterNameMap.get(activeTenant) : null;
    if (tenantMap && prop in tenantMap) {
      return tenantMap[prop];
    }
    return target[prop];
  },
  has(target, prop) {
    const activeTenant = resolveSyncTenantId();
    const tenantMap = activeTenant ? _characterNameMap.get(activeTenant) : null;
    if (tenantMap && prop in tenantMap) return true;
    return prop in target;
  }
});

/**
 * Exported for backward compatibility — the static manifests object.
 * Proxy delegates to the active tenant's cached manifests when available.
 */
export const UNIVERSE_MANIFESTS = new Proxy({ pawville: PAWVILLE_STATIC_FALLBACK }, {
  get(target, prop) {
    if (typeof prop === 'string' && _manifestCache) {
      const activeTenant = resolveSyncTenantId();
      if (activeTenant) {
        const key = makeCacheKey(activeTenant, prop);
        if (key in _manifestCache) return _manifestCache[key];
      }
    }
    return target[prop];
  },
  has(target, prop) {
    if (typeof prop === 'string' && _manifestCache) {
      const activeTenant = resolveSyncTenantId();
      if (activeTenant) {
        const key = makeCacheKey(activeTenant, prop);
        if (key in _manifestCache) return true;
      }
    }
    return prop in target;
  },
  ownKeys() {
    if (_manifestCache) {
      const slugs = getAvailableUniverseSlugs();
      if (slugs.length > 0) return slugs;
    }
    return ['pawville'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'string' && _manifestCache) {
      const activeTenant = resolveSyncTenantId();
      if (activeTenant) {
        const key = makeCacheKey(activeTenant, prop);
        if (key in _manifestCache) {
          return { value: _manifestCache[key], writable: true, enumerable: true, configurable: true };
        }
      }
    }
    if (prop in target) {
      return Object.getOwnPropertyDescriptor(target, prop);
    }
    return undefined;
  }
});

/**
 * Normalizes character names to standard keys (mochi, dr_paw, coco, boba, tofu, ...)
 * Scoped to the active or explicitly provided tenant.
 * @param {string} rawName - Raw character name from storyboard or AI output
 * @param {{ tenantId?: string|null }} [options]
 * @returns {string|null} - Normalized character key or null if not in map
 */
export function normalizeCharacterId(rawName, { tenantId = null } = {}) {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase();
  const effectiveTenant = resolveSyncTenantId(tenantId);
  const tenantMap = effectiveTenant ? _characterNameMap.get(effectiveTenant) : null;
  if (tenantMap && clean in tenantMap) {
    return tenantMap[clean];
  }
  return STATIC_CHARACTER_NAME_MAP[clean] || null;
}

/**
 * Retrieves the manifest for a specific universe profile (tenant-isolated)
 * @param {string} universeProfile - Profile key / slug (e.g., 'pawville')
 * @param {{ tenantId?: string|null }} [options]
 * @returns {Object|null} - Manifest object or null
 */
export function getUniverseManifest(universeProfile, { tenantId = null } = {}) {
  if (!universeProfile) return null;
  const cleanProfile = universeProfile.trim().toLowerCase();
  const effectiveTenant = resolveSyncTenantId(tenantId);

  // Try tenant-scoped DB cache first
  if (_manifestCache && effectiveTenant) {
    const cacheKey = makeCacheKey(effectiveTenant, cleanProfile);
    if (cacheKey in _manifestCache) {
      return _manifestCache[cacheKey];
    }
  }

  // Fallback to static
  if (cleanProfile === 'pawville') {
    return PAWVILLE_STATIC_FALLBACK;
  }

  return null;
}

/**
 * Async version that ensures manifests are loaded and falls back to tenant-isolated dynamic DB lookup.
 * Prioritizes lookup by universeId first, then slug scoped strictly to tenantId.
 * @param {string} universeProfile - Profile key / slug (e.g., 'kio-wonders')
 * @param {{ forceRefresh?: boolean, universeId?: string|null, tenantId?: string|null }} [options]
 * @returns {Promise<Object|null>} - Manifest object or null
 */
export async function getUniverseManifestAsync(
  universeProfile,
  { forceRefresh = false, universeId = null, tenantId = null } = {}
) {
  if (!universeProfile && !universeId) return null;
  const cleanProfile = universeProfile ? String(universeProfile).trim().toLowerCase() : '';
  const explicitTenant = normalizeTenantId(tenantId);
  const rawStore = tenantContext.getStore();
  const storeTenant = normalizeTenantId(rawStore);
  const effectiveTenantForId = explicitTenant || storeTenant || null;
  const effectiveTenantForSlug = explicitTenant || (rawStore === '__none__' ? null : (storeTenant || 'default_tenant'));

  if (!forceRefresh) {
    await ensureManifestsLoaded();
    if (universeId && _manifestById.has(universeId)) {
      const entry = _manifestById.get(universeId);
      if (!effectiveTenantForId || entry.tenantId === effectiveTenantForId) {
        return entry.manifest;
      }
    }
    if (cleanProfile && effectiveTenantForSlug && _manifestCache) {
      const cacheKey = makeCacheKey(effectiveTenantForSlug, cleanProfile);
      if (cacheKey in _manifestCache) {
        return _manifestCache[cacheKey];
      }
    }
  }

  try {
    const dbAdapter = getDbAdapter();

    let profile = null;
    if (universeId) {
      profile = await dbAdapter.queryProfileById(universeId, effectiveTenantForId);
    }
    if (!profile && cleanProfile && effectiveTenantForSlug) {
      profile = await dbAdapter.queryProfileBySlug(cleanProfile, effectiveTenantForSlug);
    }

    if (profile) {
      const pTenantId = normalizeTenantId(profile.tenant_id) || 'default_tenant';
      const characters = await dbAdapter.queryCharacters(profile.id, pTenantId);
      const locations = await dbAdapter.queryLocations(profile.id, pTenantId);
      const approvedAssets = await dbAdapter.queryApprovedAssets(profile.id, pTenantId);

      const manifest = buildManifestFromDb(profile, characters || [], locations || [], approvedAssets || []);
      storeManifestInCache(profile, manifest);
      return manifest;
    }
  } catch (err) {
    console.warn('[UniverseManifests] Dynamic fallback lookup error:', err.message);
  }

  if (cleanProfile === 'pawville') {
    return PAWVILLE_STATIC_FALLBACK;
  }

  return null;
}

/**
 * Refresh or selectively invalidate the manifest cache.
 * - refreshManifestCache({ tenantId, universeId }): evicts only matching cache entries.
 * - refreshManifestCache() or legacy non-object argument: reloads all manifests from DB.
 */
export async function refreshManifestCache(options = undefined) {
  if (options && typeof options === 'object' && !Array.isArray(options) && (options.tenantId || options.universeId)) {
    const targetTenant = normalizeTenantId(options.tenantId);
    const targetUniverseId = options.universeId ? String(options.universeId).trim() : null;
    const affectedTenants = new Set();

    if (targetUniverseId) {
      const existing = _manifestById.get(targetUniverseId);
      if (existing && (!targetTenant || existing.tenantId === targetTenant)) {
        if (_manifestCache) delete _manifestCache[existing.cacheKey];
        _manifestById.delete(targetUniverseId);
        affectedTenants.add(existing.tenantId);
      } else if (targetTenant) {
        affectedTenants.add(targetTenant);
      }
    } else if (targetTenant) {
      if (_manifestCache) {
        const prefix = `${targetTenant}:`;
        for (const key of Object.keys(_manifestCache)) {
          if (key.startsWith(prefix)) {
            delete _manifestCache[key];
          }
        }
      }
      for (const [id, entry] of _manifestById.entries()) {
        if (entry.tenantId === targetTenant) {
          _manifestById.delete(id);
        }
      }
      affectedTenants.add(targetTenant);
    }

    for (const tId of affectedTenants) {
      rebuildTenantCharacterNameMap(tId);
    }
    return;
  }

  _cacheLoadPromise = loadManifestsFromDb();
  await _cacheLoadPromise;
}

/**
 * Ensure manifests are loaded. Non-blocking — returns immediately if already loaded.
 * First call triggers DB load; subsequent calls return the same promise.
 */
export async function ensureManifestsLoaded() {
  if (_cacheReady) return;
  if (!_cacheLoadPromise) {
    _cacheLoadPromise = loadManifestsFromDb();
  }
  await _cacheLoadPromise;
}

/**
 * Get all available universe slugs for the active or specified tenant
 */
export function getAvailableUniverseSlugs(tenantId = null) {
  if (_manifestCache) {
    const effectiveTenant = resolveSyncTenantId(tenantId);
    if (!effectiveTenant) return [];
    const prefix = `${effectiveTenant}:`;
    return Object.keys(_manifestCache)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
  }
  return ['pawville'];
}

// Auto-load on first import (non-blocking)
if (process.env.DISABLE_STARTUP_DB_CACHES !== 'true') {
  const _bootTimer = setTimeout(() => {
    ensureManifestsLoaded().catch(() => {});
  }, 2000);
  if (typeof _bootTimer.unref === 'function') {
    _bootTimer.unref();
  }
}
