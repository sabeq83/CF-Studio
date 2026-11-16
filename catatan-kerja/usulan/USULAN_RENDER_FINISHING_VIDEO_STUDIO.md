# Usulan (Revisi 2): Render Penuh dengan Finishing Template di Video Studio

Tanggal: 16 Nov 2026 · Status: usulan final, keputusan pengguna sudah masuk, belum ada kode yang diubah
Sumber: baca kode `sabeq83/cf-studio` (commit terbaru 16 Nov 2026). Tidak dijalankan di Mac mini.
Instruksi eksekusi: `antigravity_video_studio_finishing_render_instructions.md`

## Keputusan pengguna (16 Nov 2026)

| # | Pertanyaan | Keputusan | Dampak ke usulan |
|---|---|---|---|
| 1 | Sumber plan yang paling sering dipakai | **Campaign asal** | Plan dari campaign asal jadi default dan dikerjakan pertama. AI dan manual menyusul sebagai cadangan (U2) |
| 2 | Audio upload didukung di rilis pertama? | **Ya** | Jalur audio upload/DB masuk rilis pertama, dengan 2 mode (U5) |
| 3 | Job Video Studio vs job produksi terjadwal | **Video Studio mengalah** | Perlu "slot render" bersama yang memberi prioritas ke produksi (U7) |

---

## 1. Kondisi saat ini (hasil baca kode)

### 1.1 Engine finishing sudah siap, Video Studio belum menyambungkannya
- Jika audio dari **TTS Studio**, `triggerFfmpegStudioQueue()` sudah memanggil `processTtsStudioMuxing()`, yaitu engine yang sama dengan OPC, RE, dan Multiplier. Engine ini sudah multi-klip dan sudah punya overlay global 30 fps (Playwright), SFX, dan loudnorm −14 LUFS.
- Masalahnya, queue hanya meneruskan 8 parameter. Akibatnya `finishingTemplate` selalu `'none'` dan `finishingPlan` selalu `null`.
- Jika audio dari **upload/DB**, job dikirim ke `processVideoMuxing()` yang hanya menyinkronkan video dan audio, tanpa finishing.
- Audio upload sekarang hanya **satu file**, sedangkan video bisa banyak klip.

### 1.2 Template dan skin
- 8 template di `lib/finishing-template-registry.js`: `none`, `calm_wellness`, `recipe_pop`, `tips_listicle`, `ramuan_ritual`, `problem_solution`, `angka_banding`, `mitos_fakta`.
- Skin di `lib/finishing-skin-registry.js` (default `pop_kuning`). `brand_profiles` sudah punya kolom `finishing_skin` dan `default_finishing_template`.
- Template "kaya" butuh **finishing plan** yang divalidasi `validateFinishingPlan()`.

### 1.3 Word timing untuk audio non-TTS sudah tersedia
`lib/word-alignment-engine.js` → `resolveClipWordTimings()` punya tingkatan:
- **Tier 2:** Whisper CLI (`alignClipWordsTier2`). Bisa mentranskripsi audio tanpa teks.
- **Tier 3:** penyelarasan teks ke jeda bicara lewat silence detect (`alignClipWordsTier3`). Butuh teks VO.

Jadi audio upload bisa mendapat caption yang sinkron tanpa membuat engine baru.

### 1.4 Antrean render dan prioritas
- Antrean Video Studio sekuensial lewat flag di memori (`globalRef.ffmpegStudioQueueActive`).
- Render produksi terjadwal (`scheduler-processors.js` di 4 lokasi, `re-multiplier-worker.js`) memanggil `processTtsStudioMuxing()` **langsung**, tanpa lewat antrean ini, dan **tanpa kunci bersama**.
- Di Mac mini berjalan beberapa proses PM2 (UI dan API, untuk Staging dan Production). Flag di memori tidak terlihat antar-proses, dan schema DB Staging berbeda dari Production. Jadi kunci di memori atau di DB **tidak cukup** untuk membuat Video Studio mengalah ke produksi.

### 1.5 Dugaan bug di antrean (perlu dicek Antigravity di Fase 0)
Di `triggerFfmpegStudioQueue()` (sekitar baris 576), `getPendingFfmpegStudioJob()` dipanggil **tanpa `await`**, padahal fungsinya `async` (Postgres). Jika benar, `job` selalu berupa Promise (selalu "ada") dan `job.id` bernilai `undefined`. Akibatnya antrean bisa gagal terus atau berputar tanpa henti. Ini harus dipastikan dan diperbaiki sebelum fitur baru dibangun di atasnya. `updateFfmpegStudioJob` juga perlu dicek apakah perlu di-`await`.

### 1.6 Koreksi atas usulan versi pertama
Temuan lama K1, K4, K5, K8, dan K9 (timing ditebak, ghosting, 15 fps, encode berulang, tanpa loudnorm) **sudah diperbaiki** di kode. Tidak perlu dikerjakan lagi.

---

## 2. Usulan

### U1. Panel Finishing di halaman render (mode FFmpeg)
- **Galeri 8 template** (kartu dengan nama, deskripsi, dan thumbnail), diambil dari registry. Badge "Disarankan" dari `suggestFinishingTemplate()`.
- **Skin**: dropdown dari `FINISHING_SKIN_REGISTRY`. Otomatis terisi dari `brand_profiles.finishing_skin` jika brand dipilih.
- **Pengaturan**: caption mode (`full` / `hybrid` / `keyword_only`), transisi (cut/xfade + durasi), camera motion, platform, target loudness.
- **Brand**: preset brand + override warna aksen. Template default dari `brand_profiles.default_finishing_template`.
- **Data konten**: hook title, nama brand, CTA, disclaimer (default herbal).

### U2. Sumber finishing plan: **campaign asal lebih dulu**
Urutan otomatis saat user memilih video:

1. **Campaign asal (default).** Jika video dari RE Campaign atau Instant Factory, plan tersimpan langsung dimuat, beserta template, skin, brand, hook, `recipeData`/`productData`, dan teks VO. User cukup klik render.
   - Jika user mengganti template ke template lain yang butuh field berbeda, tampilkan: "Plan campaign dibuat untuk `recipe_pop`. Untuk `tips_listicle`, buat plan baru dengan AI atau isi manual."
   - Jika campaign punya batch TTS terkait, batch itu otomatis terpilih sebagai audio.
2. **Generate AI (cadangan).** Untuk video tanpa campaign atau saat template diganti. Teks VO diambil dari batch TTS, input user, atau hasil transkripsi Whisper (audio upload). Hasilnya divalidasi `validateFinishingPlan()`.
3. **Manual (cadangan).** Form per template + tab JSON, juga untuk mengoreksi plan dari campaign atau AI.

Semua plan divalidasi sebelum render. Error (klaim terlarang, angka tidak ada di VO) memblokir render. Peringatan (teks padat) cukup ditampilkan.

### U3. Preview sebelum render
`FinishingTemplatePreview` dengan template, skin, dan plan terpilih, memakai klip video pertama user sebagai latar, plus scrub timeline. Jalan di browser tanpa ffmpeg.

### U4. Render penuh seluruh klip
- Satu tombol "Mulai Rendering Video". Jika template ≠ `none`, job membawa semua parameter finishing.
- Seluruh klip diproses: sync per klip → concat → overlay global → SFX → loudnorm → MP4 final.
- Progress per tahap tampil di antrean: sync klip N/total, gabung, capture overlay, master pass, termasuk status "Menunggu produksi selesai" (U7).
- Status hasil: "Selesai", "Selesai tanpa finishing" (dengan alasan), "Gagal".

### U5. Audio upload/DB dengan template (masuk rilis pertama)
Dua mode, dipilih otomatis dari jumlah file audio:

| Mode | Kapan | Cara kerja | Catatan |
|---|---|---|---|
| **A. Satu audio untuk semua klip** | 1 file audio, N klip video | Video digabung dulu menjadi satu (cut atau xfade sesuai pilihan), lalu dirender sebagai batch sintetis 1 klip berisi video gabungan + audio upload. Strategi sinkron (shortest/stretch/freeze/loop) berlaku untuk keseluruhan | Layer yang berbasis nomor klip (babak `problem_solution`, tips per klip) diletakkan berdasarkan waktu bicara, bukan batas klip. Tampilkan peringatan ini di UI |
| **B. Satu audio per klip** | Jumlah file audio = jumlah klip video | Batch sintetis N klip (`batchDataOverride`), sama persis dengan batch TTS | Hasilnya setara dengan TTS Studio. UI upload audio perlu mendukung banyak file + urutan |

Word timing untuk audio upload:
1. Jika user mengisi teks VO → `resolveClipWordTimings` (Tier 3, penyelarasan teks ke jeda bicara).
2. Jika tanpa teks dan Whisper CLI tersedia → Tier 2 (transkripsi). Teks hasil transkripsi ditampilkan dan bisa dikoreksi user sebelum render.
3. Jika tanpa teks dan tanpa Whisper → caption dimatikan, hanya layer non-caption yang tampil (hook, chips, CTA, disclaimer).

Template `none` dengan audio upload tetap lewat `processVideoMuxing()` seperti sekarang.

### U6. Perubahan backend
1. **Perbaiki dugaan bug antrean** (1.5) lebih dulu.
2. **Tabel `ffmpeg_studio_jobs`**: kolom baru `finishing_template`, `finishing_config` (JSON), `progress_stage`, `finishing_status` (`applied` / `skipped`), `audio_mode` (`tts_batch` / `single` / `per_clip`), `yield_count` (berapa kali mengalah).
3. **`POST /api/video-studio/render`**: terima dan validasi parameter finishing, cek pasangan klip di depan, simpan config.
4. **`triggerFfmpegStudioQueue()`**: teruskan semua parameter ke `processTtsStudioMuxing()`, bangun `batchDataOverride` untuk audio upload, dan lewat slot render (U7).
5. **`processTtsStudioMuxing()`**: tambahan opsional saja, yaitu callback `onProgress`, `shouldYield`, dan return value `{ finishingApplied, finishingSkippedReason }`. Pemanggil lain tidak terpengaruh.

### U7. Slot render bersama: Video Studio mengalah
Karena Staging, Production, UI, dan API berjalan di proses terpisah di Mac mini yang sama, kuncinya dibuat di **sistem file mesin**, bukan di memori atau DB.

- **Modul baru `lib/render-slot.js`**: file penanda di folder bersama (env `RENDER_SLOT_DIR`, default `~/.cfstudio/render-slots/`), dipakai semua proses dan semua environment.
  - `acquireProductionSlot(jobRef)` / `releaseProductionSlot()`: dipanggil oleh render produksi. **Tidak pernah menunggu**: produksi selalu jalan.
  - `isProductionActive()`: ada penanda produksi dengan heartbeat < 2 menit.
  - Heartbeat setiap 30 detik. Penanda yang basi (proses mati) diabaikan dan dibersihkan otomatis.
- **Sebelum mulai job**, antrean Video Studio memeriksa `isProductionActive()` dan jadwal produksi terdekat (`campaign-scheduler`). Jika produksi aktif atau dijadwalkan mulai dalam perkiraan durasi render job ini, job tetap `pending` dengan status "Menunggu produksi selesai". Pemeriksaan diulang setiap 60 detik.
- **Saat job berjalan**, di setiap batas tahap (antar klip, sebelum capture overlay, sebelum master pass), `shouldYield()` memeriksa produksi. Jika produksi mulai, job Video Studio dihentikan dengan rapi, file sementara dibersihkan, status kembali `pending`, dan `yield_count` bertambah. Job dilanjutkan dari awal setelah produksi selesai.
  - Setelah 3 kali mengalah, tampilkan saran di UI: "Render sering tertunda produksi. Coba jadwalkan di luar jam produksi."
- **Wrapper produksi**: keempat lokasi pemanggilan di `scheduler-processors.js` dan satu di `re-multiplier-worker.js` dibungkus `acquire/release` (dengan `try/finally`). Perilaku produksi tidak berubah, hanya ditandai.

### U8. Penjaga mutu
- Pasangan klip tidak cocok (mode TTS dan mode B) ditolak di UI dan API sebelum masuk antrean.
- Jika overlay gagal, render tetap jalan tanpa teks, tetapi job ditandai `finishing_status = 'skipped'` beserta alasannya.
- Plan dari campaign tetap divalidasi ulang, karena validator bisa lebih ketat daripada saat campaign dibuat.

---

## 3. Rencana bertahap

| Tahap | Isi | Perkiraan |
|---|---|---|
| 0 | Bukti awal + cek dan perbaiki bug `await` antrean | 0,5 hari |
| 1 | Mockup UI di Staging → persetujuan pengguna | 1 hari |
| 2 | Kolom DB + API + queue meneruskan parameter (batch TTS) | 1–2 hari |
| 3 | **Plan dari campaign asal** (auto-muat template, skin, brand, plan, batch TTS) | 1–2 hari |
| 4 | Slot render bersama (U7) + wrapper produksi | 1–2 hari |
| 5 | UI Panel Finishing + preview + progress | 2 hari |
| 6 | Audio upload mode A dan B + word timing (Whisper/Tier 3) | 2–3 hari |
| 7 | Plan cadangan: generate AI + form manual | 2 hari |
| 8 | Test, dokumentasi SOT, rilis Staging | 1 hari |

Slot render (tahap 4) dikerjakan **sebelum** UI dibuka ke pengguna, supaya render dari Video Studio tidak pernah mengganggu produksi sejak hari pertama.

---

## 4. Risiko
- **Waktu render**: capture 30 fps untuk video 72 detik sekitar 2.160 frame, bisa beberapa menit. Jika ditambah mengalah ke produksi, waktunya bisa lebih lama lagi. Tampilkan estimasi dan status tunggu dengan jelas.
- **Render diulang dari awal** setelah mengalah, karena engine belum punya titik lanjut. Ini disengaja demi kesederhanaan. Bisa ditingkatkan nanti (simpan hasil sync per klip).
- **Whisper CLI** belum tentu terpasang di Mac mini. Cek di Fase 0. Jika tidak ada, audio upload tanpa teks berarti tanpa caption.
- **Mode A**: layer berbasis klip tidak serapi mode B. Sarankan mode B untuk template `problem_solution` dan `tips_listicle`.
- **Font** untuk Playwright harus ada di Mac mini.
- **Plan campaign lama** mungkin gagal validator baru. Tampilkan error dengan jelas dan tawarkan generate ulang dengan AI.
