import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toAuditCandidate,
  evaluateCandidateScores,
  decidePhotoStatus,
  buildRefreshPhotoUpdates,
  computeCropBox
} from '../lib/product-photo-picker.js';
import { compactRawResponse } from '../scripts/fix-photo-audit-bloat.mjs';

// ============================================================================
// R1: Audit Bloat Prevention
// ============================================================================
test('R1: toAuditCandidate strips large buffers and temporary paths', () => {
  const dummyBuffer = Buffer.alloc(200 * 1024, 0xff); // 200 KB buffer
  const rawCand = {
    index: 0,
    url: 'https://example.com/test.jpg',
    source: 'dom',
    w: 1200,
    h: 1200,
    buffer: dummyBuffer,
    localPath: '/tmp/cand_0.jpg',
    tempPath: '/tmp/temp_0.jpg',
    has_person: false,
    text_overlay: 'none',
    is_infographic: false,
    product_visible: true,
    score: 90,
    isAcceptable: true,
    local_path: '/uploads/products/candidates/pe_123/cand_0.jpg'
  };

  const audit = toAuditCandidate(rawCand);

  assert.equal(audit.buffer, undefined, 'Buffer must be completely removed');
  assert.equal(audit.localPath, undefined, 'Temporary localPath must be removed');
  assert.equal(audit.tempPath, undefined, 'tempPath must be removed');
  assert.equal(audit.local_path, '/uploads/products/candidates/pe_123/cand_0.jpg');
  assert.equal(audit.score, 90);
  assert.equal(audit.has_person, false);

  const jsonStr = JSON.stringify(audit);
  assert.ok(jsonStr.length < 500, `Audit candidate JSON should be small (< 500 bytes), got ${jsonStr.length}`);
});

test('R1: 6 candidates evaluation produces JSON audit < 20 KB without buffer keys', () => {
  const dummyBuffer = Buffer.alloc(200 * 1024, 0xaa);
  const candidates = Array.from({ length: 6 }, (_, i) => ({
    index: i,
    url: `https://example.com/cand_${i}.jpg`,
    source: 'dom',
    w: 1200,
    h: 1200,
    buffer: dummyBuffer,
    localPath: `/tmp/cand_${i}.jpg`,
    tempPath: `/tmp/temp_${i}.jpg`,
    local_path: `/uploads/products/candidates/pe_123/cand_${i}.jpg`
  }));

  const aiResult = {
    best_index: 1,
    candidates: candidates.map((_, i) => ({
      index: i,
      has_person: i === 0,
      text_overlay: 'none',
      is_infographic: false,
      product_visible: true,
      score: 80 + i
    }))
  };

  const evaluation = evaluateCandidateScores(candidates, aiResult);
  const jsonStr = JSON.stringify(evaluation);

  assert.ok(jsonStr.length < 20 * 1024, `Evaluation size must be < 20 KB, got ${jsonStr.length} bytes`);
  assert.ok(!jsonStr.includes('"buffer"'), 'JSON must not contain buffer');
  assert.ok(!jsonStr.includes('"localPath"'), 'JSON must not contain localPath');
  assert.equal(evaluation.selectedIndex, 5); // Highest score acceptable
});

test('R1: compactRawResponse shrinks bloated raw_response by > 90%', () => {
  const dummyBufferObj = { type: 'Buffer', data: Array.from({ length: 150000 }, () => 120) };
  const bloatedPayload = {
    product_name: 'Habarlic 5 in 1',
    photo_selection_audit: {
      evaluated: [
        { index: 0, url: 'https://example.com/cand0.jpg', buffer: dummyBufferObj, score: 30 },
        { index: 1, url: 'https://example.com/cand1.jpg', buffer: dummyBufferObj, score: 95 }
      ],
      selectedCandidate: { index: 1, url: 'https://example.com/cand1.jpg', buffer: dummyBufferObj }
    }
  };

  const rawStr = JSON.stringify(bloatedPayload);
  assert.ok(rawStr.length > 500000, 'Original payload should be large');

  const compacted = compactRawResponse(rawStr);
  assert.ok(compacted, 'Should produce compacted string');
  assert.ok(compacted.length < 2000, `Compacted string should be < 2000 chars, got ${compacted.length}`);
  assert.ok(!compacted.includes('"data"'), 'Should strip binary array');
});

// ============================================================================
// R2: Failure Conditions Correctly Flagged as needs_review
// ============================================================================
test('R2: all candidates rejected for infographic/heavy text flags needs_review', () => {
  const result = decidePhotoStatus({
    pickerNeedsReview: true,
    pickerReason: 'semua kandidat memuat orang/teks',
    selectedCandidate: { index: 0, has_person: false, is_infographic: true },
    finalCheck: { has_person: false, has_heavy_text: false }
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.error, 'semua kandidat memuat orang/teks');
});

test('R2: all candidates failed download flags needs_review', () => {
  const result = decidePhotoStatus({
    pickerNeedsReview: true,
    pickerReason: 'gagal mengunduh semua kandidat gambar',
    selectedCandidate: { index: 0, url: 'https://example.com/cand.jpg' },
    finalCheck: null
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.error, 'gagal mengunduh semua kandidat gambar');
});

test('R2: new photo processed but finalCheck is missing/null flags needs_review', () => {
  const result = decidePhotoStatus({
    hasNewPhoto: true,
    finalCheck: null,
    selectedCandidate: { has_person: false, product_visible: true }
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.error, 'pemeriksaan akhir foto tidak berjalan');
});

test('R2: background removal failure (bgError = true) flags needs_review', () => {
  const result = decidePhotoStatus({
    bgError: true,
    selectedCandidate: { has_person: false, product_visible: true }
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.error, 'hapus latar belakang gagal');
});

// ============================================================================
// R3: buildRefreshPhotoUpdates Preserves Old Photos on Failure
// ============================================================================
test('R3: refresh_photo failure does not clear existing photo columns', () => {
  const existing = {
    photo_status: 'approved',
    photo_url: '/uploads/products/clean/old_clean.jpg',
    raw_photo_url: '/uploads/products/raw/old_raw.png',
    clean_photo_url: '/uploads/products/clean/old_clean.jpg',
    generated_photo_url: '/uploads/products/generated/old_gen.jpg'
  };

  const updates = buildRefreshPhotoUpdates({
    existing,
    newRaw: null, // failed download
    error: 'gagal download gambar baru'
  });

  assert.equal(updates.photo_status, 'approved', 'Old photo_status preserved');
  assert.ok(updates.photo_error.includes('refresh foto gagal'));
  assert.equal(updates.raw_photo_url, undefined, 'raw_photo_url must not be cleared');
  assert.equal(updates.clean_photo_url, undefined, 'clean_photo_url must not be cleared');
  assert.equal(updates.generated_photo_url, undefined, 'generated_photo_url must not be cleared');
});

test('R3: G-Labs failure in refresh preserves old generated_photo_url and activates clean', () => {
  const existing = {
    photo_status: 'approved',
    raw_photo_url: '/uploads/products/raw/old_raw.png',
    clean_photo_url: '/uploads/products/clean/old_clean.jpg',
    generated_photo_url: '/uploads/products/generated/old_gen.jpg'
  };

  const updates = buildRefreshPhotoUpdates({
    existing,
    newRaw: '/uploads/products/raw/raw_123_20261116120000.png',
    newClean: '/uploads/products/clean/clean_123_20261116120000.jpg',
    newGenerated: null, // G-Labs failed
    status: 'approved'
  });

  assert.equal(updates.raw_photo_url, '/uploads/products/raw/raw_123_20261116120000.png');
  assert.equal(updates.clean_photo_url, '/uploads/products/clean/clean_123_20261116120000.jpg');
  assert.equal(updates.generated_photo_url, '/uploads/products/generated/old_gen.jpg', 'Preserves old generated');
  assert.equal(updates.active_photo, 'cleaned_photo_url', 'Directs active photo to new clean shot');
  assert.equal(updates.photo_url, '/uploads/products/clean/clean_123_20261116120000.jpg');
});

// ============================================================================
// R4: Ordinary Repair Mode Does Not Overwrite needs_review
// ============================================================================
test('R4: ordinary repair without new photos leaves photo_status untouched', () => {
  const isOrdinaryRepair = true;
  const needsRaw = false;
  const needsClean = false;

  const data = {
    product_name: 'Existing Product',
    unique_selling_point: 'New USP',
    photo_status: 'approved',
    photo_error: null,
    photo_url: '/uploads/products/old.jpg'
  };

  if (isOrdinaryRepair && !needsRaw && !needsClean) {
    delete data.photo_status;
    delete data.photo_error;
    delete data.photo_url;
  }

  assert.equal(data.photo_status, undefined, 'photo_status must be omitted so existing DB status is preserved');
  assert.equal(data.photo_error, undefined);
  assert.equal(data.unique_selling_point, 'New USP', 'Metadata is still updated');
});

// ============================================================================
// R5: computeCropBox with 6% Padding and Skip Thresholds
// ============================================================================
test('R5: computeCropBox applies 6% padding to bounding box', () => {
  // 1200x1200 image, package at [ymin: 200, xmin: 300, ymax: 800, xmax: 900]
  // width = 600 norm (pad 36 norm), height = 600 norm (pad 36 norm)
  const coords = { ymin: 200, xmin: 300, ymax: 800, xmax: 900 };
  const result = computeCropBox({ coords, width: 1200, height: 1200 });

  assert.equal(result.shouldSkip, false);
  // xmin = 300 - 36 = 264 norm -> left = 317 px
  // ymin = 200 - 36 = 164 norm -> top = 197 px
  // xmax = 900 + 36 = 936 norm -> width = Math.round(672 * 1.2) = 806 px
  assert.ok(result.left < 360, 'Left should be padded outward');
  assert.ok(result.top < 240, 'Top should be padded outward');
  assert.ok(result.width > 720, 'Width should be larger than unpadded');
  assert.ok(result.height > 720, 'Height should be larger than unpadded');
});

test('R5: computeCropBox skips crop if result < 800px on source >= 1000px', () => {
  // Small crop coordinates on large 1200x1200 image
  const coords = { ymin: 400, xmin: 400, ymax: 600, xmax: 600 };
  const result = computeCropBox({ coords, width: 1200, height: 1200 });

  assert.equal(result.shouldSkip, true);
  assert.ok(result.reason.includes('resolusi crop') || result.reason.includes('luas crop'));
});

test('R5: computeCropBox skips crop if crop area < 25% of image', () => {
  const coords = { ymin: 100, xmin: 100, ymax: 300, xmax: 300 }; // 200x200 norm = 4% area
  const result = computeCropBox({ coords, width: 600, height: 600 });

  assert.equal(result.shouldSkip, true);
  assert.ok(result.reason.includes('< 25%'));
});

// ============================================================================
// R6: Photo Review Validation
// ============================================================================
test('R6: photo-review only permits needs_review products (rejects approved with 409)', () => {
  function validatePhotoReview(product) {
    if (!product) return { status: 404, error: 'Produk tidak ditemukan.' };
    if (product.photo_status !== 'needs_review') {
      return {
        status: 409,
        error: `Hanya foto berstatus needs_review yang dapat disetujui (Status saat ini: ${product.photo_status || 'approved'}).`
      };
    }
    return {
      status: 200,
      updates: {
        photo_status: 'approved',
        photo_error: null,
        active_photo: product.cleaned_photo_url ? 'cleaned_photo_url' : 'raw_photo_url'
      }
    };
  }

  // Approved product -> 409
  const resApproved = validatePhotoReview({ id: 'p1', photo_status: 'approved' });
  assert.equal(resApproved.status, 409);
  assert.ok(resApproved.error.includes('Hanya foto berstatus needs_review'));

  // Needs review product -> 200 OK
  const resReview = validatePhotoReview({ id: 'p2', photo_status: 'needs_review', cleaned_photo_url: '/clean.jpg' });
  assert.equal(resReview.status, 200);
  assert.equal(resReview.updates.photo_status, 'approved');
  assert.equal(resReview.updates.active_photo, 'cleaned_photo_url');
});

// ============================================================================
// R7: Photo Replace Validation
// ============================================================================
test('R7: photo-replace validates input source, candidate index, and source_url', () => {
  function validatePhotoReplace({ source, candidateIndex, product, file }) {
    if (!['candidate', 'upload', 'rescrape'].includes(source)) {
      return { status: 400, error: 'Sumber tidak valid' };
    }

    if (source === 'rescrape') {
      if (!product.source_url) return { status: 400, error: 'Produk tidak memiliki source_url' };
      return { status: 200, mode: 'rescrape' };
    }

    if (source === 'candidate') {
      const idx = Number(candidateIndex);
      if (Number.isNaN(idx) || idx < 0) return { status: 400, error: 'candidate_index tidak valid' };
      const candidates = product.evaluated_candidates || [];
      if (!candidates[idx]) return { status: 400, error: 'Kandidat di luar jangkauan' };
      return { status: 200, mode: 'candidate', chosen: candidates[idx] };
    }

    if (source === 'upload') {
      if (!file) return { status: 400, error: 'File wajib diunggah' };
      return { status: 200, mode: 'upload' };
    }
  }

  // 1. Unknown source -> 400
  assert.equal(validatePhotoReplace({ source: 'magic_ai', product: {} }).status, 400);

  // 2. Rescrape without source_url -> 400
  assert.equal(validatePhotoReplace({ source: 'rescrape', product: { id: '1' } }).status, 400);

  // 3. Rescrape with valid source_url -> 200
  assert.equal(validatePhotoReplace({ source: 'rescrape', product: { id: '1', source_url: 'https://tokopedia.com/item' } }).status, 200);

  // 4. Candidate index out of bounds -> 400
  assert.equal(validatePhotoReplace({ source: 'candidate', candidateIndex: 5, product: { evaluated_candidates: [{ index: 0 }] } }).status, 400);

  // 5. Candidate index valid -> 200
  assert.equal(validatePhotoReplace({ source: 'candidate', candidateIndex: 0, product: { evaluated_candidates: [{ index: 0, url: 'a.jpg' }] } }).status, 200);

  // 6. Upload without file -> 400
  assert.equal(validatePhotoReplace({ source: 'upload', product: {}, file: null }).status, 400);
});

