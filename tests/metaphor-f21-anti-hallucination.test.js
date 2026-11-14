process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import {
  METAPHOR_WORLD_KITS,
  getKit,
  resolveProductForm,
  renderReactionBeat,
  buildMetaphorWorldKitSection
} from '../lib/metaphor-world-kits.js';
import {
  resolveMetaphorPolicy,
  resolveVideoVariety,
  MODEST_WARDROBE_ROTATION,
  METAPHOR_CAMERA_ANGLES
} from '../lib/metaphor-policy.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { applyPromptReplacements } from '../lib/scheduler-processors.js';
import { resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { sanitizeImagePrompt } from '../lib/webhook-client.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

const garlibeeProduct = {
  id: 'pe_garlibee_test',
  product_name: 'Garlibee Madu Bawang Lanang',
  product_description: 'Madu murni dengan bawang tunggal lanang terfermentasi alami dalam jar kaca squircle',
  unique_selling_point: 'Pendamping pola makan seimbang harian',
  packaging_type: 'Jar Kaca (Squircle Glass Jar)',
  product_truth: 'Squircle glass jar containing viscous dark amber honey and fermented single-clove solo garlic bulbs',
  geometric_truth: 'Faceted squircle glass jar with matte gold lid',
  t2i_prompt: 'Squircle glass jar with dark amber honey and fermented garlic',
  i2v_action_prompt: 'Spoon lifting viscous dark honey with solo garlic clove'
};

const powderProduct = {
  id: 'prod_powder',
  product_name: 'Serbuk Temulawak Instan',
  product_description: 'Minuman serbuk herbal tradisional siap seduh',
  packaging_type: 'Pouch Serbuk 200g'
};

const capsuleProduct = {
  id: 'prod_capsule',
  product_name: 'Kapsul Ekstrak Kunyit',
  product_description: 'Suplemen kapsul herbal ekstrak kunyit',
  packaging_type: 'Botol 60 Kapsul'
};

function makeTestVi({ allSwitchesOn = true, compactPrompts = false } = {}) {
  const structured = validateAndNormalizeVisualIdentity({
    identity_key: 'dapurbotani_metaphor_world_test',
    label: 'DapurBotani Metaphor World Test',
    visual_language: {
      primary_style: 'commercial_product_cinematic',
      supporting_styles: ['cinematic_realistic', 'symbolic_surrealism']
    },
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      custom_description: 'POV hands actively manipulating botanicals on the tabletop with culinary precision'
    },
    wardrobe: {
      custom_description: 'Loose sage-linen modest tunic sleeves covered to wrists',
      sleeve_policy: 'wrists_covered'
    },
    environment: {
      custom_description: 'Dark apothecary wooden slate kitchen counter',
      policy: allSwitchesOn ? 'metaphor_driven' : 'brand_locked'
    },
    lighting: {
      custom_description: 'Moody organic directional golden morning window light (3500K)'
    },
    metaphor_engine: {
      enabled: true,
      hands_policy: allSwitchesOn ? 'modest_hands_active' : 'zero_hands',
      product_entry: allSwitchesOn ? 'inside_metaphor' : 'after_bridge',
      lighting_arc: allSwitchesOn ? 'kit' : 'none',
      compact_prompts: compactPrompts
    }
  });
  return {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { identity_key: structured.identity_key },
    structured,
    resolved: {
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'linen_sage',
      lighting_style: 'golden_hour',
      environment_prompt: structured.environment.primary_setting
    }
  };
}

test('Part A: sanitizeImagePrompt tidak meninggalkan fragmen ", jar, or packaging)" & active policy memakai positive framing', async () => {
  const cleaned = sanitizeImagePrompt(
    '(VERTICAL 9:16) Close macro view, (Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging), glass bowl.'
  );
  assert.ok(!/jar/i.test(cleaned), `Cleaned prompt still contains orphan jar fragment: ${cleaned}`);
  assert.ok(!/packaging/i.test(cleaned), `Cleaned prompt still contains orphan packaging fragment: ${cleaned}`);

  const kit = getKit('carpet_deep_clean');
  const vso = makeTestVi({ allSwitchesOn: true });
  const policy = resolveMetaphorPolicy({ viConfig: vso.structured, isMetaphoricFaceless: true, kit });

  const campaign = {
    id: 'camp_f21_a',
    product_id: garlibeeProduct.id,
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless',
    resolved_metaphor_policy: policy
  };

  const replacedClip1 = applyPromptReplacements(
    '(Biometric Anchor: POV culinary hands), (Wardrobe: linen outfit), (Product Truth: glass jar), (Lighting: flat 3500K)',
    1,
    { campaign, itemId: 'item_f21_1', visualOverrides: { subject_demographic: 'syari_classic', wardrobe_style: 'linen_sage', lighting_style: 'golden_hour' } }
  );
  assert.ok(!/ZERO HANDS|NO ARMS|strictly no bottle|no bare arms|no face/i.test(replacedClip1));

  const reqClip1 = await buildOpcStartFrameRequest({
    campaign,
    item: { id: 'item_f21_1', result_json: '{}' },
    clipIndex: 1,
    prompt: '(Presence Truth: hands manipulating botanicals), (Wardrobe: sage linen), dusty beige carpet fiber close-up',
    productLoader: async () => garlibeeProduct
  });
  const clip1Final = reqClip1.providerRequest.prompt;
  assert.ok(!clip1Final.includes('hands only'), `Clip 1 MUST NOT inject "hands only" camera framing! Got: ${clip1Final}`);
  assert.ok(!/ZERO HANDS|NO ARMS|strictly no bottle|no bare arms/i.test(clip1Final));
  assert.ok(clip1Final.includes('unattended') || clip1Final.includes('nobody in scene'));
  assert.ok(!clip1Final.includes('(Wardrobe:'));

  // compact_prompts optional switch works cleanly (off by default, on enables 500-800 char mandate)
  const promptNormal = buildOrganicPillarPrompt([], { ...campaign, item_id: 'item_f21_1', resolved_health_metaphor: { kit_key: kit.key, kit } }, garlibeeProduct, {}, vso);
  assert.ok(!promptNormal.includes('COMPACT PROMPT MODE (AKTIF)'));
  const vsoCompact = makeTestVi({ allSwitchesOn: true, compactPrompts: true });
  const policyCompact = resolveMetaphorPolicy({ viConfig: vsoCompact.structured, isMetaphoricFaceless: true, kit });
  const promptCompact = buildOrganicPillarPrompt([], { ...campaign, item_id: 'item_f21_1', resolved_metaphor_policy: policyCompact, resolved_health_metaphor: { kit_key: kit.key, kit } }, garlibeeProduct, {}, vsoCompact);
  assert.ok(promptCompact.includes('COMPACT PROMPT MODE (AKTIF)'));
  assert.ok(promptCompact.includes('500 hingga 800 karakter'));
});

test('Part B & F: Clip 2+ memakai 1 orang tepat 2 tangan bersarung manset, plus rotasi warna wardrobe & sudut kamera konsisten per video', async () => {
  const kit = getKit('greasy_tupperware');
  const vso = makeTestVi({ allSwitchesOn: true });
  const policy = resolveMetaphorPolicy({ viConfig: vso.structured, isMetaphoricFaceless: true, kit });
  const campaign = {
    id: 'camp_f21_bf',
    product_id: garlibeeProduct.id,
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless',
    resolved_metaphor_policy: policy
  };

  assert.equal(MODEST_WARDROBE_ROTATION.length, 6);
  assert.equal(METAPHOR_CAMERA_ANGLES.length, 4);

  const colorsSeen = new Set();
  const anglesSeen = new Set();
  for (let i = 1; i <= 12; i++) {
    const v = resolveVideoVariety(`item_batch_${i}`);
    colorsSeen.add(v.wardrobeColorKey);
    anglesSeen.add(v.cameraAngleKey);
  }
  assert.ok(colorsSeen.size >= 4, 'Per-video variety must rotate wardrobe colors across batch');
  assert.ok(anglesSeen.size >= 3, 'Per-video variety must rotate camera angles across batch');

  const varietyItem1 = resolveVideoVariety('item_999');
  const clip2Req = await buildOpcStartFrameRequest({
    campaign,
    item: { id: 'item_999', result_json: '{}' },
    clipIndex: 2,
    prompt: '(Presence Truth: generic), (Wardrobe: old outfit), orange oily plastic container under studio light',
    productLoader: async () => garlibeeProduct
  });
  const clip4Req = await buildOpcStartFrameRequest({
    campaign,
    item: { id: 'item_999', result_json: '{}' },
    clipIndex: 4,
    prompt: '(Presence Truth: generic), (Wardrobe: old outfit), clean spotless plastic container',
    productLoader: async () => garlibeeProduct
  });

  assert.ok(clip2Req.providerRequest.prompt.includes('exactly two hands visible'));
  assert.ok(clip2Req.providerRequest.prompt.includes('wrist cuffs'));
  assert.ok(clip2Req.providerRequest.prompt.includes(varietyItem1.wardrobeDesc));
  assert.ok(clip4Req.providerRequest.prompt.includes(varietyItem1.wardrobeDesc), 'All clips within 1 video share identical sleeve color');
});

test('Part C: Final Hero Clip (Clip 6) menjaga Product Reference & Product Truth saat inside_metaphor + blokir drift kuliner VI', async () => {
  const kit = getKit('carpet_deep_clean');
  const vso = makeTestVi({ allSwitchesOn: true });
  const policy = resolveMetaphorPolicy({ viConfig: vso.structured, isMetaphoricFaceless: true, kit });

  const baseCampaign = {
    id: 'camp_f21_c',
    product_id: garlibeeProduct.id,
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless'
  };

  // Active inside_metaphor: Clip 3 (bridge) & Clip 6 (Hero Finale) wajib butuh product reference; Clips 4-5 tidak wajib
  const campaignOn = { ...baseCampaign, resolved_metaphor_policy: policy };
  const req3 = resolveProductReferenceRequirement({ campaign: campaignOn, item: { new_video_plan_json: '[]' }, clipIndex: 3 });
  const req4 = resolveProductReferenceRequirement({ campaign: campaignOn, item: { new_video_plan_json: '[]' }, clipIndex: 4 });
  const req5 = resolveProductReferenceRequirement({ campaign: campaignOn, item: { new_video_plan_json: '[]' }, clipIndex: 5 });
  const req6 = resolveProductReferenceRequirement({ campaign: campaignOn, item: { new_video_plan_json: '[]' }, clipIndex: 6 });

  assert.equal(req3.required, true);
  assert.equal(req4.required, false);
  assert.equal(req5.required, false);
  assert.equal(req6.required, true);
  assert.equal(req6.reason, 'metaphor_hero_finale');

  // Flag-off / default campaign remains untouched (Clip 6 not required when bridge_duration_clips = 1)
  const req6Legacy = resolveProductReferenceRequirement({ campaign: baseCampaign, item: { new_video_plan_json: '[]' }, clipIndex: 6 });
  assert.equal(req6Legacy.required, false);

  // applyPromptReplacements preserves Product Truth on Clip 6 Hero Finale
  const replacedClip6 = applyPromptReplacements(
    '(Biometric Anchor: modest hands), (Wardrobe: sage linen), (Product Truth: Squircle glass jar with dark amber honey), (Product Reference File: \'garlibee.jpg\'), (Lighting: bright)',
    6,
    { campaign: campaignOn, itemId: 'item_hero_1', visualOverrides: { subject_demographic: 'syari_classic', wardrobe_style: 'linen_sage', lighting_style: 'golden_hour' } }
  );
  assert.ok(replacedClip6.includes('(Product Truth: Squircle glass jar with dark amber honey)'));
  assert.ok(replacedClip6.includes('garlibee.jpg'));

  // buildOrganicPillarPrompt suppresses VI subject culinary "manipulating botanicals" phrase & locks non-cooking Clips 4-5
  const pillarPrompt = buildOrganicPillarPrompt(
    [],
    { ...campaignOn, item_id: 'item_hero_1', resolved_health_metaphor: { kit_key: kit.key, kit } },
    garlibeeProduct,
    {},
    vso
  );
  assert.ok(!pillarPrompt.includes('actively manipulating botanicals on the tabletop'), 'Culinary custom_description must not bleed into active Metaphor World prompt');
  assert.ok(pillarPrompt.includes('HERO FINALE'));
  assert.ok(pillarPrompt.includes('DILARANG membelokkan adegan visual pasca-bridging'));
});

test('Part D & E: 28 kits mendukung product_form (honey_garlic/powder/capsule) tanpa placeholder tersisa + kontras lighting terjaga', () => {
  assert.equal(resolveProductForm(garlibeeProduct).form, 'honey_garlic');
  assert.equal(resolveProductForm(powderProduct).form, 'powder');
  assert.equal(resolveProductForm(capsuleProduct).form, 'capsule');

  for (const kit of METAPHOR_WORLD_KITS) {
    assert.ok(kit.beats.reaction.includes('{product_substance}'), `Kit "${kit.key}" reaction beat should parameterize {product_substance}`);
    for (const prod of [garlibeeProduct, powderProduct, capsuleProduct]) {
      const section = buildMetaphorWorldKitSection(kit, { targetClips: 6, bridgeAtClip: 3, product: prod });
      assert.ok(!section.includes('{product_substance}'), `Unresolved placeholder in kit "${kit.key}" for form "${prod.id}"`);
      const resolvedReaction = renderReactionBeat(kit.beats.reaction, prod);
      assert.ok(!resolvedReaction.includes('{product_substance}'));
    }
  }

  // Lighting arc suppresses baseline 3500K warm override in allocator
  const kitCarpet = getKit('carpet_deep_clean');
  const vso = makeTestVi({ allSwitchesOn: true });
  const policyCarpet = resolveMetaphorPolicy({ viConfig: vso.structured, isMetaphoricFaceless: true, kit: kitCarpet });
  const allocSection = buildVisualIdentityPromptSection(vso, 6, { metaphorPolicy: policyCarpet });
  assert.ok(allocSection.includes(kitCarpet.lighting_arc.from));
  assert.ok(allocSection.includes(kitCarpet.lighting_arc.to));
  assert.ok(!allocSection.includes('Moody organic directional golden morning window light (3500K)'), 'Baseline warm 3500K light must be suppressed when lighting_arc active');
});

test('F2.2-H3 & H4: Chest-down framing pada eye_level_side & three_quarter_front + solid plain wardrobe selalu disuntikkan ke Clip 4-5 meski tag awal hilang', async () => {
  const sideAngle = METAPHOR_CAMERA_ANGLES.find(a => a.key === 'eye_level_side');
  const frontAngle = METAPHOR_CAMERA_ANGLES.find(a => a.key === 'three_quarter_front');
  const overheadAngle = METAPHOR_CAMERA_ANGLES.find(a => a.key === 'overhead_top_down');
  assert.ok(sideAngle.prompt.includes('chest-down'));
  assert.ok(sideAngle.prompt.includes('below shoulders'));
  assert.ok(frontAngle.prompt.includes('chest-down'));
  assert.ok(frontAngle.prompt.includes('below shoulders'));
  assert.equal(overheadAngle.prompt, '90-degree overhead flat-lay top-down macro angle');

  for (const w of MODEST_WARDROBE_ROTATION) {
    assert.ok(w.description.includes('solid plain'), `Wardrobe ${w.key} must specify solid plain`);
    assert.ok(w.description.includes('no pattern, no print'), `Wardrobe ${w.key} must exclude patterns/prints`);
  }

  // Simulasi kasus #2136 Clips 4-5: prompt T2I awal tanpa tag (Wardrobe: ...) maupun (Presence Truth: ...)
  const kit = getKit('kitchen_drain_oil');
  const vso = makeTestVi({ allSwitchesOn: true });
  const policy = resolveMetaphorPolicy({ viConfig: vso.structured, isMetaphoricFaceless: true, kit });
  const campaign = {
    id: 'camp_f22_h4',
    product_id: garlibeeProduct.id,
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless',
    resolved_metaphor_policy: policy
  };
  const variety = resolveVideoVariety('item_2136_sim');
  const clip4Req = await buildOpcStartFrameRequest({
    campaign,
    item: { id: 'item_2136_sim', result_json: '{}' },
    clipIndex: 4,
    prompt: '(Object Anchor: clear glass bowl on pale ceramic tabletop) (Scene Context: water turns crystal clear)',
    productLoader: async () => garlibeeProduct
  });
  assert.ok(clip4Req.providerRequest.prompt.includes('chest-down'));
  assert.ok(clip4Req.providerRequest.prompt.includes(`(Wardrobe: ${variety.wardrobeDesc})`), 'Must inject solid plain wardrobe even when LLM omitted (Wardrobe: ...)');
  assert.ok(clip4Req.providerRequest.prompt.includes('Presence Truth:'), 'Must inject Presence Truth even when LLM omitted it');
});

