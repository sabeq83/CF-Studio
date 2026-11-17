import { resolveModelChain, createResilientGeminiModel, executeWithKeyPool, runWithGeminiTrace } from './gemini.js';

export const INDONESIAN_TRUTH_STOPWORDS = new Set([
  'dan',
  'yang',
  'dengan',
  'berbentuk',
  'kemasan',
  'berwarna',
  'terbuat',
  'untuk',
  'dari',
  'berisi'
]);

/**
 * Shared authoritative definition for Product Truth (T2I) and Geometric Truth (I2V),
 * reused by both batch truth extraction and single/bulk product enrichment prompts.
 */
export const PRODUCT_TRUTH_DEFINITIONS = `1. **Product Truth (T2I Physics & Packaging Lock)** — WAJIB BAHASA INGGRIS (English):
   - Deskripsi detail wujud fisik kemasan/produk yang tampak dari luar.
   - Harus memuat aspek-aspek yang harus dijaga agar Text-to-Image (T2I) stabil: warna dominan kemasan, letak logo, teks utama di kemasan, jenis tutup, dan aksen warna penting.
   - Tujuan: Menjadi pedoman agar gambar AI tetap setia pada produk asli dan tidak menghasilkan tulisan typo/cacat.
   - Format: 3-4 kalimat deskriptif yang padat dalam Bahasa Inggris (English).

2. **Geometric Truth (I2V Geometry & Material Lock)** — WAJIB BAHASA INGGRIS (English):
   - Deskripsi struktur 3 dimensi wadah dan material/tekstur permukaannya.
   - Harus memuat bentuk geometris wadah (misal: upright cylinder bottle, flat round jar, rectangular pouch/tube) dan sifat material/refleksi permukaan (misal: matte plastic, clear thick glass, glossy foil, viscous amber liquid).
   - Tujuan: Menjadi pedoman agar saat Image-to-Video (I2V) menggerakkan objek tersebut, AI memahami sifat fisika gerak benda dan pembiasan cahaya yang logis.
   - Format: 2-3 kalimat deskriptif dalam Bahasa Inggris (English).`;

/**
 * Detects whether a Product Truth / Geometric Truth text is written in Indonesian.
 * Triggers when at least 3 common Indonesian packaging keywords appear or their share exceeds 8%.
 */
export function looksIndonesian(text) {
  if (!text || typeof text !== 'string') return false;
  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  if (tokens.length === 0) return false;

  let hitCount = 0;
  for (const token of tokens) {
    if (INDONESIAN_TRUTH_STOPWORDS.has(token)) {
      hitCount++;
    }
  }
  return hitCount >= 3 || (hitCount / tokens.length) > 0.08;
}

function buildSingleTruthTranslatePrompt({ productName = '', productTruth = '', geometricTruth = '' }) {
  return `Translate the following e-commerce visual lock fields into clear, concise, natural descriptive English for AI image (T2I) and video (I2V) prompts.
Preserve every physical detail (colors, logo placement, main label text, cap/lid type, 3D container shape, material finish, surface reflection). Do NOT invent facts or add commentary.

Product name: ${productName || '-'}
Input JSON:
${JSON.stringify({
  product_truth: productTruth || null,
  geometric_truth: geometricTruth || null
}, null, 2)}

Return ONLY valid JSON with exact keys:
{
  "product_truth": "English Product Truth (3-4 descriptive sentences) or null if input was null",
  "geometric_truth": "English Geometric Truth (2-3 descriptive sentences) or null if input was null"
}`;
}

export function buildBatchTruthTranslatePrompt(items = []) {
  return `Translate each item's "product_truth" and "geometric_truth" fields into clear, concise, natural descriptive English for AI image (T2I) and video (I2V) prompts.
Preserve all physical details (colors, logo position, label text, cap/lid style, 3D container geometry, surface material/reflection) faithfully without adding marketing hype. Keep each "id" identical to input.

Input items JSON:
${JSON.stringify(items.map((item) => ({
  id: item.id,
  product_name: item.product_name || '',
  product_truth: item.product_truth || null,
  geometric_truth: item.geometric_truth || null
})), null, 2)}

Return ONLY valid JSON:
{
  "items": [
    {
      "id": "same id as input",
      "product_truth": "English Product Truth or null",
      "geometric_truth": "English Geometric Truth or null"
    }
  ]
}`;
}

async function defaultTranslateSingleWithGemini({ productName, productTruth, geometricTruth, itemId = null, tenantId = null }) {
  const prompt = buildSingleTruthTranslatePrompt({ productName, productTruth, geometricTruth });
  const resolved = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
  const raw = await runWithGeminiTrace(
    { stage: 'product_truth_translate', item_id: itemId, tenant_id: tenantId },
    () => executeWithKeyPool(1, async (apiKey) => {
      const { model } = await createResilientGeminiModel({
        apiKey,
        role: 'light',
        taskType: 'PRODUCT_ENRICHMENT',
        modelName: resolved.model,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        isExplicitKey: true
      });
      const result = await model.generateContent([{ text: prompt }]);
      return result.response.text();
    }, { modelName: resolved.model, role: 'light', taskType: 'PRODUCT_ENRICHMENT' })
  );
  const cleaned = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    product_truth: parsed.product_truth ?? productTruth ?? null,
    geometric_truth: parsed.geometric_truth ?? geometricTruth ?? null
  };
}

/**
 * Post-enrichment language guard: if either Truth looks Indonesian, performs one English
 * translation pass. On failure, logs a warning and preserves the original text so enrichment
 * never fails just because of language normalization.
 */
export async function ensureEnglishProductTruths(item, {
  itemId = null,
  tenantId = null,
  productName = '',
  translateFn = null,
  logger = console.warn
} = {}) {
  if (!item || typeof item !== 'object') return item;

  const pt = item.product_truth || '';
  const gt = item.geometric_truth || '';
  const ptIsId = looksIndonesian(pt);
  const gtIsId = looksIndonesian(gt);

  if (!ptIsId && !gtIsId) {
    return item;
  }

  try {
    const translator = translateFn || defaultTranslateSingleWithGemini;
    const translated = await translator({
      productName: productName || item.product_name || '',
      productTruth: pt || null,
      geometricTruth: gt || null,
      itemId,
      tenantId
    });
    return {
      ...item,
      product_truth: (pt && translated?.product_truth) ? translated.product_truth : item.product_truth,
      geometric_truth: (gt && translated?.geometric_truth) ? translated.geometric_truth : item.geometric_truth
    };
  } catch (err) {
    if (typeof logger === 'function') {
      logger(`[Enrichment Language Guard Warning] Gagal menerjemahkan Truth ke Bahasa Inggris untuk "${productName || itemId || '-'}": ${err.message}`);
    }
    return item;
  }
}
