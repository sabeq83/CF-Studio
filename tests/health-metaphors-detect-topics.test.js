import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_METAPHOR_MAP,
  resolveHealthMetaphor,
  detectHealthTopics
} from '../lib/health-metaphors.js';

test('resolveHealthMetaphor: seluruh 22 topik utama tetap menghasilkan snapshot identik', () => {
  const keys = Object.keys(HEALTH_METAPHOR_MAP);
  assert.equal(keys.length, 22);

  for (const key of keys) {
    const query = key.replace(/_/g, ' ');
    const resolved = resolveHealthMetaphor(query);
    assert.ok(resolved, `Topik "${key}" harus ter-resolve`);
    assert.equal(resolved.key, key);
    assert.equal(resolved.archetype, HEALTH_METAPHOR_MAP[key].archetype);
    assert.equal(resolved.archetype_label, HEALTH_METAPHOR_MAP[key].archetype_label);
    assert.equal(resolved.label, HEALTH_METAPHOR_MAP[key].label);
    assert.equal(resolved.hook_metaphor, HEALTH_METAPHOR_MAP[key].hook_metaphor);
    assert.equal(resolved.environment, HEALTH_METAPHOR_MAP[key].environment);
  }

  // Legacy alias smoke check
  assert.equal(resolveHealthMetaphor('asam lambung naik')?.key, 'maag');
  assert.equal(resolveHealthMetaphor('sendi kaku')?.key, 'persendian');
  assert.equal(resolveHealthMetaphor('') , null);
});

test('detectHealthTopics: mendukung alias baru dan mengembalikan array multi-topic unik', () => {
  assert.deepEqual(detectHealthTopics(''), []);
  assert.deepEqual(detectHealthTopics(null), []);

  assert.ok(detectHealthTopics('Sering makan gorengan dan santan bikin lemak menumpuk').includes('kolesterol'));
  assert.ok(detectHealthTopics('Program diet langsing sehat alami').includes('kolesterol'));
  assert.ok(detectHealthTopics('Perut begah dan sembelit susah BAB').includes('pencernaan'));
  assert.ok(detectHealthTopics('Kulit wajah kusam dan jerawat membandel').includes('kesehatan_kulit'));
  assert.ok(detectHealthTopics('Badan sering lesu, capek, dan lelah seharian').includes('stamina'));
  assert.ok(detectHealthTopics('Stres kerja memicu lonjakan cortisol').includes('fungsi_otak'));

  // Multi-topic detection
  const multi = detectHealthTopics('Habis makan gorengan berlemak jadi begah dan lesu');
  assert.ok(multi.includes('kolesterol'));
  assert.ok(multi.includes('pencernaan'));
  assert.ok(multi.includes('stamina'));
  assert.equal(new Set(multi).size, multi.length, 'Hasil harus unik tanpa duplikat');

  // "gula darah" tidak salah memicu sirkulasi_darah
  const sugarOnly = detectHealthTopics('Cara menjaga gula darah tetap stabil');
  assert.deepEqual(sugarOnly, ['gula_darah']);
});

