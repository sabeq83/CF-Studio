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
import {
  upsertResearchBatch,
  upsertResearchCandidates
} from '../../lib/product-research-repository.js';
import {
  registerTelegramIdentity,
  revokeTelegramIdentity
} from '../../lib/product-research-bot-service.js';
import { GET as candidatesGet } from '../../app/api/operator/v2/product-research/candidates/route.js';
import { GET as candidateDetailGet } from '../../app/api/operator/v2/product-research/candidates/[ref]/route.js';
import { POST as candidateUrlPost } from '../../app/api/operator/v2/product-research/candidates/[ref]/url/route.js';
import { POST as promotePost } from '../../app/api/operator/v2/product-research/promote/route.js';
import { POST as submitPost } from '../../app/api/operator/v2/product-research/submit/route.js';
import { GET as matchUrlGet } from '../../app/api/operator/v2/product-research/candidates/match-url/route.js';
import { GET as statusGet } from '../../app/api/operator/v2/product-research/status/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_bot_a_${runSuffix}`;
const TENANT_B = `test_bot_b_${runSuffix}`;
const TG_OK = '700100200';
const TG_REVOKED = '700100201';
const TG_UNKNOWN = '700100299';
const TG_B = '700100300';

const TOKENS = {
  ingestA: `tok_bot_ingest_${crypto.randomBytes(12).toString('hex')}`,
  readA: `tok_bot_read_${crypto.randomBytes(12).toString('hex')}`,
  curateA: `tok_bot_curate_${crypto.randomBytes(12).toString('hex')}`,
  promoteA: `tok_bot_promote_${crypto.randomBytes(12).toString('hex')}`,
  mcpA: `tok_bot_mcp_${crypto.randomBytes(12).toString('hex')}`,
  fullB: `tok_bot_full_b_${crypto.randomBytes(12).toString('hex')}`
};
const credIds = Object.keys(TOKENS).map(k => `op_bot_${k}_${runSuffix}`);

function req(path, { method = 'GET', token = null, body = null } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== null) headers['content-type'] = 'application/json';
  return new Request(`http://127.0.0.1:5020${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
}

describe('API Operator Radar untuk Bot Telegram (Tahap 7.4)', () => {
  let batchA = null;
  let idHigh = null;
  let idLow = null;
  let idNearest = null;
  let idArchived = null;
  const createdJobIds = [];

  before(async () => {
    for (const [id, slug] of [[TENANT_A, `bot-a-${runSuffix}`], [TENANT_B, `bot-b-${runSuffix}`]]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [id, `Bot ${id}`, slug]
      );
    }

    const creds = [
      ['ingestA', TENANT_A, 'product_research:ingest'],
      ['readA', TENANT_A, 'product_research:read'],
      ['curateA', TENANT_A, 'product_research:curate'],
      ['promoteA', TENANT_A, 'product_research:promote'],
      ['mcpA', TENANT_A, 'product_research:mcp_promote'],
      ['fullB', TENANT_B, 'product_research:read,product_research:promote,product_research:curate']
    ];
    for (const [key, tenant, scopes] of creds) {
      await pgQuery(
        `INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [
          `op_bot_${key}_${runSuffix}`,
          tenant,
          `Bot ${key}`,
          crypto.createHash('sha256').update(TOKENS[key]).digest('hex'),
          scopes
        ]
      );
    }

    await tenantContext.run(TENANT_A, async () => {
      await registerTelegramIdentity({ telegramUserId: TG_OK, displayName: 'Marketer A', createdBy: 'test' });
      await registerTelegramIdentity({ telegramUserId: TG_REVOKED, displayName: 'Mantan', createdBy: 'test' });
      await revokeTelegramIdentity(TG_REVOKED);

      batchA = await upsertResearchBatch({
        source: 'teleradar',
        externalBatchId: `bot-batch-${runSuffix}`,
        observedAt: '2026-11-18T08:00:00.000Z'
      });
      const up = await upsertResearchCandidates(batchA.id, [
        { external_candidate_id: '1', url_status: 'official', source_url: `https://shopee.co.id/p/bot-high-${runSuffix}`,
          research_data: { rank: 1, name: 'Produk Skor Tinggi', sold_per_week: 1500, trend: 'up', commission_rp: 30000, price: 120000 } },
        { external_candidate_id: '2', url_status: 'listing', source_url: `https://shopee.co.id/p/bot-low-${runSuffix}`,
          research_data: { rank: 2, name: 'Produk Skor Rendah', sold_per_week: 60, trend: 'down', commission_rp: 3500, price: 15000 } },
        { external_candidate_id: '3', url_status: 'nearest', source_url: `https://shopee.co.id/mirip/bot-${runSuffix}`,
          research_data: { rank: 3, name: 'Produk Terdekat', sold_per_week: 900, trend: 'up', commission_rp: 20000, price: 100000 } },
        { external_candidate_id: '4', url_status: 'official', source_url: `https://shopee.co.id/p/bot-arch-${runSuffix}`,
          research_data: { rank: 4, name: 'Produk Diarsipkan', sold_per_week: 2000, trend: 'up', commission_rp: 30000, price: 100000 } }
      ]);
      const m = new Map(up.results.map(r => [r.external_candidate_id, r.candidate_id]));
      idHigh = m.get('1');
      idLow = m.get('2');
      idNearest = m.get('3');
      idArchived = m.get('4');
      await pgQuery(
        `UPDATE product_research_candidates SET curation_status = 'archived' WHERE id = $1 AND tenant_id = $2`,
        [idArchived, TENANT_A]
      );
    });

    await tenantContext.run(TENANT_B, () =>
      registerTelegramIdentity({ telegramUserId: TG_B, displayName: 'Marketer B', createdBy: 'test' })
    );
  });

  after(async () => {
    if (createdJobIds.length) {
      await pgQuery('DELETE FROM scheduler_jobs WHERE id = ANY($1::bigint[])', [createdJobIds.map(Number)]);
    }
    await pgQuery('DELETE FROM product_extractions WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM product_research_telegram_identities WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM operator_credentials WHERE id = ANY($1::text[])', [credIds]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await closePgPool();
  });

  it('Scope dipisah ketat: tanpa token 401, ingest tidak boleh baca/promosi, read tidak boleh promosi', async () => {
    assert.equal((await candidatesGet(req('/api/operator/v2/product-research/candidates'))).status, 401);
    assert.equal(
      (await candidatesGet(req('/api/operator/v2/product-research/candidates', { token: TOKENS.ingestA }))).status,
      403
    );
    assert.equal(
      (await promotePost(req('/api/operator/v2/product-research/promote', {
        method: 'POST', token: TOKENS.readA, body: { candidate_refs: ['1'], telegram_user_id: TG_OK }
      }))).status,
      403
    );
    assert.equal(
      (await promotePost(req('/api/operator/v2/product-research/promote', {
        method: 'POST', token: TOKENS.curateA, body: { candidate_refs: ['1'], telegram_user_id: TG_OK }
      }))).status,
      403
    );
  });

  it('/top mengurutkan menurut skor, menyembunyikan arsip, dan /produk memakai nomor batch terbaru', async () => {
    const res = await candidatesGet(req('/api/operator/v2/product-research/candidates?mode=top&limit=10', { token: TOKENS.readA }));
    assert.equal(res.status, 200);
    const data = await res.json();
    const nums = data.items.map(i => i.number);
    assert.equal(nums[0], '1');
    assert.ok(!nums.includes('4'), 'kandidat arsip tidak boleh tampil');
    assert.ok(data.items[0].score.total >= data.items[data.items.length - 1].score.total);

    const detailRes = await candidateDetailGet(
      req('/api/operator/v2/product-research/candidates/2', { token: TOKENS.readA }),
      { params: Promise.resolve({ ref: '2' }) }
    );
    assert.equal(detailRes.status, 200);
    const detail = await detailRes.json();
    assert.equal(detail.candidate.id, idLow);
    assert.equal(detail.score_breakdown.length, 5);

    const statusRes = await statusGet(req('/api/operator/v2/product-research/status', { token: TOKENS.readA }));
    assert.equal((await statusRes.json()).summary.total, 4);
  });

  it('/kirim wajib identitas Telegram terdaftar & aktif (tanpa ID 400, tidak dikenal 403, dicabut 403)', async () => {
    const call = (body) => promotePost(req('/api/operator/v2/product-research/promote', {
      method: 'POST', token: TOKENS.promoteA, body
    }));
    assert.equal((await call({ candidate_refs: ['1'], mode: 'execute' })).status, 400);
    const unknown = await call({ candidate_refs: ['1'], mode: 'execute', telegram_user_id: TG_UNKNOWN });
    assert.equal(unknown.status, 403);
    assert.equal((await unknown.json()).code, 'TELEGRAM_IDENTITY_NOT_REGISTERED');
    assert.equal((await call({ candidate_refs: ['1'], mode: 'execute', telegram_user_id: TG_REVOKED })).status, 403);

    const jobs = await pgQuery('SELECT COUNT(*)::int AS c FROM product_research_imports WHERE tenant_id = $1', [TENANT_A]);
    assert.equal(jobs.rows[0].c, 0);
  });

  it('/url menyimpan URL dari bot sebagai status "user" dan menolak URL tidak valid', async () => {
    const call = (ref, body, token = TOKENS.curateA) => candidateUrlPost(
      req(`/api/operator/v2/product-research/candidates/${ref}/url`, { method: 'POST', token, body }),
      { params: Promise.resolve({ ref }) }
    );
    assert.equal((await call('3', { url: 'ftp://x', telegram_user_id: TG_OK })).status, 400);
    assert.equal((await call('3', { url: `https://shopee.co.id/p/fix-${runSuffix}`, telegram_user_id: TG_UNKNOWN })).status, 403);
    const ok = await call('3', { url: `https://shopee.co.id/p/fix-${runSuffix}`, telegram_user_id: TG_OK });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.candidate.url_status, 'user');
    assert.equal(body.candidate.effective_url, `https://shopee.co.id/p/fix-${runSuffix}`);
  });

  it('/kirim lewat bot memakai layanan promosi yang sama: preview tanpa efek, execute 1 job + requested_by telegram', async () => {
    const call = (body) => promotePost(req('/api/operator/v2/product-research/promote', {
      method: 'POST', token: TOKENS.promoteA, body
    }));

    const preview = await call({ candidate_refs: ['1', '2'], mode: 'preview', telegram_user_id: TG_OK });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).summary.valid_count, 2);
    assert.equal(
      (await pgQuery('SELECT COUNT(*)::int AS c FROM product_research_imports WHERE tenant_id = $1', [TENANT_A])).rows[0].c,
      0
    );

    // kandidat arsip (4) tidak boleh ikut terkirim walau nomornya diminta
    const exec = await call({ candidate_refs: ['1', '4'], mode: 'execute', telegram_user_id: TG_OK });
    assert.equal(exec.status, 200);
    const data = await exec.json();
    assert.equal(data.mode, 'execute');
    const q = data.results.find(r => r.status === 'queued');
    assert.ok(q, 'kandidat 1 harus masuk antrean');
    createdJobIds.push(q.job_id);
    assert.equal(data.summary.queued, 1);

    const imp = (await pgQuery(
      `SELECT requested_by FROM product_research_imports WHERE tenant_id = $1 AND candidate_id = $2`,
      [TENANT_A, idHigh]
    )).rows[0];
    assert.equal(imp.requested_by, `telegram:${TG_OK}`);

    const dup = await call({ candidate_refs: ['1'], mode: 'execute', telegram_user_id: TG_OK });
    const dupData = await dup.json();
    assert.equal(dupData.summary.queued, 0);
    assert.equal(dupData.summary.skipped_blocked, 1);
  });

  it('Isolasi tenant: token & identitas tenant B tidak melihat atau mempromosikan kandidat tenant A', async () => {
    const list = await candidatesGet(req('/api/operator/v2/product-research/candidates', { token: TOKENS.fullB }));
    assert.equal((await list.json()).items.length, 0);

    const detail = await candidateDetailGet(
      req(`/api/operator/v2/product-research/candidates/${idLow}`, { token: TOKENS.fullB }),
      { params: Promise.resolve({ ref: idLow }) }
    );
    assert.equal(detail.status, 404);

    const exec = await promotePost(req('/api/operator/v2/product-research/promote', {
      method: 'POST', token: TOKENS.fullB, body: { candidate_refs: [idLow], mode: 'execute', telegram_user_id: TG_B }
    }));
    assert.equal(exec.status, 200);
    const data = await exec.json();
    assert.equal(data.summary.queued, 0);
    assert.equal(data.summary.skipped_blocked, 1);

    // identitas Telegram tenant A tidak berlaku di tenant B
    const cross = await promotePost(req('/api/operator/v2/product-research/promote', {
      method: 'POST', token: TOKENS.fullB, body: { candidate_refs: [idLow], mode: 'preview', telegram_user_id: TG_OK }
    }));
    assert.equal(cross.status, 403);
  });

  it('MCP (7.6): submit wajib scope product_research:mcp_promote, tanpa identitas Telegram, requested_by mcp:<kredensial>, tertahan/arsip tidak terkirim', async () => {
    const call = (token, body) => submitPost(req('/api/operator/v2/product-research/submit', { method: 'POST', token, body }));

    // token bot (promote) & read tidak boleh memakai jalur MCP
    assert.equal((await call(TOKENS.promoteA, { candidate_refs: ['2'], mode: 'execute' })).status, 403);
    assert.equal((await call(TOKENS.readA, { candidate_refs: ['2'], mode: 'execute' })).status, 403);
    assert.equal((await call(null, { candidate_refs: ['2'] })).status, 401);

    const preview = await (await call(TOKENS.mcpA, { candidate_refs: ['2', '4'] })).json();
    assert.equal(preview.mode, 'preview');
    assert.equal(preview.summary.valid_count, 1);

    const exec = await call(TOKENS.mcpA, { candidate_refs: ['2', '4'], mode: 'execute' });
    assert.equal(exec.status, 200);
    const data = await exec.json();
    const q = data.results.find(r => r.status === 'queued');
    assert.ok(q);
    createdJobIds.push(q.job_id);
    assert.equal(data.summary.queued, 1);
    assert.equal(data.results.find(r => r.candidate_id === idArchived).status, 'skipped_blocked');

    const imp = (await pgQuery(
      `SELECT requested_by FROM product_research_imports WHERE tenant_id = $1 AND candidate_id = $2`,
      [TENANT_A, idLow]
    )).rows[0];
    assert.equal(imp.requested_by, `mcp:op_bot_mcpA_${runSuffix}`);
  });

  it('MCP (7.6): match-url menemukan kandidat Radar (guard cf_add_product), butuh scope read, terisolasi tenant', async () => {
    const url = `https://www.shopee.co.id/p/bot-high-${runSuffix}?utm_source=x`;
    const path = `/api/operator/v2/product-research/candidates/match-url?url=${encodeURIComponent(url)}`;
    assert.equal((await matchUrlGet(req(path, { token: TOKENS.ingestA }))).status, 403);

    const hit = await (await matchUrlGet(req(path, { token: TOKENS.readA }))).json();
    assert.equal(hit.matches.length, 1);
    assert.equal(hit.matches[0].id, idHigh);

    const none = await (await matchUrlGet(req(path, { token: TOKENS.fullB }))).json();
    assert.equal(none.matches.length, 0);

    const archivedUrl = `/api/operator/v2/product-research/candidates/match-url?url=${encodeURIComponent(`https://shopee.co.id/p/bot-arch-${runSuffix}`)}`;
    assert.equal((await (await matchUrlGet(req(archivedUrl, { token: TOKENS.readA }))).json()).matches.length, 0);
  });
});
