import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlabsImageLaneKey,
  requestImageLane,
  tryAcquireImageLane,
  heartbeatImageLane,
  releaseImageLane,
  recoverExpiredImageLanes,
  reserveGlabsSubmitSlot,
  waitAndReserveGlabsSubmitSlot
} from '../lib/glabs-image-lane-service.js';
import { getPgPool, closePgPool } from '../lib/db-pg.js';

test('buildGlabsImageLaneKey generates deterministic, safe sha256 hash without secrets', () => {
  const key1 = buildGlabsImageLaneKey({ host: '100.64.70.61', port: '8765' });
  const key2 = buildGlabsImageLaneKey({ host: '100.64.70.61', port: '8765' });
  assert.equal(typeof key1, 'string');
  assert.equal(key1.length, 64);
  assert.equal(key1, key2);

  const keyOther = buildGlabsImageLaneKey({ host: '127.0.0.1', port: '8765' });
  assert.notEqual(key1, keyOther);
});

test('glabs image lane concurrency: serialization and FIFO isolation', async () => {
  const laneKey = `test_lane_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tenantId = 'default_tenant';

  // 1. Exclusive Lease 1 (e.g. Item 215 clip 3 Product Bridge)
  const req1 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'exclusive',
    ownerKind: 'test_asset',
    ownerId: 'item_215_clip_3',
    leaseSeconds: 30
  });
  assert.equal(req1.acquired, true, 'Exclusive Lease 1 should acquire immediately on empty lane');

  // 2. Exclusive Lease 2 (e.g. Item 216 clip 3 Product Bridge)
  const req2 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'exclusive',
    ownerKind: 'test_asset',
    ownerId: 'item_216_clip_3',
    leaseSeconds: 30
  });
  assert.equal(req2.acquired, false, 'Exclusive Lease 2 must wait while Lease 1 is active');

  // 3. Shared Lease 3 (e.g. Item 217 clip 2 non-product)
  const req3 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'shared',
    ownerKind: 'test_asset',
    ownerId: 'item_217_clip_2',
    leaseSeconds: 30
  });
  assert.equal(req3.acquired, false, 'Shared Lease 3 must wait because an older Exclusive Waiter (Lease 2) is in queue');

  // 4. Heartbeat on Lease 1
  const hb = await heartbeatImageLane(req1.lease.id, { extendSeconds: 60 });
  assert.equal(hb, true, 'Heartbeat should successfully extend active lease');

  // 5. Release Lease 1 -> Lease 2 (older exclusive waiter) should now be able to acquire
  await releaseImageLane(req1.lease.id, 'completed');

  const acquire2 = await tryAcquireImageLane(req2.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire2.acquired, true, 'Exclusive Lease 2 acquires after Lease 1 released');

  // Shared Lease 3 should still wait while Lease 2 is active
  const acquire3While2Active = await tryAcquireImageLane(req3.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire3While2Active.acquired, false, 'Shared Lease 3 still waits while Exclusive Lease 2 is active');

  // 6. Release Lease 2 -> Shared Lease 3 should now acquire
  await releaseImageLane(req2.lease.id, 'completed');

  const acquire3 = await tryAcquireImageLane(req3.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire3.acquired, true, 'Shared Lease 3 acquires after Exclusive Lease 2 released');

  // Clean up
  await releaseImageLane(req3.lease.id, 'completed');
});

test('glabs image lane: auto-recovers and expires stale orphaned waiting leases without blocking', async () => {
  const { getPgPool } = await import('../lib/db-pg.js');
  const pool = getPgPool();
  const laneKey = `test_stale_lane_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tenantId = 'default_tenant';

  // 1. Insert a stale exclusive waiting lease (simulating a dead process from 10 minutes ago)
  const staleLeaseId = `glease_stale_${Date.now()}`;
  await pool.query(
    `INSERT INTO glabs_image_lane_leases (
       id, tenant_id, lane_key, mode, owner_kind, owner_id, status, requested_at
     ) VALUES ($1, $2, $3, 'exclusive', 'test_asset', 'dead_process_1', 'waiting', CURRENT_TIMESTAMP - INTERVAL '10 minutes')`,
    [staleLeaseId, tenantId, laneKey]
  );

  // 2. A new lease requests the lane
  const newReq = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'exclusive',
    ownerKind: 'test_asset',
    ownerId: 'new_active_process_2',
    leaseSeconds: 30
  });

  // 3. The stale waiter should have been auto-expired and new lease should acquire immediately
  assert.equal(newReq.acquired, true, 'New lease should acquire immediately because stale waiter is auto-expired');

  // Verify the stale lease was updated to status = 'expired' and release_reason = 'wait_abandoned'
  const checkStale = await pool.query(`SELECT status, release_reason FROM glabs_image_lane_leases WHERE id = $1`, [staleLeaseId]);
  assert.equal(checkStale.rows[0]?.status, 'expired', 'Stale waiting lease must be marked as expired');
  assert.equal(checkStale.rows[0]?.release_reason, 'wait_abandoned', 'Release reason must be wait_abandoned');

  // Clean up
  await releaseImageLane(newReq.lease.id, 'completed');
});

test('reserveGlabsSubmitSlot enforces stagger window and resets after elapsed', async () => {
  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS glabs_image_lane_submit_gates (
      lane_key TEXT PRIMARY KEY,
      last_submit_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const laneKey = `test_stagger_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const first = await reserveGlabsSubmitSlot(laneKey, 10);
    assert.equal(first.allowed, true, 'First submit on fresh lane must be allowed');
    assert.equal(first.waitMs, 0);

    const second = await reserveGlabsSubmitSlot(laneKey, 10);
    assert.equal(second.allowed, false, 'Immediate second submit within stagger window must be blocked');
    assert.ok(second.waitMs > 0, 'Blocked submit must report positive waitMs');
    assert.ok(second.nextAllowedAt, 'Blocked submit must include nextAllowedAt timestamp');

    // Simulate elapsed window (> 10s ago)
    await pool.query(
      `UPDATE glabs_image_lane_submit_gates
       SET last_submit_at = CURRENT_TIMESTAMP - INTERVAL '15 seconds'
       WHERE lane_key = $1`,
      [laneKey]
    );

    const third = await reserveGlabsSubmitSlot(laneKey, 10);
    assert.equal(third.allowed, true, 'Submit after stagger window elapsed must be allowed');
  } finally {
    await pool.query('DELETE FROM glabs_image_lane_submit_gates WHERE lane_key = $1', [laneKey]).catch(() => {});
  }
});

test('reserveGlabsSubmitSlot is atomic under concurrent Promise.all calls', async () => {
  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS glabs_image_lane_submit_gates (
      lane_key TEXT PRIMARY KEY,
      last_submit_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const laneKey = `test_stagger_race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => reserveGlabsSubmitSlot(laneKey, 15))
    );
    const allowedCount = results.filter(r => r.allowed).length;
    const blockedCount = results.filter(r => !r.allowed).length;
    assert.equal(allowedCount, 1, 'Exactly one concurrent caller may reserve the submit slot');
    assert.equal(blockedCount, 5, 'All other concurrent callers must be rejected with waitMs');
  } finally {
    await pool.query('DELETE FROM glabs_image_lane_submit_gates WHERE lane_key = $1', [laneKey]).catch(() => {});
  }
});

test('waitAndReserveGlabsSubmitSlot retries until slot opens', async () => {
  let calls = 0;
  const mockReserve = async () => {
    calls += 1;
    if (calls < 3) {
      return { allowed: false, waitMs: 120, nextAllowedAt: new Date(Date.now() + 120).toISOString() };
    }
    return { allowed: true, waitMs: 0, nextAllowedAt: null };
  };

  const slot = await waitAndReserveGlabsSubmitSlot('mock_lane', 12, {
    maxWaitMs: 5000,
    reserveFn: mockReserve
  });
  assert.equal(slot.allowed, true);
  assert.equal(calls, 3);
});

test.after(async () => {
  await closePgPool().catch(() => {});
});

