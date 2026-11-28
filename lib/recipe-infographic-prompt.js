import { normalizeInfographicTemplateId } from './recipe-infographic-renderer.js';

/**
 * Prompt builder and response normalizer for Recipe Labs Infographic mode (Option A: Hybrid).
 * Adapts T2I image generation count to the chosen template to save G-Labs quota.
 */

function getPhotoGuardrail(handMode = 'objects_only') {
  if (handMode === 'wrist_only') {
    return '[CLEAN MACRO FOOD PHOTOGRAPHY ONLY: TIGHT CLOSE-UP ZOOM TO BOWL/PLATE RIM. At most clean bare wrist-to-hand only with consistent warm tan Indonesian skin tone and natural clean short nails. STRICTLY NO sleeves, NO sweaters, NO shirts, NO bracelets, NO watches, NO elbows, NO forearms, NO faces. NO TEXT, NO LETTERS, NO NUMBERS, NO LABELS, NO WATERMARKS]';
  }
  return '[CLEAN MACRO FOOD PHOTOGRAPHY ONLY: STRICTLY OBJECT-ONLY STILL LIFE. Show only cookware, utensils, ingredients, and food. ZERO HANDS, ZERO ARMS, ZERO WRISTS, ZERO FINGERS, ZERO SLEEVES, ZERO CLOTHING, ZERO PEOPLE. NO TEXT, NO LETTERS, NO NUMBERS, NO LABELS, NO WATERMARKS]';
}

const MACRO_LIGHTING_MODIFIER = 'tight close-up macro food photography framing (100mm macro lens feel, dish/bowl fills 75%+ of frame), high-key bright diffused dual-softbox studio daylight lighting, lifted shadows revealing crisp surface crumb/glaze/ingredient details even on dark chocolate or cocoa foods, zero harsh muddiness';

export function getTemplateImageSpec(templateId) {
  const normalized = normalizeInfographicTemplateId(templateId);
  switch (normalized) {
    case 'compact_2col_cheat_sheet':
    case 'centerpiece_spotlight':
      return { template: normalized, mode: 'hero_only', stepPhotoCount: 0, textStepCount: 6 };
    case 'hero_right_editorial':
    case 'layered_band_cards':
      return { template: normalized, mode: 'hero_and_detail', stepPhotoCount: 0, textStepCount: 4 };
    case 'magazine_vertical_split':
    case 'polaroid_scrapbook':
      return { template: normalized, mode: 'step_photos', stepPhotoCount: 3, textStepCount: 4 };
    case 'step_timeline_zigzag':
      return { template: normalized, mode: 'step_photos', stepPhotoCount: 4, textStepCount: 4 };
    case 'visual_ingredient_shelf':
    case 'step_grid_classic':
    default:
      return { template: normalized, mode: 'step_photos', stepPhotoCount: 6, textStepCount: 6 };
  }
}

/**
 * Builds the Gemini system prompt for producing structured infographic recipe JSON + social captions.
 */
export function buildInfographicRecipeSystemPrompt({
  recipeClassification = 'Makanan',
  targetTopic = null,
  targetLang = 'id_ID',
  envObj = {},
  infographicTemplate = 'step_grid_classic',
  handMode = 'objects_only',
  curatedRecipe = null,
  optionalProduct = null,
  deconstructContext = ''
} = {}) {
  const spec = getTemplateImageSpec(infographicTemplate);
  const surface = envObj?.surface || 'pristine bright white Carrara marble countertop';
  const lighting = envObj?.lighting || 'high-key bright diffused dual-softbox studio daylight macro lighting';
  const props = envObj?.props || 'clean matte ceramic bowls, brushed steel utensils, fresh culinary herbs';
  const styleName = envObj?.name || 'Modern Minimalist Nordic Studio';
  const photoGuardrail = getPhotoGuardrail(handMode);
  const framingRule = handMode === 'wrist_only'
    ? 'Frame tightly on the bowl/plate rim (100mm macro close-up zoom). If hand interaction helps show an action, show ONLY one clean bare wrist-to-hand (consistent warm tan Indonesian skin, zero sleeves/sweaters/shirts/bracelets/watches).'
    : 'Frame tightly on the dish/bowl/ingredients (100mm macro close-up zoom). STRICTLY OBJECT-ONLY STILL LIFE: depict cookware, whisks/spoons in bowls, sifter dusting flour/cocoa, baking pans, and plated food cleanly WITHOUT ANY human hands, wrists, arms, sleeves, or people.';

  const isIndonesian = targetLang === 'id_ID' || targetLang === 'bilingual';
  const langRule = targetLang === 'id_ID'
    ? 'Seluruh judul, pita subjudul, hook, bahan-bahan, langkah memasak, tips, dan caption media sosial WAJIB menggunakan Bahasa Indonesia yang natural, hangat, dan menggugah selera. Semua prompt gambar T2I (hero_prompt & steps[].t2i_prompt) tetap dalam Bahasa Inggris.'
    : (targetLang === 'bilingual'
      ? 'Gunakan hook & subjudul Bilingual (English + Indonesia), namun daftar bahan, langkah, tips, dan body caption dalam Bahasa Indonesia yang jelas. Prompt gambar T2I dalam Bahasa Inggris.'
      : 'Write title, subtitle_ribbon, hook_badge, ingredients, steps, tips, and social captions in natural appetizing English. T2I prompts in English.');

  let recipeSourceBlock = '';
  if (curatedRecipe) {
    recipeSourceBlock = `
[AUTHORITATIVE RECIPE LIBRARY LOCK — STRICT FIDELITY]
You MUST base this infographic strictly on the curated recipe below from our Recipe Library.
- Original Authoritative Dish Name: "${curatedRecipe.original_title || curatedRecipe.title}"
- Display Headline Reference: "${curatedRecipe.title}"
${curatedRecipe.summary ? `- Authoritative Dish Summary: "${curatedRecipe.summary}"` : ''}
- Servings: "${curatedRecipe.servings || '4 porsi'}" | Prep: "${curatedRecipe.prep_time || '15 menit'}" | Cook: "${curatedRecipe.cook_time || '20 menit'}"
- Authoritative Ingredients (DO NOT alter quantities or invent unrelated ingredients; keep all measurements accurate, no duplicates):
${curatedRecipe.ingredients.map(i => `  * ${i}`).join('\n')}
- Authoritative Instructions (condense/split into ${spec.textStepCount} clear concise steps matching the exact sequence):
${curatedRecipe.steps.map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')}
CRITICAL TRUTH CHECK: Always inspect "Original Authoritative Dish Name" + ALL instructions together to determine the true baked/cooked form (for example, "Coffee Brownie Sourdough Bread" with coil fold/banneton/scoring is an artisanal dark-chocolate sourdough BREAD loaf, NOT a flat cake brownie).
`;
  } else if (targetTopic) {
    recipeSourceBlock = `
[MANDATORY DISH KEYWORD]
The recipe MUST revolve strictly around: "${targetTopic}" (Category: "${recipeClassification}").
Ensure every ingredient measurement is realistic, non-duplicated, and culinary-tested.
`;
  }

  let productBlock = '';
  if (optionalProduct?.product_name) {
    productBlock = `
[OPTIONAL CATALOG PRODUCT INTEGRATION]
Naturally feature this product from our catalog in 1 relevant ingredient/step or tip, and mention it smoothly in social_media_package:
- Product Name: "${optionalProduct.product_name}"
- Category: "${optionalProduct.category || 'Kitchen/Culinary'}"
- Key USP: "${optionalProduct.usp || optionalProduct.description || 'Praktis dan berkualitas'}"
Do NOT turn the infographic into a hard-sell ad; keep it a helpful recipe poster.
`;
  }

  let stepSchemaNote = '';
  if (spec.mode === 'hero_only') {
    stepSchemaNote = `Produce ${spec.textStepCount} concise steps. Only "hero_prompt" is required; set "secondary_prompt" and "steps[].t2i_prompt" to "".`;
  } else if (spec.mode === 'hero_and_detail') {
    stepSchemaNote = `Produce 4 concise steps. Provide "hero_prompt" and "secondary_prompt" (sliced/cross-section/detail shot); set "steps[].t2i_prompt" to "".`;
  } else {
    stepSchemaNote = `Produce ${spec.textStepCount} concise steps. Include a clean English "t2i_prompt" for the first ${spec.stepPhotoCount} steps depicting each exact cooking step in the SAME kitchen environment (${surface}, ${lighting}).`;
  }

  const dishHint = String(curatedRecipe?.original_title || curatedRecipe?.title || targetTopic || 'Special Homemade Dish').replace(/"/g, "'");

  return `You are an Indonesian Culinary Editor, Food Stylist, and Social Media Visual Strategist.
Your task is to generate complete structured content for a Single-Page Recipe Infographic Poster (${spec.template}) and ready-to-publish Social Media Captions.

${recipeSourceBlock}
${productBlock}
${deconstructContext || ''}

[LANGUAGE & COPYWRITING RULES]
- ${langRule}
- FORBIDDEN: Do NOT use em dashes ("—"), duplicate ingredient lines, or typos.
- POSTER HEADLINE RULE ("title"): Keep "title" SHORT and punchy for the poster header — ONLY the core dish name (**2 to 5 words, max 34 characters**). Do NOT copy long blog subtitles after ":" or "-" into "title" (e.g. "Sourdough Coffee Brownie Bliss: Perpaduan..." MUST become "Sourdough Coffee Brownie"). Put descriptive flavor angles in "subtitle_ribbon" or "hook_badge" instead; you may still mention the full recipe name in "social_media_package".
- Keep "subtitle_ribbon" punchy (3 to 5 words, e.g. "Aroma Kopi & Cokelat").
- Keep "hook_badge" short (4 to 7 words max).
- Keep each ingredient concise so it fits cleanly on a recipe poster card.
- Keep each step caption crisp (**6 to 11 words max**, 2-3 short lines on card, clear action verb).
- Include **2 concise "tips"** (each max 10 words, 1 line).
- Keep "cta_badge" super short (**2 to 3 words max**, e.g. "Yuk Recook!" or "Selamat Mencoba!" / "Happy Cooking!") so it stays on 1 single line.
- ${stepSchemaNote}

[VISUAL CONSISTENCY & SEQUENTIAL STATE LOCK FOR ALL T2I PROMPTS]
First, define "dish_visual_identity" **STRICTLY IN ENGLISH**: ONE concrete visual noun-phrase describing the final finished dish matching "Original Authoritative Dish Name" + ALL steps (exact shape like loaf bread vs square cake vs drink glass, crust/crumb color, chocolate/topping details, appropriate plate/board/cup — NEVER put cake/bread on a deep soup bowl unless the dish is a soup/bowl!).
Second, EVERY image prompt ("hero_prompt", "secondary_prompt", "steps[].t2i_prompt") MUST be **100% CONCRETE ENGLISH** naming the actual food & ingredients (NEVER output template variable words like "dish_visual_identity"):
- Style: ${styleName}
- Surface: ${surface}
- Lighting & Lens: ${lighting}; ${MACRO_LIGHTING_MODIFIER}
- Framing & Hands Policy: ${framingRule}
- Props: ${props}
- Cumulative Ingredient State Continuity (CRITICAL): Track cumulative dough/batter color and ingredients step by step! Once dark cocoa, chocolate paste, espresso, matcha, turmeric, or berries enter in an earlier step, EVERY subsequent step prompt MUST explicitly describe that exact colored mixture (e.g. "rich dark brown cocoa-coffee dough dotted with chocolate chips"), NEVER reverting to plain uncolored white dough.
- Hero <-> Final Dish Consistency (CRITICAL): "hero_prompt" MUST explicitly name the dish ("${dishHint}") and its exact cooked/baked shape, crumb, crust, and vessel so the image model renders "${dishHint}" unmistakably (and NEVER hallucinates berries/granola).
- Mandatory Suffix: ${photoGuardrail}

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "${curatedRecipe ? curatedRecipe.title : (targetTopic || 'Resep Spesial Rumahan')}",
  "dish_visual_identity": "ENGLISH ONLY concrete description of finished ${dishHint}, e.g. sliced dark chocolate sourdough bread loaf with rustic scored crust on white ceramic plate",
  "subtitle_ribbon": "${isIndonesian ? 'Renyah, Gurih, Praktis!' : 'Crispy, Savory, Easy!'}",
  "hook_badge": "${isIndonesian ? 'Ide Sajian Keluarga & Jualan' : 'Perfect Family & Snack Idea'}",
  "cuisine_category": "${recipeClassification}",
  "prep_time": "${curatedRecipe?.prep_time || (isIndonesian ? '15 menit' : '15 mins')}",
  "cook_time": "${curatedRecipe?.cook_time || (isIndonesian ? '20 menit' : '20 mins')}",
  "servings": "${curatedRecipe?.servings || (isIndonesian ? '4 porsi' : '4 servings')}",
  "ingredients_groups": [
    {
      "group_title": "${isIndonesian ? 'Bahan-bahan' : 'Ingredients'}",
      "items": ["Item 1 with exact measurement", "Item 2 with exact measurement"]
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "caption": "Short step instruction",
      "t2i_prompt": "${spec.mode === 'step_photos' ? `Tight overhead close-up macro food photography of cooking step 1 for ${dishHint}, keeping cumulative dough/batter color & state from prior steps on ${surface}, ${MACRO_LIGHTING_MODIFIER}, ${lighting}. ${photoGuardrail}` : ''}"
    }
  ],
  "tips": [
    "Practical culinary tip 1",
    "Practical culinary tip 2"
  ],
  "cta_badge": "${isIndonesian ? 'Yuk Recook!' : 'Happy Cooking!'}",
  "hero_prompt": "Commercial bright macro hero food photography of finished ${dishHint} plated appropriately on ${surface}, showing realistic texture, color, and crumb/glaze, ${MACRO_LIGHTING_MODIFIER}, ${lighting}. ${photoGuardrail}",
  "secondary_prompt": "${spec.mode === 'hero_and_detail' ? `Tight macro close-up cross-section or plating detail of finished ${dishHint} on ${surface}, ${MACRO_LIGHTING_MODIFIER}, ${lighting}. ${photoGuardrail}` : ''}",
  "social_media_package": {
    "caption_facebook": "Engaging Facebook post caption with clean line breaks, ingredient list, numbered steps, tips, and Save/Share CTA. NO raw markdown # or **.",
    "caption_bio": "Concise Instagram & Threads caption with hook, key highlights, Save CTA, and Link in Bio note if product used. NO raw markdown # or **.",
    "hashtags": ["#ResepRumahan", "#IdeJualan", "#MasakPraktis"]
  },
  "content_md": "# Dish Title\\n\\n## Bahan-bahan\\n- ...\\n\\n## Cara Membuat\\n1. ..."
}`;
}

/**
 * Normalizes Gemini infographic response, guarantees clean fallback captions,
 * builds T2I prompts map (`image_1..image_N`) sized precisely for the selected template,
 * and enriches affiliate/bio links if an optional product is bound.
 */
function isCleanEnglishSpec(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 8) return false;
  return !/\b(sebuah|dengan|berwarna|disajikan|berbentuk|di\s+atas|yang|untuk|dalam|lalu|hingga)\b/i.test(s);
}

function enforcePromptHandAndMacroPolicy(rawPrompt, handMode = 'objects_only', requiredDishContext = '') {
  let clean = String(rawPrompt || '').trim();
  const guardrail = getPhotoGuardrail(handMode);
  const hadPlaceholder = /\bmatching\s+dish_visual_identity\b|\bdescribed\s+in\s+dish_visual_identity\b|\bdish_visual_identity\b/i.test(clean);

  clean = clean
    .replace(/\[CLEAN(?:\s+MACRO)?\s+FOOD PHOTOGRAPHY ONLY:[^\]]*\]/gi, '')
    .replace(/\bat most hands\/forearms from elbow down[^.]*\./gi, '')
    .replace(/\b(?:matching|described\s+in)\s+dish_visual_identity\b/gi, '')
    .replace(/\bdish_visual_identity\b/gi, '')
    .replace(/\bREPLACE WITH CONCRETE[^:]*:/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();

  if (requiredDishContext) {
    const tokens = requiredDishContext.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    const hasDishMention = tokens.some(tok => clean.toLowerCase().includes(tok));
    if (hadPlaceholder || !hasDishMention || !clean) {
      clean = clean
        ? `Bright macro hero food photography of ${requiredDishContext}, ${clean}`
        : `Bright macro hero food photography of ${requiredDishContext}`;
    }
  }

  if (clean && !/macro/i.test(clean)) {
    clean = `${clean.replace(/\.+$/, '')}, ${MACRO_LIGHTING_MODIFIER}.`;
  }
  return clean ? `${clean} ${guardrail}` : guardrail;
}

export function shortenPosterTitle(rawTitle, maxChars = 34, maxWords = 5) {
  let clean = String(rawTitle || '').replace(/—/g, '-').trim();
  if (!clean) return 'Resep Spesial Rumahan';
  if (clean.length > maxChars) {
    const splitParts = clean.split(/\s*[:|]\s*|\s+[-–]\s+/);
    if (splitParts[0] && splitParts[0].trim().length >= 8) {
      clean = splitParts[0].trim();
    }
  }
  if (clean.length > maxChars) {
    const withoutClause = clean.replace(/\s+(?:yang|dengan|untuk|agar|supaya)\s+.+$/i, '').trim();
    if (withoutClause.length >= 10) clean = withoutClause;
  }
  if (clean.length > maxChars || clean.split(/\s+/).length > maxWords) {
    const words = clean.split(/\s+/);
    const capped = [];
    let len = 0;
    for (const w of words) {
      if (capped.length >= maxWords || (len + w.length + 1 > maxChars && capped.length >= 2)) break;
      capped.push(w);
      len += w.length + 1;
    }
    clean = capped.join(' ');
  }
  return clean;
}

export function normalizeInfographicPayload(rawParsed = {}, {
  curatedRecipe = null,
  optionalProduct = null,
  brandWatermarkText = null,
  infographicTemplate = 'step_grid_classic',
  handMode = 'objects_only',
  targetLang = 'id_ID'
} = {}) {
  const spec = getTemplateImageSpec(infographicTemplate);
  const guardrail = getPhotoGuardrail(handMode);
  const fullTitle = String(curatedRecipe?.title || rawParsed.title || 'Resep Spesial Rumahan').trim();
  const title = shortenPosterTitle(rawParsed.title || fullTitle);
  const subtitleRibbon = String(rawParsed.subtitle_ribbon || (targetLang === 'en_US' ? 'Fresh, Delicious & Easy!' : 'Lezat, Praktis, Bikin Nagih!')).trim();
  const hookBadge = String(rawParsed.hook_badge || (targetLang === 'en_US' ? 'Homemade Favorite' : 'Cocok untuk Keluarga & Ide Jualan')).trim();

  let groups = Array.isArray(rawParsed.ingredients_groups) && rawParsed.ingredients_groups.length > 0
    ? rawParsed.ingredients_groups
    : [{ group_title: targetLang === 'en_US' ? 'Ingredients' : 'Bahan-bahan', items: curatedRecipe?.ingredients || [] }];

  groups = groups.map(g => {
    const seen = new Set();
    const cleanItems = (Array.isArray(g.items) ? g.items : [])
      .map(s => String(s || '').replace(/—/g, ',').trim())
      .filter(s => {
        if (!s) return false;
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return {
      group_title: String(g.group_title || 'Bahan-bahan').trim(),
      items: cleanItems
    };
  }).filter(g => g.items.length > 0);

  if (groups.length === 0 && curatedRecipe?.ingredients?.length) {
    groups = [{ group_title: 'Bahan-bahan', items: curatedRecipe.ingredients }];
  }

  const rawSteps = Array.isArray(rawParsed.steps) ? rawParsed.steps : [];
  const steps = rawSteps.slice(0, spec.textStepCount).map((s, idx) => ({
    step_number: idx + 1,
    caption: String(s?.caption || s || '').replace(/—/g, ',').trim(),
    t2i_prompt: String(s?.t2i_prompt || '').trim()
  })).filter(s => s.caption);

  const tips = (Array.isArray(rawParsed.tips) ? rawParsed.tips : [])
    .map(t => String(t || '').replace(/—/g, ',').trim())
    .filter(Boolean)
    .slice(0, 2);

  const rawCta = String(rawParsed.cta_badge || (targetLang === 'en_US' ? 'Happy Cooking!' : 'Yuk Recook!')).trim();
  const ctaBadge = rawCta.length <= 20 && rawCta.split(/\s+/).length <= 3
    ? rawCta
    : (targetLang === 'en_US' ? 'Happy Cooking!' : 'Yuk Recook!');

  // Build prompts map matching exact template quota with strict hand & macro policy
  const englishIdentity = isCleanEnglishSpec(rawParsed.dish_visual_identity)
    ? String(rawParsed.dish_visual_identity).trim()
    : '';
  const heroDishContext = englishIdentity || curatedRecipe?.original_title || fullTitle || title;

  const prompts = {};
  prompts.image_1 = enforcePromptHandAndMacroPolicy(
    rawParsed.hero_prompt || `Commercial bright macro food photography of ${heroDishContext}, vibrant appetizing plating, ${MACRO_LIGHTING_MODIFIER}.`,
    handMode,
    heroDishContext
  );

  if (spec.mode === 'hero_and_detail') {
    prompts.image_2 = enforcePromptHandAndMacroPolicy(
      rawParsed.secondary_prompt || `Tight macro close-up cross-section detail shot of ${heroDishContext}, appetizing texture, ${MACRO_LIGHTING_MODIFIER}.`,
      handMode,
      heroDishContext
    );
  } else if (spec.mode === 'step_photos') {
    const stepPhotoSteps = steps.slice(0, spec.stepPhotoCount);
    stepPhotoSteps.forEach((step, idx) => {
      const slotKey = `image_${idx + 2}`;
      const isLastStep = idx === stepPhotoSteps.length - 1;
      prompts[slotKey] = enforcePromptHandAndMacroPolicy(
        step.t2i_prompt || `Tight close-up macro culinary preparation photo of ${heroDishContext}, step ${idx + 1}: ${step.caption}.`,
        handMode,
        isLastStep ? heroDishContext : ''
      );
    });
  }

  const flatIngredients = groups.flatMap(g => g.items);
  const contentMd = rawParsed.content_md || [
    `# ${fullTitle}`,
    '',
    `_${subtitleRibbon}_`,
    '',
    '## Bahan-bahan',
    ...flatIngredients.map(i => `- ${i}`),
    '',
    '## Cara Membuat',
    ...steps.map((s, i) => `${i + 1}. ${s.caption}`),
    ...(tips.length ? ['', '## Tips', ...tips.map(t => `- ${t}`)] : [])
  ].join('\n');

  const pkg = rawParsed.social_media_package || {};
  const hashtags = Array.isArray(pkg.hashtags) && pkg.hashtags.length > 0
    ? pkg.hashtags.map(h => (String(h).startsWith('#') ? String(h) : `#${String(h).replace(/\s+/g, '')}`))
    : ['#ResepRumahan', '#IdeJualan', '#KulinerNusantara'];

  let captionFb = String(pkg.caption_facebook || '').trim();
  if (!captionFb) {
    captionFb = [
      `${fullTitle.toUpperCase()} (${subtitleRibbon})`,
      '',
      'Simpan resep ini biar gampang dicari saat mau eksekusi di dapur.',
      '',
      'Bahan-bahan:',
      ...flatIngredients.map(i => `- ${i}`),
      '',
      'Cara membuat:',
      ...steps.map((s, i) => `${i + 1}. ${s.caption}`),
      ...(tips.length ? ['', 'Tips:', ...tips.map(t => `- ${t}`)] : [])
    ].join('\n');
  }

  let captionBio = String(pkg.caption_bio || '').trim();
  if (!captionBio) {
    captionBio = [
      `${fullTitle} - ${subtitleRibbon}`,
      '',
      `Estimasi waktu: ${rawParsed.prep_time || '15 menit'} persiapan, ${rawParsed.cook_time || '20 menit'} masak (${rawParsed.servings || '4 porsi'}).`,
      '',
      'Simpan postingan infografis ini supaya tidak lupa takarannya.'
    ].join('\n');
  }

  if (optionalProduct?.product_name) {
    if (optionalProduct.affiliate_link && !captionFb.includes(optionalProduct.affiliate_link)) {
      captionFb += `\n\nRekomendasi perlengkapan/bahan yang dipakai:\n${optionalProduct.product_name}\nCek detail produknya di sini: ${optionalProduct.affiliate_link}`;
    } else if (!captionFb.includes(optionalProduct.product_name)) {
      captionFb += `\n\nRekomendasi perlengkapan/bahan: ${optionalProduct.product_name}`;
    }
    if (!captionBio.toLowerCase().includes('link di bio')) {
      captionBio += `\n\nRekomendasi ${optionalProduct.product_name} bisa dicek di Link di Bio.`;
    }
  }

  if (brandWatermarkText && !captionFb.includes(brandWatermarkText)) {
    captionFb += `\n\nResep oleh ${brandWatermarkText}`;
  }

  const hashtagLine = hashtags.join(' ');
  if (!captionFb.includes('#')) captionFb += `\n\n${hashtagLine}`;
  if (!captionBio.includes('#')) captionBio += `\n\n${hashtagLine}`;

  const dishVisualIdentity = String(rawParsed.dish_visual_identity || '').replace(/—/g, '-').trim() || null;
  const promptCount = Object.keys(prompts).length;
  const referenceHeroKeys = spec.mode === 'hero_and_detail' && prompts.image_2
    ? ['image_2']
    : (spec.mode === 'step_photos' && promptCount >= 2 ? [`image_${promptCount}`] : []);

  return {
    resolved_template: spec.template,
    reference_hero_keys: referenceHeroKeys,
    infographic: {
      title,
      full_title: fullTitle,
      dish_visual_identity: dishVisualIdentity,
      subtitle_ribbon: subtitleRibbon,
      hook_badge: hookBadge,
      cuisine_category: rawParsed.cuisine_category || 'Kuliner',
      prep_time: String(rawParsed.prep_time || '15 menit'),
      cook_time: String(rawParsed.cook_time || '20 menit'),
      servings: String(rawParsed.servings || '4 porsi'),
      ingredients_groups: groups,
      steps,
      tips,
      cta_badge: ctaBadge,
      optional_product_name: optionalProduct?.product_name || null
    },
    prompts,
    content_md: contentMd,
    social_media_package: {
      title: fullTitle,
      caption: captionFb,
      caption_facebook: captionFb,
      caption_bio: captionBio,
      hashtags
    }
  };
}

const VERTICAL_HERO_TEMPLATES = new Set([
  'hero_right_editorial',
  'magazine_vertical_split',
  'polaroid_scrapbook'
]);

/**
 * Maps an infographic image slot (`image_1` Hero vs `image_2..7` secondary/step)
 * to a G-Labs-supported aspect ratio ('1:1' | '3:4' | '4:3' | '9:16' | '16:9').
 */
export function resolveInfographicGlabsAspectRatio({
  key = 'image_1',
  templateId = 'step_grid_classic',
  canvasAspectRatio = '4:5'
} = {}) {
  const normalizedTpl = normalizeInfographicTemplateId(templateId);
  const ratio = ['1:1', '4:5', '3:4', '9:16'].includes(canvasAspectRatio) ? canvasAspectRatio : '4:5';

  if (key !== 'image_1') {
    return '4:3';
  }

  if (VERTICAL_HERO_TEMPLATES.has(normalizedTpl)) {
    if (ratio === '9:16') return '9:16';
    if (ratio === '1:1' && normalizedTpl !== 'magazine_vertical_split') return '1:1';
    return '3:4';
  }

  if (ratio === '9:16') return '4:3';
  return '16:9';
}
