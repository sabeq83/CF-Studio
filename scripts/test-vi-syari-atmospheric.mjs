import assert from 'node:assert/strict';
import {
  listSystemVisualIdentities,
  getSystemVisualIdentity
} from '../lib/visual-identity-system-presets.js';
import {
  validateAndNormalizeVisualIdentity
} from '../lib/visual-identity-contract.js';
import {
  DEMOGRAPHIC_PRESETS
} from '../lib/prompts.js';

console.log('🧪 Starting automated test: Syar\'iy Classic Atmospheric Home Visual Identity...');

// 1. Verify Preset Existence & Retrieval
console.log('1. Checking getSystemVisualIdentity("syari_classic_atmospheric_home")...');
const preset = getSystemVisualIdentity('syari_classic_atmospheric_home');
assert.ok(preset, 'Preset "syari_classic_atmospheric_home" must exist in system presets');
assert.equal(preset.key, 'syari_classic_atmospheric_home');
assert.equal(preset.version, 1);
assert.ok(preset.label.includes('Atmospheric Serenity'), 'Label must reflect Atmospheric Serenity');

// 2. Validate Schema V2 Structure
console.log('2. Validating Schema V2 configuration and guardrails...');
const config = preset.config;
assert.equal(config.schema_version, '2');
assert.equal(config.subject.kind, 'human');
assert.equal(config.subject.faceless_mode, 'back_view');
assert.equal(config.subject.demographic_key, 'syari_classic');
assert.equal(config.visual_language.primary_style, 'cinematic_realistic');
assert.ok(config.visual_language.supporting_styles.includes('commercial_product_cinematic'));

// Check wardrobe & environment
assert.equal(config.wardrobe.preset_key, 'mocca_caramel');
assert.equal(config.wardrobe.sleeve_policy, 'wrists_covered');
assert.equal(config.environment.preset_key, 'custom');
assert.ok(config.environment.custom_description.toLowerCase().includes('rain') || config.environment.custom_description.toLowerCase().includes('window'), 'Environment must describe weather/window elements');

// Check guardrails against kitchen monotony
assert.equal(config.guardrails.anti_kitchen_monotony, 'enforced');
assert.equal(config.guardrails.forbid_faceless_kitchen_only, true);
assert.ok(
  config.guardrails.required_negative_prompts.some(p => p.includes('cutting board') || p.includes('kitchen tabletop')),
  'Guardrails must contain negative prompts preventing repetitive kitchen chopping'
);

// 3. Test validateAndNormalizeVisualIdentity on the preset config
console.log('3. Testing normalization through validateAndNormalizeVisualIdentity()...');
const normalized = validateAndNormalizeVisualIdentity(preset.config);
assert.equal(normalized.schema_version, '2');
assert.equal(normalized.visual_language.primary_style, 'cinematic_realistic');
assert.equal(normalized.subject.faceless_mode, 'back_view');

// 4. Test DEMOGRAPHIC_PRESETS.syari_classic in lib/prompts.js
console.log('4. Testing DEMOGRAPHIC_PRESETS.syari_classic prompt content...');
const syariPrompt = DEMOGRAPHIC_PRESETS.syari_classic;
assert.ok(syariPrompt, 'DEMOGRAPHIC_PRESETS.syari_classic must be defined');
assert.ok(
  syariPrompt.toLowerCase().includes('atmospheric') || syariPrompt.toLowerCase().includes('weather') || syariPrompt.toLowerCase().includes('window'),
  'DEMOGRAPHIC_PRESETS.syari_classic must allow atmospheric/weather/window storytelling'
);
assert.ok(
  syariPrompt.toLowerCase().includes('back-view') || syariPrompt.toLowerCase().includes('silhouette'),
  'DEMOGRAPHIC_PRESETS.syari_classic must allow modest back-view silhouettes'
);

// 5. Test presence in listSystemVisualIdentities()
console.log('5. Testing listSystemVisualIdentities()...');
const allPresets = listSystemVisualIdentities();
const foundInList = allPresets.find(p => p.key === 'syari_classic_atmospheric_home');
assert.ok(foundInList, 'syari_classic_atmospheric_home must be present in listSystemVisualIdentities()');

console.log('🎉 ALL SYAR\'IY CLASSIC ATMOSPHERIC TESTS PASSED SUCCESSFULLY!\n');
process.exit(0);
