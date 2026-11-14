import crypto from 'crypto';
import { getDb } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveCampaignProductReference } from './product-reference-resolver.js';
import { inspectBase64ImageReference, inspectBase64ImageReferences } from './base64-image-reference.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from './opc-start-frame-contract.js';
import { resolveBridgePlan, readBridgeInputs } from './bridging/bridge-plan.js';
import {
  presenceTruthTuple,
  lightingTupleForClip,
  hasAnyMetaphorPolicyOverride,
  cleanSceneTuple,
  resolveVideoVariety
} from './metaphor-policy.js';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

function sanitizeTag(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

const lockProductIdentityPrompt = (prompt, product, productTag) => {
  const sanitizedPrompt = String(prompt || '')
    .replace(/\(Product Reference File:\s*['"][^'"]*generated_[^'"]*['"][^)]*\)\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const productName = String(product?.name || product?.product_name || '').trim();
  return `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK] The attached product reference @${productTag} is the sole visual source of truth${productName ? ` for ${productName}` : ''}. Reproduce the exact same package identity, silhouette, materials, colors, logo, label artwork, typography, and printed details. Do not redesign, simplify, genericize, relabel, translate, substitute, or invent a different product package. Ignore any filename or textual product description that conflicts with the attached image. Preserve the attached package as a recognizable exact product while composing it naturally into the requested scene.\n\n${sanitizedPrompt}`;
};

function applyModestPresenceAndWardrobe(promptText, policy, zone, variety) {
  let next = promptText;
  const presenceTag = presenceTruthTuple(policy, zone, { hasOverride: true, variety });
  if (/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)/i.test(next)) {
    next = next.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, presenceTag);
  } else {
    next = `${next} ${presenceTag}`.trim();
  }
  if (variety?.wardrobeDesc) {
    const wardrobeTag = `(Wardrobe: ${variety.wardrobeDesc})`;
    if (/\(Wardrobe:\s*.*?\)/i.test(next)) {
      next = next.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, wardrobeTag);
    } else {
      next = `${next} ${wardrobeTag}`.trim();
    }
  }
  return next;
}

export async function buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, origin = 'phase_1_initial', contextReferences = [], productLoader = getProductById, cwd = process.cwd() }) {
  const requirement = resolveProductReferenceRequirement({ campaign, item, clipIndex });
  const row = parse(item?.row_creative_payload);
  const productId = campaign?.target_product_id || campaign?.product_id || null;
  const product = requirement.required && productId ? await productLoader(productId) : null;
  const reference = requirement.required
    ? resolveCampaignProductReference({ product, fallbackPaths: productId ? [] : [campaign?.product_ref_image_path, row.product_ref_image_path], cwd })
    : null;
  if (requirement.required && !reference) throw new ProductReferenceUnavailableError();

  const productTag = `product_truth_${sanitizeTag(product?.id || productId || 'product')}`;
  const productReference = reference ? {
    data: reference.base64DataUrl,
    category: 'subject',
    name: `${productTag}.${extensionForMime(reference.mimeType)}`
  } : null;

  let effectiveContextReferences = [...(contextReferences || [])];
  const isCartoonWorld = campaign?.content_world === 'cartoon_universe' || row?.content_world === 'cartoon_universe';

  // Auto-resolve character context references if not explicitly provided
  if (isCartoonWorld && effectiveContextReferences.length === 0) {
    try {
      const plan = parse(item?.new_video_plan_json, []);
      const planEntry = Array.isArray(plan) ? plan.find(p => Number(p.clip_index) === Number(clipIndex)) : null;
      const clipCharacters = Array.isArray(planEntry?.characters) ? planEntry.characters : [];
      let universeSnapshot = null;
      let visualIdentitySnapshot = null;
      try { universeSnapshot = campaign?.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null; } catch (_) {}
      try { visualIdentitySnapshot = campaign?.visual_overrides_json ? JSON.parse(campaign.visual_overrides_json) : null; } catch (_) {}

      const { resolveClipReferenceImagesAsync } = await import('./cartoon-reference-resolver.js');
      const resolved = await resolveClipReferenceImagesAsync({
        contentWorld: 'cartoon_universe',
        universeProfile: campaign?.universe_profile || row?.universe_profile || 'pawville',
        universeSnapshot,
        visualIdentitySnapshot,
        clip: clipIndex,
        promptText: prompt,
        productReference: null,
        productRevealBeat: row?.product_reveal_beat || campaign?.product_reveal_beat || 'none',
        clipCharacters
      });
      if (resolved?.allReferences?.length) {
        effectiveContextReferences = resolved.allReferences;
      }
    } catch (resolveErr) {
      console.warn('[buildOpcStartFrameRequest] Failed auto-resolving cartoon references:', resolveErr.message);
    }
  }

  const references = [];
  const seenSha = new Set();

  if (productReference) {
    references.push(productReference);
    seenSha.add(reference.sha256);
  }

  for (const ctxRef of effectiveContextReferences) {
    if (!ctxRef) continue;
    try {
      const meta = inspectBase64ImageReference(ctxRef);
      if (!seenSha.has(meta.sha256)) {
        seenSha.add(meta.sha256);
        references.push(ctxRef);
      }
    } catch (_) {
      // Ignore invalid context references
    }
  }

  const referenceMetadata = inspectBase64ImageReferences(references);
  const productReferenceCount = reference && referenceMetadata.length > 0 && referenceMetadata[0].sha256 === reference.sha256 ? 1 : 0;
  if ((requirement.required && productReferenceCount !== 1) || (!requirement.required && productReferenceCount !== 0)) {
    throw new Error('OPC_PRODUCT_REFERENCE_INVARIANT_FAILED');
  }

  const db = getDb();
  const brandProfile = campaign?.brand_profile_id ? await db.prepare('SELECT * FROM brand_profiles WHERE id=?').get(campaign.brand_profile_id) : null;

  // Gateway Sanitizer: Jika requirement.required === false (klip sebelum bridging / post non-produk),
  // bersihkan seluruh kata kunci nama produk, merek, dan instruksi jar agar T2I engine tidak berhalusinasi botol fiktif
  const isMetaphoricFaceless = campaign?.visual_style === 'metaphoric_faceless' || row?.visual_style === 'metaphoric_faceless';
  const parsedResult = parse(item?.result_json);
  const policy = campaign?.resolved_metaphor_policy || row?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
  const isClip1 = Number(clipIndex) === 1;
  const hasPolicyOverride = hasAnyMetaphorPolicyOverride(policy);
  const variety = hasPolicyOverride
    ? resolveVideoVariety(item?.id || campaign?.item_id || campaign?.content_pillar || parsedResult?.resolved_health_metaphor?.kit_key || campaign?.id || 'default')
    : null;

  let sanitizedPrompt = String(prompt || '');
  if (!requirement.required) {
    const rawProductName = String(product?.name || product?.product_name || campaign?.target_product_name || '').trim();
    if (rawProductName) {
      const escapedName = rawProductName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitizedPrompt = sanitizedPrompt.replace(new RegExp(`\\b${escapedName}\\b`, 'gi'), 'natural ingredients');
    }
    sanitizedPrompt = sanitizedPrompt.replace(/\bgarlibee\b/gi, 'natural botanical');
    sanitizedPrompt = sanitizedPrompt.replace(/\b(?:authentic\s+)?(?:garlibee\s+)?(?:product\s+)?(?:jar|bottle)\b/gi, 'glass conduit');
    sanitizedPrompt = sanitizedPrompt.replace(/\(Product Reference File:\s*['"][^'"]*['"][^)]*\)\.?/gi, '');
    if (hasPolicyOverride) {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Product Truth:\s*[^)]+\)\.?/gi, cleanSceneTuple(policy));
      sanitizedPrompt = sanitizedPrompt.replace(/\(Geometric Truth:\s*strictly\s+no\s+[^)]*\)\.?/gi, cleanSceneTuple(policy));
    } else {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Product Truth:\s*[^)]+\)\.?/gi, '(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)');
    }

    if (isMetaphoricFaceless) {
      if (hasPolicyOverride) {
        if (isClip1) {
          sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, presenceTruthTuple(policy, 'clip1', { hasOverride: true }));
          sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
          sanitizedPrompt = sanitizedPrompt.replace(/\(Action\s*&\s*Craft:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
        } else if (policy?.active && policy.handsPolicy === 'modest_hands_active') {
          sanitizedPrompt = applyModestPresenceAndWardrobe(sanitizedPrompt, policy, 'pre', variety);
        } else {
          sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, presenceTruthTuple(policy, 'clip1', { hasOverride: true }));
          sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
        }
      } else if (policy?.active && policy.handsPolicy === 'modest_hands_active' && !isClip1) {
        sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, presenceTruthTuple(policy, 'pre'));
      } else {
        sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)`);
        sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, ``);
      }
    }
  } else if (hasPolicyOverride) {
    sanitizedPrompt = sanitizedPrompt.replace(/\(Geometric Truth:\s*strictly\s+no\s+[^)]*\)\.?/gi, '');
    if (policy?.active && policy.handsPolicy === 'modest_hands_active') {
      sanitizedPrompt = applyModestPresenceAndWardrobe(sanitizedPrompt, policy, 'post', variety);
    }
  }

  if (hasPolicyOverride && policy?.lightingArc) {
    const startFrameBridgePlan = resolveBridgePlan(readBridgeInputs(campaign || {}, {}, { defaultActive: true }));
    const resolvedLight = lightingTupleForClip(policy, clipIndex, startFrameBridgePlan);
    if (resolvedLight) {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Lighting:\s*[^)]+\)/gi, `(Lighting: ${resolvedLight})`);
    }
  }

  const providerPrompt = reference ? lockProductIdentityPrompt(sanitizedPrompt, product, productTag) : sanitizedPrompt;

  // FLUX-safe Positive Framing Enforcer:
  // Clip 1 of metaphoric_faceless WAJIB pure still-life objek saja — DILARANG menyisipkan "hands only"!
  let effectiveProviderPrompt = providerPrompt;
  if (isMetaphoricFaceless && isClip1) {
    effectiveProviderPrompt = effectiveProviderPrompt.replace(/\[CAMERA FRAMING:\s*[^\]]*hands only[^\]]*\]\s*/gi, '');
    if (!effectiveProviderPrompt.includes('[CAMERA FRAMING:')) {
      const clip1Framing = hasPolicyOverride
        ? `[CAMERA FRAMING: ${variety?.cameraAnglePrompt || 'close macro still-life framing'} focused solely on unattended physical objects, nobody in scene, empty foreground around subject]`
        : '[CAMERA FRAMING: Unattended macro still-life close-up focusing solely on physical objects, head and hands out of frame]';
      effectiveProviderPrompt = `${clip1Framing} ${effectiveProviderPrompt}`.trim();
    }
  } else {
    const isFacelessCampaign = campaign?.face_visibility === 'Faceless' || row?.face_visibility === 'Faceless' || !isCartoonWorld;

    if (isFacelessCampaign && !effectiveProviderPrompt.includes('[CAMERA FRAMING:') && !effectiveProviderPrompt.includes('zero facial')) {
      const isBackView = /back-view|tampak belakang|behind|gazing out/i.test(effectiveProviderPrompt);
      const cameraLock = isBackView
        ? '[CAMERA FRAMING: Strict 180-degree rear view from directly behind subject, subject completely facing away, 0% facial visibility]'
        : (hasPolicyOverride && policy?.handsPolicy === 'modest_hands_active'
            ? `[CAMERA FRAMING: Strict chest-down tabletop close-up with upper frame edge below shoulders focused on hands, one person with exactly two modest hands in long fitted-cuff sleeves, ${variety?.cameraAnglePrompt || '35-degree macro diagonal'}]`
            : '[CAMERA FRAMING: Strict neck-down POV close-up cropped below chest, hands only, head and face 100% out of frame]');
      effectiveProviderPrompt = `${cameraLock} ${effectiveProviderPrompt}`;
    }
  }

  const promptSha256 = hash(effectiveProviderPrompt);
  const referenceSha256s = referenceMetadata.map(metadata => metadata.sha256);
  const requestedModel = 'nano_banana_2';
  const fingerprint = hash(JSON.stringify({
    clipIndex: Number(clipIndex),
    promptSha256,
    referenceSha256s,
    productReferenceSha256: reference?.sha256 || null,
    referenceCount: references.length,
    productReferenceCount,
    model: requestedModel,
    aspectRatio: campaign?.aspect_ratio || '9:16'
  }));

  const cartoonNegativePrompt = 'photorealistic human photography, real live-action person, uncanny valley, ugly, bad anatomy, distorted limbs, extra fingers, missing fingers, blurry, low resolution, 2D flat vector clipart';
  const defaultFacelessNegativePrompt = 'human face, facial features, eyes, nose, mouth, head, headshot, portrait, hair, neck, torso, chest, shoulders, upper body, selfie, looking at camera, blurry hands, extra fingers, missing fingers, distorted limbs';
  const effectiveNegativePrompt = isCartoonWorld ? cartoonNegativePrompt : defaultFacelessNegativePrompt;

  return {
    providerRequest: {
      prompt: effectiveProviderPrompt,
      negative_prompt: effectiveNegativePrompt,
      model: requestedModel,
      aspect_ratio: campaign?.aspect_ratio || '9:16',
      reference_images: references.length ? references : undefined,
      expected_reference_sha256s: referenceSha256s,
      webhookOverride: brandProfile
    },
    audit: {
      origin,
      campaign_id: String(campaign?.id),
      campaign_item_id: String(item?.id),
      clip_index: Number(clipIndex),
      requires_product_reference: requirement.required,
      requirement_reason: requirement.reason,
      reference_count: references.length,
      product_reference_count: productReferenceCount,
      reference_source_field: reference?.sourceField || null,
      reference_name: reference ? productReference.name : null,
      reference_position: reference ? 0 : null,
      reference_sha256: reference?.sha256 || null,
      payload_reference_sha256: reference ? referenceMetadata[0]?.sha256 || null : null,
      reference_mime_type: reference ? referenceMetadata[0]?.mimeType || null : null,
      reference_byte_length: reference ? referenceMetadata[0]?.byteLength || 0 : 0,
      requested_model: requestedModel,
      effective_model: requestedModel,
      bridge_start: requirement.bridgeStart,
      bridge_end: requirement.bridgeEnd,
      prompt_sha256: promptSha256,
      request_fingerprint: fingerprint
    }
  };
}
