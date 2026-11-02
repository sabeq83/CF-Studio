import { Pool } from 'pg';
import { resolveVisualIdentity } from '../lib/visual-override-resolver.js';

const pool = new Pool({
  host: process.env.PGHOST || '100.78.186.123',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'makna_user',
  password: process.env.PGPASSWORD || 'maknagridpass',
  database: process.env.PGDATABASE || 'maknaflow_db',
  max: 2,
});

async function run() {
  const targetCampaignId = 'opc_261102_nat6jl';
  const targetPresetId = 'vi_dapurbotani_apothecary_3d_female';
  const schema = process.env.PG_SEARCH_PATH || 'staging';

  console.log(`[Migrate] Running for campaign ${targetCampaignId} in schema: ${schema}`);
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${schema}, public;`);

    // 1. Resolve authoritative fresh snapshot
    const liveSnapshot = await resolveVisualIdentity({
      presetRef: targetPresetId,
      itemContext: { itemIndex: 0, stableSeed: `${targetCampaignId}:init` }
    });

    if (!liveSnapshot) {
      throw new Error(`Failed to resolve live snapshot for preset: ${targetPresetId}`);
    }

    console.log(`[Migrate] Resolved fresh snapshot for ${targetPresetId}:`, {
      version: liveSnapshot.identity_ref?.version,
      wardrobe: liveSnapshot.legacy?.wardrobe_style_custom
    });

    // 2. Update campaign snapshot
    const updateCampRes = await client.query(
      `UPDATE pillar_campaigns 
       SET visual_identity_preset_id = $1,
           visual_identity_preset_version = $2,
           visual_overrides_json = $3
       WHERE id = $4
       RETURNING id, visual_identity_preset_id, visual_identity_preset_version`,
      [
        targetPresetId,
        liveSnapshot.identity_ref?.version || 4,
        JSON.stringify(liveSnapshot),
        targetCampaignId
      ]
    );

    console.log(`[Migrate] Updated pillar_campaigns:`, updateCampRes.rows[0]);

    // 3. Update campaign items prompts
    const itemsRes = await client.query(
      `SELECT id, result_json, visual_status, start_frame_status 
       FROM pillar_campaign_items 
       WHERE campaign_id = $1 
       ORDER BY id ASC`,
      [targetCampaignId]
    );

    console.log(`[Migrate] Found ${itemsRes.rows.length} items to update.`);

    const targetWardrobeText = liveSnapshot.legacy?.wardrobe_style_custom ||
      'Strictly uniform single solid warm soft mocca modest loose-fitting linen sleeves fully covering wrists down to the hands (consistent identical soft mocca color across all scenes, strictly no color change), primary color soft_mocca';

    const newWardrobeTuple = `(Wardrobe: ${targetWardrobeText})`;

    for (const item of itemsRes.rows) {
      if (!item.result_json) continue;
      let resObj = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json;

      let modified = false;

      // Update t2i_prompts
      if (Array.isArray(resObj.t2i_prompts)) {
        resObj.t2i_prompts = resObj.t2i_prompts.map(pObj => {
          if (pObj && typeof pObj.prompt === 'string') {
            // Replace old wardrobe tag
            const oldPrompt = pObj.prompt;
            const updatedPrompt = oldPrompt.replace(
              /\(Wardrobe:[^)]+\)/gi,
              newWardrobeTuple
            );
            if (updatedPrompt !== oldPrompt) {
              modified = true;
              return { ...pObj, prompt: updatedPrompt };
            }
          }
          return pObj;
        });
      }

      // Update resolved_visual_overrides inside result_json if present
      if (resObj.resolved_visual_overrides) {
        resObj.resolved_visual_overrides = liveSnapshot;
        modified = true;
      }

      if (modified) {
        // Reset visual_status and start_frame_status so user/agent can regenerate fresh clean frames
        await client.query(
          `UPDATE pillar_campaign_items 
           SET result_json = $1,
               visual_status = 'pending',
               start_frame_status = 'pending',
               t2i_start_frame_path = NULL,
               t2i_images_json = NULL
           WHERE id = $2`,
          [JSON.stringify(resObj), item.id]
        );
        console.log(`[Migrate] Item ${item.id} prompt updated to Soft Mocca & reset to pending.`);
      }
    }

    console.log(`[Migrate] All items successfully migrated!`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Migrate] Error:', err);
  process.exit(1);
});
