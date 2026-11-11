import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOGRAPHIC_PRESETS } from '../lib/prompts.js';
import { resolveVisualIdentitySnapshot } from '../lib/visual-override-resolver.js';
import { applyPromptReplacements } from '../lib/scheduler-processors.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

test('Syari Classic demographic presets structure & modularity', () => {
  assert.ok(DEMOGRAPHIC_PRESETS.syari_classic, 'syari_classic should exist');
  assert.ok(DEMOGRAPHIC_PRESETS.syari_classic_hands_only, 'syari_classic_hands_only should exist');
  assert.ok(DEMOGRAPHIC_PRESETS.syari_classic_back_view, 'syari_classic_back_view should exist');

  // Verify strict zero face directives in all presets
  assert.match(DEMOGRAPHIC_PRESETS.syari_classic, /zero facial visibility/i);
  assert.match(DEMOGRAPHIC_PRESETS.syari_classic_hands_only, /head and face 100% out of frame/i);
  assert.match(DEMOGRAPHIC_PRESETS.syari_classic_back_view, /100% zero facial features/i);
});

test('resolveVisualIdentitySnapshot specializes syari_classic based on faceless_mode', () => {
  // 1. Hands-only mode
  const snapshotHands = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'test', key: 'syari_classic_atmospheric_home', version: 1, source: 'test' },
    structured: {
      visual_language: { primary_style: 'cinematic_realistic' },
      subject: {
        kind: 'human',
        demographic_key: 'syari_classic',
        faceless_mode: 'hands_only'
      },
      wardrobe: { mode: 'fixed', preset_key: 'mocca_caramel' },
      environment: { preset_key: 'cozy_atmospheric_interior' },
      lighting: { preset_key: 'warm_ambient_rain' },
      camera: {}
    }
  };

  const resolvedHands = resolveVisualIdentitySnapshot(snapshotHands);
  assert.match(resolvedHands.resolved.subject_prompt, /head and face 100% out of frame/i);
  assert.match(resolvedHands.resolved.camera_prompt, /forearms_and_hands_cropped_below_neck/i);

  // 2. Back-view mode
  const snapshotRear = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'test', key: 'syari_classic_atmospheric_home', version: 1, source: 'test' },
    structured: {
      visual_language: { primary_style: 'cinematic_realistic' },
      subject: {
        kind: 'human',
        demographic_key: 'syari_classic',
        faceless_mode: 'back_view'
      },
      wardrobe: { mode: 'fixed', preset_key: 'mocca_caramel' },
      environment: { preset_key: 'cozy_atmospheric_interior' },
      lighting: { preset_key: 'warm_ambient_rain' },
      camera: {}
    }
  };

  const resolvedRear = resolveVisualIdentitySnapshot(snapshotRear);
  assert.match(resolvedRear.resolved.subject_prompt, /180-degree rear view/i);
  assert.match(resolvedRear.resolved.camera_prompt, /strict_180_degree_rear_view_from_behind/i);
});

test('applyPromptReplacements dynamically injects camera framing & context-aware anchor for syari_classic', () => {
  const visualOverrides = {
    subject_demographic: 'syari_classic',
    wardrobe_style: 'mocca_caramel',
    lighting_style: 'warm_ambient'
  };

  // Case A: Tabletop / Typing Scene (Clip 1)
  const rawClip1Prompt = `(VERTICAL 9:16) [LAYER 1: OPTICS] (Macro closeup, 50mm f/1.8). [LAYER 2: SUBJECT] (Biometric Anchor: [Subject Anchor]), typing on laptop. [LAYER 3: SCENE] (Environment: warm study room).`;
  const processedClip1 = applyPromptReplacements(rawClip1Prompt, 1, {
    visualOverrides,
    demographicPresets: DEMOGRAPHIC_PRESETS
  });

  assert.match(processedClip1, /\[CAMERA FRAMING: Strict neck-down POV close-up cropped tightly below chest/i);
  assert.match(processedClip1, /head and face 100% out of frame/i);
  assert.doesNotMatch(processedClip1, /180-degree rear shot/i);

  // Case B: Contemplative Window / Rear Scene (Clip 2)
  const rawClip2Prompt = `(VERTICAL 9:16) [LAYER 1: OPTICS] (Cinematic eye-level, 35mm lens). [LAYER 2: SUBJECT] (Biometric Anchor: [Subject Anchor]), menatap jendela luar malam hari yang sedang hujan sambil memegang cangkir keramik hangat. [LAYER 3: SCENE] (Environment: rain window sill).`;
  const processedClip2 = applyPromptReplacements(rawClip2Prompt, 2, {
    visualOverrides,
    demographicPresets: DEMOGRAPHIC_PRESETS
  });

  assert.match(processedClip2, /\[CAMERA FRAMING: Strict 180-degree rear shot positioned directly behind subject's back/i);
  assert.match(processedClip2, /100% zero facial features/i);
  assert.match(processedClip2, /completely facing away/i);
});

test('buildOpcStartFrameRequest enforces positive framing guard if missing in prompt', async () => {
  const mockCampaign = {
    id: 'opc_mock_test',
    aspect_ratio: '9:16',
    face_visibility: 'Faceless',
    content_world: 'live_action'
  };
  const mockItem = {
    id: 'item_mock_1',
    row_creative_payload: JSON.stringify({ face_visibility: 'Faceless' })
  };

  // Prompt without camera framing tag
  const rawPrompt = `(VERTICAL 9:16) [LAYER 1: OPTICS] (50mm lens). A person typing on laptop keyboard at wooden desk.`;
  const req = await buildOpcStartFrameRequest({
    campaign: mockCampaign,
    item: mockItem,
    clipIndex: 1,
    prompt: rawPrompt,
    productLoader: async () => null
  });

  assert.ok(req.providerRequest.prompt.startsWith('[CAMERA FRAMING:'));
  assert.match(req.providerRequest.prompt, /head and face 100% out of frame/i);
  process.exit(0);
});
