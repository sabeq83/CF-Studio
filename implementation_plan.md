# Rencana Implementasi: Recipe Importer Otoritatif & Sequential Batch Polish (50 URLs)

> [!NOTE]
> Rencana implementasi ini dirancang untuk mengadopsi dan menyempurnakan arsitektur Importer dari **Recipe Studio** ke dalam **CF Studio**. Fitur ini memungkinkan pengguna dan agen AI (Claude/ChatGPT/Antigravity) mengimpor hingga **50 URL resep secara sekuensial**, menyimpan data mentah ke database, menjalankan **AI Magic Polish** khusus pada *Title*, *Summary*, dan *Direction*, serta **MENJAGA 100% BAHAN RESEP (INGREDIENTS) TETAP UTUH & TIDAK BOLEH DIPOLES**. Resep otoritatif ini selanjutnya menjadi pustaka referensi nyata untuk merancang adegan video memasak yang akurat dan anti-halusinasi.

---

## Ringkasan Eksekutif & Arsitektur

### 1. Prinsip Utama (Strict Guardrails)
- **Otoritatif & Valid**: Resep diambil dari web kuliner nyata berbasis standar Schema.org (`JSON-LD Recipe`) dan parser khusus (Cookpad, dll.).
- **Bahan Resep Terproteksi (100% Frozen)**: Takaran gram, sendok, siung, dan bahan asli **TIDAK DISENTUH ATAU DIPOLES SAMA SEKALI** oleh AI untuk mencegah kesalahan fatal takaran.
- **AI Magic Polish (1-Call)**:
  - **Title**: Dipoles menjadi judul memikat (*click-worthy* & *mouthwatering*).
  - **Summary**: Dipoles menjadi intro kuliner 2-3 kalimat yang menggugah selera.
  - **Direction / Steps**: Dipoles menjadi langkah terstruktur kronologis dengan indikator sensori memasak (aroma, warna, tekstur).
  - **Visual Prompts**: Dibuatkan prompt foto/video 5-layer optical stack untuk sajian akhir.
- **Pemrosesan Sekuensial 50 Baris URL**:
  - Dijalankan berurutan (satu per satu) dengan **jeda acak terkontrol (10 - 20 detik)** guna meniru pola browsing manusia alami (*natural human browsing behavior*), mencegah pemblokiran IP oleh Cloudflare/sistem anti-bot situs web kuliner, serta melindungi kuota *rate limit* Gemini AI.
  - Dilengkapi *real-time progress feedback* dan *graceful error handling* (jika URL #7 gagal, batch tetap lanjut ke URL #8).

---

## Execution Task List
- [x] **Task 1: Buat Skema & Repositori Database `lib/curated-recipes-repository.js`** untuk tabel `curated_recipes` di PostgreSQL dan SQLite.
- [x] **Task 2: Buat Modul Fetcher & Parser Otoritatif (`lib/recipe-importer/recipe-url-fetcher.js`, `parsers/json-ld-recipe-parser.js`, `parsers/cookpad-parser.js`)** dengan proteksi SSRF.
- [x] **Task 3: Buat AI Magic Polish Engine (`lib/recipe-importer/recipe-polish-engine.js`)** dengan Strict Guardrail perlindungan bahan 100% utuh.
- [x] **Task 4: Buat Sequential Batch Processor (`lib/recipe-importer/recipe-batch-processor.js`)** untuk memproses hingga 50 URL secara sekuensial dan terisolasi.
- [x] **Task 5: Buat Endpoint API Batch Import & Polishing (`app/api/v2/recipes/curated/import-batch/route.js`)**.
- [x] **Task 6: Daftarkan Tools MCP `cf_import_recipe_batch` dan `cf_list_curated_recipes` pada `apps/mcp/tools.mjs`**.
- [x] **Task 7: Buat Standalone HTML Mockup Interaktif (`public/mockup_recipe_importer.html`)** berbasis 100% Semantic CSS Tokens dari `app/theme.css`.
- [x] **Task 8: Buat Unit Test Suite Komprehensif (`tests/test-curated-recipe-importer.test.js`)**.
- [x] **Task 9: Uji Verifikasi Otomatis, Next.js Build Check, dan Prosedur Rilis Non-Interaktif**.

---

## Before & After Code Snippets

### 1. `lib/curated-recipes-repository.js` (File Baru)

#### Code Sesudah (Proposed/After):
```javascript
import { getDb } from './db.js';
import { pgQuery } from './db-pg.js';

export async function ensureCuratedRecipesTable() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS curated_recipes (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default_tenant',
      source_url TEXT NOT NULL,
      source_domain TEXT,
      author TEXT,
      original_title TEXT NOT NULL,
      polished_title TEXT,
      original_summary TEXT,
      polished_summary TEXT,
      ingredients_raw JSONB NOT NULL,
      original_instructions JSONB,
      polished_instructions JSONB,
      prep_time TEXT,
      cook_time TEXT,
      total_time TEXT,
      servings TEXT,
      category TEXT DEFAULT 'makanan_utama',
      cuisine TEXT DEFAULT 'indonesia',
      original_image_url TEXT,
      ai_photo_prompts JSONB,
      status TEXT DEFAULT 'draft',
      polish_status TEXT DEFAULT 'unpolished',
      polish_error TEXT,
      batch_id TEXT,
      used_in_campaign_count INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_curated_recipes_tenant ON curated_recipes(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_curated_recipes_source ON curated_recipes(source_url);
    CREATE INDEX IF NOT EXISTS idx_curated_recipes_batch ON curated_recipes(batch_id);
  `;
  try {
    await pgQuery(ddl);
  } catch (err) {
    console.warn('[Curated Recipes Repository] PG DDL note:', err.message);
  }
}

export async function insertCuratedRecipe(data) {
  await ensureCuratedRecipesTable();
  const sql = `
    INSERT INTO curated_recipes (
      id, tenant_id, source_url, source_domain, author, original_title, polished_title,
      original_summary, polished_summary, ingredients_raw, original_instructions,
      polished_instructions, prep_time, cook_time, total_time, servings, category,
      cuisine, original_image_url, ai_photo_prompts, status, polish_status, batch_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    ON CONFLICT (id) DO UPDATE SET
      polished_title = EXCLUDED.polished_title,
      polished_summary = EXCLUDED.polished_summary,
      polished_instructions = EXCLUDED.polished_instructions,
      ai_photo_prompts = EXCLUDED.ai_photo_prompts,
      polish_status = EXCLUDED.polish_status,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const res = await pgQuery(sql, [
    data.id, data.tenant_id || 'default_tenant', data.source_url, data.source_domain,
    data.author, data.original_title, data.polished_title, data.original_summary,
    data.polished_summary, JSON.stringify(data.ingredients_raw),
    JSON.stringify(data.original_instructions), JSON.stringify(data.polished_instructions),
    data.prep_time, data.cook_time, data.total_time, data.servings,
    data.category || 'makanan_utama', data.cuisine || 'indonesia',
    data.original_image_url, JSON.stringify(data.ai_photo_prompts || []),
    data.status || 'draft', data.polish_status || 'unpolished', data.batch_id
  ]);
  return res.rows[0];
}
```

---

### 2. `lib/recipe-importer/recipe-polish-engine.js` (File Baru) — AI Magic Polish dengan Strict Guardrail Bahan

#### Code Sesudah (Proposed/After):
```javascript
import { executeWithKeyPool } from '../gemini.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Magic Polish: Memoles Title, Summary, dan Direction.
 * STRICT GUARDRAIL: ingredients_raw TIDAK BOLEH DIPOLES/DIUBAH.
 */
export async function polishRecipeWithAi({ recipeData, stylePreset = 'Food Porn', targetLanguage = 'id-ID' }) {
  const originalTitle = recipeData.original_title || recipeData.title || '';
  const originalSummary = recipeData.original_summary || recipeData.summary || '';
  const originalInstructions = Array.isArray(recipeData.original_instructions)
    ? recipeData.original_instructions
    : (recipeData.instructions || []);

  // Format instruksi untuk konteks AI
  const formattedSteps = originalInstructions.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Kamu adalah Elite Culinary Author, Food Director & Recipe Polish Engine.
Tugasmu adalah memoles teks resep masakan agar SANGAT MENGGUGAH SELERA, CLICK-WORTHY, dan JELAS untuk audiens media sosial kuliner modern.

[DATA RESEP ASLI]
Judul Asli: ${originalTitle}
Summary Asli: ${originalSummary || 'Belum ada'}
Langkah Asli:
${formattedSteps}

[ATURAN WAJIB & GUARDRAILS]
1. POLISH TITLE:
   - Buat 1 judul utama yang click-worthy dan menggugah selera (contoh: "Ayam Woku Belanga Khas Manado: Bumbu Pedas Gurih Meresap Sempurna").
   - Buat 2 judul alternatif yang memikat.
2. POLISH SUMMARY:
   - Buat 2-3 kalimat hook puitis kuliner yang mendeskripsikan perpaduan rasa, aroma bumbu, dan kelezatan masakan.
3. POLISH DIRECTIONS / LANGKAH:
   - Parafrase langkah-langkah asli menjadi instruksi yang runtut, mudah diikuti, dan memiliki penanda sensori (warna kecokelatan, aroma tumisan harum, kuah mengental menyusut).
   - JANGAN MENGURANGI inti tahapan memasak asli.
4. PERLINDUNGAN BAHAN (CRITICAL):
   - Kamu DILARANG mengubah atau menambahkan bahan dan takaran resep. Bahan asli telah dikunci.
5. AI PHOTO PROMPT:
   - Buat 1 prompt 5-layer optical stack dalam Bahasa Inggris untuk generator foto T2I dengan gaya "${stylePreset}".

Output WAJIB berupa JSON dengan schema persis:
{
  "polished_title": "Judul utama hasil poles",
  "alternative_titles": ["Opsi 1", "Opsi 2"],
  "polished_summary": "Intro 2-3 kalimat",
  "polished_instructions": [
    "Langkah 1...",
    "Langkah 2..."
  ],
  "ai_photo_prompt": "English 5-layer optical stack prompt --ar 9:16"
}`;

  const rawJson = await executeWithKeyPool(1, async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });

  return JSON.parse(rawJson);
}
```

---

### 3. `lib/recipe-importer/recipe-batch-processor.js` (File Baru) — Pemrosesan Sekuensial Hingga 50 URLs

#### Code Sesudah (Proposed/After):
```javascript
import { v4 as uuidv4 } from 'uuid';
import { fetchRecipeFromUrl } from './recipe-url-fetcher.js';
import { polishRecipeWithAi } from './recipe-polish-engine.js';
import { insertCuratedRecipe } from '../curated-recipes-repository.js';

export async function processRecipeBatchSequential({
  urls = [],
  autoPolish = true,
  stylePreset = 'Food Porn',
  category = 'makanan_utama',
  tenantId = 'default_tenant',
  minDelayMs = 10000, // 10 detik jeda minimal
  maxDelayMs = 20000, // 20 detik jeda maksimal
  onProgress = null
}) {
  const cleanUrls = urls.map(u => String(u).trim()).filter(Boolean);
  if (cleanUrls.length === 0) {
    throw new Error('Daftar URL resep tidak boleh kosong.');
  }
  if (cleanUrls.length > 50) {
    throw new Error('Maksimum URL yang dapat diproses dalam satu batch adalah 50 URL.');
  }

  const batchId = `rbatch_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const results = [];

  for (let i = 0; i < cleanUrls.length; i++) {
    const targetUrl = cleanUrls[i];
    const currentIndex = i + 1;
    const recipeId = `rcp_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    try {
      if (onProgress) onProgress({ index: currentIndex, total: cleanUrls.length, url: targetUrl, status: 'fetching' });

      // 1. Fetch & Parse Otoritatif
      const scraped = await fetchRecipeFromUrl(targetUrl);

      // 2. Simpan BAHAN ASLI 100% UTUH (FROZEN)
      const rawIngredients = scraped.ingredients || [];

      let polishedData = null;
      let polishStatus = 'unpolished';

      // 3. AI Magic Polish jika diaktifkan (Hanya Title, Summary, Directions)
      if (autoPolish) {
        if (onProgress) onProgress({ index: currentIndex, total: cleanUrls.length, url: targetUrl, status: 'polishing' });
        try {
          polishedData = await polishRecipeWithAi({
            recipeData: {
              original_title: scraped.title,
              original_summary: scraped.summary,
              original_instructions: scraped.instructions
            },
            stylePreset
          });
          polishStatus = 'polished';
        } catch (polErr) {
          console.warn(`[Batch Importer] Polish warning for URL ${targetUrl}:`, polErr.message);
          polishStatus = 'failed';
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
        ingredients_raw: rawIngredients, // DIJAMIN 100% UTUH
        original_instructions: scraped.instructions,
        polished_instructions: polishedData?.polished_instructions || scraped.instructions,
        prep_time: scraped.prep_time,
        cook_time: scraped.cook_time,
        total_time: scraped.total_time,
        servings: scraped.servings,
        category: category || scraped.category || 'makanan_utama',
        cuisine: scraped.cuisine || 'indonesia',
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
        title: saved.polished_title || saved.original_title,
        ingredients_count: rawIngredients.length,
        polish_status: polishStatus
      });

    } catch (err) {
      results.push({
        index: currentIndex,
        url: targetUrl,
        success: false,
        error: err.message
      });
    }

    // Jeda acak sekuensial (10-20 detik) menyerupai perilaku manusia alami & anti-bot
    if (i < cleanUrls.length - 1 && maxDelayMs > 0) {
      const delayMs = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
      if (onProgress) onProgress({ index: currentIndex, total: cleanUrls.length, status: 'delaying', delayMs });
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
```

---

### 4. `apps/mcp/tools.mjs` — Penambahan Tools MCP `cf_import_recipe_batch`

#### Code Sesudah (Proposed/After):
```javascript
  // Tool: Sequential Batch Recipe Importer (1-50 URLs)
  register(
    'cf_import_recipe_batch',
    'Import and curate 1 to 50 recipe URLs sequentially into the authoritative recipe database with strict ingredients preservation and AI Magic Polish (title, summary, directions).',
    {
      urls: z.array(z.string().url()).min(1).max(50),
      auto_polish: z.boolean().default(true),
      style_preset: z.string().default('Food Porn'),
      category: z.enum(['makanan_utama', 'masakan', 'minuman', 'dessert', 'kue', 'camilan']).default('makanan_utama')
    },
    false,
    ({ urls, auto_polish, style_preset, category }) =>
      request('/api/v2/recipes/curated/import-batch', {
        body: { urls, auto_polish, style_preset, category }
      })
  );

  // Tool: List Curated Authoritative Recipes
  register(
    'cf_list_curated_recipes',
    'List or search curated authoritative recipes stored in the database for video planning.',
    {
      search: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20)
    },
    false,
    ({ search, category, limit }) =>
      request(`/api/v2/recipes/curated?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${category ? `&category=${category}` : ''}`)
  );
```
