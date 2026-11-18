# Implementation Plan: Tombol GPT Image 2 di Jendela Banding & Foto Scraper Square

Tanggal: 18 November 2026 (Asia/Jakarta)
Status: rencana saja; belum ada kode aplikasi yang diubah.
Menggantikan: usulan Codex "GPT Image 2 Khusus Foto Studio Produk" (arsip: `catatan-kerja/rencana/gpt_foto_produk_usulan_codex_arsip_20261118.md`). Dasar review: `catatan-kerja/usulan/REVIEW_USULAN_GPT_IMAGE2_FOTO_PRODUK.md` (bagian D2).

## Keputusan pengguna

1. **GPT Image 2 hanya dipakai manual**, lewat tombol di jendela banding/tinjau foto produk, satu produk per klik. Tujuannya hemat kuota: dipakai hanya saat hasil Nano Banana kurang bagus.
2. **Scraper**: foto studio dibuat **square 1:1** dan memakai **Nano Banana 2** (lebih patuh daripada Pro).
3. Proses otomatis lain (bulk, enrichment Gemini, start frame video) **tidak berubah**.

> [!NOTE]
> Pengguna menyebut "Nano Banana 2.1". Di G-Labs (dokumen webhook §5.1/§5.7) dan di kode, model yang tersedia hanya `nano_banana_pro`, `nano_banana_2`, `nano_banana_2_lite`; nilai lain **diam-diam** jatuh ke `nano_banana_2`. Rencana ini memakai `nano_banana_2`. Sebelum eksekusi, cek daftar model di worker G-Labs yang terpasang; bila ada ID baru untuk versi 2.1, ganti nilainya dan tambahkan ke `normalizeGlabsImageModel` — jangan menulis ID yang tidak dikenal.

## Pembagian branch (SOP: satu branch = satu fitur)

| Bagian | Branch | Isi | Migrasi DB |
|---|---|---|---|
| A | `fitur/scraper-foto-square` | Scraper: Nano Banana 2, rasio 1:1 | Tidak |
| B | `fitur/gpt-regenerate-manual` | Tombol GPT di jendela banding + adapter GPT + label model | **Ya** (3 kolom baru, hanya menambah) |

Bagian A kecil dan bisa jalan duluan. Keduanya lewat Dev dulu, naik Staging setelah pengguna menyatakan lolos uji.

## Batas cakupan

- GPT **tidak** masuk Settings, bulk otomatis, scraper, tombol massal, maupun tool MCP `cf_regenerate_product_photo`.
- API menolak permintaan GPT bila lebih dari 1 produk.
- GPT gagal → foto lama tetap, pesan jelas, **tidak** pindah otomatis ke Nano Banana.
- Pilihan GPT hanya berlaku untuk satu klik. "Ulangi Generate" biasa berikutnya kembali ke Nano Banana.
- Hasil GPT tetap masuk slot `clean_photo_url`, memakai mekanisme `previous_clean_photo_url` + revert v2.52.0 yang sudah ada.
- Provider tetap `glabs` (polling memfilter `photo_provider = 'glabs'`); GPT dibedakan lewat kolom model.

---

## Bagian A — Scraper: Nano Banana 2, square 1:1

### A1. lib/scheduler-processors.js (blok Generative Polish, ±baris 9468–9492)
Code Sebelum (Current/Before):
```js
// Tahap 3: G-Labs Generative Polish (Generasi foto studio AI via model default nano_banana_pro) - P5 / R4
...
console.log(`[Product Scraper Job] Sending request to G-Labs Generative Polish (model: nano_banana_pro)...`);
const glabsResult = await generateGlabsImage({
  prompt: productData.t2i_prompt,
  model: 'nano_banana_pro',
  aspect_ratio: '9:16',
  reference_images: [cleanedDataUrl]
});
```
Code Sesudah (Proposed/After):
```js
// Tahap 3: G-Labs Generative Polish (foto studio square via nano_banana_2 — lebih patuh pada referensi)
const SCRAPER_POLISH_MODEL = 'nano_banana_2';
const SCRAPER_POLISH_ASPECT = '1:1';
...
console.log(`[Product Scraper Job] Sending request to G-Labs Generative Polish (model: ${SCRAPER_POLISH_MODEL}, ${SCRAPER_POLISH_ASPECT})...`);
const glabsResult = await generateGlabsImage({
  prompt: productData.t2i_prompt,
  model: SCRAPER_POLISH_MODEL,
  aspect_ratio: SCRAPER_POLISH_ASPECT,
  reference_images: [cleanedDataUrl]
});
```
Catatan:
- Fallback kuota Pro → Nano Banana 2 di `webhook-client.js` otomatis tidak terpakai lagi untuk scraper (sudah 2). Tidak perlu diubah.
- Hanya produk yang di-scrape setelah rilis. Foto lama tidak diregenerasi.
- Audit cepat: cari pemakai `generated_photo_url` yang mengasumsikan 9:16 (`product-reference-resolver.js`, `campaign-scheduler.js`, `custom-storyboard-pipeline.js`, `app/content-flow/page.js`). Dugaan awal aman (foto hanya referensi; start frame tetap 9:16), tapi wajib dicek tampilan thumbnail.

### A2. sot/menus/kartu/products.md
Code Sebelum (Current/Before):
```md
3. Generative polish membutuhkan G-Labs API aktif (cek `tenant_settings`).
```
Code Sesudah (Proposed/After):
```md
3. Generative polish scraper memakai Nano Banana 2, rasio 1:1 (sejak vX.Y.Z), dan membutuhkan G-Labs API aktif.
```

### A3. Verifikasi Bagian A
- Scrape 1 URL produk di Dev → `generated_photo_url` berbentuk persegi, log menyebut `nano_banana_2, 1:1`.
- Tampilan kartu produk & thumbnail tidak terpotong aneh.
- Buat 1 start frame dari produk itu → tetap 9:16 dan produk terbaca benar.

---

## Bagian B — Tombol "Ulangi dengan GPT" di jendela banding

### Alur
```
Klik "🧠 Ulangi dengan GPT" (1 produk, konfirmasi)
 → POST /api/v2/products/regenerate-photos { ids:[id], engine:'gpt_image_2' }
 → set photo_status='pending', photo_engine_request='gpt_image_2'
 → worker klaim → processProductPhoto: engine GPT → adapter → /api/openai/generate
 → polling existing (photo_provider='glabs', photo_task_id asli)
 → simpan clean + previous, photo_model='gpt_image_2', previous_photo_model=model lama
 → photo_engine_request dikosongkan
```
Klik "✨ Ulangi Generate" biasa mengirim tanpa `engine` → route mengosongkan `photo_engine_request` → Nano Banana seperti sekarang.

### B1. lib/db-pg.js — migrasi tambah kolom (±baris 1188)
Code Sebelum (Current/Before):
```sql
ADD COLUMN IF NOT EXISTS previous_clean_photo_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
```
Code Sesudah (Proposed/After):
```sql
ADD COLUMN IF NOT EXISTS previous_clean_photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_engine_request TEXT,   -- permintaan sekali pakai: 'gpt_image_2' atau NULL
ADD COLUMN IF NOT EXISTS photo_model TEXT,            -- model yang membuat foto clean aktif
ADD COLUMN IF NOT EXISTS previous_photo_model TEXT,   -- model foto sebelumnya (untuk label banding)
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
```
- Hanya menambah kolom kosong; data lama tidak berubah. Rollback kode tidak menghapus kolom (aman, kolom diabaikan).
- Wajib cek cara migrasi berjalan di Dev/Staging (build memakai `DISABLE_AUTO_MIGRATIONS=true`; pastikan migrasi runtime/manual untuk schema `dev` dan `staging`). **Beri tahu pengguna sebelum naik Staging.**
- Cek juga apakah ada salinan skema SQLite/test (`lib/db.js`, `scripts/test-product-pipeline.js`) yang perlu kolom sama.

### B2. app/api/v2/products/regenerate-photos/route.js
Code Sebelum (Current/Before):
```js
const { ids, provider } = body;
...
SET photo_status = 'pending',
    photo_error = NULL,
    ${resolvedProvider ? 'photo_provider = $3,' : ''}
    extraction_status = 'pending_image',
```
Code Sesudah (Proposed/After):
```js
const { ids, provider, engine } = body;
const ALLOWED_ENGINES = [undefined, null, 'gpt_image_2'];
if (!ALLOWED_ENGINES.includes(engine)) → 400 'Engine tidak dikenal'
if (engine === 'gpt_image_2' && ids.length !== 1) → 400 'GPT hanya untuk 1 produk per klik'
if (engine === 'gpt_image_2' && !String(product.raw_photo_url || '').startsWith('/uploads'))
  → results.push({ id, status:'skipped', reason:'Foto mentah belum tersimpan di server — upload foto mentah dulu.' })
...
SET photo_status = 'pending',
    photo_error = NULL,
    photo_engine_request = $N,        -- 'gpt_image_2' atau NULL (tombol biasa selalu mengosongkan)
    photo_provider = 'glabs' (bila engine GPT; selain itu perilaku lama),
    extraction_status = 'pending_image',
```
- Tolak bila produk sedang `photo_status IN ('pending','processing')` agar tidak dobel kirim.
- Otorisasi tenant existing (`withTenantContext`) tetap.

### B3. lib/product-bulk-worker.js
Code Sebelum (Current/Before):
```js
SELECT id, product_name, raw_photo_url, clean_photo_t2i_prompt, photo_provider,
       packaging_status, packaging_type, enrichment_status
...
const prompt = clean_photo_t2i_prompt || buildCleanProductPrompt(job);
const provider = await resolveProductPhotoProvider(job, tenantId);
...
const result = await generateWithGlabs({ referenceImage, prompt, tenantId });
```
Code Sesudah (Proposed/After):
```js
SELECT id, product_name, raw_photo_url, clean_photo_t2i_prompt, photo_provider, photo_engine_request,
       packaging_status, packaging_type, enrichment_status
...
if (job.photo_engine_request === 'gpt_image_2') {
  if (!referenceImage) throw new Error('Foto mentah belum tersimpan di server — upload foto mentah dulu.');
  const prompt = buildGptProductPrompt(job);   // pengunci identitas + detail clean_photo_t2i_prompt
  const result = await generateWithGlabs({ referenceImage, prompt, tenantId, engine: 'gpt_image_2' });
  // UPDATE: photo_task_id, photo_provider='glabs', photo_status='processing'
  return;
}
// jalur lama tidak berubah
```
Di `saveAndCommitCleanPhoto` (Before → After):
```sql
-- Before
clean_photo_url = $1, cleaned_photo_url = $1, photo_url = $1, photo_status = $2, photo_provider = $3, ...
-- After (tambahan)
previous_photo_model = CASE WHEN <kondisi previous yang sama> THEN photo_model ELSE previous_photo_model END,
photo_model = $7,               -- 'gpt_image_2' / model Nano efektif / 'gemini'
photo_engine_request = NULL,
```
- Model efektif Nano Banana diambil dari respons `generateImage` (`effective_model`) bila tersedia; bila tidak, tulis `nano_banana`.
- Saat polling gagal: tulis `photo_error` dengan pesan asli G-Labs, kosongkan `photo_engine_request`. Foto lama tidak disentuh.
- Polling: tambahkan `photo_engine_request` / model ke SELECT seperlunya untuk diteruskan ke penyimpanan.

### B4. lib/product-photo-providers/glabs.js
Code Sebelum (Current/Before):
```js
export async function generateWithGlabs({ referenceImage, prompt, tenantId }) {
  ...
  const response = await generateImage({ prompt, model: model || undefined, aspect_ratio: '1:1', reference_images: ... });
...
const downloadUrl = getFileUrl(imageFile);
...
return { completed: false, failed: true, error: 'G-Labs task gagal' };
```
Code Sesudah (Proposed/After):
```js
export async function generateWithGlabs({ referenceImage, prompt, tenantId, engine = null }) {
  if (engine === 'gpt_image_2') {
    const response = await generateProductPhotoWithOpenAI({ referenceImage, prompt });
    if (!response?.task_id) throw new Error('G-Labs (GPT) tidak mengembalikan task_id');
    return { mode: 'async', provider: 'glabs', model: 'gpt_image_2', taskId: response.task_id };
  }
  // jalur lama Nano Banana tidak berubah
}
...
let imageFile = files.find(f => /\.(png|jpe?g|webp)$/i.test(f)) || files[0];
const downloadUrl = getFileUrl(imageFile, taskId);          // perbaikan: unduh dari worker yang mengerjakan
...
return { completed: false, failed: true, error: statusResult?.error || statusResult?.error_detail || 'G-Labs task gagal' };
```

### B5. lib/webhook-client.js (helper baru; fungsi lama tidak diubah)
Code Sebelum (Current/Before): belum ada helper OpenAI.
Code Sesudah (Proposed/After):
```js
export async function generateProductPhotoWithOpenAI({ referenceImage, prompt }) {
  if (!referenceImage) throw new Error('Foto referensi produk wajib tersedia');
  await applyRandomDelay('image');
  const endpoint = resolveWebhookEndpoint();
  const body = {
    prompt,                          // TIDAK lewat sanitizeImagePrompt (prompt_mode direct)
    aspect_ratio: '1:1', quality: 'high', prompt_mode: 'direct',
    reasoning: 'none', web_search: false,
    reference_images: [referenceImage]
  };
  const res = await fetch(`${endpoint.baseUrl}/api/openai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': endpoint.apiKey },
    body: JSON.stringify(body)
  });
  // !res.ok → throw pesan error G-Labs (tanpa key/base64 di log)
  // sukses → saveGlabsTaskRoute(task_id, endpoint.host, endpoint.port, endpoint.apiKey)
  // TANPA antrean BullMQ, TANPA fallback ke Nano Banana
}
```

### B6. lib/product-photo-service.js — prompt GPT
Code Sebelum (Current/Before): hanya `buildCleanProductPrompt(product)`.
Code Sesudah (Proposed/After):
```js
export function buildGptProductPrompt(product) {
  const base = buildCleanProductPrompt(product);          // pengunci identitas
  const extra = product.clean_photo_t2i_prompt
    ? `\nAdditional styling detail (lower priority; if it conflicts with the reference image, follow the reference image): ${product.clean_photo_t2i_prompt}`
    : '';
  return `${base}\nOutput: square 1:1, single product, pure white seamless background.${extra}`;
}
```

### B7. app/products/page.js — tombol di jendela tinjau/banding (±baris 2648–2664) & fungsi regenerate (±670)
Code Sebelum (Current/Before):
```jsx
async function handleRegeneratePhoto(productId) {
  ... body: JSON.stringify({ ids: [productId] })
}
...
<button ... onClick={() => { ... handleRegeneratePhoto(targetId); }}>
  {regeneratingPhotoId === reviewModalProduct.id ? '⏳ Mengantrekan…' : '✨ Ulangi Generate'}
</button>
```
Code Sesudah (Proposed/After):
```jsx
async function handleRegeneratePhoto(productId, engine = null) {
  ... body: JSON.stringify(engine ? { ids: [productId], engine } : { ids: [productId] })
}
...
<button ...>✨ Ulangi Generate</button>              {/* tetap Nano Banana */}
<button
  type="button"
  className="btn btn-secondary btn-sm"
  disabled={isSubmittingReview || !hasLocalRaw || regeneratingPhotoId === reviewModalProduct.id}
  title={hasLocalRaw ? 'Generate ulang memakai GPT Image 2 (kuota akun ChatGPT di G-Labs)' : 'Foto mentah belum tersimpan di server'}
  onClick={() => {
    if (!window.confirm(`Generate ulang "${reviewModalProduct.product_name}" dengan GPT Image 2?\nMemakai kuota akun ChatGPT. Foto sekarang tetap disimpan dan bisa dikembalikan.`)) return;
    const targetId = reviewModalProduct.id;
    setReviewModalProduct(null);
    handleRegeneratePhoto(targetId, 'gpt_image_2');
  }}
>
  🧠 Ulangi dengan GPT
</button>
```
- `hasLocalRaw = String(reviewModalProduct.raw_photo_url || '').startsWith('/uploads')`.
- Label model di jendela banding: "Foto baru: GPT Image 2 · Foto lama: Nano Banana" dari `photo_model` / `previous_photo_model` (kosong → tidak ditampilkan). Ganti/lengkapi `formatPhotoProviderLabel` (±baris 2436).
- Saat `photo_engine_request = 'gpt_image_2'` dan status processing, kartu menampilkan "Sedang dibuat dengan GPT…".
- Semua warna memakai token `app/theme.css` (tanpa hex). Tombol massal tidak berubah.
- Pastikan API list/detail produk (`app/api/v2/products/route.js`, `[id]/route.js`) ikut mengembalikan tiga kolom baru.

### B7b. File pendukung kontrak kolom & revert (`lib/product-repository.js`, `app/api/v2/products/[id]/photo-review/route.js`)
Code Sebelum (`lib/product-repository.js`):
```js
  'photo_reviewed_at', 'normalized_source_url', 'raw_photo_sha256',
  'previous_clean_photo_url',
```
Code Sesudah (`lib/product-repository.js`):
```js
  'photo_reviewed_at', 'normalized_source_url', 'raw_photo_sha256',
  'previous_clean_photo_url', 'photo_engine_request', 'photo_model', 'previous_photo_model',
```
Code Sebelum (`app/api/v2/products/[id]/photo-review/route.js`, aksi `revert_previous`):
```js
      const updates = {
        clean_photo_url: previousCleanUrl,
        cleaned_photo_url: previousCleanUrl,
        photo_url: previousCleanUrl,
        active_photo: 'cleaned_photo_url',
        previous_clean_photo_url: null,
        photo_status: 'approved',
```
Code Sesudah (`app/api/v2/products/[id]/photo-review/route.js`, aksi `revert_previous`):
```js
      const updates = {
        clean_photo_url: previousCleanUrl,
        cleaned_photo_url: previousCleanUrl,
        photo_url: previousCleanUrl,
        active_photo: 'cleaned_photo_url',
        previous_clean_photo_url: null,
        photo_model: product.previous_photo_model || null,
        previous_photo_model: null,
        photo_engine_request: null,
        photo_status: 'approved',
```

### B8. public/mockup_tombol_gpt_banding_produk.html (baru, wajib sebelum B7)
Code Sebelum (Current/Before): belum ada.
Code Sesudah (Proposed/After):
```html
<!-- token light/dark mandiri mengikuti app/theme.css -->
<!-- jendela banding: foto lama | foto baru + label model -->
<!-- tombol: 🔄 Ganti Foto · ✨ Ulangi Generate · 🧠 Ulangi dengan GPT · ↩ Kembalikan foto lama -->
<!-- simulasi: konfirmasi → status "Sedang dibuat dengan GPT…" → hasil + label; kondisi tombol GPT nonaktif bila foto mentah tidak ada -->
```
Sinkronkan hanya file mockup ke public runtime Staging (cek current/shared sesuai SOT), verifikasi HTTP 200, bagikan `http://100.95.245.55:5010/mockup_tombol_gpt_banding_produk.html`.

### B9. Tes
`tests/product-photo-gpt-manual.test.js` (baru), memakai mock fetch sendiri (jangan bergantung pada `getTaskStatus` mode test yang mengembalikan `succeeded`):
- engine GPT → `/api/openai/generate`, body `1:1/high/direct/none/false`, tanpa `model`, prompt tidak disanitasi.
- Tombol biasa → `/api/image/generate`, `photo_engine_request` dikosongkan.
- GPT + >1 id → 400; GPT tanpa raw lokal → skipped dengan pesan jelas.
- GPT gagal → tidak ada submit Nano Banana; foto lama utuh; `photo_error` berisi pesan asli.
- Simpan sukses → `photo_model='gpt_image_2'`, `previous_photo_model` = model lama, `photo_engine_request` NULL.
- `getFileUrl` dipanggil dengan `taskId`.
- Isolasi tenant: permintaan tenant A tidak terbaca tenant B.

### B10. Kartu menu
`sot/menus/kartu/products.md`: tambah butir "Jendela banding punya tombol 🧠 Ulangi dengan GPT (manual, 1 produk, kuota akun ChatGPT di G-Labs; gagal tidak mengubah foto lama; label model foto)". Perbarui tanggal/versi saat rilis.

---

## Verifikasi & kriteria diterima

- Mockup disetujui pengguna sebelum coding React.
- Bagian A: lihat A3.
- Bagian B (Dev, satu produk berlabel jelas): Nano Banana dulu → klik GPT → banding menampilkan dua foto + label → revert berfungsi → klik "Ulangi Generate" biasa kembali ke Nano Banana.
- Cocokkan bentuk, logo, teks, warna, jumlah produk, latar putih 1:1. Catat keterbatasan; tidak mengklaim teks pasti identik.
- Buat 1 start frame dari foto GPT → produk terbaca benar (resolusi GPT ~1,57 MP tanpa upscale).
- Cek versi G-Labs di worker, endpoint `/api/openai/generate` tersedia, dan akun ChatGPT login. Jangan mencetak key/cookie/base64.
- Tes terarah + lint/build lulus.

## Deployment & rollback

- Per branch: commit/push, deploy Dev dengan full SHA (`npm run deploy:dev:atomic -- --ref <sha> --apply --confirm-dev`), tanpa `npm run release`.
- Naik Staging per bagian setelah pengguna menyatakan lolos Dev + minimal 1 hari (atau izin percepatan). Bagian B: **beri tahu migrasi 3 kolom** sebelum naik.
- Setelah gate: merge `--no-ff` ke main, `npm run release-non-interactive`, verifikasi tag, deploy SHA rilis ke Staging, hapus branch. Production tidak disentuh.
- Rollback: atomic rollback kode. Kolom baru tetap ada dan tidak mengganggu. Task GPT yang sedang berjalan tidak dibatalkan otomatis.

## Execution Task List

### Persiapan
- [x] Review usulan Codex & cek kode/dokumen G-Labs.
- [x] Arsipkan rencana Codex, susun rencana baru sesuai keputusan pengguna.
- [x] Konfirmasi ID model "Nano Banana 2.1" di worker G-Labs (default rencana: `nano_banana_2`).

### Bagian A — `fitur/scraper-foto-square`
- [x] Buat branch dari main terbaru.
- [x] Ubah model & rasio scraper (A1), audit pemakai `generated_photo_url`.
- [x] Perbarui kartu menu (A2), commit/push, deploy Dev.
- [x] Uji A3, laporkan ke pengguna, tunggu lolos uji + gate 1 hari.
- [x] Merge main, release, deploy Staging, hapus branch.

### Bagian B — `fitur/gpt-regenerate-manual`
- [x] Buat branch dari main terbaru (setelah A digabung bila sudah).
- [x] Buat mockup B8, sinkron ke Staging, HTTP 200, review pengguna.
- [x] Migrasi kolom (B1) + cek mekanisme migrasi Dev/Staging.
- [x] API regenerate (B2), worker (B3), provider (B4), helper OpenAI (B5), prompt (B6).
- [x] UI tombol & label (B7) setelah mockup disetujui.
- [x] Tes (B9), lint/build.
- [x] Kartu menu (B10), commit/push, deploy Dev.
- [x] Uji live 1 produk + 1 start frame di Dev, laporkan; catat tanggal mulai uji.
- [x] Beri tahu migrasi, tunggu lolos uji + gate 1 hari.
- [x] Merge main, release, deploy Staging, verifikasi, hapus branch.
- [x] Arsipkan rencana selesai & perbarui daftar isi.
