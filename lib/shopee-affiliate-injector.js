import { pgQuery } from './db-pg.js';
import { callGeminiAPI } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';

/**
 * Mengambil produk aktif bertautan Shopee khusus untuk Brand Profile tertentu
 * Strict Brand Safety Isolation: Hanya mengembalikan produk yang terdaftar pada brandProfileId.
 */
export async function getBrandShopeeProducts({ tenantId, brandProfileId }) {
  if (!brandProfileId) return [];

  const query = `
    SELECT 
      bp.id AS brand_product_id,
      bp.brand_profile_id,
      b.brand_name,
      bp.product_id,
      COALESCE(NULLIF(bp.affiliate_link, ''), p.affiliate_link) AS affiliate_link,
      COALESCE(NULLIF(bp.product_name_override, ''), p.product_name) AS product_name,
      p.product_description,
      p.category,
      p.tags
    FROM brand_products bp
    JOIN brand_profiles b ON bp.brand_profile_id = b.id
    JOIN product_extractions p ON bp.product_id = p.id
    WHERE bp.brand_profile_id = $1
      AND (bp.is_active = TRUE OR bp.is_active IS NULL)
      AND (
        COALESCE(NULLIF(bp.affiliate_link, ''), p.affiliate_link) ILIKE '%shopee%' 
        OR COALESCE(NULLIF(bp.affiliate_link, ''), p.affiliate_link) ILIKE '%shope.ee%'
      )
  `;
  try {
    const res = await pgQuery(query, [brandProfileId]);
    return res.rows || [];
  } catch (err) {
    console.error(`[Shopee Injector] Error querying brand products for ${brandProfileId}:`, err.message);
    return [];
  }
}

/**
 * Format caption dengan menyisipkan CTA dan link Shopee sebelum deretan hashtags
 */
export function formatEnrichedCaption({ originalCaption, matchedProduct, ctaPhrase }) {
  if (!originalCaption || !matchedProduct?.affiliate_link) return originalCaption;

  // Jika caption sudah memiliki tautan Shopee, jangan duplikasi
  if (originalCaption.includes('shope.ee') || originalCaption.includes('shopee.co.id')) {
    return originalCaption;
  }

  // Pisahkan hashtags di bagian akhir kalimat
  const hashtagRegex = /(?:^|\s)(#[a-zA-Z0-9_\u0080-\uffff]+)/g;
  const matches = [...originalCaption.matchAll(hashtagRegex)];

  let cleanNarrative = originalCaption;
  let hashtagsString = '';

  if (matches.length > 0) {
    const firstHashtagIdx = matches[0].index;
    cleanNarrative = originalCaption.substring(0, firstHashtagIdx).trim();
    hashtagsString = matches.map(m => m[1]).join(' ');
  }

  const resolvedCta = ctaPhrase && ctaPhrase.trim()
    ? ctaPhrase.trim()
    : `Dapatkan ${matchedProduct.product_name} original di Shopee:`;

  const ctaBlock = `🛒 ${resolvedCta}\n👉 ${matchedProduct.affiliate_link.trim()}`;

  let finalCaption = `${cleanNarrative}\n\n${ctaBlock}`;
  if (hashtagsString) {
    finalCaption += `\n\n${hashtagsString}`;
  }

  return finalCaption;
}

/**
 * Mencocokkan caption dengan produk brand via Gemini AI Semantic Intent Matcher
 */
export async function matchCaptionToShopeeProduct({ caption, products, brandName = '' }) {
  if (!caption || !products || products.length === 0) {
    return { matched: false };
  }

  const simplifiedProducts = products.map(p => ({
    id: p.product_id,
    name: p.product_name,
    category: p.category,
    tags: p.tags,
    description: (p.product_description || '').substring(0, 160)
  }));

  const prompt = `Anda adalah asisten AI kurator e-commerce untuk brand "${brandName}".
Tugas Anda: Menganalisa teks naskah/caption video berikut dan menentukan apakah naskah ini secara eksplisit atau implisit relevan dengan salah satu produk Shopee dari katalog brand ini.

NASKAH CAPTION:
"""
${caption}
"""

KATALOG PRODUK BRAND (HANYA PILIH DARI DAFTAR INI):
${JSON.stringify(simplifiedProducts, null, 2)}

ATURAN KETAT:
1. Hanya boleh memilih produk jika naskah benar-benar relevan secara konteks atau kata kunci (bahan resep, herbal, bumbu, alat masak, atau keluhan kesehatan yang dibahas).
2. Jika naskah bersifat umum dan TIDAK ada produk yang cocok, kembalikan "matched": false. JANGAN MEMAKSAKAN!
3. Jika matched: true, buatkan 1 kalimat "cta_phrase" ajakan pembelian yang luwes, persuasif, natural, dan sesuai konteks video (jangan terlalu kaku seperti iklan banner).

KEMBALIKAN DALAM FORMAT JSON SAJA:
{
  "matched": true,
  "product_id": "pe_xxxx",
  "confidence": 0.95,
  "reason": "Alasan singkat mengapa produk ini cocok",
  "cta_phrase": "Kalimat ajakan pembelian kontekstual..."
}`;

  try {
    const rawRes = await callGeminiAPI(prompt);
    const parsed = parseGeminiJSON(rawRes, 'gemini');

    if (parsed && parsed.matched && parsed.product_id) {
      const selectedProduct = products.find(p => p.product_id === parsed.product_id);
      if (selectedProduct) {
        return {
          matched: true,
          product: selectedProduct,
          ctaPhrase: parsed.cta_phrase,
          confidence: parsed.confidence || 0.9,
          reason: parsed.reason
        };
      }
    }
  } catch (err) {
    console.warn('[Shopee Injector] Error matching caption with Gemini:', err.message);
  }

  return { matched: false };
}

/**
 * Fungsi utama pengayaan caption khusus Facebook Publishing.
 * Memvalidasi Brand Profile, mencocokkan produk Shopee, menyusun caption, dan memperbarui snapshot di database.
 */
export async function enrichCaptionForFacebookPublishing({ caption, tenantId, brandProfileId, cfItemId = null }) {
  if (!caption || !brandProfileId) return caption;

  try {
    const products = await getBrandShopeeProducts({ tenantId, brandProfileId });
    if (!products || products.length === 0) {
      return caption;
    }

    const brandName = products[0]?.brand_name || '';
    const matchResult = await matchCaptionToShopeeProduct({ caption, products, brandName });

    if (!matchResult.matched || !matchResult.product) {
      return caption;
    }

    const enrichedCaption = formatEnrichedCaption({
      originalCaption: caption,
      matchedProduct: matchResult.product,
      ctaPhrase: matchResult.ctaPhrase
    });

    // Update snapshot ke content_flow_items jika cfItemId tersedia
    if (cfItemId && enrichedCaption !== caption) {
      const effectiveTenant = tenantId || 'default_tenant';
      await pgQuery(`
        UPDATE content_flow_items
        SET caption = $1,
            link_affiliate = $2,
            nama_produk = $3,
            product_id = $4,
            brand_product_id = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND tenant_id = $7
      `, [
        enrichedCaption,
        matchResult.product.affiliate_link,
        matchResult.product.product_name,
        matchResult.product.product_id,
        matchResult.product.brand_product_id,
        cfItemId,
        effectiveTenant
      ]);
      console.log(`[Shopee Injector] ✅ Enriched caption & synced to DB for cfItem ${cfItemId} (Product: ${matchResult.product.product_name})`);
    }

    return enrichedCaption;
  } catch (err) {
    console.error('[Shopee Injector] Failed to enrich caption:', err.message);
    return caption;
  }
}

