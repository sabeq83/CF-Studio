import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import {
  FINISHING_TEMPLATE_REGISTRY,
  getFinishingTemplateMeta,
  resolveFinishingTemplateFile
} from '../lib/finishing-template-registry.js';
import {
  extractRecipeOverlayData,
  resolveCtaAndSavePrompt
} from '../lib/finishing-data-extractor.js';
import { buildPhase1Timeline } from '../lib/finishing-overlay-renderer.js';
import {
  buildPreviewTimeline,
  PREVIEW_TIMELINE_MARKERS
} from '../lib/finishing-preview-builder.js';

const RICH_TEMPLATES = [
  'calm_wellness',
  'recipe_pop',
  'tips_listicle',
  'ramuan_ritual',
  'problem_solution',
  'angka_banding',
  'mitos_fakta'
];

test('F3-T1: All 7 templates registered cleanly, enforce right: 15cqw safe zone & zero forbidden R6.6 literals', () => {
  const registeredIds = FINISHING_TEMPLATE_REGISTRY.map((t) => t.id);
  assert.ok(registeredIds.includes('none'));
  for (const id of RICH_TEMPLATES) {
    assert.ok(registeredIds.includes(id), `Template ${id} missing from FINISHING_TEMPLATE_REGISTRY`);
    const meta = getFinishingTemplateMeta(id);
    const file = resolveFinishingTemplateFile(id);
    assert.equal(meta.id, id);
    const fullPath = path.join(process.cwd(), 'templates', 'finishing', file);
    assert.ok(fs.existsSync(fullPath), `Missing template file ${file}`);
    const html = fs.readFileSync(fullPath, 'utf8');
    assert.ok(/right:\s*15cqw/.test(html), `${file} must enforce right: 15cqw TikTok/Reels right-rail safe zone`);
    assert.equal(/garlibee|madu\s+bawang|sasyahouse|nutriblend|gala\s+malam|#f2b632|#b88928/i.test(html), false, `${file} must stay clean of hardcoded brand/color literals`);
  }
});

test('F3-T1: recipe-pop.html localizes BAHAN/LANGKAH -> INGREDIENTS/STEP for targetLanguage=en-US', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const page = await context.newPage();
    const url = pathToFileURL(path.join(process.cwd(), 'templates', 'finishing', 'recipe-pop.html')).href;
    await page.goto(url, { waitUntil: 'load' });

    const enTimeline = buildPhase1Timeline({
      finishingTemplate: 'recipe_pop',
      targetLanguage: 'en-US',
      finishingPlan: {
        hook_card: { title: 'Quick Warm Drink', eyebrow: 'HOME RECIPE' },
        punches: [{ text: 'SIP WARM', anchor: 'sip', level: 'primary' }]
      },
      clipOffsets: [
        { start: 0, duration: 3 },
        { start: 3, duration: 3 }
      ],
      totalDuration: 6,
      wordEvents: [
        { w: 'Mix', s: 0.4, e: 0.8 },
        { w: 'sip', s: 3.3, e: 3.7 }
      ],
      recipe: {
        hasRecipe: true,
        ingredients: {
          title: 'Ingredients',
          items: [
            { label: 'Fresh ginger', s: 1.85 },
            { label: 'Warm water', s: 2.15 }
          ],
          totalCount: 2,
          until: 2.95
        },
        steps: [
          { n: 1, total: 2, badge: '', t: 'Stir gently', s: 3.0, e: 4.5 },
          { n: 2, total: 2, badge: '', t: 'Serve warm', s: 4.5, e: 5.9 }
        ]
      }
    });

    await page.evaluate((t) => {
      window.loadTimeline({ ...t, fontBaseUrl: 'http://invalid.local' });
      window.renderAt(2.3);
    }, enTimeline);

    const ingHeaderEn = await page.textContent('#oIng');
    assert.ok(ingHeaderEn && ingHeaderEn.includes('INGREDIENTS'), `Expected INGREDIENTS in en-US, got: ${ingHeaderEn}`);

    await page.evaluate(() => window.renderAt(3.4));
    const stepBadgeEn = await page.textContent('#oStepNum');
    assert.ok(stepBadgeEn && stepBadgeEn.includes('STEP 1/2'), `Expected STEP 1/2 in en-US, got: ${stepBadgeEn}`);
  } finally {
    await browser.close();
  }

  const recEn = extractRecipeOverlayData({
    task: {
      new_caption: 'INGREDIENTS:\n1. Fresh ginger\n2. Raw honey\n3. Cinnamon\n4. Lemon\n5. Warm water\nSTEPS:\n1. Steep ginger\n2. Serve warm'
    },
    clipOffsets: [{ start: 0, duration: 3 }, { start: 3, duration: 3 }],
    totalDuration: 6,
    targetLanguage: 'en-US'
  });
  assert.equal(recEn.ingredients.overflowLabel, '+1 more');
  assert.equal(recEn.steps[0].badge, 'STEP 1/2');
  const ctaEn = resolveCtaAndSavePrompt({
    cleanVoiceoverClips: ['Warm sip', 'Check link in caption for full recipe'],
    clipOffsets: [
      { start: 0, duration: 3 },
      { start: 3, duration: 3 },
      { start: 6, duration: 3 },
      { start: 9, duration: 3 }
    ],
    hasRecipe: true,
    platform: 'tiktok',
    totalDuration: 12,
    targetLanguage: 'en-US'
  });
  assert.equal(ctaEn.savePrompt.titleText, 'Save & Share This Recipe');
});

test('F3-T2: All 7+1 templates load & scrub cleanly via buildPreviewTimeline() in Chromium with zero runtime errors', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 720, height: 1280 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    for (const entry of FINISHING_TEMPLATE_REGISTRY) {
      const fileUrl = pathToFileURL(path.join(process.cwd(), 'templates', 'finishing', entry.file)).href;
      await page.goto(fileUrl, { waitUntil: 'load' });
      const timeline = buildPreviewTimeline({
        templateId: entry.id,
        captionMode: 'hybrid',
        loudnessTarget: -14,
        targetLanguage: 'id-ID'
      });
      // Offline file:// test overrides fontBaseUrl away from Next /fonts HTTP server path
      const loaded = await page.evaluate((t) => window.loadTimeline({ ...t, fontBaseUrl: '' }), timeline);
      assert.equal(loaded, true, `${entry.file} loadTimeline must return true`);

      for (const mk of PREVIEW_TIMELINE_MARKERS) {
        await page.evaluate((sec) => window.renderAt(sec), mk.t);
      }

      if (entry.id === 'tips_listicle') {
        await page.evaluate(() => window.renderAt(4.2));
        const tipNum = await page.textContent('#oTipNum');
        assert.ok(tipNum && tipNum.includes('TIP'), `Expected active TIP pill on tips-listicle preview, got: ${tipNum}`);
      } else if (entry.id === 'mitos_fakta') {
        await page.evaluate(() => window.renderAt(9.5));
        const stampTag = await page.textContent('#oStampTag');
        assert.ok(stampTag && stampTag.includes('FAKTA'), `Expected active FAKTA stamp on mitos-fakta preview, got: ${stampTag}`);
      } else if (entry.id === 'angka_banding') {
        await page.evaluate(() => window.renderAt(9.5));
        const leftTxt = await page.textContent('#oCmpLeftTitle');
        assert.ok(leftTxt && leftTxt.length > 0, 'Expected compare column rendered on angka-banding preview');
      } else if (entry.id === 'problem_solution') {
        await page.evaluate(() => window.renderAt(4.2));
        const chapLbl = await page.textContent('#oChapLabel');
        assert.ok(chapLbl && chapLbl.length > 0, 'Expected active chapter label on problem-solution preview');
      }
    }

    assert.equal(pageErrors.length, 0, `Unexpected preview page errors: ${pageErrors.join(' | ')}`);
  } finally {
    await browser.close();
  }
});
