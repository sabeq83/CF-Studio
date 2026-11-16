# Usulan: Sumber Video di Video Studio Disambungkan ke Kampanye Aktif

Tanggal: 17 Nov 2026 · Dari: Claude (reviewer/planner) · Untuk: pengguna, lalu Antigravity (eksekutor)
Status: usulan, belum ada kode yang diubah. Sesuai SOP: **mockup dulu**, kode setelah mockup disetujui.
Terkait: `USULAN_RENDER_FINISHING_VIDEO_STUDIO.md`, `antigravity_video_studio_finishing_render_instructions.md`

Sumber data: baca kode (commit `550cc67`, v2.50.0), baca database (hanya SELECT) di schema `staging` dan `public`, dan hitung file di Mac mini Staging pada 17 Nov 2026.

---

## 1. Temuan

### 1.1 Kampanye yang aktif tidak ada di daftar sumber video
Empat tab sumber video sekarang: Unggah File, Dari DB, RE Campaign, Instant Factory. Kampanye yang benar-benar dipakai (OPC: tabel `pillar_campaigns` / `pillar_campaign_items`) **tidak dibaca sama sekali** oleh Video Studio.

| Sumber | Tabel | Data di Staging | Aktivitas terakhir |
|---|---|---|---|
| **Kampanye aktif (OPC)** | `pillar_campaign_items` | 1.964 item, 1.498 punya klip, 447 item dalam 30 hari terakhir | 16 Nov 2026 |
| RE Campaign | `re_campaign_items` | 664 item | Kampanye terakhir dibuat 30 Sep 2026 |
| Instant Factory | `instant_campaigns` | 0 | Tidak pernah dipakai |
| "Dari DB" | `video_library` | 0 | Kosong |

Jenis konten di kampanye aktif: `generic` (1.690), `brand_editorial` (125), `product_campaign` (103), `recipe_campaign` (25), `custom_storyboard` (21).

Di schema `public` (Production) hanya ada 74 item kampanye, 3 di antaranya punya klip. Hampir semua produksi berjalan di Staging.

### 1.2 "Dari DB" kosong karena membaca tabel yang salah untuk kebutuhan ini
Tab "Dari DB" membaca `video_library`, yaitu pustaka video hasil unduhan scraper (video referensi dari luar). Tabel ini kosong di Staging maupun Production. Jadi tab itu memang benar kosong, tetapi namanya menyesatkan: orang mengira isinya video hasil kampanye.

### 1.3 Di mana video kampanye sebenarnya disimpan
Ingatan pengguna benar: video final ada di Nextcloud. Rinciannya:

- **Database** tidak menyimpan video, hanya alamat file.
- **Klip mentah per adegan** disimpan di Mac mini: `public/temp/opc_glabs_<item>_clip_<n>.mp4` (kolom `visual_clip_paths`).
- **Video final** disimpan di Mac mini (`public/temp/opc_final_<item>.mp4`, kolom `ffmpeg_output_path`) **dan** diunggah ke Nextcloud bersama audio VO dan naskah (kolom `drive_link` berisi link berbagi Nextcloud).
- **Klip mentah tidak diunggah ke Nextcloud** jika video final sudah ada (`lib/nextcloud-sync-helper.js`, fungsi `syncOpcCampaignAssetsToNextcloud`: klip hanya diunggah bila final belum ada).

### 1.4 Klip mentah lama sudah tidak ada di Mac mini
Di Mac mini Staging saat ini hanya tersisa klip untuk **121 item terbaru** (640 klip, 111 video final, total folder 3,9 GB), yaitu item nomor 2066 ke atas. Database masih mencatat 1.498 item punya klip. Artinya untuk sekitar 1.370 item lama, klip mentahnya sudah terhapus dan yang tersisa hanya video final di Nextcloud.

Belum diketahui proses mana yang menghapusnya (tidak ditemukan di kode `lib/`). Antigravity perlu memastikan: script pembersih, deploy, atau manual.

Akibatnya untuk render ulang dengan finishing template:
- Item baru (klip masih ada): bisa dirender ulang penuh.
- Item lama: hanya ada video final yang **sudah berisi caption dan overlay**. Menambah finishing di atasnya akan menumpuk teks, jadi tidak layak.

### 1.5 Fitur "plan dari campaign asal" saat ini hanya jalan untuk sumber yang akan dihapus
`lib/video-studio-finishing-source.js` hanya mengenali `re_campaign` dan `instant_factory`. Padahal "plan dari campaign asal" adalah keputusan pengguna nomor 1. Jika kedua tab itu dihapus tanpa menambah sumber kampanye aktif, fitur ini tidak bisa dipakai sama sekali.

Catatan: dari 1.964 item kampanye aktif, hanya 16 yang kampanyenya memakai finishing template (`calm_wellness` 11, `recipe_pop` 4, `angka_banding` 1). Sisanya `none`. Jadi untuk sebagian besar video, plan harus dibuat lewat AI atau manual, dan itu perlu terlihat jelas di UI.

---

## 2. Usulan

### U1. Susunan tab sumber video yang baru
| Sekarang | Usulan |
|---|---|
| Unggah File | **Kampanye** (baru, jadi tab default) |
| Dari DB | **Unggah File** |
| RE Campaign | **Pustaka** (nama baru untuk "Dari DB", lihat keputusan 3) |
| Instant Factory | dihapus |

RE Campaign dan Instant Factory dihapus dari UI sesuai permintaan pengguna. Job lama yang dulu dibuat dari kedua sumber itu tetap tampil di riwayat antrean.

### U2. Tab "Kampanye": pilih per video, bukan per klip
- Daftar item kampanye aktif, terbaru di atas, dimuat bertahap (20 per halaman). Jangan memuat semuanya sekaligus seperti `campaign-videos` sekarang, karena ada ribuan item dan setiap file dicek satu per satu.
- Pencarian nama kampanye, filter brand, filter jenis konten, filter tanggal.
- Setiap baris menampilkan: thumbnail, nama kampanye, judul/hook, tanggal, jumlah klip, dan satu label status:
  - **Klip lengkap (6)**: bisa dirender ulang penuh.
  - **Klip sebagian (4 dari 6)**: tidak bisa dipilih, dengan penjelasan.
  - **Hanya video final**: tampil redup dan tidak bisa dipilih, dengan link ke video final di Nextcloud (keputusan 1). Sediakan saklar "Sembunyikan yang tidak bisa dipilih" supaya daftar tidak penuh item lama.
- Satu klik pada item memilih **semua klipnya sesuai urutan**, sekaligus batch audio VO-nya. Pengguna tetap bisa membuang atau menukar urutan klip.
- Hanya boleh memilih satu item kampanye per render, supaya plan, brand, dan audio tidak tercampur.

### U3. Data finishing ikut termuat dari kampanye aktif
`finishing-source` ditambah sumber `campaign` (tabel `pillar_campaign_items`), memakai `resolvePreRenderFinishingMeta()` yang sama dengan render produksi, sehingga template, skin, brand, hook, data produk/resep, teks VO, dan plan terisi otomatis.

Banner di UI menyesuaikan:
- Kampanye punya template dan plan: "Dimuat dari kampanye X: template `recipe_pop`, plan ✓, audio ✓" + tombol "Pakai apa adanya".
- Kampanye tanpa template (kebanyakan): "Kampanye ini dirender tanpa template. Pilih template, lalu buat plan dengan AI." Brand, hook, teks VO, dan audio tetap terisi otomatis, sehingga pengguna hanya memilih template dan menekan "Buat plan".

### U4. Sumber lama dibersihkan
- Tab RE Campaign dan Instant Factory dihapus dari halaman.
- API render menolak job **baru** dengan sumber `re_campaign` / `instant_factory`. Job lama tidak disentuh.
- Rute `campaign-videos` diganti rute baru berhalaman untuk kampanye aktif.
- Tabel dan data RE/Instant di database tidak dihapus.

### U5. Mockup lebih dulu
Perbarui bagian "1. Sumber Video" di `public/mockup_video_studio_finishing.html`:
- tab baru sesuai U1, daftar kampanye sesuai U2 dengan contoh ketiga label status,
- skenario tambahan di pemilih skenario: "Kampanye dengan template", "Kampanye tanpa template", "Item lama hanya video final",
- deploy ke Staging, kirim link, **berhenti** sampai pengguna menyetujui.

---

## 3. Yang perlu diputuskan pengguna

1. **Item lama yang klip mentahnya sudah hilang (sekitar 1.370 item).** ✅ **Diputuskan pengguna, 17 Nov 2026: tampil dengan label "Hanya video final", tidak bisa dipilih.** Baris tampil redup, tombol pilih nonaktif, dengan keterangan "Klip mentah sudah tidak tersedia, video ini tidak bisa diberi finishing ulang" dan link "Buka video final" ke Nextcloud (`drive_link`).
> **Keputusan pengguna 17 Nov 2026 untuk nomor 2–4:** (2) **Ya**, klip mentah ikut disimpan ke Nextcloud, sebagai pekerjaan terpisah. (3) Tab "Dari DB" **dihapus**, jadi tab sumber video tinggal **Kampanye** dan **Unggah File**. (4) **Staging dulu.**
> Instruksi eksekusi: `catatan-kerja/instruksi-agent/antigravity_video_studio_sumber_kampanye_instructions.md`.

2. **Apakah klip mentah mulai sekarang ikut disimpan ke Nextcloud?** Tanpa ini, setiap video hanya bisa dirender ulang selama klipnya belum terhapus dari Mac mini. Perkiraan kasar ukuran: sekitar 5 MB per klip, 30 MB per video. Jika ya, ini pekerjaan terpisah di alur produksi.
3. **Tab "Pustaka" (dulu "Dari DB").** Isinya kosong. Pilihan: dipertahankan dengan nama baru dan keterangan "video referensi hasil unduhan", atau dihapus juga.
4. **Production.** Hampir semua data kampanye ada di Staging. Fitur ini cukup di Staging dulu, atau perlu disiapkan juga untuk Production?

---

## 4. Rencana bertahap

| Tahap | Isi | Perkiraan |
|---|---|---|
| A | Antigravity memastikan apa yang menghapus klip lama + contoh 1 item berplan dan 1 item tanpa plan (tanpa mengubah kode) | 0,5 hari |
| B | Perbarui mockup bagian Sumber Video → **berhenti, tunggu persetujuan** | 0,5 hari |
| C | `implementation_plan.md` (kode sebelum/sesudah) → **berhenti, tunggu persetujuan** | 0,5 hari |
| D | API daftar kampanye berhalaman + `finishing-source` untuk kampanye aktif + test | 1–2 hari |
| E | UI tab Kampanye, hapus tab RE/Instant, banner dua keadaan | 1–2 hari |
| F | Uji: 1 item berplan ("Pakai apa adanya" setara hasil kampanye), 1 item tanpa plan (buat plan AI), 1 item lama | 0,5 hari |
| G | Dokumentasi SOT, rilis, deploy Staging | 0,5 hari |

## 5. Risiko
- **Daftar lambat** jika setiap file dicek saat memuat. Cek keberadaan file hanya untuk 20 item yang sedang tampil.
- **Klip terhapus di tengah proses**: API render wajib mengecek ulang file sebelum masuk antrean dan menolak dengan pesan yang jelas.
- **Plan kampanye lama** bisa gagal validator sekarang. Tampilkan error dan tawarkan "Buat ulang dengan AI".
- **Brand dan tenant**: daftar kampanye harus mengikuti tenant yang sedang aktif, sama seperti halaman kampanye.
