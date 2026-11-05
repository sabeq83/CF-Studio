import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  executeAutonomousRecipePipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '@/lib/autonomous-recipe-engine';
import { listRecipeOperatorPresetsForBrand } from '@/lib/operator-presets';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presetKey = searchParams.get('preset_key') || searchParams.get('presetKey');
    const tenantId = user?.tenantId || 'default_tenant';

    const operatorPresets = listRecipeOperatorPresetsForBrand(brandId, tenantId);
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
    const {
      brand_id,
      brandId,
      preset_key,
      presetKey,
      topic,
      category,
      recipe_count,
      recipeCount,
      execution_mode,
      executionMode,
      visual_identity_preset_id,
      visualIdentityPresetId,
      enable_motion_text,
      enableMotionText,
      motion_text_style,
      motionTextStyle,
      motion_text_position,
      motionTextPosition,
      video_transition,
      videoTransition,
      transition_duration,
      transitionDuration,
      overrides
    } = body;

    const isMotionEnabled = enable_motion_text !== undefined 
      ? Boolean(enable_motion_text) 
      : (enableMotionText !== undefined ? Boolean(enableMotionText) : true);

    const result = await executeAutonomousRecipePipeline({
      brandId: brand_id || brandId,
      presetKey: preset_key || presetKey || null,
      topic,
      category: category || 'makanan_utama',
      recipeCount: recipe_count || recipeCount || 1,
      executionMode: execution_mode || executionMode || 'full_autopilot',
      visualIdentityPresetId: visual_identity_preset_id || visualIdentityPresetId || null,
      enableMotionText: isMotionEnabled,
      motionTextStyle: motion_text_style || motionTextStyle || 'floating_white_yellow',
      motionTextPosition: motion_text_position || motionTextPosition || 'bottom',
      videoTransition: video_transition || videoTransition || 'fade',
      transitionDuration: Number(transition_duration || transitionDuration || 0.5),
      overrides: overrides || {},
      tenantId: user?.tenantId || 'default_tenant'
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

