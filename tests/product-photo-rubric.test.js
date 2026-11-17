import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateCandidateScores, decidePhotoStatus } from '../lib/product-photo-picker.js';

const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'photo_picker_cuculemon_eval.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('S6: evaluateCandidateScores selects clean product photo with light text (Cuculemon case)', () => {
  const candidates = [
    { url: 'https://images.tokopedia.net/img/cache/700/cand0.jpg', w: 700, h: 700 },
    { url: 'https://images.tokopedia.net/img/cache/700/cand1.jpg', w: 700, h: 700 },
    { url: 'https://images.tokopedia.net/img/cache/700/cand2.jpg', w: 700, h: 700 }
  ];

  const evalResult = evaluateCandidateScores(candidates, fixtures.cuculemon);

  assert.equal(evalResult.needsReview, false, 'Cuculemon dengan label kecil harus lolos tanpa needsReview');
  assert.equal(evalResult.selectedIndex, 0, 'Kandidat 0 dengan skor 92 harus terpilih');
  assert.equal(evalResult.shouldAttemptClean, true);
  assert.equal(evalResult.selectedCandidate?.score, 92);
  assert.equal(evalResult.selectedCandidate?.text_area_pct, 8);
  assert.equal(evalResult.selectedCandidate?.has_person, false);
});

test('S6: evaluateCandidateScores rejects candidates with person/model (Habarlic banner case)', () => {
  const candidates = [
    { url: 'https://images.tokopedia.net/img/cache/700/habarlic_person_0.jpg', w: 700, h: 700 },
    { url: 'https://images.tokopedia.net/img/cache/700/habarlic_person_1.jpg', w: 700, h: 700 }
  ];

  const evalResult = evaluateCandidateScores(candidates, fixtures.habarlic_person_banner);

  assert.equal(evalResult.needsReview, true, 'Kandidat dengan orang/banner endorser harus ditandai needsReview');
  assert.equal(evalResult.shouldAttemptClean, false, 'Tidak ada kandidat layak tanpa orang, lewati clean');
  assert.equal(evalResult.reason, 'tidak ada foto layak, ganti foto manual');
});

test('S7: evaluateCandidateScores allows fallback clean for non-person candidate score >= 70', () => {
  const candidates = [
    { url: 'https://images.tokopedia.net/img/cache/700/cand_dense_text.jpg', w: 700, h: 700 },
    { url: 'https://images.tokopedia.net/img/cache/700/cand_with_person.jpg', w: 700, h: 700 }
  ];

  const evalResult = evaluateCandidateScores(candidates, fixtures.fallback_clean_candidate);

  assert.equal(evalResult.needsReview, true, 'Fallback harus ditandai needsReview');
  assert.equal(evalResult.shouldAttemptClean, true, 'Kandidat tanpa orang dengan skor >= 70 harus dicoba pembersihan clean');
  assert.equal(evalResult.reason, 'dipilih otomatis, perlu ditinjau');
  assert.equal(evalResult.selectedIndex, 0);

  // Verifikasi pembentukan status di decidePhotoStatus
  const statusDecision = decidePhotoStatus({
    pickerNeedsReview: evalResult.needsReview,
    pickerReason: evalResult.reason,
    selectedCandidate: evalResult.selectedCandidate,
    finalCheck: { has_person: false, has_heavy_text: false },
    bgError: false,
    hasNewPhoto: true
  });

  assert.equal(statusDecision.status, 'needs_review');
  assert.ok(statusDecision.error.includes('dipilih otomatis, perlu ditinjau'));
});

test('S7: evaluateCandidateScores marks manual replacement when all candidates have person or score < 70', () => {
  const candidates = [
    { url: 'https://images.tokopedia.net/img/cache/700/cand_bad_1.jpg', w: 700, h: 700 },
    { url: 'https://images.tokopedia.net/img/cache/700/cand_bad_2.jpg', w: 700, h: 700 }
  ];

  const badAiEval = {
    best_index: 0,
    candidates: [
      { index: 0, has_person: true, text_overlay: 'heavy', text_area_pct: 60, is_infographic: true, is_collage: false, product_visible: true, score: 55 },
      { index: 1, has_person: false, text_overlay: 'heavy', text_area_pct: 80, is_infographic: true, is_collage: false, product_visible: false, score: 40 }
    ]
  };

  const evalResult = evaluateCandidateScores(candidates, badAiEval);

  assert.equal(evalResult.needsReview, true);
  assert.equal(evalResult.shouldAttemptClean, false);
  assert.equal(evalResult.reason, 'tidak ada foto layak, ganti foto manual');
});
