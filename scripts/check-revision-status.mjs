import { getPgPool, closePgPool } from '../lib/db-pg.js';

const TARGET_ITEM_IDS = [2013, 2015, 2016, 2017, 2018];

async function main() {
  const pool = getPgPool();
  const res = await pool.query(`
    SELECT campaign_item_id, clip_index, revision, status, local_path, last_error_message, updated_at
    FROM staging.pillar_campaign_item_assets
    WHERE campaign_item_id = ANY($1::text[]) AND revision = 6
    ORDER BY campaign_item_id ASC, clip_index ASC
  `, [TARGET_ITEM_IDS.map(String)]);

  const summary = {};
  for (const row of res.rows) {
    if (!summary[row.campaign_item_id]) summary[row.campaign_item_id] = {};
    summary[row.campaign_item_id][row.clip_index] = {
      status: row.status,
      local_path: row.local_path,
      error: row.last_error_message
    };
  }

  console.log(JSON.stringify(summary, null, 2));

  const total = res.rows.length;
  const completed = res.rows.filter(r => r.status === 'completed').length;
  const processing = res.rows.filter(r => ['processing', 'provider_processing', 'waiting_lane'].includes(r.status)).length;
  const queued = res.rows.filter(r => r.status === 'queued').length;
  const failed = res.rows.filter(r => ['failed', 'terminal_failure'].includes(r.status)).length;

  console.log(`\nProgress: Total: ${total} | Completed: ${completed} | Processing: ${processing} | Queued: ${queued} | Failed: ${failed}`);
  await closePgPool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
