import assert from 'assert';
import { enrichCaptionForFacebookPublishing, getBrandShopeeProducts, matchCaptionToShopeeProduct } from '../lib/shopee-affiliate-injector.js';

async function runE2ETests() {
  console.log('🧪 Starting End-to-End AI Integration Test for Smart Shopee Injector...\n');

  const dapurbotaniBrandId = 'df382ce8-2145-4464-ae63-79375ff3aff2'; // Dapur Botani
  const products = await getBrandShopeeProducts({ tenantId: 'default_tenant', brandProfileId: dapurbotaniBrandId });
  console.log(`Fetched ${products.length} products for Dapur Botani.`);
  assert(products.length > 0, 'Must have products for Dapur Botani');

  // Test Case A: Caption explicitly mentions jahe merah
  const testCaption = `Saat cuaca dingin atau badan mulai meriang, racikan rempah hangat seperti jahe merah murni ini langsung bikin tenggorokan plong dan lambung nyaman seketika.\n\nYuk coba resep ini di rumah sore nanti!\n\n#DapurBotani #ResepHerbal #JaheMerah #HangatAlami #TipsKeluarga`;

  console.log('\n--- Test Case A: Testing AI Semantic Matching with Dapur Botani Products ---');
  const matchRes = await matchCaptionToShopeeProduct({
    caption: testCaption,
    products,
    brandName: 'Dapur Botani'
  });

  console.log('AI Match Result:', JSON.stringify(matchRes, null, 2));
  assert(matchRes.matched === true, 'AI should match jahe merah context');
  assert(matchRes.product && matchRes.product.affiliate_link, 'Must have matched product with affiliate link');
  assert(matchRes.ctaPhrase && matchRes.ctaPhrase.length > 5, 'Must have generated contextual CTA phrase');
  console.log('✅ AI Matching Passed!');

  // Test Case B: Full enrichment pipeline
  console.log('\n--- Test Case B: Full Enrichment Pipeline ---');
  const enriched = await enrichCaptionForFacebookPublishing({
    caption: testCaption,
    tenantId: 'default_tenant',
    brandProfileId: dapurbotaniBrandId
  });

  console.log('Final Enriched Caption:\n' + enriched);
  assert(enriched.includes('🛒'), 'Must contain shopping cart CTA prefix');
  assert(enriched.includes(matchRes.product.affiliate_link), 'Must contain the Shopee affiliate link');
  assert(enriched.includes('#DapurBotani #ResepHerbal'), 'Hashtags must remain intact');
  console.log('✅ Full Enrichment Pipeline Passed!');

  // Test Case C: Fail-safe test on completely unrelated content (e.g. crypto/finance)
  console.log('\n--- Test Case C: Fail-Safe on Unrelated Content ---');
  const unrelatedCaption = `Analisa pergerakan grafik saham dan aset kripto di sesi pembukaan pasar pagi hari ini.\n\n#Investasi #Saham #Trading`;
  const matchUnrelated = await matchCaptionToShopeeProduct({
    caption: unrelatedCaption,
    products,
    brandName: 'Dapur Botani'
  });
  console.log('Unrelated Content Match Result:', matchUnrelated);
  assert(matchUnrelated.matched === false, 'AI must NOT match unrelated content to kitchen herbs');
  const untouchedCaption = await enrichCaptionForFacebookPublishing({
    caption: unrelatedCaption,
    tenantId: 'default_tenant',
    brandProfileId: dapurbotaniBrandId
  });
  assert.strictEqual(untouchedCaption, unrelatedCaption, 'Caption must remain completely untouched when no match');
  console.log('✅ Fail-Safe Passed!');

  console.log('\n🎉 ALL E2E INTEGRATION TESTS PASSED PERFECTLY! ✅');
  process.exit(0);
}

runE2ETests().catch(err => {
  console.error('❌ E2E Test failed:', err);
  process.exit(1);
});

