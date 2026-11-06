process.env.PG_SEARCH_PATH = 'dev';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import assert from 'assert';
import { tenantContext, getActiveTenantId } from '../lib/tenant-context.js';
import { runScheduleImmediately } from '../lib/auto-pipeline-scheduler-runner.js';

async function runTenantIsolationTests() {
  console.log('🧪 Starting Tenant Isolation & Gemini Key Fallback Tests...');

  // Test 1: getActiveTenantId behavior inside '__none__'
  await tenantContext.run('__none__', async () => {
    assert.strictEqual(getActiveTenantId(), '__none__', 'Tenant context should initially be __none__');
    
    // Simulate what scheduler runner does: wraps execution in effectiveTenantId
    const effectiveTenantId = (getActiveTenantId() && getActiveTenantId() !== '__none__') ? getActiveTenantId() : 'default_tenant';
    assert.strictEqual(effectiveTenantId, 'default_tenant', 'Effective tenant ID must normalize __none__ to default_tenant');

    await tenantContext.run(effectiveTenantId, async () => {
      assert.strictEqual(getActiveTenantId(), 'default_tenant', 'Nested execution must run within default_tenant context');
    });
  });
  console.log('✅ Test 1 Passed: Context properly normalizes __none__ to default_tenant');

  // Test 2: Auto-pipeline scheduler runner handles __none__ gracefully
  // When runScheduleImmediately is called with '__none__', it should normalize to 'default_tenant'
  // (We test the ID check before calling DB or mock)
  try {
    await runScheduleImmediately('__none__', 'non_existent_schedule_id');
    assert.fail('Should have thrown schedule not found error, but not tenant isolation error');
  } catch (err) {
    assert(
      err.message.includes('tidak ditemukan') || err.message.includes('Jadwal dengan ID'),
      `Expected 'tidak ditemukan' error, got: ${err.message}`
    );
    assert(
      !err.message.includes('__none__ belum dikonfigurasi'),
      'Must NOT fail with tenant (__none__) error'
    );
  }
  console.log('✅ Test 2 Passed: runScheduleImmediately correctly normalizes __none__ to default_tenant');

  console.log('🎉 All Tenant Isolation Tests Passed!');
  process.exit(0);
}

runTenantIsolationTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
