import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';
import { getProductById } from './product-repository.js';
import { resolveCampaignProductReference } from './product-reference-resolver.js';
import {
  inspectBase64ImageReference,
  inspectBase64ImageReferences,
  detectMimeTypeFromBuffer,
  extensionForImageMime,
  bufferToBase64DataUrl
} from './base64-image-reference.js';
import { sanitizeTimeOfDayLighting } from './scene-brief.js';
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

export function buildWardrobeReferencePrompt(wardrobe = {}) {
  const wardrobeDesc = String(wardrobe?.description || wardrobe?.label || 'solid plain modest long-sleeve linen gamis covering wrists completely, plain unprinted fabric').trim();
  return `(VERTICAL 9:16) --ar 9:16 --no landscape [CAMERA FRAMING: Strict chest-down tabletop close-up cropped strictly below shoulders and collarbones, chin, neck, and face 100% out of frame] Studio neutral soft matte cream seamless backdrop showing a pair of modest Indonesian female hands resting cleanly on an empty light-wood tabletop wearing ${wardrobeDesc}, single uniform solid fabric color, clear fitted wrist cuffs, even soft daylight.`;
}

export function shouldAttachWardrobeReference({ visualMode = '', clipIndex = 1, policy = null, isMetaphoricFaceless = false } = {}) {
  const normalizedMode = String(visualMode || '').trim().toLowerCase();
  if (normalizedMode === '3d_bio_cellular' || normalizedMode === 'symbolic_surrealism') {
    return false;
  }
  const cNum = Number(clipIndex) || 1;
  if (cNum === 1 && (policy?.mode === 'hook_only' || isMetaphoricFaceless)) {
    return false;
  }
  if (policy?.active && policy?.handsPolicy === 'zero_hands' && policy?.mode !== 'hook_only') {
    return false;
  }
  return true;
}

function formatLockedWardrobeTag(variety) {
  const desc = String(variety?.wardrobeDesc || variety?.wardrobeColorLabel || '').trim();
  if (!desc) return '';
  const hasCuffs = /fitted(?:\s+wrist)?\s+cuffs/i.test(desc);
  const hasIdentical = /identical\s+color\s+in\s+every\s+clip/i.test(desc);
  const labelPrefix = variety?.wardrobeColorLabel && !desc.toLowerCase().includes(variety.wardrobeColorLabel.toLowerCase())
    ? `${variety.wardrobeColorLabel}, `
    : '';
  const suffixParts = [];
  if (!hasCuffs) suffixParts.push('fitted cuffs at wrists');
  if (!hasIdentical) suffixParts.push('identical color in every clip');
  const fullDesc = suffixParts.length > 0
    ? `${labelPrefix}${desc}, ${suffixParts.join(', ')}`
    : `${labelPrefix}${desc}`;
  return `(Wardrobe: ${fullDesc})`;
}

function resolveEffectiveWardrobeVariety({ savedWardrobe, policy, item, campaign, parsedResult }) {
  if (savedWardrobe && (savedWardrobe.description || savedWardrobe.label || savedWardrobe.key)) {
    const fallbackVariety = resolveVideoVariety(
      item?.id || campaign?.item_id || campaign?.content_pillar || parsedResult?.resolved_health_metaphor?.kit_key || campaign?.id || 'default'
    );
    return {
      ...fallbackVariety,
      wardrobeColorKey: savedWardrobe.key || fallbackVariety.wardrobeColorKey,
      wardrobeColorLabel: savedWardrobe.label || fallbackVariety.wardrobeColorLabel,
      wardrobeDesc: savedWardrobe.description || savedWardrobe.label || fallbackVariety.wardrobeDesc,
      cameraAngleKey: savedWardrobe.cameraAngleKey || fallbackVariety.cameraAngleKey
    };
  }

  const hasOverride = hasAnyMetaphorPolicyOverride(policy);
  const sceneDirectorOn = campaign?.planner_scene_director === 'on' || Boolean(parsedResult?.resolved_scene_brief || campaign?.resolved_scene_brief);
  if (!hasOverride && !sceneDirectorOn) return null;

  const vso = parse(campaign?.visual_overrides_json || parsedResult?.resolved_visual_overrides);
  const viStructured = vso?.structured || vso || null;
  const paletteEntries = Array.isArray(viStructured?.wardrobe?.palette) && viStructured.wardrobe.palette.length > 0
    ? viStructured.wardrobe.palette
    : null;
  const sleevePolicy = viStructured?.wardrobe?.sleeve_policy || 'wrists_covered';
  return resolveVideoVariety(
    item?.id || campaign?.item_id || campaign?.content_pillar || parsedResult?.resolved_health_metaphor?.kit_key || campaign?.id || 'default',
    { paletteEntries, sleevePolicy }
  );
}

function applyModestPresenceAndWardrobe(promptText, policy, zone, variety) {
  let next = promptText;
  const presenceTag = presenceTruthTuple(policy, zone, { hasOverride: true, variety });
  if (/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)/i.test(next)) {
    next = next.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, presenceTag);
  } else {
    next = `${next} ${presenceTag}`.trim();
  }
  const wardrobeTag = formatLockedWardrobeTag(variety);
  if (wardrobeTag) {
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
  } else if (!isCartoonWorld && !effectiveContextReferences.some(r => /^wardrobe_fabric_hands_ref\./i.test(r?.name || ''))) {
    const parsedForWardrobe = parse(item?.result_json);
    const wardrobeRefRel = parsedForWardrobe?.wardrobe_reference_image || campaign?.wardrobe_reference_image || '';
    if (wardrobeRefRel) {
      const planForWardrobe = parse(item?.new_video_plan_json, []);
      const planEntryWardrobe = Array.isArray(planForWardrobe) ? planForWardrobe.find(p => Number(p.clip_index) === Number(clipIndex)) : null;
      const policyForWardrobe = campaign?.resolved_metaphor_policy || row?.resolved_metaphor_policy || parsedForWardrobe?.resolved_metaphor_policy || null;
      const isMetaphoricWardrobe = campaign?.visual_style === 'metaphoric_faceless' || row?.visual_style === 'metaphoric_faceless';
      if (shouldAttachWardrobeReference({
        visualMode: planEntryWardrobe?.visual_mode,
        clipIndex,
        policy: policyForWardrobe,
        isMetaphoricFaceless: isMetaphoricWardrobe
      })) {
        const cleanRel = String(wardrobeRefRel).replace(/^\/+/, '');
        const absWardrobePath = path.isAbsolute(wardrobeRefRel) && fs.existsSync(wardrobeRefRel)
          ? wardrobeRefRel
          : path.join(cwd, 'public', cleanRel);
        if (fs.existsSync(absWardrobePath)) {
          try {
            const buf = fs.readFileSync(absWardrobePath);
            const detectedMime = detectMimeTypeFromBuffer(buf, absWardrobePath) || 'image/png';
            const dataUrl = bufferToBase64DataUrl(buf, absWardrobePath);
            if (dataUrl) {
              effectiveContextReferences.push({
                data: dataUrl,
                category: 'style',
                name: `wardrobe_fabric_hands_ref.${extensionForImageMime(detectedMime)}`
              });
            }
          } catch (wReadErr) {
            console.warn(`[buildOpcStartFrameRequest] Failed reading wardrobe reference ${absWardrobePath}:`, wReadErr.message);
          }
        }
      }
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
    } catch (ctxErr) {
      console.warn(`[buildOpcStartFrameRequest] Skipping invalid context reference (${ctxRef?.name || 'unnamed'}):`, ctxErr.message);
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
  const planList = parse(item?.new_video_plan_json, []);
  const planEntry = Array.isArray(planList) ? planList.find(p => Number(p.clip_index) === Number(clipIndex)) : null;
  const clipVisualMode = String(planEntry?.visual_mode || '').trim().toLowerCase();
  const isPure3dOrSurrealClip = clipVisualMode === '3d_bio_cellular' || clipVisualMode === 'symbolic_surrealism';
  const policy = campaign?.resolved_metaphor_policy || row?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
  const isClip1 = Number(clipIndex) === 1;
  const isHookOnlyClip1 = isClip1 && policy?.mode === 'hook_only';
  const hasPolicyOverride = hasAnyMetaphorPolicyOverride(policy);
  const sceneBrief = parsedResult?.resolved_scene_brief || campaign?.resolved_scene_brief || row?.resolved_scene_brief || null;
  const isPreBridgeKitchenScene = !requirement.required && /kitchen|dapur|pantry|dining|makan/i.test(`${sceneBrief?.location_en || ''} ${sceneBrief?.location_id || ''} ${prompt || ''}`);
  const variety = resolveEffectiveWardrobeVariety({
    savedWardrobe: parsedResult?.resolved_wardrobe_color || campaign?.resolved_wardrobe_color,
    policy,
    item,
    campaign,
    parsedResult
  });

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
    if (isPreBridgeKitchenScene) {
      sanitizedPrompt = sanitizedPrompt.replace(/\b(?:glass\s+spice\s+jars?|spice\s+jars?|amber\s+glass\s+bottles?|condiment\s+bottles?)\b/gi, 'ceramic prep bowl');
    }
    if (hasPolicyOverride) {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Product Truth:\s*[^)]+\)\.?/gi, cleanSceneTuple(policy));
      sanitizedPrompt = sanitizedPrompt.replace(/\(Geometric Truth:\s*strictly\s+no\s+[^)]*\)\.?/gi, cleanSceneTuple(policy));
    } else {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Product Truth:\s*[^)]+\)\.?/gi, '(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)');
    }

    if (isPure3dOrSurrealClip) {
      sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject|Wardrobe):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
    } else if (isHookOnlyClip1) {
      sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '(Subject: unattended physical hook objects inside the planned home setting, empty foreground)');
      sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, '');
    } else if (isMetaphoricFaceless) {
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
        sanitizedPrompt = applyModestPresenceAndWardrobe(sanitizedPrompt, policy, 'pre', variety);
      } else {
        sanitizedPrompt = sanitizedPrompt.replace(/\((?:Presence Truth|Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)`);
        sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, ``);
      }
    } else if (!isClip1 && ((policy?.active && policy.handsPolicy === 'modest_hands_active') || variety?.wardrobeDesc)) {
      if (!(policy?.active && policy?.handsPolicy === 'zero_hands' && policy?.mode !== 'hook_only')) {
        sanitizedPrompt = applyModestPresenceAndWardrobe(sanitizedPrompt, policy, 'pre', variety);
      }
    } else if (variety?.wardrobeDesc && (!policy?.active || policy.handsPolicy !== 'zero_hands')) {
      sanitizedPrompt = applyModestPresenceAndWardrobe(sanitizedPrompt, policy, 'pre', variety);
    }
  } else if (!isPure3dOrSurrealClip) {
    if (hasPolicyOverride) {
      sanitizedPrompt = sanitizedPrompt.replace(/\(Geometric Truth:\s*strictly\s+no\s+[^)]*\)\.?/gi, '');
    }
    const handsModestActive = (policy?.active && policy.handsPolicy === 'modest_hands_active')
      || (Boolean(variety?.wardrobeDesc) && !(policy?.active && policy?.handsPolicy === 'zero_hands' && policy?.mode !== 'hook_only'));
    if (handsModestActive) {
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

  if (sceneBrief?.time_key) {
    sanitizedPrompt = sanitizeTimeOfDayLighting(sanitizedPrompt, sceneBrief.time_key);
  }

  const hasWardrobeRefOrLock = !isPure3dOrSurrealClip
    && !isHookOnlyClip1
    && !(isMetaphoricFaceless && isClip1)
    && Boolean(variety?.wardrobeDesc || effectiveContextReferences.some(r => /^wardrobe_/i.test(r?.name || '')));
  if (reference && hasWardrobeRefOrLock && !/\(Wardrobe Lock Priority:/i.test(sanitizedPrompt)) {
    sanitizedPrompt = `${sanitizedPrompt} (Wardrobe Lock Priority: sleeve color must match the wardrobe reference, ignore any clothing color seen in the product reference)`.trim();
  }

  const providerPrompt = reference ? lockProductIdentityPrompt(sanitizedPrompt, product, productTag) : sanitizedPrompt;

  // FLUX-safe Positive Framing Enforcer (K7.4 chest-down below-shoulders + clean 3D):
  let effectiveProviderPrompt = providerPrompt;
  if (isPure3dOrSurrealClip) {
    effectiveProviderPrompt = effectiveProviderPrompt.replace(/\[CAMERA FRAMING:\s*[^\]]*hands[^\]]*\]\s*/gi, '');
    if (!effectiveProviderPrompt.includes('[CAMERA FRAMING:')) {
      effectiveProviderPrompt = `[CAMERA FRAMING: Pure microscopic 3D bio-cellular or symbolic botanical visual render cleanly centered on organic cellular structures, clean frameless canvas without floating HUD text or human clothing] ${effectiveProviderPrompt}`.trim();
    }
  } else if ((isMetaphoricFaceless && isClip1) || isHookOnlyClip1) {
    effectiveProviderPrompt = effectiveProviderPrompt.replace(/\[CAMERA FRAMING:\s*[^\]]*hands only[^\]]*\]\s*/gi, '');
    if (!effectiveProviderPrompt.includes('[CAMERA FRAMING:')) {
      const clip1Framing = hasPolicyOverride || isHookOnlyClip1
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
            ? `[CAMERA FRAMING: Strict chest-down tabletop close-up with upper frame edge cropped strictly below shoulders and collarbones focused on hands, one person with exactly two modest hands in long fitted-cuff sleeves, chin, neck and shoulders out of frame, ${variety?.cameraAnglePrompt || '35-degree macro diagonal'}]`
            : '[CAMERA FRAMING: Strict chest-down POV close-up cropped strictly below shoulders and collarbones, focusing on hands and tabletop only, chin, neck, shoulders and head 100% out of frame]');
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
  const baseFacelessNeg = 'human face, facial features, eyes, nose, mouth, head, headshot, portrait, chin, jawline, hair, neck, collarbones, shoulders, torso, chest, upper body, selfie, looking at camera, blurry hands, extra fingers, missing fingers, distorted limbs';
  const kitchenPreBridgeNeg = isPreBridgeKitchenScene ? ', glass spice jars, amber dropper bottles, labelled jars, commercial bottles, condiment jars' : '';
  const cell3dNeg = isPure3dOrSurrealClip ? ', clothed human torso, dressed person, collar, HUD overlay, floating text labels, UI badges' : '';
  const effectiveNegativePrompt = isCartoonWorld
    ? cartoonNegativePrompt
    : `${baseFacelessNeg}${kitchenPreBridgeNeg}${cell3dNeg}`;

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
