# Aturan video Motion Format

Aturan ini lahir dari ratusan putaran revisi konten Motion Format. Tiap butir punya alasan:
penonton Reels memutuskan lanjut atau geser dalam 1–2 detik, dan yang membuat mereka geser
hampir selalu sama: terasa seperti presentasi, teks tak terbaca, atau tak ada yang terjadi.

## 1. Video, bukan slide

Tanda sebuah adegan terasa "slide":
- kamera diam dan latar diam, hanya teks yang muncul;
- adegan berganti dengan fade ke latar yang sama, lalu elemen baru muncul satu-satu;
- semua benda ada di tengah layar, satu lapis, tanpa kedalaman;
- benda melayang di latar polos tanpa dunia di sekitarnya.

Yang dilakukan sebagai gantinya:
- **Kamera selalu bergerak**: dorong masuk, naik (crane), mengitari (orbit), menggeser, atau
  goyang halus `nz(t)`. Gerak boleh pelan, tidak boleh nol.
- **Dunia berlapis**: depan (partikel, daun, debu, bingkai benda) · tengah (subjek) · belakang
  (langit, kota, gradasi). Lapisan bergerak dengan kecepatan berbeda (paralaks).
- **Perpindahan menyambung**: kamera menembus benda, benda menutup lensa lalu terbuka di
  adegan baru, zoom masuk ke detail, match cut bentuk (lingkaran roda → lingkaran jam),
  potong di ketukan suara. Bila harus menggelap, gelapkan ke hitam/warna gelap — **jangan
  kilatan putih/abu-abu**.
- **Konsep diletakkan di dunia nyata**: "listrik mengalir" = kabel di dalam dinding rumah yang
  terbelah, bukan panah di latar kosong.

## 2. Hook 0–2 detik

Frame pertama sudah bergerak dan sudah indah: subjek terlihat, cahaya jadi, kamera melaju.
Jangan mulai dari layar kosong, logo, atau judul diam. Judul boleh masuk di atas gambar yang
sudah bergerak. Pertanyaan/kalimat pengait diucapkan di 0,3–2 detik.

## 3. Ritme

- Momen penting (angka kunci, wujud utama, hasil akhir) bertahan ±2,5 detik.
- Ada rentang tenang ±2 detik di tengah video (kamera melambat, tanpa teks baru) supaya penonton
  bernapas.
- Satu ide per adegan. Adegan Shorts umumnya 3–7 detik.
- Akhiri dengan penutup yang jelas: jawaban/ringkasan + gambar terindah, bukan berhenti mendadak.

## 4. Teks

- **Zona aman** (`AMAN` di mesin). 9:16: jangan ada teks penting di 180 px teratas, 300 px
  terbawah, dan 150 px kanan (tertutup tombol aplikasi). 16:9: margin ±110 px kiri-kanan.
- **Ukuran minimum** di 1080×1920: judul ≥ 96 px, teks utama ≥ 56 px, subtitle ≥ 56 px, label
  ≥ 44 px. Di 16:9: kurangi ±20%.
- **Tanpa kotak/plakat/pil** kecuali gaya memintanya (mis. subtitle pil di Tubuh Anime). Keterbacaan
  dijaga dengan bayangan teks berlapis dan, bila latar terang, gelapkan area di belakang teks
  (gradien lokal), bukan kotak.
- **Label** menunjuk objek: titik bercahaya + garis + teks (`label()` di mesin). Label ikut
  objek yang bergerak.
- Font dari Google Fonts sesuai gaya. Hindari font sistem polos dan font yang sama di setiap video.
- Maksimal 2 keluarga font per video (display + pendamping).

## 5. Subtitle

- Bawaan untuk 9:16: subtitle per kata (`SCENE.sub` + `kata.js`). Frasa 2–5 kata, kata muncul
  saat diucapkan, kata kunci warna aksen (`kunci:[...]`).
- Posisi bawaan ±68% tinggi layar. Boleh dipindah ke ruang kosong dekat objek yang dibahas
  (`y:(t,frasa)=>({x,y})`), selama tetap di zona aman dan tidak menutup subjek.
- Satu sumber kebenaran: subtitle dari `kata.js`, bukan diketik ulang di adegan.
- Tanpa VO → tidak perlu subtitle; teks layar yang membawa cerita.

## 6. Warna & cahaya

- Palet dari gaya atau brand user: 1 warna utama, 1 latar, 1 aksen (+ netral). Tulis hex-nya di
  `gaya.md`.
- Latar tidak harus gelap. Pilih dari suasana topik.
- Cahaya punya arah (matahari, lampu, cahaya dari dalam benda). Bayangan jatuh ke arah yang sama.
- Hindari putih murni luas dan hitam murni luas; beri gradasi/tekstur.

## 7. Berbeda tiap video, konsisten dalam seri

- Dua video berbeda topik: beda minimal 3 dari 4 → palet, font, latar, tanda tangan gerak.
  Resep gaya menyediakan varian untuk ini.
- Seri (Part 1, 2, …): palet, font, posisi subtitle, pembuka, dan penutup sama persis. Simpan di
  `gaya.md` proyek pertama dan salin ke proyek berikutnya.

## 8. Isi & kejujuran

- Fakta di layar hanya dari naskah yang sudah disetujui. Angka tanpa sumber jangan dikarang.
- Tokoh nyata, merek orang lain, karakter berhak cipta: jangan ditiru wajah/logonya.
- Topik kesehatan: tanpa klaim medis dan tanpa gambar yang menjijikkan.
- Sejarah keagamaan: hormati kebiasaan tidak menggambarkan sosok tertentu (pakai siluet/benda).
