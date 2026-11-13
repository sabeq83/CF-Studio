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
import { isHerbalMedicalClaimPhrase } from '../lib/tiktok-compliance-service.js';
import {
  validateFinishingPlan,
  validateTimingBadges,
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

test('F2c3-T2 (R12.1, R12.2): ramuan_ritual registered with strictClaims & prompt schema injects timing_badges ONLY for ramuan_ritual', () => {
  assert.ok(FINISHING_TEMPLATE_IDS.includes('ramuan_ritual'));
  const meta = getFinishingTemplateMeta('ramuan_ritual');
  assert.equal(meta.file, 'ramuan-ritual.html');
  assert.equal(resolveFinishingTemplateFile('ramuan_ritual'), 'ramuan-ritual.html');
  assert.equal(isRichFinishingTemplate('ramuan_ritual'), true);
  assert.equal(hasStrictTemplateCompliance('ramuan_ritual'), true);
  assert.equal(hasStrictTemplateCompliance('calm_wellness'), false);
  assert.equal(hasStrictTemplateCompliance('tips_listicle'), false);
  assert.equal(suggestFinishingTemplate({ preset_key: 'siasat_sehat_herbal', content_pillar: 'Seduhan Malam Hangat' }), 'ramuan_ritual');
  assert.ok(fs.existsSync(resolveFinishingTemplatePath('ramuan_ritual')));

  const defaultSchema = buildFinishingPlanPromptJson('none');
  const tipsSchema = buildFinishingPlanPromptJson('tips_listicle');
  const ramuanSchema = buildFinishingPlanPromptJson('ramuan_ritual');
  assert.equal(defaultSchema.includes('"timing_badges"'), false);
  assert.equal(tipsSchema.includes('"timing_badges"'), false);
  assert.equal(ramuanSchema.includes('"timing_badges"'), true);

  // All 4 prompt builders inject timing_badges ONLY when finishing_template === 'ramuan_ritual'
  const reOther = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'recipe_pop' });
  const reRamuan = buildReverseEngineeringPrompt([], { target_language: 'id-ID', finishing_template: 'ramuan_ritual' });
  assert.equal(reOther.includes('"timing_badges"'), false);
  assert.equal(reRamuan.includes('"timing_badges"'), true);

  const bridgeOther = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'tips_listicle' });
  const bridgeRamuan = buildReverseEngineeringBridgePrompt([], { target_language: 'id-ID', finishing_template: 'ramuan_ritual' });
  assert.equal(bridgeOther.includes('"timing_badges"'), false);
  assert.equal(bridgeRamuan.includes('"timing_badges"'), true);

  const pillarOther = buildOrganicPillarPrompt([], { content_pillar: 'Seduhan', finishing_template: 'calm_wellness' }, {}, {}, {});
  const pillarRamuan = buildOrganicPillarPrompt([], { content_pillar: 'Seduhan', finishing_template: 'ramuan_ritual' }, {}, {}, {});
  assert.equal(pillarOther.includes('"timing_badges"'), false);
  assert.equal(pillarRamuan.includes('"timing_badges"'), true);

  const multOther = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'recipe_pop' }, {}, {}, {});
  const multRamuan = buildMultiplierPhase2Prompt({ clips: [] }, {}, { finishing_template: 'ramuan_ritual' }, {}, {}, {});
  assert.equal(multOther.includes('"timing_badges"'), false);
  assert.equal(multRamuan.includes('"timing_badges"'), true);
});

test('F2c3-T2: ramuan_ritual enforces strict claim block on hook, punches, fallback hook & timing_badges even when isHerbalProduct=false', () => {
  // Verify strict helper vs non-strict helper
  assert.equal(isHerbalMedicalClaimPhrase('Luntur Lemak Perut', { strict: false }), false);
  assert.equal(isHerbalMedicalClaimPhrase('Luntur Lemak Perut', { strict: true }), true);
  assert.equal(isHerbalMedicalClaimPhrase('Percepat Metabolisme Tubuh', { strict: true }), true);
  assert.equal(isHerbalMedicalClaimPhrase('Detoks Ginjal Alami', { strict: true }), true);
  assert.equal(isHerbalMedicalClaimPhrase('Kurangi Lemak Visceral', { strict: true }), true);
  assert.equal(isHerbalMedicalClaimPhrase('Turunkan Gula Darah & Kolesterol', { strict: true }), true);

  const clips = [
    'Rebus irisan rimpang lalu minum hangat sebelum tidur agar nyaman.',
    'Seduhan ini sering dikaitkan dengan lemak metabolisme detoks ginjal serta gula darah kolesterol visceral.'
  ];

  const badPlan = {
    hook: 'Bakar Lemak Visceral Cepat',
    punches: [
      { clip_index: 1, phrase: 'lemak metabolisme', type: 'result' },
      { clip_index: 1, phrase: 'detoks ginjal', type: 'benefit' },
      { clip_index: 1, phrase: 'gula darah kolesterol', type: 'warning' },
      { clip_index: 0, phrase: 'minum hangat', type: 'benefit' } // SAFE!
    ],
    timing_badges: [
      { clip_index: 0, trigger: 'sebelum tidur', emoji: '🌙', title: 'SEBELUM TIDUR', sub: 'Seduh hangat malam' }, // VALID
      { clip_index: 0, trigger: 'sebelum tidur', emoji: '⏱️', title: 'DETOKS GINJAL', sub: 'Bersih total' }, // CLAIM TITLE -> BLOCKED
      { clip_index: 0, trigger: 'tidak ada di vo', emoji: '⏱️', title: 'PAGI PERUT KOSONG' }, // UNGROUNDED TRIGGER -> SKIPPED
      { clip_index: 0, trigger: 'minum hangat', emoji: '⏱️', title: 'KLAIM RANDOM TAK TERDAFTAR' } // NOT IN WHITELIST -> SKIPPED
    ]
  };

  // NOTE: isHerbalProduct is explicitly FALSE here — strict compliance MUST still apply for ramuan_ritual!
  const res = validateFinishingPlan(badPlan, {
    cleanVoiceoverClips: clips,
    isHerbalProduct: false,
    finishingTemplate: 'ramuan_ritual'
  });

  assert.equal(res.hookCard, null, 'Hook claiming lemak visceral must be blocked');
  assert.equal(res.punches.length, 1);
  assert.equal(res.punches[0].phrase, 'minum hangat');
  assert.equal(res.timingBadges.length, 1);
  assert.equal(res.timingBadges[0].title, 'SEBELUM TIDUR');
  assert.ok(res.warnings.some((w) => w.includes('hook rejected')));
  assert.ok(res.warnings.some((w) => w.includes('timing_badges blocked')));
  assert.ok(res.warnings.some((w) => w.includes('trigger not found in VO')));
  assert.ok(res.warnings.some((w) => w.includes('title outside whitelist/recipe')));

  // Non-ramuan template must ignore timing_badges completely
  const calmRes = validateFinishingPlan(badPlan, {
    cleanVoiceoverClips: clips,
    isHerbalProduct: false,
    finishingTemplate: 'calm_wellness'
  });
  assert.deepEqual(calmRes.timingBadges, []);

  // buildPhase1Timeline fallback hook & product spec strict guard + mandatory safetyNotice
  const timeline = buildPhase1Timeline({
    wordEvents: [
      { w: 'Minum', s: 1.9, e: 2.3, c: 0 },
      { w: 'hangat', s: 2.35, e: 2.8, c: 0 },
      { w: 'sebelum', s: 2.85, e: 3.3, c: 0 },
      { w: 'tidur', s: 3.35, e: 3.8, c: 0 }
    ],
    cleanVoiceoverClips: ['Minum hangat sebelum tidur'],
    hookCard: { line1: 'Bakar Lemak', line2: 'Visceral', l1: 'Bakar Lemak', l2: 'Visceral', text: 'Bakar Lemak Visceral' },
    finishingTemplate: 'ramuan_ritual',
    isHerbalProduct: false,
    productCard: { name: 'Rimpang Kering Alami', specLine: 'Membantu detoks ginjal harian', s: 2.0, e: 4.5 },
    totalDuration: 6.0
  });

  assert.equal(timeline.hookCard, null, 'Caller fallback hookCard with strict claim must be blocked for ramuan_ritual');
  assert.equal(timeline.productCard.specLine, '', 'Claim inside productCard.specLine must be scrubbed');
  assert.ok(timeline.productCard.disclaimer, 'ProductCard keeps non-claim disclaimer');
  assert.equal(timeline.config.sharedBrand?.safetyNotice, true);
  assert.ok(timeline.safetyNotice?.mandatory === true && timeline.safetyNotice.text.length > 5, 'Mandatory x-notice is always scheduled for ramuan_ritual');

  // Direct validateTimingBadges check with recipeTexts grounding
  const directWarnings = [];
  const recipeGrounded = validateTimingBadges(
    [{ clip_index: 0, trigger: 'sebelum tidur', title: 'SEDIAKAN GELAS', sub: 'Tanpa klaim medis' }],
    {
      clipTokenLists: [['minum', 'hangat', 'sebelum', 'tidur']],
      recipeTexts: ['Sediakan gelas kaca tahan panas'],
      warnings: directWarnings
    }
  );
  assert.equal(recipeGrounded.length, 1);
  assert.equal(recipeGrounded[0].title, 'SEDIAKAN GELAS');
});

test('F2c3-T1 & T3 (R6.6, R12.5): templates/finishing passes R6.6 grep, ramuan-ritual.html captures clean Chromium PNGs & calm_wellness/recipe_pop stay unchanged', async () => {
  const tmplDir = path.join(process.cwd(), 'templates', 'finishing');
  const forbiddenRe = /\b(nusa|herba|kunyit|jahe|diabetes|mahkota|kolesterol|sasyahouse|malang|siasat|nutriblend|dapurbotani|lemak|metabolisme|detoks|ginjal|visceral)\b/i;
  for (const fileName of fs.readdirSync(tmplDir)) {
    const content = fs.readFileSync(path.join(tmplDir, fileName), 'utf8');
    assert.equal(forbiddenRe.test(content), false, `Found hardcoded/prohibited term in ${fileName}`);
  }

  const clipWords = [
    ['Siapkan', 'bahan', 'dapur', 'lalu', 'seduh', 'sebelum', 'tidur'],
    ['Diamkan', 'sejenak', 'agar', 'aroma', 'hangat', 'makin', 'nyaman']
  ];
  const wordEvents = [];
  const clipOffsets = [];
  let cursor = 0;
  for (let c = 0; c < clipWords.length; c++) {
    const start = cursor;
    for (let wi = 0; wi < clipWords[c].length; wi++) {
      const s = Number((start + 0.25 + wi * 0.48).toFixed(3));
      const e = Number((s + 0.4).toFixed(3));
      wordEvents.push({ w: clipWords[c][wi], s, e, c });
    }
    clipOffsets.push({ clipIndex: c, start, duration: 4.5 });
    cursor += 4.5;
  }

  const timeline = buildPhase1Timeline({
    wordEvents,
    finishingPlan: {
      hook: 'Ritual Seduhan Malam Hangat',
      punches: [
        { clip_index: 1, phrase: 'makin nyaman', type: 'benefit' }
      ],
      timing_badges: [
        { clip_index: 0, trigger: 'sebelum tidur', emoji: '🌙', title: 'SEBELUM TIDUR', sub: 'Diminum hangat' },
        { clip_index: 1, trigger: 'diamkan sejenak', emoji: '⏱️', title: 'DIAMKAN 5 MENIT', sub: 'Saring sebelum minum' }
      ]
    },
    finishingTemplate: 'ramuan_ritual',
    cleanVoiceoverClips: clipWords.map((arr) => arr.join(' ')),
    isHerbalProduct: false,
    clipOffsets,
    captionMode: 'hybrid',
    totalDuration: 9.0,
    fps: 5,
    recipe: {
      hasRecipe: true,
      ingredients: {
        header: 'BAHAN',
        s: 1.9,
        e: 6.5,
        items: [
          { text: '1 ruas rimpang segar', s: 2.0 },
          { text: '250 ml air hangat', s: 2.6 }
        ]
      }
    },
    productCard: {
      name: 'Kemasan Seduh Botani',
      specLine: 'Berat bersih 100g siap seduh',
      s: 4.2,
      e: 6.8
    },
    brand: {
      name: 'Brand Contoh',
      mark: 'BC',
      color: '#2f2116',
      tagline: 'Kreasi Dapur Alami',
      defaultCta: 'SIMPAN RESEP INI'
    },
    targetLanguage: 'id-ID'
  });

  assert.equal(timeline.config.finishingTemplate, 'ramuan_ritual');
  assert.equal(timeline.timingBadges.length, 2);
  assert.ok(timeline.safetyNotice?.text);

  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c3-ramuan-'));
  try {
    const res = await renderPlaywrightOverlay({ outputDir: tmpOut, timeline });
    assert.equal(res.success, true);
    assert.ok(res.frameCount >= 40);
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00001')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00025')));
    assert.ok(fs.existsSync(res.imagePattern.replace('%05d', '00040')));
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // Regression check: calm_wellness and recipe_pop outputs stay untouched
  const calm = buildPhase1Timeline({
    wordEvents: [{ w: 'Tenang', s: 1.9, e: 2.3, c: 0 }],
    finishingTemplate: 'calm_wellness',
    totalDuration: 3.2
  });
  assert.equal(calm.timingBadges, undefined);
  assert.equal(calm.safetyNotice, undefined);
  assert.equal(calm.config.sharedBrand, undefined);

  const recipe = buildPhase1Timeline({
    wordEvents: [{ w: 'Aduk', s: 1.9, e: 2.3, c: 0 }],
    finishingTemplate: 'recipe_pop',
    totalDuration: 3.2
  });
  assert.equal(recipe.timingBadges, undefined);
  assert.equal(recipe.safetyNotice, undefined);
  assert.equal(recipe.config.sharedBrand, undefined);
});

