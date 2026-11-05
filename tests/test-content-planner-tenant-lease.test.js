import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';
import { withPlannerGenerationLease } from '../lib/content-planner-consumption.js';
import { pgQuery } from '../lib/db-pg.js';

test('createDraftContentPlanner should properly persist tenant_id and lease without PLANNER_NOT_FOUND', async () => {
  const testTenant = 'test_tenant_' + Date.now();
  const testPlanner = await createDraftContentPlanner({
    title: 'Test Tenant Isolation Planner',
    account_name: 'test_account',
    planner_focus: 'recipe_campaign',
    recipe_config: { category: 'makanan_utama' },
    recipe_category: 'makanan_utama',
    promotion_context: 'test topic',
    planner_count: 1,
    tenant_id: testTenant
  });

  assert.ok(testPlanner.id, 'Draft planner must have an ID');
  
  // Verify tenant_id in DB
  const row = (await pgQuery('SELECT id, tenant_id FROM content_planners WHERE id = $1', [testPlanner.id])).rows[0];
  assert.equal(row.tenant_id, testTenant, 'Planner in database must have the correct tenant_id');

  // Verify lease acquires successfully
  let leaseAcquired = false;
  await withPlannerGenerationLease(testPlanner.id, async (p) => {
    assert.equal(p.id, testPlanner.id);
    assert.equal(p.tenant_id, testTenant);
    leaseAcquired = true;
  }, testTenant);

  assert.ok(leaseAcquired, 'Generation lease must be acquired without error');

  // Clean up
  await pgQuery('DELETE FROM content_planners WHERE id = $1', [testPlanner.id]);
});
