import { Pool } from 'pg';

export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS auto_pipeline_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
  name TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  topic_strategy TEXT NOT NULL DEFAULT 'dynamic_ai',
  topic TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'makanan_utama',
  recipe_count INTEGER NOT NULL DEFAULT 1,
  generation_time TEXT NOT NULL DEFAULT '05:00',
  publish_time TEXT NOT NULL DEFAULT '09:00',
  days_of_week_json JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  repliz_account_ids_json JSONB NOT NULL DEFAULT '[]',
  auto_publish_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active',
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_campaign_id TEXT,
  last_publish_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS auto_pipeline_schedules_tenant_status_idx 
ON auto_pipeline_schedules(tenant_id, status);

CREATE INDEX IF NOT EXISTS auto_pipeline_schedules_brand_idx 
ON auto_pipeline_schedules(tenant_id, brand_id);
`;

export async function migrateAutoPipelineSchedules(targetSchema = 'dev') {
  const connectionConfig = {
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'maknaflow_db',
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    ssl: false,
    connectionTimeoutMillis: 10000
  };

  const pool = new Pool(connectionConfig);
  const client = await pool.connect();

  try {
    console.log(`📡 Connecting to PostgreSQL (Schema: ${targetSchema})...`);
    await client.query(`SET search_path TO ${targetSchema}, public`);

    await client.query(CREATE_TABLE_SQL);
    console.log(`✅ [Success] Table "auto_pipeline_schedules" created/verified in schema "${targetSchema}".`);

    // Tambahkan 1 jadwal default HabitFolk sebagai starter jika tabel masih kosong
    const tenantId = 'default_tenant';
    const countRes = await client.query('SELECT COUNT(*) as count FROM auto_pipeline_schedules WHERE tenant_id = $1', [tenantId]);
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      // Dapatkan brand profile HabitFolk
      const brandRes = await client.query("SELECT id FROM brand_profiles WHERE brand_name ILIKE '%habitfolk%' LIMIT 1");
      const brandId = brandRes.rows[0]?.id || '226f835a-1717-4c0f-b1ab-0b276130c839';

      // Dapatkan akun Repliz yang ada
      const accRes = await client.query("SELECT id FROM publishing_accounts WHERE tenant_id = $1 AND provider = 'repliz' LIMIT 4", [tenantId]);
      const replizAccountIds = accRes.rows.map(r => r.id);

      const insertSql = `
        INSERT INTO auto_pipeline_schedules (
          id, tenant_id, name, brand_id, preset_key, topic_strategy, topic,
          category, recipe_count, generation_time, publish_time, days_of_week_json,
          timezone, repliz_account_ids_json, auto_publish_enabled, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;

      await client.query(insertSql, [
        'apsched_habitfolk_daily_morning',
        tenantId,
        'HabitFolk — Daily Morning Snack & Reels',
        brandId,
        'habitfolk_6clips_quick',
        'dynamic_ai',
        'Air fryer crispy chicken tenders and snack finger foods',
        'camilan',
        1,
        '05:00',
        '09:00',
        JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
        'Asia/Jakarta',
        JSON.stringify(replizAccountIds),
        true,
        'active'
      ]);
      console.log(`✨ [Seeded] Default starter schedule "HabitFolk Daily Morning Snack" seeded in "${targetSchema}".`);
    }

    return true;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('migrate-auto-pipeline-schedules.mjs')) {
  const schemaArg = process.argv[2] || process.env.TARGET_SCHEMA || 'dev';
  migrateAutoPipelineSchedules(schemaArg)
    .then(() => {
      console.log(`✨ Migration finished successfully for ${schemaArg}.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration error:', err);
      process.exit(1);
    });
}

