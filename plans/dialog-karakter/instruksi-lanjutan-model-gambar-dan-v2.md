# Instruksi Lanjutan — Model Gambar Awal Karakter + Lanjut V-2..V-5

> Tanggal: 2026-11-15 · Penulis: Claude (reviewer) · Eksekutor: Antigravity · **Staging saja**
> Dasar: `laporan-uji-ab-model-gambar-dan-v1-mockup.md` (v2.48.14).
> **Status: DISETUJUI PENGGUNA 2026-11-15** — Opsi B dipilih dan mockup V-1 disetujui (dengan 3 catatan di Bagian V).

## Catatan review
- Temuan bug `fileToBase64` sangat penting. Uji #2183 r1 ternyata dibuat **tanpa gambar acuan sama sekali**. Akibatnya rekomendasi reviewer sebelumnya (Pro) dibuat dari data yang salah.
- Penilaian visual agent sesuai dengan pengecekan reviewer: dengan 4 acuan, `nano_banana_2` lebih patuh (klip 2–4). Pro sering mengecilkan karakter, mengganti bentuk (wajan tembaga di kompor, Sponge hijau), dan di klip 4 **Sapu hilang**.
- Waktu tunggu kedua model setara (±85 detik/gambar). Jadi Pro tidak memberi keuntungan.

## G-1. Kebijakan model (Opsi B)
- `resolveOpcStartFrameModel`: start frame karakter/stylized kembali ke **`nano_banana_2`**.
- Pro tetap untuk pembuatan gambar acuan (`reference-asset-service`) dan bisa dipakai lewat `modelOverride`.
- Fallback dan log per klip yang sudah dibuat tetap dipertahankan.

## G-2. Acuan yang lebih bersih untuk start frame
Dugaan kuat: lembar multi-pose (4 tampak + 3 ekspresi) membuat model meniru wajah ekstra dan pose acak. Contohnya Sapu 3 wajah dan gagang menembus.

1. Buat peran **`identity`** per karakter: **1 gambar tampak depan saja**, satu wajah, badan utuh, latar krem polos.
   - Dibuat dengan Pro, 2 variasi per karakter (total 6).
   - **Pengguna yang menyetujui.**
2. Saat membuat start frame, kirim acuan `identity` per karakter. Pakai `character_sheet` hanya bila `identity` belum ada.
   - Lineup VI hanya dikirim bila semua karakter tampil. Uji juga tanpa lineup (lihat G-4).
3. Prompt start frame wajib menyebut tiap karakter dengan wujud singkat, misalnya "Sapu: upright ijuk broom, sage-green handle on top, bristles at bottom, one face on the bristle bundle".
   - Tambah negatif: `multiple faces on one character, duplicate characters, extra talking objects`.

## G-3. Galat 403 `PUBLIC_ERROR_USER_MINOR`
- Ini salah deteksi filter G-Labs (kemungkinan dipicu kata seperti "cute/small/child-like").
- Ulangi otomatis **1×** dengan prompt yang sudah dibersihkan dari kata pemicu tersebut. Catat di log.
- Bila masih gagal, tandai klip untuk ditinjau. Jangan diulang terus-menerus.

## G-4. Uji ulang singkat (#2183, tanpa render video)
- **r4:** `nano_banana_2` + acuan `identity` + lineup.
- **r5:** `nano_banana_2` + acuan `identity` tanpa lineup.

Buat contact sheet r3 | r4 | r5 dengan kriteria yang sama:
- Sapu tegak, gagang sage di atas, 1 wajah;
- Si Wajan wajan datar bulat;
- Sponge kuning di atas / hijau di bawah;
- tidak ada duplikat;
- semua karakter yang disebut di klip tampil.

Laporkan jumlah gambar (target ≤ 16).

## V. Mockup disetujui — lanjut V-2..V-5
Catatan perbaikan saat membangun React:
1. Daftar suara ElevenLabs harus menampilkan **ke-14 suara Indonesia** (`ELEVENLABS_ID_VOICES`), bukan hanya 6 seperti di mockup.
2. Tampilkan kolom/baris **watak singkat** (`persona`) per karakter, bisa diedit. Kolom ini dipakai untuk prompt suara Cara C nanti.
3. Peringatan "dua karakter memakai suara yang sama" juga berlaku untuk suara narator bawaan bila dialog menyala. Di mockup, narator dan Sapu sama-sama Zan; ini boleh, cukup diberi info.

Lanjutkan V-2..V-5 sesuai `usulan-voice-persona-karakter-preset.md`. Rilis patch, deploy staging, lalu laporkan.
