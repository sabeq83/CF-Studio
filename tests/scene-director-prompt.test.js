import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { getVisualStyleDefinition, getVisualStyleForSceneDirector } from '../lib/visual-language-catalog.js';
import { getSystemVisualIdentity } from '../lib/visual-identity-system-presets.js';
import { resolveVideoVariety } from '../lib/metaphor-policy.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';

const LEGACY_DPB_VI = {
  label: 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Female',
  schema_version: 'visual_identity_snapshot_v1',
  structured: {
    schema_version: '2',
    label: 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Female',
    description: 'Earthy Eastern botanical apothecary and 3D bio-cellular organ healing with modest syari female hands.',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'syari_classic',
      custom_description: 'POV close-up culinary framing focusing strictly on female hands covered in modest sleeves'
    },
    visual_language: {
      primary_style: 'culinary_cinematic',
      supporting_styles: ['cinematic_realistic', 'symbolic_surrealism', '3d_bio_cellular'],
      disabled_styles: ['cozy_claymation']
    },
    mode_routing: {
      hook: 'culinary_cinematic',
      context: 'culinary_cinematic',
      mechanism: '3d_bio_cellular',
      consequence: 'cinematic_realistic',
      evidence_reveal: 'culinary_cinematic',
      conclusion: 'culinary_cinematic'
    },
    wardrobe: {
      mode: 'fixed',
      sleeve_policy: 'wrists_covered',
      custom_description: 'Strictly uniform soft mocca loose linen sleeves'
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'Artisanal apothecary studio, rough black slate stone workstation with natural dew droplets'
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: 'Moody organic directional golden morning window light (3500K)'
    },
    rendering: {
      geometry: 'simplified_semi_realistic',
      textures: ['rough_black_slate_stone', '3d_cellular_translucency'],
      shadow_style: 'soft_ambient',
      finish: 'soft_matte'
    },
    guardrails: { face_visibility: 'prohibited' }
  }
};

const SAMPLE_PRODUCT = {
  product_name: 'Garlibee Madu Bawang Lanang',
  product_description: 'Madu mentah dan bawang lanang fermentasi minimal 3 bulan.',
  unique_selling_point: 'Praktis harian, 1 siung dan 1 sendok madu.',
  packaging_type: 'Squircle Glass Jar',
  is_in_packaging: 1,
  product_filename_declare: 'garlibee_clean.png'
};

const ROW_2055 = {
  item_id: 2055,
  content_pillar: 'Emotional Based',
  category_cep: 'Emotional Based',
  ws_matrix: 'When: Menjelang malam saat merawat diri | How Feeling: Ingin merasa tenang dan terlindungi | Why: Demi membersamai keluarga.',
  context: 'Malam hari di kamar tidur yang sunyi, Bunda merenungkan pentingnya investasi kesehatan jantung demi masa depan keluarga.',
  vfo: 'Aspirational',
  strategic_angle: 'The Minimalist',
  custom_hook: 'Lindungi masa depan keluarga lewat kesehatan jantung terbaik.',
  visual_action_guideline: 'Kamera sudut eye-level di kamar tidur. Toples di samping bingkai foto keluarga diterangi lampu tidur lembut.',
  promotion_context: 'kesehatan jantung'
};

const ROW_2053 = {
  item_id: 2053,
  content_pillar: 'Problem-Solution Based',
  category_cep: 'Problem-Solution Based',
  ws_matrix: 'When: Siang hari di sela kesibukan pekerjaan rumah | How Feeling: Merasa cepat lelah dan cemas | Why: Mencari solusi alami.',
  context: 'Saat jam istirahat siang di ruang makan, Bunda merasakan tubuh kurang bugar.',
  vfo: 'Instinctive',
  strategic_angle: 'The Intellectual Flex',
  custom_hook: 'Lelah harian teratasi, sirkulasi dan jantung pun lebih tenang.',
  visual_action_guideline: 'Close-up tangan mengambil sendok berisi madu di meja makan.',
  promotion_context: 'kesehatan jantung'
};

function makeCampaign(row, extra = {}) {
  return {
    id: 'opc_test_sd',
    campaign_name: 'DapurBotani Test',
    content_kind: 'product_campaign',
    content_pillar: row.content_pillar,
    category_cep: row.category_cep,
    ws_matrix: row.ws_matrix,
    context: row.context,
    vfo: row.vfo,
    strategic_angle: row.strategic_angle,
    custom_hook: row.custom_hook,
    visual_action_guideline: row.visual_action_guideline,
    promotion_context: row.promotion_context,
    narrative_mode: 'Storytelling',
    visual_style: 'Cinematic',
    visual_mode: 'hybrid_lock',
    target_clips_count: 6,
    bridge_at_clip: 5,
    clip_duration: 4,
    is_bridging_active: 1,
    _rowPayload: row,
    ...extra
  };
}

test('Flag planner_scene_director OFF keeps legacy prompt byte-for-byte identical', () => {
  const campBaseline = makeCampaign(ROW_2055);
  const campExplicitOff = makeCampaign(ROW_2055, { planner_scene_director: 'off' });

  const outBaseline = buildOrganicPillarPrompt([], campBaseline, SAMPLE_PRODUCT, { brand_name: 'dapurbotani', visual_signature: '3D bio-cellular CGI simulations.' }, LEGACY_DPB_VI);
  const outOff = buildOrganicPillarPrompt([], campExplicitOff, SAMPLE_PRODUCT, { brand_name: 'dapurbotani', visual_signature: '3D bio-cellular CGI simulations.' }, LEGACY_DPB_VI);

  assert.equal(outOff, outBaseline);
  assert.doesNotMatch(outOff, /SCENE DIRECTOR \(WAJIB PER KLIP/);
  assert.match(outOff, /DILARANG KERAS menyimpang dari latar setting visual identity/);
});

test('Flag planner_scene_director ON enforces hierarchy, 0 3D on Minimalist (2055), and bedroom night mood', () => {
  const campOn = makeCampaign(ROW_2055, {
    planner_scene_director: 'on',
    resolved_health_metaphor: { kit_key: 'pipes', kit: { key: 'pipes', object_world: 'clogged pipes' } },
    resolved_metaphor_policy: { active: true, lightingArc: { from: 'dark', to: 'bright' } }
  });
  const prompt = buildOrganicPillarPrompt(
    [],
    campOn,
    SAMPLE_PRODUCT,
    { brand_name: 'dapurbotani', visual_signature: '3D bio-cellular CGI simulations of dark slate' },
    LEGACY_DPB_VI
  );

  const sdIdx = prompt.indexOf('SCENE DIRECTOR (WAJIB PER KLIP');
  const brandIdx = prompt.indexOf('BRAND LOOK & VISUAL IDENTITY');
  assert.ok(sdIdx !== -1, 'Missing SCENE DIRECTOR block');
  assert.ok(brandIdx !== -1, 'Missing BRAND LOOK block');
  assert.ok(sdIdx < brandIdx, 'SCENE DIRECTOR must appear BEFORE BRAND LOOK & VISUAL IDENTITY');

  assert.doesNotMatch(prompt, /DILARANG KERAS menyimpang dari latar setting visual identity/);
  assert.doesNotMatch(prompt, /artisanal studio workspace/);
  assert.doesNotMatch(prompt, /DUAL-REALM NARRATIVE ORCHESTRATION MANDATE/);
  assert.doesNotMatch(prompt, /Mode Visual: "3d_bio_cellular"/);
  assert.match(prompt, /quiet cozy home bedroom/i);
  assert.match(prompt, /bedside|3000K/i);
  assert.match(prompt, /well-lit|no dark murky gloom/i);

  // R1: "Toples" / product placement moved strictly to bridge section, NOT in pre-bridge or clip-1 instructions
  const preBridgeLine = prompt.match(/^- Panduan Aksi Awal\s*:.*$/m)?.[0] || '';
  const clip1VisualDescLine = prompt.match(/"visual_description":.*$/m)?.[0] || '';
  assert.doesNotMatch(preBridgeLine, /toples|garlibee/i, 'R1: Panduan Aksi Awal must not leak product mention');
  assert.doesNotMatch(clip1VisualDescLine, /toples|garlibee/i, 'R1: Clip 1 visual_description instruction must not ask for product');
  assert.match(prompt, /Panduan Aksi Bridge \(KHUSUS Klip 5\+/);

  // R6: Clean newline before closing ======== delimiter
  assert.doesNotMatch(prompt, /[^\n]========================================================================/);
});

test('Flag planner_scene_director ON allows max 1 3D clip on Intellectual Flex (2053) and uses dining room midday', () => {
  const campOn = makeCampaign(ROW_2053, { planner_scene_director: 'on' });
  const prompt = buildOrganicPillarPrompt([], campOn, SAMPLE_PRODUCT, { brand_name: 'dapurbotani' }, LEGACY_DPB_VI);

  const match3dCount = (prompt.match(/\| Mode: 3d_bio_cellular/g) || []).length;
  assert.ok(match3dCount <= 1, `Expected at most 1 3D clip in plan, got ${match3dCount}`);
  assert.match(prompt, /Indonesian home dining room table/i);
  assert.match(prompt, /midday/i);
});

test('Catalog getVisualStyleForSceneDirector strips hardcoded location terms when stripLocation=true while keeping catalog default intact', () => {
  const raw = getVisualStyleDefinition('culinary_cinematic');
  const stripped = getVisualStyleForSceneDirector('culinary_cinematic', { stripLocation: true });
  assert.match(raw.description, /kitchen/i);
  assert.doesNotMatch(stripped.description, /kitchen/i);
  assert.doesNotMatch(stripped.prompt, /kitchen/i);

  const rawComm = getVisualStyleDefinition('commercial_product_cinematic');
  const strippedComm = getVisualStyleForSceneDirector('commercial_product_cinematic', { stripLocation: true });
  assert.match(rawComm.description, /workspace/i);
  assert.doesNotMatch(strippedComm.description, /workspace/i);
});

test('K6 Brand Identity Cards v3 validate cleanly, enforce talent sleeve rules, and rotate palette per item', () => {
  const dpb = getSystemVisualIdentity('dapurbotani_identity_v3');
  const ss = getSystemVisualIdentity('siasatsehat_identity_v3');
  const nb = getSystemVisualIdentity('nutriblend_identity_v3');

  assert.ok(dpb && ss && nb);
  assert.equal(dpb.config.schema_mode, 'identity_card');
  assert.equal(dpb.config.environment.policy, 'planner_driven');
  assert.equal(dpb.config.wardrobe.sleeve_policy, 'wrists_covered');

  assert.equal(ss.config.subject.demographic_key, 'southeast_asian_male');
  assert.equal(ss.config.wardrobe.sleeve_policy, 'forearms_exposed');
  assert.ok(ss.config.wardrobe.palette.length >= 4);

  assert.equal(nb.config.wardrobe.sleeve_policy, 'wrists_covered');
  assert.ok(nb.config.wardrobe.palette.includes('Pastel Mint'));

  const v1 = resolveVideoVariety('item-101', { paletteEntries: ss.config.wardrobe.palette, sleevePolicy: ss.config.wardrobe.sleeve_policy });
  const v2 = resolveVideoVariety('item-102', { paletteEntries: ss.config.wardrobe.palette, sleevePolicy: ss.config.wardrobe.sleeve_policy });
  const vSame = resolveVideoVariety('item-101', { paletteEntries: ss.config.wardrobe.palette, sleevePolicy: ss.config.wardrobe.sleeve_policy });
  assert.equal(v1.wardrobeColorKey, vSame.wardrobeColorKey);
  assert.match(v1.wardrobeDesc, /rolled-to-elbow|long-sleeve/i);
  assert.notEqual(`${v1.wardrobeColorKey}:${v1.cameraAngleKey}`, `${v2.wardrobeColorKey}:${v2.cameraAngleKey}`);

  const section = buildVisualIdentityPromptSection(dpb.config, 6, {
    sceneDirector: { active: true, angleName: 'The Caregiver', bridgeAtClip: 5, wardrobeDesc: v1.wardrobeDesc }
  });
  assert.match(section, /BRAND LOOK & VISUAL IDENTITY/);
  assert.match(section, /FALLBACK LOKASI BRAND/);
  assert.doesNotMatch(section, /DILARANG KERAS menyimpang/);
});
