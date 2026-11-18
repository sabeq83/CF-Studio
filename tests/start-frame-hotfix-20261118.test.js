// Hotfix 18 Nov 2026 (hotfix/start-frame-retry): hitungan percobaan start frame, carry-forward klip yang sudah jadi.
// Bagian DB memakai tenant uji terpisah dan schema dari PG_SEARCH_PATH (.env.local = dev); data uji dihapus di akhir.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { isTerminalStartFrameAttempt, isTransientStartFrameError } from '../lib/start-frame-worker.js';
import { carryForwardCompletedAssets, claimIsolatedStartFrameAsset } from '../lib/pillar-start-frame-service.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';

const TENANT = `test_hotfix_${crypto.randomUUID().slice(0, 8)}`;
const ITEM = `t${Date.now()}`;

async function insertAsset({ clip, revision = 1, status = 'completed', attempt = 0, localPath = null, critical = false }) {
  const id = `pcia_t${crypto.randomUUID().replaceAll('-', '').slice(0, 15)}`;
  await pgQuery(`INSERT INTO pillar_campaign_item_assets
    (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,local_path,reference_critical,created_at)
    VALUES($1,$2,'cst_test',$3,$4,'start_frame',$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
  [id, TENANT, ITEM, clip, revision, status, attempt, localPath, critical]);
  return id;
}

test.after(async () => {
  await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE tenant_id = $1', [TENANT]).catch(() => {});
  await closePgPool().catch(() => {});
});

test('error sementara (deadlock/timeout jalur) mendapat batas percobaan lebih longgar', () => {
  const deadlock = Object.assign(new Error('deadlock detected'), { code: '40P01' });
  const lane = Object.assign(new Error('Timeout waiting for G-Labs image lane (exclusive): exceeded 300000ms'), { code: 'LANE_WAIT_TIMEOUT' });
  const provider = new Error('Provider task failed');
  assert.equal(isTransientStartFrameError(deadlock), true);
  assert.equal(isTransientStartFrameError(lane), true);
  assert.equal(isTransientStartFrameError(provider), false);
  assert.equal(isTerminalStartFrameAttempt(5, provider), true);
  assert.equal(isTerminalStartFrameAttempt(5, deadlock), false);
  assert.equal(isTerminalStartFrameAttempt(8, deadlock), true);
});

test('klaim untuk menunggu jalur / polling tidak menaikkan attempt_count; klaim percobaan baru menaikkan', async () => {
  await tenantContext.run(TENANT, async () => {
    const waiting = await insertAsset({ clip: 1, status: 'waiting_lane', attempt: 3 });
    let claimed = await claimIsolatedStartFrameAsset('test-worker', { leaseSeconds: 5 });
    assert.equal(claimed.id, waiting);
    assert.equal(Number(claimed.attempt_count), 3, 'waiting_lane tidak dihitung');
    await pgQuery("UPDATE pillar_campaign_item_assets SET status='completed', lease_expires_at=NULL WHERE id=$1", [waiting]);

    const polling = await insertAsset({ clip: 2, status: 'provider_processing', attempt: 2 });
    claimed = await claimIsolatedStartFrameAsset('test-worker', { leaseSeconds: 5 });
    assert.equal(claimed.id, polling);
    assert.equal(Number(claimed.attempt_count), 2, 'provider_processing (polling) tidak dihitung');
    await pgQuery("UPDATE pillar_campaign_item_assets SET status='completed', lease_expires_at=NULL WHERE id=$1", [polling]);

    const retry = await insertAsset({ clip: 3, status: 'retry_wait', attempt: 1 });
    claimed = await claimIsolatedStartFrameAsset('test-worker', { leaseSeconds: 5 });
    assert.equal(claimed.id, retry);
    assert.equal(Number(claimed.attempt_count), 2, 'retry_wait adalah percobaan baru');
    await pgQuery("UPDATE pillar_campaign_item_assets SET status='completed', lease_expires_at=NULL WHERE id=$1", [retry]);
  });
});

test('carryForwardCompletedAssets membawa klip jadi ke revisi baru kecuali klip yang diulang', async () => {
  await tenantContext.run(TENANT, async () => {
    await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE tenant_id = $1', [TENANT]);
    for (const clip of [1, 2, 3, 5, 6]) {
      await insertAsset({ clip, revision: 1, status: 'completed', localPath: `/uploads/start_frames/x_clip_${clip}_r1.jpg` });
    }
    await insertAsset({ clip: 4, revision: 1, status: 'failed' });
    await carryForwardCompletedAssets({ itemId: ITEM, revision: 2, excludeClips: [4] });
    const rows = (await pgQuery(
      `SELECT clip_index, status, local_path FROM pillar_campaign_item_assets
       WHERE tenant_id=$1 AND campaign_item_id=$2 AND revision=2 ORDER BY clip_index`, [TENANT, ITEM])).rows;
    assert.deepEqual(rows.map(r => Number(r.clip_index)), [1, 2, 3, 5, 6], 'klip 1,2,3,5,6 dibawa; klip 4 (yang diulang) tidak');
    assert.ok(rows.every(r => r.status === 'completed' && r.local_path));

    // Idempoten: dipanggil ulang tidak menggandakan baris
    await carryForwardCompletedAssets({ itemId: ITEM, revision: 2, excludeClips: [4] });
    const count = (await pgQuery('SELECT COUNT(*)::int AS n FROM pillar_campaign_item_assets WHERE tenant_id=$1 AND revision=2', [TENANT])).rows[0].n;
    assert.equal(count, 5);
  });
});
