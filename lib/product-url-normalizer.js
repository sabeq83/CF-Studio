/**
 * Normalisasi URL produk e-commerce secara konsisten antara scrape route,
 * scheduler processor, dan modul Radar Produk.
 *
 * Menghapus query string, hash, trailing slash, dan prefix "www." pada protocol.
 */
export function normalizeProductUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let normalized = parsed.toString().trim();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    normalized = normalized.replace('://www.', '://');
    return normalized;
  } catch {
    let cleaned = url.trim().split('?')[0].split('#')[0];
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  }
}
