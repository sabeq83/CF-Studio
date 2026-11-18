import { resolvePreRenderFinishingMeta } from './tiktok-compliance-service.js';
import { DEFAULT_FINISHING_SKIN } from './finishing-skin-registry.js';
import { validateFinishingPlan } from './finishing-plan-validator.js';
import { hasStrictTemplateCompliance } from './finishing-template-registry.js';

/**
 * Memvalidasi apakah video_source_type di Video Studio didukung.
 * Sumber 'instant_factory' ditolak secara eksplisit (HTTP 400).
 */
export function validateVideoStudioSourceType(videoSourceType) {
  if (!videoSourceType) {
    return { valid: false, status: 400, error: 'Sumber video dan path video wajib diisi' };
  }
  if (videoSourceType === 'instant_factory') {
    return {
      valid: false,
      status: 400,
      error: "Sumber video 'instant_factory' sudah tidak didukung dan telah dihapus."
    };
  }
  const allowed = ['upload', 'database', 're_campaign'];
  if (!allowed.includes(videoSourceType)) {
    return {
      valid: false,
      status: 400,
      error: `Sumber video '${videoSourceType}' tidak dikenal. Pilih: ${allowed.join(', ')}`
    };
  }
  return { valid: true };
}

/**
 * Resolves finishing source metadata from originating campaign (RE Campaign).
 * 
 * @param {Object} options
 * @param {string} options.videoSourceType - 're_campaign'
 * @param {string|string[]} options.videoPath - raw path or array of paths (e.g. ['re::123::clip0'])
 * @param {Object} options.db - database instance from getDb()
 * @returns {Promise<{ success: boolean, conflict?: boolean, message?: string, error?: string, data?: Object }>}
 */
export async function resolveFinishingSource({ videoSourceType, videoPath, db }) {
  if (!videoSourceType || !videoPath) {
    return {
      success: false,
      error: 'Parameter videoSourceType dan videoPath wajib disertakan'
    };
  }

  let videoPathList = [];
  if (Array.isArray(videoPath)) {
    videoPathList = videoPath;
  } else if (typeof videoPath === 'string' && videoPath.trim().startsWith('[')) {
    try {
      videoPathList = JSON.parse(videoPath);
    } catch (_) {
      videoPathList = [videoPath];
    }
  } else {
    videoPathList = [videoPath];
  }

  // ─────────────────────────────────────────
  // 1. RE CAMPAIGN
  // ─────────────────────────────────────────
  if (videoSourceType === 're_campaign') {
    const itemIds = new Set();
    for (const vp of videoPathList) {
      if (typeof vp === 'string' && vp.startsWith('re::')) {
        const parts = vp.split('::');
        if (parts[1]) itemIds.add(parts[1]);
      }
    }

    if (itemIds.size === 0) {
      return {
        success: false,
        error: 'Format video_path untuk re_campaign tidak valid (harus re::<itemId>::clipN atau re::<itemId>::final)'
      };
    }

    if (itemIds.size > 1) {
      return {
        success: true,
        conflict: true,
        message: 'Klip video berasal dari beberapa campaign yang berbeda. Pilih klip dari satu campaign atau buat plan baru.'
      };
    }

    const itemId = Array.from(itemIds)[0];
    const item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return { success: false, error: `RE Campaign item '${itemId}' tidak ditemukan` };
    }

    const campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return { success: false, error: `Campaign '${item.campaign_id}' tidak ditemukan` };
    }

    const finishingMeta = await resolvePreRenderFinishingMeta({ db, campaign, item });

    let skin = DEFAULT_FINISHING_SKIN;
    if (campaign.brand_profile_id) {
      try {
        const bp = await db.prepare('SELECT finishing_skin FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id);
        if (bp?.finishing_skin) skin = bp.finishing_skin;
      } catch (_) {}
    }

    const ttsBatchId = item.tts_batch_id || null;
    let voiceoverTexts = [];
    if (ttsBatchId) {
      try {
        const clips = await db.prepare('SELECT source_text FROM tts_studio_clips WHERE batch_id = ? ORDER BY CAST(clip_index AS INT) ASC').all(ttsBatchId);
        voiceoverTexts = (clips || []).map(c => c.source_text || '');
      } catch (_) {}
    }

    let planValidation = null;
    let planValid = true;
    let planErrors = [];
    let planWarnings = [];

    if (finishingMeta.finishingPlan && finishingMeta.finishingTemplate !== 'none') {
      const strictClaims = hasStrictTemplateCompliance(finishingMeta.finishingTemplate);
      planValidation = validateFinishingPlan(finishingMeta.finishingPlan, {
        finishingTemplate: finishingMeta.finishingTemplate,
        strictClaims,
        isHerbalProduct: finishingMeta.isHerbalProduct,
        cleanVoiceoverClips: voiceoverTexts
      });
      planWarnings = planValidation.warnings || [];
      planErrors = planWarnings.filter(w => /rejected|claim|invalid|illegal|forbidden/i.test(w));
      if (planErrors.length > 0) {
        planValid = false;
      }
    }

    return {
      success: true,
      conflict: false,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.campaign_name,
        itemId: item.id,
        finishingTemplate: finishingMeta.finishingTemplate || 'none',
        finishingPlan: finishingMeta.finishingPlan,
        skin,
        brand: finishingMeta.brand,
        brandProfileId: campaign.brand_profile_id || null,
        hookTitle: finishingMeta.hookTitle || '',
        captionMode: finishingMeta.captionMode || 'full',
        loudnessTarget: finishingMeta.loudnessTarget || -14,
        isHerbalProduct: finishingMeta.isHerbalProduct,
        productData: finishingMeta.productData,
        recipeData: null,
        captionText: finishingMeta.captionText || '',
        voiceoverTexts,
        ttsBatchId,
        brandPatch: finishingMeta.brandPatch,
        planValid,
        planErrors,
        planWarnings
      }
    };
  }

  return {
    success: false,
    error: `Sumber video '${videoSourceType}' tidak memiliki finishing source campaign.`
  };
}
