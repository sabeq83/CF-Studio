import { NextResponse } from 'next/server';
import { executeWithKeyPool, generateContentFlexible } from '@/lib/gemini';
import { getTtsBatchWithClips } from '@/lib/db';
import {
  buildFinishingPlanPromptJson,
  FINISHING_PLAN_PROMPT_APPENDIX,
  validateFinishingPlan
} from '@/lib/finishing-plan-validator';
import {
  FINISHING_TEMPLATE_IDS,
  hasStrictTemplateCompliance
} from '@/lib/finishing-template-registry';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      templateId,
      batchId,
      voTexts = [],
      productData = null,
      recipeData = null,
      isHerbalProduct = true
    } = body;

    const resolvedTemplate = String(templateId || 'none').trim().toLowerCase();
    if (!FINISHING_TEMPLATE_IDS.includes(resolvedTemplate)) {
      return NextResponse.json({
        success: false,
        error: `Template finishing '${resolvedTemplate}' tidak dikenal. Pilih salah satu dari: ${FINISHING_TEMPLATE_IDS.join(', ')}`
      }, { status: 400 });
    }

    if (resolvedTemplate === 'none') {
      return NextResponse.json({
        success: true,
        plan: { hook: '', punches: [] },
        warnings: [],
        errors: []
      });
    }

    let finalVoTexts = Array.isArray(voTexts) ? voTexts.filter(Boolean) : [];
    if (finalVoTexts.length === 0 && batchId) {
      const batchData = await getTtsBatchWithClips(batchId);
      if (batchData && batchData.clips) {
        finalVoTexts = batchData.clips
          .filter(c => c.status === 'completed')
          .map(c => c.source_text || '')
          .filter(Boolean);
      }
    }

    const tplJsonFormat = buildFinishingPlanPromptJson(resolvedTemplate, '  ');
    const isStrict = hasStrictTemplateCompliance(resolvedTemplate);

    const prompt = `Anda adalah AI Creative Video Finishing Director.
Tugas Anda: menyusun struktur "finishing_plan" JSON yang presisi, engaging, dan strictly compliant untuk video TikTok / Reels dengan template "${resolvedTemplate}".

${FINISHING_PLAN_PROMPT_APPENDIX}

PANDUAN SCHEMA JSON UNTUK TEMPLATE "${resolvedTemplate}":
{
${tplJsonFormat}
}

ATURAN KEPATUHAN & INTEGRITAS (WAJIB DIIKUTI):
1. "hook": Teks hook card singkat frame awal <= 34 karakter total (maks 2 baris). ${isStrict || isHerbalProduct ? 'DILARANG KERAS membuat klaim medis herbal seperti menyembuhkan, mengobati, menurunkan gula darah/kolesterol/asam urat/kanker, detoks, dsb.' : ''}
2. "punches": Maksimal 2 frasa kunci per klip. Setiap "phrase" WAJIB berupa kata-kata PERSIS (substring asli) yang ada di naskah Voiceover klip tersebut. Dilarang mengarang kata baru.
3. Layer-layer spesifik template (tips, chapters, timing_badges, callouts, compare, chips, numbers):
   - Wajib grounded pada teks Voiceover yang tersedia.
   - Jika template membutuhkan data tetapi teks Voiceover tidak memuatnya, kosongkan array [] atau isi hanya yang benar-benar didukung naskah.
4. Output WAJIB berupa JSON murni tanpa markdown pembungkus (tanpa \`\`\`json).

NASKAH VOICEOVER PER KLIP:
${finalVoTexts.length > 0
  ? finalVoTexts.map((text, idx) => `[Klip #${idx}] (clip_index: ${idx}): "${text}"`).join('\n')
  : '(Tidak ada naskah VO spesifik, buat hook dan struktur umum yang relevan)'}

DATA PRODUK / BRAND:
${JSON.stringify(productData || {}, null, 2)}

DATA RESEP (JIKA ADA):
${JSON.stringify(recipeData || {}, null, 2)}
`;

    // Execute with Tenant Key Pool
    const responseText = await executeWithKeyPool(1, async (apiKey) => {
      return await generateContentFlexible({
        prompt,
        apiKey,
        systemInstruction: 'Anda adalah generator JSON finishing video profesional. Balas HANYA dengan JSON valid objek finishing_plan.'
      });
    });

    let generatedPlan = null;
    try {
      const cleanJson = responseText
        .replace(/^```json/im, '')
        .replace(/^```/im, '')
        .replace(/```$/im, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      generatedPlan = parsed.finishing_plan || parsed;
    } catch (parseErr) {
      console.warn('[Finishing Plan Generate API] Gagal parse JSON langsung:', parseErr.message, responseText);
      generatedPlan = {
        hook: productData?.name ? `Rahasia ${productData.name}` : 'Tips Penting Hari Ini',
        punches: []
      };
    }

    // Run validator immediately
    const cleanVoiceoverClips = finalVoTexts.map(t => ({ text: t }));
    const recipeTexts = [
      ...((recipeData?.ingredients?.items || []).map(it => (typeof it === 'string' ? it : it?.label || ''))),
      ...((Array.isArray(recipeData?.steps) ? recipeData.steps : []).map(st => (typeof st === 'string' ? st : st?.label || '')))
    ].filter(Boolean);

    const validation = validateFinishingPlan(generatedPlan, {
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
      plan: generatedPlan,
      warnings: planWarnings,
      errors: planErrors,
      valid: planErrors.length === 0
    });

  } catch (error) {
    console.error('[Video Studio Finishing Plan Generate API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
