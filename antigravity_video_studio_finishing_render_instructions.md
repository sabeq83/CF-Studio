# Instruksi Antigravity: Render Penuh dengan Finishing Template di Video Studio

Tanggal: 16 Nov 2026 (Revisi 3: mockup dulu, tanpa pengecualian) · Dari: Claude (reviewer/planner) · Untuk: Antigravity (eksekutor)

Latar belakang, alasan, dan keputusan pengguna: **[USULAN_RENDER_FINISHING_VIDEO_STUDIO.md](USULAN_RENDER_FINISHING_VIDEO_STUDIO.md)** (Revisi 2). Baca seluruhnya sebelum mulai.

Tujuan: dari menu `/video-studio`, user bisa memilih salah satu dari **8 finishing template**, memakai video pilihannya sendiri dan audio dari TTS Studio **atau upload**, lalu merender **penuh seluruh klip** menjadi MP4 final dengan engine yang sama dengan OPC, RE, dan Multiplier (`processTtsStudioMuxing`). Render dari Video Studio **selalu mengalah** kepada render produksi terjadwal.

Keputusan pengguna yang mengikat:
1. Sumber plan utama: **campaign asal**. AI dan manual hanya cadangan.
2. Audio upload **wajib didukung** di rilis pertama.
3. Job Video Studio **mengalah** kepada job produksi terjadwal.

---

## ⛔ Aturan utama

1. Kerjakan **Fase 0 dan Fase 1 saja dulu**. Setelah link mockup Staging bisa dibuka (HTTP 200), **kirim link ke pengguna lalu BERHENTI**. **Tidak ada pengecualian**: perbaikan bug antrean pun menunggu mockup disetujui (dikerjakan di awal Fase 2).
2. **Dilarang** mengubah `lib/`, `app/`, `tests/`, `scripts/`, database, atau MCP sebelum pengguna menulis di chat bahwa mockup **disetujui**. Sebelum itu, satu-satunya file yang boleh di-commit adalah `public/mockup_video_studio_finishing.html` dan file ini (centang task list). Catatan Fase 0 di `scratch/` tidak di-commit.
3. **Jangan membuat engine finishing baru.** Semua render lewat `processTtsStudioMuxing()`. Word timing lewat `lib/word-alignment-engine.js` yang sudah ada.
4. **Kompatibel ke belakang:** job lama tanpa kolom finishing, render tanpa template, dan semua render produksi harus menghasilkan output yang sama persis seperti sekarang.
5. **Produksi tidak boleh pernah menunggu Video Studio.** Wrapper slot render untuk produksi hanya menandai, tidak pernah memblokir.
6. **Dilarang deploy Production.** Hanya Staging (dan Dev bila perlu), atomic dengan full SHA.
7. Tidak ada secret atau API key di kode, test, maupun mockup.
8. Setiap fase selesai, centang `- [ ]` → `- [x]` di **Execution Task List** di bagian bawah file ini.
9. **Commit hanya file yang dimaksud.** Jangan `git add -A` atau `git add .`. Di working tree ada perubahan milik pekerjaan lain yang belum di-commit (`tests/finishing-natural-chapters.test.mjs`, `tests/finishing-skin-general.test.mjs`): jangan disentuh, jangan ikut di-commit, jangan di-reset.
10. **Fase 0–1 tanpa rilis versi.** Jangan jalankan `npm run release-non-interactive` untuk mockup. Cukup commit `docs:`/`chore:`, push `main`, deploy Staging. Rilis versi baru dilakukan di Fase 8. Aturan ini mengesampingkan SOP rilis otomatis di `AGENTS.md` khusus untuk Fase 0–1.
11. **Rencana before/after wajib sebelum kode.** Setelah mockup disetujui, tulis `implementation_plan.md` (sesuai SOP di `AGENTS.md`: Execution Task List + potongan kode Sebelum/Sesudah untuk setiap file yang diubah) untuk Fase 2–4, kirim ke pengguna, dan tunggu persetujuan kedua. Fase 5–7 boleh menyusul di rencana terpisah.
12. Jika isi file ini berbeda dengan `USULAN_RENDER_FINISHING_VIDEO_STUDIO.md` (misalnya soal kapan bug antrean diperbaiki), **file ini yang berlaku**.

---

## Peta kode (hasil baca Claude, verifikasi ulang sebelum mengubah)

| Bagian | File | Catatan |
|---|---|---|
| Halaman | `app/video-studio/page.js` | Mode `ffmpeg` / `remotion`. Audio upload sekarang satu file (`audioFile`). Body POST render ada di sekitar baris 318–333 |
| API render | `app/api/video-studio/render/route.js` | Validasi `sync_option`, resolve TTS batch (sekitar baris 117–130), lalu `createFfmpegStudioJob` |
| Antrean | `lib/video-studio-processor.js` → `triggerFfmpegStudioQueue()` (sekitar baris 565) | Flag memori `globalRef.ffmpegStudioQueueActive`. TTS → `processTtsStudioMuxing` dengan **hanya 8 parameter**. Lainnya → `processVideoMuxing` |
| **Bug (sudah dicek Claude di kode, 16 Nov 2026)** | `lib/video-studio-processor.js` baris 576, 583, 616, 626 | `const job = getPendingFfmpegStudioJob();` tanpa `await`, padahal fungsinya `async` (`lib/db.js` baris 2186). `updateFfmpegStudioJob(...)` di baris 583, 616, 626 juga tanpa `await` (fungsi `async`, `lib/db.js` baris 2174). Dampak nyata di Staging tetap perlu dibuktikan di Fase 0 |
| Engine | `processTtsStudioMuxing()` (sekitar baris 842) | Sudah menerima `finishingTemplate`, `finishingPlan`, `captionMode`, `brand`, `brandPatch`, `brandName`, `hookTitle`, `captionText`, `videoTransition`, `transitionDuration`, `enableCameraMotion`, `platform`, `loudnessTarget`, `recipeData`, `productData`, `isHerbalProduct`, `targetLanguage`, `voiceoverTexts`, `batchDataOverride` |
| Pemanggil produksi | `lib/scheduler-processors.js` (sekitar baris 3255, 4346, 8571, 10048), `lib/re-multiplier-worker.js` (sekitar baris 1515) | Memanggil engine langsung. **Tiru cara mereka menyusun parameter finishing** (`finishingMeta`) |
| Jadwal | `lib/campaign-scheduler.js` | Sumber jadwal produksi terdekat untuk U7 |
| DB job | `lib/db.js` → `createFfmpegStudioJob`, `getPendingFfmpegStudioJob`, `updateFfmpegStudioJob` (sekitar baris 2149–2195) | Postgres, multi-schema |
| Migrasi | `scripts/migrate-*.mjs` | Pola acuan: `scripts/migrate-brand-finishing-fields.mjs` |
| Template | `lib/finishing-template-registry.js` | `suggestFinishingTemplate`, `isRichFinishingTemplate`, `hasStrictTemplateCompliance` |
| Skin | `lib/finishing-skin-registry.js` | `FINISHING_SKIN_REGISTRY`, `DEFAULT_FINISHING_SKIN`. `brand_profiles.finishing_skin`, `default_finishing_template` |
| Plan | `lib/finishing-plan-validator.js` | `validateFinishingPlan`, `buildFinishingPlanPromptJson`, `FINISHING_PLAN_PROMPT_APPENDIX`, `auditTextDensity` |
| Data | `lib/finishing-data-extractor.js` | `extractRecipeOverlayData`, `extractProductCardData`, `resolveCtaAndSavePrompt`, `DEFAULT_HERBAL_DISCLAIMER` |
| Word timing | `lib/word-alignment-engine.js` | `resolveClipWordTimings`, `alignClipWordsTier2` (Whisper CLI), `alignClipWordsTier3` (teks + silence), `resolveWhisperCliConfig` |
| Sumber video campaign | `app/api/video-studio/campaign-videos/route.js` | RE Campaign & Instant Factory (`unified_production_json`) |
| Preview | `app/components/FinishingTemplatePreview.js`, `lib/finishing-preview-builder.js` | |
| Proses PM2 | `ecosystem.macmini-prod.config.cjs`, `ecosystem.staging.config.cjs` | UI dan API terpisah, Staging dan Prod di mesin yang sama → kunci harus di sistem file |

---

## Fase 0: Bukti awal (tanpa mengubah kode sama sekali)

**Bukti:**
- Render 1 job lewat Video Studio di Staging (video multi-klip + audio TTS Studio). Simpan output dan log. Catat apakah antrean berjalan normal. Karena bug `await`, job ini mungkin gagal atau tidak pernah selesai: itu hasil yang sah, catat gejalanya (status job di DB, isi log) lalu lanjut. Jangan diperbaiki dulu.
- Konfirmasi dari log bahwa template jatuh ke `none` (`⏱️ [Finishing Metrics] template=...`).
- Ambil 1 contoh plan nyata dari RE Campaign dan Instant Factory untuk `recipe_pop` dan `problem_solution`. Catat **di field mana plan, template, skin, brand, batch TTS, dan teks VO tersimpan**. Simpan di `scratch/video_studio_finishing/plans/`.
- Cek `resolveWhisperCliConfig()` di Mac mini Staging: apakah Whisper CLI tersedia?
- Cek apakah `RENDER_SLOT_DIR` (default `~/.cfstudio/render-slots/`) bisa ditulis oleh user PM2 Staging **dan** Production.
- Frame setiap 1 dtk dari output → `scratch/video_studio_finishing/before/`.
- Tulis semuanya di `scratch/video_studio_finishing/CATATAN.md`, termasuk jalur skin ke renderer.

**Bug antrean: buktikan saja, jangan diperbaiki di fase ini.**
- Catat di `CATATAN.md`: gejala di Staging, baris kode yang salah, dan usulan perbaikannya (potongan kode Sebelum/Sesudah).
- Jika render Fase 0 gagal karena bug ini sehingga frame "before" tidak bisa diambil, tulis itu di laporan. Frame "before" diambil ulang setelah perbaikan di Fase 2.
- Perbaikannya dikerjakan sebagai langkah pertama Fase 2, setelah mockup dan `implementation_plan.md` disetujui.

## Fase 1: Mockup `public/mockup_video_studio_finishing.html`

### Syarat teknis
- Standalone: CSS/JS inline, token desain sendiri di `:root` (gaya `--surface`, `--text-primary`, `--action-primary`), mendukung light/dark (`prefers-color-scheme` + tombol ganti).
- Layar video 9:16 (360×640 di layar), latar gradien atau gambar placeholder. Jangan memakai logo atau produk asli.
- Tidak ada kredensial.

### Isi mockup (meniru halaman Video Studio mode FFmpeg)
**Panel kiri**
1. Sumber video (Upload / DB / RE Campaign / Instant Factory) + jumlah klip.
2. Sumber audio:
   - TTS Studio (jumlah klip VO),
   - Upload/DB dengan **dua mode**: "Satu audio untuk semua klip" dan "Satu audio per klip" (daftar file yang bisa diurutkan, dengan penanda pasangan klip 1↔audio 1, dan seterusnya),
   - kolom teks VO opsional + tombol "Transkripsi otomatis" + hasil transkripsi yang bisa diedit.
3. Strategi sinkronisasi + BGM (tetap).
4. **Panel Finishing**
   - **Banner campaign asal** (state default saat video dari campaign): "Dimuat dari campaign *X*: template `recipe_pop`, skin `pop_kuning`, plan ✓, batch TTS ✓". Tombol "Pakai apa adanya" dan "Ubah".
   - Galeri 8 kartu template + badge "Disarankan" + badge "Dari campaign".
   - Dropdown skin, caption mode, transisi + durasi, camera motion, platform, target loudness.
   - Brand preset + override warna aksen. Data konten: hook, nama brand, CTA, disclaimer.
   - Sumber plan, 3 tab dengan urutan: **Dari campaign asal** (default) → Buat dengan AI → Isi manual (form per template + tab JSON).
   - Contoh peringatan saat template diganti dari template campaign: "Plan campaign dibuat untuk `recipe_pop`. Untuk `tips_listicle`, buat plan baru."
   - Kotak hasil validasi: hijau / kuning / merah.
   - Contoh peringatan mode A: "Satu audio untuk semua klip: babak dan tips diletakkan berdasarkan waktu bicara. Untuk hasil terbaik di template ini, pakai satu audio per klip."
5. Peringatan pasangan klip ("Video 7 klip, audio 9 file. Samakan dulu.") → tombol render nonaktif.
6. Tombol "Mulai Rendering Video" + estimasi waktu.

**Panel kanan**
- Preview 9:16 dengan scrub timeline dan Play/Pause.
- Antrean dengan contoh status: `Menunggu produksi selesai (cek ulang 60 dtk)`, `Sync klip 3/9`, `Gabung klip`, `Capture overlay 1.240/2.160`, `Master pass`, `Dijeda: produksi mulai, diantre ulang (1×)`, `Selesai`, `Selesai tanpa finishing — alasan`, `Gagal`.
- Contoh saran setelah 3 kali mengalah: "Render sering tertunda produksi. Coba di luar jam produksi."

### Tambahan wajib untuk mockup (agar pengguna bisa menilai alurnya)
1. **Pemilih skenario** di bagian paling atas (dropdown atau deretan tombol). Memilih skenario mengubah seluruh isi mockup:
   - **A. Video dari campaign** (default): banner campaign, plan ✓, batch TTS ✓, tombol render aktif.
   - **B. Video upload tanpa campaign**: tanpa banner, tab plan terbuka di "Buat dengan AI", tombol render nonaktif sampai plan ada.
   - **C. Template diganti dari template campaign**: peringatan plan tidak cocok.
   - **D. Audio upload, satu audio per klip, jumlah cocok**: daftar pasangan klip ↔ audio.
   - **E. Audio upload, jumlah tidak cocok**: peringatan + tombol render nonaktif.
   - **F. Audio upload, satu audio untuk semua klip**: peringatan mode A.
   - **G. Tanpa teks VO dan tanpa Whisper**: keterangan "caption dimatikan, layer lain tetap tampil".
2. **Jalur cepat satu klik.** Pada skenario A, yang terlihat hanya: sumber video, banner campaign, preview, estimasi waktu, dan tombol "Mulai Rendering Video". Semua pengaturan lain (skin, caption mode, transisi, camera motion, platform, loudness, brand, data konten, sumber plan) **terlipat** dan baru terbuka saat pengguna menekan "Ubah".
3. **Preview ikut berubah.** Mengganti template atau skin mengubah tampilan overlay di layar 9:16 (cukup tiruan sederhana per template, tidak perlu persis engine), supaya ke-8 template bisa dibandingkan.
4. **Antrean bisa dicoba.** Tombol "Mulai Rendering Video" menambah satu baris ke antrean tiruan yang berjalan melewati tahap-tahapnya, termasuk satu contoh "Menunggu produksi selesai" dan satu contoh "Dijeda: produksi mulai".
5. Semua teks UI dalam **Bahasa Indonesia sederhana**. Istilah teknis (`finishing_config`, `batchDataOverride`, nama fungsi) tidak boleh muncul di layar.

### Sinkron ke Staging (wajib, sesuai SOP)
- Commit **hanya** file mockup: `git add public/mockup_video_studio_finishing.html` (`docs:`/`chore:`, tanpa rilis versi), push ke `main`, deploy atomic:
  `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`
- Jangan polling SSH berulang. Tunggu di sesi deploy yang sama (interval 60–120 dtk).
- Verifikasi HTTP 200: `http://100.95.245.55:5010/mockup_video_studio_finishing.html`.
- **Kirim link + hasil Fase 0 ke pengguna, lalu BERHENTI.**

---

## Fase 2–8 (hanya setelah mockup disetujui)

### Gerbang sebelum Fase 2: `implementation_plan.md`
Setelah pengguna menyetujui mockup, tulis `implementation_plan.md` untuk Fase 2–4 (Execution Task List + kode Sebelum/Sesudah per file), kirim ke pengguna, dan **tunggu persetujuan kedua**. Sertakan juga tiga keputusan yang masih terbuka di Fase 4.

### Fase 2: Perbaikan bug antrean + kolom DB + API + queue meneruskan parameter (batch TTS)
**Langkah pertama: perbaiki bug antrean** (commit terpisah `fix(video-studio): await pending job lookup in queue`):
- Tambahkan `await` pada `getPendingFfmpegStudioJob()` (baris 576) dan pada ketiga `updateFfmpegStudioJob(...)` (baris 583, 616, 626) di `triggerFfmpegStudioQueue()`.
- Tambah test kecil yang membuktikan antrean berhenti saat tidak ada job pending.
- Deploy Staging, ulangi render Fase 0, dan ambil frame "before" jika sebelumnya gagal.
**Migrasi** `scripts/migrate-ffmpeg-studio-finishing-fields.mjs` (pola `migrate-brand-finishing-fields.mjs`, advisory lock `makna_ffmpeg_studio_finishing_v1`):
```sql
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_template TEXT NULL;
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_config TEXT NULL;    -- JSON
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS progress_stage TEXT NULL;
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS finishing_status TEXT NULL;    -- 'applied' | 'skipped'
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS audio_mode TEXT NULL;          -- 'tts_batch' | 'single' | 'per_clip'
ALTER TABLE ffmpeg_studio_jobs ADD COLUMN IF NOT EXISTS yield_count INTEGER NOT NULL DEFAULT 0;
```
Jalankan untuk `dev` → `staging`. **Jangan** `public` tanpa izin pengguna. Update `createFfmpegStudioJob` (field baru default `NULL`/0, insert lama tetap jalan).

**API `render/route.js`**
- Terima `finishing_template`, `finishing_config`, `audio_mode`.
- Template harus ada di registry.
- Template kaya → plan wajib (kecuali registry bilang tidak perlu). Jalankan `validateFinishingPlan` dengan opsi yang sama seperti pemanggil produksi (`strictClaims: hasStrictTemplateCompliance(t)`, `isHerbalProduct`, `clipCount`, dan seterusnya). Error → HTTP 400 berbahasa Indonesia. Peringatan ikut di response.
- Cek pasangan klip di depan untuk `tts_batch` dan `per_clip`.

**Queue `triggerFfmpegStudioQueue()`**
- Parse `finishing_config` dengan aman (try/catch → `{}`). Teruskan hanya field yang ada.
- `processTtsStudioMuxing` mendapat tambahan **opsional**: `onProgress(stage)`, `shouldYield()` (dipakai di Fase 4), dan return `{ finishingApplied, finishingSkippedReason }`. Pemanggil produksi tidak mengirim callback, jadi perilakunya tidak berubah.
- Isi `progress_stage` dan `finishing_status`. Alasan skip masuk `error_log`, status tetap `completed`.

**Uji:** POST manual untuk `none`, `recipe_pop`, `problem_solution` dengan batch TTS + plan dari Fase 0 → MP4 penuh dengan overlay benar.

### Fase 3: Plan dari campaign asal (prioritas pengguna #1)
- `GET /api/video-studio/finishing-source?video_source_type=...&video_path=...` mengembalikan dari campaign asal: `finishingTemplate`, `finishingPlan`, `skin`, `brand` (atau id brand profile), `hookTitle`, `recipeData`/`productData`, `captionText`, teks VO per klip, dan `ttsBatchId` terkait jika ada. Ambil dari field yang dicatat di Fase 0. **Jangan menebak struktur**: ikuti cara `scheduler-processors.js` / `re-multiplier-worker.js` membangun `finishingMeta`.
- Jika video dipilih dari beberapa campaign berbeda, jangan gabungkan plan. Kembalikan `conflict: true` supaya UI meminta user memilih atau membuat plan baru.
- Plan campaign tetap divalidasi ulang. Jika gagal validator sekarang, kembalikan error yang jelas + saran generate ulang.
- Uji dengan minimal 1 video RE Campaign dan 1 Instant Factory: render dengan "Pakai apa adanya" harus menghasilkan overlay yang setara dengan hasil campaign aslinya (bandingkan frame).

### Fase 4: Slot render bersama, Video Studio mengalah
**Modul baru `lib/render-slot.js`** (kunci di sistem file, berlaku lintas proses dan environment):
- `RENDER_SLOT_DIR` dari env, default `~/.cfstudio/render-slots/`. Buat folder jika belum ada.
- `acquireProductionSlot({ env, jobRef })` → tulis `prod-<pid>-<jobRef>.json` (`{ env, jobRef, pid, startedAt, heartbeatAt }`), heartbeat setiap 30 dtk, kembalikan `release()`. **Tidak pernah menunggu atau melempar error yang menghentikan produksi.** Jika folder gagal ditulis, log peringatan lalu lanjut.
- `isProductionActive()` → ada file `prod-*` dengan `heartbeatAt` < 120 dtk. File basi dihapus.
- `getNextScheduledProductionAt()` → dari `campaign-scheduler` (jadwal terdekat di environment ini). Jika sulit diakses lintas environment, cukup environment sendiri, dan catat batasannya di laporan.

**Wrapper produksi:** bungkus kelima pemanggilan `processTtsStudioMuxing` di `scheduler-processors.js` dan `re-multiplier-worker.js`:
```js
const slot = await acquireProductionSlot({ env, jobRef });
try { await processTtsStudioMuxing({...}); } finally { slot.release(); }
```
Jangan mengubah argumen atau urutan logika lain.

**Antrean Video Studio:**
- Sebelum mengambil job: jika `isProductionActive()` atau jadwal produksi berikutnya < perkiraan durasi job (misalnya klip × 40 dtk, dikalibrasi dari log Fase 0), jangan mulai. Set `progress_stage = 'waiting_production'`, lepas flag antrean, dan jadwalkan cek ulang dalam 60 dtk (`setTimeout`, tanpa loop sibuk).
- Saat berjalan: `shouldYield = () => isProductionActive()` dicek di batas tahap (antar klip sync, sebelum concat, sebelum capture overlay, sebelum master pass). Jika `true`, engine melempar `RenderYieldError`. Antrean menangkapnya, membersihkan file sementara job, set status `pending`, `yield_count + 1`, `progress_stage = 'yielded'`, lalu kembali ke mode tunggu.
- `yield_count >= 3` → UI menampilkan saran (lihat mockup). Job tetap diantre, tidak digagalkan.

**Tiga hal yang harus diputuskan pengguna (tanyakan di `implementation_plan.md`, jangan diputuskan sendiri):**
1. **Production.** Penanda render produksi ditulis oleh kode produksi. Selama wrapper hanya ada di Staging, Video Studio **tidak bisa melihat** render Production, jadi "mengalah" belum benar-benar berlaku. Deploy Production tetap dilarang tanpa perintah pengguna. Laporkan ini dengan jelas dan minta keputusan kapan wrapper produksi naik ke Production.
2. **Batas tunggu.** Jika jadwal produksi rapat, job Video Studio bisa menunggu tanpa akhir. Usulkan batas (misalnya: setelah menunggu 60 menit, tampilkan pemberitahuan dan tombol "Batalkan"), lalu minta keputusan pengguna.
3. **Jeda di tengah capture overlay.** `shouldYield` hanya dicek di batas tahap, sedangkan capture overlay bisa beberapa menit. Ukur durasinya di Staging, lalu tanyakan apakah perlu titik jeda tambahan di dalam tahap itu (misalnya setiap N frame).

**Test:** `tests/render-slot.test.js`: acquire/release, heartbeat basi diabaikan, folder tidak bisa ditulis tidak menghentikan produksi, dan antrean tidak mulai saat produksi aktif.

### Fase 5: UI Panel Finishing
- Implementasi sesuai mockup. Komponen baru di `app/components/video-studio/` (`FinishingPanel.jsx`, `TemplateGallery.jsx`, `CampaignSourceBanner.jsx`, `FinishingPlanEditor.jsx`, `AudioModePicker.jsx`), supaya `page.js` tidak makin panjang.
- Saat video campaign dipilih → panggil `finishing-source` → isi otomatis semua field + pilih batch TTS terkait.
- Preview: `FinishingTemplatePreview` + `finishing-preview-builder`. Tambah prop opsional `backgroundVideoUrl` jika perlu, tanpa mengubah halaman lain.
- Tombol render nonaktif jika pasangan klip tidak cocok, plan wajib belum ada, atau validasi error.
- Antrean menampilkan `progress_stage` (dalam Bahasa Indonesia), `finishing_status`, dan `yield_count`.
- **100% semantic token dari `app/theme.css`**, adaptif light/dark, tanpa hex langsung.

### Fase 6: Audio upload/DB dengan template (keputusan pengguna #2)
- **Upload multi-file:** `upload/route.js` dan UI mendukung banyak file audio dengan urutan. Batas ukuran per file tetap mengikuti aturan yang ada.
- **Mode B `per_clip`** (jumlah audio = jumlah klip): bangun `batchDataOverride` N klip berstatus `completed` (path audio, teks VO per klip jika ada, `clip_index` berurutan) → `processTtsStudioMuxing`.
- **Mode A `single`** (1 audio, N klip): gabungkan klip video dulu menjadi satu file sementara (cut atau xfade sesuai pilihan; pakai `runConcatStage` atau helper yang ada, jangan membuat ulang), lalu `batchDataOverride` 1 klip (video gabungan + audio) → `processTtsStudioMuxing`. Layer berbasis nomor klip diletakkan berdasarkan waktu bicara. Jika engine belum mendukung, petakan `clip_index` di plan ke rentang waktu dengan membagi durasi video gabungan sesuai durasi asli tiap klip, sebelum dikirim ke engine.
- **Word timing:** jangan menulis aligner baru. Pakai `resolveClipWordTimings`:
  - ada teks VO → Tier 3,
  - tanpa teks + Whisper tersedia → Tier 2. Endpoint `POST /api/video-studio/transcribe` mengembalikan teks agar user bisa mengoreksi sebelum render,
  - tanpa teks + tanpa Whisper → caption dimatikan (`captionMode` khusus atau `enableMotionText` untuk layer caption saja; ikuti mekanisme yang ada), layer non-caption tetap tampil.
- Simpan `audio_mode` di job. Template `none` + audio upload tetap lewat `processVideoMuxing`.
- Uji: mode A dan B masing-masing dengan `recipe_pop` dan `problem_solution`. Untuk mode B, bandingkan hasilnya dengan render dari batch TTS yang setara.

### Fase 7: Plan cadangan: generate AI + manual
- `POST /api/video-studio/finishing-plan-generate` → `{ templateId, batchId | voTexts[], productData?, recipeData? }` → LLM dengan `buildFinishingPlanPromptJson(templateId)` + `FINISHING_PLAN_PROMPT_APPENDIX`, lewat client LLM dan key pool tenant yang sudah dipakai campaign. Hasil langsung divalidasi. Kembalikan `{ plan, warnings, errors }`.
- `POST /api/video-studio/finishing-plan-validate` untuk form manual.
- Form manual per template mengikuti struktur validator (`validateChipsList`, `validateTipsList`, `validateCompareList`, `validateMythFact`, `validateChapters`, `validateTimingBadges`, `validateCallouts`, `validateNumbersList`). Jangan mengarang field.

### Fase 8: Test, dokumentasi, rilis Staging
- `tests/video-studio-finishing.test.js` (`node --test`):
  - queue meneruskan parameter (mock engine),
  - job lama tanpa `finishing_config` → argumen engine sama seperti sebelumnya,
  - API menolak template tidak dikenal, plan invalid, dan klip tidak berpasangan,
  - `finishing_config` rusak → render jalan tanpa finishing dengan `finishing_status = 'skipped'`,
  - `batchDataOverride` mode A dan B tersusun benar,
  - `RenderYieldError` → job kembali `pending` dan `yield_count` bertambah.
- `tests/render-slot.test.js` (Fase 4).
- Jalankan test terkait yang sudah ada (`tests/opc-ffmpeg-guard.test.js`, `tests/youtube-studio-timeline-mux.test.js`, test finishing lain). Semua harus hijau.
- Perbarui `sot/menus/video-studio.md` (bagian Finishing, mode audio, aturan mengalah) dan `sot/global/changelog.md`.
- `npm run release-non-interactive` → deploy Staging atomic dengan full SHA.

---

## Aturan pengerjaan
- Urutan uji template: `none` → `recipe_pop` → `problem_solution` → `tips_listicle` → `ramuan_ritual` → `calm_wellness` → `angka_banding` → `mitos_fakta`.
- **Kepatuhan klaim:** template strict/herbal wajib lewat `strictClaims`, termasuk plan dari campaign dan dari AI.
- **Grounding VO:** teks overlay wajib berasal dari VO/transkripsi atau data produk. Jika tidak lolos, kosongkan, jangan dikarang.
- Antrean Video Studio tetap sekuensial. Tidak boleh ada dua render Video Studio bersamaan.
- Migrasi DB hanya lewat script, sesuai SOP (`DISABLE_AUTO_MIGRATIONS=true` saat build).

## Kriteria selesai (cek sebelum lapor)
- [ ] Bug `await` antrean sudah dipastikan dan diperbaiki (atau dibuktikan bukan bug).
- [ ] Ke-8 template bisa dipilih dan menghasilkan MP4 **penuh seluruh klip** (minimal diuji: `none`, `recipe_pop`, `problem_solution`, `tips_listicle`, `mitos_fakta`).
- [ ] Video dari RE Campaign / Instant Factory otomatis memuat template, skin, brand, plan, dan batch TTS. "Pakai apa adanya" menghasilkan overlay setara campaign asli.
- [ ] Audio upload mode A dan B berfungsi, termasuk transkripsi (jika Whisper ada) dan fallback tanpa caption.
- [ ] Saat render produksi berjalan, job Video Studio tidak mulai. Saat produksi mulai di tengah render Video Studio, job dijeda di batas tahap dan diantre ulang. **Waktu render produksi tidak bertambah** (bandingkan dengan log sebelum perubahan).
- [ ] Log produksi menunjukkan slot acquire/release. Output produksi identik dengan sebelumnya.
- [ ] Laporan menyebut dengan jelas apakah wrapper produksi sudah ada di Production atau baru di Staging, dan apa akibatnya.
- [ ] Tidak ada file di luar lingkup yang ikut ter-commit (cek `git show --stat` setiap commit).
- [ ] Job lama dan render tanpa template identik dengan sebelumnya.
- [ ] Pasangan klip tidak cocok ditolak sebelum antre. Job yang finishing-nya dilewati berlabel "Selesai tanpa finishing" + alasan.
- [ ] UI lolos cek light/dark, tanpa hex langsung.
- [ ] Semua test baru + test terkait hijau.
- [ ] Frame sesudah di `scratch/video_studio_finishing/after/<template>/` dilaporkan bersama link Staging.

## Format laporan ke pengguna
Bahasa sederhana: apa yang berubah, link Staging untuk dicoba, contoh hasil per template dan per mode audio, bukti Video Studio mengalah ke produksi, apa yang belum, dan apa yang perlu diputuskan pengguna.

---

## Execution Task List
- [x] Fase 0: Bukti awal + catatan (lokasi plan campaign, Whisper, folder slot, jalur skin, gejala bug antrean), tanpa mengubah kode
- [x] Fase 1: Mockup `public/mockup_video_studio_finishing.html` (dengan pemilih skenario A–G) di Staging → **STOP, tunggu persetujuan mockup**
- [x] Gerbang: `implementation_plan.md` Fase 2–4 (before/after + 3 keputusan terbuka) → **STOP, tunggu persetujuan kedua**
- [x] Fase 2: Perbaikan bug `await` antrean + test + deploy Staging
- [x] Fase 2: Migrasi kolom + API + queue meneruskan parameter (batch TTS) + uji POST manual
- [x] Fase 3: Plan dari campaign asal (`finishing-source`) + uji setara campaign
- [x] Fase 4: `lib/render-slot.js` + wrapper produksi + antrean mengalah + test
- [x] Fase 5: UI Panel Finishing + banner campaign + preview + status antrean
- [x] Fase 6: Audio upload mode A & B + transkripsi/word timing
- [x] Fase 7: Plan cadangan: generate AI + form manual
- [ ] Fase 8: Test, dokumentasi SOT, rilis & deploy Staging
