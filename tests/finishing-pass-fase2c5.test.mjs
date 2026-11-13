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
  extractNumericValuesFromText,
  buildVerifiedNumericSet,
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

const THERMAL_VO_NO_NUMBERS = [
  'Berapa sebenarnya rincian harga peredam panas atap per meter saat sengatan terik matahari membuat ruangan terasa gerah?',
  'Padahal, menghitung estimasi biaya peredam panas jauh lebih hemat dibanding risiko boros pengeluaran listrik AC setiap bulannya.',
  'Di titik ini, pilihan material berkualitas seperti Alum Thermal atau Bubble Foil sangat terjangkau per meter perseginya.',
  'Makanya, sesuaikan pilihan material insulasi dengan anggaran dan jenis bangunanmu. Untuk konsultasi dan daftar harga, komen di bawah ya!'
];

test('F2c5-T2 (R12.1, R12.2): angka_banding registered & prompt schema injects compare/numbers/chips ONLY for angka_banding', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('angka_banding'));
  const meta = getFinishingTemplateMeta('angka_banding');
  assert.equal(meta.file, 'angka-banding.html');
  assert.equal(resolveFinishingTemplateFile('angka_banding'), 'angka-banding.html');
  assert.equal(isRichFinishingTemplate('angka_banding'), true);
  assert.equal(hasStrictTemplateCompliance('angka_banding'), false);
  assert.equal(meta.layers.compare, true);
  assert.equal(meta.layers.numbers, true);
  assert.equal(meta.layers.chips, true);
  assert.equal(meta.layers.sharedBrand, true);
  assert.equal(suggestFinishingTemplate({ campaign_name: 'Solusi Thermal ID - Angka Banding' }), 'angka_banding');

  const abJson = buildFinishingPlanPromptJson('angka_banding', '  ');
  assert.ok(abJson.includes('"compare"'));
  assert.ok(abJson.includes('"numbers"'));
  assert.ok(abJson.includes('"chips"'));

  for (const otherTpl of ['none', 'calm_wellness', 'recipe_pop', 'tips_listicle', 'ramuan_ritual', 'problem_solution']) {
    const otherJson = buildFinishingPlanPromptJson(otherTpl, '  ');
    assert.ok(!otherJson.includes('"compare"'), `${otherTpl} prompt must omit compare`);
    assert.ok(!otherJson.includes('"numbers"'), `${otherTpl} prompt must omit numbers`);
    assert.ok(!otherJson.includes('"chips"'), `${otherTpl} prompt must omit chips`);
  }

  const reOther = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'calm_wellness' });
  const rePrompt = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'angka_banding' });
  const brOther = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'problem_solution' });
  const brPrompt = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'angka_banding' });
  const multOther = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'recipe_pop' }, {}, {}, {});
  const multPrompt = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'angka_banding' }, {}, {}, {});
  const pillarOther = buildOrganicPillarPrompt([], { content_pillar: 'Tips', finishing_template: 'tips_listicle' }, {}, {}, {});
  const pillarPrompt = buildOrganicPillarPrompt([], { content_pillar: 'Harga', finishing_template: 'angka_banding' }, {}, {}, {});
  for (const otherP of [reOther, brOther, multOther, pillarOther]) {
    assert.ok(!otherP.includes('"compare"'));
    assert.ok(!otherP.includes('"numbers"'));
    assert.ok(!otherP.includes('"chips"'));
  }
  for (const p of [rePrompt, brPrompt, multPrompt, pillarPrompt]) {
    assert.ok(p.includes('"compare"'));
    assert.ok(p.includes('"numbers"'));
    assert.ok(p.includes('"chips"'));
  }
});

test('F2c5-T2: strict anti-fake-number guard rejects fabricated numbers/compare while keeping VO/product-grounded items', () => {
  // 1. Clean VO without numbers -> m² exponent must not count as "2"
  const verifiedEmpty = buildVerifiedNumericSet(THERMAL_VO_NO_NUMBERS, null);
  assert.equal(verifiedEmpty.has(2), false);
  assert.equal(verifiedEmpty.has(38), false);
  assert.equal(verifiedEmpty.has(24), false);

  const planWithFakeNumbers = {
    hook: 'HARGA PEREDAM PER M2',
    punches: [
      { clip_index: 0, phrase: 'terasa gerah', type: 'problem' },
      { clip_index: 3, phrase: 'daftar harga', type: 'benefit' }
    ],
    numbers: [
      { clip_index: 0, trigger: 'terasa gerah', from_value: 38, value: 24, unit: '°C', label: 'Turun suhu' },
      { clip_index: 1, trigger: 'jauh lebih hemat', from_value: 0, value: 45, unit: '%', label: 'Hemat listrik' },
      { clip_index: 2, trigger: 'terjangkau per meter', from_value: 0, value: 85000, unit: 'Rp/m2', label: 'Harga promo' }
    ],
    compare: [
      {
        clip_index: 1,
        trigger: 'dibanding risiko boros',
        left: { title: 'HEMAT 50%', sub: 'Suhu turun 38°C ke 24°C', good: true },
        right: { title: 'LISTRIK AC', sub: 'Boros 1 juta', good: false }
      },
      {
        clip_index: 1,
        trigger: 'dibanding risiko boros',
        left: { title: 'PEREDAM PANAS', sub: 'estimasi lebih hemat', good: true },
        right: { title: 'LISTRIK AC', sub: 'boros tiap bulan', good: false }
      }
    ],
    chips: [
      {
        clip_index: 2,
        trigger: 'Alum Thermal',
        items: [
          { trigger: 'Alum Thermal', label: 'ALUM THERMAL' },
          { trigger: 'Bubble Foil', label: 'BUBBLE FOIL' },
          { trigger: 'tidak ada di vo', label: 'ROCKWOOL PALSU' }
        ],
        foot: 'terjangkau per m²'
      }
    ],
    brand_patch: { clip_index: 3, anchor: 'top_right', label: 'Solusi Thermal ID' }
  };

  const checkedNoNums = validateFinishingPlan(planWithFakeNumbers, {
    cleanVoiceoverClips: THERMAL_VO_NO_NUMBERS,
    isHerbalProduct: false,
    finishingTemplate: 'angka_banding'
  });

  // All 3 fabricated numbers MUST be rejected
  assert.equal(checkedNoNums.numbers.length, 0);
  assert.ok(checkedNoNums.warnings.some((w) => w.includes('numbers skipped')));

  // Fabricated compare with 50% / 38°C rejected; VO-grounded compare preserved
  assert.equal(checkedNoNums.compare.length, 1);
  assert.equal(checkedNoNums.compare[0].left.title, 'PEREDAM PANAS');
  assert.equal(checkedNoNums.compare[0].right.title, 'LISTRIK AC');

  // Fabricated chip skipped; grounded Alum Thermal + Bubble Foil + foot "terjangkau per m²" kept
  assert.equal(checkedNoNums.chips.length, 1);
  assert.equal(checkedNoNums.chips[0].items.length, 2);
  assert.deepEqual(checkedNoNums.chips[0].items.map((x) => x.label), ['ALUM THERMAL', 'BUBBLE FOIL']);
  assert.equal(checkedNoNums.chips[0].foot, 'terjangkau per m²');
  assert.equal(checkedNoNums.brandPatch.clipIndex, 3);

  // 2. When VO + productData DO contain real numbers, real numbers pass while unverified ones still fail
  const voWithNums = [
    'Pemasangan insulasi bantu hemat pengeluaran listrik AC hingga tiga puluh lima persen setiap bulan.',
    'Pilihan Alum Thermal mulai tersedia sesuai anggaran bangunan Anda.'
  ];
  const numsExtracted = extractNumericValuesFromText(voWithNums[0]);
  assert.ok(numsExtracted.includes(35));

  const checkedWithNums = validateFinishingPlan({
    numbers: [
      { clip_index: 0, trigger: 'tiga puluh lima persen', from_value: 0, value: 35, unit: '%', label: 'Hemat listrik AC' },
      { clip_index: 1, trigger: 'Alum Thermal', from_value: 0, value: 85000, unit: 'Rp/m2', label: 'Harga mulai' },
      { clip_index: 0, trigger: 'listrik AC', from_value: 0, value: 99, unit: '%', label: 'Angka palsu' }
    ]
  }, {
    cleanVoiceoverClips: voWithNums,
    isHerbalProduct: false,
    finishingTemplate: 'angka_banding',
    productData: { product_name: 'Alum Thermal', price: 85000, specification: 'Tebal 4 mm' }
  });

  assert.equal(checkedWithNums.numbers.length, 2);
  assert.equal(checkedWithNums.numbers[0].value, 35);
  assert.equal(checkedWithNums.numbers[1].value, 85000);
  assert.ok(checkedWithNums.warnings.some((w) => w.includes('99')));
});

test('F2c5-T1 & T3 (R6.6, R12.5): templates/finishing passes R6.6 grep, angka-banding.html captures Chromium PNGs & regression holds', async () => {
  const templatesDir = path.join(process.cwd(), 'templates', 'finishing');
  const htmlFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.html'));
  const forbiddenSampleCopy = [
    'Sari Kunyit', 'Siasat Sehat', 'Nutriblend', 'Dapur Botani', 'GarliBee',
    'Sasyahouse', 'Ruang Akustik', 'Solusi Thermal', 'PEREDAM PANAS',
    'ALUM THERMAL', 'BUBBLE FOIL', 'Kost Muslimah', '38°C'
  ];
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    for (const term of forbiddenSampleCopy) {
      assert.ok(!content.includes(term), `${file} contains hardcoded sample string: ${term}`);
    }
  }

  assert.equal(resolveFinishingTemplatePath('angka_banding'), path.join(templatesDir, 'angka-banding.html'));

  const wordEvents = [
    { w: 'Berapa', c: 0, s: 0.1, e: 0.5 },
    { w: 'harga', c: 0, s: 0.55, e: 1.0 },
    { w: 'teredam', c: 0, s: 1.05, e: 1.5 },
    { w: 'terasa', c: 0, s: 2.0, e: 2.4 },
    { w: 'gerah?', c: 0, s: 2.45, e: 2.9 },
    { w: 'Jauh', c: 1, s: 3.1, e: 3.5 },
    { w: 'lebih', c: 1, s: 3.55, e: 3.9 },
    { w: 'hemat', c: 1, s: 3.95, e: 4.4 },
    { w: 'dibanding', c: 1, s: 4.45, e: 4.95 },
    { w: 'risiko', c: 1, s: 4.96, e: 5.2 },
    { w: 'boros', c: 1, s: 5.21, e: 5.45 },
    { w: 'listrik', c: 1, s: 5.46, e: 5.65 },
    { w: 'AC.', c: 1, s: 5.66, e: 5.85 },
    { w: 'Seperti', c: 2, s: 6.0, e: 6.4 },
    { w: 'Alum', c: 2, s: 6.45, e: 6.8 },
    { w: 'Thermal', c: 2, s: 6.85, e: 7.3 },
    { w: 'atau', c: 2, s: 7.35, e: 7.6 },
    { w: 'Bubble', c: 2, s: 7.65, e: 8.1 },
    { w: 'Foil', c: 2, s: 8.15, e: 8.55 },
    { w: 'terjangkau.', c: 2, s: 8.6, e: 9.1 },
    { w: 'Komen', c: 3, s: 9.4, e: 9.8 },
    { w: 'daftar', c: 3, s: 9.85, e: 10.3 },
    { w: 'harga!', c: 3, s: 10.35, e: 10.8 }
  ];
  const clipOffsets = [
    { clipIndex: 0, start: 0, duration: 3.0 },
    { clipIndex: 1, start: 3.0, duration: 3.0 },
    { clipIndex: 2, start: 6.0, duration: 3.3 },
    { clipIndex: 3, start: 9.3, duration: 3.0 }
  ];

  const tl = buildPhase1Timeline({
    wordEvents,
    hookCard: { l1: 'HARGA PEREDAM', l2: 'PER M2?' },
    hookDuration: 1.75,
    finishingPlan: {
      hook: 'HARGA PEREDAM PER M2',
      punches: [
        { clip_index: 0, phrase: 'terasa gerah', type: 'problem' },
        { clip_index: 3, phrase: 'daftar harga', type: 'benefit' }
      ],
      numbers: [
        { clip_index: 0, trigger: 'terasa gerah', from_value: 38, value: 24, unit: '°C', label: 'Suhu palsu' }
      ],
      compare: [
        {
          clip_index: 1,
          trigger: 'dibanding risiko boros',
          left: { title: 'PEREDAM PANAS', sub: 'hemat biaya', good: true },
          right: { title: 'LISTRIK AC', sub: 'boros bulanan', good: false }
        }
      ],
      chips: [
        {
          clip_index: 2,
          trigger: 'Alum Thermal',
          items: [
            { trigger: 'Alum Thermal', label: 'ALUM THERMAL' },
            { trigger: 'Bubble Foil', label: 'BUBBLE FOIL' }
          ],
          foot: 'terjangkau'
        }
      ],
      brand_patch: { clip_index: 3, anchor: 'top_right', label: 'Solusi Thermal ID' }
    },
    finishingTemplate: 'angka_banding',
    cleanVoiceoverClips: THERMAL_VO_NO_NUMBERS,
    isHerbalProduct: false,
    clipOffsets,
    captionMode: 'hybrid',
    fps: 15,
    totalDuration: 12.3,
    brand: { name: 'Solusi Thermal ID', tagline: 'Insulasi & peredam panas atap', color: '#1c2430', defaultCta: 'Komen untuk daftar harga' },
    cta: { text: 'Komen HARGA untuk daftar harga', arrowDir: '▼', s: 9.5, e: 10.5 }
  });

  assert.equal(tl.numbers.length, 0);
  assert.equal(tl.compare.length, 1);
  assert.equal(tl.chips.length, 1);
  assert.ok(tl.sfx.some((x) => x.k === 'pop'));
  assert.ok(tl.sfx.some((x) => x.k === 'tick'));

  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c5-render-'));
  try {
    const res = await renderPlaywrightOverlay({ outputDir: tmpOut, timeline: tl });
    assert.equal(res.success, true);
    assert.ok(res.frameCount >= 180);
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00001')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00075')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00110')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', String(res.frameCount - 1).padStart(5, '0'))));

    // Verified real number counter capture
    const tlWithNum = buildPhase1Timeline({
      wordEvents: [
        { w: 'Hemat', c: 0, s: 1.85, e: 2.2 },
        { w: 'tiga', c: 0, s: 2.25, e: 2.5 },
        { w: 'puluh', c: 0, s: 2.55, e: 2.85 },
        { w: 'lima', c: 0, s: 2.9, e: 3.2 },
        { w: 'persen.', c: 0, s: 3.25, e: 3.7 }
      ],
      hookCard: { l1: 'HEMAT LISTRIK', l2: 'AC' },
      finishingPlan: {
        numbers: [{ clip_index: 0, trigger: 'tiga puluh lima persen', from_value: 0, value: 35, unit: '%', label: 'Hemat listrik AC' }]
      },
      finishingTemplate: 'angka_banding',
      cleanVoiceoverClips: ['Hemat tiga puluh lima persen.'],
      clipOffsets: [{ clipIndex: 0, start: 0, duration: 4.5 }],
      fps: 15,
      totalDuration: 4.5
    });
    assert.equal(tlWithNum.numbers.length, 1);
    const numDir = path.join(tmpOut, 'with_num');
    const resNum = await renderPlaywrightOverlay({ outputDir: numDir, timeline: tlWithNum });
    assert.equal(resNum.success, true);
    assert.ok(fs.existsSync(resNum.imagePattern.replace('%05d', '00045')));
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // Regression guard: calm_wellness & recipe_pop remain intact and omit angka_banding fields
  for (const regTpl of ['calm_wellness', 'recipe_pop']) {
    const regTl = buildPhase1Timeline({
      wordEvents: wordEvents.slice(0, 6),
      hookCard: { l1: 'TIPS HARIAN', l2: 'SEHAT' },
      finishingPlan: {
        compare: [{ clip_index: 0, trigger: 'harga', left: { title: 'A', good: true }, right: { title: 'B', good: false } }],
        numbers: [{ clip_index: 0, trigger: 'harga', value: 10, label: 'Test' }],
        chips: [{ clip_index: 0, items: [{ trigger: 'harga', label: 'HARGA' }] }]
      },
      finishingTemplate: regTpl,
      cleanVoiceoverClips: ['Berapa harga harian sehat'],
      isHerbalProduct: regTpl === 'calm_wellness',
      totalDuration: 4
    });
    assert.equal(regTl.compare, undefined);
    assert.equal(regTl.numbers, undefined);
    assert.equal(regTl.chips, undefined);
  }
});

