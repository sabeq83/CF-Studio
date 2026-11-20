import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { POST } from '../app/api/v2/products/[id]/photo-replace/route.js';
import { getProductById } from '../lib/product-repository.js';
import { activeSessionsCache } from '../lib/auth.js';
import { pgQuery } from '../lib/db-pg.js';

// Minimal 1x1 transparent PNG buffer for testing
const TINY_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const TEST_TENANT = 'default_tenant';
const TEST_AUTH_TOKEN = 'TEST_MOCK_AUTH_TOKEN_PHOTO_REPLACE';
const createdTestProductIds = [];
const createdJobIds = [];
const createdFiles = [];

// Setup mock session
activeSessionsCache[TEST_AUTH_TOKEN] = {
  id: 'test_admin_user',
  username: 'admin_test',
  role: 'admin',
  tenantId: TEST_TENANT
};

async function createTestProduct(initialProps = {}) {
  const id = `test_prod_${crypto.randomBytes(6).toString('hex')}`;
  createdTestProductIds.push(id);
  await pgQuery(
    `INSERT INTO product_extractions (
      id, tenant_id, product_name, category, photo_status, clean_photo_url, photo_url, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
    [
      id,
      TEST_TENANT,
      initialProps.product_name || 'Test Product Professional Shot',
      'Test Category',
      initialProps.photo_status || 'approved',
      initialProps.clean_photo_url || '/uploads/products/clean/initial_test.png',
      initialProps.photo_url || '/uploads/products/clean/initial_test.png'
    ]
  );
  return id;
}

test('Direct Use Photo Upload: applies professional photo directly without queue or rembg', async (t) => {
  const productId = await createTestProduct({
    clean_photo_url: '/uploads/products/clean/old_clean_photo.png'
  });

  // 1. Mock multipart FormData request with direct_use: 'true'
  const formData = new FormData();
  formData.append('source', 'upload');
  formData.append('direct_use', 'true');
  const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
  formData.append('file', blob, 'pro_packshot_clean.png');

  const req = new Request(`http://localhost:3000/api/v2/products/${productId}/photo-replace`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEST_AUTH_TOKEN}`
    },
    body: formData
  });

  const res = await POST(req, { params: Promise.resolve({ id: productId }) });
  const data = await res.json();

  assert.equal(res.status, 200, 'HTTP status should be 200');
  assert.equal(data.success, true, 'Response should succeed');
  assert.equal(data.mode, 'direct', 'Response mode should be "direct"');
  assert.ok(data.data.clean_photo_url.startsWith('/uploads/products/clean/'), 'Clean photo URL should point to clean dir');
  assert.equal(data.data.photo_status, 'approved', 'Status should be approved');

  // 2. Verify product row in database
  const product = await getProductById(productId);
  assert.equal(product.photo_status, 'approved', 'Database photo_status should be approved');
  assert.equal(product.photo_provider, 'manual_upload', 'photo_provider should be manual_upload');
  assert.equal(product.previous_clean_photo_url, '/uploads/products/clean/old_clean_photo.png', 'Previous clean photo should be preserved');
  assert.equal(product.photo_task_id, null, 'photo_task_id should be null (zero background queue)');
  assert.ok(product.photo_reviewed_at, 'photo_reviewed_at should have a timestamp');

  // 3. Verify physical files exist on disk
  const cleanAbs = path.join(process.cwd(), 'public', product.clean_photo_url);
  const rawAbs = path.join(process.cwd(), 'public', product.raw_photo_url);
  createdFiles.push(cleanAbs, rawAbs);

  assert.ok(fs.existsSync(cleanAbs), `Clean file must exist on disk: ${cleanAbs}`);
  assert.ok(fs.existsSync(rawAbs), `Raw file must exist on disk: ${rawAbs}`);
});

test('Non-Direct Photo Upload (Legacy): queues background rembg job when direct_use is false', async (t) => {
  const productId = await createTestProduct();

  const formData = new FormData();
  formData.append('source', 'upload');
  formData.append('direct_use', 'false');
  const blob = new Blob([TINY_PNG_BUFFER], { type: 'image/png' });
  formData.append('file', blob, 'raw_mobile_snapshot.png');

  const req = new Request(`http://localhost:3000/api/v2/products/${productId}/photo-replace`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEST_AUTH_TOKEN}`
    },
    body: formData
  });

  const res = await POST(req, { params: Promise.resolve({ id: productId }) });
  const data = await res.json();

  assert.equal(res.status, 200, 'HTTP status should be 200');
  assert.equal(data.success, true, 'Response should succeed');
  assert.equal(data.mode, 'upload', 'Response mode should be "upload"');
  assert.ok(data.job_id, 'job_id should be returned for background queue');
  createdJobIds.push(data.job_id);

  // Verify product row is processing with job id
  const product = await getProductById(productId);
  assert.equal(product.photo_status, 'processing', 'Database photo_status should be processing');
  assert.equal(product.photo_provider, 'photo_replace', 'photo_provider should be photo_replace');
  assert.equal(product.photo_task_id, String(data.job_id), 'photo_task_id should match created job');

  // Verify job in database queue contains raw_path
  const jobRow = (await pgQuery('SELECT payload FROM scheduler_jobs WHERE id = $1', [data.job_id])).rows[0];
  assert.ok(jobRow, 'Job row must exist in scheduler_jobs');
  const payload = typeof jobRow.payload === 'string' ? JSON.parse(jobRow.payload) : jobRow.payload;
  assert.ok(payload.raw_path, 'Payload must contain raw_path');

  const rawAbs = path.join(process.cwd(), 'public', payload.raw_path);
  createdFiles.push(rawAbs);
  assert.ok(fs.existsSync(rawAbs), 'Raw file should be saved for worker processing');
});

test('Direct Use Photo Upload: rejects invalid file or missing upload', async (t) => {
  const productId = await createTestProduct();

  // Missing file
  const formData = new FormData();
  formData.append('source', 'upload');
  formData.append('direct_use', 'true');

  const req = new Request(`http://localhost:3000/api/v2/products/${productId}/photo-replace`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEST_AUTH_TOKEN}`
    },
    body: formData
  });

  const res = await POST(req, { params: Promise.resolve({ id: productId }) });
  const data = await res.json();

  assert.equal(res.status, 400, 'HTTP status should be 400 when file is missing');
  assert.equal(data.success, false);
});

// Cleanup test records and files
test.after(async () => {
  delete activeSessionsCache[TEST_AUTH_TOKEN];
  for (const id of createdTestProductIds) {
    try {
      await pgQuery('DELETE FROM product_extractions WHERE id = $1', [id]);
    } catch (_) {}
  }
  for (const jid of createdJobIds) {
    try {
      await pgQuery('DELETE FROM scheduler_jobs WHERE id = $1', [jid]);
    } catch (_) {}
  }
  for (const f of createdFiles) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (_) {}
  }
});
