import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import {
  buildInfographicRecipeSystemPrompt,
  normalizeInfographicPayload
} from '../lib/recipe-infographic-prompt.js';
import {
  buildInfographicPosterHtml,
  renderRecipeInfographicPoster
} from '../lib/recipe-infographic-renderer.js';

test('buildInfographicRecipeSystemPrompt embeds curated recipe lock and optional product', () => {
  const prompt = buildInfographicRecipeSystemPrompt({
    recipeClassification: 'Minuman',
    targetLang: 'id_ID',
    infographicTemplate: 'infographic_step_grid',
    curatedRecipe: {
      id: 'rcp_test_1',
      title: 'Es Teler Creamy',
      ingredients: ['1 buah alpukat matang', '500 ml susu cair full cream'],
      steps: ['Potong dadu alpukat.', 'Campur susu cair dan santan.'],
      prep_time: '15 menit',
      cook_time: '10 menit',
      servings: '4 porsi'
    },
    optionalProduct: {
      product_name: 'Cup Es 16oz Tebal',
      category: 'Kemasan',
      usp: 'Tutup cembung bening anti tumpah'
    }
  });

  assert.match(prompt, /AUTHORITATIVE RECIPE LIBRARY LOCK/);
  assert.match(prompt, /Es Teler Creamy/);
  assert.match(prompt, /1 buah alpukat matang/);
  assert.match(prompt, /Cup Es 16oz Tebal/);
  assert.match(prompt, /CLEAN FOOD PHOTOGRAPHY ONLY: NO TEXT/);
});

test('normalizeInfographicPayload deduplicates ingredients, builds step prompts, and enriches affiliate/bio links', () => {
  const normalized = normalizeInfographicPayload(
    {
      title: 'Stik Royco Renyah',
      subtitle_ribbon: 'Renyah, Gurih, Nagih!',
      hook_badge: 'Camilan Simpel untuk Segala Suasana',
      ingredients_groups: [
        {
          group_title: 'Bahan-bahan',
          items: ['250 gr tepung terigu', '100-120 ml air', '100-120 ml air', '1 sachet kaldu ayam']
        }
      ],
      steps: [
        { step_number: 1, caption: 'Campurkan tepung dan bumbu', t2i_prompt: 'Overhead bowl of flour and seasoning, NO TEXT' },
        { step_number: 2, caption: 'Uleni hingga kalis', t2i_prompt: 'Kneaded dough ball in glass bowl, NO TEXT' },
        { step_number: 3, caption: 'Gilas tipis lalu potong', t2i_prompt: 'Flat rolled dough cut into strips, NO TEXT' },
        { step_number: 4, caption: 'Goreng hingga kuning keemasan', t2i_prompt: 'Golden fried sticks in pan, NO TEXT' }
      ],
      tips: ['Pastikan adonan tipis agar renyah.', 'Simpan di toples kedap udara.'],
      hero_prompt: 'Crispy golden savory sticks in glass jar and white plate, NO TEXT'
    },
    {
      optionalProduct: {
        product_id: 'pe_123',
        product_name: 'Toples Kaca Kedap Udara 1000ml',
        affiliate_link: 'https://shopee.co.id/toples-kedap-udara'
      },
      brandWatermarkText: '@NutriBake.id',
      infographicTemplate: 'infographic_step_grid',
      targetLang: 'id_ID'
    }
  );

  // Duplicate '100-120 ml air' removed
  assert.equal(normalized.infographic.ingredients_groups[0].items.length, 3);
  // Hero + 4 step prompts = 5 prompts
  assert.equal(Object.keys(normalized.prompts).length, 5);
  assert.ok(normalized.prompts.image_1.includes('glass jar'));
  assert.ok(normalized.prompts.image_5.includes('Golden fried sticks'));
  // Captions include affiliate link for FB, Link di Bio for IG, and watermark brand
  assert.ok(normalized.social_media_package.caption_facebook.includes('https://shopee.co.id/toples-kedap-udara'));
  assert.ok(normalized.social_media_package.caption_facebook.includes('@NutriBake.id'));
  assert.ok(normalized.social_media_package.caption_bio.toLowerCase().includes('link di bio'));
});

test('buildInfographicPosterHtml supports templates, ratios, watermark toggle, and renders valid 4:5 JPEG', async () => {
  const sampleData = {
    title: 'Matcha Almond Crispy',
    subtitle_ribbon: 'Renyah, Lembut, Wangi Matcha',
    hook_badge: 'Resep Kue Kering Terbaru',
    servings: '1 Toples',
    cook_time: '20 menit',
    ingredients_groups: [
      { group_title: 'Bahan', items: ['50 gr putih telur', '25 gr mentega', '5 gr matcha bubuk'] },
      { group_title: 'Topping', items: ['20 gr almond slice', '20 gr keju parut'] }
    ],
    steps: [
      { step_number: 1, caption: 'Aduk mentega dan margarin sampai rata.' },
      { step_number: 2, caption: 'Masukkan putih telur dan matcha bubuk.' },
      { step_number: 3, caption: 'Cetak bulat pipih dan beri topping almond.' },
      { step_number: 4, caption: 'Panggang suhu 150C selama 20 menit.' }
    ],
    tips: ['Oles adonan setipis mungkin agar renyah merata.'],
    cta_badge: 'Selamat Mencoba!',
    optional_product_name: 'Loyang Kue Kering Anti Lengket'
  };

  const htmlWithWm = buildInfographicPosterHtml({
    data: sampleData,
    config: {
      aspectRatio: '4:5',
      template: 'infographic_text_steps',
      theme: 'fresh_pandan',
      showBrandWatermark: true,
      brandWatermarkText: '@NutriBake.id'
    }
  });
  assert.ok(htmlWithWm.includes('Matcha Almond Crispy'));
  assert.ok(htmlWithWm.includes('@NutriBake.id'));
  assert.ok(htmlWithWm.includes('Loyang Kue Kering Anti Lengket'));

  const htmlNoWm = buildInfographicPosterHtml({
    data: sampleData,
    config: {
      aspectRatio: '3:4',
      template: 'infographic_step_grid',
      theme: 'warm_cream',
      showBrandWatermark: false,
      brandWatermarkText: '@NutriBake.id'
    }
  });
  assert.equal(htmlNoWm.includes('@NutriBake.id'), false);

  // Render real JPEG poster via Playwright + Sharp using tiny generated placeholder images
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-infographic-test-'));
  const heroPath = path.join(tmpDir, 'hero.jpg');
  const stepPath = path.join(tmpDir, 'step1.jpg');
  const outPath = path.join(tmpDir, 'poster.jpg');

  try {
    await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 120, g: 180, b: 90 } } })
      .jpeg()
      .toFile(heroPath);
    await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 220, g: 190, b: 140 } } })
      .jpeg()
      .toFile(stepPath);

    await renderRecipeInfographicPoster({
      data: sampleData,
      heroImagePath: heroPath,
      stepImagePaths: [stepPath, stepPath, stepPath, stepPath],
      outputPath: outPath,
      config: {
        aspectRatio: '4:5',
        template: 'infographic_step_grid',
        theme: 'warm_cream',
        showBrandWatermark: true,
        brandWatermarkText: '@NutriBake.id'
      }
    });

    assert.ok(fs.existsSync(outPath));
    const meta = await sharp(outPath).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
