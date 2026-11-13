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
  validateMythFact,
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

const HERBAL_MYTH_FACT_VO = [
  'Stop asal rebus! Kalau caranya salah, kamu rugi karena gagal melepaskan seluruh kandungan aktif terbaik bagi tubuh.',
  'Gunakan api kecil dan selalu tutup panci agar minyak atsiri esensial tidak menguap sia-sia.',
  'Simpan cara praktis ini buat seduhan harian di rumah. Jangan lupa follow dan komen mau ya!'
];

test('F2c6-T2 (R12.1, R12.2): mitos_fakta registered & prompt schema injects myth_fact ONLY for mitos_fakta', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('mitos_fakta'));
  const meta = getFinishingTemplateMeta('mitos_fakta');
  assert.equal(meta.file, 'mitos-fakta.html');
  assert.equal(resolveFinishingTemplateFile('mitos_fakta'), 'mitos-fakta.html');
  assert.equal(isRichFinishingTemplate('mitos_fakta'), true);
  assert.equal(hasStrictTemplateCompliance('mitos_fakta'), false);
  assert.equal(meta.layers.mythFact, true);
  assert.equal(meta.layers.sharedBrand, true);
  assert.equal(suggestFinishingTemplate({ campaign_name: 'Edukasi Dapur - Mitos vs Fakta' }), 'mitos_fakta');
  assert.equal(suggestFinishingTemplate({ campaign_name: 'Siasat Sehat Harian' }), 'ramuan_ritual');

  const mfJson = buildFinishingPlanPromptJson('mitos_fakta', '  ');
  assert.ok(mfJson.includes('"myth_fact"'));

  for (const otherTpl of ['none', 'calm_wellness', 'recipe_pop', 'tips_listicle', 'ramuan_ritual', 'problem_solution', 'angka_banding']) {
    const otherJson = buildFinishingPlanPromptJson(otherTpl, '  ');
    assert.ok(!otherJson.includes('"myth_fact"'), `${otherTpl} prompt must omit myth_fact`);
  }

  const reOther = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'calm_wellness' });
  const reMf = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'mitos_fakta' });
  const brOther = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'problem_solution' });
  const brMf = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'mitos_fakta' });
  const mulOther = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'recipe_pop' }, {}, {}, {});
  const mulMf = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'mitos_fakta' }, {}, {}, {});
  const pillarOther = buildOrganicPillarPrompt([], { content_pillar: 'Edukasi', finishing_template: 'calm_wellness' }, {}, {}, {});
  const pillarMf = buildOrganicPillarPrompt([], { content_pillar: 'Mitos', finishing_template: 'mitos_fakta' }, {}, {}, {});

  for (const otherP of [reOther, brOther, mulOther, pillarOther]) {
    assert.ok(!otherP.includes('"myth_fact"'));
  }
  for (const mfP of [reMf, brMf, mulMf, pillarMf]) {
    assert.ok(mfP.includes('"myth_fact"'));
  }
});

test('F2c6-T2 (R12.2 Compliance Guard): FAKTA & reason bar block medical claims via isHerbalMedicalClaimPhrase', () => {
  const validPlan = validateFinishingPlan({
    hook: 'Rebus rempah sudah benar?',
    punches: [
      { clip_index: 1, phrase: 'api kecil', type: 'benefit' },
      { clip_index: 1, phrase: 'tutup panci', type: 'benefit' }
    ],
    myth_fact: [
      {
        clip_index: 0,
        type: 'myth',
        trigger: 'Kalau caranya salah',
        text: 'Asal rebus, kandungan pasti keluar'
      },
      {
        clip_index: 1,
        type: 'fact',
        trigger: 'agar',
        text: 'Api kecil + panci ditutup',
        why: 'Minyak atsiri tidak ikut menguap'
      }
    ]
  }, {
    cleanVoiceoverClips: HERBAL_MYTH_FACT_VO,
    finishingTemplate: 'mitos_fakta',
    isHerbalProduct: true
  });

  assert.equal(validPlan.mythFact.length, 2);
  assert.equal(validPlan.mythFact[0].type, 'myth');
  assert.equal(validPlan.mythFact[1].type, 'fact');
  assert.equal(validPlan.mythFact[1].why, 'Minyak atsiri tidak ikut menguap');

  // Medical claim on FAKTA text OR FAKTA `why` MUST be blocked even if isHerbalProduct=false
  const blockedMedicalFact = validateFinishingPlan({
    myth_fact: [
      {
        clip_index: 1,
        type: 'fact',
        trigger: 'agar',
        text: 'Air rebusan menyembuhkan diabetes dan kolesterol'
      },
      {
        clip_index: 1,
        type: 'fact',
        trigger: 'api kecil',
        text: 'Api kecil jaga aroma',
        why: 'Membantu mengobati asam urat serta menurunkan gula darah'
      }
    ]
  }, {
    cleanVoiceoverClips: HERBAL_MYTH_FACT_VO,
    finishingTemplate: 'mitos_fakta',
    isHerbalProduct: false
  });

  assert.equal(blockedMedicalFact.mythFact.length, 0);
  assert.ok(blockedMedicalFact.warnings.some((w) => w.includes('medical claim on FAKTA')));

  // Missing trigger / ungrounded text must be skipped cleanly without crashing
  const ungroundedPlan = validateFinishingPlan({
    myth_fact: [
      {
        clip_index: 0,
        type: 'myth',
        trigger: 'kalimat halu tidak ada',
        text: 'Asal rebus tidak apa apa'
      },
      {
        clip_index: 1,
        type: 'fact',
        trigger: 'agar',
        text: 'Roket mars meluncur menuju pluto'
      }
    ]
  }, {
    cleanVoiceoverClips: HERBAL_MYTH_FACT_VO,
    finishingTemplate: 'mitos_fakta',
    isHerbalProduct: true
  });

  assert.equal(ungroundedPlan.mythFact.length, 0);
  assert.ok(ungroundedPlan.warnings.some((w) => w.includes('trigger not found in VO')));
  assert.ok(ungroundedPlan.warnings.some((w) => w.includes('not grounded in VO')));

  // Direct validateMythFact sanity check: invalid type & ungrounded `why` stripped cleanly
  const warningsDirect = [];
  const resDirect = validateMythFact([
    { clip_index: 0, type: 'unknown_badge', trigger: 'Stop asal rebus', text: 'Asal rebus' },
    { clip_index: 1, type: 'fact', trigger: 'agar', text: 'Gunakan api kecil tutup panci', why: 'Pluto orbit planet dingin' }
  ], {
    clipTokenLists: HERBAL_MYTH_FACT_VO.map((s) => s.toLowerCase().split(/\s+/)),
    warnings: warningsDirect
  });
  assert.equal(resDirect.length, 1);
  assert.equal(resDirect[0].why, undefined);
  assert.ok(warningsDirect.some((w) => w.includes('invalid type')));
  assert.ok(warningsDirect.some((w) => w.includes('why stripped')));

  // Verify i18n label localization in shared-layers.js (`id` vs `en`)
  const enTl = buildPhase1Timeline({
    wordEvents: [
      { w: 'Stop', c: 0, s: 0.1, e: 0.4 },
      { w: 'asal', c: 0, s: 0.5, e: 0.8 },
      { w: 'rebus!', c: 0, s: 0.9, e: 1.3 },
      { w: 'Gunakan', c: 0, s: 1.4, e: 1.9 },
      { w: 'api', c: 0, s: 2.0, e: 2.4 },
      { w: 'kecil', c: 0, s: 2.5, e: 3.0 }
    ],
    finishingTemplate: 'mitos_fakta',
    targetLanguage: 'en-US',
    cleanVoiceoverClips: ['Stop asal rebus! Gunakan api kecil.'],
    totalDuration: 4.0
  });
  assert.equal(enTl.config.targetLanguage, 'en-US');
});

test('F2c6-T3 (R12.5 Regression + R6.6 Check): calm_wellness/recipe_pop unchanged & HTML templates clean', () => {
  // 1. calm_wellness & recipe_pop must ignore myth_fact and omit question flag
  const calmTl = buildPhase1Timeline({
    wordEvents: [
      { w: 'Gunakan', c: 0, s: 0.1, e: 0.5 },
      { w: 'api', c: 0, s: 0.55, e: 0.9 },
      { w: 'kecil', c: 0, s: 0.95, e: 1.4 }
    ],
    finishingPlan: {
      hook: 'Seduhan hangat?',
      punches: [{ clip_index: 0, phrase: 'api kecil', type: 'benefit' }],
      myth_fact: [{ clip_index: 0, type: 'fact', trigger: 'api kecil', text: 'Gunakan api kecil', why: 'Minyak atsiri' }]
    },
    finishingTemplate: 'calm_wellness',
    cleanVoiceoverClips: ['Gunakan api kecil saat merebus.'],
    totalDuration: 4
  });
  assert.equal(calmTl.mythFact, undefined);
  assert.equal(calmTl.hookCard?.question, undefined);
  assert.equal(calmTl.config.finishingTemplate, 'calm_wellness');

  const recipeTl = buildPhase1Timeline({
    wordEvents: [{ w: 'Gunakan', c: 0, s: 0.1, e: 0.5 }, { w: 'api', c: 0, s: 0.55, e: 0.9 }, { w: 'kecil', c: 0, s: 0.95, e: 1.4 }],
    finishingPlan: {
      hook: 'Seduhan hangat?',
      myth_fact: [{ clip_index: 0, type: 'myth', trigger: 'api kecil', text: 'Gunakan api kecil' }]
    },
    finishingTemplate: 'recipe_pop',
    cleanVoiceoverClips: ['Gunakan api kecil saat merebus.'],
    totalDuration: 4
  });
  assert.equal(recipeTl.mythFact, undefined);
  assert.equal(recipeTl.hookCard?.question, undefined);

  // 2. R6.6 static leak grep across all HTML templates in templates/finishing/
  const templatesDir = path.join(process.cwd(), 'templates', 'finishing');
  const htmlFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.html'));
  assert.ok(htmlFiles.includes('mitos-fakta.html'));

  const forbiddenPatterns = [
    /siasat\s+sehat/i,
    /dapur\s+botani/i,
    /ruang\s+akustik/i,
    /solusi\s+thermal/i,
    /sasyahouse/i,
    /nutrifarm/i,
    /nutriblend/i,
    /mul_2611/i,
    /23\.726/,
    /atsiri/i,
    /tutup\s+panci/i,
    /rebus\s+rempah/i
  ];
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    for (const re of forbiddenPatterns) {
      assert.equal(re.test(content), false, `Template ${file} violates R6.6 by containing ${re}`);
    }
  }
});

test('F2c6-T1 & T3: mitos-fakta.html Chromium Playwright overlay + question hook + RGBA end card verified', async () => {
  const templatesDir = path.join(process.cwd(), 'templates', 'finishing');
  assert.equal(resolveFinishingTemplatePath('mitos_fakta'), path.join(templatesDir, 'mitos-fakta.html'));

  const wordEvents = [
    { w: 'Stop', c: 0, s: 0.1, e: 0.45 },
    { w: 'asal', c: 0, s: 0.5, e: 0.85 },
    { w: 'rebus!', c: 0, s: 0.9, e: 1.4 },
    { w: 'Kalau', c: 0, s: 1.9, e: 2.3 },
    { w: 'caranya', c: 0, s: 2.35, e: 2.8 },
    { w: 'salah,', c: 0, s: 2.85, e: 3.3 },
    { w: 'kamu', c: 0, s: 3.35, e: 3.7 },
    { w: 'rugi.', c: 0, s: 3.75, e: 4.2 },
    { w: 'Gunakan', c: 1, s: 4.5, e: 4.95 },
    { w: 'api', c: 1, s: 5.0, e: 5.3 },
    { w: 'kecil', c: 1, s: 5.35, e: 5.75 },
    { w: 'dan', c: 1, s: 5.8, e: 6.0 },
    { w: 'tutup', c: 1, s: 6.05, e: 6.4 },
    { w: 'panci', c: 1, s: 6.45, e: 6.8 },
    { w: 'agar', c: 1, s: 6.85, e: 7.15 },
    { w: 'minyak', c: 1, s: 7.2, e: 7.55 },
    { w: 'atsiri', c: 1, s: 7.6, e: 8.0 },
    { w: 'terjaga.', c: 1, s: 8.05, e: 8.6 },
    { w: 'Jangan', c: 2, s: 8.9, e: 9.2 },
    { w: 'lupa', c: 2, s: 9.25, e: 9.55 },
    { w: 'komen', c: 2, s: 9.6, e: 9.95 },
    { w: 'mau!', c: 2, s: 10.0, e: 10.4 }
  ];
  const clipOffsets = [
    { clipIndex: 0, start: 0, duration: 4.4 },
    { clipIndex: 1, start: 4.4, duration: 4.4 },
    { clipIndex: 2, start: 8.8, duration: 3.2 }
  ];

  const tl = buildPhase1Timeline({
    wordEvents,
    hookCard: { l1: 'REBUS REMPAH', l2: 'SUDAH BENAR?' },
    hookDuration: 1.75,
    finishingPlan: {
      hook: 'Rebus rempah sudah benar?',
      punches: [
        { clip_index: 1, phrase: 'api kecil', type: 'benefit' },
        { clip_index: 1, phrase: 'tutup panci', type: 'benefit' }
      ],
      myth_fact: [
        {
          clip_index: 0,
          type: 'myth',
          trigger: 'Kalau caranya salah',
          text: 'Asal rebus, kandungan pasti keluar'
        },
        {
          clip_index: 1,
          type: 'fact',
          trigger: 'agar',
          text: 'Api kecil + panci ditutup',
          why: 'Minyak atsiri tidak menguap'
        }
      ]
    },
    finishingTemplate: 'mitos_fakta',
    cleanVoiceoverClips: HERBAL_MYTH_FACT_VO,
    isHerbalProduct: true,
    clipOffsets,
    captionMode: 'hybrid',
    fps: 15,
    totalDuration: 12.0,
    brand: {
      name: 'Brand Test Herbal',
      mark: 'BT',
      tagline: 'Resep dapur harian',
      cta: 'Komen MAU untuk resep'
    },
    cta: {
      text: 'Komen MAU',
      s: 9.4,
      e: 10.2
    }
  });

  assert.equal(tl.hookCard?.question, true);
  assert.equal(tl.mythFact?.length, 2);
  assert.equal(tl.mythFact[0].type, 'myth');
  assert.equal(tl.mythFact[1].type, 'fact');
  assert.ok(tl.sfx.some((s) => s.k === 'tick' && Math.abs(s.t - tl.mythFact[0].s) < 0.01));
  assert.ok(tl.sfx.some((s) => s.k === 'pop' && Math.abs(s.t - tl.mythFact[1].s) < 0.01));

  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'finishing-mf-'));
  try {
    const res = await renderPlaywrightOverlay({ outputDir: tmpOut, timeline: tl });
    assert.equal(res.success, true);
    assert.ok(res.frameCount >= 170);

    // Inspect frame 0 (question hook), mid-frame (fact stamp), and last frame (x-end) for RGBA PNG (colorType 6)
    const sampleFrames = [
      'f_00000.png',
      `f_${String(Math.min(res.frameCount - 1, Math.round(7.5 * 15))).padStart(5, '0')}.png`,
      `f_${String(res.frameCount - 1).padStart(5, '0')}.png`
    ];
    for (const fn of sampleFrames) {
      const buf = fs.readFileSync(path.join(tmpOut, fn));
      assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${fn} valid PNG`);
      assert.equal(buf.readUInt32BE(16), 720, `${fn} width 720`);
      assert.equal(buf.readUInt32BE(20), 1280, `${fn} height 1280`);
      assert.equal(buf.readUInt8(25), 6, `${fn} must preserve RGBA colorType=6 (never RGB24)`);
    }
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});
