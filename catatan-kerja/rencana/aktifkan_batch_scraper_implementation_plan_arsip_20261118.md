# Implementation Plan: Aktifkan Tombol Batch Scraper + Pengaman Kuota & Tahap 1B (S3, S5, S6)

Tanggal: 18 November 2026 (Asia/Jakarta)
Instruksi sumber: `catatan-kerja/instruksi-agent/antigravity_aktifkan_batch_scraper_instructions.md`
Branch: `fitur/aktifkan-batch-scraper` (dari `main` `v2.53.0`)
Status: Selesai & lolos uji Dev (dipercepat atas izin pengguna, siap rilis v2.54.0 ke Staging).

---

## Ringkasan Cakupan

1. **Tahap 1 — Aktifkan Tombol & Pengaman Kuota/Data**:
   - **A**: Mengaktifkan tombol `⚡ Batch Scraper` di header `app/products/page.js` memakai token warna `app/theme.css`.
   - **B**: Menegakkan batas maksimal **50 URL** dan **50 baris CSV** di sisi API (`app/api/v2/products/scrape/route.js`).
   - **C**: Saat upload CSV, baris dengan kolom afiliasi kosong tidak lagi menghapus link afiliasi lama, dan `UPDATE` wajib memfilter `tenant_id`.
   - **D**: Centang *"Perbaiki & Lengkapi Data Produk yang Sudah Ada"* default **MATI** (`false`) + catatan kuota G-Labs & Gemini di modal.
   - **E**: Pembaruan kartu menu `sot/menus/kartu/products.md`.
2. **Tahap 1B — Penyempurnaan S3, S5, S6**:
   - **S3**: Satu fungsi bersama `assessProductCompleteness` (`lib/product-completeness.js`) untuk API dan worker; produk dengan `clean_photo_url` atau `cleaned_photo_url` dianggap cukup tanpa mewajibkan `generated_photo_url`.
   - **S5**: Kegagalan/timeout *Generative Polish* foto studio dicatat ke `raw_response.studio_polish` (tanpa mengubah `photo_status` / `photo_error`) dan ditampilkan sebagai satu baris keterangan `var(--status-warning)` di kartu/jendela tinjau produk.
   - **S6**: Membatasi antrean `product_scraper` maksimal **1 job berjalan bersamaan** lintas tick (`QUEUE_CONCURRENCY = { product_scraper: 1 }`) di `lib/scheduler.js`.

---

## Before & After (Tahap 1 + Tahap 1B)

### 2.1 `public/mockup_batch_scraper_aktif.html` (baru — sebelum kode aplikasi)
- Code Sebelum: belum ada.
- Code Sesudah: mockup HTML mandiri (token light/dark `app/theme.css`) berisi header tombol `⚡ Batch Scraper`, modal dengan default centang Perbaiki mati + catatan kuota, simulasi kirim → toast + banner latar belakang, serta preview baris catatan S5 di kartu produk.

### 2.2-A & D & S5 UI. `app/products/page.js`
Code Sebelum (Current/Before):
```jsx
const [repairMode, setRepairMode] = useState(true);
...
<button
  className="btn"
  disabled
  style={{
    background: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid #334155',
    color: 'var(--text-muted)',
    ...
    cursor: 'not-allowed',
    ...
  }}
>
  🔒 Batch Scraper (Locked)
</button>
...
// di modal:
<p ...>
  Jika diaktifkan, URL produk yang sudah ada di database namun kekurangan aset visual (raw/clean/studio) atau USP/Kemasan akan di-scrape ulang/dilengkapi secara otomatis.
</p>
```
Code Sesudah (Proposed/After):
```jsx
const [repairMode, setRepairMode] = useState(false);
...
<button
  type="button"
  className="btn btn-secondary"
  onClick={() => setShowScraperModal(true)}
  disabled={isSubmittingScraper}
  title="Tempel hingga 50 link Shopee/Tokopedia untuk ditambahkan otomatis"
  style={{
    background: 'var(--surface-interactive)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)',
    padding: '10px 16px',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: isSubmittingScraper ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease'
  }}
>
  ⚡ Batch Scraper
</button>
...
// di modal:
<p ...>
  Jika diaktifkan, URL produk yang sudah ada di database namun datanya belum lengkap akan di-scrape ulang. Memakai kuota G-Labs &amp; Gemini untuk setiap produk yang diperbaiki. Biarkan mati bila hanya menambah produk baru.
</p>
...
// catatan di bawah tombol kirim modal:
<div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  Setiap produk baru membuat 1 foto studio (Nano Banana 2) dan memakai kuota G-Labs &amp; Gemini. Maks 50 URL.
</div>
...
// S5 di kartu produk & jendela tinjau: bila raw_response.studio_polish.status === 'failed' | 'timeout'
<div style={{ fontSize: '11px', color: 'var(--status-warning)', marginTop: '3px' }}>
  ⚠️ Foto studio gagal dibuat ({studioPolish.error || studioPolish.status}) — foto bersih tetap dipakai.
</div>
```

### 2.2-B & C & S3 API. `app/api/v2/products/scrape/route.js`
Code Sebelum (Current/Before):
```js
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type FROM product_extractions WHERE tenant_id = ?').all(activeTenant);
...
const checkMissingComponents = (product) => {
  const rawFileMissing = !product.raw_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.raw_photo_url));
  const cleanFileMissing = !product.cleaned_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.cleaned_photo_url));
  const studioFileMissing = !product.generated_photo_url || !fs.existsSync(path.join(process.cwd(), 'public', product.generated_photo_url));
  const metadataMissing = !product.unique_selling_point || !product.packaging_type;
  return { rawFileMissing, cleanFileMissing, studioFileMissing, metadataMissing, anyMissing: rawFileMissing || cleanFileMissing || studioFileMissing || metadataMissing };
};
...
// CSV
await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ?').run(affiliate, existing.id);
updatedCount++;
...
// Manual URLs
const uniqueUrls = Array.from(new Set(urlList));
```
Code Sesudah (Proposed/After):
```js
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, clean_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, t2i_prompt, i2v_action_prompt FROM product_extractions WHERE tenant_id = ?').all(activeTenant);
...
const checkMissingComponents = (product) => assessProductCompleteness(product, {
  fileExists: (rel) => Boolean(rel && fs.existsSync(path.join(process.cwd(), 'public', rel)))
});
...
// CSV: batas 50 baris unik & jangan hapus link afiliasi kosong + filter tenant_id
if (uniqueCsvRows.length > 50) {
  return NextResponse.json({ success: false, error: `Maksimal 50 URL per batch. Anda memasukkan ${uniqueCsvRows.length}.` }, { status: 400 });
}
...
if (affiliate) {
  await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ? AND tenant_id = ?')
    .run(affiliate, existing.id, activeTenant);
  updatedCount++;
}
...
// Manual URLs
const uniqueUrls = Array.from(new Set(urlList));
if (uniqueUrls.length > 50) {
  return NextResponse.json({ success: false, error: `Maksimal 50 URL per batch. Anda memasukkan ${uniqueUrls.length}.` }, { status: 400 });
}
```

### S3 Shared Helper. `lib/product-completeness.js` (baru)
Code Sebelum (Current/Before): belum ada (logika terpisah di `route.js` & `scheduler-processors.js`).
Code Sesudah (Proposed/After):
```js
export function assessProductCompleteness(product, { fileExists } = {}) {
  const checkFile = (relPath) => Boolean(relPath && (typeof fileExists === 'function' ? fileExists(relPath) : true));
  const hasRaw = checkFile(product?.raw_photo_url);
  const hasClean = checkFile(product?.cleaned_photo_url) || checkFile(product?.clean_photo_url);
  const hasStudio = checkFile(product?.generated_photo_url);

  const needsRaw = !hasRaw;
  const needsClean = !hasClean;
  const needsStudio = !hasStudio && !hasClean; // foto bersih sudah cukup, studio tidak wajib
  const needsMetadata = !product?.unique_selling_point
    || !product?.packaging_type
    || !product?.t2i_prompt
    || !product?.i2v_action_prompt;

  return {
    needsRaw,
    needsClean,
    needsStudio,
    needsMetadata,
    anyMissing: needsRaw || needsClean || needsStudio || needsMetadata
  };
}
```

### S3 & S5 Worker. `lib/scheduler-processors.js`
Code Sebelum (Current/Before):
```js
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, scraped_image_url, raw_description, t2i_prompt, i2v_action_prompt, product_name FROM product_extractions WHERE tenant_id = ?').all(activeTenant);
...
const hasRawFile = existing.raw_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.raw_photo_url));
const hasCleanFile = existing.cleaned_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.cleaned_photo_url));
const hasStudioFile = existing.generated_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.generated_photo_url));
const needsRaw = !hasRawFile;
const needsClean = !hasCleanFile;
const needsStudio = !hasStudioFile;
const needsMetadata = !existing.unique_selling_point || !existing.packaging_type || !existing.t2i_prompt || !existing.i2v_action_prompt;
...
// Tahap 3: G-Labs Generative Polish (hanya console.warn jika gagal/timeout, tanpa mencatat status)
```
Code Sesudah (Proposed/After):
```js
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, clean_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, scraped_image_url, raw_description, t2i_prompt, i2v_action_prompt, product_name FROM product_extractions WHERE tenant_id = ?').all(activeTenant);
...
const { needsRaw, needsClean, needsStudio, needsMetadata, anyMissing } = assessProductCompleteness(existing, {
  fileExists: (rel) => Boolean(rel && fs.existsSync(path.join(process.cwd(), 'public', rel)))
});
if (!anyMissing) { ... continue; }
...
// Tahap 3: G-Labs Generative Polish mencatat studioPolish = { status, model: SCRAPER_POLISH_MODEL, task_id, error }
// di setiap cabang (completed, failed, timeout, download !ok, catch, skipped), lalu simpan ke raw_response.studio_polish
// tanpa mengubah photo_status maupun photo_error.
```

### S6 Queue Concurrency. `lib/scheduler.js`
Code Sebelum (Current/Before):
```js
async function processQueue(queueName) {
  const isAiQueue = AI_QUEUES.includes(queueName);
  const limit = isAiQueue ? 2 : 3;
  ...
  for (let i = 0; i < limit; i++) {
    if (isAiQueue && getActiveAiTasksCount(state.activeLocks) >= 2) break;
    const claim = await claimNextJobWithLock(queueName, state.activeLocks);
    ...
```
Code Sesudah (Proposed/After):
```js
const QUEUE_CONCURRENCY = { product_scraper: 1 };
if (!state.runningByQueue) state.runningByQueue = {};
...
async function processQueue(queueName) {
  const isAiQueue = AI_QUEUES.includes(queueName);
  const hasPerQueueCap = Object.prototype.hasOwnProperty.call(QUEUE_CONCURRENCY, queueName);
  const limit = hasPerQueueCap ? QUEUE_CONCURRENCY[queueName] : (isAiQueue ? 2 : 3);
  ...
  for (let i = 0; i < limit; i++) {
    if (hasPerQueueCap && (state.runningByQueue[queueName] || 0) >= QUEUE_CONCURRENCY[queueName]) break;
    if (isAiQueue && getActiveAiTasksCount(state.activeLocks) >= 2) break;
    const claim = await claimNextJobWithLock(queueName, state.activeLocks);
    if (!claim) break;
    if (hasPerQueueCap) state.runningByQueue[queueName] = (state.runningByQueue[queueName] || 0) + 1;
    ...
    // di finally executeJob:
    if (hasPerQueueCap) state.runningByQueue[queueName] = Math.max(0, (state.runningByQueue[queueName] || 1) - 1);
```

### 2.2-E Kartu Menu. `sot/menus/kartu/products.md`
Code Sebelum:
```md
11. Jendela banding punya tombol **🧠 Ulangi dengan GPT** ...
```
Code Sesudah:
```md
11. Jendela banding punya tombol **🧠 Ulangi dengan GPT** ...
12. Tombol **⚡ Batch Scraper** aktif kembali (maks 50 URL/CSV, centang *Perbaiki & Lengkapi* default mati, CSV tidak menimpa link afiliasi kosong, antrean `product_scraper` maks 1 job berjalan sekaligus, serta kegagalan foto studio dicatat di `raw_response.studio_polish` tanpa mengubah `photo_status`).
```

---

## Execution Task List

### Tahap 1 — Mockup & Pengaman Batch Scraper
- [x] Buat branch `fitur/aktifkan-batch-scraper` dari `main` terbaru (`v2.53.0`) & tulis rencana ini.
- [x] Buat mockup `public/mockup_batch_scraper_aktif.html`, sinkron ke Staging, verifikasi HTTP 200.
- [x] Berhenti dan tunggu persetujuan mockup dari pengguna.
- [x] Implementasi Tahap 1 (`2.2-A` tombol, `2.2-B` batas 50 URL/CSV, `2.2-C` CSV afiliasi + `tenant_id`, `2.2-D` default repair mati + catatan kuota).

### Tahap 1B — S3, S5, S6
- [x] Implementasi S3 (`lib/product-completeness.js` + pakai di API & worker).
- [x] Implementasi S5 (`studioPolish` di `raw_response.studio_polish` + baris warning `var(--status-warning)` di UI).
- [x] Implementasi S6 (`QUEUE_CONCURRENCY = { product_scraper: 1 }` lintas tick di `lib/scheduler.js`).

### Tes, Dev & Verifikasi
- [x] Buat/perluas tes untuk API 50 URL/CSV afiliasi/tenant, S3 (4 kasus), S5 (failed & timeout), S6 (3 job + 2 tick).
- [x] Perbarui `sot/menus/kartu/products.md`, jalankan tes & build, commit/push, deploy Dev (full SHA), verifikasi SOT.
- [x] Uji live di Dev (2–3 URL baru/lama + cek S3, S5, S6), laporkan ke pengguna + tanggal mulai masa uji Dev.
- [x] Tunggu lolos uji + gate 1 hari (atau izin percepatan), lalu merge `main`, release, deploy Staging, hapus branch, dan arsipkan rencana.
