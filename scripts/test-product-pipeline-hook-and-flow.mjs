import assert from 'node:assert/strict';
import {
  HOOK_VISUAL_MODES,
  DEFAULT_HOOK_VISUAL_MODE,
  normalizeHookVisualMode
} from '../lib/content-planner-contract.js';
import {
  buildOrganicPillarPrompt,
  buildStrategicCampaignPrompt
} from '../lib/prompts.js';

console.log('🧪 Running Test Suite: Product Pipeline Hook Visual Mode & Connective Narrative Flow...');

// ---------------------------------------------------------------------------
// 1. Contract & Normalization Tests
// ---------------------------------------------------------------------------
assert.ok(Array.isArray(HOOK_VISUAL_MODES), 'HOOK_VISUAL_MODES must be an array');
assert.ok(HOOK_VISUAL_MODES.includes('problem_first'), 'HOOK_VISUAL_MODES must include problem_first');
assert.ok(HOOK_VISUAL_MODES.includes('product_first'), 'HOOK_VISUAL_MODES must include product_first');
assert.equal(DEFAULT_HOOK_VISUAL_MODE, 'problem_first', 'Default hook visual mode must be problem_first');

assert.equal(normalizeHookVisualMode(undefined), 'problem_first');
assert.equal(normalizeHookVisualMode(null), 'problem_first');
assert.equal(normalizeHookVisualMode(''), 'problem_first');
assert.equal(normalizeHookVisualMode('problem_first'), 'problem_first');
assert.equal(normalizeHookVisualMode('product_first'), 'product_first');
assert.equal(normalizeHookVisualMode('unknown_mode'), 'problem_first');
console.log('  ✓ Contract & normalization tests passed.');

// ---------------------------------------------------------------------------
// 2. Storyboard Prompts: Connective Flow & Master Monologue Through-Line Tests
// ---------------------------------------------------------------------------
const sampleCampaignData = {
  words_per_clip: '16 kata',
  aspect_ratio: '9:16',
  narrative_mode: 'Problem-Solution',
  custom_hook: 'Mata perih karena seharian menatap layar laptop?',
  target_clips: 4,
  clip_duration: 8,
  bridge_at_clip: 3,
  is_bridging_active: true,
  visual_style: 'Cinematic'
};

const organicPrompt = buildOrganicPillarPrompt(
  [{ name: 'General', content: 'Knowledge base text' }],
  sampleCampaignData,
  { product_name: 'Eyevit Plus', unique_selling_point: 'Ekstrak bilberry & lutein alami' },
  { brand_name: 'NutriCare', tone_of_voice: 'Empatik Edukatif' },
  null
);

assert.ok(organicPrompt.includes('CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE') || organicPrompt.includes('Master Monologue'),
  'Organic Pillar Prompt must contain Connective Flow & Master Monologue Mandate');
assert.ok(organicPrompt.includes('Padahal') || organicPrompt.includes('Masalahnya'),
  'Organic Pillar Prompt must guide AI to use discourse connectors (e.g. Padahal, Masalahnya)');
assert.ok(organicPrompt.includes('Klip 1 s/d'),
  'Organic Pillar Prompt must enforce narrative connection across all clips');
console.log('  ✓ buildOrganicPillarPrompt narrative flow tests passed.');

const sampleCampaign = {
  id: 'cmp_test_001',
  product_description: 'Suplemen kesehatan mata alami kaya antioksidan lutein dan bilberry.',
  product_usp: 'Ekstrak bilberry alami terstandarisasi.',
  clip_duration: 8
};

const sampleItem = {
  id: 'item_test_001',
  pillar: 'Edukasi & Problem Solving',
  category_cep: 'Problem-Solution Based',
  ws_matrix: 'Bekerja larut malam di depan monitor',
  context: 'Mata lelah dan kering saat deadline',
  vfo: 'Concrete (Fakta & Produk Langsung)',
  strategic_angle: 'Gejala mata lelah bukan sekadar ngantuk biasa',
  hook: 'Mata perih karena seharian menatap layar laptop?',
  visual_action: 'Close-up ekspresi kelelahan pekerja di meja kerja malam hari',
  product: 'Eyevit Plus',
  target_clips_count: 4
};

const sampleWorkflow = {
  target_clips_count: 4,
  clip_duration: 8,
  target_language: 'id-ID',
  is_bridging_active: true,
  promotion_style: 'Softselling',
  visual_style: 'Cinematic',
  visual_mode: 'hybrid_lock',
  words_per_clip: '15-16 kata'
};

const strategicPrompt = buildStrategicCampaignPrompt(
  sampleCampaign,
  sampleItem,
  sampleWorkflow,
  'Creative KB content',
  'VSO Directives',
  'Isolation Mandate',
  'Klip 3 dari total 4 klip'
);

assert.ok(strategicPrompt.includes('MASTER MONOLOGUE') || strategicPrompt.includes('CONNECTIVE NARRATIVE FLOW'),
  'Strategic Campaign Prompt must mandate Master Monologue & Connective Narrative Flow');
assert.ok(strategicPrompt.includes('Padahal') || strategicPrompt.includes('Masalahnya') || strategicPrompt.includes('discourse markers'),
  'Strategic Campaign Prompt must mandate discourse connectors between scenes');
console.log('  ✓ buildStrategicCampaignPrompt narrative flow tests passed.');

console.log('🎉 All Product Pipeline Hook Visual & Narrative Flow tests passed!');
process.exit(0);
