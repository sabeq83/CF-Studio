import { Pool } from 'pg';

export async function migrateStagingProviderConstraint(schemas = ['dev', 'staging', 'public']) {
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
    for (const schema of schemas) {
      console.log(`📡 Connecting to PostgreSQL (Schema: ${schema})...`);
      await client.query(`SET search_path TO ${schema}, public`);

      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'publishing_media_staging'
        );
      `, [schema]);

      if (!tableCheck.rows[0].exists) {
        console.log(`ℹ️ [Skip] Table publishing_media_staging does not exist in schema "${schema}".`);
        continue;
      }

      await client.query(`
        ALTER TABLE publishing_media_staging 
        DROP CONSTRAINT IF EXISTS publishing_media_staging_provider_check;

        ALTER TABLE publishing_media_staging 
        ADD CONSTRAINT publishing_media_staging_provider_check 
        CHECK (provider IN ('google_drive', 'cloudflare_r2'));
      `);

      console.log(`✅ [Success] Constraint publishing_media_staging_provider_check updated in schema "${schema}".`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetSchemaArg = process.argv[2] ? [process.argv[2]] : ['dev', 'staging', 'public'];
  migrateStagingProviderConstraint(targetSchemaArg)
    .then(() => {
      console.log('🚀 Migration script completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Fatal migration error:', err);
      process.exit(1);
    });
}

