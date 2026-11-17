# Implementation Plan: Kartu Produk (Enrich & Foto G-Labs) + Truth Berbahasa Inggris

> Instruksi sumber: [antigravity_kartu_produk_enrich_foto_truth_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_kartu_produk_enrich_foto_truth_instructions.md)  
> Tahap saat ini: **Bagian A (`hotfix/truth-bahasa-inggris`)** dulu, baru **Bagian B (`hotfix/kartu-produk-foto-enrich`)**.

---

## Execution Task List

### Bagian A — `hotfix/truth-bahasa-inggris` (Tanpa UI Mockup)
- [x] **Persiapan Branch A**: Buat branch `hotfix/truth-bahasa-inggris` dari `main`.
- [x] **A1 (Prompt Enrichment & Konstanta Bersama)**: Pindahkan definisi baku Product Truth (3–4 kalimat English) & Geometric Truth (2–3 kalimat English) ke konstanta bersama agar dipakai oleh `buildBatchProductTruthsPrompt` (`lib/prompts.js`) dan `buildEnrichmentPrompt` (`lib/product-bulk-worker.js`); jaga USP & kategori tetap Bahasa Indonesia.
- [x] **A2 (Penjaga Bahasa)**: Buat `looksIndonesian(text)` dan helper terjemah cadangan di `lib/product-truth-language.js`, lalu integrasikan penjaga pasca-enrichment di `lib/product-bulk-worker.js` (1x call terjemah bila salah satu Truth berbahasa Indonesia; non-fatal bila gagal).
- [x] **A3 (Skrip Data Lama)**: Buat `scripts/translate-product-truths.mjs` (`--schema <dev|staging>`, `--tenant`, `--limit`, `--apply` dengan default dry-run).
- [x] **A4 (Keterangan Form Modal)**: Tambah teks bantu Bahasa Inggris ber-token `var(--text-muted)` di `app/products/ProductDatabaseModal.js`.
- [x] **A5 (Unit Test & Build)**: Tambah `tests/product-truth-language.test.js` dan verifikasi semua tes produk + `npm run build`.
- [ ] **A6 (Deploy & Uji Dev + Dry-Run Staging)**: Deploy `hotfix/truth-bahasa-inggris` ke Dev (`5020`/`7020`), uji enrich 1 produk di Dev (Truth English), jalankan `--apply` di Dev atau dry-run `--schema staging` (read-only) untuk laporan.

### Bagian B — `hotfix/kartu-produk-foto-enrich` (UI — Mockup Dulu)
- [ ] **B0 (Mockup HTML)**: Buat `public/mockup_kartu_produk_foto_enrich.html` (standalone, semantic tokens, light/dark, 3 kondisi kartu + jendela banding + tab foto modal Edit), deploy/tampilkan link HTTP ke pengguna untuk persetujuan sebelum edit UI React (`app/products/`).
- [ ] **B1–B6**: Kerjakan tombol Enrich di kartu, thumbnail terbaru + sakelar Asli|Hasil AI + label status, jendela banding, tampilan foto di Modal Edit, tes unit pemilih foto default + `npm run build`, dan uji Dev (serta konfirmasi B5 migrasi DB hanya bila diizinkan).

---

## Rencana Perubahan Kode Bagian A (Before & After Snippets)

### 1. Konstanta Bersama & Prompt Enrichment ([lib/product-truth-language.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-truth-language.js), [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js))

**Code Sebelum (Current/Before) — `lib/product-bulk-worker.js`:**
```javascript
    {
      "id": "ID produk asli",
      "unique_selling_point": ["USP 1", "USP 2", "USP 3"],
      "product_truth": "Fakta nyata produk dari perspektif konsumen (1-2 kalimat)",
      "geometric_truth": "Deskripsi bentuk fisik, dimensi, dan visual kemasan (1-2 kalimat)",
      "category": "Kategori produk",
      "clean_photo_t2i_prompt": "Prompt Bahasa Inggris untuk foto produk clean berlatar putih — deskripsi produk, studio light, white background"
    }
```

**Code Sesudah (Proposed/After):**
```javascript
// Konstanta PRODUCT_TRUTH_DEFINITIONS di lib/product-truth-language.js dipakai bersama oleh buildBatchProductTruthsPrompt & buildEnrichmentPrompt:
// - product_truth: WAJIB Bahasa Inggris, 3-4 kalimat deskripsi tampilan luar kemasan (warna dominan, letak logo, teks utama, jenis tutup, aksen warna) untuk mengunci T2I.
// - geometric_truth: WAJIB Bahasa Inggris, 2-3 kalimat struktur 3D & material/permukaan (silinder tegak, plastik doff, kaca bening, dll.) untuk I2V.
// - unique_selling_point & category tetap Bahasa Indonesia (dipakai naskah VO).
```

### 2. Penjaga Bahasa di `enrichProduct` ([lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js))

**Code Sebelum (Current/Before):**
```javascript
    const enriched = JSON.parse(rawResponse);
    const item = (enriched.products || [enriched])[0];
    if (!item) throw new Error('Gemini tidak mengembalikan data produk');

    await pgQuery(`UPDATE product_extractions SET ...`, [..., item.product_truth || null, item.geometric_truth || null, ...]);
```

**Code Sesudah (Proposed/After):**
```javascript
    const enriched = JSON.parse(rawResponse);
    const rawItem = (enriched.products || [enriched])[0];
    if (!rawItem) throw new Error('Gemini tidak mengembalikan data produk');

    const item = await ensureEnglishProductTruths(rawItem, {
      itemId: id,
      tenantId,
      productName: product_name,
      logger: (msg) => logToBulk(msg, tenantId)
    });
```

### 3. Keterangan Helper Bahasa Inggris di Modal Produk ([app/products/ProductDatabaseModal.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js))

**Code Sebelum (Current/Before):**
```jsx
<textarea ... value={formData.product_truth} ... />
```

**Code Sesudah (Proposed/After):**
```jsx
<textarea ... value={formData.product_truth} ... />
<p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
  Ditulis dalam Bahasa Inggris — dipakai langsung untuk prompt gambar/video.
</p>
```
