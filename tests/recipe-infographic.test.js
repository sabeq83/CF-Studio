import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import {
  getTemplateImageSpec,
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

test('buildInfographicRecipeSystemPrompt embeds curated recipe lock and optional product', () => {
  const prompt = buildInfographicRecipeSystemPrompt({
    recipeClassification: 'Minuman & Es Kekinian',
    targetTopic: 'Es Teler Creamy',
    targetLang: 'id_ID',
    envObj: { name: 'Rustic Warm Tabletop' },
    infographicTemplate: 'hero_right_editorial',
    curatedRecipe: {
      title: 'Es Teler Alpukat Creamy',
      ingredients: ['1 buah alpukat', '500 ml susu full cream'],
      steps: ['Potong alpukat.', 'Tuang kuah susu.']
    },
    optionalProduct: {
      product_name: 'Blender Chopper Mini 300W',
      usp: 'Mata pisau stainless super cepat'
    }
  });

  assert.match(prompt, /AUTHORITATIVE RECIPE LIBRARY LOCK/i);
  assert.match(prompt, /Es Teler Alpukat Creamy/);
  assert.match(prompt, /Blender Chopper Mini 300W/);
  assert.match(prompt, /hero_right_editorial/i);
});

test('normalizeInfographicPayload sets resolved_template, builds adaptive prompts, and enriches affiliate/bio links', () => {
  const normalized = normalizeInfographicPayload(MOCK_RAW_RECIPE, {
    optionalProduct: {
      product_id: 'prod_1',
      product_name: 'Wajan Anti Lengket 28cm',
      affiliate_link: 'https://shope.ee/test-link'
    },
    brandWatermarkText: 'Dapur Nusantara',
    infographicTemplate: 'step_timeline_zigzag',
    targetLang: 'id_ID'
  });

  assert.equal(normalized.resolved_template, 'step_timeline_zigzag');
  assert.equal(normalized.infographic.optional_product_name, 'Wajan Anti Lengket 28cm');
  // hero + 4 step photos for step_timeline_zigzag = 5 prompts
  assert.equal(Object.keys(normalized.prompts).length, 5);
  assert.match(normalized.social_media_package.caption_facebook, /shope\.ee\/test-link/);
  assert.match(normalized.social_media_package.caption_facebook, /Dapur Nusantara/);
  assert.match(normalized.social_media_package.caption_bio, /Link di Bio/i);
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
