import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { tenantContext } from '../../lib/tenant-context.js';
import { createSession, destroySession } from '../../lib/auth.js';
import { hashPassword } from '../../lib/schema/user-schema.js';
import {
  upsertResearchBatch,
  upsertResearchCandidates,
  getResearchCandidateById
} from '../../lib/product-research-repository.js';
import {
  promoteResearchCandidate,
  getResearchCandidatePromotionStatus
} from '../../lib/product-research-promotion-service.js';
import { POST as promotePost } from '../../app/api/v2/product-research/candidates/[id]/promote/route.js';
import { GET as statusGet } from '../../app/api/v2/product-research/candidates/[id]/status/route.js';
import { POST as legacyScrapePost } from '../../app/api/v2/products/scrape/route.js';
import { GET as legacyScrapeJobGet } from '../../app/api/v2/products/scrape/jobs/[jobId]/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_promo_a_${runSuffix}`;
const TENANT_B = `test_promo_b_${runSuffix}`;
const USER_A = `usr_promo_a_${runSuffix}`;
const USER_B = `usr_promo_b_${runSuffix}`;
const EXISTING_CAT_ID = `pe_promo_exist_${runSuffix}`;
const NEW_PROD_ID = `pe_promo_new_${runSuffix}`;

function makeReq(urlPath, { method = 'POST', sessionToken = null, body = null } = {}) {
  const headers = {};
  const cookieName = process.env.SESSION_COOKIE_NAME || 'makna_session';
  if (sessionToken) headers.cookie = `${cookieName}=${sessionToken}`;
  if (body !== null) headers['content-type'] = 'application/json';
  return new Request(`http://127.0.0.1:5020${urlPath}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
}

describe('Promosi Radar Produk & Kontrak Scrape Route (Tahap 5)', () => {
  let sessA = null;
  let sessB = null;
  let batchIdA = null;
  let candNearestId = null;
  let candNotFoundId = null;
  let candDupId = null;
  let candNewParallelId = null;
  let candRetryId = null;
  let candStatusId = null;
  const createdJobIds = [];

  before(async () => {
    for (const [id, name, slug] of [
      [TENANT_A, `Promo Tenant A ${runSuffix}`, `promo-a-${runSuffix}`],
      [TENANT_B, `Promo Tenant B ${runSuffix}`, `promo-b-${runSuffix}`]
    ]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [id, name, slug]
      );
    }

    const pwdHash = hashPassword(`promo-pwd-${runSuffix}`);
    for (const [uid, uname, tid] of [
      [USER_A, `promo_a_${runSuffix}`, TENANT_A],
      [USER_B, `promo_b_${runSuffix}`, TENANT_B]
    ]) {
      await pgQuery(
        `INSERT INTO users (id, username, email, password_hash, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, 'user', 'active', $5)`,
        [uid, uname, `${uname}@example.local`, pwdHash, tid]
      );
      await pgQuery(
        `INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
         VALUES ($1, $2, 'product_research', 1, 1)`,
        [`perm_${uid}_pr`, uid]
      );
    }

    sessA = (await createSession(USER_A)).token;
    sessB = (await createSession(USER_B)).token;

    // Seed produk katalog eksisting untuk test duplikat URL & tidak menimpa data
    await pgQuery(
      `INSERT INTO product_extractions (
         id, tenant_id, product_name, product_description, unique_selling_point,
         affiliate_link, input_source, source_url, normalized_source_url,
         photo_status, enrichment_status, raw_photo_url, clean_photo_url, t2i_prompt, i2v_action_prompt, packaging_type
       ) VALUES (
         $1, $2, 'Produk Eksisting Asli', 'Deskripsi asli jangan ditimpa', 'USP asli jangan ditimpa',
         'https://s.shopee.co.id/aff-original', 'https://shopee.co.id/produk/existing-1', 'https://shopee.co.id/produk/existing-1',
         'https://shopee.co.id/produk/existing-1',
         'approved', 'completed', '/uploads/fake/raw.jpg', '/uploads/fake/clean.jpg', 't2i', 'i2v', 'bottle'
       )`,
      [EXISTING_CAT_ID, TENANT_A]
    );

    const batch = await tenantContext.run(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `promo-batch-${runSuffix}`,
      observedAt: '2026-11-18T07:00:00.000Z'
    }));
    batchIdA = batch.id;

    const upserted = await tenantContext.run(TENANT_A, () => upsertResearchCandidates(batchIdA, [
      {
        external_candidate_id: 'p_nearest',
        url_status: 'nearest',
        source_url: 'https://shopee.co.id/mirip/1',
        research_data: { rank: 1, name: 'Kandidat Terdekat' }
      },
      {
        external_candidate_id: 'p_notfound',
        url_status: 'not_found',
        source_url: '',
        research_data: { rank: 2, name: 'Kandidat Not Found' }
      },
      {
        external_candidate_id: 'p_dup',
        url_status: 'official',
        source_url: 'https://www.shopee.co.id/produk/existing-1/?utm=radar',
        research_data: { rank: 3, name: 'Kandidat Duplikat URL', description: 'Deskripsi riset beda' }
      },
      {
        external_candidate_id: 'p_parallel',
        url_status: 'official',
        source_url: `https://shopee.co.id/produk/baru-paralel-${runSuffix}`,
        research_data: { rank: 4, name: 'Kandidat Paralel', category: 'Minuman & Kopi' }
      },
      {
        external_candidate_id: 'p_retry',
        url_status: 'listing',
        source_url: `https://shopee.co.id/produk/retry-${runSuffix}`,
        research_data: { rank: 5, name: 'Kandidat Retry' }
      },
      {
        external_candidate_id: 'p_status',
        url_status: 'official',
        source_url: `https://shopee.co.id/produk/status-${runSuffix}`,
        research_data: { rank: 6, name: 'Kandidat Pelacakan Status' }
      }
    ]));

    const mapByExt = new Map(upserted.results.map(r => [r.external_candidate_id, r.candidate_id]));
    candNearestId = mapByExt.get('p_nearest');
    candNotFoundId = mapByExt.get('p_notfound');
    candDupId = mapByExt.get('p_dup');
    candNewParallelId = mapByExt.get('p_parallel');
    candRetryId = mapByExt.get('p_retry');
    candStatusId = mapByExt.get('p_status');
  });

  after(async () => {
    await destroySession(sessA);
    await destroySession(sessB);
    if (createdJobIds.length > 0) {
      await pgQuery('DELETE FROM scheduler_jobs WHERE id = ANY($1::bigint[])', [createdJobIds.map(Number)]);
    }
    await pgQuery('DELETE FROM product_extractions WHERE id = ANY($1::text[]) OR tenant_id = ANY($2::text[])', [
      [EXISTING_CAT_ID, NEW_PROD_ID],
      [TENANT_A, TENANT_B]
    ]);
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM users WHERE id = ANY($1::text[])', [[USER_A, USER_B]]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await closePgPool();
  });

  it('V3: kandidat nearest dan not_found tanpa pilihan listing ditolak HTTP 422', async () => {
    const resNearest = await promotePost(
      makeReq(`/api/v2/product-research/candidates/${candNearestId}/promote`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(resNearest.status, 422);
    const bodyNearest = await resNearest.json();
    assert.equal(bodyNearest.code, 'URL_VERIFICATION_REQUIRED');

    const resNotFound = await promotePost(
      makeReq(`/api/v2/product-research/candidates/${candNotFoundId}/promote`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candNotFoundId }) }
    );
    assert.equal(resNotFound.status, 422);
  });

  it('V6: tenant B tidak dapat mempromosikan atau mengecek status kandidat tenant A', async () => {
    const resPromoB = await promotePost(
      makeReq(`/api/v2/product-research/candidates/${candDupId}/promote`, { sessionToken: sessB }),
      { params: Promise.resolve({ id: candDupId }) }
    );
    assert.equal(resPromoB.status, 404);

    const resStatB = await statusGet(
      makeReq(`/api/v2/product-research/candidates/${candDupId}/status`, { method: 'GET', sessionToken: sessB }),
      { params: Promise.resolve({ id: candDupId }) }
    );
    assert.equal(resStatB.status, 404);
  });

  it('V7: kandidat dengan URL sudah ada di katalog dihubungkan tanpa menimpa produk atau membuat job baru', async () => {
    const jobsBefore = (await pgQuery('SELECT COUNT(*)::int AS cnt FROM scheduler_jobs WHERE payload LIKE $1', [`%${TENANT_A}%`])).rows[0].cnt;

    const res = await promotePost(
      makeReq(`/api/v2/product-research/candidates/${candDupId}/promote`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candDupId }) }
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.action, 'linked');
    assert.equal(json.cf_product_id, EXISTING_CAT_ID);
    assert.equal(json.candidate.process_status, 'in_catalog');

    // Pastikan tidak ada job baru dibuat
    const jobsAfter = (await pgQuery('SELECT COUNT(*)::int AS cnt FROM scheduler_jobs WHERE payload LIKE $1', [`%${TENANT_A}%`])).rows[0].cnt;
    assert.equal(jobsAfter, jobsBefore);

    // Pastikan data produk di katalog tidak tertimpa
    const prod = (await pgQuery('SELECT * FROM product_extractions WHERE id = $1', [EXISTING_CAT_ID])).rows[0];
    assert.equal(prod.product_description, 'Deskripsi asli jangan ditimpa');
    assert.equal(prod.unique_selling_point, 'USP asli jangan ditimpa');
    assert.equal(prod.affiliate_link, 'https://s.shopee.co.id/aff-original');

    // Kandidat yang sudah punya cf_product_id tidak boleh di-scrape ulang
    const resAgain = await promotePost(
      makeReq(`/api/v2/product-research/candidates/${candDupId}/promote`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candDupId }) }
    );
    assert.equal(resAgain.status, 409);
  });

  it('V4: dua request promote paralel untuk kandidat yang sama hanya menghasilkan tepat 1 job product_scraper', async () => {
    const [r1, r2] = await Promise.all([
      promotePost(
        makeReq(`/api/v2/product-research/candidates/${candNewParallelId}/promote`, { sessionToken: sessA }),
        { params: Promise.resolve({ id: candNewParallelId }) }
      ),
      promotePost(
        makeReq(`/api/v2/product-research/candidates/${candNewParallelId}/promote`, { sessionToken: sessA }),
        { params: Promise.resolve({ id: candNewParallelId }) }
      )
    ]);

    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const okBody = r1.status === 200 ? await r1.json() : await r2.json();
    assert.equal(okBody.action, 'queued');
    assert.ok(okBody.job_id);
    assert.ok(okBody.reserved_product_id);
    createdJobIds.push(okBody.job_id);

    const jobRow = (await pgQuery('SELECT * FROM scheduler_jobs WHERE id = $1', [okBody.job_id])).rows[0];
    assert.equal(jobRow.queue_name, 'product_scraper');
    const payload = typeof jobRow.payload === 'string' ? JSON.parse(jobRow.payload) : jobRow.payload;
    assert.equal(payload.reserved_ids[`https://shopee.co.id/produk/baru-paralel-${runSuffix}`], okBody.reserved_product_id);
  });

  it('V5: retry setelah enqueue gagal memakai reserved_product_id yang sama dan tidak membuat produk ganda', async () => {
    // 1. Paksa gagal saat enqueue
    await assert.rejects(
      () => tenantContext.run(TENANT_A, () => promoteResearchCandidate(
        candRetryId,
        { requestedBy: 'tester' },
        {
          enqueueProductScrapeFn: async () => {
            throw new Error('Simulasi queue mati sementara');
          }
        }
      )),
      (err) => err.code === 'SCRAPE_ENQUEUE_FAILED' && Boolean(err.reserved_product_id)
    );

    const afterFail = await tenantContext.run(TENANT_A, () => getResearchCandidateById(candRetryId));
    assert.equal(afterFail.process_status, 'failed');
    const reservedAfterFail = afterFail.imports[0].reserved_product_id;
    assert.ok(reservedAfterFail);

    // 2. Retry sekarang sukses, dan wajib memakai reserved_product_id yang sama
    const retryRes = await tenantContext.run(TENANT_A, () => promoteResearchCandidate(
      candRetryId,
      { requestedBy: 'tester' }
    ));
    assert.equal(retryRes.action, 'queued');
    assert.equal(retryRes.reserved_product_id, reservedAfterFail);
    createdJobIds.push(retryRes.job_id);
  });

  it('Pelacakan status: job_id selesai tanpa baris product_extractions tidak dianggap in_catalog; kegagalan foto/enrich menjadi needs_review', async () => {
    const promoRes = await tenantContext.run(TENANT_A, () => promoteResearchCandidate(candStatusId, {
      requestedBy: 'tester'
    }));
    createdJobIds.push(promoRes.job_id);
    const reservedId = promoRes.reserved_product_id;

    // 1. Simulasikan job completed tetapi produk BELUM ada di product_extractions
    const missingStatus = await tenantContext.run(TENANT_A, () => getResearchCandidatePromotionStatus(
      candStatusId,
      {
        getProductScrapeJobStatusFn: async () => ({
          success: true,
          job_id: promoRes.job_id,
          status: 'completed',
          status_summary: 'ok',
          errors: {}
        })
      }
    ));
    assert.notEqual(missingStatus.candidate.process_status, 'in_catalog');
    assert.equal(missingStatus.candidate.process_status, 'failed');

    // 2. Buat baris produk di product_extractions dengan enrichment_status = 'failed'
    await pgQuery(
      `INSERT INTO product_extractions (
         id, tenant_id, product_name, input_source, source_url, normalized_source_url,
         photo_status, enrichment_status, enrichment_error
       ) VALUES ($1, $2, 'Produk Status Uji', $3, $3, $3, 'approved', 'failed', 'MODEL_BUSY (dapat diulang)')`,
      [reservedId, TENANT_A, `https://shopee.co.id/produk/status-${runSuffix}`]
    );

    const reviewStatus = await tenantContext.run(TENANT_A, () => getResearchCandidatePromotionStatus(candStatusId));
    assert.equal(reviewStatus.candidate.process_status, 'needs_review');
    assert.equal(reviewStatus.recovery.needed, true);
    assert.equal(reviewStatus.recovery.enrichment_failed, true);

    // 3. Perbaiki enrichment_status = 'completed' -> harus jadi in_catalog
    await pgQuery(
      `UPDATE product_extractions SET enrichment_status = 'completed', enrichment_error = NULL WHERE id = $1`,
      [reservedId]
    );
    const okStatus = await tenantContext.run(TENANT_A, () => getResearchCandidatePromotionStatus(candStatusId));
    assert.equal(okStatus.candidate.process_status, 'in_catalog');
    assert.equal(okStatus.recovery.needed, false);

    // Pastikan created_product dibersihkan
    await pgQuery('DELETE FROM product_extractions WHERE id = $1', [reservedId]);
  });

  it('V8: route POST /api/v2/products/scrape dan GET /api/v2/products/scrape/jobs/[jobId] mempertahankan kontrak lama', async () => {
    // 1. Tanpa urls/csv_data -> 400
    const rEmpty = await legacyScrapePost(makeReq('/api/v2/products/scrape', {
      sessionToken: sessA,
      body: {}
    }));
    assert.equal(rEmpty.status, 400);

    // 2. > 50 URL -> 400
    const urls51 = Array.from({ length: 51 }, (_, i) => `https://shopee.co.id/over/${i}`);
    const r51 = await legacyScrapePost(makeReq('/api/v2/products/scrape', {
      sessionToken: sessA,
      body: { urls: urls51 }
    }));
    assert.equal(r51.status, 400);

    // 3. Single URL baru -> enqueued_count: 1, job_ids, product_id, new_count: 1
    const rOk = await legacyScrapePost(makeReq('/api/v2/products/scrape', {
      sessionToken: sessA,
      body: {
        urls: [`https://shopee.co.id/legacy-contract/${runSuffix}`],
        category: 'Skincare',
        repair_mode: false
      }
    }));
    assert.equal(rOk.status, 200);
    const okJson = await rOk.json();
    assert.equal(okJson.success, true);
    assert.equal(okJson.enqueued_count, 1);
    assert.equal(okJson.new_count, 1);
    assert.equal(okJson.repair_count, 0);
    assert.equal(okJson.skipped_count, 0);
    assert.equal(okJson.updated_count, 0);
    assert.equal(okJson.job_ids.length, 1);
    assert.ok(okJson.product_id?.startsWith('pe_'));
    createdJobIds.push(...okJson.job_ids);

    // 4. Cek GET /api/v2/products/scrape/jobs/[jobId]
    const jobRes = await legacyScrapeJobGet(
      makeReq(`/api/v2/products/scrape/jobs/${okJson.job_ids[0]}`, { method: 'GET', sessionToken: sessA }),
      { params: Promise.resolve({ jobId: okJson.job_ids[0] }) }
    );
    assert.equal(jobRes.status, 200);
    const jobJson = await jobRes.json();
    assert.equal(jobJson.success, true);
    assert.equal(String(jobJson.job_id), String(okJson.job_ids[0]));
    assert.equal(jobJson.queue_name, 'product_scraper');
  });
});
