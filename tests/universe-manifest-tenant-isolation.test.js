import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';

const { tenantContext } = await import('../lib/tenant-context.js');
const {
  getUniverseManifest,
  getUniverseManifestAsync,
  normalizeCharacterId,
  refreshManifestCache,
  getAvailableUniverseSlugs,
  __setUniverseManifestDbAdapterForTest
} = await import('../lib/universe-manifests.js');
const { resolveClipReferenceImagesAsync } = await import('../lib/cartoon-reference-resolver.js');

function createTempPng(dir, filename, extraByte) {
  const pngBuf = Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    Buffer.alloc(120, extraByte)
  ]);
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, pngBuf);
  return { fullPath, expectedBase64: `data:image/png;base64,${pngBuf.toString('base64')}` };
}

function createMockDb(profiles, characters, locations = []) {
  const calls = {
    queryAllActiveProfiles: 0,
    queryProfileById: [],
    queryProfileBySlug: [],
    queryCharacters: []
  };

  const adapter = {
    async queryAllActiveProfiles() {
      calls.queryAllActiveProfiles += 1;
      return profiles.filter(p => (p.status || 'active') === 'active');
    },
    async queryProfileById(universeId, tenantId) {
      calls.queryProfileById.push({ universeId, tenantId });
      return profiles.find(p => p.id === universeId && (!tenantId || p.tenant_id === tenantId)) || null;
    },
    async queryProfileBySlug(slug, tenantId) {
      calls.queryProfileBySlug.push({ slug, tenantId });
      if (!tenantId) return null;
      return profiles.find(p => p.slug.toLowerCase() === slug.toLowerCase() && p.tenant_id === tenantId) || null;
    },
    async queryCharacters(universeId, tenantId) {
      calls.queryCharacters.push({ universeId, tenantId });
      return characters.filter(c => c.universe_id === universeId && c.tenant_id === tenantId);
    },
    async queryLocations(universeId, tenantId) {
      return locations.filter(l => l.universe_id === universeId && l.tenant_id === tenantId);
    },
    async queryApprovedAssets() {
      return [];
    }
  };

  return { adapter, calls };
}

test('B2: two tenants with identical universe slug stay strictly isolated in cache, async lookup, and characterNameMap', async (t) => {
  const profiles = [
    { id: 'univ_alpha', tenant_id: 'tnt_alpha', slug: 'ruang-akustik', name: 'Ruang Akustik Alpha', status: 'active' },
    { id: 'univ_beta', tenant_id: 'tnt_beta', slug: 'ruang-akustik', name: 'Ruang Akustik Beta', status: 'active' }
  ];
  const characters = [
    {
      id: 'char_alpha',
      tenant_id: 'tnt_alpha',
      universe_id: 'univ_alpha',
      character_key: 'arka_alpha',
      name: 'Arka Alpha',
      canonical_prompt: 'Alpha acoustic consultant',
      reference_image_path: '/uploads/alpha/arka.png'
    },
    {
      id: 'char_beta',
      tenant_id: 'tnt_beta',
      universe_id: 'univ_beta',
      character_key: 'maya_beta',
      name: 'Maya Beta',
      canonical_prompt: 'Beta acoustic consultant',
      reference_image_path: '/uploads/beta/maya.png'
    }
  ];

  const { adapter, calls } = createMockDb(profiles, characters);
  __setUniverseManifestDbAdapterForTest(adapter);
  t.after(() => __setUniverseManifestDbAdapterForTest(null));

  // Warm cache
  await refreshManifestCache();
  assert.equal(calls.queryAllActiveProfiles, 1);

  // Sync cache lookup isolated by explicit tenantId
  const mAlpha = getUniverseManifest('ruang-akustik', { tenantId: 'tnt_alpha' });
  const mBeta = getUniverseManifest('ruang-akustik', { tenantId: 'tnt_beta' });
  assert.ok(mAlpha?.characters?.arka_alpha);
  assert.equal(mAlpha?.characters?.maya_beta, undefined);
  assert.ok(mBeta?.characters?.maya_beta);
  assert.equal(mBeta?.characters?.arka_alpha, undefined);

  // Sync cache lookup isolated by AsyncLocalStorage tenantContext
  const mAlphaCtx = tenantContext.run('tnt_alpha', () => getUniverseManifest('ruang-akustik'));
  const mBetaCtx = tenantContext.run('tnt_beta', () => getUniverseManifest('ruang-akustik'));
  assert.equal(mAlphaCtx?.characters?.arka_alpha?.display_name, 'Arka Alpha');
  assert.equal(mBetaCtx?.characters?.maya_beta?.display_name, 'Maya Beta');

  // Available slugs isolated per tenant
  assert.deepEqual(getAvailableUniverseSlugs('tnt_alpha'), ['ruang-akustik']);
  assert.deepEqual(getAvailableUniverseSlugs('tnt_gamma'), []);

  // Character name map isolated per tenant
  assert.equal(normalizeCharacterId('Arka Alpha', { tenantId: 'tnt_alpha' }), 'arka_alpha');
  assert.equal(normalizeCharacterId('Arka Alpha', { tenantId: 'tnt_beta' }), null);
  assert.equal(normalizeCharacterId('Maya Beta', { tenantId: 'tnt_beta' }), 'maya_beta');
  assert.equal(normalizeCharacterId('Maya Beta', { tenantId: 'tnt_alpha' }), null);
  // Static PawVille character names preserved
  assert.equal(normalizeCharacterId('Mochi', { tenantId: 'tnt_beta' }), 'mochi');

  // Static PawVille fallback preserved for any tenant
  const pawville = getUniverseManifest('pawville', { tenantId: 'tnt_gamma' });
  assert.equal(pawville?.universe_profile, 'pawville');
  assert.ok(pawville?.characters?.mochi);

  // Async slug lookup passes explicit tenantId and never leaks across tenants
  const asyncBeta = await getUniverseManifestAsync('ruang-akustik', { forceRefresh: true, tenantId: 'tnt_beta' });
  assert.ok(asyncBeta?.characters?.maya_beta);
  assert.equal(asyncBeta?.characters?.arka_alpha, undefined);
  assert.deepEqual(calls.queryProfileBySlug[calls.queryProfileBySlug.length - 1], {
    slug: 'ruang-akustik',
    tenantId: 'tnt_beta'
  });

  // Inside __none__ without explicit tenantId, slug lookup must NOT return any tenant's universe
  const noneResult = await tenantContext.run('__none__', () =>
    getUniverseManifestAsync('ruang-akustik', { forceRefresh: true })
  );
  assert.equal(noneResult, null);
});

test('B2: getUniverseManifestAsync prioritizes universeId before slug and blocks cross-tenant ID access', async (t) => {
  const profiles = [
    { id: 'univ_alpha', tenant_id: 'tnt_alpha', slug: 'shared-slug', name: 'Alpha', status: 'active' },
    { id: 'univ_beta', tenant_id: 'tnt_beta', slug: 'shared-slug', name: 'Beta', status: 'active' }
  ];
  const characters = [
    {
      id: 'char_alpha',
      tenant_id: 'tnt_alpha',
      universe_id: 'univ_alpha',
      character_key: 'arka_alpha',
      name: 'Arka Alpha',
      canonical_prompt: 'Alpha'
    }
  ];

  const { adapter, calls } = createMockDb(profiles, characters);
  __setUniverseManifestDbAdapterForTest(adapter);
  t.after(() => __setUniverseManifestDbAdapterForTest(null));

  // Lookup by ID first when both slug and universeId are given
  const mById = await getUniverseManifestAsync('shared-slug', {
    forceRefresh: true,
    universeId: 'univ_alpha',
    tenantId: 'tnt_alpha'
  });
  assert.ok(mById?.characters?.arka_alpha);
  assert.equal(calls.queryProfileById.length, 1);
  assert.deepEqual(calls.queryProfileById[0], { universeId: 'univ_alpha', tenantId: 'tnt_alpha' });
  assert.equal(calls.queryProfileBySlug.length, 0, 'Should NOT fall back to slug when ID lookup succeeds');

  // Cross-tenant ID attempt without slug returns null
  const crossTenant = await getUniverseManifestAsync(null, {
    forceRefresh: true,
    universeId: 'univ_alpha',
    tenantId: 'tnt_beta'
  });
  assert.equal(crossTenant, null);
});

test('B2: selective refreshManifestCache({ tenantId, universeId }) only evicts matching tenant/universe', async (t) => {
  const profiles = [
    { id: 'univ_alpha', tenant_id: 'tnt_alpha', slug: 'ruang-akustik', name: 'Alpha', status: 'active' },
    { id: 'univ_beta', tenant_id: 'tnt_beta', slug: 'ruang-akustik', name: 'Beta', status: 'active' }
  ];
  const characters = [
    { id: 'c1', tenant_id: 'tnt_alpha', universe_id: 'univ_alpha', character_key: 'arka_v1', name: 'Arka V1', canonical_prompt: 'V1' },
    { id: 'c2', tenant_id: 'tnt_beta', universe_id: 'univ_beta', character_key: 'maya_v1', name: 'Maya V1', canonical_prompt: 'Beta' }
  ];

  const { adapter, calls } = createMockDb(profiles, characters);
  __setUniverseManifestDbAdapterForTest(adapter);
  t.after(() => __setUniverseManifestDbAdapterForTest(null));

  await refreshManifestCache();
  assert.ok(getUniverseManifest('ruang-akustik', { tenantId: 'tnt_alpha' })?.characters?.arka_v1);
  assert.ok(getUniverseManifest('ruang-akustik', { tenantId: 'tnt_beta' })?.characters?.maya_v1);

  // Add a new character to Alpha in mock DB, then evict ONLY Alpha
  characters.push({ id: 'c3', tenant_id: 'tnt_alpha', universe_id: 'univ_alpha', character_key: 'arka_v2', name: 'Arka V2', canonical_prompt: 'V2' });
  await refreshManifestCache({ tenantId: 'tnt_alpha', universeId: 'univ_alpha' });

  // Alpha was evicted from sync cache; Beta remains cached
  assert.equal(getUniverseManifest('ruang-akustik', { tenantId: 'tnt_alpha' }), null);
  assert.ok(getUniverseManifest('ruang-akustik', { tenantId: 'tnt_beta' })?.characters?.maya_v1);
  assert.equal(calls.queryAllActiveProfiles, 1, 'Selective eviction must not trigger full reload');

  // Next async lookup for Alpha fetches fresh DB state containing arka_v2
  const refreshedAlpha = await getUniverseManifestAsync('ruang-akustik', { tenantId: 'tnt_alpha', universeId: 'univ_alpha' });
  assert.ok(refreshedAlpha?.characters?.arka_v2);
  assert.equal(normalizeCharacterId('Arka V2', { tenantId: 'tnt_alpha' }), 'arka_v2');

  // Legacy string argument is safely accepted and triggers full reload without throwing
  await refreshManifestCache('univ_alpha');
  assert.equal(calls.queryAllActiveProfiles, 2);
});

test('B2: resolveClipReferenceImagesAsync forwards tenantId and preserves universeSnapshot priority', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-b2-resolver-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const alphaImg = createTempPng(tmpDir, 'alpha.png', 0x11);
  const betaImg = createTempPng(tmpDir, 'beta.png', 0x22);
  const snapImg = createTempPng(tmpDir, 'snap.png', 0x33);

  const profiles = [
    { id: 'univ_alpha', tenant_id: 'tnt_alpha', slug: 'ruang-akustik', name: 'Alpha', status: 'active' },
    { id: 'univ_beta', tenant_id: 'tnt_beta', slug: 'ruang-akustik', name: 'Beta', status: 'active' }
  ];
  const characters = [
    {
      id: 'c_alpha',
      tenant_id: 'tnt_alpha',
      universe_id: 'univ_alpha',
      character_key: 'host_utama',
      name: 'Host Alpha',
      canonical_prompt: 'Alpha host',
      reference_image_path: alphaImg.fullPath
    },
    {
      id: 'c_beta',
      tenant_id: 'tnt_beta',
      universe_id: 'univ_beta',
      character_key: 'host_utama',
      name: 'Host Beta',
      canonical_prompt: 'Beta host',
      reference_image_path: betaImg.fullPath
    }
  ];

  const { adapter, calls } = createMockDb(profiles, characters);
  __setUniverseManifestDbAdapterForTest(adapter);
  t.after(() => __setUniverseManifestDbAdapterForTest(null));

  const resAlpha = await resolveClipReferenceImagesAsync({
    contentWorld: 'cartoon_universe',
    universeProfile: 'ruang-akustik',
    tenantId: 'tnt_alpha',
    clip: 1,
    clipCharacters: ['host_utama']
  });
  assert.equal(resAlpha.characterReferences.length, 1);
  assert.equal(resAlpha.characterReferences[0], alphaImg.expectedBase64);

  const resBeta = await resolveClipReferenceImagesAsync({
    contentWorld: 'cartoon_universe',
    universeProfile: 'ruang-akustik',
    tenantId: 'tnt_beta',
    clip: 1,
    clipCharacters: ['host_utama']
  });
  assert.equal(resBeta.characterReferences.length, 1);
  assert.equal(resBeta.characterReferences[0], betaImg.expectedBase64);
  assert.notEqual(resAlpha.characterReferences[0], resBeta.characterReferences[0]);

  // Snapshot priority: must use universeSnapshot without extra DB queries
  const prevSlugCalls = calls.queryProfileBySlug.length;
  const resSnap = await resolveClipReferenceImagesAsync({
    contentWorld: 'cartoon_universe',
    universeProfile: 'ruang-akustik',
    tenantId: 'tnt_alpha',
    universeSnapshot: {
      manifest: {
        universe_profile: 'ruang-akustik',
        characters: {
          host_utama: {
            display_name: 'Host Snapshot',
            identity_reference_path: snapImg.fullPath
          }
        }
      }
    },
    clip: 1,
    clipCharacters: ['host_utama']
  });
  assert.equal(resSnap.characterReferences[0], snapImg.expectedBase64);
  assert.equal(calls.queryProfileBySlug.length, prevSlugCalls, 'Snapshot must take priority over DB lookup');
});
