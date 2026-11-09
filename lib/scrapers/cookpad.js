/**
 * Cookpad Indonesia Scraper Driver
 * Mengekstrak title, category, canonical URL, id, dan metadata pendukung dari halaman pencarian Cookpad.
 */

/**
 * Decode basic HTML entities safely
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Ekstraksi kategori otomatis dari URL Cookpad
 * @param {string} url - Contoh: https://cookpad.com/id/cari/brownies
 * @returns {string}
 */
export function extractCategoryFromCookpadUrl(url = '') {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/cari\/([^/?#]+)/i);
    if (match && match[1]) {
      const rawSlug = decodeURIComponent(match[1]).replace(/\+/g, ' ').trim().toLowerCase();
      return rawSlug;
    }
  } catch (err) {
    // URL parsing fallback
    const matchFallback = String(url).match(/\/cari\/([^/?#\s]+)/i);
    if (matchFallback && matchFallback[1]) {
      return decodeURIComponent(matchFallback[1]).replace(/\+/g, ' ').trim().toLowerCase();
    }
  }
  return 'general';
}

/**
 * Parse HTML pencarian Cookpad dan kembalikan daftar resep bersih
 * @param {string} html - HTML string dari respons pencarian Cookpad
 * @param {string} defaultCategory - Kategori resep (misal 'brownies')
 * @returns {Array<{ id: string, title: string, category: string, url: string, thumbnail: string|null }>}
 */
export function parseCookpadSearchHtml(html = '', defaultCategory = '') {
  if (!html || typeof html !== 'string') return [];

  const results = [];
  const seenIds = new Set();
  const category = (defaultCategory || 'general').trim().toLowerCase();

  // Pattern 1: Deteksi anchor tag menuju /id/resep/{id}
  const recipeAnchorRegex = /<a[^>]*href="(\/id\/resep\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = recipeAnchorRegex.exec(html)) !== null) {
    const rawPath = match[1];
    const recipeId = match[2];
    const innerHtml = match[3];

    // Bersihkan tag HTML dari title
    const cleanTitle = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

    // Filter link non-resep seperti "Resep Baru" atau tombol navigasi
    const lowerTitle = cleanTitle.toLowerCase();
    const isInvalidTitle =
      cleanTitle.length < 3 ||
      lowerTitle.includes('resep baru') ||
      lowerTitle.includes('tulis resep') ||
      lowerTitle.includes('simpan resep') ||
      lowerTitle.includes('masuk') ||
      lowerTitle.includes('daftar');

    if (!isInvalidTitle && !seenIds.has(recipeId)) {
      seenIds.add(recipeId);

      // Cari thumbnail jika ada di sekitar blok resep
      let thumbnail = null;
      const thumbMatch = html.match(new RegExp(`data-recipe-id="${recipeId}"[\\s\\S]*?<img[^>]*src="([^"]+)"`, 'i')) ||
                         html.match(new RegExp(`<img[^>]*src="([^"]+cpcdn\\.com\\/recipes\\/[^"]+)"`, 'i'));
      if (thumbMatch && thumbMatch[1] && !thumbMatch[1].includes('avatar')) {
        thumbnail = thumbMatch[1];
      }

      results.push({
        id: recipeId,
        title: cleanTitle,
        category: category,
        url: `https://cookpad.com/id/resep/${recipeId}`,
        thumbnail: thumbnail
      });
    }
  }

  return results;
}
