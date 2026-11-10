import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../../lib/auth.js';
import { getDb, getSetting } from '../../../../../lib/db.js';
import { pgQuery } from '../../../../../lib/db-pg.js';
import {
  executeAutonomousRecipePipeline,
  executeAutonomousProductPipeline,
  executeAutonomousEditorialPipeline,
  executeAutonomousMultiplierPipeline,
  executeAutonomousRecipeLabsPipeline,
  executeCustomStoryboardPipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '../../../../../lib/autonomous-engine.js';
import { listOperatorPresetsForCampaignKind, hydrateOperatorPresetCache } from '../../../../../lib/operator-presets.js';
import { GRID_LAYOUT_COORDINATES } from '../../../../../lib/core/GridCoordinates.js';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const rawBrandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presetKey = searchParams.get('preset_key') || searchParams.get('presetKey');
    const pipelineType = searchParams.get('pipeline_type') || searchParams.get('campaign_type') || 'recipe_campaign';
    const action = searchParams.get('action');
    const tenantId = user?.tenantId || 'default_tenant';

    // 1. Auto-Hydrate operator preset cache dari database tenant_settings
    try {
      let tenantPresets = getSetting('operator_presets_json', false);
      if (!tenantPresets) {
        const sRes = await pgQuery(
          'SELECT setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key = $2 LIMIT 1',
          [tenantId, 'operator_presets_json']
        );
        tenantPresets = sRes.rows[0]?.setting_value || '{}';
      }
      hydrateOperatorPresetCache(tenantId, tenantPresets);
    } catch (hErr) {
      console.warn('[Autonomous Pipeline GET] Preset cache hydration notice:', hErr.message);
    }

    // 2. Resolusi nama brand jika parameter berupa UUID
    let brandIdentifier = rawBrandId || '';
    if (rawBrandId) {
      try {
        const bpRes = await pgQuery(
          'SELECT brand_name FROM brand_profiles WHERE id = $1 OR brand_name = $1 LIMIT 1',
          [rawBrandId]
        );
        if (bpRes.rows[0]?.brand_name) {
          brandIdentifier = bpRes.rows[0].brand_name;
        }
      } catch (bpErr) {
        console.warn('[Autonomous Pipeline GET] Brand name resolution notice:', bpErr.message);
      }
    }

    // Sub-action: Preview dynamic angles untuk Multiplier Blueprint
    if (action === 'get_multiplier_angles') {
      const blueprintId = searchParams.get('blueprint_id') || searchParams.get('deconstruct_asset_id');
      const { generateDynamicMultiplierAngles } = await import('../../../../../lib/multiplier-angle-generator.js');
      const angles = await generateDynamicMultiplierAngles({
        blueprintId,
        angleCount: 3,
        tenantId
      });
      return NextResponse.json({ success: true, angles });
    }

    const operatorPresets = listOperatorPresetsForCampaignKind(pipelineType, brandIdentifier, tenantId);
    const viPresets = await listVisualIdentityPresetsForBrand(rawBrandId);
    const targetPresetKey = presetKey || operatorPresets[0]?.key || null;
    const defaultPreset = await resolveBrandRecipePreset(rawBrandId, targetPresetKey, null, tenantId);

    let blueprints = [];
    if (pipelineType === 'multiplier_campaign' || searchParams.get('include_blueprints') === 'true') {
      try {
        const bpSearch = searchParams.get('blueprint_search')?.trim();
        let bpSql = `
          SELECT id, source_url, original_caption, viral_pattern_summary, niche, core_problem, core_solution, tags, created_at
          FROM re_deconstructed_assets
        `;
        const bpParams = [];
        if (bpSearch) {
          bpSql += `
            WHERE (
              source_url ILIKE $1 
              OR id::text ILIKE $1 
              OR core_problem ILIKE $1 
              OR core_solution ILIKE $1 
              OR niche ILIKE $1 
              OR (tags IS NOT NULL AND tags::text ILIKE $1)
              OR viral_pattern_summary ILIKE $1
            )
          `;
          bpParams.push(`%${bpSearch}%`);
        }
        bpSql += ` ORDER BY created_at DESC LIMIT 200`;
        const bpRes = await pgQuery(bpSql, bpParams);
        blueprints = bpRes.rows || [];
      } catch (bpErr) {
        console.warn('[Autonomous Pipeline GET] blueprints fetch warning:', bpErr.message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      operator_presets: operatorPresets,
      presets: viPresets,
      vi_presets: viPresets, 
      default_preset: defaultPreset,
      blueprints: blueprints || [],
      grid_layouts: GRID_LAYOUT_COORDINATES
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const pipelineType = body.pipeline_type || 'recipe_campaign';
    const tenantId = user?.tenantId || 'default_tenant';

    // Sub-action: generate angles on the fly
    if (body.action === 'generate_multiplier_angles') {
      const { generateDynamicMultiplierAngles } = await import('../../../../../lib/multiplier-angle-generator.js');
      const angles = await generateDynamicMultiplierAngles({
        blueprintId: body.blueprint_id || body.deconstruct_asset_id,
        angleCount: 3,
        tenantId
      });
      return NextResponse.json({ success: true, angles });
    }

    const isEditorialOrLabs = pipelineType === 'editorial_campaign' || pipelineType === 'recipe_labs';
    const isAffiliateEnabled = body.post_link_affiliate !== undefined
      ? Boolean(body.post_link_affiliate)
      : (!isEditorialOrLabs);
    const isBridgingActive = body.is_bridging_active !== undefined
      ? Boolean(body.is_bridging_active)
      : (isEditorialOrLabs ? false : isAffiliateEnabled);

    const affiliateOverride = {
      post_link_affiliate: isAffiliateEnabled,
      is_affiliate_enabled: isAffiliateEnabled,
      is_bridging_active: isBridgingActive
    };

    const isRecipeEnabled = body.generate_recipe !== undefined
      ? Boolean(body.generate_recipe)
      : (body.generateRecipe !== undefined ? Boolean(body.generateRecipe) : undefined);
    const recipeOverride = isRecipeEnabled !== undefined ? { generate_recipe: isRecipeEnabled } : {};

    let result;
    if (pipelineType === 'custom_storyboard') {
      result = await executeCustomStoryboardPipeline({
        storyboard: body.storyboard || body,
        tenantId,
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot'
      });
    } else if (pipelineType === 'product_campaign') {
      result = await executeAutonomousProductPipeline({
        brandId: body.brand_id || body.brandId,
        productId: body.product_id || body.productId,
        productTitle: body.product_title || body.topic,
        promotionContext: body.promotion_context || body.promotionContext || body.topic_directive || null,
        selectedCep: body.selected_cep || body.selectedCep || null,
        presetKey: body.preset_key || body.presetKey || 'product_campaign',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          ...affiliateOverride,
          ...(body.overrides || {})
        }
      });
    } else if (pipelineType === 'editorial_campaign') {
      const isKeywordMode = body.use_brand_pillars === false || Boolean(body.keyword);
      result = await executeAutonomousEditorialPipeline({
        brandId: body.brand_id || body.brandId,
        pillarTitle: body.content_pillar || body.pillar_title || body.topic,
        keyword: body.keyword || (isKeywordMode ? (body.content_pillar || body.pillar_title || body.topic) : null),
        useBrandPillars: body.use_brand_pillars !== undefined ? Boolean(body.use_brand_pillars) : !isKeywordMode,
        presetKey: body.preset_key || body.presetKey || 'brand_editorial_campaign',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          use_brand_pillars: body.use_brand_pillars !== undefined ? Boolean(body.use_brand_pillars) : !isKeywordMode,
          keyword: body.keyword || (isKeywordMode ? (body.content_pillar || body.pillar_title || body.topic) : null),
          ...affiliateOverride,
          ...(body.overrides || {})
        }
      });
    } else if (pipelineType === 'multiplier_campaign') {
      result = await executeAutonomousMultiplierPipeline({
        brandId: body.brand_id || body.brandId,
        deconstructAssetId: body.deconstruct_asset_id || body.blueprint_id || body.deconstructAssetId,
        productId: body.product_id || body.productId,
        presetKey: body.preset_key || body.presetKey || 'multiplier_deconstruct_remix',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        selectedAngle: body.selected_angle || body.selectedAngle || null,
        tenantId,
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          enable_motion_text: body.enable_motion_text,
          motion_text_style: body.motion_text_style,
          video_transition: body.video_transition,
          transition_duration: body.transition_duration,
          ...affiliateOverride,
          ...recipeOverride,
          ...(body.overrides || {})
        }
      });
    } else if (pipelineType === 'threads_series') {
      const { executeAutonomousThreadsSeriesPipeline } = await import('../../../../../lib/threads-series-pipeline.js');
      result = await executeAutonomousThreadsSeriesPipeline({
        schedule: {
          id: `manual_${Date.now()}`,
          auto_publish_enabled: body.auto_publish !== false,
          repliz_account_ids: body.account_id ? [body.account_id] : []
        },
        pipelineConfig: {
          account_id: body.account_id,
          account_username: body.account_username,
          post_objective: body.post_objective || 'personal_product',
          personal_product_name: body.personal_product_name,
          personal_product_cta: body.personal_product_cta,
          affiliate_product_title: body.affiliate_product_title,
          affiliate_product_link: body.affiliate_product_link,
          pure_organic_topic: body.pure_organic_topic,
          visual_mode: body.visual_mode || 'glabs'
        },
        tenantId,
        targetPublishIso: body.publish_time || new Date(Date.now() + 10 * 60 * 1000).toISOString()
      });
    } else if (pipelineType === 'recipe_labs') {
      result = await executeAutonomousRecipeLabsPipeline({
        brandId: body.brand_id || body.brandId,
        category: body.category || 'Makanan',
        topic: body.topic || 'Resep Praktis Pilihan',
        visualStyle: body.visual_style || body.visualStyle || 'Food Porn',
        imagesPerRecipe: Number(body.images_per_recipe || body.imagesPerRecipe || 4),
        selectedLayoutId: body.selected_layout_id || body.selectedLayoutId || '4_editorial_split',
        gridGapSize: Number(body.grid_gap_size !== undefined ? body.grid_gap_size : 12),
        gridBorderRadius: Number(body.grid_border_radius !== undefined ? body.grid_border_radius : 16),
        gridOuterPadding: Number(body.grid_outer_padding !== undefined ? body.grid_outer_padding : 16),
        gridBgColor: body.grid_bg_color || body.gridBgColor || '#0d0d12',
        postToFacebook: body.post_to_facebook !== undefined ? Boolean(body.post_to_facebook) : true,
        tenantId,
        overrides: {
          ...affiliateOverride,
          ...(body.overrides || {})
        }
      });
    } else {
      const isMotionEnabled = body.enable_motion_text !== undefined 
        ? Boolean(body.enable_motion_text) 
        : (body.enableMotionText !== undefined ? Boolean(body.enableMotionText) : true);

      result = await executeAutonomousRecipePipeline({
        brandId: body.brand_id || body.brandId,
        presetKey: body.preset_key || body.presetKey || null,
        topic: body.topic,
        category: body.category || 'makanan_utama',
        recipeCount: body.recipe_count || body.recipeCount || 1,
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        visualIdentityPresetId: body.visual_identity_preset_id || body.visualIdentityPresetId || null,
        enableMotionText: isMotionEnabled,
        motionTextStyle: body.motion_text_style || body.motionTextStyle || 'floating_white_yellow',
        overrides: {
          ...affiliateOverride,
          ...recipeOverride,
          ...(body.overrides || {})
        },
        motionTextPosition: body.motion_text_position || body.motionTextPosition || 'bottom',
        videoTransition: body.video_transition || body.videoTransition || 'fade',
        transitionDuration: Number(body.transition_duration || body.transitionDuration || 0.5),
        tenantId
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

