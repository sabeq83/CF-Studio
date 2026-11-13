# Revisi 03: Caption 2–3 Kata, Font Besar, Satu Sumber (berlaku setelah v2.44.19)

Dokumen ini melengkapi Revisi 01 dan 02. Jika bertentangan, **Revisi 03 yang berlaku** untuk layer subtitle.

Acuan visual dan perilaku: `mockup_caption_styles.html` (fungsi `chunkNew()`, kelas CSS `.new.s-*`). Versi dengan video: https://claude.ai/artifact/Bm6tBmwcb1mucLi2N3L4Li

## Langkah wajib sebelum coding

1. Baca revisi ini dan source mockup.
2. Perbarui `finishing_pass_implementation_plan.md` dengan tracker **Fase 4: Caption Refresh** sesuai R14–R19, lengkap dengan Code Sebelum/Sesudah. Tandai `(Revisi 03)`.
3. Laporkan plan dan **berhenti**. Tunggu persetujuan user.

---

## Latar

- Keluhan user: teks caption gaya `floating_white_yellow`, `floating_black_on_white`, dan `minimal_white` kadang terlalu panjang dan menumpuk.
- Teks yang menumpuk sekalimat penuh adalah perilaku **versi produksi lama** (sebelum v2.44.4). Staging sudah memotong 2–4 kata, tetapi:
  - font **mengecil** sampai 4,9cqw saat potongan panjang (`joinedLen > 22`), padahal seharusnya potongannya yang dipendekkan;
  - potongan bisa memutus frasa secara janggal ("seperti Alum | Thermal", "terjangkau per | meter");
  - gaya pill membuat satu pill per kata, sehingga layar ramai;
  - CSS subtitle dan aturan pengecilan font **tersalin di 8 file template** (`base-caption`, `calm-wellness`, `recipe-pop`, `tips-listicle`, `ramuan-ritual`, `problem-solution`, `angka-banding`, `mitos-fakta`).

## R14. Satu sumber untuk layer subtitle

1. Pindahkan CSS dan logika render subtitle (termasuk mode `pill` dan `minimal`) dari kedelapan template ke `templates/finishing/shared-layers.js`, mengikuti pola layer bersama dari Fase 2c-1.
2. Setiap template hanya memanggil fungsi bersama, misalnya `renderSubtitle(oSub, timeline, t, { style, captionMode })`. Template tidak boleh lagi memuat aturan ukuran font subtitle sendiri.
3. Hapus aturan pengecilan font berbasis `joinedLen` dari semua template.
4. Posisi default tetap `top: 69cqh`. Template boleh menggeser posisi lewat parameter, bukan menyalin CSS.

## R15. Aturan pemotongan baru (`chunkCaptionWords`)

Ganti logika di `lib/motion-text-engine.js` (dipakai renderer Playwright dan fallback Sharp/SVG). Acuan: `chunkNew()` di mockup.

1. **Maksimal 3 kata** dan **maksimal 16 karakter** per potongan (termasuk spasi dan tanda baca).
2. **Selalu putus di batas klip.**
3. **Putus setelah tanda baca** `, . ? ! :`, kecuali jika kata itu kata sambung.
4. **Jangan putus setelah kata sambung.** Jika potongan sudah berisi ≥2 kata dan kata berikutnya kata sambung, putus **sebelum** kata sambung itu. Setelah pemotongan, jika sebuah potongan berakhir dengan kata sambung dan potongan berikutnya masih muat (≤3 kata, ≤16 karakter), pindahkan kata sambung itu ke awal potongan berikutnya.
   - Daftar awal (bisa diperluas, simpan sebagai konstanta terpusat): `dan, atau, di, ke, dari, per, untuk, yang, dengan, saat, karena, agar, serta, tanpa, jadi, sebelum, sesudah, seperti, tapi, kalau` dan untuk konten bahasa Inggris `and, or, the, to, of, in, for, with`.
   - Jangan masukkan `ini` / `itu` (contoh "Di titik ini," harus utuh).
5. **Frasa terlindungi tidak boleh dipisah.** Sumbernya, bukan ditulis manual:
   - nama produk/material dari data produk dan brand profile;
   - frasa punch, `callouts.trigger`, `compare` title, `numbers.trigger`, `timing_badges.trigger` dari `finishing_plan` yang lolos validasi;
   - label bahan dari ekstraktor resep (kata inti, misalnya "jahe merah").

   Jika frasa terlindungi akan terpotong, pindahkan kata pertamanya ke potongan baru. Frasa terlindungi boleh mengisi satu potongan sendiri sampai 4 kata.
6. **Gabungkan potongan yang terlalu singkat.** Potongan berdurasi < 0,45 dtk digabung dengan tetangga di klip yang sama (coba yang sesudahnya dulu, lalu yang sebelumnya) selama hasilnya ≤3 kata dan ≤18 karakter. Pengecualian: satu kata yang tampil < 0,3 dtk boleh bergabung sampai total 4 kata.
7. **Tidak pernah mengecilkan font untuk memuat teks.** Setelah dirender, jika lebar potongan > 88cqw pada ukuran gaya, potong lagi berdasarkan kata. Hanya **satu kata tunggal** yang tetap terlalu lebar yang boleh dikecilkan, dengan batas bawah 6cqw.
8. Aturan ini berlaku untuk semua `caption_mode`. Pada mode `hybrid`, subtitle tetap disembunyikan selama punch tampil (perilaku sekarang).

## R16. Spesifikasi tiga gaya

Nama gaya **tidak berubah**, jadi preset dan campaign lama otomatis memakai versi baru. Nilai di bawah adalah ukuran di frame 720×1280 (cqw = % lebar).

| Gaya | Tampilan baru |
|---|---|
| `floating_white_yellow` | Montserrat 900, huruf kapital, **7,6cqw**, putih dengan stroke hitam 0,75cqw dan bayangan padat ke bawah. Kata aktif berwarna aksen (default `#ffd23f`, atau warna brand bila tersedia) |
| `floating_black_on_white` | **Satu pill putih per potongan** (bukan per kata), Montserrat 900 kapital **7cqw**, radius 2,4cqw, bayangan padat. Kata aktif disorot dengan kotak warna aksen di dalam pill |
| `minimal_white` | Montserrat 800, **huruf normal (bukan kapital)**, **6,8cqw**, putih tanpa stroke, di atas **gradasi gelap tipis** (56–84cqh, puncak opasitas ±0,55). Kata aktif diberi garis bawah warna aksen. Kartu putih dan efek mengetik dihapus |

Semua gaya:
- Satu baris, rata tengah, `white-space: nowrap`.
- Animasi masuk potongan baru: skala 0,9 → 1,0 dan opasitas naik dalam 0,12 dtk. Fungsi murni terhadap `t`, sesuai kontrak `renderAt(t)`.
- Warna aksen diambil dari brand profile bila ada (R6.1). Cek kontras teks gelap di atas aksen.

## R17. Kompatibilitas

1. Campaign dan preset lama tidak perlu diubah. Nama gaya, `caption_mode`, dan default lainnya tetap.
2. Fallback Sharp/SVG memakai `chunkCaptionWords` yang sama, dengan ukuran font setara (boleh tanpa animasi).
3. Template yang punya layer di area subtitle (CTA, notice, rekap) harus diuji ulang tabrakannya karena font subtitle membesar. Gunakan aturan zona R6.4.

## R18. Verifikasi

- Unit test `chunkCaptionWords` dengan kalimat nyata dari VO acuan:
  - Solusi Thermal `opc_2107`: tidak ada potongan "seperti Alum" / "Thermal atau"; "Alum Thermal", "Bubble Foil", dan "Di titik ini," utuh.
  - Sasyahouse `opc_1756`: "dana darurat" dan "sepuluh persen" utuh.
  - Siasat Sehat `mul_261113_nfrdfh`: "api kecil" dan "tutup panci" utuh.
  - Tidak ada potongan > 3 kata kecuali frasa terlindungi atau kata tunggal < 0,3 dtk yang digabung.
  - Tidak ada potongan yang berakhir dengan kata sambung bila masih bisa dipindah.
- Render staging untuk ketiga gaya pada 3 video berbeda. Contact sheet tiap 0,5 dtk. Ukur lebar teks: tidak ada yang melewati 88cqw.
- Regression: ketujuh template tetap lolos test yang ada. Grep: tidak ada lagi aturan ukuran subtitle di file template selain `shared-layers.js`.
- Cek tabrakan subtitle dengan CTA, notice, dan rekap di `tips_listicle`, `ramuan_ritual`, dan `recipe_pop`.

## R19. Perbaikan default `caption_mode` di override campaign (bug v2.44.19)

**Masalah:** campaign lama dengan `caption_mode` kosong/NULL berjalan sebagai **`full`** (aturan kompatibilitas Revisi 01). Namun:
- `app/pillar-campaigns/[id]/page.js` menampilkan nilai kosong sebagai `hybrid` (`caption_mode: data.campaign?.caption_mode || 'hybrid'`, juga state awal `caption_mode: 'hybrid'`);
- tombol simpan Finishing Pass selalu mengirim ketiga field (`finishing_template`, `caption_mode`, `loudness_target`);
- `app/api/v2/pillar-campaigns/[id]/route.js` mengubah string kosong menjadi `hybrid` (`String(body.caption_mode || 'hybrid')`).

Akibatnya, mengganti template saja di Campaign Detail ikut mengubah caption campaign lama dari `full` ke `hybrid` tanpa disadari user.

**Perubahan:**
1. UI menampilkan nilai efektif yang sebenarnya: kosong/NULL → `full` (pakai `resolveCampaignCaptionMode()` atau logika setara), dengan keterangan kecil "default (campaign lama)".
2. Tombol simpan hanya mengirim field yang **benar-benar diubah** user.
3. Route PATCH: string kosong untuk `caption_mode` tidak diubah menjadi `hybrid`. Pilih salah satu dan catat di plan: tolak dengan 400, atau simpan sebagai NULL (kembali ke default). Jangan ada nilai default tersembunyi.
4. Periksa hal yang sama untuk `finishing_template` (kosong → `none`) dan `loudness_target` (kosong → -14), serta form preset (`app/settings/presets/page.js`) dan jalur MCP.
5. Test: buka campaign lama (`caption_mode` NULL), ganti hanya `finishing_template`, simpan → `caption_mode` di DB tetap NULL dan render tetap `full`.

## Di luar scope agent

- **Deploy ke production** tetap keputusan user. Selama production masih versi lama, video brand harian masih memakai caption lama yang menumpuk.
- Pengaturan durasi layer (bahan, kartu produk, dan lainnya) per template dibahas terpisah.

## Ringkasan tracker

| Bagian | Isi |
|---|---|
| Fase 4-T1 | Pindahkan layer subtitle ke `shared-layers.js`, hapus duplikasi di 8 template (R14) |
| Fase 4-T2 | Aturan pemotongan baru + sumber frasa terlindungi (R15) |
| Fase 4-T3 | Tiga gaya baru (R16) + kompatibilitas (R17) |
| Fase 4-T0 | Perbaikan default `caption_mode` di override campaign (R19). Boleh dirilis lebih dulu karena kecil dan berdiri sendiri |
| Fase 4-T4 | Verifikasi (R18) → rilis |

Aturan lain tetap berlaku: satu fase per rilis, jangan deploy production, campaign lama tidak berubah, teks tidak boleh dikarang.
