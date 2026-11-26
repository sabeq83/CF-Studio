# Implementation Plan: Halaman Publik Katalog Link Affiliate (`/aff`)

**Sumber Usulan:** [USULAN_HALAMAN_KATALOG_LINK_AFF_PUBLIK.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_HALAMAN_KATALOG_LINK_AFF_PUBLIK.md)  
**Mockup Disetujui:** [mockup_public_affiliate_catalog.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_public_affiliate_catalog.html)  
**Target Branch Kerja:** `fitur/public-affiliate-catalog`  
**Lingkungan Uji Target:** Unit test lokal (`PG_SEARCH_PATH=dev`), `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, lalu deploy ke **Dev (`5020`/`7020`)**.

> [!NOTE]
> **Tanpa Migrasi Database:** Seluruh data berasal dari tabel PostgreSQL yang sudah ada (`product_extractions`, `brand_profiles`, `brand_products`, `tenants`). Tidak ada perubahan skema database.

---

## Execution Task List

### Tahap 0: Persiapan Branch
- [x] Buat branch fitur baru `fitur/public-affiliate-catalog` dari `main`

### Tahap 1: Mockup HTML (Disetujui Pengguna)
- [x] Buat dan revisi mockup mobile-first [public/mockup_public_affiliate_catalog.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_public_affiliate_catalog.html) (dropdown Brand Profile full-width, kotak pencarian full-width di bawah dropdown, thumbnail `64×64px`, 1 kartu = 1 brand, hanya tombol `Salin Link Aff`, semantic tokens Light/Dark mode)

### Tahap 2: Service, API Publik, & Middleware
- [x] Tambahkan helper resolusi file gambar aman di [lib/product-image-storage.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-image-storage.js) agar dapat dipakai bersama oleh endpoint produk internal dan endpoint gambar publik
- [x] Buat service katalog publik [lib/public-affiliate-catalog-service.js](file:///Users/sabeqmmursyid/_cfstudio/lib/public-affiliate-catalog-service.js) (DTO publik aman tanpa field internal, relasi 1 kartu = 1 brand dari `brand_products` aktif, isolasi `tenant_id`)
- [x] Buat API publik [app/api/public/affiliate-catalog/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/public/affiliate-catalog/route.js) dan [app/api/public/affiliate-catalog/image/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/public/affiliate-catalog/image/route.js) (serta manfaatkan helper bersama di [app/api/v2/products/image/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/image/route.js))
- [x] Daftarkan `/aff` dan `/api/public/affiliate-catalog` pada whitelist publik di [middleware.js](file:///Users/sabeqmmursyid/_cfstudio/middleware.js)

### Tahap 3: Halaman Front-End Publik `/aff`
- [x] Buat stylesheet scoped [app/aff/aff.module.css](file:///Users/sabeqmmursyid/_cfstudio/app/aff/aff.module.css) menggunakan 100% semantic CSS tokens dari `app/theme.css`
- [x] Buat komponen client [app/aff/PublicAffiliateCatalogClient.js](file:///Users/sabeqmmursyid/_cfstudio/app/aff/PublicAffiliateCatalogClient.js) dan halaman [app/aff/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/aff/page.js) tanpa `<Sidebar />`

### Tahap 4: Pengujian, Verifikasi Build, & Deploy Dev
- [x] Buat unit test [tests/public-affiliate-catalog.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/public-affiliate-catalog.test.js) dan jalankan dengan `PG_SEARCH_PATH=dev node --test tests/public-affiliate-catalog.test.js`
- [x] Jalankan build lokal `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build` dan pastikan sukses tanpa error
- [x] Commit dan push branch `fitur/public-affiliate-catalog`, lalu deploy ke **Dev (`5020`/`7020`)** dan verifikasi akses publik tanpa login

---

## Rincian Perubahan Kode (Before & After Code Snippets)

### 1. `middleware.js`

**Code Sebelum (Current/Before):**
```js
  // Allow public static assets, public landing pages, legal pages, and auth API endpoints
  if (
    pathname === '/' ||
    pathname === '/home' ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
```

**Code Sesudah (Proposed/After):**
```js
  // Allow public static assets, public landing pages, legal pages, and auth API endpoints
  if (
    pathname === '/' ||
    pathname === '/home' ||
    pathname === '/aff' ||
    pathname.startsWith('/aff/') ||
    pathname.startsWith('/api/public/affiliate-catalog') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
```

### 2. `lib/product-image-storage.js`

**Code Sebelum (Current/Before):**
```js
export function readLocalImageToBuffer(relativePath) {
  if (!relativePath) return null;
  // Ensure it doesn't try to read outside public directory
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const absolutePath = path.join(process.cwd(), 'public', cleanPath);
  
  // Basic security check
  if (!absolutePath.startsWith(path.join(process.cwd(), 'public'))) return null;
  
  try {
    if (fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath);
    }
  } catch (e) {
    // Ignore
  }
  return null;
}
```

**Code Sesudah (Proposed/After):**
```js
export const BASE_PRODUCTS_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');

/**
 * Validasi dan sanitasi path gambar di bawah public/uploads/products tanpa traversal.
 */
export function resolveSafeProductUploadFile(relativePath, { baseDir = BASE_PRODUCTS_UPLOAD_DIR } = {}) {
  if (!relativePath || typeof relativePath !== 'string') {
    return { error: 'path parameter is required', status: 400 };
  }
  const trimmed = relativePath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { error: 'External URLs are not proxied by this endpoint', status: 400 };
  }

  let cleanPath = trimmed.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
  if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice(7);
  if (cleanPath.startsWith('uploads/products/')) cleanPath = cleanPath.slice(17);

  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(path.join(resolvedBase, cleanPath));
  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    return { error: 'Unauthorized path', status: 403 };
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return { missing: true, cleanPath, resolvedPath, contentType: 'image/gif' };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentTypeMap = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  return {
    missing: false,
    cleanPath,
    resolvedPath,
    contentType: contentTypeMap[ext] || 'image/jpeg'
  };
}
```

### 3. `app/api/v2/products/image/route.js`

**Code Sebelum (Current/Before):**
```js
    // Sanitize path
    let cleanPath = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
    if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice(7);
    if (cleanPath.startsWith('uploads/products/')) cleanPath = cleanPath.slice(17);

    // Security: cek path traversal
    const resolvedPath = path.resolve(path.join(BASE_PRODUCTS_DIR, cleanPath));
    if (!resolvedPath.startsWith(BASE_PRODUCTS_DIR)) {
      return NextResponse.json({ success: false, error: 'Unauthorized path' }, { status: 403 });
    }
```

**Code Sesudah (Proposed/After):**
```js
    const resolved = resolveSafeProductUploadFile(relativePath, { baseDir: BASE_PRODUCTS_DIR });
    if (resolved.error) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    if (resolved.missing) {
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache',
          'X-Image-Missing': 'true'
        },
      });
    }
    const fileBuffer = fs.readFileSync(resolved.resolvedPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': resolved.contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
```

### 4. File Baru yang Ditambahkan
- `lib/public-affiliate-catalog-service.js`: Query publik `listPublicAffiliateCatalog()` dan sanitasi URL/path gambar per tenant (`resolvePublicThumbnailUrl()`, `isProductPhotoAllowedForTenant()`).
- `app/api/public/affiliate-catalog/route.js`: Handler `GET` publik untuk daftar brand dan item produk (1 item = 1 relasi produk-brand).
- `app/api/public/affiliate-catalog/image/route.js`: Handler `GET` publik read-only untuk menyajikan thumbnail produk milik tenant publik secara aman.
- `app/aff/page.js`, `app/aff/PublicAffiliateCatalogClient.js`, `app/aff/aff.module.css`: Halaman mobile-first tanpa login sesuai mockup yang disetujui.
- `tests/public-affiliate-catalog.test.js`: Unit test kontrak DTO publik, pemetaan 1 kartu = 1 brand, dan keamanan path gambar.
