import crypto from 'crypto';
import { fetchRecipeFromUrl } from './recipe-url-fetcher.js';
import { polishRecipeWithAi } from './recipe-polish-engine.js';
import { insertCuratedRecipe } from '../curated-recipes-repository.js';

/**
 * Memproses hingga 50 baris URL resep secara sekuensial dengan jeda acak 10 - 20 detik anti-bot.
 * STRICT GUARDRAIL: ingredients_raw disimpan 100% utuh tanpa polesan AI.
 */
export async function processRecipeBatchSequential({
  urls = [],
  autoPolish = true,
  stylePreset = 'Food Porn',
  category = 'makanan_utama',
  cuisine = 'indonesia',
  tenantId = 'default_tenant',
  minDelayMs = 10000, // 10 detik minimal
  maxDelayMs = 20000, // 20 detik maksimal
  onProgress = null,
  apiKey = null
}) {
  let cleanUrls = [];
  if (Array.isArray(urls)) {
    cleanUrls = urls.map(u => String(u).trim()).filter(Boolean);
  } else if (typeof urls === 'string') {
    cleanUrls = urls.split(/[\r\n]+/).map(u => u.trim()).filter(Boolean);
  }

  if (cleanUrls.length === 0) {
    throw new Error('Daftar URL resep tidak boleh kosong.');
  }

  if (cleanUrls.length > 50) {
    throw new Error('Maksimum URL yang dapat diproses dalam satu batch adalah 50 baris URL.');
  }

  const batchId = `rbatch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const results = [];

  for (let i = 0; i < cleanUrls.length; i++) {
    const targetUrl = cleanUrls[i];
    const currentIndex = i + 1;
    const recipeId = `rcp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    try {
      if (onProgress) {
        onProgress({
          index: currentIndex,
          total: cleanUrls.length,
          url: targetUrl,
          status: 'fetching'
        });
      }

      // 1. Fetch & Parse data otoritatif dari sumber web
      const scraped = await fetchRecipeFromUrl(targetUrl);

      // 2. KUNCI BAHAN ASLI 100% UTUH (STRICT GUARDRAIL)
      const rawIngredients = scraped.ingredients || [];

      let polishedData = null;
      let polishStatus = 'unpolished';

      // 3. AI Magic Polish jika diaktifkan
      if (autoPolish) {
        if (onProgress) {
          onProgress({
            index: currentIndex,
            total: cleanUrls.length,
            url: targetUrl,
            status: 'polishing'
          });
        }

        try {
          polishedData = await polishRecipeWithAi({
            recipeData: {
              original_title: scraped.title,
              original_summary: scraped.summary,
              original_instructions: scraped.instructions,
              ingredients_raw: rawIngredients
            },
            stylePreset,
            apiKey
          });
          polishStatus = polishedData.polish_status || 'polished';
        } catch (polErr) {
          console.warn(`[Batch Importer] Peringatan AI Polish untuk URL ${targetUrl}:`, polErr.message);
          polishStatus = 'fallback_raw';
        }
      }

      // 4. Simpan ke Database
      const saved = await insertCuratedRecipe({
        id: recipeId,
        tenant_id: tenantId,
        source_url: targetUrl,
        source_domain: scraped.domain,
        author: scraped.author,
        original_title: scraped.title,
        polished_title: polishedData?.polished_title || scraped.title,
        original_summary: scraped.summary,
        polished_summary: polishedData?.polished_summary || scraped.summary,
        ingredients_raw: rawIngredients, // DIJAMIN 100% ASLI
        original_instructions: scraped.instructions,
        polished_instructions: polishedData?.polished_instructions || scraped.instructions,
        prep_time: scraped.prep_time,
        cook_time: scraped.cook_time,
        total_time: scraped.total_time,
        servings: scraped.servings,
        category: category || scraped.category || 'makanan_utama',
        cuisine: cuisine || scraped.cuisine || 'indonesia',
        original_image_url: scraped.image_url,
        ai_photo_prompts: polishedData?.ai_photo_prompt ? [polishedData.ai_photo_prompt] : [],
        status: 'ready_for_production',
        polish_status: polishStatus,
        batch_id: batchId
      });

      results.push({
        index: currentIndex,
        url: targetUrl,
        success: true,
        recipe_id: recipeId,
        original_title: saved.original_title,
        polished_title: saved.polished_title,
        ingredients_count: rawIngredients.length,
        polish_status: polishStatus
      });

      if (onProgress) {
        onProgress({
          index: currentIndex,
          total: cleanUrls.length,
          url: targetUrl,
          status: 'saved',
          recipeId
        });
      }

    } catch (err) {
      console.error(`[Batch Importer] Gagal memproses URL ${targetUrl}:`, err.message);
      results.push({
        index: currentIndex,
        url: targetUrl,
        success: false,
        error: err.message
      });

      if (onProgress) {
        onProgress({
          index: currentIndex,
          total: cleanUrls.length,
          url: targetUrl,
          status: 'failed',
          error: err.message
        });
      }
    }

    // 5. Jeda Acak Sekuensial 10 - 20 Detik (Anti-Bot & Emulasi Perilaku Manusia Alami)
    if (i < cleanUrls.length - 1 && maxDelayMs > 0) {
      const delayMs = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
      if (onProgress) {
        onProgress({
          index: currentIndex,
          total: cleanUrls.length,
          status: 'waiting_delay',
          delayMs
        });
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return {
    batch_id: batchId,
    total_processed: cleanUrls.length,
    success_count: results.filter(r => r.success).length,
    failed_count: results.filter(r => !r.success).length,
    results
  };
}

