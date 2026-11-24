import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

import {
  SUBJECT_KINDS,
  CAMERA_FRAMINGS,
  validateAndNormalizeVisualIdentity,
  isEnvironmentObjectOnlyVisualConfig,
  isStylizedCharacterVisualConfig
} from '../lib/visual-identity-contract.js';
import { resolveVisualIdentitySnapshot } from '../lib/visual-override-resolver.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import {
  deriveQcContext,
  buildClipRuleSnippet,
  evaluateQcChecklistVerdict
} from '../lib/start-frame-visual-qc.js';
import { compileVeoAmbientOnlyPrompt } from '../lib/veo-native-audio.js';
import { normalizeAudioConfig } from '../lib/multiplier-audio-config.js';
import {
  getSystemVisualIdentity,
  listSystemVisualIdentities,
} from '../lib/visual-identity-system-presets.js';
import {
  getOperatorPresetConfig,
  buildPresetHydratedGlobalFields
} from '../lib/operator-presets.js';
import {
  buildReverseEngineeringPrompt,
  buildOrganicPillarPrompt,
  buildCustomStoryboardPromptEngineerPrompt,
  buildMultiplierPhase2Prompt
} from '../lib/prompts.js';

const ROOT = process.cwd();

test('Visual Identity contract normalizes environment_object_only cleanly', () => {
  assert.ok(SUBJECT_KINDS.includes('environment_object_only'));
  assert.ok(CAMERA_FRAMINGS.includes('interior_showcase'));
  assert.ok(CAMERA_FRAMINGS.includes('product_still_life'));
  assert.ok(CAMERA_FRAMINGS.includes('top_down_flatlay'));
  assert.ok(CAMERA_FRAMINGS.includes('before_after_frame'));

  const normalized = validateAndNormalizeVisualIdentity({
    schema_version: 'visual_identity_v2',
    name: 'Test Zero Human Living',
    subject: { kind: 'environment_object_only', character_count: 2 },
    wardrobe: { mode: 'fixed', preset_key: 'amber_terracotta', custom_description: 'terracotta robe' },
    camera: { framing: 'interior_showcase' }
  });

  assert.equal(normalized.subject.kind, 'environment_object_only');
  assert.equal(normalized.subject.faceless_mode, 'not_applicable');
  assert.equal(normalized.subject.demographic_key, 'not_applicable');
  assert.equal(normalized.subject.character_count, 0);
  assert.equal(normalized.subject.population_mode, 'none');
  assert.equal(normalized.wardrobe.mode, 'not_applicable');
  assert.equal(normalized.wardrobe.preset_key, 'not_applicable');
  assert.equal(normalized.wardrobe.custom_description, '');
  assert.equal(normalized.guardrails.human_presence, 'prohibited');
  assert.equal(normalized.guardrails.hands_visibility, 'prohibited');
  assert.equal(normalized.guardrails.intentional_crowd, 'prohibited');
  assert.equal(normalized.metaphor_engine.hands_policy, 'zero_hands');

  assert.equal(isEnvironmentObjectOnlyVisualConfig({ structured: normalized }), true);
  assert.equal(isStylizedCharacterVisualConfig({ structured: normalized }), false);
});

test('Resolver and allocator produce strict Zero-Human prompts without wardrobe locks', () => {
  const vi = getSystemVisualIdentity('home_living_serene_interior');
  assert.ok(vi);
  assert.equal(vi.config.subject.kind, 'environment_object_only');

  const resolved = resolveVisualIdentitySnapshot(vi.config);
  assert.match(resolved.resolved.subject_prompt, /zero humans|no people|no human hands/i);
  assert.equal(resolved.resolved.wardrobe_prompt, '');
  assert.match(resolved.resolved.negative_prompt, /human|hands|fingers/i);
  assert.equal(resolved.legacy.character_concept, 'environment_object_only');

  const promptSection = buildVisualIdentityPromptSection({ structured: vi.config }, 5);
  assert.match(promptSection, /ZERO-HUMAN \/ SPACE & OBJECT ONLY MANDATE/i);
  assert.doesNotMatch(promptSection, /MANDAT KONSISTENSI WARDROBE WAJIB/i);
});

test('Start Frame Visual QC rejects any human hand and skips wardrobe penalty for environment_object_only', () => {
  const vi = getSystemVisualIdentity('home_living_product_still_life');
  assert.ok(vi);
  const campaign = {
    visual_identity_preset_id: 'home_living_product_still_life',
    visual_overrides_json: JSON.stringify({ structured: vi.config })
  };

  const qcCtx = deriveQcContext({ campaign, clipIndex: 2 });
  assert.equal(qcCtx.isEnvironmentOnly, true);
  assert.equal(qcCtx.handsPolicy, 'zero_hands');

  const ruleSnippet = buildClipRuleSnippet({
    clipIndex: 2,
    expectsProduct: true,
    isEnvironmentOnly: qcCtx.isEnvironmentOnly,
    handsPolicy: qcCtx.handsPolicy
  });
  assert.match(ruleSnippet.handRule, /ZERO-HUMAN VISUAL IDENTITY/i);

  const rejectVerdict = evaluateQcChecklistVerdict(
    { hand_count: 1, visible_face: false, exposed_forearm: false, wardrobe_color_match: false, metaphor_alignment_score: 0.9 },
    { ...qcCtx, expectsProduct: true }
  );
  assert.equal(rejectVerdict.pass, false);
  assert.ok(rejectVerdict.reasons.some(r => /Zero-human|hand/i.test(r)));

  const passVerdict = evaluateQcChecklistVerdict(
    { hand_count: 0, visible_face: false, exposed_forearm: false, wardrobe_color_match: false, metaphor_alignment_score: 0.9 },
    { ...qcCtx, expectsProduct: true }
  );
  assert.equal(passVerdict.pass, true);
});

test('compileVeoAmbientOnlyPrompt and Multiplier audio config preserve No-VO bed settings', () => {
  const prompt = compileVeoAmbientOnlyPrompt({
    basePrompt: 'Slow push-in across sun-drenched oak coffee table and ceramic vase.',
    sfxCue: 'soft linen curtain rustle, gentle wooden surface creak',
    withSfx: true,
    withAmbience: true,
    antiMusic: true
  });
  assert.match(prompt, /ZERO spoken words/i);
  assert.match(prompt, /ZERO background music/i);
  assert.match(prompt, /soft linen curtain rustle/i);

  const audioCfg = normalizeAudioConfig({
    audio_engine_mode: 'no_vo',
    no_vo_audio_bed: 'bgm_only',
    on_screen_text_mode: 'off',
    ffmpeg_sfx_volume: 0.25,
    ffmpeg_bgm_volume: 0.4
  });
  assert.equal(audioCfg.audio_engine_mode, 'no_vo');
  assert.equal(audioCfg.no_vo_audio_bed, 'bgm_only');
  assert.equal(audioCfg.on_screen_text_mode, 'off');
  assert.equal(audioCfg.enableTts, false);
  assert.equal(audioCfg.ffmpegSfxVolume, 0.25);
  assert.equal(audioCfg.ffmpegBgmVolume, 0.4);
});

test('Operator preset multiplier_home_living_no_vo_asmr hydrates No-VO + Zero-Human cleanly', () => {
  const preset = getOperatorPresetConfig('multiplier_home_living_no_vo_asmr');
  assert.ok(preset);
  assert.equal(preset.workflow.audio_engine_mode, 'no_vo');
  assert.equal(preset.workflow.enable_tts, false);
  assert.equal(preset.workflow.no_vo_audio_bed, 'native_sfx_ambience');
  assert.equal(preset.visual_swap.visual_identity_preset_id, 'home_living_serene_interior');

  const hydrated = buildPresetHydratedGlobalFields({
    effectivePresetKey: 'multiplier_home_living_no_vo_asmr',
    presetConfig: preset,
    executionMode: 'full_autopilot',
    overrides: {}
  });
  assert.equal(hydrated.audio_engine_mode, 'no_vo');
  assert.equal(hydrated.no_vo_audio_bed, 'native_sfx_ambience');
  assert.equal(hydrated.on_screen_text_mode, 'short_caption_overlay');
  assert.equal(hydrated.enable_tts, 0);
  assert.equal(hydrated.enable_audio_segment, 0);
});

test('Prompt builders inject Action Translation (Zero-Human) and No-VO Storytelling instructions', () => {
  const vi = getSystemVisualIdentity('home_living_serene_interior');
  const vsoSnapshot = resolveVisualIdentitySnapshot(vi.config);

  const rePrompt = buildReverseEngineeringPrompt([], {
    target_clips_count: 4,
    visual_mode: 'hybrid_lock',
    audio_engine_mode: 'no_vo',
    no_vo_audio_bed: 'native_sfx_ambience',
    on_screen_text_mode: 'short_caption_overlay',
    visual_overrides: {
      ...vsoSnapshot,
      character_concept: 'environment_object_only',
      structured: vi.config
    }
  });
  assert.match(rePrompt, /ACTION TRANSLATION MANDATE: DECONSTRUCT -> ZERO-HUMAN/i);
  assert.match(rePrompt, /MANDAT MODE TANPA VOICEOVER/i);
  assert.match(rePrompt, /"new_vo": ""/);

  const opcPrompt = buildOrganicPillarPrompt([], {
    content_pillar: 'Penataan Kamar Tenang',
    custom_hook: '',
    visual_action_guideline: 'Sudut kamar pagi hari dengan tirai linen',
    visual_mode: 'hybrid_lock',
    audio_engine_mode: 'no_vo',
    no_vo_audio_bed: 'native_sfx_plus_bgm',
    on_screen_text_mode: 'short_caption_overlay',
    target_clips_count: 4
  }, null, { brand_name: 'HomeNest' }, {
    schema_version: 'visual_identity_snapshot_v1',
    structured: vi.config,
    ...vsoSnapshot
  });
  assert.match(opcPrompt, /ZERO-HUMAN \/ SPACE & OBJECT ONLY/i);
  assert.match(opcPrompt, /MANDAT MODE TANPA VOICEOVER/i);

  const csPrompt = buildCustomStoryboardPromptEngineerPrompt([], {
    content_pillar: 'Living Room Refresh',
    visual_mode: 'hybrid_lock',
    audio_engine_mode: 'no_vo',
    no_vo_audio_bed: 'silent',
    on_screen_text_mode: 'off'
  }, {
    title: 'Minimalist Living Corner',
    scenes: [{ scene_index: 1, visual_action: 'Slow push-in toward ceramic vase on travertine console', voiceover_text: '' }]
  }, null, { brand_name: 'HomeNest' }, {
    schema_version: 'visual_identity_snapshot_v1',
    structured: vi.config,
    ...vsoSnapshot
  });
  assert.match(csPrompt, /Mode TANPA VO aktif/i);
  assert.match(csPrompt, /Zero-Human/i);

  const mulPrompt = buildMultiplierPhase2Prompt(
    [{ scene_number: 1, visual_action: 'Hand opens wooden drawer' }],
    { is_pure_storytelling: true, product_name: '' },
    { targetClipsCount: 4, visualMode: 'hybrid_lock', visualStyle: 'Cinematic', targetLanguage: 'id-ID' },
    { isBridgingActive: false, bridging_mode: 'none', targetClipsCount: 4, visualMode: 'hybrid_lock' },
    {
      isVsoActive: true,
      characterConcept: 'environment_object_only',
      structured: vi.config,
      resolved: vsoSnapshot.resolved
    },
    {
      targetLanguage: 'id-ID',
      enable_tts: false,
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay'
    }
  );
  assert.match(mulPrompt, /ACTION TRANSLATION MANDATE: DECONSTRUCT -> ZERO-HUMAN/i);
  assert.match(mulPrompt, /"narration_transcript": ""/);
  assert.doesNotMatch(mulPrompt, /WARDROBE CONSISTENCY:/i);
});

test('Pipeline workers, scheduler, processor, and MCP schemas wire No-VO without skipping FFmpeg', () => {
  const schedSrc = fs.readFileSync(path.join(ROOT, 'lib/scheduler-processors.js'), 'utf8');
  assert.ok(schedSrc.includes("const isTtsOptionalMode = ['native_veo', 'no_vo'].includes(campaign.audio_engine_mode);"));
  assert.ok(schedSrc.includes('compileVeoAmbientOnlyPrompt'));

  const procSrc = fs.readFileSync(path.join(ROOT, 'lib/video-studio-processor.js'), 'utf8');
  assert.ok(procSrc.includes("const isNoVoMode = jobConfig.audioEngineMode === 'no_vo';"));
  assert.ok(procSrc.includes("audioEngineMode === 'no_vo'"));
  assert.ok(procSrc.includes('if (!isNativeVeoAudio && sfxVolume > 0)'));

  const cspSrc = fs.readFileSync(path.join(ROOT, 'lib/custom-storyboard-pipeline.js'), 'utf8');
  assert.ok(cspSrc.includes("audioEngineMode === 'no_vo'"));
  assert.ok(cspSrc.includes('no_vo_audio_bed'));

  const reMulSrc = fs.readFileSync(path.join(ROOT, 'lib/re-multiplier-worker.js'), 'utf8');
  assert.ok(reMulSrc.includes('compileVeoAmbientOnlyPrompt'));
  assert.ok(!reMulSrc.includes('tts_audio_path:'));
  assert.ok(!reMulSrc.includes('tts_batch_id:'));
  assert.ok(reMulSrc.includes('const maxAttempts = 60;'));
  assert.ok(reMulSrc.includes('glabs_task=${t2iResult.task_id}'));

  const dbPgSrc = fs.readFileSync(path.join(ROOT, 'lib/db-pg.js'), 'utf8');
  assert.ok(dbPgSrc.includes('ADD COLUMN IF NOT EXISTS audio_engine_mode'));
  assert.ok(dbPgSrc.includes('ADD COLUMN IF NOT EXISTS no_vo_audio_bed'));
  assert.ok(dbPgSrc.includes('ADD COLUMN IF NOT EXISTS on_screen_text_mode'));

  const homeInterior = getSystemVisualIdentity('home_living_serene_interior');
  assert.equal(homeInterior.label, 'Home & Living — Serene Interior (Zero-Human)');
  assert.equal(homeInterior.version, 1);
  const homeStillLife = getSystemVisualIdentity('home_living_product_still_life');
  assert.equal(homeStillLife.label, 'Home & Living — Product Still Life (Zero-Human)');
  assert.equal(homeStillLife.version, 1);

  for (const sysVi of listSystemVisualIdentities()) {
    assert.ok(typeof sysVi.label === 'string' && sysVi.label.trim().length > 0, `System VI ${sysVi.key} missing label`);
    assert.ok(Number(sysVi.version) >= 1, `System VI ${sysVi.key} missing version`);
  }

  const mcpSrc = fs.readFileSync(path.join(ROOT, 'apps/mcp/tools.mjs'), 'utf8');
  assert.ok(mcpSrc.includes('AUDIO_ENGINE_MODE_VALUES'));
  assert.ok(mcpSrc.includes("AUDIO_ENGINE_MODE_VALUES = ['minimax_tts', 'native_veo', 'no_vo']"));
  assert.ok(mcpSrc.includes("resolvedAudioMode !== 'no_vo'"));
});
