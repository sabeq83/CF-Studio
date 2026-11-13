# Usulan Perbaikan Narasi VO (Gemini) — Kampanye Pilar & Multiplier

Tanggal analisa: 14 Nov 2026 · Sumber: server staging (produksi) lewat MCP CF Studio · Kode: `~/_cfstudio` @ `26c9dab`

## 1. Ringkasan

Narasi terasa mengambang karena **prompt tidak pernah meminta "isi"**, hanya meminta suasana, emosi, dan alur. Rantainya:

1. **Content Planner** menghasilkan pilar, CEP, W's Matrix (emosi), konteks, angle, dan hook, tetapi **tidak menghasilkan poin tips atau jawaban konkret**. Field `evidence` hampir selalu `null`.
2. **Prompt VO pilar** mewajibkan pola per klip "Hook → Padahal… → Nah/Di titik inilah… → Hasilnya…". Dari 4 klip, hanya 1 klip yang tersisa untuk solusi, dan klip itu pun tidak diwajibkan konkret.
3. **Narrative Mode "Storytelling"** dipakai di hampir semua naskah. Instruksinya adalah "melukiskan suasana… ketenangan pikiran" dan "penutup hangat reflektif", jadi hasilnya memang naskah suasana, bukan tips.
4. **Aturan kepatuhan klaim** (benar dan perlu) tidak diberi alternatif. Karena dilarang menyebut manfaat, model mengisi kekosongan dengan kata umum: "bantu jaga kebugaran", "kebaikan alami", "langkah tepat".
5. **Multiplier**: 3 klip × 17–19 kata terlalu sempit untuk resep. Takaran dan langkah dari video sumber hilang. Sebaliknya, klaim medis justru lolos.

Usulan intinya adalah **"Isi dulu, baru gaya"**: planner wajib menghasilkan 2–4 poin konkret per video, prompt VO wajib menyampaikan poin itu satu per klip, lalu validator menolak naskah yang tidak memuat pegangan konkret.

## 2. Data yang dicek

65 naskah VO unik dari 7 brand (49 kampanye pilar/OPC + 16 multiplier). Ruang Akustik, Solusi Thermal, Habitfolk, dan Sasyahouse belum punya multiplier, jadi yang dicek hanya pilar mereka.

| Brand | Jenis | Naskah | Klip isi yang memuat angka/takaran | Kata samar per 100 kata | Penanda formula per naskah |
|---|---|---|---|---|---|
| Dapur Botani (Garlibee) | pilar produk | 7 | **0%** | **6,6** | 1,9 |
| Ruang Akustik ID | pilar keyword | 7 | **0%** | 3,5 | **3,4** |
| Solusi Thermal ID | pilar keyword | 7 | 14% | 3,1 | **2,9** |
| Sasyahouse | pilar | 7 | 5% | 2,3 | 0,1 |
| Siasat Sehat | pilar resep | 7 | 32% | 1,9 | 0 |
| Nutriblend | pilar resep | 7 | 22% | 1,2 | 0 |
| Habitfolk (EN) | pilar resep | 7 | rendah (langkah tanpa suhu/waktu) | – | 0 |
| Siasat Sehat | multiplier | 7 | 29% | 3,1 | 0,3 |
| Dapur Botani | multiplier | 7 | 43% | 2,5 | 0 |
| Nutriblend | multiplier | 2 | 0% | 3,3 | 0 |

Kata samar yang paling sering muncul: *padahal* (22×), *alami* (17), *nyaman* (12), *efektif* (11), *maksimal* (10), *sempurna* (10), *pilihan* (10), *tepat* (9), *kebugaran* (8), dan *secukupnya* (7).

Catatan metode: "klip isi" adalah klip selain hook dan penutup. Angka mencakup bilangan, takaran, durasi, suhu, dan persen.

## 3. Pola masalah + contoh nyata

### P1. Kampanye produk herbal: tidak ada yang bisa dipraktikkan
Dapur Botani `opc_261113_wwffoo` (Garlibee):
> Menjaga kesehatan jantung keluarga dimulai dari kebiasaan kecil setiap pagi. / **Padahal** rutinitas padat sering membuat niat sehat ini kerap tertunda. / **Padahal** tubuh memerlukan dukungan harian yang praktis dan konsisten. / Di sinilah pentingnya memilih asupan alami yang mudah diserap tubuh. / GarliBee memadukan bawang lanang dan madu mentah murni pilihan. / …

Dari 6 klip, tidak ada satu pun yang menjawab **kapan, berapa, dan bagaimana** produk dikonsumsi. "Padahal" muncul dua kali berturut-turut karena diwajibkan prompt.

### P2. Keyword editorial: pertanyaan keyword tidak dijawab
- `opc_261112_48bvpb` dengan keyword **"harga bubble foil per roll"**: naskahnya tidak menyebut harga, kisaran, maupun cara menghitung. Isinya hanya "harga ditentukan kerapatan dan ketebalan… membantu perlindungan termal optimal".
- `opc_261114_r03q2l` dengan keyword **"cara agar suara tidak keluar kamar"**: solusinya hanya "dibutuhkan kombinasi material insulasi yang tepat". Tidak ada langkah: menutup celah pintu, bagian dinding mana yang dilapisi, atau ketebalan materialnya.
- `opc_261112_jvir7o` dengan keyword **"perbedaan gema dan gaung"**: perbedaannya tidak pernah dijelaskan, dan naskah ditutup dengan pertanyaan.

Penonton yang datang dari pencarian langsung pergi karena jawabannya tidak ada. Ini merugikan retensi dan SEO.

### P3. Formula penanda wacana memakan durasi
Hampir semua naskah Ruang Akustik dan Solusi Thermal berpola "Hook / Padahal… / Nah… / Hasilnya…, komen di bawah ya!". Dengan 4 klip, hook dan eskalasi emosi memakan 2 klip, dan penutup memakan 1 klip, sehingga **hanya 1 klip (±18 kata) yang berisi solusi**.

### P4. Multiplier: takaran dan langkah sumber hilang
| Video | Sumber viral | Hasil remake |
|---|---|---|
| Siasat `mul_261114_dvz288` (kulit) | "satu sendok **pati jagung**… madu… minyak zaitun… aduk sampai seperti krim" | "Campurkan **bahan pilihan** dengan madu murni serta minyak zaitun…" (bahan utama hilang) |
| Dapur Botani `mul_261113_lu12u7` | "rendam **semalaman**… rebus hingga **menyusut setengah**… saring" | "Seduh dengan air hangat setiap pagi" (2 langkah kunci hilang) |
| Dapur Botani `mul_261114_oo2q9u` | chia, susu, pisang, madu, "dinginkan beberapa jam" | "madu murni **secukupnya**… dinginkan **sebentar**" |

Penyebabnya adalah batas 3 klip × 17–19 kata dengan hook dan outro wajib, sehingga isi resep hanya mendapat ±25 kata.

### P5. Multiplier: klaim medis lolos, audit tidak terpakai
Naskah yang **dibacakan TTS** (`narration_transcript`) masih memuat "rontokkan lemak visceral", "bilas racun ginjal", "melarutkan sisa polusi di paru-paru", "stabilkan gula darah", dan "mendetoks racun tubuh". Siasat `0jbsl8` bahkan menyelipkan "Nutrifarm Sari Lemon Murni… cek link di bio" di mode tanpa produk.

Ada dua bug terkait yang ditemukan:
- `lib/re-multiplier-worker.js` sekitar baris 610–620: hasil audit kepatuhan disimpan ke field `voice_over`, tetapi TTS membaca `narration_transcript` (baris 904) dan `selected_vo_version` tetap `original`. Akibatnya **audit tidak berpengaruh ke suara**.
- `revised_script[idx]` dipetakan per indeks, tetapi audit juga menerima teks caption. Field `voice_over` di 3 task berisi teks caption beremoji ("✨ RAHASIA KULIT GLOWING…", "• 1 buah Bit merah…"). Jika suatu saat versi audit dipilih, TTS akan membacakan emoji dan bullet.

### P6. Resep pilar: klip pengisi
Nutriblend (15 klip) memuat langkah seperti "Siapkan gelas tinggi bening yang sudah bersih dan kering", "Tancapkan sedotan kaca bening…", dan "Lihat gradasi warna cantik…". Jumlah klip dikunci, sehingga langkah dipecah dan diisi kalimat kosong. Sebaliknya, Habitfolk ("Air fry until golden") dan Siasat ("rebus hingga harum") justru tidak menyebut suhu atau waktu yang menjadi inti tips air fryer.

## 4. Akar masalah di prompt builder

| Lokasi | Masalah |
|---|---|
| `lib/content-planner-engine.js` sekitar 663–760 (Call 1 Skeleton) | Output tidak punya field isi. W's Matrix mendorong "How Feeling" sehingga konteksnya emosional, tidak instruktif. `evidence` jarang terisi. |
| `lib/content-planner-engine.js` sekitar 797–880 (Call 2 Creative) | Hanya menghasilkan `hook` 8–11 kata dan `visual_action`. Tidak ada janji isi yang harus ditepati VO. |
| `lib/prompts.js` `buildOrganicPillarPrompt` sekitar 2903–2955 | Kewajiban "Klip 2 diawali Padahal/Masalahnya, Klip solusi diawali Nah/Di titik inilah, penutup Hasilnya/Makanya". Mode Storytelling: "melukiskan suasana… penutup hangat reflektif". Tidak ada aturan kekonkretan. |
| `lib/prompts.js` `buildOrganicPillarPrompt` (keseluruhan) | Sebagian besar prompt adalah aturan visual (faceless, kinetics, anatomy lock). Aturan isi VO hanya beberapa baris, sehingga Gemini memprioritaskan bentuk. |
| `lib/prompts.js` `buildMultiplierPhase2Prompt` sekitar 3687–3705 | Mode Storytelling: "fokus pada keindahan proses… ketenangan pikiran". Tidak ada kunci bahan, takaran, atau langkah dari storyboard sumber. |
| `lib/re-multiplier-worker.js` 600–640, 904 | Audit tidak dipakai TTS, dan pemetaan `revised_script` tercampur caption (P5). |
| Tidak ada | Validator pasca-generasi untuk kekonkretan dan kata samar. Validator klaim herbal (`isHerbalMedicalClaimPhrase`) memang dipakai di audit TikTok, tetapi hasil audit tidak sampai ke TTS multiplier (P5) dan tidak dijalankan pada VO pilar. |

## 5. Usulan perbaikan (urut prioritas)

### U1. "Payload-first": planner wajib menghasilkan isi
Tambahkan field baru per baris di Call 1 (Skeleton) planner:

```json
"takeaways": [
  {"point": "Tutup celah bawah pintu dulu", "anchor": "celah 1 cm bisa meloloskan suara lebih banyak dari dinding tipis", "anchor_type": "fakta|angka|langkah|kriteria|kesalahan"},
  {"point": "...", "anchor": "...", "anchor_type": "..."}
],
"search_answer": "Jawaban 1 kalimat untuk keyword (wajib untuk Keyword Editorial)"
```

Aturannya:
- Buat 2–4 poin per video, dan setiap poin wajib punya **pegangan** (`anchor`) berupa salah satu dari: angka atau takaran, durasi atau frekuensi, urutan langkah, kriteria memilih, lokasi pemasangan, atau kesalahan umum beserta koreksinya.
- Sumber pegangan: KB brand, data produk (spesifikasi, cara pakai, label), research brief, atau resep. **Jika tidak ada data angka, pakai pegangan non-angka** (urutan, kriteria, kesalahan). Angka tidak boleh dikarang.
- Untuk Keyword Editorial, `search_answer` wajib menjawab langsung niat pencarian (harga → kisaran dari data produk atau cara menghitung; "cara…" → langkah pertama; "perbedaan…" → definisi kontras).
- Simpan di `content_planner_rows` dan teruskan ke `row_creative_payload`, seperti field lain.

### U2. Struktur VO baru: satu klip = satu poin
Di `buildOrganicPillarPrompt`, ganti blok "CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE" dengan struktur berikut:

| Klip | Isi |
|---|---|
| 1 | Hook. Untuk keyword, hook adalah pertanyaan pencarian itu sendiri atau janji jawaban ("3 cara…", "Harga bubble foil ditentukan 2 hal…") |
| 2 … N-1 | **Satu `takeaway` per klip**, dibaca beserta pegangannya. Klip 2 menyampaikan `search_answer` untuk keyword |
| N | Ringkasan 1 kalimat (poin terpenting) + CTA |

- Penanda wacana ("Padahal", "Nah", "Hasilnya") tidak lagi wajib. Batasi **maksimal 1 per naskah** dan larang kata pembuka yang sama di dua klip berturut-turut.
- Eskalasi masalah cukup **satu kalimat di dalam klip 1** (hook + masalah), bukan satu klip penuh.
- Jika jumlah poin kurang dari jumlah klip, klip sisa dipakai untuk **contoh penerapan**, bukan untuk kalimat suasana.

### U3. Narrative Mode yang sesuai isi
- Tambahkan mode **"Tips/Tutorial"** dan jadikan default untuk Keyword Editorial, `strategic_angle` jenis *Life Hack / Math Whiz / Problem You Didn't Know*, dan pilar bertema cara/tips/trik/harga/perbedaan.
- Batasi **Storytelling** untuk konten suasana brand (contoh Sasyahouse "Life at SasyaHouse"). Instruksinya diganti dari "melukiskan suasana" menjadi "cerita konkret dengan detail yang bisa ditiru (jam, tempat, benda, kebiasaan)".
- Pemetaan otomatis bisa dilakukan di planner (dari angle dan keyword), tetap bisa di-override di preset.

### U4. Kata samar wajib diikuti bukti
Masukkan ke prompt sebagai aturan, lalu cek di validator:
- Daftar awal: *efektif, maksimal, optimal, tepat, sempurna, berkualitas, pilihan, terbaik, alami, kebugaran, nyaman, praktis, secukupnya, sebentar, beberapa*.
- Aturannya: kata-kata ini boleh dipakai **hanya jika** di kalimat yang sama ada pegangan (angka, cara, atau kriteria). Contoh: "efektif" → "menyerap gema di titik pantul pertama, yaitu dinding sejajar speaker"; "secukupnya" → "1 sdm".

### U5. Produk herbal: konkret tanpa klaim
Kepatuhan tetap berlaku. Ganti dorongan "sebutkan manfaat" menjadi **"sebutkan cara pakai"**. Isi yang aman dan konkret:
- kapan dikonsumsi (pagi sebelum sarapan / sore), berapa banyak **sesuai label**, dicampur dengan apa (air hangat, bukan mendidih, jika ada di data produk), cara penyimpanan, rasa dan tekstur, serta kebiasaan pendamping (jalan kaki 10 menit, kurangi santan malam hari) sebagai **tips gaya hidup umum**, bukan klaim produk.
- Field data produk yang dibutuhkan: `cara_pakai`, `takaran_label`, `penyimpanan`, `rasa_tekstur`. Jika kosong, planner menandai baris itu "butuh data" alih-alih mengarang.

### U6. Multiplier: kunci bahan dan langkah sumber
Di `buildMultiplierPhase2Prompt`:
1. Sebelum menulis VO, minta Gemini menyusun `source_recipe_lock` dari storyboard sumber: daftar bahan, takaran, dan langkah (rendam/rebus/diamkan + durasi). Remake **wajib menyebut semua bahan inti dan setiap durasi atau takaran yang ada di sumber**. Kata pengganti seperti "bahan pilihan" dilarang.
2. Jika isi tidak muat, ada dua pilihan (dipilih di preset):
   - **a.** Tambah klip otomatis (3 → 4–5) saat sumber punya lebih dari 3 langkah, atau naikkan `words_per_clip` resep menjadi 22–26 kata.
   - **b.** Pindahkan takaran ke layer teks finishing (`tips` / chip bahan). VO menyebut bahan dan langkah, layar menampilkan angka. Pilihan ini memanfaatkan Fase 2c yang sudah ada.
3. Mode tanpa produk: larang menyebut merek apa pun di VO.

### U7. Multiplier: perbaiki jalur kepatuhan (bug)
1. Jalankan pemeriksa klaim herbal (`isHerbalMedicalClaimPhrase` + daftar lemak visceral, racun, detoks, ginjal, paru-paru, gula darah, kanker, dan sejenisnya) pada **`narration_transcript` sebelum TTS**. Jika kena, regenerate klip itu atau pakai versi audit.
2. Audit hanya dijalankan atas VO (tanpa caption), dan hasilnya dipetakan per scene dengan validasi jumlah. Teks yang memuat emoji atau bullet ditolak sebagai VO.
3. Jika `verdict` = `revise`, TTS memakai versi yang sudah direvisi (atau task masuk antrean review), bukan `original`.

### U8. Resep pilar: jumlah klip mengikuti langkah nyata
- Larang klip pengisi (menyiapkan gelas kosong, menancapkan sedotan, "lihat cantiknya"). Langkah kecil digabung.
- Setiap langkah masak wajib punya **parameter**: suhu/api, waktu, takaran, atau tanda selesai yang bisa dilihat ("sampai pinggiran kecokelatan"). Untuk Habitfolk: "air fry at 400°F for 12 minutes, flip at 6" alih-alih "until golden".

### U9. Validator pasca-generasi (server)
Buat modul baru, misalnya `lib/vo-quality-validator.js`, yang dipanggil setelah JSON VO diterima (pilar dan multiplier):
- **Skor kekonkretan**: persentase klip isi yang punya pegangan (angka/takaran/durasi/urutan/kriteria). Target ≥ 60%.
- **Kata samar** tanpa pegangan: maksimal 2 per naskah.
- **Penanda formula**: maksimal 1, tanpa pembuka yang sama berurutan.
- **Keyword**: `search_answer` muncul di klip 2 (cocok kata kunci).
- **Multiplier**: semua bahan dari `source_recipe_lock` muncul.
- **Klaim**: nol frasa terlarang.

Jika gagal, lakukan **satu kali regenerate terarah** (kirim daftar pelanggaran ke Gemini). Jika masih gagal, simpan dengan status `review` dan jangan auto-publish. Catat skor di `result_json` agar bisa dipantau per brand.

### U10. Cara mengukur
- Rubrik 0–2 untuk 5 kriteria (jawaban keyword, poin konkret, tanpa kata samar, alur tidak berulang, kepatuhan): dinilai otomatis oleh validator, lalu spot-check manual 10 naskah per brand.
- A/B 2 minggu: 5 video lama vs 5 video baru per brand, dengan metrik retensi rata-rata, tonton sampai akhir, simpan, dan komentar.

## 6. Contoh sebelum → sesudah

Angka di contoh "sesudah" bertanda `[data]` wajib diambil dari KB atau data produk. Contoh ini menunjukkan **bentuk**, bukan fakta final.

**Ruang Akustik ID — "cara agar suara tidak keluar kamar"** (4 klip)

| | Sebelum | Sesudah |
|---|---|---|
| 1 | Susah tidur malam karena suara bising tembus dinding kamar | Suara kamar bocor ke luar? Cek tiga titik ini, urut dari yang paling murah. |
| 2 | Padahal, kebocoran suara seperti ini biasanya terjadi karena massa dinding yang kurang padat. | Pertama, celah bawah pintu. Pasang door seal karet; celah kecil saja meloloskan suara lebih banyak dari dinding. |
| 3 | Nah, untuk mengatasinya dibutuhkan kombinasi material insulasi yang tepat guna meredam getaran. | Kedua, dinding yang berbagi sisi dengan kamar lain. Lapisi rangka dengan Rockwool [data: densitas/ketebalan], lalu tutup gypsum. |
| 4 | Hasilnya, kamar tidur jadi jauh lebih tenang dan nyaman untuk beristirahat, komen di bawah ya! | Ketiga, jendela: ganti kaca tipis atau tambah lapisan kedua. Mulai dari pintu dulu. Kamarmu bocor di titik mana? Komen di bawah ya! |

**Solusi Thermal ID — "harga bubble foil per roll"**

| | Sebelum | Sesudah |
|---|---|---|
| 1 | Bingung harga bubble foil per roll? Ada rahasia yang tak terduga! | Harga bubble foil per roll beda jauh? Ini dua hal yang menentukannya. |
| 2 | Padahal, variasi harga… ditentukan oleh kerapatan lapisan dan ketebalan materialnya. | Satu roll umumnya [data: ukuran, mis. 1,25 × 40 m], kisaran [data: harga terendah–tertinggi]. Yang membedakan: satu atau dua sisi foil, dan ketebalan bubble. |
| 3 | Nah, memahami perbedaan spesifikasi ini membantu bangunan mendapatkan perlindungan termal yang optimal. | Cara hitung kebutuhan: luas atap dibagi luas satu roll, tambah 10% untuk sambungan [data]. |
| 4 | Bagaimana pengalaman dalam memilih insulasi…? komen di bawah ya! | Atap seng langsung panas? Pilih dua sisi foil. Sebutkan luas atapmu di komen, kami bantu hitung. |

**Dapur Botani — Garlibee (produk herbal, tanpa klaim)**

| | Sebelum | Sesudah |
|---|---|---|
| 1 | Menjaga kesehatan jantung keluarga dimulai dari kebiasaan kecil setiap pagi. | Biar kebiasaan pagi nggak putus di hari ketiga, ini cara paling gampang. |
| 2 | Padahal rutinitas padat sering membuat niat sehat ini kerap tertunda. | Taruh toples GarliBee di samping gelas minummu, bukan di lemari. Yang terlihat, lebih gampang diingat. |
| 3 | Padahal tubuh memerlukan dukungan harian yang praktis dan konsisten. | Ambil [data: takaran label], langsung atau dicampur air hangat, bukan mendidih [data: cara pakai]. |
| 4 | Di sinilah pentingnya memilih asupan alami yang mudah diserap tubuh. | Rasanya manis madu dengan aroma bawang yang lembut [data: rasa], jadi nggak perlu ditahan napas. |
| 5–6 | GarliBee memadukan… / Mulai langkah sehatmu… | Simpan di suhu ruang, tutup rapat [data: penyimpanan]. Mulai besok pagi, link-nya di bio ya! |

**Siasat Sehat multiplier — kulit (resep sumber dipertahankan)**

| | Sebelum | Sesudah |
|---|---|---|
| 1 | Bongkar rahasia kulit cerah natural tanpa skincare mahal yang bikin boncos kantong! | Masker dapur tiga bahan, tanpa beli skincare mahal. |
| 2 | Campurkan **bahan pilihan** dengan madu murni serta minyak zaitun berkualitas tinggi secara perlahan. | Satu sendok makan pati jagung, satu sendok teh madu, setengah sendok teh minyak zaitun, aduk sampai seperti krim. |
| 3 | Balurkan merata ke seluruh wajah… | Oles tipis, diamkan 10–15 menit [cek sumber/KB], bilas air hangat. Tes dulu di belakang telinga. Mau resep lainnya? Follow & komen mau ya! |

## 7. Urutan pengerjaan yang disarankan

| Tahap | Isi | Dampak | Perkiraan |
|---|---|---|---|
| T1 | U7 (bug audit multiplier + filter klaim VO) | Risiko kepatuhan, langsung | kecil |
| T2 | U2 + U3 + U4 di `buildOrganicPillarPrompt` (struktur, mode, kata samar) | Naskah pilar langsung lebih konkret | kecil–sedang |
| T3 | U1 di planner (`takeaways`, `search_answer`) + penerusan ke payload | Sumber isi; dampak terbesar | sedang |
| T4 | U6 + U8 (kunci resep multiplier, parameter langkah) | Resep bisa dipraktikkan | sedang |
| T5 | U9 validator + U10 pengukuran | Mencegah kemunduran, bisa dipantau | sedang |
| T6 | U5 field data produk (cara pakai, takaran label, penyimpanan) | Isi produk herbal | kecil (data) |

Sebelum mengubah prompt produksi, sebaiknya uji dulu: jalankan prompt baru untuk 2–3 baris planner nyata per brand di jalur dev, lalu bandingkan berdampingan dengan naskah lama memakai validator U9.

**Update 14 Nov:** uji A/B sudah dilakukan untuk 6 kasus nyata. Hasil dan temuan tambahannya ada di [plans/vo-narasi-reference/HASIL_UJI_PROMPT_VO.md](plans/vo-narasi-reference/HASIL_UJI_PROMPT_VO.md): validator wajib, filter klaim di hook planner, `clip_plan` untuk format panjang, field `cara_pakai`/`fakta_produksi`, dan pengecekan model Gemini per tenant.
