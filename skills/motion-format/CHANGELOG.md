# Riwayat perubahan — skill Motion Format

## 2.0.0 · November 2026

Ditulis ulang dari nol dengan alur kerja dan gaya Motion Format.

**Baru**
- Alur 8 langkah: brief → gaya → gambar uji adegan 1 → naskah → suara → semua adegan → revisi → render.
- Gaya yang disebut user langsung dipakai; bila belum disebut, 3 pilihan gaya + rekomendasi.
- 7 resep gaya (`references/gaya/`) + contoh adegan yang langsung jalan (`assets/gaya/`):
  Isometrik Dibongkar, Sejarah 3D Sinematik, Tubuh Manusia Anime, Dunia 2D Bertekstur, Kartun Cel
  Cerah, Peta Relief Sinematik, Promo Produk & Iklan.
- `references/racik-gaya.md`: meracik gaya sendiri dari contoh gambar/video atau dari brand.
- Mesin adegan baru (`assets/mesin/core.html`): subtitle per kata, label penunjuk, zona aman,
  rasio 9:16 / 16:9 / 1:1 / 4:5 dari satu baris.
- `scripts/mf.py`: `baru`, `rakit`, `potret` (+ lembar cek & error JS), `kata` (waktu subtitle dari
  suara), `cadangan` / `riwayat` / `pulihkan`, `render` (MP4 bersuara, loudness ±-15 LUFS).
- Bawaan 9:16 + subtitle.

**Diubah**
- Suara dibuat setelah gambar uji & naskah disetujui (sebelumnya sebelum animasi).
- Panduan suara ElevenLabs diperbarui (model v4, efek suara di jeda VO, `teks` per klip).

**Dihapus**
- Seluruh isi lama yang bukan buatan Motion Format: starter explainer lama, katalog konsep opener,
  bridge After Effects, skrip `snap.mjs` / `export-frames.mjs` (butuh Node).
- Sebutan paket lama (Paket Gaya / paket Kreator).

## 1.0.0 · 28 September 2026

Rilis pertama.
