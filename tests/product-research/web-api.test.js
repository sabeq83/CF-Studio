import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { tenantContext } from '../../lib/tenant-context.js';
import { createSession, destroySession } from '../../lib/auth.js';
import { hashPassword } from '../../lib/schema/user-schema.js';
import { listProductCatalog } from '../../lib/product-catalog-service.js';
import { POST as ingestPost } from '../../app/api/operator/v2/product-research/batches/route.js';
import { GET as candidatesGet } from '../../app/api/v2/product-research/candidates/route.js';
import {
  GET as candidateDetailGet,
  PATCH as candidateDetailPatch
} from '../../app/api/v2/product-research/candidates/[id]/route.js';
import { POST as candidateArchivePost } from '../../app/api/v2/product-research/candidates/[id]/archive/route.js';
import { GET as candidateImageGet } from '../../app/api/v2/product-research/candidates/[id]/image/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_web_a_${runSuffix}`;
const TENANT_B = `test_web_b_${runSuffix}`;
const USER_A_PERMITTED = `usr_a_ok_${runSuffix}`;
const USER_A_DENIED = `usr_a_no_${runSuffix}`;
const USER_B_PERMITTED = `usr_b_ok_${runSuffix}`;
const CRED_A = `op_web_a_${runSuffix}`;
const TOKEN_OP_INGEST = `tok_web_ingest_${crypto.randomBytes(16).toString('hex')}`;
const CATALOG_PROD_ID = `pe_web_test_${runSuffix}`;

const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function makeWebReq(urlPath, { method = 'GET', sessionToken = null, bearerToken = null, body = null } = {}) {
  const headers = {};
  const cookieName = process.env.SESSION_COOKIE_NAME || 'makna_session';
  if (sessionToken) headers.cookie = `${cookieName}=${sessionToken}`;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (body !== null) headers['content-type'] = 'application/json';
  return new Request(`http://127.0.0.1:5020${urlPath}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
}

describe('Web API Radar Produk & Izin Menu (Tahap 4)', () => {
  let sessAOk = null;
  let sessANo = null;
  let sessBOk = null;
  let candNearestId = null;
  let candOfficialId = null;

  before(async () => {
    for (const [id, name, slug] of [
      [TENANT_A, `Web Tenant A ${runSuffix}`, `web-a-${runSuffix}`],
      [TENANT_B, `Web Tenant B ${runSuffix}`, `web-b-${runSuffix}`]
    ]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [id, name, slug]
      );
    }

    const dummyPwdHash = hashPassword(`test-pwd-${runSuffix}`);
    for (const [uid, uname, tid] of [
      [USER_A_PERMITTED, `radar_a_ok_${runSuffix}`, TENANT_A],
      [USER_A_DENIED, `radar_a_no_${runSuffix}`, TENANT_A],
      [USER_B_PERMITTED, `radar_b_ok_${runSuffix}`, TENANT_B]
    ]) {
      await pgQuery(
        `INSERT INTO users (id, username, email, password_hash, role, status, tenant_id)
         VALUES ($1, $2, $3, $4, 'user', 'active', $5)`,
        [uid, uname, `${uname}@example.local`, dummyPwdHash, tid]
      );
    }

    await pgQuery(
      `INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
       VALUES ($1, $2, 'product_research', 1, 1), ($3, $4, 'product_research', 1, 1)`,
      [`perm_${USER_A_PERMITTED}_pr`, USER_A_PERMITTED, `perm_${USER_B_PERMITTED}_pr`, USER_B_PERMITTED]
    );

    sessAOk = (await createSession(USER_A_PERMITTED)).token;
    sessANo = (await createSession(USER_A_DENIED)).token;
    sessBOk = (await createSession(USER_B_PERMITTED)).token;

    const tokenHash = crypto.createHash('sha256').update(TOKEN_OP_INGEST).digest('hex');
    await pgQuery(
      `INSERT INTO operator_credentials (id, tenant_id, name, token_hash, scopes, status)
       VALUES ($1, $2, 'TeleRadar Web Test', $3, 'product_research:ingest', 'active')`,
      [CRED_A, TENANT_A, tokenHash]
    );

    // Seed 1 existing catalog product in Tenant A for archive & picker verification
    await pgQuery(
      `INSERT INTO product_extractions (id, tenant_id, product_name, input_source, source_url, normalized_source_url)
       VALUES ($1, $2, 'Produk Katalog Eksisting', 'https://shopee.co.id/existing/999', 'https://shopee.co.id/existing/999', 'https://shopee.co.id/existing/999')`,
      [CATALOG_PROD_ID, TENANT_A]
    );

    // Ingest 2 candidates via Operator API into Tenant A
    const ingestRes = await ingestPost(new Request('http://127.0.0.1:5020/api/operator/v2/product-research/batches', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TOKEN_OP_INGEST}`
      },
      body: JSON.stringify({
        batch: {
          source: 'teleradar',
          external_batch_id: `web-batch-${runSuffix}`,
          observed_at: '2026-11-17T08:00:00.000Z'
        },
        candidates: [
          {
            external_candidate_id: 'cand_nearest',
            url_status: 'nearest',
            source_url: 'https://shopee.co.id/mirip/111',
            thumb_base64: `data:image/png;base64,${TINY_PNG_BUFFER.toString('base64')}`,
            research_data: { rank: 1, name: 'Kandidat Terdekat Uji', category: 'Minuman & Kopi', sold_per_week: 400, trend: 'up', price: 55000 }
          },
          {
            external_candidate_id: 'cand_official',
            url_status: 'official',
            source_url: 'https://shopee.co.id/existing/999?utm_source=test',
            research_data: { rank: 2, name: 'Kandidat Resmi Duplikat', category: 'Skincare & Kecantikan', sold_per_week: 700, trend: 'stable', price: 89000 }
          }
        ]
      })
    }));
    const ingestJson = await ingestRes.json();
    candNearestId = ingestJson.candidates.find(c => c.external_candidate_id === 'cand_nearest').candidate_id;
    candOfficialId = ingestJson.candidates.find(c => c.external_candidate_id === 'cand_official').candidate_id;
  });

  after(async () => {
    await destroySession(sessAOk);
    await destroySession(sessANo);
    await destroySession(sessBOk);
    await pgQuery('DELETE FROM product_extractions WHERE id = $1', [CATALOG_PROD_ID]);
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM operator_credentials WHERE id = $1', [CRED_A]);
    await pgQuery('DELETE FROM users WHERE id = ANY($1::text[])', [[USER_A_PERMITTED, USER_A_DENIED, USER_B_PERMITTED]]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    fs.rmSync(path.join(process.cwd(), 'public', 'uploads', 'product-research', TENANT_A), { recursive: true, force: true });
    await closePgPool();
  });

  it('menolak unauthenticated (401), operator scope ingest (403), dan user tanpa izin product_research (403)', async () => {
    const r401 = await candidatesGet(makeWebReq('/api/v2/product-research/candidates'));
    assert.equal(r401.status, 401);

    const rOp = await candidatesGet(makeWebReq('/api/v2/product-research/candidates', { bearerToken: TOKEN_OP_INGEST }));
    assert.equal(rOp.status, 403);

    const rNoPerm = await candidatesGet(makeWebReq('/api/v2/product-research/candidates', { sessionToken: sessANo }));
    assert.equal(rNoPerm.status, 403);
  });

  it('daftar kandidat, filter, deteksi duplikat URL read-only, dan url_blocked berjalan akurat', async () => {
    const res = await candidatesGet(makeWebReq('/api/v2/product-research/candidates', { sessionToken: sessAOk }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.items.length, 2);

    const nearest = json.items.find(i => i.id === candNearestId);
    const official = json.items.find(i => i.id === candOfficialId);
    assert.equal(nearest.url_blocked, true);
    assert.equal(nearest.thumb_api_url, `/api/v2/product-research/candidates/${candNearestId}/image?kind=thumb`);
    assert.equal(official.url_blocked, false);
    assert.equal(official.duplicate_match?.cf_product_id, CATALOG_PROD_ID);
  });

  it('tenant B tidak dapat membaca, mengedit, mengarsip, atau mengambil foto kandidat tenant A', async () => {
    const listB = await candidatesGet(makeWebReq('/api/v2/product-research/candidates', { sessionToken: sessBOk }));
    assert.equal(listB.status, 200);
    const listBJson = await listB.json();
    assert.equal(listBJson.items.length, 0);

    const getB = await candidateDetailGet(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}`, { sessionToken: sessBOk }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(getB.status, 404);

    const patchB = await candidateDetailPatch(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}`, {
        method: 'PATCH',
        sessionToken: sessBOk,
        body: { curated_data: { name: 'Cross Tenant Hack' } }
      }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(patchB.status, 404);

    const imgB = await candidateImageGet(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}/image?kind=thumb`, { sessionToken: sessBOk }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(imgB.status, 404);
  });

  it('PATCH edit kurator & verifikasi URL mengubah url_blocked menjadi false dan menegakkan optimistic revision', async () => {
    const patchOk = await candidateDetailPatch(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}`, {
        method: 'PATCH',
        sessionToken: sessAOk,
        body: {
          curated_data: { name: 'Kandidat Terverifikasi Kurator', usp: 'USP teruji' },
          target_url: 'https://www.tokopedia.com/official/kopi-verified?ref=1',
          curation_status: 'ready',
          expected_revision: 1
        }
      }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(patchOk.status, 200);
    const okJson = await patchOk.json();
    assert.equal(okJson.candidate.url_status, 'user');
    assert.equal(okJson.candidate.url_blocked, false);
    assert.equal(okJson.candidate.revision, 2);

    const patchConflict = await candidateDetailPatch(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}`, {
        method: 'PATCH',
        sessionToken: sessAOk,
        body: { curated_data: { name: 'Stale' }, expected_revision: 1 }
      }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(patchConflict.status, 409);
  });

  it('route foto menyajikan bytes PNG milik tenant A dan arsip kandidat tidak menghapus produk katalog', async () => {
    const imgRes = await candidateImageGet(
      makeWebReq(`/api/v2/product-research/candidates/${candNearestId}/image?kind=thumb`, { sessionToken: sessAOk }),
      { params: Promise.resolve({ id: candNearestId }) }
    );
    assert.equal(imgRes.status, 200);
    assert.equal(imgRes.headers.get('content-type'), 'image/png');
    const buf = Buffer.from(await imgRes.arrayBuffer());
    assert.deepEqual(buf, TINY_PNG_BUFFER);

    const archRes = await candidateArchivePost(
      makeWebReq(`/api/v2/product-research/candidates/${candOfficialId}/archive`, {
        method: 'POST',
        sessionToken: sessAOk,
        body: { archived: true }
      }),
      { params: Promise.resolve({ id: candOfficialId }) }
    );
    assert.equal(archRes.status, 200);

    // Verifikasi katalog product_extractions tetap utuh (Verifikasi Wajib #10)
    const prodCheck = await pgQuery('SELECT id FROM product_extractions WHERE id = $1 AND tenant_id = $2', [CATALOG_PROD_ID, TENANT_A]);
    assert.equal(prodCheck.rowCount, 1);

    // Verifikasi pemilih produk katalog tidak memuat kandidat riset (Verifikasi Wajib #9)
    const catalog = await tenantContext.run(TENANT_A, () => listProductCatalog({ limit: 100 }));
    assert.equal(catalog.data.length, 1);
    assert.equal(catalog.data[0].id, CATALOG_PROD_ID);
  });
});
