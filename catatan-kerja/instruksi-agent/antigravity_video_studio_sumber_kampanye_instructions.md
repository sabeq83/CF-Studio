# Instruksi Antigravity: Sumber Video dari Kampanye Aktif di Video Studio

Tanggal: 17 Nov 2026 · Dari: Claude (reviewer/planner) · Untuk: Antigravity (eksekutor)

Latar belakang, angka, dan keputusan pengguna: **[catatan-kerja/usulan/USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md](../usulan/USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md)**. Baca seluruhnya sebelum mulai.

Tujuan: di `/video-studio`, pengguna memilih video langsung dari **kampanye aktif (OPC, tabel `pillar_campaign_items`)**. Satu klik memilih semua klip sebuah video beserta audio VO dan data finishing-nya. Tab RE Campaign, Instant Factory, dan Dari DB dihapus.

Keputusan pengguna yang mengikat (17 Nov 2026):
1. Item lama yang klip mentahnya sudah hilang: **tetap tampil** dengan label "Hanya video final", **tidak bisa dipilih**.
2. Klip mentah **ikut disimpan ke Nextcloud** mulai sekarang, sebagai **pekerjaan terpisah** (Bagian 2 di file ini).
3. Tab "Dari DB" untuk video **dihapus**. Tab sumber video tinggal **Kampanye** (default) dan **Unggah File**.
4. **Staging dulu.** Production tidak disentuh.

---

## ⛔ Aturan utama

1. **Mockup dulu, tanpa pengecualian.** Kerjakan Fase A dan Fase B saja, kirim link mockup, lalu **BERHENTI**.
2. Sebelum mockup disetujui, **dilarang** mengubah `lib/`, `app/`, `tests/`, `scripts/`, database, atau MCP. Yang boleh di-commit hanya `public/mockup_video_studio_finishing.html` dan file ini.
3. Setelah mockup disetujui, tulis `implementation_plan.md` (Execution Task List + kode Sebelum/Sesudah per file) untuk Fase D–E, kirim, lalu **BERHENTI lagi** sampai disetujui.
4. **Bagian 2 (klip ke Nextcloud) punya gerbang sendiri** dan menyentuh alur produksi. Jangan dimulai sebelum Bagian 1 selesai dan rencananya disetujui terpisah.
5. **Commit hanya file yang dimaksud.** Dilarang `git add -A` / `git add .`. Dilarang `git checkout`, `git restore`, `git reset`, atau `git stash` terhadap file yang bukan milik pekerjaan ini. Jika ada perubahan orang lain di working tree, biarkan dan laporkan.
6. **Database: hanya SELECT** di Fase A. Tidak ada migrasi di Bagian 1. Tabel dan data RE/Instant/`video_library` **tidak dihapus**.
7. **Dilarang deploy Production.** Hanya Staging, atomic dengan full SHA. Tanpa polling SSH berulang.
8. Fase A–C tanpa rilis versi (cukup commit `docs:`/`chore:` + deploy Staging). Rilis versi di Fase G.
9. Render produksi dan job Video Studio lama harus berperilaku sama persis seperti sekarang.
10. Tidak ada secret atau API key di kode, test, maupun mockup.
11. Setiap fase selesai, centang di **Execution Task List** di bawah.

---

## Pertanggungjawaban pekerjaan sebelumnya (jawab di laporan Fase A)

1. Perubahan yang belum di-commit di `tests/finishing-natural-chapters.test.mjs` dan `tests/finishing-skin-general.test.mjs` hilang selama pekerjaan v2.50.0 dan tidak ada di commit mana pun, padahal instruksi melarang menyentuhnya. Jelaskan apa yang terjadi dan apakah isinya masih bisa dipulihkan (`git reflog`, `git fsck --lost-found`, riwayat editor). Jangan mengarang isi penggantinya.
2. Menjalankan `node --test tests/video-studio-*.test.mjs tests/render-slot.test.js` sekaligus **tidak selesai dalam 2 menit** (proses menggantung). Cari file mana yang menahan proses (kemungkinan koneksi DB atau timer yang tidak ditutup) dan usulkan perbaikannya di `implementation_plan.md`. Perbaikannya dikerjakan di Fase D.

---

## Peta kode (hasil baca Claude pada commit `550cc67`, verifikasi ulang sebelum mengubah)

| Bagian | File | Catatan |
|---|---|---|
| Tab sumber video | `app/video-studio/page.js` sekitar baris 767–800 (tombol tab), 803–1070 (isi tiap tab) | State `videoSourceType`: `upload` / `database` / `re_campaign` / `instant_factory`. Hitung klip di sekitar baris 289. Validasi di 330–336. Body POST di 364–403 |
| Daftar video kampanye lama | `app/api/video-studio/campaign-videos/route.js` | Hanya `re_campaign_items` dan `instant_campaigns`. Memuat semua baris + `fs.existsSync` per file, tanpa halaman, tanpa filter tenant |
| "Dari DB" | `app/video-studio/page.js` baris 126 → `/api/scraper/library?type=video` → tabel `video_library` | Kosong di Staging dan Production. **Sumber audio "database" memakai rute yang sama (`type=audio`): jangan diubah di pekerjaan ini** |
| API render | `app/api/video-studio/render/route.js` baris 88–135 | Cabang `database`, `re_campaign`, `instant_factory` |
| Sumber finishing | `lib/video-studio-finishing-source.js`, `app/api/video-studio/finishing-source/route.js` | Hanya `re_campaign` dan `instant_factory` |
| Pemicu di UI | `app/components/video-studio/FinishingPanel.jsx` baris 46 | Hanya memanggil `finishing-source` untuk dua sumber lama |
| Resolver produksi | `lib/tiktok-compliance-service.js` baris 518 → `resolvePreRenderFinishingMeta()` | **Pakai ini** untuk kampanye aktif. Lokasi field ada di `scratch/video_studio_finishing/CATATAN.md` bagian 2 |
| Data kampanye aktif | `pillar_campaigns`, `pillar_campaign_items` | Kolom penting item: `visual_clip_paths` (JSON `/temp/opc_glabs_<id>_clip_<n>.mp4`), `ffmpeg_output_path` (`/temp/opc_final_<id>.mp4`), `drive_link` (link Nextcloud), `tts_batch_id`, `result_json`, `row_creative_payload`, `content_kind`, `created_at`. Kampanye: `campaign_name`, `brand_profile_id`, `account_name`, `tenant_id`, `finishing_template`, `caption_mode` |
| Unggah ke Nextcloud | `lib/nextcloud-sync-helper.js` → `syncOpcCampaignAssetsToNextcloud()` (baris 238), cabang "A. Video final" (265) dan "B. Video clips" (274) | Klip hanya diunggah jika video final **belum** ada (`else if`). Ini inti Bagian 2 |
| Dokumentasi | `sot/menus/video-studio.md`, `sot/global/changelog.md` | |

Angka acuan Staging (17 Nov 2026): 1.964 item, 1.498 tercatat punya klip, tetapi file klip di Mac mini hanya ada untuk 121 item terbaru (item 2066 ke atas).

---

# Bagian 1: Tab Kampanye

## Fase A: Bukti awal (tanpa mengubah kode)
Tulis hasilnya di `scratch/video_studio_sumber_kampanye/CATATAN.md` (tidak di-commit):
- **Siapa yang menghapus klip lama** di `public/temp` Mac mini Staging: script, cron, deploy, PM2, atau manual. Sebutkan file/perintahnya dan aturan umurnya. Ini menentukan desain Bagian 2.
- Ambil 3 contoh item nyata (hanya SELECT): (1) kampanye bertemplate dengan plan, (2) kampanye tanpa template, (3) item lama yang klipnya sudah hilang. Catat hasil `resolvePreRenderFinishingMeta()` untuk (1) dan (2).
- Cara halaman kampanye yang ada memfilter **tenant** dan brand. Daftar di Video Studio harus memakai cara yang sama.
- Sumber thumbnail yang sudah ada untuk item kampanye (start frame, `t2i_images_json`, atau lainnya). Jangan membuat generator thumbnail baru di pekerjaan ini.
- Jawaban dua pertanyaan di bagian "Pertanggungjawaban".

## Fase B: Perbarui mockup `public/mockup_video_studio_finishing.html`
Hanya bagian "1. Sumber Video" dan pemilih skenario. Bagian lain tidak diubah.

**Tab:** `Kampanye` (default) dan `Unggah File`. Tab Dari DB, RE Campaign, dan Instant Factory hilang.

**Isi tab Kampanye:**
1. Kotak cari (nama kampanye / judul), filter brand, filter jenis konten (Umum, Editorial brand, Produk, Resep, Storyboard kustom), filter tanggal.
2. Saklar **"Sembunyikan yang tidak bisa dipilih"**.
3. Daftar item, terbaru di atas, 20 per halaman dengan tombol "Muat lagi". Tiap baris: thumbnail, nama kampanye, judul/hook, tanggal, jumlah klip, dan satu label:
   - **Klip lengkap (6)**: bisa dipilih.
   - **Klip sebagian (4 dari 6)**: tidak bisa dipilih, keterangan "Sebagian klip sudah tidak tersedia".
   - **Hanya video final**: baris redup, tombol pilih nonaktif, keterangan "Klip mentah sudah tidak tersedia, video ini tidak bisa diberi finishing ulang", dan link "Buka video final".
4. Memilih satu item langsung menampilkan daftar klipnya berurutan (bisa dibuang atau ditukar urutannya) dan mengisi sumber audio dengan VO kampanye itu. Hanya satu item per render: memilih item lain mengganti pilihan, dengan konfirmasi.
5. Banner finishing dua keadaan:
   - **Kampanye bertemplate:** "Dimuat dari kampanye *X*: template `recipe_pop`, plan ✓, audio ✓" + "Pakai apa adanya" / "Ubah".
   - **Kampanye tanpa template:** "Kampanye ini dirender tanpa template. Pilih template, lalu buat plan dengan AI." Brand, hook, teks VO, dan audio sudah terisi. Galeri template terbuka dan tombol "Buat plan dengan AI" menonjol.
6. Keadaan kosong: "Belum ada video kampanye yang cocok dengan pencarian."

**Pemilih skenario:** ganti skenario "Video dari campaign" dengan tiga skenario: "Kampanye bertemplate", "Kampanye tanpa template", "Item lama hanya video final". Skenario lain tetap.

Syarat teknis sama seperti sebelumnya: standalone, token desain sendiri di `:root`, light/dark, Bahasa Indonesia sederhana, tanpa istilah teknis di layar, tanpa logo atau produk asli.

**Sinkron ke Staging:** commit hanya file mockup, push `main`, `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`, verifikasi HTTP 200 di `http://100.95.245.55:5010/mockup_video_studio_finishing.html`. **Kirim link + hasil Fase A, lalu BERHENTI.**

Tanyakan juga ke pengguna saat mengirim mockup: tab **audio** "Dari DB" membaca pustaka yang sama dan juga kosong. Dihapus juga atau dibiarkan?

## Fase C: `implementation_plan.md` → BERHENTI
Untuk Fase D–E, dengan kode Sebelum/Sesudah. Sertakan perbaikan test yang menggantung.

## Fase D: Backend (setelah rencana disetujui)

**1. Rute baru `GET /api/video-studio/campaign-items`**
- Parameter: `page`, `limit` (default 20, maks 50), `search`, `brand_profile_id`, `content_kind`, `date_from`, `date_to`, `hide_unavailable`.
- Sumber: `pillar_campaign_items` JOIN `pillar_campaigns`, urut `created_at` terbaru, **difilter tenant aktif** dengan cara yang sama seperti halaman kampanye (hasil Fase A).
- Halaman di SQL (`LIMIT/OFFSET`), bukan di memori. Jangan `SELECT *` untuk kolom JSON besar yang tidak dipakai.
- Cek keberadaan file **hanya** untuk item di halaman yang dikembalikan. Tiap item mengembalikan: `item_id`, `campaign_id`, `campaign_name`, `brand_name`, `content_kind`, `title` (hook atau judul), `created_at`, `thumbnail_url`, `clip_total`, `clip_available`, `clips[]` (`index`, `fs_path`, `exists`), `availability` (`full` / `partial` / `final_only` / `none`), `final_url` (`drive_link`), `tts_batch_id`, `tts_clip_count`, `finishing_template`.
- `hide_unavailable=true` tidak bisa difilter murni di SQL karena bergantung pada file. Usulkan cara yang tidak membuat halaman kosong (misalnya ambil lebih banyak lalu saring, dengan batas), dan jelaskan di rencana.
- Jalur file: hanya terima path di dalam `public/temp`. Tolak `..` dan path absolut dari data.

**2. `lib/video-studio-finishing-source.js`: sumber `campaign`**
- Format `video_path`: `opc::<itemId>`.
- Ambil item + kampanye, lalu panggil `resolvePreRenderFinishingMeta()` dengan argumen yang sama seperti pemanggil produksi di `lib/scheduler-processors.js`. **Jangan menyalin logikanya.**
- Kembalikan bentuk yang sama dengan sumber lama (`finishingTemplate`, `finishingPlan`, `skin`, `brand`, `hookTitle`, `recipeData`/`productData`, `captionText`, teks VO per klip, `ttsBatchId`), ditambah `hasPlan` dan `campaignTemplate`.
- Kampanye tanpa template → `finishingTemplate: 'none'`, `hasPlan: false`, tetapi brand, hook, teks VO, dan batch TTS tetap terisi.
- Plan kampanye divalidasi ulang dengan `validateFinishingPlan` (opsi sama dengan produksi). Gagal → error jelas + saran buat ulang dengan AI.

**3. `app/api/video-studio/render/route.js`**
- Tambah `video_source_type: 'campaign'` dengan `video_path` berisi `opc::<itemId>` dan daftar indeks klip terpilih. Path file **diambil dari database**, bukan dari kiriman browser.
- Cek ulang semua klip terpilih masih ada sebelum masuk antrean. Jika ada yang hilang → HTTP 400: "Klip X sudah tidak tersedia. Muat ulang daftar kampanye."
- Job **baru** dengan `re_campaign`, `instant_factory`, atau `database` (video) ditolak dengan HTTP 400 berbahasa Indonesia. Kode pemrosesan untuk job lama yang sudah ada di antrean tidak dihapus.
- `audio_source_type: 'database'` tidak diubah.

**4. Test** `tests/video-studio-campaign-source.test.mjs`:
- halaman dan filter tenant benar,
- `availability` benar untuk `full`, `partial`, `final_only`,
- `finishing-source` kampanye bertemplate dan tanpa template,
- render menolak sumber lama untuk job baru, menolak klip yang hilang, menolak path di luar `public/temp`,
- job lama `re_campaign` di antrean tetap diproses seperti sebelumnya.
- Semua test Video Studio harus **selesai sendiri** saat dijalankan bersama (tidak menggantung).

## Fase E: UI
- Komponen baru `app/components/video-studio/CampaignVideoPicker.jsx` (dan pecahan seperlunya), supaya `page.js` berkurang, bukan bertambah.
- Hapus tab dan state RE Campaign, Instant Factory, dan Dari DB (video) dari `page.js`. Hapus pemanggilan `/api/video-studio/campaign-videos` dan `/api/scraper/library?type=video` dari halaman ini. Rute `campaign-videos` dihapus jika tidak ada pemakai lain (cek dengan grep, laporkan).
- `FinishingPanel.jsx` memanggil `finishing-source` untuk sumber `campaign`. `CampaignSourceBanner` mendukung dua keadaan.
- Riwayat antrean: job lama bersumber RE/Instant tetap tampil normal.
- **100% semantic token dari `app/theme.css`**, adaptif light/dark, tanpa hex.

## Fase F: Uji di Staging
1. Item bertemplate: "Pakai apa adanya" → overlay setara hasil kampanye asli (bandingkan frame dengan video final di Nextcloud).
2. Item tanpa template: pilih `tips_listicle` → "Buat plan dengan AI" → render penuh.
3. Item lama: tampil redup, tidak bisa dipilih, link video final terbuka.
4. Hapus sementara satu klip uji (salinan, bukan klip asli) → render ditolak dengan pesan yang benar.
5. Unggah File tetap berfungsi seperti sebelumnya.
Simpan frame di `scratch/video_studio_sumber_kampanye/after/`.

## Fase G: Dokumentasi dan rilis Staging
- Perbarui `sot/menus/video-studio.md` (sumber video baru, sumber yang dihapus, aturan item lama) dan `sot/global/changelog.md`.
- `npm run release-non-interactive` → deploy Staging atomic dengan full SHA.

---

# Bagian 2: Klip mentah ikut disimpan ke Nextcloud (pekerjaan terpisah)

Dimulai **hanya** setelah Bagian 1 selesai dan pengguna menyetujui rencananya. Ini menyentuh alur produksi, jadi wajib ekstra hati-hati.

## Fase H: Rencana → BERHENTI
Tulis `implementation_plan.md` terpisah berisi:
- Perubahan di `syncOpcCampaignAssetsToNextcloud()`: klip mentah diunggah **selain** video final (sekarang hanya salah satu). Nama file tetap `${filePrefix}_video_clip_<n>.mp4`, memakai `uploadToNextcloudIfMissing` yang sudah ada.
- **Kegagalan unggah klip tidak boleh menggagalkan** unggah video final, `drive_link`, atau status item.
- Pengaruh ke waktu dan antrean produksi (unggah bisa lama). Usulkan agar unggah klip berjalan setelah video final selesai diunggah.
- Perkiraan tambahan ruang Nextcloud per hari, dari jumlah item 30 hari terakhir (447 item) dan ukuran klip nyata.
- Tiga hal yang harus ditanyakan ke pengguna, jangan diputuskan sendiri:
  1. Berlaku untuk semua jenis konten, atau hanya jenis tertentu?
  2. Apakah perlu batas umur klip di Nextcloud (misalnya dihapus setelah 90 hari)?
  3. Untuk item yang klip lokalnya sudah hilang tetapi klipnya ada di Nextcloud: apakah Video Studio perlu tombol "Ambil klip dari Nextcloud"? Jika ya, itu pekerjaan lanjutan dan label "Hanya video final" menjadi "Klip ada di Nextcloud".
- Apakah 121 item yang klipnya masih ada sekarang perlu diunggah susulan (script sekali jalan, Staging saja).

## Fase I: Implementasi + uji (setelah disetujui)
- Test: final + klip terunggah, unggah klip gagal tidak mengubah status item, unggah ulang tidak menduplikasi.
- Uji 1 kampanye nyata di Staging: folder Nextcloud berisi video final, klip, audio, dan naskah. Bandingkan lama proses dengan sebelum perubahan.
- Dokumentasi SOT, rilis, deploy Staging.

---

## Kriteria selesai (cek sebelum lapor)

**Bagian 1**
- [ ] Tab sumber video hanya Kampanye dan Unggah File.
- [ ] Daftar kampanye berhalaman, mengikuti tenant aktif, dan terbuka cepat (catat waktu muat halaman pertama).
- [ ] Satu klik memilih semua klip + audio VO + data finishing.
- [ ] Item lama tampil redup, tidak bisa dipilih, dengan link video final.
- [ ] Kampanye bertemplate: "Pakai apa adanya" setara hasil kampanye. Kampanye tanpa template: alur pilih template → buat plan AI → render berhasil.
- [ ] Job baru dari sumber lama ditolak, job lama tetap tampil dan diproses.
- [ ] Render ditolak dengan pesan jelas jika klip hilang.
- [ ] Semua test Video Studio lulus **dan selesai sendiri** saat dijalankan bersama.
- [ ] UI lolos cek light/dark, tanpa hex.
- [ ] Tidak ada file di luar lingkup yang ter-commit atau ter-reset (cek `git show --stat` tiap commit dan `git status` sebelum/sesudah).

**Bagian 2**
- [ ] Klip mentah ada di Nextcloud untuk kampanye baru, tanpa mengubah hasil dan status produksi.
- [ ] Lama proses produksi sebelum/sesudah dilaporkan.

## Format laporan ke pengguna
Bahasa sederhana: apa yang berubah, link Staging untuk dicoba, apa yang belum, dan apa yang perlu diputuskan pengguna.

---

## Execution Task List
- [ ] Fase A: Bukti awal + pertanggungjawaban (file test yang hilang, test menggantung), tanpa mengubah kode
- [ ] Fase B: Mockup bagian Sumber Video di Staging → **STOP, tunggu persetujuan mockup**
- [ ] Fase C: `implementation_plan.md` Fase D–E → **STOP, tunggu persetujuan**
- [ ] Fase D: Rute `campaign-items` + `finishing-source` kampanye + API render + test
- [ ] Fase E: UI tab Kampanye + hapus tab lama + banner dua keadaan
- [ ] Fase F: Uji di Staging (5 skenario)
- [ ] Fase G: Dokumentasi SOT, rilis & deploy Staging
- [ ] Fase H: Rencana klip ke Nextcloud → **STOP, tunggu persetujuan**
- [ ] Fase I: Implementasi klip ke Nextcloud + uji + rilis Staging
