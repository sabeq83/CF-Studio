process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';

const { __setGeminiTestHooks } = await import('../lib/gemini.js');
const {
  resolveEnrichmentImageInput,
  resolveEnrichmentPackagingUpdates,
  generateProductEnrichmentWithGemini,
  buildEnrichmentPrompt
} = await import('../lib/product-bulk-worker.js');
const {
  PHOTO_PICKER_SCHEMA,
  PHOTO_PICKER_PROMPT,
  pickBestProductPhoto
} = await import('../lib/product-photo-picker.js');

test('resolveEnrichmentImageInput memilih foto prioritas cleaned -> clean -> raw -> generated', () => {
  const fakeBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  const calls = [];
  const res1 = resolveEnrichmentImageInput(
    {
      cleaned_photo_url: '/uploads/products/clean/a.jpg',
      raw_photo_url: '/uploads/products/raw/a.png',
      generated_photo_url: '/uploads/products/generated/a.jpg'
    },
    (p) => {
      calls.push(p);
      return p.includes('clean') ? fakeBuf : null;
    },
    () => 'image/jpeg'
  );
  assert.equal(res1.imagePath, '/uploads/products/clean/a.jpg');
  assert.equal(res1.mimeType, 'image/jpeg');
  assert.equal(Buffer.isBuffer(res1.imageBuffer), true);

  // Fallback ke raw jika clean belum ada
  const res2 = resolveEnrichmentImageInput(
    {
      cleaned_photo_url: '/uploads/products/clean/missing.jpg',
      raw_photo_url: '/uploads/products/raw/real.png'
    },
    (p) => (p.includes('real.png') ? fakeBuf : null),
    () => 'image/png'
  );
  assert.equal(res2.imagePath, '/uploads/products/raw/real.png');
  assert.equal(res2.mimeType, 'image/png');

  // Text-only fallback jika tidak ada file foto terbaca
  const res3 = resolveEnrichmentImageInput({}, () => null, () => 'image/jpeg');
  assert.equal(res3.imageBuffer, null);
  assert.equal(res3.imagePath, null);
});

test('resolveEnrichmentPackagingUpdates mengoreksi tebakan scraper saat packaging_status kosong, namun menjaga editan manual', () => {
  // Kasus pe_1795007715441_445: tebakan awal Kardus Kotak, packaging_status masih kosong
  const autoUpdate = resolveEnrichmentPackagingUpdates(
    { packaging_status: null, packaging_type: 'Kardus Kotak', is_in_packaging: 1 },
    { detected_packaging_type: 'Jar Plastik', detected_is_in_packaging: true }
  );
  assert.equal(autoUpdate.packagingType, 'Jar Plastik');
  assert.equal(autoUpdate.isInPackaging, 1);

  // Kasus editan manual pengguna di modal (packaging_status = 'packaged')
  const manualLocked = resolveEnrichmentPackagingUpdates(
    { packaging_status: 'packaged', packaging_type: 'Jar Plastik', is_in_packaging: 1 },
    { detected_packaging_type: 'Standing Pouch', detected_is_in_packaging: true }
  );
  assert.equal(manualLocked.packagingType, 'Jar Plastik');
  assert.equal(manualLocked.isInPackaging, 1);
});

test('generateProductEnrichmentWithGemini mengirim inlineData foto bila tersedia dan text-only bila null', async () => {
  const capturedRequests = [];
  class MockGenAI {
    getGenerativeModel() {
      return {
        generateContent: async (parts) => {
          capturedRequests.push(parts);
          return {
            response: {
              text: () => JSON.stringify({ products: [{ id: 'p1', product_truth: 'Plastic jar.' }] }),
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
            }
          };
        }
      };
    }
  }

  __setGeminiTestHooks({
    getSetting: (k) => ({
      gemini_api_tier: 'free',
      gemini_smart_routing: 'on',
      gemini_model_primary: 'gemini-3.5-flash-lite',
      gemini_model_light: 'gemini-3.5-flash-lite'
    }[k] ?? null),
    sleep: async () => {},
    maxWaterfallCycles: 1,
    GoogleGenerativeAI: MockGenAI,
    getAvailableApiKey: async () => ({ id: 1, key_name: 'mock', api_key: 'TEST_MOCK_API_KEY' }),
    incrementKeyUsage: async () => {},
    markKeyExhausted: async () => {},
    markApiKeyStatus: async () => {},
    recordAiTokenUsage: async () => {}
  });

  try {
    const imgBuf = Buffer.from('fake-jpeg-bytes');
    await generateProductEnrichmentWithGemini('Analyze product', {
      itemId: 'p1',
      tenantId: 'default_tenant',
      imageBuffer: imgBuf,
      mimeType: 'image/jpeg'
    });

    assert.equal(capturedRequests.length, 1);
    assert.equal(capturedRequests[0].length, 2);
    assert.equal(capturedRequests[0][0].inlineData.mimeType, 'image/jpeg');
    assert.equal(capturedRequests[0][0].inlineData.data, imgBuf.toString('base64'));
    assert.equal(capturedRequests[0][1].text, 'Analyze product');

    // Text-only fallback
    await generateProductEnrichmentWithGemini('Analyze text only', {
      itemId: 'p2',
      tenantId: 'default_tenant'
    });
    assert.equal(capturedRequests[1].length, 1);
    assert.equal(capturedRequests[1][0].text, 'Analyze text only');
  } finally {
    __setGeminiTestHooks(null);
  }
});

test('buildEnrichmentPrompt bebas kata pemicu pouch berdiri dan mewajibkan Visual Grounding', () => {
  const prompt = buildEnrichmentPrompt([{ id: 'p1', product_name: 'Grainnola', has_attached_image: true }]);
  assert.equal(prompt.includes('pouch berdiri'), false);
  assert.equal(prompt.includes('VISUAL GROUNDING KETAT'), true);
  assert.equal(prompt.includes('detected_packaging_type'), true);
});

test('PHOTO_PICKER_SCHEMA & pickBestProductPhoto meneruskan selected_packaging_type & selected_is_in_packaging', async () => {
  assert.ok(PHOTO_PICKER_SCHEMA.properties.selected_packaging_type);
  assert.ok(PHOTO_PICKER_SCHEMA.properties.selected_is_in_packaging);
  assert.equal(PHOTO_PICKER_PROMPT.includes('selected_packaging_type'), true);

  const fs = await import('node:fs');
  const fakeJpg = Buffer.alloc(700, 0xFF);
  fakeJpg[0] = 0xFF; fakeJpg[1] = 0xD8; fakeJpg[2] = 0xFF;

  const result = await pickBestProductPhoto({
    candidates: [
      { url: 'https://example.com/1.jpg', source: 'dom', w: 700, h: 700 },
      { url: 'https://example.com/2.jpg', source: 'dom', w: 700, h: 700 }
    ],
    downloadFn: async (_url, filePath) => {
      fs.writeFileSync(filePath, fakeJpg);
      return true;
    },
    generateWithImagesFn: async () => JSON.stringify({
      best_index: 1,
      selected_packaging_type: 'Jar Plastik',
      selected_is_in_packaging: true,
      candidates: [
        { index: 0, has_person: false, text_overlay: 'light', is_infographic: false, product_visible: true, score: 80 },
        { index: 1, has_person: false, text_overlay: 'none', is_infographic: false, product_visible: true, score: 95 }
      ]
    }),
    productId: 'pe_test_pkg'
  });

  assert.equal(result.selectedUrl, 'https://example.com/2.jpg');
  assert.equal(result.detectedPackagingType, 'Jar Plastik');
  assert.equal(result.detectedIsInPackaging, true);
});
