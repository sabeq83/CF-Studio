# Usulan: Link Affiliate Shopee di Komentar Pertama YouTube

Tanggal: 16 November 2026
Status: usulan (belum dikerjakan, belum ada perubahan kode)
Sumber: referensi API Repliz `https://api.repliz.com/public-json` (versi 1.0.0)

## 1. Jawaban singkat

Bisa. Repliz sudah menyediakan fitur "komentar pertama" bawaan untuk YouTube, jadi tidak perlu membuat jadwal kedua di jam 15.02.

## 2. Temuan dari API Repliz

| Temuan | Arti untuk kita |
|---|---|
| Saat membuat jadwal (`POST /public/schedule`) ada isian `additionalInfo.firstComment` | Akun otomatis berkomentar di postingannya sendiri tepat setelah tayang |
| `firstComment` berlaku untuk Facebook, Instagram, LinkedIn, YouTube, TikTok | Bisa dipakai juga di platform lain nanti |
| Tidak jalan pada video YouTube "made for kids" | Video kita bukan untuk anak, aman |
| Video `private` tidak terbaca oleh Repliz | Video harus `public` |
| Ada juga `POST /public/content/{contentId}/comment` (komentar manual ke video yang sudah tayang) | Jadi cadangan bila komentar pertama gagal |
| Tidak ada fitur "pin/sematkan komentar" di API | Menyematkan komentar hanya bisa manual di YouTube Studio |
| Batas panjang untuk YouTube tidak disebut | Kalimat pendek + 1 link aman |

## 3. Kondisi CF Studio sekarang

- Caption Facebook berisi link Shopee (`caption_facebook`).
- Caption platform lain, termasuk YouTube, hanya menulis "cek Link di Bio" (`caption_bio`), tanpa link.
- Pengirim jadwal ke Repliz (`lib/publishing-worker.js`, bagian `additionalInfo`) belum mengisi `firstComment`.
- Fungsi komentar manual sudah ada di `lib/repliz-client.js` (`createReplizComment`), sejauh ini dipakai untuk Threads.

## 4. Alur yang diusulkan

Alur utama (1 langkah, tanpa jadwal tambahan):

1. 15.01 — Repliz menayangkan video ke YouTube.
2. Langsung setelah tayang — Repliz memposting komentar pertama:
   `Produknya bisa order di sini ya 👉 <link Shopee>`

Alur cadangan (hanya bila komentar pertama tidak muncul):

1. Sistem mengecek status jadwal dan mengambil ID video yang sudah tayang.
2. Sistem mengirim komentar lewat `POST /public/content/{contentId}/comment`.
3. Maksimal 1 kali coba ulang, supaya tidak ada komentar dobel.

## 5. Hal yang perlu diketahui sebelum memutuskan

1. **Link di komentar YouTube Shorts tidak bisa diklik.** Sejak 2023 YouTube mematikan klik pada link di komentar dan deskripsi Shorts. Link tetap terlihat, tetapi penonton harus menyalin sendiri. Di video biasa (format panjang/horizontal) link bisa diklik. Karena video kita pendek dan vertikal, kemungkinan besar masuk Shorts. Ini perlu dibuktikan dengan uji 1 video.
2. **Komentar tidak otomatis tersemat.** Komentar pemilik channel biasanya muncul di atas, tetapi tidak dijamin.
3. **Risiko dianggap spam.** Komentar berisi link dengan kalimat yang sama persis di setiap video bisa ditahan YouTube. Perlu beberapa variasi kalimat.
4. **Link pendek lebih baik.** Karena kemungkinan harus disalin, pakai link pendek Shopee (`s.shopee.co.id/...`).
5. **Jalur edukasi tanpa produk** tidak perlu komentar ini.

## 6. Rekomendasi

Jalankan sebagai uji kecil dulu, bukan langsung untuk semua jalur:

- Tahap 1 — uji manual 1 video YouTube: jadwalkan lewat Repliz dengan komentar pertama berisi link. Cek: komentar muncul atau tidak, bisa diklik atau tidak, ditahan atau tidak.
- Tahap 2 — bila hasilnya layak, Antigravity memasang isian komentar pertama di CF Studio (rincian di bagian 7).
- Tahap 3 — pantau 2 minggu: jumlah klik link Shopee dari YouTube dibanding sebelum ada komentar.

Pelengkap yang disarankan, karena link Shorts tidak bisa diklik:

- Pasang link toko di profil channel YouTube (link profil bisa diklik).
- Ubah kalimat penutup caption YouTube dari "cek Link di Bio" menjadi "link ada di komentar pertama dan profil channel".

## 7. Catatan teknis untuk Antigravity (bila disetujui)

Perubahan kecil, 3 titik:

1. `lib/publishing-contract.js` — terima isian baru opsional `first_comment` (atau `platform_first_comments.youtube`), simpan sebagai snapshot di job.
2. `lib/auto-pipeline-scheduler-runner.js` (sekitar baris 458–546, tempat `caption_facebook` diperkaya link affiliate) — bentuk teks komentar YouTube dari link affiliate yang sama, hanya bila jalur punya produk dan link aktif. Pilih 1 dari beberapa variasi kalimat.
3. `lib/publishing-worker.js` (payload `additionalInfo`, sekitar baris 818) — kirim ke Repliz.

Code Sebelum (Current/Before):

```js
additionalInfo: {
  isAiGenerated: isAiGeneratedContent,
  isDraft: job.publish_mode === 'draft',
  isAutoAddMusic: false,
  // ...
```

Code Sesudah (Proposed/After):

```js
additionalInfo: {
  isAiGenerated: isAiGeneratedContent,
  isDraft: job.publish_mode === 'draft',
  isAutoAddMusic: false,
  ...(job.platform === 'youtube' && job.first_comment_snapshot
    ? { firstComment: job.first_comment_snapshot }
    : {}),
  // ...
```

Syarat aman:

- Bila link affiliate kosong, `firstComment` tidak dikirim sama sekali (jangan kirim kalimat tanpa link).
- Tidak mengubah perilaku Facebook, TikTok, Instagram, Threads.
- Perlu kolom baru di tabel job publishing (`first_comment_snapshot`), lewat migrasi yang aman untuk schema `dev`, `staging`, `public`.
- Alur cadangan (komentar manual) dikerjakan terpisah setelah hasil uji Tahap 1 diketahui.

## Execution Task List

- [ ] Uji manual 1 video YouTube dengan komentar pertama berisi link
- [ ] Catat hasil: muncul, bisa diklik, ditahan atau tidak
- [ ] Keputusan pengguna: lanjut atau tidak
- [ ] Tambah isian `first_comment` di kontrak publishing + migrasi kolom
- [ ] Bentuk teks komentar YouTube di runner auto-pipeline (dengan variasi kalimat)
- [ ] Kirim `firstComment` di payload Repliz untuk YouTube
- [ ] Uji di Dev lalu Staging dengan 1 video
- [ ] Pantau klik 2 minggu
