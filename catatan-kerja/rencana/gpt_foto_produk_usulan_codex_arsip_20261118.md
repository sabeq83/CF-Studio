# Implementation Plan: GPT Image 2 Khusus Foto Studio Produk

Tanggal: 18 November 2026 (Asia/Jakarta)
Status: rencana saja; belum mengubah kode aplikasi, setting tenant, atau menjalankan generasi berbayar.
Branch saat inspeksi: `main`, working tree bersih. Implementasi berikutnya memakai `fitur/gpt-foto-produk`, dibuat dari main terbaru.

## Tujuan dan batas cakupan

- Settings menyediakan model khusus foto studio produk: Ikuti model gambar umum (nilai kosong), Nano Banana Pro, Nano Banana 2, Nano Banana 2 Lite, GPT Image 2 melalui G Labs (key internal `gpt_image_2`).
- GPT hanya memproses foto produk (raw → studio, generate ulang, dan polish scraper). Enrichment USP/Product Truth/Geometric Truth tetap Gemini.
- `webhook_image_model`, normalisasi model umum, pemilihan otomatis start frame, dan semua pemanggil video tetap memakai Nano Banana seperti sebelumnya. Jangan menambahkan GPT ke allowlist start frame.
- GPT: rasio 1:1, quality high, prompt_mode direct, reasoning none, web_search false. Untuk tahap pertama parameter ini preset tetap, sehingga UI cukup satu dropdown dan keterangan.
- Tidak ada fallback otomatis dari GPT ke Nano Banana. Kegagalan terlihat dan dapat diulang, foto lama tetap tersedia. Jalur Nano Banana lama mempertahankan kebijakan fallback yang ada.
- Pemilihan GPT berlaku untuk pekerjaan foto baru setelah setting disimpan; pekerjaan yang sudah berjalan diselesaikan dengan request sebelumnya. Tidak meregenerasi katalog otomatis.
- Tidak membutuhkan migrasi database: gunakan tenant_settings dan struktur status foto yang tersedia. Periksa ulang asumsi ini sebelum implementasi.

## Referensi dan temuan kode

Referensi: https://github.com/duckmartians/G-Labs-Studio/blob/main/WEBHOOK_INTEGRATION.en.md bagian 5.5.
GPT memakai `POST /api/openai/generate`; field model tidak diperlukan; reference positional tanpa @tag; satu gambar per request. Polling dan download memakai endpoint status/files yang sama. Dokumentasi bukan bukti worker terpasang sudah kompatibel: periksa versi dan akun login saat uji integrasi.

- `app/settings/page.js`: dropdown umum hanya Pro/2; tidak ada UI setting model khusus produk.
- `app/api/settings/route.js`: GET dan destructuring POST sudah memiliki product_photo_glabs_model, tetapi belum ada setSetting untuk nilai itu.
- `lib/product-photo-providers/glabs.js`: membaca setting khusus produk lalu umum, tetapi selalu memanggil generateImage (endpoint Flow).
- `lib/webhook-client.js`: model di luar tiga Nano Banana dinormalisasi menjadi Nano Banana 2. Karena itu GPT perlu adapter khusus, jangan diteruskan ke normalizer ini.
- `lib/product-bulk-worker.js`: memilih prompt hasil AI jika tersedia, melewati pengunci kemasan fallback. Reference diambil dari raw.
- `lib/scheduler-processors.js`: polish scraper mengunci Nano Banana Pro, 9:16, dan memakai foto yang sudah dibersihkan sebagai referensi.
- `scripts/glabs-worker.js`: antrean image memakai endpoint /api/image/generate. Tahap ini GPT akan submit langsung dari adapter khusus, sehingga tidak memperluas kontrak antrean bersama. Polling GPT tetap menggunakan task_id asli, bukan bullmq_. Nano Banana tetap mengikuti jalur existing (termasuk antrean bila aktif).

## Desain alur

Settings tenant → product_photo_glabs_model → provider foto produk:
- GPT → adapter khusus → /api/openai/generate → status/files existing → simpan sesuai kontrak masing-masing jalur foto.
- Nano Banana / ikut umum → generateImage existing → /api/image/generate.

Provider identitas tetap `glabs`; `gpt_image_2` adalah pilihan engine di dalam G Labs. Jangan menyimpan `photo_provider = gpt_image_2`, karena polling saat ini memfilter provider glabs. Pastikan tenant context aktif dalam worker dan scraper, dan setting tidak terbaca dari tenant default.

Prompt GPT wajib menggabungkan pengunci identitas dari buildCleanProductPrompt dengan instruksi clean_photo_t2i_prompt sebagai detail tambahan. Prioritas: foto referensi dan identitas asli menang atas deskripsi hasil AI yang berkonflik. Harus gagal jelas jika reference tidak tersedia, tidak jatuh ke generasi teks bebas. Jalur bulk memakai raw; scraper mengutamakan raw yang sudah tersimpan dan membolehkan clean sebagai referensi bila raw tidak tersedia. Tidak mengubah crop, background removal, atau kebijakan review yang ada.

## Mockup sebelum kode aplikasi

Buat `public/mockup_setting_foto_produk_gpt.html` dengan token semantik, light/dark, dropdown dan simulasi simpan lokal. Tampilkan dua baris: “Model foto studio produk: GPT Image 2” dan “Model start frame video: Nano Banana (pengaturan saat ini)”. Keterangan: “Hanya untuk foto produk. Enrichment data tetap Gemini.” Simulasi tidak memanggil API generasi.

Sinkronkan hanya file mockup ke lokasi public runtime Staging setelah memeriksa current/shared sesuai SOT deployment. Verifikasi HTTP 200 dan bagikan `http://100.95.245.55:5010/mockup_setting_foto_produk_gpt.html` untuk review pengguna sebelum mengubah React/Next.js. URL ini rencana, belum tersedia. Jangan deploy fitur ke Staging pada tahap mockup.

## Perubahan per file — Code Sebelum dan Code Sesudah

Potongan After adalah rancangan kontrak, bukan patch siap dieksekusi. Bila ditemukan file tambahan yang perlu diubah, lengkapi bagian Before/After ini dahulu.

### 1. app/settings/page.js
Code Sebelum (Current/Before):
```js
const [webhookImageModel, setWebhookImageModel] = useState('nano_banana_pro');
// save body
webhook_image_model: webhookImageModel,
```
Code Sesudah (Proposed/After):
```jsx
const [productPhotoGlabsModel, setProductPhotoGlabsModel] = useState('');
// load: setProductPhotoGlabsModel(data.data.product_photo_glabs_model || '');
// save body: product_photo_glabs_model: productPhotoGlabsModel,
<select value={productPhotoGlabsModel} onChange={e => setProductPhotoGlabsModel(e.target.value)}>
  <option value="">Ikuti model gambar umum</option>
  <option value="nano_banana_pro">Nano Banana Pro</option>
  <option value="nano_banana_2">Nano Banana 2</option>
  <option value="nano_banana_2_lite">Nano Banana 2 Lite</option>
  <option value="gpt_image_2">GPT Image 2 — G Labs</option>
</select>
```
Gunakan class form existing dan token app/theme.css. Setting provider glabs harus efektif untuk pilihan ini: bila tenant sedang memakai provider gemini, tampilkan keterangan dan simpan pilihan provider glabs secara eksplisit saat pengguna mengaktifkan model G Labs. Jangan membiarkan setting tampak aktif tetapi diabaikan.

### 2. app/api/settings/route.js
Code Sebelum (Current/Before):
```js
if (product_photo_provider !== undefined) await setSetting('product_photo_provider', product_photo_provider);
if (product_photo_gemini_model !== undefined) await setSetting('product_photo_gemini_model', product_photo_gemini_model);
```
Code Sesudah (Proposed/After):
```js
// Validasi semua nilai request terkait sebelum write pertama.
const allowedPhotoModels = ['', 'nano_banana_pro', 'nano_banana_2', 'nano_banana_2_lite', 'gpt_image_2'];
// Nilai bukan string / di luar daftar -> HTTP 400, tidak mengubah setting.
if (product_photo_glabs_model !== undefined) {
  await setSetting('product_photo_glabs_model', product_photo_glabs_model);
}
```
GET yang ada dipertahankan; tenant authorization existing wajib berlaku.

### 3. lib/product-photo-providers/glabs.js
Code Sebelum (Current/Before):
```js
const response = await generateImage({
  prompt, model: model || undefined, aspect_ratio: '1:1',
  reference_images: referenceImage ? [referenceImage] : undefined
});
```
Code Sesudah (Proposed/After):
```js
const response = model === 'gpt_image_2'
  ? await generateProductPhotoWithOpenAI({ referenceImage, prompt, tenantId })
  : await generateImage({
      prompt, model: model || undefined, aspect_ratio,
      reference_images: referenceImage ? [referenceImage] : undefined
    });
```
Tambahkan opsi aspect_ratio dengan default 1:1 untuk menjaga rasio scraper lama pada jalur Nano Banana; GPT tetap 1:1. Polling mengembalikan pesan error provider yang aman dan berguna; tanpa secret atau base64 dalam log.

### 4. lib/webhook-client.js
Code Sebelum (Current/Before):
```js
export async function generateImage({ prompt, model, aspect_ratio, reference_images, expected_reference_sha256s, upscale, webhookOverride }) {
  // Flow: normalisasi Nano Banana -> /api/image/generate
}
```
Code Sesudah (Proposed/After):
```js
// Ekspor helper khusus produk; generateImage dan normalizer existing tetap utuh.
export async function generateProductPhotoWithOpenAI({ referenceImage, prompt, tenantId }) {
  if (!referenceImage) throw new Error('Foto referensi produk wajib tersedia');
  const endpoint = resolveWebhookEndpoint();
  const body = {
    prompt, aspect_ratio: '1:1', quality: 'high', prompt_mode: 'direct',
    reasoning: 'none', web_search: false, reference_images: [referenceImage]
  };
  // POST endpoint.baseUrl + '/api/openai/generate', X-API-Key dari endpoint.
  // Validasi HTTP, task_id; timeout submit; tanpa retry lintas engine.
  // Catat routing task memakai mekanisme existing agar polling/download ke host submit.
}
```
Jangan melewatkan prompt GPT melalui sanitizer Flow yang dapat menghapus instruksi identitas; reuse hanya helper transport/endpoint/status yang sesuai. Respect delay/rate limiting existing untuk pengiriman image. Audit kontrak route persistence sebelum menulis helper.

### 5. lib/product-bulk-worker.js
Code Sebelum (Current/Before):
```js
const prompt = clean_photo_t2i_prompt || buildCleanProductPrompt(job);
```
Code Sesudah (Proposed/After):
```js
const provider = await resolveProductPhotoProvider(job, tenantId);
// Untuk GPT, komposisi prompt di provider wajib mengunci identitas dengan konteks job.
const prompt = clean_photo_t2i_prompt || buildCleanProductPrompt(job);
// generateWithGlabs({ referenceImage, prompt, tenantId, product: job })
```
Teruskan konteks produk agar provider menggabungkan prompt GPT; jangan mengubah prompt Nano Banana yang sudah ada. Hilangkan deklarasi provider ganda saat patch. Foto lama dan previous_clean_photo_url tetap mengikuti mekanisme save/revert existing.

### 6. lib/scheduler-processors.js (hanya blok product scraper polish)
Code Sebelum (Current/Before):
```js
const glabsResult = await generateGlabsImage({
  prompt: productData.t2i_prompt, model: 'nano_banana_pro',
  aspect_ratio: '9:16', reference_images: [cleanedDataUrl]
});
```
Code Sesudah (Proposed/After):
```js
const result = await generateWithGlabs({
  referenceImage: productReferenceDataUrl,
  prompt: productData.t2i_prompt,
  product: productData,
  tenantId: activeTenant,
  aspect_ratio: '9:16'
});
const glabsTaskId = result.taskId;
// Pakai glabsTaskId dalam loop status existing.
```
Provider memilih model khusus produk, GPT override rasio 1:1. Adaptasi taskId vs task_id eksplisit. Pertahankan tujuan penyimpanan generated_photo_url pada scraper dan clean_photo_url pada bulk; perubahan kontrak slot foto bukan bagian fitur ini. Audit semua jalur foto produk manual/MCP/replace untuk memastikan akhirnya memakai resolver yang sama; bila ada jalur tambahan, tambahkan rencana sebelum patch.

### 7. tests/product-photo-gpt-routing.test.js (baru)
Code Sebelum (Current/Before): file belum ada.
Code Sesudah (Proposed/After):
```js
// Mock fetch dan setting tenant; tidak mengirim generasi live.
// assert GPT -> /api/openai/generate; Nano Banana -> /api/image/generate.
// assert GPT ref wajib, direct/high/1:1, tidak ada model/upscale/Flow sanitizer.
// assert gagal GPT tidak submit Nano Banana dan mempertahankan foto sebelumnya.
// assert dua tenant tidak saling mewarisi setting.
```

### 8. tests/product-photo-model-settings.test.js (baru)
Code Sebelum (Current/Before): file belum ada.
Code Sesudah (Proposed/After):
```js
// Simpan/baca ulang semua pilihan termasuk kosong; invalid -> 400 sebelum write.
// Simpan model produk tidak mengubah webhook_image_model.
// Regresi start frame tetap memilih Nano Banana, termasuk saat GPT produk aktif.
```

### 9. public/mockup_setting_foto_produk_gpt.html (baru)
Code Sebelum (Current/Before): file belum ada.
Code Sesudah (Proposed/After):
```html
<style>
/* definisi token mandiri light/dark mengikuti app/theme.css */
.panel { background: var(--surface); color: var(--text-primary); border: 1px solid var(--border-subtle); }
</style>
<section class="panel">
  <label for="photo-model">Model foto studio produk</label>
  <select id="photo-model"><option>GPT Image 2 — G Labs</option></select>
  <p>Hanya untuk foto produk. Enrichment data tetap Gemini.</p>
</section>
```
Lengkapi pilihan lain dan simulasi interaktif saat pelaksanaan mockup.

### 10. sot/menus/kartu/settings.md
Code Sebelum (Current/Before):
```md
Pusat konfigurasi sistem dan koneksi layanan pihak ketiga.
```
Code Sesudah (Proposed/After):
```md
- Model foto studio produk dipilih per tenant, terpisah dari model start frame video.
- GPT Image 2 melalui G Labs: kualitas High, Direct, 1:1; tanpa fallback lintas engine.
```
Tambahkan poin pada kartu, perbarui tanggal/versi sesuai rilis nyata.

### 11. sot/menus/kartu/products.md
Code Sebelum (Current/Before):
```md
3. Generative polish membutuhkan G-Labs API aktif (cek `tenant_settings`).
```
Code Sesudah (Proposed/After):
```md
3. Generative polish memakai model foto produk dari Settings tenant; GPT Image 2 membutuhkan akun OpenAI aktif di G Labs. Enrichment metadata tetap Gemini, start frame tetap Nano Banana.
```
Perbarui tanggal/versi saat rilis, dokumentasikan retry dan preservation foto lama.

## Verifikasi dan kriteria diterima

- Mockup disajikan HTTP 200 di Staging, light/dark dan kontrol diuji manual oleh pengguna sebelum coding React.
- Settings GPT tersimpan per tenant, tetap sama setelah reload; tenant lain dan webhook_image_model tidak berubah.
- Mock HTTP membuktikan GPT hanya masuk endpoint OpenAI; ref wajib, tanpa silent normalization/fallback.
- Uji bulk, regenerate dan scraper: task tersimpan/dipoll dengan benar; foto tersimpan pada slot existing, approval/revert tetap berfungsi; gagal tidak menghapus foto lama.
- Uji dengan antrean enabled: produk GPT tetap submit langsung dan poll task_id asli; Nano Banana tetap lewat jalur existing. Ketergantungan antrean bersama tidak diubah.
- Uji regresi start frame membuktikan tetap Nano Banana; tidak perlu menghasilkan video berbayar untuk membuktikan routing.
- Jalankan tes relevan existing foto produk, lint/build sesuai scripts repo. Tambahkan tes bermakna routing dan setting, tanpa snapshot kosmetik.
- Uji live terbatas di Dev pada satu produk berlabel jelas: cocokkan bentuk, logo, teks, jumlah produk, warna, hasil putih 1:1. Catat keterbatasan visual, tidak mengklaim teks AI pasti identik.
- Periksa versi G Labs, endpoint OpenAI, dan login akun pada worker sebelum live. Jangan mencetak key/cookie/base64.

## Deployment dan rollback

Baca `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` saat eksekusi. Commit/push branch fitur, deploy Dev memakai full SHA remote. Laporkan link Dev dan checklist manual. Tidak menjalankan release pada branch fitur.
Staging hanya setelah pengguna eksplisit menyatakan lolos Dev dan minimal satu hari di Dev atau izin percepatan eksplisit. Setelah gate: merge main, release noninteraktif, verifikasi tag/main remote, deploy SHA rilis Staging, hapus branch yang sudah digabung. Tidak deploy Production.
Rollback operasional: kembalikan pilihan foto produk ke model sebelumnya untuk job baru; task GPT aktif tidak otomatis dibatalkan. Gunakan rollback atomic bila kode bermasalah. Tidak ada perubahan otomatis terhadap foto katalog lama.

## Execution Task List

- [x] Inspeksi Settings, API, provider produk, worker bulk, scraper, antrean dan referensi G Labs.
- [x] Arsipkan rencana lama dan susun rencana aktif beserta Before/After.
- [ ] Periksa main remote terbaru lalu buat branch fitur; baca panduan Next relevan sebelum mengedit kode.
- [ ] Audit semua entry point foto produk serta tenant/task routing; lengkapi rencana jika cakupan file berubah.
- [ ] Buat mockup HTML, sinkronkan ke Staging, verifikasi HTTP 200, dan tampilkan untuk review pengguna.
- [ ] Selesaikan review mockup pengguna sebelum coding React/Next.js.
- [ ] Implementasikan penyimpanan/validasi setting dan kontrol UI khusus foto produk.
- [ ] Implementasikan adapter GPT, prompt identity lock dan error tanpa fallback lintas engine.
- [ ] Hubungkan bulk/regenerate dan scraper, pertahankan kontrak slot foto serta start frame.
- [ ] Jalankan tes terarah dan build, perbarui kartu menu dengan status implementasi yang akurat.
- [ ] Commit/push fitur dan deploy full SHA ke Dev; verifikasi health sesuai SOT.
- [ ] Uji live terbatas dan review pengguna di Dev; catat tanggal mulai masa uji.
- [ ] Penuhi persetujuan lolos Dev dan gate satu hari atau izin percepatan eksplisit.
- [ ] Merge main, finalisasi kartu versi rilis, release/push tag, deploy Staging dan verifikasi.
- [ ] Hapus branch selesai, arsipkan rencana selesai dan perbarui daftar isi.
