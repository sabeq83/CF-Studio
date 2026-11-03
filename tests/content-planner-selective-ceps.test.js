import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDistributionPlan, validateLockedPlannerStructure } from '../lib/content-planner-contract.js';

test('1. Seleksi Kustom: Hanya 2 CEP yang terpilih menghasilkan baris dari 2 CEP tersebut secara seimbang', () => {
  const customCeps = ['Problem-Solution Based', 'Opportunistic Based'];
  const plan = buildDistributionPlan(12, [], 0, 'seed-123', { selectedCeps: customCeps });
  assert.equal(plan.length, 12);
  
  const cepsUsed = new Set(plan.map(r => r.category_cep));
  assert.equal(cepsUsed.size, 2);
  assert.ok(cepsUsed.has('Problem-Solution Based'));
  assert.ok(cepsUsed.has('Opportunistic Based'));
  assert.ok(!cepsUsed.has('Routine Based'));
  assert.ok(!cepsUsed.has('Emotional Based'));

  const countProblem = plan.filter(r => r.category_cep === 'Problem-Solution Based').length;
  const countOpportunistic = plan.filter(r => r.category_cep === 'Opportunistic Based').length;
  assert.equal(countProblem, 6);
  assert.equal(countOpportunistic, 6);
});

test('2. Seleksi 1 CEP tunggal: Seluruh baris menggunakan 1 CEP tersebut dan harmonis dengan CEP-As-Pillar', () => {
  const customCeps = ['Problem-Solution Based'];
  const plan = buildDistributionPlan(6, [], 0, 'seed-single', { selectedCeps: customCeps });
  assert.equal(plan.length, 6);
  assert.ok(plan.every(r => r.category_cep === 'Problem-Solution Based'));
  assert.ok(plan.every(r => r.pillar === 'Problem-Solution Based'), 'Ketika pilar OFF ([]), pillar WAJIB sama dengan category_cep');
});

test('3. Mode Sequential Default: Menggunakan seluruh 6 CEP jika selectedCeps kosong atau null', () => {
  const plan1 = buildDistributionPlan(6, [], 0, 'seed-seq-1', { selectedCeps: [] });
  const cepsUsed1 = new Set(plan1.map(r => r.category_cep));
  assert.equal(cepsUsed1.size, 6);

  const plan2 = buildDistributionPlan(6, [], 0, 'seed-seq-2', { selectedCeps: null });
  const cepsUsed2 = new Set(plan2.map(r => r.category_cep));
  assert.equal(cepsUsed2.size, 6);
});

test('4. Filter CEP Invalid: Mengabaikan nilai CEP yang tidak valid dan fallback ke valid / default', () => {
  const dirtyCeps = ['Problem-Solution Based', 'Invalid CEP Name', 'Unknown Category'];
  const plan = buildDistributionPlan(6, [], 0, 'seed-dirty', { selectedCeps: dirtyCeps });
  assert.equal(plan.length, 6);
  assert.ok(plan.every(r => r.category_cep === 'Problem-Solution Based'));
});

test('5. Validasi Locked Structure lulus pada hasil distribusi Selective CEP', () => {
  const customCeps = ['Routine Based', 'Emotional Based', 'Aspirational Based'];
  const lockedPlan = buildDistributionPlan(6, [], 0, 'seed-locked', { selectedCeps: customCeps });
  
  // Simulasi rows dari LLM yang mengikuti locked distribution
  const generatedRows = lockedPlan.map(item => ({
    sequence: item.sequence,
    pillar: item.pillar,
    category_cep: item.category_cep,
    vfo: item.vfo,
    context: 'Situasi kontekstual',
    strategic_angle: 'The Life Hack'
  }));

  assert.doesNotThrow(() => {
    validateLockedPlannerStructure(generatedRows, lockedPlan);
  });
});

