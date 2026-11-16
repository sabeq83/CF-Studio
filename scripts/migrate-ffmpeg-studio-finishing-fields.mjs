/**
 * scripts/migrate-ffmpeg-studio-finishing-fields.mjs
 * Migrasi idempotent kolom finishing pada tabel ffmpeg_studio_jobs.
 * Mendukung schema dev, staging, dan public (public hanya jika eksplisit diminta).
 *
 * Pemakaian:
 *   node scripts/migrate-ffmpeg-studio-finishing-fields.mjs [dev|staging|public]
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { getPgPool } from '../lib/db-pg.js';

const ALLOWED_SCHEMAS = new Set(['dev', 'staging', 'public']);

export const FFMPEG_STUDIO_FINISHING_DDL = `
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_template TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_config TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS progress_stage TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_status TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS audio_mode TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS yield_count INTEGER NOT NULL DEFAULT 0;
`;

export async function migrateFfmpegStudioFinishing(targetSchema = 'dev') {
  if (!ALLOWED_SCHEMAS.has(targetSchema)) {
    throw new Error(`Invalid target schema "${targetSchema}". Allowed: dev, staging, public`);
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);
    await client.query(`SELECT pg_advisory_lock(hashtext('makna_ffmpeg_studio_finishing_v1'));`);
    await client.query(FFMPEG_STUDIO_FINISHING_DDL);
    console.log(`✅ [migrate-ffmpeg-studio-finishing] Columns verified in ffmpeg_studio_jobs on schema "${targetSchema}".`);
    return true;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('makna_ffmpeg_studio_finishing_v1'));`).catch(() => {});
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate-ffmpeg-studio-finishing-fields.mjs')) {
  const schemaArg = process.argv[2] || process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'dev';
  migrateFfmpegStudioFinishing(schemaArg)
    .then(async () => {
      await getPgPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ [migrate-ffmpeg-studio-finishing] Failed:', err.message);
      await getPgPool().end().catch(() => {});
      process.exit(1);
    });
}
