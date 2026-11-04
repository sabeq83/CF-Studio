import { getPgPool, closePgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  const res = await pool.query(`
    SELECT i.id, i.campaign_id, i.generation_status, i.retry_count, i.workflow_status,
           i.new_video_plan_json IS NOT NULL as has_video_plan,
           c.campaign_name, c.status as campaign_status
    FROM staging.pillar_campaign_items i
    JOIN staging.pillar_campaigns c ON c.id = i.campaign_id
    WHERE i.id = 2019
  `);

  console.log('Item 2019 status:', JSON.stringify(res.rows[0], null, 2));

  if (res.rows[0]?.has_video_plan) {
    const planRes = await pool.query(`SELECT new_video_plan_json FROM staging.pillar_campaign_items WHERE id = 2019`);
    try {
      const plan = JSON.parse(planRes.rows[0].new_video_plan_json);
      console.log(`Clips in plan: ${plan?.length || 0}`);
      if (Array.isArray(plan)) {
        plan.forEach((clip, idx) => {
          console.log(`Clip #${idx + 1} (${clip.scene}):`);
          console.log(`  VO: ${clip.narration || clip.new_vo || ''}`);
          console.log(`  T2I: ${(clip.t2i_prompt || '').substring(0, 100)}...`);
        });
      }
    } catch (_) {}
  }

  await closePgPool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

