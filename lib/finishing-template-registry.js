/**
 * Single source of truth registry for Finishing Pass HTML templates.
 * Must remain pure JS (no Node fs/path/DB imports) so Client UI, MCP, and Workers can all share it.
 */
export const FINISHING_TEMPLATE_REGISTRY = [
  {
    id: 'none',
    file: 'base-caption.html',
    label: 'None — Legacy FFmpeg ASS Only / Caption Dasar',
    description: 'Subtitle & Hook Card dasar tanpa overlay template khusus.',
    layers: {
      recipe: false,
      product: false,
      cameraMotion: false,
      sharedBrand: false
    },
    finishingPlanFields: ['hook', 'punches'],
    suggestFor: [],
    compatibilityCampaignKinds: [],
    compliance: {
      strictClaims: false
    }
  },
  {
    id: 'calm_wellness',
    file: 'calm-wellness.html',
    label: 'Calm Wellness — Editorial Serif & Product Card',
    description: 'Overlay editorial bersih dengan Product Card faktual & Save Prompt.',
    layers: {
      recipe: false,
      product: true,
      cameraMotion: true,
      sharedBrand: false
    },
    finishingPlanFields: ['hook', 'punches'],
    suggestFor: [
      {
        campaignKinds: ['brand_editorial'],
        patterns: [/editorial|wellness|edukasi|herbal_editorial|mindful|holistic/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign'],
    compliance: {
      strictClaims: false
    }
  },
  {
    id: 'recipe_pop',
    file: 'recipe-pop.html',
    label: 'Recipe Pop — Chips Bahan + Step Cards + Tick SFX',
    description: 'Chip bahan resep (maks 4 + badge +N), kartu langkah dinamis, Save Prompt & Tick SFX.',
    layers: {
      recipe: true,
      product: true,
      cameraMotion: true,
      sharedBrand: false
    },
    finishingPlanFields: ['hook', 'punches'],
    suggestFor: [
      {
        campaignKinds: ['recipe_campaign'],
        patterns: [/recipe|resep|bahan-bahan|langkah pembuatan|kuliner|masak/i],
        requireRecipeSignals: true
      }
    ],
    compatibilityCampaignKinds: ['recipe_campaign', 'multiplier_campaign'],
    compliance: {
      strictClaims: false
    }
  }
];

export const FINISHING_TEMPLATE_IDS = FINISHING_TEMPLATE_REGISTRY.map((entry) => entry.id);

export function getFinishingTemplateRegistry() {
  return FINISHING_TEMPLATE_REGISTRY;
}

export function getFinishingTemplateMeta(templateId = 'none', registry = FINISHING_TEMPLATE_REGISTRY) {
  const normalized = String(templateId || 'none').trim().toLowerCase();
  const list = Array.isArray(registry) && registry.length > 0 ? registry : FINISHING_TEMPLATE_REGISTRY;
  return list.find((entry) => entry.id === normalized) || list[0];
}

export function resolveFinishingTemplateFile(templateId = 'none', registry = FINISHING_TEMPLATE_REGISTRY) {
  return getFinishingTemplateMeta(templateId, registry)?.file || 'base-caption.html';
}

export function isRichFinishingTemplate(templateId = 'none', registry = FINISHING_TEMPLATE_REGISTRY) {
  const meta = getFinishingTemplateMeta(templateId, registry);
  return Boolean(meta && meta.id !== 'none' && (meta.layers?.recipe || meta.layers?.product || meta.layers?.cameraMotion || meta.layers?.sharedBrand));
}

export function hasStrictTemplateCompliance(templateId = 'none', registry = FINISHING_TEMPLATE_REGISTRY) {
  return Boolean(getFinishingTemplateMeta(templateId, registry)?.compliance?.strictClaims);
}

/**
 * Suggests a finishing template from record metadata or returns null when no template fits (R6.5 & R11).
 */
export function suggestFinishingTemplate(record = {}, registry = FINISHING_TEMPLATE_REGISTRY) {
  const list = Array.isArray(registry) && registry.length > 0 ? registry : FINISHING_TEMPLATE_REGISTRY;
  const explicit = String(record?.finishing_template || '').trim().toLowerCase();
  if (explicit && list.some((entry) => entry.id === explicit)) {
    return explicit;
  }

  const campaignKind = String(record?.campaign_kind || '').trim().toLowerCase();
  const presetKey = String(record?.preset_key || '').trim().toLowerCase();
  const textBlob = [
    campaignKind,
    presetKey,
    record?.new_caption,
    record?.campaign_name,
    record?.content_pillar
  ].filter(Boolean).join(' ').toLowerCase();

  // R6.5 guard: product_hard_sell is not auto-mapped to recipe_pop or forced into calm_wellness
  if (/product_hard_sell/i.test(presetKey) || /product_hard_sell/i.test(campaignKind)) {
    return null;
  }

  // Match recipe first when campaign_kind or recipe text signals exist
  const hasExplicitRecipeKind = campaignKind === 'recipe_campaign' || Boolean(record?.generate_recipe);
  if (hasExplicitRecipeKind) {
    const recipeEntry = list.find((entry) => entry.id === 'recipe_pop');
    if (recipeEntry) return recipeEntry.id;
  }

  for (const entry of list) {
    if (!Array.isArray(entry.suggestFor) || entry.suggestFor.length === 0) continue;
    for (const rule of entry.suggestFor) {
      if (Array.isArray(rule.campaignKinds) && campaignKind && rule.campaignKinds.includes(campaignKind)) {
        return entry.id;
      }
      if (Array.isArray(rule.patterns) && textBlob && rule.patterns.some((re) => re.test(textBlob))) {
        return entry.id;
      }
    }
  }

  return null;
}

