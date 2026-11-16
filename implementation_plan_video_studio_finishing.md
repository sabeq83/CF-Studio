# Implementation Plan — Video Studio Finishing Template (Fase 2–4)

Tanggal: 16 Nov 2026 | Status: **Menunggu persetujuan pengguna**
Mockup disetujui: ✅ (16 Nov 2026)
Instruksi sumber: `antigravity_video_studio_finishing_render_instructions.md`

> [!IMPORTANT]
> Dokumen ini harus disetujui pengguna sebelum satu baris kode pun diubah di luar file ini.

---

## Execution Task List

- [x] **Fase 2.1** — Fix bug `await` antrean di `lib/video-studio-processor.js` (commit `fix(video-studio): await queue db calls`)
- [x] **Fase 2.1** — Tambah test kecil antrean berhenti saat tidak ada job pending
- [x] **Fase 2.1** — Deploy Staging, ambil frame "before" (render `none`, simpan di `scratch/.../before/`)
- [x] **Fase 2.2** — Buat `scripts/migrate-ffmpeg-studio-finishing-fields.mjs`, jalankan ke `dev` → `staging`
- [x] **Fase 2.2** — Update `createFfmpegStudioJob` di `lib/db.js` (tambah kolom baru, INSERT lama tetap jalan)
- [x] **Fase 2.2** — Update `app/api/video-studio/render/route.js` (terima & validasi parameter finishing)
- [x] **Fase 2.2** — Update `triggerFfmpegStudioQueue()` (parse `finishing_config`, teruskan ke engine)
- [x] **Fase 2.2** — Uji POST manual: `none`, `recipe_pop`, `problem_solution` dengan batch TTS + plan
- [x] **Fase 3** — Buat `GET /api/video-studio/finishing-source` (ambil plan dari campaign asal)
- [x] **Fase 3** — Uji setara campaign: render "Pakai apa adanya" vs frame campaign asli
- [x] **Fase 4** — Buat `lib/render-slot.js` (`acquireProductionSlot`, `isProductionActive`, `getNextScheduledProductionAt`)
- [x] **Fase 4** — Bungkus 5 pemanggilan `processTtsStudioMuxing` di `scheduler-processors.js` + `re-multiplier-worker.js`
- [x] **Fase 4** — Update `triggerFfmpegStudioQueue()` (yield logic + shouldYield + re-queue)
- [x] **Fase 4** — Buat `tests/render-slot.test.js`
- [x] **Fase 4** — Deploy Staging, verifikasi log slot acquire/release
- [x] **Fase 5** — UI Panel Finishing (`FinishingPanel`, `TemplateGallery`, `CampaignSourceBanner`, dll.)
- [x] **Fase 6** — Dukungan audio upload Mode A & Mode B + transkripsi & word-timing fallback
- [x] **Fase 7** — Plan cadangan: AI generator (`finishing-plan-generate`) & form manual (`finishing-plan-validate`)
- [x] **Fase 8** — Final test suite, dokumentasi SOT, rilis dan deploy Staging

---

## Fase 2.1 — Perbaikan Bug `await` Antrean

### File: `lib/video-studio-processor.js`

#### Code Sebelum (Current)

```js
// lib/video-studio-processor.js — fungsi triggerFfmpegStudioQueue()

while (true) {
  const job = getPendingFfmpegStudioJob();           // ← BUG: tanpa await
  if (!job) {
    console.log('[Video Studio Queue] No pending rendering jobs found in queue.');
    break;
  }

  console.log(`[Video Studio Queue] Processing job ${job.id}...`);
  updateFfmpegStudioJob(job.id, { status: 'processing' });   // ← BUG: tanpa await

  try {
    // ... render ...

    updateFfmpegStudioJob(job.id, {                          // ← BUG: tanpa await
      status: 'completed',
      output_path: `/rendered/${job.id}.mp4`
    });

  } catch (err) {
    console.error(`[Video Studio Queue] Job ${job.id} processing failed:`, err);
    updateFfmpegStudioJob(job.id, {                          // ← BUG: tanpa await
      status: 'failed',
      error_log: err.message || String(err)
    });
  }
}
```

#### Code Sesudah (Proposed)

```js
// lib/video-studio-processor.js — fungsi triggerFfmpegStudioQueue()

while (true) {
  const job = await getPendingFfmpegStudioJob();     // ← FIX: tambah await
  if (!job) {
    console.log('[Video Studio Queue] No pending rendering jobs found in queue.');
    break;
  }

  console.log(`[Video Studio Queue] Processing job ${job.id}...`);
  await updateFfmpegStudioJob(job.id, { status: 'processing' });   // ← FIX

  try {
    // ... render (tidak ada perubahan lain di Fase 2.1) ...

    await updateFfmpegStudioJob(job.id, {                          // ← FIX
      status: 'completed',
      output_path: `/rendered/${job.id}.mp4`
    });

  } catch (err) {
    console.error(`[Video Studio Queue] Job ${job.id} processing failed:`, err);
    await updateFfmpegStudioJob(job.id, {                          // ← FIX
      status: 'failed',
      error_log: err.message || String(err)
    });
  }
}
```

**Commit terpisah:** `fix(video-studio): await queue db calls in triggerFfmpegStudioQueue`

---

## Fase 2.2 — Migrasi DB, API, Queue Parameter

### File baru: `scripts/migrate-ffmpeg-studio-finishing-fields.mjs`

#### Code Sesudah (file baru, polanya dari `migrate-brand-finishing-fields.mjs`)

```js
/**
 * scripts/migrate-ffmpeg-studio-finishing-fields.mjs
 * Migrasi idempotent kolom finishing pada tabel ffmpeg_studio_jobs.
 * Pemakaian: node scripts/migrate-ffmpeg-studio-finishing-fields.mjs [dev|staging|public]
 */
process.env.DISABLE_AUTO_MIGRATIONS = 'true';
import { getPgPool } from '../lib/db-pg.js';

const ALLOWED_SCHEMAS = new Set(['dev', 'staging', 'public']);

export const FFMPEG_STUDIO_FINISHING_DDL = `
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_template TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_config TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS progress_stage TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_status TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS audio_mode TEXT NULL;
  ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS yield_count INTEGER NOT NULL DEFAULT 0;
`;

export async function migrateFfmpegStudioFinishing(targetSchema = 'dev') {
  if (!ALLOWED_SCHEMAS.has(targetSchema)) throw new Error(`Schema tidak valid: "${targetSchema}"`);
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);
    await client.query(`SELECT pg_advisory_lock(hashtext('makna_ffmpeg_studio_finishing_v1'));`);
    await client.query(FFMPEG_STUDIO_FINISHING_DDL);
    console.log(`✅ Kolom diverifikasi di schema "${targetSchema}".`);
    return true;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('makna_ffmpeg_studio_finishing_v1'));`).catch(() => {});
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate-ffmpeg-studio-finishing-fields.mjs')) {
  const schemaArg = process.argv[2] || process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'dev';
  migrateFfmpegStudioFinishing(schemaArg)
    .then(async () => { await getPgPool().end(); process.exit(0); })
    .catch(async (err) => {
      console.error('❌ Gagal:', err.message);
      await getPgPool().end().catch(() => {});
      process.exit(1);
    });
}
```

---

### File: `lib/db.js` — `createFfmpegStudioJob`

#### Code Sebelum (Current)

```js
export async function createFfmpegStudioJob(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO ffmpeg_studio_jobs (
      id, video_source_type, video_path, audio_source_type, audio_path,
      sync_option, bgm_path, bgm_volume, sfx_volume, video_scale, output_path, status, error_log
    )
    VALUES (
      @id, @video_source_type, @video_path, @audio_source_type, @audio_path,
      @sync_option, @bgm_path, @bgm_volume, @sfx_volume, @video_scale, @output_path, @status, @error_log
    )
  `);
  return await stmt.run([job]);
}
```

#### Code Sesudah (Proposed)

```js
export async function createFfmpegStudioJob(job) {
  const db = getDb();
  // Kolom finishing baru: default NULL/0 — job lama yang tidak menyertakannya tetap jalan
  const payload = {
    finishing_template: null,
    finishing_config: null,
    progress_stage: null,
    finishing_status: null,
    audio_mode: null,
    yield_count: 0,
    ...job  // override default dengan nilai dari caller jika ada
  };
  const stmt = db.prepare(`
    INSERT INTO ffmpeg_studio_jobs (
      id, video_source_type, video_path, audio_source_type, audio_path,
      sync_option, bgm_path, bgm_volume, sfx_volume, video_scale, output_path, status, error_log,
      finishing_template, finishing_config, progress_stage, finishing_status, audio_mode, yield_count
    )
    VALUES (
      @id, @video_source_type, @video_path, @audio_source_type, @audio_path,
      @sync_option, @bgm_path, @bgm_volume, @sfx_volume, @video_scale, @output_path, @status, @error_log,
      @finishing_template, @finishing_config, @progress_stage, @finishing_status, @audio_mode, @yield_count
    )
  `);
  return await stmt.run([payload]);
}
```

---

### File: `app/api/video-studio/render/route.js`

#### Code Sebelum (Current) — bagian destructuring body & pembuatan jobRecord

```js
// Destructuring (baris 17–27)
const {
  video_source_type,
  video_path,
  audio_source_type,
  audio_path,
  sync_option,
  bgm_file,
  bgm_volume,
  sfx_volume,
  video_scale
} = body;

// ... (validasi & resolve path, tidak berubah) ...

// jobRecord (baris ~186–197)
const jobRecord = {
  id: jobId,
  video_source_type,
  video_path: JSON.stringify(resolvedVideoPaths),
  audio_source_type,
  audio_path: resolvedAudioPath,
  sync_option,
  bgm_path: bgmPath,
  bgm_volume: bgm_volume !== undefined ? parseFloat(bgm_volume) : 0.15,
  sfx_volume: sfx_volume !== undefined ? parseFloat(sfx_volume) : 0.0,
  video_scale: video_scale !== undefined ? parseFloat(video_scale) : 1.0,
  output_path: null,
  status: 'pending',
  error_log: null
};
```

#### Code Sesudah (Proposed)

```js
// Destructuring — tambah 3 field finishing
const {
  video_source_type,
  video_path,
  audio_source_type,
  audio_path,
  sync_option,
  bgm_file,
  bgm_volume,
  sfx_volume,
  video_scale,
  finishing_template,   // NEW
  finishing_config,     // NEW — JSON string
  audio_mode            // NEW — 'tts_batch' | 'single' | 'per_clip'
} = body;

// === VALIDASI FINISHING (disisipkan setelah validasi sync_option yang sudah ada) ===

// 1. Validasi template (registry check)
const { FINISHING_TEMPLATE_IDS, isRichFinishingTemplate, hasStrictTemplateCompliance } =
  await import('@/lib/finishing-template-registry');
const resolvedTemplate = finishing_template || 'none';
if (!FINISHING_TEMPLATE_IDS.includes(resolvedTemplate)) {
  return NextResponse.json(
    { success: false, error: `Template finishing tidak dikenal: "${resolvedTemplate}"` },
    { status: 400 }
  );
}

// 2. Parse finishing_config dengan aman
let parsedFinishingConfig = {};
if (finishing_config) {
  try { parsedFinishingConfig = JSON.parse(finishing_config); } catch (_) {
    console.warn('[Video Studio Render API] finishing_config JSON rusak, diabaikan.');
    // Render tetap jalan tanpa finishing (finishing_status = 'skipped' di queue)
  }
}

// 3. Template kaya → plan wajib + validasi
if (isRichFinishingTemplate(resolvedTemplate)) {
  const plan = parsedFinishingConfig?.finishingPlan || null;
  if (!plan) {
    return NextResponse.json(
      { success: false, error: `Template "${resolvedTemplate}" membutuhkan finishing plan. Buat plan dengan AI atau isi manual.` },
      { status: 400 }
    );
  }
  const { validateFinishingPlan } = await import('@/lib/finishing-plan-validator');
  const strictClaims = hasStrictTemplateCompliance(resolvedTemplate);
  const isHerbalProduct = parsedFinishingConfig?.isHerbalProduct ?? true;
  const validationResult = validateFinishingPlan(plan, {
    finishingTemplate: resolvedTemplate,
    strictClaims,
    isHerbalProduct,
    cleanVoiceoverClips: Array(resolvedVideoPaths.length).fill({ text: '' }),
  });
  const errors = (validationResult?.warnings || []).filter(w =>
    w.startsWith('error_') || w.startsWith('claim_')
  );
  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, error: `Plan tidak valid untuk "${resolvedTemplate}": ${errors.join(', ')}`, warnings: validationResult.warnings },
      { status: 400 }
    );
  }
}

// 4. Cek pasangan klip untuk mode per_clip
const resolvedAudioMode = audio_mode || (audio_source_type === 'tts_studio' ? 'tts_batch' : 'single');
if (resolvedAudioMode === 'per_clip') {
  let audioPaths = [];
  try { audioPaths = JSON.parse(audio_path); } catch { audioPaths = [audio_path]; }
  if (!Array.isArray(audioPaths) || audioPaths.length !== resolvedVideoPaths.length) {
    return NextResponse.json(
      { success: false, error: `Mode "satu audio per klip": video ${resolvedVideoPaths.length} klip, audio ${audioPaths.length} file. Harus sama.` },
      { status: 400 }
    );
  }
}

// ... (kode BGM resolve tidak berubah) ...

// jobRecord — tambah kolom baru
const jobRecord = {
  id: jobId,
  video_source_type,
  video_path: JSON.stringify(resolvedVideoPaths),
  audio_source_type,
  audio_path: resolvedAudioPath,
  sync_option,
  bgm_path: bgmPath,
  bgm_volume: bgm_volume !== undefined ? parseFloat(bgm_volume) : 0.15,
  sfx_volume: sfx_volume !== undefined ? parseFloat(sfx_volume) : 0.0,
  video_scale: video_scale !== undefined ? parseFloat(video_scale) : 1.0,
  output_path: null,
  status: 'pending',
  error_log: null,
  // === BARU ===
  finishing_template: resolvedTemplate,
  finishing_config: JSON.stringify(parsedFinishingConfig),
  audio_mode: resolvedAudioMode,
  progress_stage: null,
  finishing_status: null,
  yield_count: 0
};
```

---

### File: `lib/video-studio-processor.js` — Queue meneruskan parameter finishing

#### Code Sebelum (Current) — blok TTS render

```js
if (job.audio_source_type === 'tts_studio') {
  await processTtsStudioMuxing({
    id: job.id,
    videoPath: job.video_path,
    batchId: job.audio_path,
    syncOption: job.sync_option,
    bgmPath: job.bgm_path,
    bgmVolume: bgmVolume,
    sfxVolume: sfxVolume,
    videoScale: videoScale,
    outputPath: outputPath
  });
}

await updateFfmpegStudioJob(job.id, {
  status: 'completed',
  output_path: `/rendered/${job.id}.mp4`
});
```

#### Code Sesudah (Proposed)

```js
if (job.audio_source_type === 'tts_studio') {
  // Parse finishing_config dengan aman
  let fc = {};
  try { fc = JSON.parse(job.finishing_config || '{}'); } catch (_) {
    console.warn(`[Video Studio Queue] finishing_config job ${job.id} rusak → render tanpa finishing.`);
  }
  const finishingTemplate = job.finishing_template || 'none';

  await updateFfmpegStudioJob(job.id, { progress_stage: 'sync_clips' });

  await processTtsStudioMuxing({
    id: job.id,
    videoPath: job.video_path,
    batchId: job.audio_path,
    syncOption: job.sync_option,
    bgmPath: job.bgm_path,
    bgmVolume,
    sfxVolume,
    videoScale,
    outputPath,
    // === Parameter finishing (semua opsional — pemanggil produksi tidak terpengaruh) ===
    finishingTemplate,
    finishingPlan:         fc.finishingPlan        ?? null,
    captionMode:           fc.captionMode          ?? 'full',
    brand:                 fc.brand                ?? null,
    brandPatch:            fc.brandPatch           ?? null,
    brandName:             fc.brandName            ?? '',
    hookTitle:             fc.hookTitle            ?? '',
    captionText:           fc.captionText          ?? '',
    videoTransition:       fc.videoTransition      ?? 'cut',
    transitionDuration:    fc.transitionDuration   ?? 0.5,
    enableCameraMotion:    fc.enableCameraMotion   ?? null,
    platform:              fc.platform             ?? 'tiktok',
    loudnessTarget:        fc.loudnessTarget       ?? -14,
    recipeData:            fc.recipeData           ?? null,
    productData:           fc.productData          ?? null,
    isHerbalProduct:       fc.isHerbalProduct      ?? true,
    targetLanguage:        fc.targetLanguage       ?? 'id-ID',
    voiceoverTexts:        fc.voiceoverTexts       ?? null,
    batchDataOverride:     fc.batchDataOverride    ?? null,
    onProgress: async (stage) => {
      await updateFfmpegStudioJob(job.id, { progress_stage: stage }).catch(() => {});
    },
  });

  const finishing_status = (finishingTemplate !== 'none') ? 'applied' : null;

  await updateFfmpegStudioJob(job.id, {
    status: 'completed',
    output_path: `/rendered/${job.id}.mp4`,
    progress_stage: 'done',
    finishing_status
  });
}
```

---

## Fase 3 — API `finishing-source` (Plan dari Campaign Asal)

### File baru: `app/api/video-studio/finishing-source/route.js`

**GET** `?video_source_type=re_campaign|instant_factory&video_path=<encoded>`

Logika:
1. Parse `video_path` → extract `itemId` dari format `re::itemId::clipN`
2. Query DB: `re_campaign_items` JOIN `campaigns` JOIN `tasks`
3. Panggil `resolvePreRenderFinishingMeta({ db, campaign, item })` — persis sama dengan produksi
4. Cek batch TTS terkait item
5. Validasi ulang plan yang ditemukan
6. Return JSON lengkap atau `{ conflict: true }` jika video dari campaign berbeda

Tidak ada `Code Sebelum` karena ini file baru.

---

## Fase 4 — Slot Render Bersama

### File baru: `lib/render-slot.js`

Tidak ada `Code Sebelum` karena ini file baru.

Fungsi yang diekspos:
- `acquireProductionSlot({ env, jobRef })` → `{ release() }` — TIDAK PERNAH throw
- `isProductionActive()` → `boolean` — sinkron, baca sistem file
- `getNextScheduledProductionAt()` → `Promise<number|null>` — query Postgres

### File: `lib/scheduler-processors.js` + `lib/re-multiplier-worker.js` — Wrapper produksi

Hanya tambah `acquireProductionSlot` import + `try/finally` di kelima titik pemanggilan.
**Argumen `processTtsStudioMuxing` tidak berubah sama sekali.**

#### Code Sebelum (pola umum di kelima lokasi)

```js
await processTtsStudioMuxing({
  id: ...,
  videoPath: ...,
  // ... semua argumen
});
```

#### Code Sesudah

```js
import { acquireProductionSlot } from './render-slot.js'; // sekali di atas file

// Di tiap dari 5 lokasi:
const _slot = await acquireProductionSlot({
  env: process.env.PG_SEARCH_PATH?.split(',')[0]?.trim() || 'staging',
  jobRef: String(item?.id || task?.id || '')
});
try {
  await processTtsStudioMuxing({
    id: ...,
    videoPath: ...,
    // ... SEMUA argumen persis sama, tidak ada yang diubah
  });
} finally {
  _slot.release();
}
```

### File: `lib/video-studio-processor.js` — Yield logic (penambahan di queue loop)

#### Code Sebelum

```js
// Di awal while(true) loop — langsung getPendingFfmpegStudioJob
while (true) {
  const job = await getPendingFfmpegStudioJob();
  if (!job) { break; }
  // ...
```

#### Code Sesudah

```js
import { isProductionActive, getNextScheduledProductionAt } from './render-slot.js';

// Di awal while(true) loop:
while (true) {
  // === YIELD CHECK: jangan mulai jika produksi aktif ===
  if (isProductionActive()) {
    console.log('[Video Studio Queue] Produksi aktif. Job ditunda 60 dtk.');
    globalRef.ffmpegStudioQueueActive = false;
    setTimeout(() => triggerFfmpegStudioQueue(), 60_000);
    return;
  }
  // === YIELD CHECK: jangan mulai jika produksi dijadwalkan segera ===
  const nextProdAt = await getNextScheduledProductionAt();
  if (nextProdAt) {
    const msUntilProd = nextProdAt - Date.now();
    const estMs = 1 * 40_000; // placeholder; akan dikalibrasi dari log Fase 2.1
    if (msUntilProd > 0 && msUntilProd < estMs) {
      console.log(`[Video Studio Queue] Produksi dijadwalkan dalam ${Math.round(msUntilProd/1000)}s. Ditunda.`);
      globalRef.ffmpegStudioQueueActive = false;
      setTimeout(() => triggerFfmpegStudioQueue(), Math.min(msUntilProd + 5_000, 60_000));
      return;
    }
  }

  const job = await getPendingFfmpegStudioJob();
  if (!job) { break; }
  // ...

  // === Di outer catch — tambah handling RenderYieldError ===
  } catch (err) {
    if (err?.name === 'RenderYieldError') {
      console.warn(`[Video Studio Queue] Job ${job.id} dijeda (yield #${(job.yield_count||0)+1}).`);
      await updateFfmpegStudioJob(job.id, {
        status: 'pending',
        progress_stage: 'yielded',
        yield_count: (job.yield_count || 0) + 1
      });
      globalRef.ffmpegStudioQueueActive = false;
      setTimeout(() => triggerFfmpegStudioQueue(), 60_000);
      return;
    }
    // Error biasa — seperti sebelumnya
    console.error(`[Video Studio Queue] Job ${job.id} processing failed:`, err);
    await updateFfmpegStudioJob(job.id, { status: 'failed', error_log: err.message || String(err) });
    // ...
  }
```

---

## ❓ Tiga Pertanyaan Terbuka (Fase 4)

> [!IMPORTANT]
> Ketiga hal ini harus diputuskan pengguna. Saya tidak akan memutuskan sendiri.

### Pertanyaan 1: Kapan wrapper produksi naik ke Production?

Wrapper `acquireProductionSlot` di `scheduler-processors.js` + `re-multiplier-worker.js` saat ini hanya di-deploy ke **Staging**. Selama Production tidak memakai kode yang sama, Video Studio tidak bisa "melihat" render Production. Fitur "mengalah" belum berlaku sepenuhnya.

**Deploy Production tanpa perintah eksplisit dilarang keras.**

**Pilihan:**
- **A** — Deploy ke Production bersamaan Fase 4 (pengguna beri perintah eksplisit setelah Staging terbukti aman)
- **B** — Fase 4 rilis Staging dulu. Wrapper Production menyusul di rilis berikutnya
- **C** — Lainnya

👉 **Mohon keputusan:** Kapan wrapper produksi naik ke Production?

---

### Pertanyaan 2: Batas tunggu maksimum job Video Studio

Jika jadwal produksi rapat, job bisa menunggu tanpa batas.

**Usulan saya:** Setelah **60 menit** total menunggu, tampilkan notifikasi di UI antrean: *"Render belum bisa mulai karena produksi terus aktif."* Job tidak digagalkan otomatis — pengguna yang memutuskan via tombol "Batalkan".

👉 **Mohon keputusan:** Setuju batas 60 menit? Nilai lain? Batalkan otomatis atau hanya notifikasi?

---

### Pertanyaan 3: Jeda di dalam tahap capture overlay

`shouldYield` hanya dicek di batas tahap. Capture overlay Playwright bisa beberapa menit (2.160 frame untuk video 72 dtk × 30 fps). Durasi belum diukur di Staging dengan kode yang berjalan.

**Usulan saya:** Ukur durasi capture overlay setelah Fase 2.1 berjalan, laporkan ke pengguna, lalu putuskan bersama apakah perlu titik yield tambahan setiap N frame.

👉 **Mohon keputusan:** Setuju pendekatan "ukur dulu, laporkan"? Atau ada ambang yang sudah diinginkan sekarang?

---

## Urutan Deploy

| Fase | Commit | Deploy |
|---|---|---|
| 2.1 (fix await) | `fix(video-studio): await queue db calls` | Staging atomic |
| 2.2 (DB+API+queue) | `feat(video-studio): finishing template db columns api queue params` | Staging atomic |
| 3 (finishing-source) | `feat(video-studio): finishing-source api from campaign origin` | Staging atomic |
| 4 (render-slot) | `feat(render-slot): production slot guard and video-studio yield logic` | Staging atomic |

**`npm run release-non-interactive` baru dijalankan di Fase 8.**

---

## Checklist Kompatibilitas ke Belakang

- [x] Job lama (tanpa kolom finishing) → kolom NULL → engine dapat `finishingTemplate='none'` → output identik dengan sebelumnya
- [x] `processVideoMuxing` path (audio bukan TTS) tidak tersentuh
- [x] 5 pemanggilan `processTtsStudioMuxing` di produksi: argumen tidak berubah, hanya dibungkus slot
- [x] `createFfmpegStudioJob` lama yang tidak menyertakan kolom baru tetap jalan (default NULL/0)

---

## Execution Task List
- [x] Fase 0: Bukti awal + catatan (lokasi plan campaign, Whisper, folder slot, jalur skin, gejala bug antrean)
- [x] Fase 1: Mockup `public/mockup_video_studio_finishing.html` di Staging
- [x] Gerbang: `implementation_plan.md` Fase 2–4 (sebelum/sesudah kode + keputusan pengguna)
- [x] Fase 2.1: Perbaikan bug `await` antrean + verifikasi test & frame "before"
- [x] Fase 2.2: Migrasi kolom DB + API parameter + queue loop finishing params + uji manual Staging (3 template)
- [x] Fase 3: API `finishing-source` dari campaign origin + verifikasi Staging (`re_campaign` & `instant_factory`)
- [x] Fase 4: `lib/render-slot.js` + wrapper produksi + antrean Video Studio yield logic + unit test
- [x] Fase 5: UI Panel Finishing di Video Studio (`app/components/video-studio/`)
- [ ] Fase 6: Audio upload mode A (single) & B (per-clip) + word timing
- [ ] Fase 7: Plan cadangan (AI generator & form manual)
- [ ] Fase 8: Test menyeluruh, update SOT & changelog, rilis Staging

