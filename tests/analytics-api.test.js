import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.PG_SEARCH_PATH = 'dev';

const { GET: getAccounts } = await import('../app/api/v2/analytics/accounts/route.js');
const { GET: getPosts } = await import('../app/api/v2/analytics/posts/route.js');
const { GET: getHealth } = await import('../app/api/v2/analytics/health/route.js');
const { POST: postCollect } = await import('../app/api/v2/analytics/collect/route.js');

test('GET /api/v2/analytics/accounts returns 200 with standard response format', async () => {
  const req = new Request('http://localhost:5020/api/v2/analytics/accounts?period=7d');
  const res = await getAccounts(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data);
  assert.equal(json.data.period, '7d');
  assert.ok(json.data.summary);
  assert.ok(Array.isArray(json.data.accounts));
});

test('GET /api/v2/analytics/posts returns 200 with pagination', async () => {
  const req = new Request('http://localhost:5020/api/v2/analytics/posts?tag=latest&limit=10&sortBy=engagement_score');
  const res = await getPosts(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data);
  assert.ok(Array.isArray(json.data.posts));
  assert.ok(json.data.pagination);
  assert.equal(json.data.pagination.limit, 10);
});

test('GET /api/v2/analytics/health returns 200 with credentials & scheduler status without leaking secrets', async () => {
  const req = new Request('http://localhost:5020/api/v2/analytics/health');
  const res = await getHealth(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.credentials);
  assert.equal(typeof json.data.credentials.repliz.configured, 'boolean');
  assert.equal(typeof json.data.scheduler.active, 'boolean');
  assert.ok(json.data.accounts);
  assert.ok(json.data.storage);

  // Verifikasi zero secret exposure
  const stringified = JSON.stringify(json);
  assert.equal(stringified.includes('access_key'), false);
  assert.equal(stringified.includes('secret_key'), false);
  assert.equal(stringified.includes('EAAB'), false);
});

test('POST /api/v2/analytics/collect with dryRun=true runs safely without database writes', async () => {
  const req = new Request('http://localhost:5020/api/v2/analytics/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: true })
  });

  const res = await postCollect(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data);
  assert.equal(json.data.dryRun, true);
  assert.equal(json.data.dailyMetricRowsUpserted, 0);
  assert.equal(json.data.postSnapshotsUpserted, 0);
});
