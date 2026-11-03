import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDistributionPlan, validateLockedPlannerStructure } from '../lib/content-planner-contract.js';

test('1. CEP-As-Pillar: Saat pilar OFF ([]), kolom pillar mencerminkan category_cep', () => {
  const plan = buildDistributionPlan(6, [], 0, 'test-seed');
  assert.equal(plan.length, 6);
  for (const row of plan) {
    assert.ok(row.pillar, 'Pillar tidak boleh null atau kosong');
    assert.equal(row.pillar, row.category_cep, `Pillar (${row.pillar}) harus sama dengan category_cep (${row.category_cep})`);
  }
});

test('2. Pilar ON: Saat pilar diisi array, kolom pillar mengikuti rotasi pilar', () => {
  const plan = buildDistributionPlan(6, ['Pilar Alpha', 'Pilar Beta'], 0, 'test-seed');
  assert.equal(plan.length, 6);
  assert.ok(plan.every(r => r.pillar === 'Pilar Alpha' || r.pillar === 'Pilar Beta'));
});

test('3. Backward Compatibility: Saat pilar null/undefined, kolom pillar memakai pilar default', () => {
  const plan = buildDistributionPlan(4, null, 0, 'test-seed');
  assert.equal(plan.length, 4);
  assert.ok(plan[0].pillar.includes('Edukasi') || plan[0].pillar.includes('Routine') || plan[0].pillar.includes('Review') || plan[0].pillar.includes('Behind'));
});

test('4. Locked Structure Validation lulus pada model CEP-As-Pillar', () => {
  const plan = buildDistributionPlan(6, [], 0, 'test-seed');
  const validRows = plan.map(r => ({ ...r, hook: 'Test Hook', visual_action: 'Test Visual' }));
  assert.doesNotThrow(() => validateLockedPlannerStructure(validRows, plan));
});
