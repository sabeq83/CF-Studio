import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

import { buildDynamicStoryCurveGuideline } from '../lib/kb/dynamic-story-curve.js';
import { resolveBridgePlan } from '../lib/bridging/bridge-plan.js';
import { buildBridgeZoningContract } from '../lib/bridging/bridge-prompt-zones.js';
import {
  buildReverseEngineeringPrompt,
  buildReverseEngineeringBridgePrompt,
  buildOrganicPillarPrompt,
  buildMultiplierPhase2Prompt
} from '../lib/prompts.js';
import {
  getSystemVisualIdentity,
  listSystemVisualIdentities
} from '../lib/visual-identity-system-presets.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { resolveMetaphorPolicy } from '../lib/metaphor-policy.js';
import {
  deriveQcContext,
  evaluateQcChecklistVerdict
} from '../lib/start-frame-visual-qc.js';
import {
  getOperatorPresetConfig,
  resolveOperatorPreset,
  buildPresetHydratedGlobalFields
} from '../lib/operator-presets.js';

const SHOP_PRODUCT = {
  id: 'prod_shopee_1',
  product_name: 'Tas Selempang Kanvas Mini',
  product_description: 'Tas selempang ringkas bahan kanvas tebal tahan percikan air',
  unique_selling_point: 'Muat HP + dompet, jahitan bartack rapi, tali adjustable',
  packaging_type: 'Parcel Box / Pouch',
  is_in_packaging: 1,
  t2i_prompt: 'Structured mini canvas sling bag in warm khaki with matte metal buckle',
  i2v_action_prompt: 'Gentle handheld showcase showing smooth zipper and sturdy canvas weave'
};

test('2-clip Direct Showcase story curve and zoning avoid KLIP 2 SAMPAI 1 and pre-bridge contradictions', () => {
  const plan = resolveBridgePlan({
    targetClips: 2,
    isBridgingActive: true,
    bridgeAtClip: 1,
    bridgeDurationClips: 2
  });

  assert.deepEqual(plan.productClips, [1, 2]);
  assert.equal(plan.zoneOf(1), 'intro');
  assert.equal(plan.zoneOf(2), 'intro');

  const curve = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 2,
    bridgeAtClip: 1,
    bridgeDurationClips: 2,
    bridgePlan: plan,
    narrativeMode: 'Direct_Showcase'
  });
  assert.match(curve, /DIRECT SHOWCASE/i);
  assert.doesNotMatch(curve, /KLIP 2 SAMPAI 1/i);
  assert.doesNotMatch(curve, /Total adegan di tengah: 0 klip/i);

  const curveNonDirect = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 2,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    bridgePlan: resolveBridgePlan({ targetClips: 2, isBridgingActive: true, bridgeAtClip: 2, bridgeDurationClips: 1 }),
    narrativeMode: 'Storytelling'
  });
  assert.doesNotMatch(curveNonDirect, /KLIP 2 SAMPAI 1/i);

  const zoneContract = buildBridgeZoningContract(plan, {
    mode: 'multiplier',
    productName: SHOP_PRODUCT.product_name,
    productUsp: SHOP_PRODUCT.unique_selling_point,
    mandatoryOutroLine: 'Cek keranjang sekarang ya!'
  });
  assert.doesNotMatch(zoneContract, /ZONA PRE-BRIDGING/);
  assert.doesNotMatch(zoneContract, /menjawab konteks klip sebelumnya/);
  assert.match(zoneContract, /Direct Showcase/i);
});

test('Prompt builders (Pillar, RE Bridge, Multiplier Phase 2) have zero pre-bridge prohibitions when bridgeAtClip=1 & targetClips=2', () => {
  const unboxingPreset = getSystemVisualIdentity('shopee_unboxing_pov_hands');
  assert.ok(unboxingPreset);

  const pillarPrompt = buildOrganicPillarPrompt(
    [],
    {
      id: 'opc_shopee_test',
      campaign_name: 'Shopee 2 Klip Unboxing',
      content_pillar: 'Unboxing Produk',
      narrative_mode: 'Direct_Showcase',
      visual_mode: 'hybrid_lock',
      target_clips_count: 2,
      clip_duration: 4,
      is_bridging_active: 1,
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      bridge_segments: [{ at_clip: 1, duration_clips: 2, role: 'intro' }],
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay'
    },
    SHOP_PRODUCT,
    { brand_name: 'ShopeeShowcase' },
    { schema_version: 'visual_identity_snapshot_v1', structured: unboxingPreset.config, ...unboxingPreset.config }
  );

  assert.doesNotMatch(pillarPrompt, /PADA KLIP 1 s\/d 1 \(PRE-BRIDGING\)/);
  assert.doesNotMatch(pillarPrompt, /DILARANG MEMPERKENALKAN PRODUK.*SEBELUM KLIP 1/);
  assert.doesNotMatch(pillarPrompt, /KLIP 2 SAMPAI 1/);
  assert.doesNotMatch(pillarPrompt, /PADA KLIP DI LUAR RENTANG TERSEBUT/);

  const rePrompt = buildReverseEngineeringPrompt([], {
    target_clips_count: 2,
    bridge_at_clip: 1,
    bridge_duration_clips: 2,
    narrative_mode: 'Direct_Showcase',
    visual_mode: 'hybrid_lock'
  });
  assert.match(rePrompt, /Direct_Showcase/);
  assert.doesNotMatch(rePrompt, /KLIP 2 SAMPAI 1/);

  const reBridgePrompt = buildReverseEngineeringBridgePrompt([], {
    target_clips_count: 2,
    bridge_at_clip: 1,
    bridge_duration_clips: 2,
    narrative_mode: 'Direct_Showcase',
    visual_mode: 'hybrid_lock',
    product_data: SHOP_PRODUCT
  });
  assert.doesNotMatch(reBridgePrompt, /Klip 1 hingga Klip 0/);
  assert.doesNotMatch(reBridgePrompt, /PADA KLIP DI LUAR RENTANG TERSEBUT/);
  assert.match(reBridgePrompt, /INSTANT SHOWCASE \/ DIRECT REVEAL/);

  const multiplierPrompt = buildMultiplierPhase2Prompt(
    [{ clip: 1, narration: 'Hook', visual: 'Open box' }, { clip: 2, narration: 'Close', visual: 'Show bag' }],
    SHOP_PRODUCT,
    {
      target_clips_count: 2,
      clip_duration: 4,
      visual_mode: 'hybrid_lock',
      narrative_mode: 'Direct_Showcase'
    },
    {
      is_bridging_active: true,
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      bridge_segments: [{ at_clip: 1, duration_clips: 2, role: 'intro' }],
      productFilenameDeclare: 'tas_kanvas.jpg'
    },
    {
      isVsoActive: true,
      structured: unboxingPreset.config
    },
    {
      audio_engine_mode: 'minimax_tts',
      enable_tts: true,
      enable_glabs: true,
      enable_ffmpeg: true
    }
  );
  assert.doesNotMatch(multiplierPrompt, /KLIP 2 SAMPAI 1/);
  assert.doesNotMatch(multiplierPrompt, /Untuk klip di luar rentang produk/);
  assert.doesNotMatch(multiplierPrompt, /Klip 1 s\/d 0/);
  assert.doesNotMatch(multiplierPrompt, /strictly no product shown/);
});

test('System Visual Identities shopee_unboxing_pov_hands and shopee_tryon_faceless_fit normalize cleanly', () => {
  const list = listSystemVisualIdentities();
  const keys = list.map(v => v.key);
  assert.ok(keys.includes('shopee_unboxing_pov_hands'));
  assert.ok(keys.includes('shopee_tryon_faceless_fit'));

  const unboxing = getSystemVisualIdentity('shopee_unboxing_pov_hands');
  const tryon = getSystemVisualIdentity('shopee_tryon_faceless_fit');

  for (const vi of [unboxing, tryon]) {
    const validated = validateAndNormalizeVisualIdentity(vi.config);
    assert.equal(validated.subject.kind, 'human');
    assert.equal(validated.metaphor_engine.enabled, false);
    assert.equal(validated.metaphor_engine.mode, 'off');
    assert.equal(validated.metaphor_engine.hands_policy, 'modest_hands_active');
    assert.equal(validated.guardrails.face_visibility, 'prohibited');
  }

  assert.equal(unboxing.config.subject.faceless_mode, 'hands_only');
  assert.equal(unboxing.config.camera.framing, 'forearms_and_hands');
  assert.equal(tryon.config.subject.faceless_mode, 'crop_below_neck');
  assert.equal(tryon.config.camera.framing, 'crop_below_neck');

  const unboxingPolicy = resolveMetaphorPolicy({
    viConfig: unboxing.config,
    isMetaphoricFaceless: false,
    sceneDirectorActive: false
  });
  assert.equal(unboxingPolicy.handsPolicy, 'modest_hands_active');
});

test('Start Frame Visual QC treats Clip 1 direct showcase hands_only and crop_below_neck as product frames', () => {
  const unboxing = getSystemVisualIdentity('shopee_unboxing_pov_hands');
  const tryon = getSystemVisualIdentity('shopee_tryon_faceless_fit');

  const ctxUnboxing = deriveQcContext({
    campaign: {
      id: 'cmp_unbox',
      target_clips_count: 2,
      is_bridging_active: 1,
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      target_product_id: SHOP_PRODUCT.id,
      product_name: SHOP_PRODUCT.product_name,
      visual_overrides_json: JSON.stringify({ structured: unboxing.config })
    },
    item: { id: 'item_unbox' },
    clipIndex: 1
  });

  assert.equal(ctxUnboxing.expectsProduct, true);
  assert.equal(ctxUnboxing.isPreBridge, false);
  assert.equal(ctxUnboxing.expectsObjectOnly, false);
  assert.equal(ctxUnboxing.handsPolicy, 'modest_hands_active');
  assert.match(ctxUnboxing.expectedWardrobeLabel, /beige|off-white/i);

  const verdictUnboxing = evaluateQcChecklistVerdict({
    hand_count: 2,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    wardrobe_color_match: true,
    pre_bridge_product: true, // model flags bottle/box — should be forgiven since expectsProduct=true
    foreign_objects: false,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.9
  }, ctxUnboxing);
  assert.equal(verdictUnboxing.pass, true);

  const ctxTryon = deriveQcContext({
    campaign: {
      id: 'cmp_tryon',
      target_clips_count: 2,
      is_bridging_active: 1,
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      target_product_id: SHOP_PRODUCT.id,
      product_name: SHOP_PRODUCT.product_name,
      visual_overrides_json: JSON.stringify({ structured: tryon.config })
    },
    item: { id: 'item_tryon' },
    clipIndex: 1
  });
  assert.equal(ctxTryon.facelessMode, 'crop_below_neck');
  assert.equal(ctxTryon.expectsObjectOnly, false);
  assert.equal(ctxTryon.handsPolicy, 'modest_hands_active');
});

test('Operator presets shopee_2clip_showcase_vo and shopee_2clip_showcase_no_vo resolve cleanly', () => {
  const voPreset = resolveOperatorPreset('shopee_2clip_showcase_vo');
  assert.equal(voPreset.basic_strategy.narrative_mode, 'Direct_Showcase');
  assert.equal(voPreset.visual_engine.target_clips_count, 2);
  assert.equal(voPreset.visual_engine.video_model, 'omni_flash');
  assert.equal(voPreset.product_bridging.bridge_at_clip, 1);
  assert.equal(voPreset.product_bridging.bridge_duration_clips, 2);

  const voFields = buildPresetHydratedGlobalFields({
    effectivePresetKey: 'shopee_2clip_showcase_vo',
    presetConfig: voPreset,
    executionMode: 'manual',
    overrides: {}
  });
  assert.equal(voFields.audio_engine_mode, 'minimax_tts');
  assert.equal(voFields.enable_tts, 1);

  const noVoPreset = resolveOperatorPreset('shopee_2clip_showcase_no_vo');
  assert.equal(noVoPreset.basic_strategy.audio_engine_mode, 'no_vo');
  assert.equal(noVoPreset.workflow.enable_tts, false);
  assert.equal(noVoPreset.visual_engine.target_clips_count, 2);

  const noVoFields = buildPresetHydratedGlobalFields({
    effectivePresetKey: 'shopee_2clip_showcase_no_vo',
    presetConfig: noVoPreset,
    executionMode: 'full_autopilot',
    overrides: {}
  });
  assert.equal(noVoFields.audio_engine_mode, 'no_vo');
  assert.equal(noVoFields.enable_tts, 0);
  assert.equal(noVoFields.no_vo_audio_bed, 'native_sfx_ambience');
});
