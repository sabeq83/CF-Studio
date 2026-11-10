import { callGeminiAPI } from './gemini.js';
import { pgQuery } from './db-pg.js';
import { saveReplyDraft, listPendingAnalysisPosts } from './threads-affiliate-repository.js';

/**
 * Mengambil katalog produk aktif untuk pencocokan AI
 */
export async function getActiveProductsForMatcher(tenantId = 'default_tenant', limit = 40) {
  const sql = `
    SELECT 
      id, 
      COALESCE(product_name, 'Produk Shopee') as name, 
      category, 
      COALESCE(affiliate_link, source_url, '') as shopee_url, 
      COALESCE(photo_url, clean_photo_url, scraped_image_url, '') as image_url, 
      COALESCE(product_description, raw_description, '') as description
    FROM products
    WHERE (tenant_id = $1 OR tenant_id = 'default_tenant' OR tenant_id IS NULL)
    ORDER BY created_at DESC
    LIMIT $2
  `;
  try {
    const res = await pgQuery(sql, [tenantId, limit]);
    return res.rows;
  } catch (err) {
    console.warn('[Threads Matcher] Gagal fetch products:', err.message);
    return [];
  }
}

/**
 * Membersihkan output JSON dari markdown fences (```json ... ```)
 */
function cleanJsonOutput(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  try {
    return JSON.parse(str.trim());
  } catch {
    return null;
  }
}

/**
 * Agen 2: Menganalisa postingan Threads, mencocokkan produk Shopee, dan menyusun draf balasan
 */
export async function analyzeAndDraftReply(tenantId = 'default_tenant', post, customProducts = null) {
  if (!post || (!post.post_content && !post.description && !post.text)) {
    throw new Error('Postingan Threads tidak valid atau kosong');
  }

  const postContent = post.post_content || post.description || post.text;
  const author = post.author_username || post.author_name || post.owner?.name || 'Anonim';
  const postUrl = post.post_url || post.url || '';

  const products = customProducts || await getActiveProductsForMatcher(tenantId);
  if (!products || products.length === 0) {
    return {
      success: false,
      reason: 'Tidak ada produk Shopee aktif di katalog untuk dicocokkan.'
    };
  }

  const catalogSummary = products.map((p, idx) => ({
    id: p.id,
    index: idx + 1,
    name: p.name,
    category: p.category || 'general',
    price: p.price,
    description: (p.description || '').slice(0, 120),
    has_image: Boolean(p.image_url),
    shopee_url: p.shopee_url
  }));

  const prompt = `
Anda adalah "Agen B / The Strategist", asisten AI yang bertindak sebagai "Warga Threads" Indonesia yang ramah, empatik, suka membantu orang, dan berpengalaman mengatasi masalah sehari-hari.

Tugas Anda adalah membaca postingan Threads seseorang, menentukan apakah ada produk dari KATALOG KITA yang menjadi SOLUSI NYATA untuk masalahnya, dan menyusun draf balasan yang terasa 100% natural (BUKAN IKLAN KAKU / BOT SPAM).

[POSTINGAN THREADS TARGET]
Penulis: ${author}
URL: ${postUrl}
Teks Postingan:
"""
${postContent}
"""

[KATALOG PRODUK SHOPEE KITA]
${JSON.stringify(catalogSummary, null, 2)}

ATURAN STRATEGI JAWABAN:
1. Relevansi:
   - Jika postingan TIDAK relevan sama sekali dengan produk apa pun di katalog (misal: curhat politik, galau cinta, jual rumah/tanah), set "is_relevant": false, "confidence_score": < 50, dan beri alasan singkat di "skip_reason".
   - Jika RELEVAN, pilih 1 produk yang paling tepat sasaran dan berikan "confidence_score" (50 - 100).
2. Strategi Link ("reply_strategy"):
   - "direct_link": Pilih ini HANYA JIKA penulis secara gamblang meminta spill/link/rekomendasi beli (misal: "beli di mana ya?", "spill dong", "rekomendasi merk X murah?"). Tulis balasan santai + sertakan link Shopee di akhir teks.
   - "soft_in_bio": Pilih ini jika penulis hanya curhat/mengeluhkan masalah biasa tanpa minta link. Jangan taruh link panjang di teks (agar tidak kena spam filter Threads). Cukup berikan tips/solusi, sebutkan foto produk terlampir, dan arahkan santai ke bio (contoh: "Fotonya kyk gini kak, link tokonya udah aku taruh di bio profil ya biar gampang dicek").
3. Gaya Bahasa (Tone of Voice):
   - Wajib khas gaya warga Threads Indonesia: santai, akrab, empati, gunakan kata seperti 'fyi', 'kebetulan kmrn', 'lumayan bgt', 'aku pake ini'. Dilarang memakai sapaan kaku seperti "Halo Kakak!", "Yuk buruan diorder!", atau bahasa robot marketing.
4. Maksimal Panjang Karakter: 150 - 280 karakter (ringkas, to the point, bersahabat).

Hasilkan respon HANYA dalam format JSON berikut tanpa teks pembuka/penutup apa pun:
{
  "is_relevant": true,
  "confidence_score": 90,
  "intent_category": "seeking_recommendation",
  "matched_product_id": "ID_PRODUK_DARI_KATALOG",
  "reply_strategy": "soft_in_bio",
  "reply_text": "Teks balasan yang sudah matang dan siap diposting...",
  "skip_reason": null
}
`;

  try {
    const rawAiResponse = await callGeminiAPI(prompt);
    const parsed = cleanJsonOutput(rawAiResponse);

    if (!parsed) {
      throw new Error(`Gagal mem-parse respon AI: ${rawAiResponse?.slice(0, 150)}`);
    }

    if (!parsed.is_relevant || (parsed.confidence_score && parsed.confidence_score < 60)) {
      return {
        success: false,
        is_relevant: false,
        confidence_score: parsed.confidence_score || 40,
        skip_reason: parsed.skip_reason || 'Kurang relevan dengan katalog produk yang tersedia.'
      };
    }

    // Temukan detail produk yang terpilih
    const matchedProduct = products.find(p => String(p.id) === String(parsed.matched_product_id)) || products[0];

    const draftData = {
      discovered_post_id: post.id || post.post_id,
      matched_product_id: matchedProduct.id,
      reply_text: parsed.reply_text,
      reply_strategy: parsed.reply_strategy || 'soft_in_bio',
      product_image_url: matchedProduct.image_url || null,
      shopee_affiliate_url: matchedProduct.shopee_url || null,
      ai_confidence_score: parsed.confidence_score || 85,
      ai_intent_category: parsed.intent_category || 'recommendation'
    };

    let savedDraft = null;
    const isValidUuid = typeof post.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.id);
    if (isValidUuid) {
      savedDraft = await saveReplyDraft(tenantId, draftData);
    }

    return {
      success: true,
      is_relevant: true,
      draft: savedDraft || draftData,
      matched_product: matchedProduct
    };
  } catch (err) {
    console.error('[Threads Matcher Error]:', err);
    throw err;
  }
}

/**
 * Memproses semua postingan yang berstatus 'pending_analysis' untuk tenant tertentu
 */
export async function processDiscoveredThreadsPosts(tenantId = 'default_tenant', { limit = 10 } = {}) {
  const pendingPosts = await listPendingAnalysisPosts(tenantId, limit);
  if (!pendingPosts || pendingPosts.length === 0) {
    return { success: true, processedCount: 0, draftsCreated: 0, skippedCount: 0, results: [] };
  }

  const products = await getActiveProductsForMatcher(tenantId);
  let draftsCreated = 0;
  let skippedCount = 0;
  const results = [];

  for (const post of pendingPosts) {
    try {
      const outcome = await analyzeAndDraftReply(tenantId, post, products);
      if (outcome.is_relevant) {
        draftsCreated++;
      } else {
        skippedCount++;
      }
      results.push({ postId: post.id, outcome });
    } catch (err) {
      console.warn(`[Threads Matcher] Gagal analisis post ${post.id}:`, err.message);
      results.push({ postId: post.id, error: err.message });
    }
  }

  return {
    success: true,
    processedCount: pendingPosts.length,
    draftsCreated,
    skippedCount,
    results
  };
}
