process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildMultiplierPhase2Prompt, buildOrganicPillarPrompt } from '../lib/prompts.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

const SNAPSHOT_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'bridge-prompt-stage1.snapshot.json');

const baseProduct = {
  id: 'prod_snap_1',
  product_name: 'Susu Steril Kurma Madu',
  product_description: 'Minuman susu steril dengan ekstrak kurma dan madu alami',
  unique_selling_point: 'Praktis menjaga stamina dan energi harian',
  packaging_type: 'Kaleng 189ml',
  is_in_packaging: 1,
  product_truth: '189ml matte gold aluminum can with date & honey motif',
  geometric_truth: 'Cylindrical aluminum can 189ml',
  t2i_prompt: 'Cylindrical gold aluminum can',
  i2v_action_prompt: 'Hand holding can gently'
};

const baseVsoMultiplier = {
  isVsoActive: true,
  characterConcept: 'faceless',
  subjectDemographic: 'syari_classic',
  wardrobeStyle: 'amber_terracotta',
  lightingStyle: 'golden_hour',
  environmentPrompt: 'Warm morning breakfast table'
};

const baseVsoPillar = {
  schema_version: 'visual_identity_snapshot_v1',
  structured: {
    visual_language: { primary_style: 'commercial_product_cinematic' },
    subject: { anchor_description: 'Graceful Muslimah POV hands' },
    wardrobe: { clothing_description: 'Muted sage linen sleeve' },
    lighting: { mood_description: 'Golden morning window light' }
  }
};

function generateScenarios() {
  const scenarios = [
    {
      name: 'multiplier_4_N2_X1',
      fn: () => buildMultiplierPhase2Prompt(
        [{ scene: 1, visual: 'Hook', voice_over: 'Hook' }],
        baseProduct,
        { clip_duration: 4, words_per_clip: '8-9 kata', visual_style_preset: 'Macrophotography' },
        { is_bridging_active: true, target_clips_count: 4, bridge_at_clip: 2, bridge_duration_clips: 1, visual_mode: 'hybrid_lock', product_filename_declare: 'prod_snap_1.png' },
        baseVsoMultiplier,
        { enable_tts: true, voice_provider: 'minimax' }
      )
    },
    {
      name: 'multiplier_6_N3_X2',
      fn: () => buildMultiplierPhase2Prompt(
        [{ scene: 1, visual: 'Hook', voice_over: 'Hook' }],
        baseProduct,
        { clip_duration: 4, words_per_clip: '8-9 kata', visual_style_preset: 'Macrophotography' },
        { is_bridging_active: true, target_clips_count: 6, bridge_at_clip: 3, bridge_duration_clips: 2, visual_mode: 'hybrid_lock', product_filename_declare: 'prod_snap_1.png' },
        baseVsoMultiplier,
        { enable_tts: true, voice_provider: 'minimax' }
      )
    },
    {
      name: 'multiplier_6_N2_X0',
      fn: () => buildMultiplierPhase2Prompt(
        [{ scene: 1, visual: 'Hook', voice_over: 'Hook' }],
        baseProduct,
        { clip_duration: 4, words_per_clip: '8-9 kata', visual_style_preset: 'Macrophotography' },
        { is_bridging_active: true, target_clips_count: 6, bridge_at_clip: 2, bridge_duration_clips: 0, visual_mode: 'hybrid_lock', product_filename_declare: 'prod_snap_1.png' },
        baseVsoMultiplier,
        { enable_tts: true, voice_provider: 'minimax' }
      )
    },
    {
      name: 'multiplier_6_inactive',
      fn: () => buildMultiplierPhase2Prompt(
        [{ scene: 1, visual: 'Hook', voice_over: 'Hook' }],
        { is_pure_storytelling: true, product_name: '', unique_selling_point: 'Pesan positif' },
        { clip_duration: 4, words_per_clip: '8-9 kata', visual_style_preset: 'Cinematic', narrative_mode: 'Storytelling' },
        { is_bridging_active: false, target_clips_count: 6, visual_mode: 'hybrid_lock' },
        baseVsoMultiplier,
        { enable_tts: true, voice_provider: 'minimax' }
      )
    },
    {
      name: 'pillar_4_N2_X1',
      fn: () => buildOrganicPillarPrompt(
        [],
        {
          campaign_name: 'Snap Pillar 4',
          content_pillar: 'Energi Kerja Harian',
          target_clips_count: 4,
          bridge_at_clip: 2,
          bridge_duration_clips: 1,
          is_bridging_active: 1,
          visual_style: 'Cinematic',
          narrative_mode: 'Problem-Solution',
          custom_hook: 'Energi habis sebelum jam makan siang?',
          visual_action_guideline: 'Cangkir kopi mendingin di meja kerja'
        },
        baseProduct,
        {},
        baseVsoPillar
      )
    },
    {
      name: 'pillar_6_N3_X2',
      fn: () => buildOrganicPillarPrompt(
        [],
        {
          campaign_name: 'Snap Pillar 6',
          content_pillar: 'Energi Kerja Harian',
          target_clips_count: 6,
          bridge_at_clip: 3,
          bridge_duration_clips: 2,
          is_bridging_active: 1,
          visual_style: 'Cinematic',
          narrative_mode: 'Problem-Solution',
          custom_hook: 'Energi habis sebelum jam makan siang?',
          visual_action_guideline: 'Cangkir kopi mendingin di meja kerja'
        },
        baseProduct,
        {},
        baseVsoPillar
      )
    },
    {
      name: 'pillar_6_N2_X0',
      fn: () => buildOrganicPillarPrompt(
        [],
        {
          campaign_name: 'Snap Pillar Zero',
          content_pillar: 'Energi Kerja Harian',
          target_clips_count: 6,
          bridge_at_clip: 2,
          bridge_duration_clips: 0,
          is_bridging_active: 1,
          visual_style: 'Cinematic',
          narrative_mode: 'Storytelling',
          custom_hook: 'Pagi produktif dimulai dari meja kerja rapi.',
          visual_action_guideline: 'Meja kerja pagi hari'
        },
        baseProduct,
        {},
        baseVsoPillar
      )
    },
    {
      name: 'pillar_metaphoric_6_N3_X1',
      fn: () => buildOrganicPillarPrompt(
        [],
        {
          campaign_name: 'Snap Pillar Metaphoric',
          content_pillar: 'Aliran Darah Sehat',
          target_clips_count: 6,
          bridge_at_clip: 3,
          bridge_duration_clips: 1,
          is_bridging_active: 1,
          visual_style: 'metaphoric_faceless',
          narrative_mode: 'Problem-Solution',
          custom_hook: 'Pernah merasa aliran tenaga terasa berat di sore hari?',
          visual_action_guideline: 'Cairan madu mengalir perlahan di saluran kaca transparan'
        },
        baseProduct,
        {},
        baseVsoPillar
      )
    },
    {
      name: 'pillar_6_inactive',
      fn: () => buildOrganicPillarPrompt(
        [],
        {
          campaign_name: 'Snap Pillar Inactive',
          content_pillar: 'Manajemen Fokus Harian',
          target_clips_count: 6,
          bridge_at_clip: 2,
          bridge_duration_clips: 1,
          is_bridging_active: 0,
          visual_style: 'Cinematic',
          narrative_mode: 'Storytelling',
          custom_hook: 'Fokus yang tenang lahir dari meja yang bebas gangguan.',
          visual_action_guideline: 'Notebook terbuka dengan pena di sebelah jendela'
        },
        null,
        {},
        baseVsoPillar
      )
    }
  ];

  const results = {};
  for (const sc of scenarios) {
    results[sc.name] = sc.fn();
  }
  return results;
}

if (process.env.UPDATE_SNAPSHOTS === '1') {
  const out = generateScenarios();
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(out, null, 2));
  console.log(`Captured ${Object.keys(out).length} Stage 1 prompt snapshots -> ${SNAPSHOT_PATH}`);
}

test('Stage 1 Single-Segment Prompt Snapshots match baseline exactly', () => {
  assert.ok(fs.existsSync(SNAPSHOT_PATH), 'Snapshot fixture must exist (run with UPDATE_SNAPSHOTS=1 first)');
  const expected = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const actual = generateScenarios();

  for (const key of Object.keys(expected)) {
    assert.equal(actual[key], expected[key], `Prompt mismatch for snapshot "${key}"`);
  }
});

