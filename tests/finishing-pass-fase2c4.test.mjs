import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FINISHING_TEMPLATE_IDS,
  getFinishingTemplateMeta,
  resolveFinishingTemplateFile,
  isRichFinishingTemplate,
  hasStrictTemplateCompliance,
  suggestFinishingTemplate
} from '../lib/finishing-template-registry.js';
import {
  validateFinishingPlan,
  validateChapters,
  validateCallouts,
  buildFinishingPlanPromptJson
} from '../lib/finishing-plan-validator.js';
import {
  buildOrganicPillarPrompt,
  buildMultiplierPhase2Prompt,
  buildReverseEngineeringPrompt,
  buildReverseEngineeringBridgePrompt
} from '../lib/prompts.js';
import {
  resolveFinishingTemplatePath,
  buildPhase1Timeline,
  renderPlaywrightOverlay
} from '../lib/finishing-overlay-renderer.js';

test('F2c4-T2 (R12.1, R12.2): problem_solution registered & prompt schema injects chapters/callouts ONLY for problem_solution', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('problem_solution'));
  const meta = getFinishingTemplateMeta('problem_solution');
  assert.equal(meta.file, 'problem-solution.html');
  assert.equal(resolveFinishingTemplateFile('problem_solution'), 'problem-solution.html');
  assert.equal(isRichFinishingTemplate('problem_solution'), true);
  assert.equal(hasStrictTemplateCompliance('problem_solution'), false);
  assert.equal(suggestFinishingTemplate({ brand_name: 'Ruang Akustik ID', content_pillar: 'Peredam Suara' }), 'problem_solution');
  assert.ok(fs.existsSync(resolveFinishingTemplatePath('problem_solution')));

  const defaultSchema = buildFinishingPlanPromptJson('none');
  const ramuanSchema = buildFinishingPlanPromptJson('ramuan_ritual');
  const probSchema = buildFinishingPlanPromptJson('problem_solution');
  assert.equal(defaultSchema.includes('"chapters"'), false);
  assert.equal(defaultSchema.includes('"callouts"'), false);
  assert.equal(ramuanSchema.includes('"chapters"'), false);
  assert.equal(probSchema.includes('"chapters"'), true);
  assert.equal(probSchema.includes('"callouts"'), true);

  // All 4 prompt builders inject chapters + callouts ONLY when finishing_template === 'problem_solution'
  const reOther = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'calm_wellness' });
  const reProb = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'problem_solution' });
  assert.equal(reOther.includes('"chapters"'), false);
  assert.equal(reProb.includes('"chapters"'), true);
  assert.equal(reProb.includes('"callouts"'), true);

  const bridgeOther = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'ramuan_ritual' });
  const bridgeProb = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'problem_solution' });
  assert.equal(bridgeOther.includes('"chapters"'), false);
  assert.equal(bridgeProb.includes('"chapters"'), true);

  const pillarOther = buildOrganicPillarPrompt([], { content_pillar: 'Tips', finishing_template: 'tips_listicle' }, {}, {}, {});
  const pillarProb = buildOrganicPillarPrompt([], { content_pillar: 'Masalah Ruangan', finishing_template: 'problem_solution' }, {}, {}, {});
  assert.equal(pillarOther.includes('"chapters"'), false);
  assert.equal(pillarProb.includes('"chapters"'), true);

  const multOther = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'recipe_pop' }, {}, {}, {});
  const multProb = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'problem_solution' }, {}, {}, {});
  assert.equal(multOther.includes('"chapters"'), false);
  assert.equal(multProb.includes('"chapters"'), true);
});

test('F2c4-T2: validateChapters & validateCallouts validate VO grounding, localize labels & skip invalid/fabricated entries', () => {
  const clips = [
    'Suara jalan malam hari menembus lewat celah sempit bingkai kamar.',
    'Gelombang frekuensi rendah merambat lewat pori dinding yang tipis.',
    'Solusinya pasang panel rockwool padat untuk meredam getaran bising.',
    'Hasilnya ruangan terasa lebih tenang saat istirahat malam kamu.'
  ];

  const plan = validateFinishingPlan({
    hook: 'Suara Jalan Tembus Kamar?',
    punches: [
      { clip_index: 0, phrase: 'celah sempit', type: 'problem' },
      { clip_index: 3, phrase: 'lebih tenang', type: 'result' }
    ],
    chapters: [
      { clip_index: 0, phase: 'MASALAH' },
      { clip_index: 1, phase: 'PENYEBAB' },
      { clip_index: 1, phase: 'SOLUSI' }, // duplicate clip_index
      { clip_index: 9, phase: 'SOLUSI' }, // invalid clip_index
      { clip_index: 2, phase: 'FASE_NGAWUR' }, // unknown phase
      { clip_index: 2, phase: 'SOLUSI' },
      { clip_index: 3, phase: 'HASIL' }
    ],
    callouts: [
      { clip_index: 2, trigger: 'panel rockwool padat', text: 'PANEL ROCKWOOL', sub: 'Meredam getaran bising', x: 50, y: 27 }, // VALID
      { clip_index: 2, trigger: 'panel rockwool padat', text: 'BUSA AJAIB FIKTIF', sub: 'Tidak disebut VO', x: 50, y: 27 }, // SKIPPED (ungrounded)
      { clip_index: 0, trigger: 'trigger fiktif tiada', text: 'CELAH', x: 50, y: 27 } // SKIPPED (trigger missing)
    ]
  }, {
    cleanVoiceoverClips: clips,
    isHerbalProduct: false,
    finishingTemplate: 'problem_solution',
    targetLanguage: 'id-ID'
  });

  assert.equal(plan.chapters.length, 4);
  assert.deepEqual(
    plan.chapters.map((c) => ({ n: c.n, label: c.label, color: c.color })),
    [
      { n: 1, label: 'MASALAH', color: '#e5484d' },
      { n: 2, label: 'PENYEBAB', color: '#f2850d' },
      { n: 3, label: 'SOLUSI', color: '#1f9d55' },
      { n: 4, label: 'HASIL', color: '#2f7fe0' }
    ]
  );
  assert.equal(plan.callouts.length, 1);
  assert.equal(plan.callouts[0].text, 'PANEL ROCKWOOL');
  assert.equal(plan.callouts[0].clipIndex, 2);
  assert.ok(plan.warnings.some((w) => w.includes('duplicate clip_index')));
  assert.ok(plan.warnings.some((w) => w.includes('invalid clip_index')));
  assert.ok(plan.warnings.some((w) => w.includes('not grounded in clip')));
  assert.ok(plan.warnings.some((w) => w.includes('trigger not found in VO')));

  // English localization check
  const enWarnings = [];
  const enChaps = validateChapters(
    [{ clip_index: 0, phase: 'problem' }, { clip_index: 1, phase: 'solution' }],
    { clipCount: 2, targetLanguage: 'en-US', warnings: enWarnings }
  );
  assert.deepEqual(enChaps.map((c) => c.label), ['PROBLEM', 'SOLUTION']);

  // Non-problem_solution templates ignore chapters & callouts
  const otherPlan = validateFinishingPlan({
    chapters: [{ clip_index: 0, phase: 'MASALAH' }],
    callouts: [{ clip_index: 2, trigger: 'panel rockwool padat', text: 'PANEL ROCKWOOL' }]
  }, {
    cleanVoiceoverClips: clips,
    finishingTemplate: 'calm_wellness'
  });
  assert.deepEqual(otherPlan.chapters, []);
  assert.deepEqual(otherPlan.callouts, []);
});

test('F2c4-T1 & T3 (R6.6, R12.5): templates/finishing passes R6.6 grep, problem-solution.html renders Chromium PNGs & calm_wellness/recipe_pop stay intact', async () => {
  const tmplDir = path.join(process.cwd(), 'templates', 'finishing');
  const forbiddenRe = /\b(nusa|herba|kunyit|jahe|diabetes|mahkota|kolesterol|sasyahouse|malang|siasat|nutriblend|dapurbotani|ruang\s+akustik|rockwool|glasswool|solusi\s+thermal|lemak|metabolisme|detoks|ginjal|visceral)\b/i;
  for (const fileName of fs.readdirSync(tmplDir)) {
    const content = fs.readFileSync(path.join(tmplDir, fileName), 'utf8');
    assert.equal(forbiddenRe.test(content), false, `Found hardcoded brand/product term in ${fileName}`);
  }

  const clipWords = [
    ['Suara', 'jalanan', 'masuk', 'lewat', 'celah', 'sempit'],
    ['Gelombang', 'rendah', 'tembus', 'pori', 'dinding', 'tipis'],
    ['Pasang', 'lapisan', 'peredam', 'padat', 'di', 'dinding'],
    ['Kamar', 'jauh', 'lebih', 'tenang', 'konsultasi', 'sekarang']
  ];
  const wordEvents = [];
  const clipOffsets = [];
  let cursor = 0;
  for (let c = 0; c < clipWords.length; c++) {
    const start = cursor;
    for (let wi = 0; wi < clipWords[c].length; wi++) {
      const s = Number((start + 0.25 + wi * 0.42).toFixed(3));
      const e = Number((s + 0.36).toFixed(3));
      wordEvents.push({ w: clipWords[c][wi], s, e, c });
    }
    clipOffsets.push({ clipIndex: c, start, duration: 3.0 });
    cursor += 3.0;
  }

  const timeline = buildPhase1Timeline({
    wordEvents,
    finishingPlan: {
      hook: 'Bising Jalan Masuk Kamar?',
      punches: [
        { clip_index: 0, phrase: 'celah sempit', type: 'problem' },
        { clip_index: 3, phrase: 'lebih tenang', type: 'result' }
      ],
      // Omit chapters intentionally to verify auto 4-phase storyboard mapping on problem_solution!
      callouts: [
        { clip_index: 2, trigger: 'peredam padat', text: 'PEREDAM PADAT', sub: 'Serap suara dari luar', x: 50, y: 27 }
      ]
    },
    finishingTemplate: 'problem_solution',
    cleanVoiceoverClips: clipWords.map((arr) => arr.join(' ')),
    isHerbalProduct: false,
    clipOffsets,
    captionMode: 'hybrid',
    totalDuration: 12.0,
    fps: 5,
    cta: { text: 'Konsultasi gratis · cek bio', s: 8.6, e: 10.1 },
    brand: {
      name: 'Brand Contoh',
      mark: 'BC',
      color: '#0e2a33',
      tagline: 'Peredam & Solusi Ruangan',
      defaultCta: 'KONSULTASI GRATIS · LINK DI BIO',
      presenterName: 'Tim Konsultan Contoh',
      presenterRole: 'Spesialis Ruangan'
    },
    targetLanguage: 'id-ID'
  });

  assert.equal(timeline.config.finishingTemplate, 'problem_solution');
  assert.equal(timeline.chapters.length, 4);
  assert.deepEqual(timeline.chapters.map((c) => c.label), ['MASALAH', 'PENYEBAB', 'SOLUSI', 'HASIL']);
  assert.ok(timeline.chapters[0].s >= 1.8, 'Chapter 1 avoids Hook Card collision at t < 1.75s');
  assert.ok(timeline.chapters[3].e <= 10.25, 'Chapter 4 clears End Card at dur - 1.75s');
  assert.equal(timeline.callouts.length, 1);
  assert.equal(timeline.callouts[0].text, 'PEREDAM PADAT');

  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c4-prob-'));
  try {
    const res = await renderPlaywrightOverlay({ outputDir: tmpOut, timeline });
    assert.equal(res.success, true);
    assert.ok(res.frameCount >= 55);
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00001')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00035')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00055')));
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // Regression check: calm_wellness & recipe_pop stay clean without chapters/callouts
  const calm = buildPhase1Timeline({
    wordEvents: [{ w: 'Tenang', s: 1.9, e: 2.3, c: 0 }],
    finishingTemplate: 'calm_wellness',
    totalDuration: 3.2
  });
  assert.equal(calm.chapters, undefined);
  assert.equal(calm.callouts, undefined);
  assert.equal(calm.config.sharedBrand, undefined);

  const recipe = buildPhase1Timeline({
    wordEvents: [{ w: 'Aduk', s: 1.9, e: 2.3, c: 0 }],
    finishingTemplate: 'recipe_pop',
    totalDuration: 3.2
  });
  assert.equal(recipe.chapters, undefined);
  assert.equal(recipe.callouts, undefined);
  assert.equal(recipe.config.sharedBrand, undefined);
});

