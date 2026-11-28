import crypto from 'node:crypto';
import { getPgPool } from '../../lib/db-pg.js';

const SOURCE_TENANT = 'tnt_sy-dodot_4ba27b';
const TARGET_TENANT = 'default_tenant';

const DATA_COLUMNS = [
  'source_url',
  'source_domain',
  'author',
  'original_title',
  'polished_title',
  'original_summary',
  'polished_summary',
  'ingredients_raw',
  'original_instructions',
  'polished_instructions',
  'prep_time',
  'cook_time',
  'total_time',
  'servings',
  'category',
  'cuisine',
  'original_image_url',
  'ai_photo_prompts',
  'status',
  'polish_status',
  'polish_error',
  'batch_id'
];

function makeDeterministicCopyId(sourceId) {
  const hash = crypto.createHash('sha256').update(`copy:${SOURCE_TENANT}->${TARGET_TENANT}:${sourceId}`).digest('hex').slice(0, 12);
  return `rcp_def_${hash}`;
}

async function copyIntoSchema(client, schema, sourceRows, apply) {
  const existingRes = await client.query(
    `SELECT id, source_url FROM ${schema}.curated_recipes WHERE tenant_id = $1`,
    [TARGET_TENANT]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const existingUrls = new Set(existingRes.rows.map(r => String(r.source_url || '').trim()).filter(Boolean));

  let wouldInsert = 0;
  let skipped = 0;
  const insertedSamples = [];

  for (const row of sourceRows) {
    const newId = makeDeterministicCopyId(row.id);
    const urlKey = String(row.source_url || '').trim();
    if (existingIds.has(newId) || (urlKey && existingUrls.has(urlKey))) {
      skipped++;
      continue;
    }
    wouldInsert++;
    if (insertedSamples.length < 5) {
      insertedSamples.push({ id: newId, title: row.polished_title || row.original_title, source_url: row.source_url });
    }

    if (apply) {
      const colList = ['id', 'tenant_id', ...DATA_COLUMNS, 'used_in_campaign_count', 'created_at', 'updated_at'];
      const placeholders = [];
      const values = [newId, TARGET_TENANT];
      for (const col of DATA_COLUMNS) {
        values.push(row[col] ?? null);
      }
      values.push(0); // used_in_campaign_count reset for target tenant

      for (let i = 1; i <= values.length; i++) {
        placeholders.push(`$${i}`);
      }
      placeholders.push('CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP');

      await client.query(
        `INSERT INTO ${schema}.curated_recipes (${colList.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      );
    }
  }

  return {
    schema,
    beforeCount: existingRes.rows.length,
    inserted: wouldInsert,
    skipped,
    samples: insertedSamples
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const srcRes = await client.query(
      `SELECT * FROM staging.curated_recipes WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [SOURCE_TENANT]
    );
    const sourceRows = srcRes.rows || [];
    console.log(`[Source] staging.curated_recipes (${SOURCE_TENANT}): ${sourceRows.length} rows`);

    if (sourceRows.length === 0) {
      throw new Error(`No rows found in staging.curated_recipes for ${SOURCE_TENANT}`);
    }

    if (apply) {
      await client.query('BEGIN');
    }

    const stagingSummary = await copyIntoSchema(client, 'staging', sourceRows, apply);
    const devSummary = await copyIntoSchema(client, 'dev', sourceRows, apply);

    if (apply) {
      await client.query('COMMIT');
    }

    const afterStaging = await client.query(
      `SELECT tenant_id, COUNT(*)::int AS cnt FROM staging.curated_recipes WHERE tenant_id IN ($1, $2) GROUP BY tenant_id ORDER BY tenant_id`,
      [SOURCE_TENANT, TARGET_TENANT]
    );
    const afterDev = await client.query(
      `SELECT tenant_id, COUNT(*)::int AS cnt FROM dev.curated_recipes WHERE tenant_id = $1 GROUP BY tenant_id`,
      [TARGET_TENANT]
    );

    console.log(JSON.stringify({
      mode: apply ? 'APPLY_COMMITTED' : 'DRY_RUN',
      stagingSummary,
      devSummary,
      postCheck: {
        staging: afterStaging.rows,
        dev: afterDev.rows
      }
    }, null, 2));
  } catch (err) {
    if (apply) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Copy Error]', err);
  process.exit(1);
});
