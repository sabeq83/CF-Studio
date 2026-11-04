import { getPgPool, closePgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  const res = await pool.query(`
    SELECT i.id, i.campaign_id, i.hook, i.generation_status, i.retry_count, i.last_error_message,
           c.campaign_name, c.status as campaign_status, c.bridge_at_clip, c.visual_style
    FROM staging.pillar_campaign_items i
    JOIN staging.pillar_campaigns c ON c.id = i.campaign_id
    WHERE i.id = 2019
  `);

  if (res.rows.length === 0) {
    console.log('Item 2019 not found in staging.pillar_campaign_items');
  } else {
    console.log('Item 2019 status:', JSON.stringify(res.rows[0], null, 2));
  }

  await closePgPool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
