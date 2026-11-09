import { parseJsonLdRecipe } from './json-ld-recipe-parser.js';

/**
 * Cookpad Dedicated Recipe Parser
 * Mendukung cookpad.com dan semua varian locale (/id/, /us/, /es/, dll.)
 */

export function isCookpadUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'cookpad.com' || host.endsWith('.cookpad.com');
  } catch {
    return false;
  }
}

/**
 * Bersihkan judul Cookpad dari hashtag dan embel-embel kompetisi
 */
export function cleanCookpadTitle(rawTitle) {
  if (!rawTitle) return '';
  let cleaned = rawTitle
    .replace(/#\w+/g, '') // Hapus hashtag seperti #BikinRamadanBerkesan
    .replace(/^resep\s+/i, '') // Hapus kata "Resep " di awal
    .replace(/(\s*[-|–]\s*Cookpad.*)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || rawTitle.trim();
}

/**
 * Parse resep Cookpad
 */
export function parseCookpadRecipe(html, url = '') {
  // 1. Ekstrak dengan JsonLd parser utama
  const parsed = parseJsonLdRecipe(html, url);
  if (!parsed) {
    throw new Error('Gagal mengekstrak data resep dari halaman Cookpad');
  }

  // 2. Bersihkan judul khas Cookpad
  parsed.title = cleanCookpadTitle(parsed.title);
  parsed.source_domain = 'cookpad.com';
  parsed.parser_used = 'cookpad_dedicated_parser';

  return parsed;
}

