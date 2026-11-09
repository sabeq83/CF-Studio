/**
 * Universal JSON-LD Schema.org Recipe Parser
 * Mengekstrak data resep berstandar Schema.org (@type = 'Recipe') dari halaman web kuliner.
 * Mendukung Cookpad, Masak Apa Hari Ini, Endeus, Sajian Sedap, BBC Food, AllRecipes, Tasty, dll.
 */

/**
 * Decode HTML entities sederhana
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim();
}

/**
 * Hapus tag HTML
 */
function stripTags(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Konversi ISO 8601 Duration (misal: PT20M, PT1H30M, P1D) ke teks bahasa Indonesia
 */
export function formatIsoDuration(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const clean = iso.trim().toUpperCase();
  const match = clean.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) {
    return iso.trim(); // Return as-is jika sudah format natural teks (e.g. "30 mins")
  }
  const days = match[1] ? `${parseInt(match[1], 10)} hari ` : '';
  const hours = match[2] ? `${parseInt(match[2], 10)} jam ` : '';
  const minutes = match[3] ? `${parseInt(match[3], 10)} menit ` : '';
  const seconds = match[4] ? `${parseInt(match[4], 10)} detik` : '';
  const result = `${days}${hours}${minutes}${seconds}`.trim();
  return result || iso.trim();
}

/**
 * Cari objek Recipe secara rekursif dalam object atau array JSON-LD
 */
function findRecipeInGraph(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInGraph(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof data === 'object') {
    // Periksa @type
    const type = data['@type'];
    if (type) {
      if (typeof type === 'string' && type.toLowerCase() === 'recipe') {
        return data;
      }
      if (Array.isArray(type) && type.some(t => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
        return data;
      }
    }

    // Periksa @graph
    if (data['@graph'] && Array.isArray(data['@graph'])) {
      for (const node of data['@graph']) {
        const found = findRecipeInGraph(node);
        if (found) return found;
      }
    }

    // Cari di semua nested properties
    for (const key of Object.keys(data)) {
      if (key !== '@graph' && typeof data[key] === 'object' && data[key] !== null) {
        const found = findRecipeInGraph(data[key]);
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Ekstraksi instruksi langkah memasak secara rekursif dari HowToStep / HowToSection
 */
function extractInstructionsRecursive(items, result = []) {
  if (!items) return result;

  if (typeof items === 'string') {
    const lines = items.split(/[\r\n]+/);
    for (const line of lines) {
      const clean = decodeHtmlEntities(stripTags(line));
      if (clean) result.push(clean);
    }
    return result;
  }

  if (Array.isArray(items)) {
    for (const item of items) {
      extractInstructionsRecursive(item, result);
    }
    return result;
  }

  if (typeof items === 'object') {
    const type = (items['@type'] || '').toLowerCase();
    if (type === 'howtosection' && items.itemListElement) {
      extractInstructionsRecursive(items.itemListElement, result);
    } else if (items.text) {
      const clean = decodeHtmlEntities(stripTags(String(items.text)));
      if (clean) result.push(clean);
    } else if (items.itemListElement) {
      extractInstructionsRecursive(items.itemListElement, result);
    }
  }

  return result;
}

/**
 * Ekstraksi URL gambar
 */
function extractImage(rawImg) {
  if (!rawImg) return null;
  if (typeof rawImg === 'string') return rawImg;
  if (Array.isArray(rawImg) && rawImg.length > 0) {
    const first = rawImg[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first?.url) return first.url;
  }
  if (typeof rawImg === 'object' && rawImg.url) return rawImg.url;
  return null;
}

/**
 * Ekstraksi Author
 */
function extractAuthor(author) {
  if (!author) return '';
  if (typeof author === 'string') return author;
  if (Array.isArray(author) && author.length > 0) {
    const first = author[0];
    return typeof first === 'string' ? first : first?.name || '';
  }
  if (typeof author === 'object' && author.name) return String(author.name);
  return '';
}

/**
 * Parse JSON-LD Schema.org Recipe dari HTML
 */
export function parseJsonLdRecipe(html, url = '') {
  if (!html || typeof html !== 'string') {
    throw new Error('HTML input tidak boleh kosong');
  }

  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let rawRecipe = null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonStr = match[1]?.trim();
    if (!jsonStr) continue;

    try {
      const parsed = JSON.parse(jsonStr);
      const found = findRecipeInGraph(parsed);
      if (found) {
        rawRecipe = found;
        break;
      }
    } catch {
      // Abaikan syntax error pada blok JSON-LD yang bukan target
    }
  }

  if (!rawRecipe) {
    // Coba fallback OpenGraph jika JSON-LD tidak ada
    return fallbackOpenGraphParse(html, url);
  }

  // 1. Title
  const title = decodeHtmlEntities(stripTags(rawRecipe.name || rawRecipe.headline || 'Resep Tanpa Judul'));

  // 2. Summary / Description
  const summary = decodeHtmlEntities(stripTags(rawRecipe.description || ''));

  // 3. Durasi & Porsi
  const prepTime = formatIsoDuration(rawRecipe.prepTime);
  const cookTime = formatIsoDuration(rawRecipe.cookTime);
  const totalTime = formatIsoDuration(rawRecipe.totalTime);

  let servings = '';
  if (rawRecipe.recipeYield) {
    if (Array.isArray(rawRecipe.recipeYield)) {
      servings = String(rawRecipe.recipeYield[0] || '');
    } else {
      servings = String(rawRecipe.recipeYield);
    }
    servings = servings.replace(/[^0-9\-–]/g, ' ').replace(/\s+/g, ' ').trim();
    if (servings && !servings.toLowerCase().includes('porsi')) {
      servings += ' porsi';
    }
  }

  // 4. Ingredients (STRICT: Diekstrak asli, tidak boleh dimodifikasi)
  const ingredients = [];
  const rawIng = rawRecipe.recipeIngredient || rawRecipe.ingredients || [];
  if (Array.isArray(rawIng)) {
    for (const ing of rawIng) {
      if (typeof ing === 'string' && ing.trim()) {
        const clean = decodeHtmlEntities(stripTags(ing));
        if (clean) ingredients.push(clean);
      }
    }
  }

  // 5. Instructions
  const rawInst = rawRecipe.recipeInstructions || [];
  const instructions = extractInstructionsRecursive(rawInst);

  // 6. Gambar & Author
  const imageUrl = extractImage(rawRecipe.image);
  const author = extractAuthor(rawRecipe.author);

  // 7. Kategori & Masakan
  let category = 'makanan_utama';
  if (rawRecipe.recipeCategory) {
    category = Array.isArray(rawRecipe.recipeCategory) ? rawRecipe.recipeCategory.join(', ') : String(rawRecipe.recipeCategory);
  }
  let cuisine = 'indonesia';
  if (rawRecipe.recipeCuisine) {
    cuisine = Array.isArray(rawRecipe.recipeCuisine) ? rawRecipe.recipeCuisine.join(', ') : String(rawRecipe.recipeCuisine);
  }

  return {
    title,
    summary,
    prep_time: prepTime,
    cook_time: cookTime,
    total_time: totalTime,
    servings,
    ingredients, // DIJAMIN ASLI
    instructions,
    image_url: imageUrl,
    author,
    category,
    cuisine,
    parser_used: 'json_ld_schema_org'
  };
}

/**
 * Fallback parser menggunakan OpenGraph / Meta tags dasar
 */
function fallbackOpenGraphParse(html, url = '') {
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                     html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return null;

  let title = decodeHtmlEntities(stripTags(titleMatch[1]));
  title = title.replace(/(\s*[-|–]\s*(Cookpad|Masak Apa Hari Ini|Endeus|Sajian Sedap).*)$/i, '').trim();

  const descMatch = html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)["']/i);
  const summary = descMatch ? decodeHtmlEntities(stripTags(descMatch[1])) : '';

  const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const imageUrl = imgMatch ? imgMatch[1].trim() : null;

  return {
    title: title || 'Resep Kuliner',
    summary,
    prep_time: '',
    cook_time: '',
    total_time: '',
    servings: '',
    ingredients: [],
    instructions: [],
    image_url: imageUrl,
    author: '',
    category: 'makanan_utama',
    cuisine: 'indonesia',
    parser_used: 'opengraph_fallback'
  };
}

