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

  console.log(`[Reconstruct] Running for campaign ${targetCampaignId} in schema: ${schema}`);
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${schema}, public;`);

    // 1. Resolve fresh authoritative snapshot
    const liveSnapshot = await resolveVisualIdentity({
      presetRef: targetPresetId,
      itemContext: { itemIndex: 0, stableSeed: `${targetCampaignId}:reconstruct` }
    });

    const targetAnchorText = liveSnapshot.subject_prompt || liveSnapshot.resolved?.subject_prompt || liveSnapshot.legacy?.subject_demographic_custom ||
      'POV close-up culinary framing focusing strictly on female forearms and hands covered in modest flowing sleeves down to the wrists (strictly no bare arms, strictly no rolled-up sleeves), featuring delicate female hands with smooth light Southeast Asian skin tone, slender fingers, and natural neat fingernails, hands actively manipulating ingredients and utensils on the tabletop workspace, camera tightly cropped from mid-forearm down to hands and tabletop';

    const targetWardrobeText = liveSnapshot.legacy?.wardrobe_style_custom ||
      'Strictly uniform single solid warm soft mocca modest loose-fitting linen sleeves fully covering wrists down to the hands (consistent identical soft mocca color across all scenes, strictly no color change), primary color soft_mocca';

    const targetLightingText = liveSnapshot.lighting_prompt || liveSnapshot.resolved?.lighting_prompt || liveSnapshot.legacy?.lighting_style_custom ||
      'illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights, Moody organic directional golden morning window light (3500K) with soft chiaroscuro shadows and warm amber reflections';

    // 2. Fetch items
    const itemsRes = await client.query(
      `SELECT id, row_creative_payload, result_json 
       FROM pillar_campaign_items 
       WHERE campaign_id = $1 
       ORDER BY id ASC`,
      [targetCampaignId]
    );

    console.log(`[Reconstruct] Processing ${itemsRes.rows.length} items...`);

    for (let i = 0; i < itemsRes.rows.length; i++) {
      const item = itemsRes.rows[i];
      if (!item.result_json) continue;

      let resObj = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json;
      const storyboard = resObj.storyboard || [];
      const t2iPrompts = resObj.t2i_prompts || [];

      // Reconstruct each clip prompt to be rich, exhaustive (1500+ chars), cinematic, with exact storyboard action
      const newT2iPrompts = t2iPrompts.map((pObj, idx) => {
        const clipNum = pObj.clip || (idx + 1);
        const sbEntry = storyboard.find(s => Number(s.clip || s.scene || s.clip_number) === Number(clipNum)) || storyboard[idx] || {};
        const sceneAction = sbEntry.visual_description || 'Faceless delicate female hands working on artisanal tabletop workspace';

        let reconstructedPrompt = '';

        if (clipNum === 3) {
          // Realm 2: 3D Bio-Cellular / Biomedical simulation
          reconstructedPrompt = `(VERTICAL 9:16) --ar 9:16 [STYLE: 3d_bio_cellular] [TEXTURE: dark_amber_glass_refraction, 3d_cellular_translucency] [LAYER 1: SCENE & METAPHOR] (Product Reference File: 'garlibee_clean_official.jpg', exact high-fidelity visual design match with attached reference photo) Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey in a squircle transparent glass jar with a premium ribbed silver-metal screw lid, filled with viscous dark golden-amber honey and micro-bubbles: solitary round marble-shaped single clove displaying a rich translucent caramelized amber-brown hue. [LAYER 2: SUBJECT & COMPOSITION] (Biometric Anchor: ${targetAnchorText}), (Wardrobe: ${targetWardrobeText}), (Action & Microscopic Truth: ${sceneAction}), (Composition: extreme macro scientific simulation, cellular cross-section framing, 8K scientific visualization). [LAYER 3: LIGHT & SHADOW] (Environment: Scientific 3D simulation void, dark charcoal background with bioluminescent organic glow), (Lighting: Directional volumetric biological rim lighting, 3500K warm accents, ${targetLightingText}).`;
        } else if (clipNum >= 4) {
          // Product Engagement Clips (Clips 4, 5, 6)
          reconstructedPrompt = `(VERTICAL 9:16) --ar 9:16 [STYLE: culinary_cinematic] [TEXTURE: rough_black_slate_stone, dark_amber_glass_refraction] [LAYER 1: SCENE & METAPHOR] (Product Reference File: 'garlibee_clean_official.jpg', exact high-fidelity visual design match with attached reference photo) Authentic naturally fermented GarliBee Solo Garlic in squircle glass jar with ribbed silver lid and matte black label. [LAYER 2: SUBJECT & COMPOSITION] (Biometric Anchor: ${targetAnchorText}), (Wardrobe: ${targetWardrobeText}), (Product Truth: solitary tender single clove fermented over 3 months in golden raw forest honey), (Action & Craft: ${sceneAction}), (Composition: cinematic macro product focus with shallow depth of field). [LAYER 3: LIGHT & SHADOW] (Environment: artisanal apothecary kitchen workspace on rough black slate stone), (Lighting: ${targetLightingText}).`;
        } else {
          // Opening Hook & Craft Clips (Clips 1, 2)
          reconstructedPrompt = `(VERTICAL 9:16) --ar 9:16 [STYLE: culinary_cinematic, artisanal kitchen interior] [TEXTURE: rough_black_slate_stone, herbal_dew_droplets] [LAYER 1: SCENE & METAPHOR] (Geometric Truth: strictly no product shown in opening scene) Artisanal botanical preparation setup with raw fresh botanicals and granite mortar. [LAYER 2: SUBJECT & COMPOSITION] (Biometric Anchor: ${targetAnchorText}), (Wardrobe: ${targetWardrobeText}), (Action & Craft: ${sceneAction}), (Composition: macro POV culinary action shot with shallow depth of field). [LAYER 3: LIGHT & SHADOW] (Environment: artisanal apothecary studio workbench), (Lighting: ${targetLightingText}).`;
        }

        return {
          clip: clipNum,
          prompt: reconstructedPrompt
        };
      });

      resObj.t2i_prompts = newT2iPrompts;
      resObj.resolved_visual_overrides = liveSnapshot;

      // Update new_video_plan_json if exists
      let newVideoPlan = [];
      try { newVideoPlan = JSON.parse(item.new_video_plan_json || '[]'); } catch(_) {}
      if (Array.isArray(newVideoPlan) && newVideoPlan.length > 0) {
        newVideoPlan = newVideoPlan.map((vp, idx) => {
          const matchT2i = newT2iPrompts.find(p => Number(p.clip) === Number(vp.clip_index || idx + 1));
          if (matchT2i) {
            return { ...vp, t2i_prompt: matchT2i.prompt };
          }
          return vp;
        });
      }

      await client.query(
        `UPDATE pillar_campaign_items 
         SET result_json = $1,
             new_video_plan_json = $2,
             visual_status = 'pending',
             start_frame_status = 'pending',
             t2i_start_frame_path = NULL,
             t2i_images_json = NULL
         WHERE id = $3`,
        [JSON.stringify(resObj), JSON.stringify(newVideoPlan), item.id]
      );

      console.log(`[Reconstruct] Item ${item.id} (Row ${i+1}) updated: ${newT2iPrompts.length} clips reconstructed (Length Clip 1: ${newT2iPrompts[0]?.prompt?.length} chars).`);
    }

    console.log(`[Reconstruct] All items for ${targetCampaignId} successfully restored!`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Reconstruct] Error:', err);
  process.exit(1);
});
