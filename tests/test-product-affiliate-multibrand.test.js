import assert from 'assert';
import { toProductCatalogItem } from '../lib/product-catalog-service.js';

async function runTests() {
  console.log('🧪 Starting Test: Multi-Brand Product Affiliate & Non-Affiliate Filter...');

  // Test 1: toProductCatalogItem with Multi-Brand links (e.g. Dapur Botani & Siasat Sehat)
  console.log('Test 1: toProductCatalogItem formats multi-brand links properly');
  const multiBrandRaw = {
    id: 'prod_test_01',
    product_name: 'Nutrifarm Jahe Merah Bubuk',
    category: 'Bumbu Dapur',
    unique_selling_point: '100% Jahe Merah Alami',
    target_audience: 'Keluarga Sehat',
    source_url: 'https://shopee.co.id/jahe-merah',
    affiliate_link: '',
    brand_links: [
      {
        brand_product_id: 'bp_01',
        brand_profile_id: 'brand_dapur_botani',
        brand_name: 'Dapur Botani',
        affiliate_link: 'https://s.shopee.co.id/dapur_jahe_01',
        is_active: true
      },
      {
        brand_product_id: 'bp_02',
        brand_profile_id: 'brand_siasat_sehat',
        brand_name: 'Siasat Sehat',
        affiliate_link: 'https://s.shopee.co.id/siasat_jahe_02',
        is_active: true
      }
    ]
  };

  const item1 = toProductCatalogItem(multiBrandRaw);
  assert.strictEqual(item1.id, 'prod_test_01');
  assert.strictEqual(item1.brand_links.length, 2, 'Should preserve both brand links');
  assert.strictEqual(item1.brand_links[0].brand_name, 'Dapur Botani');
  assert.strictEqual(item1.brand_links[1].brand_name, 'Siasat Sehat');
  console.log('✅ Test 1 Passed!');

  // Test 2: toProductCatalogItem with 0 brand links and NO fallback (Pure Non-Affiliate)
  console.log('Test 2: toProductCatalogItem with 0 brand links becomes Pure Non-Affiliate');
  const nonAffiliateRaw = {
    id: 'prod_test_02',
    product_name: 'Panci Kaca Borosilikat 1.5L',
    category: 'Peralatan Masak',
    unique_selling_point: 'Tahan api & aesthetic',
    target_audience: 'Ibu Muda',
    source_url: 'https://tokopedia.com/panci-kaca',
    affiliate_link: '',
    brand_links: []
  };

  const item2 = toProductCatalogItem(nonAffiliateRaw);
  assert.strictEqual(item2.brand_links.length, 0, 'Pure non-affiliate product must have 0 brand links');
  console.log('✅ Test 2 Passed!');

  // Test 3: toProductCatalogItem with 0 brand links but has legacy p.affiliate_link (Fallback)
  console.log('Test 3: Legacy affiliate_link is wrapped into global fallback brand link');
  const legacyRaw = {
    id: 'prod_test_03',
    product_name: 'Madu Randu Asli',
    category: 'Herbal',
    unique_selling_point: 'Murni tanpa gula',
    target_audience: 'Pecinta Madu',
    source_url: 'https://shopee.co.id/madu-randu',
    affiliate_link: 'https://s.shopee.co.id/global_madu_99',
    brand_links: []
  };

  const item3 = toProductCatalogItem(legacyRaw);
  assert.strictEqual(item3.brand_links.length, 1, 'Should wrap legacy affiliate link');
  assert.strictEqual(item3.brand_links[0].brand_name, 'Global Fallback');
  assert.strictEqual(item3.brand_links[0].affiliate_link, 'https://s.shopee.co.id/global_madu_99');
  console.log('✅ Test 3 Passed!');

  // Test 4: Classification Logic Simulation
  console.log('Test 4: Status classification matches specification');
  function getProductStatus(item) {
    const count = item.brand_links.length;
    if (count >= 2) return 'multi_brand';
    if (count === 1) return 'with_link';
    return 'without_link';
  }

  assert.strictEqual(getProductStatus(item1), 'multi_brand', 'item1 must be multi_brand');
  assert.strictEqual(getProductStatus(item2), 'without_link', 'item2 must be without_link (non-affiliate)');
  assert.strictEqual(getProductStatus(item3), 'with_link', 'item3 must be with_link');
  console.log('✅ Test 4 Passed!');

  // Test 5: Verify Mockup File Existence & Content Integrity
  console.log('Test 5: Verify Standalone HTML Mockup file integrity');
  const fs = await import('fs');
  const mockupExists = fs.existsSync('public/mockup_product_affiliate_management.html');
  assert(mockupExists, 'public/mockup_product_affiliate_management.html must exist');
  const mockupContent = fs.readFileSync('public/mockup_product_affiliate_management.html', 'utf8');
  assert(mockupContent.includes('Multi-Brand'), 'Mockup must contain Multi-Brand references');
  assert(mockupContent.includes('Dapur Botani') && mockupContent.includes('Siasat Sehat'), 'Mockup must simulate Dapur Botani & Siasat Sehat');
  assert(mockupContent.includes('Non-Afiliasi'), 'Mockup must simulate Non-Afiliasi status');
  console.log('✅ Test 5 Passed!');

  console.log('\n🎉 ALL MULTI-BRAND PRODUCT TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
