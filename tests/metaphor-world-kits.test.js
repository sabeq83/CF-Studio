import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METAPHOR_WORLD_KITS,
  GENRE_LABEL,
  PRE_BRIDGE_FORBIDDEN_WORDS_RE,
  getKit,
  listKitsByTopics,
  validateKit,
  toLegacyMetaphorShape,
  mapBeatsToClips,
  buildMetaphorWorldKitSection,
} from '../lib/metaphor-world-kits.js';

test('METAPHOR_WORLD_KITS: tepat 28 seed kit dengan key unik dan seluruhnya lolos validateKit', () => {
  assert.equal(METAPHOR_WORLD_KITS.length, 28, 'Seed library harus berisi 28 kit');

  const keys = new Set();
  for (const kit of METAPHOR_WORLD_KITS) {
    assert.ok(!keys.has(kit.key), `Duplicate kit key: ${kit.key}`);
    keys.add(kit.key);

    const check = validateKit(kit);
    assert.equal(check.valid, true, `Kit "${kit.key}" gagal validasi: ${check.errors.join('; ')}`);

    // Pastikan nama merek Bundayes tidak disalin ke isi kit (hanya slug konsep di source)
    const serialized = JSON.stringify({ ...kit, source: undefined });
    assert.ok(!/bundayes/i.test(serialized), `Kit "${kit.key}" tidak boleh menyebut nama merek sumber`);
  }
});

test('Cakupan topik utama herbal >= 4 kit dan topik berisiko tinggi (kanker/kandungan_wanita) dikecualikan', () => {
  const mainTopics = ['kolesterol', 'pencernaan', 'gula_darah', 'detox', 'kesehatan_kulit'];
  for (const topic of mainTopics) {
    const kits = listKitsByTopics([topic]);
    assert.ok(kits.length >= 4, `Topik "${topic}" harus memiliki minimal 4 kit (aktual: ${kits.length})`);
  }

  assert.deepEqual(listKitsByTopics(['pencegahan_kanker']), []);
  assert.deepEqual(listKitsByTopics(['kandungan_wanita']), []);
});

test('Lint kepatuhan F1: beat pre-bridge (problem/threat/struggle/failure) bebas kata tangan/produk', () => {
  for (const kit of METAPHOR_WORLD_KITS) {
    for (const beatName of ['problem', 'threat', 'struggle', 'failure']) {
      const text = kit.beats[beatName];
      assert.equal(
        PRE_BRIDGE_FORBIDDEN_WORDS_RE.test(text),
        false,
        `Kit "${kit.key}" beat "${beatName}" melanggar lint object-only: "${text}"`
      );
    }
  }
});

test('Helper toLegacyMetaphorShape, getKit, mapBeatsToClips, dan buildMetaphorWorldKitSection berfungsi akurat', () => {
  const kit = getKit('grease_in_water');
  assert.ok(kit);
  assert.equal(getKit('non_existent'), null);

  const legacy = toLegacyMetaphorShape(kit);
  assert.equal(legacy.key, 'grease_in_water');
  assert.equal(legacy.label, kit.label);
  assert.equal(legacy.archetype, 'kitchen_science_demo');
  assert.equal(legacy.archetype_label, GENRE_LABEL.kitchen_science_demo);
  assert.equal(legacy.hook_metaphor, kit.beats.problem);
  assert.equal(legacy.environment, kit.environment);
  assert.equal(legacy.kit_key, 'grease_in_water');
  assert.equal(legacy.kit, kit);

  // Beat mapping pre-bridge tidak boleh memancarkan reaction/result sebelum bridgeAtClip
  const mapped = mapBeatsToClips(6, 4);
  assert.equal(mapped.length, 6);
  for (const entry of mapped) {
    if (entry.clip < 4) {
      assert.ok(['problem', 'threat', 'struggle', 'failure'].includes(entry.beat));
      assert.equal(entry.zone, 'pre');
    } else {
      assert.ok(['reaction', 'result'].includes(entry.beat));
      assert.equal(entry.zone, 'post');
    }
  }
  assert.equal(mapped[0].beat, 'problem');
  assert.equal(mapped[5].beat, 'result');

  const section = buildMetaphorWorldKitSection(kit, { targetClips: 6, bridgeAtClip: 4 });
  assert.ok(section.includes('METAPHOR WORLD KIT:'));
  assert.ok(section.includes(kit.object_world));
  assert.ok(section.includes(kit.environment));
  assert.ok(section.includes(kit.vo_bridge));
});

