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
import { generateWithImage, generateWithImages } from './gemini.js';
import { resolveProductReferenceRequirement } from './opc-start-frame-contract.js';
import { resolveBridgePlan, readBridgeInputs } from './bridging/bridge-plan.js';
import { resolveVideoVariety } from './metaphor-policy.js';

export const START_FRAME_QC_SETTING_KEY = 'start_frame_visual_qc';
export const START_FRAME_QC_BATCH_SETTING_KEY = 'start_frame_visual_qc_batch';
export const START_FRAME_QC_MAX_RETRIES = 2;
export const VALID_QC_MODES = new Set(['off', 'report_only', 'enforce']);
export const VALID_QC_BATCH_MODES = new Set(['off', 'shadow', 'on']);

export function resolveStartFrameQcBatchMode(explicitValue = null) {
  const candidate = explicitValue !== null && explicitValue !== undefined
    ? explicitValue
    : getSetting(START_FRAME_QC_BATCH_SETTING_KEY, false);
  const normalized = String(candidate || 'off').trim().toLowerCase();
  if (normalized === 'shadow') return 'shadow';
  if (normalized === 'on' || normalized === '1' || normalized === 'true') return 'on';
  return 'off';
}

export function isStartFrameQcBatchEnabled(explicitValue = null) {
  return resolveStartFrameQcBatchMode(explicitValue) !== 'off';
}

export const START_FRAME_QC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    hand_count: { type: 'integer' },
    awkward_anatomy: { type: 'boolean' },
    visible_face: { type: 'boolean' },
    exposed_forearm: { type: 'boolean' },
    wardrobe_color_match: { type: 'boolean' },
    pre_bridge_product: { type: 'boolean' },
    foreign_objects: { type: 'boolean' },
    weird_text_watermark: { type: 'boolean' },
    time_of_day_mismatch: { type: 'boolean' },
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
    'wardrobe_color_match',
    'pre_bridge_product',
    'foreign_objects',
    'weird_text_watermark',
    'metaphor_alignment_score',
    'reasons',
    'correction_hint'
  ]
};

export const START_FRAME_BATCH_QC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    clips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clip_index: { type: 'integer' },
          hand_count: { type: 'integer' },
          awkward_anatomy: { type: 'boolean' },
          visible_face: { type: 'boolean' },
          exposed_forearm: { type: 'boolean' },
          wardrobe_color_match: { type: 'boolean' },
          pre_bridge_product: { type: 'boolean' },
          foreign_objects: { type: 'boolean' },
          weird_text_watermark: { type: 'boolean' },
          time_of_day_mismatch: { type: 'boolean' },
          metaphor_alignment_score: { type: 'number' },
          reasons: {
            type: 'array',
            items: { type: 'string' }
          },
          correction_hint: { type: 'string' }
        },
        required: [
          'clip_index',
          'hand_count',
          'awkward_anatomy',
          'visible_face',
          'exposed_forearm',
          'wardrobe_color_match',
          'pre_bridge_product',
          'foreign_objects',
          'weird_text_watermark',
          'metaphor_alignment_score',
          'reasons',
          'correction_hint'
        ]
      }
    },
    cross_clip_consistency: {
      type: 'object',
      properties: {
        wardrobe_color_same_all_clips: { type: 'boolean' },
        wardrobe_outlier_clips: {
          type: 'array',
          items: { type: 'integer' }
        },
        location_consistent: { type: 'boolean' },
        location_outlier_clips: {
          type: 'array',
          items: { type: 'integer' }
        },
        consistency_notes: { type: 'string' }
      },
      required: [
        'wardrobe_color_same_all_clips',
        'wardrobe_outlier_clips',
        'location_consistent',
        'location_outlier_clips'
      ]
    }
  },
  required: ['clips', 'cross_clip_consistency']
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

function buildClipRuleSnippet({
  clipIndex = 1,
  isPreBridge = true,
  expectsProduct = false,
  expectsObjectOnly = false,
  handsPolicy = 'zero_hands',
  objectWorld = '',
  cleanResultWorld = '',
  productName = '',
  expectedWardrobeLabel = '',
  isRecipeGenre = false,
  environmentPolicy = '',
  sceneBrief = null
} = {}) {
  const isPlannerDriven = environmentPolicy === 'planner_driven' || (Boolean(sceneBrief) && environmentPolicy !== 'metaphor_world_override');
  const handRule = expectsObjectOnly
    ? 'Opening hook frame MUST have 0 human hands, fingers, or arms (hand_count MUST be 0). Flag exposed_forearm=true or reasons if any hand/arm appears.'
    : (handsPolicy === 'modest_hands_active'
        ? 'At most 2 hands from 1 person are allowed; upper frame MUST crop below shoulders (no collarbones/shoulders/chin/head); both forearms and wrists MUST be completely covered by opaque long sleeves (flag exposed_forearm=true if skin shows above the wrist or sleeves are rolled up).'
        : 'Flag if >2 hands, detached hands, or uncovered bare arms appear.');

  const isKitchenScene = isPlannerDriven && /kitchen|dapur|pantry|dining|makan/i.test(`${sceneBrief?.location_en || ''} ${sceneBrief?.location_id || ''}`);
  const productRule = isPreBridge && !expectsProduct
    ? `PRE-BRIDGE FRAME: Commercial bottles, labelled jars, glass spice/condiment jars, amber bottles, caps, boxes, or skincare/supplement packaging MUST NOT appear (flag pre_bridge_product=true if seen${isKitchenScene ? '; in pre-bridge kitchen/pantry/dining backgrounds keep counters free of glass jars or bottles' : ''}).`
    : (expectsProduct
        ? `PRODUCT/HERO FRAME (expects_product=true${productName ? ` for "${productName}"` : ''}): The featured product bottle/jar AND natural core ingredients that form the product (such as honey, solo garlic cloves, or herbal oil/extracts matching the brand) are EXPECTED and VALID. ALWAYS set pre_bridge_product=false when authentic product packaging or product ingredients appear here. Do NOT flag the featured product or its ingredients as foreign_objects. Still flag garbled gibberish overlaid UI text or surreal AI artifacts.`
        : 'CLEAN CONTINUITY FRAME: Check whether unrequested commercial jars/bottles or unrelated packaging appear unexpectedly.');

  const expectedSceneState = isPlannerDriven && sceneBrief
    ? `${sceneBrief.location_en || sceneBrief.location_id || 'Planned home setting'}${Array.isArray(sceneBrief.props) && sceneBrief.props.length ? ` (valid room props: ${sceneBrief.props.join(', ')})` : ''}`
    : (expectsProduct
        ? (cleanResultWorld || objectWorld || 'Clean calm tabletop result paired with featured product')
        : (objectWorld || 'Focused everyday metaphor demonstration'));

  const driftRule = isRecipeGenre
    ? 'Flag foreign_objects=true only for surreal or completely corrupted unrelated props.'
    : (isPlannerDriven
        ? `Planner-Driven World (${expectedSceneState}): Normal domestic furniture, room appliances, cookware, sink/bedside props, curtains, framed wall photos, or TV/laptop screens fitting this planned room are EXPECTED — NEVER mark them as foreign_objects. Flag foreign_objects=true ONLY if a completely unrelated surreal studio void, raw-herb pile out of nowhere, or corrupted hallucinated artifact breaks the room.`
        : (expectsProduct
            ? `Expected Hero/Bridge State: "${expectedSceneState}". Notice the featured product jar/bottle and its natural product ingredients (e.g., honey, solo garlic) ARE part of this scene — do NOT expect dirty pre-bridge clutter and do NOT mark authentic product or its ingredients as foreign_objects. Flag foreign_objects=true ONLY for completely off-topic random clutter or chaotic raw-herb chopping piles.`
            : `Expected Metaphor World: "${expectedSceneState}". Flag foreign_objects=true if the scene drifts off into unrelated culinary herb chopping, raw spices/ginger piles, or random objects not belonging to the metaphor world.`));

  const wardrobeRule = (handsPolicy === 'modest_hands_active' && !expectsObjectOnly)
    ? `Expected solid plain sleeves matching "${expectedWardrobeLabel || 'single solid plain neutral long sleeve'}". Set wardrobe_color_match=false if sleeves show stripes, floral/knit prints, bright contrasting patterns, or a clearly different fabric color from "${expectedWardrobeLabel || 'the locked solid color'}"; otherwise true (also true if sleeves are outside close-up edge).`
    : 'Object-only or no locked wardrobe: set wardrobe_color_match=true.';

  const faceRule = isPlannerDriven
    ? 'visible_face: true ONLY if an actual live foreground talent/person face, eyes, nose, mouth, or head profile is visible. Do NOT flag tiny faces inside framed wall photos, TV screens, or laptop screens as visible_face.'
    : 'visible_face: true if any human face, eyes, nose, mouth, or partial head profile is visible.';

  const timeRule = sceneBrief?.time_key === 'night'
    ? 'time_of_day_mismatch (report_only): true if bright morning/daytime sunlight or blue sky streams through uncovered windows instead of night ambiance (dark curtains/opaque night window + warm interior lamp); otherwise false.'
    : 'time_of_day_mismatch: false unless blatantly contradictory daylight/midnight error exists.';

  return {
    isPlannerDriven,
    handRule,
    productRule,
    expectedSceneState,
    driftRule,
    wardrobeRule,
    faceRule,
    timeRule
  };
}

export function buildStartFrameQcPrompt({
  clipIndex = 1,
  totalClips = 6,
  isPreBridge = true,
  expectsProduct = false,
  expectsObjectOnly = false,
  handsPolicy = 'zero_hands',
  objectWorld = '',
  cleanResultWorld = '',
  productName = '',
  expectedWardrobeLabel = '',
  isRecipeGenre = false,
  environmentPolicy = '',
  sceneBrief = null
} = {}) {
  const rules = buildClipRuleSnippet({
    clipIndex,
    isPreBridge,
    expectsProduct,
    expectsObjectOnly,
    handsPolicy,
    objectWorld,
    cleanResultWorld,
    productName,
    expectedWardrobeLabel,
    isRecipeGenre,
    environmentPolicy,
    sceneBrief
  });

  return `You are a strict visual Quality Control inspector auditing AI-generated start frame #${clipIndex} of ${totalClips}.
Evaluate ONLY what is actually visible inside the attached image. Be objective and conservative against AI hallucinations.

Checklist Rules:
1. hand_count: Count visible human hands. Fail if >2 hands appear${expectsObjectOnly ? ', or if ANY hand (>0) appears in this Clip 1 opening object-only hook' : ''}.
2. awkward_anatomy: true if fused fingers, extra fingers (>5 per hand), twisted wrists, floating disembodied limbs, or distorted hand geometry exist.
3. ${rules.faceRule}
4. exposed_forearm: true if bare human wrist/forearm skin above the wrist or rolled-up sleeves are visible. ${rules.handRule}
5. wardrobe_color_match: ${rules.wardrobeRule}
6. pre_bridge_product: ${rules.productRule}
7. foreign_objects: ${rules.driftRule}
8. weird_text_watermark: true if distorted gibberish text, AI watermarks, stock logos, or random floating UI captions appear.
9. ${rules.timeRule}
10. metaphor_alignment_score: float from 0.0 (completely wrong subject/broken) to 1.0 (cleanly matches the scene brief/metaphor & lighting quality).
11. reasons: short, specific plain-language list of detected defects (empty array [] if clean pass).
12. correction_hint: concise positive-framing visual fix instruction (NO negative phrases like "no hands/no bottle"; e.g. "tight chest-down tabletop close-up below shoulders focusing on both gloved/long-sleeved hands with the ceramic cup in warm evening light") to help regenerate if defective.

Return strictly JSON matching the schema.`;
}

export function evaluateQcChecklistVerdict(checklist = {}, context = {}) {
  const c = checklist && typeof checklist === 'object' ? checklist : {};
  const handCount = Number.isFinite(Number(c.hand_count)) ? Number(c.hand_count) : 0;
  const score = Number.isFinite(Number(c.metaphor_alignment_score)) ? Number(c.metaphor_alignment_score) : 0.7;
  const expectsObjectOnly = Boolean(context.expectsObjectOnly);
  const expectsProduct = Boolean(context.expectsProduct);
  const isPreBridge = Boolean(context.isPreBridge) && !expectsProduct;
  const handsPolicy = context.handsPolicy || 'zero_hands';
  const effectivePreBridgeProduct = Boolean(isPreBridge && c.pre_bridge_product);
  const batchWardrobeOutlier = Boolean(context.batchWardrobeOutlier && handsPolicy === 'modest_hands_active' && !expectsObjectOnly);
  const batchLocationOutlier = Boolean(context.batchLocationOutlier && !expectsProduct);
  const timeMismatch = Boolean(c.time_of_day_mismatch);

  const rawReasons = Array.isArray(c.reasons) ? c.reasons.filter(Boolean).map(String) : [];
  const derivedReasons = expectsProduct
    ? rawReasons.filter(r => !/pre-bridge|unexpected.*(bottle|jar|product|packaging)/i.test(r))
    : [...rawReasons];

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
  const wardrobeMismatch = Boolean(handsPolicy === 'modest_hands_active' && !expectsObjectOnly && (c.wardrobe_color_match === false || batchWardrobeOutlier));
  if (wardrobeMismatch && !derivedReasons.some(r => /wardrobe|pattern|motif|warna baju|sleeve color|wardrobe_mismatch/i.test(r))) {
    derivedReasons.push(
      batchWardrobeOutlier
        ? `wardrobe_mismatch: Sleeve color/fabric differs from sibling clips (expected ${context.expectedWardrobeLabel || 'locked brand color'})`
        : `wardrobe_mismatch: Wardrobe sleeve mismatches solid plain ${context.expectedWardrobeLabel || 'brand color'}`
    );
  }
  if (batchLocationOutlier && !derivedReasons.some(r => /location|room|latar|ruangan|consistent/i.test(r))) {
    derivedReasons.push('Location/room aesthetic drifts sharply from sibling clips');
  }
  if (effectivePreBridgeProduct && !derivedReasons.some(r => /product|bottle|jar|kemasan/i.test(r))) {
    derivedReasons.push('Pre-bridge frame shows commercial bottle/jar packaging');
  }
  if (c.foreign_objects && !derivedReasons.some(r => /foreign|drift|herb|asing/i.test(r))) {
    derivedReasons.push('Foreign/off-metaphor objects detected');
  }
  if (c.weird_text_watermark && !derivedReasons.some(r => /text|watermark|teks/i.test(r))) {
    derivedReasons.push('Distorted text or watermark artifact detected');
  }
  if (timeMismatch && !derivedReasons.some(r => /time_of_day_mismatch|daylight|night|siang|malam/i.test(r))) {
    derivedReasons.push('time_of_day_mismatch (report_only): Night scene appears brightly sunlit instead of night ambiance');
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
    wardrobeMismatch ||
    batchLocationOutlier ||
    effectivePreBridgeProduct ||
    c.foreign_objects ||
    c.weird_text_watermark ||
    score < 0.45
  );

  return {
    pass: !failed,
    severity: !failed ? 'pass' : (c.awkward_anatomy || c.visible_face || effectivePreBridgeProduct || handCount > 2 || (expectsObjectOnly && handCount > 0) ? 'fail' : 'minor_fail'),
    reasons: (failed || timeMismatch) ? derivedReasons : [],
    metrics: {
      hand_count: handCount,
      awkward_anatomy: Boolean(c.awkward_anatomy),
      visible_face: Boolean(c.visible_face),
      exposed_forearm: Boolean(c.exposed_forearm),
      wardrobe_color_match: !wardrobeMismatch,
      wardrobe_mismatch: wardrobeMismatch,
      pre_bridge_product: effectivePreBridgeProduct,
      foreign_objects: Boolean(c.foreign_objects),
      weird_text_watermark: Boolean(c.weird_text_watermark),
      time_of_day_mismatch: timeMismatch,
      batch_location_outlier: batchLocationOutlier,
      metaphor_alignment_score: score
    },
    correction_hint: String(c.correction_hint || '').trim()
  };
}

export function deriveQcContext({ campaign = {}, item = {}, clipIndex = 1 } = {}) {
  const parsedResult = parseJson(item?.result_json, {});
  const policy = campaign?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
  const kit = parsedResult?.resolved_health_metaphor?.kit || campaign?.resolved_health_metaphor?.kit || null;
  const sceneBrief = parsedResult?.resolved_scene_brief || campaign?.resolved_scene_brief || item?.resolved_scene_brief || null;
  const environmentPolicy = sceneBrief?.environment_policy || campaign?.environment?.policy || (sceneBrief ? 'planner_driven' : '');
  const bridgePlan = resolveBridgePlan(readBridgeInputs(campaign || {}, {}, { defaultActive: Boolean(campaign?.is_bridging_active) }));
  const cIdx = Number(clipIndex) || 1;
  const zone = bridgePlan.zoneOf(cIdx);
  const req = resolveProductReferenceRequirement({ campaign, item, clipIndex: cIdx });
  const isMetaphoric = campaign?.visual_style === 'metaphoric_faceless' || Boolean(policy?.active);
  const metaphorMode = policy?.mode || (isMetaphoric ? 'full_metaphor' : 'off');
  const handsPolicy = policy?.handsPolicy || (environmentPolicy === 'planner_driven' ? 'modest_hands_active' : 'zero_hands');
  const expectsObjectOnly = (isMetaphoric || metaphorMode === 'hook_only') && (cIdx === 1 || handsPolicy === 'zero_hands');
  const savedWardrobe = parsedResult?.resolved_wardrobe_color || campaign?.resolved_wardrobe_color;
  const fallbackVariety = (item?.id || campaign?.id) ? resolveVideoVariety(item?.id || campaign?.id) : null;
  const expectedWardrobeLabel = (handsPolicy === 'modest_hands_active' && !expectsObjectOnly)
    ? (savedWardrobe?.label || fallbackVariety?.wardrobeColorLabel || '')
    : '';

  return {
    clipIndex: cIdx,
    totalClips: bridgePlan.targetClips || Number(campaign?.target_clips_count) || 6,
    isPreBridge: zone === 'pre' && !req.required,
    expectsProduct: Boolean(req.required),
    expectsObjectOnly,
    handsPolicy,
    metaphorMode,
    environmentPolicy,
    sceneBrief,
    objectWorld: policy?.objectWorld || kit?.object_world || '',
    cleanResultWorld: kit?.beats?.result || kit?.beats?.bridge || policy?.beats?.result || '',
    productName: campaign?.product_name || item?.product_name || parsedResult?.product_name || '',
    expectedWardrobeLabel,
    isRecipeGenre: kit?.genre === 'recipe' || campaign?.campaign_focus === 'recipe_campaign'
  };
}

export function buildStartFrameBatchQcPrompt({ clipContexts = [], campaign = {}, item = {} } = {}) {
  const totalClips = clipContexts.length || Number(campaign?.target_clips_count) || 6;
  const firstSceneBrief = clipContexts.find(c => c.sceneBrief)?.sceneBrief || null;
  const isPlannerDriven = clipContexts.some(c => c.environmentPolicy === 'planner_driven' || Boolean(c.sceneBrief));
  const sharedWardrobe = clipContexts.find(c => c.expectedWardrobeLabel)?.expectedWardrobeLabel || '';

  const perClipDirectives = clipContexts.map(ctx => {
    const r = buildClipRuleSnippet(ctx);
    const clipTags = [
      ctx.expectsObjectOnly ? 'HOOK_OBJECT_ONLY(hand_count=0)' : `HANDS(${ctx.handsPolicy}, max 2 hands, chest-down below shoulders)`,
      ctx.expectsProduct ? `PRODUCT_ALLOWED(${ctx.productName || 'featured product'})` : (ctx.isPreBridge ? 'PRE_BRIDGE(NO bottle/jar/packaging)' : 'CLEAN_CONTINUITY'),
      r.isPlannerDriven ? 'PLANNER_DRIVEN_ROOM' : 'METAPHOR_WORLD'
    ].join(' | ');
    return `- Clip #${ctx.clipIndex}: [${clipTags}] -> Scene: "${r.expectedSceneState}". ${ctx.expectsObjectOnly ? r.handRule : r.wardrobeRule} ${ctx.sceneBrief?.time_key === 'night' ? r.timeRule : ''}`.trim();
  }).join('\n');

  return `You are a strict Visual Quality Control inspector auditing ALL ${totalClips} attached start frames (labeled Clip #1 through Clip #${totalClips}) of a single video in ONE batch.
Evaluate ONLY what is actually visible inside each labeled image, and also check cross-clip visual consistency across the sequence.

Per-Clip Context & Rules:
${perClipDirectives}

Core Per-Clip Rules:
1. hand_count & awkward_anatomy: Hook clip (HOOK_OBJECT_ONLY) MUST have 0 hands. Live-action clips allow at most 2 hands from 1 person, anatomically clean (5 fingers/hand).
2. visible_face: ${isPlannerDriven ? 'true ONLY if a foreground/talent human face/head is visible. Do NOT flag tiny faces inside framed wall photos, TVs, or laptop screens.' : 'true if any human face, eyes, nose, mouth, or head profile appears.'}
3. exposed_forearm: true if bare wrists/forearms above the wrist or rolled-up sleeves appear; sleeves must cover wrists cleanly.
4. wardrobe_color_match: ${sharedWardrobe ? `All live-action clips with hands/sleeves MUST wear solid plain sleeves matching "${sharedWardrobe}" (flag false if stripes/floral/prints or a different color appear).` : 'Check solid plain modest sleeves across live-action clips.'}
5. pre_bridge_product: Flag true on PRE_BRIDGE clips if ANY commercial bottle, jar, glass spice container, packaging, or product label appears. Always false on PRODUCT_ALLOWED clips for authentic featured product/ingredients.
6. foreign_objects: ${isPlannerDriven ? 'Room furniture, appliances, cookware, sink/bedside props, curtains, framed photos, and laptop/TV screens belonging to the planned room are VALID (false). Flag true ONLY for surreal studio voids, chaotic raw-herb piles, or broken artifacts.' : 'Flag true if scene drifts off the expected metaphor world into unrelated culinary herb chopping or random clutter.'}
7. weird_text_watermark: true if gibberish overlaid text, AI watermarks, or fake UI captions appear.
8. time_of_day_mismatch: ${firstSceneBrief?.time_key === 'night' ? 'true if night scene shows bright sunlit windows/daylight instead of night lighting with dark/drawn curtains and warm indoor lamp.' : 'false unless blatantly wrong time of day.'}
9. metaphor_alignment_score: 0.0 to 1.0 per clip.
10. reasons & correction_hint: clear defect reasons ([] if pass) and positive-framing fix hint for any failed clip.

Cross-Clip Consistency Rules (cross_clip_consistency):
- wardrobe_color_same_all_clips: true if ALL clips that show sleeves/clothing wear the same consistent color & plain fabric; false if 1+ clips visibly switched garment color or pattern, and list those outlier clip numbers in wardrobe_outlier_clips.
- location_consistent: true if the clips belong to a coherent setting/time progression matching the narrative; false if an outlier clip jumps into an incongruous/broken environment, and list outlier clip numbers in location_outlier_clips.

Return strictly JSON matching the schema with an entry for every clip_index attached.`;
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
  const traceContext = {
    campaign_id: campaign?.id || item?.campaign_id || null,
    item_id: item?.id || null,
    stage: 'start_frame_visual_qc',
    clip_index: Number(clipIndex) || 1
  };

  try {
    const rawResponse = typeof visionFn === 'function'
      ? await visionFn(buffer, mimeType, prompt, START_FRAME_QC_RESPONSE_SCHEMA)
      : await generateWithImage(buffer, mimeType, prompt, START_FRAME_QC_RESPONSE_SCHEMA, null, { traceContext });
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

export async function evaluateBatchStartFramesQc({
  clipEntries = [],
  campaign = {},
  item = {},
  mode = null,
  visionFn = null
} = {}) {
  const resolvedMode = resolveStartFrameQcMode(mode);
  if (resolvedMode === 'off') {
    return { ok: true, skipped: true, mode: 'off', verdictsByClip: {}, crossClipConsistency: null, callsUsed: 0 };
  }

  const images = [];
  const clipContexts = [];
  for (const entry of (clipEntries || [])) {
    const clipIndex = Number(entry?.clipIndex);
    const absPath = resolveAbsoluteImagePath(entry?.imagePath);
    if (!clipIndex || !absPath || !fs.existsSync(absPath)) continue;
    const buffer = fs.readFileSync(absPath);
    const mimeType = detectImageMime(buffer, absPath);
    images.push({ clipIndex, buffer, mimeType, label: `Clip #${clipIndex}` });
    clipContexts.push(deriveQcContext({ campaign, item, clipIndex }));
  }

  if (images.length === 0) {
    return { ok: false, fallbackRequired: true, error: 'No readable start frame images on disk', verdictsByClip: {}, callsUsed: 0 };
  }

  const prompt = buildStartFrameBatchQcPrompt({ clipContexts, campaign, item });
  const traceContext = {
    campaign_id: campaign?.id || item?.campaign_id || null,
    item_id: item?.id || null,
    stage: 'start_frame_visual_qc_batch'
  };

  try {
    const rawResponse = typeof visionFn === 'function'
      ? await visionFn(images, prompt, START_FRAME_BATCH_QC_RESPONSE_SCHEMA)
      : await generateWithImages(images, prompt, START_FRAME_BATCH_QC_RESPONSE_SCHEMA, null, { traceContext });

    const parsedBatch = parseJson(rawResponse, null);
    if (!parsedBatch || !Array.isArray(parsedBatch.clips) || parsedBatch.clips.length === 0) {
      throw new Error('Invalid or empty clips array returned by Batch Vision QC');
    }

    const crossClip = parsedBatch.cross_clip_consistency || {
      wardrobe_color_same_all_clips: true,
      wardrobe_outlier_clips: [],
      location_consistent: true,
      location_outlier_clips: []
    };
    const wardrobeOutliers = new Set((crossClip.wardrobe_outlier_clips || []).map(Number).filter(Boolean));
    const locationOutliers = new Set((crossClip.location_outlier_clips || []).map(Number).filter(Boolean));

    const verdictsByClip = {};
    for (const ctx of clipContexts) {
      const checklist = parsedBatch.clips.find(c => Number(c.clip_index) === ctx.clipIndex);
      if (!checklist) {
        throw new Error(`Batch Vision QC omitted clip_index ${ctx.clipIndex}`);
      }
      const enrichedCtx = {
        ...ctx,
        batchWardrobeOutlier: crossClip.wardrobe_color_same_all_clips === false && wardrobeOutliers.has(ctx.clipIndex),
        batchLocationOutlier: crossClip.location_consistent === false && locationOutliers.has(ctx.clipIndex)
      };
      const verdict = evaluateQcChecklistVerdict(checklist, enrichedCtx);
      verdictsByClip[ctx.clipIndex] = {
        skipped: false,
        mode: resolvedMode,
        ...verdict,
        context: {
          clipIndex: ctx.clipIndex,
          isPreBridge: ctx.isPreBridge,
          expectsProduct: ctx.expectsProduct,
          expectsObjectOnly: ctx.expectsObjectOnly
        },
        checked_at: new Date().toISOString()
      };
    }

    return {
      ok: true,
      skipped: false,
      mode: resolvedMode,
      verdictsByClip,
      crossClipConsistency: crossClip,
      callsUsed: 1
    };
  } catch (err) {
    console.warn(`[StartFrameQC Batch] Batch vision audit failed; falling back to per-clip QC for item #${item?.id}:`, err.message);
    return {
      ok: false,
      fallbackRequired: true,
      mode: resolvedMode,
      error: err.message,
      verdictsByClip: {},
      crossClipConsistency: null,
      callsUsed: 0
    };
  }
}

export async function evaluateStartFrameRetryWithReference({
  clipIndex,
  imagePath,
  referenceClipIndex = null,
  referenceClipPath = null,
  campaign = {},
  item = {},
  mode = null,
  visionFn = null
} = {}) {
  const resolvedMode = resolveStartFrameQcMode(mode);
  if (resolvedMode === 'off') {
    return { skipped: true, mode: 'off', pass: true, reasons: [], metrics: null, correction_hint: '' };
  }

  const context = deriveQcContext({ campaign, item, clipIndex });
  const absRetry = resolveAbsoluteImagePath(imagePath);
  if (!absRetry || !fs.existsSync(absRetry)) {
    return {
      skipped: true,
      mode: resolvedMode,
      pass: true,
      error: `Retried image not found on disk: ${imagePath}`,
      reasons: [],
      metrics: null,
      correction_hint: ''
    };
  }

  const retryBuf = fs.readFileSync(absRetry);
  const retryMime = detectImageMime(retryBuf, absRetry);
  const absRef = referenceClipPath ? resolveAbsoluteImagePath(referenceClipPath) : '';
  const hasRef = Boolean(absRef && fs.existsSync(absRef) && Number(referenceClipIndex) !== Number(clipIndex));

  if (!hasRef) {
    return await inspectStartFrameFile({ imagePath, campaign, item, clipIndex, mode: resolvedMode, visionFn });
  }

  const refBuf = fs.readFileSync(absRef);
  const refMime = detectImageMime(refBuf, absRef);
  const basePrompt = buildStartFrameQcPrompt(context);
  const comparisonPrompt = `${basePrompt}

REFERENCE COMPARISON MODE:
You are given TWO images:
- Image 1: Retried Clip #${clipIndex} (the ONLY clip you are scoring in JSON).
- Image 2: Passing Reference Clip #${referenceClipIndex} from the same video.
Compare Image 1 against Image 2 for sleeve color/plain fabric continuity${context.expectedWardrobeLabel ? ` (${context.expectedWardrobeLabel})` : ''} and room/lighting continuity. If Image 1 wears a visibly different garment color or pattern from Image 2 (on a sleeved hand clip), set wardrobe_color_match=false.`;

  const images = [
    { buffer: retryBuf, mimeType: retryMime, label: `Retried Clip #${clipIndex} (AUDIT THIS IMAGE)` },
    { buffer: refBuf, mimeType: refMime, label: `Passing Reference Clip #${referenceClipIndex} (BASELINE FOR CONSISTENCY)` }
  ];

  const traceContext = {
    campaign_id: campaign?.id || item?.campaign_id || null,
    item_id: item?.id || null,
    stage: 'start_frame_visual_qc_retry_compare',
    clip_index: Number(clipIndex) || 1
  };

  try {
    const rawResponse = typeof visionFn === 'function'
      ? await visionFn(images, comparisonPrompt, START_FRAME_QC_RESPONSE_SCHEMA)
      : await generateWithImages(images, comparisonPrompt, START_FRAME_QC_RESPONSE_SCHEMA, null, { traceContext });

    const parsedChecklist = parseJson(rawResponse, null);
    if (!parsedChecklist || typeof parsedChecklist !== 'object') {
      throw new Error('Invalid JSON returned by Retry Comparison Vision QC');
    }
    const verdict = evaluateQcChecklistVerdict(parsedChecklist, context);
    return {
      skipped: false,
      mode: resolvedMode,
      compared_against_clip: Number(referenceClipIndex),
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
    console.warn(`[StartFrameQC RetryCompare] Failed non-fatally for item #${item?.id} clip ${clipIndex}:`, err.message);
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

export function compareBatchVsPerClipQc({ perClipVerdicts = {}, batchVerdicts = {} } = {}) {
  const clipKeys = Array.from(new Set([
    ...Object.keys(perClipVerdicts || {}),
    ...Object.keys(batchVerdicts || {})
  ])).sort((a, b) => Number(a) - Number(b));

  const disagreements = [];
  let agreementCount = 0;

  for (const key of clipKeys) {
    const single = perClipVerdicts[key];
    const batch = batchVerdicts[key];
    if (!single || !batch) continue;
    const singlePass = Boolean(single.pass);
    const batchPass = Boolean(batch.pass);
    if (singlePass === batchPass) {
      agreementCount += 1;
    } else {
      disagreements.push({
        clip_index: Number(key),
        per_clip_pass: singlePass,
        batch_pass: batchPass,
        per_clip_reasons: single.reasons || [],
        batch_reasons: batch.reasons || []
      });
    }
  }

  const compared = agreementCount + disagreements.length;
  return {
    clips_compared: compared,
    agreement_count: agreementCount,
    disagreement_count: disagreements.length,
    agreement_rate: compared > 0 ? Number((agreementCount / compared).toFixed(3)) : 1,
    disagreements
  };
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
    compared_against_clip: verdict.compared_against_clip || prevClip.compared_against_clip || null,
    reasons: Array.isArray(verdict.reasons) ? verdict.reasons : [],
    correction_hint: verdict.correction_hint || '',
    metrics: verdict.metrics || null,
    error: verdict.error || null,
    checked_at: verdict.checked_at || new Date().toISOString()
  };

  const clipList = Object.values(clips);
  const callsIncrement = verdict.skipped ? 0 : 1;

  next.start_frame_qc = {
    ...existing,
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

export function mergeBatchStartFrameQcTelemetry(resultJsonObj = {}, {
  mode = 'off',
  verdictsByClip = {},
  crossClipConsistency = null,
  callsUsed = 1,
  fallbackToPerClip = false,
  shadowDiff = null
} = {}) {
  const next = resultJsonObj && typeof resultJsonObj === 'object' ? { ...resultJsonObj } : {};
  const existing = next.start_frame_qc && typeof next.start_frame_qc === 'object' ? next.start_frame_qc : {};
  const clips = { ...(existing.clips || {}) };

  for (const [clipIdx, verdict] of Object.entries(verdictsByClip || {})) {
    const prevClip = clips[String(clipIdx)] || { attempts: 1 };
    clips[String(clipIdx)] = {
      clip_index: Number(clipIdx),
      pass: Boolean(verdict.pass),
      needs_review: Boolean(prevClip.needs_review),
      attempts: Math.max(Number(prevClip.attempts || 1), 1),
      reasons: Array.isArray(verdict.reasons) ? verdict.reasons : [],
      correction_hint: verdict.correction_hint || '',
      metrics: verdict.metrics || null,
      error: verdict.error || null,
      checked_at: verdict.checked_at || new Date().toISOString()
    };
  }

  const clipList = Object.values(clips);
  next.start_frame_qc = {
    ...existing,
    mode,
    batch_enabled: !fallbackToPerClip,
    fallback_to_per_clip: Boolean(fallbackToPerClip),
    cross_clip_consistency: crossClipConsistency || existing.cross_clip_consistency || null,
    ...(shadowDiff ? { shadow_diff: shadowDiff } : {}),
    calls: Number(existing.calls || 0) + Number(callsUsed || 0),
    retries: Number(existing.retries || 0),
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
  visionFn = null,
  referenceClipIndex = null,
  referenceClipPath = null
} = {}) {
  const resolvedMode = resolveStartFrameQcMode(mode);
  if (resolvedMode === 'off') {
    return { action: 'ok', mode: 'off', pass: true, skipped: true };
  }

  const db = getDb();
  const activeItem = item || (itemId ? await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId) : null);
  if (!activeItem) return { action: 'ok', mode: resolvedMode, pass: true, skipped: true };
  const activeCampaign = campaign || await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(activeItem.campaign_id);

  const verdict = (isRetry && referenceClipPath && Number(referenceClipIndex) !== Number(clipIndex))
    ? await evaluateStartFrameRetryWithReference({
        clipIndex,
        imagePath,
        referenceClipIndex,
        referenceClipPath,
        campaign: activeCampaign || {},
        item: activeItem,
        mode: resolvedMode,
        visionFn
      })
    : await inspectStartFrameFile({
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

