import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import { listPublishingJobs } from '../lib/publishing-repository.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';

test('listPublishingJobs: handles multiplier content_id without integer overflow error', async () => {
  const tenantId = 'test_tenant_query_safety_' + Date.now();
  const accountId = 'acc_test_' + Date.now();
  const multiplierContentId = 'multiplier_mul_261112_3844l6';
  const jobId = `pub_test_${Date.now()}`;
  const idempotencyKey = `idem_${Date.now()}`;

  try {
    // 1. Create temporary publishing account
    await pgQuery(
      `INSERT INTO publishing_accounts (
        id, tenant_id, platform, provider, display_name, status
      ) VALUES ($1, $2, 'facebook', 'meta', 'Test Page', 'active')`,
      [accountId, tenantId]
    );

    // 2. Create temporary publishing job with multiplier content_id
    await pgQuery(
      `INSERT INTO publishing_jobs (
        id, tenant_id, account_id, content_id, platform, publish_mode, media_type,
        caption_snapshot, media_url_snapshot, scheduled_at, status, created_by, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'facebook', 'live', 'reels', 'Test caption', 'https://example.com/video.mp4', NOW() + INTERVAL '1 hour', 'scheduled', 'test', $5)`,
      [jobId, tenantId, accountId, multiplierContentId, idempotencyKey]
    );

    // 3. Query listPublishingJobs for queue view
    const queueResult = await listPublishingJobs(tenantId, { view: 'queue' });
    assert.ok(queueResult, 'Result should be returned');
    assert.equal(queueResult.items.length, 1, 'Should find 1 scheduled job');
    assert.equal(queueResult.items[0].content_id, multiplierContentId);

    // 4. Query listPublishingJobs for all view
    const allResult = await listPublishingJobs(tenantId, { view: 'all' });
    assert.ok(allResult, 'Result should be returned');
    assert.equal(allResult.items.length, 1);
  } finally {
    // Cleanup
    await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [tenantId]);
    await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [tenantId]);
    await closePgPool();
  }
});
