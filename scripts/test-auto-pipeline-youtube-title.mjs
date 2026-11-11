import assert from 'node:assert/strict';

console.log('🧪 Running Test Suite: Auto Pipeline YouTube Title Resolution...');

// ---------------------------------------------------------------------------
// 1. Logic Helper Test: High-CTR Title Extraction
// ---------------------------------------------------------------------------
export function extractSchedulerHighCtrTitle(cfItem, fallbackName = '') {
  let highCtrTitle = '';
  if (cfItem?.social_media_package_json) {
    try {
      const pkg = typeof cfItem.social_media_package_json === 'string'
        ? JSON.parse(cfItem.social_media_package_json)
        : cfItem.social_media_package_json;
      highCtrTitle = pkg?.title || '';
    } catch (_) {}
  }

  if (!highCtrTitle) {
    highCtrTitle = cfItem?.hook || cfItem?.campaign_title || fallbackName || '';
  }

  return String(highCtrTitle).trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100);
}

// Case 1: social_media_package.title exists
const itemWithPkgTitle = {
  campaign_title: '[Keyword Editorial] Solusi Thermal ID - harga glasswool per roll',
  hook: 'Mau pasang insulasi peredam panas?',
  social_media_package_json: JSON.stringify({
    title: 'Gerah? Ini Harga Glasswool Per Roll untuk Solusi Anti-Panas! #Shorts',
    caption: 'Caption content here'
  })
};
assert.equal(
  extractSchedulerHighCtrTitle(itemWithPkgTitle, 'Jadwal Mingguan'),
  'Gerah? Ini Harga Glasswool Per Roll untuk Solusi Anti-Panas! #Shorts',
  'Should prioritize social_media_package.title over campaign_title'
);

// Case 2: social_media_package.title empty, has hook
const itemWithHookOnly = {
  campaign_title: 'Habitfolk - Product: Eyevit Plus [Problem-Solution Based]',
  hook: 'Mata perih karena seharian menatap layar laptop?',
  social_media_package_json: JSON.stringify({
    title: '',
    caption: 'Caption content without title'
  })
};
assert.equal(
  extractSchedulerHighCtrTitle(itemWithHookOnly, 'Jadwal Harian'),
  'Mata perih karena seharian menatap layar laptop?',
  'Should fallback to hook when social_media_package.title is empty'
);

// Case 3: Both package title and hook empty
const itemWithCampaignTitleOnly = {
  campaign_title: 'Habitfolk - Product: Eyevit Plus [Problem-Solution Based]',
  hook: '',
  social_media_package_json: null
};
assert.equal(
  extractSchedulerHighCtrTitle(itemWithCampaignTitleOnly, 'Jadwal Harian'),
  'Habitfolk - Product: Eyevit Plus [Problem-Solution Based]',
  'Should fallback to campaign_title when hook and package title are missing'
);

// Case 4: Everything empty on item, use schedule name
const emptyItem = {
  campaign_title: '',
  hook: '',
  social_media_package_json: null
};
assert.equal(
  extractSchedulerHighCtrTitle(emptyItem, 'Jadwal Autopipeline Harian'),
  'Jadwal Autopipeline Harian',
  'Should fallback to schedule name when item has no titles'
);

console.log('  ✓ Scheduler High-CTR title extraction tests passed.');

// ---------------------------------------------------------------------------
// 2. Worker Defense-in-Depth Slug & Campaign Title Detection
// ---------------------------------------------------------------------------
export function isCampaignSlugPattern(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (
    /^\[(?:keyword editorial|editorial|product|resep|recipe)[^\]]*\]/i.test(trimmed) ||
    trimmed.includes(' - Product: ')
  );
}

assert.equal(isCampaignSlugPattern('[Keyword Editorial] Solusi Thermal ID - harga glasswool'), true);
assert.equal(isCampaignSlugPattern('[Product Campaign] Eyevit Plus'), true);
assert.equal(isCampaignSlugPattern('Habitfolk - Product: Eyevit Plus [Problem-Solution Based]'), true);
assert.equal(isCampaignSlugPattern('Gerah? Ini Harga Glasswool Per Roll untuk Solusi Anti-Panas! #Shorts'), false);
assert.equal(isCampaignSlugPattern('Cara Masak Bolu Kukus Mekar Merekah Anti Gagal'), false);

console.log('  ✓ Worker campaign slug pattern detection tests passed.');

console.log('🎉 All Auto Pipeline YouTube Title tests passed!');
process.exit(0);

