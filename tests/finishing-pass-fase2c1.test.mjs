import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import sharedLayers from '../templates/finishing/shared-layers.js';
import { resolvePreRenderFinishingMeta } from '../lib/tiktok-compliance-service.js';
import { validateFinishingPlan, validateBrandPatchSpec } from '../lib/finishing-plan-validator.js';
import {
  buildPhase1Timeline,
  renderPlaywrightOverlay
} from '../lib/finishing-overlay-renderer.js';
import { alignWordsToSpeechIntervals } from '../lib/word-alignment-engine.js';

function createMockDb(brandRow = null) {
  return {
    prepare(sql) {
      return {
        async get(...args) {
          if (String(sql).includes('brand_profiles') && brandRow && Number(args[0]) === Number(brandRow.id)) {
            return brandRow;
          }
          return null;
        }
      };
    }
  };
}

test('F2c1-T1 (R12.1): resolvePreRenderFinishingMeta populates Brand Profile fields per platform & language with clean fallback', async () => {
  const brandRow = {
    id: 42,
    brand_name: 'Studio Uji Alami',
    logo_url: 'https://cdn.example.com/logo-trans.png',
    brand_color: '#1b4332',
    brand_tagline: 'Sehat Alami Setiap Hari',
    default_cta_tiktok: 'CEK KERANJANG KUNING',
    default_cta_facebook: 'KLIK PESAN SEKARANG',
    default_cta_youtube: 'CEK LINK DESKRIPSI',
    safety_notice_text: 'Minum sesuai anjuran, hentikan bila tidak cocok.',
    presenter_name: 'Tim R&D',
    presenter_role: 'Formulator',
    brand_location: 'Yogyakarta'
  };

  const mockDb = createMockDb(brandRow);

  const metaTikTok = await resolvePreRenderFinishingMeta({
    db: mockDb,
    campaign: {
      brand_profile_id: 42,
      target_platform: 'tiktok',
      target_language: 'id-ID',
      finishing_template: 'calm_wellness',
      caption_mode: 'hybrid'
    },
    item: { hook_title: 'Kebiasaan Pagi' }
  });

  assert.equal(metaTikTok.brand.name, 'Studio Uji Alami');
  assert.equal(metaTikTok.brand.mark, 'SU');
  assert.equal(metaTikTok.brand.logoUrl, 'https://cdn.example.com/logo-trans.png');
  assert.equal(metaTikTok.brand.color, '#1b4332');
  assert.equal(metaTikTok.brand.tagline, 'Sehat Alami Setiap Hari');
  assert.equal(metaTikTok.brand.defaultCta, 'CEK KERANJANG KUNING');
  assert.equal(metaTikTok.brand.safetyNoticeText, 'Minum sesuai anjuran, hentikan bila tidak cocok.');
  assert.equal(metaTikTok.brand.presenterName, 'Tim R&D');
  assert.equal(metaTikTok.brand.presenterRole, 'Formulator');
  assert.equal(metaTikTok.brand.location, 'Yogyakarta');
  assert.equal(metaTikTok.targetLanguage, 'id-ID');

  const metaFacebook = await resolvePreRenderFinishingMeta({
    db: mockDb,
    campaign: { brand_profile_id: 42, target_platform: 'facebook', target_language: 'en-US' }
  });
  assert.equal(metaFacebook.brand.defaultCta, 'KLIK PESAN SEKARANG');
  assert.equal(metaFacebook.targetLanguage, 'en-US');

  const metaYoutube = await resolvePreRenderFinishingMeta({
    db: mockDb,
    campaign: { brand_profile_id: 42, target_platform: 'youtube' }
  });
  assert.equal(metaYoutube.brand.defaultCta, 'CEK LINK DESKRIPSI');

  // Fallback when DB has no brand_profile_id
  const metaFallback = await resolvePreRenderFinishingMeta({
    db: null,
    campaign: { account_name: 'Fallback Account' }
  });
  assert.equal(metaFallback.brand.name, 'Fallback Account');
  assert.equal(metaFallback.brand.mark, 'FA');
  assert.equal(metaFallback.brand.logoUrl, '');
  assert.equal(metaFallback.targetLanguage, 'id-ID');

  // Timeline propagation
  const timeline = buildPhase1Timeline({
    wordEvents: [{ w: 'Halo', s: 0.2, e: 0.6 }],
    cleanVoiceoverClips: ['Halo'],
    clipOffsets: [{ clipIndex: 0, start: 0, duration: 2 }],
    totalDuration: 2,
    brand: metaTikTok.brand,
    targetLanguage: metaTikTok.targetLanguage,
    brandPatch: { clip_index: 0, anchor: 'top_right', label: 'TERDAFTAR' }
  });
  assert.equal(timeline.config.targetLanguage, 'id-ID');
  assert.equal(timeline.brand.name, 'Studio Uji Alami');
  assert.equal(timeline.brandPatch.clipIndex, 0);
  assert.equal(timeline.brandPatch.anchor, 'top_right');
  assert.equal(timeline.brandPatch.label, 'TERDAFTAR');
});

test('F2c1-T2 (R12.1, R12.4, R6.6): shared-layers.js i18n, explicit x-patch, watermark/end-card mutex, & Playwright Chromium render', async () => {
  const idLabels = sharedLayers.getLocalizedLabels('id-ID');
  assert.equal(idLabels.lang, 'id');
  assert.equal(idLabels.before, 'SEBELUM');
  assert.equal(idLabels.myth, 'MITOS');
  assert.equal(idLabels.ingredientsHeader, 'BAHAN');

  const enLabels = sharedLayers.getLocalizedLabels('en-US');
  assert.equal(enLabels.lang, 'en');
  assert.equal(enLabels.before, 'BEFORE');
  assert.equal(enLabels.myth, 'MYTH');
  assert.equal(enLabels.ingredientsHeader, 'INGREDIENTS');

  // Explicit brand_patch validator (only active on requested clip, blocks herbal claims)
  const planCheck = validateFinishingPlan({
    hook: 'Langkah Harian',
    punches: [],
    brand_patch: {
      clip_index: 3,
      anchor: 'top_right',
      label: 'NAMA BRAND',
      rect: { left: 53.5, top: 6.5, width: 44, height: 21 }
    }
  }, {
    cleanVoiceoverClips: ['Klip satu', 'Klip dua', 'Klip tiga', 'Klip empat', 'Klip lima'],
    isHerbalProduct: true
  });
  assert.ok(planCheck.brandPatch);
  assert.equal(planCheck.brandPatch.clipIndex, 3);
  assert.equal(planCheck.brandPatch.rect.left, 53.5);

  const blockedPatch = validateBrandPatchSpec({
    clip_index: 0,
    anchor: 'top_right',
    label: 'Sembuhkan Diabetes'
  }, { clipCount: 2, isHerbalProduct: true, warnings: [] });
  assert.equal(blockedPatch, null);

  // Shared layer state progression over timeline
  const timeline = buildPhase1Timeline({
    wordEvents: [
      { w: 'Satu', s: 0.3, e: 0.8 },
      { w: 'Dua', s: 1.0, e: 1.5 },
      { w: 'Tiga', s: 6.2, e: 7.0 }
    ],
    cleanVoiceoverClips: ['Satu', 'Dua', 'Tiga', 'Empat'],
    clipOffsets: [
      { clipIndex: 0, start: 0, duration: 2 },
      { clipIndex: 1, start: 2, duration: 2 },
      { clipIndex: 2, start: 4, duration: 2 },
      { clipIndex: 3, start: 6, duration: 4 }
    ],
    totalDuration: 10,
    brand: {
      name: 'Brand Test',
      mark: 'BT',
      tagline: 'Tagline Singkat',
      defaultCta: 'LINK IN BIO',
      presenterName: 'Presenter A',
      presenterRole: 'Educator',
      safetyNoticeText: 'Catatan aman pengguna.'
    },
    targetLanguage: 'en-US',
    brandPatch: planCheck.brandPatch
  });
  timeline.config.sharedBrand = { enabled: true, endCardDuration: 1.75, safetyNotice: true };

  // Body clip 1 (t = 1.0): x-wm + x-lower + x-notice active, NO x-patch (patch is clip 3), NO x-end
  const stateBody = sharedLayers.resolveSharedLayerState(timeline, 1.0);
  assert.ok(stateBody.watermark);
  assert.ok(stateBody.lowerThird);
  assert.ok(stateBody.safetyNotice);
  assert.equal(stateBody.activePatches.length, 0);
  assert.equal(stateBody.endCard, null);

  // Clip 4 (t = 6.5): explicit x-patch active!
  const stateClip4 = sharedLayers.resolveSharedLayerState(timeline, 6.5);
  assert.equal(stateClip4.activePatches.length, 1);
  assert.equal(stateClip4.activePatches[0].rect.left, 53.5);
  assert.equal(stateClip4.activePatches[0].label, 'NAMA BRAND');

  // End card window (t = 9.0, inside [8.25..10]): x-end hides x-wm, x-lower, x-patch, x-notice
  const stateEnd = sharedLayers.resolveSharedLayerState(timeline, 9.0);
  assert.ok(stateEnd.endCard);
  assert.equal(stateEnd.watermark, null);
  assert.equal(stateEnd.lowerThird, null);
  assert.equal(stateEnd.safetyNotice, null);
  assert.equal(stateEnd.activePatches.length, 0);

  // R6.6 static guard: zero hardcoded brand/product words in templates/finishing/
  const tmplDir = path.join(process.cwd(), 'templates', 'finishing');
  const forbiddenRe = /\b(nusa|herba|kunyit|jahe|diabetes|mahkota|kolesterol)\b/i;
  for (const fileName of fs.readdirSync(tmplDir)) {
    const content = fs.readFileSync(path.join(tmplDir, fileName), 'utf8');
    assert.equal(forbiddenRe.test(content), false, `Found forbidden hardcoded term in ${fileName}`);
  }

  // Real Chromium/Playwright DOM harness verification for shared-layers.js (<script src> over file://)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c1-shared-'));
  const sharedCopyPath = path.join(tmpDir, 'shared-layers.js');
  fs.copyFileSync(path.join(tmplDir, 'shared-layers.js'), sharedCopyPath);
  const harnessPath = path.join(tmpDir, 'harness.html');
  fs.writeFileSync(harnessPath, `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;width:720px;height:1280px;background:transparent;}
    #stage{position:relative;width:720px;height:1280px;container-type:size;}
    .layer{position:absolute;inset:0;pointer-events:none;}
  </style></head><body>
    <div id="stage"><div id="o-patch" class="layer" hidden></div><div id="o-brand" class="layer" hidden></div></div>
    <script src="./shared-layers.js"></script>
    <script>
      const st = document.createElement('style');
      st.textContent = window.FinishingSharedLayers.SHARED_LAYERS_CSS;
      document.head.appendChild(st);
      window.__renderShared = (tl, t) => window.FinishingSharedLayers.renderSharedLayersDom({
        oBrandRoot: document.getElementById('o-brand'),
        oPatchRoot: document.getElementById('o-patch'),
        timeline: tl,
        time: t
      });
    </script>
  </body></html>`);

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(harnessPath).href, { waitUntil: 'load' });

    // Body frame on clip 4 (x-wm + x-patch)
    await page.evaluate(({ tl }) => window.__renderShared(tl, 6.5), { tl: timeline });
    const clip4Boxes = await page.evaluate(() => ({
      wm: document.querySelector('.x-wm')?.getBoundingClientRect() || null,
      patch: document.querySelector('.x-patch')?.getBoundingClientRect() || null,
      end: document.querySelector('.x-end')?.getBoundingClientRect() || null
    }));
    assert.ok(clip4Boxes.wm && clip4Boxes.wm.width > 10);
    assert.ok(clip4Boxes.patch && clip4Boxes.patch.left > 350 && clip4Boxes.patch.width > 200);
    assert.equal(clip4Boxes.end, null);

    // End card frame (t = 9.0)
    await page.evaluate(({ tl }) => window.__renderShared(tl, 9.0), { tl: timeline });
    const endBoxes = await page.evaluate(() => ({
      wm: document.querySelector('.x-wm')?.getBoundingClientRect() || null,
      patch: document.querySelector('.x-patch')?.getBoundingClientRect() || null,
      end: document.querySelector('.x-end')?.getBoundingClientRect() || null
    }));
    assert.equal(endBoxes.wm, null);
    assert.equal(endBoxes.patch, null);
    assert.ok(endBoxes.end && endBoxes.end.width === 720 && endBoxes.end.height === 1280);
  } finally {
    if (browser) await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F2c1-T3 (R12.3): alignWordsToSpeechIntervals places words strictly in sp & snaps punctuation < 0.9s', () => {
  const words = ['Air', 'hangat', 'pagi,', 'membantu', 'tubuh', 'nyaman', 'seharian.'];
  // Island 0: [0.2 .. 1.9] (1.7s), Silence: [1.9 .. 2.7] (0.8s gap), Island 1: [2.7 .. 4.9] (2.2s)
  const islands = [
    { start: 0.2, end: 1.9 },
    { start: 2.7, end: 4.9 }
  ];

  const aligned = alignWordsToSpeechIntervals(words, islands, { snapWindowSec: 0.9 });
  assert.equal(aligned.length, words.length);

  // Every word must lie strictly inside one of the speech intervals (never across silence [1.9..2.7])
  for (const w of aligned) {
    const insideFirst = w.s >= 0.199 && w.e <= 1.905;
    const insideSecond = w.s >= 2.699 && w.e <= 4.905;
    assert.ok(insideFirst || insideSecond, `Word "${w.w}" (${w.s}-${w.e}) leaked into silence gap`);
  }

  // Word with comma ('pagi,') must snap to end of island 0 (<= 1.9), next word starts on island 1 (>= 2.7)
  const pagiWord = aligned.find((w) => w.w === 'pagi,');
  const nextWord = aligned.find((w) => w.w === 'membantu');
  assert.ok(pagiWord.e <= 1.905);
  assert.ok(nextWord.s >= 2.699);

  // Distant punctuation >= 0.9s away from boundary must NOT force a wrong early split
  const farWords = ['Klausa,', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];
  const farIslands = [
    { start: 0.0, end: 5.0 },
    { start: 5.6, end: 8.0 }
  ];
  const farAligned = alignWordsToSpeechIntervals(farWords, farIslands, { snapWindowSec: 0.9 });
  // 'Klausa,' estimated boundary ~0.75s speech vs boundary at 5.0s -> diff > 0.9s -> stays early, 'dua' also on island 0
  assert.ok(farAligned[1].e < 5.0, 'Word after distant comma must remain in first speech island');
});

test('F2c1-T4 (Regression): calm_wellness & recipe_pop outputs stay intact without sharedBrand', async () => {
  const tmpOutCalm = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c1-reg-calm-'));
  const tmpOutRecipe = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c1-reg-recipe-'));

  try {
    const calmTimeline = buildPhase1Timeline({
      wordEvents: [
        { w: 'Minum', s: 1.85, e: 2.2 },
        { w: 'hangat', s: 2.25, e: 2.6 },
        { w: 'setiap', s: 2.65, e: 3.0 },
        { w: 'pagi', s: 3.05, e: 3.4 }
      ],
      hookCard: { line1: 'Rutinitas Pagi', line2: 'Lebih Tenang', duration: 1.75 },
      finishingTemplate: 'calm_wellness',
      captionMode: 'hybrid',
      totalDuration: 3.6
    });
    assert.equal(calmTimeline.config.finishingTemplate, 'calm_wellness');
    assert.equal(calmTimeline.config.width, 720);
    assert.equal(calmTimeline.config.height, 1280);
    assert.equal(calmTimeline.words.length, 4);
    assert.equal(calmTimeline.brandPatch, null);

    const calmPngs = await renderPlaywrightOverlay({
      outputDir: tmpOutCalm,
      timeline: calmTimeline,
      fps: 5
    });
    assert.ok(calmPngs.frameCount > 0 && fs.existsSync(calmPngs.imagePattern.replace('%05d', '00001')));

    const recipeTimeline = buildPhase1Timeline({
      wordEvents: [
        { w: 'Seduh', s: 1.85, e: 2.2 },
        { w: 'lima', s: 2.25, e: 2.6 },
        { w: 'menit', s: 2.65, e: 3.0 },
        { w: 'saja', s: 3.05, e: 3.4 }
      ],
      hookCard: { line1: 'Resep Praktis', line2: 'Dua Bahan', duration: 1.75 },
      finishingTemplate: 'recipe_pop',
      captionMode: 'full',
      totalDuration: 3.6,
      recipe: {
        hasRecipe: true,
        ingredients: { showStart: 1.8, showEnd: 2.8, items: ['Air 200ml', 'Daun 2 lbr'], extraCount: 0 },
        steps: [{ n: 1, text: 'Seduh 5 menit', s: 2.4, e: 3.5 }]
      }
    });
    assert.equal(recipeTimeline.config.finishingTemplate, 'recipe_pop');
    assert.equal(recipeTimeline.recipe.hasRecipe, true);

    const recipePngs = await renderPlaywrightOverlay({
      outputDir: tmpOutRecipe,
      timeline: recipeTimeline,
      fps: 5
    });
    assert.ok(recipePngs.frameCount > 0 && fs.existsSync(recipePngs.imagePattern.replace('%05d', '00001')));
  } finally {
    fs.rmSync(tmpOutCalm, { recursive: true, force: true });
    fs.rmSync(tmpOutRecipe, { recursive: true, force: true });
  }
});
