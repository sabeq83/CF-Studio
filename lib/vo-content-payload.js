import { findVoClaimViolations } from './tiktok-compliance-service.js';

export const VAGUE_WORDS_ID = Object.freeze([
  'efektif',
  'maksimal',
  'optimal',
  'tepat',
  'sempurna',
  'berkualitas',
  'pilihan',
  'terbaik',
  'alami',
  'kebugaran',
  'nyaman',
  'praktis',
  'secukupnya',
  'sebentar',
  'beberapa'
]);

export const VAGUE_WORDS_EN = Object.freeze([
  'effective',
  'effectively',
  'optimal',
  'optimally',
  'perfect',
  'perfectly',
  'best',
  'natural',
  'naturally',
  'wellness',
  'comfortable',
  'practical',
  'enough',
  'briefly',
  'several',
  'various',
  'boost',
  'supercharge',
  'simply',
  'easily'
]);

export const TRANSITION_MARKERS_ID = Object.freeze([
  'Padahal',
  'Masalahnya',
  'Nah',
  'Di titik inilah',
  'Di sinilah',
  'Hasilnya',
  'Makanya'
]);

export const TRANSITION_MARKERS_EN = Object.freeze([
  'Actually',
  'Here is the catch',
  'The catch is',
  'Now',
  'In reality',
  'At this point',
  'As a result',
  'That is why',
  'The thing is'
]);

export const BANNED_AI_PHRASES_EN = Object.freeze([
  'not only',
  'but also',
  'deep dive',
  'game changer',
  'unlock the secret',
  "in today's fast-paced world",
  'take it to the next level',
  'transform your life'
]);

export function resolveVoLanguage(targetLanguage = 'id-ID') {
  const norm = String(targetLanguage || 'id-ID').trim().toLowerCase();
  return norm.startsWith('en') ? 'en' : 'id';
}

export function getVagueWordsForLanguage(targetLanguage = 'id-ID') {
  return resolveVoLanguage(targetLanguage) === 'en' ? VAGUE_WORDS_EN : VAGUE_WORDS_ID;
}

export function getTransitionMarkersForLanguage(targetLanguage = 'id-ID') {
  return resolveVoLanguage(targetLanguage) === 'en' ? TRANSITION_MARKERS_EN : TRANSITION_MARKERS_ID;
}

export function parseWordsPerClipRange(wordsPerClip, clipDuration = 8) {
  const raw = String(wordsPerClip || '').trim();
  const matches = raw.match(/\d+/g);
  if (matches && matches.length >= 2) {
    const min = Number(matches[0]);
    const max = Number(matches[1]);
    return {
      min,
      max,
      mid: Math.round((min + max) / 2),
      label: raw
    };
  }
  if (matches && matches.length === 1) {
    const val = Number(matches[0]);
    return { min: Math.max(4, val - 2), max: val, mid: val, label: raw };
  }
  const dur = Number(clipDuration || 8);
  if (dur <= 6) return { min: 10, max: 13, mid: 12, label: '10-13 kata' };
  return { min: 17, max: 19, mid: 18, label: '17-19 kata' };
}

/**
 * Deterministic clip allocation plan when targetClips > 5 (including 6-7+ clip Cartoon Universe).
 */
export function buildClipPlanForTargetClips(targetClips = 4, takeawaysCount = 3) {
  const clips = Math.max(3, Number(targetClips || 4));
  if (clips <= 5) return null;

  const count = Math.max(1, Math.min(3, Number(takeawaysCount || 3)));
  const plan = [];
  plan.push({ clip: 1, role: 'hook', instruction: 'Hook terpasang + 1 kalimat pendek konteks/masalah' });
  plan.push({ clip: 2, role: 'search_answer_and_takeaway_1', instruction: 'Jawaban langsung (search_answer) + poin takeaway 1 beserta anchor' });

  const middleSlots = clips - 3; // clips 3 .. clips-1
  for (let i = 0; i < middleSlots; i++) {
    const clipNumber = 3 + i;
    const takeawayIndex = Math.min(count, Math.floor((i * count) / middleSlots) + 1);
    const isFollowUp = i > 0 && Math.floor(((i - 1) * count) / middleSlots) === Math.floor((i * count) / middleSlots);
    plan.push({
      clip: clipNumber,
      role: isFollowUp ? `takeaway_${takeawayIndex}_detail` : `takeaway_${takeawayIndex}`,
      takeaway_index: takeawayIndex,
      instruction: isFollowUp
        ? `Contoh nyata / cara mengecek hasil / kesalahan umum terkait takeaway ${takeawayIndex}`
        : `Sampaikan takeaway ${takeawayIndex} beserta pegangan (anchor) secara utuh`
    });
  }

  plan.push({ clip: clips, role: 'summary_and_cta', instruction: 'Ringkas 1 poin terpenting dalam 1 kalimat + CTA' });
  return plan;
}

/**
 * Formats verified product fields while explicitly separating usage instructions from manufacturing facts.
 */
export function buildVoProductTruthSummary(product = null, targetLanguage = 'id-ID') {
  if (!product || typeof product !== 'object') return '';
  const lang = resolveVoLanguage(targetLanguage);
  const name = product.product_name || product.name || '';
  const desc = product.description || product.desc || '';
  const usp = product.usp || product.selling_point || product.product_usp || '';
  const caraPakai = product.cara_pakai || '';
  const takaranLabel = product.takaran_label || '';
  const penyimpanan = product.penyimpanan || '';
  const rasaTekstur = product.rasa_tekstur || '';
  const faktaProduksi = product.fakta_produksi || '';
  const rawTruth = product.truth || '';

  const lines = [];
  if (lang === 'en') {
    if (name) lines.push(`- Product: ${name}`);
    if (desc) lines.push(`- Description: ${desc}`);
    if (usp) lines.push(`- USP: ${usp}`);
    if (caraPakai) lines.push(`- How to use (actionable for viewer): ${caraPakai}`);
    if (takaranLabel) lines.push(`- Serving / dosage on label: ${takaranLabel}`);
    if (penyimpanan) lines.push(`- Storage: ${penyimpanan}`);
    if (rasaTekstur) lines.push(`- Taste / texture: ${rasaTekstur}`);
    if (faktaProduksi) lines.push(`- Brand production facts (reason/anchor ONLY, NOT viewer action): ${faktaProduksi}`);
    if (rawTruth) lines.push(`- Product facts: ${rawTruth}`);
  } else {
    if (name) lines.push(`- Produk: ${name}`);
    if (desc) lines.push(`- Deskripsi produk: ${desc}`);
    if (usp) lines.push(`- USP: ${usp}`);
    if (caraPakai) lines.push(`- Cara pakai (tindakan penonton): ${caraPakai}`);
    if (takaranLabel) lines.push(`- Takaran label: ${takaranLabel}`);
    if (penyimpanan) lines.push(`- Penyimpanan: ${penyimpanan}`);
    if (rasaTekstur) lines.push(`- Rasa/tekstur: ${rasaTekstur}`);
    if (faktaProduksi) lines.push(`- Fakta produksi brand (alasan di anchor SAJA, BUKAN perintah tindakan penonton): ${faktaProduksi}`);
    if (rawTruth) lines.push(`- Fakta produk: ${rawTruth}`);
  }
  return lines.join('\n');
}

function buildContextHeader(ctx = {}, lang = 'id') {
  const clips = Math.max(3, Number(ctx.clips || ctx.targetClips || 4));
  const wpc = parseWordsPerClipRange(ctx.wordsPerClip, ctx.clipDuration);
  const totalWords = clips * wpc.mid;
  const maxTakeaways = Math.min(3, Math.max(2, clips - 2));
  const productBlock = buildVoProductTruthSummary(ctx.product, lang === 'en' ? 'en-US' : 'id-ID');
  const cartoonLine = ctx.storyPremise || ctx.petProblem
    ? (lang === 'en'
      ? `- Story premise: ${ctx.storyPremise || '-'} | Character problem: ${ctx.petProblem || '-'} | Product role: ${ctx.productRole || 'none'}`
      : `- Premis cerita: ${ctx.storyPremise || '-'} | Masalah karakter: ${ctx.petProblem || '-'} | Peran produk: ${ctx.productRole || 'none'}`)
    : '';

  return { clips, wpc, totalWords, maxTakeaways, productBlock, cartoonLine };
}

/**
 * Builds single-row Content Editor prompt (matches plans/vo-narasi-reference/newprompts.mjs) in id-ID or en-US.
 */
export function buildVoContentPayloadPrompt(ctx = {}) {
  const lang = resolveVoLanguage(ctx.targetLanguage || 'id-ID');
  const { clips, wpc, totalWords, maxTakeaways, productBlock, cartoonLine } = buildContextHeader(ctx, lang);
  const vagueList = getVagueWordsForLanguage(lang === 'en' ? 'en-US' : 'id-ID');
  const clipPlanNote = clips > 5
    ? (lang === 'en'
      ? `\n4. Because clips = ${clips} (> 5), also return "clip_plan": array of objects {"clip":1..${clips},"role":"hook|search_answer_and_takeaway_1|takeaway_k|takeaway_k_detail|summary_and_cta","instruction":"..."}.`
      : `\n4. Karena jumlah klip = ${clips} (> 5), sertakan juga "clip_plan": array objek {"clip":1..${clips},"role":"hook|search_answer_and_takeaway_1|takeaway_k|takeaway_k_detail|summary_and_cta","instruction":"..."}.`)
    : '';
  const clipPlanJson = clips > 5
    ? `,"clip_plan":[{"clip":1,"role":"hook","instruction":"..."}]`
    : '';

  if (lang === 'en') {
    return `You are a senior Content Editor. Your job is NOT to write a script yet, but to define the CONCRETE SUBSTANCE for a ${clips}-clip short video (±${wpc.label} per clip, ~${totalWords} spoken words total).

## DATA
- Brand: ${ctx.brandName || '-'}
- Brand context: ${ctx.brandContext || '-'}
- Content kind: ${ctx.kind || 'brand_editorial'}
- Pillar / keyword: "${ctx.pillar || '-'}"
- Subject: ${ctx.subject || '-'}
- Audience situation: ${ctx.context || '-'}
- Angle: ${ctx.angle || '-'}
- Hook (already locked): "${ctx.hook || '-'}"
${cartoonLine ? `${cartoonLine}\n` : ''}${productBlock || '- Product: none (pure editorial)'}

## TASKS
1. Identify search_intent: the real question inside the viewer's head on this topic.
2. Write search_answer: a direct 1-sentence answer (<=20 words). If price is asked without price data, answer with pricing factors + how to estimate needs.
3. Build up to ${maxTakeaways} takeaways (MAXIMUM 3; sharper beats more). Each takeaway = one action the viewer can do/check today, paired with a concrete "anchor" (number/measurement, duration/frequency, step order, exact spot, selection criteria, or common mistake + fix).${clipPlanNote}

## TAKEAWAY RULES
- "point" must be a VIEWER ACTION (imperative verb: measure, check, place, stir, store, avoid). Brand manufacturing facts are NOT viewer actions; put them as reasoning in the anchor only, never as a command.
- For keyword-driven content, takeaway #1 MUST directly answer search_intent.
- Never invent cosmetic fake numbers (e.g. arbitrary radius or uncheckable minutes) just to sound specific; use observable criteria or real examples instead.

## HONESTY RULES (MANDATORY)
- Brand/product figures (price, size, density, dosage) ONLY if verified in DATA above. If missing, use a non-numeric anchor (step order/criteria/spot) or list "[needs data: ...]" in needs_data. NEVER fabricate numbers.
- Everyday general knowledge is allowed with source "pengetahuan_umum".
- Health/herbal content: ZERO medical cure/prevention claims (visceral fat, blood sugar, cholesterol, heart, kidneys, lungs, detox, immunity, etc.). Focus on HOW TO USE (timing, mix, storage, taste) and ordinary daily habits.
- Avoid vague words (${vagueList.join(', ')}) inside anchors.

Return ONLY JSON:
{"search_intent":"...","search_answer":"...","takeaways":[{"point":"...","anchor":"...","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}]${clipPlanJson},"needs_data":["..."]}`;
  }

  return `Kamu adalah Content Editor senior. Tugasmu BUKAN menulis naskah, tetapi menyusun ISI yang akan disampaikan sebuah video pendek ${clips} klip (±${wpc.label} per klip, total ±${totalWords} kata lisan).

## DATA
- Brand: ${ctx.brandName || '-'}
- Konteks brand: ${ctx.brandContext || '-'}
- Jenis konten: ${ctx.kind || 'brand_editorial'}
- Pilar / keyword: "${ctx.pillar || '-'}"
- Subjek: ${ctx.subject || '-'}
- Situasi audiens: ${ctx.context || '-'}
- Angle: ${ctx.angle || '-'}
- Hook (sudah dikunci): "${ctx.hook || '-'}"
${cartoonLine ? `${cartoonLine}\n` : ''}${productBlock || '- Produk: tidak ada (editorial murni)'}

## TUGAS
1. Tentukan search_intent: pertanyaan nyata yang ada di kepala penonton saat melihat topik ini.
2. Tulis search_answer: jawaban langsung 1 kalimat (<=20 kata). Jika keyword berupa harga dan data harga TIDAK ada, jawab dengan faktor penentu harga + cara menghitung kebutuhan.
3. Susun ${maxTakeaways} takeaways (MAKSIMAL 3, lebih sedikit tapi tajam lebih baik daripada banyak tapi dangkal). Setiap takeaway = satu hal yang bisa langsung dipraktikkan/diperiksa penonton hari ini, dengan "anchor" (pegangan konkret) berupa salah satu: angka/takaran, durasi/frekuensi, urutan langkah, lokasi/titik, kriteria memilih, atau kesalahan umum + koreksinya.${clipPlanNote}

## ATURAN TAKEAWAY
- "point" adalah TINDAKAN yang dilakukan PENONTON (kata kerja perintah: pasang, ukur, ambil, simpan, catat, hindari). Fakta tentang cara brand memproduksi produk (mis. difermentasi 3 bulan) BUKAN tindakan penonton; jika dipakai, tulis sebagai alasan di anchor, bukan perintah.
- Untuk keyword, takeaway pertama WAJIB langsung menjawab search_intent.
- Angka kosmetik dilarang: jangan membuat angka yang tidak lazim/tidak bisa dicek (mis. "radius 100 meter", "30 menit evaluasi") hanya agar terlihat konkret. Lebih baik anchor berupa contoh nyata atau kriteria.

## ATURAN KEJUJURAN (WAJIB)
- Angka spesifik brand/produk (harga, ukuran roll, densitas, takaran produk) HANYA boleh jika ada di DATA. Jika tidak ada, tulis anchor non-angka (urutan/kriteria/titik) atau tandai "[butuh data: ...]" di needs_data. JANGAN mengarang.
- Pengetahuan umum yang lazim dan aman (mis. tes alergi di belakang telinga, celah bawah pintu meloloskan suara) boleh, beri source "pengetahuan_umum".
- Konten kesehatan/herbal: DILARANG klaim menyembuhkan/mencegah/menurunkan kondisi medis (lemak visceral, gula darah, kolesterol, jantung, ginjal, paru-paru, detoks, imun, dsb). Untuk produk herbal, isi berupa CARA PAKAI (kapan, dicampur apa, penyimpanan, rasa) dan kebiasaan pendukung umum, bukan manfaat medis.
- Hindari kata samar (${vagueList.join(', ')}) di anchor.

Return ONLY JSON:
{"search_intent":"...","search_answer":"...","takeaways":[{"point":"...","anchor":"...","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}]${clipPlanJson},"needs_data":["..."]}`;
}

/**
 * Builds a compact 1-call batch Content Editor prompt for multiple Content Planner rows (after hooks are locked).
 */
export function buildBatchVoContentPayloadPrompt(rows = [], ctx = {}) {
  const lang = resolveVoLanguage(ctx.targetLanguage || 'id-ID');
  const clips = Math.max(3, Number(ctx.clips || ctx.targetClips || 4));
  const wpc = parseWordsPerClipRange(ctx.wordsPerClip, ctx.clipDuration);
  const maxTakeaways = Math.min(3, Math.max(2, clips - 2));
  const productBlock = buildVoProductTruthSummary(ctx.product, lang === 'en' ? 'en-US' : 'id-ID');
  const vagueList = getVagueWordsForLanguage(lang === 'en' ? 'en-US' : 'id-ID');

  const compactRows = rows.map(r => ({
    sequence: r.sequence,
    pillar: r.pillar,
    context: r.context,
    strategic_angle: r.strategic_angle,
    content_subject: r.content_subject || r.context,
    hook: r.hook,
    ...(r.story_premise ? { story_premise: r.story_premise } : {}),
    ...(r.pet_problem ? { pet_problem: r.pet_problem } : {}),
    ...(r.product_role ? { product_role: r.product_role } : {})
  }));

  if (lang === 'en') {
    return `You are a senior Content Editor preparing structured substance ("content_payload") for ${rows.length} short videos (${clips} clips each, ±${wpc.label} per clip).

## CONTEXT
- Brand: ${ctx.brandName || '-'}
- Brand context: ${ctx.brandContext || '-'}
- Content kind: ${ctx.kind || 'brand_editorial'}
${productBlock || '- Product: none (pure editorial)'}

## RULES
- Do NOT rewrite hooks. Keep each item matched by "sequence".
- search_answer: 1 direct sentence <=20 words.
- takeaways: MAXIMUM ${maxTakeaways} items, each a viewer action (imperative) + concrete "anchor" (no vague words: ${vagueList.join(', ')}).
- Brand production facts go ONLY as reasoning inside anchor, never as a viewer command.
- ZERO unverified numbers (log gaps in "needs_data") and ZERO medical claims.

## ROWS
${JSON.stringify(compactRows)}

Return ONLY a JSON array:
[{"sequence":number,"search_intent":"...","search_answer":"...","takeaways":[{"point":"...","anchor":"...","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}],"needs_data":[]}]`;
  }

  return `Kamu adalah Content Editor senior yang menyusun ISI terstruktur ("content_payload") untuk ${rows.length} baris rencana video pendek (${clips} klip per video, ±${wpc.label} per klip).

## KONTEKS
- Brand: ${ctx.brandName || '-'}
- Konteks brand: ${ctx.brandContext || '-'}
- Jenis konten: ${ctx.kind || 'brand_editorial'}
${productBlock || '- Produk: tidak ada (editorial murni)'}

## ATURAN
- JANGAN ubah hook yang sudah dikunci. Cocokkan output berdasarkan "sequence".
- search_answer: jawaban langsung 1 kalimat <=20 kata.
- takeaways: MAKSIMAL ${maxTakeaways} item, "point" berupa tindakan penonton (kata kerja perintah) + "anchor" konkret (hindari kata samar: ${vagueList.join(', ')}).
- Fakta produksi brand hanya ditulis sebagai alasan di anchor, BUKAN perintah tindakan penonton.
- DILARANG mengarang angka (tulis kekurangan di "needs_data") dan DILARANG klaim medis/penyakit.

## BARIS PLANNER
${JSON.stringify(compactRows)}

Return ONLY JSON array:
[{"sequence":number,"search_intent":"...","search_answer":"...","takeaways":[{"point":"...","anchor":"...","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}],"needs_data":[]}]`;
}

export function parseContentPayloadJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

const VALID_ANCHOR_TYPES = new Set(['angka', 'durasi', 'urutan', 'titik', 'kriteria', 'kesalahan']);
const VALID_SOURCES = new Set(['data_produk', 'data_brand', 'pengetahuan_umum']);

export function normalizeVoContentPayload(raw, options = {}) {
  const obj = parseContentPayloadJson(raw);
  if (!obj) return null;

  const targetClips = Math.max(3, Number(options.targetClips || obj.target_clips || 4));
  const isHerbalTarget = Boolean(options.isHerbalTarget);
  const searchIntent = String(obj.search_intent || '').trim();

  // Enforce concise search_answer (<= 20 words soft-cap warning; keep clean string)
  let searchAnswer = String(obj.search_answer || '').trim();
  const answerWords = searchAnswer.split(/\s+/).filter(Boolean);
  if (answerWords.length > 24) {
    searchAnswer = answerWords.slice(0, 20).join(' ');
  }

  const rawTakeaways = Array.isArray(obj.takeaways) ? obj.takeaways : [];
  const takeaways = rawTakeaways
    .slice(0, 3)
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const point = String(item.point || '').trim();
      const anchor = String(item.anchor || '').trim();
      if (!point && !anchor) return null;
      const anchorType = VALID_ANCHOR_TYPES.has(item.anchor_type) ? item.anchor_type : 'kriteria';
      const source = VALID_SOURCES.has(item.source) ? item.source : 'pengetahuan_umum';
      return { point, anchor, anchor_type: anchorType, source };
    })
    .filter(Boolean);

  const needsData = Array.isArray(obj.needs_data)
    ? obj.needs_data.map(x => String(x || '').trim()).filter(Boolean)
    : [];

  let clipPlan = null;
  if (targetClips > 5) {
    clipPlan = Array.isArray(obj.clip_plan) && obj.clip_plan.length >= targetClips
      ? obj.clip_plan
      : buildClipPlanForTargetClips(targetClips, takeaways.length);
  }

  const claimText = [
    searchAnswer,
    ...takeaways.flatMap(t => [t.point, t.anchor])
  ].filter(Boolean).join(' ');
  const claimHits = isHerbalTarget ? findVoClaimViolations(claimText) : [];

  return {
    search_intent: searchIntent,
    search_answer: searchAnswer,
    takeaways,
    ...(clipPlan ? { clip_plan: clipPlan } : {}),
    needs_data: needsData,
    ...(claimHits.length > 0 ? { claim_warnings: claimHits } : {})
  };
}

