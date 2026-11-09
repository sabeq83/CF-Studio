import { callGeminiAPI } from '../gemini.js';
import { jsonrepair } from 'jsonrepair';

/**
 * AI Magic Polish Engine untuk Resep Otoritatif
 * STRICT GUARDRAIL: Hanya memoles Title, Summary, dan Direction/Instructions.
 * Bahan baku (ingredients) TIDAK BOLEH disentuh atau dipoles sama sekali!
 */

export async function polishRecipeWithAi({
  recipeData,
  stylePreset = 'Food Porn',
  apiKey = null
}) {
  if (!recipeData) {
    throw new Error('recipeData diperlukan untuk proses polesan AI.');
  }

  const originalTitle = recipeData.original_title || recipeData.title || 'Resep Kuliner';
  const originalSummary = recipeData.original_summary || recipeData.summary || '';
  const originalInstructions = recipeData.original_instructions || recipeData.instructions || [];
  const rawIngredients = recipeData.ingredients_raw || recipeData.ingredients || [];

  const instructionsText = Array.isArray(originalInstructions)
    ? originalInstructions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
    : String(originalInstructions);

  const ingredientsRefText = Array.isArray(rawIngredients)
    ? rawIngredients.slice(0, 15).map(i => `- ${i}`).join('\n')
    : String(rawIngredients);

  const prompt = `
Kamu adalah Culinary Creative Director di CF Studio.
Tugasmu adalah melakukan "Magic Polish" pada konten resep kuliner untuk kebutuhan naskah video reels/shorts memasak yang memikat dan menggugah selera.

=== STRICT GUARDRAIL (ATURAN MUTLAK) ===
1. JANGAN PERNAH MENGUBAH, MEMOLES, ATAU MENGEMBALIKAN BAHAN RESEP (INGREDIENTS)!
   Bahan resep bersifat otoritatif dan 100% BEKU (FROZEN). Daftar bahan di bawah hanya disediakan sebagai referensi membaca konteks hidangan.
2. Kamu HANYA boleh memoles 3 komponen:
   - "polished_title": Judul baru yang sangat menggugah selera (mouthwatering, click-worthy, dan kaya daya tarik kuliner). Pertahankan esensi nama masakannya.
   - "polished_summary": Pengantar kuliner 2-3 kalimat yang memikat, menggambarkan sensasi rasa, aroma, dan kenikmatan sajian untuk hook pembuka video.
   - "polished_instructions": Array langkah-langkah memasak kronologis terstruktur. Pertahankan urutan asli namun percantik dengan bahasa aksi kuliner dan indikator sensori memasak (misal: "tumis hingga harum semerbak berminyak", "masak hingga daging empuk keemasan dan bumbu meresap sempurna").
   - "ai_photo_prompt": Prompt deskriptif fotorealistis dalam bahasa Inggris dengan gaya 5-layer optical stack (lighting, 85mm f/1.8 lens, angle, depth of field, appetizing steam & garnishing) untuk sajian akhir hidangan ini dengan preset gaya: "${stylePreset}".

=== DATA RESEP SUMBER ===
Judul Asli: ${originalTitle}
Intro/Deskripsi Asli: ${originalSummary || '(Belum ada intro)'}

Referensi Bahan Baku (HANYA UNTUK DIBACA, JANGAN DIUBAH/DIPOLES):
${ingredientsRefText || '(Daftar bahan terlampir pada dokumen asli)'}

Instruksi / Tahapan Masak Asli:
${instructionsText || '(Langkah memasak belum terstruktur)'}

=== FORMAT OUTPUT WAJIB (JSON MURNI TANPA MARKDOWN BACKTICKS) ===
{
  "polished_title": "string",
  "polished_summary": "string",
  "polished_instructions": ["Langkah 1...", "Langkah 2..."],
  "ai_photo_prompt": "string"
}
`.trim();

  try {
    const rawResponse = await callGeminiAPI(prompt, apiKey);
    if (!rawResponse) {
      throw new Error('Respons kosong dari Gemini AI');
    }

    // Bersihkan pembungkus markdown ```json ... ``` jika ada
    let cleanedJson = rawResponse.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      const repaired = jsonrepair(cleanedJson);
      parsed = JSON.parse(repaired);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Format output JSON dari Gemini tidak valid');
    }

    return {
      polished_title: parsed.polished_title?.trim() || originalTitle,
      polished_summary: parsed.polished_summary?.trim() || originalSummary,
      polished_instructions: Array.isArray(parsed.polished_instructions) && parsed.polished_instructions.length > 0
        ? parsed.polished_instructions.map(s => String(s).trim())
        : (Array.isArray(originalInstructions) ? originalInstructions : [String(originalInstructions)]),
      ai_photo_prompt: parsed.ai_photo_prompt?.trim() || `Professional culinary photography of ${originalTitle}, ${stylePreset} style, 8k resolution, cinematic lighting`,
      polish_status: 'polished'
    };

  } catch (err) {
    console.warn('[Recipe Polish Engine] Gagal memoles resep via AI, menggunakan data asli sebagai fallback:', err.message);
    return {
      polished_title: originalTitle,
      polished_summary: originalSummary,
      polished_instructions: Array.isArray(originalInstructions) ? originalInstructions : [String(originalInstructions)],
      ai_photo_prompt: `Professional culinary photography of ${originalTitle}, ${stylePreset} style, 8k resolution, cinematic lighting`,
      polish_status: 'fallback_raw',
      polish_error: err.message
    };
  }
}

