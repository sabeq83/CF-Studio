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
 * Membersihkan blok CTA (Bio CTA & Shopee Link) serta trailing hashtags yang mungkin sudah ada di dalam naskah
 * agar tidak terjadi duplikasi saat proses adaptasi platform.
 * @param {string} caption
 * @returns {string}
 */
export function stripCtaAndHashtags(caption) {
  if (!caption) return '';
  let cleaned = String(caption).trim();

  // 1. Bersihkan blok CTA Info Bahan / Produk (Bio CTA)
  cleaned = cleaned.replace(/(?:\r?\n)*👉\s*Info\s*(?:Bahan|Produk|Bahan\/Produk)?[\s\S]*?(?=(?:\r?\n\s*#|$))/gi, '');

  // 2. Bersihkan blok CTA Rekomendasi Resmi Shopee
  cleaned = cleaned.replace(/(?:\r?\n)*🛒\s*Rekomendasi\s*(?:Bahan|Produk|Bahan\/Produk)?\s*Resmi:[\s\S]*?(?=(?:\r?\n\s*#|$))/gi, '');

  // 3. Bersihkan sisa link shopee atau {{AFFILIATE_LINK}}
  cleaned = cleaned.replace(/https?:\/\/s\.shopee\.co\.id\/\S+/gi, '');
  cleaned = cleaned.replace(/\{\{AFFILIATE_LINK\}\}/g, '');

  // 4. Bersihkan deretan hashtag yang menempel di akhir caption
  cleaned = cleaned.replace(/(?:\r?\n|\s)*(?:#[a-zA-Z0-9_\u00c0-\u00ff]+\s*)+$/g, '');

  return cleaned.trim();
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
  const cleanCaption = stripCtaAndHashtags(baseCaption);

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
      product_name: pName,
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
  // Hanya operkan produk yang memiliki affiliate_link aktif dan terisi ke dalam prompt AI
  const activeAffiliateProducts = (brandProducts || []).filter(p => p.affiliate_link && String(p.affiliate_link).trim() !== '');

  if (!isAffiliateEnabled || activeAffiliateProducts.length === 0) {
    return `
ATURAN SOCIAL MEDIA PACKAGE & AFFILIATE:
- Konten ini berstatus Murni Edukasi / Non-Afiliasi (atau belum ada produk ber-link Shopee terverifikasi).
- Pada objek "social_media_package", hasilkan "caption" universal yang bersih, bernilai edukatif, dan diakhiri hashtags relevan. DILARANG mencantumkan link penjualan.
`;
  }

  // Siapkan daftar etalase produk brand (maks 10 produk untuk efisiensi token)
  let candidateProducts = activeAffiliateProducts;
  if (selectedProductId) {
    const specific = activeAffiliateProducts.find(p => p.product_id === selectedProductId || p.brand_product_id === selectedProductId);
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
   - "caption": Teks naskah cerita/resep utama BERSIH (hanya intro hook + isi cerita/langkah/tips tanpa CTA produk dan tanpa deretan hashtags).
   - "caption_facebook": Naskah lengkap di mana sebelum deretan hashtag disematkan CTA rekomendasi produk resmi:
     "🛒 Rekomendasi Bahan/Produk Resmi:\\nBeli [Nama Produk Terpilih] asli di Shopee resmi kami di sini:\\n{{AFFILIATE_LINK}}"
   - "caption_bio": Naskah lengkap di mana sebelum deretan hashtag disematkan CTA khusus non-FB:
     "👉 Info Bahan/Produk:\\nBahan & produk rekomendasi ([Nama Produk Terpilih]) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨"
   - "selected_product_id": ID produk yang Anda pilih dari daftar di atas.
   - "selected_product_name": Nama produk yang Anda pilih dari daftar di atas.
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

  // Jika matchedProduct tersedia dan memiliki link Shopee
  if (matchedProduct && matchedProduct.affiliate_link) {
    const pName = matchedProduct.product_name || 'Bahan/Produk Rekomendasi';
    const affLink = matchedProduct.affiliate_link.trim();

    // Selalu bangun platform-adaptive captions secara bersih dan bebas duplikasi
    const adapted = buildPlatformAdaptiveCaptions({
      baseCaption,
      hashtags,
      matchedProduct
    });

    let captionFb = rawSocialPackage.caption_facebook || '';
    if (captionFb && captionFb.includes('{{AFFILIATE_LINK}}')) {
      captionFb = captionFb.replace(/\{\{AFFILIATE_LINK\}\}/g, affLink);
    } else {
      captionFb = adapted.caption_facebook;
    }

    return {
      title: rawSocialPackage.title || '',
      caption: stripCtaAndHashtags(baseCaption),
      caption_facebook: captionFb,
      caption_bio: adapted.caption_bio,
      caption_universal: adapted.caption_universal,
      hashtags: adapted.hashtags,
      matched_product: {
        product_id: matchedProduct.product_id,
        product_name: pName,
        affiliate_link: affLink,
        brand_profile_id: matchedProduct.brand_profile_id || null
      }
    };
  }

  // Non-affiliate / tanpa produk affiliate
  const cleanBase = stripCtaAndHashtags(baseCaption);
  const formattedTags = hashtags.length > 0 ? '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
  const unified = cleanBase + formattedTags;

  return {
    title: rawSocialPackage.title || '',
    caption: cleanBase,
    caption_facebook: rawSocialPackage.caption_facebook ? stripCtaAndHashtags(rawSocialPackage.caption_facebook) + formattedTags : unified,
    caption_bio: rawSocialPackage.caption_bio ? stripCtaAndHashtags(rawSocialPackage.caption_bio) + formattedTags : unified,
    caption_universal: unified,
    hashtags,
    matched_product: null
  };
}
