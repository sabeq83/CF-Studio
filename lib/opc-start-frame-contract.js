import { resolveBridgePlan, readBridgeInputs } from './bridging/bridge-plan.js';

const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveProductReferenceRequirement({ campaign, item, clipIndex }) {
  const plan = parse(item?.new_video_plan_json, []);
  const normalizedClipIndex = positiveInteger(clipIndex, 0);
  const clip = plan.find(entry => Number(entry.clip_index) === normalizedClipIndex) || {};
  const bridgeInputs = readBridgeInputs(campaign || {}, {}, { defaultActive: true });
  const bridgePlan = resolveBridgePlan(bridgeInputs);
  const seg = bridgePlan.segmentOf(normalizedClipIndex);
  const bridgeStart = seg?.start ?? bridgePlan.firstBridgeClip;
  const bridgeEnd = seg?.end ?? (bridgePlan.segments[0]?.end ?? bridgeStart);
  const bridge = bridgePlan.isProductClip(normalizedClipIndex);
  const parsedResult = parse(item?.result_json, {});
  const policy = campaign?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
  const isMetaphorHeroFinale = Boolean(
    policy?.active &&
    policy.productEntry === 'inside_metaphor' &&
    bridgePlan.active &&
    bridgePlan.targetClips > 1 &&
    normalizedClipIndex === bridgePlan.targetClips
  );
  const productCampaign = Boolean(campaign?.target_product_id || campaign?.product_id);
  const required = productCampaign && (bridge || isMetaphorHeroFinale || clip.product_visible === true || clip.requires_product_reference === true);
  return {
    required,
    productCampaign,
    bridge,
    isHeroFinale: isMetaphorHeroFinale,
    bridgeStart,
    bridgeEnd,
    reason: bridge
      ? 'bridge_range'
      : isMetaphorHeroFinale
        ? 'metaphor_hero_finale'
        : clip.requires_product_reference === true
          ? 'clip_metadata'
          : clip.product_visible === true
            ? 'product_visible'
            : 'not_required'
  };
}

export class ProductReferenceUnavailableError extends Error {
  constructor(message = 'Foto referensi produk wajib tetapi tidak tersedia.') { super(message); this.code = 'PRODUCT_REFERENCE_UNAVAILABLE'; this.status = 422; }
}
