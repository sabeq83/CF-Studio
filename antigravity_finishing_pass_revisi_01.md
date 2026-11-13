# Revisi 01: Finishing Pass (berlaku sebelum Fase 0 dikerjakan)

Dokumen ini mengoreksi `finishing_pass_implementation_plan.md`. Jika bertentangan dengan `antigravity_finishing_pass_instructions.md` atau usulan, **revisi ini yang berlaku**.

Rencana Anda sudah bagus dan audit awalnya akurat (sumber data pra-FFmpeg, penyebab bug `<#1.0#>` sebelum v2.44.3, kondisi font dan whisper di staging). Pertahankan semua itu. Yang diubah hanya poin di bawah.

## Langkah wajib sebelum coding

1. Baca revisi ini, lalu **update `finishing_pass_implementation_plan.md`** sesuai R1–R8 (tracker + Code Sebelum/Sesudah). Tandai bagian yang direvisi dengan `(Revisi 01)`.
2. Baca acuan implementasi di `plans/finishing-pass-reference/` (lihat R3).
3. Setelah plan diupdate, baru mulai Fase 0.

---

## R1. Hook card Fase 0: compliance + auto-fit (wajib)

**Masalah:** di Fase 0, hook diambil mentah dari `custom_hook` / `yt_title`. Audit Anda sendiri menunjukkan isi opc_2117: *"Hasil lab kolesterol naik lagi padahal sudah jaga makan?"*. Akibatnya:
- Kata klaim kesehatan ("kolesterol") tampil besar di video produk herbal, padahal pemblokir kata klaim baru dijadwalkan di Fase 1.
- Kalimat sepanjang ini tidak muat di Anton 13–15cqw.

**Perubahan:**
1. Pindahkan `isHerbalMedicalClaimPhrase()` (F1-T3) ke **Fase 0**. Fungsi ini dipakai untuk hook card sejak Fase 0, dan untuk punch mulai Fase 1.
2. Buat `fitHookCard(text, { isHerbalProduct })` yang mengembalikan `{ line1, line2, fs1, fs2 }` atau `null`:
   - Bersihkan teks: `sanitizeOverlayTextStrict`, buang `#Shorts`/hashtag, buang emoji.
   - Pecah jadi maksimal 2 baris di batas alami (tanda tanya, koma, atau titik tengah kata). Baris 2 sebaiknya bagian yang paling "menjual" (pertanyaan atau angka).
   - Ukuran font menyesuaikan panjang baris: baris 1 antara 8–13cqw, baris 2 antara 10–15cqw, lebar teks maksimal 88cqw. Ukur lebar teks dengan font sebenarnya, jangan menebak dari jumlah huruf.
   - Kembalikan `null` (hook card dilewati) jika: setelah dipecah masih lebih dari 2 baris pada ukuran minimum, total lebih dari ~34 karakter, atau mengandung kata klaim kesehatan pada produk herbal.
3. Prioritas sumber hook: `finishing_plan.hook` (Fase 1+) → `custom_hook` / `yt_title` yang lolos `fitHookCard`. Jika `null`, jangan tampilkan hook card. Subtitle tetap jalan.
4. Penentuan `isHerbalProduct` memakai data produk yang sudah ada (kategori/flag di `product_extractions` atau brand profile). Jika tidak bisa ditentukan, anggap `true` (lebih aman).

**Verifikasi tambahan Fase 0:**
- Unit test `fitHookCard` dengan dua hook nyata: opc_2117 (harus `null` karena "kolesterol" pada produk herbal) dan mul_261113_qt67yl *"Bikin Brownies Tanpa Gula Cuma 3 Bahan Lembut Banget"* (harus dipecah 2 baris atau `null`, tidak boleh meluber).
- Contact sheet frame 0 untuk kedua video.

## R2. Timing subtitle Fase 0 memakai cadangan jeda audio

**Masalah:** plan Fase 0 memindahkan subtitle ke timeline global tetapi tidak menyebut cara menghitung waktu kata. Kalau masih memakai estimasi lama (75% durasi klip dibagi rata), subtitle tetap meleset.

**Perubahan:**
1. Bawa **tier 3** dari `lib/word-alignment-engine.js` ke Fase 0: `silencedetect=noise=-35dB:d=0.08` pada audio VO tiap klip → rentang bicara → kata dibagi berdasarkan bobot `norm(w).length + 1.6`. Rentang dipecah di jeda internal yang cocok dengan tanda baca (koma, titik) bila ada. Lihat `derive()` di `plans/finishing-pass-reference/overlay.html` dan cara memecah segmen di `segs`.
2. Di Fase 0 hasilnya dihitung saat render saja (tanpa kolom DB). Kolom `word_timings_json`, tier 1 (ElevenLabs) dan tier 2 (whisper) tetap di Fase 1.
3. Offset global kata = awal klip di base video + waktu kata relatif terhadap audio klip. Pastikan audio VO tidak di-tempo-ulang oleh smart sync (`stretch` hanya mengubah video). Jika ada jalur yang mengubah tempo audio, sesuaikan timings dengan faktor yang sama.

**Verifikasi tambahan Fase 0:** cek manual minimal 5 potongan subtitle per video acuan, awal potongan ±0,2 dtk dari kata yang diucapkan.

## R3. Renderer layer animasi: template HTML + Playwright (ganti Sharp/SVG Fase 2 dan Remotion Fase 3)

**Masalah:** plan membangun semua layer dua kali, yaitu Sharp/SVG di Fase 2 lalu Remotion/React di Fase 3. Sharp/SVG juga punya keterbatasan nyata untuk layer ini:
- Tidak bisa mengukur lebar teks, jadi pill dan chip akan menumpuk lagi.
- librsvg umumnya tidak menggambar emoji berwarna (📌 di ajakan simpan).
- Font harus diakali lewat fontconfig.

**Sudah dibuktikan:** video brownies `mul_261113_qt67yl` sudah dirender penuh dengan cara ini. Template HTML dirender lewat Playwright (sudah ada di `package.json`, `playwright ^1.60.0`) sebagai PNG transparan per frame, lalu digabung ffmpeg. Untuk video 21 dtk 720×1280 30fps: capture 631 frame sekitar 30 dtk, komposit sekitar 12 dtk. Output -14,1 LUFS, hasil identik dengan mockup. Script lengkapnya ada di `plans/finishing-pass-reference/`:
- `overlay.html`: template overlay transparan dengan `window.renderAt(t)` deterministik (tanpa CSS animation/timer). Semua layer `recipe_pop`.
- `capture.cjs`: Playwright, viewport 720×1280, `omitBackground: true`, screenshot per frame.
- `compose.py` + `filter.txt`: zoompan dengan upscale 3× (anti getar), overlay, SFX `adelay` + `amix` + `sidechaincompress` (SFX diredam di bawah VO), `loudnorm`.
- `meta.json`: contoh timeline (offset klip, waktu punch, daftar SFX).

Ini **acuan, bukan kode produksi**. Path di dalamnya mengarah ke folder sementara, dan data timeline masih ditulis manual.

**Perubahan arsitektur:**
1. **Fase 0** tetap ringan: Sharp/SVG hanya untuk subtitle per potongan + hook card, di timeline global setelah concat. Hasil Fase 0 ini menjadi **fallback permanen**.
2. **Mulai Fase 1**, semua layer animasi (punch, progress bar, lalu di Fase 2: daftar bahan, langkah, ajakan simpan, kartu produk, CTA, flash) dirender oleh modul baru `lib/finishing-overlay-renderer.js`:
   - Template per niche di `templates/finishing/` (`calm_wellness.html`, `recipe_pop.html`), diturunkan dari `mockup_finishing_preview.html` dan `overlay.html`. Satu file template = satu sumber kebenaran visual.
   - Kontrak template: `window.loadTimeline(json)` lalu `window.renderAt(t)`. Fungsi murni terhadap `t`, tidak boleh memakai `requestAnimationFrame`, CSS transition, atau `Date.now()`.
   - Font sebagai file lokal lewat `@font-face` (bukan Google Fonts). Gambar produk lewat `file://` atau data URI.
   - Chromium diluncurkan sekali per job, ditutup di `finally`. Frame di-pipe ke ffmpeg (`image2pipe`) atau ditulis ke folder temp yang dihapus setelah selesai.
   - Gagal di titik mana pun → fallback ke hasil Fase 0 + warning. Upload tidak boleh terhenti.
3. **Gerak kamera** (F2-T2) dikerjakan di ffmpeg pada timeline global setelah concat, seperti `compose.py`: `scale` 3× → `zoompan` dengan ekspresi `it` → 720×1280. Jangan zoompan tanpa upscale.
4. **Fase 2** tidak lagi membangun layer di Sharp/SVG. F2-T3 diganti: implementasi layer di template HTML.
5. **Fase 3** diganti menjadi: template per niche final, UI pilihan template/caption mode/loudness, **preview di UI memakai template HTML yang sama** (iframe + `renderAt` di atas `<video>`), dan pengukuran performa. Remotion **tidak** dikerjakan kecuali waktu render rata-rata lebih dari 3× durasi video. Jika itu terjadi, laporkan dulu sebelum mulai.

## R4. Operasional

1. Pastikan Chromium Playwright ada di host render staging (`npx playwright install chromium` jika belum). `lib/remotion-engine.js` sudah memakai `chromium.executablePath()`, jadi cek di sana dulu.
2. Emoji di template mengandalkan font emoji sistem (Apple Color Emoji di macOS). Jika suatu saat render di Linux, perlu Noto Color Emoji. Catat di plan.
3. Antrean ffmpeg tetap serial. Catat waktu capture dan komposit per video di log dan di laporan rilis.
4. SFX: boleh memakai file pendek berlisensi bebas di `public/sfx/`. Versi sintetis di `compose.py` boleh dipakai sebagai default awal.

## R5. Ringkasan perubahan tracker

| Task lama | Perubahan |
|---|---|
| F0-T3 / F0-T4 | + `fitHookCard` dan pemblokir klaim (R1), + timing jeda audio (R2) |
| F1-T3 | Pemblokir klaim sudah ada sejak Fase 0, di sini diperluas untuk punch |
| F1-T5 | Punch + progress bar dirender oleh `finishing-overlay-renderer.js` (template HTML), bukan Sharp/SVG |
| F2-T2 | Kamera di ffmpeg setelah concat, dengan upscale 3× |
| F2-T3 | Layer data di template HTML, bukan Sharp/SVG |
| F3-T1 s/d F3-T3 | Diganti: template final + preview UI + performa. Remotion hanya jika di atas ambang (R3.5) |
| Verifikasi Fase 0 | + unit test `fitHookCard` (2 hook nyata), + cek timing subtitle ±0,2 dtk |
| Verifikasi Fase 1+ | + bandingkan frame hasil renderer dengan screenshot mockup pada detik yang sama (≥5 titik per video) |
| Semua fase dengan template | + aturan parametrisasi R6, + uji dengan video ketiga di luar dua video acuan |
| Baru: Fase 2b (setelah Fase 2 rilis) | Re-finish backlog ContentFlow (R7) |
| F1-T1 / F1-T4 | Setting finishing di preset + salinan ke semua jalur, termasuk Multiplier dan custom storyboard (R8) |
| F3-T4 | Field pilihan template di halaman Presets dimajukan ke Fase 2 (R8.5) |

## R6. Template harus umum, bukan salinan dua video acuan

**Masalah:** `mockup_finishing_preview.html` dan `plans/finishing-pass-reference/overlay.html` dibuat untuk dua video saja. Data dan beberapa angka ditulis manual. Jika disalin mentah, video lain akan tampil salah.

### R6.1 Pemisahan tiga lapisan

| Lapisan | Isi | Sumber |
|---|---|---|
| Template (tetap) | Posisi default, font, ukuran, animasi, aturan potongan subtitle, warna per jenis punch, jenis layer yang dimiliki template | File `templates/finishing/<template>.html` |
| Brand (per akun/brand profile) | Warna aksen, label kartu produk, flag herbal, CTA default per platform | Brand profile / Visual Identity / data produk |
| Video (per item) | Hook, punch, bahan, langkah, kartu produk, CTA, offset klip, waktu kata | `finishing_plan` + data resep/produk + audio VO |

Template **tidak boleh** berisi teks, angka detik, atau nama produk dari video tertentu. Semua masuk lewat `loadTimeline(json)`.

### R6.2 Nilai yang hardcoded di kode acuan dan wajib jadi parameter

| Di kode acuan | Ganti dengan |
|---|---|
| Warna aksen per proyek (`#f2b632`, `#ffcc3d`) | Warna aksen dari brand profile / Visual Identity. Fallback ke default template. Cek kontras teks gelap di atas aksen; jika kurang, pakai teks putih |
| Ajakan simpan di detik 8,45–10,6 | Klip langkah ke-`ceil(N_langkah × 0,7)`, mulai 0,2 dtk setelah awal klip, selama maksimal 2,2 dtk atau sampai akhir klip |
| Daftar bahan hilang di detik 10,65 | Akhir klip langkah terakhir dikurangi 0,1 dtk, atau sebelum kartu produk muncul (mana yang lebih dulu) |
| Kartu produk sampai detik 16,95 / 12,39 | Akhir klip tempat produk pertama kali disebut. Jika klip berikutnya juga menampilkan produk, boleh diperpanjang sampai akhir klip itu |
| `total: 5` langkah | Jumlah langkah yang benar-benar ada (klip yang punya label langkah) |
| Ukuran font hook 8,6 / 11 | Hasil `fitHookCard` (R1) |
| Label "BAHAN KUNCI" / "YANG AKU PAKAI" | Default per template, bisa di-override per brand |
| "Pangan olahan, bukan obat" | Hanya jika `isHerbalProduct === true`. Untuk produk lain baris ini kosong atau diisi deskripsi faktual produk |
| Deskripsi produk "Tanpa gula · 100 gram" | Dari data produk (netto, USP pendek), maksimal ~28 karakter. Kosongkan jika tidak ada data, jangan dikarang |
| Posisi kartu produk (13 vs 28cqh) dan CTA (20 vs 47cqh) | Default per template. Jika layer lain aktif di area yang sama, pakai slot alternatif yang sudah ditentukan template (lihat R6.4) |
| Emoji di teks ajakan simpan | Boleh, tetapi teks berasal dari default template/brand, bukan ditulis per video |

### R6.3 Batas isi (supaya tidak meluber)

| Kondisi | Perilaku |
|---|---|
| Bahan lebih dari 4 | Tampilkan 4 chip terakhir yang muncul + chip ringkas "+n bahan lain". Header tetap "BAHAN n/N" |
| Label bahan lebih dari ~22 karakter | Ringkas dari data (jumlah + nama inti, contoh "2 sdm madu"). Jika masih panjang, kecilkan font sampai batas minimum, lalu potong dengan "…" |
| Nama langkah lebih dari ~16 karakter | Kecilkan font sampai minimum, lalu potong. Badge "LANGKAH n/N" tetap utuh |
| Teks punch tidak muat 2 baris pada 16cqw | Kecilkan sampai 11cqw. Jika masih tidak muat, punch dilewati |
| Klip lebih dari 8 atau kurang dari 3 | Template tetap jalan: langkah mengikuti klip yang punya label, layer tanpa data dilewati |
| Tidak ada data resep di video `recipe_pop` | Daftar bahan dan langkah dilewati, layer lain tetap jalan |

Semua ukuran diukur dengan font sebenarnya di browser (Playwright), bukan ditebak dari jumlah huruf.

### R6.4 Tabrakan antar layer

Template mendefinisikan zona per layer dan urutan prioritas. Contoh `recipe_pop`: hook > punch > kartu produk > CTA > ajakan simpan > daftar bahan/langkah > subtitle. Jika dua layer jatuh di zona yang sama pada detik yang sama:
1. Layer berprioritas lebih rendah pindah ke slot alternatif yang sudah ditentukan template.
2. Jika slot alternatif juga terpakai, layer itu disembunyikan sementara.
Aturan zona aman TikTok di usulan bagian 4b tetap berlaku.

### R6.5 Pemilihan template

1. `finishing_template` di campaign/preset menang jika diisi.
2. Jika kosong (`none` atau NULL), finishing nonaktif (perilaku lama). **Jangan** memilih otomatis di fase ini.
3. Siapkan fungsi `suggestFinishingTemplate(item)` untuk UI saja: `content_kind = 'recipe'` → `recipe_pop`, produk herbal/wellness → `calm_wellness`, selain itu → tidak ada saran. Template lain (misalnya `product_hard_sell`) **di luar scope**. Catat sebagai pekerjaan berikutnya, jangan dibuat.

### R6.6 Verifikasi tambahan

- Unit test perhitungan waktu otomatis (ajakan simpan, batas daftar bahan, kartu produk) untuk jumlah klip 4, 6, dan 8.
- Unit test batas isi: resep 8 bahan, label panjang, punch panjang.
- Smoke test di staging dengan **video ketiga** di luar dua video acuan: satu resep nutribake atau sasyahouse dengan jumlah bahan ≥5 dan akun/brand berbeda. Lampirkan contact sheet-nya di laporan.
- Grep template: tidak ada string "brownies", "GarliBee", "cocoa", atau angka detik tetap di `templates/finishing/`.

## R7. Re-finish backlog ContentFlow (Fase 2b)

**Tujuan:** video lama di ContentFlow Hub yang belum dipublish (saat ini ~1.089 item total, sebagian besar Not Published) bisa diberi finishing **tanpa generate ulang AI**, sebelum dijadwalkan ke Repliz.

**Dasar:** bundle Nextcloud tiap item sudah menyimpan bahan mentah. Ini sudah dibuktikan: video brownies `mul_261113_qt67yl` dirender ulang dari bundle-nya. Struktur bundle berbeda per sumber:

| Sumber | Klip video | Audio VO per klip | Naskah | Link yang memuat bundle |
|---|---|---|---|---|
| OPC (contoh `opc_2117`) | `*_video_clip_N.mp4` | `*_audio_clip_NN.mp3` | `naskah.md` | `nextcloud_url` |
| Multiplier (contoh `mul_261113_qt67yl`) | `*_scene_cNN.mp4` | `*_vo_cNN.mp3` | `*_naskah.md` | `drive_link` (sedangkan `nextcloud_url` hanya berisi MP4 final) |

Jangan mengandalkan link publik. Akses lewat helper Nextcloud yang sudah ada di repo (`lib/nextcloud-helper.js`) memakai folder campaign/batch yang tercatat. Audit dulu pemetaan item → folder untuk OPC, RE, Multiplier, dan Recipe Labs, lalu catat di plan.

**Jadwal:** dikerjakan **setelah Fase 2 dirilis dan terverifikasi**, sebagai rilis tersendiri. Jangan mulai sebelum itu.

### R7.1 Kriteria item yang boleh di-re-finish

Semua syarat wajib terpenuhi:
- `pipeline_status = 'Completed'`.
- Semua status platform (`tiktok_status`, `facebook_status`, `instagram_status`, `youtube_status`, `threads_status`, `linkedin_status`) = `Not Published`.
- **Tidak ada** publishing job untuk item itu dalam status apa pun (pending, scheduled, processing, failed). Item yang sudah masuk antrean Repliz dilewati, karena `media_url` di job lama bisa menunjuk ke file lama.
- Bundle lengkap: jumlah klip = jumlah audio VO, dan semua file bisa diunduh.
- Belum pernah di-re-finish dengan versi template yang sama (lihat R7.3).
- Tenant sesuai.

### R7.2 Alur per item

1. Unduh bundle (klip + audio + naskah) ke folder temp per item.
2. Teks VO per klip: ambil dari `tts_studio_clips.source_text` jika batch-nya masih ada, jika tidak dari naskah di bundle. Bersihkan dengan `stripTtsMarkupTags`.
3. Durasi klip: ikuti aturan base video di usulan 4b (dipotong mengikuti VO + 0,25 dtk, digabung dengan cut).
4. Waktu kata: tier 3 (jeda audio), atau tier 1/2 jika sudah tersimpan.
5. Data finishing:
   - Hook: `fitHookCard` dari `hook` / judul item (R1).
   - Bahan dan langkah: dari `recipe_text_markdown` di `content_flow_items` (untuk item lama data ini sudah ada).
   - Kartu produk: dari `product_id` / `brand_product_id` → foto bersih dan data produk.
   - Punch: **default tidak ada** untuk backlog. Opsional: flag `generate_punches=true` memakai LLM untuk membuat `finishing_plan.punches` dari teks VO, dan tetap wajib lolos `validateFinishingPlan`.
   - Template: dari parameter job, atau dari preset asal item jika parameter kosong (R8.6). Tidak dipilih otomatis berdasarkan isi.
6. Render dengan renderer yang sama dengan pipeline utama (satu kode, bukan salinan).
7. Simpan versi lama sebagai cadangan: unggah file final lama ke bundle dengan nama `*_final_v0.mp4` sebelum menimpa.
8. Unggah file final baru dengan nama dan path yang sama seperti sebelumnya, lalu update `url_asset` / file lokal jika dipakai.
9. Catat di item: kolom baru `finishing_version` (contoh `recipe_pop@1`), `finishing_applied_at`, dan `finishing_source = 'refinish'`.
10. Jika langkah mana pun gagal: item dibiarkan seperti semula (file lama tetap dipakai), catat error, lanjut ke item berikutnya.

### R7.3 Cara menjalankan

- Fungsi `refinishContentFlowItems({ tenantId, itemIds?, filter?, template, limit, dryRun, generatePunches })`.
- `dryRun = true` (default): hanya mengembalikan daftar item yang lolos kriteria R7.1 beserta alasan item yang dilewati. Tidak mengunduh dan tidak menimpa apa pun.
- Pemicu: endpoint API internal dan tool MCP `cf_refinish_content_flow` (ikuti pola tool yang ada). Tombol di UI ContentFlow **di luar scope** fase ini.
- Antrean tetap serial lewat antrean ffmpeg yang sama, maksimal `limit` item per job (default 10).
- Idempoten: item dengan `finishing_version` sama dengan versi template saat ini dilewati, kecuali `force = true`.
- Job berhenti otomatis jika 3 item berturut-turut gagal, lalu melaporkan penyebabnya.

### R7.4 Hubungan dengan Repliz

- Scheduler Repliz (`lib/auto-pipeline-scheduler-runner.js`) tidak boleh mengambil item yang **sedang** di-re-finish. Tandai item selama proses (misalnya `finishing_status = 'processing'`) dan buat scheduler melewatinya.
- Setelah selesai, item kembali normal dan dijadwalkan Repliz seperti biasa dengan file baru.

### R7.5 Verifikasi

- `dryRun` di staging: laporkan jumlah item yang lolos dan alasan item yang dilewati (per alasan).
- Re-finish 3 item nyata di staging: satu OPC, satu Multiplier resep, satu dari akun lain. Lampirkan contact sheet sebelum/sesudah dan hasil LUFS.
- Pastikan `*_final_v0.mp4` ada di bundle dan bisa diputar.
- Pastikan item yang sudah punya publishing job **tidak** tersentuh (unit test + cek staging).
- Simulasikan kegagalan unduh di tengah: item tetap memakai file lama, job lanjut ke item berikutnya.
- Pastikan scheduler Repliz melewati item berstatus `finishing_status = 'processing'`.

## R8. Pilihan template disimpan di preset

**Prinsip:** ikuti pola setting motion text yang sudah ada. `enable_motion_text`, `motion_text_style`, `motion_text_position`, `video_transition` sudah disimpan di `preset.workflow` (`lib/operator-presets.js`), diatur di `app/settings/presets/page.js`, di-resolve di `lib/autonomous-engine.js` dengan urutan *override → preset.workflow → default*, lalu disalin ke baris campaign. Setting finishing memakai jalur yang sama.

### R8.1 Field di preset

Tambahkan ke `preset.workflow` (dan ke default preset bawaan di `lib/operator-presets.js`):

| Field | Nilai | Default preset bawaan |
|---|---|---|
| `finishing_template` | `none` \| `calm_wellness` \| `recipe_pop` | `none` (preset resep boleh `recipe_pop` hanya setelah Fase 2 rilis) |
| `caption_mode` | `full` \| `hybrid` \| `keyword_only` | `hybrid` untuk preset baru, kosong untuk preset lama (dibaca sebagai `full`) |
| `loudness_target` | angka LUFS | `-14` |

Preset yang tersimpan di DB tanpa field ini harus tetap jalan dengan perilaku lama (finishing nonaktif, caption `full`).

### R8.2 Urutan prioritas dan salinan

1. Override per job/campaign (form campaign, jadwal auto pipeline, parameter MCP) → `preset.workflow` → default (`none` / `full` / `-14`).
2. Nilai hasil resolve **disalin** ke campaign/task saat dibuat. Perubahan preset sesudahnya tidak mengubah campaign/task yang sudah ada.
3. Render membaca nilai dari salinan di campaign/task, bukan dari preset langsung.

### R8.3 Semua jalur wajib membawa nilai ini

Audit dan centang setiap jalur di plan:

| Jalur | Tempat salinan | Pembaca saat render |
|---|---|---|
| OPC / Pillar | kolom `pillar_campaigns` | `scheduler-processors.js` (~7441) |
| RE | kolom `re_campaigns` | `scheduler-processors.js` (~3088, ~4164) |
| Multiplier | config task (`audio_config_json` / `aesthetics`), **bukan** hanya kolom campaign | `re-multiplier-worker.js` (~1310), yang membaca `audioConfig.* \|\| aesthetics.*` |
| Custom storyboard | `rawDna` / `pWorkflow` | `custom-storyboard-pipeline.js` (~257, ~449) |
| Recipe Labs / ingest resep | `globalSettings` yang dipakai saat ingest (bukan preset), disalin ke campaign resep | `recipe-campaign-ingest.js` (~118) |
| Auto pipeline | `auto-pipeline-scheduler-runner.js` (~153) meneruskan dari config jadwal | jalur di atas sesuai jenis |
| MCP | `cf_create_preset`, `cf_update_preset`, `cf_get_preset_detail` menerima dan menampilkan field baru. Tool pembuat campaign menerima override opsional | — |

Tambahkan test: preset dengan `finishing_template = recipe_pop` menghasilkan nilai yang sama di baris/config untuk setiap jalur di atas.

### R8.4 Yang tidak boleh disimpan di preset

Warna aksen, label kartu produk, CTA default per platform, dan status herbal **bukan** setting preset. Satu preset bisa dipakai beberapa akun/brand (contoh: preset resep untuk nutribake dan sasyahouse). Data itu diambil dari brand profile / Visual Identity / data produk (R6.1). Preset hanya menentukan *template mana*, brand menentukan *tampilannya*.

### R8.5 UI

1. Field `finishing_template`, `caption_mode`, `loudness_target` di halaman Presets, di bagian yang sama dengan setting motion text. **Dimajukan ke Fase 2** (bersamaan dengan template pertama yang siap), bukan Fase 3.
2. Sebelum Fase 2, pilihan `calm_wellness` / `recipe_pop` belum ditampilkan di UI (template belum ada). `caption_mode` boleh muncul sejak Fase 1.
3. Tampilkan peringatan (bukan blokir) jika template tidak cocok dengan jenis konten preset, memakai `suggestFinishingTemplate` (R6.5). Contoh: `recipe_pop` dipilih pada preset `product_campaign`.
4. Override per campaign di form/detail campaign boleh menyusul di Fase 3.
5. Ikuti token `app/theme.css` dan buat mockup HTML staging dulu sebelum menambah kontrol baru, sesuai aturan UI repo.

### R8.6 Re-finish backlog

Di R7, parameter `template` menjadi opsional. Jika kosong, pakai `finishing_template` dari preset yang dipakai item itu (lewat campaign/task asalnya). Jika preset-nya `none` atau tidak bisa ditelusuri, item dilewati dengan alasan "template tidak ditentukan".

Aturan lain di instruksi tetap berlaku: satu fase per rilis, jangan deploy production, campaign lama tidak berubah, dan teks tidak boleh dikarang.
