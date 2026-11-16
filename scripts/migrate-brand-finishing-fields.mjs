/**
 * scripts/migrate-brand-finishing-fields.mjs
 * Migrasi idempotent kolom finishing_skin dan default_finishing_template pada tabel brand_profiles.
 * Mendukung schema dev, staging, dan public.
 *
 * Pemakaian:
 *   node scripts/migrate-brand-finishing-fields.mjs [dev|staging|public]
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { getPgPool } from '../lib/db-pg.js';

const ALLOWED_SCHEMAS = new Set(['dev', 'staging', 'public']);

export const BRAND_PROFILES_FINISHING_DDL = `
  ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS finishing_skin TEXT NULL;
  ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS default_finishing_template TEXT NULL;
`;

export async function migrateBrandProfilesFinishing(targetSchema = 'dev') {
  if (!ALLOWED_SCHEMAS.has(targetSchema)) {
    throw new Error(`Invalid target schema "${targetSchema}". Allowed: dev, staging, public`);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);
    await client.query(`SELECT pg_advisory_lock(hashtext('makna_brand_profiles_finishing_v1'));`);
    await client.query(BRAND_PROFILES_FINISHING_DDL);
    console.log(`✅ [migrate-brand-finishing] Columns verified in brand_profiles on schema "${targetSchema}".`);
    return true;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('makna_brand_profiles_finishing_v1'));`).catch(() => {});
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate-brand-finishing-fields.mjs')) {
  const schemaArg = process.argv[2] || process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'dev';
  migrateBrandProfilesFinishing(schemaArg)
    .then(async () => {
      await getPgPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ [migrate-brand-finishing] Failed:', err.message);
      await getPgPool().end().catch(() => {});
      process.exit(1);
    });
}

