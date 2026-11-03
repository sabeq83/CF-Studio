import test from 'node:test';
import assert from 'node:assert/strict';
import { getSystemVisualIdentity, listSystemVisualIdentities } from '../lib/visual-identity-system-presets.js';

test('1. Validasi 4 Preset Visual Identity Metafor Baru di Registry Sistem', () => {
  const keys = [
    'hydraulic_pipeline_metaphor',
    'decompression_gauge_metaphor',
    'chrono_restoration_metaphor',
    'luxury_rheology_metaphor'
  ];

  for (const key of keys) {
    const preset = getSystemVisualIdentity(key);
    assert.ok(preset, `Preset ${key} harus terdaftar di sistem`);
    assert.equal(preset.config.schema_version, '2');
    assert.equal(preset.config.visual_language.primary_style, 'commercial_product_cinematic');
    assert.equal(preset.config.metaphor_engine.enabled, true);
    assert.equal(preset.config.metaphor_engine.pattern, 'concept_to_object_to_action');
    assert.equal(preset.config.guardrails.face_visibility, 'prohibited');
    assert.equal(preset.config.wardrobe.sleeve_policy, 'wrists_covered');
    assert.ok(preset.config.environment.material_palette.length >= 3);
  }
});

test('2. listSystemVisualIdentities memuat semua preset metafor', () => {
  const all = listSystemVisualIdentities();
  const keys = all.map(p => p.key);
  assert.ok(keys.includes('hydraulic_pipeline_metaphor'));
  assert.ok(keys.includes('decompression_gauge_metaphor'));
  assert.ok(keys.includes('chrono_restoration_metaphor'));
  assert.ok(keys.includes('luxury_rheology_metaphor'));
});

test('3. Preset Visual Identity bebas dari kebocoran merek GarliBee dan sekuens klip', () => {
  const all = listSystemVisualIdentities();
  for (const p of all) {
    const raw = JSON.stringify(p);
    assert.ok(!raw.toLowerCase().includes('garlibee'), `Preset ${p.key} tidak boleh memuat merek garlibee`);
    const customDesc = p.config?.subject?.custom_description || '';
    assert.ok(!customDesc.includes('Clips 1 to 4'), `Preset ${p.key} subject description tidak boleh memuat meta-rule klip sekuensial`);
    assert.ok(!customDesc.includes('Clips 5-6'), `Preset ${p.key} subject description tidak boleh memuat meta-rule klip sekuensial`);
  }
});

