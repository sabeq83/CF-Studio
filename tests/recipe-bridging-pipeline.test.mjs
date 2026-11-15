import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scoreCatalogProductForRecipe, pickAutoMatchedBrandProduct, buildRecipeProductSubmitFields } from '../lib/recipe-product-matcher-shared.js';
import { resolveRecipeProductSelection } from '../lib/recipe-product-resolver.js';
import { resolveAutonomousPipelineAffiliateOverrides } from '../lib/bridging/bridge-plan.js';
import { resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

const MOCK_PRODUCTS = [
  {
    id: 'pe_baking_paper',
    product_name: 'DELAPAN Baking Paper Non-Stick Silicone',
    category: 'Peralatan Masak & Alat Baking',
    tags: 'nutribake',
    clean_photo_url: '/uploads/products/test/baking_paper.jpg',
    photo_url: '/uploads/products/test/baking_paper.jpg',
    affiliate_link: 'https://example.com/baking'
  },
  {
    id: 'pe_monggo_dark',
    product_name: 'Monggo Dark Chocolate',
    category: 'Makanan & Minuman / Cokelat',
    tags: 'nutribake',
    clean_photo_url: '/uploads/products/test/monggo.jpg',
    photo_url: '/uploads/products/test/monggo.jpg',
    affiliate_link: 'https://example.com/monggo'
  },
  {
    id: 'pe_chia_seeds',
    product_name: 'Nutrifarm Chia Seeds',
    category: 'Makanan Sehat & Superfood',
    tags: 'nutribake',
    clean_photo_url: '/uploads/products/test/chia.jpg',
    photo_url: '/uploads/products/test/chia.jpg',
    affiliate_link: 'https://example.com/chia'
  }
];

function createMockDb(rows = MOCK_PRODUCTS) {
  return {
    prepare(sql) {
      // Guard against PostgreSQL 42P18 ("could not determine data type of parameter") caused by `? IS NULL`
      assert.equal(/\?\s+IS\s+NULL/i.test(sql), false, `SQL must not use untyped "? IS NULL": ${sql}`);
      return {
        async get(...params) {
          const targetId = params[params.length - 1];
          return rows.find(r => r.id === targetId) || null;
        },
        async all() {
          return rows;
        }
      };
    }
  };
}

test('Auto-match picks topic-relevant food ingredient over utensil for brownies dessert', async () => {
  const best = pickAutoMatchedBrandProduct(MOCK_PRODUCTS, {
    topic: 'Fudgy Brownies Sehat Tanpa Tepung',
    category: 'dessert'
  });
  assert.equal(best.product?.id, 'pe_monggo_dark');

  const chiaBest = pickAutoMatchedBrandProduct(MOCK_PRODUCTS, {
    topic: 'Overnight Oats Chia Seeds Sehat',
    category: 'dessert'
  });
  assert.equal(chiaBest.product?.id, 'pe_chia_seeds');
  assert.ok(scoreCatalogProductForRecipe(MOCK_PRODUCTS[1], { topic: 'brownies cokelat', category: 'dessert' }) > 30);
});

test('resolveRecipeProductSelection supports auto, manual, and explicit organic none mode', async () => {
  const db = createMockDb();

  const autoRes = await resolveRecipeProductSelection({
    db,
    brandId: 'brand_nutribake',
    topic: 'Fudgy Brownies Sehat Tanpa Tepung',
    category: 'dessert',
    productMode: 'auto',
    bridgingMode: 'select_existing'
  });
  assert.equal(autoRes.resolved, true);
  assert.equal(autoRes.mode, 'auto');
  assert.equal(autoRes.product?.product_id, 'pe_monggo_dark');
  assert.equal(autoRes.product?.photo_path, '/uploads/products/test/monggo.jpg');

  const manualRes = await resolveRecipeProductSelection({
    db,
    brandId: 'brand_nutribake',
    topic: 'Fudgy Brownies Sehat Tanpa Tepung',
    category: 'dessert',
    productId: 'pe_baking_paper',
    productMode: 'manual',
    bridgingMode: 'select_existing'
  });
  assert.equal(manualRes.resolved, true);
  assert.equal(manualRes.mode, 'manual');
  assert.equal(manualRes.product?.product_id, 'pe_baking_paper');

  const manualNoBrandRes = await resolveRecipeProductSelection({
    db,
    brandId: null,
    topic: 'coklat diet',
    category: 'dessert',
    productId: 'pe_monggo_dark',
    productMode: 'manual',
    bridgingMode: 'select_existing'
  });
  assert.equal(manualNoBrandRes.resolved, true);
  assert.equal(manualNoBrandRes.mode, 'manual');
  assert.equal(manualNoBrandRes.product?.product_id, 'pe_monggo_dark');

  assert.deepEqual(buildRecipeProductSubmitFields('manual', 'pe_monggo_dark'), {
    product_mode: 'manual',
    product_id: 'pe_monggo_dark',
    bridging_mode: 'select_existing'
  });
  assert.deepEqual(buildRecipeProductSubmitFields('none', 'pe_monggo_dark'), {
    product_mode: 'none',
    product_id: null,
    bridging_mode: 'none'
  });
  assert.deepEqual(buildRecipeProductSubmitFields('auto', null), {
    product_mode: 'auto',
    product_id: 'auto'
  });

  const noneRes = await resolveRecipeProductSelection({
    db,
    brandId: 'brand_nutribake',
    topic: 'Fudgy Brownies Sehat Tanpa Tepung',
    category: 'dessert',
    productMode: 'none',
    bridgingMode: 'none'
  });
  assert.equal(noneRes.resolved, false);
  assert.equal(noneRes.mode, 'none');
  assert.equal(noneRes.product, null);
});

test('resolveAutonomousPipelineAffiliateOverrides preserves preset bridging decision on recipe_campaign unless explicitly disabled', () => {
  const defaultAuto = resolveAutonomousPipelineAffiliateOverrides(
    { post_link_affiliate: false, product_mode: 'auto' },
    'recipe_campaign'
  );
  assert.equal(defaultAuto.post_link_affiliate, false);
  assert.equal('is_bridging_active' in defaultAuto, false);

  const explicitNone = resolveAutonomousPipelineAffiliateOverrides(
    { post_link_affiliate: true, product_mode: 'none', bridging_mode: 'none' },
    'recipe_campaign'
  );
  assert.equal(explicitNone.is_bridging_active, false);
  assert.equal(explicitNone.bridging_mode, 'none');

  const explicitManual = resolveAutonomousPipelineAffiliateOverrides(
    { product_id: 'pe_monggo_dark', product_mode: 'manual' },
    'recipe_campaign'
  );
  assert.equal(explicitManual.is_bridging_active, true);
});

test('OPC start frame contract & request honor both campaign and per-item product binding only on bridged clips 4 & 6', async () => {
  const campaignWithFallback = {
    id: 'opc_test_recipe',
    target_clips_count: 6,
    is_bridging_active: 1,
    bridge_segments: JSON.stringify([
      { at_clip: 4, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ]),
    target_product_id: null // simulate per-item fallback resolution
  };
  const item = {
    id: 'opc_test_recipe_item_1',
    target_prod_id: 'pe_monggo_dark',
    row_creative_payload: JSON.stringify({
      primary_product_id: 'pe_monggo_dark',
      primary_product_name: 'Monggo Dark Chocolate',
      featured_products: [{ product_id: 'pe_monggo_dark', name: 'Monggo Dark Chocolate' }]
    })
  };

  const clip3Req = resolveProductReferenceRequirement({
    campaign: campaignWithFallback,
    item,
    clip: { clip_index: 3, product_visible: false },
    clipIndex: 3
  });
  assert.equal(clip3Req.required, false);

  const clip4Req = resolveProductReferenceRequirement({
    campaign: campaignWithFallback,
    item,
    clip: { clip_index: 4, product_visible: true },
    clipIndex: 4
  });
  assert.equal(clip4Req.required, true);

  const clip6Req = resolveProductReferenceRequirement({
    campaign: campaignWithFallback,
    item,
    clip: { clip_index: 6, product_visible: true },
    clipIndex: 6
  });
  assert.equal(clip6Req.required, true);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-bridge-test-'));
  try {
    const imgRelPath = '/uploads/products/test/monggo.png';
    const imgAbsPath = path.join(tmpDir, 'public', 'uploads', 'products', 'test', 'monggo.png');
    fs.mkdirSync(path.dirname(imgAbsPath), { recursive: true });
    // Minimal valid PNG (>100 bytes to satisfy G-Labs minimum reference size guard)
    const pngBase = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex'
    );
    fs.writeFileSync(imgAbsPath, Buffer.concat([pngBase, Buffer.alloc(80, 0)]));

    let loadedProductId = null;
    const mockLoader = async (pid) => {
      loadedProductId = pid;
      return {
        id: pid,
        product_name: 'Monggo Dark Chocolate',
        clean_photo_url: imgRelPath
      };
    };

    const reqClip4 = await buildOpcStartFrameRequest({
      campaign: campaignWithFallback,
      item,
      clipIndex: 4,
      prompt: 'Culinary tabletop scene with chocolate bar',
      productLoader: mockLoader,
      cwd: tmpDir
    });
    assert.equal(loadedProductId, 'pe_monggo_dark');
    assert.equal(reqClip4.audit.reference_count, 1);
    assert.equal(reqClip4.audit.product_reference_count, 1);
    assert.equal(reqClip4.providerRequest.reference_images?.length, 1);

    const reqClip6 = await buildOpcStartFrameRequest({
      campaign: campaignWithFallback,
      item,
      clipIndex: 6,
      prompt: 'Plating finished brownies next to chocolate bar',
      productLoader: mockLoader,
      cwd: tmpDir
    });
    assert.equal(reqClip6.audit.reference_count, 1);
    assert.equal(reqClip6.audit.product_reference_count, 1);

    const reqClip3 = await buildOpcStartFrameRequest({
      campaign: campaignWithFallback,
      item,
      clipIndex: 3,
      prompt: 'Culinary tabletop batter mixing',
      productLoader: mockLoader,
      cwd: tmpDir
    });
    assert.equal(reqClip3.audit.reference_count, 0);
    assert.equal(reqClip3.audit.product_reference_count, 0);
    assert.equal(reqClip3.providerRequest.reference_images, undefined);

    // Migrated OPC products often have photo_url populated while clean/raw are null
    const legacyLoader = async (pid) => ({
      id: pid,
      product_name: 'Tepung Almond Premium 500g',
      active_photo: 'generated_photo_url',
      raw_photo_url: null,
      clean_photo_url: null,
      photo_url: imgRelPath
    });
    const reqLegacyClip4 = await buildOpcStartFrameRequest({
      campaign: campaignWithFallback,
      item,
      clipIndex: 4,
      prompt: 'Culinary tabletop scene with almond flour pack',
      productLoader: legacyLoader,
      cwd: tmpDir
    });
    assert.equal(reqLegacyClip4.audit.reference_count, 1);
    assert.equal(reqLegacyClip4.audit.product_reference_count, 1);
    assert.equal(reqLegacyClip4.audit.reference_source_field, 'photo_url');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
