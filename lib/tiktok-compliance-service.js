import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { readKbFile } from './kb-loader.js';

/**
 * High-speed Lexicon Pattern Scanner for TikTok Shop Policy Blockers & High Risk Claims
 * Extended with COMPLIANCE_GUIDE.md Section 16 & Section 21
 */
const FORBIDDEN_LEXICON_BLOCKERS = [
  { pattern: /menyembuhkan/i, category: 'disease_treatment_claim', reason: 'Klaim menyembuhkan penyakit dilarang oleh kebijakan TikTok Shop (Section 21).' },
  { pattern: /mengobati/i, category: 'disease_treatment_claim', reason: 'Klaim mengobati penyakit dilarang oleh kebijakan TikTok Shop (Section 21).' },
  { pattern: /obat\s+penyakit/i, category: 'disease_treatment_claim', reason: 'Penggunaan istilah obat penyakit dilarang untuk produk non-farmasi (Section 21).' },
  { pattern: /garansi\s+100%/i, category: 'guaranteed_results_claim', reason: 'Klaim garansi 100% hasil instan dilarang (Section 15).' },
  { pattern: /dijamin\s+langsing/i, category: 'weight_loss_claim', reason: 'Klaim jaminan penurunan berat badan dilarang (Section 5.2).' },
  { pattern: /hilang\s+permanen/i, category: 'permanent_results_claim', reason: 'Klaim hasil permanen instan dilarang (Section 21.5).' },
  { pattern: /resep\s+dokter/i, category: 'doctor_endorsement_claim', reason: 'Klaim endorse atau resep dokter tanpa lisensi terbukti dilarang (Section 10).' },
  { pattern: /usus\s+kotor|detoks|detox|luntur\s+lemak/i, category: 'pseudo_medical_detox_claim', reason: 'Klaim detox usus kotor / luntur lemak tanpa bukti klinis dilarang (Section 5.2 & 6).' },
  { pattern: /tanpa\s+efek\s+samping|tanpa\s+ketergantungan|bebas\s+efek\s+samping|bebas\s+ketergantungan|aman\s+tanpa\s+efek/i, category: 'prohibited_absolute_safety_claim', reason: 'Frasa tanpa efek samping / tanpa ketergantungan dilarang keras (Section 16).' },
  { pattern: /menurunkan\s+kolesterol|menurunkan\s+gula\s+darah|mencegah\s+kanker|menyembuhkan\s+wasir|mengobati\s+ambeyen|menghilangkan\s+diabetes/i, category: 'restricted_medical_claim', reason: 'Klaim penyakit kronis/organ dalam dilarang mutlak (Section 21.2).' }
];

async function callGeminiJson(prompt, systemInstruction = '') {
  const model = await getGeminiModel();
  const fullPrompt = systemInstruction 
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;
    
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  });

  const responseText = result.response.text();
  return parseGeminiJSON(responseText, 'gemini');
}

/**
 * Local Lexicon Pre-Scanner
 */
export function scanLexicon(text) {
  const detected = [];
  if (!text) return detected;
  
  FORBIDDEN_LEXICON_BLOCKERS.forEach(rule => {
    if (rule.pattern.test(text)) {
      detected.push({
        category: rule.category,
        matched_text: text.match(rule.pattern)[0],
        reason: rule.reason
      });
    }
  });
  return detected;
}

/**
 * Method 1: Review Creative Content Package (Call 1 Output)
 */
export async function reviewCreative(item, creativePackage, productProfile = {}) {
  const hook = creativePackage.creative_direction?.final_hook || item.hook || '';
  const masterVo = creativePackage.voice_over?.master_vo || '';
  const storyboard = creativePackage.storyboard || [];

  const textToScan = `${hook} ${masterVo} ${storyboard.map(s => s.voice_over || '').join(' ')} ${storyboard.map(s => s.on_screen_text || '').join(' ')}`;
  const lexiconIssues = scanLexicon(textToScan);

  // USULAN 2: Zero-Token Local Pre-Filter Bypass
  if (lexiconIssues.length === 0) {
    console.log(`[TikTokComplianceService] ✅ Creative Package item #${item.id || ''} bersih dari kata terlarang (Zero-Token Lexicon Pass).`);
    return {
      status: 'pass',
      verdict: 'pass',
      risk_level: 'low',
      risk_score: 'low',
      detected_issues: [],
      safe_revisions: {
        final_hook: hook,
        master_voice_over: masterVo,
        scene_voice_overs: storyboard.map(s => s.voice_over || '')
      },
      human_review_required: false
    };
  }

  // Cooldown Pacing jika terdeteksi blocker
  console.warn(`[TikTokComplianceService] ⚠️ Terdeteksi ${lexiconIssues.length} kata sensitif pada item #${item.id || ''}. Memberikan jeda cooldown 12 detik sebelum meminta AI revisi aman...`);
  await new Promise(resolve => setTimeout(resolve, 12000));

  const complianceKb = readKbFile('COMPLIANCE_GUIDE.md') || '';

  const systemInstruction = `
Kamu adalah TikTok Shop Compliance Auditor & QC Specialist senior (Health & Beauty Niche).
Tugasmu adalah melakukan audit kepatuhan terhadap naskah video berdasarkan Knowledge Base resmi COMPLIANCE_GUIDE.md berikut:

${complianceKb}

ATURAN HASIL STATUS:
- "pass": Naskah bersih dari klaim terlarang.
- "revise": Terdapat klaim terlarang/superlatif ringan yang BISA DIREVISI OTOMATIS menjadi kalimat aman tanpa merusak strategi.
- "block": Terdapat pelanggaran fundamental berat yang dilarang penuh.
- "human_review": Terdapat kalimat berisiko tinggi / ambigu yang memerlukan keputusan manusia (Human-in-the-loop).

FORMAT OUTPUT JSON WAJIB:
{
  "status": "pass" | "revise" | "block" | "human_review",
  "verdict": "pass" | "revise" | "block" | "human_review",
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": "low" | "medium" | "high" | "critical",
  "detected_issues": [
    {
      "field": "final_hook" | "master_voice_over" | "scene_voice_over",
      "category": "disease_treatment_claim" | "guaranteed_results_claim" | "medical_misinformation" | "prohibited_safety_claim",
      "original_text": "...",
      "reason": "...",
      "policy_reference": "COMPLIANCE_GUIDE.md Section 16/21"
    }
  ],
  "safe_revisions": {
    "final_hook": "Teks revisi aman...",
    "master_voice_over": "Teks master VO revisi aman...",
    "scene_voice_overs": ["Klip 1 revisi...", "Klip 2 revisi..."]
  },
  "human_review_required": boolean
}
`;

  const prompt = `
Lakukan audit kepatuhan TikTok terhadap data naskah berikut:
Produk: ${item.product}
Final Hook: "${hook}"
Master Voiceover: "${masterVo}"
Adegan Storyboard (${storyboard.length} Klip):
${storyboard.map((s, idx) => `Klip #${idx+1}: VO="${s.voice_over || ''}" | Text="${s.on_screen_text || ''}" | Visual="${s.visual_action || ''}"`).join('\n')}

Isu Pemindaian awal Lexicon: ${JSON.stringify(lexiconIssues)}

Hasilkan audit JSON sesuai schema di atas.
`;

  console.log(`[TikTokComplianceService] Reviewing Creative Package for item ${item.id}...`);
  const reviewResult = await callGeminiJson(prompt, systemInstruction);

  if (lexiconIssues.length > 0 && reviewResult.status === 'pass') {
    reviewResult.status = 'revise';
    reviewResult.verdict = 'revise';
    reviewResult.risk_level = 'medium';
    reviewResult.risk_score = 'medium';
    reviewResult.human_review_required = true;
  }

  reviewResult.verdict = reviewResult.verdict || reviewResult.status;
  reviewResult.risk_score = reviewResult.risk_score || reviewResult.risk_level;

  return reviewResult;
}

/**
 * Method 2: Rewrite Unsafe Fields in Creative Package using Safe Revisions
 */
export function rewriteUnsafeFields(item, creativePackage, safeRevisions = {}) {
  if (!creativePackage) return creativePackage;

  const updatedPkg = JSON.parse(JSON.stringify(creativePackage));

  if (safeRevisions.final_hook && updatedPkg.creative_direction) {
    updatedPkg.creative_direction.final_hook = safeRevisions.final_hook;
  }

  if (safeRevisions.master_voice_over && updatedPkg.voice_over) {
    updatedPkg.voice_over.master_vo = safeRevisions.master_voice_over;
  }

  if (Array.isArray(safeRevisions.scene_voice_overs) && Array.isArray(updatedPkg.storyboard)) {
    safeRevisions.scene_voice_overs.forEach((revVo, idx) => {
      if (updatedPkg.storyboard[idx] && revVo) {
        updatedPkg.storyboard[idx].voice_over = revVo;
      }
    });
  }

  return updatedPkg;
}

/**
 * Method 3: Review Publishing Content Package (Call 2 Output)
 */
export async function reviewPublishing(item, creativePackage, publishingPackage, productProfile = {}) {
  const tiktokCaption = publishingPackage?.publishing_assets?.tiktok?.caption || '';
  const igCaption = publishingPackage?.publishing_assets?.instagram?.caption || '';
  const cta = publishingPackage?.publishing_assets?.tiktok?.cta || '';

  const lexiconIssues = scanLexicon(`${tiktokCaption} ${igCaption} ${cta}`);

  // USULAN 2: Zero-Token Local Pre-Filter Bypass
  if (lexiconIssues.length === 0) {
    console.log(`[TikTokComplianceService] ✅ Publishing Package item #${item.id || ''} bersih dari kata terlarang (Zero-Token Lexicon Pass).`);
    return {
      status: 'pass',
      verdict: 'pass',
      risk_level: 'low',
      risk_score: 'low',
      detected_issues: [],
      safe_revisions: {
        tiktok_caption: tiktokCaption,
        cta: cta
      },
      human_review_required: false
    };
  }

  // Cooldown Pacing jika terdeteksi blocker
  console.warn(`[TikTokComplianceService] ⚠️ Terdeteksi ${lexiconIssues.length} kata sensitif pada publishing item #${item.id || ''}. Memberikan jeda cooldown 12 detik...`);
  await new Promise(resolve => setTimeout(resolve, 12000));

  const complianceKb = readKbFile('COMPLIANCE_GUIDE.md') || '';

  const systemInstruction = `
Kamu adalah TikTok Shop Publishing Compliance Auditor.
Tugasmu adalah memeriksa Caption media sosial, CTA, dan Hashtag hasil Call 2 berdasarkan Kebijakan Resmi COMPLIANCE_GUIDE.md:

${complianceKb}

Format Output WAJIB berupa JSON Object:
{
  "status": "pass" | "revise" | "block" | "human_review",
  "verdict": "pass" | "revise" | "block" | "human_review",
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": "low" | "medium" | "high" | "critical",
  "detected_issues": [],
  "safe_revisions": {
    "tiktok_caption": "...",
    "cta": "..."
  },
  "human_review_required": boolean
}
`;

  const prompt = `
Lakukan audit kepatuhan penerbitan terhadap data berikut:
TikTok Caption: "${tiktokCaption}"
Instagram Caption: "${igCaption}"
CTA: "${cta}"
Isi Lexicon Issues: ${JSON.stringify(lexiconIssues)}

Hasilkan audit JSON.
`;

  console.log(`[TikTokComplianceService] Reviewing Publishing Package for item ${item.id}...`);
  const res = await callGeminiJson(prompt, systemInstruction);
  res.verdict = res.verdict || res.status;
  res.risk_score = res.risk_score || res.risk_level;
  return res;
}

const HERBAL_MEDICAL_CLAIM_TOKENS_RE = /\b(kolesterol|kolestrol|cholesterol|jantung|heart\s+disease|gula\s+darah|blood\s+sugar|diabetes|diabet|hipertensi|hypertension|darah\s+tinggi|asam\s+urat|kanker|cancer|tumor|stroke|wasir|ambeien|maag|lambung\s+akut|obat|medicine|mengobati|menyembuhkan|cure|terapi\s+penyakit|diagnosa|resep\s+dokter)\b/i;

const STRICT_RAMUAN_CLAIM_TOKENS_RE = /\b(lemak|metabolisme|metabolism|detoks|detox|ginjal|kidney|visceral|luntur\s+lemak|membakar\s+lemak|melangsingkan|menguruskan|pelangsing|perut\s+buncit|turun\s+berat)\b/i;

/**
 * Checks whether an overlay phrase (Hook Card / Keyword Punch) contains medical/disease claim tokens
 * prohibited on TikTok/Reels for herbal or food products.
 * When `strict` is true (e.g. `ramuan_ritual`), also blocks wellness/metabolic claim tokens such as
 * lemak, metabolisme, detoks, ginjal, visceral, etc.
 */
export function isHerbalMedicalClaimPhrase(text, { strict = false } = {}) {
  if (!text || typeof text !== 'string') return false;
  if (HERBAL_MEDICAL_CLAIM_TOKENS_RE.test(text)) return true;
  if (strict && STRICT_RAMUAN_CLAIM_TOKENS_RE.test(text)) return true;
  return false;
}

/**
 * Resolves whether a product belongs to the herbal/health/wellness group.
 * Defaults conservatively to true whenever product category/identity cannot be verified as non-herbal.
 */
export function resolveIsHerbalProduct({
  category = '',
  tags = '',
  productName = '',
  isHerbalExplicit = null
} = {}) {
  if (typeof isHerbalExplicit === 'boolean') return isHerbalExplicit;
  const combined = `${category || ''} ${tags || ''} ${productName || ''}`.trim();
  if (!combined) return true;
  if (/herbal|jamu|suplemen|supplement|madu|honey|minyak\s+balur|essential|kesehatan|wellness|rempah|apotek|sari\s+lemon/i.test(combined)) {
    return true;
  }
  if (/peralatan\s+dapur|baking|cookware|alat\s+masak|panci|wajan|cetakan|pisau|elektronik|kitchenware|rolled\s+oat|cocoa|cokelat|tepung/i.test(combined)) {
    return false;
  }
  return true;
}

/**
 * Shared pre-render resolver extracting Hook Card candidate text and herbal product classification
 * cleanly across OPC, RE, Multiplier, and Instant workers.
 */
export async function resolvePreRenderFinishingMeta({
  db = null,
  campaign = null,
  item = null,
  task = null,
  parsedResult = null
} = {}) {
  const safeParse = (val) => {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (_) { return {}; }
  };

  const rowPayload = safeParse(item?.row_creative_payload);
  const resObj = parsedResult || safeParse(item?.result_json);
  const remakeObj = safeParse(task?.remake_storyboard_json);
  const bridging = safeParse(task?.bridging_config_json);
  const audioConfig = safeParse(task?.audio_config_json);
  const aesthetics = safeParse(task?.vso_config_json);
  const prodSnapshot = safeParse(task?.product_snapshot_json);
  const ephemeralProd = safeParse(campaign?.ephemeral_product_data);

  const finishingPlan = resObj?.finishing_plan || remakeObj?.finishing_plan || rowPayload?.finishing_plan || null;

  const hookTitle = String(
    rowPayload.custom_hook ||
    bridging.angleTitle ||
    item?.yt_title ||
    task?.yt_title ||
    resObj.yt_title ||
    resObj.social_media_package?.title ||
    campaign?.custom_hook ||
    ''
  ).trim();

  const productId = campaign?.target_product_id || task?.target_product_id || item?.product_id || null;
  let dbProduct = null;
  if (db && productId) {
    try {
      dbProduct = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(productId);
    } catch (_) {}
  }

  const isHerbalProduct = resolveIsHerbalProduct({
    category: dbProduct?.category || prodSnapshot?.category || ephemeralProd?.category || '',
    tags: dbProduct?.tags || prodSnapshot?.tags || ephemeralProd?.tags || '',
    productName: dbProduct?.product_name || prodSnapshot?.product_name || ephemeralProd?.product_name || rowPayload?.product_name || ''
  });

  // Legacy campaigns with NULL caption_mode default safely to 'full'
  const rawCaptionMode = audioConfig?.caption_mode ?? aesthetics?.caption_mode ?? campaign?.caption_mode;
  const captionMode = rawCaptionMode && String(rawCaptionMode).trim() !== ''
    ? String(rawCaptionMode).trim().toLowerCase()
    : 'full';

  const finishingTemplateRaw =
    audioConfig?.finishing_template ??
    aesthetics?.finishing_template ??
    campaign?.finishing_template ??
    'none';
  const finishingTemplate = String(finishingTemplateRaw || 'none').trim().toLowerCase() || 'none';

  const loudnessTarget = Number(
    audioConfig?.loudness_target ?? aesthetics?.loudness_target ?? campaign?.loudness_target ?? -14
  );

  const captionText = String(
    task?.new_caption ||
    item?.new_caption ||
    resObj?.social_media_package?.caption ||
    remakeObj?.social_media_package?.caption ||
    ''
  );

  const productData = (dbProduct || Object.keys(prodSnapshot).length > 0 || Object.keys(ephemeralProd).length > 0)
    ? { ...ephemeralProd, ...prodSnapshot, ...(dbProduct || {}) }
    : null;

  const brandProfileId = campaign?.brand_profile_id || item?.brand_profile_id || task?.brand_profile_id || null;
  let dbBrand = null;
  if (db && brandProfileId) {
    try {
      dbBrand = await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(brandProfileId);
    } catch (_) {}
  }

  const resolvedBrandName = String(
    dbBrand?.brand_name || campaign?.account_name || task?.account_name || ''
  ).trim();
  const buildMark = (name) => {
    const clean = String(name || '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (!clean) return '';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };
  const platformKey = String(campaign?.target_platform || audioConfig?.platform || 'tiktok').trim().toLowerCase();
  const platformDefaultCta = platformKey === 'facebook'
    ? (dbBrand?.default_cta_facebook || dbBrand?.brand_slogan_or_cta || '')
    : platformKey === 'youtube'
      ? (dbBrand?.default_cta_youtube || dbBrand?.brand_slogan_or_cta || '')
      : (dbBrand?.default_cta_tiktok || dbBrand?.brand_slogan_or_cta || '');

  const targetLanguage = String(
    campaign?.target_language ||
    audioConfig?.target_language ||
    aesthetics?.target_language ||
    rowPayload?.target_language ||
    task?.target_language ||
    'id-ID'
  ).trim();

  const brand = {
    name: resolvedBrandName,
    mark: buildMark(resolvedBrandName),
    logoUrl: dbBrand?.logo_url || '',
    color: dbBrand?.brand_color || '',
    tagline: dbBrand?.brand_tagline || '',
    defaultCta: platformDefaultCta,
    defaultCtaTiktok: dbBrand?.default_cta_tiktok || '',
    defaultCtaFacebook: dbBrand?.default_cta_facebook || '',
    defaultCtaYoutube: dbBrand?.default_cta_youtube || '',
    safetyNoticeText: dbBrand?.safety_notice_text || '',
    presenterName: dbBrand?.presenter_name || '',
    presenterRole: dbBrand?.presenter_role || '',
    location: dbBrand?.brand_location || '',
    targetLanguage
  };

  const brandPatch = finishingPlan?.brand_patch || rowPayload?.brand_patch || audioConfig?.brand_patch || null;

  return {
    hookTitle,
    isHerbalProduct,
    finishingPlan,
    finishingTemplate,
    captionMode,
    loudnessTarget: Number.isFinite(loudnessTarget) ? loudnessTarget : -14,
    productData,
    captionText,
    brand,
    targetLanguage,
    brandPatch
  };
}

/**
 * Audit Voiceover Script & Caption for TikTok Shop Compliance (Poller & Worker AI Auditor)
 */
export async function auditScriptForTikTok(voiceoverText = '', captionText = '') {
  const textToScan = `${voiceoverText} ${captionText}`.trim();
  const lexiconIssues = scanLexicon(textToScan);

  // USULAN 2: Zero-Token Local Pre-Filter Bypass
  // Jika pemindaian lokal bersih dari kata terlarang, langsung PASS tanpa memanggil Gemini AI (0ms, 0 Token)
  if (lexiconIssues.length === 0) {
    console.log(`[TikTokComplianceService] ✅ Naskah bersih dari kata terlarang (Zero-Token Lexicon Pass). Menghemat 1x Call Gemini.`);
    return {
      passed: true,
      status: 'pass',
      verdict: 'pass',
      risk_level: 'low',
      risk_score: 'low',
      detected_issues: [],
      revised_script: [],
      notes: 'Lolos audit kepatuhan lokal (Lexicon Pre-filter 0-Token)'
    };
  }

  // FALLBACK DENGAN JEDA: Ada kata blocker terdeteksi, berikan jeda cooldown 12 detik agar terhindar dari 503
  console.warn(`[TikTokComplianceService] ⚠️ Terdeteksi ${lexiconIssues.length} kata sensitif. Memberikan jeda cooldown 12 detik sebelum meminta AI revisi aman...`);
  await new Promise(resolve => setTimeout(resolve, 12000));

  const complianceKb = readKbFile('COMPLIANCE_GUIDE.md') || '';

  try {
    const systemInstruction = `
Kamu adalah TikTok Shop Compliance Auditor Senior.
Tugasmu adalah melakukan audit kepatuhan terhadap Naskah Voiceover dan Caption berikut berdasarkan Kebijakan Resmi COMPLIANCE_GUIDE.md:

${complianceKb}

INSTRUKSI KHUSUS AUDIT:
1. Periksa apakah naskah mengandung klaim berlebihan, klaim medis terlarang (Section 21), klaim detox ("usus kotor", "detoks"), atau frasa terlarang ("tanpa efek samping", "tanpa ketergantungan" - Section 16).
2. Jika terdeteksi klaim terlarang, buatlah REVISI NASKAH AMAN ("revised_script" sebagai array string per kalimat/klip) yang 100% compliant tanpa merusak maksud edukasi.

FORMAT OUTPUT JSON WAJIB:
{
  "status": "pass" | "revise" | "block",
  "verdict": "pass" | "revise" | "block",
  "risk_level": "low" | "medium" | "high",
  "risk_score": "low" | "medium" | "high",
  "detected_issues": [
    {
      "category": "...",
      "original_text": "...",
      "reason": "..."
    }
  ],
  "revised_script": ["Kalimat klip 1 revisi...", "Kalimat klip 2 revisi..."],
  "notes": "..."
}
`;

    const prompt = `
Naskah Voiceover untuk Diaudit:
"${voiceoverText}"

Caption untuk Diaudit:
"${captionText}"

Isu Scanner Lexicon Awal: ${JSON.stringify(lexiconIssues)}

Hasilkan audit JSON terstruktur.
`;

    console.log(`[TikTokComplianceService] Running AI Compliance Audit for Voiceover Script...`);
    const aiResult = await callGeminiJson(prompt, systemInstruction);

    if (lexiconIssues.length > 0 && aiResult.status === 'pass') {
      aiResult.status = 'revise';
      aiResult.verdict = 'revise';
      aiResult.risk_level = 'medium';
      aiResult.risk_score = 'medium';
    }

    return {
      passed: (aiResult.status || aiResult.verdict) === 'pass',
      status: aiResult.status || aiResult.verdict || 'pass',
      verdict: aiResult.verdict || aiResult.status || 'pass',
      risk_level: aiResult.risk_level || aiResult.risk_score || 'low',
      risk_score: aiResult.risk_score || aiResult.risk_level || 'low',
      detected_issues: Array.isArray(aiResult.detected_issues) && aiResult.detected_issues.length > 0 ? aiResult.detected_issues : lexiconIssues,
      revised_script: Array.isArray(aiResult.revised_script) ? aiResult.revised_script : [],
      notes: aiResult.notes || (lexiconIssues.length > 0 ? 'Terdeteksi frasa sensitif kebijakan TikTok Shop' : 'Naskah bersih dari klaim terlarang')
    };
  } catch (err) {
    console.error('[TikTokComplianceService] AI Audit Error, falling back to Lexicon Scanner:', err.message);
    const hasBlockers = lexiconIssues.length > 0;
    return {
      passed: !hasBlockers,
      status: hasBlockers ? 'revise' : 'pass',
      verdict: hasBlockers ? 'revise' : 'pass',
      risk_level: hasBlockers ? 'medium' : 'low',
      risk_score: hasBlockers ? 'medium' : 'low',
      detected_issues: lexiconIssues,
      revised_script: [],
      notes: hasBlockers ? 'Terdeteksi frasa sensitif kebijakan TikTok Shop (Lexicon Fallback)' : 'Naskah bersih dari klaim terlarang'
    };
  }
}
