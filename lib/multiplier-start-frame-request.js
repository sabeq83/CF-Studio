import {
  resolveCampaignProductReference,
  lockProductIdentityPrompt
} from './product-reference-resolver.js';
import { ProductReferenceUnavailableError } from './opc-start-frame-contract.js';
import { resolveBridgePlan, readBridgeInputs } from './bridging/bridge-plan.js';
import {
  stripLeakedProductNames,
  sanitizeCommercialPackagingTerms,
  sanitizeNonBridgingFoodTruth,
  appendUnbrandedPrepTag
} from './bridging/non-bridging-prompt-sanitizer.js';

function sanitizeTag(id) {
  return String(id || 'product').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

/**
 * Build a G-Labs T2I start frame request for Multiplier clips matching OPC Product Identity Lock
 * on bridging clips and strict non-packaging sanitization on non-bridging clips.
 */
export function buildMultiplierStartFrameRequest({
  task = {},
  clipIndex = 1,
  prompt = '',
  product = null,
  bridging = {},
  aesthetics = {},
  imageModel = 'nano_banana_pro',
  webhookOverride = null,
  cwd = process.cwd()
} = {}) {
  const normalizedClipIndex = Number(clipIndex) || 1;
  const plan = resolveBridgePlan(readBridgeInputs(bridging || {}, aesthetics || {}, { defaultActive: true }));
  const isBridgeClip = plan.isProductClip(normalizedClipIndex);
  const aspect_ratio = aesthetics?.aspect_ratio || aesthetics?.aspectRatio || '9:16';

  const productNames = [
    product?.product_name,
    bridging?.productName,
    bridging?.resolvedDNA?.product_name
  ].filter(Boolean);

  const fallbackPaths = [
    bridging?.productRefImagePath,
    bridging?.product_ref_image_path,
    bridging?.resolvedDNA?.product_image_url
  ].filter(Boolean);

  const hasRegisteredProductTarget = Boolean(
    product?.id ||
    task?.target_product_id ||
    bridging?.targetProductId ||
    fallbackPaths.length > 0
  );

  let effectivePrompt = String(prompt || '').trim();
  let references;
  let expectedReferenceSha256s;
  let referenceMeta = null;

  if (isBridgeClip) {
    effectivePrompt = effectivePrompt.replace(/\(Geometric Truth:\s*strictly\s+no\s+[^)]*\)\.?/gi, '').trim();

    if (hasRegisteredProductTarget && plan.active) {
      const ref = resolveCampaignProductReference({
        product,
        fallbackPaths,
        cwd
      });

      if (!ref) {
        throw new ProductReferenceUnavailableError(
          `Foto referensi produk Multiplier wajib untuk klip ${normalizedClipIndex}, tetapi file tidak tersedia di disk.`
        );
      }

      const productId = product?.id || task?.target_product_id || bridging?.targetProductId || 'product';
      const productTag = `product_truth_${sanitizeTag(productId)}`;
      references = [
        {
          data: ref.base64DataUrl,
          category: 'subject',
          name: `${productTag}.${extensionForMime(ref.mimeType)}`
        }
      ];
      expectedReferenceSha256s = [ref.sha256];
      referenceMeta = {
        path: ref.path,
        sourceField: ref.sourceField,
        sha256: ref.sha256,
        mimeType: ref.mimeType
      };
      effectivePrompt = lockProductIdentityPrompt(
        effectivePrompt,
        product || { product_name: bridging?.productName || bridging?.resolvedDNA?.product_name },
        productTag
      );
    }
  } else {
    const isKitchenScene = /\b(?:kitchen|dapur|countertop|bowl|oven|blender|stove|pastry|batter|cake|cook)\b/i.test(effectivePrompt);
    effectivePrompt = stripLeakedProductNames(effectivePrompt, productNames, 'natural culinary ingredients');
    effectivePrompt = sanitizeCommercialPackagingTerms(effectivePrompt, {
      isPreBridgeKitchenScene: isKitchenScene,
      preserveBottleJarToConduit: true
    });
    if (/\(Food Truth:/i.test(effectivePrompt)) {
      effectivePrompt = sanitizeNonBridgingFoodTruth(effectivePrompt, {
        recipeTitle: bridging?.angleTitle || task?.campaign_name || '',
        productNames
      });
    }
    effectivePrompt = effectivePrompt.replace(
      /\(Product Truth:\s*[^)]+\)\.?/gi,
      '(Geometric Truth: strictly no product shown, strictly no bottle, jar, or commercial packaging)'
    );
    if (isKitchenScene) {
      effectivePrompt = appendUnbrandedPrepTag(effectivePrompt);
    }
  }

  return {
    isBridgeClip,
    providerRequest: {
      prompt: effectivePrompt,
      model: imageModel || 'nano_banana_pro',
      aspect_ratio,
      reference_images: references,
      expected_reference_sha256s: expectedReferenceSha256s,
      webhookOverride: webhookOverride || undefined
    },
    audit: {
      clipIndex: normalizedClipIndex,
      isBridgeClip,
      referenceSha256: referenceMeta?.sha256 || null,
      referencePath: referenceMeta?.path || null,
      referenceSourceField: referenceMeta?.sourceField || null
    }
  };
}
