import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
if (!process.env.PG_SEARCH_PATH || process.env.PG_SEARCH_PATH === 'public') {
  process.env.PG_SEARCH_PATH = 'dev';
}

import { pgQuery, closePgPool } from '../../lib/db-pg.js';
import { tenantContext } from '../../lib/tenant-context.js';
import { buildTeleRadarBatchIngestPayload } from '../../lib/teleradar-batch-mapper.js';
import { ingestProductResearchBatch } from '../../lib/product-research-ingest-service.js';
import { listResearchCandidates } from '../../lib/product-research-repository.js';

const runSuffix = crypto.randomUUID().slice(0, 8);
const TENANT_MAPPER = `test_mapper_${runSuffix}`;

describe('TeleRadar Batch Mapper & Migrasi 1 Batch Aman (Tahap 6)', () => {
  after(async () => {
    await pgQuery('DELETE FROM product_research_batches WHERE tenant_id = $1', [TENANT_MAPPER]);
    await closePgPool();
  });

  it('memetakan tren, status_url, serta menjaga disetujui/cf_product_id lama hanya sebagai referensi historis', async () => {
    const sampleDataJson = {
      tanggal: `2026-11-17-${runSuffix}`,
      produk: [
        {
          no: 1,
          kategori: 'Cookware Sets',
          rank: 1,
          nama: 'Wajan Set Legacy Disetujui',
          terjual: 7800,
          tren: 'Naik',
          catatan_tren: 'naik tajam',
          komisi: 10508,
          harga: 153000,
          status_url: 'Resmi',
          toko: 'Texania',
          url: 'https://www.tokopedia.com/texania/wajan-set',
          deskripsi: 'Deskripsi riset',
          usp: 'USP riset',
          disetujui: true,
          cf_status: 'siap',
          cf_product_id: 'pe_staging_legacy_12345'
        },
        {
          no: 2,
          kategori: 'Dapur',
          rank: 2,
          nama: 'Panci Terdekat',
          terjual: 300,
          tren: 'Menurun',
          komisi: 5000,
          harga: 75000,
          status_url: 'Terdekat',
          toko: 'Toko B',
          url: 'https://www.tokopedia.com/search?q=panci',
          rekomendasi: false
        }
      ]
    };

    const payload = buildTeleRadarBatchIngestPayload(sampleDataJson, { includeLocalPhotos: false });
    assert.equal(payload.batch.source, 'teleradar');
    assert.equal(payload.candidates.length, 2);
    assert.equal(payload.candidates[0].url_status, 'official');
    assert.equal(payload.candidates[0].research_data.trend, 'up');
    assert.equal(payload.candidates[0].research_data.legacy_approved, true);
    assert.equal(payload.candidates[0].research_data.legacy_staging_cf_product_id, 'pe_staging_legacy_12345');
    assert.equal(payload.candidates[1].url_status, 'nearest');
    assert.equal(payload.candidates[1].research_data.trend, 'down');

    const beforeJobs = (await pgQuery('SELECT COUNT(*)::int AS cnt FROM scheduler_jobs')).rows[0].cnt;

    const ingestRes = await tenantContext.run(TENANT_MAPPER, () => ingestProductResearchBatch({ payload }));
    assert.equal(ingestRes.summary.created, 2);

    const list = await tenantContext.run(TENANT_MAPPER, () => listResearchCandidates({ batchId: ingestRes.batch.id }));
    const item1 = list.items.find(i => i.external_candidate_id === '1');
    assert.equal(item1.cf_product_id, null, 'cf_product_id Staging tidak boleh langsung mengisi cf_product_id Dev');
    assert.equal(item1.process_status, 'not_sent', 'Persetujuan lama tidak boleh memicu promosi');
    assert.equal(item1.research_data.legacy_staging_cf_product_id, 'pe_staging_legacy_12345');

    const afterJobs = (await pgQuery('SELECT COUNT(*)::int AS cnt FROM scheduler_jobs')).rows[0].cnt;
    assert.equal(afterJobs, beforeJobs, 'Impor historis tidak boleh membuat job scraper baru');
  });
});
