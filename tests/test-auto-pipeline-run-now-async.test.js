import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { getCascadeAction, GEMINI_CASCADE_ORDER_FREE, GEMINI_CASCADE_ORDER_PAID } from '../lib/gemini.js';
import {
  triggerScheduleImmediatelyAsync,
  isScheduleRunning
} from '../lib/auto-pipeline-scheduler-runner.js';

describe('Auto Pipeline Run Now & Smart Gemini Cascade Test Suite', () => {
  const tenantId = 'default_tenant';

  after(() => {
    setTimeout(() => process.exit(0), 100);
  });

  test('1. GEMINI_CASCADE_ORDER should preserve gemini-3.8-flash and include gemini-2.5-flash as safety net', () => {
    assert.ok(GEMINI_CASCADE_ORDER_FREE.includes('gemini-3.8-flash'), 'FREE cascade must include gemini-3.8-flash');
    assert.ok(GEMINI_CASCADE_ORDER_FREE.includes('gemini-2.5-flash'), 'FREE cascade must include gemini-2.5-flash');
    assert.ok(GEMINI_CASCADE_ORDER_PAID.includes('gemini-3.8-flash'), 'PAID cascade must include gemini-3.8-flash');
    assert.ok(GEMINI_CASCADE_ORDER_PAID.includes('gemini-2.5-flash'), 'PAID cascade must include gemini-2.5-flash');
    
    // Check order: 3.8 before 2.5
    assert.ok(GEMINI_CASCADE_ORDER_FREE.indexOf('gemini-3.8-flash') < GEMINI_CASCADE_ORDER_FREE.indexOf('gemini-2.5-flash'));
  });

  test('2. getCascadeAction should cascade on 180s Timeout when hasNextModel is true', () => {
    const timeoutError = new Error('Generative AI request timed out after 180s');
    const action = getCascadeAction(timeoutError, 0, true);
    assert.equal(action.action, 'cascade');
    assert.match(action.reason, /timed out/i);
  });

  test('3. getCascadeAction should throw on Timeout when no fallback model is left', () => {
    const timeoutError = new Error('Generative AI request timed out after 180s');
    const action = getCascadeAction(timeoutError, 0, false);
    assert.equal(action.action, 'throw');
  });

  test('4. getCascadeAction should fast-cascade on 503 High Demand if attempt >= 1 and hasNextModel is true', () => {
    const err503 = Object.assign(new Error('This model is currently experiencing high demand.'), { status: 503 });
    const actionAttempt0 = getCascadeAction(err503, 0, true);
    assert.equal(actionAttempt0.action, 'retry');

    const actionAttempt1 = getCascadeAction(err503, 1, true);
    assert.equal(actionAttempt1.action, 'cascade');
    assert.match(actionAttempt1.reason, /503/i);
  });

  test('5. isScheduleRunning should accurately report running state', () => {
    assert.equal(isScheduleRunning('non_existent_sched'), false);
  });

  test('6. triggerScheduleImmediatelyAsync should throw error if schedule not found', async () => {
    await assert.rejects(
      async () => {
        await triggerScheduleImmediatelyAsync(tenantId, 'non_existent_sched_12345');
      },
      /tidak ditemukan/
    );
  });
});
