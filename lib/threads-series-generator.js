import { getGeminiModel } from './gemini.js';
import { pgQuery } from './db-pg.js';

/**
 * Single-Pass Generator untuk Rangkaian Utas Threads (Kultwit 5-Part) & Prompt T2I G-Labs
 */
export async function generateThreadsSeries({
  tenantId = 'default_tenant',
  accountUsername = 'threads_user',
  brandName = 'Brand',
  postObjective = 'personal_product', // 'personal_product' | 'affiliate' | 'pure_organic'
  personalProductName = '',
  personalProductCta = '',
  affiliateProductTitle = '',
  affiliateProductLink = '',
  pureOrganicTopic = '',
  visualMode = 'glabs', // 'glabs' | 'none'
  personaTone = 'curhat_santai',
  apiKey = null
}) {
  let resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  if (!resolvedKey) {
    try {
      const res = await pgQuery(`
        SELECT setting_value FROM (
          SELECT setting_value, tenant_id, 1 as priority FROM staging.tenant_settings WHERE setting_key = 'gemini_api_key' AND LENGTH(setting_value) > 35
          UNION ALL
          SELECT setting_value, tenant_id, 2 as priority FROM tenant_settings WHERE setting_key = 'gemini_api_key' AND LENGTH(setting_value) > 35
        ) s
        ORDER BY CASE 
          WHEN tenant_id = 'tnt_sy-benu_415f99' THEN 1
          WHEN tenant_id = $1 THEN 2
          ELSE 3 
        END, priority ASC
        LIMIT 1
      `, [tenantId]);
      if (res.rows.length > 0) resolvedKey = res.rows[0].setting_value;
    } catch (e) {
      console.warn('[Threads Series Generator] Warning querying gemini_api_key:', e.message);
    }
  }
  const systemInstruction = `Anda adalah copywriter profesional dan pakar viral marketing untuk Threads Meta.
Tugas Anda adalah merangkai "Utas Berseri" (Thread Series / Kultwit berantai 5 bagian) yang sangat adiktif, santai, memancing reply, dan diakhiri Call to Action (CTA) yang natural.

ATURAN STRUKTUR 5 PART:
- Part 1 (Hook Utama): Buat netizen berhenti scroll. Kalimat pembuka dramatis atau membuat penasaran + akhiri dengan simbol "🧵👇". Maksimal 300 karakter.
- Part 2 (Problem/Cerita): Uraikan masalah atau latar belakang yang sangat relatable dalam kehidupan sehari-hari anak muda/pekerja/mahasiswa/keluarga.
- Part 3 (Solusi/Insight): Berikan tips praktis atau pandangan mencerahkan yang menyelesaikan masalah di Part 2.
- Part 4 (Bukti & Visual): Deskripsikan wujud nyata/suasana/solusi. Jika visual_mode = 'glabs', sesuaikan dengan foto yang akan ditampilkan.
- Part 5 (CTA Sesuai Tujuan):
  * Jika personal_product: Arahkan ke produk/layanan pribadi (${personalProductName || 'produk kami'}), dengan CTA: ${personalProductCta || 'hubungi via DM'}.
  * Jika affiliate: Spill toko Shopee dengan link: ${affiliateProductLink || 'link di bio'}.
  * Jika pure_organic: Tanpa jualan. Ajak diskusi, minta tanggapan netizen, atau ajak bookmark/repost jika bermanfaat.

ATURAN PROMPT T2I G-LABS:
- Jika visual_mode = 'glabs': Sediakan 'visual_prompt_t2i' berupa prompt bahasa Inggris deskriptif fotorealistik untuk model difusi G-Labs (e.g. nano_banana_2/FLUX) yang menggambarkan visual suasana di Part 4 secara estetik (contoh: "Eye-level shot of a modern minimalist cozy bedroom, clean bed, warm soft natural morning sunlight casting soft shadows through window, aesthetic photorealistic 8k, cinematic lighting").
- Jika visual_mode = 'none': Set 'visual_prompt_t2i' ke null.

FORMAT OUTPUT JSON WAJIB:
{
  "theme": "Topik singkat utas",
  "objective": "${postObjective}",
  "series": [
    { "part": 1, "role": "hook", "text": "..." },
    { "part": 2, "role": "problem", "text": "..." },
    { "part": 3, "role": "solution", "text": "..." },
    { "part": 4, "role": "proof", "text": "..." },
    { "part": 5, "role": "cta", "text": "..." }
  ],
  "visual_prompt_t2i": ${visualMode === 'glabs' ? '"Prompt bahasa Inggris deskriptif fotorealistik untuk difusi G-Labs"' : 'null'}
}`;

  const userPrompt = `Buat 1 rangkaian Utas Threads untuk akun @${accountUsername}.
Brand: ${brandName}
Tujuan Postingan: ${postObjective}
${postObjective === 'personal_product' ? `Nama Produk Pribadi: ${personalProductName || 'Kamar Kos Sasya House'}\nCTA Produk Pribadi: ${personalProductCta || 'DM ke @' + accountUsername}` : ''}
${postObjective === 'affiliate' ? `Produk Shopee: ${affiliateProductTitle || 'Cable Management Box'}\nLink Shopee: ${affiliateProductLink || 'https://s.shopee.co.id/xxx'}` : ''}
${postObjective === 'pure_organic' ? `Topik Cerita: ${pureOrganicTopic || 'Tips hemat anak kos'}` : ''}
Mode Visual: ${visualMode}
Gaya Bahasa: ${personaTone}`;

  let responseText;
  try {
    const model = await getGeminiModel(resolvedKey, systemInstruction);
    const result = await model.generateContent(userPrompt);
    responseText = result.response.text();
  } catch (err) {
    console.warn('[Threads Series Generator] Primary model warning, retrying with gemini-2.5-flash fallback:', err.message);
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(resolvedKey);
    const fallbackModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await fallbackModel.generateContent(userPrompt);
    responseText = result.response.text();
  }

  const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  // Pastikan struktur valid
  if (!parsed.series || !Array.isArray(parsed.series)) {
    throw new Error('Format output Gemini tidak memuat array series yang valid.');
  }

  return parsed;
}
