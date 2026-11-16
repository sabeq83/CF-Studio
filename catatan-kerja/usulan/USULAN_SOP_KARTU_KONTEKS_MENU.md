# USULAN — SOP Kartu Konteks Menu CF Studio (Hemat Token)

Status: **usulan, belum dikerjakan**. Tidak ada kode aplikasi yang diubah oleh usulan ini.
Tanggal: 17 November 2026

---

## 1. Masalahnya sekarang

Setiap kali kita mulai percakapan baru tentang satu menu, Claude harus "belajar ulang" menu itu dari nol. Yang terjadi di balik layar:

| Temuan | Angka nyata di proyek |
|---|---|
| Dokumen menu di `sot/menus/` | 38 file, total ± 670 ribu karakter (kira-kira 170–190 ribu token kalau dibaca semua) |
| Rata-rata satu dokumen menu | ± 17 ribu karakter. Contoh: Video Studio 27 ribu, RE Campaign 32 ribu |
| Isi folder tercampur | 16 dari 38 file adalah rencana pengerjaan YouTube Studio, bukan penjelasan menu |
| Menu tanpa dokumen khusus di `sot/menus/` | Auto Pipeline, Threads Labs, Recipe Library, Recipe Exporter, Preset Manager (perlu dicek ulang saat pengerjaan) |
| Catatan rilis (`changelog.md`) | ± 475 ribu karakter — terlalu besar untuk dibaca utuh |
| Folder utama proyek | ± 90 file `.md` lepas (usulan, instruksi, laporan) tanpa daftar isi |

Akibatnya Claude sering membaca dokumen panjang atau menelusuri kode hanya untuk menjawab pertanyaan sederhana seperti "menu ini fungsinya apa dan terhubung ke mana".

---

## 2. Solusinya: baca bertingkat, dari yang paling pendek

Tiga lapis. Claude selalu mulai dari lapis 1 dan baru turun kalau memang perlu.

| Lapis | Isi | Ukuran | Kapan dibaca |
|---|---|---|---|
| **1. Peta Menu** | Satu file berisi daftar 22 menu: nama, fungsi satu kalimat, tautan ke kartunya | ± 1 halaman | Setiap percakapan yang menyebut menu |
| **2. Kartu Menu** | Satu file pendek per menu, format seragam | maks. 60 baris | Hanya kartu menu yang sedang dibahas |
| **3. Dokumen lengkap** | Dokumen panjang yang sudah ada sekarang + kode | apa adanya | Hanya jika kartu tidak cukup, dan hanya bagian yang relevan |

Perkiraan penghematan untuk satu pertanyaan tentang satu menu: dari ± 7–9 ribu token (baca dokumen panjang) menjadi ± 1 ribu token (peta + satu kartu). Ini perkiraan, belum diukur.

### Lokasi file yang diusulkan

```
sot/menus/_PETA_MENU.md          ← lapis 1
sot/menus/kartu/<nama-menu>.md   ← lapis 2 (22 file)
sot/menus/*.md                   ← lapis 3 (tetap, tidak dihapus)
sot/menus/rencana/               ← 16 rencana YouTube Studio dipindah ke sini (opsional)
```

---

## 3. Daftar 22 menu yang perlu kartu

Diambil dari sidebar aplikasi (`lib/sidebar-nav.js`).

| Kelompok | Menu |
|---|---|
| — | Dashboard |
| PLANNING | Content Planner · Product Database · Recipe Library · Deconstruct Lab · Preset Manager · Visual Identity · Universe Manager · Brand Profile Manager |
| WORKFLOW | Auto Pipeline · Threads Labs · RE Campaign · Pillar Campaign · Recipe Labs · Multiplier Labs · Product Bridging |
| PUBLISHING | ContentFlow Hub · Recipe Exporter |
| TOOLS | Video Studio · TTS Studio |
| SYSTEM | Settings · User Management · Tenant Management |

---

## 4. Format Kartu Menu (seragam, maks. 60 baris)

```markdown
# Kartu Menu: <Nama Menu>
Terakhir dicek: <tanggal> · Versi aplikasi: <vX.Y.Z>

## Fungsi (bahasa pemasar)
1–3 kalimat: menu ini dipakai untuk apa, hasil akhirnya apa.

## Alur pakai
3–6 langkah singkat dari sudut pandang pengguna.

## Terhubung dengan
- Butuh data dari: <menu lain>
- Hasilnya dipakai oleh: <menu lain>
- Perintah MCP terkait: <nama tool cf_... jika ada>

## Lokasi (untuk agent)
- Halaman: app/<folder>/
- API: app/api/<folder>/
- Logika inti: lib/<file>
- Tabel data utama: <nama tabel>

## Aturan penting & jebakan
Maks. 5 butir. Hal yang sering salah atau tidak boleh dilanggar.

## Belum ada / batasan
Fitur yang sering dikira ada padahal belum.

## Dokumen lengkap
- sot/menus/<file>.md — baca bagian <judul bagian> untuk <topik>
```

Contoh awal untuk Video Studio (baru bagian yang sudah terverifikasi; sisanya diisi saat pengerjaan):

```markdown
# Kartu Menu: Video Studio
## Fungsi
Menggabungkan klip video dan suara menjadi video siap tayang, termasuk template finishing.
## Lokasi (untuk agent)
- Halaman: app/video-studio/ · Komponen: app/components/video-studio/
- Kelompok sidebar: TOOLS · Kunci izin menu: ffmpeg_studio
## Dokumen lengkap
- sot/menus/video-studio.md
```

---

## 5. SOP untuk agent (teks siap tempel ke AGENTS.md)

```markdown
# SOP Konteks Menu (Hemat Token)

1. Jika percakapan menyebut sebuah menu CF Studio, baca `sot/menus/_PETA_MENU.md`
   lalu HANYA kartu menu terkait di `sot/menus/kartu/`.
2. Jawab dari kartu bila cukup. Jangan membuka dokumen lengkap atau kode
   untuk pertanyaan yang sudah terjawab di kartu.
3. Jika kartu tidak cukup, buka dokumen lengkap pada bagian yang ditunjuk kartu saja
   (cari judul bagian dulu, jangan baca seluruh file).
4. DILARANG membaca utuh `sot/global/changelog.md`. Cari dengan kata kunci
   atau baca 100 baris teratas saja.
5. Jika pengguna tidak menyebut menu, tanyakan menu mana — satu pertanyaan singkat —
   sebelum menelusuri kode.
6. Setiap rilis yang mengubah perilaku sebuah menu WAJIB memperbarui kartu menu itu
   (tanggal, versi, dan butir yang berubah) dalam commit yang sama.
7. Jika isi kartu bertentangan dengan kode, kode yang benar: perbaiki kartu dan
   laporkan ke pengguna.
```

---

## 6. Kebiasaan chat yang ikut menghemat (untuk pengguna)

- **Sebut nama menu di kalimat pertama.** Contoh: "Video Studio — kenapa hasil render tanpa subtitle?"
- **Satu percakapan, satu menu.** Ganti menu = mulai percakapan baru. Percakapan panjang makin mahal karena semua isi sebelumnya ikut terbawa.
- **Sebut tujuan: tanya, review, atau usulan.** Supaya Claude tidak membaca lebih dari yang diperlukan.
- **Tempel tautan atau nama file kalau sudah tahu.** Menghapus tahap pencarian.

---

## 7. Menjaga kartu tetap benar

Kartu yang basi lebih berbahaya daripada tidak ada kartu. Pengamannya:

1. Aturan no. 6 di atas: kartu diperbarui bersamaan dengan rilis.
2. Setiap kartu mencantumkan tanggal cek dan versi aplikasi.
3. Cek ulang berkala (misalnya sebulan sekali): Claude membandingkan kartu dengan kode dan melaporkan yang sudah tidak cocok.

---

## 8. Tahapan pengerjaan yang diusulkan

- [ ] **Tahap 1 — Uji coba 3 menu.** Buat Peta Menu + kartu untuk 3 menu yang paling sering dibahas (usul: Video Studio, Auto Pipeline, Multiplier Labs). Dipakai 1 minggu.
- [ ] **Tahap 2 — Ukur.** Bandingkan pemakaian token sebelum dan sesudah untuk pertanyaan sejenis.
- [ ] **Tahap 3 — Lengkapi 19 kartu sisanya** jika hasil tahap 2 terbukti hemat.
- [ ] **Tahap 4 — Pasang SOP ke AGENTS.md** dan pindahkan 16 rencana YouTube Studio ke `sot/menus/rencana/`.
- [ ] **Tahap 5 (opsional) — Rapikan ± 90 file `.md` di folder utama** ke dalam folder `usulan/`, `instruksi/`, `laporan/` dengan satu daftar isi.

Pembagian kerja: Claude menulis kartu (hanya file dokumentasi, perlu membaca kode tiap menu sekali), pengguna meninjau isinya, Antigravity memasang SOP ke AGENTS.md dan merilis.

---

## 9. Yang perlu diputuskan pengguna

1. Setuju mulai dari uji coba 3 menu? Menu mana yang paling sering dibahas?
2. Kartu ditulis oleh Claude di sini, atau oleh Antigravity?
3. Tahap 5 (merapikan folder utama) ikut dikerjakan atau ditunda?
