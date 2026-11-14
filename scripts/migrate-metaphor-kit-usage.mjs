/**
 * scripts/migrate-metaphor-kit-usage.mjs
 * Migrasi idempotent tabel metaphor_kit_usage untuk schema target (dev / staging).
 * Memakai PG_SEARCH_PATH / parameter CLI tanpa hardcoded credential.
 *
 * Pemakaian:
 *   PG_SEARCH_PATH=staging node scripts/migrate-metaphor-kit-usage.mjs staging
 */
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { getPgPool } from '../lib/db-pg.js';
import { METAPHOR_KIT_USAGE_DDL } from '../lib/metaphor-kit-usage-repository.js';

const ALLOWED_SCHEMAS = new Set(['dev', 'staging', 'public']);

export async function migrateMetaphorKitUsageSchema(targetSchema = 'dev') {
  if (!ALLOWED_SCHEMAS.has(targetSchema)) {
    throw new Error(`Invalid target schema "${targetSchema}". Allowed: dev, staging, public`);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);
    await client.query(`SELECT pg_advisory_lock(hashtext('makna_metaphor_kit_usage_v1'));`);
    await client.query(METAPHOR_KIT_USAGE_DDL);
    console.log(`✅ [migrate-metaphor-kit-usage] Table "metaphor_kit_usage" verified in schema "${targetSchema}".`);
    return true;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('makna_metaphor_kit_usage_v1'));`).catch(() => {});
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate-metaphor-kit-usage.mjs')) {
  const schemaArg = process.argv[2] || process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'dev';
  migrateMetaphorKitUsageSchema(schemaArg)
    .then(async () => {
      await getPgPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ [migrate-metaphor-kit-usage] Failed:', err.message);
      await getPgPool().end().catch(() => {});
      process.exit(1);
    });
}

