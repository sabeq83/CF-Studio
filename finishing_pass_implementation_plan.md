# Finishing Pass Implementation Plan & Execution Tracker (`v2.45.x`)

Dokumen ini adalah rencana teknis & tracker eksekusi bertahap untuk mengimplementasikan seluruh usulan di [`USULAN_FINISHING_VIDEO_CFSTUDIO.md`](file:///Users/sabeqmmursyid/_cfstudio/USULAN_FINISHING_VIDEO_CFSTUDIO.md) dan [`antigravity_finishing_pass_instructions.md`](file:///Users/sabeqmmursyid/_cfstudio/antigravity_finishing_pass_instructions.md), mengacu langsung pada spesifikasi visual & timing di [`mockup_finishing_preview.html`](file:///Users/sabeqmmursyid/_cfstudio/mockup_finishing_preview.html).

---

## 0. Hasil Audit Awal (Codebase, DB Staging, & Runtime Mac Mini)

Audit berikut telah diverifikasi langsung sebelum penulisan rencana agar setiap fase akurat:

1. **Status Git Lokal**:
   - `lib/tts-text-sanitizer.js` memiliki modifikasi trailing newline lokal — **dipertahankan** (tidak ditimpa).
2. **Audit Bug Tag `<#1.0#>` di `mul_261113_qt67yl` (Staging DB)**:
   - Pada `staging.tts_studio_clips` (`batch_id = 'multiplier_tts_mul_261113_qt67yl'`, `clip_index = '4'`), `source_text` tercatat:
     `"Kuncinya pakai Premix Cocoa Powder Premium. <#1.0#> Tanpa tambahan gula sama sekali."` (dibuat saat `audio_config_json.tts_model_quality = 'speech-2.8-turbo'` sebelum rilis `v2.44.3`).
   - Pada render lama sebelum `v2.44.3`, `buildMultiplierPhase2Prompt` dan `processTtsStudioMuxing()`/`generateMotionTextFrames()` belum membersihkan tag pause tersebut. Meski `v2.44.3` sudah menambahkan `stripTtsMarkupTags`, Fase 0 tetap menambahkan **QA pre-render guard + test regresi** untuk memastikan bentuk mentah, HTML-escaped (`&lt;#...#&gt;`), maupun tag `[...]`/interjeksi tidak pernah lolos ke overlay.
3. **Audit Sumber Data Sebelum FFmpeg (`opc_2117` & `mul_261113_qt67yl`)**:
   - **Hook Title (tersedia sebelum FFmpeg)**:
     - *OPC (`opc_2117`)*: `pillar_campaign_items.row_creative_payload.custom_hook` (`"Hasil lab kolesterol naik lagi padahal sudah jaga makan?"`) dan `result_json.yt_title` / `result_json.social_media_package.title`.
     - *Multiplier (`mul_261113_qt67yl`)*: `re_multiplier_tasks.yt_title` atau `bridging_config_json.angleTitle` (tanpa suffix `#Shorts`).
     - *RE (`re_campaign_items`)*: `yt_title` / `result_json.yt_title`.
   - **Daftar Bahan & Langkah Resep (tersedia sebelum FFmpeg)**:
     - Pada Multiplier (`mul_261113_qt67yl`), `re_multiplier_tasks.new_caption` sudah memuat seksi `📋 BAHAN-BAHAN:` dan `👩‍🍳 LANGKAH PEMBUATAN:` sejak Stage 2 (sebelum tahap TTS/G-Labs/FFmpeg). Sedangkan `content_flow_items.recipe_text_markdown` baru disinkronkan setelah FFmpeg selesai (`lib/contentflow-ingest.js:255,878`).
     - Pada Recipe Labs, bersumber dari `recipe_items.recipe_markdown_text`; pada OPC, dari `pillar_campaign_items.recipe_data_json` / `recipe_text_markdown` / `result_json.social_media_package.caption`.
   - **Kartu Produk (tersedia sebelum FFmpeg)**:
     - *OPC (`opc_2117`)*: `pillar_campaigns.product_ref_image_path` (`/uploads/products/default_tenant/clean/clean_default_tenant_pe_1793545394035_6698_1793832949845.png`) + `product_extractions` (`product_name`, `product_description`, `unique_selling_point`).
     - *Multiplier (`mul_261113_qt67yl`)*: `re_multiplier_tasks.bridging_config_json.productRefImagePath` (`/uploads/products/default_tenant/clean/clean_default_tenant_pe_1786588017962_4710_1786588283450.jpg`) + `product_snapshot_json` / `product_extractions`.
4. **Audit Runtime Mac Mini (`100.95.245.55`)**:
   - `ffmpeg`: memiliki filter `loudnorm` dan `zoompan`; **tidak memiliki** `ass`, `subtitles`, maupun `drawtext`. Jalur overlay tetap Sharp/SVG (Fase 0–2) dan Remotion v4 (Fase 3).
   - Font (`fc-list`): **belum ada** font `Anton`, `Montserrat`, maupun `Inter` terpasang di host (`public/fonts/` belum ada). Perlu bundling font OFL lokal + Fontconfig khusus agar Sharp/librsvg memakainya secara deterministik.
   - `whisper-cli` / `whisper.cpp`: **belum tersedia** di `PATH` Mac Mini. Oleh karena itu cadangan wajib tier (3) `silencedetect=noise=-35dB:d=0.08` + bobot `jumlah_huruf + 1.6` menjadi pengaman utama selain ElevenLabs `/with-timestamps`.
   - Next.js `16.2.5` (`next.config.mjs`) memakai `--webpack` saat build dengan `@remotion/bundler`, `@remotion/renderer`, `esbuild` sudah tercantum di `serverExternalPackages`. Remotion `^4.0.542` dan `@remotion/media-utils` sudah terpasang.

---

## Execution Task List (Tracker Resmi)

> **Aturan Kontrol**: Kerjakan **satu fase per rilis** (`Fase 0 → Verifikasi & Smoke Test Staging → Rilis → Fase 1 → ...`). Dilarang menggabungkan fase atau mencentang task sebelum verifikasi selesai.

### Tracker Fase 0 — Perbaikan Cepat (Tanpa Arsitektur Baru, Target Rilis #1)
- [ ] **F0-T1**: Pasang file font OFL lokal (`Anton-Regular.ttf`, `Montserrat-Black.ttf`, `Montserrat-ExtraBold.ttf`, `Inter-Bold.ttf`) di `public/fonts/` + buat konfigurasi `fontconfig` (`public/fonts/fonts.conf` / `FONTCONFIG_FILE` loader) agar `sharp`/librsvg benar-benar merender Anton & Montserrat, lalu verifikasi dengan render PNG uji.
- [ ] **F0-T2**: Tambahkan helper sanitasi ketat & QA guard pre-render pada [`lib/tts-text-sanitizer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js) (`sanitizeOverlayTextStrict`, `hasLeakedOverlayMarkup`) untuk mendeteksi/menolak/membersihkan `<#`, `#>`, `&lt;#`, `[`, `]`, dan tag interjeksi sebelum render overlay, serta test regresi kasus `mul_261113_qt67yl` klip 4.
- [ ] **F0-T3**: Perbarui [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js):
  - Gunakan FPS video target (bukan hardcoded `15` fps).
  - Potong subtitle menjadi chunk **2–4 kata** (putus di tanda baca, maks ~15 huruf, mengikuti `derive()` di mockup) dengan ukuran `6.6cqw` (`Math.round(width * 0.066)`), Montserrat Black, dan stroke hitam tebal (`0.55cqw`).
  - Tambahkan renderer **Hook Card Frame 0** (`generateHookCardImage` / `hookTitle` statis 1.5–2.0 detik dari field hook item tanpa `#Shorts`).
  - Terapkan QA guard pada setiap teks overlay sebelum rendering PNG.
- [ ] **F0-T4**: Perbarui [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (`processTtsStudioMuxing()`):
  - Probe FPS asli video (`getVideoMetadata`), pindahkan render motion text overlay **setelah tahap concat/xfade** di timeline global (agar tidak pernah bertumpuk/ghosting pada campaign lama yang masih memakai `fade`).
  - Rendam/campur Hook Card Frame 0 pada detik `0`–`1.75`s.
  - Terapkan `loudnorm=I=-14:TP=-1.0:LRA=11` pada encode audio final.
- [ ] **F0-T5**: Ubah default `video_transition` menjadi `'cut'` **khusus untuk campaign baru** di [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js), [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js), dan [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js), sekaligus meneruskan `hookTitle` dari [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) dan [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) ke `processTtsStudioMuxing()`. Campaign lama yang sudah menyimpan `'fade'` tetap kompatibel tanpa ghosting.
- [ ] **F0-T6**: Verifikasi Fase 0 (unit test regresi `<#1.0#>`, QA guard, chunk 2–4 kata, render font OFL nyata; `node --check`; `npm run build`), lalu deploy Staging & lakukan smoke test render ulang `opc_2117` dan `mul_261113_qt67yl` (verifikasi `-14 ± 1 LUFS`, contact sheet tiap `0.5s`, frame 0 Hook Card, 0 markup bocor, 0 ghosting di cut/transisi).
- [ ] **F0-T7**: Jalankan rilis `npm run release-non-interactive` khusus **Fase 0** dan catat baseline waktu render & changelog.

### Tracker Fase 1 — Word Timestamps + Keyword Punch + `finishing_plan` (Target Rilis #2)
- [ ] **F1-T1**: Tambah migration PostgreSQL (`dev`, `staging`, `public` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js)) dan helper query di [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js):
  - Kolom `tts_studio_clips.word_timings_json` & `tts_studio_clips.word_timings_source`.
  - Kolom campaign/preset `caption_mode` (`full` | `hybrid` | `keyword_only`, default `'hybrid'` untuk campaign baru, fallback kompatibel `'full'` untuk campaign lama yang bernilai NULL/kosong), `finishing_template` (`none` | `calm_wellness` | `recipe_pop`), dan `loudness_target` (default `-14`).
- [ ] **F1-T2**: Perbarui [`lib/elevenlabs-tts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/elevenlabs-tts.js) ke `POST /v1/text-to-speech/{voice_id}/with-timestamps` dan buat modul baru [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) dengan sumber berjenjang: (1) ElevenLabs alignment per karakter → kata, (2) `whisper.cpp` lokal bahasa `id` bila biner & model tersedia di host, (3) wajib fallback `ffmpeg silencedetect=noise=-35dB:d=0.08` + pembagian bobot `jumlah_huruf + 1.6`, serta **backfill on-demand** saat render jika klip lama belum memiliki `word_timings_json`.
- [ ] **F1-T3**: Buat modul [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) dan perluas lexicon compliance di [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js):
  - Validasi `phrase`/`trigger` wajib substring persis dari VO bersih.
  - Maksimal **2 punch per klip**.
  - Blokir kata klaim kesehatan (`kolesterol`, `jantung`, `gula darah`, `diabetes`, `obat`, `menyembuhkan`, `mengobati`, dsb.) dari Keyword Punch maupun Hook Card untuk produk herbal/non-obat.
  - Gagal validasi → layer dilewati + catat warning, render tetap berjalan.
- [ ] **F1-T4**: Tambahkan opsional `finishing_plan` pada schema JSON output prompt storyboard relevan di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildMultiplierPhase2Prompt`, `buildOrganicPillarPrompt`, `buildReverseEngineeringPrompt`, `buildReverseEngineeringBridgePrompt`) tanpa mengubah bagian prompt lain, lalu simpan hasil tervalidasi & word timings di [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) dan [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
- [ ] **F1-T5**: Implementasikan timeline global Keyword Punch + Subtitle Hybrid (`caption_mode: 'hybrid' | 'keyword_only' | 'full'`) + Progress Bar (`0.9cqw`) pada [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) & [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (subtitle disembunyikan saat punch tampil, kata punch dikecualikan dari baris subtitle, warna per `type`), plus SFX pendek berlisensi bebas (`public/sfx/pop.wav`, `public/sfx/whoosh.wav`) yang diredam di bawah VO.
- [ ] **F1-T6**: Verifikasi Fase 1 (unit test compliance herbal punch blocker, invalid `finishing_plan` skip-layer fallback, kompatibilitas campaign lama `caption_mode` kosong, alignment fallback `silencedetect`; build; deploy Staging & smoke test contact sheet `opc_2117` + `mul_261113_qt67yl` + cek manual akurasi ±0.15s pada minimal 5 punch) → Rilis **Fase 1**.

### Tracker Fase 2 — Overlay Data & Gerak Kamera (Target Rilis #3)
- [ ] **F2-T1**: Buat [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js) untuk mengekstrak data nyata sebelum FFmpeg tanpa mengarang teks: bahan & langkah resep (`re_multiplier_tasks.new_caption`, `recipe_items.recipe_markdown_text`, `pillar_campaign_items.recipe_data_json`), foto produk bersih (`product_ref_image_path` / `product_extractions`), deskripsi singkat & flag herbal, serta teks CTA sesuai platform (`cta_tiktok` vs `cta_facebook`/bio).
- [ ] **F2-T2**: Buat modul [`lib/camera-motion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/camera-motion-engine.js) (dan integrasikan ke `processTtsStudioMuxing()` sebelum/saat concat): gerak kamera `zoompan`/`scale+crop` (`1.00 -> 1.045` per klip, goyang hook `0.35s`, punch-in `+0.07` naik `0.12s` turun eksponensial `~0.8s`), flash putih di cut (`0.55 -> 0` selama `0.12s`), serta SFX `tick.wav` untuk kemunculan bahan.
- [ ] **F2-T3**: Implementasikan layer overlay data di [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) (Sharp/SVG timeline global, juga menjadi fallback permanen untuk Fase 3): `IngredientStack` (`BAHAN n/N` + chip ✓), `StepBadge` (`LANGKAH n/N`), `SavePrompt`, `ProductCard` (wajib disclaimer `"Pangan olahan, bukan obat"` untuk herbal + foto produk bersih), dan `CtaArrow` memantul.
- [ ] **F2-T4**: Verifikasi Fase 2 (unit test ekstraksi resep dari `new_caption`, guardrail zero hallucination & disclaimer herbal pada `ProductCard`, build Next.js, deploy Staging, smoke test `opc_2117` & `mul_261113_qt67yl` + contact sheet) → Rilis **Fase 2**.

### Tracker Fase 3 — Finishing Pass Remotion & Template per Niche (Target Rilis #4)
- [ ] **F3-T1**: Buat struktur modular Remotion 4 baru:
  - [`remotion/templates/FinishingPass.jsx`](file:///Users/sabeqmmursyid/_cfstudio/remotion/templates/FinishingPass.jsx) menggunakan `<OffthreadVideo>` + kamera transform (`scale`/`translateY`) + `@font-face` font OFL lokal (`staticFile('fonts/...')`).
  - Komponen terpisah di `remotion/components/finishing/`: `HookCard.jsx`, `CaptionChunks.jsx`, `KeywordPunch.jsx`, `IngredientStack.jsx`, `StepBadge.jsx`, `SavePrompt.jsx`, `ProductCard.jsx`, `CtaArrow.jsx`, `ProgressBar.jsx`, `CutFlash.jsx`.
  - Daftarkan `<Composition id="FinishingPass" ...>` dengan `calculateMetadata` dinamis (durasi & fps dari `base.mp4` via metadata `ffprobe` yang dikirim lewat `inputProps`) di [`remotion/Root.jsx`](file:///Users/sabeqmmursyid/_cfstudio/remotion/Root.jsx).
- [ ] **F3-T2**: Tambahkan `renderFinishingPassVideo()` dan builder props timeline global pada [`lib/remotion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/remotion-engine.js).
- [ ] **F3-T3**: Integrasikan ke [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) saat `finishing_template` aktif (`calm_wellness` | `recipe_pop`):
  - Mux per klip tanpa teks pada `-crf 16` → concat cut → `base.mp4` → Remotion `FinishingPass` → mux audio final (VO + SFX + `loudnorm`).
  - Fallback otomatis & aman ke hasil Sharp/SVG timeline global (Fase 0/1/2) jika Remotion gagal (render tidak boleh gagal total, catat warning).
  - Pertahankan antrean serial `ffmpegStudioQueueActive` dan catat metrik durasi render.
- [ ] **F3-T4**: Expose pilihan `caption_mode`, `finishing_template`, dan `loudness_target` pada UI Preset ([`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js)) / Campaign Detail ([`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js)) sesuai token `app/theme.css` (membuat mockup HTML Staging dulu jika menambah kontrol UI baru).
- [ ] **F3-T5**: Verifikasi Fase 3 (unit test fallback Remotion & schema props timeline global, `npm run build`, deploy Staging, smoke test penuh `opc_2117` & `mul_261113_qt67yl` termasuk perbandingan contact sheet + pengukuran waktu render sebelum/sesudah + audit LUFS) → Rilis **Fase 3**.

---

## Rincian Perubahan Kode (Code Sebelum & Code Sesudah per Fase)

> Setiap blok di bawah hanya memuat perubahan yang relevan untuk fase masing-masing agar lingkup tetap terkendali dan mudah diaudit.

---

### FASE 0 — Code Sebelum & Code Sesudah

#### 1. [`lib/tts-text-sanitizer.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tts-text-sanitizer.js) (QA Guard Pre-Render & Edge Variants)
**Code Sebelum (`lib/tts-text-sanitizer.js:28-36`):**
```js
export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```
**Code Sesudah:**
```js
const ESCAPED_MINIMAX_PAUSE_TAG_RE = /&lt;#\s*\d+(?:\.\d+)?s?\s*#&gt;/gi;
const RESIDUAL_ANGLE_HASH_TAG_RE = /<#|#>|&lt;#|#&gt;|‹#|#›/gi;
const SQUARE_BRACKET_STAGE_NOTE_RE = /\[[^\]\n]{1,60}\]/g;

export function hasLeakedOverlayMarkup(text) {
  if (typeof text !== 'string' || !text) return false;
  return (
    /<#|#>|&lt;#|#&gt;|\[|\]/i.test(text) ||
    new RegExp(MINIMAX_INTERJECTION_TAG_RE.source, 'i').test(text)
  );
}

export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(ESCAPED_MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeOverlayTextStrict(text) {
  const base = stripTtsMarkupTags(String(text || ''));
  return base
    .replace(RESIDUAL_ANGLE_HASH_TAG_RE, ' ')
    .replace(SQUARE_BRACKET_STAGE_NOTE_RE, ' ')
    .replace(/[[\]]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

---

#### 2. `public/fonts/` + Fontconfig Helper untuk Sharp/librsvg (`lib/motion-font-loader.js`)
**File Baru:**
- Unduh/pasang font berlisensi **OFL** ke `public/fonts/`:
  - `public/fonts/Anton-Regular.ttf`
  - `public/fonts/Montserrat-Black.ttf`
  - `public/fonts/Montserrat-ExtraBold.ttf`
  - `public/fonts/Inter-Bold.ttf`
- Buat `public/fonts/fonts.conf` dan [`lib/motion-font-loader.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-font-loader.js) yang menulis konfigurasi Fontconfig absolut di runtime (`process.env.FONTCONFIG_FILE`) sebelum memanggil `sharp()` agar `librsvg` di macOS benar-benar memakai font OFL lokal (terverifikasi lewat pixel/font audit, bukan fallback Arial/Hiragino).

---

#### 3. [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) (FPS Video, Chunk 2–4 Kata 6.6cqw Stroke Tebal, Hook Card Frame 0, Font OFL, QA Guard)
**Code Sebelum (`lib/motion-text-engine.js:1-165`):**
```js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { stripTtsMarkupTags } from './tts-text-sanitizer.js';
...
export async function generateMotionTextFrames(options) {
  const {
    outputDir,
    text = '',
    role = 'story',
    style = 'floating_white_yellow',
    effect = 'typewriter',
    videoWidth = 1080,
    videoHeight = 1920,
    duration = 5.0,
    fps = 15,
    tag = 'HOOK',
    brand = '',
    position = 'bottom'
  } = options;
...
  const cleanText = stripTtsMarkupTags(text);
  if (!cleanText) {
    return { success: false, reason: 'Empty text' };
  }
...
  const speechDuration = Math.max(duration * 0.75, 1.2);
  const totalFrames = Math.max(Math.round(speechDuration * fps), 15);
  const timePerWord = speechDuration / totalWords;

  const overlayWidth = videoWidth;
  const overlayHeight = Math.round(videoHeight * 0.32);
  const centerX = Math.round(overlayWidth / 2);

  const lines = wrapWordsIntoLines(rawWords, style === 'floating_black_on_white' ? 24 : 30);
  const fontSize = Math.round(overlayWidth * (style === 'minimal_white' ? 0.038 : 0.048));
  const lineHeight = Math.round(fontSize * 1.45);
...
        textElements += `<text x="${centerX}" y="${yPos}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}px" letter-spacing="1.2px" xml:space="preserve" filter="url(#drop-shadow)">${tspans}</text>`;
```
**Code Sesudah:**
```js
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { ensureMotionFontsRegistered } from './motion-font-loader.js';
import { sanitizeOverlayTextStrict, hasLeakedOverlayMarkup } from './tts-text-sanitizer.js';

export function chunkCaptionWords(words = []) {
  // Mengikuti mockup derive(): 2-4 kata, putus di tanda baca [,.?!]$, atau >15 karakter jika >=2 kata
  const chunks = [];
  let cur = [];
  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    const joined = cur.map(w => w.w || w).join(' ');
    const lastWord = String(words[i].w || words[i]);
    const hasClipBoundary = words[i + 1] && words[i].c !== undefined && words[i + 1].c !== words[i].c;
    if (/[,.?!]$/.test(lastWord) || cur.length >= 4 || (cur.length >= 2 && joined.length > 15) || hasClipBoundary) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function cleanHookCardTitle(rawHook = '') {
  return sanitizeOverlayTextStrict(String(rawHook || '').replace(/#shorts\b/gi, '')).trim();
}
// + generateHookCardOverlay(options): membuat PNG statis 9:16 top ~30cqh dengan font Anton 13cqw/15cqw (l1 putih stroke hitam, l2 miring -2.5deg pada blok aksen #f2b632).
// + Di generateMotionTextFrames / renderGlobalTimelineSubtitleFrames:
//   1. ensureMotionFontsRegistered();
//   2. sanitizeOverlayTextStrict(text) + log warning jika hasLeakedOverlayMarkup(text) sempat terdeteksi;
//   3. Gunakan fps = Number(options.fps) || 30 (sama dengan fps video);
//   4. Render subtitle per potongan chunkCaptionWords() (bukan akumulasi satu kalimat penuh), ukuran 6.6cqw (Math.round(videoWidth * 0.066)), Montserrat Black 900, stroke hitam Math.round(videoWidth * 0.0055 * 2), posY di ~69cqh.
```

---

#### 4. [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (`loudnorm`, FPS video, Pindah Overlay ke Timeline Global Setelah Concat, Hook Card Frame 0)
**Code Sebelum (`lib/video-studio-processor.js:615-890`):**
```js
  for (let i = 0; i < pairCount; i++) {
    ...
    await processVideoMuxing({ ... outputPath: tempClipPath });
    let finalSegmentPath = tempClipPath;
    if (Number(enableMotionText) === 1) {
      // ... merender overlay per klip SEBELUM concat/xfade pada 15fps ...
    }
    tempClipPaths.push(finalSegmentPath);
  }
  // 2. Concatenate all segment video files together (with XFade or Concat)
  ...
  concatCommand.outputOptions([
    `-map ${mapVideo}`,
    `-map ${mapAudio}`,
    '-c:v libx264',
    '-pix_fmt yuv420p',
    '-c:a aac'
  ]);
```
**Code Sesudah:**
```js
  // 1. Mux semua segmen TANPA teks overlay per klip; catat durasi segmen & fps video sumber
  //    Jika campaign lama masih memakai videoTransition !== 'cut' (xfade), hitung offset xfade agar teks tidak bertumpuk di cut.
  // 2. Bangun baseVideo (concat/xfade + audio mix) terlebih dahulu ke temp_base_${id}.mp4
  //    Probe fps aktual via getVideoStreamInfo(baseVideoPath) -> targetFps (e.g. 30).
  // 3. Render Global Finishing Overlay di ATAS baseVideoPath (timeline global [0..totalDur]):
  //    - Hook Card statis di Frame 0 (0..1.75s) dari cleanHookCardTitle(hookTitle) jika hookTitle tersedia
  //    - Subtitle chunks (2-4 kata, 6.6cqw) mengikuti timeline segmen klip di baseVideo (bebas ghosting xfade!)
  // 4. Encode final dengan normalisasi audio wajib:
  //    loudnormFilter = `loudnorm=I=${loudnessTarget}:TP=-1.0:LRA=11` (default loudnessTarget = -14)
  //    Output tetap YUV420P H.264 + AAC 192k 48kHz +faststart.
```

---

#### 5. [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js), [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js), [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js), & Caller (`lib/scheduler-processors.js`, `lib/re-multiplier-worker.js`)
**Code Sebelum:**
- `lib/db.js:2243`: `video_transition: campaign.video_transition || 'fade',`
- `lib/autonomous-engine.js:147,187,258,568,778,897`: fallback default `'fade'`
- `lib/operator-presets.js:98,180,474`: `video_transition: 'fade'`
- `lib/scheduler-processors.js:3088,4164,7441,8888` & `lib/re-multiplier-worker.js:1310`: belum meneruskan `hookTitle` ke `processTtsStudioMuxing()`.

**Code Sesudah:**
- Ubah fallback default `video_transition` di creator campaign baru / preset baru menjadi `'cut'` (kolom DB campaign lama yang sudah bernilai `'fade'` tetap dibaca `'fade'`, dan overlay tetap bebas ghosting karena sudah dipindah ke timeline pasca-concat).
- Teruskan `hookTitle: resolvePreRenderHookTitle(...)` dari `scheduler-processors.js` (`yt_title` / `row_creative_payload.custom_hook`) dan `re-multiplier-worker.js` (`task.yt_title` / `bridgingConfig.angleTitle`) ke `processTtsStudioMuxing()`.

---

### FASE 1 — Code Sebelum & Code Sesudah

#### 1. [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) & [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js) (Migration Kolom Word Timings & Campaign Setting)
**Code Sebelum (`lib/db-pg.js:290-303` & `lib/db.js:1985-2005`):**
```js
// lib/db-pg.js
        await pool.query(`
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS enable_motion_text INTEGER DEFAULT 1,
            ...
            ADD COLUMN IF NOT EXISTS video_transition TEXT DEFAULT 'fade',
            ADD COLUMN IF NOT EXISTS transition_duration DOUBLE PRECISION DEFAULT 0.5;
        `);
// lib/db.js:1980-1985 hanya INSERT (id, batch_id, clip_index, source_text, audio_path, status)
```
**Code Sesudah:**
```js
// lib/db-pg.js — tambah migration idempoten (untuk schema dev, staging, public):
        await pool.query(`
          ALTER TABLE tts_studio_clips
            ADD COLUMN IF NOT EXISTS word_timings_json TEXT,
            ADD COLUMN IF NOT EXISTS word_timings_source TEXT;
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS caption_mode TEXT,
            ADD COLUMN IF NOT EXISTS finishing_template TEXT DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS loudness_target DOUBLE PRECISION DEFAULT -14;
          ALTER TABLE re_campaigns
            ADD COLUMN IF NOT EXISTS caption_mode TEXT,
            ADD COLUMN IF NOT EXISTS finishing_template TEXT DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS loudness_target DOUBLE PRECISION DEFAULT -14;
        `);
// Catatan: caption_mode dibiarkan NULL pada campaign lama agar perilaku runtime fallback ke 'full';
// campaign baru diisi 'hybrid' saat insert di createPillarCampaign / createReCampaign.
```

---

#### 2. [`lib/elevenlabs-tts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/elevenlabs-tts.js) & [`lib/word-alignment-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/word-alignment-engine.js) (Word Timestamps 3-Tier)
**Code Sebelum (`lib/elevenlabs-tts.js:75-117`):**
```js
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  ...
  const response = await fetch(url, { ... });
  ...
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, audioBuffer);
  return outputPath;
```
**Code Sesudah:**
```js
  const useTimestamps = config.withTimestamps !== false;
  const url = useTimestamps
    ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`
    : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  // Jika with-timestamps sukses: decode audio_base64 ke MP3 + konversi alignment per karakter
  // menjadi array [{ w, s, e }] lalu kembalikan { outputPath, wordTimings, source: 'elevenlabs' }
  // atau tetap kompatibel mengembalikan string outputPath bila returnMetadata !== true (atau tempel metadata).
  // Modul lib/word-alignment-engine.js menyediakan:
  //   alignClipWords({ audioPath, text, existingTimingsJson, providerTimings })
  //   Tier 1: ElevenLabs alignment | Tier 2: whisper-cli (jika terpasang) | Tier 3: ffmpeg silencedetect=noise=-35dB:d=0.08 + bobot (norm(w).length + 1.6)
```

---

#### 3. [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) & [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js)
**Code Sebelum (`lib/tiktok-compliance-service.js:9-20`):**
```js
const FORBIDDEN_LEXICON_BLOCKERS = [
  { pattern: /menyembuhkan/i, ... },
  ...
  { pattern: /menurunkan\s+kolesterol|menurunkan\s+gula\s+darah|mencegah\s+kanker|.../i, ... }
];
```
**Code Sesudah:**
- Export helper baru `isHerbalMedicalClaimPhrase(text)` di `lib/tiktok-compliance-service.js` yang memblokir kata klaim kesehatan standalone untuk overlay besar/punch produk herbal (`kolesterol`, `jantung`, `gula darah`, `diabetes`, `obat`, `menyembuhkan`, `mengobati`, `kanker`, `wasir`, `hipertensi`, `stroke`).
- Buat `lib/finishing-plan-validator.js` (`validateFinishingPlan(rawPlan, { clipsVoClean, isHerbalProduct })`):
  1. Verifikasi tiap `punch.phrase` dan `trigger` adalah substring persis dari VO klip terkait (setelah `stripTtsMarkupTags`).
  2. Batasi maksimal **2 punch per klip**.
  3. Tolak & skip punch/hook yang melanggar `isHerbalMedicalClaimPhrase` saat `isHerbalProduct === true`.
  4. Kembalikan `{ validPlan, warnings }` tanpa melempar exception agar render tetap berjalan walau validasi gagal.

---

#### 4. [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js), [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js)
**Code Sebelum (`lib/prompts.js:3835-3845`, `3006-3013`, `1618-1623`):**
- Schema JSON output berisi `storyboard`/`new_video_plan`/`voiceover`, `captions`, `social_media_package`, belum ada `finishing_plan`.

**Code Sesudah:**
- Tambahkan blok opsional `"finishing_plan"` pada output JSON (didampingi instruksi singkat compliance & rule 1–2 punch per klip + substring persis VO), **tanpa** mengubah instruksi inti prompt storyboard yang ada.
- Worker menyimpan `finishing_plan` tervalidasi ke metadata item/task (`bridging_config_json` / `result_json`) sebelum FFmpeg berjalan, serta menyimpan `word_timings_json` & `word_timings_source` ke `tts_studio_clips`.

---

#### 5. [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) & [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js) (Keyword Punch + Hybrid Mode + Progress Bar + SFX `pop`/`whoosh`)
- Render timeline global pada `caption_mode === 'hybrid'` atau `'keyword_only'`:
  - `KeywordPunch`: font Anton `16cqw`, top `40cqh`, stroke hitam `0.6cqw`, warna per `type` (`problem`: `#ffffff` + shake `0.3s`, `benefit`: `#9df27a`, `product`: brand accent, `cta`: `#ffe14d`, `result`: `#ffcc3d`), pop back-out `0.2s`, durasi `max(wordEnd + 0.35, wordStart + 1.0)`.
  - Saat punch aktif, subtitle disembunyikan dan kata punch (`PW` set) tidak ikut tampil di subtitle.
  - `ProgressBar`: tinggi `0.9cqw` di tepi atas.
  - Campur SFX `public/sfx/pop.wav` & `whoosh.wav` via filter FFmpeg `adelay` + `volume=0.22` + `amix` sebelum `loudnorm=I=-14:TP=-1.0:LRA=11`.
  - Jika `caption_mode` kosong/NULL atau `'full'` → pertahankan perilaku subtitle klasik (zero regression campaign lama).

---

### FASE 2 — Code Sebelum & Code Sesudah

#### 1. [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js) (Baru)
- Memetakan data nyata **hulu pra-FFmpeg** ke timeline finishing tanpa AI/halusinasi:
  - Resep (`recipe_pop`): parsing `📋 BAHAN-BAHAN:` & `👩‍🍳 LANGKAH PEMBUATAN:` dari `re_multiplier_tasks.new_caption` / `recipe_items.recipe_markdown_text` / `pillar_campaign_items.recipe_data_json`. Pencocokan kemunculan bahan ke `word_timings_json`.
  - Kartu produk (`ProductCard`): ambil `product_ref_image_path` (foto produk bersih), nama produk, deskripsi ringkas faktual (`netto` / USP pendek), dan **wajib** label `"Pangan olahan, bukan obat"` bila produk berkategori herbal/madu/fermentasi.
  - Platform CTA (`cta_tiktok` vs `cta_facebook`/bio) menyesuaikan target/naskah.

#### 2. [`lib/camera-motion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/camera-motion-engine.js) (Baru) & [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js)
**Code Sebelum (`lib/video-studio-processor.js:680-690`):**
```js
      await processVideoMuxing({
        videoPath: JSON.stringify([videoPaths[i]]),
        audioPath: completedClips[i].audio_path,
        syncOption: resolvedSyncOption,
        ...
      });
```
**Code Sesudah:**
- Untuk jalur Sharp/FFmpeg (non-Remotion), bangun ekspresi crop/scale/zoompan per-frame atau timeline kamera:
  - Zoom pelan `1.00 -> 1.045` per klip, titik pusat `50% / 45%`.
  - Goyang kecil `0.35s` pertama di frame pembuka.
  - Punch-in `+0.07` saat timestamp `punch.s` (naik `0.12s`, turun eksponensial `~0.8s`).
  - Flash putih di cut (`0.55 -> 0` selama `0.12s`) pada titik cut antar klip.
  - Tambahkan SFX `public/sfx/tick.wav` saat chip bahan muncul.

#### 3. [`lib/motion-text-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/motion-text-engine.js) (Layer Data Overlay di Timeline Global)
- Tambahkan renderer Sharp/SVG untuk `IngredientStack` (`left 4.5cqw, top 12cqh`, header `BAHAN n/N`), `StepBadge` (`right 4.5cqw, top 12cqh`, `LANGKAH n/N`), `SavePrompt` (`top 56cqh`), `ProductCard` (`left 5cqw`, `top 13cqh` atau `28cqh` pada `recipe_pop`), dan `CtaArrow` (`LINK DI BIO` ▲ vs `CEK KERANJANG KUNING` ▼).

---

### FASE 3 — Code Sebelum & Code Sesudah

#### 1. [`remotion/Root.jsx`](file:///Users/sabeqmmursyid/_cfstudio/remotion/Root.jsx) & `remotion/templates/FinishingPass.jsx` + `remotion/components/finishing/*`
**Code Sebelum (`remotion/Root.jsx:1-30`):**
```jsx
import React from 'react';
import { Composition } from 'remotion';
import { GarliBeeExplainer } from './templates/GarliBeeExplainer';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="GarliBeeExplainer"
        component={GarliBeeExplainer}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ... }}
      />
    </>
  );
};
```
**Code Sesudah:**
```jsx
import React from 'react';
import { Composition } from 'remotion';
import { GarliBeeExplainer } from './templates/GarliBeeExplainer';
import { FinishingPass } from './templates/FinishingPass';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="GarliBeeExplainer"
        component={GarliBeeExplainer}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ... }}
      />
      <Composition
        id="FinishingPass"
        component={FinishingPass}
        fps={30}
        width={720}
        height={1280}
        durationInFrames={300}
        calculateMetadata={({ props }) => {
          const fps = Number(props?.fps) || 30;
          const durSec = Number(props?.durationSeconds) || 10;
          return {
            fps,
            width: Number(props?.width) || 720,
            height: Number(props?.height) || 1280,
            durationInFrames: Math.max(1, Math.round(durSec * fps))
          };
        }}
        defaultProps={{
          baseVideoSrc: '',
          template: 'calm_wellness',
          accentColor: '#f2b632',
          fps: 30,
          width: 720,
          height: 1280,
          durationSeconds: 10,
          clips: [],
          hook: null,
          captions: [],
          punches: [],
          ingredients: [],
          steps: [],
          savePrompt: null,
          productCard: null,
          cta: null
        }}
      />
    </>
  );
};
```
- Komponen `remotion/components/finishing/` dipisah per layer: `HookCard.jsx`, `CaptionChunks.jsx`, `KeywordPunch.jsx`, `IngredientStack.jsx`, `StepBadge.jsx`, `SavePrompt.jsx`, `ProductCard.jsx`, `CtaArrow.jsx`, `ProgressBar.jsx`, `CutFlash.jsx` menggunakan `spring()`, `interpolate()`, `<OffthreadVideo>` (dengan transform kamera pada video), serta `staticFile('fonts/...')` via `@font-face`.

#### 2. [`lib/remotion-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/remotion-engine.js) & [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js)
**Code Sebelum (`lib/remotion-engine.js:50-107`):**
- Hanya memiliki `renderExplainerVideo({ compositionId = 'GarliBeeExplainer', ... })`.

**Code Sesudah:**
- Tambahkan `renderFinishingPassVideo({ baseVideoPath, timelineProps, outputPath, onProgress })` yang melayani aset lokal `base.mp4` + foto produk bersih dengan path Remotion-safe (via `public/` / local static server atau `staticFile` symlink/copy sementara ke bundle/temp) dan merender video visual MP4 sesuai `calculateMetadata`.
- Di [`lib/video-studio-processor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/video-studio-processor.js):
  1. Mux tiap klip (video+VO saja, tanpa teks, intermediate `-crf 16`).
  2. Concat cut → `base.mp4` (+ catat offset detik absolut tiap klip).
  3. Bila `finishingTemplate` aktif (`calm_wellness` | `recipe_pop`): jalankan `renderFinishingPassVideo(...)` dalam `try/catch`; **jika gagal**, catat warning & fallback ke overlay Sharp/SVG timeline global (Fase 0/1/2) sehingga render & sinkronisasi tidak pernah gagal total.
  4. Final audio master pass: mux VO + SFX (`pop`/`whoosh`/`tick`) + `loudnorm=I=-14:TP=-1.0:LRA=11` pada antrean serial `ffmpegStudioQueueActive`.

---

## Kriteria Verifikasi Minimum per Rilis

| Verifikasi | Fase 0 | Fase 1 | Fase 2 | Fase 3 |
|---|---|---|---|---|
| Render ulang `opc_2117` & `mul_261113_qt67yl` di Staging + contact sheet tiap 0.5s | Wajib | Wajib | Wajib | Wajib |
| Loudness output `-14 ± 1 LUFS` (`loudnorm=print_format=summary`) | Wajib | Wajib | Wajib | Wajib |
| Zero tag markup (`<#`, `#>`, `[...]`, `(breath)`) di seluruh frame | Wajib | Wajib | Wajib | Wajib |
| Frame 0 menampilkan Hook Card tanpa `#Shorts` | Wajib | Wajib | Wajib | Wajib |
| Zero teks bertumpuk / ghosting di sekitar cut/transisi | Wajib | Wajib | Wajib | Wajib |
| Akurasi punch `±0.15s` dari audio VO (cek min. 5 punch) | — | Wajib | Wajib | Wajib |
| Unit test klaim herbal diblokir & invalid `finishing_plan` skip-layer aman | — | Wajib | Wajib | Wajib |
| Unit test campaign lama (`caption_mode` kosong) non-regresi | Wajib | Wajib | Wajib | Wajib |
| Disclaimer `"Pangan olahan, bukan obat"` + foto produk bersih di `ProductCard` | — | — | Wajib | Wajib |
| Fallback Remotion → Sharp/SVG + catatan waktu render sebelum vs sesudah | — | — | — | Wajib |
| `next build --webpack` + OPC/RE/Multiplier smoke non-regresi | Wajib | Wajib | Wajib | Wajib |
