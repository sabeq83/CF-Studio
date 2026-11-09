import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import { validateUrlSsrf } from '../lib/recipe-importer/recipe-url-fetcher.js';
import { parseJsonLdRecipe, formatIsoDuration } from '../lib/recipe-importer/parsers/json-ld-recipe-parser.js';
import { isCookpadUrl, cleanCookpadTitle } from '../lib/recipe-importer/parsers/cookpad-parser.js';
import {
  ensureCuratedRecipesTable,
  insertCuratedRecipe,
  getCuratedRecipeById,
  listCuratedRecipes,
  deleteCuratedRecipe
} from '../lib/curated-recipes-repository.js';
import { processRecipeBatchSequential } from '../lib/recipe-importer/recipe-batch-processor.js';

test('SSRF Guard: blocks private, loopback, and invalid protocols', () => {
  // Protocol check
  assert.throws(() => validateUrlSsrf('ftp://cookpad.com/recipe/123'), /Hanya http dan https/);
  assert.throws(() => validateUrlSsrf('javascript:alert(1)'), /Hanya http dan https/);

  // Private / internal IP check
  assert.throws(() => validateUrlSsrf('http://localhost:3000/resep'), /SSRF Guard/);
  assert.throws(() => validateUrlSsrf('http://127.0.0.1:8080/resep'), /SSRF Guard/);
  assert.throws(() => validateUrlSsrf('http://10.0.0.1/resep'), /SSRF Guard/);
  assert.throws(() => validateUrlSsrf('http://192.168.1.100/resep'), /SSRF Guard/);
  assert.throws(() => validateUrlSsrf('http://169.254.169.254/latest/meta-data'), /SSRF Guard/);

  // Valid public URLs pass
  assert.doesNotThrow(() => validateUrlSsrf('https://cookpad.com/id/resep/12345-ayam-goreng'));
  assert.doesNotThrow(() => validateUrlSsrf('https://www.masakapahariini.com/resep/soto-ayam'));
});

test('ISO Duration Parser: converts ISO 8601 to human-friendly text', () => {
  assert.equal(formatIsoDuration('PT30M'), '30 menit');
  assert.equal(formatIsoDuration('PT1H'), '1 jam');
  assert.equal(formatIsoDuration('PT1H15M'), '1 jam 15 menit');
  assert.equal(formatIsoDuration('P1DT2H'), '1 hari 2 jam');
  assert.equal(formatIsoDuration('45 menit'), '45 menit'); // As-is fallback
});

test('Cookpad Parser: cleans hashtags and title prefixes', () => {
  assert.equal(isCookpadUrl('https://cookpad.com/id/resep/12345'), true);
  assert.equal(isCookpadUrl('https://id.cookpad.com/resep/12345'), true);
  assert.equal(isCookpadUrl('https://www.masakapahariini.com/resep/12345'), false);

  const rawTitle = 'Resep Ayam Woku Belanga Pedas Gurih #BikinRamadanBerkesan #MenuPraktis - Cookpad';
  const cleaned = cleanCookpadTitle(rawTitle);
  assert.equal(cleaned, 'Ayam Woku Belanga Pedas Gurih');
});

test('Schema.org JSON-LD Recipe Parser: extracts authentic recipe data accurately', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Resep Rendang Daging Sapi Padang Asli</title>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Rendang Daging Sapi Padang Asli",
        "description": "Rendang daging sapi khas Minang dengan santan kelapa kental dan rempah melimpah.",
        "prepTime": "PT30M",
        "cookTime": "PT3H",
        "totalTime": "PT3H30M",
        "recipeYield": "8 porsi",
        "recipeCategory": "Masakan Utama",
        "recipeCuisine": "Minangkabau",
        "recipeIngredient": [
          "1 kg daging sapi bagian paha (potong tebal)",
          "1000 ml santan kental dari 3 butir kelapa tua",
          "1000 ml santan encer",
          "4 batang serai (memarkan)",
          "5 lembar daun jeruk purut",
          "2 lembar daun kunyit",
          "2 buah asam kandis"
        ],
        "recipeInstructions": [
          {
            "@type": "HowToStep",
            "text": "Rebus santan bersama bumbu halus, serai, daun kunyit, dan asam kandis hingga mendidih dan berminyak."
          },
          {
            "@type": "HowToStep",
            "text": "Masukkan potongan daging sapi, aduk perlahan dengan api sedang hingga kuah menyusut menjadi kalio."
          },
          {
            "@type": "HowToStep",
            "text": "Kecilkan api, aduk terus secara berkala hingga bumbu berubah warna cokelat gelap kehitaman dan meresap sempurna."
          }
        ],
        "image": "https://example.com/rendang.jpg",
        "author": {
          "@type": "Person",
          "name": "Uni Nelda"
        }
      }
      </script>
    </head>
    <body><h1>Rendang Daging Sapi</h1></body>
    </html>
  `;

  const parsed = parseJsonLdRecipe(sampleHtml, 'https://example.com/rendang');

  assert.equal(parsed.title, 'Rendang Daging Sapi Padang Asli');
  assert.equal(parsed.prep_time, '30 menit');
  assert.equal(parsed.cook_time, '3 jam');
  assert.equal(parsed.servings, '8 porsi');
  assert.equal(parsed.author, 'Uni Nelda');
  assert.equal(parsed.image_url, 'https://example.com/rendang.jpg');

  // STRICT GUARDRAIL CHECK: Ingredients must match 100% exactly
  assert.equal(parsed.ingredients.length, 7);
  assert.equal(parsed.ingredients[0], '1 kg daging sapi bagian paha (potong tebal)');
  assert.equal(parsed.ingredients[1], '1000 ml santan kental dari 3 butir kelapa tua');

  // Instructions check
  assert.equal(parsed.instructions.length, 3);
  assert.ok(parsed.instructions[0].includes('Rebus santan bersama bumbu halus'));
  assert.ok(parsed.instructions[2].includes('Kecilkan api, aduk terus'));
});

test('Curated Recipes Repository: CRUD operations and strict ingredients immutability', async () => {
  await ensureCuratedRecipesTable();

  const testId = `test_rcp_${Date.now()}`;
  const rawIngredients = [
    '500 gr cumi segar',
    '5 siung bawang merah',
    '3 siung bawang putih',
    '10 buah cabai hijau keriting',
    '1 sdm saus tiram'
  ];

  // 1. Insert
  const saved = await insertCuratedRecipe({
    id: testId,
    tenant_id: 'default_tenant',
    source_url: 'https://example.com/resep/cumi-cabai-hijau',
    source_domain: 'example.com',
    author: 'Chef Juna',
    original_title: 'Cumi Cabai Hijau',
    polished_title: 'Tumis Cumi Cabai Hijau Gurih Pedas Nagih',
    original_summary: 'Cumi segar pedas gurih.',
    polished_summary: 'Sensasi gurih kenyal cumi segar berpadu pedas harum cabai hijau.',
    ingredients_raw: rawIngredients, // DIJAMIN 100% ASLI
    original_instructions: ['Bersihkan cumi', 'Tumis bumbu', 'Masukkan cumi'],
    polished_instructions: ['Bersihkan cumi dan potong cincin', 'Tumis bumbu hingga harum semerbak', 'Aduk cepat api besar'],
    prep_time: '15 menit',
    cook_time: '10 menit',
    servings: '4 porsi',
    category: 'seafood',
    cuisine: 'indonesia',
    status: 'ready_for_production',
    polish_status: 'polished',
    batch_id: 'test_batch_123'
  });

  assert.equal(saved.id, testId);
  assert.equal(saved.original_title, 'Cumi Cabai Hijau');
  assert.equal(saved.polished_title, 'Tumis Cumi Cabai Hijau Gurih Pedas Nagih');

  // STRICT GUARDRAIL CHECK: ingredients_raw must be array with 100% untouched contents
  assert.ok(Array.isArray(saved.ingredients_raw));
  assert.deepEqual(saved.ingredients_raw, rawIngredients);

  // 2. Query By ID
  const retrieved = await getCuratedRecipeById(testId, 'default_tenant');
  assert.ok(retrieved);
  assert.equal(retrieved.id, testId);
  assert.deepEqual(retrieved.ingredients_raw, rawIngredients);

  // 3. List
  const list = await listCuratedRecipes({
    tenantId: 'default_tenant',
    batchId: 'test_batch_123',
    limit: 10
  });
  assert.ok(list.length >= 1);
  assert.ok(list.some(r => r.id === testId));

  // 4. Delete cleanup
  const delRes = await deleteCuratedRecipe(testId, 'default_tenant');
  assert.equal(delRes.success, true);
  const afterDel = await getCuratedRecipeById(testId, 'default_tenant');
  assert.equal(afterDel, null);
});

test('Sequential Batch Processor: validates input bounds (1 - 50 URLs)', async () => {
  // Empty array validation
  await assert.rejects(
    () => processRecipeBatchSequential({ urls: [] }),
    /Daftar URL resep tidak boleh kosong/
  );

  // Exceeding 50 URLs validation
  const tooManyUrls = Array.from({ length: 51 }, (_, i) => `https://example.com/resep-${i + 1}`);
  await assert.rejects(
    () => processRecipeBatchSequential({ urls: tooManyUrls }),
    /Maksimum URL yang dapat diproses dalam satu batch adalah 50 baris URL/
  );
});

after(() => {
  setTimeout(() => {
    process.exit(0);
  }, 200);
});
