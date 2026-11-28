import { normalizeInfographicTemplateId } from './recipe-infographic-renderer.js';

/**
 * Prompt builder and response normalizer for Recipe Labs Infographic mode (Option A: Hybrid).
 * Adapts T2I image generation count to the chosen template to save G-Labs quota.
 */

const SHARED_PHOTO_GUARDRAIL = '[CLEAN FOOD PHOTOGRAPHY ONLY: NO TEXT, NO LETTERS, NO NUMBERS, NO LABELS, NO WATERMARKS. FACELESS ONLY: at most hands/forearms from elbow down, never face/head]';

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
  curatedRecipe = null,
  optionalProduct = null,
  deconstructContext = ''
} = {}) {
  const spec = getTemplateImageSpec(infographicTemplate);
  const surface = envObj?.surface || 'warm natural wooden kitchen tabletop';
  const lighting = envObj?.lighting || 'bright soft natural window daylight';
  const props = envObj?.props || 'clean glass bowls, ceramic plate, fresh culinary herbs';
  const styleName = envObj?.name || 'Warm Indonesian Culinary Studio';

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
- Exact Title: "${curatedRecipe.title}"
- Servings: "${curatedRecipe.servings || '4 porsi'}" | Prep: "${curatedRecipe.prep_time || '15 menit'}" | Cook: "${curatedRecipe.cook_time || '20 menit'}"
- Authoritative Ingredients (DO NOT alter quantities or invent unrelated ingredients; keep all measurements accurate, no duplicates):
${curatedRecipe.ingredients.map(i => `  * ${i}`).join('\n')}
- Authoritative Instructions (condense/split into ${spec.textStepCount} clear concise steps matching the exact sequence):
${curatedRecipe.steps.map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')}
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

  return `You are an Indonesian Culinary Editor, Food Stylist, and Social Media Visual Strategist.
Your task is to generate complete structured content for a Single-Page Recipe Infographic Poster (${spec.template}) and ready-to-publish Social Media Captions.

${recipeSourceBlock}
${productBlock}
${deconstructContext || ''}

[LANGUAGE & COPYWRITING RULES]
- ${langRule}
- FORBIDDEN: Do NOT use em dashes ("—"), duplicate ingredient lines, or typos.
- Keep "subtitle_ribbon" punchy (3 to 6 words, e.g. "Segar, Creamy, Enak Banget!").
- Keep "hook_badge" short (4 to 9 words).
- Keep each ingredient concise so it fits cleanly on a recipe poster card.
- Keep each step caption crisp (6 to 14 words max, clear action verb).
- Include 2 to 3 practical "tips" (each max 12 words).
- ${stepSchemaNote}

[VISUAL CONSISTENCY ANCHOR FOR ALL T2I PROMPTS]
Every image prompt ("hero_prompt", "secondary_prompt", "steps[].t2i_prompt") MUST share:
- Style: ${styleName}
- Surface: ${surface}
- Lighting: ${lighting}
- Props: ${props}
- Mandatory Suffix: ${SHARED_PHOTO_GUARDRAIL}

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "${curatedRecipe ? curatedRecipe.title : (targetTopic || 'Resep Spesial Rumahan')}",
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
      "t2i_prompt": "${spec.mode === 'step_photos' ? `Overhead close-up food photography of step 1 on ${surface}, ${lighting}. ${SHARED_PHOTO_GUARDRAIL}` : ''}"
    }
  ],
  "tips": [
    "Practical culinary tip 1",
    "Practical culinary tip 2"
  ],
  "cta_badge": "${isIndonesian ? 'Selamat Mencoba!' : 'Happy Cooking!'}",
  "hero_prompt": "Commercial hero food photography of the finished dish beautifully served on ${surface}, ${props}, ${lighting}, vibrant appetizing texture. ${SHARED_PHOTO_GUARDRAIL}",
  "secondary_prompt": "${spec.mode === 'hero_and_detail' ? `Close-up cross-section or serving detail of the finished dish on ${surface}, ${lighting}. ${SHARED_PHOTO_GUARDRAIL}` : ''}",
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
export function normalizeInfographicPayload(rawParsed = {}, {
  curatedRecipe = null,
  optionalProduct = null,
  brandWatermarkText = null,
  infographicTemplate = 'step_grid_classic',
  targetLang = 'id_ID'
} = {}) {
  const spec = getTemplateImageSpec(infographicTemplate);
  const title = String(rawParsed.title || curatedRecipe?.title || 'Resep Spesial Rumahan').trim();
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
    .slice(0, 3);

  const ctaBadge = String(rawParsed.cta_badge || (targetLang === 'en_US' ? 'Happy Cooking!' : 'Selamat Mencoba!')).trim();

  // Build prompts map matching exact template quota
  const prompts = {};
  prompts.image_1 = String(rawParsed.hero_prompt || `Commercial food photography of ${title}, vibrant appetizing plating, natural daylight. ${SHARED_PHOTO_GUARDRAIL}`).trim();

  if (spec.mode === 'hero_and_detail') {
    prompts.image_2 = String(rawParsed.secondary_prompt || `Close-up cross-section detail shot of ${title}, appetizing texture, natural daylight. ${SHARED_PHOTO_GUARDRAIL}`).trim();
  } else if (spec.mode === 'step_photos') {
    const stepPhotoSteps = steps.slice(0, spec.stepPhotoCount);
    stepPhotoSteps.forEach((step, idx) => {
      const slotKey = `image_${idx + 2}`;
      prompts[slotKey] = step.t2i_prompt || `Close-up culinary preparation photo of ${title}, step ${idx + 1}: ${step.caption}. ${SHARED_PHOTO_GUARDRAIL}`;
    });
  }

  const flatIngredients = groups.flatMap(g => g.items);
  const contentMd = rawParsed.content_md || [
    `# ${title}`,
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
      `${title.toUpperCase()} (${subtitleRibbon})`,
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
      `${title} - ${subtitleRibbon}`,
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

  return {
    resolved_template: spec.template,
    infographic: {
      title,
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
      title,
      caption: captionFb,
      caption_facebook: captionFb,
      caption_bio: captionBio,
      hashtags
    }
  };
}
