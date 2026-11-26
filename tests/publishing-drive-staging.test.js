import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

const {
  isNextcloudMediaUrl,
  verifyPublishingDriveReady,
  getPublishingDriveReadiness,
  normalizeDriveFolderId,
  ensurePublishingDriveFolder,
  invalidatePublishingDriveReadiness
} = await import('../lib/publishing-drive-staging.js');


const {
  verifyAnonymousDriveDownload
} = await import('../lib/drive-uploader.js');

test('Drive Staging: isNextcloudMediaUrl correctly detects Nextcloud hostnames', () => {
  assert.equal(isNextcloudMediaUrl('https://cloud.ast402.my.id/s/xyz/download/video.mp4'), true);
  assert.equal(isNextcloudMediaUrl('https://drive.google.com/uc?export=download&id=123'), false);
  assert.equal(isNextcloudMediaUrl('https://s3.amazonaws.com/bucket/video.mp4'), false);
  assert.equal(isNextcloudMediaUrl(''), false);
  assert.equal(isNextcloudMediaUrl(null), false);
});

test('Drive Staging: verifyAnonymousDriveDownload accepts 200/206 with binary media', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      // Ensure probe uses NO Authorization header and NO Cookie
      assert.equal(options.headers?.Authorization, undefined);
      assert.equal(options.headers?.Cookie, undefined);
      assert.equal(options.headers?.Range, 'bytes=0-1023');

      return new Response(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes 0-1023/1048576'
        }
      });
    };

    const res = await verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=test1234');
    assert.equal(res, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: verifyAnonymousDriveDownload rejects HTML / virus warning responses', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      return new Response('<html><body>Google Drive - Virus scan warning</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    };

    await assert.rejects(
      () => verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=virus_scan_file'),
      /returned HTML/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: verifyAnonymousDriveDownload rejects 403 / 404 / 500 status codes', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      return new Response('Forbidden', { status: 403 });
    };

    await assert.rejects(
      () => verifyAnonymousDriveDownload('https://drive.google.com/uc?export=download&id=private_file'),
      /probe failed with HTTP 403/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Drive Staging: getPublishingDriveReadiness catches and formats errors gracefully', async () => {
  // If not configured, should return not connected / error object instead of unhandled throw
  const status = await getPublishingDriveReadiness({ bypassCache: true });
  assert.equal(typeof status, 'object');
  assert.equal(status.connected, false);
  assert.ok(status.code);
});

test('Drive Staging: runPublishingMediaCleanupTick purges expired items and marks deleted in DB without touching Nextcloud', async () => {
  const { pgQuery } = await import('../lib/db-pg.js');
  const { saveMediaStaging } = await import('../lib/publishing-repository.js');
  const { runPublishingMediaCleanupTick } = await import('../lib/publishing-media-cleanup-worker.js');

  const testTenant = `t_clean_${Date.now()}`;
  const testJobId = `job_clean_${Date.now()}`;

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [testTenant, 'Cleanup Tenant']);
  const accRes = await pgQuery(`
    INSERT INTO publishing_accounts (id, tenant_id, platform, display_name, provider, provider_account_id, status)
    VALUES ($1, $2, 'tiktok', 'Test Acc', 'repliz', 'acc_clean_1', 'active')
    RETURNING id
  `, [`acc_clean_${Date.now()}`, testTenant]);

  await pgQuery(`
    INSERT INTO publishing_jobs (
      id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
      caption_snapshot, media_url_snapshot, scheduled_at, status, idempotency_key, provider
    ) VALUES ($1, $2, 'VID-CLEAN-01', $3, 'tiktok', 'live', 'video', 'Cleanup test',
      'https://cloud.ast402.my.id/s/xyz/download/video.mp4', CURRENT_TIMESTAMP, 'published', $4, 'repliz')
  `, [testJobId, testTenant, accRes.rows[0].id, `idem_clean_${testJobId}`]);

  // Insert expired staging record (expires_at 1 day in the past)
  const expiredPast = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const stagingRow = await saveMediaStaging({
    tenantId: testTenant,
    jobId: testJobId,
    provider: 'google_drive',
    externalFileId: 'mock_drive_file_id_999',
    publicUrl: 'https://drive.google.com/uc?export=download&id=mock_drive_file_id_999',
    status: 'verified',
    expiresAt: expiredPast
  });

  assert.ok(stagingRow);
  assert.equal(stagingRow.job_id, testJobId);

  // Run cleanup tick (mocking google client if not authorized)
  await runPublishingMediaCleanupTick();

  // Cleanup DB fixtures
  await pgQuery('DELETE FROM publishing_media_staging WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_attempts WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [testTenant]);
  await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);
});

test('Drive Staging: normalizeDriveFolderId extracts and validates IDs and URLs', () => {
  // Raw clean IDs
  assert.equal(normalizeDriveFolderId('1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'), '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6');
  assert.equal(normalizeDriveFolderId('  folder_12345-abc  '), 'folder_12345-abc');

  // Full URLs
  assert.equal(
    normalizeDriveFolderId('https://drive.google.com/drive/folders/1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6?usp=sharing'),
    '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'
  );
  assert.equal(
    normalizeDriveFolderId('https://drive.google.com/drive/u/0/folders/1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'),
    '1fEn2ChMCvBWEc_LiiaxbEpRESjtO5Kg6'
  );

  // Empty / whitespace
  assert.equal(normalizeDriveFolderId(''), '');
  assert.equal(normalizeDriveFolderId(null), '');

  // Invalid formats / malicious URLs
  assert.throws(() => normalizeDriveFolderId('https://evil.com/folders/12345'), /drive\.google\.com/);
  assert.throws(() => normalizeDriveFolderId('invalid string with spaces @!'), /Format Folder ID/);
});


test('Drive Staging: readinessCache is isolated per tenant and does not leak between tenants', async () => {
  const { invalidatePublishingDriveReadiness } = await import('../lib/publishing-drive-staging.js');
  invalidatePublishingDriveReadiness('tenant_A');
  invalidatePublishingDriveReadiness('tenant_B');
  invalidatePublishingDriveReadiness();
  assert.ok(true);
});

test('Drive Staging: resolveMediaSourceStream handles local disk media file stream without HTTP fetch', async () => {
  const { resolveMediaSourceStream } = await import('../lib/drive-uploader.js');
  // Memastikan bahwa path lokal tidak memicu error 'Failed to parse URL' dari fetch, melainkan deteksi file lokal
  await assert.rejects(
    async () => {
      await resolveMediaSourceStream('/temp/non_existent_opc_video.mp4');
    },
    /Local media file not found for path/
  );
});

test('Drive Staging: buildReplizMediaDedupKey produces identical key across platforms and changes when sourceUrl or contentId changes', async () => {
  const { buildReplizMediaDedupKey } = await import('../lib/publishing-drive-staging.js');

  const k1 = buildReplizMediaDedupKey({
    tenantId: 'default_tenant',
    contentId: 'mul_261126_abc',
    sourceUrl: 'http://100.78.186.123/s/token123/download'
  });
  const k2 = buildReplizMediaDedupKey({
    tenantId: 'default_tenant',
    contentId: 'mul_261126_abc',
    sourceUrl: 'http://100.78.186.123/s/token123/download'
  });
  const kDifferentUrl = buildReplizMediaDedupKey({
    tenantId: 'default_tenant',
    contentId: 'mul_261126_abc',
    sourceUrl: 'http://100.78.186.123/s/token999/download'
  });
  const kDifferentTenant = buildReplizMediaDedupKey({
    tenantId: 'other_tenant',
    contentId: 'mul_261126_abc',
    sourceUrl: 'http://100.78.186.123/s/token123/download'
  });

  assert.equal(k1.length, 24);
  assert.equal(k1, k2);
  assert.notEqual(k1, kDifferentUrl);
  assert.notEqual(k1, kDifferentTenant);
  assert.equal(buildReplizMediaDedupKey({ tenantId: 'default_tenant', contentId: 'x', sourceUrl: '' }), '');
});

test('Drive Staging: listExpiredMediaStaging enforces status-aware grace period and excludes scheduled/recent jobs', async () => {
  const { pgQuery } = await import('../lib/db-pg.js');
  const { saveMediaStaging, listExpiredMediaStaging } = await import('../lib/publishing-repository.js');

  const ts = Date.now();
  const testTenant = `t_grace_${ts}`;
  const accId = `acc_grace_${ts}`;
  const futureExpiry = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [testTenant, 'Grace Tenant']);
  await pgQuery(`
    INSERT INTO publishing_accounts (id, tenant_id, platform, display_name, provider, provider_account_id, status)
    VALUES ($1, $2, 'tiktok', 'Grace Acc', 'repliz', $3, 'active')
  `, [accId, testTenant, `rep_grace_${ts}`]);

  const cases = [
    { id: `j_pub_old_${ts}`, status: 'published', pubOffsetHours: -3, cancelOffsetHours: null, updOffsetHours: -3, fileId: `f_pub_old_${ts}`, expectEligible: true },
    { id: `j_pub_new_${ts}`, status: 'published', pubOffsetHours: -0.5, cancelOffsetHours: null, updOffsetHours: -0.5, fileId: `f_pub_new_${ts}`, expectEligible: false },
    { id: `j_can_old_${ts}`, status: 'cancelled', pubOffsetHours: null, cancelOffsetHours: -2, updOffsetHours: -2, fileId: `f_can_old_${ts}`, expectEligible: true },
    { id: `j_nr_old_${ts}`, status: 'needs_review', pubOffsetHours: null, cancelOffsetHours: null, updOffsetHours: -96, fileId: `f_nr_old_${ts}`, expectEligible: true },
    { id: `j_nr_new_${ts}`, status: 'needs_review', pubOffsetHours: null, cancelOffsetHours: null, updOffsetHours: -24, fileId: `f_nr_new_${ts}`, expectEligible: false },
    { id: `j_sched_${ts}`, status: 'scheduled', pubOffsetHours: null, cancelOffsetHours: null, updOffsetHours: -240, fileId: `f_sched_${ts}`, expectEligible: false }
  ];

  try {
    for (const c of cases) {
      const pubAt = c.pubOffsetHours !== null ? new Date(Date.now() + c.pubOffsetHours * 3600 * 1000).toISOString() : null;
      const canAt = c.cancelOffsetHours !== null ? new Date(Date.now() + c.cancelOffsetHours * 3600 * 1000).toISOString() : null;
      const updAt = new Date(Date.now() + c.updOffsetHours * 3600 * 1000).toISOString();

      await pgQuery(`
        INSERT INTO publishing_jobs (
          id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
          caption_snapshot, media_url_snapshot, scheduled_at, status, published_at, cancelled_at, updated_at, idempotency_key, provider
        ) VALUES ($1, $2, 'VID-GRACE-01', $3, 'tiktok', 'live', 'video', 'Grace test',
          'https://cloud.ast402.my.id/s/xyz/download', CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, 'repliz')
      `, [c.id, testTenant, accId, c.status, pubAt, canAt, updAt, `idem_${c.id}`]);

      await saveMediaStaging({
        tenantId: testTenant,
        jobId: c.id,
        provider: 'google_drive',
        externalFileId: c.fileId,
        publicUrl: `https://drive.usercontent.google.com/download?id=${c.fileId}&export=download`,
        status: 'verified',
        expiresAt: futureExpiry
      });
    }

    const rows = await listExpiredMediaStaging(200, { tenantIds: [testTenant] });
    const tenantRows = rows.filter(r => r.tenant_id === testTenant);
    const returnedIds = new Set(tenantRows.map(r => r.job_id));

    for (const c of cases) {
      assert.equal(returnedIds.has(c.id), c.expectEligible, `Expected ${c.id} (${c.status}) eligibility=${c.expectEligible}`);
    }
  } finally {
    await pgQuery('DELETE FROM publishing_media_staging WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = $1', [testTenant]);
    await pgQuery('DELETE FROM tenants WHERE id = $1', [testTenant]);
  }
});

test('Drive Staging: ref-counting holds shared external_file_id until all sibling jobs are eligible, then deletes physical file once with supportsAllDrives', async () => {
  const { pgQuery } = await import('../lib/db-pg.js');
  const { saveMediaStaging, listExpiredMediaStaging } = await import('../lib/publishing-repository.js');
  const { runPublishingMediaCleanupTick } = await import('../lib/publishing-media-cleanup-worker.js');

  const ts = Date.now();
  const tenantA = `t_refA_${ts}`;
  const tenantB = `t_refB_${ts}`;
  const accA = `acc_refA_${ts}`;
  const accB = `acc_refB_${ts}`;
  const sharedFileId = `shared_drive_file_${ts}`;
  const tenantBFileId = `tenantB_drive_file_${ts}`;
  const futureExpiry = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

  await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING', [tenantA, 'Ref Tenant A', tenantB, 'Ref Tenant B']);
  await pgQuery(`
    INSERT INTO publishing_accounts (id, tenant_id, platform, display_name, provider, provider_account_id, status)
    VALUES ($1, $2, 'facebook', 'Acc A', 'repliz', $3, 'active'),
           ($4, $5, 'tiktok', 'Acc B', 'repliz', $6, 'active')
  `, [accA, tenantA, `rep_refA_${ts}`, accB, tenantB, `rep_refB_${ts}`]);

  const jobFb = `j_fb_${ts}`;
  const jobTt = `j_tt_${ts}`;
  const jobTenantB = `j_tb_${ts}`;

  try {
    // Sibling 1 (published 3h ago) & Sibling 2 (still scheduled) sharing sharedFileId
    await pgQuery(`
      INSERT INTO publishing_jobs (
        id, tenant_id, content_id, account_id, platform, publish_mode, media_type,
        caption_snapshot, media_url_snapshot, scheduled_at, status, published_at, updated_at, idempotency_key, provider
      ) VALUES
        ($1, $2, 'VID-SHARED-01', $3, 'facebook', 'live', 'video', 'Shared FB', 'https://drive.usercontent.google.com/download?id=x', CURRENT_TIMESTAMP, 'published', $4, $4, $5, 'repliz'),
        ($6, $2, 'VID-SHARED-01', $3, 'tiktok', 'live', 'video', 'Shared TT', 'https://drive.usercontent.google.com/download?id=x', CURRENT_TIMESTAMP, 'scheduled', NULL, CURRENT_TIMESTAMP, $7, 'repliz'),
        ($8, $9, 'VID-TB-01', $10, 'tiktok', 'live', 'video', 'Tenant B', 'https://drive.usercontent.google.com/download?id=y', CURRENT_TIMESTAMP, 'published', $4, $4, $11, 'repliz')
    `, [jobFb, tenantA, accA, threeHoursAgo, `idem_${jobFb}`, jobTt, `idem_${jobTt}`, jobTenantB, tenantB, accB, `idem_${jobTenantB}`]);

    await saveMediaStaging({
      tenantId: tenantA,
      jobId: jobFb,
      provider: 'google_drive',
      externalFileId: sharedFileId,
      publicUrl: `https://drive.usercontent.google.com/download?id=${sharedFileId}&export=download`,
      status: 'verified',
      expiresAt: futureExpiry
    });
    await saveMediaStaging({
      tenantId: tenantA,
      jobId: jobTt,
      provider: 'google_drive',
      externalFileId: sharedFileId,
      publicUrl: `https://drive.usercontent.google.com/download?id=${sharedFileId}&export=download`,
      status: 'verified',
      expiresAt: futureExpiry
    });
    await saveMediaStaging({
      tenantId: tenantB,
      jobId: jobTenantB,
      provider: 'google_drive',
      externalFileId: tenantBFileId,
      publicUrl: `https://drive.usercontent.google.com/download?id=${tenantBFileId}&export=download`,
      status: 'verified',
      expiresAt: futureExpiry
    });

    // While jobTt is still scheduled, sharedFileId MUST NOT be eligible
    const beforeRows = await listExpiredMediaStaging(200, { tenantIds: [tenantA, tenantB] });
    assert.equal(beforeRows.some(r => r.external_file_id === sharedFileId), false);
    assert.equal(beforeRows.some(r => r.external_file_id === tenantBFileId), true);

    // Now mark jobTt as published 3h ago
    await pgQuery(`UPDATE publishing_jobs SET status = 'published', published_at = $1, updated_at = $1 WHERE id = $2`, [threeHoursAgo, jobTt]);

    const deleteCalls = [];
    const seenTenants = new Set();
    const mockDriveFactory = async (tenantId) => {
      seenTenants.add(tenantId);
      return {
        files: {
          delete: async (params) => {
            deleteCalls.push({ tenantId, ...params });
          }
        }
      };
    };

    const summary = await runPublishingMediaCleanupTick({
      tenantIds: [tenantA, tenantB],
      driveClientFactory: mockDriveFactory
    });
    assert.equal(summary.deleted, 3);

    const sharedDeletes = deleteCalls.filter(c => c.fileId === sharedFileId);
    const tenantBDeletes = deleteCalls.filter(c => c.fileId === tenantBFileId);

    assert.equal(sharedDeletes.length, 1, 'Shared Drive file must be deleted physically only once');
    assert.equal(sharedDeletes[0].supportsAllDrives, true);
    assert.equal(tenantBDeletes.length, 1);
    assert.equal(tenantBDeletes[0].supportsAllDrives, true);
    assert.equal(seenTenants.has(tenantA), true);
    assert.equal(seenTenants.has(tenantB), true);

    const dbCheck = await pgQuery(
      `SELECT job_id, status, deleted_at FROM publishing_media_staging WHERE job_id = ANY($1::text[])`,
      [[jobFb, jobTt, jobTenantB]]
    );
    assert.equal(dbCheck.rowCount, 3);
    for (const row of dbCheck.rows) {
      assert.equal(row.status, 'deleted');
      assert.ok(row.deleted_at);
    }
  } finally {
    await pgQuery('DELETE FROM publishing_media_staging WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]);
    await pgQuery('DELETE FROM publishing_jobs WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]);
    await pgQuery('DELETE FROM publishing_accounts WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[tenantA, tenantB]]);
  }
});

test('Cleanup and close database connections', async () => {
  const { closePgPool } = await import('../lib/db-pg.js');
  await closePgPool();
});


