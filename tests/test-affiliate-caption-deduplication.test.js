import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripCtaAndHashtags,
  buildPlatformAdaptiveCaptions,
  buildAffiliatePromptInstruction,
  normalizeSocialMediaPackage
} from '../lib/smart-affiliate-package-builder.js';

test('1. stripCtaAndHashtags cleanly removes pre-existing Bio CTA, Shopee CTA, and trailing hashtags', () => {
  const dirtyCaption = `Nggak nyangka banget, telur rebus di dapur kost bisa disulap jadi mousse cokelat creamy semewah ini! 🍫✨

Mulai sekarang, ngidam manis malam hari nggak perlu pakai rasa bersalah lagi.

👉 Info Bahan/Produk:
Bahan & produk rekomendasi (Monggo Dark Chocolate) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨

#DessertSehat #MousseCokelat #HealthySnack #ResepDiet`;

  const cleaned = stripCtaAndHashtags(dirtyCaption);
  assert.ok(cleaned.includes('Nggak nyangka banget'));
  assert.ok(cleaned.includes('rasa bersalah lagi.'));
  assert.ok(!cleaned.includes('👉 Info Bahan/Produk:'), 'Must strip existing Info Bahan CTA');
  assert.ok(!cleaned.includes('Monggo Dark Chocolate'), 'Must strip existing product info CTA');
  assert.ok(!cleaned.includes('#DessertSehat'), 'Must strip trailing hashtags');

  const dirtyFbCaption = `Resep brownies enak!

🛒 Rekomendasi Bahan Resmi:
Beli Cokelat asli di Shopee resmi kami di sini:
https://s.shopee.co.id/dummy123

#Brownies #ResepKue`;

  const cleanedFb = stripCtaAndHashtags(dirtyFbCaption);
  assert.equal(cleanedFb, 'Resep brownies enak!');
});

test('2. buildPlatformAdaptiveCaptions never creates duplicate CTA or duplicate hashtags', () => {
  const captionWithExistingCta = `Nggak nyangka banget, telur rebus di dapur kost bisa disulap jadi mousse cokelat creamy semewah ini! 🍫✨

Mulai sekarang, ngidam manis malam hari nggak perlu pakai rasa bersalah lagi.

👉 Info Bahan/Produk:
Bahan & produk rekomendasi (Monggo Dark Chocolate) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨

#DessertSehat #MousseCokelat`;

  const matchedProduct = {
    product_id: 'pe_monggo',
    product_name: 'Monggo Dark Chocolate',
    affiliate_link: 'https://s.shopee.co.id/4qD9f6eeeG'
  };

  const adapted = buildPlatformAdaptiveCaptions({
    baseCaption: captionWithExistingCta,
    hashtags: ['#DessertSehat', '#MousseCokelat', '#HealthySnack'],
    matchedProduct
  });

  // Verify Instagram / Bio caption:
  const bioCtaCount = (adapted.caption_bio.match(/👉 Info Bahan\/Produk:/g) || []).length;
  assert.equal(bioCtaCount, 1, 'caption_bio must have EXACTLY 1 Bio CTA block');

  const dessertHashtagCount = (adapted.caption_bio.match(/#DessertSehat/g) || []).length;
  assert.equal(dessertHashtagCount, 1, 'Hashtags must appear EXACTLY once');

  assert.ok(adapted.caption_bio.includes('Link di Bio'), 'Must direct to Link di Bio');
  assert.ok(!adapted.caption_bio.includes('https://s.shopee.co.id'), 'Bio caption must not include raw Shopee link');

  // Verify Facebook caption:
  const fbCtaCount = (adapted.caption_facebook.match(/🛒 Rekomendasi Bahan\/Produk Resmi:/g) || []).length;
  assert.equal(fbCtaCount, 1, 'caption_facebook must have EXACTLY 1 Shopee CTA block');
  assert.ok(adapted.caption_facebook.includes('https://s.shopee.co.id/4qD9f6eeeG'), 'Must contain active Shopee link');
});

test('3. normalizeSocialMediaPackage fixes the real-world collision bug (dapur_botani case)', () => {
  // Simulasi output nyata Gemini yang mengembalikan caption + bio CTA + hashtags di dalam caption
  const rawAiSocialPackage = {
    title: 'Trik Sulap Telur Rebus Jadi Mousse Diet Malam Hari #Shorts',
    caption: `Nggak nyangka banget, telur rebus di dapur kost bisa disulap jadi mousse cokelat creamy semewah ini! 🍫✨

Mulai sekarang, ngidam manis malam hari nggak perlu pakai rasa bersalah lagi. Cukup pakai bahan-bahan simpel yang ada di rumah dan jadikan dessert tinggi protein yang super lezat.

👉 Info Bahan/Produk:
Bahan & produk rekomendasi (Monggo Dark Chocolate) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨

#DessertSehat #MousseCokelat #HealthySnack #ResepDiet #CokelatHitam #HealthyDessert #TrikDapur`,
    caption_bio: `Nggak nyangka banget, telur rebus di dapur kost bisa disulap jadi mousse cokelat creamy semewah ini! 🍫✨

Mulai sekarang, ngidam manis malam hari nggak perlu pakai rasa bersalah lagi. Cukup pakai bahan-bahan simpel yang ada di rumah dan jadikan dessert tinggi protein yang super lezat.

👉 Info Bahan/Produk:
Bahan & produk rekomendasi (Monggo Dark Chocolate) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨

#DessertSehat #MousseCokelat #HealthySnack #ResepDiet #CokelatHitam #HealthyDessert #TrikDapur`,
    caption_facebook: `Nggak nyangka banget, telur rebus di dapur kost bisa disulap jadi mousse cokelat creamy semewah ini! 🍫✨

Mulai sekarang, ngidam manis malam hari nggak perlu pakai rasa bersalah lagi. Cukup pakai bahan-bahan simpel yang ada di rumah dan jadikan dessert tinggi protein yang super lezat.

🛒 Rekomendasi Bahan/Produk Resmi:
Beli Monggo Dark Chocolate asli di Shopee resmi kami di sini:
{{AFFILIATE_LINK}}

#DessertSehat #MousseCokelat #HealthySnack #ResepDiet #CokelatHitam #HealthyDessert #TrikDapur`,
    hashtags: ['#DessertSehat', '#MousseCokelat', '#HealthySnack', '#ResepDiet', '#CokelatHitam', '#HealthyDessert', '#TrikDapur']
  };

  const matchedProduct = {
    product_id: 'pe_monggo',
    product_name: 'Monggo Dark Chocolate',
    affiliate_link: 'https://s.shopee.co.id/4qD9f6eeeG'
  };

  const normalized = normalizeSocialMediaPackage(rawAiSocialPackage, matchedProduct);

  // Verifikasi caption_bio
  const ctaMatches = normalized.caption_bio.match(/👉 Info Bahan\/Produk:/g) || [];
  assert.equal(ctaMatches.length, 1, 'Hanya boleh ada 1 blok Info Bahan/Produk di caption_bio!');

  const monggoMatches = normalized.caption_bio.match(/Monggo Dark Chocolate/g) || [];
  assert.equal(monggoMatches.length, 1, 'Hanya boleh ada 1 penyebutan produk di caption_bio!');

  const hashtagMatches = normalized.caption_bio.match(/#DessertSehat/g) || [];
  assert.equal(hashtagMatches.length, 1, 'Hashtags tidak boleh berulang dua kali!');

  // Verifikasi caption_facebook
  assert.ok(normalized.caption_facebook.includes('https://s.shopee.co.id/4qD9f6eeeG'));
  assert.ok(!normalized.caption_facebook.includes('{{AFFILIATE_LINK}}'));
  const fbCtaMatches = normalized.caption_facebook.match(/🛒 Rekomendasi/g) || [];
  assert.equal(fbCtaMatches.length, 1, 'Hanya boleh ada 1 blok Shopee di caption_facebook!');
});

test('4. buildAffiliatePromptInstruction filters out products without active affiliate links', () => {
  const mixedProducts = [
    { product_id: 'p1', product_name: 'Produk Tanpa Link', affiliate_link: null },
    { product_id: 'p2', product_name: 'Produk Link Kosong', affiliate_link: '   ' },
    { product_id: 'p3', product_name: 'Produk Link Valid', affiliate_link: 'https://s.shopee.co.id/sample123' }
  ];

  const prompt = buildAffiliatePromptInstruction({
    brandProducts: mixedProducts,
    isAffiliateEnabled: true
  });

  assert.ok(prompt.includes('Produk Link Valid'), 'Must include product with valid link');
  assert.ok(!prompt.includes('Produk Tanpa Link'), 'Must exclude product with null link');
  assert.ok(!prompt.includes('Produk Link Kosong'), 'Must exclude product with whitespace link');

  // If no products have affiliate links, fall back to pure educational mode
  const noLinkProducts = [
    { product_id: 'p1', product_name: 'Produk A', affiliate_link: null }
  ];
  const eduPrompt = buildAffiliatePromptInstruction({
    brandProducts: noLinkProducts,
    isAffiliateEnabled: true
  });
  assert.ok(eduPrompt.includes('Murni Edukasi / Non-Afiliasi'), 'Must fallback to educational mode when no links exist');
});

