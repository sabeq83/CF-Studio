import { getPgPool, closePgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { queueStartFrameRevision } from '../lib/pillar-start-frame-service.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

const CAMPAIGN_ID = 'opc_261103_8kz9ko';
const TARGET_ITEM_IDS = [2013, 2015, 2016, 2017, 2018];

async function main() {
  await tenantContext.run('default_tenant', async () => {
    const pool = getPgPool();
    console.log(`Connecting to Staging DB to queue start frames for campaign ${CAMPAIGN_ID}...`);

    const client = await pool.connect();
    try {
      // 1. Align start_frame_revision = 5 for items 2015..2018 so all become Revision 6
      await client.query(`
        UPDATE staging.pillar_campaign_items
        SET start_frame_revision = 5
        WHERE id = ANY($1::int[]) AND (start_frame_revision IS NULL OR start_frame_revision < 5)
      `, [[2015, 2016, 2017, 2018]]);

      console.log('✓ Revisions aligned to 5 so next revision is uniformly 6.');

      // 2. Fetch campaign
      const campRes = await client.query('SELECT * FROM staging.pillar_campaigns WHERE id = $1', [CAMPAIGN_ID]);
      if (campRes.rows.length === 0) throw new Error('Campaign not found');
      const campaign = campRes.rows[0];

      // 3. Process each targeted item
      for (const itemId of TARGET_ITEM_IDS) {
        console.log(`\n--- Queueing Start Frames for Item ${itemId} ---`);
        const itemRes = await client.query('SELECT * FROM staging.pillar_campaign_items WHERE id = $1', [itemId]);
        if (itemRes.rows.length === 0) throw new Error(`Item ${itemId} not found`);
        const item = itemRes.rows[0];

        const plan = typeof item.new_video_plan_json === 'string'
          ? JSON.parse(item.new_video_plan_json)
          : (item.new_video_plan_json || []);

        if (!plan.length) {
          console.warn(`Item ${itemId} has empty video plan!`);
          continue;
        }

        const clips = plan.map(clip => ({
          clip_index: Number(clip.clip_index),
          context: {
            campaignId: campaign.id,
            itemId: String(item.id),
            clipIndex: Number(clip.clip_index),
            prompt: clip.t2i_prompt,
            origin: 'bulk_regen'
          }
        }));

        for (const clip of clips) {
          await buildOpcStartFrameRequest({
            campaign,
            item,
            clipIndex: clip.context.clipIndex,
            prompt: clip.context.prompt,
            origin: 'bulk_regen_preflight'
          });
        }

        const queued = await queueStartFrameRevision(itemId, clips, {
          expectedCount: Number(campaign.target_clips_count || clips.length),
          carryForwardCompleted: false
        });

        console.log(`✓ Queued Item ${itemId} at revision ${queued.revision} (${queued.queued} clips).`);
      }

      console.log('\n🎉 Successfully queued Revision 6 for all targeted items (2013, 2015, 2016, 2017, 2018)!');
    } finally {
      client.release();
      await closePgPool();
    }
  });
}

main().catch(err => {
  console.error('❌ Error queueing start frames:', err);
  process.exit(1);
});
