# Instruksi Antigravity: Cek Ulang Plan Finishing Pass (setelah Revisi 01)

## Mandat

Sebelum menulis kode apa pun, **cek ulang dan perbarui** `finishing_pass_implementation_plan.md` agar sesuai dengan `antigravity_finishing_pass_revisi_01.md` (R1–R8). Tugas ini **hanya dokumen**: jangan mengubah kode, jangan migration, jangan rilis, jangan deploy.

## Urutan Wajib

1. Baca ulang, berurutan: `antigravity_finishing_pass_instructions.md` → `antigravity_finishing_pass_revisi_01.md` → `USULAN_FINISHING_VIDEO_CFSTUDIO.md` (bagian 4, 4b, 5) → `finishing_pass_implementation_plan.md`.
2. Baca acuan di `plans/finishing-pass-reference/` (`overlay.html`, `capture.cjs`, `compose.py`, `filter.txt`, `meta.json`).
3. Periksa `git status`. Jangan overwrite perubahan user (termasuk `lib/tts-text-sanitizer.js`).
4. Perbarui plan sesuai revisi. Tandai setiap bagian yang berubah dengan `(Revisi 01)`.
5. Isi checklist di bawah dengan jujur (✅ / ❌ / ⚠️ + lokasi di plan). Jangan mencentang yang belum benar-benar tertulis di plan.
6. Laporkan hasilnya dan **berhenti**. Tunggu persetujuan user sebelum mengerjakan Fase 0.

## Checklist Kesesuaian (wajib diisi di laporan)

### R1. Hook card Fase 0
- [ ] `isHerbalMedicalClaimPhrase()` dipindah ke Fase 0 dan dipakai untuk hook card.
- [ ] `fitHookCard()` ada di Fase 0: maksimal 2 baris, ukuran font adaptif, lebar diukur dengan font sebenarnya, `null` jika terlalu panjang atau mengandung klaim.
- [ ] Prioritas sumber hook: `finishing_plan.hook` → `custom_hook`/`yt_title` yang lolos `fitHookCard`.
- [ ] `isHerbalProduct` default `true` jika tidak bisa ditentukan.
- [ ] Unit test 2 hook nyata (opc_2117 → `null`, mul_261113_qt67yl → 2 baris atau `null`).

### R2. Timing subtitle Fase 0
- [ ] Tier 3 (`silencedetect` + bobot `norm(w).length + 1.6`) dipakai sejak Fase 0, dihitung saat render tanpa kolom DB.
- [ ] Offset global = awal klip di base video + waktu kata relatif audio klip. Jalur yang mengubah tempo audio sudah diaudit.
- [ ] Verifikasi ±0,2 dtk pada minimal 5 potongan per video acuan.

### R3. Renderer
- [ ] Fase 0: Sharp/SVG hanya untuk subtitle + hook, sekaligus menjadi fallback permanen.
- [ ] Mulai Fase 1: `lib/finishing-overlay-renderer.js` (Playwright) + `templates/finishing/*.html` dengan kontrak `loadTimeline(json)` + `renderAt(t)`, font lokal `@font-face`.
- [ ] Layer data Fase 2 (F2-T3) **tidak** lagi di Sharp/SVG.
- [ ] Kamera di ffmpeg setelah concat, dengan upscale 3× sebelum `zoompan`.
- [ ] Fase 3 diganti: template final + preview UI dengan HTML yang sama + pengukuran performa. Remotion hanya jika render > 3× durasi, dan harus lapor dulu.
- [ ] Gagal di renderer → fallback ke hasil Fase 0 + warning, upload tetap jalan.

### R4. Operasional
- [ ] Cek Chromium Playwright di host staging tercantum sebagai task.
- [ ] Catatan font emoji (macOS vs Linux) tercantum.
- [ ] Pencatatan waktu capture + komposit per video di log dan laporan rilis.

### R5. Tracker
- [ ] Semua baris di tabel R5 sudah tercermin di tracker (F0-T3/T4, F1-T3, F1-T5, F2-T2, F2-T3, F3-T1..T3, F3-T4, Fase 2b, verifikasi).

### R6. Template umum
- [ ] Pemisahan 3 lapisan (template / brand / video) tertulis, dan template dilarang memuat teks, detik, atau nama produk spesifik.
- [ ] Setiap nilai hardcoded di tabel R6.2 punya pengganti di plan (ajakan simpan, batas daftar bahan, durasi kartu produk, jumlah langkah, font hook, label, disclaimer herbal, deskripsi produk, posisi).
- [ ] Batas isi R6.3 (maks 4 chip + "+n", label panjang, punch tidak muat, jumlah klip 3–8, data resep kosong).
- [ ] Aturan tabrakan layer R6.4 (zona, prioritas, slot alternatif).
- [ ] `suggestFinishingTemplate()` hanya untuk saran UI, tidak memilih otomatis. `product_hard_sell` di luar scope.
- [ ] Verifikasi R6.6: unit test 4/6/8 klip, resep 8 bahan, video ketiga dari akun berbeda, grep string terlarang di `templates/finishing/`.

### R7. Re-finish backlog (Fase 2b)
- [ ] Fase 2b tercantum sebagai rilis tersendiri setelah Fase 2.
- [ ] Audit pemetaan item → folder Nextcloud per sumber (OPC, RE, Multiplier, Recipe Labs) tercantum, akses lewat `lib/nextcloud-helper.js`.
- [ ] Kriteria R7.1 lengkap, termasuk "tidak ada publishing job dalam status apa pun".
- [ ] Alur R7.2 lengkap: cadangan `*_final_v0.mp4`, kolom `finishing_version` / `finishing_applied_at` / `finishing_source`, gagal → file lama tetap dipakai.
- [ ] `refinishContentFlowItems` dengan `dryRun` default `true`, `limit` default 10, idempoten, berhenti setelah 3 gagal berturut-turut. Tool MCP `cf_refinish_content_flow`.
- [ ] `finishing_status = 'processing'` dan scheduler Repliz melewati item tersebut.
- [ ] Verifikasi R7.5 lengkap.

### R8. Preset
- [ ] Field `finishing_template`, `caption_mode`, `loudness_target` di `preset.workflow` + default bawaan di `lib/operator-presets.js`. Preset lama tetap berperilaku lama.
- [ ] Urutan prioritas override → preset → default, dan nilai disalin ke campaign/task saat dibuat.
- [ ] Semua jalur di tabel R8.3 tercantum dengan file dan baris: OPC, RE, Multiplier (config task), custom storyboard, Recipe Labs (`globalSettings`), auto pipeline, tool MCP preset.
- [ ] Test satu preset → nilai sama di semua jalur.
- [ ] Warna aksen, label, CTA, dan status herbal **tidak** disimpan di preset.
- [ ] UI field template di halaman Presets dimajukan ke Fase 2, dengan peringatan template tidak cocok.
- [ ] Re-finish memakai template preset asal jika parameter kosong.

### Konsistensi umum
- [ ] Tidak ada task yang masih merujuk renderer lama (Sharp/SVG untuk layer data, Remotion sebagai jalur utama) setelah revisi.
- [ ] Code Sebelum/Sesudah tersedia untuk setiap file yang akan diubah di Fase 0, dengan nomor baris yang dicek ulang ke kode saat ini (HEAD `v2.44.3` atau lebih baru).
- [ ] Kriteria verifikasi per fase di tabel akhir plan sudah memuat tambahan dari R1, R2, R6, R7, R8.
- [ ] Aturan dasar tetap: satu fase per rilis, jangan deploy production, campaign lama tidak berubah, teks tidak dikarang.

## Format Laporan

1. Ringkasan perubahan plan (maksimal 10 poin).
2. Checklist di atas, lengkap dengan status dan lokasi di plan (judul bagian atau ID task).
3. Daftar hal yang **tidak bisa** dipenuhi atau butuh keputusan user, beserta alasannya (misalnya data `isHerbalProduct` tidak tersedia di tabel tertentu, atau bundle Nextcloud suatu sumber tidak lengkap).
4. Temuan baru dari audit ulang kode yang belum ada di revisi, jika ada.
5. Konfirmasi bahwa tidak ada file kode yang diubah (`git status`).

Setelah laporan dikirim, **berhenti** dan tunggu persetujuan user.
