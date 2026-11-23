/**
 * Shared pure-JS helpers untuk klasifikasi peran promosi produk (promo_role)
 * serta pencocokan Blueprint Deconstruct Lab <-> Produk Katalog.
 * Aman dipakai di server, client components, dan unit test tanpa ketergantungan DB.
 */

export const PROMO_ROLES = Object.freeze(['alat_dapur', 'bahan_resep', 'lainnya']);

const TOOL_CATEGORY_RE = /(peralatan|perkakas|elektronik dapur|kitchen appliance|timbangan|mixer|frother|teko|masak|baking|laboratorium|wadah|minuman & teh)/i;
const TOOL_KEYWORD_RE = /\b(blender|chopper|hand\s*mixer|stand\s*mixer|mixer|balloon\s*whisk|whisk|frother|oven|air\s*fryer|steamer|kukusan|panci|wajan|skillet|cast\s*iron|teko|kettle|health\s*pot|slow\s*juicer|juicer|grinder|kompor|induksi|timbangan|digital\s*scale|saringan|ayakan|parutan|grater|pemeras|cobek|ulekan|mortar|pestle|talenan|ramekin|mangkuk|gelas\s*kaca|highball|straw\s*cup|beaker|gelas\s*ukur|gelas\s*takar|kotak\s*kaca|lunch\s*box|meja\s*putar|turntable|spuit|spatula|cetakan|loyang|baking\s*paper|pizza\s*cutter|gas\s*torch|torch|scoop|sendok\s*takar|measuring\s*spoon|chasen|masher|ricer|egg\s*boiler|egg\s*steamer|perebus\s*telur|infuser|toples)\b/i;

const INGREDIENT_KEYWORD_RE = /\b(tepung|flour|premix|cocoa|cokelat|coklat|matcha|oat|chia|kunyit|turmeric|jahe|ginger|kayu\s*manis|cinnamon|cengkeh|clove|rosella|madu|honey|gula|stevia|aren|palm\s*sugar|garam|kaldu|bumbu|rempah|minyak|oil|butter|mentega|selai|peanut|almond|kopi|coffee|teh\s*herbal|tea|susu|milk|yogurt|keju|cheese|bubuk|powder|biji|seed|ekstrak|extract|syrup|sirup|cuka|vinegar|moringa|kelor|habbatussauda|kurma|kismis|psyllium|collagen)\b/i;
const INGREDIENT_CATEGORY_RE = /(bahan\s*kue|rempah|herbal|superfood|bumbu|pemanis|makanan|minuman|suplemen\s*bubuk)/i;
const NON_CULINARY_PRODUCT_RE = /\b(kapsul|capsule|tablet|pil|salep|serum|cream|lotion|sabun|shampoo|skincare|pasta\s*gigi|peeling|toner|cleanser)\b/i;

const NON_FOOD_BLUEPRINT_NICHE_RE = /(skincare|home\s*care|beauty|cosmetic|cleaning)/i;
const TOPICAL_OR_CLEANING_RE = /\b(jerawat|flek|ketombe|rambut\s*rontok|karang\s*gigi|sakit\s*gigi|pemutih\s*gigi|kamar\s*mandi|lantai|karat|nyamuk|kecoa|pakaian|cuci\s*piring|wajah\s*glowing|masker\s*wajah|body\s*scrub)\b/i;
const CULINARY_INTENT_RE = /\b(minum|seduh|rebus|adonan|panggang|kukus|blender|jus|smoothie|kue|roti|brownies|cookies|muffin|makan|resep|teh|kopi|matcha|cokelat)\b/i;

const METHOD_RULES = [
  {
    key: 'blender_jus',
    label: 'blender/jus/smoothie',
    bpRe: /\b(blender|jus|juice|smoothie|puree|haluskan\s*(buah|sayur)|blend)\b/i,
    prodRe: /\b(blender|juicer|slow\s*juicer|portable\s*blender|hand\s*blender)\b/i,
  },
  {
    key: 'chopper_halus',
    label: 'chopper/food processor',
    bpRe: /\b(chopper|food\s*processor|cincang|giling|es\s*krim|sorbet|ice\s*cream|beku)\b/i,
    prodRe: /\b(chopper|food\s*processor|scoop|es\s*krim)\b/i,
  },
  {
    key: 'mixer_kocok',
    label: 'mixer/kocok/matcha whisk',
    bpRe: /\b(mixer|whisk|kocok|aduk|frother|busa|foam|matcha|latte|telur)\b/i,
    prodRe: /\b(mixer|whisk|frother|chasen|perebus\s*telur|egg)\b/i,
  },
  {
    key: 'oven_panggang',
    label: 'oven/air fryer/baking',
    bpRe: /\b(oven|panggang|bake|baking|kue|cake|roti|bread|brownies|cookies|muffin|air\s*fryer|pastry|cinnamon\s*roll)\b/i,
    prodRe: /\b(oven|air\s*fryer|baking\s*paper|ramekin|cetakan|loyang|meja\s*putar|turntable|pizza\s*cutter|torch|scoop|cookie|whisk)\b/i,
  },
  {
    key: 'steamer_kukus',
    label: 'kukus/steamer',
    bpRe: /\b(kukus|steamer|steam|bolu\s*kukus|brownies\s*kukus|ubi\s*kukus|kentang)\b/i,
    prodRe: /\b(steamer|kukusan|masher|ricer|cetakan)\b/i,
  },
  {
    key: 'kettle_seduh',
    label: 'rebus/seduh herbal/teh',
    bpRe: /\b(rebus|seduh|infuse|teko|teh|herbal|jamu|cengkeh|kayu\s*manis|jahe|kunyit|rosella|air\s*hangat|ramuan)\b/i,
    prodRe: /\b(teko|kettle|health\s*pot|infuser|leher\s*angsa|panci\s*susu|panci|saringan)\b/i,
  },
  {
    key: 'skillet_masak',
    label: 'wajan/skillet/kompor',
    bpRe: /\b(goreng|tumis|sangrai|skillet|teflon|wajan|pan|pancake|crepes|dadar|kompor|induksi|masak)\b/i,
    prodRe: /\b(skillet|cast\s*iron|wajan|panci|kompor|induksi)\b/i,
  },
  {
    key: 'saring_peras',
    label: 'saring/peras jeruk',
    bpRe: /\b(saring|ampas|ayakan|ayak|peras|jeruk|lemon|nipis)\b/i,
    prodRe: /\b(saringan|ayakan|pemeras|juicer)\b/i,
  },
  {
    key: 'takar_timbang',
    label: 'timbangan/gelas & sendok takar',
    bpRe: /\b(gram|timbang|takar|takaran|sendok\s*takar|gelas\s*ukur|ml|sdm|sdt|presisi)\b/i,
    prodRe: /\b(timbangan|scale|beaker|gelas\s*ukur|gelas\s*takar|sendok\s*takar|measuring)\b/i,
  },
  {
    key: 'potong_parut_ulek',
    label: 'potong/parut/ulek rempah',
    bpRe: /\b(parut|bawang|jahe|kunyit|potong|iris|talenan|ulek|cobek|tumbuk|giling\s*rempah)\b/i,
    prodRe: /\b(parutan|grater|talenan|cobek|ulekan|mortar|pestle|grinder)\b/i,
  },
  {
    key: 'cetak_hias',
    label: 'cetak/dekorasi dessert',
    bpRe: /\b(cetakan|cetak|puding|jelly|coklat\s*sehat|dekorasi|tart|frosting|karamel|creme\s*brulee)\b/i,
    prodRe: /\b(cetakan|silikon|meja\s*putar|turntable|torch|ramekin|scoop)\b/i,
  },
  {
    key: 'wadah_saji',
    label: 'gelas estetik/kotak simpan kaca',
    bpRe: /\b(sajikan|tuang|gelas|iced|es\s*batu|simpan|kulkas|freezer|meal\s*prep|overnight)\b/i,
    prodRe: /\b(gelas\s*kaca|highball|straw\s*cup|kotak\s*kaca|borosilikat|clarity\s*vent)\b/i,
  },
];

const INGREDIENT_RULES = [
  { key: 'cocoa_cokelat', label: 'cokelat/cocoa', re: /\b(cocoa|cokelat|coklat|chocolate|brownies)\b/i },
  { key: 'matcha_teh', label: 'matcha/teh', re: /\b(matcha|green\s*tea|teh\s*hijau|teh)\b/i },
  { key: 'kopi', label: 'kopi/espresso', re: /\b(kopi|coffee|espresso|latte)\b/i },
  { key: 'oat_tepung', label: 'oat/tepung sehat', re: /\b(oat|oatmeal|rolled\s*oat|tepung|almond\s*flour|gluten\s*free)\b/i },
  { key: 'chia_biji', label: 'chia/superfood', re: /\b(chia|flax|biji|seed|psyllium)\b/i },
  { key: 'kunyit_jahe_rempah', label: 'kunyit/jahe/rempah', re: /\b(kunyit|jahe|temulawak|serai|sereh|rempah|jamu|herbal|moringa|kelor)\b/i },
  { key: 'kayu_manis_cengkeh', label: 'kayu manis/cengkeh', re: /\b(kayu\s*manis|cinnamon|cengkeh|clove|kapulaga|bunga\s*lawang)\b/i },
  { key: 'madu_pemanis', label: 'madu/pemanis alami', re: /\b(madu|honey|stevia|gula\s*aren|gula\s*kelapa|kurma|dates)\b/i },
  { key: 'kacang_selai', label: 'selai kacang/peanut butter', re: /\b(peanut\s*butter|selai\s*kacang|almond|kacang)\b/i },
  { key: 'rosella_bunga', label: 'rosella/teh bunga', re: /\b(rosella|chamomile|telang|hibiscus)\b/i },
];

function tokenizePlain(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4);
}

/**
 * Klasifikasikan peran promosi produk menjadi 'alat_dapur' | 'bahan_resep' | 'lainnya'.
 */
export function classifyProductPromoRole(product = {}, { respectExisting = true } = {}) {
  const existing = String(product?.promo_role || '').trim().toLowerCase();
  if (respectExisting && PROMO_ROLES.includes(existing)) {
    return existing;
  }

  const name = String(product?.product_name || '');
  const category = String(product?.category || '');
  const tags = String(product?.tags || '');
  const desc = String(product?.product_description || '');
  const combined = `${name} ${category} ${tags} ${desc}`;

  if (tags.toLowerCase().includes('alat_dapur') || TOOL_KEYWORD_RE.test(`${name} ${category} ${tags}`)) {
    // Pastikan bukan bahan seperti "matcha powder" yang hanya kebetulan menyebut nama resep
    if (!INGREDIENT_KEYWORD_RE.test(name) || TOOL_KEYWORD_RE.test(name)) {
      return 'alat_dapur';
    }
  }

  if (TOOL_CATEGORY_RE.test(category) && !INGREDIENT_KEYWORD_RE.test(name)) {
    return 'alat_dapur';
  }

  if (NON_CULINARY_PRODUCT_RE.test(`${name} ${category}`) && !CULINARY_INTENT_RE.test(name)) {
    return 'lainnya';
  }

  if (INGREDIENT_KEYWORD_RE.test(`${name} ${tags}`) || INGREDIENT_CATEGORY_RE.test(category)) {
    return 'bahan_resep';
  }

  if (TOOL_KEYWORD_RE.test(combined)) {
    return 'alat_dapur';
  }
  if (INGREDIENT_KEYWORD_RE.test(combined)) {
    return 'bahan_resep';
  }
  return 'lainnya';
}

/**
 * Analisis satu blueprint deconstruct untuk mengetahui metode dapur, bahan dominan, dan keamanan pangan.
 */
export function analyzeBlueprintProfile(asset = {}) {
  const niche = String(asset.niche || '').trim();
  const storyboardText = (() => {
    try {
      const sb = typeof asset.original_storyboard_json === 'string'
        ? JSON.parse(asset.original_storyboard_json || '[]')
        : (asset.original_storyboard_json || []);
      return Array.isArray(sb)
        ? sb.map(s => [s?.visual_action, s?.visual_description, s?.voiceover, s?.narration, s?.text_overlay].filter(Boolean).join(' ')).join(' ')
        : String(asset.original_storyboard_json || '');
    } catch {
      return String(asset.original_storyboard_json || '');
    }
  })();

  const ideasText = String(asset.product_ideas_json || '');
  const textBlob = [
    asset.niche,
    asset.tags,
    asset.core_problem,
    asset.core_solution,
    asset.target_audience_pain_point,
    asset.viral_pattern_summary,
    asset.original_caption,
    storyboardText,
    ideasText,
  ].filter(Boolean).join(' ');

  const methods = [];
  for (const rule of METHOD_RULES) {
    if (rule.bpRe.test(textBlob)) {
      methods.push(rule);
    }
  }

  const ingredients = [];
  for (const rule of INGREDIENT_RULES) {
    if (rule.re.test(textBlob)) {
      ingredients.push(rule);
    }
  }

  const topicalSignal = TOPICAL_OR_CLEANING_RE.test(textBlob) && !CULINARY_INTENT_RE.test(textBlob);
  const isFoodSafe = !NON_FOOD_BLUEPRINT_NICHE_RE.test(niche) && !topicalSignal;

  return {
    id: asset.id,
    niche,
    isFoodSafe,
    methods,
    ingredients,
    ideaTokens: new Set(tokenizePlain(ideasText)),
    textBlobLower: textBlob.toLowerCase(),
  };
}

/**
 * Hitung skor kecocokan antara satu blueprint profile dengan satu produk katalog.
 */
export function scoreBlueprintAgainstProduct(bpProfile, product, options = {}) {
  const promoRole = classifyProductPromoRole(product);
  const productName = String(product?.product_name || '');
  const productBlob = [
    productName,
    product?.category,
    product?.tags,
    product?.product_description,
    product?.unique_selling_point,
    product?.pain_point_solved,
  ].filter(Boolean).join(' ');

  if (!bpProfile?.isFoodSafe) {
    return {
      score: 0,
      promoRole,
      reason: 'Blueprint non-pangan tidak direkomendasikan untuk produk kuliner/dapur',
      matchedKeywords: [],
    };
  }

  let score = 0;
  const reasons = [];
  const matchedKeywords = [];

  if (promoRole === 'alat_dapur') {
    for (const m of bpProfile.methods || []) {
      if (m.prodRe.test(productBlob)) {
        score += 38;
        matchedKeywords.push(m.label);
        if (reasons.length < 2) reasons.push(`Aksi blueprint: ${m.label}`);
      }
    }
    // Bonus relevan jika ide produk blueprint menyebut kata inti produk alat
    const nameTokens = tokenizePlain(productName);
    let ideaOverlap = 0;
    for (const t of nameTokens) {
      if (bpProfile.ideaTokens?.has(t) || bpProfile.textBlobLower?.includes(t)) {
        ideaOverlap += 1;
        matchedKeywords.push(t);
      }
    }
    if (ideaOverlap > 0) {
      score += Math.min(28, ideaOverlap * 14);
      if (reasons.length === 0) reasons.push('Alat disebut langsung di naskah/ide blueprint');
    }
    // Baseline kecil untuk alat ukur/sajian umum bila blueprint memasak/herbal relevan
    if (score === 0 && /\b(Baking|Cooking|Health)\b/i.test(bpProfile.niche || '')) {
      if (/\b(timbangan|sendok\s*takar|gelas\s*ukur|gelas\s*kaca|talenan)\b/i.test(productName)) {
        score += 24;
        reasons.push(`Alat pendamping serbaguna untuk konten ${bpProfile.niche}`);
      }
    }
  } else if (promoRole === 'bahan_resep') {
    for (const ing of bpProfile.ingredients || []) {
      if (ing.re.test(productBlob)) {
        score += 46;
        matchedKeywords.push(ing.label);
        if (reasons.length < 2) reasons.push(`Bahan inti blueprint: ${ing.label}`);
      }
    }
    const nameTokens = tokenizePlain(productName).filter(t => !['nutrifarm', 'beorganik', 'sahabat', 'premix', 'premium', 'bubuk', 'powder'].includes(t));
    let tokenHits = 0;
    for (const t of nameTokens) {
      if (bpProfile.textBlobLower?.includes(t)) {
        tokenHits += 1;
        matchedKeywords.push(t);
      }
    }
    if (tokenHits > 0) {
      score += Math.min(34, tokenHits * 17);
      if (reasons.length === 0) reasons.push('Nama bahan cocok dengan resep/masalah blueprint');
    }
  } else {
    // 'lainnya' hanya diberi skor bila ada kecocokan kata langsung
    const nameTokens = tokenizePlain(productName);
    for (const t of nameTokens) {
      if (bpProfile.textBlobLower?.includes(t)) {
        score += 18;
        matchedKeywords.push(t);
      }
    }
    if (score > 0) reasons.push('Kecocokan topik spesifik');
  }

  if (score <= 0) {
    return {
      score: 0,
      promoRole,
      reason: '',
      matchedKeywords: [],
    };
  }

  // Readiness bonus agar produk siap produksi visual memprioritaskan produk lengkap
  if (options.hasCleanPhoto) score += 8;
  if (options.hasProductTruth) score += 5;
  if (options.hasAffiliateLink) score += 4;

  const uniqueKeywords = Array.from(new Set(matchedKeywords)).slice(0, 6);
  const readinessNote = options.hasCleanPhoto ? ' · foto bersih siap' : '';
  const finalReason = (reasons.join(' + ') || 'Kecocokan metode & bahan blueprint') + readinessNote;

  return {
    score: Math.min(99, Math.max(1, Math.round(score))),
    promoRole,
    reason: finalReason,
    matchedKeywords: uniqueKeywords,
  };
}
