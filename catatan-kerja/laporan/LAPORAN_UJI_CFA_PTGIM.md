# Laporan Uji CFA — PT GIM Week 2 (Solusi Thermal ID & Ruang Akustik ID)

> Tanggal: 17 November 2026 · Lingkungan: CF Studio **Staging** (5010) + CFA Mac Mini · Versi: v2.50.2
> Tahap 4 `implementation_plan.md`. Video uji **tidak dipublikasikan** (jalur masih `publish.mode = draft`).

## Ringkasan

| Kriteria | Hasil |
|---|---|
| 1. Wajah & pakaian Reno/Maya konsisten di semua klip | ✅ Lolos (Character Lock aktif di 20/20 klip) |
| 2. Latar sesuai kata kunci & berbeda antar-video | ✅ Reno lolos. ⚠️ Maya: latar bergeser **di dalam** satu video (lihat Temuan) |
| 3. Tidak ada orang lain / teks rusak | ✅ Tidak ada orang lain. ⚠️ Angka dB melayang (mis. "45dB") muncul di beberapa klip Maya |
| 4. VO & klaim sesuai katalog | ✅ Fakta dari riset bersumber + katalog; tanpa janji angka pasti |
| 5. CTA benar | ✅ Klip 5 = "Konsultasi gratis, klik WA di bio ya!"; caption menyebut gudang Sidoarjo + kirim seluruh Indonesia |

## Video uji

| # | Kata kunci (latar) | Karakter | Kampanye / item | Video final |
|---|---|---|---|---|
| T4 | ac netes air di indoor (ruang tamu, AC menetes) | Reno | `cst_cbe176164a21` / 2227 | http://100.78.186.123/index.php/s/fyNyFnHacQ5oJ8J |
| T5 | isolasi pipa steam (jalur pipa uap pabrik) | Reno | `cst_c7f9daf7c96b` / 2228 | http://100.78.186.123/index.php/s/YAmtDNHdJMJctcY |
| A1 | suara tetangga terdengar (kamar kos malam) | Maya | `cst_df4507476942` / 2230 | http://100.78.186.123/index.php/s/W22ggyxDcC9rfaF |
| A6 | plafon peredam suara hujan (rumah atap seng saat hujan) | Maya | `cst_d26797eeee78` / 2229 | http://100.78.186.123/index.php/s/S63FX3s8EtC6HXW |

Uji pendahuluan Character Lock: `cst_24aa4768bccb` / 2226 (2 klip Reno), http://100.78.186.123/index.php/s/RC6nPipZdyZs9Q5

Lembar kontak start frame:
- `catatan-kerja/laporan/uji_cfa_ptgim_reno_20261117.jpg` (baris atas T4, baris bawah T5)
- `catatan-kerja/laporan/uji_cfa_ptgim_maya_20261117.jpg` (baris atas A1, baris bawah A6)

## Bukti Character Lock (log `maknaflow-staging-ui`)

Setiap klip dari keempat video:
```
[CharacterLock Async] Clip N: characters=reno_thermal_engineer refs=1   (item 2227, 2228)
[CharacterLock Async] Clip N: characters=maya_acoustic_architect refs=1 (item 2229, 2230)
[StartFrame Model] Clip N (item #22xx): model=nano_banana_pro
```

## Alur yang diuji (end-to-end CFA)

`plan-today` → riset (merge `riset`, `riset_selesai`) → naskah (`cek-naskah` lolos, `naskah_siap`) → `cfa_produksi.py --jalur …` (dry-run lalu kirim) → CF Studio Staging `direct_passthrough` → TTS, start frame, Veo, FFmpeg, upload Nextcloud. Total ±15 menit untuk 4 video (dikirim 10:13, selesai sebelum 10:31 WIB).

## Temuan

1. **Reno sangat baik.** Wajah, helm, kacamata, dan jumpsuit konsisten di 10 klip. Latar tetap di ruang tamu (T4) dan di jalur pipa uap (T5) sepanjang video. Klip cara kerja berupa diagram potongan, sesuai rencana.
2. **Maya: wajah konsisten, latar bergeser di dalam video.**
   - A1: klip 1 kamar kos, lalu klip 2 dinding beton ala loft, klip 3 studio diagram putih, klip 4 ruang kerja, dan klip 5 kamar seperti hotel. Kamar kos "sederhana" berubah menjadi interior lebih mewah.
   - A6: klip 1 ruang tamu tradisional, lalu klip 5 apartemen modern.
   - Dugaan penyebab:
     - deskripsi lokasi per klip terlalu singkat ("in the same boarding room");
     - gaya "elegant" + blazer premium pada Maya mendorong interior mewah;
     - gambar acuan Maya berlatar kantor modern.
3. **Angka dB melayang** ("45dB", "85dB" dsb.) muncul sebagai teks di beberapa klip Maya, padahal blok gaya melarang teks. Asalnya dari permintaan "decibel meter showing the drop".
4. **VO klip 5 hanya 7 kata** untuk klip 8 detik, karena aturan CFA edukasi mewajibkan VO terakhir persis sama dengan outro. Ada jeda tanpa suara di akhir video.

## Rekomendasi sebelum go-live

| # | Perbaikan | Tempat | Dampak |
|---|---|---|---|
| R1 | Penulis wajib menulis ulang deskripsi lokasi lengkap di setiap `scene_t2i` (bukan "the same room"), mis. "a small simple Indonesian boarding room with plain painted walls, single bed, small window" | `sudut_wajib` jalur Ruang Akustik (+ Thermal untuk konsistensi) | Latar Maya stabil |
| R2 | Ganti "digital decibel meter showing the drop" menjadi "handheld decibel meter (screen without readable numbers)"; tambah "no floating numbers" | `blok_gaya_t2i` Ruang Akustik | Hilangkan teks melayang |
| R3 | Tambah "simple everyday Indonesian home interior, not luxurious" untuk latar rumah/kos | `blok_gaya_t2i` Ruang Akustik | Interior relevan dengan penonton |
| R4 | Klip 5 durasi 4 detik, atau outro dibuat lebih panjang di preset CFA, mis. "Mau konsultasi gratis soal peredam? Langsung klik WA di bio ya, kami bantu pilihkan!" (15+ kata) | preset `*_cfa` (`mandatory_outro_line`) | Tidak ada jeda sunyi di akhir |

R1–R3 cukup diubah di konfigurasi jalur CFA, tanpa kode. R4 mengubah preset (outro), sehingga perlu persetujuan pengguna.

## Uji ulang Maya setelah perbaikan R1–R3 (17 Nov, 10:36–10:45 WIB)

Perubahan (konfigurasi CFA saja, tanpa kode; cadangan di Mac Mini `/tmp/cfa_ptgim/*.bak*.json`):
- **R1** — `sudut_wajib` kedua jalur: "LOKASI KONSISTEN" (deskripsi lokasi lengkap + 3 ciri tetap di setiap `scene_t2i`, rumah/kos sederhana khas Indonesia).
- **R2/R3** — `blok_gaya_t2i` Maya: "charming" (bukan "elegant"), interior sederhana sesuai lokasi, meteran dB hanya grafik batang, "no readable numbers, no floating labels". Reno diberi pengaman serupa (tablet termal hanya gradasi warna).
- Batas `cek-naskah`: `scene_t2i` 25–45 kata, sehingga deskripsi lokasi dipadatkan (±17 kata) dan ditulis ulang di setiap klip.

| Video (tanggal tayang 18 Nov) | Kampanye / item | Video final | Hasil |
|---|---|---|---|
| Studio drum rumahan diprotes tetangga (A2) | `cst_b120ef92c4e7` / 2232 | http://100.78.186.123/index.php/s/F4gNkZxgxojHdBR | ✅ 5 klip di ruang drum yang sama (dinding abu muda, pintu kayu, set drum) |
| Busa telur bukan bikin kedap suara (A3) | `cst_966af92a2610` / 2231 | http://100.78.186.123/index.php/s/mEgxdNFHg4QZ2eD | ✅ 5 klip di pojok podcast yang sama (dinding putih, gorden, meja kayu) |

Lembar kontak: `catatan-kerja/laporan/uji_cfa_ptgim_maya_revisi_20261117.jpg`. Kesimpulan: **latar stabil, interior sederhana, angka dB melayang hilang, wajah Maya konsisten** (`nano_banana_pro` di 10/10 klip). R4 (outro lebih panjang) belum diterapkan dan menunggu keputusan pengguna.

Rekomendasi untuk 2 video Maya uji pertama (2229 atap seng, 2230 suara tetangga): **jangan ditayangkan** (latar bergeser). 2 video Reno (2227, 2228) layak tayang.

## Status jalur

- `solusithermal-edukasi` dan `ruangakustik-edukasi`: aktif, `video_per_hari = 2` (uji), `publish.mode = draft`.
- `maks_video_per_hari` CFA = 30 (keputusan K1).
- Go-live (K4) menunggu penilaian pengguna atas 4 video ini: `video_per_hari = 3`, `publish.mode = live`, `riset = mingguan`.
