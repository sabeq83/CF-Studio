import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleOverlayLayers, LAYER_PRIORITY, collectCandidatesFromTimeline } from '../lib/finishing-layer-scheduler.js';

test('1. Layer priority and candidate extraction', () => {
  const sampleTimeline = {
    config: { hookDuration: 1.75 },
    hookCard: { l1: 'Resep Rahasia', l2: 'Ayam Krispi' },
    punches: [{ s: 5.5, e: 6.2, word: 'KRISPI' }],
    recipe: {
      ingredients: {
        s: 1.85,
        until: 5.2,
        items: [{ label: 'Tepung terigu', s: 1.85, e: 3.5 }]
      },
      steps: [
        { s: 5.3, e: 9.0, badge: 'LANGKAH 1/3', t: 'Campur tepung' }
      ]
    },
    productCard: { name: 'Minyak Goreng Nabati', s: 12.0, e: 16.0 },
    savePrompt: { titleText: 'Simpan Resep Ini', s: 18.0, e: 21.0 }
  };

  const candidates = collectCandidatesFromTimeline(sampleTimeline);
  assert.ok(candidates.length >= 5, 'Should collect all candidate layers');

  const layers = candidates.map((c) => c.layer);
  assert.ok(layers.includes('hook'));
  assert.ok(layers.includes('punch'));
  assert.ok(layers.includes('ingredients'));
  assert.ok(layers.includes('step'));
  assert.ok(layers.includes('product'));
  assert.ok(layers.includes('save'));
});

test('2. Schedule layers enforces minDwell (>=1.2s) and gap (>=0.25s)', () => {
  const timeline = {
    config: { hookDuration: 1.75 },
    hookCard: { l1: 'Hook Header', l2: 'Hook Detail' },
    punches: [{ s: 8.0, e: 8.8, word: 'PUNCH' }],
    recipe: {
      ingredients: {
        s: 1.85,
        until: 5.0,
        items: [{ label: 'Bahan 1', s: 1.85, e: 5.0 }]
      },
      steps: [
        { s: 5.2, e: 8.5, badge: 'STEP 1', t: 'Langkah Satu' },
        { s: 9.0, e: 13.0, badge: 'STEP 2', t: 'Langkah Dua' }
      ]
    },
    productCard: { name: 'Produk Andalan', s: 13.2, e: 17.0 }
  };

  scheduleOverlayLayers(timeline, { minDwell: 1.2, gap: 0.25 });

  assert.ok(Array.isArray(timeline.slots), 'timeline.slots should be created');
  assert.ok(Array.isArray(timeline.subtitleCompact), 'timeline.subtitleCompact should be created');

  const topSlots = timeline.slots.filter((s) => s.zone === 'top');
  for (let i = 0; i < topSlots.length; i++) {
    const slot = topSlots[i];
    const dur = slot.e - slot.s;
    assert.ok(dur >= 1.19, `Top slot ${slot.layer} (${slot.s}s - ${slot.e}s) must be at least minDwell (1.2s)`);

    if (i < topSlots.length - 1) {
      const nextSlot = topSlots[i + 1];
      const gapBetween = nextSlot.s - slot.e;
      assert.ok(gapBetween >= 0.20, `Gap between ${slot.layer} and ${nextSlot.layer} must be at least 0.25s (got ${gapBetween.toFixed(2)})`);
    }
  }
});

test('3. Satu Fokus (R1): No simultaneous top and mid cards', () => {
  const timeline = {
    config: { hookDuration: 1.75 },
    hookCard: { l1: 'Hook', l2: 'Hook' },
    punches: [
      { s: 4.0, e: 4.8, word: 'BOOM' },
      { s: 10.0, e: 10.6, word: 'WOW' }
    ],
    tips: [
      { s: 1.5, e: 5.0, text: 'Tip 1 overlapping hook and punch' },
      { s: 9.5, e: 13.0, text: 'Tip 2 overlapping punch' }
    ]
  };

  scheduleOverlayLayers(timeline, { minDwell: 1.2, gap: 0.25 });

  // Sample every 0.1s from 0 to 15s to verify R1: at most 1 top or mid card active
  for (let t = 0; t <= 15.0; t += 0.1) {
    const activeMid = timeline.slots.filter((s) => s.zone === 'mid' && t >= s.s && t < s.e);
    const activeTop = timeline.slots.filter((s) => s.zone === 'top' && t >= s.s && t < s.e);

    if (activeMid.length > 0) {
      assert.equal(activeTop.length, 0, `At time ${t.toFixed(1)}s, mid card is active so top card must NOT be active`);
    }
    assert.ok(activeTop.length <= 1, `At time ${t.toFixed(1)}s, at most 1 top card may be active`);
  }
});

test('4. Subtitle compact windows match top zone cards', () => {
  const timeline = {
    config: { hookDuration: 1.75 },
    productCard: { name: 'Kopi Nusantara', s: 3.0, e: 6.0 },
    savePrompt: { titleText: 'Save', s: 7.0, e: 9.5 }
  };

  scheduleOverlayLayers(timeline, { minDwell: 1.2, gap: 0.25 });

  assert.equal(timeline.subtitleCompact.length, 2);
  assert.equal(timeline.subtitleCompact[0].layer, 'product');
  assert.equal(timeline.subtitleCompact[1].layer, 'save');
});

