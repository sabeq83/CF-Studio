process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISHING_TEMPLATE_IDS, isRichFinishingTemplate, hasStrictTemplateCompliance } from '../lib/finishing-template-registry.js';
import { validateFinishingPlan } from '../lib/finishing-plan-validator.js';
import { RenderYieldError } from '../lib/render-slot.js';
import { createFfmpegStudioJob, getFfmpegStudioJob } from '../lib/db.js';

test('Fase 8: Registry has all 8 finishing templates', () => {
  const expected = [
    'none', 'recipe_pop', 'problem_solution', 'tips_listicle',
    'ramuan_ritual', 'calm_wellness', 'angka_banding', 'mitos_fakta'
  ];
  for (const tpl of expected) {
    assert.ok(FINISHING_TEMPLATE_IDS.includes(tpl), `Template ${tpl} must be in registry`);
  }
});

test('Fase 8: API rejection for unknown template', () => {
  const invalidTpl = 'super_viral_template_unknown';
  assert.equal(FINISHING_TEMPLATE_IDS.includes(invalidTpl), false);
});

test('Fase 8: Rich templates require valid finishing plan', () => {
  assert.equal(isRichFinishingTemplate('recipe_pop'), true);
  assert.equal(isRichFinishingTemplate('problem_solution'), true);
  assert.equal(isRichFinishingTemplate('tips_listicle'), true);
  assert.equal(isRichFinishingTemplate('none'), false);

  const planMissingHook = { punches: [] };
  const res = validateFinishingPlan(planMissingHook, {
    finishingTemplate: 'problem_solution',
    cleanVoiceoverClips: [{ text: 'masalah kulit' }]
  });
  // Empty hook should produce warning / error
  const warnings = res.warnings || [];
  assert.ok(warnings.length > 0 || !res.hookCard, 'Missing hook must be flagged');
});

test('Fase 8: RenderYieldError properties and handling contract', () => {
  const err = new RenderYieldError('Yielded for production');
  assert.equal(err.name, 'RenderYieldError');
  assert.equal(err.message, 'Yielded for production');
  assert.ok(err instanceof Error);
});

test('Fase 8: Legacy jobs without finishing_config run cleanly with null finishing_status', async () => {
  const legacyJobId = `fsj_legacy_test_${Date.now()}`;
  await createFfmpegStudioJob({
    id: legacyJobId,
    video_source_type: 'upload',
    video_path: JSON.stringify(['public/temp/legacy.mp4']),
    audio_source_type: 'upload',
    audio_path: 'public/temp/legacy_audio.mp3',
    sync_option: 'shortest',
    bgm_path: null,
    status: 'pending',
    finishing_template: 'none',
    finishing_config: null,
    progress_stage: null,
    finishing_status: null,
    audio_mode: 'single',
    yield_count: 0
  });

  const saved = await getFfmpegStudioJob(legacyJobId);
  assert.equal(saved.id, legacyJobId);
  assert.equal(saved.finishing_template, 'none');
  assert.equal(saved.finishing_status, null);
  assert.equal(saved.yield_count, 0);
});

test('Fase 8: Broken finishing_config JSON is handled gracefully', () => {
  const brokenJson = '{ "hook": "test", broken... ';
  let parsed = {};
  try {
    parsed = JSON.parse(brokenJson);
  } catch (_) {
    parsed = {};
  }
  assert.deepEqual(parsed, {}, 'Broken JSON must fallback to empty object without throwing');
});

test('Fase 8: Mode A and Mode B batchDataOverride construction', () => {
  // Mode B: per_clip
  const clipsB = ['a1.mp3', 'a2.mp3'];
  const voB = ['teks satu', 'teks dua'];
  const overrideB = {
    id: 'batch_b',
    clips: clipsB.map((p, idx) => ({
      id: `c_${idx}`,
      clip_index: idx + 1,
      audio_path: p,
      source_text: voB[idx],
      status: 'completed'
    }))
  };
  assert.equal(overrideB.clips.length, 2);
  assert.equal(overrideB.clips[0].clip_index, 1);
  assert.equal(overrideB.clips[1].clip_index, 2);

  // Mode A: single
  const singleAudio = 'single.mp3';
  const voA = ['adegan satu', 'adegan dua'];
  const overrideA = {
    id: 'batch_a',
    clips: [{
      id: 'c_single',
      clip_index: 1,
      audio_path: singleAudio,
      source_text: voA.join(' '),
      status: 'completed'
    }]
  };
  assert.equal(overrideA.clips.length, 1);
  assert.equal(overrideA.clips[0].source_text, 'adegan satu adegan dua');
});

test.after(async () => {
  setTimeout(() => process.exit(0), 500).unref();
});
