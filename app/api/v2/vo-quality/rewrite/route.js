import { NextResponse } from 'next/server';
import { getDb, updateMultiplierTask, updatePillarCampaignItem } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { executeWithKeyPool, generateContentFlexible } from '@/lib/gemini';
import { resolveIsHerbalOrHealthTarget } from '@/lib/tiktok-compliance-service';
import { extractClipVoText, rewriteVoWithQualityFeedback, validateVoQuality } from '@/lib/vo-quality-validator';

function safeParse(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const tenantId = user?.tenantId || 'default_tenant';
    const body = await request.json();
    const targetType = body.target_type || body.targetType || 'pillar_item';
    const id = body.id;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Field id wajib diisi.' }, { status: 400 });
    }

    const db = getDb();

    if (targetType === 'multiplier_task') {
      const task = await db.prepare('SELECT * FROM re_multiplier_tasks WHERE id = ? AND tenant_id = ?').get(id, tenantId);
      if (!task) {
        return NextResponse.json({ success: false, error: 'Task Multiplier tidak ditemukan.' }, { status: 404 });
      }

      const storyboard = safeParse(task.remake_storyboard_json, []);
      if (!Array.isArray(storyboard) || storyboard.length === 0) {
        return NextResponse.json({ success: false, error: 'Storyboard Multiplier kosong.' }, { status: 400 });
      }
      const audioCfg = safeParse(task.audio_config_json, {});
      const vsoCfg = safeParse(task.vso_config_json, {});
      const bridging = safeParse(task.bridging_config_json, {});
      const prodSnap = safeParse(task.product_snapshot_json, {});
      const isHerbalOrHealth = resolveIsHerbalOrHealthTarget({
        productName: prodSnap?.product_name || '',
        niche: bridging?.angleTitle || '',
        brandName: task.account_name || ''
      });

      const voLines = storyboard.map(extractClipVoText);
      const valOpts = {
        sourceRecipeLock: bridging?.source_recipe_lock || null,
        isHerbalOrHealth,
        targetLanguage: audioCfg?.targetLanguage || 'id-ID',
        wordsPerClip: vsoCfg?.wordsPerClip || vsoCfg?.words_per_clip || '17-19 kata',
        clipDuration: Number(vsoCfg?.clipDuration || vsoCfg?.clip_duration || 8),
        mandatoryOutroLine: vsoCfg?.mandatoryOutroLine || '',
        finishingPlan: bridging?.finishing_plan || null,
        expectedClipsCount: storyboard.length
      };

      const preValidation = validateVoQuality({ clips: voLines, ...valOpts });
      const rw = await rewriteVoWithQualityFeedback({
        voLines,
        validation: preValidation,
        targetLanguage: valOpts.targetLanguage,
        wordsPerClip: valOpts.wordsPerClip,
        sourceRecipeLock: valOpts.sourceRecipeLock,
        generateFn: async (rwPrompt) => executeWithKeyPool(1, async (apiKey) => {
          return await generateContentFlexible({ prompt: rwPrompt, taskType: 'MULTIPLIER_REMAKE', timeoutMs: 90000, apiKey });
        })
      });

      const finalLines = rw.applied ? rw.voLines : voLines;
      const postValidation = validateVoQuality({ clips: finalLines, ...valOpts });
      const updatedStoryboard = storyboard.map((s, idx) => ({
        ...s,
        narration_transcript: finalLines[idx],
        voiceover: finalLines[idx],
        voice_over: finalLines[idx],
        narration: finalLines[idx],
        tiktok_safe_vo: finalLines[idx]
      }));

      const newStatus = postValidation.passed ? 'pass_after_rewrite' : 'blocked';
      await updateMultiplierTask(task.id, {
        remake_storyboard_json: JSON.stringify(updatedStoryboard),
        tiktok_safe_voiceover: JSON.stringify(updatedStoryboard),
        vo_quality_score_json: JSON.stringify(postValidation),
        vo_quality_status: newStatus
      });

      return NextResponse.json({
        success: true,
        applied: rw.applied,
        vo_quality_status: newStatus,
        vo_quality_score_json: postValidation,
        storyboard: updatedStoryboard
      });
    }

    // Default: pillar_item
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item OPC tidak ditemukan.' }, { status: 404 });
    }
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye induk tidak ditemukan.' }, { status: 404 });
    }

    const rowPayload = safeParse(item.row_creative_payload, {});
    const resultJson = safeParse(item.result_json, {});
    const videoPlan = safeParse(item.new_video_plan_json, []);
    if (!Array.isArray(videoPlan) || videoPlan.length === 0) {
      return NextResponse.json({ success: false, error: 'new_video_plan_json item kosong.' }, { status: 400 });
    }

    const isKeywordMode = rowPayload?.use_brand_pillars === 0 || rowPayload?.use_brand_pillars === false || Boolean(rowPayload?.keyword);
    const isHerbalOrHealth = resolveIsHerbalOrHealthTarget({
      productName: rowPayload?.product_name || item.target_prod_name || '',
      niche: campaign.knowledge_domain || '',
      brandName: campaign.brand_name || campaign.account_name || '',
      contentPillar: rowPayload?.content_pillar || campaign.content_pillar || ''
    });

    const voLines = videoPlan.map(extractClipVoText);
    const valOpts = {
      contentPayload: rowPayload?.content_payload || resultJson?.content_payload || null,
      isKeywordMode,
      isHerbalOrHealth,
      targetLanguage: campaign.target_language || 'id-ID',
      wordsPerClip: campaign.words_per_clip || '17-19 kata',
      clipDuration: Number(campaign.clip_duration || 8),
      mandatoryHook: rowPayload?.custom_hook || campaign.custom_hook || '',
      mandatoryOutroLine: rowPayload?.mandatory_outro_line || campaign.mandatory_outro_line || '',
      finishingPlan: resultJson?.finishing_plan || null,
      expectedClipsCount: videoPlan.length
    };

    const preValidation = validateVoQuality({ clips: voLines, ...valOpts });
    const rw = await rewriteVoWithQualityFeedback({
      voLines,
      validation: preValidation,
      targetLanguage: valOpts.targetLanguage,
      wordsPerClip: valOpts.wordsPerClip,
      contentPayload: valOpts.contentPayload,
      mandatoryHook: valOpts.mandatoryHook,
      generateFn: async (rwPrompt) => executeWithKeyPool(1, async (apiKey) => {
        return await generateContentFlexible({ prompt: rwPrompt, taskType: 'PILLAR_CAMPAIGN', timeoutMs: 90000, apiKey });
      })
    });

    const finalLines = rw.applied ? rw.voLines : voLines;
    const postValidation = validateVoQuality({ clips: finalLines, ...valOpts });

    const updatedPlan = videoPlan.map((vp, idx) => ({
      ...vp,
      new_vo: finalLines[idx]
    }));
    const updatedVoiceover = Array.isArray(resultJson.voiceover)
      ? resultJson.voiceover.map((v, idx) => ({ ...v, narration: finalLines[idx] ?? v.narration }))
      : finalLines.map((text, idx) => ({ scene: idx + 1, narration: text }));
    const updatedResultJson = {
      ...resultJson,
      voiceover: updatedVoiceover
    };

    const newStatus = postValidation.passed ? 'pass_after_rewrite' : 'blocked';
    await updatePillarCampaignItem(item.id, {
      new_video_plan_json: JSON.stringify(updatedPlan),
      result_json: JSON.stringify(updatedResultJson),
      tiktok_safe_voiceover: JSON.stringify(updatedVoiceover),
      vo_quality_score_json: JSON.stringify(postValidation),
      vo_quality_status: newStatus,
      ...(postValidation.passed && item.review_state === 'vo_quality_blocked'
        ? { review_state: 'ready_for_review', review_reason: 'Lolos setelah Perbaiki VO Otomatis' }
        : {})
    });

    return NextResponse.json({
      success: true,
      applied: rw.applied,
      vo_quality_status: newStatus,
      vo_quality_score_json: postValidation,
      new_video_plan: updatedPlan
    });
  } catch (err) {
    console.error('[API /v2/vo-quality/rewrite POST Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
