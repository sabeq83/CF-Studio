# Skill Motion Format v2.0.0

Skill Claude untuk membuat video motion graphic lewat chat dengan alur kerja Motion Format:
brief → gaya → gambar uji adegan 1 → naskah → suara ElevenLabs → semua adegan → revisi → MP4.

## Yang baru di v2

- **Ditulis ulang dari nol** dengan alur kerja tim Motion Format.
- **7 resep gaya dari seri konten kami**: Isometrik Dibongkar, Sejarah 3D Sinematik, Tubuh Manusia
  Anime, Dunia 2D Bertekstur, Kartun Cel Cerah, Peta Relief Sinematik, Promo Produk & Iklan —
  masing-masing dengan contoh adegan yang langsung jalan.
- **Gaya yang kamu sebut langsung dipakai.** Claude tidak lagi menawarkan gaya lain kalau kamu
  sudah menentukan gayanya. Belum menentukan? Claude memberi 3 pilihan.
- **Gambar uji adegan 1 dulu**, baru suara. Kredit ElevenLabs tidak terbuang kalau gayanya
  masih direvisi.
- **9:16 + subtitle per kata** jadi bawaan (Reels/TikTok/Shorts).
- **Setiap revisi dicadangkan otomatis.** Bilang "balikin yang tadi" kapan saja.
- Satu alat kerja `scripts/mf.py` (buat proyek, potret cek, waktu subtitle, cadangan, render MP4).

## Pasang

1. Unduh `motion-format-v2.0.0.zip` dari halaman Download kelas.
2. Di Claude Code, kirim zip-nya dengan pesan: *"pasang skill motion-format dari zip ini ke folder
   skill-ku. Kalau sudah ada versi lama, ganti dengan yang ini."*
   Manual: ekstrak, lalu salin folder `motion-format` ke `~/.claude/skills/` (timpa yang lama).
3. Mulai chat baru, lalu tanya: *"skill motion-format versi berapa yang aktif?"* → harus **2.0.0**.

Butuh: Google Chrome, Python 3, dan ffmpeg (Mac: `brew install ffmpeg`, Windows:
`winget install Gyan.FFmpeg`). Untuk suara: plugin ElevenLabs di Kustomisasi → Konektor.

> Punya skill lain untuk motion graphic yang terpasang bersamaan? Sebaiknya pakai salah satu saja,
> supaya Claude tidak bingung memilih.

## Cara pakai

Cukup ngobrol:
- *"bikin video 9:16 gaya isometrik dibongkar: gimana kulkas bikin dingin, 40 detik, pakai suara"*
- *"bikin promo 15 detik untuk kopi susu Kopi Teras, warna brand hijau tua, ini logonya"*
- *"bikin video sejarah 3D tentang Mercusuar Alexandria"*
- *"pakai gaya ini"* + kirim gambar contoh

Revisi cukup satu kalimat: *"adegan 2 kelamaan"*, *"kurang detail"*, *"ganti suaranya lebih
semangat"*, *"balikin yang tadi"*.

## Isi

```
motion-format/
  SKILL.md                 alur kerja (dibaca Claude)
  references/              aturan video, mesin, suara, revisi, racik gaya, resep tiap gaya
  assets/mesin/            mesin adegan + contoh dasar 2D & 3D
  assets/gaya/<gaya>/      contoh adegan tiap gaya
  scripts/mf.py            alat kerja proyek
```

## Lisensi

Lisensi Pembeli Motion Format — lihat `LICENSE`. Video yang kamu buat sepenuhnya milikmu.
