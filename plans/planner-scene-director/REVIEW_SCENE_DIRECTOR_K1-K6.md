# Review Reviewer — Scene Director K1–K6 (belum dirilis)

> Tanggal: 2026-11-14 · Basis: `v2.46.4` + perubahan lokal belum di-commit
> Bukti dicek: `prompt-diff.md`, `lib/scene-brief.js`, `lib/angle-visual-formats.js`, preset `*_identity_v3`, tes lokal.

## Verifikasi reviewer
- Tes Scene Director dan tes regresi terkait: **24/24 lulus**. Dijalankan ulang oleh reviewer.
- Kegagalan `tests/organic-pillar-dual-realm.test.js` **sudah terjadi di `v2.46.4`** (dicek pada salinan bersih HEAD), jadi bukan disebabkan pekerjaan ini.
- Flag `planner_scene_director` default `off`, sehingga aman dirilis karena tidak mengubah apa pun sampai dinyalakan.
- Prompt sesudah untuk 2053 (ruang makan, siang, 1 klip 3D) dan 2055 (kamar tidur, malam, 0 klip 3D) sesuai tujuan.

## Wajib diperbaiki sebelum uji staging flag ON
### R1 — Produk bocor lewat "Panduan Aksi" planner
- **Kasus #2055:** baris "Panduan Aksi Awal" berbunyi *"Toples Garlibee … diletakkan di samping bingkai foto keluarga"*. Baris ini ditampilkan untuk seluruh video, padahal aturan lain melarang produk sebelum klip bridge. AI akan bingung dan bisa memunculkan toples terlalu awal, yaitu halusinasi yang sudah kita perangi di F2.1.
- **Perbaikan:** kalimat yang menyebut produk, merek, atau kemasan di `visual_action_hint` diberi label "khusus klip bridge/hero" atau dipindah ke beat bridge. Jangan ditampilkan sebagai panduan umum.

### R2 — Kata "toples" menghasilkan properti wadah kaca sebelum bridge
- Di `PROP_PATTERNS`, kata `toples`, `wadah kaca`, dan sejenisnya menghasilkan properti *"clean transparent glass bowl or clear tumbler"*. Planner hampir selalu menulis "toples" untuk **produk**, sehingga wadah mirip toples muncul di klip awal dan pemeriksa gambar akan menandainya `pre_bridge_product`.
- **Perbaikan:** jangan ambil properti dari kalimat yang menyebut produk/merek, atau hapus `toples` dari pola properti.

### R3 — Malam terlalu gelap untuk DapurBotani
- Lighting malam *"warm dim … calm deep indoor shadows"* bertentangan dengan kartu identitas DapurBotani, yang berbunyi "tidak gelap-suram".
- **Perbaikan:** malam tetap lampu hangat, tetapi **cukup terang** (tangan dan produk jelas, tanpa bayangan pekat). Batas gelap diambil dari kartu identitas brand.

## Perbaikan kecil (boleh sekalian)
- **R4:** laporan agent menyebut lokasi "kafe" dan "mobil", tetapi keduanya **belum ada** di daftar lokasi. Tambahkan minimal: kafe/warung, mobil, musala/sajadah, kamar anak, dan meja belajar. Bila lokasi dari planner tidak dikenali, teks bahasa Indonesia mentah masuk ke prompt bahasa Inggris. Terjemahkan atau beri label.
- **R5:** di pola properti ada salah ketik `bulk|` sebelum "bingkai foto keluarga". Hapus.
- **R6:** blok Scene Director tidak punya baris baru sebelum `=====`. Ini hanya kosmetik, tetapi rapikan.
- **R7:** bila konteks menyebut dua tempat (mis. "dari dapur ke ruang makan"), lokasi dipilih berdasarkan urutan daftar aturan, bukan tempat yang disebut pertama. Catat saja, belum perlu diubah.

## Urutan yang disarankan
1. Kerjakan R1–R3 (R4–R6 boleh sekalian). Tes lokal, lalu perbarui `prompt-diff.md` untuk 2053 dan 2055.
2. Rilis patch/minor dan deploy ke **staging** (flag tetap `off` saat deploy).
3. Di staging, untuk `default_tenant` saja: nyalakan `planner_scene_director = on` dan pasang VI `dapurbotani_identity_v3`. Generate ulang **6 baris yang sama dari `opc_261108_8618kc`**, dengan `start_frame_visual_qc = report_only`.
4. Laporkan dengan contact sheet 6×6, lalu cocokkan dengan kriteria sukses di `RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md`. Minimal yang dicek:
   - lokasi sesuai planner di ≥5/6 video;
   - waktu/cahaya sesuai di ≥5/6;
   - 3D maksimal 1 klip, dan hanya di angle edukasi;
   - tidak ada produk sebelum bridge;
   - warna lengan konsisten per video.
5. Production tetap tidak disentuh.
