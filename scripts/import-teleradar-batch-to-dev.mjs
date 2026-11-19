import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildTeleRadarBatchIngestPayload } from '../lib/teleradar-batch-mapper.js';
import { loadAndValidateDbEnv } from '../lib/db-env-validator.js';

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function parseImportArgs(argv = process.argv.slice(2)) {
  const valueOf = (flag) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : null;
  };

  const file = expandHome(valueOf('--file') || '~/riset-produk/2026-11-17/data.json');
  const schema = (valueOf('--schema') || 'dev').trim();
  const tenant = (valueOf('--tenant') || 'default_tenant').trim();
  const viaApi = valueOf('--via-api');
  const apply = argv.includes('--apply');
  const confirmDev = argv.includes('--confirm-dev');

  if (schema !== 'dev') {
    throw new Error(`Skrip migrasi batch awal ini HANYA diizinkan untuk schema "dev" (diterima: "${schema}").`);
  }
  if (apply && !confirmDev) {
    throw new Error('Eksekusi --apply wajib menyertakan --confirm-dev.');
  }

  return { file, schema, tenant, viaApi, apply, confirmDev };
}

export async function runImportBatch() {
  const opts = parseImportArgs();
  if (!fs.existsSync(opts.file)) {
    throw new Error(`File data.json tidak ditemukan: ${opts.file}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
  const batchDir = path.dirname(opts.file);
  const payload = buildTeleRadarBatchIngestPayload(rawJson, {
    batchDir,
    includeLocalPhotos: true
  });

  const stats = {
    mode: opts.apply ? 'apply' : 'dry-run',
    schema: opts.schema,
    tenant: opts.tenant,
    via_api: opts.viaApi || 'direct-db',
    external_batch_id: payload.batch.external_batch_id,
    total_candidates: payload.candidates.length,
    with_local_photo: payload.candidates.filter(c => Boolean(c.thumb_base64)).length,
    legacy_approved_count: payload.candidates.filter(c => c.research_data.legacy_approved).length,
    legacy_staging_id_count: payload.candidates.filter(c => Boolean(c.research_data.legacy_staging_cf_product_id)).length,
    url_statuses: payload.candidates.reduce((acc, c) => {
      acc[c.url_status] = (acc[c.url_status] || 0) + 1;
      return acc;
    }, {}),
    trends: payload.candidates.reduce((acc, c) => {
      const t = c.research_data.trend;
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  };

  if (!opts.apply) {
    console.log(JSON.stringify(stats, null, 2));
    console.log('ℹ️  Dry-run selesai. Tambahkan --apply --confirm-dev untuk mengimpor ke Dev.');
    return stats;
  }

  if (opts.viaApi) {
    const token = process.env.CF_RADAR_INGEST_TOKEN || '';
    if (!token) {
      throw new Error('CF_RADAR_INGEST_TOKEN wajib diset di environment saat memakai --via-api.');
    }
    const res = await fetch(opts.viaApi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(`HTTP ${res.status}: ${json?.error || JSON.stringify(json)}`);
    }
    console.log(JSON.stringify({ ...stats, ingest_result: json.summary, batch_id: json.batch?.id }, null, 2));
    return json;
  }

  // Direct DB mode (hanya ke schema dev)
  process.env.DISABLE_AUTO_MIGRATIONS = 'true';
  process.env.PG_SEARCH_PATH = 'dev';
  loadAndValidateDbEnv({ requireDevSchema: true });

  const { tenantContext } = await import('../lib/tenant-context.js');
  const { closePgPool } = await import('../lib/db-pg.js');
  const { ingestProductResearchBatch } = await import('../lib/product-research-ingest-service.js');

  try {
    const result = await tenantContext.run(opts.tenant, async () => {
      return await ingestProductResearchBatch({ payload });
    });
    console.log(JSON.stringify({ ...stats, ingest_result: result.summary, batch_id: result.batch?.id }, null, 2));
    return result;
  } finally {
    await closePgPool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runImportBatch()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [import-teleradar-batch-to-dev] Gagal:', err.message);
      process.exit(1);
    });
}
