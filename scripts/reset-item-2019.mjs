import { getPgPool, closePgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();

  console.log('Resetting item #2019 in staging.pillar_campaign_items...');
  const res = await pool.query(`
    UPDATE staging.pillar_campaign_items
    SET generation_status = 'pending',
        retry_count = 0
    WHERE id = 2019
    RETURNING id, campaign_id, generation_status, retry_count
  `);

  console.log('Updated item:', res.rows[0]);

  // Ensure campaign status is running
  await pool.query(`
    UPDATE staging.pillar_campaigns
    SET status = 'running'
    WHERE id = $1
  `, [res.rows[0].campaign_id]);

  console.log(`Campaign ${res.rows[0].campaign_id} status confirmed as 'running'.`);
  await closePgPool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

