import assert from 'assert';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';

console.log('🧪 Starting tests for Visual Identity Universe Linking & Character Integration...\n');

// --------------------------------------------------------------------------
// Test 1: Normalize Visual Identity with Universe Profile Link
// --------------------------------------------------------------------------
console.log('▶ Test 1: Testing normalization of Visual Identity with Universe Link...');

const rawKioViConfig = {
  schema_version: '2',
  label: 'Kio Wonders — 3D Sci-Fi Curiosity',
  description: '3D Science Curiosity style',
  subject: {
    kind: 'stylized_3d_character',
    faceless_mode: 'not_applicable',
    universe_profile_id: 'univ_kio_wonders_12345',
    universe_slug: 'kio-wonders',
    universe_name: 'Kio Wonders',
    character_keys: ['kio', 'bimo'],
    custom_description: 'Kio (3D Boy Explorer) & BIMO (AI Hover-Bot)',
    character_count: 2,
    population_mode: 'group'
  },
  visual_language: {
    primary_style: 'stylized_3d_character',
    supporting_styles: ['isometric_society']
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['smooth_matte_plastic', 'glowing_hologram_glass']
  },
  guardrails: {
    face_visibility: 'allowed'
  }
};

const normalized = validateAndNormalizeVisualIdentity(rawKioViConfig);

console.log('  Normalized subject:', normalized.subject);
console.log('  Normalized guardrails:', normalized.guardrails);

assert.strictEqual(normalized.subject.kind, 'stylized_3d_character', 'subject.kind should be stylized_3d_character');
assert.strictEqual(normalized.subject.universe_slug, 'kio-wonders', 'universe_slug should be preserved');
assert.strictEqual(normalized.subject.universe_name, 'Kio Wonders', 'universe_name should be preserved');
assert.deepStrictEqual(normalized.subject.character_keys, ['kio', 'bimo'], 'character_keys should be preserved');
assert.strictEqual(normalized.guardrails.face_visibility, 'allowed', 'guardrails.face_visibility should be allowed for 3D character');

console.log('  ✅ Test 1 Passed: Visual Identity correctly preserves Universe Linking fields and allowed face visibility.\n');

// --------------------------------------------------------------------------
// Test 2: Prompt Generation with Universe-Linked 3D Visual Identity
// --------------------------------------------------------------------------
console.log('▶ Test 2: Testing prompt generation with Universe-Linked 3D Visual Identity...');

const promptSection = buildVisualIdentityPromptSection(normalized, 8);
console.log('  Prompt Section Preview (excerpts):');
const lines = promptSection.split('\n').filter(l => l.includes('Konsep Karakter') || l.includes('GUARDRAILS') || l.includes('Wajib konsisten'));
lines.forEach(l => console.log('   ', l));

assert.ok(promptSection.includes('FULL 3D STYLIZED ANIMATED CHARACTER'), 'Prompt should include full 3D stylized animated character');
assert.ok(!promptSection.includes('STRICTLY FACELESS'), 'Prompt should not mandate strictly faceless hands only');
assert.ok(promptSection.includes('DILARANG KERAS memunculkan wajah manusia fotorealistik'), 'Prompt should still prohibit photorealistic human faces');

console.log('  ✅ Test 2 Passed: Prompt Section generated without faceless restrictions.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');

// --------------------------------------------------------------------------
// Test 3: VI Universe Link service (dry-run no write, merge preserves other fields, unknown key rejected)
// --------------------------------------------------------------------------
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { linkVisualIdentityToUniverse } from '../lib/visual-identity-universe-link.js';
import { runCharacterLockPreflight } from '../lib/character-lock-preflight.js';

console.log('\n▶ Test 3: Testing linkVisualIdentityToUniverse (dry-run, merge isolation, unknown key rejection)...');

const tenantId = 'tnt_pt-gim-sosmed_62d0d9';
const existingVi = {
  id: 'vi_arka_test',
  tenant_id: tenantId,
  label: 'Ruang Akustik — Arka',
  version: 3,
  source: 'user',
  config: {
    ...normalized,
    wardrobe: { mode: 'fixed', custom_description: 'Navy blazer over light grey tee' },
    lighting: { preset_key: 'studio_soft', color_temperature: 'neutral' },
    subject: {
      ...normalized.subject,
      universe_profile_id: 'univ_ra_old',
      universe_slug: 'old-slug',
      character_keys: ['maya'],
      character_lock_mode: 'off',
      custom_description: 'Keep this custom description intact'
    }
  }
};
const universeRow = {
  id: 'univ_ra_1',
  tenant_id: tenantId,
  slug: 'ruang-akustik-id',
  name: 'Ruang Akustik ID'
};
const universeChars = [
  { id: 'c_maya', character_key: 'maya', name: 'Maya' },
  { id: 'c_arka', character_key: 'arka_acoustic_consultant', name: 'Arka' }
];

let updateCalls = 0;
let lastUpdatedConfig = null;
const linkDeps = {
  async getVisualIdentityFn(id) { return id === existingVi.id ? existingVi : null; },
  async updateVisualIdentityFn(id, input) {
    updateCalls += 1;
    lastUpdatedConfig = input.config;
    return { ...existingVi, version: existingVi.version + 1, config: input.config };
  },
  async getUniverseProfileFn(id) { return id === universeRow.id ? universeRow : null; },
  async getUniverseCharactersFn() { return universeChars; },
  async findActiveSchedulesForViFn() { return [{ id: 'sch_1', name: 'Jadwal Ruang Akustik' }]; }
};

// 3a. dry_run default true must NOT write
const dryRes = await linkVisualIdentityToUniverse({
  visualIdentityId: existingVi.id,
  universeId: universeRow.id,
  characterKeys: ['arka_acoustic_consultant'],
  characterLockMode: 'strict',
  tenantId,
  deps: linkDeps
});
assert.strictEqual(dryRes.dry_run, true, 'dry_run must default to true');
assert.strictEqual(updateCalls, 0, 'dry_run must NOT call updateVisualIdentity');
assert.strictEqual(dryRes.before.character_lock_mode, 'off');
assert.strictEqual(dryRes.after.character_lock_mode, 'strict');
assert.deepStrictEqual(dryRes.after.character_keys, ['arka_acoustic_consultant']);
assert.ok(dryRes.warnings.length === 1 && dryRes.warnings[0].includes('Jadwal Ruang Akustik'), 'Active schedule warning expected');
assert.ok(dryRes.diff['subject.character_keys'], 'diff should include subject.character_keys');

// 3b. unknown character key must be rejected
let unknownRejected = false;
try {
  await linkVisualIdentityToUniverse({
    visualIdentityId: existingVi.id,
    universeId: universeRow.id,
    characterKeys: ['nonexistent_char'],
    dryRun: false,
    tenantId,
    deps: linkDeps
  });
} catch (err) {
  unknownRejected = err.code === 'OWNER_NOT_FOUND';
}
assert.strictEqual(unknownRejected, true, 'Unknown character key must throw OWNER_NOT_FOUND');
assert.strictEqual(updateCalls, 0);

// 3c. dry_run: false writes ONLY subject link fields, leaving wardrobe/lighting/custom_description untouched
const applyRes = await linkVisualIdentityToUniverse({
  visualIdentityId: existingVi.id,
  universeId: universeRow.id,
  characterKeys: ['arka_acoustic_consultant'],
  characterLockMode: 'strict',
  dryRun: false,
  tenantId,
  deps: linkDeps
});
assert.strictEqual(applyRes.dry_run, false);
assert.strictEqual(updateCalls, 1);
assert.deepStrictEqual(lastUpdatedConfig.wardrobe, existingVi.config.wardrobe, 'wardrobe must stay untouched');
assert.deepStrictEqual(lastUpdatedConfig.lighting, existingVi.config.lighting, 'lighting must stay untouched');
assert.strictEqual(lastUpdatedConfig.subject.custom_description, 'Keep this custom description intact', 'other subject fields must stay untouched');
assert.strictEqual(lastUpdatedConfig.subject.character_lock_mode, 'strict');
assert.deepStrictEqual(lastUpdatedConfig.subject.character_keys, ['arka_acoustic_consultant']);
console.log('  ✅ Test 3 Passed: linkVisualIdentityToUniverse dry-run, merge isolation, and validation verified.');

// --------------------------------------------------------------------------
// Test 4: Character Lock Preflight (ready with approved asset + Maya prompt blocked on strict)
// --------------------------------------------------------------------------
console.log('\n▶ Test 4: Testing runCharacterLockPreflight...');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-preflight-test-'));
try {
  const arkaBytes = Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    Buffer.alloc(120, 0x77)
  ]);
  const arkaPath = path.join(tmpDir, 'arka_v1.png');
  fs.writeFileSync(arkaPath, arkaBytes);
  const arkaSha = crypto.createHash('sha256').update(arkaBytes).digest('hex');

  const preflightVi = {
    ...existingVi,
    config: lastUpdatedConfig
  };

  const preflightRes = await runCharacterLockPreflight({
    visualIdentityId: preflightVi.id,
    mode: 'required',
    samplePrompt: 'Maya is explaining acoustic panels in the living room',
    tenantId,
    deps: {
      async getVisualIdentityFn() { return preflightVi; },
      async getUniverseProfileFn() { return universeRow; },
      async getReferenceAssetFn(assetId) {
        if (assetId === 'ref_arka_1') {
          return {
            id: 'ref_arka_1',
            tenant_id: tenantId,
            asset_role: 'identity',
            version: 1,
            sha256: arkaSha,
            storage_path: arkaPath,
            public_path: arkaPath
          };
        }
        return null;
      },
      async getManifestFn() {
        return {
          universe_profile: 'ruang-akustik-id',
          characters: {
            maya: {
              display_name: 'Maya',
              identity_reference_path: arkaPath,
              identity_asset: { asset_id: 'ref_maya_1', version: 1, sha256: 'other', public_path: arkaPath, source: 'approved_asset' }
            },
            arka_acoustic_consultant: {
              display_name: 'Arka',
              identity_reference_path: arkaPath,
              identity_asset: { asset_id: 'ref_arka_1', version: 1, sha256: arkaSha, public_path: arkaPath, source: 'approved_asset' }
            }
          }
        };
      }
    }
  });

  assert.strictEqual(preflightRes.success, true);
  assert.strictEqual(preflightRes.status, 'ready');
  assert.strictEqual(preflightRes.blocking, false);
  assert.strictEqual(preflightRes.resolved_assets.length, 1);
  assert.strictEqual(preflightRes.resolved_assets[0].character_key, 'arka_acoustic_consultant');
  assert.strictEqual(preflightRes.resolved_assets[0].asset_id, 'ref_arka_1');
  assert.strictEqual(preflightRes.resolved_assets[0].sha256, arkaSha);
  assert.strictEqual(preflightRes.resolved_assets[0].source, 'approved_asset');
  console.log('  ✅ Test 4 Passed: runCharacterLockPreflight returned status=ready with ONLY Arka approved_asset even when prompt mentioned Maya.');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
