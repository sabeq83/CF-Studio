/**
 * lib/start-frame-visual-qc.js
 * Visual Quality Control (Layer 2) menggunakan Gemini Vision untuk memverifikasi start frame T2I
 * sebelum dikirim ke render video G-Labs / Veo.
 *
 * Kontrol tenant (strict, tanpa fallback ke default_tenant):
 * Setting key `start_frame_visual_qc`: 'off' (default) | 'report_only' | 'enforce'
 */

import fs from 'fs';
import path from 'path';
import { getSetting, getDb, updatePillarCampaignItem } from './db.js';
import { generateWithImage } from './gemini.js';
import { resolveProductReferenceRequirement } from './opc-start-frame-contract.js';
import { resolveBridgePlan, readBridgeInputs } from './bridging/bridge-plan.js';

export const START_FRAME_QC_SETTING_KEY = 'start_frame_visual_qc';
export const START_FRAME_QC_MAX_RETRIES = 2;
export const VALID_QC_MODES = new Set(['off', 'report_only', 'enforce']);

export const START_FRAME_QC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    hand_count: { type: 'integer' },
    awkward_anatomy: { type: 'boolean' },
    visible_face: { type: 'boolean' },
    exposed_forearm: { type: 'boolean' },
    pre_bridge_product: { type: 'boolean' },
    foreign_objects: { type: 'boolean' },
    weird_text_watermark: { type: 'boolean' },
    metaphor_alignment_score: { type: 'number' },
    reasons: {
      type: 'array',
      items: { type: 'string' }
    },
    correction_hint: { type: 'string' }
  },
  required: [
    'hand_count',
    'awkward_anatomy',
    'visible_face',
    'exposed_forearm',
    'pre_bridge_product',
    'foreign_objects',
    'weird_text_watermark',
    'metaphor_alignment_score',
    'reasons',
    'correction_hint'
  ]
};

export function resolveStartFrameQcMode(explicitValue = null) {
  const candidate = explicitValue !== null && explicitValue !== undefined
    ? explicitValue
    : getSetting(START_FRAME_QC_SETTING_KEY, false);
  const normalized = String(candidate || 'off').trim().toLowerCase();
  return VALID_QC_MODES.has(normalized) ? normalized : 'off';
}

function parseJson(value, fallback = {}) {
  try {
    if (value && typeof value === 'object') return value;
    return JSON.parse(value || '') || fallback;
  } catch (_) {
    return fallback;
  }
}

function resolveAbsoluteImagePath(localPath) {
  if (!localPath) return '';
  if (path.isAbsolute(localPath) && fs.existsSync(localPath)) return localPath;
  const trimmed = String(localPath).replace(/^\/+/, '');
  const underPublic = path.join(process.cwd(), 'public', trimmed);
  if (fs.existsSync(underPublic)) return underPublic;
  return localPath;
}

function detectImageMime(buffer, filePath) {
  if (buffer && buffer.length >= 4) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  }
  if (/\.jpe?g$/i.test(filePath)) return 'image/jpeg';
  if (/\.webp$/i.test(filePath)) return 'image/webp';
  return 'image/png';
}

export function buildStartFrameQcPrompt({
  clipIndex = 1,
  totalClips = 6,
  isPreBridge = true,
  expectsProduct = false,
  expectsObjectOnly = false,
  handsPolicy = 'zero_hands',
  objectWorld = '',
  isRecipeGenre = false
} = {}) {
  const handRule = expectsObjectOnly
    ? 'Opening hook frame MUST have 0 human hands, fingers, or arms (hand_count MUST be 0). Flag exposed_forearm=true or reasons if any hand/arm appears.'
    : (handsPolicy === 'modest_hands_active'
        ? 'At most 2 hands from 1 person are allowed; both forearms and wrists MUST be completely covered by opaque long sleeves (flag exposed_forearm=true if skin shows above the wrist or sleeves are rolled up).'
        : 'Flag if >2 hands, detached hands, or uncovered bare arms appear.');

  const productRule = isPreBridge && !expectsProduct
    ? 'PRE-BRIDGE FRAME: Commercial bottles, labelled jars, caps, boxes, or skincare/supplement packaging MUST NOT appear (flag pre_bridge_product=true if seen).'
    : (expectsProduct
        ? 'PRODUCT/HERO FRAME: Commercial product packaging/jar is expected and allowed; still flag weird garbled watermarks or gibberish overlaid UI text.'
        : 'CLEAN CONTINUITY FRAME: Check whether unrequested commercial jars/bottles or unrelated kitchen herb chopping appear unexpectedly.');

  const driftRule = isRecipeGenre
    ? 'Flag foreign_objects=true only for surreal or completely corrupted unrelated props.'
    : `Expected Metaphor World: "${objectWorld || 'Focused everyday metaphor demonstration'}". Flag foreign_objects=true if the scene drifts off into unrelated culinary herb chopping, raw spices/ginger piles, or random objects not belonging to the metaphor world.`;

  return `You are a strict visual Quality Control inspector auditing AI-generated start frame #${clipIndex} of ${totalClips}.
Evaluate ONLY what is actually visible inside the attached image. Be objective and conservative against AI hallucinations.

Checklist Rules:
1. hand_count: Count visible human hands. Fail if >2 hands appear${expectsObjectOnly ? ', or if ANY hand (>0) appears in this Clip 1 opening object-only hook' : ''}.
2. awkward_anatomy: true if fused fingers, extra fingers (>5 per hand), twisted wrists, floating disembodied limbs, or distorted hand geometry exist.
3. visible_face: true if any human face, eyes, nose, mouth, or partial head profile is visible.
4. exposed_forearm: true if bare human wrist/forearm skin above the wrist or rolled-up sleeves are visible. ${handRule}
5. pre_bridge_product: ${productRule}
6. foreign_objects: ${driftRule}
7. weird_text_watermark: true if distorted gibberish text, AI watermarks, stock logos, or random floating UI captions appear.
8. metaphor_alignment_score: float from 0.0 (completely wrong subject/broken) to 1.0 (cleanly matches the metaphor & lighting quality).
9. reasons: short, specific plain-language list of detected defects (empty array [] if clean pass).
10. correction_hint: concise positive-framing visual fix instruction (NO negative phrases like "no hands/no bottle"; e.g. "tight macro still-life framing on empty cream tabletop focusing solely on the glass bowl in cool overcast light") to help regenerate if defective.

Return strictly JSON matching the schema.`;
}

export function evaluateQcChecklistVerdict(checklist = {}, context = {}) {
  const c = checklist && typeof checklist === 'object' ? checklist : {};
  const handCount = Number.isFinite(Number(c.hand_count)) ? Number(c.hand_count) : 0;
  const score = Number.isFinite(Number(c.metaphor_alignment_score)) ? Number(c.metaphor_alignment_score) : 0.7;
  const expectsObjectOnly = Boolean(context.expectsObjectOnly);
  const isPreBridge = Boolean(context.isPreBridge);
  const handsPolicy = context.handsPolicy || 'zero_hands';

  const derivedReasons = Array.isArray(c.reasons) ? [...c.reasons.filter(Boolean).map(String)] : [];

  if (expectsObjectOnly && handCount > 0) {
    if (!derivedReasons.some(r => /hand|tangan/i.test(r))) {
      derivedReasons.push(`Clip 1 object-only hook unexpectedly contains ${handCount} hand(s)`);
    }
  } else if (handCount > 2) {
    if (!derivedReasons.some(r => /hand|>2|extra hand/i.test(r))) {
      derivedReasons.push(`Detected ${handCount} hands (>2 hands hallucination)`);
    }
  }
  if (c.awkward_anatomy && !derivedReasons.some(r => /anatom|finger|jari|cacat/i.test(r))) {
    derivedReasons.push('Awkward hand/finger anatomy detected');
  }
  if (c.visible_face && !derivedReasons.some(r => /face|wajah|head/i.test(r))) {
    derivedReasons.push('Visible human face/head violates faceless rule');
  }
  if (c.exposed_forearm && (handsPolicy === 'modest_hands_active' || expectsObjectOnly) && !derivedReasons.some(r => /forearm|sleeve|lengan/i.test(r))) {
    derivedReasons.push('Exposed forearm / uncovered wrist detected');
  }
  if (isPreBridge && c.pre_bridge_product && !derivedReasons.some(r => /product|bottle|jar|kemasan/i.test(r))) {
    derivedReasons.push('Pre-bridge frame shows commercial bottle/jar packaging');
  }
  if (c.foreign_objects && !derivedReasons.some(r => /foreign|drift|herb|asing/i.test(r))) {
    derivedReasons.push('Foreign/off-metaphor objects detected');
  }
  if (c.weird_text_watermark && !derivedReasons.some(r => /text|watermark|teks/i.test(r))) {
    derivedReasons.push('Distorted text or watermark artifact detected');
  }
  if (score < 0.45 && !derivedReasons.some(r => /alignment|score|skor/i.test(r))) {
    derivedReasons.push(`Low metaphor alignment score (${score.toFixed(2)})`);
  }

  const failed = Boolean(
    (expectsObjectOnly && handCount > 0) ||
    handCount > 2 ||
    c.awkward_anatomy ||
    c.visible_face ||
    c.exposed_forearm ||
    (isPreBridge && c.pre_bridge_product) ||
    c.foreign_objects ||
    c.weird_text_watermark ||
    score < 0.45
  );

  return {
    pass: !failed,
    severity: !failed ? 'pass' : (c.awkward_anatomy || c.visible_face || (isPreBridge && c.pre_bridge_product) || handCount > 2 || (expectsObjectOnly && handCount > 0) ? 'fail' : 'minor_fail'),
    reasons: failed ? derivedReasons : [],
    metrics: {
      hand_count: handCount,
      awkward_anatomy: Boolean(c.awkward_anatomy),
      visible_face: Boolean(c.visible_face),
      exposed_forearm: Boolean(c.exposed_forearm),
      pre_bridge_product: Boolean(c.pre_bridge_product),
      foreign_objects: Boolean(c.foreign_objects),
      weird_text_watermark: Boolean(c.weird_text_watermark),
      metaphor_alignment_score: score
    },
    correction_hint: String(c.correction_hint || '').trim()
  };
}

export function deriveQcContext({ campaign = {}, item = {}, clipIndex = 1 } = {}) {
  const parsedResult = parseJson(item?.result_json, {});
  const policy = campaign?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
  const kit = parsedResult?.resolved_health_metaphor?.kit || campaign?.resolved_health_metaphor?.kit || null;
  const bridgePlan = resolveBridgePlan(readBridgeInputs(campaign || {}, {}, { defaultActive: Boolean(campaign?.is_bridging_active) }));
  const cIdx = Number(clipIndex) || 1;
  const zone = bridgePlan.zoneOf(cIdx);
  const req = resolveProductReferenceRequirement({ campaign, item, clipIndex: cIdx });
  const isMetaphoric = campaign?.visual_style === 'metaphoric_faceless' || Boolean(policy?.active);
  const handsPolicy = policy?.handsPolicy || 'zero_hands';
  const expectsObjectOnly = isMetaphoric && (cIdx === 1 || handsPolicy === 'zero_hands');

  return {
    clipIndex: cIdx,
    totalClips: bridgePlan.targetClips || Number(campaign?.target_clips_count) || 6,
    isPreBridge: zone === 'pre' && !req.required,
    expectsProduct: Boolean(req.required),
    expectsObjectOnly,
    handsPolicy,
    objectWorld: policy?.objectWorld || kit?.object_world || '',
    isRecipeGenre: kit?.genre === 'recipe' || campaign?.campaign_focus === 'recipe_campaign'
  };
}

export async function inspectStartFrameFile({
  imagePath,
  campaign = {},
  item = {},
  clipIndex = 1,
  mode = null,
  visionFn = null
} = {}) {
  const resolvedMode = resolveStartFrameQcMode(mode);
  if (resolvedMode === 'off') {
    return { skipped: true, mode: 'off', pass: true, reasons: [], metrics: null, correction_hint: '' };
  }

  const context = deriveQcContext({ campaign, item, clipIndex });
  const absolutePath = resolveAbsoluteImagePath(imagePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return {
      skipped: true,
      mode: resolvedMode,
      pass: true,
      error: `Image not found on disk: ${imagePath}`,
      reasons: [],
      metrics: null,
      correction_hint: ''
    };
  }

  const buffer = fs.readFileSync(absolutePath);
  const mimeType = detectImageMime(buffer, absolutePath);
  const prompt = buildStartFrameQcPrompt(context);

  try {
    const runner = typeof visionFn === 'function' ? visionFn : generateWithImage;
    const rawResponse = await runner(buffer, mimeType, prompt, START_FRAME_QC_RESPONSE_SCHEMA);
    const parsedChecklist = parseJson(rawResponse, null);
    if (!parsedChecklist || typeof parsedChecklist !== 'object') {
      throw new Error('Invalid JSON returned by Vision QC');
    }

    const verdict = evaluateQcChecklistVerdict(parsedChecklist, context);
    return {
      skipped: false,
      mode: resolvedMode,
      ...verdict,
      context: {
        clipIndex: context.clipIndex,
        isPreBridge: context.isPreBridge,
        expectsProduct: context.expectsProduct,
        expectsObjectOnly: context.expectsObjectOnly
      },
      checked_at: new Date().toISOString()
    };
  } catch (err) {
    console.warn(`[StartFrameQC] Vision audit failed non-fatally for item #${item?.id} clip ${clipIndex}:`, err.message);
    return {
      skipped: true,
      mode: resolvedMode,
      pass: true,
      error: err.message,
      reasons: [],
      metrics: null,
      correction_hint: '',
      checked_at: new Date().toISOString()
    };
  }
}

export function appendPositiveQcCorrectionHint(promptText = '', correctionHint = '') {
  const cleanedBase = String(promptText || '').replace(/\s*\[QC REFINEMENT:[^\]]*\]/gi, '').trim();
  const safeHint = String(correctionHint || '').replace(/[\[\]]/g, '').trim();
  if (!safeHint) return cleanedBase;
  return `${cleanedBase} [QC REFINEMENT: ${safeHint}]`;
}

export function mergeStartFrameQcTelemetry(resultJsonObj = {}, {
  mode = 'off',
  clipIndex = 1,
  verdict = {},
  attempt = 1,
  isRetry = false,
  needsReview = false
} = {}) {
  const next = resultJsonObj && typeof resultJsonObj === 'object' ? { ...resultJsonObj } : {};
  const existing = next.start_frame_qc && typeof next.start_frame_qc === 'object' ? next.start_frame_qc : {};
  const clips = { ...(existing.clips || {}) };
  const clipKey = String(clipIndex);

  const prevClip = clips[clipKey] || { attempts: 0 };
  clips[clipKey] = {
    clip_index: Number(clipIndex),
    pass: Boolean(verdict.pass),
    needs_review: Boolean(needsReview),
    attempts: Math.max(Number(prevClip.attempts || 0), Number(attempt || 1)),
    reasons: Array.isArray(verdict.reasons) ? verdict.reasons : [],
    correction_hint: verdict.correction_hint || '',
    metrics: verdict.metrics || null,
    error: verdict.error || null,
    checked_at: verdict.checked_at || new Date().toISOString()
  };

  const clipList = Object.values(clips);
  const callsIncrement = verdict.skipped ? 0 : 1;

  next.start_frame_qc = {
    mode,
    calls: Number(existing.calls || 0) + callsIncrement,
    retries: Number(existing.retries || 0) + (isRetry ? 1 : 0),
    passed_count: clipList.filter(c => c.pass).length,
    failed_count: clipList.filter(c => !c.pass).length,
    needs_review_clips: clipList.filter(c => c.needs_review).map(c => c.clip_index),
    updated_at: new Date().toISOString(),
    clips
  };
  return next;
}

/**
 * Menjalankan QC + mencatat telemetri di item.result_json.
 * Mengembalikan instruksi tindakan: 'ok' | 'retry' | 'needs_review'.
 */
export async function evaluateAndRecordStartFrameQc({
  itemId,
  clipIndex,
  imagePath,
  campaign = null,
  item = null,
  attempt = 1,
  isRetry = false,
  mode = null,
  visionFn = null
} = {}) {
  const resolvedMode = resolveStartFrameQcMode(mode);
  if (resolvedMode === 'off') {
    return { action: 'ok', mode: 'off', pass: true, skipped: true };
  }

  const db = getDb();
  const activeItem = item || (itemId ? await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId) : null);
  if (!activeItem) return { action: 'ok', mode: resolvedMode, pass: true, skipped: true };
  const activeCampaign = campaign || await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(activeItem.campaign_id);

  const verdict = await inspectStartFrameFile({
    imagePath,
    campaign: activeCampaign || {},
    item: activeItem,
    clipIndex,
    mode: resolvedMode,
    visionFn
  });

  const maxAttempts = 1 + START_FRAME_QC_MAX_RETRIES;
  const shouldRetry = resolvedMode === 'enforce' && !verdict.pass && !verdict.skipped && attempt < maxAttempts;
  const shouldMarkNeedsReview = resolvedMode === 'enforce' && !verdict.pass && !verdict.skipped && !shouldRetry;

  const parsedResult = parseJson(activeItem.result_json, {});
  const updatedResult = mergeStartFrameQcTelemetry(parsedResult, {
    mode: resolvedMode,
    clipIndex,
    verdict,
    attempt,
    isRetry,
    needsReview: shouldMarkNeedsReview
  });

  await updatePillarCampaignItem(activeItem.id, {
    result_json: JSON.stringify(updatedResult),
    ...(shouldMarkNeedsReview ? {
      start_frame_status: 'needs_review',
      review_state: 'needs_review',
      review_reason: `Visual QC Klip #${clipIndex} gagal setelah ${START_FRAME_QC_MAX_RETRIES}x auto-retry: ${(verdict.reasons || []).join('; ') || 'Kualitas visual tidak memenuhi syarat'}`
    } : {})
  });

  if (shouldRetry) {
    return {
      action: 'retry',
      mode: resolvedMode,
      pass: false,
      nextAttempt: attempt + 1,
      verdict,
      updatedResultJson: updatedResult
    };
  }
  if (shouldMarkNeedsReview) {
    return {
      action: 'needs_review',
      mode: resolvedMode,
      pass: false,
      verdict,
      updatedResultJson: updatedResult
    };
  }
  return {
    action: 'ok',
    mode: resolvedMode,
    pass: Boolean(verdict.pass),
    verdict,
    updatedResultJson: updatedResult
  };
}

