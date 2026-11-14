process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { SYSTEM_VISUAL_IDENTITIES } from '../lib/visual-identity-system-presets.js';
import {
  MODEST_WARDROBE_ROTATION,
  resolveMetaphorPolicy
} from '../lib/metaphor-policy.js';
import { buildSceneBrief, stripInternalVisualPromptTags } from '../lib/scene-brief.js';
import { resolveAngleFormat } from '../lib/angle-visual-formats.js';
import { analyzeCampaignDiversity } from '../lib/scene-diversity-guard.js';
import {
  buildOpcStartFrameRequest,
  buildWardrobeReferencePrompt,
  shouldAttachWardrobeReference
} from '../lib/opc-start-frame-request.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

test('K7.1: Action-verb enforcement removes silent freeze when Scene Director is active & tracks passive_pose_clips limit', () => {
  const statusSignal = resolveAngleFormat('The Status Signal');
  const hookCue = statusSignal.beats.find(b => b[0] === 'hook')?.[2] || '';
  assert.ok(!/framing tenang/i.test(hookCue), 'status_signal hook must use concrete action verb instead of Framing tenang');

  const promptOn = buildOrganicPillarPrompt(
    [],
    {
      campaign_name: 'SD Test',
      planner_scene_director: 'on',
      target_clips_count: 6,
      visual_mode: 'hybrid_lock',
      ws_matrix: 'When: Pagi hari | Where: Dapur rumah | While: Menyiapkan sarapan'
    },
    null,
    { brand_name: 'Dapur Botani' },
    null
  );
  assert.ok(promptOn.includes('KATA KERJA AKSI FISIK (WAJIB)'));
  assert.ok(!promptOn.includes('tangan diam di samping objek'));

  // Passive pose guard checks
  const diversityFail = analyzeCampaignDiversity([
    {
      id: 1,
      sceneBrief: { location_key: 'dapur', time_key: 'morning', angle_key: 'status_signal' },
      parsed: {
        storyboard: [
          { scene: 1, visual_description: 'Tangan diam di samping cangkir' },
          { scene: 2, visual_description: 'Tangan mengaduk teh dengan sendok kayu' },
          { scene: 3, visual_description: 'Tangan membuka buku catatan' },
          { scene: 4, visual_description: 'Tangan menuang air hangat' },
          { scene: 5, visual_description: 'Tangan meletakkan gelas' },
          { scene: 6, visual_description: 'Memegang secara tenang tanpa gerakan aktif' }
        ]
      }
    }
  ]);
  assert.deepEqual(diversityFail.stats.passive_pose_clips, [1, 6]);
  assert.equal(diversityFail.status, 'warning');
  assert.ok(diversityFail.warnings.some(w => w.code === 'PASSIVE_POSE_LIMIT'));
});

test('K7.2: metaphor_engine.mode = hook_only keeps presets bounded & Clips 2+ planner-driven', () => {
  const dapur = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === 'dapurbotani_identity_v3');
  const siasat = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === 'siasatsehat_identity_v3');
  const nutri = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === 'nutriblend_identity_v3');

  assert.equal(dapur.config.metaphor_engine.mode, 'hook_only');
  assert.equal(siasat.config.metaphor_engine.mode, 'hook_only');
  assert.equal(nutri.config.metaphor_engine.mode, 'off');

  const norm = validateAndNormalizeVisualIdentity(dapur.config);
  assert.equal(norm.metaphor_engine.mode, 'hook_only');

  const policy = resolveMetaphorPolicy({
    viConfig: norm,
    isMetaphoricFaceless: false,
    kit: { environment: 'abstract dark charcoal cavern', object_world: 'rusted pipe' },
    sceneDirectorActive: true
  });
  assert.equal(policy.active, true);
  assert.equal(policy.mode, 'hook_only');
  assert.equal(policy.environmentPolicy, 'planner_driven');
  assert.equal(policy.sceneEnvironment, null);

  const policyOff = resolveMetaphorPolicy({
    viConfig: nutri.config,
    isMetaphoricFaceless: false,
    sceneDirectorActive: true
  });
  assert.equal(policyOff.active, false);
  assert.equal(policyOff.mode, 'off');
});

test('K7.3 & K7.4 & K7.6: Wardrobe reference gating, chest-down framing, clean 3D, and pre-bridge kitchen jar ban', async () => {
  assert.equal(MODEST_WARDROBE_ROTATION.length, 6);
  for (const item of MODEST_WARDROBE_ROTATION) {
    assert.ok(/gamis|abaya|tunic/i.test(item.description));
  }

  const wPrompt = buildWardrobeReferencePrompt(MODEST_WARDROBE_ROTATION[0]);
  assert.ok(wPrompt.includes('below shoulders and collarbones'));
  assert.ok(!/\b(?:bottle|jar|garlibee)\b/i.test(wPrompt));

  const policyHookOnly = { active: true, mode: 'hook_only', handsPolicy: 'modest_hands_active' };
  assert.equal(shouldAttachWardrobeReference({ visualMode: 'cinematic_realistic', clipIndex: 1, policy: policyHookOnly }), false);
  assert.equal(shouldAttachWardrobeReference({ visualMode: 'cinematic_realistic', clipIndex: 2, policy: policyHookOnly }), true);
  assert.equal(shouldAttachWardrobeReference({ visualMode: '3d_bio_cellular', clipIndex: 3, policy: policyHookOnly }), false);
  assert.equal(shouldAttachWardrobeReference({ visualMode: 'symbolic_surrealism', clipIndex: 3, policy: policyHookOnly }), false);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k7-req-'));
  try {
    const publicDir = path.join(tmpDir, 'public', 'uploads', 'start_frames');
    fs.mkdirSync(publicDir, { recursive: true });
    const fakeWardrobePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(128, 0x11)]);
    const fakeProdPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(128, 0x22)]);
    fs.writeFileSync(path.join(publicDir, 'wardrobe_ref_999.png'), fakeWardrobePng);
    const prodImgPath = path.join(publicDir, 'prod_ref.png');
    fs.writeFileSync(prodImgPath, fakeProdPng);

    const campaign = {
      id: 77,
      face_visibility: 'Faceless',
      is_bridging_active: 1,
      bridge_at_clip: 4,
      bridge_duration_clips: 2,
      target_clips_count: 6,
      target_product_id: 42,
      product_ref_image_path: prodImgPath,
      resolved_metaphor_policy: policyHookOnly,
      resolved_scene_brief: {
        environment_policy: 'planner_driven',
        location_en: 'tidy Indonesian home kitchen counter',
        time_key: 'morning'
      }
    };
    const mockProductLoader = async () => ({
      id: 42,
      name: 'Garlibee',
      clean_photo_url: '/uploads/start_frames/prod_ref.png'
    });
    const item = {
      id: 999,
      new_video_plan_json: JSON.stringify([
        { clip_index: 1, visual_mode: 'cinematic_realistic' },
        { clip_index: 2, visual_mode: 'cinematic_realistic' },
        { clip_index: 3, visual_mode: '3d_bio_cellular' },
        { clip_index: 4, visual_mode: 'cinematic_realistic' }
      ]),
      result_json: JSON.stringify({
        wardrobe_reference_image: '/uploads/start_frames/wardrobe_ref_999.png',
        resolved_metaphor_policy: policyHookOnly,
        resolved_scene_brief: campaign.resolved_scene_brief
      })
    };

    // Clip 1 (hook_only object hook): NO wardrobe ref attached
    const req1 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 1,
      prompt: 'Steaming ceramic cup on kitchen counter',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(req1.audit.reference_count, 0);

    // Clip 2 (pre-bridge kitchen live-action): wardrobe ref attached, below shoulders, kitchen jar ban in negative prompt
    const req2 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 2,
      prompt: 'POV hands placing glass spice jars on wooden kitchen counter',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(req2.audit.reference_count, 1);
    assert.ok(req2.providerRequest.prompt.includes('below shoulders and collarbones'));
    assert.ok(!/glass spice jars/i.test(req2.providerRequest.prompt));
    assert.ok(req2.providerRequest.negative_prompt.includes('glass spice jars'));

    // Clip 3 (3d_bio_cellular): NO wardrobe ref, NO human torso/HUD text
    const req3 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 3,
      prompt: '3D microscopic gut villi absorption motion',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(req3.audit.reference_count, 0);
    assert.ok(req3.providerRequest.prompt.includes('3D bio-cellular'));
    assert.ok(req3.providerRequest.negative_prompt.includes('clothed human torso'));
    assert.ok(req3.providerRequest.negative_prompt.includes('HUD overlay'));

    // Clip 4 (bridge clip): Product reference stays position 0 AND wardrobe ref stays position 1
    const req4 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 4,
      prompt: 'POV hands holding authentic product on kitchen counter',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(req4.audit.requires_product_reference, true);
    assert.equal(req4.audit.product_reference_count, 1);
    assert.equal(req4.audit.reference_position, 0);
    assert.equal(req4.audit.reference_count, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('K7.5 & K7.6 & K7.8: Night curtains lock, pre-bridge kitchen jar filtering, and UI tag stripping', () => {
  const briefNight = buildSceneBrief({
    ws_matrix: 'When: Malam hari | Where: Kamar tidur utama | While: Duduk lelah sebelum tidur',
    visual_action_guideline: 'Tangan menggeser botol suplemen dan toples kaca di meja nakas -> Klip 4 memegang produk'
  }, { visual_action_guideline: '' });

  assert.equal(briefNight.time_key, 'night');
  assert.ok(briefNight.lighting_mood.includes('opaque drawn dark curtains'));
  assert.ok(briefNight.lighting_mood.includes('practical'));
  assert.ok(briefNight.situational_props.some(p => /curtain/i.test(p)));
  assert.ok(briefNight.situational_props.some(p => /lamp/i.test(p)));

  const briefKitchen = buildSceneBrief({
    ws_matrix: 'When: Pagi hari | Where: Pantry dapur rumah | While: Merapikan toples kaca bumbu dan gelas'
  }, {});
  assert.ok(!briefKitchen.location_en.includes('jar'));
  assert.ok(briefKitchen.situational_props.every(p => !/\b(?:jar|bottle|toples|botol)\b/i.test(p)));

  // K7.8 tag stripping
  const dirty = '[CAMERA FRAMING: Strict chest-down POV cropped strictly below shoulders] [LAYER 1: OPTICS] [QC REFINEMENT: tighten crop] Tangan mengaduk cangkir teh hangat di meja kayu.';
  const clean = stripInternalVisualPromptTags(dirty);
  assert.equal(clean, 'Tangan mengaduk cangkir teh hangat di meja kayu.');
});

