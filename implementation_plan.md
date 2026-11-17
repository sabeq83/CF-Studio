# Implementation Plan: Bagian B — Perbaikan Kartu Produk, Jendela Banding & Penyimpanan Foto Sebelumnya (B1–B6)

> Referensi tugas: [antigravity_kartu_produk_enrich_foto_truth_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_kartu_produk_enrich_foto_truth_instructions.md)  
> Mockup disetujui: [mockup_kartu_produk_foto_enrich.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_kartu_produk_foto_enrich.html)  
> Branch aktif: `hotfix/kartu-produk-foto-enrich` (dibuat dari `main` @ `82c21ff`)

## Ringkasan Tujuan

1. **B1 — Tombol Enrich AI di Kartu Produk**: Mengembalikan tombol `🧠 Enrich AI` / `Enriching…` (spinner) / `🧠 Coba lagi` (ketika `enrichment_status === 'failed'` & `enrichment_retryable === true`) yang memanggil `handleReEnrichProduct(p.id)`, serta mengekspos `enrichment_retryable` di `GET /api/v2/products`.
2. **B2 — Default Foto Bersih + Toggle Asli | Hasil AI + Badge Status**: Ekstrak helper murni `resolveDefaultCardPhotoTab(product)` (`clean_photo_url`/`cleaned_photo_url` -> `'cleaned'`, selain itu `'raw'`), tampilkan sakelar **Asli | Hasil AI** di bawah thumbnail (state lokal `viewTabs`), tampilkan badge pojok status foto (*Perlu ditinjau*, *Disetujui*, *Sedang dibuat*), tampilkan pesan error enrichment jika `failed`, dan ubah klik thumbnail agar membuka **Jendela Banding**.
3. **B3 — Jendela Banding Foto Asli vs Hasil AI**: Perbarui modal review (`reviewModalProduct`) menjadi Jendela Banding 2 kolom (`Asli` vs `Hasil AI`, responsif di mobile, klik gambar untuk zoom), metadata sumber (`photo_provider`), status, `updated_at`, catatan peninjauan AI, dan tombol **Setujui** (saat `needs_review`), **Ganti Foto**, **Ulangi Generate** (konfirmasi + `/api/v2/products/regenerate-photos`), serta **Tolak, pakai foto sebelumnya** (B5).
4. **B4 — Foto di Modal Detail (Tab Foto & AI)**: Tampilkan foto **Asli** (`raw_photo_url`) dan **Hasil AI** (`cleaned_photo_url || clean_photo_url`) secara read-only tepat di atas unggah foto raw (atau teks `"Belum ada"` jika kosong) dengan kemampuan klik untuk pratinjau penuh.
5. **B5 — Simpan & Pulihkan Foto Sebelumnya**: Tambah kolom `previous_clean_photo_url TEXT` di `product_extractions`, simpan clean lama sebelum menimpa di `saveAndCommitCleanPhoto`, proxy URL di API `/api/v2/products` & `/api/v2/products/[id]`, dan dukung `action: 'revert_previous'` di `/api/v2/products/[id]/photo-review`.
6. **B6 — Verifikasi**: Tambah unit test `tests/product-card-photo-view.test.js`, jalankan seluruh tes produk + `npm run build`, lalu deploy & uji di Dev (`5020`/`7020`) sebelum persiapan rilis bersama Bagian A (`hotfix/truth-bahasa-inggris`) setelah persetujuan pengguna.

---

## Execution Task List

- [x] **B5 (DB, Worker, API)**: Tambah `previous_clean_photo_url` di `lib/db-pg.js` & `lib/product-repository.js`, snapshot di `lib/product-bulk-worker.js`, proxy & `enrichment_retryable` di `app/api/v2/products/route.js` & `[id]/route.js`, serta `revert_previous` di `app/api/v2/products/[id]/photo-review/route.js`.
- [x] **Helper Murni UI (`lib/product-card-photo-view.js`)**: Fungsi murni `resolveDefaultCardPhotoTab`, `resolveCardPhotoUrl`, `resolvePhotoStatusBadge`, dan `resolveEnrichButtonState`.
- [x] **B1, B2, B3 (`app/products/page.js`)**: Implementasi tombol `Enrich AI`, sakelar `Asli | Hasil AI`, badge pojok foto, pesan gagal enrichment, klik thumbnail membuka Jendela Banding, dan Jendela Banding lengkap dengan 4 tombol aksi (`Setujui`, `Tolak, pakai foto sebelumnya`, `Ganti Foto`, `Ulangi Generate`).
- [x] **B4 (`app/products/ProductDatabaseModal.js`)**: Pratinjau hanya-baca foto `Asli` vs `Hasil AI` (+ pratinjau klik perbesar) di Tab `visual_ai`.
- [ ] **B6 (Unit Test, Build, Dev Deploy)**: Tambah `tests/product-card-photo-view.test.js`, jalankan unit test & build, push branch `hotfix/kartu-produk-foto-enrich`, deploy ke Dev, verifikasi kolom DB & endpoint Dev, dan buat laporan.

---

## Rencana Perubahan Kode (Before & After Snippets)

### 1. [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) & [lib/product-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js) (B5)

**Code Sebelum (Current/Before):**
```javascript
          ADD COLUMN IF NOT EXISTS normalized_source_url TEXT,
          ADD COLUMN IF NOT EXISTS raw_photo_sha256 TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
```

**Code Sesudah (Proposed/After):**
```javascript
          ADD COLUMN IF NOT EXISTS normalized_source_url TEXT,
          ADD COLUMN IF NOT EXISTS raw_photo_sha256 TEXT,
          ADD COLUMN IF NOT EXISTS previous_clean_photo_url TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
```

### 2. [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js) (B5 — `saveAndCommitCleanPhoto`)

**Code Sebelum (Current/Before):**
```javascript
    await pgQuery(`
      UPDATE product_extractions
      SET clean_photo_url = $1,
          cleaned_photo_url = $1,
          photo_url = $1,
          photo_status = $2,
          photo_provider = $3,
          photo_error = NULL,
          extraction_status = $4,
          updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
    `, [saved.relativePath, newStatus, provider, newExtractionStatus, productId, tenantId]);
```

**Code Sesudah (Proposed/After):**
```javascript
    await pgQuery(`
      UPDATE product_extractions
      SET previous_clean_photo_url = CASE
            WHEN COALESCE(NULLIF(cleaned_photo_url, ''), NULLIF(clean_photo_url, '')) IS NOT NULL
             AND COALESCE(NULLIF(cleaned_photo_url, ''), NULLIF(clean_photo_url, '')) <> $1
            THEN COALESCE(NULLIF(cleaned_photo_url, ''), NULLIF(clean_photo_url, ''))
            ELSE previous_clean_photo_url
          END,
          clean_photo_url = $1,
          cleaned_photo_url = $1,
          photo_url = $1,
          photo_status = $2,
          photo_provider = $3,
          photo_error = NULL,
          extraction_status = $4,
          updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
    `, [saved.relativePath, newStatus, provider, newExtractionStatus, productId, tenantId]);
```

### 3. [app/api/v2/products/[id]/photo-review/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/photo-review/route.js) (B5)

**Code Sebelum (Current/Before):**
```javascript
    const action = body.action || 'approve';
    if (action !== 'approve') {
      return NextResponse.json({ success: false, error: `Action '${action}' tidak didukung. Gunakan 'approve'.` }, { status: 400 });
    }
```

**Code Sesudah (Proposed/After):**
```javascript
    const action = body.action || 'approve';
    if (action === 'revert_previous') {
      // Validasi previous_clean_photo_url ada, kembalikan clean_photo_url & cleaned_photo_url & photo_url
      // ke previous_clean_photo_url, set photo_status = 'approved', photo_error = NULL, active_photo = 'cleaned_photo_url',
      // dan kosongkan previous_clean_photo_url.
    } else if (action !== 'approve') { ... }
```

### 4. [app/api/v2/products/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/route.js) (B1 & B5)

**Code Sebelum (Current/Before):**
```javascript
      const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url'];
      for (const key of urlKeys) { ... }
      return updated;
```

**Code Sesudah (Proposed/After):**
```javascript
      const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url', 'previous_clean_photo_url'];
      for (const key of urlKeys) { ... }
      updated.enrichment_retryable = isRetryableGeminiError(updated.enrichment_error);
      return updated;
```

### 5. [app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js) & [app/products/ProductDatabaseModal.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js) (B1, B2, B3, B4)

**Code Sebelum (Current/Before):**
```javascript
const activeTab = viewTabs[p.id] || (p.active_photo === 'raw_photo_url' ? 'raw' : 'cleaned');
const displayPhotoUrl = activeTab === 'raw' ? p.raw_photo_url : (p.cleaned_photo_url || p.clean_photo_url);
// Thumbnail onclick -> setZoomedImage(displayPhotoUrl)
// Footer hanya berisi Setujui, Ganti Foto, Detail, Hapus
// Modal review 480px menampilkan 1 foto dan tombol Setujui
```

**Code Sesudah (Proposed/After):**
```javascript
const activeTab = viewTabs[p.id] || resolveDefaultCardPhotoTab(p);
const displayPhotoUrl = resolveCardPhotoUrl(p, activeTab);
// Thumbnail dengan badge pojok status + sakelar "Asli | Hasil AI" di bawahnya
// Klik thumbnail -> membuka Jendela Banding (Asli vs Hasil AI side-by-side + metadata + zoom + Setujui / Tolak pakai foto sebelumnya / Ganti Foto / Ulangi Generate)
// Footer menambahkan tombol Enrich AI / Enriching… / Coba lagi
// Tab visual_ai di ProductDatabaseModal menambahkan pratinjau Asli vs Hasil AI read-only
```
