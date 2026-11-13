process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutonomousPipelineAffiliateOverrides, resolveBridgePlan } from '../lib/bridging/bridge-plan.js';
import { buildDynamicStoryCurveGuideline } from '../lib/kb/dynamic-story-curve.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

const garlibeeProduct = {
  id: 'pe_1793545394035_6698',
  product_name: 'GarliBee Madu Bawang Lanang',
  product_description: 'Madu fermentasi bawang lanang murni',
  unique_selling_point: 'Kombinasi madu mentah dan bawang lanang fermentasi untuk rutinitas harian',
  packaging_type: 'Jar Kaca Heksagonal',
  is_in_packaging: 1,
  product_truth: 'Hexagonal glass jar containing golden raw honey and black fermented single-clove garlic',
  geometric_truth: 'Hexagonal clear glass jar with matte black lid',
  t2i_prompt: 'Hexagonal glass jar with amber honey',
  i2v_action_prompt: 'Gentle atmospheric pour'
};

const testVso = {
  schema_version: 'visual_identity_snapshot_v1',
  structured: {
    visual_language: { primary_style: 'syari_classic_atmospheric_home' },
    subject: { anchor_description: 'Graceful faceless hands' },
    wardrobe: { clothing_description: 'Soft earth-tone modest sleeve' },
    lighting: { mood_description: 'Warm morning window light' }
  },
  visual_language: { primary_style: 'syari_classic_atmospheric_home' }
};

test('1. Unchecking post_link_affiliate on product_campaign does NOT force is_bridging_active=false', () => {
  const productUnchecked = resolveAutonomousPipelineAffiliateOverrides(
    { post_link_affiliate: false },
    'product_campaign'
  );
  assert.deepEqual(productUnchecked, {
    post_link_affiliate: false,
    is_affiliate_enabled: false
  });
  assert.equal('is_bridging_active' in productUnchecked, false);

  const productExplicitBridgeOff = resolveAutonomousPipelineAffiliateOverrides(
    { post_link_affiliate: false, is_bridging_active: false },
    'product_campaign'
  );
  assert.equal(productExplicitBridgeOff.is_bridging_active, false);

  const editorialDefault = resolveAutonomousPipelineAffiliateOverrides({}, 'editorial_campaign');
  assert.equal(editorialDefault.post_link_affiliate, false);
  assert.equal(editorialDefault.is_bridging_active, false);

  const recipeUnchecked = resolveAutonomousPipelineAffiliateOverrides(
    { post_link_affiliate: false },
    'recipe_campaign'
  );
  assert.equal(recipeUnchecked.post_link_affiliate, false);
  assert.equal(recipeUnchecked.is_bridging_active, false);
});

test('2. Dynamic Story Curve applies multi-segment Intro & Recall rules on product_campaign without USP conflict', () => {
  const bridgePlan = resolveBridgePlan({
    targetClips: 6,
    isBridgingActive: true,
    segments: [
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 5, duration_clips: 1, role: 'recall' }
    ]
  });

  const curve = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 6,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    bridgePlan,
    language: 'id-ID'
  });

  assert.match(curve, /Titik Intro Produk \(Klip #2\)/);
  assert.match(curve, /Titik Recall Produk #2 \(Klip #5\)/);
  assert.match(curve, /HANYA klip segmen produk di atas yang menampilkan & membahas produk/);
  assert.doesNotMatch(curve, /Klip selanjutnya s\.d\. 5: Tunjukkan Unique Selling Proposition/);
});

test('3. buildOrganicPillarPrompt emits multi-segment isolation, Clip 2 & 5 T2I examples, and defaults active for product_campaign', () => {
  const prompt = buildOrganicPillarPrompt(
    [],
    {
      campaign_name: 'GarliBee Atmosfer Reveal 2x',
      campaign_type: 'product_campaign',
      content_pillar: 'Energi Pagi Tanpa Drama',
      target_clips_count: 6,
      bridge_segments: JSON.stringify([
        { at_clip: 2, duration_clips: 1, role: 'intro' },
        { at_clip: 5, duration_clips: 1, role: 'recall' }
      ]),
      visual_mode: 'hybrid_lock',
      visual_style: 'metaphoric_faceless',
      custom_hook: 'Kenapa tubuh tetap terasa berat meski tidur sudah cukup?',
      visual_action_guideline: 'Air jernih mengalir perlahan di saluran kaca',
      mandatory_outro_line: 'link pembelian aku taruh di Bio ya!'
    },
    garlibeeProduct,
    {},
    testVso
  );

  assert.match(prompt, /ATURAN PENYISIPAN PRODUK ORGANIK MULTI-SEGMEN/);
  assert.match(prompt, /ZONA INTRO PRODUK — PERKENALAN UTAMA \(Klip #2\)/);
  assert.match(prompt, /ZONA RECALL PRODUK — PENGINGAT \/ BUKTI \/ CTA \(Klip #5\)/);
  assert.match(prompt, /ZONA GAP \/ JEDA CERITA MURNI \(KLIP #3 s\.d\. KLIP #4/);
  assert.match(prompt, /"clip": 2,/);
  assert.match(prompt, /"clip": 5,/);
  assert.match(prompt, /Karena Klip 2 adalah Titik Intro Produk/);
});

test('4. resolveProductReferenceRequirement marks ONLY Clips 2 & 5 as required for GarliBee preset 2x reveal', () => {
  const campaign = {
    target_product_id: garlibeeProduct.id,
    target_clips_count: 6,
    is_bridging_active: 1,
    bridge_at_clip: 2,
    bridge_duration_clips: 1,
    bridge_segments: JSON.stringify([
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 5, duration_clips: 1, role: 'recall' }
    ])
  };
  const item = { new_video_plan_json: '[]' };

  const requiredClips = [];
  for (let clip = 1; clip <= 6; clip++) {
    const req = resolveProductReferenceRequirement({ campaign, item, clipIndex: clip });
    if (req.required) requiredClips.push(clip);
  }
  assert.deepEqual(requiredClips, [2, 5]);
});

