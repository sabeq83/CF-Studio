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
  },
  {
    id: 'tips_listicle',
    file: 'tips-listicle.html',
    label: 'Tips Listicle — Badge TIP N/Total + Rekap Daftar',
    description: 'Daftar tips bernomor (TIP 1/N <= 6 kata), punch_display angka kunci, chip lokasi opsional & kartu rekap akhir.',
    layers: {
      recipe: false,
      product: false,
      cameraMotion: true,
      sharedBrand: true,
      tips: true
    },
    finishingPlanFields: ['hook', 'punches', 'punch_display', 'tips', 'brand_patch'],
    suggestFor: [
      {
        patterns: [/tips_listicle|listicle|daftar\s+tips|\d+\s+(?:kunci|tips|cara|kebiasaan)|sasyahouse/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign'],
    compliance: {
      strictClaims: false
    }
  },
  {
    id: 'ramuan_ritual',
    file: 'ramuan-ritual.html',
    label: 'Ramuan Ritual — Resep Seduh & Pengingat Waktu Aman',
    description: 'Kartu bahan & takaran hangat, badge waktu minum/diamkan (x-time), produk non-klaim opsional & disclaimer wajib.',
    layers: {
      recipe: true,
      product: true,
      cameraMotion: true,
      sharedBrand: true,
      timingBadges: true
    },
    finishingPlanFields: ['hook', 'punches', 'timing_badges', 'brand_patch'],
    suggestFor: [
      {
        patterns: [/ramuan_ritual|ramuan|seduhan|siasat\s+sehat|nutriblend|dapur\s+botani.*herbal/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign', 'recipe_campaign'],
    compliance: {
      strictClaims: true
    }
  },
  {
    id: 'problem_solution',
    file: 'problem-solution.html',
    label: 'Problem Solution — Babak MASALAH → PENYEBAB → SOLUSI → HASIL',
    description: 'Pill fase bernomor + track progres 4 langkah, callout material/titik masalah ber-leader-line dari VO, lower-third presenter, CTA konsultasi & end card.',
    layers: {
      recipe: false,
      product: false,
      cameraMotion: true,
      sharedBrand: true,
      chapters: true,
      callouts: true
    },
    finishingPlanFields: ['hook', 'punches', 'chapters', 'callouts', 'brand_patch'],
    suggestFor: [
      {
        patterns: [/problem[_\s-]*solution|ruang\s+akustik|peredam\s+suara|masalah.*solusi/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign'],
    compliance: {
      strictClaims: false
    }
  },
  {
    id: 'angka_banding',
    file: 'angka-banding.html',
    label: 'Angka & Banding — Komparasi A vs B + Chips Material + Angka Nyata',
    description: 'Kartu banding 2 kolom (A vs B), chip pilihan material sinkron kata VO, dan counter/meter angka khusus bila angka nyata disebut di VO atau data produk.',
    layers: {
      recipe: false,
      product: false,
      cameraMotion: true,
      sharedBrand: true,
      compare: true,
      numbers: true,
      chips: true
    },
    finishingPlanFields: ['hook', 'punches', 'compare', 'numbers', 'chips', 'brand_patch'],
    suggestFor: [
      {
        patterns: [/angka[_\s-]*banding|solusi\s*thermal|insulasi|perbandingan|banding/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign'],
    compliance: {
      strictClaims: false
    }
  },
  {
    id: 'mitos_fakta',
    file: 'mitos-fakta.html',
    label: 'Mitos vs Fakta — Hook Pertanyaan + Cap MITOS/FAKTA & Alasan',
    description: 'Hook pertanyaan frame 0, stempel MITOS/FAKTA tersinkron VO, bar alasan KENAPA? bebas klaim medis, watermark & kartu penutup.',
    layers: {
      recipe: false,
      product: false,
      cameraMotion: true,
      sharedBrand: true,
      mythFact: true
    },
    finishingPlanFields: ['hook', 'punches', 'myth_fact', 'brand_patch'],
    suggestFor: [
      {
        patterns: [/mitos[_\s-]*(?:vs[_\s-]+)?fakta|myth[_\s-]*(?:vs[_\s-]+)?fact|benarkah|faktanya/i]
      }
    ],
    compatibilityCampaignKinds: ['brand_editorial', 'product_campaign', 'multiplier_campaign', 'recipe_campaign'],
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

  // 1. Check specific niche patterns (specialized templates take precedence over generic editorial fallback)
  for (const entry of list) {
    if (entry.id === 'calm_wellness' || !Array.isArray(entry.suggestFor)) continue;
    for (const rule of entry.suggestFor) {
      if (Array.isArray(rule.patterns) && textBlob && rule.patterns.some((re) => re.test(textBlob))) {
        return entry.id;
      }
    }
  }

  // 2. Check pattern & campaignKinds across remaining registry entries
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

export const FINISHING_CAPTION_MODES = ['hybrid', 'keyword_only', 'full'];

/**
 * Resolves effective display/runtime values for finishing override fields without mutating stored NULLs.
 * Empty/NULL caption_mode defaults to 'full' per Revisi 01 compatibility (R19.1).
 */
export function getEffectiveFinishingOverride(record = {}) {
  const src = record && typeof record === 'object' ? record : {};
  const rawTpl = src.finishing_template !== null && src.finishing_template !== undefined
    ? String(src.finishing_template).trim().toLowerCase()
    : '';
  const hasValidTpl = Boolean(rawTpl && FINISHING_TEMPLATE_IDS.includes(rawTpl));

  const rawCap = src.caption_mode !== null && src.caption_mode !== undefined
    ? String(src.caption_mode).trim().toLowerCase()
    : '';
  const hasValidCap = Boolean(rawCap && FINISHING_CAPTION_MODES.includes(rawCap));

  const rawLoud = src.loudness_target;
  const parsedLoud = rawLoud !== null && rawLoud !== undefined && String(rawLoud).trim() !== ''
    ? Number(rawLoud)
    : NaN;
  const hasValidLoud = Number.isFinite(parsedLoud) && parsedLoud >= -24 && parsedLoud <= -6;

  return {
    finishing_template: hasValidTpl ? rawTpl : 'none',
    finishing_template_is_default: !rawTpl,
    caption_mode: hasValidCap ? rawCap : 'full',
    caption_mode_is_default: !rawCap,
    loudness_target: hasValidLoud ? parsedLoud : -14,
    loudness_target_is_default: !hasValidLoud
  };
}

/**
 * Computes a diff-only PATCH payload so untouched finishing override fields keep their DB NULL/default (R19.2).
 */
export function buildFinishingOverridePatch(baselineRecord = {}, draft = {}) {
  const baseline = getEffectiveFinishingOverride(baselineRecord);
  const patch = {};

  if (draft.finishing_template !== undefined && draft.finishing_template !== baseline.finishing_template) {
    patch.finishing_template = draft.finishing_template;
  }
  if (draft.caption_mode !== undefined && draft.caption_mode !== baseline.caption_mode) {
    patch.caption_mode = draft.caption_mode;
  }
  if (draft.loudness_target !== undefined && Number(draft.loudness_target) !== baseline.loudness_target) {
    patch.loudness_target = Number(draft.loudness_target);
  }
  return patch;
}

/**
 * Strictly parses finishing override fields for PATCH/PUT endpoints (R19.3 & R19.4).
 * Empty strings are rejected with HTTP 400; explicit null clears the override back to DB NULL.
 */
export function parseFinishingOverrideFields(body = {}, { allowNull = true } = {}) {
  const updates = {};
  const src = body && typeof body === 'object' ? body : {};

  if (src.finishing_template !== undefined) {
    if (src.finishing_template === null) {
      if (!allowNull) return { error: 'Invalid finishing_template: null is not allowed', status: 400 };
      updates.finishing_template = null;
    } else if (typeof src.finishing_template !== 'string') {
      return { error: 'Invalid finishing_template: must be a string', status: 400 };
    } else {
      const normalizedTpl = src.finishing_template.trim().toLowerCase();
      if (!normalizedTpl || !FINISHING_TEMPLATE_IDS.includes(normalizedTpl)) {
        return { error: `Invalid finishing_template: ${normalizedTpl || '(empty)'}`, status: 400 };
      }
      updates.finishing_template = normalizedTpl;
    }
  }

  if (src.caption_mode !== undefined) {
    if (src.caption_mode === null) {
      if (!allowNull) return { error: 'Invalid caption_mode: null is not allowed', status: 400 };
      updates.caption_mode = null;
    } else if (typeof src.caption_mode !== 'string') {
      return { error: 'Invalid caption_mode: must be a string', status: 400 };
    } else {
      const normalizedCap = src.caption_mode.trim().toLowerCase();
      if (!normalizedCap || !FINISHING_CAPTION_MODES.includes(normalizedCap)) {
        return { error: `Invalid caption_mode: ${normalizedCap || '(empty)'}`, status: 400 };
      }
      updates.caption_mode = normalizedCap;
    }
  }

  if (src.loudness_target !== undefined) {
    if (src.loudness_target === null) {
      if (!allowNull) return { error: 'Invalid loudness_target: null is not allowed', status: 400 };
      updates.loudness_target = null;
    } else if (typeof src.loudness_target === 'string' && src.loudness_target.trim() === '') {
      return { error: 'Invalid loudness_target: (empty)', status: 400 };
    } else {
      const numLoud = Number(src.loudness_target);
      if (!Number.isFinite(numLoud) || numLoud < -24 || numLoud > -6) {
        return { error: 'loudness_target must be between -24 and -6 LUFS', status: 400 };
      }
      updates.loudness_target = numLoud;
    }
  }

  return { updates, error: null, status: 200 };
}

