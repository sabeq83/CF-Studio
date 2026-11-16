import { NextResponse } from 'next/server';
import { validateFinishingPlan } from '@/lib/finishing-plan-validator';
import {
  FINISHING_TEMPLATE_IDS,
  hasStrictTemplateCompliance
} from '@/lib/finishing-template-registry';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      templateId,
      plan,
      cleanVoiceoverClips = [],
      isHerbalProduct = true,
      productData = null,
      recipeTexts = []
    } = body;

    const resolvedTemplate = String(templateId || 'none').trim().toLowerCase();
    if (!FINISHING_TEMPLATE_IDS.includes(resolvedTemplate)) {
      return NextResponse.json({
        success: false,
        error: `Template finishing '${resolvedTemplate}' tidak dikenal.`
      }, { status: 400 });
    }

    if (resolvedTemplate === 'none') {
      return NextResponse.json({
        success: true,
        valid: true,
        warnings: [],
        errors: []
      });
    }

    if (!plan || typeof plan !== 'object') {
      return NextResponse.json({
        success: false,
        valid: false,
        errors: ['Plan finishing wajib berupa objek JSON.'],
        warnings: []
      }, { status: 400 });
    }

    const isStrict = hasStrictTemplateCompliance(resolvedTemplate);
    const validation = validateFinishingPlan(plan, {
      cleanVoiceoverClips,
      isHerbalProduct,
      finishingTemplate: resolvedTemplate,
      strictClaims: isStrict,
      recipeTexts,
      productData
    });

    const planWarnings = validation.warnings || [];
    const planErrors = planWarnings.filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));

    return NextResponse.json({
      success: true,
      valid: planErrors.length === 0,
      warnings: planWarnings,
      errors: planErrors
    });

  } catch (error) {
    console.error('[Video Studio Finishing Plan Validate API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
