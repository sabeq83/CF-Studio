import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { tenantContext } from '../../lib/tenant-context.js';
import { createSession, destroySession } from '../../lib/auth.js';
import { hashPassword } from '../../lib/schema/user-schema.js';
import { QUEUE_CONCURRENCY } from '../../lib/scheduler.js';
import { PRODUCT_SCRAPER_MAX_CONCURRENT } from '../../lib/product-catalog-service.js';
import {
  upsertResearchBatch,
  upsertResearchCandidates,
  getResearchCandidateById
} from '../../lib/product-research-repository.js';
import {
  MAX_BULK_PROMOTE_IDS,
  previewBulkResearchPromotion,
  promoteResearchCandidatesBulk
} from '../../lib/product-research-promotion-service.js';
import { POST as bulkPromotePost } from '../../app/api/v2/product-research/candidates/bulk-promote/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_bulk_a_${runSuffix}`;
const TENANT_B = `test_bulk_b_${runSuffix}`;
const USER_A_OK = `usr_bulk_a_ok_${runSuffix}`;
const USER_A_DENIED = `usr_bulk_a_no_${runSuffix}`;
const USER_B_OK = `usr_bulk_b_ok_${runSuffix}`;
const OP_CRED_ID = `op_bulk_a_${runSuffix}`;
const OP_TOKEN = `tok_bulk_ingest_${crypto.randomBytes(16).toString('hex')}`;
const EXISTING_CAT_ID = `pe_bulk_exist_${runSuffix}`;
const ALREADY_LINKED_CAT_ID = `pe_bulk_linked_${runSuffix}`;

function makeReq(urlPath, { method = 'POST', sessionToken = null, bearerToken = null, body = null, rawBody = null } = {}) {
  const headers = {};
  const cookieName = process.env.SESSION_COOKIE_NAME || 'makna_session';
  if (sessionToken) headers.cookie = `${cookieName}=${sessionToken}`;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (rawBody !== null || body !== null) headers['content-type'] = 'application/json';
  return new Request(`http://127.0.0.1:5020${urlPath}`, {
    method,
    headers,
    body: rawBody !== null ? rawBody : (body !== null ? JSON.stringify(body) : undefined)
  });
}

describe('Bulk Approval Radar Produk (Tahap 7.1)', () => {
  let sessAOk = null;
  let sessANo = null;
  let sessBOk = null;
  let batchIdA = null;
  let candNearestId = null;
  let candNotFoundId = null;
  let candInCatalogId = null;
  let candDupId = null;
  let candValid1Id = null;
  let candValid2Id = null;
  const createdJobIds = [];

  before(async () => {
    for (const [id, name, slug] of [
      [TENANT_A, `Bulk Tenant A ${runSuffix}`, `bulk-a-${runSuffix}`],
      [TENANT_B, `Bulk Tenant B ${runSuffix}`, `bulk-b-${runSuffix}`]
    ]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [id, name, slug]
      );
    }

    const pwdHash = hashPassword(`bulk-pwd-${runSuffix}`);
    for (const [uid, uname, tid] of [
      [USER_A_OK, `bulk_a_ok_${runSuffix}`, TENANT_A],
      [USER_A_DENIED, `bulk_a_no_${runSuffix}`, TENANT_A],
      [USER_B_OK, `bulk_b_ok_${runSuffix}`, TENANT_B]
    ]) {
      await pgQuery(
        `INSERT INTO users (id, username, email, password_hash, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, 'user', 'active', $5)`,
        [uid, uname, `${uname}@example.local`, pwdHash, tid]
      );
    }

    await pgQuery(
      `INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
       VALUES ($1, $2, 'product_research', 1, 1), ($3, $4, 'product_research', 1, 1)`,
      [`perm_${USER_A_OK}_pr`, USER_A_OK, `perm_${USER_B_OK}_pr`, USER_B_OK]
    );

    sessAOk = (await createSession(USER_A_OK)).token;
    sessANo = (await createSession(USER_A_DENIED)).token;
    sessBOk = (await createSession(USER_B_OK)).token;

    const tokenHash = crypto.createHash('sha256').update(OP_TOKEN).digest('hex');
    await pgQuery(
      `INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status)
       VALUES ($1, $2, 'TeleRadar Bulk Test', $3, 'product_research:ingest', 'active')`,
      [OP_CRED_ID, TENANT_A, tokenHash]
    );

    // Seed 2 produk katalog eksisting di Tenant A (1 untuk uji duplikat, 1 untuk uji sudah in_catalog)
    await pgQuery(
      `INSERT INTO product_extractions (
         id, tenant_id, product_name, product_description, unique_selling_point,
         affiliate_link, input_source, source_url, normalized_source_url,
         photo_status, enrichment_status
       ) VALUES
       (
         $1, $3, 'Produk Katalog Asli Bulk', 'Deskripsi katalog asli jangan tertimpa', 'USP katalog asli',
         'https://s.shopee.co.id/aff-bulk-asli', 'https://shopee.co.id/produk/bulk-exist-1', 'https://shopee.co.id/produk/bulk-exist-1',
         'https://shopee.co.id/produk/bulk-exist-1', 'approved', 'completed'
       ),
       (
         $2, $3, 'Produk Sudah Terhubung Bulk', 'Deskripsi linked', 'USP linked',
         '', 'https://shopee.co.id/produk/bulk-linked-1', 'https://shopee.co.id/produk/bulk-linked-1',
         'https://shopee.co.id/produk/bulk-linked-1', 'approved', 'completed'
       )`,
      [EXISTING_CAT_ID, ALREADY_LINKED_CAT_ID, TENANT_A]
    );

    const batch = await tenantContext.run(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `bulk-batch-${runSuffix}`,
      observedAt: '2026-11-18T09:00:00.000Z'
    }));
    batchIdA = batch.id;

    const upserted = await tenantContext.run(TENANT_A, () => upsertResearchCandidates(batchIdA, [
      {
        external_candidate_id: 'b_nearest',
        url_status: 'nearest',
        source_url: `https://shopee.co.id/mirip/bulk-${runSuffix}`,
        research_data: { rank: 1, name: 'Kandidat Terdekat Bulk' }
      },
      {
        external_candidate_id: 'b_notfound',
        url_status: 'not_found',
        source_url: '',
        research_data: { rank: 2, name: 'Kandidat Not Found Bulk' }
      },
      {
        external_candidate_id: 'b_incatalog',
        url_status: 'official',
        source_url: 'https://shopee.co.id/produk/bulk-linked-1',
        research_data: { rank: 3, name: 'Kandidat Sudah Di Katalog' }
      },
      {
        external_candidate_id: 'b_dup',
        url_status: 'official',
        source_url: 'https://www.shopee.co.id/produk/bulk-exist-1/?utm_source=teleradar&sp_atk=abc',
        research_data: { rank: 4, name: 'Kandidat Duplikat Bulk', description: 'Deskripsi radar berbeda' }
      },
      {
        external_candidate_id: 'b_valid_1',
        url_status: 'official',
        source_url: `https://shopee.co.id/produk/bulk-valid-1-${runSuffix}?utm_medium=social`,
        research_data: { rank: 5, name: 'Kandidat Valid Satu', category: 'Skincare' }
      },
      {
        external_candidate_id: 'b_valid_2',
        url_status: 'listing',
        source_url: `https://shopee.co.id/produk/bulk-valid-2-${runSuffix}`,
        research_data: { rank: 6, name: 'Kandidat Valid Dua', category: 'Fashion' }
      }
    ]));

    const mapByExt = new Map(upserted.results.map(r => [r.external_candidate_id, r.candidate_id]));
    candNearestId = mapByExt.get('b_nearest');
    candNotFoundId = mapByExt.get('b_notfound');
    candInCatalogId = mapByExt.get('b_incatalog');
    candDupId = mapByExt.get('b_dup');
    candValid1Id = mapByExt.get('b_valid_1');
    candValid2Id = mapByExt.get('b_valid_2');

    // Tandai b_incatalog sebagai sudah in_catalog
    await pgQuery(
      `UPDATE product_research_candidates
       SET cf_product_id = $1, process_status = 'in_catalog'
       WHERE id = $2 AND tenant_id = $3`,
      [ALREADY_LINKED_CAT_ID, candInCatalogId, TENANT_A]
    );
  });

  after(async () => {
    await destroySession(sessAOk);
    await destroySession(sessANo);
    await destroySession(sessBOk);
    if (createdJobIds.length > 0) {
      await pgQuery('DELETE FROM scheduler_jobs WHERE id = ANY($1::bigint[])', [createdJobIds.map(Number)]);
    }
    await pgQuery('DELETE FROM product_extractions WHERE id = ANY($1::text[]) OR tenant_id = ANY($2::text[])', [
      [EXISTING_CAT_ID, ALREADY_LINKED_CAT_ID],
      [TENANT_A, TENANT_B]
    ]);
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM operator_credentials WHERE id = $1', [OP_CRED_ID]);
    await pgQuery('DELETE FROM users WHERE id = ANY($1::text[])', [[USER_A_OK, USER_A_DENIED, USER_B_OK]]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await closePgPool();
  });

  it('Auth & validasi input: menolak 401 unauth, 403 token operator / tanpa izin, serta 400 payload tidak valid', async () => {
    const resUnauth = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        body: { mode: 'preview', candidate_ids: [candValid1Id] }
      })
    );
    assert.equal(resUnauth.status, 401);

    const resOpToken = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        bearerToken: OP_TOKEN,
        body: { mode: 'preview', candidate_ids: [candValid1Id] }
      })
    );
    assert.ok([401, 403].includes(resOpToken.status), `Operator token harus ditolak, dapat ${resOpToken.status}`);

    const resNoPerm = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessANo,
        body: { mode: 'preview', candidate_ids: [candValid1Id] }
      })
    );
    assert.equal(resNoPerm.status, 403);

    const resBadJson = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        rawBody: '{bad json'
      })
    );
    assert.equal(resBadJson.status, 400);

    const resEmpty = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        body: { mode: 'preview', candidate_ids: [] }
      })
    );
    assert.equal(resEmpty.status, 400);
    assert.equal((await resEmpty.json()).code, 'EMPTY_BULK_IDS');

    const tooManyIds = Array.from({ length: MAX_BULK_PROMOTE_IDS + 1 }, (_, i) => `prc_overflow_${i}`);
    const resOverflow = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        body: { mode: 'preview', candidate_ids: tooManyIds }
      })
    );
    assert.equal(resOverflow.status, 400);
    assert.equal((await resOverflow.json()).code, 'BULK_LIMIT_EXCEEDED');
  });

  it('Konkurensi antrean product_scraper dipastikan 1 job aktif sekaligus', () => {
    assert.equal(QUEUE_CONCURRENCY.product_scraper, 1);
    assert.equal(PRODUCT_SCRAPER_MAX_CONCURRENT, 1);
  });

  it('Preview memisahkan kandidat campuran menjadi Valid, Duplikat, dan Tertahan tanpa memicu job', async () => {
    const foreignOrMissingId = `prc_missing_${runSuffix}`;
    const res = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        body: {
          mode: 'preview',
          candidate_ids: [
            candNearestId,
            candNotFoundId,
            candInCatalogId,
            foreignOrMissingId,
            candDupId,
            candValid1Id,
            candValid2Id,
            candValid1Id // duplikasi ID di payload harus dideduplikasi
          ]
        }
      })
    );
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.mode, 'preview');
    assert.equal(data.queue_concurrency, 1);
    assert.deepEqual(data.summary, {
      requested: 7,
      valid_count: 2,
      duplicate_count: 1,
      blocked_count: 4,
      not_found_count: 1
    });

    assert.deepEqual(data.valid_items.map(i => i.id), [candValid1Id, candValid2Id]);
    assert.deepEqual(data.duplicate_items.map(i => i.id), [candDupId]);
    assert.equal(data.duplicate_items[0].duplicate_match.cf_product_id, EXISTING_CAT_ID);
    assert.deepEqual(data.not_found_ids, [foreignOrMissingId]);
    assert.deepEqual(
      data.blocked_items.map(i => i.id).sort(),
      [candNearestId, candNotFoundId, candInCatalogId, foreignOrMissingId].sort()
    );
  });

  it('Isolasi tenant: Tenant B tidak dapat preview maupun execute kandidat Tenant A', async () => {
    const resPreviewB = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessBOk,
        body: { mode: 'preview', candidate_ids: [candValid1Id, candDupId] }
      })
    );
    assert.equal(resPreviewB.status, 200);
    const previewB = await resPreviewB.json();
    assert.equal(previewB.summary.valid_count, 0);
    assert.equal(previewB.summary.duplicate_count, 0);
    assert.equal(previewB.summary.blocked_count, 2);
    assert.equal(previewB.summary.not_found_count, 2);

    const resExecB = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessBOk,
        body: { mode: 'execute', candidate_ids: [candValid1Id, candDupId] }
      })
    );
    assert.equal(resExecB.status, 200);
    const execB = await resExecB.json();
    assert.equal(execB.summary.queued, 0);
    assert.equal(execB.summary.linked, 0);
    assert.equal(execB.summary.skipped_blocked, 2);

    const candA1 = await tenantContext.run(TENANT_A, () => getResearchCandidateById(candValid1Id));
    assert.equal(candA1.process_status, 'not_sent');
    assert.equal(candA1.cf_product_id, null);
  });

  it('Execute melewatkan kandidat tertahan, menghubungkan duplikat tanpa menimpa, dan membuat 1 job per kandidat valid', async () => {
    const res = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        body: {
          mode: 'execute',
          candidate_ids: [
            candNearestId,
            candNotFoundId,
            candInCatalogId,
            candDupId,
            candValid1Id,
            candValid2Id
          ]
        }
      })
    );
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.mode, 'execute');
    assert.equal(data.queue_concurrency, 1);
    assert.deepEqual(data.summary, {
      requested: 6,
      queued: 2,
      linked: 1,
      skipped_blocked: 3,
      conflicts: 0,
      failed: 0
    });

    const byId = new Map(data.results.map(r => [r.candidate_id, r]));
    assert.equal(byId.get(candNearestId).status, 'skipped_blocked');
    assert.equal(byId.get(candNotFoundId).status, 'skipped_blocked');
    assert.equal(byId.get(candInCatalogId).status, 'skipped_blocked');

    assert.equal(byId.get(candDupId).status, 'linked');
    assert.equal(byId.get(candDupId).cf_product_id, EXISTING_CAT_ID);

    for (const validId of [candValid1Id, candValid2Id]) {
      const r = byId.get(validId);
      assert.equal(r.status, 'queued');
      assert.ok(r.job_id, `Harus memiliki job_id untuk ${validId}`);
      assert.ok(r.reserved_product_id, `Harus memiliki reserved_product_id untuk ${validId}`);
      createdJobIds.push(r.job_id);
    }

    // Verifikasi produk eksisting tidak tertimpa
    const existingProd = (await pgQuery('SELECT * FROM product_extractions WHERE id = $1', [EXISTING_CAT_ID])).rows[0];
    assert.equal(existingProd.product_name, 'Produk Katalog Asli Bulk');
    assert.equal(existingProd.product_description, 'Deskripsi katalog asli jangan tertimpa');
    assert.equal(existingProd.unique_selling_point, 'USP katalog asli');
    assert.equal(existingProd.affiliate_link, 'https://s.shopee.co.id/aff-bulk-asli');

    // Verifikasi tepat 2 scheduler_jobs tercipta dan status kandidat berubah
    const jobsRes = await pgQuery(
      'SELECT id, queue_name, status, payload FROM scheduler_jobs WHERE id = ANY($1::bigint[]) ORDER BY id ASC',
      [createdJobIds.map(Number)]
    );
    assert.equal(jobsRes.rows.length, 2);
    for (const row of jobsRes.rows) {
      assert.equal(row.queue_name, 'product_scraper');
      assert.equal(row.status, 'pending');
      const payload = JSON.parse(row.payload);
      assert.equal(payload.tenant_id, TENANT_A);
      assert.equal(payload.urls.length, 1);
      assert.ok(payload.reserved_ids && payload.reserved_ids[payload.urls[0]]);
    }

    const candNearestAfter = await tenantContext.run(TENANT_A, () => getResearchCandidateById(candNearestId));
    assert.equal(candNearestAfter.process_status, 'not_sent');
    const candValid1After = await tenantContext.run(TENANT_A, () => getResearchCandidateById(candValid1Id));
    assert.equal(candValid1After.process_status, 'queued');
    const candDupAfter = await tenantContext.run(TENANT_A, () => getResearchCandidateById(candDupId));
    assert.equal(candDupAfter.process_status, 'in_catalog');
    assert.equal(candDupAfter.cf_product_id, EXISTING_CAT_ID);

    // Submit ulang setelah sudah queued -> aman, dilewati sebagai skipped_blocked tanpa duplikat job
    const resResubmit = await bulkPromotePost(
      makeReq('/api/v2/product-research/candidates/bulk-promote', {
        sessionToken: sessAOk,
        body: { mode: 'execute', candidate_ids: [candValid1Id, candDupId] }
      })
    );
    assert.equal(resResubmit.status, 200);
    const resubmitData = await resResubmit.json();
    assert.equal(resubmitData.summary.queued, 0);
    assert.equal(resubmitData.summary.linked, 0);
    assert.equal(resubmitData.summary.skipped_blocked, 2);
  });

  it('Isolasi kegagalan parsial & konflik saat eksekusi bulk tidak menggagalkan item lain', async () => {
    const batch2 = await tenantContext.run(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `bulk-partial-${runSuffix}`,
      observedAt: '2026-11-18T10:00:00.000Z'
    }));
    const up = await tenantContext.run(TENANT_A, () => upsertResearchCandidates(batch2.id, [
      { external_candidate_id: 'p_ok', url_status: 'official', source_url: `https://shopee.co.id/p-ok-${runSuffix}`, research_data: { rank: 1, name: 'Item OK' } },
      { external_candidate_id: 'p_conflict', url_status: 'official', source_url: `https://shopee.co.id/p-cf-${runSuffix}`, research_data: { rank: 2, name: 'Item Konflik' } },
      { external_candidate_id: 'p_fail', url_status: 'official', source_url: `https://shopee.co.id/p-fl-${runSuffix}`, research_data: { rank: 3, name: 'Item Gagal' } }
    ]));
    const [idOk, idConflict, idFail] = up.results.map(r => r.candidate_id);

    const fakeResult = await tenantContext.run(TENANT_A, () =>
      promoteResearchCandidatesBulk(
        [idOk, idConflict, idFail, candNearestId],
        { requestedBy: 'test_runner' },
        {
          promoteResearchCandidateFn: async (cid) => {
            if (cid === idConflict) {
              const err = new Error('Kandidat sedang dipromosikan oleh request lain.');
              err.status = 409;
              err.code = 'PROMOTION_IN_PROGRESS';
              throw err;
            }
            if (cid === idFail) {
              const err = new Error('Scraper gagal sementara');
              err.status = 502;
              err.code = 'SCRAPE_ENQUEUE_FAILED';
              throw err;
            }
            return { action: 'queued', job_id: 999001, reserved_product_id: `pe_mock_${cid}` };
          },
          getProductScraperQueueLoadFn: async () => ({
            queue_name: 'product_scraper',
            max_concurrent: 1,
            running: 0,
            pending: 1
          })
        }
      )
    );

    assert.equal(fakeResult.success, true);
    assert.deepEqual(fakeResult.summary, {
      requested: 4,
      queued: 1,
      linked: 0,
      skipped_blocked: 1,
      conflicts: 1,
      failed: 1
    });
    const resMap = new Map(fakeResult.results.map(r => [r.candidate_id, r]));
    assert.equal(resMap.get(idOk).status, 'queued');
    assert.equal(resMap.get(idConflict).status, 'conflict');
    assert.equal(resMap.get(idFail).status, 'failed');
    assert.equal(resMap.get(candNearestId).status, 'skipped_blocked');
  });
});
