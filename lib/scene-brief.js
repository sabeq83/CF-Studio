/**
 * lib/scene-brief.js
 * K1: Deterministic Scene Brief Extractor (Planner -> Scene Director).
 * Mengubah baris Content Planner (context, ws_matrix, visual_action_guideline, vfo, strategic_angle)
 * menjadi Scene Brief terstruktur tanpa panggilan LLM tambahan.
 */

import { resolveAngleFormat } from './angle-visual-formats.js';

const WS_FIELD_PATTERNS = {
  when: /(?:^|[|;+,\n])\s*when\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:where|while|how\s*feeling|with\s*what|with\/for\s*whom|why|what|who)\b|$))/i,
  where: /(?:^|[|;+,\n])\s*where\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:when|while|how\s*feeling|with\s*what|with\/for\s*whom|why|what|who)\b|$))/i,
  whileDoing: /(?:^|[|;+,\n])\s*while\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:when|where|how\s*feeling|with\s*what|with\/for\s*whom|why|what|who)\b|$))/i,
  feeling: /(?:^|[|;+,\n])\s*how\s*feeling\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:when|where|while|with\s*what|with\/for\s*whom|why|what|who)\b|$))/i,
  withWhat: /(?:^|[|;+,\n])\s*with\s*what\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:when|where|while|how\s*feeling|with\/for\s*whom|why|what|who)\b|$))/i,
  whom: /(?:^|[|;+,\n])\s*(?:with\/for\s*whom|who)\s*[?:]?\s*(.+?)(?=(?:[|;+,\n]\s*(?:when|where|while|how\s*feeling|with\s*what|why|what)\b|$))/i
};

function cleanWsValue(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/^\((.+)\)$/, '$1')
    .replace(/^[:\-–\s]+|[\s.;]+$/g, '')
    .trim();
}

export function parseWsMatrix(wsMatrix = '') {
  const text = String(wsMatrix || '').trim();
  if (!text) return {};
  const out = {};
  for (const [key, regex] of Object.entries(WS_FIELD_PATTERNS)) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleaned = cleanWsValue(match[1]);
      if (cleaned) out[key] = cleaned;
    }
  }
  return out;
}

const LOCATION_RULES = [
  { regex: /\b(?:kamar anak|kamar tidur anak|ruang bermain anak|nursery|kids bedroom)\b/i, id: 'kamar anak yang rapi', en: 'bright tidy Indonesian kids bedroom study corner' },
  { regex: /\b(?:kamar tidur utama|kamar tidur|bedroom|bedside|nakas)\b/i, id: 'kamar tidur yang tenang', en: 'quiet cozy home bedroom with wooden bedside nightstand' },
  { regex: /\b(?:meja belajar|ruang belajar|sudut belajar|study desk|study table)\b/i, id: 'meja belajar di rumah', en: 'tidy Indonesian home wooden study desk with open books' },
  { regex: /\b(?:ruang makan|meja makan|dining room|dining table)\b/i, id: 'ruang makan rumah', en: 'tidy Indonesian home dining room table' },
  { regex: /\b(?:ruang keluarga|living room|ruang tamu)\b/i, id: 'ruang keluarga yang hangat', en: 'warm lived-in Indonesian family living room corner' },
  { regex: /\b(?:musala|mushola|musholla|sajadah|tempat salat|ruang salat|sudut ibadah|masjid)\b/i, id: 'sudut musala / sajadah yang tenang', en: 'peaceful clean Indonesian home prayer corner with woven prayer mat' },
  { regex: /\b(?:kafe|cafe|coffee shop|kedai kopi|warung kopi|warung makan|warung|restoran|resto)\b/i, id: 'meja kafe / kedai kopi', en: 'warm everyday Indonesian cafe or wooden coffee shop table' },
  { regex: /\b(?:di dalam mobil|dalam mobil|mobil keluarga|interior mobil|kursi mobil|dashboard mobil|mobil)\b/i, id: 'interior mobil', en: 'clean parked family car interior cabin and dashboard' },
  { regex: /\b(?:meja pantry|pantry dapur|pantry rumah|pantry)\b/i, id: 'meja pantry dapur rumah', en: 'warm home kitchen pantry counter' },
  { regex: /\b(?:dapur rumah|meja dapur|kitchen|wastafel dapur|kompor)\b/i, id: 'dapur rumah', en: 'home kitchen counter with everyday cookware' },
  { regex: /\b(?:teras rumah|halaman rumah|patio|porch|terrace)\b/i, id: 'teras rumah yang asri', en: 'breezy shaded home terrace table overlooking plants' },
  { regex: /\b(?:kantin kantor|cafeteria|food court|kantin)\b/i, id: 'kantin kantor yang ramai', en: 'bustling modern office cafeteria table' },
  { regex: /\b(?:meja kerja|ruang kerja|kantor|office|facility manager|studio kerja|workspace)\b/i, id: 'meja kerja / ruang kantor', en: 'modern work desk in a calm home office or studio' },
  { regex: /\b(?:area produksi pabrik|pabrik|gudang|warehouse|workshop|rooftop)\b/i, id: 'area produksi pabrik / workshop', en: 'bright industrial factory workshop floor' },
  { regex: /\b(?:kamar mandi|bathroom|vanity table|meja rias)\b/i, id: 'meja rias / kamar mandi modern', en: 'clean modern minimalist vanity or bathroom counter' },
  { regex: /\b(?:gym|studio olahraga|workout|lapangan|taman|park|outdoor)\b/i, id: 'area olahraga / taman segar', en: 'bright active home workout corner or sunlit garden table' }
];

const UNKNOWN_LOCATION_DICTIONARY = [
  [/\bruang tunggu\b/gi, 'waiting room'],
  [/\brumah sakit\b/gi, 'hospital'],
  [/\bpuskesmas\b/gi, 'community clinic'],
  [/\bklinik\b/gi, 'modern clinic'],
  [/\bapotek\b/gi, 'pharmacy counter'],
  [/\bsupermarket\b/gi, 'grocery aisle'],
  [/\bminimarket\b/gi, 'convenience store aisle'],
  [/\bpasar\b/gi, 'local market stall'],
  [/\btoko\b/gi, 'shop counter'],
  [/\bsekolah\b/gi, 'school classroom'],
  [/\bbalkon\b/gi, 'apartment balcony'],
  [/\btangga\b/gi, 'indoor staircase'],
  [/\bhalaman\b/gi, 'home front yard'],
  [/\bruang\b/gi, 'room'],
  [/\bkamar\b/gi, 'room'],
  [/\bmeja\b/gi, 'table'],
  [/\bsudut\b/gi, 'corner'],
  [/\brumah\b/gi, 'Indonesian home']
];

function translateUnknownLocationToEn(cleanedWhere = '') {
  let translated = String(cleanedWhere || '').trim();
  if (!translated) return 'clean everyday Indonesian home tabletop';
  for (const [pattern, replacement] of UNKNOWN_LOCATION_DICTIONARY) {
    translated = translated.replace(pattern, replacement);
  }
  const hasUntranslatedIndonesian = /\b(?:yang|dan|atau|untuk|saat|dekat|samping|depan|belakang|dalam|dengan|bersama|lobi|teras|serambi|pondok|masjid|keluarga|anak|ibu|bapak)\b/i.test(translated)
    || translated.toLowerCase() === cleanedWhere.toLowerCase();
  if (hasUntranslatedIndonesian) {
    return `clean everyday Indonesian indoor setting (render in English matching context: "${cleanedWhere}")`;
  }
  return `clean bright ${translated.replace(/\s+/g, ' ').trim()}`;
}

const TIME_RULES = [
  {
    key: 'night',
    regex: /\b(?:malam hari|menjelang tidur|malam|tengah malam|late night|nighttime|tonight|bedtime|malam sunyi)\b/i,
    labelId: 'Malam hari',
    lightingEn: 'well-lit warm 3000K indoor bedside or evening room lamp light keeping hands and objects clearly visible with soft natural shadows (no dark murky gloom, strictly night ambiance without morning window sunlight)',
    dramaticLightingEn: 'warm 2800K bedside lamp with subtle evening contrast (strictly night ambiance, no morning window sunlight)'
  },
  {
    key: 'midday',
    regex: /\b(?:siang hari|jam makan siang|istirahat siang|shift siang|siang|midday|noon|lunchtime|lunch break)\b/i,
    labelId: 'Siang hari',
    lightingEn: 'bright crisp midday indoor ambient daylight (5200K) filtering cleanly across the room (no dim dusk or amber bedtime lamp)'
  },
  {
    key: 'afternoon',
    regex: /\b(?:sore hari|petang|late afternoon|evening light|senja)\b/i,
    labelId: 'Sore hari',
    lightingEn: 'soft warm late-afternoon side daylight (3800K) with relaxed long shadows'
  },
  {
    key: 'morning',
    regex: /\b(?:pagi hari|sarapan|pagi|morning|breakfast|subuh|esok pagi)\b/i,
    labelId: 'Pagi hari',
    lightingEn: 'fresh bright natural morning window daylight (4800K) with soft airy highlights'
  }
];

const PROTAGONIST_RULES = [
  { regex: /\b(?:bunda\s*(?:&|dan)\s*suami|bersama pasangan|pasangan|suami dan istri)\b/i, label: 'Bunda bersama pasangan (dua cangkir/sajian pendamping, fokus POV tangan utama)' },
  { regex: /\b(?:bunda|ibu rumah tangga|ibu)\b/i, label: 'Bunda (tangan wanita Indonesia dewasa)' },
  { regex: /\b(?:suami|ayah|bapak|pria)\b/i, label: 'Pria dewasa Indonesia' },
  { regex: /\b(?:manajer fasilitas|karyawan|pekerja|rekan kerja|teknisi)\b/i, label: 'Profesional / pekerja Indonesia' },
  { regex: /\b(?:anak muda|olahragawan|wanita muda)\b/i, label: 'Dewasa muda aktif Indonesia' }
];

const PROP_PATTERNS = [
  { regex: /\bbuk[u]?\s*(?:catatan|agenda)\b|\bnotebook\b/i, prop: 'open paper notebook and pen' },
  { regex: /\b(?:bingkai foto keluarga|foto keluarga)\b/i, prop: 'warm wooden family photo frame' },
  { regex: /\blampu tidur|lampu meja\b/i, prop: 'soft glowing bedside table lamp' },
  { regex: /\blilin aromaterapi\b/i, prop: 'small unscented ceramic tealight candle' },
  { regex: /\b(?:cangkir hangat|cangkir teh|tea cup|mug)\b/i, prop: 'ceramic tea mug with gentle rising steam' },
  { regex: /\b(?:piring kecil|piring saji|sarapan)\b/i, prop: 'clean ceramic side plate and spoon' },
  { regex: /\b(?:laptop|spreadsheet|laporan anggaran)\b/i, prop: 'open laptop with clean screen glow' },
  { regex: /\b(?:gelas bening|gelas air|gelas minum|tumbler)\b/i, prop: 'plain clear drinking glass' },
  { regex: /\b(?:mangkuk keramik|mangkuk kecil)\b/i, prop: 'small plain ceramic bowl' },
  { regex: /\b(?:talenan|ulekan|mortar|sendok kayu|sendok)\b/i, prop: 'small wooden spoon or compact wooden board' },
  { regex: /\b(?:tirai|jendela)\b/i, prop: 'sheer window curtains' },
  { regex: /\b(?:kantin|dinding beton)\b/i, prop: 'cafeteria tray and plain ceramic cups' },
  { regex: /\b(?:sajadah|tasbih)\b/i, prop: 'clean folded woven prayer mat' },
  { regex: /\b(?:setir|sabuk pengaman|dashboard)\b/i, prop: 'car steering wheel and clean travel cup' },
  { regex: /\b(?:termometer|panel|denah)\b/i, prop: 'architectural blueprint sheet or digital room thermometer' }
];

const GENERIC_PRODUCT_MENTION_RE = /\b(?:toples|jar|botol|bottle|kemasan|packaging|label|merek|produk|product|sachet|kaleng|kapsul|suplemen|garlibee|nutribake|siasat\s*sehat|dapur\s*botani)\b/i;

function buildProductMentionRegex(productName = '', brandName = '') {
  const dynamicTokens = `${productName} ${brandName}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(tok => tok.length >= 4 && !['madu', 'bawang', 'lanang', 'herbal', 'alami', 'natural', 'blend', 'sehat', 'dapur', 'untuk', 'dengan'].includes(tok));
  if (dynamicTokens.length === 0) return GENERIC_PRODUCT_MENTION_RE;
  const escaped = dynamicTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:${GENERIC_PRODUCT_MENTION_RE.source})|\\b(?:${escaped.join('|')})\\b`, 'i');
}

function splitVisualActionByProductMention(actionText = '', productName = '', brandName = '') {
  const raw = String(actionText || '').trim();
  if (!raw) {
    return { preBridge: '', bridgeOnly: '' };
  }
  const productRe = buildProductMentionRegex(productName, brandName);
  const clauses = raw
    .split(/(?<=[.!?;\n])\s+/)
    .map(c => c.trim())
    .filter(Boolean);

  const preBridgeClauses = [];
  const bridgeClauses = [];
  for (const clause of clauses) {
    if (productRe.test(clause)) {
      bridgeClauses.push(clause);
    } else {
      preBridgeClauses.push(clause);
    }
  }
  return {
    preBridge: preBridgeClauses.join(' ').trim(),
    bridgeOnly: bridgeClauses.join(' ').trim()
  };
}

function inferLocation(sources, fallbackEnv = '') {
  const { wsWhere, action, context, pillar } = sources;

  const findRule = (text) => LOCATION_RULES.find(rule => rule.regex.test(text || ''));

  // Priority 1: explicit W'S Where
  const whereRule = findRule(wsWhere);
  if (whereRule) {
    return { location: whereRule.id, locationEn: whereRule.en, locationSource: 'ws_matrix.where' };
  }
  if (wsWhere) {
    const cleanedWhere = wsWhere.replace(/^di\s+(?:dalam\s+)?/i, '').trim();
    if (cleanedWhere.length >= 4) {
      return {
        location: cleanedWhere,
        locationEn: translateUnknownLocationToEn(cleanedWhere),
        locationSource: 'ws_matrix.where_raw'
      };
    }
  }

  // Priority 2: context & visual_action_guideline
  const combinedCtx = [context, action, pillar].filter(Boolean).join(' | ');
  const ctxRule = findRule(context);
  if (ctxRule) {
    return { location: ctxRule.id, locationEn: ctxRule.en, locationSource: 'context' };
  }
  const actionRule = findRule(action);
  if (actionRule) {
    return { location: actionRule.id, locationEn: actionRule.en, locationSource: 'visual_action_guideline' };
  }
  const combinedRule = findRule(combinedCtx);
  if (combinedRule) {
    return { location: combinedRule.id, locationEn: combinedRule.en, locationSource: 'combined_text' };
  }

  // Priority 3: Visual Identity Brand Card fallback location
  if (fallbackEnv) {
    return {
      location: fallbackEnv,
      locationEn: fallbackEnv,
      locationSource: 'visual_identity_fallback'
    };
  }

  return {
    location: 'Meja rumah harian yang rapi dan natural',
    locationEn: 'clean everyday Indonesian home tabletop',
    locationSource: 'neutral_home_default'
  };
}

function inferTimeAndLighting(sources, vsoData = null) {
  const { wsWhen, wsWhere, wsWhile, context, action } = sources;
  const searchOrder = [wsWhen, wsWhere, wsWhile, context, action].filter(Boolean);
  const contrastPref = String(vsoData?.lighting?.contrast || '').toLowerCase();
  const useDramaticNight = contrastPref === 'dramatic' || contrastPref === 'high';

  for (const snippet of searchOrder) {
    for (const rule of TIME_RULES) {
      if (rule.regex.test(snippet)) {
        const lightingEn = rule.key === 'night' && useDramaticNight
          ? rule.dramaticLightingEn
          : rule.lightingEn;
        return {
          timeKey: rule.key,
          time_of_day: rule.labelId,
          lighting_mood: lightingEn,
          timeSource: snippet === wsWhen ? 'ws_matrix.when' : (snippet === context ? 'context' : 'visual_action_guideline')
        };
      }
    }
  }

  const brandLight = vsoData?.lighting?.character || vsoData?.lighting_prompt || vsoData?.lighting?.custom_description || '';
  return {
    timeKey: 'neutral',
    time_of_day: null,
    lighting_mood: brandLight || 'soft balanced natural indoor light',
    timeSource: brandLight ? 'visual_identity_character' : 'neutral_default'
  };
}

function inferSituationalProps(sources, locationResult, timeResult) {
  const { bridgeOnly } = splitVisualActionByProductMention(sources.action, sources.productName, sources.brandName);
  // Allow non-product room props while suppressing product/packaging tokens so "toples" never leaks as a pre-bridge container prop.
  const actionWithoutProductWords = bridgeOnly
    ? `${sources.actionPreBridge || ''} ${bridgeOnly.replace(/\b(?:toples|jar|botol|bottle|wadah kaca|kemasan)\b/gi, '')}`.trim()
    : sources.action;
  const combined = [sources.wsWithWhat, actionWithoutProductWords, sources.context, sources.wsWhile, sources.hook]
    .filter(Boolean)
    .join(' | ');
  const props = [];
  for (const item of PROP_PATTERNS) {
    if (item.regex.test(combined) && !props.includes(item.prop)) {
      props.push(item.prop);
    }
    if (props.length >= 4) break;
  }

  if (props.length === 0) {
    if (/kamar tidur|bedroom/i.test(locationResult.locationEn)) {
      props.push('wooden bedside nightstand', 'soft bedside lamp');
    } else if (/ruang makan|dining/i.test(locationResult.locationEn)) {
      props.push('clean dining plate and ceramic cup', 'linen table runner');
    } else if (/teras|terrace/i.test(locationResult.locationEn)) {
      props.push('small porch wood table', 'potted green houseplants in soft blur');
    } else if (/kafe|cafe|coffee/i.test(locationResult.locationEn)) {
      props.push('warm ceramic cafe cup', 'small wooden table napkin');
    } else if (/mobil|car interior/i.test(locationResult.locationEn)) {
      props.push('car steering wheel', 'clean travel cup');
    } else if (/musala|prayer/i.test(locationResult.locationEn)) {
      props.push('woven prayer mat', 'small warm side table');
    } else if (/kamar anak|kids bedroom/i.test(locationResult.locationEn)) {
      props.push('tidy kids study desk', 'colored pencil cup');
    } else if (/meja belajar|study desk/i.test(locationResult.locationEn)) {
      props.push('open study notebook', 'desk lamp');
    } else if (/kantor|desk|kantin/i.test(locationResult.locationEn)) {
      props.push('clean modern desk mat', 'plain drinking glass');
    } else {
      props.push('clean ceramic bowl', 'plain glass');
    }
  }

  if (timeResult.timeKey === 'night' && !props.some(p => /lamp|candle/i.test(p))) {
    props.push('warm indoor bedside or table lamp');
  }
  return props.slice(0, 4);
}

function inferFeeling(wsParsed, context = '') {
  if (wsParsed.feeling) return wsParsed.feeling;
  const ctx = String(context || '');
  if (/cemas|khawatir|frustrasi|terganggu|bising|lelah|gerah|berat|begah/i.test(ctx)) {
    const snippet = ctx.match(/(?:merasa|rasa|merenungkan|khawatir|cemas|lelah|frustrasi|terganggu)[^.,;]+/i)?.[0];
    if (snippet) return snippet.trim();
  }
  return '';
}

function inferProtagonist(sources, vsoData = null) {
  const combined = [sources.wsWhom, sources.context, sources.action].filter(Boolean).join(' ');
  for (const rule of PROTAGONIST_RULES) {
    if (rule.regex.test(combined)) return rule.label;
  }
  const demKey = vsoData?.subject?.demographic_key || vsoData?.structured?.subject?.demographic_key || '';
  if (/male/i.test(demKey)) return 'Pria dewasa Indonesia (POV tangan)';
  if (/syari|muslimah|female/i.test(demKey)) return 'Wanita Indonesia (POV tangan berlengan panjang sopan)';
  return 'Audiens Indonesia (POV tangan natural)';
}

export { splitVisualActionByProductMention };

/**
 * Extract structured Scene Brief deterministically from a content planner row.
 */
export function buildSceneBrief(rowPayload = {}, campaignData = {}, { brandProfile = null, vsoData = null, productData = null } = {}) {
  const row = rowPayload || {};
  const wsRaw = row.ws_matrix || campaignData.ws_matrix || '';
  const wsParsed = parseWsMatrix(wsRaw);
  const rawAction = row.visual_action_guideline || campaignData.visual_action_guideline || '';
  const productName = productData?.product_name || campaignData.product_name || row.product_name || '';
  const brandName = brandProfile?.brand_name || campaignData.brand_name || '';
  const actionSplit = splitVisualActionByProductMention(rawAction, productName, brandName);

  const sources = {
    wsWhen: wsParsed.when || '',
    wsWhere: wsParsed.where || '',
    wsWhile: wsParsed.whileDoing || '',
    wsFeeling: wsParsed.feeling || '',
    wsWithWhat: wsParsed.withWhat || '',
    wsWhom: wsParsed.whom || '',
    context: row.context || campaignData.context || '',
    action: rawAction,
    actionPreBridge: actionSplit.preBridge,
    actionBridgeOnly: actionSplit.bridgeOnly,
    productName,
    brandName,
    vfo: row.vfo || campaignData.vfo || '',
    strategicAngle: row.strategic_angle || campaignData.strategic_angle || '',
    hook: row.custom_hook || campaignData.custom_hook || '',
    pillar: row.content_pillar || campaignData.content_pillar || '',
    contentSubject: row.content_subject || campaignData.content_subject || ''
  };

  const viStructured = vsoData?.structured || vsoData || {};
  const fallbackEnv = viStructured?.environment?.fallback_location
    || viStructured?.environment?.custom_description
    || vsoData?.environment_prompt
    || '';

  const locResult = inferLocation(sources, fallbackEnv);
  const timeResult = inferTimeAndLighting(sources, viStructured);
  const situationalProps = inferSituationalProps(sources, locResult, timeResult);
  const feeling = inferFeeling(wsParsed, sources.context);
  const protagonist = inferProtagonist(sources, vsoData);
  const angleFormat = resolveAngleFormat(sources.strategicAngle);

  return {
    location: locResult.location,
    location_en: locResult.locationEn,
    time_of_day: timeResult.time_of_day,
    time_key: timeResult.timeKey,
    lighting_mood: timeResult.lighting_mood,
    situational_props: situationalProps,
    feeling,
    protagonist,
    vfo: sources.vfo,
    visual_action_hint: actionSplit.preBridge || (actionSplit.bridgeOnly ? 'Ikuti situasi ruangan dan properti tanpa memunculkan produk sebelum klip bridge' : rawAction),
    visual_action_hint_pre_bridge: actionSplit.preBridge,
    visual_action_hint_bridge: actionSplit.bridgeOnly,
    angle_format_key: angleFormat.key,
    angle_label: angleFormat.label,
    angle_set: angleFormat.set,
    allows_3d: Boolean(angleFormat.allows3D),
    signature_cues: angleFormat.signatureVisualCues,
    source_trace: {
      location_source: locResult.locationSource,
      time_source: timeResult.timeSource,
      has_context: Boolean(sources.context),
      has_ws_matrix: Boolean(wsRaw),
      has_visual_action_guideline: Boolean(rawAction),
      split_bridge_action: Boolean(actionSplit.bridgeOnly),
      raw_angle: sources.strategicAngle || null,
      brand_name: brandProfile?.brand_name || null
    }
  };
}
