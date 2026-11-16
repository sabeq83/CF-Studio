process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISHING_TEMPLATE_IDS, isRichFinishingTemplate, hasStrictTemplateCompliance } from '../lib/finishing-template-registry.js';
import { validateFinishingPlan } from '../lib/finishing-plan-validator.js';
import { createFfmpegStudioJob, getFfmpegStudioJob } from '../lib/db.js';

test('Fase 2.2: Finishing template registry validation', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('none'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('recipe_pop'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('problem_solution'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('tips_listicle'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('ramuan_ritual'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('calm_wellness'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('angka_banding'));
  assert.ok(FINISHING_TEMPLATE_IDS.includes('mitos_fakta'));

  assert.equal(isRichFinishingTemplate('none'), false);
  assert.equal(isRichFinishingTemplate('recipe_pop'), true);
  assert.equal(isRichFinishingTemplate('problem_solution'), true);
  assert.equal(hasStrictTemplateCompliance('ramuan_ritual'), true);
});

test('Fase 2.2: validateFinishingPlan catches violations on rich templates', () => {
  const invalidPlan = {
    hook: 'Obat mujarab menyembuhkan segala penyakit kanker kronis'
  };
  const res = validateFinishingPlan(invalidPlan, {
    finishingTemplate: 'ramuan_ritual',
    strictClaims: true,
    isHerbalProduct: true,
    cleanVoiceoverClips: [{ text: '' }]
  });
  const claimErrors = (res.warnings || []).filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));
  assert.ok(claimErrors.length > 0, 'Must produce claim violation errors for forbidden medical claim');
});

test('Fase 2.2: createFfmpegStudioJob persists new finishing fields with safe defaults', async () => {
  const jobId = `fsj_f2_test_${Date.now()}`;
  await createFfmpegStudioJob({
    id: jobId,
    video_source_type: 'upload',
    video_path: JSON.stringify(['public/temp/test.mp4']),
    audio_source_type: 'tts_studio',
    audio_path: 'batch_dummy',
    sync_option: 'shortest',
    bgm_path: null,
    status: 'pending',
    finishing_template: 'recipe_pop',
    finishing_config: JSON.stringify({ captionMode: 'full' }),
    audio_mode: 'tts_batch'
  });

  const record = await getFfmpegStudioJob(jobId);
  assert.ok(record);
  assert.equal(record.finishing_template, 'recipe_pop');
  assert.equal(record.audio_mode, 'tts_batch');
  assert.equal(record.yield_count, 0);
  assert.ok(record.finishing_config.includes('captionMode'));
});

setTimeout(() => process.exit(0), 100).unref();

