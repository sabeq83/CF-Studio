import { Pool } from 'pg';
import { loadAndValidateDbEnv } from '../lib/db-env-validator.js';

const ALLOWED_SCHEMAS = new Set(['dev', 'staging']);
const ADVISORY_LOCK_KEY = 'makna_product_research_v1';

export const PRODUCT_RESEARCH_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS product_research_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'teleradar',
  external_batch_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_prb_tenant_source_batch UNIQUE (tenant_id, source, external_batch_id),
  CONSTRAINT uq_prb_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_prb_tenant_observed
  ON product_research_batches (tenant_id, observed_at DESC, synced_at DESC);

CREATE TABLE IF NOT EXISTS product_research_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  external_candidate_id TEXT NOT NULL,
  research_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  curated_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  url_status TEXT NOT NULL DEFAULT 'not_researched',
  normalized_url TEXT,
  screenshot_path TEXT,
  thumb_path TEXT,
  curation_status TEXT NOT NULL DEFAULT 'new',
  process_status TEXT NOT NULL DEFAULT 'not_sent',
  cf_product_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prc_tenant_batch
    FOREIGN KEY (tenant_id, batch_id)
    REFERENCES product_research_batches (tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT uq_prc_tenant_batch_candidate UNIQUE (tenant_id, batch_id, external_candidate_id),
  CONSTRAINT uq_prc_tenant_id UNIQUE (tenant_id, id),
  CONSTRAINT chk_prc_url_status CHECK (
    url_status IN ('official', 'listing', 'nearest', 'not_found', 'user', 'not_researched')
  ),
  CONSTRAINT chk_prc_curation_status CHECK (
    curation_status IN ('new', 'needs_info', 'ready', 'archived')
  ),
  CONSTRAINT chk_prc_process_status CHECK (
    process_status IN ('not_sent', 'queued', 'processing', 'in_catalog', 'needs_review', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_prc_tenant_batch
  ON product_research_candidates (tenant_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_prc_tenant_statuses
  ON product_research_candidates (tenant_id, curation_status, process_status, url_status);

CREATE INDEX IF NOT EXISTS idx_prc_tenant_norm_url
  ON product_research_candidates (tenant_id, normalized_url)
  WHERE normalized_url IS NOT NULL AND normalized_url <> '';

CREATE INDEX IF NOT EXISTS idx_prc_tenant_cf_product
  ON product_research_candidates (tenant_id, cf_product_id)
  WHERE cf_product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_research_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  action TEXT NOT NULL,
  requested_by TEXT,
  reserved_product_id TEXT,
  job_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pri_tenant_candidate
    FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES product_research_candidates (tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT chk_pri_action CHECK (
    action IN ('promote', 'link', 'archive', 'retry')
  ),
  CONSTRAINT chk_pri_status CHECK (
    status IN ('claimed', 'queued', 'processing', 'completed', 'failed', 'linked', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pri_active_claim
  ON product_research_imports (tenant_id, candidate_id)
  WHERE status IN ('claimed', 'queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_pri_tenant_candidate_created
  ON product_research_imports (tenant_id, candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pri_tenant_job
  ON product_research_imports (tenant_id, job_id)
  WHERE job_id IS NOT NULL;
`;

export function parseMigrateArgs(argv = process.argv.slice(2)) {
  let schema = 'dev';
  let apply = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--dry-run') {
      apply = false;
    } else if (arg.startsWith('--schema=')) {
      schema = arg.slice('--schema='.length).trim();
    } else if (arg === '--schema') {
      schema = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }

  if (!ALLOWED_SCHEMAS.has(schema)) {
    throw new Error(`Schema "${schema}" tidak diizinkan. Hanya "dev" atau "staging" yang diterima (dilarang menyentuh "public").`);
  }

  return { schema, apply };
}

export async function migrateProductResearch({ schema = 'dev', apply = false } = {}) {
  if (!ALLOWED_SCHEMAS.has(schema)) {
    throw new Error(`Schema "${schema}" tidak diizinkan. Hanya "dev" atau "staging".`);
  }

  const env = loadAndValidateDbEnv({ requireDevSchema: false });
  const pool = new Pool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query(`SET search_path TO ${schema}, public`);

    const existingRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name IN ('product_research_batches', 'product_research_candidates', 'product_research_imports')
       ORDER BY table_name ASC`,
      [schema]
    );
    const existingTables = existingRes.rows.map(r => r.table_name);

    if (!apply) {
      return {
        mode: 'dry-run',
        schema,
        existingTables,
        tablesToEnsure: [
          'product_research_batches',
          'product_research_candidates',
          'product_research_imports'
        ],
        applied: false,
      };
    }

    await client.query('SELECT pg_advisory_lock(hashtext($1))', [ADVISORY_LOCK_KEY]);
    lockAcquired = true;

    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query(PRODUCT_RESEARCH_MIGRATION_SQL);
    await client.query('COMMIT');

    const verifiedRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name IN ('product_research_batches', 'product_research_candidates', 'product_research_imports')
       ORDER BY table_name ASC`,
      [schema]
    );

    return {
      mode: 'apply',
      schema,
      existingTables,
      verifiedTables: verifiedRes.rows.map(r => r.table_name),
      applied: true,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('migrate-product-research.mjs')) {
  try {
    const opts = parseMigrateArgs();
    console.log(`[migrate-product-research] Target schema: ${opts.schema} | Mode: ${opts.apply ? 'APPLY' : 'DRY-RUN'}`);
    const result = await migrateProductResearch(opts);
    console.log(JSON.stringify(result, null, 2));
    if (!opts.apply) {
      console.log('ℹ️  Dry-run selesai. Tambahkan --apply untuk mengeksekusi DDL.');
    } else {
      console.log(`✅ Migrasi Radar Produk berhasil diterapkan di schema "${opts.schema}".`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ [migrate-product-research] Gagal:', err.message);
    process.exit(1);
  }
}
