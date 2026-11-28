import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

import {
  getTemplateImageSpec,
  shortenPosterTitle,
  buildInfographicRecipeSystemPrompt,
  normalizeInfographicPayload
} from '../lib/recipe-infographic-prompt.js';
import {
  INFOGRAPHIC_TEMPLATE_LIST,
  normalizeInfographicTemplateId,
  pickAutoRotatedTemplate,
  buildInfographicPosterHtml,
  renderRecipeInfographicPoster
} from '../lib/recipe-infographic-renderer.js';

const MOCK_RAW_RECIPE = {
  title: 'Es Teler Creamy Spesial',
  subtitle_ribbon: 'Segar, Creamy, dan Cocok untuk Ide Jualan',
  hook_badge: 'Perpaduan alpukat, mangga, dan kelapa muda',
  prep_time: '15 menit',
  cook_time: '10 menit',
  servings: '4 porsi',
  ingredients_groups: [
    {
      group_name: 'Bahan Utama',
      items: [
        '1 buah alpukat matang, potong dadu',
        '100 gr nangka matang',
        '100 gr kelapa muda',
        '100 gr jelly hijau'
      ]
    },
    {
      group_name: 'Kuah Creamy',
      items: [
        '500 ml susu cair full cream',
        '100 ml santan matang',
        '4 sdm susu kental manis'
      ]
    }
  ],
  steps: [
    { step_number: 1, text: 'Potong alpukat, nangka, dan jelly sesuai ukuran sajian.', t2i_prompt: 'Fresh diced avocado and jackfruit on white ceramic plate' },
    { step_number: 2, text: 'Aduk rata susu cair, santan, dan kental manis hingga lembut.', t2i_prompt: 'Whisking creamy white milk base in clear glass bowl' },
    { step_number: 3, text: 'Susun potongan buah ke dalam cup saji transparan.', t2i_prompt: 'Layering diced tropical fruits inside clear plastic cup' },
    { step_number: 4, text: 'Tuang kuah creamy dan beri topping keju parut.', t2i_prompt: 'Pouring creamy milk into dessert cup topped with grated cheese' }
  ],
  tips: [
    'Gunakan buah matang sempurna agar rasa lebih manis.',
    'Simpan di kulkas sebelum disajikan.'
  ],
  cta_badge: 'Selamat Mencoba!',
  hero_prompt: 'Realistic food photography of creamy Indonesian es teler in clear cup topped with grated cheese',
  secondary_prompt: 'Overhead close-up bowl of creamy es teler topping',
  caption_facebook: 'Bikin Es Teler Creamy sendiri di rumah yuk!',
  caption_bio: 'Resep Es Teler Creamy mudah anti gagal.',
  hashtags: ['#EsTelerCreamy', '#ResepMinuman', '#IdeJualan']
};

test('getTemplateImageSpec returns accurate photo quotas across all 9 templates', () => {
  assert.equal(INFOGRAPHIC_TEMPLATE_LIST.length, 9);

  const heroOnly = getTemplateImageSpec('compact_2col_cheat_sheet');
  assert.equal(heroOnly.mode, 'hero_only');
  assert.equal(heroOnly.stepPhotoCount, 0);

  const heroDetail = getTemplateImageSpec('hero_right_editorial');
  assert.equal(heroDetail.mode, 'hero_and_detail');
  assert.equal(heroDetail.stepPhotoCount, 0);

  const polaroid = getTemplateImageSpec('polaroid_scrapbook');
  assert.equal(polaroid.mode, 'step_photos');
  assert.equal(polaroid.stepPhotoCount, 3);

  const timeline = getTemplateImageSpec('step_timeline_zigzag');
  assert.equal(timeline.mode, 'step_photos');
  assert.equal(timeline.stepPhotoCount, 4);

  const classic = getTemplateImageSpec('step_grid_classic');
  assert.equal(classic.mode, 'step_photos');
  assert.equal(classic.stepPhotoCount, 6);
});

test('normalizeInfographicTemplateId preserves legacy aliases and pickAutoRotatedTemplate cycles cleanly', () => {
  assert.equal(normalizeInfographicTemplateId('infographic_step_grid'), 'step_grid_classic');
  assert.equal(normalizeInfographicTemplateId('infographic_text_steps'), 'layered_band_cards');
  assert.equal(normalizeInfographicTemplateId('infographic_visual_ingredients'), 'visual_ingredient_shelf');
  assert.equal(normalizeInfographicTemplateId('auto_rotate'), 'step_grid_classic');

  const seen = new Set();
  let last = null;
  for (let i = 0; i < 9; i++) {
    const next = pickAutoRotatedTemplate({ lastUsedTemplate: last, itemIndex: 0 });
    seen.add(next);
    last = next;
  }
  assert.equal(seen.size, 9);
});

test('buildInfographicRecipeSystemPrompt embeds curated recipe lock, original_title, and optional product', () => {
  const prompt = buildInfographicRecipeSystemPrompt({
    recipeClassification: 'Minuman & Es Kekinian',
    targetTopic: 'Es Teler Creamy',
    targetLang: 'id_ID',
    envObj: { name: 'Rustic Warm Tabletop' },
    infographicTemplate: 'hero_right_editorial',
    curatedRecipe: {
      title: 'Sourdough Coffee Brownie Bliss',
      original_title: 'Coffee Brownie Sourdough Bread',
      summary: 'Roti sourdough cokelat kopi panggang',
      ingredients: ['150 gr tepung protein tinggi', '45 gr pasta coklat'],
      steps: ['Autolisis 1 jam.', 'Scoring dan panggang 250C.']
    },
    optionalProduct: {
      product_name: 'Blender Chopper Mini 300W',
      usp: 'Mata pisau stainless super cepat'
    }
  });

  assert.match(prompt, /AUTHORITATIVE RECIPE LIBRARY LOCK/i);
  assert.match(prompt, /Coffee Brownie Sourdough Bread/);
  assert.match(prompt, /Cumulative Ingredient State Continuity/i);
  assert.match(prompt, /Blender Chopper Mini 300W/);
  assert.match(prompt, /hero_right_editorial/i);
});

test('normalizeInfographicPayload enforces zero-hand/wrist macro policies, reference_hero_keys & enriches affiliate/bio links', () => {
  const withOldForearmPrompt = {
    ...MOCK_RAW_RECIPE,
    dish_visual_identity: 'Round artisanal dark chocolate sourdough bread loaf scored on top',
    hero_prompt: 'Overhead dish photo, at most hands/forearms from elbow down. [CLEAN FOOD PHOTOGRAPHY ONLY: old]'
  };
  const objectsOnly = normalizeInfographicPayload(withOldForearmPrompt, {
    optionalProduct: {
      product_id: 'prod_1',
      product_name: 'Wajan Anti Lengket 28cm',
      affiliate_link: 'https://shope.ee/test-link'
    },
    brandWatermarkText: 'Dapur Nusantara',
    infographicTemplate: 'step_timeline_zigzag',
    handMode: 'objects_only',
    targetLang: 'id_ID'
  });

  assert.equal(objectsOnly.resolved_template, 'step_timeline_zigzag');
  assert.deepEqual(objectsOnly.reference_hero_keys, ['image_5']);
  assert.equal(objectsOnly.infographic.dish_visual_identity, 'Round artisanal dark chocolate sourdough bread loaf scored on top');
  assert.equal(objectsOnly.infographic.optional_product_name, 'Wajan Anti Lengket 28cm');
  assert.equal(Object.keys(objectsOnly.prompts).length, 5);
  assert.match(objectsOnly.prompts.image_1, /STRICTLY OBJECT-ONLY STILL LIFE/);
  assert.match(objectsOnly.prompts.image_1, /macro/i);
  assert.doesNotMatch(objectsOnly.prompts.image_1, /forearms from elbow down/i);
  assert.match(objectsOnly.social_media_package.caption_facebook, /shope\.ee\/test-link/);
  assert.match(objectsOnly.social_media_package.caption_facebook, /Dapur Nusantara/);
  assert.match(objectsOnly.social_media_package.caption_bio, /Link di Bio/i);

  const wristOnly = normalizeInfographicPayload(MOCK_RAW_RECIPE, {
    infographicTemplate: 'hero_right_editorial',
    handMode: 'wrist_only',
    targetLang: 'id_ID'
  });
  assert.deepEqual(wristOnly.reference_hero_keys, ['image_2']);
  assert.match(wristOnly.prompts.image_1, /bare wrist-to-hand only/i);
  assert.match(wristOnly.prompts.image_1, /NO sleeves/i);
});

test('shortenPosterTitle and buildInfographicPosterHtml fit long 3:4 Recipe Library data without clipping brand watermark or footer', async () => {
  const longTitle = 'Sourdough Coffee Brownie Bliss: Perpaduan Aroma Kopi dan Kelezatan Cokelat yang Menggoda!';
  const short = shortenPosterTitle(longTitle);
  assert.ok(short.length <= 34, `Shortened title too long: ${short}`);
  assert.equal(short, 'Sourdough Coffee Brownie Bliss');

  const htmlCase = buildInfographicPosterHtml({
    data: { ...MOCK_RAW_RECIPE, title: 'brownies fudgy dari ubi' },
    config: {
      aspectRatio: '4:5',
      template: 'step_grid_classic',
      theme: 'warm_cream',
      brandWatermarkText: 'nutribake',
      showBrandWatermark: true
    }
  });
  assert.match(htmlCase, /Brownies Fudgy dari Ubi/);
  assert.match(htmlCase, /nutribake/);

  // Real Chromium bounding-box check on 3:4 (1080x1440) with 6 steps & watermark
  const sixStepData = {
    ...MOCK_RAW_RECIPE,
    title: longTitle,
    cta_badge: 'Yuk Recook!',
    steps: [
      { step_number: 1, text: 'Campur tepung terigu dan air kopi lalu diamkan 1 jam.' },
      { step_number: 2, text: 'Masukkan choco starter ke adonan dan aduk hingga merata.' },
      { step_number: 3, text: 'Tambahkan garam, pasta cokelat, dan madu lalu uleni perlahan.' },
      { step_number: 4, text: 'Lakukan stretch and fold sambil menabur choco chips merata.' },
      { step_number: 5, text: 'Fermentasikan adonan dengan coil fold sampai mengembang optimal.' },
      { step_number: 6, text: 'Beri scoring dan panggang sampai matang sempurna berkilau.' }
    ]
  };
  const posterHtml = buildInfographicPosterHtml({
    data: sixStepData,
    config: {
      aspectRatio: '3:4',
      template: 'step_grid_classic',
      theme: 'warm_cream',
      brandWatermarkText: 'nutribake',
      showBrandWatermark: true
    }
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
    await page.setContent(posterHtml, { waitUntil: 'load' });
    const boxes = await page.evaluate(() => {
      const wm = document.querySelector('[data-watermark="brand"]')?.getBoundingClientRect();
      const footer = document.querySelector('[data-footer="infographic"]')?.getBoundingClientRect();
      const h1 = document.querySelector('h1.title-outline')?.getBoundingClientRect();
      return {
        wm: wm ? { top: wm.top, bottom: wm.bottom, height: wm.height } : null,
        footer: footer ? { top: footer.top, bottom: footer.bottom } : null,
        h1: h1 ? { height: h1.height } : null
      };
    });
    assert.ok(boxes.wm, 'Watermark element missing');
    assert.ok(boxes.wm.bottom <= 1440, `Watermark clipped below 1440px: ${boxes.wm.bottom}`);
    assert.ok(boxes.footer, 'Footer missing');
    assert.ok(boxes.footer.bottom <= 1440, `Footer clipped below 1440px: ${boxes.footer.bottom}`);
    assert.ok(boxes.h1.height <= 90, `Title wrapped past 2 lines: ${boxes.h1.height}`);

    // Verify all 9 templates fit cleanly inside 1080x1440 (3:4) & 1080x1350 (4:5) with zero vertical overflow
    for (const tpl of INFOGRAPHIC_TEMPLATE_LIST) {
      for (const ar of ['3:4', '4:5']) {
        const expectedH = ar === '3:4' ? 1440 : 1350;
        const tplHtml = buildInfographicPosterHtml({
          data: sixStepData,
          config: {
            aspectRatio: ar,
            template: tpl.id,
            theme: ar === '4:5' ? 'dark_bistro' : 'warm_cream',
            brandWatermarkText: 'nutribake',
            showBrandWatermark: true
          }
        });
        await page.setViewportSize({ width: 1080, height: expectedH });
        await page.setContent(tplHtml, { waitUntil: 'load' });
        const check = await page.evaluate(() => {
          const wm = document.querySelector('[data-watermark="brand"]')?.getBoundingClientRect();
          const ft = document.querySelector('[data-footer="infographic"]')?.getBoundingClientRect();
          return {
            scrollH: document.body.scrollHeight,
            wmBottom: wm ? wm.bottom : 9999,
            ftBottom: ft ? ft.bottom : 9999
          };
        });
        assert.ok(check.scrollH <= expectedH, `${tpl.id} ${ar} scrollHeight overflow: ${check.scrollH} > ${expectedH}`);
        assert.ok(check.wmBottom <= expectedH, `${tpl.id} ${ar} watermark clipped: ${check.wmBottom} > ${expectedH}`);
        assert.ok(check.ftBottom <= expectedH, `${tpl.id} ${ar} footer clipped: ${check.ftBottom} > ${expectedH}`);
      }
    }
  } finally {
    await browser.close();
  }
});

test('buildInfographicPosterHtml and renderRecipeInfographicPoster render all 9 templates into valid JPEGs', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-infographic-test-'));
  try {
    const heroPath = path.join(tmpDir, 'hero.jpg');
    const secondaryPath = path.join(tmpDir, 'secondary.jpg');
    const stepPaths = [];

    await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 232, g: 165, b: 84 } }
    }).jpeg().toFile(heroPath);

    await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 196, g: 132, b: 78 } }
    }).jpeg().toFile(secondaryPath);

    for (let i = 0; i < 6; i++) {
      const p = path.join(tmpDir, `step_${i + 1}.jpg`);
      await sharp({
        create: { width: 480, height: 360, channels: 3, background: { r: 120 + i * 18, g: 170, b: 110 } }
      }).jpeg().toFile(p);
      stepPaths.push(p);
    }

    const html = buildInfographicPosterHtml({
      data: MOCK_RAW_RECIPE,
      heroDataUri: 'data:image/jpeg;base64,/9j/4AAQ',
      secondaryDataUri: 'data:image/jpeg;base64,/9j/4AAQ',
      stepDataUris: stepPaths.map(() => 'data:image/jpeg;base64,/9j/4AAQ'),
      config: {
        aspectRatio: '3:4',
        template: 'polaroid_scrapbook',
        theme: 'pastel_bakery',
        brandWatermarkText: 'Dapur Nusantara',
        showBrandWatermark: true
      }
    });
    assert.match(html, /Dapur Nusantara/);
    assert.match(html, /Es Teler Creamy Spesial/);

    for (const tpl of INFOGRAPHIC_TEMPLATE_LIST) {
      const outPath = path.join(tmpDir, `poster_${tpl.id}.jpg`);
      await renderRecipeInfographicPoster({
        data: MOCK_RAW_RECIPE,
        heroImagePath: heroPath,
        secondaryImagePath: secondaryPath,
        stepImagePaths: stepPaths,
        outputPath: outPath,
        config: {
          aspectRatio: tpl.id === 'compact_2col_cheat_sheet' ? '4:5' : '3:4',
          template: tpl.id,
          theme: 'warm_cream',
          showBrandWatermark: true,
          brandWatermarkText: 'Dapur Nusantara'
        }
      });

      assert.ok(fs.existsSync(outPath), `Output missing for ${tpl.id}`);
      const meta = await sharp(outPath).metadata();
      assert.equal(meta.width, 1080);
      assert.equal(meta.height, tpl.id === 'compact_2col_cheat_sheet' ? 1350 : 1440);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
