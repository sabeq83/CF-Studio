import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.PGHOST || '100.78.186.123',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'maknaflow_db',
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || ''
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  const campaignId = 'opc_261103_8kz9ko';

  // 1. Clean visual_overrides_json in staging.pillar_campaigns
  const campRes = await client.query('SELECT visual_overrides_json FROM staging.pillar_campaigns WHERE id = $1', [campaignId]);
  if (campRes.rows.length === 0) {
    console.error('Campaign not found!');
    process.exit(1);
  }

  let vo = campRes.rows[0].visual_overrides_json;
  if (typeof vo === 'string') {
    const oldStr = 'Faceless, strictly object-centric hydraulic cinematography. Clips 1 to 4 are 100% pure isolated glass conduits, fluid flows, and chemical reactions with zero human hands. Clips 5-6 feature subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.';
    const cleanStr = 'Faceless POV cinematography focusing on subtle hands with minimal charcoal cuffs, wrists covered, non-intrusive artisanal framing.';
    vo = vo.replaceAll(oldStr, cleanStr);
    await client.query('UPDATE staging.pillar_campaigns SET visual_overrides_json = $1 WHERE id = $2', [vo, campaignId]);
    console.log('Cleaned visual_overrides_json in staging.pillar_campaigns');
  }

  // 2. Clean items in staging.pillar_campaign_items
  const itemsRes = await client.query('SELECT id, new_video_plan_json, result_json FROM staging.pillar_campaign_items WHERE campaign_id = $1 ORDER BY id ASC', [campaignId]);
  for (const item of itemsRes.rows) {
    let plan = typeof item.new_video_plan_json === 'string' ? JSON.parse(item.new_video_plan_json) : (item.new_video_plan_json || []);
    let result = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : (item.result_json || {});

    let modified = false;
    for (const clip of plan) {
      const clipIdx = Number(clip.clip_index);
      if (clipIdx < 5) { // Pre-bridging clips (1 to 4)
        if (clip.t2i_prompt) {
          // Replace any leaked anchor with pure isolated object
          clip.t2i_prompt = clip.t2i_prompt.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)');
          clip.t2i_prompt = clip.t2i_prompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
          clip.t2i_prompt = clip.t2i_prompt.replace(/\bgarlibee\b/gi, 'natural botanical');
          clip.t2i_prompt = clip.t2i_prompt.replace(/\b(?:authentic\s+)?(?:garlibee\s+)?(?:product\s+)?(?:jar|bottle)\b/gi, 'glass conduit');
          clip.t2i_prompt = clip.t2i_prompt.replace(/\(Product Reference File:\s*['"][^'"]*['"][^)]*\)\.?/gi, '');
          clip.t2i_prompt = clip.t2i_prompt.replace(/\(Product Truth:\s*[^)]+\)\.?/gi, '(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)');
          modified = true;
        }
        clip.product_visible = false;
        clip.requires_product_reference = false;
      } else { // Product clips (5 and 6)
        clip.product_visible = true;
        clip.requires_product_reference = true;
      }
    }

    if (Array.isArray(result.t2i_prompts)) {
      result.t2i_prompts = plan.map(p => ({
        clip: p.clip_index,
        prompt: p.t2i_prompt
      }));
    }

    if (modified) {
      await client.query('UPDATE staging.pillar_campaign_items SET new_video_plan_json = $1, result_json = $2 WHERE id = $3', [
        JSON.stringify(plan),
        JSON.stringify(result),
        item.id
      ]);
      console.log(`Cleaned prompts for item ${item.id}`);
    }
  }

  await client.end();
  console.log('Cleanup completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

