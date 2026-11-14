import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateVoQualityRows,
  evaluateAndGateVoQuality,
  validateVoQuality
} from '../lib/vo-quality-validator.js';
import { validateFinishingOverlayAgainstVo } from '../lib/finishing-plan-validator.js';

const goodPayload = {
  search_intent: 'Kenapa suara luar masih menembus pintu kamar yang tertutup?',
  search_answer: 'Suara bocor lewat celah bawah 3-5 mm dan kusen yang tidak rapat.',
  takeaways: [
    { point: 'Pasang door sweep karet di bawah daun pintu', anchor: 'tutup celah bawah 3-5 mm', anchor_type: 'angka', source: 'pengetahuan_umum' },
    { point: 'Tempel weatherstrip pada tiga sisi kusen', anchor: 'sisi kiri kanan atas kusen', anchor_type: 'titik', source: 'pengetahuan_umum' }
  ]
};

test('V4 Pass Case: Concrete anchored script in id-ID passes with high score', () => {
  const clips = [
    'Pintu kamar ditutup rapat tapi suara bising dari luar masih tembus?',
    'Suara bocor lewat celah bawah 3-5 mm dan kusen pintu yang renggang.',
    'Pasang door sweep karet agar celah bawah 3-5 mm tertutup rapat merata.',
    'Tempel weatherstrip di tiga sisi kusen lalu simpan panduan ini buat dicek nanti.'
  ];
  const res = validateVoQuality({
    clips,
    contentPayload: goodPayload,
    isKeywordMode: true,
    targetLanguage: 'id-ID',
    wordsPerClip: '17-19 kata',
    expectedClipsCount: 4
  });
  assert.equal(res.passed, true);
  assert.equal(res.status, 'pass');
  assert.equal(res.score, 100);
  assert.ok(res.metrics.anchor_ratio >= 0.6);
  assert.ok(res.metrics.anchor_recall_ratio >= 0.8);
});

test('V4 Fail Cases: Catches herbal claims, missing ingredients, AI hype EN, repeat opener, clip mismatch, and overlay claim', () => {
  const herbalFail = validateVoQuality({
    clips: [
      'Rutinitas pagi cepat dengan segelas air hangat yang menyegarkan.',
      'Minum racikan ini membantu rontokkan lemak visceral dan jaga paru-paru tetap bersih.',
      'Yuk coba sekarang supaya kualitas tidur kembali maksimal dan optimal.'
    ],
    isHerbalOrHealth: true,
    targetLanguage: 'id-ID',
    wordsPerClip: '17-19 kata',
    expectedClipsCount: 6
  });
  assert.equal(herbalFail.passed, false);
  assert.ok(herbalFail.metrics.claim_hits.length > 0);
  assert.ok(herbalFail.reasons.some(r => r.includes('Klaim terlarang')));
  assert.ok(herbalFail.reasons.some(r => r.includes('Jumlah klip VO (3)')));
  assert.ok(herbalFail.reasons.some(r => r.includes('template CTA generik')));

  const mulFail = validateVoQuality({
    clips: [
      'Siapkan bahan pilihan di dapur sebelum memulai seduhan malam.',
      'Padahal banyak orang langsung merebus rempah ini sebentar tanpa takaran.',
      'Padahal rebusan cepat hanya menghasilkan rasa hambar di gelas.',
      'Nah sajikan hangat setelah disaring perlahan.'
    ],
    sourceRecipeLock: {
      ingredients: [
        { name: 'biji adas', amount: '1 sdm' },
        { name: 'kayu manis', amount: '1 batang' }
      ]
    },
    targetLanguage: 'id-ID',
    wordsPerClip: '17-19 kata'
  });
  assert.equal(mulFail.passed, false);
  assert.deepEqual(mulFail.metrics.missing_ingredients, ['biji adas', 'kayu manis']);
  assert.equal(mulFail.metrics.consecutive_repeat_opener, 1);
  assert.ok(mulFail.metrics.transition_markers > 1);

  const enFail = validateVoQuality({
    clips: [
      'Why does morning light help reset your daily work rhythm fast?',
      'It is not only a game changer for your desk, simply optimal comfort.',
      'Open curtains within 15 minutes of waking for natural focus.',
      'Save this checklist for Monday morning.'
    ],
    targetLanguage: 'en-US',
    wordsPerClip: '15-18 kata'
  });
  assert.equal(enFail.passed, false);
  assert.ok(enFail.metrics.en_hype_hits.includes('not only'));
  assert.ok(enFail.metrics.en_hype_hits.includes('game changer'));

  const overlayCheck = validateFinishingOverlayAgainstVo({
    finishingPlan: {
      tips: [{ clip_index: 1, text: 'Bakar lemak visceral cepat' }]
    },
    voLines: ['Seduh satu sendok madu dengan air hangat'],
    isHerbal: true
  });
  assert.equal(overlayCheck.valid, false);
  assert.ok(overlayCheck.claimHits.some(h => h.includes('lemak')));
});

test('V4 Gates: off skips, warn passes non-blocking, enforce runs 1x rewrite and blocks if still bad', async () => {
  const badClips = [
    'Pintu kamar ditutup rapat tapi suara bising dari luar masih tembus?',
    'Hidup tenang terasa lebih nyaman dan optimal sepanjang hari.',
    'Suasana damai membuat kamar terasa praktis bagi semua orang.',
    'Yuk coba sekarang di rumah.'
  ];

  const offRes = await evaluateAndGateVoQuality({ clips: badClips, gateMode: 'off', contentPayload: goodPayload });
  assert.equal(offRes.skipped, true);
  assert.equal(offRes.blocked, false);

  const warnRes = await evaluateAndGateVoQuality({ clips: badClips, gateMode: 'warn', contentPayload: goodPayload, isKeywordMode: true });
  assert.equal(warnRes.passed, false);
  assert.equal(warnRes.blocked, false);
  assert.equal(warnRes.status, 'warn');

  let rewriteCalls = 0;
  const enforcePassRes = await evaluateAndGateVoQuality({
    clips: badClips,
    gateMode: 'enforce',
    contentPayload: goodPayload,
    isKeywordMode: true,
    wordsPerClip: '17-19 kata',
    rewriteFn: async () => {
      rewriteCalls += 1;
      return {
        applied: true,
        voLines: [
          'Pintu kamar ditutup rapat tapi suara bising dari luar masih tembus?',
          'Suara bocor lewat celah bawah 3-5 mm dan kusen yang renggang.',
          'Pasang door sweep karet di celah bawah 3-5 mm lalu tempel weatherstrip kusen.',
          'Cek sisi kiri kanan atas kusen pintu kamarmu malam ini.'
        ]
      };
    }
  });
  assert.equal(rewriteCalls, 1);
  assert.equal(enforcePassRes.passed, true);
  assert.equal(enforcePassRes.blocked, false);
  assert.equal(enforcePassRes.status, 'pass_after_rewrite');

  const enforceBlockRes = await evaluateAndGateVoQuality({
    clips: badClips,
    gateMode: 'enforce',
    contentPayload: goodPayload,
    isKeywordMode: true,
    rewriteFn: async () => ({ applied: true, voLines: badClips })
  });
  assert.equal(enforceBlockRes.passed, false);
  assert.equal(enforceBlockRes.blocked, true);
  assert.equal(enforceBlockRes.gateAction, 'block_waiting_approval');
});

test('V4 Weekly Brand Analytics Aggregation computes per-brand pass rate and failure reasons', () => {
  const report = aggregateVoQualityRows([
    {
      brand_name: 'Siasat',
      vo_quality_status: 'pass',
      vo_quality_score_json: JSON.stringify({ score: 95, passed: true, metrics: { anchor_ratio: 1, vague_without_anchor: 0, claim_hits: [] }, reasons: [] })
    },
    {
      brand_name: 'Siasat',
      vo_quality_status: 'blocked',
      vo_quality_score_json: JSON.stringify({ score: 45, passed: false, metrics: { anchor_ratio: 0.25, vague_without_anchor: 4, claim_hits: ['paru-paru'] }, reasons: ['Klaim terlarang'] })
    },
    {
      brand_name: 'Habitfolk',
      vo_quality_status: 'pass_after_rewrite',
      vo_quality_score_json: JSON.stringify({ score: 88, passed: true, metrics: { anchor_ratio: 0.8, vague_without_anchor: 1, claim_hits: [] }, reasons: [] })
    }
  ]);

  assert.equal(report.summary.total_audited, 3);
  assert.equal(report.summary.pass_count, 2);
  assert.equal(report.summary.blocked_count, 1);
  assert.equal(report.by_brand.Siasat.pass_rate, 50);
  assert.equal(report.by_brand.Siasat.claim_hits, 1);
  assert.equal(report.by_brand.Habitfolk.pass_rate, 100);
});
