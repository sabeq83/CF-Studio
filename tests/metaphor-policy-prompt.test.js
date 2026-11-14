process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getKit, toLegacyMetaphorShape } from '../lib/metaphor-world-kits.js';
import {
  resolveMetaphorPolicy,
  presenceTruthTuple,
  hasAnyMetaphorPolicyOverride,
  POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE
} from '../lib/metaphor-policy.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { applyPromptReplacements } from '../lib/scheduler-processors.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

const sampleProduct = {
  id: 'prod_db_1',
  product_name: 'Kapsul Bawang Tunggal DapurBotani',
  product_description: 'Ekstrak bawang lanang fermentasi alami dalam kapsul harian',
  unique_selling_point: 'Membantu menjaga kebugaran sirkulasi harian tanpa bau menyengat',
  packaging_type: 'Botol Plastik 60 Kapsul',
  is_in_packaging: 1,
  product_truth: 'Matte dark amber apothecary bottle with cream botanical label',
  geometric_truth: 'Cylindrical PET bottle 120ml with matte black cap',
  t2i_prompt: 'Matte dark amber bottle with cream botanical label',
  i2v_action_prompt: 'Gentle modest hand presenting bottle softly'
};

function makeDapurBotaniVi({ allSwitchesOn = false } = {}) {
  const structured = validateAndNormalizeVisualIdentity({
    identity_key: allSwitchesOn ? 'dapurbotani_metaphor_world_test' : 'dapurbotani_apothecary_3d_female',
    label: allSwitchesOn ? 'DapurBotani Metaphor World Test' : 'DapurBotani 3D Bio-Cellular Apothecary',
    visual_language: {
      primary_style: 'commercial_product_cinematic',
      supporting_styles: ['cinematic_realistic', 'symbolic_surrealism', '3d_bio_cellular']
    },
    mode_routing: {
      hook: 'commercial_product_cinematic',
      mechanism: allSwitchesOn ? 'symbolic_surrealism' : '3d_bio_cellular',
      proof: 'commercial_product_cinematic'
    },
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      sleeve_policy: 'wrists_covered',
      anchor_description: 'Indonesian female hands with loose earth-toned modest sleeves'
    },
    wardrobe: {
      custom_description: 'Loose sage-linen modest tunic sleeves covered to wrists',
      material_notes: 'matte breathable cotton-linen'
    },
    environment: {
      custom_description: 'Dark matte black slate apothecary bench with antique brass mortar',
      props: ['brass_scale', 'mortar_pestle'],
      policy: allSwitchesOn ? 'metaphor_driven' : 'brand_locked'
    },
    lighting: {
      custom_description: 'Warm amber side key light with clean shadows'
    },
    metaphor_engine: {
      enabled: true,
      hands_policy: allSwitchesOn ? 'modest_hands_active' : 'zero_hands',
      product_entry: allSwitchesOn ? 'inside_metaphor' : 'after_bridge',
      lighting_arc: allSwitchesOn ? 'kit' : 'none'
    },
    guardrails: {
      negative_prompt_base: 'neon colors, bare arms, visible face'
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

test('buildOrganicPillarPrompt reflects all 4 Metaphor Policy switches + F1 kit without leaking legacy ZERO HANDS or dropping pre-bridge product ban', () => {
  const kit = getKit('grease_in_water');
  assert.ok(kit, 'grease_in_water seed kit must exist');
  const legacyMeta = toLegacyMetaphorShape(kit, { topicKey: 'kolesterol_plak', selectionMode: 'auto' });
  const vsoOn = makeDapurBotaniVi({ allSwitchesOn: true });
  const policyOn = resolveMetaphorPolicy({
    viConfig: vsoOn.structured,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit
  });

  const campaignOn = {
    campaign_name: 'DapurBotani Kolesterol Test',
    content_pillar: 'Kolesterol & Lemak Tubuh',
    target_clips_count: 6,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    is_bridging_active: 1,
    visual_style: 'metaphoric_faceless',
    narrative_mode: 'Problem-Solution',
    resolved_health_metaphor: legacyMeta,
    resolved_metaphor_policy: policyOn
  };

  const promptOn = buildOrganicPillarPrompt([], campaignOn, sampleProduct, {}, vsoOn);

  assert.match(promptOn, /Modest female hands/i);
  assert.ok(promptOn.includes(kit.environment), 'Prompt must inject kit.environment');
  assert.ok(promptOn.includes('METAPHOR WORLD KIT'), 'Prompt must inject kit beat map section');
  assert.ok(promptOn.includes(kit.lighting_arc.from), 'Prompt must inject lighting arc start');
  assert.ok(promptOn.includes(kit.lighting_arc.to), 'Prompt must inject lighting arc end');
  assert.ok(promptOn.includes('Klip 1: tetap object-only hook'), 'Clip 1 must remain object-only hook even when hands_policy=modest_hands_active');
  assert.ok(
    promptOn.includes(POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE),
    'Pre-bridge positive clean-scene framing must replace negative bottle/jar tuple'
  );

  // Check that the metaphoric mandate & tuple sections no longer emit "ABSOLUTELY ZERO HANDS"
  const metaphoricMandateIdx = promptOn.indexOf('METAPHOR WORLD MANDATE');
  assert.ok(metaphoricMandateIdx > -1, 'Should use METAPHOR WORLD MANDATE header');
  const tupleExpansionStart = promptOn.indexOf('MANDAT STRUKTUR TUPLE PROMPT VISUAL');
  const tupleExpansionEnd = promptOn.indexOf('METAPHOR WORLD MANDATE');
  const tupleSlice = promptOn.slice(tupleExpansionStart, tupleExpansionEnd);
  assert.ok(!tupleSlice.includes('ABSOLUTELY ZERO HANDS'), 'Tuple expansion for hands-active should not emit ABSOLUTELY ZERO HANDS');

  // Verify default policy keeps baseline behavior without overrides
  const vsoDefault = makeDapurBotaniVi({ allSwitchesOn: false });
  const policyOff = resolveMetaphorPolicy({
    viConfig: vsoDefault.structured,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit: null
  });
  assert.equal(hasAnyMetaphorPolicyOverride(policyOff), false);

  const baseDefaultCampaign = {
    ...campaignOn,
    resolved_health_metaphor: undefined,
    resolved_metaphor_policy: undefined
  };
  const promptBaseline = buildOrganicPillarPrompt([], baseDefaultCampaign, sampleProduct, {}, vsoDefault);
  const promptDefault = buildOrganicPillarPrompt([], {
    ...baseDefaultCampaign,
    resolved_metaphor_policy: policyOff
  }, sampleProduct, {}, vsoDefault);
  assert.equal(promptDefault, promptBaseline, 'Default policy without overrides must match baseline byte-for-byte');
  assert.ok(promptDefault.includes('OBJECT-CENTRIC METAPHOR MANDATE'));
  assert.ok(!promptDefault.includes('METAPHOR WORLD MANDATE'));
  assert.ok(promptDefault.includes('DILARANG KERAS menyimpang dari latar setting visual identity'));
});

test('buildVisualIdentityPromptSection remaps 3d_bio_cellular and unlocks metaphor_driven environment', () => {
  const kit = getKit('grease_in_water');
  const vsoOn = makeDapurBotaniVi({ allSwitchesOn: true });
  const policyOn = resolveMetaphorPolicy({
    viConfig: vsoOn.structured,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit
  });

  // Force 3d_bio_cellular in mode_routing + 3D clues to verify allocator suppression/remapping
  const vsoWith3d = structuredClone(vsoOn);
  vsoWith3d.structured.label = 'DapurBotani 3D Bio-Cellular Test';
  vsoWith3d.structured.mode_routing.mechanism = '3d_bio_cellular';

  const sectionOn = buildVisualIdentityPromptSection(vsoWith3d, 6, { metaphorPolicy: policyOn });
  assert.ok(!sectionOn.includes('Mode Visual: "3d_bio_cellular"'), '3d_bio_cellular must be remapped/suppressed when metaphorPolicy is active');
  assert.ok(!sectionOn.includes('DILARANG KERAS menyimpang dari latar setting visual identity'), 'brand environment hard lock must be removed in metaphor_driven mode');
  assert.ok(!sectionOn.includes('Properti Kunci'), 'forced brand props should be omitted in metaphor_driven mode');
  assert.ok(sectionOn.includes(kit.environment), 'metaphor_driven allocator section should reference kit environment');

  const vsoOff = makeDapurBotaniVi({ allSwitchesOn: false });
  const sectionOff = buildVisualIdentityPromptSection(vsoOff, 6);
  assert.ok(sectionOff.includes('Mode Visual: "3d_bio_cellular"'));
  assert.ok(sectionOff.includes('DILARANG KERAS menyimpang dari latar setting visual identity'));
  assert.ok(sectionOff.includes('brass_scale, mortar_pestle'));
});

test('applyPromptReplacements handles Clip 1 object-only vs Clip 2 modest hands + lighting arc', () => {
  const kit = getKit('grease_in_water');
  const vsoOn = makeDapurBotaniVi({ allSwitchesOn: true });
  const policyOn = resolveMetaphorPolicy({
    viConfig: vsoOn.structured,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit
  });

  const campaign = {
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless',
    resolved_metaphor_policy: policyOn
  };

  const baseInput = '(Biometric Anchor: generic), (Wardrobe: linen outfit), (Product Truth: amber bottle), (Lighting: flat studio light)';

  const clip1Out = applyPromptReplacements(baseInput, 1, {
    visualOverrides: { subject_demographic: 'syari_classic', wardrobe_style: 'linen_sage', lighting_style: 'golden_hour' },
    campaign,
    wardrobePresets: { linen_sage: 'Loose sage linen modest sleeves' },
    lightingPresets: { golden_hour: 'Warm golden light' }
  });
  assert.ok(clip1Out.includes('unattended standalone still-life objects only'), 'Clip 1 must remain positive object-only even when hands_policy=modest_hands_active');
  assert.ok(!clip1Out.includes('ABSOLUTELY ZERO HANDS'));
  assert.ok(!clip1Out.includes('(Wardrobe:'), 'Clip 1 object-only must strip wardrobe');
  assert.ok(clip1Out.includes(kit.lighting_arc.from), 'Clip 1 pre-bridge lighting follows arc.from');

  const clip2Out = applyPromptReplacements(baseInput, 2, {
    visualOverrides: { subject_demographic: 'syari_classic', wardrobe_style: 'linen_sage', lighting_style: 'golden_hour' },
    campaign,
    wardrobePresets: { linen_sage: 'Loose sage linen modest sleeves' },
    lightingPresets: { golden_hour: 'Warm golden light' }
  });
  assert.equal(clip2Out.includes('Modest female hands only'), true);
  assert.ok(!clip2Out.includes('ABSOLUTELY ZERO HANDS'), 'Clip 2 pre-bridge with modest_hands_active must allow modest hands');
  assert.ok(clip2Out.includes('(Wardrobe:') && clip2Out.includes('wrist cuffs'), 'Clip 2 pre-bridge must retain Wardrobe with covered wrist cuffs when modest hands active');
  assert.ok(clip2Out.includes('plain unlabelled vessels only'), 'Clip 2 pre-bridge must use positive clean-surface framing');
  assert.ok(clip2Out.includes(kit.lighting_arc.from), 'Clip 2 pre-bridge lighting follows arc.from');

  const clip6Out = applyPromptReplacements(baseInput, 6, {
    visualOverrides: { subject_demographic: 'syari_classic', wardrobe_style: 'linen_sage', lighting_style: 'golden_hour' },
    campaign,
    demographicPresets: { syari_classic_hands_only: 'Indonesian syari hands only' },
    wardrobePresets: { linen_sage: 'Loose sage linen modest sleeves' },
    lightingPresets: { golden_hour: 'Warm golden light' }
  });
  assert.ok(clip6Out.includes(kit.lighting_arc.to), 'Final post-bridge clip lighting follows arc.to');
});

test('buildOpcStartFrameRequest preserves modest hands on Clip 2+, keeps Clip 1 object-only, and works from both campaign and item.result_json (recovery/regen)', async () => {
  const kit = getKit('grease_in_water');
  const vsoOn = makeDapurBotaniVi({ allSwitchesOn: true });
  const policyOn = resolveMetaphorPolicy({
    viConfig: vsoOn.structured,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit
  });

  const baseCampaign = {
    id: 'camp_f2_1',
    product_id: 'prod_db_1',
    is_bridging_active: 1,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    target_clips_count: 6,
    visual_style: 'metaphoric_faceless'
  };

  const rawPrompt = '(Presence Truth: Modest female hands), (Wardrobe: sage linen modest sleeves), opaque oil droplet inside glass bowl and clear glass jar';
  const mockProductLoader = async () => ({ ...sampleProduct, main_image_url: '' });

  // Case 1: Initial run where policy is on campaign
  const reqClip1 = await buildOpcStartFrameRequest({
    campaign: { ...baseCampaign, resolved_metaphor_policy: policyOn },
    item: { id: 'item_1', result_json: '{}' },
    clipIndex: 1,
    prompt: rawPrompt,
    productLoader: mockProductLoader
  });
  const clip1Prompt = reqClip1.providerRequest.prompt;
  assert.ok(clip1Prompt.includes('unattended standalone still-life objects only'), 'Clip 1 start-frame prompt must stay pure positive object-only');
  assert.ok(!clip1Prompt.includes('hands only'), 'Clip 1 start-frame prompt must NEVER inject hands only');
  assert.ok(!clip1Prompt.includes('ABSOLUTELY ZERO HANDS'));
  assert.ok(!clip1Prompt.includes('(Wardrobe:'), 'Clip 1 start-frame prompt strips Wardrobe');
  assert.ok(clip1Prompt.includes('glass conduit'), 'Pre-bridge jar/bottle noun sanitization still applies');

  const reqClip2Initial = await buildOpcStartFrameRequest({
    campaign: { ...baseCampaign, resolved_metaphor_policy: policyOn },
    item: { id: 'item_1', result_json: '{}' },
    clipIndex: 2,
    prompt: rawPrompt,
    productLoader: mockProductLoader
  });
  const clip2InitialPrompt = reqClip2Initial.providerRequest.prompt;
  assert.ok(!clip2InitialPrompt.includes('ABSOLUTELY ZERO HANDS'), 'Clip 2 start-frame with modest_hands_active must NOT inject ABSOLUTELY ZERO HANDS');
  assert.ok(clip2InitialPrompt.includes('Modest female hands only') && clip2InitialPrompt.includes('exactly two hands visible'), 'Clip 2 initial keeps modest two hands');
  assert.ok(clip2InitialPrompt.includes('(Wardrobe:') && clip2InitialPrompt.includes('wrist cuffs'), 'Clip 2 start-frame keeps modest Wardrobe with visible cuffs');
  assert.ok(clip2InitialPrompt.includes('glass conduit'), 'Pre-bridge jar/bottle sanitization still applies on Clip 2');

  // Case 2: Recovery / regen run where campaign does NOT carry resolved_metaphor_policy, only item.result_json does
  const reqClip2Recovery = await buildOpcStartFrameRequest({
    campaign: baseCampaign,
    item: {
      id: 'item_1',
      result_json: JSON.stringify({ resolved_metaphor_policy: policyOn })
    },
    clipIndex: 2,
    prompt: rawPrompt,
    productLoader: mockProductLoader
  });
  const clip2RecoveryPrompt = reqClip2Recovery.providerRequest.prompt;
  assert.ok(clip2RecoveryPrompt.includes('Modest female hands only') && clip2RecoveryPrompt.includes('exactly two hands visible'), 'Recovery path reading item.result_json must keep modest hands');
  assert.ok(!clip2RecoveryPrompt.includes('ABSOLUTELY ZERO HANDS'));
});
