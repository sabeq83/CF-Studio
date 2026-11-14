import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { menuKeyMap, navItems, PLANNING_SECTION_HREFS } from '../lib/sidebar-nav.js';
import { buildReferenceAssetPrompt } from '../lib/reference-asset-prompt-builder.js';
import { extractProviderImageUrl } from '../lib/reference-asset-service.js';
import {
  requiresFacelessAttestation,
  validateApprovalAttestation
} from '../lib/reference-asset-contract.js';
import {
  extractClipCharacterIds,
  hasStylizedUniverseLink,
  resolveClipReferenceImagesAsync
} from '../lib/cartoon-reference-resolver.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { resolveAngleBeatsForClips } from '../lib/angle-visual-formats.js';

test('Part A: Sidebar nav restores Universe Manager and renames Multiplier Labs', () => {
  assert.equal(menuKeyMap['/settings/universes'], 'universe_manager');
  assert.ok(PLANNING_SECTION_HREFS.includes('/settings/universes'));

  const multiplierItem = navItems.find(i => i.href === '/multiplier-lab');
  assert.ok(multiplierItem, 'Multiplier Labs item should exist');
  assert.equal(multiplierItem.label, 'Multiplier Labs');
  assert.equal(navItems.some(i => i.label === 'Multiple Labs'), false);

  const viIndex = navItems.findIndex(i => i.href === '/settings/visual-identities');
  const uniIndex = navItems.findIndex(i => i.href === '/settings/universes');
  assert.ok(viIndex >= 0 && uniIndex === viIndex + 1, 'Universe Manager must follow Visual Identity');
  assert.equal(navItems[uniIndex].label, 'Universe Manager');
  assert.equal(navItems[uniIndex].icon, '🏰');
});

test('Part B1-B5: buildReferenceAssetPrompt handles stylized VI (config_json & config) cleanly', () => {
  const kawanRumahVI = {
    id: 'vi_mwfzpljm_bf15cfe9',
    config_json: {
      subject: {
        kind: 'stylized_3d_character',
        demographic_key: 'custom',
        custom_description: 'Indonesian kitchen companion characters'
      },
      visual_language: {
        primary_style: 'stylized_3d_character'
      },
      guardrails: {
        face_visibility: 'allowed'
      }
    }
  };

  const result = buildReferenceAssetPrompt({
    ownerType: 'visual_identity',
    owner: kawanRumahVI,
    visualIdentity: kawanRumahVI,
    role: 'character_sheet',
    customInstruction: 'warm smile and expressive visible eyes on three kitchen buddies'
  });

  assert.equal(result.is_human, false);
  assert.doesNotMatch(result.prompt, /graceful Muslimah/i);
  assert.doesNotMatch(result.prompt, /faceless/i);
  assert.doesNotMatch(result.prompt, /hands gestures closeups/i);
  assert.doesNotMatch(result.prompt, /=>|function\s*\(/i);
  assert.match(result.prompt, /expressive cartoon face/i);
  assert.match(result.prompt, /plain warm cream background, no text, no labels, no humans, no hands/i);
  assert.match(result.prompt, /warm smile/i);
  assert.doesNotMatch(result.negative_prompt, /visible face|eyes|nose|mouth/i);
});

test('Part B: character depiction_mode=normal does NOT trigger faceless human rules, whereas human hands_only still does', () => {
  const siWajan = buildReferenceAssetPrompt({
    ownerType: 'character',
    owner: {
      name: 'Si Wajan',
      depiction_mode: 'normal',
      canonical_prompt: 'Stylized 3D non-stick wok mascot with cute big cartoon eyes'
    },
    role: 'character_sheet',
    customInstruction: 'bright expressive smile in front, three-quarter, side, and back view'
  });

  assert.equal(siWajan.is_human, false);
  assert.doesNotMatch(siWajan.prompt, /faceless/i);
  assert.doesNotMatch(siWajan.prompt, /hands gestures closeups/i);
  assert.match(siWajan.prompt, /bright expressive smile/i);
  assert.match(siWajan.prompt, /plain warm cream background, no text, no labels, no humans, no hands/i);
  assert.doesNotMatch(siWajan.negative_prompt, /visible face/i);

  const humanVi = buildReferenceAssetPrompt({
    ownerType: 'visual_identity',
    owner: { id: 'vi_human' },
    visualIdentity: {
      config_json: {
        subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
        visual_language: { primary_style: 'cinematic_realistic' },
        guardrails: { face_visibility: 'prohibited' }
      }
    },
    role: 'character_sheet',
    customInstruction: 'please show face with warm smile'
  });

  assert.equal(humanVi.is_human, true);
  assert.match(humanVi.prompt, /faceless character sheet layout/i);
  assert.match(humanVi.prompt, /hands only/i);
  assert.doesNotMatch(humanVi.prompt, /show face|smile/i);
  assert.match(humanVi.negative_prompt, /visible face/i);
});

test('Part D1-D4: extractClipCharacterIds, resolveClipReferenceImagesAsync (with remote server), lineup priority & max_3d_clips bypass', async (t) => {
  const pngBuf = Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    Buffer.alloc(64, 1)
  ]);
  const makeJpg = (fillByte) => Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(64, fillByte),
    Buffer.from([0xff, 0xd9])
  ]);

  const srv = http.createServer((req, res) => {
    const map = {
      '/wajan.jpg': ['image/jpeg', makeJpg(2)],
      '/sponge.jpg': ['image/jpeg', makeJpg(3)],
      '/sapu.jpg': ['image/jpeg', makeJpg(4)],
      '/fourth.jpg': ['image/jpeg', makeJpg(5)],
      '/lineup.png': ['image/png', pngBuf]
    };
    const hit = map[req.url];
    if (!hit) {
      res.writeHead(404);
      res.end('nope');
      return;
    }
    res.writeHead(200, { 'Content-Type': hit[0] });
    res.end(hit[1]);
  });
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  t.after(() => srv.close());
  const baseUrl = `http://127.0.0.1:${srv.address().port}`;

  // 1. Stylized + Universe resolves voice_segments & lineup as lowest-priority style/scale ref
  const viSnapshot = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'vi_mwfzpljm_bf15cfe9' },
    structured: {
      subject: {
        kind: 'stylized_3d_character',
        universe_profile_id: 'univ_kr_1',
        universe_slug: 'kawan-rumah',
        character_keys: ['si_wajan', 'sponge', 'sapu']
      },
      visual_language: { primary_style: 'stylized_3d_character' },
      style_limits: { max_3d_clips: 1 }
    },
    reference_assets: [
      { owner_type: 'visual_identity', role: 'character_sheet', status: 'approved', public_path: `${baseUrl}/lineup.png` }
    ]
  };
  const universeSnapshot = {
    manifest: {
      universe_profile: 'kawan-rumah',
      characters: {
        si_wajan: { display_name: 'Si Wajan', identity_reference_path: `${baseUrl}/wajan.jpg` },
        sponge: { display_name: 'Sponge', character_sheet_reference_path: `${baseUrl}/sponge.jpg` },
        sapu: { display_name: 'Sapu', identity_reference_path: `${baseUrl}/sapu.jpg` },
        extra_4th: { display_name: 'Keempat', identity_reference_path: `${baseUrl}/fourth.jpg` }
      }
    }
  };

  const linkInfo = hasStylizedUniverseLink({
    campaign: { content_world: 'general' },
    visualIdentitySnapshot: viSnapshot
  });
  assert.equal(linkInfo.shouldResolveReferences, true);
  assert.equal(linkInfo.universeProfileId, 'univ_kr_1');
  assert.equal(linkInfo.universeSlug, 'kawan-rumah');

  // Extract from voice_segments when planEntry.characters is empty
  const clipCharsFromVo = extractClipCharacterIds({
    planEntry: {
      clip_index: 2,
      voice_segments: [
        { character_id: 'sponge', text: 'Aduh!' },
        { character_id: 'si_wajan', text: 'Tenang!' }
      ]
    }
  });
  assert.deepEqual(clipCharsFromVo, ['sponge', 'si_wajan']);

  const resolvedClip2 = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    universeProfile: 'kawan-rumah',
    universeProfileId: 'univ_kr_1',
    universeSnapshot,
    visualIdentitySnapshot: viSnapshot,
    clip: 2,
    clipCharacters: clipCharsFromVo
  });
  assert.deepEqual(resolvedClip2.characterKeysResolved, ['sponge', 'si_wajan']);
  assert.equal(resolvedClip2.characterReferences.length, 2);
  assert.equal(resolvedClip2.lineupReferences.length, 1);
  assert.equal(resolvedClip2.styleReferences.length, 1);
  assert.equal(resolvedClip2.allReferences.length, 3);
  assert.ok(resolvedClip2.allReferences[2].startsWith('data:image/png;base64,'), 'Lineup ref must be lowest priority at tail');

  // Fallback to si_wajan when clip has no characters/voice_segments/mentions
  const resolvedEmpty = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    universeProfile: 'kawan-rumah',
    universeSnapshot,
    visualIdentitySnapshot: viSnapshot,
    clip: 1,
    promptText: 'Warm empty kitchen counter at morning',
    clipCharacters: []
  });
  assert.deepEqual(resolvedEmpty.characterKeysResolved, ['si_wajan']);
  assert.equal(resolvedEmpty.characterReferences.length, 1);
  assert.equal(resolvedEmpty.allReferences.length, 2);

  // Max 3 character refs cap when 4 characters requested
  const resolvedCapped = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    universeProfile: 'kawan-rumah',
    universeSnapshot,
    visualIdentitySnapshot: viSnapshot,
    clip: 3,
    clipCharacters: ['si_wajan', 'sponge', 'sapu', 'extra_4th']
  });
  assert.equal(resolvedCapped.characterKeysResolved.length, 3);
  assert.equal(resolvedCapped.characterReferences.length, 3);
  assert.equal(resolvedCapped.allReferences.length, 4);

  // 2. Stylized WITHOUT Universe -> shouldResolveReferences = false (v2.48.6 behavior)
  const noUniverseVi = {
    structured: {
      subject: { kind: 'stylized_3d_character', universe_profile_id: null, universe_slug: null },
      visual_language: { primary_style: 'stylized_3d_character' }
    }
  };
  assert.equal(hasStylizedUniverseLink({ campaign: { content_world: 'general' }, visualIdentitySnapshot: noUniverseVi }).shouldResolveReferences, false);
  const resolvedNoUniv = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    visualIdentitySnapshot: noUniverseVi,
    clip: 1,
    clipCharacters: ['si_wajan']
  });
  assert.equal(resolvedNoUniv.allReferences.length, 0);

  // 3. Legacy cartoon_universe continues to resolve characters & product reveal timing
  const resolvedPaw = await resolveClipReferenceImagesAsync({
    contentWorld: 'cartoon_universe',
    universeProfile: 'kawan-rumah',
    universeSnapshot,
    clip: 5,
    clipCharacters: ['si_wajan'],
    productRevealBeat: 'beat_5',
    productReference: `${baseUrl}/fourth.jpg`
  });
  assert.equal(resolvedPaw.characterReferences.length, 1);
  assert.equal(resolvedPaw.productReferences.length, 1);
  assert.equal(resolvedPaw.allReferences.length, 2);

  // 4. Herbal / DapurBotani faceless path remains untouched
  const herbalVi = validateAndNormalizeVisualIdentity({
    label: 'DapurBotani',
    subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
    visual_language: { primary_style: 'cinematic_realistic', supporting_styles: ['3d_bio_cellular'] },
    style_limits: { max_3d_clips: 1 }
  });
  assert.equal(hasStylizedUniverseLink({ campaign: { content_world: 'real_world' }, visualIdentitySnapshot: { structured: herbalVi } }).shouldResolveReferences, false);
  const resolvedHerbal = await resolveClipReferenceImagesAsync({
    contentWorld: 'real_world',
    visualIdentitySnapshot: { structured: herbalVi },
    clip: 1,
    clipCharacters: ['si_wajan'],
    productReference: `${baseUrl}/fourth.jpg`
  });
  assert.equal(resolvedHerbal.characterReferences.length, 0);
  assert.equal(resolvedHerbal.productReferences.length, 1);

  // 5. style_limits.max_3d_clips = 1 must NOT limit 5 clips of stylized_3d_character
  const sectionText = buildVisualIdentityPromptSection(viSnapshot, 5);
  assert.doesNotMatch(sectionText, /Maksimal 1 klip 3D/i);
  assert.match(sectionText, /stylized_3d_character/);

  const anglePlan = resolveAngleBeatsForClips('mechanism_education', 5, {
    primaryStyle: 'stylized_3d_character',
    supportingStyles: ['stylized_3d_character', '3d_bio_cellular'],
    styleLimits: { max_3d_clips: 1 }
  });
  assert.equal(anglePlan.clips.length, 5);
  for (const clipBeat of anglePlan.clips) {
    assert.equal(clipBeat.visualMode, 'stylized_3d_character');
  }

  // 6. extractProviderImageUrl handles G-Labs .results array with full HTTP URLs cleanly
  const fullUrl = extractProviderImageUrl(
    { status: 'completed' },
    { results: ['http://100.64.70.61:8765/api/files/20261114_test.jpg'] },
    '8a97a38e',
    () => 'SHOULD_NOT_BE_CALLED'
  );
  assert.equal(fullUrl, 'http://100.64.70.61:8765/api/files/20261114_test.jpg');

  const relUrl = extractProviderImageUrl(
    { status: 'completed', files: ['frame_01.png'] },
    {},
    'task_rel',
    (file, id) => `http://host/api/files/${id}/${file}`
  );
  assert.equal(relUrl, 'http://host/api/files/task_rel/frame_01.png');
});

test('Approval routes await Next.js 16 params and attestation skips stylized/mascot subjects', () => {
  const dynamicRoutes = [
    'app/api/v2/reference-assets/[id]/approve/route.js',
    'app/api/v2/reference-assets/[id]/reject/route.js',
    'app/api/v2/reference-assets/[id]/status/route.js',
    'app/api/v2/reference-assets/[id]/route.js'
  ];

  for (const relPath of dynamicRoutes) {
    const src = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.match(src, /await\s+params/, `${relPath} must await params`);
    assert.doesNotMatch(src, /\bparams\.id\b/, `${relPath} must not access params.id synchronously`);
  }

  // Stylized mascot character sheet should NOT require faceless human attestation
  const mascotAsset = { owner_type: 'character', asset_role: 'character_sheet', metadata_json: {} };
  const mascotContext = {
    owner: { depiction_mode: 'normal' },
    universe: { universe_type: 'mascot_object' }
  };
  assert.equal(requiresFacelessAttestation(mascotAsset, mascotContext), false);
  assert.doesNotThrow(() => validateApprovalAttestation(mascotAsset, false, mascotContext));

  // Stylized 3D Visual Identity character sheet should NOT require faceless human attestation
  const stylizedViAsset = { owner_type: 'visual_identity', asset_role: 'character_sheet', metadata_json: {} };
  const stylizedViContext = {
    viConfig: {
      subject: { kind: 'stylized_3d_character', universe_slug: 'kawan-rumah' },
      visual_language: { primary_style: 'stylized_3d_character' }
    }
  };
  assert.equal(requiresFacelessAttestation(stylizedViAsset, stylizedViContext), false);
  assert.doesNotThrow(() => validateApprovalAttestation(stylizedViAsset, false, stylizedViContext));

  // Human faceless character / VI still requires attestation
  const humanViAsset = { owner_type: 'visual_identity', asset_role: 'character_sheet', metadata_json: {} };
  const humanViContext = {
    viConfig: {
      subject: { kind: 'human', faceless_mode: 'hands_only' },
      visual_language: { primary_style: 'cinematic_realistic' }
    }
  };
  assert.equal(requiresFacelessAttestation(humanViAsset, humanViContext), true);
  assert.throws(() => validateApprovalAttestation(humanViAsset, false, humanViContext), /Faceless compliance attestation/);
  assert.doesNotThrow(() => validateApprovalAttestation(humanViAsset, true, humanViContext));
});

test('Autonomous pipeline preserves preset VI, operator_preset_key, and audio segment flags', async () => {
  const { buildPresetHydratedGlobalFields } = await import('../lib/operator-presets.js');
  const fields = buildPresetHydratedGlobalFields({
    effectivePresetKey: 'kawan_rumah_3d_dialog',
    executionMode: 'creative_review',
    overrides: {},
    presetConfig: {
      basic_strategy: {
        enable_audio_segment: true,
        sfx_setting: 'without_sfx',
        enable_vo_audit: 1,
        nextcloud_parent_folder: '/MAKNA_Assets/KawanRumah'
      },
      workflow: {
        approval_mode: 'storyboard',
        enable_glabs: true,
        scheduler_pause_at: 'visuals'
      }
    }
  });

  assert.equal(fields.operator_preset_key, 'kawan_rumah_3d_dialog');
  assert.equal(fields.preset_key, 'kawan_rumah_3d_dialog');
  assert.equal(fields.enable_audio_segment, 1);
  assert.equal(fields.enable_glabs, 1);
  assert.equal(fields.approval_mode, 'storyboard');
  assert.equal(fields.scheduler_pause_at, 'visuals');
  assert.equal(fields.enable_vo_audit, 1);

  const routeSource = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/v2/recipes/autonomous-pipeline/route.js'),
    'utf8'
  );
  assert.equal(routeSource.includes('visual_identity_preset_id: body.visual_identity_preset_id || null'), false);
});

test('Stylized 3D VI keeps all 5 clips stylized_3d_character even with legacy mode_routing', () => {
  const promptText = buildVisualIdentityPromptSection({
    structured: {
      label: 'Kawan Rumah',
      subject: {
        kind: 'stylized_3d_character',
        universe_slug: 'kawan-rumah',
        face_visibility: 'allowed'
      },
      visual_language: {
        primary_style: 'stylized_3d_character',
        supporting_styles: ['isometric_society', 'commercial_product_cinematic']
      },
      mode_routing: {
        hook: 'stylized_3d_character',
        context: 'stylized_3d_character',
        mechanism: 'isometric_society',
        evidence_reveal: 'commercial_product_cinematic',
        conclusion: 'stylized_3d_character'
      }
    }
  }, 5);
  assert.ok(promptText.includes('Mode Visual: "stylized_3d_character"'));
  assert.equal(promptText.includes('Mode Visual: "commercial_product_cinematic"'), false);
  assert.equal(promptText.includes('Mode Visual: "isometric_society"'), false);
});

