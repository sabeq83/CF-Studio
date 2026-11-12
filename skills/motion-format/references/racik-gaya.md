# Racik gaya sendiri

Dipakai saat user meminta gaya yang tidak ada di daftar gaya bawaan, memberi gambar/video contoh,
atau ingin gaya khas brand-nya. Hasil akhirnya selalu satu `gaya.md` yang konkret.

## 1. Tujuh hal yang membentuk gaya

Isi ketujuhnya. Gaya yang terasa "nanggung" hampir selalu karena beberapa hal dibiarkan default.

| # | Hal | Contoh konkret (bukan kata sifat kosong) |
|---|---|---|
| 1 | **Kamera** | ortografik dari pojok 45°/30° · perspektif rendah dari bawah · datar dari depan seperti panggung |
| 2 | **Cahaya** | matahari rendah dari kiri, hangat, bayangan panjang · cahaya dari dalam benda · lampu sorot tunggal |
| 3 | **Palet** | 1 utama + 1 latar + 1 aksen + netral, dalam hex, dengan asal-usulnya (brand / suasana topik) |
| 4 | **Bahan & tekstur** | logam tergores, kertas berserat, cat air meleber, arsir ukiran, plastik mengilap |
| 5 | **Tipografi** | font display + font pendamping dari Google Fonts, ukuran px, perlakuan (bayangan, huruf besar) |
| 6 | **Subtitle & label** | per kata polos dekat objek · pil gelap di bawah · balon kata dari tokoh |
| 7 | **Tanda tangan gerak** | satu gerak khas yang diulang: belah bidang lurus · zoom bertingkat · kertas terlipat · garis menggambar |

Tambahkan: **latar** (dunia apa yang mengelilingi subjek) dan **suara** (nada VO, musik ya/tidak,
jenis efek).

## 2. Dari gambar atau video contoh

- Tiru **rasa gayanya**: sudut kamera, cahaya, bahan, palet umum, ritme potongan, cara teks muncul.
- Topik, komposisi adegan, dan teks tetap milik user.
- Jangan menyalin logo, karakter, wajah tokoh nyata, atau aset berhak cipta dari contoh.
- Tulis 7 hal di atas dari contoh itu, tunjukkan ke user sebagai `gaya.md`, lalu buat gambar uji
  adegan 1. Gambar uji adalah cara paling cepat memastikan "rasa"-nya sudah kena.

## 3. Dari brand user

- Warna utama & aksen dari logo/situs/kemasan (sebut hex dan sumbernya).
- Font: kalau brand punya font, cari padanannya di Google Fonts.
- Kepribadian brand → arah: premium tenang (ruang lega, gerak pelan, serif) · berani anak muda
  (warna jenuh, potongan cepat, huruf raksasa) · hangat lokal (tekstur, foto, warna tanah).
- Lihat juga `references/gaya/promo-produk.md`.

## 4. Pilih dasar mesin

- Dunia dilukis/ilustrasi/teks → `mf.py baru <proyek> --dasar 2d`
- Benda/ruang 3D, bangunan, mesin → `--dasar 3d`
- Mirip salah satu gaya bawaan → mulai dari gaya itu (`--dasar <id>`) lalu ubah 7 hal yang perlu.

## 5. Contoh `gaya.md`

```markdown
# Gaya: Diorama Kaca Pagi (racikan)
- Kamera: perspektif 35°, sedikit dari atas, dorong masuk pelan terus-menerus
- Cahaya: matahari pagi dari kanan belakang, rim light kuning, kabut tipis di lantai
- Palet: hijau daun #3E8E5A (utama, dari logo) · krem kabut #F3EBDD (latar) · jingga #FF8A3D (aksen) · arang #22262B
- Bahan: kaca bening tebal dengan pantulan, kayu berserat, tanaman berdaun lebar
- Tipografi: Fraunces 600 (judul 110 px) + Inter Tight 600 (subtitle 62 px), bayangan lembut
- Subtitle: per kata, polos, ±68% tinggi, kata kunci jingga
- Tanda tangan gerak: kamera menembus dinding kaca ke ruang berikutnya
- Suara: VO hangat perempuan, musik akustik pelan .12, efek: dentingan kaca halus
- Beda dari video sebelumnya: latar terang pagi (sebelumnya malam), font serif
```

## 6. Uji dan simpan

Gaya racikan yang berhasil (user senang) → sarankan user menyimpan `gaya.md` itu. Video berikutnya
cukup bilang "pakai gaya.md dari proyek <nama>".
