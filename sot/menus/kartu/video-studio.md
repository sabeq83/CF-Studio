# Kartu Menu: Video Studio

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.5 (branch `fitur/hapus-instant-sheets`)
Alamat: `/video-studio` · Kelompok: TOOLS · Kunci izin menu: `ffmpeg_studio`

## Fungsi
Alat rakit video mandiri. Menggabungkan klip video dengan suara (voice-over), menyamakan durasinya, lalu menambahkan template finishing (judul, teks sorot, caption) sampai jadi video siap tayang. Bisa dipakai tanpa campaign.

## Alur pakai
1. Pilih klip video: unggah langsung atau ambil dari pustaka/campaign.
2. Pilih suara: dari TTS Studio, unggah sendiri, atau dari database.
3. Pilih mode audio: **Mode A** (1 audio panjang untuk banyak klip) atau **Mode B** (1 audio per klip).
4. Pilih cara menyamakan durasi: potong ke yang terpendek, ubah kecepatan video, bekukan frame terakhir, atau ulang klip.
5. Pilih template finishing dan isi rencananya (otomatis dari campaign asal, dibuat AI, atau isi manual).
6. Render → masuk antrean → unduh hasil.

## Template finishing (8)
`none`, `recipe_pop`, `problem_solution`, `tips_listicle`, `ramuan_ritual`, `calm_wellness`, `angka_banding`, `mitos_fakta`.

## Terhubung dengan
- Butuh data dari: TTS Studio (suara), RE Campaign (klip + rencana finishing asal), pustaka video.
- Mesin finishing sama dengan yang dipakai RE Campaign dan Multiplier.
- Perintah MCP: tidak ada yang khusus Video Studio.

## Lokasi (untuk agent)
- Halaman: `app/video-studio/page.js`
- Komponen: `app/components/video-studio/` (AudioModePicker, FinishingPanel, FinishingPlanEditor, TemplateGallery, CampaignSourceBanner)
- API: `app/api/video-studio/` — `upload`, `render`, `jobs`, `transcribe`, `campaign-videos`, `finishing-source`, `finishing-plan-generate`, `finishing-plan-validate`
- Logika inti: `lib/video-studio-processor.js`, `lib/video-studio-finishing-source.js`, `lib/render-slot.js`, `lib/finishing-template-registry.js`, `lib/finishing-plan-validator.js`, `lib/clip-pair-guard.js`
- Tabel data: `ffmpeg_studio_jobs`

## Aturan penting & jebakan
1. **Video Studio selalu mengalah ke produksi.** Jika RE Campaign / Multiplier sedang render, pekerjaan Video Studio menunggu atau dihentikan lalu diantre ulang. Render "lama" sering karena ini, bukan karena rusak.
2. **Mode B wajib jumlah audio = jumlah klip.** Jika tidak sama, tombol render terkunci.
3. **Caption butuh teks VO atau Whisper.** Jika dua-duanya tidak ada, caption otomatis dimatikan; elemen template lain tetap muncul.
4. Rencana finishing yang belum lolos validasi mengunci tombol render (kecuali template `none`).
5. Validasi rencana ikut memeriksa klaim berlebihan, terutama untuk produk herbal.
6. Sumber `instant_factory` sudah dihapus dan ditolak dengan HTTP 400 oleh `/api/video-studio/render`.

## Belum ada / batasan
- Tidak bisa dijalankan lewat MCP/skill; hanya lewat halaman web.
- Bukan editor timeline bebas: hanya rakit klip + audio + template.

## Dokumen lengkap
`sot/menus/video-studio.md`
- Bagian 2 — empat cara menyamakan durasi audio-video
- Bagian 7.2 — Mode A / Mode B dan aturan caption
- Bagian 7.3 — aturan mengalah ke produksi
- Bagian 7.4 — tiga sumber rencana finishing
- Awas: bagian 3–5 dokumen itu memuat contoh kode lama; cek ke kode bila perlu detail.
