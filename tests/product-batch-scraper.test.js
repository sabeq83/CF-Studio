import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import module from 'node:module';

process.env.NODE_ENV = 'development';
process.env.PGHOST = process.env.PGHOST || '100.78.186.123';
process.env.PGPORT = process.env.PGPORT || '5432';
process.env.PGUSER = process.env.PGUSER || 'makna_user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'maknagridpass';
process.env.PGDATABASE = process.env.PGDATABASE || 'maknaflow_db';
process.env.PG_SEARCH_PATH = 'dev';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

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
const { tenantContext } = await import('../lib/tenant-context.js');
const { activeSessionsCache } = await import('../lib/auth.js');
const { createProduct, getProductById } = await import('../lib/product-repository.js');
const { assessProductCompleteness } = await import('../lib/product-completeness.js');
const { runScraperGenerativePolish } = await import('../lib/scheduler-processors.js');
const { processQueue } = await import('../lib/scheduler.js');
const { POST: scrapePost } = await import('../app/api/v2/products/scrape/route.js');

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const tenantA = `test_bs_a_${suffix}`;
const tenantB = `test_bs_b_${suffix}`;
const tokenA = `tok_bs_a_${suffix}`;
const tokenB = `tok_bs_b_${suffix}`;
const prodA = `prod_bs_a_${suffix}`;
const prodB = `prod_bs_b_${suffix}`;
const prodSharedUrl = `https://shopee.co.id/product-batch-test-${suffix}`;

const rawRelPath = `/uploads/products/raw/test_bs_raw_${suffix}.png`;
const cleanRelPath = `/uploads/products/clean/test_bs_clean_${suffix}.png`;
const rawAbsPath = path.join(repoRoot, 'public', rawRelPath);
const cleanAbsPath = path.join(repoRoot, 'public', cleanRelPath);
const createdFiles = [rawAbsPath, cleanAbsPath];
const createdJobIds = [];

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function makePostReq(body, token) {
  return new Request('http://localhost/api/v2/products/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `makna_session=${token}`
    },
    body: JSON.stringify(body)
  });
}

before(async () => {
  fs.mkdirSync(path.dirname(rawAbsPath), { recursive: true });
  fs.mkdirSync(path.dirname(cleanAbsPath), { recursive: true });
  fs.writeFileSync(rawAbsPath, TINY_PNG);
  fs.writeFileSync(cleanAbsPath, TINY_PNG);

  activeSessionsCache[tokenA] = { id: `u_a_${suffix}`, username: 'bsusera', role: 'admin', status: 'active', tenantId: tenantA };
  activeSessionsCache[tokenB] = { id: `u_b_${suffix}`, username: 'bsuserb', role: 'admin', status: 'active', tenantId: tenantB };

  await tenantContext.run(tenantA, async () => {
    await createProduct({
      id: prodA,
      product_name: 'Produk Batch Test A',
      product_description: 'Produk lengkap pipeline baru',
      input_source: prodSharedUrl,
      source_url: prodSharedUrl,
      affiliate_link: 'https://shope.ee/aff-lama-a',
      raw_photo_url: rawRelPath,
      clean_photo_url: cleanRelPath,
      cleaned_photo_url: cleanRelPath,
      generated_photo_url: null,
      unique_selling_point: '["USP 1"]',
      packaging_type: 'Botol Plastik',
      t2i_prompt: 'Studio product bottle',
      i2v_action_prompt: 'Slow pan over bottle',
      photo_status: 'approved'
    });
  });

  await tenantContext.run(tenantB, async () => {
    await createProduct({
      id: prodB,
      product_name: 'Produk Batch Test B',
      product_description: 'Produk tenant B dengan URL sama',
      input_source: prodSharedUrl,
      source_url: prodSharedUrl,
      affiliate_link: 'https://shope.ee/aff-lama-b',
      raw_photo_url: rawRelPath,
      clean_photo_url: cleanRelPath,
      cleaned_photo_url: cleanRelPath,
      unique_selling_point: '["USP B"]',
      packaging_type: 'Sachet',
      t2i_prompt: 'Studio product sachet',
      i2v_action_prompt: 'Static zoom',
      photo_status: 'approved'
    });
  });
});

after(async () => {
  delete activeSessionsCache[tokenA];
  delete activeSessionsCache[tokenB];

  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = ANY($1::text[])`, [[tenantA, tenantB]]).catch(() => {});
  if (createdJobIds.length > 0) {
    await pgQuery(`DELETE FROM scheduler_jobs WHERE id = ANY($1::int[])`, [createdJobIds]).catch(() => {});
  }
  await pgQuery(`DELETE FROM scheduler_jobs WHERE queue_name = 'product_scraper' AND payload LIKE $1`, [`%${suffix}%`]).catch(() => {});

  for (const f of createdFiles) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  }
  await getPgPool().end().catch(() => {});
});

test('2.3.1: API menolak 51 URL manual (400) dan 51 baris CSV (400) tanpa membuat job', async () => {
  const beforeJobs = await pgQuery(`SELECT COUNT(*)::int AS c FROM scheduler_jobs WHERE queue_name = 'product_scraper'`);

  const urls51 = Array.from({ length: 51 }, (_, i) => `https://shopee.co.id/item-limit-${suffix}-${i}`).join('\n');
  const resManual = await scrapePost(makePostReq({ urls: urls51, repair_mode: false }, tokenA));
  assert.equal(resManual.status, 400);
  const bodyManual = await resManual.json();
  assert.equal(bodyManual.success, false);

  const csv51 = Array.from({ length: 51 }, (_, i) => ({
    url: `https://tokopedia.com/toko/item-limit-${suffix}-${i}`,
    affiliate_link: ''
  }));
  const resCsv = await scrapePost(makePostReq({ csv_data: csv51, repair_mode: false }, tokenA));
  assert.equal(resCsv.status, 400);

  const afterJobs = await pgQuery(`SELECT COUNT(*)::int AS c FROM scheduler_jobs WHERE queue_name = 'product_scraper'`);
  assert.equal(afterJobs.rows[0].c, beforeJobs.rows[0].c, 'Tidak boleh ada job yang dibuat saat >50 URL');
});

test('2.3.2: CSV afiliasi kosong mempertahankan link lama; update afiliasi terisolasi per tenant', async () => {
  const resEmptyAff = await scrapePost(
    makePostReq({ csv_data: [{ url: prodSharedUrl, affiliate_link: '   ' }], repair_mode: false }, tokenA)
  );
  assert.equal(resEmptyAff.status, 200);
  const bodyEmpty = await resEmptyAff.json();
  assert.equal(bodyEmpty.updated_count, 0);

  const afterEmptyA = await tenantContext.run(tenantA, () => getProductById(prodA));
  assert.equal(afterEmptyA.affiliate_link, 'https://shope.ee/aff-lama-a', 'Link afiliasi lama harus tetap utuh');

  const resNewAff = await scrapePost(
    makePostReq({ csv_data: [{ url: prodSharedUrl, affiliate_link: 'https://shope.ee/aff-baru-a' }], repair_mode: false }, tokenA)
  );
  assert.equal(resNewAff.status, 200);
  const bodyNew = await resNewAff.json();
  assert.equal(bodyNew.updated_count, 1);

  const afterNewA = await tenantContext.run(tenantA, () => getProductById(prodA));
  const afterNewB = await tenantContext.run(tenantB, () => getProductById(prodB));
  assert.equal(afterNewA.affiliate_link, 'https://shope.ee/aff-baru-a');
  assert.equal(afterNewB.affiliate_link, 'https://shope.ee/aff-lama-b', 'Tenant B tidak boleh tersentuh');
});

test('2.3.3: URL sudah ada + repair_mode=false dilewati; S3 repair_mode=true tetap melewati produk pipeline baru (clean ada, studio kosong)', async () => {
  const beforeJobs = await pgQuery(`SELECT COUNT(*)::int AS c FROM scheduler_jobs WHERE queue_name = 'product_scraper'`);

  const resOff = await scrapePost(makePostReq({ urls: prodSharedUrl, repair_mode: false }, tokenA));
  assert.equal(resOff.status, 200);
  const bodyOff = await resOff.json();
  assert.equal(bodyOff.enqueued_count, 0);
  assert.equal(bodyOff.skipped_count, 1);

  const resS3On = await scrapePost(makePostReq({ urls: prodSharedUrl, repair_mode: true }, tokenA));
  assert.equal(resS3On.status, 200);
  const bodyS3On = await resS3On.json();
  assert.equal(bodyS3On.enqueued_count, 0, 'Produk dengan clean_photo_url cukup tidak boleh dianggap rumpang walau generated_photo_url kosong');
  assert.equal(bodyS3On.skipped_count, 1);

  const afterJobs = await pgQuery(`SELECT COUNT(*)::int AS c FROM scheduler_jobs WHERE queue_name = 'product_scraper'`);
  assert.equal(afterJobs.rows[0].c, beforeJobs.rows[0].c);
});

test('S3: assessProductCompleteness menangani 4 kasus kelengkapan produk', () => {
  const existingFiles = new Set(['/uploads/raw.png', '/uploads/clean.png']);
  const fileExists = (p) => existingFiles.has(p);

  // 1. Pipeline baru: clean ada, studio kosong -> tidak rumpang
  const c1 = assessProductCompleteness({
    raw_photo_url: '/uploads/raw.png',
    clean_photo_url: '/uploads/clean.png',
    generated_photo_url: null,
    unique_selling_point: '["USP"]',
    packaging_type: 'Botol',
    t2i_prompt: 't2i',
    i2v_action_prompt: 'i2v'
  }, { fileExists });
  assert.equal(c1.anyMissing, false);
  assert.equal(c1.needsStudio, false);

  // 2. Tanpa raw -> rumpang
  const c2 = assessProductCompleteness({
    raw_photo_url: null,
    clean_photo_url: '/uploads/clean.png',
    unique_selling_point: '["USP"]',
    packaging_type: 'Botol',
    t2i_prompt: 't2i',
    i2v_action_prompt: 'i2v'
  }, { fileExists });
  assert.equal(c2.needsRaw, true);
  assert.equal(c2.anyMissing, true);

  // 3. Metadata kosong -> rumpang
  const c3 = assessProductCompleteness({
    raw_photo_url: '/uploads/raw.png',
    clean_photo_url: '/uploads/clean.png',
    unique_selling_point: '["USP"]',
    packaging_type: 'Botol',
    t2i_prompt: null,
    i2v_action_prompt: 'i2v'
  }, { fileExists });
  assert.equal(c3.needsMetadata, true);
  assert.equal(c3.anyMissing, true);

  // 4. File tercatat di DB tapi hilang di disk -> rumpang
  const c4 = assessProductCompleteness({
    raw_photo_url: '/uploads/missing_raw.png',
    clean_photo_url: '/uploads/clean.png',
    unique_selling_point: '["USP"]',
    packaging_type: 'Botol',
    t2i_prompt: 't2i',
    i2v_action_prompt: 'i2v'
  }, { fileExists });
  assert.equal(c4.needsRaw, true);
  assert.equal(c4.anyMissing, true);
});

test('S5: runScraperGenerativePolish mencatat failed & timeout ke studioPolish tanpa mengubah photo_status', async () => {
  const failedRes = await runScraperGenerativePolish({
    productId: 'p_s5_fail',
    photoTimestamp: 123,
    cleanPhotoPath: cleanRelPath,
    t2iPrompt: 'Studio shot',
    cleanedDataUrl: 'data:image/png;base64,AA==',
    generateImageFn: async () => ({ task_id: 'task_s5_fail' }),
    getTaskStatusFn: async () => ({ status: 'failed', error: 'G-Labs quota reached' }),
    getFileUrlFn: () => 'http://localhost/f.jpg',
    pollDelayMs: 0,
    maxPolls: 3
  });
  assert.equal(failedRes.generatedPhotoPath, null);
  assert.equal(failedRes.studioPolish.status, 'failed');
  assert.equal(failedRes.studioPolish.task_id, 'task_s5_fail');
  assert.equal(failedRes.studioPolish.error, 'G-Labs quota reached');

  const timeoutRes = await runScraperGenerativePolish({
    productId: 'p_s5_to',
    photoTimestamp: 124,
    cleanPhotoPath: cleanRelPath,
    t2iPrompt: 'Studio shot',
    cleanedDataUrl: 'data:image/png;base64,AA==',
    generateImageFn: async () => ({ task_id: 'task_s5_to' }),
    getTaskStatusFn: async () => ({ status: 'pending' }),
    getFileUrlFn: () => 'http://localhost/f.jpg',
    pollDelayMs: 0,
    maxPolls: 3
  });
  assert.equal(timeoutRes.generatedPhotoPath, null);
  assert.equal(timeoutRes.studioPolish.status, 'timeout');
  assert.equal(timeoutRes.studioPolish.task_id, 'task_s5_to');
  assert.ok(timeoutRes.studioPolish.error.includes('Timeout'));
});

test('S6: processQueue product_scraper maksimal 1 job berjalan lintas tick', async () => {
  // Pastikan hanya job uji kita yang pending di queue product_scraper selama tes ini
  for (let i = 1; i <= 3; i++) {
    const ins = await pgQuery(
      `INSERT INTO scheduler_jobs (queue_name, status, payload, run_at) VALUES ('product_scraper', 'pending', $1, $2) RETURNING id`,
      [JSON.stringify({ tenant_id: tenantA, urls: [`https://shopee.co.id/s6-${suffix}-${i}`] }), '2000-01-01T00:00:00.000Z']
    );
    createdJobIds.push(ins.rows[0].id);
  }

  let releaseFirstJob;
  const firstJobStarted = new Promise((resolveStarted) => {
    const firstJobGate = new Promise((res) => { releaseFirstJob = res; });
    const startedUrls = [];

    const mockProcessor = async (payload) => {
      startedUrls.push(payload.urls[0]);
      if (startedUrls.length === 1) {
        resolveStarted();
        await firstJobGate;
      }
      return { processed: true };
    };

    // Simpan ke closure via outer ref
    globalThis.__s6TestHelpers = { mockProcessor, startedUrls };
  });

  const tick1Promise = processQueue('product_scraper', { processorOverride: globalThis.__s6TestHelpers.mockProcessor });
  await firstJobStarted;

  // Tick kedua saat job #1 masih berjalan tidak boleh mengklaim job ke-2
  const tick2Processed = await processQueue('product_scraper', { processorOverride: globalThis.__s6TestHelpers.mockProcessor });
  assert.equal(tick2Processed, false, 'Tick kedua harus berhenti karena cap=1 masih berjalan');

  const runningRows = await pgQuery(
    `SELECT id, status FROM scheduler_jobs WHERE id = ANY($1::int[]) ORDER BY id ASC`,
    [createdJobIds]
  );
  const runningCount = runningRows.rows.filter(r => r.status === 'running').length;
  const pendingCount = runningRows.rows.filter(r => r.status === 'pending').length;
  assert.equal(runningCount, 1, 'Hanya boleh ada 1 job berstatus running');
  assert.equal(pendingCount, 2, '2 job sisanya harus tetap pending');

  // Lepas job #1, lalu tick berikutnya mengklaim job #2
  releaseFirstJob();
  await tick1Promise;

  const tick3Processed = await processQueue('product_scraper', { processorOverride: globalThis.__s6TestHelpers.mockProcessor });
  assert.equal(tick3Processed, true, 'Setelah job #1 selesai, job #2 harus langsung diklaim');
  assert.equal(globalThis.__s6TestHelpers.startedUrls.length, 2);

  // Selesaikan job #3 agar bersih
  await processQueue('product_scraper', { processorOverride: globalThis.__s6TestHelpers.mockProcessor });
  delete globalThis.__s6TestHelpers;
});
