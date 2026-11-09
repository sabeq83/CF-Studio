# Rencana Implementasi: Perbaikan Duplikasi Info Bahan/Produk & Hashtag Ganda pada Autopipeline & Multiplier Lab

> [!NOTE]
> Rencana implementasi ini dirancang untuk menuntaskan akar masalah terjadinya **2 blok Info Bahan/Produk** dan **hashtag ganda** pada postingan media sosial (Instagram, TikTok, YouTube, Facebook) yang dihasilkan oleh Auto Pipeline Multiplier Lab.

---

## Ringkasan Eksekutif & Akar Masalah

Berdasarkan investigasi pada data riil task `mul_261109_5jhvm0` dan analisis alur kode `lib/smart-affiliate-package-builder.js` serta `lib/re-multiplier-worker.js`:

1. **Akar Masalah 1 (Pilihan AI vs Fallback Backend)**:
   - Gemini AI memilih produk **"Monggo Dark Chocolate"** yang selaras dengan resep mousse cokelat dan merangkai CTA bio di dalam naskah `caption`.
   - Di database produk, `Monggo Dark Chocolate` memiliki `affiliate_link: null`.
   - Backend kemudian menjalankan fallback keyword matcher (`selectBestProductMatch`) pada judul kampanye *"Trik Sulap **Telur** Rebus..."*, yang secara keliru mencocokkan kata *"Telur"* ke produk **"Pembersih Kocokan Telur Serbaguna"** (karena memiliki link Shopee).
2. **Akar Masalah 2 (Penumpukan CTA / Appending Flaw)**:
   - Fungsi `normalizeSocialMediaPackage` mengevaluasi `if (!captionBio || captionBio === baseCaption)`. Karena Gemini menyamakan `caption_bio` dengan `baseCaption`, kondisi ini bernilai `true`.
   - Sistem berasumsi bahwa CTA bio belum ada, lalu menempelkan (`append`) blok CTA produk kedua (*Pembersih Kocokan Telur*) beserta deretan hashtag untuk kedua kalinya di bawah `baseCaption` yang sudah memuat CTA produk pertama (*Monggo Dark Chocolate*).
3. **Akar Masalah 3 (Ketidaksesuaian Link Facebook)**:
   - Pada Facebook, teks menyebut *Monggo Dark Chocolate*, tetapi link Shopee yang disisipkan berasal dari *Pembersih Kocokan Telur Serbaguna*.

---

## Execution Task List
- [x] **Task 1: Tambahkan Helper Sanitasi `stripCtaAndHashtags` pada `lib/smart-affiliate-package-builder.js`** untuk membersihkan CTA lama dan trailing hashtags sebelum proses adaptasi platform.
- [x] **Task 2: Refaktorisasi `buildPlatformAdaptiveCaptions` pada `lib/smart-affiliate-package-builder.js`** agar tidak menumpuk CTA dan menyematkan hashtag tepat satu kali di posisi akhir.
- [x] **Task 3: Perbaiki `normalizeSocialMediaPackage` pada `lib/smart-affiliate-package-builder.js`** agar selalu menggunakan naskah bersih, menyelaraskan produk terpilih, dan mengeliminasi bug duplikasi Bio CTA.
- [x] **Task 4: Filter Etalase Produk Ber-link Valid pada `buildAffiliatePromptInstruction` (`lib/smart-affiliate-package-builder.js`)** dan tegaskan aturan naskah universal bebas CTA/hashtag pada prompt Gemini.
- [x] **Task 5: Sinkronkan Produk Pilihan AI (`selected_product_id` / `selected_product_name`) pada `lib/re-multiplier-worker.js`** sebelum fallback ke keyword matcher.
- [x] **Task 6: Buat Unit Test Suite Khusus Anti-Duplikasi Caption & Smart Affiliate** (`tests/test-affiliate-caption-deduplication.test.js`).
- [x] **Task 7: Jalankan Uji Verifikasi Otomatis, Build Check Lokal, dan SOP Rilis Non-Interaktif**.

---

## Before & After Code Snippets

### 1. `lib/smart-affiliate-package-builder.js` — Penambahan Helper `stripCtaAndHashtags` & Sanitasi Caption

#### Code Sebelum (Current/Before):
```javascript
export function buildPlatformAdaptiveCaptions({ baseCaption = '', hashtags = [], matchedProduct = null, brandName = '' }) {
  let cleanCaption = String(baseCaption || '').trim();

  // Bersihkan jika caption sudah memiliki placeholder atau link s.shopee
  cleanCaption = cleanCaption
    .replace(/https?:\/\/s\.shopee\.co\.id\/\S+/gi, '')
    .replace(/\{\{AFFILIATE_LINK\}\}/g, '')
    .trim();

  const formattedTags = Array.isArray(hashtags) && hashtags.length > 0
    ? hashtags.map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`)
    : [];
  const tagsStr = formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : '';
```

#### Code Sesudah (Proposed/After):
```javascript
/**
 * Membersihkan blok CTA (Bio CTA & Shopee Link) serta trailing hashtags yang mungkin sudah ada di dalam naskah
 * agar tidak terjadi duplikasi saat proses adaptasi platform.
 * @param {string} caption
 * @returns {string}
 */
export function stripCtaAndHashtags(caption) {
  if (!caption) return '';
  let cleaned = String(caption).trim();

  // 1. Bersihkan blok CTA Info Bahan / Produk (Bio CTA)
  cleaned = cleaned.replace(/(?:\r?\n)*👉\s*Info\s*(?:Bahan|Produk|Bahan\/Produk)?[\s\S]*?(?=(?:\r?\n\s*#|$))/gi, '');

  // 2. Bersihkan blok CTA Rekomendasi Resmi Shopee
  cleaned = cleaned.replace(/(?:\r?\n)*🛒\s*Rekomendasi\s*(?:Bahan|Produk|Bahan\/Produk)?\s*Resmi:[\s\S]*?(?=(?:\r?\n\s*#|$))/gi, '');

  // 3. Bersihkan sisa link shopee atau {{AFFILIATE_LINK}}
  cleaned = cleaned.replace(/https?:\/\/s\.shopee\.co\.id\/\S+/gi, '');
  cleaned = cleaned.replace(/\{\{AFFILIATE_LINK\}\}/g, '');

  // 4. Bersihkan deretan hashtag yang menempel di akhir caption
  cleaned = cleaned.replace(/(?:\r?\n|\s)*(?:#[a-zA-Z0-9_\u00c0-\u00ff]+\s*)+$/g, '');

  return cleaned.trim();
}

export function buildPlatformAdaptiveCaptions({ baseCaption = '', hashtags = [], matchedProduct = null, brandName = '' }) {
  const cleanCaption = stripCtaAndHashtags(baseCaption);

  const formattedTags = Array.isArray(hashtags) && hashtags.length > 0
    ? hashtags.map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`)
    : [];
  const tagsStr = formattedTags.length > 0 ? '\n\n' + formattedTags.join(' ') : '';
```

---

### 2. `lib/smart-affiliate-package-builder.js` — Filter Produk Ber-link Valid pada Prompt Gemini

#### Code Sebelum (Current/Before):
```javascript
export function buildAffiliatePromptInstruction({ brandProducts = [], selectedProductId = null, isAffiliateEnabled = true }) {
  if (!isAffiliateEnabled || !Array.isArray(brandProducts) || brandProducts.length === 0) {
    return `
ATURAN SOCIAL MEDIA PACKAGE & AFFILIATE:
- Konten ini berstatus Murni Edukasi / Non-Afiliasi.
- Pada objek "social_media_package", hasilkan "caption" universal yang bersih, bernilai edukatif, dan diakhiri hashtags relevan. DILARANG mencantumkan link penjualan.
`;
  }

  // Siapkan daftar etalase produk brand (maks 10 produk untuk efisiensi token)
  let candidateProducts = brandProducts;
```

#### Code Sesudah (Proposed/After):
```javascript
export function buildAffiliatePromptInstruction({ brandProducts = [], selectedProductId = null, isAffiliateEnabled = true }) {
  // Hanya operkan produk yang memiliki affiliate_link aktif dan terisi ke dalam prompt AI
  const activeAffiliateProducts = (brandProducts || []).filter(p => p.affiliate_link && String(p.affiliate_link).trim() !== '');

  if (!isAffiliateEnabled || activeAffiliateProducts.length === 0) {
    return `
ATURAN SOCIAL MEDIA PACKAGE & AFFILIATE:
- Konten ini berstatus Murni Edukasi / Non-Afiliasi (atau belum ada produk ber-link Shopee terverifikasi).
- Pada objek "social_media_package", hasilkan "caption" universal yang bersih, bernilai edukatif, dan diakhiri hashtags relevan. DILARANG mencantumkan link penjualan.
`;
  }

  // Siapkan daftar etalase produk brand (maks 10 produk untuk efisiensi token)
  let candidateProducts = activeAffiliateProducts;
```

---

### 3. `lib/smart-affiliate-package-builder.js` — Normalisasi Bebas Duplikasi pada `normalizeSocialMediaPackage`

#### Code Sebelum (Current/Before):
```javascript
export function normalizeSocialMediaPackage(rawSocialPackage = {}, matchedProduct = null) {
  if (!rawSocialPackage || typeof rawSocialPackage !== 'object') {
    rawSocialPackage = {};
  }

  const baseCaption = rawSocialPackage.caption || rawSocialPackage.caption_universal || '';
  const hashtags = Array.isArray(rawSocialPackage.hashtags) ? rawSocialPackage.hashtags : [];

  let captionFb = rawSocialPackage.caption_facebook || '';
  let captionBio = rawSocialPackage.caption_bio || '';

  if (matchedProduct && matchedProduct.affiliate_link) {
    if (captionFb.includes('{{AFFILIATE_LINK}}')) {
      captionFb = captionFb.replace(/\{\{AFFILIATE_LINK\}\}/g, matchedProduct.affiliate_link);
    } else if (!captionFb || captionFb === baseCaption) {
      const adapted = buildPlatformAdaptiveCaptions({
        baseCaption,
        hashtags,
        matchedProduct
      });
      captionFb = adapted.caption_facebook;
      captionBio = adapted.caption_bio;
    }

    if (!captionBio || captionBio === baseCaption) {
      const pName = matchedProduct.product_name || 'Bahan/Produk Rekomendasi';
      const bioCta = `\n\n👉 Info Bahan/Produk:\nBahan & produk rekomendasi (${pName}) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨`;
      const tagsStr = hashtags.length > 0 ? '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
      captionBio = `${baseCaption.trim()}${bioCta}${tagsStr}`;
    }
  } else {
    captionFb = baseCaption;
    captionBio = baseCaption;
  }
```

#### Code Sesudah (Proposed/After):
```javascript
export function normalizeSocialMediaPackage(rawSocialPackage = {}, matchedProduct = null) {
  if (!rawSocialPackage || typeof rawSocialPackage !== 'object') {
    rawSocialPackage = {};
  }

  const baseCaption = rawSocialPackage.caption || rawSocialPackage.caption_universal || '';
  const hashtags = Array.isArray(rawSocialPackage.hashtags) ? rawSocialPackage.hashtags : [];

  // Jika matchedProduct tersedia dan memiliki link Shopee
  if (matchedProduct && matchedProduct.affiliate_link) {
    const pName = matchedProduct.product_name || 'Bahan/Produk Rekomendasi';
    const affLink = matchedProduct.affiliate_link.trim();

    // Selalu bangun platform-adaptive captions secara bersih dan bebas duplikasi
    const adapted = buildPlatformAdaptiveCaptions({
      baseCaption,
      hashtags,
      matchedProduct
    });

    let captionFb = rawSocialPackage.caption_facebook || '';
    if (captionFb && captionFb.includes('{{AFFILIATE_LINK}}')) {
      captionFb = captionFb.replace(/\{\{AFFILIATE_LINK\}\}/g, affLink);
    } else {
      captionFb = adapted.caption_facebook;
    }

    return {
      title: rawSocialPackage.title || '',
      caption: stripCtaAndHashtags(baseCaption),
      caption_facebook: captionFb,
      caption_bio: adapted.caption_bio,
      caption_universal: adapted.caption_universal,
      hashtags: adapted.hashtags,
      matched_product: {
        product_id: matchedProduct.product_id,
        product_name: pName,
        affiliate_link: affLink,
        brand_profile_id: matchedProduct.brand_profile_id || null
      }
    };
  }

  // Non-affiliate / tanpa produk affiliate
  const cleanBase = stripCtaAndHashtags(baseCaption);
  const formattedTags = hashtags.length > 0 ? '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : '';
  const unified = cleanBase + formattedTags;

  return {
    title: rawSocialPackage.title || '',
    caption: cleanBase,
    caption_facebook: rawSocialPackage.caption_facebook ? stripCtaAndHashtags(rawSocialPackage.caption_facebook) + formattedTags : unified,
    caption_bio: rawSocialPackage.caption_bio ? stripCtaAndHashtags(rawSocialPackage.caption_bio) + formattedTags : unified,
    caption_universal: unified,
    hashtags,
    matched_product: null
  };
}
```

---

### 4. `lib/re-multiplier-worker.js` — Sinkronisasi Produk Pilihan AI Sebelum Fallback

#### Code Sebelum (Current/Before):
```javascript
    // 2. Smart Fallback: Jika non-bridging video (target_product_id null), cari produk brand via selectBestProductMatch!
    if (!matchedProduct && isAffiliateEnabled && Array.isArray(brandProductsList) && brandProductsList.length > 0) {
      const topicForMatching = task.campaign_name || parsed.title || parsed.yt_title || '';
      matchedProduct = selectBestProductMatch({
        products: brandProductsList,
        topic: topicForMatching
      });
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    // 2. Sinkronkan dengan Pilihan AI (selected_product_id / selected_product_name)
    if (!matchedProduct && isAffiliateEnabled && Array.isArray(brandProductsList) && brandProductsList.length > 0) {
      const aiPkg = parsed.social_media_package || {};
      const aiSelectedId = aiPkg.selected_product_id;
      const aiSelectedName = aiPkg.selected_product_name;

      if (aiSelectedId || aiSelectedName) {
        const found = brandProductsList.find(p =>
          (aiSelectedId && (p.product_id === aiSelectedId || p.brand_product_id === aiSelectedId)) ||
          (aiSelectedName && String(p.product_name || '').toLowerCase() === String(aiSelectedName).toLowerCase())
        );
        if (found && found.affiliate_link) {
          matchedProduct = {
            product_id: found.product_id,
            product_name: found.product_name,
            affiliate_link: found.affiliate_link
          };
        }
      }

      // 3. Smart Fallback: hanya jika AI tidak memilih produk ber-link valid
      if (!matchedProduct) {
        const topicForMatching = task.campaign_name || parsed.title || parsed.yt_title || '';
        matchedProduct = selectBestProductMatch({
          products: brandProductsList.filter(p => p.affiliate_link && String(p.affiliate_link).trim() !== ''),
          topic: topicForMatching
        });
      }
    }
```

---

## SOP Verifikasi & Rilis Non-Interaktif

1. **Uji Otomatis Unit Test**:
   - Jalankan `node --test tests/test-affiliate-caption-deduplication.test.js` dan seluruh test affiliate terkait.
2. **Uji Build Lokal**:
   - Pastikan kompilasi Next.js lokal bersih tanpa error (`npm run build`).
3. **Eksekusi Rilis Otomatis**:
   - Jalankan rilis non-interaktif sesuai SOP:
     ```bash
     npm run release-non-interactive -- --type patch --title "Fix Caption Duplication & AI Affiliate Sync in Autopipeline" --points "Sanitasi stripCtaAndHashtags anti-duplikasi|Filter produk ber-link aktif pada prompt AI|Sinkronisasi produk pilihan AI di Multiplier Worker"
     ```
