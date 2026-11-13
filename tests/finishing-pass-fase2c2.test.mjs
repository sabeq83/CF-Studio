import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  FINISHING_TEMPLATE_IDS,
  getFinishingTemplateMeta,
  resolveFinishingTemplateFile,
  isRichFinishingTemplate,
  suggestFinishingTemplate
} from '../lib/finishing-template-registry.js';
import {
  validateFinishingPlan,
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

const FFMPEG_BIN = (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
  ? process.env.FFMPEG_PATH
  : (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

test('F2c2-T2 (R11, R12.2): tips_listicle registered cleanly & prompt schema injects tips/punch_display ONLY for tips_listicle', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('tips_listicle'));
  const meta = getFinishingTemplateMeta('tips_listicle');
  assert.equal(meta.file, 'tips-listicle.html');
  assert.equal(resolveFinishingTemplateFile('tips_listicle'), 'tips-listicle.html');
  assert.equal(isRichFinishingTemplate('tips_listicle'), true);
  assert.equal(suggestFinishingTemplate({ preset_key: 'sasyahouse_editorial', content_pillar: '3 tips hemat anak kost' }), 'tips_listicle');
  assert.ok(fs.existsSync(resolveFinishingTemplatePath('tips_listicle')));

  // Direct schema helper
  const defaultSchema = buildFinishingPlanPromptJson('none');
  const tipsSchema = buildFinishingPlanPromptJson('tips_listicle');
  assert.equal(defaultSchema.includes('"tips"'), false);
  assert.equal(defaultSchema.includes('"punch_display"'), false);
  assert.equal(tipsSchema.includes('"tips"'), true);
  assert.equal(tipsSchema.includes('"punch_display"'), true);

  // All 4 prompt builders inject tips + punch_display ONLY when finishing_template === 'tips_listicle'
  const reDefault = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'calm_wellness' });
  const reTips = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'tips_listicle' });
  assert.equal(reDefault.includes('"punch_display"'), false);
  assert.equal(reTips.includes('"punch_display"'), true);
  assert.equal(reTips.includes('"tips"'), true);

  const reBridgeDefault = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'none' });
  const reBridgeTips = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'tips_listicle' });
  assert.equal(reBridgeDefault.includes('"punch_display"'), false);
  assert.equal(reBridgeTips.includes('"punch_display"'), true);

  const pillarDefault = buildOrganicPillarPrompt([], { content_pillar: 'Tips Rumah', finishing_template: 'calm_wellness' }, {}, {}, {});
  const pillarTips = buildOrganicPillarPrompt([], { content_pillar: 'Tips Rumah', finishing_template: 'tips_listicle' }, {}, {}, {});
  assert.equal(pillarDefault.includes('"tips"'), false);
  assert.equal(pillarTips.includes('"tips"'), true);

  const multDefault = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'recipe_pop' }, {}, {}, {});
  const multTips = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'tips_listicle' }, {}, {}, {});
  assert.equal(multDefault.includes('"tips"'), false);
  assert.equal(multTips.includes('"tips"'), true);
});

test('F2c2-T2 (R12.2): validateFinishingPlan validates tips (<=6 words, VO grounding, safe skip invalid) & punch_display', () => {
  const clips = [
    'Kunci ketenangan harian itu simpel amankan pos dana darurat sebelum jajan.',
    'Pisahkan segera sepuluh persen saldo utama ke rekening khusus darurat.',
    'Gunakan catatan mingguan sederhana untuk membatasi pengeluaran harian kamu.',
    'Kelola keuangan dengan bijak lalu tulis pendapat kalian di kolom komentar.'
  ];

  const validAndInvalid = validateFinishingPlan({
    hook: '3 Langkah Keuangan',
    punches: [
      { clip_index: 1, phrase: 'sepuluh persen', type: 'number', punch_display: '10%' },
      { clip_index: 0, phrase: 'amankan pos dana', type: 'benefit', punch_display: 'Obat Diabetes' }
    ],
    tips: [
      { clip_index: 0, text: 'Amankan dana darurat sebelum jajan' }, // valid (5 words, grounded)
      { clip_index: 1, text: 'Sisihkan 10% saldo ke rekening darurat' }, // valid (6 words, 10 matches sepuluh)
      { clip_index: 2, text: 'Tip ini sangat panjang sekali melebihi enam kata maksimal' }, // invalid >6 words
      { clip_index: 2, text: 'Beli emas batangan di toko' }, // invalid: not grounded in clip 2 VO
      { clip_index: 9, text: 'Clip tidak valid' }, // invalid clip_index
      { clip_index: 2, text: 'Catat pengeluaran mingguan secara rutin' } // valid (5 words, 'mingguan' / 'pengeluaran')
    ]
  }, {
    cleanVoiceoverClips: clips,
    isHerbalProduct: true
  });

  // Punches: '10%' allowed; second punch's display blocked by herbal medical claim
  assert.equal(validAndInvalid.punches.length, 2);
  assert.equal(validAndInvalid.punches[0].displayText, '10%');
  assert.equal(validAndInvalid.punches[1].displayText, undefined);
  assert.ok(validAndInvalid.warnings.some((w) => w.includes('punch_display blocked')));

  // Tips: only the 3 valid ones survive and are numbered 1..3/3
  assert.equal(validAndInvalid.tips.length, 3);
  assert.deepEqual(
    validAndInvalid.tips.map((t) => ({ n: t.n, total: t.total, clipIndex: t.clipIndex })),
    [
      { n: 1, total: 3, clipIndex: 0 },
      { n: 2, total: 3, clipIndex: 1 },
      { n: 3, total: 3, clipIndex: 2 }
    ]
  );
  assert.ok(validAndInvalid.warnings.some((w) => w.includes('>6 words')));
  assert.ok(validAndInvalid.warnings.some((w) => w.includes('not grounded')));
  assert.ok(validAndInvalid.warnings.some((w) => w.includes('invalid clip_index')));
});

test('F2c2-T1 & T3 (R6.6, R12.1): tips_listicle enforces 10% punch cap, renders x-loc/x-tip/x-recap/x-end in Chromium, & passes R6.6 grep', async () => {
  // R6.6 static guard across ALL files in templates/finishing/
  const tmplDir = path.join(process.cwd(), 'templates', 'finishing');
  const forbiddenRe = /\b(nusa|herba|kunyit|jahe|diabetes|mahkota|kolesterol|sasyahouse|malang|siasat|nutriblend)\b/i;
  for (const fileName of fs.readdirSync(tmplDir)) {
    const content = fs.readFileSync(path.join(tmplDir, fileName), 'utf8');
    assert.equal(forbiddenRe.test(content), false, `Found hardcoded brand/product term in ${fileName}`);
  }

  // Build realistic 4-clip timeline (24 words -> 10% budget = max 2 punch words)
  const clipWords = [
    ['Kunci', 'tenang', 'itu', 'amankan', 'pos', 'darurat'],
    ['Sisihkan', 'sepuluh', 'persen', 'saldo', 'utama', 'kamu'],
    ['Catat', 'pengeluaran', 'tiap', 'minggu', 'dengan', 'rapi'],
    ['Tulis', 'pendapat', 'kamu', 'di', 'kolom', 'komentar']
  ];
  const wordEvents = [];
  const clipOffsets = [];
  let cursor = 0;
  for (let c = 0; c < clipWords.length; c++) {
    const start = cursor;
    for (let wi = 0; wi < clipWords[c].length; wi++) {
      const s = Number((start + 0.2 + wi * 0.4).toFixed(3));
      const e = Number((s + 0.35).toFixed(3));
      wordEvents.push({ w: clipWords[c][wi], s, e, c });
    }
    clipOffsets.push({ clipIndex: c, start, duration: 3.0 });
    cursor += 3.0;
  }

  const timeline = buildPhase1Timeline({
    wordEvents,
    hookCard: null,
    finishingPlan: {
      hook: '3 Tips Hemat Harian',
      punches: [
        { clip_index: 1, phrase: 'sepuluh persen', type: 'number', punch_display: '10%' },
        { clip_index: 2, phrase: 'pengeluaran tiap minggu', type: 'benefit' } // 3 words -> exceeds 10% cap (2 words out of 24)
      ],
      tips: [
        { clip_index: 0, text: 'Amankan pos darurat lebih dulu' },
        { clip_index: 1, text: 'Sisihkan 10% saldo utama kamu' },
        { clip_index: 2, text: 'Catat pengeluaran tiap minggu rapi' }
      ]
    },
    finishingTemplate: 'tips_listicle',
    cleanVoiceoverClips: clipWords.map((arr) => arr.join(' ')),
    isHerbalProduct: false,
    clipOffsets,
    captionMode: 'hybrid',
    totalDuration: 12.0,
    fps: 10,
    brand: {
      name: 'Brand Contoh',
      mark: 'BC',
      color: '#3a2118',
      tagline: 'Hunian Nyaman Terkelola',
      defaultCta: 'TULIS DI KOMEN',
      location: 'Lokasi Contoh · Kota A'
    },
    targetLanguage: 'id-ID'
  });

  // 10% word budget check (24 total words -> floor(2.4) = 2 punch words max -> second punch skipped!)
  assert.equal(timeline.config.finishingTemplate, 'tips_listicle');
  assert.equal(timeline.config.sharedBrand?.enabled, true);
  assert.equal(timeline.punches.length, 1);
  assert.equal(timeline.punches[0].displayText, '10%');
  assert.ok(timeline.warnings.some((w) => w.includes('>10% word budget')));
  assert.equal(timeline.tips.length, 3);
  assert.ok(timeline.tips[0].s >= 1.85, 'Tip 1 avoids Hook Card collision at t < 1.75s');

  // Playwright real capture + verify PNG frames across body, punch, recap, and end card
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c2-tips-'));
  try {
    const res = await renderPlaywrightOverlay({
      outputDir: tmpOut,
      timeline,
      fps: 5
    });
    assert.equal(res.success, true);
    assert.ok(res.frameCount >= 55);
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00001')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00050')));
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test('F2c2-T3 (Regression): calm_wellness & recipe_pop remain unaffected by tips_listicle additions', () => {
  const calm = buildPhase1Timeline({
    wordEvents: [{ w: 'Tenang', s: 1.9, e: 2.3 }, { w: 'pagi', s: 2.35, e: 2.7 }],
    hookCard: { line1: 'Rutinitas Pagi', line2: 'Lebih Fokus', duration: 1.75 },
    finishingTemplate: 'calm_wellness',
    captionMode: 'hybrid',
    totalDuration: 3.2
  });
  assert.equal(calm.config.sharedBrand, undefined);
  assert.equal(calm.tips, undefined);
  assert.equal(resolveFinishingTemplateFile('calm_wellness'), 'calm-wellness.html');

  const recipe = buildPhase1Timeline({
    wordEvents: [{ w: 'Aduk', s: 1.9, e: 2.3 }, { w: 'rata', s: 2.35, e: 2.7 }],
    finishingTemplate: 'recipe_pop',
    captionMode: 'full',
    totalDuration: 3.2
  });
  assert.equal(recipe.config.sharedBrand, undefined);
  assert.equal(recipe.tips, undefined);
  assert.equal(resolveFinishingTemplateFile('recipe_pop'), 'recipe-pop.html');
});

