import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VAGUE_WORDS_ID,
  VAGUE_WORDS_EN,
  buildClipPlanForTargetClips,
  buildVoContentPayloadPrompt,
  buildBatchVoContentPayloadPrompt,
  normalizeVoContentPayload
} from '../lib/vo-content-payload.js';
import { autoDetectNarrativeMode } from '../lib/pillar-campaign-ingest.js';

test('V1: buildVoContentPayloadPrompt supports id-ID, en-US, >5 clips, and Cartoon Universe', () => {
  const idPrompt = buildVoContentPayloadPrompt({
    brandName: 'Siasat',
    kind: 'brand_editorial',
    pillar: 'peredam suara pintu kamar',
    hook: 'Pintu kamar ditutup rapat tapi suara luar tetap tembus?',
    clips: 4,
    wordsPerClip: '17-19 kata',
    targetLanguage: 'id-ID'
  });
  assert.ok(idPrompt.includes('search_intent'));
  assert.ok(idPrompt.includes('search_answer'));
  assert.ok(idPrompt.includes('takeaways'));
  assert.ok(idPrompt.includes('needs_data'));
  assert.ok(idPrompt.includes(VAGUE_WORDS_ID[0]));

  const enPrompt = buildVoContentPayloadPrompt({
    brandName: 'Habitfolk',
    kind: 'cartoon_universe',
    pillar: 'morning water bowl routine',
    hook: 'Why did Mochi skip her morning water bowl today?',
    clips: 7,
    wordsPerClip: '15-18 kata',
    targetLanguage: 'en-US',
    storyPremise: 'Mochi refuses stale tap water',
    petProblem: 'Film on bowl surface',
    productRole: 'supporting_solution'
  });
  assert.ok(enPrompt.includes('CONTENT SUBSTANCE') || enPrompt.includes('CONCRETE SUBSTANCE'));
  assert.ok(enPrompt.includes('clip_plan'));
  assert.ok(enPrompt.includes(VAGUE_WORDS_EN[0]));
  assert.ok(enPrompt.includes('Mochi refuses stale tap water'));
});

test('V1: normalizeVoContentPayload caps takeaways at 3, generates clip_plan for >5 clips, and flags herbal claims', () => {
  const raw = {
    search_intent: 'Kenapa suara tembus lewat pintu?',
    search_answer: 'Celah bawah dan kusen pintu meloloskan getaran udara.',
    takeaways: [
      { point: 'Pasang door sweep di celah bawah pintu', anchor: 'celah 3-5 mm di bawah daun pintu', anchor_type: 'titik', source: 'pengetahuan_umum' },
      { point: 'Tempel weatherstrip karet di kusen', anchor: 'sepanjang sisi kiri kanan atas kusen', anchor_type: 'titik', source: 'pengetahuan_umum' },
      { point: 'Turunkan lemak visceral segera', anchor: 'minum 1 sendok', anchor_type: 'angka', source: 'data_produk' },
      { point: 'Keempat harus terpotong', anchor: 'tidak boleh masuk', anchor_type: 'kriteria', source: 'pengetahuan_umum' }
    ],
    needs_data: ['[butuh data: densitas busa]']
  };
  const normalized = normalizeVoContentPayload(raw, { targetClips: 7, isHerbalTarget: true });
  assert.equal(normalized.takeaways.length, 3);
  assert.ok(Array.isArray(normalized.clip_plan));
  assert.equal(normalized.clip_plan.length, 7);
  assert.deepEqual(normalized.needs_data, ['[butuh data: densitas busa]']);
  assert.ok(normalized.claim_warnings.includes('lemak visceral'));

  const batchPrompt = buildBatchVoContentPayloadPrompt([{ sequence: 1, pillar: 'pintu', hook: 'Hook test' }], {
    brandName: 'Siasat',
    clips: 4,
    targetLanguage: 'id-ID'
  });
  assert.ok(batchPrompt.includes('"sequence":1'));
  assert.equal(buildClipPlanForTargetClips(4, 2), null);
});

test('V1: autoDetectNarrativeMode respects vo_content_contract off vs on', () => {
  const row = { pillar: 'harga vinyl lantai per meter', strategic_angle: 'cara hitung kebutuhan', narrative_mode: 'Storytelling' };
  assert.equal(autoDetectNarrativeMode(row, { voContentContract: 'off', isKeywordMode: true }), 'Storytelling');
  assert.equal(autoDetectNarrativeMode(row, { voContentContract: 'on', isKeywordMode: true }), 'Tips/Tutorial');
  assert.equal(autoDetectNarrativeMode({ pillar: 'tips merawat kulit', narrative_mode: 'auto' }, { voContentContract: 'on', isKeywordMode: false }), 'Tips/Tutorial');
  assert.equal(autoDetectNarrativeMode({ pillar: 'tips merawat kulit', narrative_mode: 'auto' }, { voContentContract: 'off', isKeywordMode: false }), 'Educational Review');
});

