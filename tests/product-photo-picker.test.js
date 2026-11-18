import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCandidateScores,
  shouldRunSpatialCrop,
  decidePhotoStatus,
  pickBestProductPhoto
} from '../lib/product-photo-picker.js';

test('P2: evaluateCandidateScores selects clean product photo over higher scored photo with person', () => {
  const candidates = [
    { url: 'https://example.com/banner_person.jpg', w: 1600, h: 1600, source: 'og' },
    { url: 'https://example.com/product_bottle.jpg', w: 1200, h: 1200, source: 'dom' }
  ];

  const aiResult = {
    best_index: 0,
    candidates: [
      { index: 0, has_person: true, text_overlay: 'heavy', is_infographic: false, product_visible: true, score: 95 },
      { index: 1, has_person: false, text_overlay: 'none', is_infographic: false, product_visible: true, score: 80 }
    ]
  };

  const evalResult = evaluateCandidateScores(candidates, aiResult);
  assert.equal(evalResult.selectedIndex, 1, 'Should reject candidate 0 with person and pick candidate 1');
  assert.equal(evalResult.selectedCandidate.url, 'https://example.com/product_bottle.jpg');
  assert.equal(evalResult.needsReview, false);
});

test('P2: evaluateCandidateScores flags needsReview when all candidates contain persons or heavy text', () => {
  const candidates = [
    { url: 'https://example.com/banner1.jpg', w: 1200, h: 1200, source: 'dom' },
    { url: 'https://example.com/banner2.jpg', w: 1000, h: 1000, source: 'dom' }
  ];

  const aiResult = {
    best_index: 0,
    candidates: [
      { index: 0, has_person: true, text_overlay: 'heavy', text_area_pct: 60, is_infographic: false, product_visible: true, score: 90 },
      { index: 1, has_person: true, text_overlay: 'light', text_area_pct: 20, is_infographic: false, product_visible: true, score: 70 }
    ]
  };

  const evalResult = evaluateCandidateScores(candidates, aiResult);
  assert.equal(evalResult.needsReview, true);
  assert.equal(evalResult.reason, 'tidak ada foto layak, ganti foto manual');
  assert.equal(evalResult.selectedIndex, 0, 'Falls back to highest score candidate');
});

test('P2: evaluateCandidateScores rejects dominant infographics and collages', () => {
  const candidates = [
    { url: 'https://example.com/infographic.jpg', w: 1200, h: 1200, source: 'dom' },
    { url: 'https://example.com/collage.jpg', w: 1200, h: 1200, source: 'dom' },
    { url: 'https://example.com/clean.jpg', w: 1000, h: 1000, source: 'dom' }
  ];

  const aiResult = {
    best_index: 0,
    candidates: [
      { index: 0, has_person: false, text_overlay: 'heavy', text_area_pct: 60, is_infographic: true, is_collage: false, product_visible: true, score: 95 },
      { index: 1, has_person: false, text_overlay: 'light', text_area_pct: 10, is_infographic: false, is_collage: true, product_visible: true, score: 90 },
      { index: 2, has_person: false, text_overlay: 'light', text_area_pct: 15, is_infographic: false, is_collage: false, product_visible: true, score: 75 }
    ]
  };

  const evalResult = evaluateCandidateScores(candidates, aiResult);
  assert.equal(evalResult.selectedIndex, 2, 'Should reject infographic and collage and pick clean photo');
  assert.equal(evalResult.needsReview, false);
});

test('P2: pickBestProductPhoto fallback when vision call throws error', async () => {
  const candidates = [
    { url: 'https://example.com/cand1.jpg', w: 1000, h: 1000, source: 'dom' }
  ];

  const mockDownloadFn = async () => true;
  const mockVisionFn = async () => { throw new Error('API key expired or rate limit'); };

  const result = await pickBestProductPhoto({
    candidates,
    downloadFn: mockDownloadFn,
    generateWithImagesFn: mockVisionFn,
    tempDir: '/tmp/test_photo_picker'
  });

  assert.equal(result.needsReview, true);
  assert.ok(result.reason.includes('gagal'));
  assert.equal(result.selectedUrl, 'https://example.com/cand1.jpg');
});

test('P3: shouldRunSpatialCrop enforces cropping for new products & refresh_photo', () => {
  // New product
  assert.equal(shouldRunSpatialCrop({ isRepair: false, refreshPhoto: false, budgetMode: false }), true);
  assert.equal(shouldRunSpatialCrop({ isRepair: false, refreshPhoto: false, budgetMode: true }), true);

  // Refresh photo
  assert.equal(shouldRunSpatialCrop({ isRepair: true, refreshPhoto: true, budgetMode: false }), true);
  assert.equal(shouldRunSpatialCrop({ isRepair: true, refreshPhoto: true, budgetMode: true }), true);

  // Repair mode on budget
  assert.equal(shouldRunSpatialCrop({ isRepair: true, refreshPhoto: false, budgetMode: true }), false);
  assert.equal(shouldRunSpatialCrop({ isRepair: true, refreshPhoto: false, budgetMode: false }), true);
});

test('P4: decidePhotoStatus marks needs_review when person or error is detected', () => {
  // Clean product
  assert.deepEqual(
    decidePhotoStatus({ pickerNeedsReview: false, finalCheck: { has_person: false, has_heavy_text: false } }),
    { status: 'approved', error: null }
  );

  // Person detected in final check
  assert.deepEqual(
    decidePhotoStatus({ pickerNeedsReview: false, finalCheck: { has_person: true, has_heavy_text: false } }),
    { status: 'needs_review', error: 'foto memuat orang/teks' }
  );

  // Heavy text detected in final check
  assert.deepEqual(
    decidePhotoStatus({ pickerNeedsReview: false, finalCheck: { has_person: false, has_heavy_text: true } }),
    { status: 'needs_review', error: 'foto memuat orang/teks' }
  );

  // Picker had flagged needs_review
  assert.deepEqual(
    decidePhotoStatus({ pickerNeedsReview: true, pickerReason: 'semua kandidat memuat orang/teks', finalCheck: { has_person: false, has_heavy_text: false } }),
    { status: 'needs_review', error: 'semua kandidat memuat orang/teks' }
  );

  // Final check API error
  assert.deepEqual(
    decidePhotoStatus({ pickerNeedsReview: false, finalCheck: { error: 'Gemini timeout' } }),
    { status: 'needs_review', error: 'pemeriksaan foto gagal' }
  );
});

test('S5: getResolutionVariants generates valid hi-res variants for Tokopedia and Shopee', async () => {
  const { getResolutionVariants } = await import('../lib/product-photo-picker.js');

  // 1. Tokopedia / ByteDance resize-jpeg
  const topoResize = 'https://p16-oec-va.ibyteimg.com/tos-alisg-i-5142rr1fum/abc~tplv-5142rr1fum-resize-jpeg:200:0.jpeg';
  const variants1 = getResolutionVariants(topoResize);
  assert.ok(variants1.some(v => v.includes(':1200:0')));
  assert.ok(variants1.some(v => v.includes(':700:0')));

  // 2. Tokopedia img/cache/700/
  const topoCache = 'https://images.tokopedia.net/img/cache/700/VqbcmM/2026/product.jpg';
  const variants2 = getResolutionVariants(topoCache);
  assert.ok(variants2.some(v => v.includes('/img/cache/900/')));

  // 3. Shopee _tn
  const shopeeTn = 'https://down-id.img.susercontent.com/file/id-11134207-7ras9-test_tn.jpg';
  const variants3 = getResolutionVariants(shopeeTn);
  assert.ok(variants3.some(v => !v.includes('_tn')));
});
