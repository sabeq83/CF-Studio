import { parseJsonLdRecipe } from './parsers/json-ld-recipe-parser.js';
import { isCookpadUrl, parseCookpadRecipe } from './parsers/cookpad-parser.js';

/**
 * Validasi keamanan URL dan SSRF Guard
 */
export function validateUrlSsrf(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Format URL tidak valid: "${urlString}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Protokol URL tidak didukung: ${parsed.protocol}. Hanya http dan https yang diizinkan.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Guard: Blokir IP loopback, intranet, metadata cloud, dan private ranges
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') || // AWS/GCP metadata
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    throw new Error(`Akses ke alamat private/internal diblokir oleh SSRF Guard: ${hostname}`);
  }

  return parsed;
}

/**
 * Mengambil konten HTML dari URL resep dengan User-Agent browser modern
 */
export async function fetchRecipeHtml(url, timeoutMs = 15000) {
  validateUrlSsrf(url);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gagal mengunduh halaman (HTTP ${response.status} ${response.statusText})`);
    }

    const html = await response.text();
    return html;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Koneksi waktu habis (Timeout ${timeoutMs}ms) saat mengambil URL: ${url}`);
    }
    throw err;
  }
}

/**
 * Mengunduh dan mengekstrak data resep otoritatif dari URL
 */
export async function fetchRecipeFromUrl(url) {
  const parsedUrl = validateUrlSsrf(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');

  const html = await fetchRecipeHtml(url);

  let parsedRecipe;
  if (isCookpadUrl(url)) {
    parsedRecipe = parseCookpadRecipe(html, url);
  } else {
    parsedRecipe = parseJsonLdRecipe(html, url);
  }

  if (!parsedRecipe) {
    throw new Error(`Tidak dapat mendeteksi struktur resep yang valid dari ${domain}. Pastikan URL merupakan halaman artikel resep.`);
  }

  return {
    ...parsedRecipe,
    url,
    domain: parsedRecipe.source_domain || domain
  };
}

