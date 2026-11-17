import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import module from 'node:module';

// Set env BEFORE importing DB/app modules
process.env.NODE_ENV = 'development';
process.env.PGHOST = process.env.PGHOST || '100.78.186.123';
process.env.PGPORT = process.env.PGPORT || '5432';
process.env.PGUSER = process.env.PGUSER || 'makna_user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'maknagridpass';
process.env.PGDATABASE = process.env.PGDATABASE || 'maknaflow_db';
process.env.PG_SEARCH_PATH = 'dev';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_REDIS_QUEUE = 'false';

// Resolve '@/...' alias used by Next.js App Router files
const repoRoot = process.cwd();
if (typeof module.registerHooks === 'function') {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('@/')) {
        const subPath = specifier.slice(2);
        const candidates = [
          path.join(repoRoot, subPath),
          path.join(repoRoot, `${subPath}.js`),
          path.join(repoRoot, subPath, 'index.js')
        ];
        const found = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (found) {
          return nextResolve(new URL(`file://${found}`).href, context);
        }
      }
      if (specifier === 'next/server') {
        const nextServerJs = path.join(repoRoot, 'node_modules/next/server.js');
        if (fs.existsSync(nextServerJs)) {
          return nextResolve(new URL(`file://${nextServerJs}`).href, context);
        }
      }
      return nextResolve(specifier, context);
    }
  });
}

const { pgQuery, getPgPool } = await import('../lib/db-pg.js');
const { setSetting, glabsTaskRoutesCache } = await import('../lib/db.js');
const { tenantContext } = await import('../lib/tenant-context.js');
const { activeSessionsCache } = await import('../lib/auth.js');
const { createProduct, getProductById, updateProduct } = await import('../lib/product-repository.js');
const { buildGptProductPrompt } = await import('../lib/product-photo-service.js');
const { pollGlabsPhotoTask } = await import('../lib/product-photo-providers/glabs.js');
const { processProductPhoto, pollPendingProductPhotoTasks } = await import('../lib/product-bulk-worker.js');
const { POST: regeneratePhotosPost } = await import('../app/api/v2/products/regenerate-photos/route.js');
const { POST: photoReviewPost } = await import('../app/api/v2/products/[id]/photo-review/route.js');

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const tenantA = `test_gpt_a_${suffix}`;
const tenantB = `test_gpt_b_${suffix}`;
const tokenA = `tok_gpt_a_${suffix}`;
const tokenB = `tok_gpt_b_${suffix}`;
const prodLocalA = `prod_gpt_local_${suffix}`;
const prodExtA = `prod_gpt_ext_${suffix}`;
const prodBusyA = `prod_gpt_busy_${suffix}`;

// 1x1 PNG valid bytes (> 1KB padding)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const MOCK_IMAGE_BYTES = Buffer.concat([TINY_PNG, Buffer.alloc(1200, 0)]);

const rawRelPath = `/uploads/products/raw/test_gpt_raw_${suffix}.png`;
const rawAbsPath = path.join(repoRoot, 'public', rawRelPath);
const createdFiles = [rawAbsPath];

let worker1Calls = [];
let worker2Calls = [];
let mockWorker1Handler = null;
let mockWorker2Handler = null;
let server1;
let server2;
let port1;
let port2;

function startMockServer(callsLog, getHandler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let jsonBody = null;
        try { if (rawBody) jsonBody = JSON.parse(rawBody); } catch (_) {}
        const entry = { method: req.method, url: req.url, headers: req.headers, body: jsonBody };
        callsLog.push(entry);
        const handler = getHandler();
        if (!handler) {
          res.statusCode = 404;
          res.end('No mock handler');
          return;
        }
        handler(entry, res);
      });
    });
    srv.listen(0, '127.0.0.1', () => {
      resolve({ srv, port: srv.address().port });
    });
  });
}

function makePostReq(url, body, sessionToken) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `makna_session=${sessionToken}`
    },
    body: JSON.stringify(body)
  });
}

before(async () => {
  await pgQuery(`
    ALTER TABLE product_extractions
    ADD COLUMN IF NOT EXISTS photo_engine_request TEXT,
    ADD COLUMN IF NOT EXISTS photo_model TEXT,
    ADD COLUMN IF NOT EXISTS previous_photo_model TEXT
  `);

  ({ srv: server1, port: port1 } = await startMockServer(worker1Calls, () => mockWorker1Handler));
  ({ srv: server2, port: port2 } = await startMockServer(worker2Calls, () => mockWorker2Handler));

  fs.mkdirSync(path.dirname(rawAbsPath), { recursive: true });
  fs.writeFileSync(rawAbsPath, MOCK_IMAGE_BYTES);

  activeSessionsCache[tokenA] = { id: `u_a_${suffix}`, username: 'usera', role: 'admin', status: 'active', tenantId: tenantA };
  activeSessionsCache[tokenB] = { id: `u_b_${suffix}`, username: 'userb', role: 'admin', status: 'active', tenantId: tenantB };

  for (const tId of [tenantA, tenantB]) {
    await tenantContext.run(tId, async () => {
      await setSetting('webhook_host', '127.0.0.1');
      await setSetting('webhook_port', String(port1));
      await setSetting('webhook_api_key', 'TEST_MOCK_KEY');
      await setSetting('webhook_delay_enabled', '0');
    });
  }

  await tenantContext.run(tenantA, async () => {
    await createProduct({
      id: prodLocalA,
      product_name: 'Serum Vit C Botol Kaca',
      product_description: 'Serum perawatan wajah botol pipet kaca bening 30ml',
      raw_photo_url: rawRelPath,
      photo_url: rawRelPath,
      clean_photo_t2i_prompt: 'Keep orange dropper cap and crisp black typography without glossy reflection, 8k',
      packaging_status: 'packaged',
      packaging_type: 'Dropper Bottle',
      enrichment_status: 'completed',
      photo_status: 'approved'
    });
    await createProduct({
      id: prodExtA,
      product_name: 'Produk Tanpa Raw Lokal',
      product_description: 'Hanya punya link eksternal',
      scraped_image_url: 'https://example.com/ext.jpg',
      raw_photo_url: null,
      enrichment_status: 'completed',
      photo_status: 'approved'
    });
    await createProduct({
      id: prodBusyA,
      product_name: 'Produk Sedang Proses',
      product_description: 'Sedang diproses worker',
      raw_photo_url: rawRelPath,
      enrichment_status: 'completed',
      photo_status: 'processing'
    });
  });
});

after(async () => {
  delete activeSessionsCache[tokenA];
  delete activeSessionsCache[tokenB];

  try {
    const res = await pgQuery(
      `SELECT clean_photo_url, previous_clean_photo_url FROM product_extractions WHERE tenant_id = ANY($1::text[])`,
      [[tenantA, tenantB]]
    );
    for (const row of res.rows) {
      for (const rel of [row.clean_photo_url, row.previous_clean_photo_url]) {
        if (rel && rel.startsWith('/uploads/')) {
          createdFiles.push(path.join(repoRoot, 'public', rel));
        }
      }
    }
  } catch (_) {}

  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = ANY($1::text[])`, [[tenantA, tenantB]]).catch(() => {});
  await pgQuery(`DELETE FROM tenant_settings WHERE tenant_id = ANY($1::text[])`, [[tenantA, tenantB]]).catch(() => {});

  for (const f of createdFiles) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  }

  await new Promise(r => server1?.close(r) || r());
  await new Promise(r => server2?.close(r) || r());
  await getPgPool().end().catch(() => {});
});

test('B9.1: API menolak GPT bila > 1 produk (400), engine tak dikenal (400), busy (409), dan skip bila tanpa raw lokal', async () => {
  const resMulti = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA, prodExtA], engine: 'gpt_image_2' }, tokenA)
  );
  assert.equal(resMulti.status, 400);

  const resUnknown = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA], engine: 'dall_e_99' }, tokenA)
  );
  assert.equal(resUnknown.status, 400);

  const resBusy = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodBusyA], engine: 'gpt_image_2' }, tokenA)
  );
  assert.equal(resBusy.status, 409);

  const resExt = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodExtA], engine: 'gpt_image_2' }, tokenA)
  );
  assert.equal(resExt.status, 200);
  const bodyExt = await resExt.json();
  assert.equal(bodyExt.results[0].status, 'skipped');
  assert.ok(bodyExt.results[0].reason.includes('Foto mentah belum tersimpan di server'));
});

test('B9.2: Isolasi tenant — tenant B tidak dapat mengantrekan produk tenant A', async () => {
  const resCross = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA], engine: 'gpt_image_2' }, tokenB)
  );
  assert.equal(resCross.status, 200);
  const bodyCross = await resCross.json();
  assert.equal(bodyCross.results[0].status, 'not_found');

  const untouched = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(untouched.photo_status, 'approved');
  assert.equal(untouched.photo_engine_request, null);
});

test('B9.3: Tombol biasa -> /api/image/generate, kosongkan photo_engine_request, simpan model Nano Banana', async () => {
  await tenantContext.run(tenantA, () => updateProduct(prodLocalA, { photo_engine_request: 'gpt_image_2' }));

  const resNormal = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA] }, tokenA)
  );
  assert.equal(resNormal.status, 200);

  const queuedProd = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(queuedProd.photo_status, 'pending');
  assert.equal(queuedProd.photo_engine_request, null);

  worker1Calls.length = 0;
  mockWorker1Handler = (req, res) => {
    if (req.url === '/api/image/generate') {
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: `nano_t_${suffix}`, status: 'pending', effective_model: 'nano_banana_2' }));
      return;
    }
    if (req.url === `/api/status/nano_t_${suffix}`) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: `nano_t_${suffix}`, status: 'completed', results: ['nano_clean.png'] }));
      return;
    }
    if (req.url === '/api/files/nano_clean.png') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.end(MOCK_IMAGE_BYTES);
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  };

  await tenantContext.run(tenantA, async () => {
    await processProductPhoto({ ...queuedProd, tenantId: tenantA });
    await pollPendingProductPhotoTasks({ tenantId: tenantA, limit: 10 });
  });

  assert.ok(worker1Calls.some(c => c.url === '/api/image/generate'), 'Harus memanggil /api/image/generate');
  assert.equal(worker1Calls.some(c => c.url === '/api/openai/generate'), false);

  const doneProd = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(doneProd.photo_model, 'nano_banana_2');
  assert.equal(doneProd.photo_engine_request, null);
  assert.ok(doneProd.clean_photo_url);
});

test('B9.4: Engine GPT -> /api/openai/generate (1:1/high/direct/none/false, tanpa model, prompt tidak disanitasi) & simpan sukses + revert', async () => {
  const beforeGpt = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  const oldCleanUrl = beforeGpt.clean_photo_url;
  const oldModel = beforeGpt.photo_model;

  const resGpt = await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA], engine: 'gpt_image_2' }, tokenA)
  );
  assert.equal(resGpt.status, 200);

  const queuedGpt = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(queuedGpt.photo_engine_request, 'gpt_image_2');
  assert.equal(queuedGpt.photo_provider, 'glabs');

  worker1Calls.length = 0;
  mockWorker1Handler = (req, res) => {
    if (req.url === '/api/openai/generate') {
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: `gpt_t_${suffix}`, status: 'pending' }));
      return;
    }
    if (req.url === `/api/status/gpt_t_${suffix}`) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: `gpt_t_${suffix}`, status: 'completed', results: ['gpt_clean.jpeg'] }));
      return;
    }
    if (req.url === '/api/files/gpt_clean.jpeg') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.end(MOCK_IMAGE_BYTES);
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  };

  await tenantContext.run(tenantA, async () => {
    await processProductPhoto({ ...queuedGpt, tenantId: tenantA });
    await pollPendingProductPhotoTasks({ tenantId: tenantA, limit: 10 });
  });

  const openaiCall = worker1Calls.find(c => c.url === '/api/openai/generate');
  assert.ok(openaiCall, 'Harus memanggil /api/openai/generate');
  const sentBody = openaiCall.body;
  assert.equal(sentBody.aspect_ratio, '1:1');
  assert.equal(sentBody.quality, 'high');
  assert.equal(sentBody.prompt_mode, 'direct');
  assert.equal(sentBody.reasoning, 'none');
  assert.equal(sentBody.web_search, false);
  assert.equal('model' in sentBody, false, 'Tidak boleh ada field model');
  assert.equal(sentBody.prompt, buildGptProductPrompt(queuedGpt), 'Prompt tidak boleh melewati sanitizeImagePrompt');
  assert.ok(sentBody.prompt.includes('8k'), 'Detail clean_photo_t2i_prompt harus dipertahankan utuh (tidak disanitasi)');
  assert.equal(worker1Calls.some(c => c.url === '/api/image/generate'), false);

  const afterGpt = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(afterGpt.photo_model, 'gpt_image_2');
  assert.equal(afterGpt.previous_photo_model, oldModel);
  assert.equal(afterGpt.previous_clean_photo_url, oldCleanUrl);
  assert.equal(afterGpt.photo_engine_request, null);
  assert.notEqual(afterGpt.clean_photo_url, oldCleanUrl);

  const resRevert = await photoReviewPost(
    makePostReq(`http://localhost/api/v2/products/${prodLocalA}/photo-review`, { action: 'revert_previous' }, tokenA),
    { params: Promise.resolve({ id: prodLocalA }) }
  );
  assert.equal(resRevert.status, 200);
  const afterRevert = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(afterRevert.clean_photo_url, oldCleanUrl);
  assert.equal(afterRevert.photo_model, oldModel);
  assert.equal(afterRevert.previous_photo_model, null);
  assert.equal(afterRevert.previous_clean_photo_url, null);
});

test('B9.5: GPT gagal -> tidak ada submit Nano Banana, foto lama utuh, photo_error berisi pesan asli', async () => {
  const beforeFail = await tenantContext.run(tenantA, () => getProductById(prodLocalA));

  await regeneratePhotosPost(
    makePostReq('http://localhost/api/v2/products/regenerate-photos', { ids: [prodLocalA], engine: 'gpt_image_2' }, tokenA)
  );
  const queued = await tenantContext.run(tenantA, () => getProductById(prodLocalA));

  worker1Calls.length = 0;
  mockWorker1Handler = (req, res) => {
    if (req.url === '/api/openai/generate') {
      res.statusCode = 202;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: `gpt_fail_${suffix}`, status: 'pending' }));
      return;
    }
    if (req.url === `/api/status/gpt_fail_${suffix}`) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        task_id: `gpt_fail_${suffix}`,
        status: 'failed',
        error: 'ChatGPT account not logged in or quota exceeded'
      }));
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  };

  await tenantContext.run(tenantA, async () => {
    await processProductPhoto({ ...queued, tenantId: tenantA });
    await pollPendingProductPhotoTasks({ tenantId: tenantA, limit: 10 });
  });

  assert.equal(worker1Calls.some(c => c.url === '/api/image/generate'), false, 'Tidak boleh fallback ke Nano Banana');

  const afterFail = await tenantContext.run(tenantA, () => getProductById(prodLocalA));
  assert.equal(afterFail.photo_status, 'failed');
  assert.ok(afterFail.photo_error.includes('ChatGPT account not logged in or quota exceeded'));
  assert.equal(afterFail.clean_photo_url, beforeFail.clean_photo_url, 'Foto clean lama harus tetap utuh');
  assert.equal(afterFail.photo_model, beforeFail.photo_model, 'Model foto lama harus tetap utuh');
  assert.equal(afterFail.photo_engine_request, null);
});

test('B9.6: pollGlabsPhotoTask memanggil getFileUrl dengan taskId (mengunduh dari worker yang mengerjakan)', async () => {
  const routedTaskId = `routed_task_${suffix}`;
  glabsTaskRoutesCache[routedTaskId] = { host: '127.0.0.1', port: String(port2), api_key: 'ROUTE_KEY' };

  worker1Calls.length = 0;
  worker2Calls.length = 0;
  mockWorker2Handler = (req, res) => {
    if (req.url === `/api/status/${routedTaskId}`) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ task_id: routedTaskId, status: 'completed', results: ['routed_output.jpeg'] }));
      return;
    }
    if (req.url === '/api/files/routed_output.jpeg') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.end(MOCK_IMAGE_BYTES);
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  };

  try {
    const pollRes = await pollGlabsPhotoTask(routedTaskId);
    assert.equal(pollRes.completed, true);
    assert.ok(worker2Calls.some(c => c.url === '/api/files/routed_output.jpeg'), 'Harus mengunduh dari worker 2 sesuai taskId');
    assert.equal(worker1Calls.some(c => c.url === '/api/files/routed_output.jpeg'), false, 'Tidak boleh salah unduh ke worker 1');
  } finally {
    delete glabsTaskRoutesCache[routedTaskId];
  }
});
