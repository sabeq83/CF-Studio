process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';

import { isStylizedCharacterVisualConfig } from '../lib/visual-identity-contract.js';
import { resolveVisualOverrides } from '../lib/visual-override-resolver.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { inspectStartFrameFile, evaluateBatchStartFramesQc } from '../lib/start-frame-visual-qc.js';

const KAWAN_RUMAH_VI = {
  schema_version: 'visual_identity_snapshot_v1',
  schema_mode: 'identity_card',
  subject: {
    kind: 'stylized_3d_character',
    face_visibility: 'allowed',
    universe_slug: 'kawan_rumah',
    custom_description: 'Pixar-style stylized 3D anthropomorphic household objects (Si Wajan cast-iron skillet, Sapu broom, Kulkas fridge, Sponge) with expressive big cartoon eyes and lively mouths'
  },
  wardrobe: {
    preset_key: 'not_applicable'
  },
  visual_language: {
    primary_style: 'stylized_3d_character'
  },
  environment: {
    policy: 'cozy_home',
    custom_description: 'warm stylized 3D Pixar Indonesian kitchen and living space'
  },
  guardrails: {
    face_visibility: 'allowed'
  }
};

const KAWAN_RUMAH_CAST = {
  characters: [
    { id: 'si_wajan', name: 'Si Wajan', minimax_voice_id: 'Indonesian_energetic_streamer_vv2' },
    { id: 'sapu', name: 'Bang Sapu', minimax_voice_id: 'Indonesian_crisp_reporter_vv2' },
    { id: 'kulkas', name: 'Om Kulkas', minimax_voice_id: 'Indonesian_compelling_storyteller_vv2' },
    { id: 'sponge', name: 'Dek Sponge', minimax_voice_id: 'Indonesian_intellectual_commentator_vv2' }
  ]
};

test('D0 Stylized 3D: isStylizedCharacterVisualConfig detects Schema V2 3D character configs and ignores faceless human', () => {
  assert.equal(isStylizedCharacterVisualConfig({ visualOverrides: KAWAN_RUMAH_VI }), true);
  assert.equal(isStylizedCharacterVisualConfig({
    campaign: {
      face_visibility: 'cartoon_face',
      visual_overrides_json: JSON.stringify(KAWAN_RUMAH_VI)
    }
  }), true);
  assert.equal(isStylizedCharacterVisualConfig({
    campaign: {
      face_visibility: 'Faceless',
      visual_overrides_json: JSON.stringify({
        schema_mode: 'identity_card',
        subject: { kind: 'human' },
        visual_language: { primary_style: 'cinematic_realistic' },
        guardrails: { face_visibility: 'strictly_faceless' }
      })
    }
  }), false);
});

test('D0 Stylized 3D: resolveVisualOverrides & buildVisualIdentityPromptSection avoid faceless/modest-clothing contamination', () => {
  const resolved = resolveVisualOverrides({ visualOverrides: KAWAN_RUMAH_VI });
  assert.equal(resolved.legacy.character_concept, 'stylized_3d');
  assert.match(resolved.resolved.wardrobe_prompt, /no human clothing/i);
  assert.doesNotMatch(resolved.resolved.wardrobe_prompt, /modest clothing|linen blouse/i);

  const viSection = buildVisualIdentityPromptSection(KAWAN_RUMAH_VI, 5);
  assert.doesNotMatch(viSection, /NO human face|strictly faceless|wrists covered|modest clothing/i);
});

test('D0 Stylized 3D: buildOrganicPillarPrompt enables multi-voice dialog for DB string enable_audio_segment="1" and suppresses Scene Director POV hands', () => {
  const prompt = buildOrganicPillarPrompt(
    [],
    {
      id: 'opc_d0_test',
      campaign_name: 'Uji D-0 Kawan Rumah',
      visual_style: 'Cinematic',
      visual_mode: 'hybrid_lock',
      target_clips_count: 5,
      clip_duration: 8,
      enable_audio_segment: '1',
      planner_scene_director: 'on',
      is_bridging_active: 0,
      narrative_mode: 'Storytelling',
      target_language: 'id-ID',
      voice_cast_json: JSON.stringify(KAWAN_RUMAH_CAST),
      _rowPayload: {
        content_pillar: 'Curhat Barang Rumah',
        topic: 'Wajan gosong cerita capek habis masak besar dan diselamatkan spons serta kulkas'
      }
    },
    null,
    { brand_name: 'Kawan Rumah' },
    KAWAN_RUMAH_VI
  );

  assert.match(prompt, /3D Stylized Animated Character Face \(Allowed\)/);
  assert.match(prompt, /MULTI-CHARACTER DIALOG MANDATE/);
  assert.match(prompt, /"voice_segments"/);
  assert.match(prompt, /si_wajan/);
  assert.doesNotMatch(prompt, /Strict chest-down POV|Authentic POV hands|floating hourglass|DILARANG KERAS menggunakan kata ganti orang pertama|Biometric Anchor|modest clothing/i);
});

test('D0 Stylized 3D: buildOpcStartFrameRequest & StartFrameQC bypass faceless human POV enforcement and negatives', async () => {
  const campaign = {
    id: 'opc_d0_test',
    visual_style: 'Cinematic',
    face_visibility: 'cartoon_face',
    aspect_ratio: '9:16',
    target_clips_count: 5,
    is_bridging_active: 0,
    visual_overrides_json: JSON.stringify(KAWAN_RUMAH_VI)
  };
  const req = await buildOpcStartFrameRequest({
    campaign,
    row: {},
    item: { id: 9999, result_json: '{}' },
    clipIndex: 1,
    prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] Pixar-style 3D animated cast-iron skillet Si Wajan talking cheerfully with wide expressive eyes in a cozy kitchen.'
  });

  assert.doesNotMatch(req.providerRequest.prompt, /Strict chest-down POV|Strict neck-down POV|modest long-sleeve/i);
  assert.doesNotMatch(req.providerRequest.negative_prompt, /eyes, nose, mouth|human face, facial features/i);
  assert.match(req.providerRequest.negative_prompt, /photorealistic human photography/i);

  const singleQc = await inspectStartFrameFile({
    imagePath: '/tmp/nonexistent.png',
    campaign,
    item: { id: 9999 },
    clipIndex: 1,
    mode: 'enforce'
  });
  assert.equal(singleQc.skipped, true);
  assert.equal(singleQc.mode, 'skipped_stylized_3d');

  const batchQc = await evaluateBatchStartFramesQc({
    clipEntries: [{ clipIndex: 1, imagePath: '/tmp/nonexistent.png' }],
    campaign,
    item: { id: 9999 },
    mode: 'enforce'
  });
  assert.equal(batchQc.skipped, true);
  assert.equal(batchQc.mode, 'skipped_stylized_3d');
});

