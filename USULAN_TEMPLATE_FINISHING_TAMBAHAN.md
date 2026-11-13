# Usulan 5 Template Finishing Tambahan (total 7)

Tanggal: 13 Nov 2026 · Status: usulan, belum dikerjakan

Template yang sudah ada: `recipe_pop` (resep/baking) dan `calm_wellness` (produk herbal, tenang).

## 1. Video yang dianalisa

Satu video Completed terbaru per brand, diunduh dari Nextcloud ContentFlow, dicek per 1 detik.

| Brand (tenant) | Item | Isi | Gaya visual | Teks di layar sekarang | Loudness |
|---|---|---|---|---|---|
| Ruang Akustik ID (PT GIM Sosmed) | opc_2108 "Suara jalanan menembus kamar" | Masalah → penyebab → solusi (Rockwool Slab) → hasil | Karakter 3D presenter, hologram gelombang suara | Caption kalimat menumpuk | -24,3 |
| Solusi Thermal ID (PT GIM Sosmed) | opc_2107 "Harga peredam panas per m²" | Pertanyaan harga → hemat listrik → material (Alum Thermal, Bubble Foil) → konsultasi | Karakter 3D di gudang, angka & termometer | Caption menumpuk. **Klip terakhir berisi teks AI rusak: "Solusi Tinemal ID mark", "comment sextion."** | -24,7 |
| Sasyahouse (default) | opc_1756 "Ketenangan finansial anak kost" | 8 tips singkat (pisahkan 10% saldo, catatan mingguan) | Faceless realistis, meja belajar, HP, buku catatan | **Tidak ada teks sama sekali** | -24,1 |
| Siasat Sehat (default) | mul_0jbsl8 "Rontokkan lemak visceral sambil tidur" | Ramuan lemon-cengkeh-kayu manis, diamkan semalaman, minum sebelum tidur | Tangan di dapur marmer, botol Nutrifarm terlihat | Pill hitam-putih 5–6 baris menutupi gelas dan produk | -24,6 |
| Dapur Botani non-GarliBee (default) | mul_lu12u7 "Ganti kopi pagi" | Hook sains (sel lemak menyala) → racikan 3 rempah | Visual mikroskopis + lesung batu | Caption menumpuk | -23,8 |
| Habitfolk (default) | opc_2074 "Garlic butter air fryer wings" | Resep **bahasa Inggris**, 6 langkah, CTA unduh app | Dapur terang, tangan | Caption menumpuk, bahasa Inggris | -18,4 |
| Nutriblend (SY Dodot) | mul_7qof6a_07 "Sains lemak perut membandel" | Seduhan jahe-lemon-madu untuk "Moms", sebelum tidur | Dapur hangat, uap teh | **Tidak ada teks sama sekali** | -24,2 |

### Temuan lintas brand

1. **Semua video terlalu pelan** (-24 LUFS, Habitfolk -18). Normalisasi -14 dari Fase 0 langsung berdampak ke semua brand.
2. **Dua brand tanpa teks sama sekali** (Sasyahouse, Nutriblend). Penonton yang menonton tanpa suara tidak menangkap apa pun.
3. **Teks AI rusak di klip penutup** Solusi Thermal ("Solusi Tinemal ID mark", "comment sextion."). Ini merusak citra brand dan bisa ditutup dengan kartu penutup brand.
4. **Brand B2B/jasa** (Ruang Akustik, Solusi Thermal) tidak punya link produk. CTA-nya konsultasi/komen, bukan keranjang.
5. **Konten herbal** (Siasat Sehat, Dapur Botani, Nutriblend) memuat klaim berat ("rontokkan lemak visceral", "bilas ginjal"). Template untuk segmen ini wajib paling ketat soal compliance.
6. **Habitfolk berbahasa Inggris.** Label template (BAHAN, LANGKAH) perlu ikut bahasa konten.

## 2. Lima template baru

### T3. `problem_solution`: Masalah → Penyebab → Solusi → Hasil

**Untuk:** Ruang Akustik ID, Solusi Thermal ID, juga konten edukasi Dapur Botani.
**Kenapa:** video brand jasa/material sudah mengikuti alur 4 babak ini, tapi penonton tidak diberi penanda babak. Penanda babak membuat penonton tahu "solusinya sebentar lagi" sehingga bertahan.

| Layer | Isi |
|---|---|
| Label babak | Chip di kiri atas per klip: `MASALAH` (merah) → `PENYEBAB` (oranye) → `SOLUSI` (hijau) → `HASIL` (biru). Diambil dari urutan klip/peran storyboard |
| Callout material | Label dengan garis penunjuk saat VO menyebut material ("ROCKWOOL SLAB", "BUBBLE FOIL"). Teks hanya dari VO |
| Keyword punch | Kata masalah dan hasil ("BOCOR LEWAT CELAH", "LEBIH TENANG") |
| Lower-third presenter | Untuk video dengan karakter 3D: "Tim Ruang Akustik ID" + logo kecil, muncul sekali di klip pertama presenter tampil |
| CTA konsultasi | Kartu "Konsultasi gratis · komen / DM / link di bio" dari CTA naskah, bukan keranjang |
| Kartu penutup brand | 1,5–2 dtk terakhir: logo + nama brand + CTA, menutup teks AI rusak di klip akhir |

### T4. `angka_banding`: Angka, harga, dan perbandingan

**Untuk:** Solusi Thermal ID (harga per m², suhu), Ruang Akustik ID (perbandingan material), juga konten "hemat X rupiah".
**Kenapa:** angka adalah hook paling kuat untuk konten material dan biaya. Sekarang angka hanya diucapkan, tidak terlihat.

| Layer | Isi |
|---|---|
| Penghitung angka | Angka besar yang menghitung naik saat diucapkan ("38°C → 24°C", "per m²"). **Hanya angka yang ada di VO atau data brand**, tidak boleh dikarang |
| Kartu banding | Dua kolom A vs B (contoh "Insulasi" vs "Treatment akustik", "Alum Thermal" vs "Glasswool") saat VO membandingkan. Isi kolom dari VO/data produk |
| Termometer / meter | Bar visual sederhana untuk suhu atau tingkat bising, hanya jika ada dua angka di VO |
| Punch | Kata hasil ("LEBIH HEMAT", "LEBIH SEJUK") |
| CTA | "Minta daftar harga · komen 'HARGA'" |
| Kartu penutup brand | Sama seperti T3 |

### T5. `tips_listicle`: Daftar tips bernomor

**Untuk:** Sasyahouse (tips anak kost), tips umum Siasat Sehat, tips memasak Habitfolk.
**Kenapa:** video Sasyahouse berisi 8 tips tanpa teks sama sekali. Nomor yang terlihat ("TIP 2/4") membuat penonton menunggu tips berikutnya, dan daftar di akhir mendorong save.

| Layer | Isi |
|---|---|
| Judul daftar | Hook card berbentuk daftar: "3 CARA TENANG DI TANGGAL TUA" (dari hook, divalidasi `fitHookCard`) |
| Penghitung tips | Badge besar `TIP 1/4` saat tiap tips mulai, plus kalimat tips singkat (≤6 kata, diringkas dari VO) |
| Angka kunci | Punch angka dari VO ("10%", "SEMINGGU SEKALI") |
| Rekap akhir | Daftar ✓ semua tips di 2 dtk terakhir, plus "📌 Simpan biar nggak lupa" |
| Lokasi/brand | Untuk Sasyahouse: chip kecil lokasi dari brand profile ("Kost Muslimah · Malang") di klip pertama |
| CTA | Ajakan komen ("Tulis tips versimu di komen") |

### T6. `ramuan_ritual`: Ramuan herbal dengan waktu dan cara minum

**Untuk:** Siasat Sehat, Nutriblend, Dapur Botani (resep herbal non-produk).
**Kenapa:** berbeda dari `recipe_pop` (baking, banyak langkah). Konten ramuan intinya: bahan sedikit, **waktu** (diamkan semalaman, sebelum tidur, pagi perut kosong), dan ritual minum. Segmen ini juga paling berisiko klaim kesehatan.

| Layer | Isi |
|---|---|
| Daftar bahan | Seperti `recipe_pop` tapi lebih ringkas, gaya hangat (krem, terakota) |
| Badge waktu | Chip waktu saat VO menyebutnya: `🌙 SEBELUM TIDUR`, `⏱ DIAMKAN 2–4 JAM`, `☀️ PAGI, PERUT KOSONG`. Hanya dari VO/resep |
| Takaran | Chip takaran saat dituang ("2 SDM", "300 ML") |
| Kartu produk | Jika produk tampil di video (contoh botol Nutrifarm Sari Lemon): kartu kecil dengan nama produk saja, tanpa klaim |
| Catatan aman | **Wajib**, tampil di akhir: "Secara tradisional dipercaya… · Bukan pengganti pengobatan medis". Teks dari brand profile |
| Punch | **Dibatasi**: hanya kata bahan/waktu/rasa ("HANGAT", "SEMALAMAN"). Kata klaim (lemak, ginjal, gula darah, visceral, detoks) selalu diblokir di template ini, apa pun jenis produknya |
| CTA | "Komen 'MAU' untuk resep lain" / "📌 Simpan resepnya" (sesuai naskah) |

### T7. `mitos_fakta`: Pertanyaan, mitos, dan fakta

**Untuk:** Dapur Botani (hook sains), Siasat Sehat ("rahasia merebus rempah"), Ruang Akustik ID ("peredam terbaik: benarkah?").
**Kenapa:** banyak hook sudah berbentuk pertanyaan atau koreksi kesalahan umum. Format mitos/fakta memicu komentar ("aku juga salah selama ini") dan rasa penasaran di detik awal.

| Layer | Isi |
|---|---|
| Kartu pertanyaan | Hook card berbentuk tanda tanya besar di frame 0 ("BENARKAH…?") |
| Cap MITOS / FAKTA | Kartu ❌ `MITOS` saat VO menyebut kesalahan umum, lalu ✅ `FAKTA` saat koreksi. Teks diringkas dari VO, ditentukan di `finishing_plan` |
| Label "Kenapa?" | Chip penjelasan saat VO masuk bagian sebab |
| Punch | Kata koreksi ("API KECIL", "TUTUP PANCI") |
| CTA | "Kamu termasuk yang mana? Komen!" |
| Compliance | Fakta hanya dari VO. Untuk topik kesehatan, cap FAKTA tidak boleh memuat klaim medis. Jika ragu, layer dilewati |

## 3. Layer bersama baru (dipakai banyak template)

| Layer | Kegunaan | Sumber data |
|---|---|---|
| Kartu penutup brand | Menutup 1,5–2 dtk terakhir dengan logo, nama, CTA. Menutupi teks AI rusak di klip akhir | Brand profile (logo, nama, CTA default) |
| Watermark brand | Logo kecil transparan di pojok atas | Brand profile |
| Lower-third presenter | Nama tim/presenter untuk video karakter 3D | Brand profile |
| Label sesuai bahasa | BAHAN/INGREDIENTS, LANGKAH/STEP, dan seterusnya | Bahasa konten (`target_language`) |

## 4. Pemetaan brand → template

| Brand | Template utama | Alternatif |
|---|---|---|
| Ruang Akustik ID | `problem_solution` | `mitos_fakta`, `angka_banding` |
| Solusi Thermal ID | `angka_banding` | `problem_solution` |
| Sasyahouse | `tips_listicle` | — |
| Siasat Sehat | `ramuan_ritual` | `mitos_fakta`, `tips_listicle` |
| Dapur Botani | `calm_wellness` (GarliBee) · `ramuan_ritual` (resep herbal) | `mitos_fakta` |
| Habitfolk | `recipe_pop` (label bahasa Inggris) | `tips_listicle` |
| Nutriblend | `ramuan_ritual` | `recipe_pop` |
| Nutribake | `recipe_pop` | — |

## 5. Catatan untuk implementasi nanti

- Semua template tunduk pada aturan Revisi 01 (template umum R6, preset R8, compliance R1). Tidak ada template yang menyimpan teks/angka video tertentu.
- Data baru yang dibutuhkan di `finishing_plan`: `chapters` (T3), `numbers` dan `compare` (T4), `tips` (T5), `timing_badges` dan `dosage` (T6), `myth_fact` (T7). Semua divalidasi: teks harus berasal dari VO atau data brand/produk.
- Brand profile perlu field: logo transparan, CTA default per platform, teks catatan aman (untuk herbal), nama presenter/tim, lokasi (opsional).
- Urutan pengerjaan yang disarankan, berdasarkan jumlah brand yang terbantu dan risiko:
  1. Layer bersama (kartu penutup brand, watermark, label bahasa): semua brand, risiko rendah.
  2. `tips_listicle`: Sasyahouse yang belum punya teks sama sekali.
  3. `ramuan_ritual`: 3 brand herbal, sekaligus memperketat compliance.
  4. `problem_solution` lalu `angka_banding`: 2 brand PT GIM.
  5. `mitos_fakta`: terakhir, karena paling bergantung pada kualitas `finishing_plan`.
- Template baru dikerjakan **setelah** Fase 2 (template pertama) stabil, sebagai fase tersendiri.
