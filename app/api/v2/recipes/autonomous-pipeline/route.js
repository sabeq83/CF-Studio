import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../../lib/auth.js';
import { getDb } from '../../../../../lib/db.js';
import { pgQuery } from '../../../../../lib/db-pg.js';
import {
  executeAutonomousRecipePipeline,
  executeAutonomousProductPipeline,
  executeAutonomousEditorialPipeline,
  executeAutonomousMultiplierPipeline,
  executeAutonomousRecipeLabsPipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '../../../../../lib/autonomous-recipe-engine.js';
import { listOperatorPresetsForCampaignKind } from '../../../../../lib/operator-presets.js';
import { GRID_LAYOUT_COORDINATES } from '../../../../../lib/core/GridCoordinates.js';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presetKey = searchParams.get('preset_key') || searchParams.get('presetKey');
    const pipelineType = searchParams.get('pipeline_type') || searchParams.get('campaign_type') || 'recipe_campaign';
    const action = searchParams.get('action');
    const tenantId = user?.tenantId || 'default_tenant';

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

    const operatorPresets = listOperatorPresetsForCampaignKind(pipelineType, brandId, tenantId);
    const viPresets = await listVisualIdentityPresetsForBrand(brandId);
    const targetPresetKey = presetKey || operatorPresets[0]?.key || null;
    const defaultPreset = await resolveBrandRecipePreset(brandId, targetPresetKey, null, tenantId);

    let blueprints = [];
    if (pipelineType === 'multiplier_campaign' || searchParams.get('include_blueprints') === 'true') {
      try {
        const bpRes = await pgQuery(`
          SELECT id, source_url, original_caption, viral_pattern_summary, created_at
          FROM re_deconstructed_assets
          ORDER BY created_at DESC
          LIMIT 25
        `);
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

    let result;
    if (pipelineType === 'product_campaign') {
      result = await executeAutonomousProductPipeline({
        brandId: body.brand_id || body.brandId,
        productId: body.product_id || body.productId,
        productTitle: body.product_title || body.topic,
        presetKey: body.preset_key || body.presetKey || 'product_showcase_6clips',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: body.overrides || {}
      });
    } else if (pipelineType === 'editorial_campaign') {
      result = await executeAutonomousEditorialPipeline({
        brandId: body.brand_id || body.brandId,
        pillarTitle: body.content_pillar || body.pillar_title || body.topic,
        presetKey: body.preset_key || body.presetKey || 'editorial_tension_6clips',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: body.overrides || {}
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
        overrides: body.overrides || {}
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
        overrides: body.overrides || {}
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
        motionTextPosition: body.motion_text_position || body.motionTextPosition || 'bottom',
        videoTransition: body.video_transition || body.videoTransition || 'fade',
        transitionDuration: Number(body.transition_duration || body.transitionDuration || 0.5),
        overrides: body.overrides || {},
        tenantId
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

