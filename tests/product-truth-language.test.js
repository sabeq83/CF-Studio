process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test from 'node:test';
import assert from 'node:assert/strict';

const { looksIndonesian, ensureEnglishProductTruths, PRODUCT_TRUTH_DEFINITIONS } = await import('../lib/product-truth-language.js');
const { buildEnrichmentPrompt } = await import('../lib/product-bulk-worker.js');
const { buildBatchProductTruthsPrompt } = await import('../lib/prompts.js');

test('A5.1 looksIndonesian detects Indonesian vs English and handles empty text', () => {
  // Indonesian packaging sentences -> true
  assert.equal(
    looksIndonesian('Kemasan botol plastik berbentuk silinder tegak berwarna hijau dengan tutup ulir putih dan label merek di bagian depan.'),
    true
  );
  assert.equal(
    looksIndonesian('Produk ini terbuat dari kaca tebal dan berisi madu murni untuk kesehatan.'),
    true
  );

  // English sentences -> false
  assert.equal(
    looksIndonesian('The front-facing packaging is a matte green plastic cylinder bottle with a white ribbed screw cap and gold foil logo centered on the upper label. Clear bold black typography reads Herbal Honey across the center band.'),
    false
  );
  assert.equal(
    looksIndonesian('Upright cylindrical bottle crafted from thick transparent glass with a brushed aluminum screw lid. The viscous amber liquid inside refracts warm studio light cleanly.'),
    false
  );

  // Empty / null / whitespace -> false
  assert.equal(looksIndonesian(''), false);
  assert.equal(looksIndonesian('   '), false);
  assert.equal(looksIndonesian(null), false);
  assert.equal(looksIndonesian(undefined), false);
});

test('A5.2 buildEnrichmentPrompt enforces English rules for both Truths and shares PRODUCT_TRUTH_DEFINITIONS', () => {
  const prompt = buildEnrichmentPrompt([
    {
      id: 'prod_1',
      product_name: 'Madu Herbal',
      raw_description: 'Madu murni botol kaca',
      packaging_status: 'packaged',
      packaging_type: 'Botol Kaca'
    }
  ]);

  assert.ok(prompt.includes('WAJIB BAHASA INGGRIS (English)'), 'enrichment prompt must enforce English for Truths');
  assert.ok(prompt.includes('Product Truth (T2I Physics & Packaging Lock)'), 'must include shared Product Truth definition');
  assert.ok(prompt.includes('Geometric Truth (I2V Geometry & Material Lock)'), 'must include shared Geometric Truth definition');
  assert.ok(prompt.includes('"unique_selling_point" dan "category" WAJIB tetap dalam Bahasa Indonesia'), 'USP & category must stay Indonesian');
  assert.ok(prompt.includes(PRODUCT_TRUTH_DEFINITIONS));

  const batchPrompt = buildBatchProductTruthsPrompt([{ id: 'prod_1', product_name: 'Madu Herbal' }]);
  assert.ok(batchPrompt.includes(PRODUCT_TRUTH_DEFINITIONS), 'batch prompt must share exact PRODUCT_TRUTH_DEFINITIONS');
});

test('A5.3 ensureEnglishProductTruths invokes translator once for Indonesian and skips for English', async () => {
  // Indonesian input -> calls translator ONCE
  let calls = 0;
  const indonesianResult = await ensureEnglishProductTruths(
    {
      id: 'p1',
      unique_selling_point: ['Madu murni pilihan'],
      product_truth: 'Kemasan botol kaca transparan dengan tutup kayu dan label berwarna emas serta logo di bagian tengah.',
      geometric_truth: 'Wadah berbentuk silinder tegak terbuat dari kaca bening tebal berisi cairan kental berwarna keemasan.',
      category: 'Madu & Herbal'
    },
    {
      productName: 'Madu Herbal',
      translateFn: async () => {
        calls++;
        return {
          product_truth: 'A clear glass jar topped with a natural wooden screw lid and a centered metallic gold front label.',
          geometric_truth: 'An upright cylindrical thick glass jar filled with viscous golden amber liquid.'
        };
      }
    }
  );

  assert.equal(calls, 1);
  assert.match(indonesianResult.product_truth, /clear glass jar/i);
  assert.match(indonesianResult.geometric_truth, /upright cylindrical/i);
  assert.deepEqual(indonesianResult.unique_selling_point, ['Madu murni pilihan']);
  assert.equal(indonesianResult.category, 'Madu & Herbal');

  // English input -> translator NOT called
  let englishCalls = 0;
  const englishResult = await ensureEnglishProductTruths(
    {
      id: 'p2',
      product_truth: 'Matte white stand-up pouch featuring a centered teal leaf logo and bold dark green brand text.',
      geometric_truth: 'Flexible laminated stand-up pouch with heat-sealed side gussets and satin matte surface texture.'
    },
    {
      translateFn: async () => {
        englishCalls++;
        return { product_truth: 'should not happen', geometric_truth: 'should not happen' };
      }
    }
  );
  assert.equal(englishCalls, 0);
  assert.match(englishResult.product_truth, /Matte white stand-up pouch/);

  // Translation failure -> warns and keeps original without throwing
  const warnings = [];
  const failedFallback = await ensureEnglishProductTruths(
    {
      id: 'p3',
      product_truth: 'Kemasan plastik berwarna biru dengan tutup putar putih dan tulisan putih.',
      geometric_truth: 'Botol silinder dari plastik doff.'
    },
    {
      logger: (msg) => warnings.push(msg),
      translateFn: async () => {
        throw new Error('503 busy');
      }
    }
  );
  assert.equal(warnings.length, 1);
  assert.match(failedFallback.product_truth, /Kemasan plastik berwarna biru/);
});
