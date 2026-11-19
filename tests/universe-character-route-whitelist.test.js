import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';

const {
  CHARACTER_KEY_REGEX,
  ALLOWED_UNIVERSE_PROFILE_FIELDS,
  ALLOWED_UNIVERSE_CHARACTER_FIELDS,
  pickAllowedFields,
  validateCharacterKey,
  buildCreateUniverseProfilePayload,
  buildCreateUniverseCharacterPayload,
  isCharacterKeyConflictError
} = await import('../lib/universe-route-validation.js');
const { activeSessionsCache } = await import('../lib/auth.js');
const { POST: createCharacterPost } = await import('../app/api/v2/universe-profiles/[id]/characters/route.js');

test('B3: buildCreateUniverseProfilePayload puts server id last and strips non-whitelisted fields', () => {
  const maliciousBody = {
    id: 'attacker_forced_id',
    tenant_id: 'tnt_other_victim',
    created_at: '1999-01-01',
    is_system: true,
    name: 'Ruang Akustik ID',
    slug: 'ruang-akustik-id',
    premise: 'Edukasi akustik ruang',
    universe_type: 'character_driven'
  };

  const payload = buildCreateUniverseProfilePayload(maliciousBody, 'server_generated_univ_id');
  assert.equal(payload.id, 'server_generated_univ_id');
  assert.equal(payload.name, 'Ruang Akustik ID');
  assert.equal(payload.slug, 'ruang-akustik-id');
  assert.equal(payload.premise, 'Edukasi akustik ruang');
  assert.equal(payload.universe_type, 'character_driven');
  assert.equal('tenant_id' in payload, false);
  assert.equal('created_at' in payload, false);
  assert.equal('is_system' in payload, false);
  assert.equal(ALLOWED_UNIVERSE_PROFILE_FIELDS.includes('id'), false);
  assert.equal(ALLOWED_UNIVERSE_PROFILE_FIELDS.includes('tenant_id'), false);
});

test('B3: buildCreateUniverseCharacterPayload puts server id and universe_id last and strips non-whitelisted fields', () => {
  const maliciousBody = {
    id: 'attacker_char_id',
    universe_id: 'attacker_other_universe',
    tenant_id: 'tnt_other_victim',
    __proto_pollute: 'x',
    name: 'Arka',
    character_key: 'arka_acoustic_consultant',
    canonical_prompt: 'Indonesian man 30-35yo, navy blazer, light grey tee, charcoal headphones',
    role: 'protagonist',
    wardrobe: 'Plain navy blazer over light grey tee'
  };

  const payload = buildCreateUniverseCharacterPayload(maliciousBody, 'server_char_uuid', 'server_univ_uuid');
  assert.equal(payload.id, 'server_char_uuid');
  assert.equal(payload.universe_id, 'server_univ_uuid');
  assert.equal(payload.name, 'Arka');
  assert.equal(payload.character_key, 'arka_acoustic_consultant');
  assert.equal(payload.role, 'protagonist');
  assert.equal('tenant_id' in payload, false);
  assert.equal('__proto_pollute' in payload, false);
  assert.equal(ALLOWED_UNIVERSE_CHARACTER_FIELDS.includes('id'), false);
  assert.equal(ALLOWED_UNIVERSE_CHARACTER_FIELDS.includes('universe_id'), false);
  assert.equal(ALLOWED_UNIVERSE_CHARACTER_FIELDS.includes('tenant_id'), false);
});

test('B3: pickAllowedFields ignores undefined and non-object inputs safely', () => {
  assert.deepEqual(pickAllowedFields(null, ['name']), {});
  assert.deepEqual(pickAllowedFields({ name: 'Arka', species: undefined, extra: 1 }, ['name', 'species']), { name: 'Arka' });
});

test('B3: validateCharacterKey enforces /^[a-z0-9_]{2,64}$/', () => {
  assert.equal(CHARACTER_KEY_REGEX.source, '^[a-z0-9_]{2,64}$');
  assert.equal(validateCharacterKey('arka_acoustic_consultant'), true);
  assert.equal(validateCharacterKey('ab'), true);
  assert.equal(validateCharacterKey('char_01_v2'), true);
  assert.equal(validateCharacterKey('a'.repeat(64)), true);

  assert.equal(validateCharacterKey('a'), false);
  assert.equal(validateCharacterKey('a'.repeat(65)), false);
  assert.equal(validateCharacterKey('Arka'), false);
  assert.equal(validateCharacterKey('arka-consultant'), false);
  assert.equal(validateCharacterKey('arka consultant'), false);
  assert.equal(validateCharacterKey('../arka'), false);
  assert.equal(validateCharacterKey(''), false);
  assert.equal(validateCharacterKey(null), false);
  assert.equal(validateCharacterKey(12345), false);
});

test('B3: isCharacterKeyConflictError recognizes PostgreSQL 23505 and unique constraint errors', () => {
  assert.equal(isCharacterKeyConflictError({ code: '23505', message: 'duplicate key value violates unique constraint "idx_universe_chars_univ_key"' }), true);
  assert.equal(isCharacterKeyConflictError(new Error('duplicate key value violates unique constraint "idx_universe_chars_univ_key"')), true);
  assert.equal(isCharacterKeyConflictError(new Error('connection refused')), false);
  assert.equal(isCharacterKeyConflictError(null), false);
});

test('B3: POST /api/v2/universe-profiles/[id]/characters rejects invalid character_key with 400 INVALID_CHARACTER_KEY before DB access', async (t) => {
  const token = 'TEST_MOCK_OPERATOR_TOKEN';
  activeSessionsCache[token] = {
    id: 'test_user_b3',
    username: 'tester',
    role: 'admin',
    tenantId: 'tnt_test_b3'
  };
  t.after(() => {
    delete activeSessionsCache[token];
  });

  const req = new Request('http://localhost/api/v2/universe-profiles/univ_123/characters', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      id: 'evil_id',
      universe_id: 'evil_univ',
      name: 'Arka',
      character_key: 'Arka-Invalid Key!',
      canonical_prompt: 'Test prompt'
    })
  });

  const res = await createCharacterPost(req, { params: Promise.resolve({ id: 'univ_123' }) });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error_code, 'INVALID_CHARACTER_KEY');
});

test('B3: route files use whitelist payload builders, 409 CHARACTER_KEY_EXISTS, and cache invalidation', () => {
  const profilesRoute = fs.readFileSync(new URL('../app/api/v2/universe-profiles/route.js', import.meta.url), 'utf8');
  assert.match(profilesRoute, /buildCreateUniverseProfilePayload/);
  assert.doesNotMatch(profilesRoute, /createUniverseProfile\(\{\s*id,\s*\.\.\.body\s*\}\)/);

  const charsRoute = fs.readFileSync(new URL('../app/api/v2/universe-profiles/[id]/characters/route.js', import.meta.url), 'utf8');
  assert.match(charsRoute, /buildCreateUniverseCharacterPayload/);
  assert.match(charsRoute, /validateCharacterKey/);
  assert.match(charsRoute, /CHARACTER_KEY_EXISTS/);
  assert.match(charsRoute, /refreshManifestCache\(\{/);
  assert.doesNotMatch(charsRoute, /createUniverseCharacter\(\{\s*id:\s*charId,\s*universe_id:\s*id,\s*\.\.\.body\s*\}\)/);
});
