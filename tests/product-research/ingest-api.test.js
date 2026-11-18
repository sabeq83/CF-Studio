import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { tenantContext } from '../../lib/tenant-context.js';
import {
  listResearchCandidates,
  updateResearchCandidateCuration
} from '../../lib/product-research-repository.js';
import { POST as ingestPost } from '../../app/api/operator/v2/product-research/batches/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_ingest_a_${runSuffix}`;
const TENANT_B = `test_ingest_b_${runSuffix}`;
const CRED_A = `op_cred_a_${runSuffix}`;
const CRED_A_NOSCOPE = `op_cred_ns_${runSuffix}`;
const CRED_B = `op_cred_b_${runSuffix}`;
const TOKEN_A = `tok_radar_a_${crypto.randomBytes(16).toString('hex')}`;
const TOKEN_A_NOSCOPE = `tok_radar_ns_${crypto.randomBytes(16).toString('hex')}`;
const TOKEN_B = `tok_radar_b_${crypto.randomBytes(16).toString('hex')}`;

// 1x1 transparent PNG bytes
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function sha256(val) {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function makeJsonRequest(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request('http://127.0.0.1:5020/api/operator/v2/product-research/batches', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

describe('Operator Ingest API POST /api/operator/v2/product-research/batches (Tahap 3)', () => {
  before(async () => {
    for (const [id, name, slug] of [
      [TENANT_A, `Test Tenant A ${runSuffix}`, `test-a-${runSuffix}`],
      [TENANT_B, `Test Tenant B ${runSuffix}`, `test-b-${runSuffix}`]
    ]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, name, slug]
      );
    }

    for (const [id, tenantId, name, token, scopes] of [
      [CRED_A, TENANT_A, 'TeleRadar Test A', TOKEN_A, 'product_research:ingest'],
      [CRED_A_NOSCOPE, TENANT_A, 'No Scope Test A', TOKEN_A_NOSCOPE, 'automation:write'],
      [CRED_B, TENANT_B, 'TeleRadar Test B', TOKEN_B, 'product_research:ingest']
    ]) {
      await pgQuery(
        `INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [id, tenantId, name, sha256(token), scopes]
      );
    }
  });

  after(async () => {
    await pgQuery(
      'DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])',
      [[TENANT_A, TENANT_B]]
    );
    await pgQuery(
      'DELETE FROM operator_credentials WHERE id = ANY($1::text[])',
      [[CRED_A, CRED_A_NOSCOPE, CRED_B]]
    );
    await pgQuery(
      'DELETE FROM tenants WHERE id = ANY($1::text[])',
      [[TENANT_A, TENANT_B]]
    );

    for (const t of [TENANT_A, TENANT_B]) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'product-research', t);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    await closePgPool();
  });

  it('menolak request tanpa token (401) dan token tanpa scope product_research:ingest (403)', async () => {
    const res401 = await ingestPost(makeJsonRequest({ batch: { external_batch_id: 'b1' }, candidates: [] }, null));
    assert.equal(res401.status, 401);

    const res403 = await ingestPost(makeJsonRequest({ batch: { external_batch_id: 'b1' }, candidates: [] }, TOKEN_A_NOSCOPE));
    assert.equal(res403.status, 403);
    const body403 = await res403.json();
    assert.equal(body403.code, 'OPERATOR_SCOPE_FORBIDDEN');
  });

  it('ingest 45 kandidat mengabaikan tenant_id payload, mengembalikan ringkasan per kandidat, tidak mengubah product_extractions, dan re-sync tetap idempotent', async () => {
    const beforeCountRes = await pgQuery('SELECT COUNT(*)::int AS cnt FROM product_extractions WHERE tenant_id = $1', [TENANT_A]);
    const beforeProductCount = beforeCountRes.rows[0].cnt;

    const candidates45 = Array.from({ length: 45 }, (_, idx) => ({
      external_candidate_id: `tr_${idx + 1}`,
      url_status: idx < 22 ? 'official' : idx < 28 ? 'listing' : idx < 42 ? 'nearest' : idx < 44 ? 'not_found' : 'user',
      source_url: idx >= 42 && idx < 44 ? '' : `https://shopee.co.id/item/${idx + 1}?utm=radar`,
      research_data: {
        rank: idx + 1,
        name: `Produk Radar ${idx + 1}`,
        category: idx % 2 === 0 ? 'Skincare & Kecantikan' : 'Minuman & Kopi',
        sold_per_week: 1000 - idx * 10,
        trend: idx < 6 ? 'up' : idx < 34 ? 'stable' : 'down',
        commission_pct: 15,
        price: 75000 + idx * 1000
      },
      ...(idx === 0 ? { thumb_base64: `data:image/png;base64,${TINY_PNG_BUFFER.toString('base64')}` } : {})
    }));

    const batchIdExt = `2026-11-17-${runSuffix}`;
    const res = await ingestPost(makeJsonRequest({
      tenant_id: TENANT_B, // wajib diabaikan!
      batch: {
        tenant_id: TENANT_B, // wajib diabaikan!
        source: 'teleradar',
        external_batch_id: batchIdExt,
        observed_at: '2026-11-17T08:00:00.000Z',
        metadata: { total_raw: 45 }
      },
      candidates: candidates45
    }, TOKEN_A));

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.summary.total, 45);
    assert.equal(json.summary.created, 45);
    assert.equal(json.summary.updated, 0);
    assert.equal(json.summary.skipped, 0);
    assert.equal(json.candidates.length, 45);

    // Pastikan product_extractions tidak tersentuh sama sekali
    const afterCountRes = await pgQuery('SELECT COUNT(*)::int AS cnt FROM product_extractions WHERE tenant_id = $1', [TENANT_A]);
    assert.equal(afterCountRes.rows[0].cnt, beforeProductCount);

    // Pastikan data masuk ke TENANT_A (bukan TENANT_B)
    const listA = await tenantContext.run(TENANT_A, () => listResearchCandidates({ batchId: json.batch.id, limit: 100 }));
    const listB = await tenantContext.run(TENANT_B, () => listResearchCandidates({ limit: 100 }));
    assert.equal(listA.items.length, 45);
    assert.equal(listB.items.length, 0);

    // Pastikan foto thumb kandidat pertama tersimpan di folder TENANT_A
    const firstItem = listA.items.find(i => i.external_candidate_id === 'tr_1');
    assert.ok(firstItem.thumb_path?.startsWith(`/uploads/product-research/${TENANT_A}/`));

    // Simulasikan kurator mengedit kandidat pertama
    await tenantContext.run(TENANT_A, () => updateResearchCandidateCuration(firstItem.id, {
      curatedData: { name: 'Nama Kurator Tetap Aman', usp: 'USP Kurator' },
      targetUrl: 'https://shopee.co.id/official/item-1-verified',
      curationStatus: 'ready',
      expectedRevision: firstItem.revision
    }));

    // Sinkron ulang batch yang sama dengan angka sold_per_week terbaru
    const updated45 = candidates45.map(c => ({
      ...c,
      research_data: { ...c.research_data, sold_per_week: c.research_data.sold_per_week + 111 }
    }));

    const res2 = await ingestPost(makeJsonRequest({
      batch: {
        source: 'teleradar',
        external_batch_id: batchIdExt,
        observed_at: '2026-11-17T09:00:00.000Z'
      },
      candidates: updated45
    }, TOKEN_A));

    assert.equal(res2.status, 200);
    const json2 = await res2.json();
    assert.equal(json2.summary.created, 0);
    assert.equal(json2.summary.updated, 45);
    assert.equal(json2.summary.skipped, 0);

    const listA2 = await tenantContext.run(TENANT_A, () => listResearchCandidates({ batchId: json.batch.id, limit: 100 }));
    assert.equal(listA2.items.length, 45);
    const firstAfter = listA2.items.find(i => i.external_candidate_id === 'tr_1');
    assert.equal(firstAfter.research_data.sold_per_week, 1111);
    assert.equal(firstAfter.curated_data.name, 'Nama Kurator Tetap Aman');
    assert.equal(firstAfter.curation_status, 'ready');
    assert.equal(firstAfter.url_status, 'user');
  });

  it('menolak batch > 100 kandidat, tipe foto selain jpg/png/webp, dan foto > 5 MB', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      external_candidate_id: `over_${i}`,
      research_data: { name: `Over ${i}` }
    }));
    const res101 = await ingestPost(makeJsonRequest({
      batch: { external_batch_id: `over-${runSuffix}` },
      candidates: tooMany
    }, TOKEN_A));
    assert.equal(res101.status, 400);
    const body101 = await res101.json();
    assert.equal(body101.code, 'BATCH_CANDIDATE_LIMIT_EXCEEDED');

    // Tipe file tidak valid (plain text base64)
    const badMimeRes = await ingestPost(makeJsonRequest({
      batch: { external_batch_id: `badmime-${runSuffix}` },
      candidates: [{
        external_candidate_id: 'bad1',
        research_data: { name: 'Bad Mime' },
        thumb_base64: Buffer.from('not-an-image-file').toString('base64')
      }]
    }, TOKEN_A));
    assert.equal(badMimeRes.status, 415);

    // Ukuran > 5 MB
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 64, 0);
    // Tulis header PNG agar bukan gagal di MIME
    TINY_PNG_BUFFER.copy(oversized, 0);
    const bigRes = await ingestPost(makeJsonRequest({
      batch: { external_batch_id: `big-${runSuffix}` },
      candidates: [{
        external_candidate_id: 'big1',
        research_data: { name: 'Big Img' },
        thumb_base64: oversized.toString('base64')
      }]
    }, TOKEN_A));
    assert.equal(bigRes.status, 413);
  });

  it('mendukung upload multipart/form-data beserta foto png', async () => {
    const form = new FormData();
    form.set('payload', JSON.stringify({
      batch: { external_batch_id: `mp-${runSuffix}`, source: 'teleradar' },
      candidates: [
        {
          external_candidate_id: 'mp_1',
          url_status: 'official',
          source_url: 'https://shopee.co.id/mp/1',
          research_data: { rank: 1, name: 'Multipart Produk' }
        }
      ]
    }));
    form.set('thumb_mp_1', new Blob([TINY_PNG_BUFFER], { type: 'image/png' }), 'thumb.png');

    const req = new Request('http://127.0.0.1:5020/api/operator/v2/product-research/batches', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: form
    });

    const res = await ingestPost(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.summary.created, 1);

    const listA = await tenantContext.run(TENANT_A, () => listResearchCandidates({ batchId: json.batch.id }));
    assert.equal(listA.items.length, 1);
    assert.ok(listA.items[0].thumb_path?.endsWith('.png'));
  });
});
