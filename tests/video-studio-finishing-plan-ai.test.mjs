process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFinishingPlanPromptJson,
  validateFinishingPlan
} from '../lib/finishing-plan-validator.js';
import { FINISHING_TEMPLATE_IDS, hasStrictTemplateCompliance } from '../lib/finishing-template-registry.js';

test('Fase 7: buildFinishingPlanPromptJson covers all 8 rich templates', () => {
  for (const tplId of FINISHING_TEMPLATE_IDS) {
    if (tplId === 'none') continue;
    const snippet = buildFinishingPlanPromptJson(tplId);
    assert.ok(typeof snippet === 'string');
    assert.ok(snippet.includes('finishing_plan'));
    assert.ok(snippet.includes('hook'));
  }
});

test('Fase 7: validateFinishingPlan rejects herbal medical claims in hook', () => {
  const badPlan = {
    hook: 'Obat Menyembuhkan Diabetes & Kanker'
  };
  const res = validateFinishingPlan(badPlan, {
    finishingTemplate: 'ramuan_ritual',
    strictClaims: true,
    isHerbalProduct: true,
    cleanVoiceoverClips: [{ text: 'ramuan herbal alami' }]
  });

  const errors = (res.warnings || []).filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));
  assert.ok(errors.length > 0, 'Must produce violation error for illegal claim');
});

test('Fase 7: validateFinishingPlan accepts compliant plan for problem_solution', () => {
  const goodPlan = {
    hook: 'Solusi Kulit Kusam',
    punches: [
      { clip_index: 0, phrase: 'kulit kusam', type: 'problem' },
      { clip_index: 1, phrase: 'hidrasi aktif', type: 'solution' }
    ],
    chapters: [
      { clip_index: 0, phase: 'problem', line: 'kulit kusam' },
      { clip_index: 1, phase: 'solution', line: 'hidrasi aktif' }
    ]
  };

  const res = validateFinishingPlan(goodPlan, {
    finishingTemplate: 'problem_solution',
    strictClaims: false,
    isHerbalProduct: false,
    cleanVoiceoverClips: [
      { text: 'Mengapa kulit kusam sering terjadi di siang hari' },
      { text: 'Gunakan hidrasi aktif untuk hasil maksimal' }
    ]
  });

  const errors = (res.warnings || []).filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));
  assert.equal(errors.length, 0, 'Valid plan must not produce fatal errors');
});

test('Fase 7: validateFinishingPlan accepts compliant plan for recipe_pop', () => {
  const goodRecipePlan = {
    hook: 'Resep Sarapan Praktis',
    punches: [
      { clip_index: 0, phrase: 'sarapan praktis', type: 'hook' }
    ]
  };

  const res = validateFinishingPlan(goodRecipePlan, {
    finishingTemplate: 'recipe_pop',
    strictClaims: false,
    isHerbalProduct: false,
    cleanVoiceoverClips: [
      { text: 'Yuk bikin sarapan praktis dalam 5 menit' }
    ]
  });

  const errors = (res.warnings || []).filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));
  assert.equal(errors.length, 0);
});

test.after(async () => {
  setTimeout(() => process.exit(0), 500).unref();
});
