# Usulan Perbaikan: Konsistensi Foto Referensi Produk pada Klip Bridging Video Multiplier (Studi Kasus `mul_261124_swv95p`)

**Tanggal:** 24 November 2026  
**Target Server Inspeksi:** Mac Mini Dev (`5020/7020`, schema PostgreSQL `dev`)  
**Sampel Kasus:** `mul_261124_swv95p` (`nutribake - Multiplier (Beorganik Peanut Butter): Ngidam Dessert Malam Hari Tanpa Takut Timbangan Naik`)  
**Preset:** `multiplier_deconstruct_remix_produk_nutribake` (`bridge_segments`: Klip 4 `intro` dan Klip 6 `recall`)  
**Produk Target:** `pe_1781998087509_929` (**Beorganik Peanut Butter**)

---

## 1. Hasil Investigasi Fakta di Server Dev (`mul_261124_swv95p`)

Dari hasil pemeriksaan langsung di database `dev` (`re_multiplier_tasks`, `product_extractions`, `glabs_tasks`), log worker `dev-ui.out.log`, serta file gambar di `~/maknaflow-dev-atomic/shared/public/uploads/`:

1. **Pada produk `pe_1781998087509_929` (*Beorganik Peanut Butter*), terdapat 3 foto berbeda yang tidak sinkron:**
   - `raw_photo_url`: `/uploads/products/raw/raw_pe_1781998087509_929.png` — poster marketplace Shopee berisi 5 toples Beorganik **tutup hijau** bertuliskan `PEANUT BUTTER` + badge promo `750.000+ pcs`.
   - `generated_photo_url`: `/uploads/products/generated/generated_pe_1781998087509_929_1782647240493.jpeg` — 1 toples **tutup aluminium silver**, teks putih `BEORGANIK PEANUT BUTTER SMOOTH` + ilustrasi kacang langsung di kaca. Kolom `active_photo` di DB menunjuk ke kolom ini (`generated_photo_url`) dengan `photo_status = 'needs_review'`.
   - `clean_photo_url` (= `cleaned_photo_url` = `photo_url`): `/uploads/products/default_tenant/clean/clean_default_tenant_pe_1781998087509_929_1786417303731.jpg` — hasil foto studio AI sebelumnya berupa 1 toples **tutup plastik putih + stiker label kertas putih polos** bertuliskan `BeOrganik Peanut Butter Peanut Spread Net Wt. (200 g)`.
   - Di schema `dev`, sebaran nilai `active_photo` pada `product_extractions` adalah: **`generated_photo_url` (245 produk)**, `cleaned_photo_url` (9 produk), dan `raw_photo_url` (1 produk).

2. **Foto mana yang sebenarnya dikirim Multiplier ke G-Labs pada `mul_261124_swv95p`?**
   - Di `dev-ui.out.log`, pada tahap `generating_t2i` Klip 4 (`05:53:15`) dan Klip 6 (`05:55:20`), G-Labs memang menerima 1 `reference_images` dengan SHA256 `2ae94aeb9e3157394dcbb8f7877f97619b40b0021786c4b615248b9d50accc35` (`323.703 bytes`, `image/jpeg`).
   - SHA256 tersebut adalah file **`clean_default_tenant_pe_1781998087509_929_1786417303731.jpg`** (`clean_photo_url`), **bukan** `active_photo` (`generated_photo_url`) maupun `raw_photo_url`.
   - Start frame yang terbentuk untuk Klip 4 (`generated_start_frame_mul_261124_swv95p_clip4_1795474456971.png`) dan Klip 6 (`generated_start_frame_mul_261124_swv95p_clip6_1795474587575.png`) mengikuti tampilan `clean_photo_url` (label putih polos + tutup putih).
   - Namun karena `clean_photo_url` tersebut jauh berbeda dari produk asli Beorganik tutup hijau (`raw_photo_url`) maupun foto studio `generated_photo_url` tutup silver yang menjadi `active_photo`, hasil klip bridging terlihat seperti **AI mengarang kemasan putih polos sendiri** dan tidak konsisten dengan foto aktif di Product Database.

---

## 2. Akar Masalah Teknis (4 Celah di Kode)

### A. Pipeline Multiplier Mengabaikan `active_photo`
Di 4 titik berikut, sistem meng-hardcode urutan `clean_photo_url || photo_url || cleaned_photo_url` dan tidak pernah membaca `product.active_photo`:
1. `buildProductSnapshot` di [`lib/multiplier-pairing.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-pairing.js#L54)
2. `buildAutonomousBridgingConfig` di [`lib/multiplier-pairing.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-pairing.js#L78)
3. `handleProductResolution` di [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L235-L265)
4. `handleT2iGeneration` di [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L953-L966)

Selain itu, [`resolveCampaignProductReference`](file:///Users/sabeqmmursyid/_cfstudio/lib/product-reference-resolver.js#L70-L107) (helper kanonik OPC) pun baru mengecek `activePhoto === 'raw_photo_url'` dan `'clean_photo_url'`, belum menghormati `'cleaned_photo_url'` atau `'generated_photo_url'` bila file-nya valid.

### B. `handleT2iGeneration` di Multiplier Belum Memakai Kontrak Identity Lock Seperti OPC
Jika dibandingkan dengan [`buildOpcStartFrameRequest`](file:///Users/sabeqmmursyid/_cfstudio/lib/opc-start-frame-request.js#L47-L54) yang sudah dipakai Pillar Campaign, [`handleT2iGeneration`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L944-L1054) memiliki 4 kelemahan:
1. **Tanpa `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]`:** Multiplier langsung mengirim `[productBase64]` mentah tanpa object `{ data, category: 'subject', name: 'product_truth_...' }` dan tanpa prefix instruksi pengunci identitas visual kemasan.
2. **Teks `product_truth` / `clean_photo_t2i_prompt` / `geometric_truth` berbenturan dengan gambar:** Prompt Klip 4 & 6 menyisipkan teks `Details: [Product Reference Image] cylindrical clear glass jar with minimalist white label and white lid`. Ketika foto produk diganti atau berbeda dari deskripsi lama, tanpa instruksi *"Ignore any textual product description that conflicts with the attached image"*, model T2I menebak-nebak mengikuti teks.
3. **Tidak meneruskan `webhookOverride: brandProfile` & `aspect_ratio` snake_case:** Baris 949 hanya membaca `aesthetics.aspectRatio` (mengabaikan `aspect_ratio`), dan baris 990 memanggil `generateImage` tanpa `webhookOverride: brandProfile` (padahal `handleVisualGeneration` baris 1349 mengirimkannya).
4. **Klip non-bridging (1, 2, 3, 5) tidak disanitasi & tanpa audit SHA256:** Pada Klip 1 `mul_261124_swv95p`, teks `peanut butter` tetap muncul di `Food Truth`. Selain itu belum ada `expected_reference_sha256s` maupun tabel/log audit start frame.

### C. Ketidakjelasan Foto Aktif Saat Mengganti / Meninjau Produk di Product Database
- Saat user mengklik tombol pakai foto di [`app/products/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js#L427-L455), API hanya menerima `clean_photo_url | raw_photo_url`, sedangkan worker lama sempat meninggalkan 245 produk dengan `active_photo = 'generated_photo_url'` dan `photo_status = 'needs_review'`.
- Di UI Auto Pipeline dan Multiplier Lab, tidak ada thumbnail pratinjau **"Foto Referensi yang Akan Dipakai di Klip Bridging"** beserta peringatan bila `photo_status === 'needs_review'`.

### D. Kualitas Foto Sumber `clean_photo_url` yang Sudah Terlanjur Polos (Khusus Data Produk Lama)
Pada kasus *Beorganik Peanut Butter*, `clean_photo_url` yang tersimpan di DB sejak `needs_review` memang sudah kehilangan ciri label hijau/ilustrasi kacang dari produk asli. Sekalipun kodenya nanti 100% akurat meneruskan foto, bila `clean_photo_url` tetap gambar label putih polos itu, hasil video tetap akan menampilkan label putih polos.

---

## 3. Usulan Perbaikan (4 Tahap Ringkas)

### P1 — Sentralisasi Resolver Foto Produk (`active_photo`-Aware)
Perbarui [`lib/product-reference-resolver.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/product-reference-resolver.js) dan sambungkan ke semua titik Multiplier:
- Buat urutan resolusi yang konsisten menghormati `product.active_photo`:
  1. Jika `active_photo === 'raw_photo_url'` -> wajib pakai `raw_photo_url`.
  2. Jika `active_photo === 'clean_photo_url'` atau `'cleaned_photo_url'` -> pakai `clean_photo_url || cleaned_photo_url`.
  3. Jika `active_photo === 'generated_photo_url'` -> pakai `generated_photo_url` (atau sinkronkan kebijakan apakah `generated_photo_url` diizinkan sebagai fallback resmi bila file ada).
  4. Fallback jika `active_photo` kosong/tidak valid: `clean_photo_url -> cleaned_photo_url -> generated_photo_url -> raw_photo_url -> photo_url`.
- Gunakan resolver ini di `buildProductSnapshot`, `buildAutonomousBridgingConfig` ([`lib/multiplier-pairing.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-pairing.js)), serta `handleProductResolution` dan `handleT2iGeneration` ([`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)), sehingga tidak ada lagi URL hardcode yang mengabaikan pilihan user.
- Tambahkan guard tegas: jika `bridging` aktif dengan produk ber-ID valid tetapi file gambar referensi produk gagal dibaca di disk (`!productBase64`), gagalkan task lebih awal di tahap `resolving_product` / `generating_t2i` daripada diam-diam membuat start frame tanpa foto produk.

### P2 — Terapkan Kontrak Identity Lock & Reference Wrapper di Multiplier T2I (`re-multiplier-worker.js`)
Samakan standar pengiriman `generateImage` di [`handleT2iGeneration`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L944) dengan OPC (`opc-start-frame-request.js`):
1. Ekstrak shared helper `lockProductIdentityPrompt(prompt, product, productTag)` agar bisa dipakai bersama oleh OPC dan Multiplier.
2. Pada klip bridging (`isBridgeClip === true`), bungkus gambar referensi sebagai objek terstruktur `{ data: productBase64, category: 'subject', name: 'product_truth_<productId>.<ext>' }`, kirim `expected_reference_sha256s`, dan pasang prefix `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]` yang memerintahkan provider **mengikuti foto terlampir sebagai kebenaran tunggal** dan mengabaikan deskripsi kemasan teks yang bertentangan.
3. Pada klip non-bridging (`!isBridgeClip`), terapkan sanitasi istilah kemasan & nama produk agar kemasan tiruan tidak bocor di klip sebelum bridging.
4. Pastikan `handleT2iGeneration` mengirim `webhookOverride: brandProfile`, membaca `aesthetics.aspect_ratio || aesthetics.aspectRatio || '9:16'`, dan mencatat metadata `reference_sha256` + `reference_source_field` ke `bridging_config_json` / log agar mudah diaudit.

### P3 — Pratinjau Foto Referensi & Badge Status di UI Auto Pipeline / Multiplier
Di UI pemilihan produk bridging pada Auto Pipeline & Multiplier Lab:
- Tampilkan thumbnail foto aktif yang benar-benar akan dikirim ke G-Labs beserta sumber field-nya (`Foto Bersih` / `Foto Studio` / `Foto Asli`) dan badge status bila masih `needs_review`, lengkap dengan tautan cepat ke menu **Product Database** untuk mengganti/menyetujui foto sebelum menjalankan video.

### P4 — Pembersihan Data Foto Produk (`pe_1781998087509_929` & Produk `needs_review`)
Karena pada kasus *Beorganik Peanut Butter* foto `clean_photo_url` memang sudah berupa jar label putih polos dan `photo_status` masih `needs_review`:
- Setelah P1–P3 diterapkan, regenerasi/unggah ulang foto bersih tunggal untuk `pe_1781998087509_929` agar tutup & label sesuai kemasan asli Beorganik lalu klik **Setujui (`approved`)** di Product Database (dan sinkronkan ulang `product_truth` + `geometric_truth` dari foto baru tersebut melalui Enrich Vision).

---

## 4. Rencana Verifikasi Jika Disetujui
1. **Unit Test:**
   - Menguji `resolveCampaignProductReference` & `buildProductSnapshot` saat `active_photo` diset ke `'raw_photo_url'`, `'clean_photo_url'`, `'cleaned_photo_url'`, dan `'generated_photo_url'`.
   - Menguji `buildMultiplierStartFrameRequest` / `handleT2iGeneration` memastikan:
     - Klip bridging (mis. klip 4 dan 6) wajib menyertakan 1 reference object `{ category: 'subject' }`, `expected_reference_sha256s`, dan prefix `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]`.
     - Klip non-bridging (1, 2, 3, 5) punya `reference_images: undefined` dan bebas nama produk/kemasan.
     - Bridging dengan file foto hilang langsung melempar error jelas alih-alih meloloskan generasi tanpa referensi.
2. **Uji Produksi di Dev (`5020`):**
   - Uji ulang 1 kampanye Multiplier *Beorganik Peanut Butter* (`multiplier_deconstruct_remix_produk_nutribake`), periksa log Dev memastikan `reference_count: 1` cocok dengan SHA256 `active_photo` yang disetujui dan cek visual start frame Klip 4 & 6.
