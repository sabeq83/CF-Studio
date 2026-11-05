import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { 
  createAutoPipelineSchedule,
  listAutoPipelineSchedules,
  getAutoPipelineScheduleById,
  updateAutoPipelineSchedule,
  togglePauseSchedule,
  archiveSchedule,
  deleteSchedule
} from '../lib/auto-pipeline-schedules-repository.js';
import { getPgPool } from '../lib/db-pg.js';

describe('Auto Pipeline Scheduler & Repository Test Suite', () => {
  const tenantId = 'default_tenant';
  const testScheduleId = `apsched_test_${Date.now()}`;

  after(async () => {
    // Cleanup schedule test
    try {
      await deleteSchedule(tenantId, testScheduleId);
    } catch (_) {}

    const pool = getPgPool();
    if (pool) {
      await pool.end();
    }
  });

  test('1. createAutoPipelineSchedule should successfully persist a schedule', async () => {
    const created = await createAutoPipelineSchedule(tenantId, {
      id: testScheduleId,
      name: 'HabitFolk Daily Snack Test Schedule',
      brand_id: 'brand_test_habitfolk',
      preset_key: 'habitfolk_6clips_quick',
      topic_strategy: 'dynamic_ai',
      topic: 'Crispy air fryer chicken tenders',
      category: 'camilan',
      recipe_count: 1,
      generation_time: '05:00',
      publish_time: '09:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      repliz_account_ids: ['acc_repliz_ig_01', 'acc_repliz_tt_01'],
      auto_publish_enabled: true,
      status: 'active'
    });

    assert.ok(created, 'Created schedule should not be null');
    assert.equal(created.id, testScheduleId);
    assert.equal(created.name, 'HabitFolk Daily Snack Test Schedule');
    assert.equal(created.generation_time, '05:00');
    assert.equal(created.publish_time, '09:00');
    assert.equal(created.status, 'active');
    assert.deepEqual(created.days_of_week, [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(created.repliz_account_ids, ['acc_repliz_ig_01', 'acc_repliz_tt_01']);
  });

  test('2. getAutoPipelineScheduleById should fetch the created schedule', async () => {
    const fetched = await getAutoPipelineScheduleById(tenantId, testScheduleId);
    assert.ok(fetched, 'Fetched schedule should exist');
    assert.equal(fetched.id, testScheduleId);
    assert.equal(fetched.topic, 'Crispy air fryer chicken tenders');
  });

  test('3. listAutoPipelineSchedules should return schedules including the test item', async () => {
    const list = await listAutoPipelineSchedules(tenantId);
    assert.ok(Array.isArray(list), 'List should be an array');
    const item = list.find(s => s.id === testScheduleId);
    assert.ok(item, 'Test schedule should be present in the list');
  });

  test('4. updateAutoPipelineSchedule should update timing and name correctly', async () => {
    const updated = await updateAutoPipelineSchedule(tenantId, testScheduleId, {
      name: 'HabitFolk Updated Morning Routine',
      generation_time: '05:30',
      publish_time: '09:30'
    });

    assert.equal(updated.name, 'HabitFolk Updated Morning Routine');
    assert.equal(updated.generation_time, '05:30');
    assert.equal(updated.publish_time, '09:30');
  });

  test('5. togglePauseSchedule should toggle status between active and paused', async () => {
    const paused = await togglePauseSchedule(tenantId, testScheduleId);
    assert.equal(paused.status, 'paused');

    const resumed = await togglePauseSchedule(tenantId, testScheduleId);
    assert.equal(resumed.status, 'active');
  });

  test('6. archiveSchedule and deleteSchedule should archive and then remove the schedule', async () => {
    const archived = await archiveSchedule(tenantId, testScheduleId);
    assert.equal(archived.status, 'archived');

    const deleted = await deleteSchedule(tenantId, testScheduleId);
    assert.equal(deleted, true);

    const recheck = await getAutoPipelineScheduleById(tenantId, testScheduleId);
    assert.equal(recheck, null);
  });
});

