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
import {
  OPPORTUNITY_SCORE_RULES,
  computeOpportunityScore
} from '../../lib/product-research-opportunity-score.js';
import {
  upsertResearchBatch,
  upsertResearchCandidates
} from '../../lib/product-research-repository.js';
import { GET as candidatesGet } from '../../app/api/v2/product-research/candidates/route.js';
import { GET as candidateDetailGet } from '../../app/api/v2/product-research/candidates/[id]/route.js';
import { GET as candidateStatusGet } from '../../app/api/v2/product-research/candidates/[id]/status/route.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_ts_a_${runSuffix}`;
const TENANT_B = `test_ts_b_${runSuffix}`;
const USER_A = `usr_ts_a_${runSuffix}`;
const USER_B = `usr_ts_b_${runSuffix}`;
const SHARED_CAT_ID_A = `pe_ts_cat_a_${runSuffix}`;
const SHARED_CAT_ID_B = `pe_ts_cat_b_${runSuffix}`;

function makeReq(urlPath, { method = 'GET', sessionToken = null } = {}) {
  const headers = {};
  const cookieName = process.env.SESSION_COOKIE_NAME || 'makna_session';
  if (sessionToken) headers.cookie = `${cookieName}=${sessionToken}`;
  return new Request(`http://127.0.0.1:5020${urlPath}`, { method, headers });
}

describe('Perbandingan Tren Lintas Minggu & Skor Peluang (Tahap 7.2 & 7.3)', () => {
  let sessA = null;
  let sessB = null;
  let batch1A = null;
  let batch2A = null;
  let candUrlW1Id = null;
  let candUrlW2Id = null;
  let candCfW2Id = null;
  let candNearestW2Id = null;
  let candHighScoreNewId = null;

  before(async () => {
    for (const [id, name, slug] of [
      [TENANT_A, `Trends Tenant A ${runSuffix}`, `ts-a-${runSuffix}`],
      [TENANT_B, `Trends Tenant B ${runSuffix}`, `ts-b-${runSuffix}`]
    ]) {
      await pgQuery(
        `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
        [id, name, slug]
      );
    }

    const pwdHash = hashPassword(`ts-pwd-${runSuffix}`);
    for (const [uid, uname, tid] of [
      [USER_A, `ts_a_${runSuffix}`, TENANT_A],
      [USER_B, `ts_b_${runSuffix}`, TENANT_B]
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

    await pgQuery(
      `INSERT INTO product_extractions (id, tenant_id, product_name, input_source, source_url, normalized_source_url)
       VALUES
         ($1, $3, 'Katalog Match A', 'https://shopee.co.id/p/cf-match-a', 'https://shopee.co.id/p/cf-match-a', 'https://shopee.co.id/p/cf-match-a'),
         ($2, $4, 'Katalog Match B', 'https://shopee.co.id/p/ts-url-repeat', 'https://shopee.co.id/p/ts-url-repeat', 'https://shopee.co.id/p/ts-url-repeat')`,
      [SHARED_CAT_ID_A, SHARED_CAT_ID_B, TENANT_A, TENANT_B]
    );

    // Tenant A Batch Minggu 1 (10 Nov 2026)
    batch1A = await tenantContext.run(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `2026-11-10-${runSuffix}`,
      observedAt: '2026-11-10T08:00:00.000Z'
    }));
    const w1Up = await tenantContext.run(TENANT_A, () => upsertResearchCandidates(batch1A.id, [
      {
        external_candidate_id: 'w1_url_repeat',
        url_status: 'listing',
        source_url: `https://shopee.co.id/p/ts-url-repeat-${runSuffix}`,
        research_data: {
          rank: 5,
          name: 'Kopi Tubruk Gayo',
          category: 'Minuman & Kopi',
          sold_per_week: 500,
          trend: 'up',
          commission_rp: 15000,
          price: 80000
        }
      },
      {
        external_candidate_id: 'w1_cf_repeat',
        url_status: 'official',
        source_url: `https://shopee.co.id/p/cf-a-old-${runSuffix}`,
        research_data: {
          rank: 4,
          name: 'Serum Niacinamide 10%',
          category: 'Skincare',
          sold_per_week: 900,
          trend: 'stable',
          commission_rp: 20000,
          price: 110000
        }
      },
      {
        external_candidate_id: 'w1_nearest_similar',
        url_status: 'nearest',
        source_url: `https://shopee.co.id/mirip/pisau-keramik-${runSuffix}`,
        research_data: {
          rank: 3,
          name: 'Set Pisau Dapur Keramik Anti Lengket 6pcs',
          category: 'Dapur',
          sold_per_week: 400,
          trend: 'stable',
          commission_rp: 9000,
          price: 90000
        }
      }
    ]));
    const w1Map = new Map(w1Up.results.map(r => [r.external_candidate_id, r.candidate_id]));
    candUrlW1Id = w1Map.get('w1_url_repeat');

    await pgQuery(
      `UPDATE product_research_candidates
       SET cf_product_id = $1, process_status = 'in_catalog'
       WHERE id = $2 AND tenant_id = $3`,
      [SHARED_CAT_ID_A, w1Map.get('w1_cf_repeat'), TENANT_A]
    );

    // Tenant A Batch Minggu 2 (17 Nov 2026)
    batch2A = await tenantContext.run(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `2026-11-17-${runSuffix}`,
      observedAt: '2026-11-17T08:00:00.000Z'
    }));
    const w2Up = await tenantContext.run(TENANT_A, () => upsertResearchCandidates(batch2A.id, [
      {
        external_candidate_id: 'w2_url_repeat',
        url_status: 'official',
        // Query tracking berbeda -> harus tetap cocok via normalized_url
        source_url: `https://www.shopee.co.id/p/ts-url-repeat-${runSuffix}?utm_source=radar&sp_atk=xyz`,
        research_data: {
          rank: 2,
          name: 'Kopi Tubruk Gayo Premium',
          category: 'Minuman & Kopi',
          sold_per_week: 820,
          trend: 'up',
          commission_rp: 18000,
          price: 78000
        }
      },
      {
        external_candidate_id: 'w2_cf_repeat',
        url_status: 'official',
        // URL baru berbeda, tapi cf_product_id sama -> cocok via cf_product_id
        source_url: `https://shopee.co.id/p/cf-a-new-${runSuffix}`,
        research_data: {
          rank: 3,
          name: 'Serum Niacinamide Brightening',
          category: 'Skincare',
          sold_per_week: 1050,
          trend: 'up',
          commission_rp: 26000,
          price: 115000
        }
      },
      {
        external_candidate_id: 'w2_nearest_similar',
        url_status: 'nearest',
        source_url: `https://shopee.co.id/mirip/pisau-keramik-${runSuffix}`,
        research_data: {
          rank: 4,
          name: 'Set Pisau Dapur Keramik Anti Lengket 6pcs',
          category: 'Dapur',
          sold_per_week: 380,
          trend: 'down',
          commission_rp: 7500,
          price: 89000
        }
      },
      {
        external_candidate_id: 'w2_high_score_new',
        url_status: 'official',
        source_url: `https://shopee.co.id/p/super-skor-${runSuffix}`,
        research_data: {
          rank: 10,
          name: 'Blender Mini Portable USB 6 Mata Pisau',
          category: 'Dapur',
          sold_per_week: 1500,
          trend: 'up',
          commission_rp: 30000,
          price: 120000
        }
      }
    ]));
    const w2Map = new Map(w2Up.results.map(r => [r.external_candidate_id, r.candidate_id]));
    candUrlW2Id = w2Map.get('w2_url_repeat');
    candCfW2Id = w2Map.get('w2_cf_repeat');
    candNearestW2Id = w2Map.get('w2_nearest_similar');
    candHighScoreNewId = w2Map.get('w2_high_score_new');

    await pgQuery(
      `UPDATE product_research_candidates
       SET cf_product_id = $1, process_status = 'in_catalog'
       WHERE id = $2 AND tenant_id = $3`,
      [SHARED_CAT_ID_A, candCfW2Id, TENANT_A]
    );

    // Tenant B: kandidat terpisah dengan nama dan URL identik -> tidak boleh bocor ke Tenant A
    const batch1B = await tenantContext.run(TENANT_B, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `2026-11-10-b-${runSuffix}`,
      observedAt: '2026-11-10T08:00:00.000Z'
    }));
    await tenantContext.run(TENANT_B, () => upsertResearchCandidates(batch1B.id, [
      {
        external_candidate_id: 'b_isolation',
        url_status: 'official',
        source_url: `https://shopee.co.id/p/ts-url-repeat-${runSuffix}`,
        research_data: {
          rank: 1,
          name: 'Kopi Tubruk Gayo Rahasia Tenant B',
          sold_per_week: 9999,
          trend: 'up',
          commission_rp: 50000,
          price: 90000
        }
      }
    ]));
  });

  after(async () => {
    await destroySession(sessA);
    await destroySession(sessB);
    await pgQuery('DELETE FROM product_extractions WHERE id = ANY($1::text[])', [[SHARED_CAT_ID_A, SHARED_CAT_ID_B]]);
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await pgQuery('DELETE FROM users WHERE id = ANY($1::text[])', [[USER_A, USER_B]]);
    await pgQuery('DELETE FROM tenants WHERE id = ANY($1::text[])', [[TENANT_A, TENANT_B]]);
    await closePgPool();
  });

  it('Rumus transparan Skor Peluang menghitung 5 komponen dengan rincian & tanpa promosi otomatis', () => {
    const high = computeOpportunityScore({
      observed_at: '2026-11-17T08:00:00.000Z',
      url_status: 'official',
      research_data: {
        sold_per_week: 1500,
        trend: 'up',
        commission_rp: 30000,
        price: 120000
      }
    });
    assert.equal(high.version, OPPORTUNITY_SCORE_RULES.version);
    assert.equal(high.total, 100);
    assert.equal(high.tier, 'high');
    assert.equal(high.tier_label, 'Prioritas Tinggi');
    assert.equal(high.breakdown.length, 5);
    assert.match(high.note, /tidak pernah memicu promosi otomatis/i);
    assert.deepEqual(
      high.breakdown.map(b => [b.key, b.score, b.max]),
      [
        ['sold', 30, 30],
        ['trend', 20, 20],
        ['commission', 20, 20],
        ['price', 15, 15],
        ['url_match', 15, 15]
      ]
    );

    const empty = computeOpportunityScore({
      url_status: 'not_found',
      research_data: {}
    });
    assert.equal(empty.total, 8); // trend default 'Tidak tercatat' = 8, lainnya 0
    assert.equal(empty.tier, 'low');
    assert.equal(empty.tier_label, 'Perlu Tinjau');
  });

  it('Skor Peluang tinggi tidak memicu promosi otomatis atau job scheduler', async () => {
    const jobsRes = await pgQuery(
      'SELECT COUNT(*)::int AS cnt FROM scheduler_jobs WHERE payload LIKE $1',
      [`%${runSuffix}%`]
    );
    assert.equal(jobsRes.rows[0].cnt, 0);

    const candRes = await pgQuery(
      'SELECT process_status, cf_product_id FROM product_research_candidates WHERE id = $1',
      [candHighScoreNewId]
    );
    assert.equal(candRes.rows[0].process_status, 'not_sent');
    assert.equal(candRes.rows[0].cf_product_id, null);
  });

  it('List API menyertakan perbandingan lintas minggu (dengan tanggal pengamatan) dan mendukung sort_by score_desc & sold_delta_desc', async () => {
    const resScoreSort = await candidatesGet(
      makeReq(`/api/v2/product-research/candidates?batch_id=${batch2A.id}&sort_by=score_desc`, { sessionToken: sessA })
    );
    assert.equal(resScoreSort.status, 200);
    const dataScore = await resScoreSort.json();
    assert.equal(dataScore.success, true);
    assert.equal(dataScore.opportunity_score_rules.maxTotal, 100);

    const idsByScore = dataScore.items.map(i => i.id);
    // w2_high_score_new (skor 100) harus urutan paling atas walau rank-nya #10
    assert.equal(idsByScore[0], candHighScoreNewId);
    assert.equal(dataScore.items[0].opportunity_score.total, 100);
    assert.equal(dataScore.items[dataScore.items.length - 1].id, candNearestW2Id);

    const urlRepeatItem = dataScore.items.find(i => i.id === candUrlW2Id);
    assert.equal(urlRepeatItem.weekly_comparison.status, 'repeat');
    assert.equal(urlRepeatItem.weekly_comparison.match_method, 'URL Terverifikasi');
    assert.equal(urlRepeatItem.weekly_comparison.observations_count, 2);
    assert.equal(urlRepeatItem.weekly_comparison.previous.candidate_id, candUrlW1Id);
    assert.equal(urlRepeatItem.weekly_comparison.deltas.sold_delta, 320);
    assert.equal(urlRepeatItem.weekly_comparison.deltas.sold_pct, 64);
    assert.equal(urlRepeatItem.weekly_comparison.deltas.rank_delta, 3); // rank #5 -> #2 = ↑3

    const cfRepeatItem = dataScore.items.find(i => i.id === candCfW2Id);
    assert.equal(cfRepeatItem.weekly_comparison.status, 'repeat');
    assert.equal(cfRepeatItem.weekly_comparison.match_method, 'ID Katalog');
    assert.equal(cfRepeatItem.weekly_comparison.deltas.sold_delta, 150);

    // Status nearest TIDAK pernah auto-match antarbatch meskipun source_url identik
    const nearestItem = dataScore.items.find(i => i.id === candNearestW2Id);
    assert.equal(nearestItem.weekly_comparison.status, 'unmatched_url');
    assert.equal(nearestItem.weekly_comparison.previous, null);
    assert.equal(nearestItem.weekly_comparison.observations_count, 1);

    // Sort menurut kenaikan terjual lintas minggu (sold_delta_desc): +320 > +150 > null
    const resDeltaSort = await candidatesGet(
      makeReq(`/api/v2/product-research/candidates?batch_id=${batch2A.id}&sort_by=sold_delta_desc`, { sessionToken: sessA })
    );
    const dataDelta = await resDeltaSort.json();
    assert.equal(dataDelta.items[0].id, candUrlW2Id);
    assert.equal(dataDelta.items[1].id, candCfW2Id);

    // Batch minggu 1 tetap tersimpan utuh dan tidak tertimpa batch minggu 2
    const resW1 = await candidatesGet(
      makeReq(`/api/v2/product-research/candidates?batch_id=${batch1A.id}`, { sessionToken: sessA })
    );
    const dataW1 = await resW1.json();
    const w1Item = dataW1.items.find(i => i.id === candUrlW1Id);
    assert.equal(w1Item.research_data.sold_per_week, 500);
    assert.equal(w1Item.weekly_comparison.previous, null); // Tidak mundur ke masa depan
  });

  it('Detail & Status API menampilkan timeline pengamatan terpisah, saran nama mirip non-auto-merge, rincian skor, serta isolasi tenant', async () => {
    // 1. Detail kandidat ber-URL repeat (2 minggu terpisah & tanpa kebocoran Tenant B)
    const resUrlDetail = await candidateDetailGet(
      makeReq(`/api/v2/product-research/candidates/${candUrlW2Id}`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candUrlW2Id }) }
    );
    assert.equal(resUrlDetail.status, 200);
    const urlDetail = (await resUrlDetail.json()).candidate;
    assert.equal(urlDetail.weekly_history.matched_by, 'normalized_url');
    assert.equal(urlDetail.weekly_history.observations.length, 2);
    assert.ok(urlDetail.weekly_history.observations.every(o => o.sold_per_week !== 9999));
    assert.equal(urlDetail.opportunity_score.breakdown.length, 5);

    // 2. Detail kandidat nearest: tidak digabung otomatis, namun menampilkan saran nama mirip
    const resNearestStatus = await candidateStatusGet(
      makeReq(`/api/v2/product-research/candidates/${candNearestW2Id}/status`, { sessionToken: sessA }),
      { params: Promise.resolve({ id: candNearestW2Id }) }
    );
    assert.equal(resNearestStatus.status, 200);
    const nearestCand = (await resNearestStatus.json()).candidate;
    assert.equal(nearestCand.weekly_history.matched_by, 'none');
    assert.equal(nearestCand.weekly_history.observations.length, 1);
    assert.ok(nearestCand.weekly_history.similar_name_suggestions.length >= 1);
    const sug = nearestCand.weekly_history.similar_name_suggestions[0];
    assert.equal(sug.is_suggestion, true);
    assert.equal(sug.auto_merged, false);
    assert.match(sug.name, /Set Pisau Dapur Keramik/);

    // 3. Isolasi tenant: Tenant B ditolak 404 saat membuka detail kandidat Tenant A
    const resCrossTenant = await candidateDetailGet(
      makeReq(`/api/v2/product-research/candidates/${candUrlW2Id}`, { sessionToken: sessB }),
      { params: Promise.resolve({ id: candUrlW2Id }) }
    );
    assert.equal(resCrossTenant.status, 404);
  });
});
