# Implementation Plan: Perbaikan Scraper Foto Produk (Pilih Foto Produk Saja)

Tanggal: 16 Nov 2026 · Versi: 1 · Eksekutor: Antigravity · Reviewer: Pengguna
Dasar: `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md`
Instruksi: `antigravity_scraper_foto_produk_instructions.md`

---

## 1. Tujuan & Ruang Lingkup

Memperbaiki alur scraper produk (`cf_scrape_product_url` -> job `product_scraper`) agar:
1. Mengumpulkan foto galeri lengkap dari DOM dan CDN baru Tokopedia (`*.tokopedia-static.net`).
2. Memilih foto produk terbaik via Gemini Vision (1x multi-image call), menolak foto berwajah/manusia, infografis, dan teks promo tebal.
3. Selalu menjalankan AI Spatial Smart Cropping untuk produk baru dan mode `refresh_photo`.
4. Menyediakan flag `refresh_photo` pada API dan MCP untuk memperbarui foto produk yang sudah ada tanpa menimpa metadata / link afiliasi.
5. Melakukan verifikasi akhir (P4) sebelum status `approved`; jika memuat manusia/teks, diberi status `needs_review` dan `photo_error`.
6. Memperbaiki format base64 data URI pada G-Labs Generative Polish (P5) dan melewati polish jika foto `needs_review`.
7. Mengembalikan `job_ids` dan `product_id` dari endpoint scrape (P6).

**Batas kerja**: Hanya alur scraper produk. Tidak mengubah alur OPC, RE, Multiplier, Recipe, finishing, atau publishing. Tidak deploy/rilis tanpa persetujuan eksplisit pengguna.

---

## 2. Execution Task List

### P1. Pengumpulan Foto Galeri (DOM + Regex Cadangan)
- [x] Tambahkan ekstraksi gambar galeri DOM pada `lib/playwright-scraper.js` (`scrapeUrlPlaywright`).
- [x] Perbarui `cdnRegex` di `lib/url-scraper.js` untuk mendukung `[a-z0-9-]+\.tokopedia-static\.net`.
- [x] Implementasikan penggabungan, dedup hash ukuran, dan return `imageCandidates` di `parseHtml()`.
- [x] Teruskan `result.images` dari Playwright ke `parseHtml()` di `scrapeUrl()`.
- [x] Export named `parseHtml` di `lib/url-scraper.js`.
- [x] Buat fixture `tests/fixtures/tokopedia_product_2026.html` dan unit test `tests/url-scraper-tokopedia-images.test.js`.

### P2. Pemilihan Foto dengan Gemini Vision
- [x] Buat modul baru `lib/product-photo-picker.js` berisi fungsi `pickBestProductPhoto`, `evaluateCandidateScores`, dan aturan filter non-person/non-infographic.
- [x] Hubungkan `pickBestProductPhoto` ke `processProductScraper` di `lib/scheduler-processors.js` sebelum tahap download raw.
- [x] Ubah schema ekstraksi teks di `lib/scheduler-processors.js` agar `scraped_image_url` bersifat opsional (hapus dari `required`).
- [x] Simpan ringkasan penilaian ke `raw_response` dan log job.
- [x] Buat unit test `tests/product-photo-picker.test.js` (dengan mock Gemini vision).

### P3. Smart Crop Selalu untuk Produk Baru & Prompt Anti-Model
- [x] Pisahkan logika crop dari `repairMode`: `runSpatialCrop = !scrapedItem.isRepair || payload?.refresh_photo === true || !budgetMode;`.
- [x] Perbarui prompt crop agar mengecualikan manusia/wajah/tangan/teks.

### P3b. Flag `refresh_photo` untuk Produk yang Sudah Ada
- [x] Terima `refresh_photo` di `app/api/v2/products/scrape/route.js` dan teruskan ke antrean job.
- [x] Di `processProductScraper`, jika `refresh_photo === true`, abaikan `canSkipScrape`, set `needsRaw = needsClean = needsStudio = true`, dan update hanya kolom foto tanpa menimpa metadata.
- [x] Tambahkan parameter `refresh_photo` di MCP tool `cf_scrape_product_url` pada `apps/mcp/tools.mjs`.

### P4. Pemeriksa Akhir Foto Bersih (Status `needs_review`)
- [x] Buat fungsi `verifyCleanProductShot` dan `decidePhotoStatus` di `lib/product-photo-picker.js`.
- [x] Panggil setelah `createCleanProductShot` di `lib/scheduler-processors.js`.
- [x] Set `photo_status` dan `photo_error` pada objek penyimpanan produk (`createProductExtraction` & `updateProductExtraction`).

### P5. Perbaikan Format Reference G-Labs
- [x] Bungkus base64 menjadi Data URI valid menggunakan `bufferToBase64DataUrl` dari `lib/base64-image-reference.js`.
- [x] Lewati G-Labs polish jika `photo_status === 'needs_review'`.
- [x] Tambahkan unit test di `tests/base64-image-reference.test.js` jika diperlukan.

### P6. Pengembalian `job_id` dan `product_id` (Opsional)
- [x] Update response `app/api/v2/products/scrape/route.js` untuk menyertakan `job_ids` dan `product_id`.

### Pengujian Lokal & Dry-Run
- [x] Buat skrip dry-run `scripts/test-scraper-photo-pick.mjs`.
- [x] Uji dry-run produk Habarlic (harus memilih foto produk botol+kotak tanpa orang).
- [x] Uji dry-run produk Laxing (foto kontrol tidak memburuk).
- [x] Uji dry-run produk berwajah/model (status `needs_review`).
- [x] Jalankan seluruh unit test (`node --test tests/url-scraper-tokopedia-images.test.js tests/product-photo-picker.test.js tests/base64-image-reference.test.js`).
- [x] Jalankan `npm run build` lokal.
- [x] **STOP & LAPORKAN**: Jangan rilis/deploy sebelum persetujuan eksplisit pengguna.

---

## 3. Code Sebelum & Sesudah

### 3.1 `lib/playwright-scraper.js`

#### Code Sebelum:
```js
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    await page.close(); // Close only the page
    
    if (!isCDP) {
      await browserOrContext.close(); // Close the persistent context (browser closes)
    }
    
    return { title, html, bodyText };
```

#### Code Sesudah:
```js
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);

    const images = await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      const imgs = Array.from(document.querySelectorAll('img'));
      // Sort gallery media alt first
      imgs.sort((a, b) => {
        const aAlt = (a.alt || '').toLowerCase();
        const bAlt = (b.alt || '').toLowerCase();
        const aScore = aAlt.startsWith('product detail media') || aAlt.startsWith('gambar ') ? 1 : 0;
        const bScore = bAlt.startsWith('product detail media') || bAlt.startsWith('gambar ') ? 1 : 0;
        return bScore - aScore;
      });

      for (const img of imgs) {
        const src = img.currentSrc || img.src;
        if (!src || !src.startsWith('http') || seen.has(src)) continue;
        if ((img.naturalWidth || 0) < 300) continue;
        seen.add(src);
        out.push({
          src,
          w: img.naturalWidth,
          h: img.naturalHeight,
          alt: (img.alt || '').slice(0, 120)
        });
        if (out.length >= 10) break;
      }
      return out;
    });
    
    await page.close(); // Close only the page
    
    if (!isCDP) {
      await browserOrContext.close(); // Close the persistent context (browser closes)
    }
    
    return { title, html, bodyText, images };
```

---

### 3.2 `lib/url-scraper.js`

#### Code Sebelum:
```js
function parseHtml(html, url) {
...
  const cdnRegex = /(https:\/\/(?:images\.tokopedia\.net|cf\.shopee\.co\.id|down-id-id\.img\.susercontent\.com|down-id\.img\.susercontent\.com|down-tx-id\.img\.susercontent\.com|ecs7\.tokopedia\.net)[^\s"'<>\\}]*)/gi;
  let match;
  while ((match = cdnRegex.exec(html)) !== null) {
    let imgUrl = match[1];
    imgUrl = imgUrl.replace(/\\/g, '');
    imgUrl = imgUrl.replace(/[.,;:]$/, '');
    if (!seen.has(imgUrl) && imgUrls.length < 20) {
      imgUrls.push(imgUrl);
      seen.add(imgUrl);
    }
  }
...
  return {
    title,
    description: description || ogDescription,
    bodyText: truncatedBody,
    fullText,
  };
}
```

#### Code Sesudah:
```js
export function parseHtml(html, url, domImages = []) {
...
  const cdnRegex = /(https:\/\/(?:images\.tokopedia\.net|ecs7\.tokopedia\.net|[a-z0-9-]+\.tokopedia-static\.net|cf\.shopee\.co\.id|down-[a-z0-9-]+\.img\.susercontent\.com)[^\s"'<>\\}]*)/gi;
...
  // Deduping and prioritizing DOM images, OG image, and CDN regex
  const imageCandidates = [];
  const seenHashes = new Map(); // hash -> candidate

  function extractImageHash(u) {
    const m = u.match(/\/([a-f0-9]{32})(?:~|\.|\?|$)/i);
    return m ? m[1].toLowerCase() : u.split('?')[0];
  }
  ...
  return {
    title,
    description: description || ogDescription,
    bodyText: truncatedBody,
    fullText,
    imageCandidates
  };
}
```

---

### 3.3 `lib/scheduler-processors.js`

#### Code Sebelum:
```js
const runSpatialCrop = !repairMode;
if (runSpatialCrop) {
  const cropPrompt = `Analyze this product photo. There might be multiple variants of the same product. Identify the SINGLE most prominent, clear, and center-focused product item. Return the bounding box coordinates [ymin, xmin, ymax, xmax] for only that ONE item. Return coordinates as normalized integers from 0 to 1000 representing [ymin, xmin, ymax, xmax]. For example, [0, 0, 1000, 1000] would be the entire image.`;
  ...
}

// G-Labs Polish
const cleanedBase64 = fs.readFileSync(cleanedAbsPath).toString('base64');
const glabsResult = await generateGlabsImage({
  prompt: productData.t2i_prompt,
  model: 'nano_banana_pro',
  aspect_ratio: '9:16',
  reference_images: [cleanedBase64]
});
```

#### Code Sesudah:
```js
const budgetMode = payload?.budget_mode === true;
const runSpatialCrop = !scrapedItem.isRepair || payload?.refresh_photo === true || !budgetMode;
if (runSpatialCrop) {
  const cropPrompt = `Analyze this product photo. There might be multiple variants of the same product. Box the product package only. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product. Return the bounding box coordinates [ymin, xmin, ymax, xmax] for only that ONE item. Return coordinates as normalized integers from 0 to 1000 representing [ymin, xmin, ymax, xmax]. For example, [0, 0, 1000, 1000] would be the entire image.`;
  ...
}

// G-Labs Polish
if (photoStatus !== 'needs_review') {
  const { bufferToBase64DataUrl } = await import('./base64-image-reference.js');
  const cleanedDataUrl = bufferToBase64DataUrl(fs.readFileSync(cleanedAbsPath), cleanedAbsPath);
  const glabsResult = await generateGlabsImage({
    prompt: productData.t2i_prompt,
    model: 'nano_banana_pro',
    aspect_ratio: '9:16',
    reference_images: [cleanedDataUrl]
  });
}
```

---

### 3.4 `app/api/v2/products/scrape/route.js`

#### Code Sebelum:
```js
    const body = await req.json();
    const { urls, csv_data, category, tags, repair_mode = true } = body;
...
    for (let i = 0; i < urlsToScrape.length; i += batchSize) {
      const chunk = urlsToScrape.slice(i, i + batchSize);
      await createJob('product_scraper', { 
        urls: chunk, 
        category, 
        tags, 
        url_affiliates_map: urlAffiliatesMap, 
        repair_mode 
      });
      enqueuedCount += chunk.length;
    }
```

#### Code Sesudah:
```js
    const body = await req.json();
    const { urls, csv_data, category, tags, repair_mode = true, refresh_photo = false } = body;
...
    if (refresh_photo && existing) {
      urlsToScrape.push(url);
      repairCount++;
    }
...
    const jobIds = [];
    for (let i = 0; i < urlsToScrape.length; i += batchSize) {
      const chunk = urlsToScrape.slice(i, i + batchSize);
      const j = await createJob('product_scraper', { 
        urls: chunk, 
        category, 
        tags, 
        url_affiliates_map: urlAffiliatesMap, 
        repair_mode,
        refresh_photo: Boolean(refresh_photo)
      });
      if (j?.id) jobIds.push(j.id);
      enqueuedCount += chunk.length;
    }
...
    return NextResponse.json({ 
      success: true, 
      message, 
      enqueued_count: enqueuedCount,
      job_ids: jobIds,
      product_id: singleTargetProductId || undefined,
      ...
    });
```

---

### 3.5 `apps/mcp/tools.mjs`

#### Code Sebelum:
```js
  register(
    'cf_scrape_product_url',
    'Scrape product specifications and images from an e-commerce or product URL.',
    {
      url: z.string().url(),
      category: z.string().max(100).optional(),
      tags: z.string().max(500).optional()
    },
    false,
    ({ url, ...args }) => request('/api/v2/products/scrape', { body: { urls: url, ...args } })
  );
```

#### Code Sesudah:
```js
  register(
    'cf_scrape_product_url',
    'Scrape product specifications and images from an e-commerce or product URL.',
    {
      url: z.string().url(),
      category: z.string().max(100).optional(),
      tags: z.string().max(500).optional(),
      refresh_photo: z.boolean().optional()
    },
    false,
    ({ url, ...args }) => request('/api/v2/products/scrape', { body: { urls: url, ...args } })
  );
```
