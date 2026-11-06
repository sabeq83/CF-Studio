import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../../lib/auth.js';
import {
  executeAutonomousRecipePipeline,
  executeAutonomousProductPipeline,
  executeAutonomousEditorialPipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '../../../../../lib/autonomous-recipe-engine.js';
import { listRecipeOperatorPresetsForBrand, listOperatorPresetsForCampaignKind } from '../../../../../lib/operator-presets.js';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presetKey = searchParams.get('preset_key') || searchParams.get('presetKey');
    const pipelineType = searchParams.get('pipeline_type') || searchParams.get('campaign_type') || 'recipe_campaign';
    const tenantId = user?.tenantId || 'default_tenant';

    const operatorPresets = listOperatorPresetsForCampaignKind(pipelineType, brandId, tenantId);
    const viPresets = await listVisualIdentityPresetsForBrand(brandId);
    const targetPresetKey = presetKey || operatorPresets[0]?.key || null;
    const defaultPreset = await resolveBrandRecipePreset(brandId, targetPresetKey, null, tenantId);

    return NextResponse.json({ 
      success: true, 
      operator_presets: operatorPresets,
      presets: viPresets,
      vi_presets: viPresets, 
      default_preset: defaultPreset 
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

