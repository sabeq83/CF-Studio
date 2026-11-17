/**
 * URL Scraper — Server-side URL fetching + content extraction
 * Fetches HTML from product landing pages, strips tags, returns clean text
 */

/**
 * Validasi apakah URL kandidat gambar memiliki format dan path yang sah
 * Mencegah URL domain-only (seperti https://images.tokopedia.net) masuk sebagai kandidat
 */
export function isValidProductImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) return false;
    const pathname = (parsed.pathname || '').trim();
    if (!pathname || pathname === '/' || pathname === '') return false;
    const lowerPath = pathname.toLowerCase();
    const hasImageExt = /\.(?:jpg|jpeg|png|webp|avif)(?:[?#]|$)/i.test(lowerPath);
    const hasPattern = lowerPath.includes('~tplv-') || lowerPath.includes('/img/') || lowerPath.includes('/file/');
    return hasImageExt || hasPattern;
  } catch (_) {
    return false;
  }
}

/**
 * Fungsi murni pendeteksi halaman produk yang 404 / tidak ditemukan
 * Mencegah halaman kosong/error disimpan ke database dan mencegah Gemini mengarang konten
 */
export function detectNotFoundPage({ httpStatus = 200, title = '', bodyText = '', html = '' } = {}) {
  if (httpStatus === 404 || httpStatus === 410) {
    return { notFound: true, reason: `HTTP status ${httpStatus}` };
  }

  const combined = `${title || ''} ${bodyText || ''}`.toLowerCase();
  const htmlLower = (html || '').toLowerCase();

  const notFoundPhrases = [
    'tujuanmu nggak ada',
    'halaman tidak ditemukan',
    'produk tidak ditemukan',
    'produk ini tidak tersedia',
    'page not found',
    'produk ini tidak ada'
  ];

  for (const phrase of notFoundPhrases) {
    if (combined.includes(phrase) || htmlLower.includes(phrase)) {
      return { notFound: true, reason: `Tanda halaman tidak ditemukan: "${phrase}"` };
    }
  }

  // Tanda: halaman tanpa harga (Rp/IDR) DAN tanpa tanda detail produk
  const hasPrice = /(?:rp|idr)\s*[\d.,]+/i.test(combined) || /(?:rp|idr)\s*[\d.,]+/i.test(htmlLower);
  const hasDetailMarker = /(?:detail produk|spesifikasi|deskripsi produk|informasi produk)/i.test(combined) ||
                         /(?:detail produk|spesifikasi|deskripsi produk|informasi produk)/i.test(htmlLower);

  if (!hasPrice && !hasDetailMarker) {
    return { notFound: true, reason: 'Halaman tidak memiliki indikator harga (Rp) maupun tanda detail produk' };
  }

  return { notFound: false, reason: null };
}

/**
 * Fetch and extract text content from a URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<{title: string, description: string, bodyText: string, fullText: string}>}
 */
export async function scrapeUrl(url) {
  const lowerUrl = url.toLowerCase();
  const isECommerce = lowerUrl.includes('shopee.co.id') || lowerUrl.includes('tokopedia.com');

  if (isECommerce) {
    console.log(`[URL Scraper] E-commerce URL terdeteksi: ${url}. Menggunakan Playwright scraper...`);
    try {
      const { scrapeUrlPlaywright } = await import('./playwright-scraper.js');
      const result = await scrapeUrlPlaywright(url);
      const parsed = parseHtml(result.html, url, result.images || []);

      // Deteksi 404 sebelum fallback atau validasi isi
      const check404 = detectNotFoundPage({
        httpStatus: result.httpStatus || 200,
        title: parsed.title,
        bodyText: parsed.bodyText,
        html: result.html
      });

      if (check404.notFound) {
        const notFoundError = new Error(`Produk tidak ditemukan (404): ${check404.reason}`);
        notFoundError.code = 'PRODUCT_NOT_FOUND';
        notFoundError.notFoundReason = check404.reason;
        throw notFoundError;
      }

      const bodyLen = (parsed.bodyText || '').trim().length;
      const titleLower = (parsed.title || '').toLowerCase();
      const isBlockedOrEmpty = 
        bodyLen < 250 || 
        titleLower.includes('shopee indonesia | situs belanja') ||
        titleLower.includes('shopee indonesia | jual beli') ||
        titleLower.includes('captcha') ||
        titleLower.includes('verification') ||
        titleLower.includes('robots.txt') ||
        titleLower.includes('security check');

      if (isBlockedOrEmpty) {
        throw new Error(`Konten e-commerce kosong atau terblokir anti-bot (Judul: "${parsed.title || 'Tanpa Judul'}", Panjang: ${bodyLen} karakter).`);
      }

      return parsed;
    } catch (playwrightError) {
      if (playwrightError.code === 'PRODUCT_NOT_FOUND') {
        // Jangan fallback ke AI Search Grounding jika halaman 404!
        throw playwrightError;
      }
      console.warn(`[URL Scraper] Playwright scraping failed: ${playwrightError.message}. Attempting AI Search Grounding fallback...`);
      
      let geminiApiKey = null;
      try {
        const { getSetting } = await import('./db.js');
        geminiApiKey = getSetting('gemini_api_key');
      } catch (dbErr) {
        console.error('[URL Scraper] Failed to load DB setting:', dbErr.message);
      }

      if (!geminiApiKey || geminiApiKey.startsWith('mock-')) {
        console.warn(`[URL Scraper] AI Fallback skipped: No valid Gemini API key found.`);
        throw playwrightError;
      }

      try {
        const { getGeminiModelWithSearch } = await import('./gemini.js');
        const resilientModel = await getGeminiModelWithSearch(geminiApiKey);
        
        const prompt = `Cari informasi detail produk dari URL marketplace berikut: ${url}.
Ekstrak nama produk lengkap, rentang harga, deskripsi produk sedetail mungkin, spesifikasi teknis, dan temukan URL gambar utama produk dari indeks pencarian (biasanya berdomain susercontent.com, tokopedia.net, dll).

Kembalikan hasil dalam format JSON terstruktur saja dengan format:
{
  "title": "Nama Produk Lengkap",
  "price": "Rentang Harga",
  "description": "Deskripsi produk lengkap panjang",
  "image_url": "URL gambar utama jika ditemukan",
  "specifications": {
    "key": "value"
  }
}`;

        console.log('[URL Scraper] Calling Gemini model with Google Search Tool...');
        const result = await resilientModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        });

        const textResponse = result.response.text();
        const data = JSON.parse(textResponse);

        if (!data.title) {
          throw new Error('AI failed to resolve product title');
        }

        console.log(`[URL Scraper] ✅ AI Search Grounding fallback success! Resolved Title: "${data.title}"`);

        return {
          title: data.title,
          description: data.description || '',
          bodyText: data.description || '',
          fullText: [
            `URL: ${url}`,
            `TITLE: ${data.title}`,
            data.price ? `HARGA DITEMUKAN: ${data.price}` : '',
            data.image_url ? `GAMBAR PRODUK DITEMUKAN:\n${data.image_url}` : '',
            `\nKONTEN HALAMAN:\n${data.description || ''}`,
            data.specifications ? `\nSPESIFIKASI:\n${JSON.stringify(data.specifications, null, 2)}` : ''
          ].filter(Boolean).join('\n')
        };
      } catch (fallbackError) {
        console.error(`[URL Scraper] AI Fallback failed:`, fallbackError.message);
        throw playwrightError;
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return parseHtml(html, url);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: URL tidak merespons dalam 15 detik`);
    }
    throw new Error(`Gagal mengakses URL: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadECommerceImage(imageUrl, absolutePath) {
  let targetUrl = imageUrl;
  let isGoogleDrive = false;
  
  // Deteksi dan konversi Google Drive Link ke Direct Download
  if (imageUrl && typeof imageUrl === 'string' && (imageUrl.includes('drive.google.com') || imageUrl.includes('docs.google.com'))) {
    const fileDRegex = /(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i;
    const openIdRegex = /(?:drive|docs)\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i;
    const driveUcRegex = /(?:drive|docs)\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/i;
    
    let fileId = null;
    let match = imageUrl.match(fileDRegex);
    if (match) {
      fileId = match[1];
    } else {
      match = imageUrl.match(openIdRegex);
      if (match) {
        fileId = match[1];
      } else {
        match = imageUrl.match(driveUcRegex);
        if (match) {
          fileId = match[1];
        }
      }
    }
    
    if (fileId) {
      targetUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      isGoogleDrive = true;
      console.log(`[URL Scraper] Mengonversi Google Drive link ke Direct Download link: ${imageUrl} -> ${targetUrl}`);
    }
  }

  // Jika Google Drive, unduh langsung via fetch demi performa dan menghindari pemblokiran Playwright
  if (isGoogleDrive) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      console.log(`[URL Scraper] Mengunduh berkas Google Drive langsung dengan fetch: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(absolutePath, buffer);
      console.log(`[URL Scraper] Berhasil mengunduh gambar Google Drive ke: ${absolutePath}`);
      return true;
    } catch (err) {
      console.error(`[URL Scraper] Gagal fetch langsung Google Drive, fallback ke Playwright:`, err.message);
    }
  }

  const { downloadImagePlaywright } = await import('./playwright-scraper.js');
  return await downloadImagePlaywright(targetUrl, absolutePath);
}



function extractImageHash(url) {
  if (!url || typeof url !== 'string') return '';
  const clean = url.replace(/\\/g, '').split('?')[0];
  // 1. Tokopedia tos-alisg-i-.../hash~tplv...
  const mTokopedia = clean.match(/\/([a-f0-9]{32})(?:~|\.|\?|$)/i);
  if (mTokopedia) return mTokopedia[1].toLowerCase();

  // 2. Shopee susercontent /file/id-...
  const mShopee = clean.match(/\/file\/([a-z0-9_-]+?)(?:_tn|\.|\?|$)/i);
  if (mShopee) return mShopee[1].toLowerCase();

  // 3. Fallback: ambil nama file dasar tanpa query/ekstensi
  const parts = clean.split('/');
  const lastPart = parts[parts.length - 1] || clean;
  return lastPart.replace(/\.[^.]+$/, '').toLowerCase();
}

function estimateResolutionScore(url, w = 0, h = 0) {
  if (w > 0 && h > 0) return w * h;
  if (!url || typeof url !== 'string') return 0;
  // Contoh: :1600:1600 atau :1200:0 atau cache/700/
  const mDim = url.match(/[:_](\d{3,4})[:x](\d{3,4})/);
  if (mDim) {
    const rw = parseInt(mDim[1], 10);
    const rh = parseInt(mDim[2], 10);
    if (rw > 0 && rh > 0) return rw * rh;
    if (rw > 0) return rw * rw;
  }
  const mSingle = url.match(/(?:cache\/|resize-[a-z]+:)(\d{3,4})/i);
  if (mSingle) {
    const r = parseInt(mSingle[1], 10);
    if (r > 0) return r * r;
  }
  if (url.includes('_tn')) return 100 * 100;
  return 300 * 300;
}

/**
 * Parse HTML and extract meaningful text content and product image candidates
 */
export function parseHtml(html, url, domImages = []) {
  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : '';

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
    || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
  const description = metaDescMatch ? cleanText(metaDescMatch[1]) : '';

  // Extract OG description as fallback
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
  const ogDescription = ogDescMatch ? cleanText(ogDescMatch[1]) : '';

  // Extract OG image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i)
    || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:image["']/i);
  const ogImage = ogImageMatch ? cleanText(ogImageMatch[1]) : '';

  // Extract price info (common e-commerce patterns)
  const priceMatches = html.match(/(?:Rp|IDR|price|harga)[^<]*?[\d.,]+/gi) || [];
  const prices = priceMatches.slice(0, 5).map(p => cleanText(p));

  // Extract image candidate URLs from DOM, OG, and CDN regex
  const imageCandidateMap = new Map();

  const addCandidate = (imgUrl, { w = 0, h = 0, alt = '', source = 'regex' } = {}) => {
    if (!imgUrl || typeof imgUrl !== 'string') return;
    const cleanUrl = imgUrl.replace(/\\/g, '').replace(/[.,;:]$/, '').trim();
    if (!isValidProductImageUrl(cleanUrl)) return;
    const lower = cleanUrl.toLowerCase();
    if (lower.includes('favicon') || lower.includes('/icon_') || lower.includes('/avatar/') ||
        lower.includes('assets-tokopedia-lite') || lower.includes('assets-unify') ||
        lower.includes('il-error') || lower.includes('icon144') || lower.includes('icon192') || lower.includes('icon512')) return;
    if (cleanUrl.match(/\.(?:js|css|woff2?|ttf|svg|json|map)(?:[?#]|$)/i)) return;

    const hash = extractImageHash(cleanUrl);
    const score = estimateResolutionScore(cleanUrl, w, h);

    if (imageCandidateMap.has(hash)) {
      const existing = imageCandidateMap.get(hash);
      if (score > existing.score) {
        existing.url = cleanUrl;
        existing.w = w || existing.w;
        existing.h = h || existing.h;
        existing.score = score;
      }
      if (!existing.alt && alt) existing.alt = alt;
    } else {
      imageCandidateMap.set(hash, {
        url: cleanUrl,
        w: w || 0,
        h: h || 0,
        alt: (alt || '').slice(0, 120),
        source,
        score
      });
    }
  };

  // 1. Masukkan domImages (prioritas tertinggi dari render browser)
  if (Array.isArray(domImages)) {
    for (const d of domImages) {
      if (d?.src) addCandidate(d.src, { w: d.w, h: d.h, alt: d.alt, source: 'dom' });
    }
  }

  // 2. Masukkan og:image
  if (ogImage) {
    addCandidate(ogImage, { source: 'og', alt: title || '' });
  }

  // 3. Masukkan regex CDN matches (S3: decode &amp; -> &)
  const cdnRegex = /(https:\/\/(?:images\.tokopedia\.net|ecs7\.tokopedia\.net|[a-z0-9-]+\.tokopedia-static\.net|cf\.shopee\.co\.id|down-[a-z0-9-]+\.img\.susercontent\.com)[^\s"'<>\\}]*)/gi;
  let match;
  while ((match = cdnRegex.exec(html)) !== null) {
    let imgUrl = match[1].replace(/&amp;/g, '&');
    addCandidate(imgUrl, { source: 'regex' });
  }

  const imageCandidates = Array.from(imageCandidateMap.values())
    .slice(0, 10)
    .map(({ url, w, h, alt, source }) => ({ url, w, h, alt, source }));

  const imgUrls = imageCandidates.map(c => c.url);

  // Remove unwanted elements
  let bodyHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Extract body content
  const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : bodyHtml;

  // Strip all HTML tags and get text
  const bodyText = cleanText(
    bodyContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  // Truncate to reasonable size (max ~8000 chars for Gemini context)
  const truncatedBody = bodyText.length > 8000
    ? bodyText.substring(0, 8000) + '\n\n[... konten terpotong karena terlalu panjang ...]'
    : bodyText;

  // Compose full text for Gemini
  const fullText = [
    `URL: ${url}`,
    title ? `TITLE: ${title}` : '',
    description ? `META DESCRIPTION: ${description}` : '',
    ogDescription && ogDescription !== description ? `OG DESCRIPTION: ${ogDescription}` : '',
    prices.length > 0 ? `HARGA DITEMUKAN: ${prices.join(' | ')}` : '',
    imgUrls.length > 0 ? `GAMBAR PRODUK DITEMUKAN:\n${imgUrls.join('\n')}` : '',
    `\nKONTEN HALAMAN:\n${truncatedBody}`,
  ].filter(Boolean).join('\n');

  return {
    title,
    description: description || ogDescription,
    bodyText: truncatedBody,
    fullText,
    imageCandidates
  };
}

/**
 * Clean text: strip tags, normalize whitespace
 */
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
