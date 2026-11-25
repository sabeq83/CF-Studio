import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutoPipelineSchedule,
  createAutoPipelineScheduleBatch,
  listAutoPipelineSchedules,
  getAutoPipelineScheduleById,
  updateAutoPipelineSchedule,
  updateScheduleExecutionStatus,
  deleteSchedule,
  validateAndNormalizeScheduleTiming,
  ScheduleValidationError
} from '../lib/auto-pipeline-schedules-repository.js';
import {
  computeTargetPublishIso,
  resolveSchedulePublishIso,
  addDaysToDateStr,
  zonedDateTimeToUtcDate
} from '../lib/auto-pipeline-scheduler-runner.js';
import { getPgPool } from '../lib/db-pg.js';

describe('Auto Pipeline Split Schedule (Produksi vs Publishing) Test Suite', () => {
  const tenantId = 'default_tenant';
  const createdIds = [];

  after(async () => {
    for (const id of createdIds) {
      try {
        await deleteSchedule(tenantId, id);
      } catch (_) {}
    }
    const pool = getPgPool();
    if (pool) {
      await pool.end();
    }
  });

  test('1. Backward compatibility specific_date lama (publish_date null, offset 0)', () => {
    const now = new Date('2026-11-26T01:00:00+07:00');
    const scheduledAtIso = computeTargetPublishIso({
      publishTimeStr: '07:15',
      timeZone: 'Asia/Jakarta',
      publishDateStr: null,
      generationDateStr: '2026-11-26',
      publishDayOffset: 0,
      now
    });

    assert.equal(
      scheduledAtIso,
      new Date('2026-11-26T07:15:00+07:00').toISOString()
    );

    // Legacy 3-argument positional signature fallback
    const legacyIso = computeTargetPublishIso('07:15', 'Asia/Jakarta', '2099-11-26');
    assert.equal(legacyIso, new Date('2099-11-26T07:15:00+07:00').toISOString());
  });

  test('2. specific_date produksi H-1 sore (25 Nov 15:00), publish H-0 pagi (26 Nov 07:15)', () => {
    const nowAfterRender = new Date('2026-11-25T15:25:00+07:00');
    const iso = resolveSchedulePublishIso({
      schedule_mode: 'specific_date',
      target_date: '2026-11-25',
      generation_time: '15:00',
      publish_date: '2026-11-26',
      publish_time: '07:15',
      publish_day_offset: 0,
      timezone: 'Asia/Jakarta'
    }, nowAfterRender);

    assert.equal(iso, new Date('2026-11-26T07:15:00+07:00').toISOString());
  });

  test('3. recurring lintas hari (publish_day_offset = 1) tidak jatuh ke now + 15 menit', () => {
    const nowAfterNightRender = new Date('2026-11-23T20:30:00+07:00'); // Senin 20:30 WIB
    const iso = resolveSchedulePublishIso({
      schedule_mode: 'recurring',
      generation_time: '20:00',
      publish_time: '06:15',
      publish_day_offset: 1,
      last_run_target_date: '2026-11-23',
      timezone: 'Asia/Jakarta'
    }, nowAfterNightRender);

    assert.equal(iso, new Date('2026-11-24T06:15:00+07:00').toISOString());
  });

  test('4. Render melewati tengah malam (recurring offset = 1) tetap mengunci last_run_target_date', () => {
    // Mulai Senin 23 Nov pukul 23:30 WIB, selesai Selasa 24 Nov pukul 00:15 WIB
    const nowAfterMidnight = new Date('2026-11-24T00:15:00+07:00');
    const iso = resolveSchedulePublishIso({
      schedule_mode: 'recurring',
      generation_time: '23:30',
      publish_time: '06:15',
      publish_day_offset: 1,
      last_run_target_date: '2026-11-23',
      timezone: 'Asia/Jakarta'
    }, nowAfterMidnight);

    // Harus Selasa 24 Nov 06:15 WIB (bukan Rabu 25 Nov!)
    assert.equal(iso, new Date('2026-11-24T06:15:00+07:00').toISOString());
  });

  test('5. Validasi tanggal terbalik & jam lintas hari tanpa offset menolak dengan statusCode 400', () => {
    assert.throws(
      () => validateAndNormalizeScheduleTiming({
        schedule_mode: 'specific_date',
        target_date: '2026-11-27',
        generation_time: '15:00',
        publish_date: '2026-11-26',
        publish_time: '07:15'
      }),
      err => err instanceof ScheduleValidationError && err.statusCode === 400
    );

    assert.throws(
      () => validateAndNormalizeScheduleTiming({
        schedule_mode: 'specific_date',
        target_date: '2026-11-26',
        generation_time: '15:00',
        publish_date: '2026-11-26',
        publish_time: '07:15'
      }),
      err => err instanceof ScheduleValidationError && err.statusCode === 400
    );

    assert.throws(
      () => validateAndNormalizeScheduleTiming({
        schedule_mode: 'recurring',
        generation_time: '20:00',
        publish_time: '06:15',
        publish_day_offset: 0
      }),
      err => err instanceof ScheduleValidationError && err.statusCode === 400 && /publish_day_offset: 1/.test(err.message)
    );

    assert.throws(
      () => validateAndNormalizeScheduleTiming({
        schedule_mode: 'recurring',
        generation_time: '08:00',
        publish_time: '10:00',
        publish_day_offset: 15
      }),
      err => err instanceof ScheduleValidationError && err.statusCode === 400
    );
  });

  test('6. Trigger manual run-now pada H-1 tetap menghormati publish_date dan target_date + offset', () => {
    const manualRunNow = new Date('2026-11-25T14:10:00+07:00');
    const isoExplicit = resolveSchedulePublishIso({
      schedule_mode: 'specific_date',
      target_date: '2026-11-26',
      publish_date: '2026-11-27',
      publish_time: '08:00',
      last_run_target_date: '2026-11-25',
      timezone: 'Asia/Jakarta'
    }, manualRunNow);
    assert.equal(isoExplicit, new Date('2026-11-27T08:00:00+07:00').toISOString());

    const isoOffset = resolveSchedulePublishIso({
      schedule_mode: 'specific_date',
      target_date: '2026-11-26',
      publish_date: null,
      publish_day_offset: 1,
      publish_time: '08:00',
      last_run_target_date: '2026-11-25',
      timezone: 'Asia/Jakarta'
    }, manualRunNow);
    assert.equal(isoOffset, new Date('2026-11-27T08:00:00+07:00').toISOString());
  });

  test('7. Timezone non-WIB (WITA/WIT/UTC) & addDaysToDateStr bekerja akurat', () => {
    assert.equal(addDaysToDateStr('2026-11-30', 1), '2026-12-01');

    const makassarUtc = zonedDateTimeToUtcDate('2026-11-26', '08:00', 'Asia/Makassar');
    assert.equal(makassarUtc.toISOString(), '2026-11-26T00:00:00.000Z');

    const jayapuraUtc = zonedDateTimeToUtcDate('2026-11-26', '09:00', 'Asia/Jayapura');
    assert.equal(jayapuraUtc.toISOString(), '2026-11-26T00:00:00.000Z');
  });

  test('8. DB Repository CRUD, alias generation_date, filter publish_date & batch 20 item', async () => {
    const singleId = `apsched_split_single_${Date.now()}`;
    createdIds.push(singleId);

    const created = await createAutoPipelineSchedule(tenantId, {
      id: singleId,
      name: 'Split Schedule H-1 Test',
      brand_id: 'brand_test_split',
      preset_key: 'multiplier_deconstruct_remix',
      schedule_mode: 'specific_date',
      generation_date: '2099-11-25',
      generation_time: '15:00',
      publish_date: '2099-11-26',
      publish_time: '07:15',
      publish_day_offset: 0,
      auto_publish_enabled: true
    });

    assert.equal(created.target_date, '2099-11-25');
    assert.equal(created.generation_date, '2099-11-25');
    assert.equal(created.publish_date, '2099-11-26');
    assert.equal(created.publish_day_offset, 0);

    const byPubDate = await listAutoPipelineSchedules(tenantId, { publishDate: '2099-11-26' });
    assert.ok(byPubDate.some(s => s.id === singleId), 'Schedule must be found via publishDate filter');

    const updated = await updateAutoPipelineSchedule(tenantId, singleId, {
      publish_date: '2099-11-27',
      publish_time: '08:30'
    });
    assert.equal(updated.publish_date, '2099-11-27');
    assert.equal(updated.publish_time, '08:30');
    assert.equal(updated.target_date, '2099-11-25');

    const execUpdated = await updateScheduleExecutionStatus(tenantId, singleId, {
      lastRunAt: new Date(),
      lastRunTargetDate: '2099-11-25'
    });
    assert.equal(execUpdated.last_run_target_date, '2099-11-25');

    const fetched = await getAutoPipelineScheduleById(tenantId, singleId);
    assert.equal(fetched.last_run_target_date, '2099-11-25');

    // Batch 20 items
    const batchItems = Array.from({ length: 20 }, (_, i) => {
      const id = `apsched_split_batch_${Date.now()}_${i}`;
      createdIds.push(id);
      return {
        id,
        name: `Batch Split #${i + 1}`,
        brand_id: 'brand_test_split',
        schedule_mode: 'specific_date',
        target_date: '2099-12-01',
        generation_time: '15:00',
        publish_date: '2099-12-02',
        publish_time: '07:15'
      };
    });

    const batchCreated = await createAutoPipelineScheduleBatch(tenantId, batchItems);
    assert.equal(batchCreated.length, 20);
    const listedBatch = await listAutoPipelineSchedules(tenantId, { publishDate: '2099-12-02' });
    assert.ok(listedBatch.filter(s => s.id.startsWith('apsched_split_batch_')).length >= 20);
  });
});
