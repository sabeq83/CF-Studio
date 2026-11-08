import assert from 'assert';
import { formatEnrichedCaption, getBrandShopeeProducts } from '../lib/shopee-affiliate-injector.js';

async function runTests() {
  console.log('🧪 Starting Test: Smart Shopee Affiliate Injector (Brand-Profile Scoped)...\n');

  // Test 1: formatEnrichedCaption inserts CTA and Shopee link before hashtags
  console.log('Test 1: formatEnrichedCaption separates narrative and places link before hashtags');
  const sampleCaption1 = `Menjaga kesehatan tubuh tidak harus rumit. Cukup manfaatkan rempah alami di dapur untuk detoks harian.\n\nSave video ini agar tidak lupa!\n\n#ResepSehat #TipsAlami #DetoksAlami`;
  const product1 = {
    product_name: 'Nutrifarm Teh Bunga Rosella',
    affiliate_link: 'https://s.shopee.co.id/3Viki27LRx'
  };
  const cta1 = 'Mau coba seduhan teh herbal alami seperti di video? Dapatkan Nutrifarm Teh Rosella di Shopee:';

  const enriched1 = formatEnrichedCaption({
    originalCaption: sampleCaption1,
    matchedProduct: product1,
    ctaPhrase: cta1
  });

  assert(enriched1.includes('🛒 Mau coba seduhan teh herbal alami seperti di video?'), 'Must contain CTA block');
  assert(enriched1.includes('👉 https://s.shopee.co.id/3Viki27LRx'), 'Must contain Shopee link');
  assert(enriched1.endsWith('#ResepSehat #TipsAlami #DetoksAlami'), 'Hashtags must remain at the very end');
  const linkPos = enriched1.indexOf('https://s.shopee.co.id/3Viki27LRx');
  const tagPos = enriched1.indexOf('#ResepSehat');
  assert(linkPos < tagPos, 'Shopee link must come before hashtags');
  console.log('✅ Test 1 Passed!\n');

  // Test 2: formatEnrichedCaption avoids duplicating Shopee link if already present
  console.log('Test 2: formatEnrichedCaption does not duplicate existing Shopee link');
  const captionWithExistingLink = `Resep herbal alami.\n\nCek di https://shope.ee/existing123\n\n#Herbal`;
  const enriched2 = formatEnrichedCaption({
    originalCaption: captionWithExistingLink,
    matchedProduct: product1,
    ctaPhrase: cta1
  });
  assert.strictEqual(enriched2, captionWithExistingLink, 'Must return original caption if link already exists');
  console.log('✅ Test 2 Passed!\n');

  // Test 3: formatEnrichedCaption handles caption with no hashtags
  console.log('Test 3: formatEnrichedCaption handles caption without hashtags gracefully');
  const captionNoTags = `Tips dapur membuat ramuan herbal segar setiap pagi. Coba sekarang dan rasakan khasiatnya!`;
  const enriched3 = formatEnrichedCaption({
    originalCaption: captionNoTags,
    matchedProduct: product1,
    ctaPhrase: cta1
  });
  assert(enriched3.startsWith(captionNoTags), 'Must preserve narrative at start');
  assert(enriched3.includes('🛒 ' + cta1), 'Must append CTA');
  assert(enriched3.includes(product1.affiliate_link), 'Must append link');
  console.log('✅ Test 3 Passed!\n');

  // Test 4: getBrandShopeeProducts queries only for the specific brand profile
  console.log('Test 4: getBrandShopeeProducts returns empty if brandProfileId is empty or invalid');
  const emptyRes = await getBrandShopeeProducts({ tenantId: 'default_tenant', brandProfileId: null });
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, 'Must return empty array for null brand');
  console.log('✅ Test 4 Passed!\n');

  // Test 5: Verify real brand database isolation for dapurbotani vs nutribake
  console.log('Test 5: Verify brand products query on PostgreSQL');
  try {
    const dapurbotaniBrandId = 'df382ce8-2145-4464-ae63-79375ff3aff2'; // Dapur Botani
    const dapurProds = await getBrandShopeeProducts({ tenantId: 'default_tenant', brandProfileId: dapurbotaniBrandId });
    console.log(`Found ${dapurProds.length} Shopee products for Dapur Botani brand:`, dapurProds.map(p => p.product_name));

    assert(dapurProds.length > 0, 'Dapur Botani must have active Shopee products');
    for (const p of dapurProds) {
      assert(p.brand_profile_id === dapurbotaniBrandId, 'All products must belong strictly to dapurbotani');
      const isShopee = p.affiliate_link.includes('shopee') || p.affiliate_link.includes('shope.ee');
      assert(isShopee, 'All returned links must be Shopee affiliate links');
    }

    const nutribakeBrandId = '940e766b-76d0-49b7-b6d5-01dfb0041d40'; // Nutribake ID
    const nutribakeProds = await getBrandShopeeProducts({ tenantId: 'default_tenant', brandProfileId: nutribakeBrandId });
    console.log(`Found ${nutribakeProds.length} Shopee products for Nutribake brand:`, nutribakeProds.map(p => p.product_name));

    assert(nutribakeProds.length > 0, 'Nutribake must have active Shopee products');
    for (const p of nutribakeProds) {
      assert(p.brand_profile_id === nutribakeBrandId, 'All products must belong strictly to nutribake');
      assert(!dapurProds.some(dp => dp.brand_product_id === p.brand_product_id), 'Zero cross-brand product leakage');
    }
    console.log('✅ Test 5 Passed (Strict Brand Safety Isolation Verified)!\n');
  } catch (dbErr) {
    console.warn('Database error in test 5:', dbErr.message);
    throw dbErr;
  }

  console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
