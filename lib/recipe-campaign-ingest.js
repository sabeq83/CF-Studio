import { createPillarCampaignBundle, getDb } from './db.js';
import { generateCampaignId } from './id-generator.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { getActiveTenantId } from './tenant-context.js';
import { withPlannerConsumptionOwner } from './content-planner-consumption.js';

export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  globalSettings = {},
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
  const db = getDb();
  const tId = tenantId || getActiveTenantId();

  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new Error('Content Planner tidak ditemukan.');

  let rows = [];
  if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    const placeholders = selectedRowIds.map(() => '?').join(',');
    rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(plannerId, ...selectedRowIds);
  } else {
    rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada baris resep yang dapat di-ingest.');
  }

  const campaignId = generateCampaignId('opc');
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const defaultName = `[ Recipe OPC ${dateStr} ] - ${planner.account_name || 'Recipe'} - ${planner.title || 'Weekly Batch'}`;
  const name = campaignName || globalSettings.campaign_name || defaultName;

  return await withPlannerConsumptionOwner({
    plannerId,
    ownerType: 'recipe_campaign',
    ownerId: campaignId,
    tenantId: tId
  }, async ({ reused }) => {
    if (reused) {
      const existingCampaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE id = ?').get(campaignId);
      const existingItems = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
      return {
        success: true,
        campaign_id: campaignId,
        campaign_name: existingCampaign?.campaign_name || name,
        item_count: existingItems.length,
        ingested_count: existingItems.length,
        campaign: existingCampaign || { id: campaignId, campaign_name: name },
        items: existingItems.map(it => ({ id: it.id, sequence: it.sequence, title: it.custom_prompt_summary }))
      };
    }

    let identityResult = { ref: null, snapshot: null };
    try {
      const { resolveVisualIdentitySubmission } = await import('./visual-override-resolver.js');
      identityResult = await resolveVisualIdentitySubmission({
        preset_id: globalSettings.visual_identity_preset_id || null,
        inline_config: globalSettings.visual_identity_inline_config || null,
        legacy_overrides_json: globalSettings.visual_overrides_json || null
      });
    } catch (e) {
      console.warn('[Recipe Ingest VI Resolver Notice]:', e.message);
    }

    const isAutopilot = globalSettings.execution_mode === 'full_autopilot';

    const campaignData = {
      id: campaignId,
      name,
      campaign_name: name,
      account_name: planner.account_name || globalSettings.account_name || 'Recipe Channel',
      source_planner_id: planner.id,
      execution_mode: globalSettings.execution_mode || 'manual_review',
      content_pillar: 'Recipe Campaign',
      custom_hook: rows[0]?.hook || '',
      visual_action_guideline: rows[0]?.visual_action || '',
      custom_instruction: globalSettings.custom_instruction || planner.custom_instructions || '',
      ai_directive: globalSettings.ai_directive || planner.promotion_context || 'Konten edukasi resep & kreasi kuliner autentik.',
      mandatory_outro_line: globalSettings.mandatory_outro_line || '',
      brand_profile_id: planner.brand_id || globalSettings.brand_profile_id || null,
      target_spreadsheet_id: planner.google_sheet_id || null,
      total_items: rows.length,
      status: isAutopilot ? 'running' : (globalSettings.status || 'idle'),
      target_product_id: null, // Per-item binding used for recipes
      target_product_name: null,
      is_bridging_active: 0,
      narrative_mode: globalSettings.narrative_mode || 'Storytelling',
      visual_style: globalSettings.visual_style || 'photorealistic_culinary',
      aspect_ratio: globalSettings.aspect_ratio || '9:16',
      approval_mode: isAutopilot ? 'none' : (globalSettings.approval_mode || 'creative'),
      auto_sync_contentflow: globalSettings.auto_sync_contentflow !== undefined ? (globalSettings.auto_sync_contentflow ? 1 : 0) : 1,
      content_world: 'real_world',
      knowledge_domain: 'food_culinary',
      universe_profile: null,
      target_clips_count: globalSettings.target_clips_count ? Number(globalSettings.target_clips_count) : 8,
      clip_duration: globalSettings.clip_duration ? Number(globalSettings.clip_duration) : 4,
      target_ai: globalSettings.target_ai || 'Google Veo Omni Flash',
      video_model: globalSettings.video_model || 'omni_flash',
      visual_mode: globalSettings.visual_mode || 'hybrid_lock',
      visual_overrides_json: identityResult.snapshot ? JSON.stringify(identityResult.snapshot) : null,
      visual_identity_preset_id: identityResult.ref?.id || globalSettings.visual_identity_preset_id || null,
      visual_identity_preset_version: identityResult.ref?.version || null,
      voice_provider: globalSettings.voice_provider || 'minimax',
      voice_persona: globalSettings.voice_persona || 'English_causual_narrator_vv1',
      target_language: globalSettings.target_language || planner.target_language || 'en-US',
      voice_speed: globalSettings.voice_speed !== undefined ? Number(globalSettings.voice_speed) : 1.0,
      voice_volume: globalSettings.voice_volume !== undefined ? Number(globalSettings.voice_volume) : 1.0,
      words_per_clip: globalSettings.words_per_clip || '8-9 kata',
      enable_tts: globalSettings.enable_tts !== undefined ? (globalSettings.enable_tts ? 1 : 0) : 1,
      enable_glabs: globalSettings.enable_glabs !== undefined ? (globalSettings.enable_glabs ? 1 : 0) : 1,
      enable_ffmpeg: globalSettings.enable_ffmpeg !== undefined ? (globalSettings.enable_ffmpeg ? 1 : 0) : 1,
      enable_motion_text: globalSettings.enable_motion_text !== undefined ? (globalSettings.enable_motion_text ? 1 : 0) : 1,
      motion_text_style: globalSettings.motion_text_style || 'floating_white_yellow',
      motion_text_position: globalSettings.motion_text_position || 'bottom',
      video_transition: globalSettings.video_transition || 'fade',
      transition_duration: globalSettings.transition_duration !== undefined ? Number(globalSettings.transition_duration) : 0.5,
      enable_social_post: 0,
      upload_markdown: 1,
      upload_spreadsheet: 1,
      local_scheduler: globalSettings.local_scheduler !== undefined ? (globalSettings.local_scheduler ? 1 : 0) : 1,
      scheduler_pause_at: isAutopilot ? null : (globalSettings.scheduler_pause_at || null),
      ffmpeg_sync_option: globalSettings.ffmpeg_sync_option || 'smart_sync',
      tenant_id: tId
    };

  const items = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    let recipeIdea = {};
    try {
      recipeIdea = typeof row.recipe_idea_json === 'string'
        ? JSON.parse(row.recipe_idea_json || '{}')
        : (row.recipe_idea_json || {});
    } catch (e) {
      recipeIdea = {};
    }

    const itemId = `${campaignId}_item_${index + 1}`;
    const creativePayload = {
      sequence: row.sequence || (index + 1),
      planner_row_id: row.id,
      planner_id: planner.id,
      content_kind: 'recipe_campaign',
      recipe_revision: row.recipe_revision || 1,
      title: recipeIdea.title || row.title,
      category: recipeIdea.category || 'minuman',
      hook: recipeIdea.hook || row.hook,
      primary_product_id: recipeIdea.primary_product_id || row.product_id || null,
      primary_product_name: recipeIdea.primary_product_name || row.product || row.product_reference || null,
      product_role: recipeIdea.product_role || 'ingredient',
      featured_products: Array.isArray(recipeIdea.featured_products) ? recipeIdea.featured_products : [],
      integration_reason: recipeIdea.integration_reason || '',
      integration_step_hint: recipeIdea.integration_step_hint || '',
      visual_highlight: recipeIdea.visual_highlight || row.visual_action || '',
      estimated_servings: recipeIdea.estimated_servings || '1 Porsi',
      estimated_cooking_minutes: recipeIdea.estimated_cooking_minutes || 5,
      cta: recipeIdea.cta || row.cta || 'Cek link di bio!',
      target_audience: planner.target_audience || 'genz_casual',
      promotion_context: planner.promotion_context || '',
      custom_instructions: planner.custom_instructions || ''
    };

    items.push({
      id: itemId,
      campaign_id: campaignId,
      sequence: index + 1,
      generation_status: 'pending',
      start_frame_status: 'pending',
      target_prod_id: recipeIdea.primary_product_id || row.product_id || null,
      target_prod_name: recipeIdea.primary_product_name || row.product || row.product_reference || null,
      custom_prompt_summary: recipeIdea.title || row.title,
      row_creative_payload: JSON.stringify(creativePayload),
      content_kind: 'recipe_campaign',
      recipe_revision: row.recipe_revision || 1,
      tenant_id: tId
    });
  }

  // Pass single object bundle { campaign, items }
  await createPillarCampaignBundle({ campaign: campaignData, items });

  // Register per-item product bindings for campaign lineage
  try {
    const { createOrUpdateCampaignProductBinding } = await import('./campaign-product-binding.js');
    const { pgQuery } = await import('./db-pg.js');

    const insertedItems = (await pgQuery(
      'SELECT id, row_creative_payload FROM pillar_campaign_items WHERE campaign_id = $1 ORDER BY id ASC',
      [campaignId]
    )).rows;

    for (const item of (insertedItems || [])) {
      let payload = {};
      try { payload = JSON.parse(item.row_creative_payload || '{}'); } catch (_) {}

      const productList = Array.isArray(payload.featured_products) && payload.featured_products.length > 0
        ? Array.from(new Set(payload.featured_products.map(p => p.product_id).filter(Boolean)))
        : [payload.primary_product_id].filter(Boolean);

      for (const prodId of productList) {
        await createOrUpdateCampaignProductBinding({
          tenantId: tId,
          sourceType: 'opc',
          sourceCampaignId: campaignId,
          sourceItemId: item.id,
          brandProfileId: planner.brand_id || null,
          productId: prodId,
          explicitAffiliateOverride: null,
          affiliateRequired: false
        });
      }
    }
  } catch (bindErr) {
    console.warn('[Recipe Ingest Product Binding Notice]:', bindErr.message);
  }

  // Trigger scheduler background processing
  if (campaignData.local_scheduler) {
    try {
      startCampaignScheduler();
    } catch (err) {
      console.warn('[Recipe Ingest] startCampaignScheduler notice:', err.message);
    }
  }

    return {
      success: true,
      campaign_id: campaignId,
      campaign_name: name,
      item_count: items.length,
      ingested_count: items.length,
      campaign: {
        id: campaignId,
        campaign_name: name
      },
      items: items.map(it => ({ id: it.id, sequence: it.sequence, title: it.custom_prompt_summary }))
    };
  });
}
