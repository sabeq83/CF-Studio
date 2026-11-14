# Analisa Pola Metafor — Bundayes, Sirlang, Rendam Herbal (Seger Waras)

> Tanggal: 2026-11-14 · Status: ANALISA & USULAN (belum ada perubahan kode)
> Sumber: `~/Documents/Shopee Aff/exported_docs` — 266 dokumen (Bundayes 102, Sirlang 106, Rendam Herbal 58).
> Cakupan baca: **judul + baris konsep kunci (konsep, catatan eksekusi, core subject, panel hook/metaphor, mode/genre) dari seluruh 266 dokumen**, bukan isi lengkap setiap prompt klip. Pola di bawah konsisten di ratusan dokumen, jadi cukup kuat sebagai dasar desain.

---

## 1. Inti temuan: tiap produk punya "mesin metafor" yang berbeda

| Produk | Cara kerja produk | Mesin metafor yang dipakai | Contoh |
|---|---|---|---|
| **Bundayes** (diet, diminum) | Dari dalam | **Kotor → Bersih**, **Macet → Lancar**, **Berat → Ringan** | gelas berminyak, wastafel mampet, filter air berkarat, french press tersumbat, kancing jeans copot, balon mengempis |
| **Sirlang** (minyak oles wasir) | Dioles, menenangkan | **Berduri → Lembut**, **Panas → Sejuk**, **Kasar/Gesek → Licin**, **Tertekan → Lega** | kursi pelaminan berduri, sadel sepeda berpaku, sajadah berbatu, jok mobil jadi aspal panas, denim vs beludru, bola silikon dijepit ragum |
| **Rendam Herbal** (rendam kaki hangat) | Hangat dari luar | **Beku → Hangat mengalir**, **Kaku/Karat → Lentur**, **Terbelenggu → Lepas** | lutut seperti engsel berkarat, kaki terbungkus beton, es merambat di celana, rantai karat di pergelangan, bara magma di sendi |

**Pelajaran utama:** metafor yang tepat **mengikuti cara kerja produk**. Produk yang diminum → membersihkan. Produk yang dioles → melembutkan/mendinginkan. Produk rendam hangat → mencairkan/melenturkan. CF Studio saat ini hanya punya mesin **"kotor → bersih"** (cocok untuk produk diminum), sehingga semua produk terdorong ke cerita yang sama.

---

## 2. Katalog pola (13 pola)

| # | Pola | Asal utama | Ringkas |
|---|---|---|---|
| P1 | **Kotor → Bersih (ASMR cleaning)** | Bundayes | Benda rumah tangga kotor dibersihkan → plong |
| P2 | **Benda Konteks Berubah Menyakitkan** | Sirlang | Benda khas lokasi persona (kursi pelaminan, sadel, sajadah, jok ojol, tikar lesehan, kursi kafe) **berubah** jadi berduri/berpaku/membara → setetes produk mengubahnya jadi beludru lembut |
| P3 | **Tubuh Menjadi Material** | Rendam Herbal | Bagian tubuh tertutup kain (lutut, betis, pergelangan) "terlihat" seperti engsel karat, beton, kabel baja tegang, es, bara → mencair jadi uap hangat keemasan |
| P4 | **Tekanan & Elastisitas** | Sirlang, Bundayes | Balon kepenuhan, ragum menjepit bola silikon, jarum manometer merah, tabung menggelembung → tekanan lepas |
| P5 | **Gesekan & Tekstur** | Sirlang | Denim menggerus beludru, tisu toilet seperti amplas, tali kasar melewati cincin silikon → berganti sutra |
| P6 | **Panas → Sejuk** | Sirlang | Bara arang, cabai jadi lava, aspal panas → tetes emas memadamkan jadi gel biru/es |
| P7 | **Beku → Hangat Mengalir** | Rendam Herbal | Embun beku merambat, porselen dingin retak, akar rapuh → hangat, cair, lentur |
| P8 | **Beban & Belenggu** | Rendam Herbal, Bundayes | Rantai karat, sepatu besi, borgol, koper berat → rantai larut/putus |
| P9 | **"Satu Tetes Emas" (Golden Drop)** | ketiganya | Momen produk bekerja: **setetes** produk menyentuh masalah → **metamorfosis instan** (duri → beludru, batu → spons, kail → silikon) |
| P10 | **Alarm/Data Merah (Red Alert hook)** | Rendam, Bundayes | Hasil lab angka merah, timbangan "ERR", ikon baterai 1%, struk obat terbakar (ROI) |
| P11 | **Genre emosional di atas metafor** | Bundayes, Sirlang | Drama (undangan mantan), thriller (deadline), horor (kulkas tengah malam), komedi (ekspektasi vs realita), romantis (persiapan cincin), aksi (zip battle), bakti anak (tangan muda vs tua) |
| P12 | **Teknik visual khusus** | Bundayes, Rendam | Stop motion burger, boneka kertas, restorasi barang antik (album, kebaya warisan), karakter sel 3D lucu |
| P13 | **Satu metafor × banyak situasi (CEP)** | Sirlang, Rendam | Pola P2 dipindah ke puluhan situasi persona: kantor, ojol, gamer, umrah, kondangan, mancing, gowes, mahasiswa skripsi, sopir, nonton bioskop → **100+ video dari 1 mesin** |

---

## 3. Yang belum ada di CF Studio

Pembanding: 28 kit F1 (`lib/metaphor-world-kits.js`), metafora kesehatan lama (`lib/health-metaphors.js`), serta preset system *hydraulic / decompression gauge / chrono restoration / rheology*.

| Pola | Status di CF Studio | Catatan |
|---|---|---|
| P1 Kotor → Bersih | ✅ Ada (28 kit) | Inilah satu-satunya mesin saat ini |
| P2 Benda Konteks Berubah Menyakitkan | ❌ **Belum ada** | Pola paling produktif di Sirlang (±80 dokumen) |
| P3 Tubuh Menjadi Material | ❌ **Belum ada** | Saat ini dilarang (kit object-only). Butuh mode "bagian tubuh tertutup" + QC halusinasi |
| P4 Tekanan & Elastisitas | 🟡 Sebagian | Kit kancing jeans + preset manometer (gaya mewah gelap). Belum ada balon/ragum/tabung |
| P5 Gesekan & Tekstur | ❌ Belum ada | |
| P6 Panas → Sejuk | 🟡 Sebagian | Hanya 1 kit (wajan meletup) |
| P7 Beku → Hangat | 🟡 Sebagian | Hanya kaca berembun |
| P8 Beban & Belenggu | 🟡 Sebagian | Hanya koper berat |
| P9 Golden Drop | 🟡 Sedang dikerjakan di F2.1 ("produk bekerja") | Belum dijadikan **adegan standar** yang selalu ada |
| P10 Red Alert hook | ❌ Belum ada | |
| P11 Genre emosional | ❌ Belum ada | "Genre" di kit saat ini = jenis visual, bukan nada cerita |
| P12 Teknik khusus | 🟡 Gaya ada (claymation, paper cutout), tapi tidak terhubung ke kit metafor | |
| P13 Metafor × Situasi | ❌ **Belum ada** | Rotasi saat ini berdasarkan **topik**, bukan **situasi persona**. Padahal Content Planner sudah punya kolom CEP/W's Matrix |

**Masalah struktural:** kit sekarang adalah "paket jadi" (1 kit = 1 cerita). Untuk mencapai variasi seperti Sirlang (100+ video), kita harus menulis ratusan kit. Sirlang tidak bekerja seperti itu: ia **menggabungkan** 1 mesin metafor + 1 situasi + 1 nada cerita.

---

## 4. Usulan terbaik

### U-A (prioritas 1) — Ubah kit menjadi 3 lapis yang bisa digabung
```
Mesin Metafor  ×  Dunia Situasi (CEP)  ×  Nada Cerita
(P1–P8)           (lokasi persona)          (P11)
```
- **Mesin Metafor** (±8): kotor→bersih, macet→lancar, berat→ringan, berduri→lembut, panas→sejuk, gesek→licin, tekanan→lega, beku→hangat, kaku→lentur, belenggu→lepas.
- **Dunia Situasi** diambil dari baris Content Planner (CEP/W's Matrix): kantor, ojol, kondangan, sajadah, dapur, kamar malam, mobil, kafe, dan seterusnya. Benda khas situasi itulah yang "berubah" (pola P2).
- **Nada Cerita**: edukatif (default), drama, komedi, thriller ringan, bakti anak, romantis. Horor dan aksi hanya dengan izin per brand.
- **Hasil:** 8 mesin × 20 situasi × 4 nada = ratusan kombinasi tanpa menulis ratusan kit. Rotasi anti-repeat F1 tetap dipakai, tapi pada kombinasinya.
- 28 kit yang sudah ada tetap dipakai sebagai mesin "kotor→bersih" yang sudah matang.

### U-B (prioritas 1) — Peta "cara kerja produk → mesin metafor"
Tambahkan di data produk satu pilihan **cara pakai**: *diminum / dioles / direndam-dihangatkan / dihirup / dimakan sebagai resep*. Sistem otomatis memilih mesin yang cocok:

| Cara pakai | Mesin yang diizinkan |
|---|---|
| Diminum / kapsul | kotor→bersih, macet→lancar, berat→ringan |
| Dioles (minyak/balsem) | berduri→lembut, panas→sejuk, gesek→licin, tekanan→lega |
| Rendam / kompres hangat | beku→hangat, kaku→lentur, belenggu→lepas |
| Resep/minuman herbal (DapurBotani, SiasatSehat) | kotor→bersih, macet→lancar, beku→hangat, berat→ringan |

Ini mencegah produk oles mendapat metafor "wastafel mampet".

### U-C (prioritas 1) — "Satu Tetes Emas" sebagai adegan wajib
Di klip produk selalu ada satu shot makro: **setetes/sesendok produk menyentuh benda bermasalah → berubah seketika**. Bentuknya mengikuti produk (tetes minyak, lelehan madu, uap rendaman). Inilah payoff yang menjual, dan sekaligus jawaban untuk masalah "produk cuma dipegang" di uji staging.

### U-D (prioritas 2) — Pustaka hook "Alarm Merah" (P10)
Hook 1–2 detik yang bisa dipasang di depan metafor apa pun: angka merah di hasil lab, timbangan "ERR", baterai 1%, struk obat terbakar. Murah, cepat, dan kuat menahan scroll.

### U-E (prioritas 2) — Nada cerita sebagai pilihan per campaign (P11)
Satu pilihan sederhana di campaign: *Edukatif / Drama / Komedi / Bakti Anak / Romantis / Thriller*. Nada mengubah musik, ritme, hook, dan narasi, sementara metafor tetap.

### U-F (prioritas 3) — Mode "Tubuh Menjadi Material" (P3)
Sangat kuat untuk nyeri sendi, asam urat, kesemutan, dan pegal. Tapi **paling rawan halusinasi** (tangan/kaki ganda, aurat). Usulan: kerjakan **setelah** pemeriksa gambar otomatis (F2.1-G) terbukti stabil, dan hanya untuk bagian tubuh yang tertutup kain (celana panjang, sarung, kaus kaki).

### U-G (prioritas 3) — Teknik visual khusus (P12)
Stop motion, boneka kertas, dan restorasi barang antik sebagai "kulit" alternatif untuk mesin yang sama. Ini bagus untuk memecah kebosanan feed setelah U-A berjalan.

---

## 5. Catatan kepatuhan
- Sirlang membuktikan **metafor adalah tameng kebijakan platform**: wasir/ambeien tidak pernah ditampilkan secara anatomis, cukup "kursi berduri yang berubah jadi beludru". Prinsip ini perlu dijaga: **masalah sensitif = wajib metafor benda**.
- Beberapa naskah lama memakai klaim keras ("bakar lemak & buang racun", "langsung reda seketika"). Saat mengadopsi pola, **visualnya diadopsi, klaimnya diganti** dengan versi aman ("membantu meredakan", "terasa lebih nyaman").
- Pola tangan muda vs tangan tua (bakti anak) efektif dan aman, asalkan tetap tanpa wajah dan lengan tertutup.

## 6. Urutan yang saya sarankan
1. Selesaikan **F2.1** (perbaikan + anti-halusinasi). Ini fondasi kualitas.
2. **F3 baru = U-A + U-B + U-C** (3 lapis + peta cara pakai produk + Golden Drop). Di sinilah variasi "skala Sirlang" lahir.
3. **F4 = U-D + U-E** (hook alarm merah + nada cerita).
4. **F5 = U-F + U-G** setelah QC visual terbukti.
