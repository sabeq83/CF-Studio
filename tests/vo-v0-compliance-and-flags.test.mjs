import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VO_CONTENT_CONTRACT,
  DEFAULT_VO_QUALITY_GATE,
  parseVoOverrideFields,
  resolveEffectiveVoSettings
} from '../lib/vo-contract-registry.js';
import { listOperatorPresets } from '../lib/operator-presets.js';
import {
  findVoClaimViolations,
  isHerbalMedicalClaimPhrase,
  resolveIsHerbalOrHealthTarget,
  detectMultiplierAuditContamination,
  validateMultiplierAuditRevision
} from '../lib/tiktok-compliance-service.js';
import { enforceHerbalHookSafety } from '../lib/content-planner-engine.js';
import { validateBrandPatchSpec } from '../lib/finishing-plan-validator.js';

test('V0 Flag Registry: defaults to off and rejects invalid enum values', () => {
  assert.equal(DEFAULT_VO_CONTENT_CONTRACT, 'off');
  assert.equal(DEFAULT_VO_QUALITY_GATE, 'off');

  const presets = listOperatorPresets('default_tenant');
  assert.ok(presets.length >= 5);
  for (const p of presets) {
    assert.equal(p.config?.workflow?.vo_content_contract, 'off', `Preset ${p.key} must default vo_content_contract to off`);
    assert.equal(p.config?.workflow?.vo_quality_gate, 'off', `Preset ${p.key} must default vo_quality_gate to off`);
  }

  const ok = parseVoOverrideFields({ vo_content_contract: 'on', vo_quality_gate: 'enforce' });
  assert.equal(ok.error, null);
  assert.deepEqual(ok.updates, { vo_content_contract: 'on', vo_quality_gate: 'enforce' });

  const badContract = parseVoOverrideFields({ vo_content_contract: 'always' });
  assert.equal(badContract.status, 400);

  const badGate = parseVoOverrideFields({ vo_quality_gate: 'strict' });
  assert.equal(badGate.status, 400);

  const eff = resolveEffectiveVoSettings({
    overrides: { vo_quality_gate: 'enforce' },
    campaign: { vo_content_contract: 'on', vo_quality_gate: 'warn' },
    preset: { workflow: { vo_content_contract: 'off', vo_quality_gate: 'off' } }
  });
  assert.deepEqual(eff, { vo_content_contract: 'on', vo_quality_gate: 'enforce' });
});

test('V0-1 Multiplier Audit Mapper: rejects scene count mismatch & caption/emoji/bullet leakage', () => {
  const originalLines = [
    'Campur satu sendok madu dan bawang putih.',
    'Diamkan tiga hari dalam toples kaca.',
    'Ambil satu siung setiap pagi.',
    'Simpan di suhu ruang yang kering.'
  ];

  // 1. Mismatch scene count -> reject & send to review
  const mismatch = validateMultiplierAuditRevision({
    auditResult: { verdict: 'revise', revised_script: ['Klip satu aman.', 'Klip dua aman.'] },
    originalLines
  });
  assert.equal(mismatch.isRevisionApplied, false);
  assert.equal(mismatch.needsManualReview, true);
  assert.match(mismatch.warning, /tidak cocok/);

  // 2. Emoji contamination -> reject
  assert.deepEqual(detectMultiplierAuditContamination('Minum hangat tiap pagi 🌿'), ['contains_emoji']);
  const emojiRes = validateMultiplierAuditRevision({
    auditResult: {
      verdict: 'revise',
      revised_script: ['Satu 🌿', 'Dua', 'Tiga', 'Empat']
    },
    originalLines
  });
  assert.equal(emojiRes.isRevisionApplied, false);
  assert.equal(emojiRes.needsManualReview, true);

  // 3. Bullet & section label contamination -> reject
  assert.deepEqual(detectMultiplierAuditContamination('Bahan & Takaran: 1 sendok madu'), ['contains_section_label']);
  assert.deepEqual(detectMultiplierAuditContamination('• Ambil satu sendok'), ['contains_bullet']);
  const labelRes = validateMultiplierAuditRevision({
    auditResult: {
      verdict: 'fail',
      revised_script: ['Klip satu', 'Bahan & Takaran: bawang', 'Klip tiga', 'Klip empat']
    },
    originalLines
  });
  assert.equal(labelRes.isRevisionApplied, false);
  assert.equal(labelRes.needsManualReview, true);

  // 4. Clean 4-clip revision on verdict=revise -> accepted for TTS
  const cleanRes = validateMultiplierAuditRevision({
    auditResult: {
      verdict: 'revise',
      revised_script: [
        'Campur satu sendok madu dan bawang tunggal.',
        'Diamkan tiga hari dalam toples kaca.',
        'Ambil satu siung setiap pagi.',
        'Simpan di suhu ruang yang kering.'
      ]
    },
    originalLines
  });
  assert.equal(cleanRes.isRevisionApplied, true);
  assert.equal(cleanRes.needsManualReview, false);
  assert.equal(cleanRes.mappedLines.length, 4);
});

test('V0-2 Centralized Claim Filter: catches 5 real medical claim sentences & rewrites planner hook', async () => {
  const realSentences = [
    'Minum ini rutin bantu rontokkan lemak visceral dan bakar lemak membandel.',
    'Menjaga kesehatan jantung keluarga dimulai dari satu sendok setiap pagi.',
    'Membantu detoks racun di ginjal dan paru-paru secara alami.',
    'Efektif menurunkan gula darah, kolesterol, dan asam urat tinggi.',
    'Meningkatkan imun dan metabolisme sekaligus mencegah kanker dan tumor.'
  ];

  for (const s of realSentences) {
    const hits = findVoClaimViolations(s, { strict: true });
    assert.ok(hits.length > 0, `Expected claim hit for: ${s}`);
    assert.equal(isHerbalMedicalClaimPhrase(s, { strict: true }), true);
  }

  // Finishing plan validator shares exact centralized rule (zero duplication)
  const warnings = [];
  const rejectedPatch = validateBrandPatchSpec(
    { clip_index: 0, anchor: 'top_right', label: 'Bakar Lemak Visceral' },
    { clipCount: 4, isHerbalProduct: true, strictClaims: true, warnings }
  );
  assert.equal(rejectedPatch, null);
  assert.ok(warnings.some(w => w.includes('medical claim label')));

  // Planner Call 2 Hook safety: herbal target triggers rewrite; non-herbal untouched
  assert.equal(resolveIsHerbalOrHealthTarget({ productName: 'Garlibee Madu Bawang Lanang' }), true);
  assert.equal(resolveIsHerbalOrHealthTarget({ niche: 'acoustic_room', brandName: 'Ruang Akustik ID' }), false);

  const rows = [
    { sequence: 1, product: 'Garlibee', context: 'Sarapan pagi', hook: 'Menjaga kesehatan jantung keluarga dimulai dari satu sendok!' },
    { sequence: 2, product: 'Panel Busa', context: 'Kamar tidur', hook: 'Pasang panel di dinding pantulan agar gema berkurang!' }
  ];

  await enforceHerbalHookSafety([rows[0]], {
    isHerbalTarget: true,
    productName: 'Garlibee',
    rewriteFn: async () => 'Cara nikmat konsumsi madu bawang tiap pagi tanpa ribet!'
  });
  assert.equal(findVoClaimViolations(rows[0].hook, { strict: true }).length, 0);
  assert.equal(rows[0].hook, 'Cara nikmat konsumsi madu bawang tiap pagi tanpa ribet!');
  assert.equal(rows[0]._hook_compliance_rewritten, true);

  // Even if LLM fails to rewrite, fallback deterministically removes claims
  const badFallbackRow = { sequence: 3, product: 'Garlibee', context: 'Pagi hari', hook: 'Bantu atasi hipertensi dan diabetes tiap pagi!' };
  await enforceHerbalHookSafety([badFallbackRow], {
    isHerbalTarget: true,
    productName: 'Garlibee',
    rewriteFn: async () => 'Bantu sembuhkan kolesterol Anda sekarang!'
  });
  assert.equal(findVoClaimViolations(badFallbackRow.hook, { strict: true }).length, 0);
});

