/**
 * tests/custom-storyboard-character-lock.test.js
 *
 * Memastikan kampanye custom storyboard (jalur CFA) menyimpan snapshot Visual Identity
 * sehingga Character Lock (referensi karakter Universe) aktif untuk VI karakter 3D,
 * dan tidak pernah menyimpan VI default bila preset tidak ditemukan.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCustomStoryboardIdentity } from '../lib/custom-storyboard-pipeline.js';
import { hasStylizedUniverseLink } from '../lib/cartoon-reference-resolver.js';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

const STYLIZED_SNAPSHOT = {
  schema_version: 'visual_identity_snapshot_v1',
  identity_ref: { id: 'vi_test_reno_v4', key: 'test_reno_v4', version: 2, source: 'user' },
  structured: {
    schema_version: '2',
    style: { preset_key: 'stylized_3d_character', aspect_ratio: '9:16' },
    visual_language: { primary_style: 'stylized_3d_character' },
    subject: {
      kind: 'stylized_3d_character',
      face_visibility: 'allowed',
      universe_profile_id: 'univ_test_thermal',
      universe_slug: 'test-thermal',
      universe_name: 'Test Thermal Universe',
      character_keys: ['reno_thermal_engineer'],
      character_count: 1
    }
  },
  reference_assets: [],
  resolved: {},
  legacy: {}
};

test('1. VI ditemukan -> ref & snapshot dikembalikan apa adanya', async () => {
  const resolver = async ({ preset_id }) => {
    assert.equal(preset_id, 'vi_test_reno_v4');
    return { ref: STYLIZED_SNAPSHOT.identity_ref, snapshot: STYLIZED_SNAPSHOT };
  };
  const res = await resolveCustomStoryboardIdentity('vi_test_reno_v4', resolver);
  assert.equal(res.ref.id, 'vi_test_reno_v4');
  assert.equal(res.ref.version, 2);
  assert.equal(res.snapshot.structured.subject.universe_profile_id, 'univ_test_thermal');
});

test('2. VI tidak ditemukan (resolver jatuh ke default "inline") -> snapshot TIDAK disimpan', async () => {
  const resolver = async () => ({
    ref: { id: 'inline', key: 'inline', version: 1, source: 'inline' },
    snapshot: { schema_version: 'visual_identity_snapshot_v1', structured: { subject: { kind: 'human' } } }
  });
  const res = await resolveCustomStoryboardIdentity('vi_tidak_ada', resolver);
  assert.equal(res.ref, null);
  assert.equal(res.snapshot, null);
});

test('3. Resolver error -> aman, snapshot null', async () => {
  const resolver = async () => { throw new Error('db down'); };
  const res = await resolveCustomStoryboardIdentity('vi_test_reno_v4', resolver);
  assert.deepEqual(res, { ref: null, snapshot: null });
});

test('4. Tanpa visual_identity_preset_id -> resolver tidak dipanggil, snapshot null', async () => {
  let called = false;
  const resolver = async () => { called = true; return {}; };
  const res = await resolveCustomStoryboardIdentity(null, resolver);
  assert.equal(called, false);
  assert.deepEqual(res, { ref: null, snapshot: null });
});

test('5. Kampanye dengan snapshot VI stylized + universe -> Character Lock aktif', () => {
  const campaign = { visual_overrides_json: JSON.stringify(STYLIZED_SNAPSHOT), content_world: 'real_world' };
  const info = hasStylizedUniverseLink({ campaign, row: {} });
  assert.equal(info.isStylized, true);
  assert.equal(info.hasUniverseLink, true);
  assert.equal(info.shouldResolveReferences, true);
  assert.equal(info.universeProfileId, 'univ_test_thermal');
  assert.deepEqual(info.fallbackCharacterKeys, ['reno_thermal_engineer']);
});

test('6. Kampanye tanpa snapshot (perilaku lama) -> Character Lock tidak aktif', () => {
  const campaign = { visual_overrides_json: null, visual_identity_preset_id: 'vi_test_reno_v4', content_world: 'real_world' };
  const info = hasStylizedUniverseLink({ campaign, row: {} });
  assert.equal(info.shouldResolveReferences, false);
});
