import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  VO_PRODUCT_MENTION_MODES,
  normalizeVoProductMention,
  readBridgeInputs,
  resolveBridgePlan,
  normalizeBridgePayload
} from '../lib/bridging/bridge-plan.js';
import { buildBridgeZoningContract } from '../lib/bridging/bridge-prompt-zones.js';
import { buildDynamicStoryCurveGuideline } from '../lib/kb/dynamic-story-curve.js';
import { buildAffiliatePromptInstruction } from '../lib/smart-affiliate-package-builder.js';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { repairMissingSceneVoiceovers } from '../lib/tts-text-sanitizer.js';
import { buildAutonomousBridgingConfig } from '../lib/multiplier-pairing.js';
import { validateAndNormalizePresetProductBridging } from '../lib/operator-presets.js';
import { buildMultiplierStartFrameRequest } from '../lib/multiplier-start-frame-request.js';

test('readBridgeInputs & resolveBridgePlan handle visual_only_placement and vo_product_mention safely', () => {
  assert.deepEqual(VO_PRODUCT_MENTION_MODES, ['full', 'cta_only', 'none']);
  assert.equal(normalizeVoProductMention('cta_only'), 'cta_only');
  assert.equal(normalizeVoProductMention('none'), 'none');
  assert.equal(normalizeVoProductMention('invalid', 'cta_only'), 'cta_only');

  const defaultVisualOnly = readBridgeInputs(
    { bridging_mode: 'visual_only_placement' },
    { targetClipsCount: 5 },
    { defaultActive: true }
  );
  assert.equal(defaultVisualOnly.bridgingMode, 'visual_only_placement');
  assert.equal(defaultVisualOnly.voProductMention, 'none');
  assert.equal(defaultVisualOnly.isBridgingActive, true);
  assert.equal(defaultVisualOnly.bridgeAtClip, 1);
  assert.equal(defaultVisualOnly.bridgeDurationClips, 0);

  const plan = resolveBridgePlan(defaultVisualOnly);
  assert.equal(plan.active, true);
  assert.equal(plan.bridgingMode, 'visual_only_placement');
  assert.equal(plan.voProductMention, 'none');
  assert.deepEqual(plan.productClips, [1, 2, 3, 4, 5]);
  assert.deepEqual(plan.legacy, { bridge_at_clip: 1, bridge_duration_clips: 0 });

  // visual_only_placement allows explicit cta_only, blocks full -> none
  const ctaOnly = readBridgeInputs(
    { bridging_mode: 'visual_only_placement', vo_product_mention: 'cta_only' },
    { targetClipsCount: 4 }
  );
  assert.equal(ctaOnly.voProductMention, 'cta_only');

  const blockedFull = readBridgeInputs(
    { bridging_mode: 'visual_only_placement', vo_product_mention: 'full' },
    { targetClipsCount: 4 }
  );
  assert.equal(blockedFull.voProductMention, 'none');

  // normalizeBridgePayload carries bridgingMode and voProductMention
  const normalized = normalizeBridgePayload(
    { is_bridging_active: true, bridging_mode: 'visual_only_placement', vo_product_mention: 'cta_only' },
    { target_clips_count: 6 }
  );
  assert.equal(normalized.active, true);
  assert.equal(normalized.bridgingMode, 'visual_only_placement');
  assert.equal(normalized.voProductMention, 'cta_only');
  assert.deepEqual(normalized.legacy, { bridge_at_clip: 1, bridge_duration_clips: 0 });
  assert.deepEqual(normalized.segments, [{ at_clip: 1, duration_clips: 0, role: 'intro' }]);

  // Standard bridging keeps full by default and accepts none/cta_only
  const standardNone = readBridgeInputs(
    { is_bridging_active: true, bridging_mode: 'select_existing', vo_product_mention: 'none' },
    { targetClipsCount: 4 }
  );
  assert.equal(standardNone.bridgingMode, 'select_existing');
  assert.equal(standardNone.voProductMention, 'none');
});

test('buildBridgeZoningContract separates visual fidelity from verbal VO contract per voProductMention mode', () => {
  const plan = resolveBridgePlan({
    targetClips: 5,
    isBridgingActive: true,
    bridgingMode: 'visual_only_placement',
    voProductMention: 'none',
    bridgeAtClip: 1,
    bridgeDurationClips: 0
  });

  const noneContract = buildBridgeZoningContract(plan, {
    productName: 'Botol Kaca LocknLock 500ml',
    productUsp: 'Anti bocor dan tahan panas',
    voProductMention: 'none',
    productCategoryOrRole: 'botol kaca'
  });
  assert.match(noneContract, /VISUAL-ONLY PRODUCT PLACEMENT CONTRACT/i);
  assert.match(noneContract, /\*\*DILARANG KERAS \(STRICTLY FORBIDDEN\)\*\* menyebut nama merek/i);
  assert.match(noneContract, /botol kaca/i);
  assert.doesNotMatch(noneContract, /TITIK PIVOT BRIDGING/i);

  const ctaOnlyContract = buildBridgeZoningContract(plan, {
    productName: 'Botol Kaca LocknLock 500ml',
    productUsp: 'Anti bocor dan tahan panas',
    voProductMention: 'cta_only',
    productCategoryOrRole: 'botol kaca'
  });
  assert.match(ctaOnlyContract, /VISUAL-ONLY PLACEMENT & CTA-ONLY VO CONTRACT/i);
  assert.match(ctaOnlyContract, /KLIP 1 s\.d\. 4 \(NARASI MURNI TANPA PRODUK\)/i);
  assert.match(ctaOnlyContract, /KLIP PENUTUP #5 \(SOFT POINTER NETRAL SAJA\)/i);

  const fullPlan = resolveBridgePlan({
    targetClips: 4,
    isBridgingActive: true,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    voProductMention: 'full'
  });
  const fullContract = buildBridgeZoningContract(fullPlan, {
    productName: 'Panci Keramik Anti Lengket',
    productUsp: 'Panas merata cepat',
    voProductMention: 'full'
  });
  assert.match(fullContract, /PRODUCT BRIDGING & STRICT CLIP ZONING CONTRACT/i);
});

test('buildDynamicStoryCurveGuideline disables verbal showcase for voProductMention=none and cta_only', () => {
  const noneCurve = buildDynamicStoryCurveGuideline({
    campaignKind: 'multiplier',
    targetClips: 4,
    narrativeMode: 'Direct_Showcase',
    bridgeAtClip: 1,
    bridgeDurationClips: 0,
    voProductMention: 'none'
  });
  assert.match(noneCurve, /VISUAL PLACEMENT \/ EDITORIAL STORYTELLING \(Produk Tampil di Visual, Narasi Murni\)/i);
  assert.match(noneCurve, /Tutup secara alami dengan payoff cerita\/resep tanpa menyebut produk maupun CTA komersial/i);
  assert.doesNotMatch(noneCurve, /DIRECT PRODUCT SHOWCASE/i);

  const ctaOnlyCurve = buildDynamicStoryCurveGuideline({
    campaignKind: 'multiplier',
    targetClips: 4,
    narrativeMode: 'Storytelling',
    bridgeAtClip: 1,
    bridgeDurationClips: 0,
    voProductMention: 'cta_only'
  });
  assert.match(ctaOnlyCurve, /VISUAL PLACEMENT \/ EDITORIAL STORYTELLING/i);
  assert.match(ctaOnlyCurve, /1 kalimat pointer netral dan singkat/i);

  const fullCurve = buildDynamicStoryCurveGuideline({
    campaignKind: 'multiplier',
    targetClips: 4,
    narrativeMode: 'Direct_Showcase',
    bridgeAtClip: 1,
    bridgeDurationClips: 0,
    voProductMention: 'full'
  });
  assert.match(fullCurve, /DIRECT PRODUCT SHOWCASE/i);
});

test('buildAffiliatePromptInstruction & buildMultiplierPhase2Prompt obey visual_only_placement contracts', () => {
  const brandProducts = [
    {
      product_id: 'prod_wok_1',
      product_name: 'Wok Pan Marble 32cm',
      affiliate_link: 'https://shopee.co.id/product/123',
      category: 'Alat Dapur'
    }
  ];
  const affNone = buildAffiliatePromptInstruction({
    brandProducts,
    selectedProductId: 'prod_wok_1',
    isAffiliateEnabled: true,
    voProductMention: 'none'
  });
  assert.match(affNone, /SOCIAL MEDIA PACKAGE/i);
  assert.match(affNone, /DILARANG KERAS menulis kalimat ajakan beli \(CTA\), promosi, atau menyebut nama merek\/produk di dalam naskah Voice-Over/is);

  const affCta = buildAffiliatePromptInstruction({
    brandProducts,
    selectedProductId: 'prod_wok_1',
    isAffiliateEnabled: true,
    voProductMention: 'cta_only'
  });
  assert.match(affCta, /pointer netral dan singkat/i);
  assert.match(affCta, /social_media_package/i);

  const storyboard = [
    { scene_number: 1, action_en: 'hands prep food in kitchen', location_en: 'minimalist kitchen' },
    { scene_number: 2, action_en: 'pouring sauce slowly', location_en: 'minimalist kitchen' },
    { scene_number: 3, action_en: 'serving dish cleanly', location_en: 'minimalist kitchen' },
    { scene_number: 4, action_en: 'close up final plating', location_en: 'minimalist kitchen' }
  ];
  const productDNA = {
    product_name: 'Chopper Serbaguna Turbo X9',
    product_description: 'Memudahkan menghaluskan bumbu dapur dalam hitungan detik.',
    product_usp: 'Pisau ganda tajam dan anti karat.',
    product_category: 'alat dapur'
  };
  const promptNone = buildMultiplierPhase2Prompt(
    storyboard,
    {
      ...productDNA,
      product_truth: 'Matte stainless chopper 300ml with transparent bowl',
      geometric_truth: 'Cylindrical transparent bowl with black lid'
    },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', visualMode: 'hybrid_lock' },
    { isBridgingActive: true, bridgingMode: 'visual_only_placement', voProductMention: 'none', promotionStyle: 'Softselling' },
    { targetClipsCount: 4, visualMode: 'hybrid_lock' },
    { audioEngineMode: 'minimax_tts', targetLanguage: 'id-ID', wordsPerClip: '12-16 kata' },
    0,
    affNone
  );

  assert.match(promptNone, /DATA PRODUK TARGET KAMI/);
  assert.match(promptNone, /Nama Produk: "Chopper Serbaguna Turbo X9"/);
  assert.match(promptNone, /MANDATORY PRODUCT TRUTH & GEOMETRIC TRUTH CONTRACT/);
  assert.match(promptNone, /VISUAL-ONLY PRODUCT PLACEMENT CONTRACT/);
  assert.match(promptNone, /Catatan Penting VO \(none\)/);

  const promptCtaOnly = buildMultiplierPhase2Prompt(
    storyboard,
    {
      ...productDNA,
      product_truth: 'Matte stainless chopper 300ml with transparent bowl',
      geometric_truth: 'Cylindrical transparent bowl with black lid'
    },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', visualMode: 'hybrid_lock' },
    { isBridgingActive: true, bridgingMode: 'visual_only_placement', voProductMention: 'cta_only' },
    { targetClipsCount: 4, visualMode: 'hybrid_lock' },
    { audioEngineMode: 'minimax_tts', targetLanguage: 'id-ID', wordsPerClip: '12-16 kata' },
    0,
    affCta
  );
  assert.match(promptCtaOnly, /VISUAL-ONLY PLACEMENT & CTA-ONLY VO CONTRACT/);
  assert.match(promptCtaOnly, /KLIP 1 s\.d\. 3 \(NARASI MURNI TANPA PRODUK\)/);
  assert.match(promptCtaOnly, /KLIP PENUTUP #4 \(SOFT POINTER NETRAL SAJA\)/);
});

test('repairMissingSceneVoiceovers enforces no-brand/no-CTA hint when voProductMention is none or cta_only', async () => {
  let capturedPromptNone = '';
  const resNone = await repairMissingSceneVoiceovers({
    storyboard: [
      { scene_number: 1, visual_description: 'chopping garlic', narration_transcript: 'Mulai dengan mencincang bawang sampai harum.' },
      { scene_number: 2, visual_description: 'plating warm soup', narration_transcript: '' }
    ],
    productName: 'Botol Kaca LocknLock 500ml',
    voProductMention: 'none',
    generateFn: async (prompt) => {
      capturedPromptNone = prompt;
      return JSON.stringify({ repairs: [{ scene: 2, narration_transcript: 'Sajikan selagi hangat bersama taburan daun bawang.' }] });
    },
    parseJsonFn: (raw) => JSON.parse(raw)
  });

  assert.deepEqual(resNone.repairedIndices, [1]);
  assert.match(capturedPromptNone, /DILARANG menyebut nama merek/i);
  assert.doesNotMatch(capturedPromptNone, /Botol Kaca LocknLock 500ml/);

  let capturedPromptCta = '';
  await repairMissingSceneVoiceovers({
    storyboard: [
      { scene_number: 1, visual_description: 'chopping garlic', narration_transcript: 'Mulai dengan mencincang bawang sampai harum.' },
      { scene_number: 2, visual_description: 'plating warm soup', narration_transcript: '' }
    ],
    productName: 'Botol Kaca LocknLock 500ml',
    voProductMention: 'cta_only',
    generateFn: async (prompt) => {
      capturedPromptCta = prompt;
      return JSON.stringify({ repairs: [{ scene: 2, narration_transcript: 'Simpan resepnya dan cek link di bio ya.' }] });
    },
    parseJsonFn: (raw) => JSON.parse(raw)
  });
  assert.match(capturedPromptCta, /pointer netral singkat/i);
  assert.doesNotMatch(capturedPromptCta, /Botol Kaca LocknLock 500ml/);
});

test('buildAutonomousBridgingConfig & validateAndNormalizePresetProductBridging keep visual_only_placement across pipeline', () => {
  const product = {
    id: 'prod_vop_1',
    product_name: 'Toples Kaca Kedap Udara',
    product_description: 'Menyimpan bahan dapur tetap renyah',
    unique_selling_point: 'Tutup silikon kedap udara',
    product_url: 'https://example.com/toples',
    clean_photo_url: '/uploads/toples.png'
  };

  const config = buildAutonomousBridgingConfig({
    product,
    overrides: { bridging_mode: 'visual_only_placement' },
    effectiveGenerateRecipe: 1
  });
  assert.equal(config.is_bridging_active, true);
  assert.equal(config.bridgingMode, 'visual_only_placement');
  assert.equal(config.bridging_mode, 'visual_only_placement');
  assert.equal(config.voProductMention, 'none');
  assert.equal(config.vo_product_mention, 'none');
  assert.equal(config.bridgeAtClip, 1);
  assert.equal(config.bridgeDurationClips, 0);

  const presetCheck = validateAndNormalizePresetProductBridging({
    visual_engine: { target_clips_count: 5 },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'visual_only_placement',
      vo_product_mention: 'cta_only',
      bridge_at_clip: 1,
      bridge_duration_clips: 0,
      bridge_segments: [{ at_clip: 1, duration_clips: 0, role: 'intro' }]
    }
  });
  assert.equal(presetCheck.error, null);
  assert.equal(presetCheck.product_bridging.bridging_mode, 'visual_only_placement');
  assert.equal(presetCheck.product_bridging.vo_product_mention, 'cta_only');
  assert.equal(presetCheck.product_bridging.bridge_at_clip, 1);
  assert.equal(presetCheck.product_bridging.bridge_duration_clips, 0);
});

test('buildMultiplierStartFrameRequest attaches product reference_images across every clip in visual_only_placement mode', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vop-test-'));
  const uploadsDir = path.join(tmpDir, 'public', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const relPath = '/uploads/test_vop_ref.png';
  fs.writeFileSync(path.join(tmpDir, 'public', 'uploads', 'test_vop_ref.png'), pngBytes);

  try {
    const bridging = {
      isBridgingActive: true,
      bridging_mode: 'visual_only_placement',
      vo_product_mention: 'none',
      targetProductId: 'prod_ref_99',
      productRefImagePath: relPath
    };
    const product = {
      id: 'prod_ref_99',
      product_name: 'Thermos Stainless 750ml',
      clean_photo_url: relPath
    };

    for (const clipIndex of [1, 2, 3, 4]) {
      const req = buildMultiplierStartFrameRequest({
        task: { id: 'task_vop_1', target_product_id: 'prod_ref_99' },
        clipIndex,
        prompt: 'Hands pour hot coffee on a wooden kitchen counter beside a matte flask.',
        product,
        bridging,
        aesthetics: { targetClipsCount: 4, aspectRatio: '9:16', visualStyle: 'UGC' },
        cwd: tmpDir
      });
      assert.equal(req.isBridgeClip, true, `Clip ${clipIndex} must remain a bridge/product-locked clip`);
      assert.equal(req.providerRequest.reference_images?.length, 1, `Clip ${clipIndex} must include reference image`);
      assert.equal(req.providerRequest.expected_reference_sha256s?.length, 1, `Clip ${clipIndex} must enforce reference sha256`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
