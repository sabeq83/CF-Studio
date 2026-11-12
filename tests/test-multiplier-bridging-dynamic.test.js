process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { buildAutonomousBridgingConfig } from '../lib/multiplier-pairing.js';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

test('1. buildAutonomousBridgingConfig propagates bridge_at_clip and bridge_duration_clips dynamically from preset without hardcoding', () => {
  const sampleProduct = {
    id: 'pe_test_1',
    product_name: 'Dark Cocoa Pure',
    product_url: 'https://shopee.co.id/test',
    clean_photo_url: '/uploads/products/clean/test.jpg'
  };

  // Scenario A: 4 clips, bridge at clip 3, duration 2
  const cfgA = buildAutonomousBridgingConfig({
    product: sampleProduct,
    chosenAngle: { title: 'Angle A', hook_text: 'Hook A' },
    presetConfig: {
      product_bridging: {
        is_bridging_active: true,
        bridging_mode: 'select_existing',
        bridge_at_clip: 3,
        bridge_duration_clips: 2
      }
    },
    effectiveTargetClipsCount: 4,
    presetKey: 'preset_a'
  });

  assert.equal(cfgA.is_bridging_active, true);
  assert.equal(cfgA.isBridgingActive, true);
  assert.equal(cfgA.bridge_at_clip, 3);
  assert.equal(cfgA.bridgeAtClip, 3);
  assert.equal(cfgA.bridge_duration_clips, 2);
  assert.equal(cfgA.bridgeDurationClips, 2);
  assert.equal(cfgA.targetClipsCount, 4);
  assert.equal(cfgA.target_clips_count, 4);

  // Scenario B: 6 clips, bridge at clip 4, duration 2 (verify not hardcoded to 2 or 3)
  const cfgB = buildAutonomousBridgingConfig({
    product: sampleProduct,
    chosenAngle: { title: 'Angle B', hook_text: 'Hook B' },
    presetConfig: {
      product_bridging: {
        is_bridging_active: true,
        bridging_mode: 'select_existing',
        bridge_at_clip: 4,
        bridge_duration_clips: 2
      }
    },
    effectiveTargetClipsCount: 6,
    presetKey: 'preset_b'
  });

  assert.equal(cfgB.bridge_at_clip, 4);
  assert.equal(cfgB.bridgeAtClip, 4);
  assert.equal(cfgB.targetClipsCount, 6);

  // Scenario C: Override takes priority over preset
  const cfgC = buildAutonomousBridgingConfig({
    product: sampleProduct,
    chosenAngle: { title: 'Angle C', hook_text: 'Hook C' },
    presetConfig: {
      product_bridging: {
        is_bridging_active: true,
        bridge_at_clip: 2,
        bridge_duration_clips: 1
      }
    },
    overrides: { bridge_at_clip: 5, bridge_duration_clips: 1 },
    effectiveTargetClipsCount: 6,
    presetKey: 'preset_c'
  });

  assert.equal(cfgC.bridge_at_clip, 5);
  assert.equal(cfgC.bridgeAtClip, 5);
});

test('2. buildMultiplierPhase2Prompt respects snake_case bridging keys, enforces exact bridge clip zoning, and injects sentence integrity rules', () => {
  const productDNA = {
    product_name: 'Dark Cocoa Pure',
    product_description: '100% cocoa powder without added sugar',
    unique_selling_point: '100% pure, high antioxidant',
    product_truth: 'Clear cylindrical jar filled with dark cocoa',
    geometric_truth: 'Cylindrical transparent jar 270g'
  };

  // Snake_case bridging config (like saved in database)
  const bridging4Clips = {
    is_bridging_active: true,
    bridge_at_clip: 3,
    bridge_duration_clips: 2,
    target_clips_count: 4,
    visual_mode: 'hybrid_lock',
    angle_title: 'Healthy Dessert Without Sugar'
  };

  const aesthetics = {
    clip_duration: 4,
    words_per_clip: '8-9 kata',
    narrative_mode: 'auto',
    visual_style_preset: 'Macrophotography'
  };

  const prompt4 = buildMultiplierPhase2Prompt([], productDNA, aesthetics, bridging4Clips, { isVsoActive: true }, { enable_tts: true, voice_provider: 'minimax' });

  assert.ok(prompt4.includes('PRODUCT BRIDGING & STRICT CLIP ZONING CONTRACT (TOTAL 4 KLIP, BRIDGING MULAI KLIP #3)'));
  assert.ok(prompt4.includes('ZONA PRE-BRIDGING (Klip 1 s.d. Klip 2)'));
  assert.ok(prompt4.includes('TITIK PIVOT BRIDGING (TEPAT DI KLIP #3)'));
  assert.ok(prompt4.includes('Klip ke-3 hingga Klip ke-4'));
  assert.ok(prompt4.includes('STRICT SENTENCE INTEGRITY'));
  assert.ok(!prompt4.includes('DIRECT PLACEMENT RULES (NO BRIDGING)'));

  // 6-clip dynamic bridging starting at clip 4 for 2 clips (clips 4-5), transition back on clip 6
  const bridging6Clips = {
    is_bridging_active: true,
    bridge_at_clip: 4,
    bridge_duration_clips: 2,
    target_clips_count: 6,
    visual_mode: 'hybrid_lock'
  };

  const prompt6 = buildMultiplierPhase2Prompt([], productDNA, aesthetics, bridging6Clips, { isVsoActive: true }, { enable_tts: true });

  assert.ok(prompt6.includes('PRODUCT BRIDGING & STRICT CLIP ZONING CONTRACT (TOTAL 6 KLIP, BRIDGING MULAI KLIP #4)'));
  assert.ok(prompt6.includes('ZONA PRE-BRIDGING (Klip 1 s.d. Klip 3)'));
  assert.ok(prompt6.includes('TITIK PIVOT BRIDGING (TEPAT DI KLIP #4)'));
  assert.ok(prompt6.includes('ZONA PEMBAHASAN PRODUK (KLIP #4 s.d. KLIP #5)'));
  assert.ok(prompt6.includes('ZONA PENUTUP / TRANSITION BACK (KLIP #6 s.d. KLIP #6)'));
  assert.ok(prompt6.includes('Klip ke-4 hingga Klip ke-5'));
});
