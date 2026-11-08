import assert from 'node:assert/strict';
import { 
  buildPlatformAdaptiveCaptions, 
  selectBestProductMatch, 
  normalizeSocialMediaPackage,
  buildAffiliatePromptInstruction
} from '../lib/smart-affiliate-package-builder.js';
import { buildRecipeSocialPackage } from '../lib/recipe-social-package.js';
import { validateScheduleRequest } from '../lib/publishing-contract.js';

console.log('🧪 Running Smart Affiliate Generator Multi-Engine & Multi-Platform Tests...\n');

// -------------------------------------------------------------
// Test 1: Platform-Adaptive Captions (FB vs Non-FB)
// -------------------------------------------------------------
console.log('Test 1: buildPlatformAdaptiveCaptions - FB Shopee vs Non-FB Link di Bio');
{
  const baseCaption = 'Resep Brownies Gluten Free super lezat dan lembut.';
  const hashtags = ['#ResepSehat', '#GlutenFree', '#BakingSehat'];
  const matchedProduct = {
    product_id: 'pe_flour_01',
    product_name: 'Tepung Singkong Ladang Lima',
    affiliate_link: 'https://s.shopee.co.id/sampleladang5'
  };

  const res = buildPlatformAdaptiveCaptions({
    baseCaption,
    hashtags,
    matchedProduct
  });

  // 1.1 Facebook Caption: WAJIB mengandung link Shopee aktif
  assert.ok(res.caption_facebook.includes('https://s.shopee.co.id/sampleladang5'), 'Facebook caption must include active Shopee link');
  assert.ok(res.caption_facebook.includes('🛒 Rekomendasi'), 'Facebook caption must include product recommendation header');
  assert.ok(res.caption_facebook.includes('#ResepSehat'), 'Facebook caption must preserve hashtags');
  
  // Posisi: link Shopee harus sebelum hashtags
  const linkPos = res.caption_facebook.indexOf('https://s.shopee.co.id/sampleladang5');
  const tagPos = res.caption_facebook.indexOf('#ResepSehat');
  assert.ok(linkPos < tagPos, 'Shopee link must appear before hashtags in Facebook caption');

  // 1.2 Non-FB Caption (Bio): WAJIB 100% diarahkan ke Link di Bio, TANPA link URL mentah
  assert.ok(res.caption_bio.includes('Link di Bio'), 'Non-FB caption must direct user to Link di Bio');
  assert.ok(!res.caption_bio.includes('http://'), 'Non-FB caption must NOT contain http://');
  assert.ok(!res.caption_bio.includes('https://'), 'Non-FB caption must NOT contain https://');
  assert.ok(!res.caption_bio.includes('shopee'), 'Non-FB caption must NOT contain shopee link');
  assert.ok(res.caption_bio.includes('#ResepSehat'), 'Non-FB caption must preserve hashtags');

  // Posisi: CTA Bio harus sebelum hashtags
  const bioCtaPos = res.caption_bio.indexOf('Link di Bio');
  const bioTagPos = res.caption_bio.indexOf('#ResepSehat');
  assert.ok(bioCtaPos < bioTagPos, 'Bio CTA must appear before hashtags in Non-FB caption');

  console.log('  ✅ Test 1 Passed: Facebook has active link & Non-FB strictly directs to Link di Bio.');
}

// -------------------------------------------------------------
// Test 2: Best Product Matching (Auto vs Manual Selection)
// -------------------------------------------------------------
console.log('\nTest 2: selectBestProductMatch - Auto Keyword Match & Manual Override');
{
  const products = [
    { product_id: 'prod_chia', product_name: 'Organic Chia Seeds', category: 'Superfood', affiliate_link: 'https://s.shopee.co.id/chia' },
    { product_id: 'prod_almond', product_name: 'Susu Almond Unsweetened', category: 'Minuman', affiliate_link: 'https://s.shopee.co.id/almond' },
    { product_id: 'prod_honey', product_name: 'Madu Hutan Murni', category: 'Madu', affiliate_link: 'https://s.shopee.co.id/honey' }
  ];

  // 2.1 Auto-matching by topic
  const match1 = selectBestProductMatch({ products, topic: 'Kreasi Puding Chia Seed dengan Susu Segar' });
  assert.strictEqual(match1.product_id, 'prod_chia', 'Should match Chia Seeds when topic mentions Chia');

  const match2 = selectBestProductMatch({ products, topic: 'Minuman Sehat Campuran Susu Almond Segar' });
  assert.strictEqual(match2.product_id, 'prod_almond', 'Should match Almond Milk when topic mentions Susu Almond');

  // 2.2 Manual override
  const matchManual = selectBestProductMatch({ 
    products, 
    topic: 'Kreasi Puding Chia Seed', 
    preferredProductId: 'prod_honey' 
  });
  assert.strictEqual(matchManual.product_id, 'prod_honey', 'Manual preference must override auto keyword match');

  console.log('  ✅ Test 2 Passed: Auto-matching and manual override work accurately.');
}

// -------------------------------------------------------------
// Test 3: Normalization & Placeholder Replacement
// -------------------------------------------------------------
console.log('\nTest 3: normalizeSocialMediaPackage - Placeholder {{AFFILIATE_LINK}} replacement');
{
  const rawAiPkg = {
    title: '5 Tips Sarapan Sehat #Shorts',
    caption: 'Awali pagi dengan sarapan kaya nutrisi...',
    caption_facebook: 'Awali pagi dengan sarapan kaya nutrisi...\n\n🛒 Rekomendasi Produk:\nBeli di {{AFFILIATE_LINK}}\n\n#TipsSehat',
    caption_bio: 'Awali pagi dengan sarapan kaya nutrisi...\n\n👉 Info Produk:\nCek di Link di Bio ya! ✨\n\n#TipsSehat',
    hashtags: ['#TipsSehat']
  };

  const matchedProduct = {
    product_id: 'prod_chia',
    product_name: 'Organic Chia Seeds',
    affiliate_link: 'https://s.shopee.co.id/chia123'
  };

  const normalized = normalizeSocialMediaPackage(rawAiPkg, matchedProduct);
  assert.ok(normalized.caption_facebook.includes('https://s.shopee.co.id/chia123'), 'Placeholder must be replaced with real affiliate link');
  assert.ok(!normalized.caption_facebook.includes('{{AFFILIATE_LINK}}'), 'Placeholder must no longer exist');
  assert.ok(normalized.caption_bio.includes('Link di Bio'), 'Bio caption must be preserved');
  assert.ok(!normalized.caption_bio.includes('shopee'), 'Bio caption must not contain shopee link');

  console.log('  ✅ Test 3 Passed: Placeholder {{AFFILIATE_LINK}} successfully replaced.');
}

// -------------------------------------------------------------
// Test 4: Recipe Social Package (Recipe Video & Recipe Foto)
// -------------------------------------------------------------
console.log('\nTest 4: buildRecipeSocialPackage - Multi-Platform Output & Platform Captions');
{
  const recipe = {
    title: 'Puding Chia Cokelat',
    ingredients: [
      { name: 'Chia Seeds', amount: '2', unit: 'sdm' },
      { name: 'Susu Almond', amount: '200', unit: 'ml' }
    ],
    steps: [
      { index: 1, instruction: 'Campur chia seeds dan susu almond.' }
    ]
  };

  const copy = {
    hook: 'Puding chia ini bikin kenyang seharian!',
    cta: 'Yuk coba buat di rumah!',
    hashtags: ['#PudingChia', '#ResepDiet'],
    matchedProduct: {
      product_id: 'prod_chia',
      product_name: 'Organic Chia Seeds NutriBake',
      affiliate_link: 'https://s.shopee.co.id/nbchia'
    }
  };

  const pkg = buildRecipeSocialPackage(recipe, copy);

  assert.ok(pkg.caption_facebook.includes('https://s.shopee.co.id/nbchia'), 'Recipe Facebook caption must have Shopee link');
  assert.ok(pkg.caption_bio.includes('Link di Bio'), 'Recipe Bio caption must direct to Link di Bio');
  assert.ok(!pkg.caption_bio.includes('https://s.shopee.co.id'), 'Recipe Bio caption must NOT have raw link');

  // Platform specific mappings
  assert.strictEqual(pkg.platform_captions.facebook, pkg.caption_facebook, 'Facebook platform caption matches caption_facebook');
  assert.strictEqual(pkg.platform_captions.instagram, pkg.caption_bio, 'Instagram platform caption matches caption_bio');
  assert.strictEqual(pkg.platform_captions.tiktok, pkg.caption_bio, 'TikTok platform caption matches caption_bio');
  assert.strictEqual(pkg.platform_captions.youtube_shorts, pkg.caption_bio, 'Shorts platform caption matches caption_bio');

  console.log('  ✅ Test 4 Passed: Recipe Social Package correctly maps platform captions.');
}

// -------------------------------------------------------------
// Test 5: Publishing Contract Validation
// -------------------------------------------------------------
console.log('\nTest 5: validateScheduleRequest - Pass-Through Adaptive Captions');
{
  const input = {
    content_id: 'cf_item_123',
    account_ids: ['acc_fb_1', 'acc_ig_1'],
    publish_mode: 'live',
    media_type: 'video',
    media_url: 'https://storage.makna.id/video.mp4',
    scheduled_at: new Date().toISOString(),
    caption: 'Universal Caption',
    caption_facebook: 'FB Caption with https://s.shopee.co.id/xyz',
    caption_bio: 'IG Caption directing to Link di Bio',
    platform_captions: {
      facebook: 'FB Caption with https://s.shopee.co.id/xyz',
      instagram: 'IG Caption directing to Link di Bio'
    }
  };

  const validated = validateScheduleRequest(input);
  assert.strictEqual(validated.caption_facebook, input.caption_facebook);
  assert.strictEqual(validated.caption_bio, input.caption_bio);
  assert.deepStrictEqual(validated.platform_captions, input.platform_captions);

  console.log('  ✅ Test 5 Passed: validateScheduleRequest retains adaptive captions.');
}

// -------------------------------------------------------------
// Test 6: Zero Secret Exposure & No Keranjang Kuning Check
// -------------------------------------------------------------
console.log('\nTest 6: Prompt & Copy Security - Zero Secret Exposure & Zero "keranjang kuning"');
{
  const brandProducts = [
    { product_id: 'db_01', product_name: 'DapurBotani VCO Extra Virgin', category: 'Minyak Sehat', affiliate_link: 'https://s.shopee.co.id/vco' }
  ];

  const promptText = buildAffiliatePromptInstruction({ brandProducts, isAffiliateEnabled: true });
  assert.ok(!promptText.includes('AIzaSy'), 'Prompt must NEVER contain Google API Key pattern');
  assert.ok(!promptText.toLowerCase().includes('keranjang kuning'), 'TikTok MUST NOT reference keranjang kuning');
  assert.ok(promptText.includes('Link di Bio'), 'Prompt must enforce Link di Bio for non-FB');
  assert.ok(promptText.includes('{{AFFILIATE_LINK}}'), 'Prompt must instruct placeholder for Facebook');

  console.log('  ✅ Test 6 Passed: No secret exposure and zero "keranjang kuning" references.');
}

console.log('\n🎉 ALL 6 TEST SUITES PASSED SUCCESSFULLY! 🚀\n');
