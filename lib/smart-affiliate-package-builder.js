/**
 * Smart Affiliate Package Builder (Unified Multi-Engine & Multi-Platform)
 * 
 * Mengorkestrasi pencocokan produk brand affiliate ke naskah konten dan
 * menghasilkan Social Media Package adaptif:
 * - Facebook: CTA dengan link Shopee aktif (clickable) sebelum deretan hashtag.
 * - Selain Facebook (Instagram, TikTok, YouTube Shorts, Threads): 100% CTA diarahkan ke Link di Bio.
 */

import { pgQuery } from './db-pg.js';

/**
 * Mengambil seluruh produk affiliate yang aktif terikat pada Brand Profile tertentu
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.brandProfileId
 * @returns {Promise<Array<Object>>}
 */
export async function resolveBrandAffiliateCatalog({ tenantId, brandProfileId }) {
  if (!brandProfileId) return [];
  const sql = `
    SELECT 
      bp.id AS brand_product_id,
      bp.brand_profile_id,
      bp.product_id,
      bp.affiliate_link,
      bp.landing_page_url,
      p.product_name,
      p.category,
      p.unique_selling_point,
      p.clean_photo_url,
      p.photo_url
    FROM brand_products bp
    JOIN product_extractions p ON bp.product_id = p.id
    WHERE bp.tenant_id = $1 
      AND bp.brand_profile_id = $2
      AND bp.is_active = TRUE 
      AND bp.affiliate_link IS NOT NULL 
      AND bp.affiliate_link != ''
    ORDER BY p.product_name ASC
  `;
  try {
    const res = await pgQuery(sql, [tenantId || 'default_tenant', brandProfileId]);
    return res.rows || [];
  } catch (err) {
    console.warn('[resolveBrandAffiliateCatalog Error]:', err.message);
    return [];
  }
}

/**
 * Memilih produk terbaik dari etalase brand berdasarkan relevansi kata kunci topik
 * @param {Object} params
 * @param {Array<Object>} params.products
 * @param {string} params.topic
 * @param {string} [params.preferredProductId]
 * @returns {Object|null}
 */
export function selectBestProductMatch({ products = [], topic = '', preferredProductId = null }) {
  if (!Array.isArray(products) || products.length === 0) return null;

  // 1. Jika ada preferensi manual dari pengguna
  if (preferredProductId) {
    const found = products.find(p => p.product_id === preferredProductId || p.brand_product_id === preferredProductId);
    if (found) return found;
  }

  const normTopic = String(topic || '').toLowerCase();
  if (!normTopic.trim()) return products[0];

  const topicWords = normTopic
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  let bestProduct = products[0];
  let maxScore = -1;

  for (const p of products) {
    let score = 0;
    const pName = String(p.product_name || '').toLowerCase();
    const pCat = String(p.category || '').toLowerCase();
    const pUsp = String(p.unique_selling_point || '').toLowerCase();

    // Exact full name match in topic
    if (normTopic.includes(pName)) score += 10;

    for (const w of topicWords) {
      if (pName.includes(w)) score += 3;
      if (pCat.includes(w)) score += 1.5;
      if (pUsp.includes(w)) score += 1;
    }

    if (score > maxScore) {
      maxScore = score;
      bestProduct = p;
    }
  }

  return bestProduct;
}

/**
 * Membangun naskah Social Media Package adaptif (FB Shopee Link & Non-FB Link di Bio)
 * @param {Object} params
 * @param {string} params.baseCaption
 * @param {Array<string>} [params.hashtags]
 * @param {Object} [params.matchedProduct]
 * @param {string} [params.brandName]
 * @returns {Object}
 */
export function buildPlatformAdaptiveCaptions({ baseCaption = '', hashtags = [], matchedProduct = null, brandName = '' }) {
  let cleanCaption = String(baseCaption || '').trim();

  // Bersihkan jika caption sudah memiliki placeholder atau link s.shopee
  cleanCaption = cleanCaption
    .replace(/https?:\/\/s\.shopee\.co\.id\/\S+/gi, '')
    .replace(/\{\{AFFILIATE_LINK\}\}/g, '')
    .trim();

  const formattedTags = Array.isArray(hashtags) && hashtags.length > 0
    ? hashtags.map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`)
    : [];
  const tagsStr = formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : '';

  if (!matchedProduct || !matchedProduct.affiliate_link) {
    const unified = cleanCaption + tagsStr;
    return {
      caption_facebook: unified,
      caption_bio: unified,
      caption_universal: unified,
      caption: unified,
      hashtags: formattedTags,
      matched_product: null
    };
  }

  const pName = matchedProduct.product_name || 'Bahan/Produk Rekomendasi';
  const affLink = matchedProduct.affiliate_link.trim();

  // 1. Facebook: Menyisipkan Link Shopee Aktif (Clickable) sebelum deretan Hashtag
  const fbCta = `\n\n🛒 Rekomendasi Bahan/Produk Resmi:\nBeli ${pName} asli di Shopee resmi kami di sini:\n${affLink}`;
  const captionFacebook = `${cleanCaption}${fbCta}${tagsStr}`;

  // 2. Selain Facebook (Instagram, TikTok, YouTube Shorts, Threads): 100% Diarahkan ke Link di Bio
  const bioCta = `\n\n👉 Info Bahan/Produk:\nBahan & produk rekomendasi (${pName}) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨`;
  const captionBio = `${cleanCaption}${bioCta}${tagsStr}`;

  return {
    caption_facebook: captionFacebook,
    caption_bio: captionBio,
    caption_universal: cleanCaption + tagsStr,
    caption: cleanCaption + tagsStr,
    hashtags: formattedTags,
    matched_product: {
      product_id: matchedProduct.product_id,
      product_name: matchedProduct.product_name,
      affiliate_link: affLink,
      brand_profile_id: matchedProduct.brand_profile_id || null
    }
  };
}

/**
 * Menyusun blok instruksi prompt untuk disuntikkan ke Gemini AI (Single-Pass Engine)
 * @param {Object} params
 * @param {Array<Object>} params.brandProducts
 * @param {string} [params.selectedProductId]
 * @param {boolean} [params.isAffiliateEnabled]
 * @returns {string}
 */
export function buildAffiliatePromptInstruction({ brandProducts = [], selectedProductId = null, isAffiliateEnabled = true }) {
  if (!isAffiliateEnabled || !Array.isArray(brandProducts) || brandProducts.length === 0) {
    return `
ATURAN SOCIAL MEDIA PACKAGE & AFFILIATE:
- Konten ini berstatus Murni Edukasi / Non-Afiliasi.
- Pada objek "social_media_package", hasilkan "caption" universal yang bersih, bernilai edukatif, dan diakhiri hashtags relevan. DILARANG mencantumkan link penjualan.
`;
  }

  // Siapkan daftar etalase produk brand (maks 10 produk untuk efisiensi token)
  let candidateProducts = brandProducts;
  if (selectedProductId) {
    const specific = brandProducts.find(p => p.product_id === selectedProductId || p.brand_product_id === selectedProductId);
    if (specific) candidateProducts = [specific];
  }
  const displayProducts = candidateProducts.slice(0, 10).map((p, i) => 
    `${i + 1}. [ID: ${p.product_id}] "${p.product_name}" (Kategori: ${p.category || '-'})`
  ).join('\n');

  return `
ATURAN INTEGRASI SMART AFFILIATE & SOCIAL MEDIA PACKAGE (SINGLE-PASS MULTI-PLATFORM):
Tersedia etalase produk resmi terverifikasi dari Brand Profile ini:
${displayProducts}

PETUNJUK AI:
1. Pilih 1 produk dari daftar di atas yang PALING SELARAS dengan tema/resep konten ini.
2. Pada naskah penutup Voice-Over (Klip Terakhir), buat kalimat ajakan (CTA) yang natural dan selaras dengan produk tersebut (misal: "Pastikan pakai bahan alami berkualitas, klik link di bio atau caption di bawah ya!").
3. Pada objek JSON "social_media_package", Anda WAJIB menghasilkan struktur multi-platform berikut:
   - "title": Judul video click-worthy (maksimal 80 karakter).
   - "caption": Teks naskah/resep utama lengkap dengan emoji rapi, tips, dan hashtags.
   - "caption_facebook": Naskah resep/konten lengkap di mana sebelum deretan hashtag disematkan CTA rekomendasi produk:
     "🛒 Rekomendasi Bahan/Produk Resmi:\\nBeli [Nama Produk Terpilih] asli di Shopee resmi kami di sini:\\n{{AFFILIATE_LINK}}"
   - "caption_bio": Naskah resep/konten lengkap di mana sebelum deretan hashtag disematkan CTA khusus non-FB:
     "👉 Info Bahan/Produk:\\nBahan & produk rekomendasi ([Nama Produk Terpilih]) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨"
   - "selected_product_id": ID produk yang Anda pilih dari daftar di atas.
   - "selected_product_name": Nama produk yang Anda pilih.
   - "hashtags": Array string hashtag relevan (5-8 hashtags).
`;
}

/**
 * Menormalisasi payload respons Gemini AI dan menyematkan link affiliate nyata
 * @param {Object} rawSocialPackage
 * @param {Object} matchedProduct
 * @returns {Object}
 */
export function normalizeSocialMediaPackage(rawSocialPackage = {}, matchedProduct = null) {
  if (!rawSocialPackage || typeof rawSocialPackage !== 'object') {
    rawSocialPackage = {};
  }

  const baseCaption = rawSocialPackage.caption || rawSocialPackage.caption_universal || '';
  const hashtags = Array.isArray(rawSocialPackage.hashtags) ? rawSocialPackage.hashtags : [];

  let captionFb = rawSocialPackage.caption_facebook || '';
  let captionBio = rawSocialPackage.caption_bio || '';

  if (matchedProduct && matchedProduct.affiliate_link) {
    if (captionFb.includes('{{AFFILIATE_LINK}}')) {
      captionFb = captionFb.replace(/\{\{AFFILIATE_LINK\}\}/g, matchedProduct.affiliate_link);
    } else if (!captionFb || captionFb === baseCaption) {
      const adapted = buildPlatformAdaptiveCaptions({
        baseCaption,
        hashtags,
        matchedProduct
      });
      captionFb = adapted.caption_facebook;
      captionBio = adapted.caption_bio;
    }

    if (!captionBio || captionBio === baseCaption) {
      const pName = matchedProduct.product_name || 'Bahan/Produk Rekomendasi';
      const bioCta = `\n\n👉 Info Bahan/Produk:\nBahan & produk rekomendasi (${pName}) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨`;
      const tagsStr = hashtags.length > 0 ? '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
      captionBio = `${baseCaption.trim()}${bioCta}${tagsStr}`;
    }
  } else {
    captionFb = baseCaption;
    captionBio = baseCaption;
  }

  return {
    title: rawSocialPackage.title || '',
    caption: baseCaption,
    caption_facebook: captionFb,
    caption_bio: captionBio,
    caption_universal: baseCaption,
    hashtags,
    matched_product: matchedProduct ? {
      product_id: matchedProduct.product_id,
      product_name: matchedProduct.product_name,
      affiliate_link: matchedProduct.affiliate_link
    } : null
  };
}
