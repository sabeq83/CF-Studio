import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER_PHASE_META,
  pickPhaseLead,
  validateChapters,
  auditTextDensity
} from '../lib/finishing-plan-validator.js';
import { buildPhase1Timeline } from '../lib/finishing-overlay-renderer.js';

test('1. CHAPTER_PHASE_META and pickPhaseLead', () => {
  assert.ok(CHAPTER_PHASE_META.problem, 'problem phase exists');
  assert.ok(CHAPTER_PHASE_META.cause, 'cause phase exists');
  assert.ok(CHAPTER_PHASE_META.solution, 'solution phase exists');
  assert.ok(CHAPTER_PHASE_META.result, 'result phase exists');

  const leadId = pickPhaseLead(CHAPTER_PHASE_META.problem, { isEn: false, seed: 'test-123' });
  assert.ok(CHAPTER_PHASE_META.problem.id.includes(leadId), 'Lead should be from Indonesian list');

  const leadEn = pickPhaseLead(CHAPTER_PHASE_META.problem, { isEn: true, seed: 'test-123' });
  assert.ok(CHAPTER_PHASE_META.problem.en.includes(leadEn), 'Lead should be from English list');

  // Deterministic seed test
  const lead1 = pickPhaseLead(CHAPTER_PHASE_META.solution, { isEn: false, seed: 'stable-seed' });
  const lead2 = pickPhaseLead(CHAPTER_PHASE_META.solution, { isEn: false, seed: 'stable-seed' });
  assert.equal(lead1, lead2, 'Same seed must yield same lead');
});

test('2. validateChapters with grounded line and Satu Fokus single-card per phase', () => {
  const clipTokenLists = [
    ['suara', 'jalanan', 'tembus', 'ke', 'kamar'],
    ['celah', 'jendela', 'tanpa', 'peredam'],
    ['celah', 'masih', 'bocor'],
    ['pasang', 'panel', 'rockwool', 'slab'],
    ['kamar', 'jauh', 'lebih', 'tenang']
  ];

  const rawChapters = [
    { clip_index: 0, phase: 'problem', line: 'Suara jalanan tembus ke kamar' },
    { clip_index: 1, phase: 'cause', line: 'Celah jendela tanpa peredam' },
    { clip_index: 2, phase: 'cause', line: 'Celah masih bocor' }, // Should be skipped (cause already shown on clip 1)
    { clip_index: 3, phase: 'solution', line: 'Pasang panel rockwool slab' },
    { clip_index: 4, phase: 'result', line: 'Kamar jauh lebih tenang' }
  ];

  const warnings = [];
  const valid = validateChapters(rawChapters, {
    clipCount: 5,
    clipTokenLists,
    warnings
  });

  assert.equal(valid.length, 4, 'Should contain exactly 4 chapters (clip 2 cause skipped)');
  assert.equal(valid[0].clipIndex, 0);
  assert.equal(valid[0].phaseKey, 'problem');
  assert.equal(valid[0].line, 'Suara jalanan tembus ke kamar');
  assert.ok(valid[0].lead, 'Should have natural lead');

  assert.equal(valid[1].clipIndex, 1);
  assert.equal(valid[1].phaseKey, 'cause');

  assert.equal(valid[2].clipIndex, 3);
  assert.equal(valid[2].phaseKey, 'solution');

  assert.equal(valid[3].clipIndex, 4);
  assert.equal(valid[3].phaseKey, 'result');
});

test('3. validateChapters backward compatibility with legacy uppercase names', () => {
  const legacyChapters = [
    { clip_index: 0, phase: 'MASALAH' },
    { clip_index: 1, phase: 'PENYEBAB' },
    { clip_index: 2, phase: 'SOLUSI' },
    { clip_index: 3, phase: 'HASIL' }
  ];

  const valid = validateChapters(legacyChapters, { clipCount: 4 });
  assert.equal(valid.length, 4);
  assert.equal(valid[0].phaseKey, 'problem');
  assert.equal(valid[1].phaseKey, 'cause');
  assert.equal(valid[2].phaseKey, 'solution');
  assert.equal(valid[3].phaseKey, 'result');
});

test('4. validateChapters discards ungrounded line but keeps lead', () => {
  const clipTokenLists = [
    ['kopi', 'seduh', 'pagi', 'hari']
  ];
  const rawChapters = [
    { clip_index: 0, phase: 'problem', line: 'Pesawat terbang mendarat darurat' } // not in VO tokens
  ];
  const warnings = [];
  const valid = validateChapters(rawChapters, {
    clipCount: 1,
    clipTokenLists,
    warnings
  });

  assert.equal(valid.length, 1);
  assert.equal(valid[0].line, '', 'Ungrounded line must be stripped');
  assert.ok(valid[0].lead, 'Lead must still be present');
});

test('5. Fallback chapters in overlay renderer (only problem and solution)', () => {
  const timeline = buildPhase1Timeline({
    finishingTemplate: 'problem_solution',
    cleanVoiceoverClips: [
      'Tidur sering terganggu suara bising jalan',
      'Ternyata celah pintu yang jadi penyebabnya',
      'Gunakan peredam pintu rockwool kami',
      'Hasilnya tidur jadi jauh lebih nyenyak'
    ],
    productCard: { name: 'Peredam Rockwool' },
    totalDuration: 15
  });

  assert.ok(timeline.chapters, 'timeline.chapters should exist');
  assert.ok(timeline.chapters.length >= 1, 'Should have fallback chapters');

  // Should NOT generate a chapter for every single clip
  assert.ok(timeline.chapters.length <= 2, `Fallback chapters should be at most 2 (got ${timeline.chapters.length})`);
  assert.equal(timeline.chapters[0].phaseKey, 'problem');
  if (timeline.chapters.length === 2) {
    assert.equal(timeline.chapters[1].phaseKey, 'solution');
  }
});

test('6. auditTextDensity validates Satu Fokus compliance', () => {
  const timeline = buildPhase1Timeline({
    finishingTemplate: 'problem_solution',
    wordEvents: [
      { w: 'Halo', s: 0.2, e: 0.6, c: 0 },
      { w: 'semuanya', s: 0.65, e: 1.1, c: 0 }
    ],
    totalDuration: 10
  });

  const audit = auditTextDensity(timeline);
  assert.ok(audit.ok, `Timeline should pass text density audit: ${audit.summary}`);
  assert.ok(audit.maxBlocks <= 2, `maxBlocks should be <= 2 (got ${audit.maxBlocks})`);
});

setTimeout(() => process.exit(0), 100);
