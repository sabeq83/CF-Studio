# Instruksi Antigravity: Finishing Pass Video (Motion Text, Keyword Punch, Template)

> **Revisi 01 berlaku:** baca `antigravity_finishing_pass_revisi_01.md` sebelum mengerjakan apa pun. Revisi itu mengubah hook card Fase 0 (compliance + auto-fit), timing subtitle Fase 0, dan renderer layer animasi (template HTML + Playwright, menggantikan Sharp/SVG Fase 2 dan Remotion Fase 3), aturan agar template bersifat umum (R6), re-finish backlog ContentFlow (R7), dan penempatan pilihan template di preset (R8).

> **Revisi 02 berlaku (setelah v2.44.6):** baca `antigravity_finishing_pass_revisi_02.md`. Fase 2b dibatalkan, ditambah pengaman urutan klip, registry template, dan Fase 2c (lima template baru).

## Mandat

Implementasikan usulan di `USULAN_FINISHING_VIDEO_CFSTUDIO.md` (root repo) (terutama bagian 4, 4b dan 5) di repo ini, bertahap per fase, tanpa memperluas scope.

Acuan visual dan timing yang **wajib ditiru**: `mockup_finishing_preview.html` (root repo; versi dengan video: https://claude.ai/artifact/CdWRnLwNv1pJj4dGg1CvjB). Objek `PROJECTS`, fungsi `derive()` dan `render()` di dalamnya adalah spesifikasi hidup: posisi, ukuran, warna, easing, dan aturan potongan subtitle. Jika ragu, ikuti mockup.

## Urutan Wajib

1. Baca `AGENTS.md`, usulan, dan source mockup sepenuhnya.
2. Periksa `git status`; jangan overwrite perubahan user.
3. Baca dokumentasi Next.js relevan di `node_modules/next/dist/docs/` dan dokumentasi Remotion 4 sebelum menulis kode.
4. Buat `finishing_pass_implementation_plan.md` di root repo dengan `## Execution Task List` per fase, berisi **Code Sebelum** dan **Code Sesudah** untuk setiap file yang diubah.
5. Kerjakan **satu fase per rilis**: Fase 0 → verifikasi → rilis → Fase 1 → dst. Jangan menggabungkan fase.
6. Centang task hanya setelah diverifikasi.
7. Jalankan lint, test, build, dan smoke test staging setiap fase.

## Konteks Kode (sudah diaudit)

| Bagian | Lokasi |
|---|---|
| Render utama (dipakai OPC, RE, Multiplier) | `lib/video-studio-processor.js` → `processTtsStudioMuxing()` sekitar baris 604–905 |
| Mux per klip + sync stretch/loop/freeze | `processVideoMuxing()` baris 100+, `lib/smart-sync-engine.js` |
| Motion text sekarang (Sharp + SVG, 15fps, per klip) | `lib/motion-text-engine.js` → `generateMotionTextFrames()` |
| Transisi xfade + acrossfade | `buildXfadeFilterGraph()` di `lib/motion-text-engine.js` |
| Pemanggil render | `lib/scheduler-processors.js` (~3088 RE angle, ~4164 RE item, ~7441 OPC), `lib/re-multiplier-worker.js` ~1310 |
| Data VO per klip | tabel `tts_studio_clips` (`source_text`, `audio_path`, `clip_index`), `getTtsBatchWithClips()` di `lib/db.js:1999` |
| Pembersih markup TTS | `lib/tts-text-sanitizer.js` → `stripTtsMarkupTags()` |
| ElevenLabs TTS (masih endpoint tanpa timestamp) | `lib/elevenlabs-tts.js:75` |
| Remotion (sudah terpasang v4) | `lib/remotion-engine.js`, `remotion/Root.jsx`, `remotion/components/` |
| Setting campaign motion text | kolom `enable_motion_text`, `motion_text_style`, `motion_text_position`, `motion_*_effect`, `video_transition`, `transition_duration` |

Fakta penting:
- ffmpeg Homebrew di Mac **tidak** punya filter `ass`, `subtitles`, `drawtext`. Jangan pakai jalur itu. `zoompan` dan `loudnorm` tersedia.
- Parameter `effect`, `tag`, `brand` di `generateMotionTextFrames()` saat ini diabaikan.
- Teks dibakar per klip **sebelum** xfade, sehingga teks bertumpuk saat transisi.
- `recipe_text_markdown` baru ada di `content_flow_items` **setelah** render. Untuk render, cari sumber resep/bahan yang tersedia sebelum tahap ffmpeg (payload storyboard/resep di task Multiplier/Recipe/OPC). Audit dulu, catat di plan.

## Fase 0: Perbaikan cepat (tanpa arsitektur baru)

1. `loudnorm=I=-14:TP=-1.0:LRA=11` pada encode final `processTtsStudioMuxing()`.
2. Usut tag `<#1.0#>` yang tampil di video `mul_261113_qt67yl` (regex di sanitizer terlihat benar). Cari bentuk teks yang sebenarnya masuk ke `generateMotionTextFrames()` di staging (escape HTML, karakter lain, atau jalur yang tidak memanggil sanitizer). Tambah test regresi.
3. QA guard sebelum render: tolak/strip teks overlay yang masih berisi `<#`, `#>`, `[`, `]`, atau tag interjeksi.
4. fps overlay = fps video, bukan 15.
5. Default `video_transition` jadi `cut` untuk campaign baru. Untuk campaign lama yang masih `fade`, teks tidak boleh ikut di-crossfade (pindahkan overlay ke setelah concat atau fade hanya video).
6. Caption: potongan 2–4 kata (aturan di mockup `derive()`), ukuran 6,6% lebar, stroke lebih tebal.
7. Hook title statis di frame 0 (1,5–2 dtk) dari field hook item, tanpa `#Shorts`.
8. Pasang font OFL (Anton, Montserrat 800/900) sebagai file di repo (`public/fonts/` atau `assets/fonts/`) dan pastikan Sharp/librsvg memakainya (fontconfig). Verifikasi dengan render, bukan asumsi.

## Fase 1: Word timestamps + Keyword Punch

1. Kolom baru `word_timings_json` di `tts_studio_clips` (migration PostgreSQL untuk schema dev/staging/public + SQLite jika masih dipakai). Format: `[{ "w": "pisang", "s": 0.61, "e": 0.98 }]`, detik relatif terhadap awal audio klip.
2. Sumber timestamp berjenjang, disimpan beserta `word_timings_source`:
   1. ElevenLabs `POST /v1/text-to-speech/{voice_id}/with-timestamps` (alignment per karakter → gabungkan jadi kata).
   2. whisper.cpp lokal (word-level, bahasa `id`) jika tersedia di host.
   3. Cadangan wajib: `silencedetect=noise=-35dB:d=0.08` → rentang bicara → bagi kata berdasarkan bobot `jumlah_huruf + 1.6` (persis seperti mockup).
3. Backfill on-demand: jika klip lama belum punya timings, hitung saat render memakai cadangan (3).
4. `finishing_plan` (skema di usulan bagian 4b) dihasilkan di tahap storyboard: tambahkan instruksi ke prompt storyboard yang relevan tanpa mengubah bagian prompt lain. Validasi di server:
   - `phrase`/`trigger` harus substring persis dari VO klip (setelah `stripTtsMarkupTags`).
   - Maks 2 punch per klip.
   - Blokir kata klaim kesehatan untuk produk herbal (pakai aturan compliance yang sudah ada di repo jika ada, jika belum buat daftar blokir terpusat).
   - Gagal validasi → layer dilewati, render tetap jalan, catat warning.
5. Kolom campaign/preset baru: `caption_mode` (`full` | `hybrid` | `keyword_only`, default `hybrid` untuk campaign baru, `full` untuk yang lama), `finishing_template` (`none` | `calm_wellness` | `recipe_pop`), `loudness_target` (default -14).
6. Render punch + subtitle hybrid di **timeline global setelah concat** (bukan per klip).

## Fase 2: Overlay data + kamera

1. Daftar bahan, penanda langkah, ajakan simpan (template `recipe_pop`).
2. Kartu produk memakai foto produk bersih yang sudah dipakai pipeline (`product_ref_image_path` / foto clean produk). Deskripsi hanya dari data produk.
3. CTA animasi per platform (keranjang kuning vs link di bio) mengikuti CTA di naskah.
4. Gerak kamera: zoom pelan per klip + punch-in saat punch (nilai di usulan 4b).
5. Flash di cut dan SFX (pop/whoosh/tick). SFX boleh file pendek berlisensi bebas di repo, diredam di bawah VO.

## Fase 3: Finishing Pass Remotion

1. Composition baru `FinishingPass` di `remotion/`: `<OffthreadVideo>` base video + layer sesuai template. Props = timeline global (kata, punch, bahan, langkah, produk, CTA, offset klip). Komponen dipisah per layer (`HookCard`, `CaptionChunks`, `KeywordPunch`, `IngredientStack`, `StepBadge`, `SavePrompt`, `ProductCard`, `CtaArrow`, `ProgressBar`, `CutFlash`). Gerak kamera di-render sebagai transform pada video.
2. Durasi composition dihitung dari base video (`calculateMetadata`), fps = fps base.
3. Alur render: mux per klip (tanpa teks, CRF 16) → concat cut → `base.mp4` → Remotion `FinishingPass` → mux audio final (VO + SFX + loudnorm).
4. Jika Remotion gagal, fallback ke hasil Fase 0/1 (Sharp/SVG di timeline global). Render tidak boleh gagal total karena finishing.
5. Antrean ffmpeg tetap serial (`ffmpegStudioQueueActive`). Ukur waktu render dan catat di laporan.

## Aturan Utama

- Jangan generate ulang video AI. Semua efek di atas klip yang ada.
- Jangan mengarang teks: hook, bahan, deskripsi produk, CTA hanya dari data item/produk/naskah.
- Campaign lama tetap jalan dengan perilaku lama kecuali setting baru diaktifkan.
- Satu item gagal finishing tidak boleh menggagalkan upload/sync item itu (fallback ke versi tanpa finishing + warning).
- Validasi tenant di server.
- Jangan ubah prompt, preset, atau UI di luar kebutuhan ini.
- Jangan deploy production.

## Bukti Verifikasi Minimum (per fase yang relevan)

- Render ulang `opc_2117` dan `mul_261113_qt67yl` di staging. Kirim frame tiap 0,5 dtk (contact sheet) dan bandingkan dengan mockup.
- Loudness output -14 ±1 LUFS (`ffmpeg -af loudnorm=print_format=summary`).
- Tidak ada tag markup di frame mana pun.
- Frame 0 berisi hook title.
- Tidak ada teks bertumpuk di sekitar cut.
- Punch muncul ±0,15 dtk dari kata yang diucapkan (cek manual minimal 5 punch).
- Kata klaim kesehatan tidak pernah jadi punch untuk produk herbal (unit test).
- Validasi `finishing_plan` gagal → render tetap selesai tanpa layer itu (unit test).
- Campaign lama (`caption_mode` kosong) menghasilkan output setara versi sebelumnya.
- OPC, RE, Multiplier tidak regression. Build berhasil.

## Kontrol Plan

Jika ada file tambahan yang perlu diubah, tambahkan dulu ke plan beserta **Code Sebelum** dan **Code Sesudah**. Jangan mencentang task sebelum diverifikasi.

## Release

Satu rilis per fase, contoh Fase 0:

```bash
npm run release-non-interactive -- --type patch --title "Finishing Pass Fase 0" --points "Normalisasi loudness -14 LUFS|Perbaiki tag TTS bocor di motion text|Caption per potongan 2-4 kata dan hook title di frame awal"
```

Laporkan file yang diubah, migration, hasil test/build, smoke test staging (dengan contact sheet dua video acuan), waktu render sebelum/sesudah, versi, commit, tag, push, dan risiko tersisa. Jangan deploy production.
