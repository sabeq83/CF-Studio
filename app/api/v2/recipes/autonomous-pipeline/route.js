import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  executeAutonomousRecipePipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '@/lib/autonomous-recipe-engine';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presets = await listVisualIdentityPresetsForBrand(brandId);
    const defaultPreset = await resolveBrandRecipePreset(brandId);
    return NextResponse.json({ success: true, presets, default_preset: defaultPreset });
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
      overrides
    } = body;

    const isMotionEnabled = enable_motion_text !== undefined 
      ? Boolean(enable_motion_text) 
      : (enableMotionText !== undefined ? Boolean(enableMotionText) : true);

    const result = await executeAutonomousRecipePipeline({
      brandId: brand_id || brandId,
      topic,
      category: category || 'makanan_utama',
      recipeCount: recipe_count || recipeCount || 1,
      executionMode: execution_mode || executionMode || 'full_autopilot',
      visualIdentityPresetId: visual_identity_preset_id || visualIdentityPresetId || null,
      enableMotionText: isMotionEnabled,
      motionTextStyle: motion_text_style || motionTextStyle || 'floating_white_yellow',
      motionTextPosition: motion_text_position || motionTextPosition || 'bottom',
      overrides: overrides || {},
      tenantId: user?.tenantId || 'default_tenant'
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

