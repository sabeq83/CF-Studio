/**
 * Scraper Orchestrator — Multi-Platform Recipe URL Extractor
 * Mengatur routing driver (Cookpad & ekstensi platform masa depan),
 * crawling multi-halaman dengan pagination, deduplikasi, rate-limit delay, dan formatter CSV/TSV.
 */

import { parseCookpadSearchHtml, extractCategoryFromCookpadUrl } from './cookpad.js';

/**
 * Deteksi platform berdasarkan hostname URL
 * @param {string} targetUrl
 * @returns {'cookpad' | 'unknown'}
 */
export function detectPlatform(targetUrl = '') {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('cookpad.com')) return 'cookpad';
    if (host.includes('endeus.tv')) return 'endeus';
    if (host.includes('briliofood.net')) return 'brilio';
  } catch (err) {}
  return 'unknown';
}

/**
 * Format array item resep menjadi string CSV standar
 * @param {Array<{ title: string, category: string, url: string }>} items
 * @returns {string}
 */
export function formatRecipesToCsv(items = []) {
  const header = 'title,category,url\n';
  const rows = items.map(item => {
    const safeTitle = `"${String(item.title || '').replace(/"/g, '""')}"`;
    const safeCategory = `"${String(item.category || '').replace(/"/g, '""')}"`;
    const safeUrl = `"${String(item.url || '').replace(/"/g, '""')}"`;
    return `${safeTitle},${safeCategory},${safeUrl}`;
  });
  return header + rows.join('\n');
}

/**
 * Format array item resep menjadi string TSV (Tab-Separated) untuk Google Sheets / Excel
 * @param {Array<{ title: string, category: string, url: string }>} items
 * @returns {string}
 */
export function formatRecipesToTsv(items = []) {
  const header = 'title\tcategory\turl\n';
  const rows = items.map(item => {
    const safeTitle = String(item.title || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
    const safeCategory = String(item.category || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
    const safeUrl = String(item.url || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
    return `${safeTitle}\t${safeCategory}\t${safeUrl}`;
  });
  return header + rows.join('\n');
}

/**
 * Eksekusi crawling multi-halaman dari URL listing resep
 * @param {Object} options
 * @param {string} options.url - Target URL listing (misal https://cookpad.com/id/cari/brownies)
 * @param {number} [options.pages=1] - Jumlah halaman yang ingin di-crawl (default 1)
 * @param {string} [options.customCategory=''] - Override kategori manual
 * @param {number} [options.delayMs=400] - Jeda waktu antar request (politeness delay)
 * @returns {Promise<{ success: boolean, source: string, category: string, total_scraped: number, pages_crawled: number, items: Array }>}
 */
export async function scrapeRecipeListingUrl({
  url,
  pages = 1,
  customCategory = '',
  delayMs = 400
}) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('URL target wajib diisi.');
  }

  const cleanUrl = url.trim();
  const platform = detectPlatform(cleanUrl);

  if (platform !== 'cookpad') {
    throw new Error(`Platform untuk URL ini (${cleanUrl}) belum didukung. Saat ini driver aktif mendukung Cookpad Indonesia.`);
  }

  // Tentukan kategori
  const resolvedCategory = (customCategory || extractCategoryFromCookpadUrl(cleanUrl)).trim().toLowerCase();

  const allItems = [];
  const seenUrls = new Set();
  const maxPages = Math.max(1, Math.min(Number(pages) || 1, 20)); // Batas aman 1-20 halaman

  for (let page = 1; page <= maxPages; page++) {
    // Bangun URL per halaman
    let targetPageUrl;
    try {
      const u = new URL(cleanUrl);
      if (page > 1) {
        u.searchParams.set('page', String(page));
      }
      targetPageUrl = u.toString();
    } catch (err) {
      throw new Error(`Format URL tidak valid: ${cleanUrl}`);
    }

    const response = await fetch(targetPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      // Jika halaman 404 atau melebihi pagination maksimal, hentikan loop
      if (response.status === 404 && page > 1) break;
      throw new Error(`Gagal memuat halaman ${page} (${targetPageUrl}): HTTP status ${response.status}`);
    }

    const html = await response.text();
    const pageItems = parseCookpadSearchHtml(html, resolvedCategory);

    // Jika halaman tidak menghasilkan resep baru sama sekali, hentikan
    if (pageItems.length === 0 && page > 1) break;

    for (const item of pageItems) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }

    // Delay ramah antar halaman jika masih ada halaman berikutnya
    if (page < maxPages && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: true,
    source: platform,
    category: resolvedCategory,
    total_scraped: allItems.length,
    pages_crawled: maxPages,
    items: allItems
  };
}
