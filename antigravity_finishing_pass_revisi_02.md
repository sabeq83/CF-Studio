# Revisi 02: Finishing Pass (berlaku setelah rilis Fase 2 v2.44.6)

Dokumen ini mengoreksi `finishing_pass_implementation_plan.md` dan melengkapi `antigravity_finishing_pass_revisi_01.md`. Jika bertentangan, **Revisi 02 yang berlaku**.

Fase 0–2 sudah selesai dan dirilis (v2.44.4–v2.44.6). Pertahankan semuanya. Revisi ini mengatur langkah berikutnya.

## Langkah wajib sebelum coding

1. Baca revisi ini, `USULAN_TEMPLATE_FINISHING_TAMBAHAN.md`, dan source `mockup_finishing_templates_v3.html` (tab `masalah`, `angka`, `tips`, `ramuan`, `mitos`).
2. Perbarui `finishing_pass_implementation_plan.md` sesuai R9–R13. Tandai bagian yang berubah dengan `(Revisi 02)`.
3. Laporkan plan yang sudah diperbarui dan **berhenti**. Tunggu persetujuan user sebelum mengerjakan R10.

---

## R9. Fase 2b DIBATALKAN

Keputusan user: **tidak ada render ulang video lama**. Finishing hanya berlaku untuk video yang diproduksi setelah fitur aktif.

1. Hapus seluruh tracker Fase 2b (F2b-T1 s/d F2b-T6) dari plan. Ganti dengan satu baris: `Fase 2b dibatalkan (Revisi 02, R9).`
2. **Jangan** membuat: `lib/contentflow-refinish-service.js`, tool MCP `cf_refinish_content_flow`, endpoint re-finish, kolom `finishing_version` / `finishing_applied_at` / `finishing_source` / `finishing_status` di `content_flow_items`, maupun perubahan `auto-pipeline-scheduler-runner.js` untuk re-finish.
3. Jangan menambahkan jalur apa pun (jadwal, tombol, script) yang memproses ulang item ContentFlow yang sudah `Completed`.
4. R7 dan R8.6 di Revisi 01 tidak berlaku lagi.

## R10. Pengaman urutan dan pasangan klip (wajib, sebelum template baru)

**Latar:** saat membuat mockup v3, script penyusun base video mengurutkan file klip memakai angka terakhir di nama file. Untuk `.mp3`/`.mp4` angka itu adalah `3`/`4` dari ekstensi, sehingga urutan video, audio, dan teks VO teracak dan hasilnya tidak sinkron. Perbaikannya ada di `plans/finishing-pass-reference/build_base.py` (lihat fungsi `num`). Pipeline utama tidak memakai nama file, tetapi punya risiko serupa di level data.

**Audit (catat hasilnya di plan):**
1. Tipe kolom `tts_studio_clips.clip_index` di PostgreSQL untuk schema `dev`, `staging`, `public`. Skema SQLite lama memakai `INTEGER`. Jika di PostgreSQL ternyata `TEXT`/`VARCHAR`, `ORDER BY clip_index` akan mengurutkan `10` sebelum `2` untuk video dengan 10 klip atau lebih. Perbaiki dengan `ORDER BY clip_index::int` di `getTtsBatchWithClips()` dan query serupa (`lib/db.js` sekitar baris 2029 dan 2048), atau migrasi tipe kolom.
2. Asal urutan `visual_clip_paths` per jalur (OPC, RE, Multiplier, custom storyboard). Pastikan urutannya ditentukan oleh indeks klip, bukan urutan selesai render atau urutan nama file.

**Pengaman di `processTtsStudioMuxing()`** sebelum mux:
1. Jumlah klip video = jumlah klip TTS = jumlah teks VO. Sudah ada untuk video vs TTS, pertahankan.
2. Jika path video atau nama file audio memuat nomor klip, nomor itu harus cocok dengan `clip_index` pasangannya. Ambil nomor dengan regex yang mengabaikan ekstensi, misalnya `/(\d+)\.(?:mp3|mp4|wav|mov)$/`. Jangan pakai "angka terakhir di nama file".
3. Durasi audio hasil probe harus cocok dengan durasi yang tercatat di data TTS (toleransi ±0,3 dtk) bila data itu ada.
4. Jika salah satu pemeriksaan gagal: **jangan render finishing**. Pakai jalur tanpa finishing dan catat warning dengan detail pasangan yang tidak cocok. Render tidak boleh gagal total.

**Test:** unit test pengurutan dan pemasangan dengan nama file nyata: `*_audio_clip_01.mp3`, `*_audio_clip_11.mp3`, `*_audio_clip_21.mp3`, `*_video_clip_1.mp4`…`*_video_clip_10.mp4`, `*_scene_c01.mp4`, `*_vo_c01.mp3`. Termasuk kasus 10+ klip.

## R11. Registry template terpusat

**Masalah:** nama template saat ini tertulis langsung di banyak tempat: `lib/finishing-overlay-renderer.js` (`resolveFinishingTemplatePath`), `lib/finishing-data-extractor.js` (`suggestFinishingTemplate`), `lib/video-studio-processor.js` (`isRichTemplate`), dropdown `app/settings/presets/page.js`, dan lima `z.enum([...])` di `apps/mcp/tools.mjs`. Menambah 5 template akan mengubah semua tempat itu.

**Perubahan:**
1. Buat `lib/finishing-template-registry.js` sebagai satu-satunya sumber daftar template. Per entri minimal: `id`, `file` (di `templates/finishing/`), `label` dan `description` untuk UI, `layers` yang didukung, `finishingPlanFields` yang dibutuhkan, `suggestFor` (jenis konten yang cocok), dan `compliance` (misalnya `strictClaims: true` untuk `ramuan_ritual`).
2. Renderer, extractor, processor, UI Presets, dan MCP membaca daftar dari registry. Enum Zod dibangun dari registry (`z.enum(TEMPLATE_IDS)`).
3. Perbaiki `suggestFinishingTemplate()`: kembalikan `null` jika tidak ada template yang cocok. Saat ini default-nya `calm_wellness` untuk konten apa pun, bertentangan dengan R6.5.
4. Test: menambah entri dummy ke registry membuat template muncul di UI dan diterima MCP tanpa perubahan di tempat lain.

## R12. Fase 2c: lima template baru

Spesifikasi lengkap: `USULAN_TEMPLATE_FINISHING_TAMBAHAN.md`. Acuan visual dan timing: tab baru di `mockup_finishing_templates_v3.html` (objek `PROJECTS`, `xHtml()`, `xAnim()`, CSS kelas `.x-*`). Semua aturan R6 (template umum), R8 (preset), dan compliance tetap berlaku.

### R12.1 Urutan pengerjaan (satu rilis per butir)

1. **Layer bersama**: watermark brand, kartu penutup brand, lower-third presenter, patch brand, label sesuai bahasa konten (`target_language`). Data dari brand profile (perlu field: logo transparan, warna brand, tagline, CTA default per platform, teks catatan aman, nama tim/presenter, lokasi opsional).
2. `tips_listicle` (Sasyahouse).
3. `ramuan_ritual` (Siasat Sehat, Nutriblend, Dapur Botani resep herbal).
4. `problem_solution` (Ruang Akustik ID).
5. `angka_banding` (Solusi Thermal ID).
6. `mitos_fakta` (Siasat Sehat, Dapur Botani, Ruang Akustik ID).

### R12.2 Perluasan `finishing_plan`

Tambahkan field opsional berikut ke skema di `lib/prompts.js` **hanya untuk preset yang memakai template terkait**, tanpa mengubah bagian prompt lain. Validasi di `lib/finishing-plan-validator.js`:

| Field | Template | Aturan validasi |
|---|---|---|
| `chapters: [{clip_index, label}]` | `problem_solution` | Label dari daftar tetap (MASALAH, PENYEBAB, SOLUSI, HASIL) |
| `callouts: [{trigger, text, sub?}]` | `problem_solution` | `trigger` dan `text` harus ada di VO |
| `compare: {trigger, left:{title,sub,good}, right:{...}}` | `angka_banding` | Judul harus berasal dari kata di VO klip terkait |
| `numbers: [{trigger, value, unit}]` | `angka_banding` | `value` wajib muncul di VO atau data produk. Jika tidak ada angka, layer dilewati |
| `tips: [{clip_index, text}]` | `tips_listicle` | `text` ≤ 6 kata, ringkasan dari VO klip itu |
| `timing_badges: [{trigger, emoji, title}]` | `ramuan_ritual` | `trigger` di VO, `title` dari daftar tetap (SEBELUM TIDUR, PAGI PERUT KOSONG, DIAMKAN …) atau dari resep |
| `myth_fact: [{type:'myth'\|'fact', trigger, text, why?}]` | `mitos_fakta` | `trigger` di VO. Untuk konten kesehatan, `text` dan `why` lolos `isHerbalMedicalClaimPhrase` |
| `punch_display` (pada punch) | semua | Teks tampilan alternatif, contoh "sepuluh persen" → "10%". Harus setara makna dengan frasa VO |

Untuk `ramuan_ritual`, kata klaim (lemak, metabolisme, detoks, ginjal, gula darah, kolesterol, visceral, dan sejenisnya) **selalu** diblokir dari hook dan punch, apa pun jenis produknya.

### R12.3 Timing

Pertahankan Tier 1–3 dari Fase 1. Untuk Tier 3, pakai perbaikan dari mockup v3: kata disebar hanya di **waktu bicara** (jeda di audio dilewati), dan batas tanda baca (`, . ? ! :`) dikunci ke jeda nyata bila jaraknya < 0,9 dtk. Lihat `derive()` di `mockup_finishing_templates_v3.html`.

### R12.4 Patch brand untuk teks AI rusak

Video Solusi Thermal ID `opc_2107` klip 4 berisi teks AI rusak ("Solusi Tinemal ID mark") di kanan atas selama ±7 dtk. Layer `patch` di mockup menutupnya dengan nama brand yang benar.
- Fase ini: patch hanya dipasang jika `finishing_plan` atau operator menandai klip dan area secara eksplisit.
- Deteksi otomatis (OCR) di luar scope. Catat sebagai pekerjaan berikutnya.

### R12.5 Verifikasi per template

- Render di staging minimal 1 video nyata dari brand sasaran template itu (bukan video acuan lama), contact sheet tiap 0,5 dtk, dan bandingkan dengan tab mockup.
- Cek sinkron manual: minimal 5 titik per video, awal kata ±0,2 dtk.
- Unit test validator untuk field baru, termasuk kasus gagal (layer dilewati, render tetap jalan).
- Grep `templates/finishing/` bebas nama brand, angka detik tetap, dan teks spesifik video (R6.6).
- Template baru tidak mengubah output `calm_wellness` / `recipe_pop` (regression test).

## R13. Fase 3 setelah Fase 2c

Fase 3 (preview UI, performa) dikerjakan setelah semua template Fase 2c dirilis, supaya preview dan benchmark mencakup ketujuh template. Isi F3-T1 s/d F3-T4 tetap, ditambah: benchmark wajib memuat template terberat (`tips_listicle` dengan rekap, `problem_solution` dengan callout).

## Ringkasan perubahan tracker

| Bagian | Perubahan |
|---|---|
| Fase 2b | Dibatalkan, semua task dihapus (R9) |
| Baru: Fase 2c-0 | Pengaman urutan klip (R10) + registry template (R11). Satu rilis, sebelum template baru |
| Baru: Fase 2c-1 s/d 2c-6 | Layer bersama + lima template, satu rilis per butir (R12.1) |
| Fase 3 | Setelah Fase 2c, benchmark mencakup 7 template (R13) |

Aturan lain tetap berlaku: satu fase per rilis, jangan deploy production, campaign lama tidak berubah, teks tidak boleh dikarang.
