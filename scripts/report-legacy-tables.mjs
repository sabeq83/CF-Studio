#!/usr/bin/env node
/**
 * Dry-run audit jumlah baris tabel legacy (Instant Factory, Sheets Autopilot, Pipeline Assets).
 * Hanya membaca (SELECT COUNT(*)), tidak pernah memodifikasi atau DROP TABLE.
 *
 * Pemakaian:
 *   node scripts/report-legacy-tables.mjs --schema dev|staging|public|all
 */

import pg from 'pg';

const LEGACY_TABLES = [
  'instant_campaigns',
  'instant_campaign_items',
  'instant_campaign_outputs',
  'instant_campaign_configs',
  'sheets_campaigns',
  'sheets_jobs',
  'pipeline_assets'
];

function parseArgs(argv) {
  let schema = 'staging';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      schema = argv[i + 1].trim().toLowerCase();
      i++;
    } else if (argv[i].startsWith('--schema=')) {
      schema = argv[i].split('=')[1].trim().toLowerCase();
    }
  }
  const allowed = ['dev', 'staging', 'public', 'all'];
  if (!allowed.includes(schema)) {
    throw new Error(`Schema '${schema}' tidak valid. Pilih: ${allowed.join(' | ')}`);
  }
  return schema === 'all' ? ['dev', 'staging', 'public'] : [schema];
}

async function main() {
  const schemas = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
    max: 2
  });

  const client = await pool.connect();
  try {
    console.log('📊 DRY-RUN LAPORAN TABEL LEGACY (READ-ONLY — TIDAK ADA DROP/DELETE)');
    for (const schema of schemas) {
      console.log(`\n=== Schema: ${schema} ===`);
      let totalRows = 0;
      for (const table of LEGACY_TABLES) {
        try {
          const existsRes = await client.query(
            `SELECT to_regclass($1) IS NOT NULL AS exists`,
            [`${schema}.${table}`]
          );
          if (!existsRes.rows[0]?.exists) {
            console.log(`  - ${table.padEnd(28)}: (tabel tidak ada)`);
            continue;
          }
          const countRes = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${schema}.${table}`);
          const cnt = countRes.rows[0]?.cnt ?? 0;
          totalRows += cnt;
          console.log(`  - ${table.padEnd(28)}: ${cnt} baris`);
        } catch (err) {
          console.log(`  - ${table.padEnd(28)}: ERROR (${err.message})`);
        }
      }
      console.log(`  Total baris di schema '${schema}': ${totalRows}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Gagal menjalankan audit tabel legacy:', err.message);
  process.exit(1);
});
