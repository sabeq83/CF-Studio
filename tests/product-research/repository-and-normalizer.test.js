import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { tenantContext } from '../../lib/tenant-context.js';
import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { normalizeProductUrl } from '../../lib/product-url-normalizer.js';
import {
  upsertResearchBatch,
  listResearchBatches,
  upsertResearchCandidates,
  listResearchCandidates,
  getResearchCandidateById,
  updateResearchCandidateCuration,
  archiveResearchCandidate,
  claimCandidatePromotion,
  markPromotionQueued,
  markPromotionFailed
} from '../../lib/product-research-repository.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_A = `test_radar_a_${runSuffix}`;
const TENANT_B = `test_radar_b_${runSuffix}`;

function runAsTenant(tenantId, fn) {
  return tenantContext.run(tenantId, fn);
}

describe('Product URL Normalizer & Radar Produk Repository (Tahap 2)', () => {
  let batchIdA = null;
  let candidateIdA1 = null;
  let candidateIdA2 = null;

  before(async () => {
    const check = await pgQuery(
      `SELECT COUNT(*)::int AS cnt
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name IN ('product_research_batches', 'product_research_candidates', 'product_research_imports')`
    );
    assert.equal(check.rows[0].cnt, 3, 'Ketiga tabel product_research_* harus ada di schema dev');
  });

  after(async () => {
    await pgQuery(
      'DELETE FROM product_research_batches WHERE tenant_id = ANY($1::text[])',
      [[TENANT_A, TENANT_B]]
    );
    await closePgPool();
  });

  it('normalizeProductUrl menjaga perilaku identik dengan normalizeUrl lama', () => {
    assert.equal(normalizeProductUrl(''), '');
    assert.equal(normalizeProductUrl(null), '');
    assert.equal(
      normalizeProductUrl('https://www.tokopedia.com/official/kopi-gayo/?utm_source=ig#top'),
      'https://tokopedia.com/official/kopi-gayo'
    );
    assert.equal(
      normalizeProductUrl('https://shopee.co.id/product/10221/8890123/?sp_atk=abc'),
      'https://shopee.co.id/product/10221/8890123'
    );
    assert.equal(
      normalizeProductUrl('not-a-valid-url/path/?a=1#b'),
      'not-a-valid-url/path'
    );
  });

  it('menolak operasi repository jika tenant context __none__', async () => {
    await assert.rejects(
      () => runAsTenant('__none__', () => listResearchBatches()),
      (err) => err.status === 403
    );
  });

  it('ingest idempotent memperbarui research_data tanpa menimpa curated_data, status, atau URL kurator', async () => {
    const batch = await runAsTenant(TENANT_A, () => upsertResearchBatch({
      source: 'teleradar',
      externalBatchId: `2026-11-19-${runSuffix}`,
      observedAt: '2026-11-19T01:00:00.000Z',
      metadata: { run: 1 }
    }));
    batchIdA = batch.id;
    assert.equal(batch.tenant_id, TENANT_A);

    const firstIngest = await runAsTenant(TENANT_A, () => upsertResearchCandidates(batchIdA, [
      {
        external_candidate_id: 'cand-1',
        url_status: 'nearest',
        source_url: 'https://www.shopee.co.id/search-mirip/produk-1?foo=1',
        research_data: { rank: 1, name: 'Produk Uji 1', sold_per_week: 500, trend: 'up' }
      },
      {
        external_candidate_id: 'cand-2',
        url_status: 'official',
        source_url: 'https://shopee.co.id/official/produk-2',
        research_data: { rank: 2, name: 'Produk Uji 2', sold_per_week: 320, trend: 'stable' }
      }
    ]));

    assert.equal(firstIngest.created, 2);
    assert.equal(firstIngest.updated, 0);
    candidateIdA1 = firstIngest.results[0].candidate_id;
    candidateIdA2 = firstIngest.results[1].candidate_id;

    // Kurator mengedit kandidat 1 (ubah URL, deskripsi, status kurasi)
    const edited = await runAsTenant(TENANT_A, () => updateResearchCandidateCuration(candidateIdA1, {
      curatedData: { name: 'Produk Uji 1 Kurasi', usp: 'USP pilihan kurator' },
      targetUrl: 'https://www.shopee.co.id/official/produk-1-asli/?ref=123',
      curationStatus: 'ready',
      expectedRevision: 1
    }));
    assert.equal(edited.revision, 2);
    assert.equal(edited.url_status, 'user');
    assert.equal(edited.curation_status, 'ready');
    assert.equal(edited.normalized_url, 'https://shopee.co.id/official/produk-1-asli');

    // Optimistic locking: revision lama (1) harus ditolak dengan 409
    await assert.rejects(
      () => runAsTenant(TENANT_A, () => updateResearchCandidateCuration(candidateIdA1, {
        curatedData: { name: 'Tabrakan' },
        expectedRevision: 1
      })),
      (err) => err.status === 409 && err.code === 'REVISION_CONFLICT'
    );

    // Sinkron ulang batch yang sama dengan angka sold_per_week terbaru
    const reSync = await runAsTenant(TENANT_A, () => upsertResearchCandidates(batchIdA, [
      {
        external_candidate_id: 'cand-1',
        url_status: 'nearest',
        source_url: 'https://shopee.co.id/search-mirip/produk-1-v2',
        research_data: { rank: 1, name: 'Produk Uji 1', sold_per_week: 620, trend: 'up' }
      }
    ]));
    assert.equal(reSync.created, 0);
    assert.equal(reSync.updated, 1);

    const afterSync = await runAsTenant(TENANT_A, () => getResearchCandidateById(candidateIdA1));
    assert.equal(afterSync.research_data.sold_per_week, 620);
    assert.equal(afterSync.curated_data.name, 'Produk Uji 1 Kurasi');
    assert.equal(afterSync.curated_data.usp, 'USP pilihan kurator');
    assert.equal(afterSync.curation_status, 'ready');
    assert.equal(afterSync.url_status, 'user');
    assert.equal(afterSync.normalized_url, 'https://shopee.co.id/official/produk-1-asli');
  });

  it('isolasi tenant mencegah tenant B membaca, mengubah, mengarsipkan, atau mengklaim kandidat tenant A', async () => {
    const listB = await runAsTenant(TENANT_B, () => listResearchCandidates());
    assert.equal(listB.items.length, 0);

    const getB = await runAsTenant(TENANT_B, () => getResearchCandidateById(candidateIdA1));
    assert.equal(getB, null);

    const updB = await runAsTenant(TENANT_B, () => updateResearchCandidateCuration(candidateIdA1, {
      curatedData: { name: 'Hack' }
    }));
    assert.equal(updB, null);

    const archB = await runAsTenant(TENANT_B, () => archiveResearchCandidate(candidateIdA1));
    assert.equal(archB, null);

    const claimB = await runAsTenant(TENANT_B, () => claimCandidatePromotion({ candidateId: candidateIdA1 }));
    assert.equal(claimB.found, false);
    assert.equal(claimB.claimed, false);
  });

  it('klaim promosi atomik mencegah eksekusi paralel ganda dan retry memakai reserved_product_id yang sama', async () => {
    const [claim1, claim2] = await Promise.all([
      runAsTenant(TENANT_A, () => claimCandidatePromotion({
        candidateId: candidateIdA2,
        requestedBy: 'tester_a',
        generateReservedProductId: () => `pe_test_${runSuffix}_1`
      })),
      runAsTenant(TENANT_A, () => claimCandidatePromotion({
        candidateId: candidateIdA2,
        requestedBy: 'tester_a',
        generateReservedProductId: () => `pe_test_${runSuffix}_2`
      }))
    ]);

    const claimedResults = [claim1, claim2].filter(r => r.claimed);
    const conflictResults = [claim1, claim2].filter(r => r.conflict);

    assert.equal(claimedResults.length, 1, 'Tepat 1 klaim paralel yang boleh berhasil');
    assert.equal(conflictResults.length, 1, 'Klaim kedua harus tertolak oleh partial unique index');
    assert.equal(conflictResults[0].reason, 'ALREADY_CLAIMED');

    const firstReservedId = claimedResults[0].reservedProductId;
    const firstImportId = claimedResults[0].importRow.id;

    // Simulasikan enqueue gagal lalu retry
    await runAsTenant(TENANT_A, () => markPromotionFailed({
      importId: firstImportId,
      candidateId: candidateIdA2,
      error: 'Simulasi gagal enqueue'
    }));

    const retryClaim = await runAsTenant(TENANT_A, () => claimCandidatePromotion({
      candidateId: candidateIdA2,
      action: 'retry',
      requestedBy: 'tester_a',
      generateReservedProductId: () => `pe_test_${runSuffix}_NEW_SHOULD_NOT_BE_USED`
    }));

    assert.equal(retryClaim.claimed, true);
    assert.equal(retryClaim.reservedProductId, firstReservedId, 'Retry wajib memakai reserved_product_id yang sama');

    await runAsTenant(TENANT_A, () => markPromotionQueued({
      importId: retryClaim.importRow.id,
      candidateId: candidateIdA2,
      jobId: `job_${runSuffix}`
    }));

    const finalCand = await runAsTenant(TENANT_A, () => getResearchCandidateById(candidateIdA2));
    assert.equal(finalCand.process_status, 'queued');
    assert.equal(finalCand.imports.length, 2);
  });

  it('arsip kandidat mengubah curation_status menjadi archived dan mencatat riwayat', async () => {
    const archived = await runAsTenant(TENANT_A, () => archiveResearchCandidate(candidateIdA1, {
      archived: true,
      requestedBy: 'tester_a'
    }));
    assert.equal(archived.curation_status, 'archived');

    const detail = await runAsTenant(TENANT_A, () => getResearchCandidateById(candidateIdA1));
    assert.equal(detail.imports[0].action, 'archive');
    assert.equal(detail.imports[0].status, 'completed');
  });
});
