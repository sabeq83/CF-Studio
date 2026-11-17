# Usulan: Visual Identity Multi-Latar untuk Solusi Thermal ID & Ruang Akustik ID

> Tanggal: 17 November 2026 · Tenant: PT GIM Sosmed (`tnt_pt-gim-sosmed_62d0d9`) · Status: **usulan, belum diterapkan**
> Dasar: Katalog Produk PT Global Isolasi Mandiri 2024 (17 halaman), VI aktif kedua brand (versi 3), pola VI DapurBotani v3.

## 1. Masalah sekarang

Kedua VI masih **mengunci satu latar** untuk semua video:

| Brand | Latar terkunci sekarang | Akibatnya |
|---|---|---|
| Solusi Thermal (Reno) | Gudang/pabrik beratap seng + diagram potongan atap | Semua video terasa "atap lagi". Padahal katalog juga berisi produk untuk pipa, tangki, boiler, tungku, AC dan ducting yang tidak pernah muncul. |
| Ruang Akustik (Maya) | Ruang meeting mewah + studio premium, cahaya temaram | Terlihat jauh dari masalah sehari-hari penonton, seperti kamar kos, tetangga berisik, atau karaoke rumah. |

## 2. Pola yang kita tiru dari DapurBotani v3

DapurBotani v3 memakai **"lokasi mengikuti cerita"** (`environment.policy = planner_driven`):
- Identitas karakter, pakaian, palet warna dan gaya kamera **tetap terkunci**, sehingga brand tetap dikenali.
- **Latar dipilih per klip sesuai babak cerita.** Klip 1 (hook) berlatar tempat masalah terjadi, klip tengah tempat proses/solusi, dan klip akhir tempat hasilnya dirasakan.
- Ada **latar cadangan** (`fallback_location`) yang dipakai jika cerita tidak menyebut tempat.
- Cahaya menyesuaikan waktu dalam cerita, tetapi tetap terang dan tidak suram.
- Perbaikan lokasi per klip untuk Multiplier sudah rilis di **v2.48.24**.

Usulannya: Reno dan Maya tetap sama, hanya latarnya yang ikut cerita.

## 3. Peta Latar — Solusi Thermal ID (Reno)

Disusun dari produk di katalog:

| # | Kelompok latar | Contoh tempat (hook → solusi → hasil) | Produk katalog | Target |
|---|---|---|---|---|
| T1 | **Atap rumah & ruko** | Kamar lantai atas panas siang hari → potongan atap dipasang foil → keluarga santai di kamar sejuk | Glasswool Foil, Aluminium Bubble Foil, Aluminium Foil Thermal, Greenwool Hilon | Rumah tangga (jangkauan terluas) |
| T2 | **Atap gudang & pabrik** *(yang ada sekarang)* | Pekerja gerah di bawah atap seng → roofmesh + glasswool dipasang → gudang adem | Glasswool Blanket/Foil, Roofmesh, Spindle Pin | Pemilik gudang/pabrik |
| T3 | **Kandang ternak** | Ayam lemas kepanasan → atap kandang dilapisi bubble foil → kandang lebih adem | Aluminium Bubble Foil, Foil Thermal | Peternak |
| T4 | **Pipa AC & ducting** | AC menetes/berembun di plafon, AC kurang dingin → pipa dibungkus isolasi → ruangan dingin, plafon kering | Glasswool Pipe, Flexible Duct, Insulflex, Insulation Tape | Rumah, kantor, kontraktor AC |
| T5 | **Pipa uap & pipa panas industri** | Pipa panas telanjang, risiko tangan pekerja tersengat panas, energi terbuang → Rockwool Pipe + cladding logam → pipa rapi dan aman disentuh | Rockwool Pipe (90–120 kg/m³, hingga 650°C), Glass Cloth | Pabrik (lead B2B bernilai besar) |
| T6 | **Tangki panas, boiler & burner** | Dinding tangki memancarkan panas → mineral wool + lembaran logam → suhu proses stabil | Mineral Wool / Rockwool Wire Blanket | Pabrik makanan, kimia, tekstil |
| T7 | **Tungku & oven suhu sangat tinggi** | Tungku peleburan memerah → lapisan ceramic fiber + bata api/castable → panas tertahan di dalam | Ceramic Fiber Blanket/Board/Paper (1260–1430°C), Bata Api, Castable | Pengecoran logam, keramik, industri berat |

**Porsi usulan per minggu:** sekitar 50% T1–T3 untuk jangkauan, 30% T4 karena masalahnya sering dialami, dan 20% T5–T7 untuk lead B2B.

## 4. Peta Latar — Ruang Akustik ID (Maya)

| # | Kelompok latar | Contoh tempat (hook → solusi → hasil) | Produk katalog | Target |
|---|---|---|---|---|
| A1 | **Kamar tidur & kamar kos** | Suara tetangga/jalan tembus dinding malam hari → dinding partisi diisi rockwool → tidur tenang | Rockwool/Mineralwool Slab, Glasswool Slab | Rumah tangga, anak kos (jangkauan terluas) |
| A2 | **Studio musik & drum rumahan** | Tetangga protes suara drum → dinding dan pintu diberi sistem peredam → latihan tanpa komplain | Rockwool Slab (mengurangi flanking), Glasswool Board | Musisi, band |
| A3 | **Studio podcast & home theater** | Suara rekaman bergema → dinding dipasangi busa telur/piramid → rekaman jernih | Busa Telur, Busa Piramid, Busa Wedge | Kreator konten |
| A4 | **Room karaoke & kafe** | Pengunjung di sebelah terganggu → peredam dinding + busa → bisnis aman | Rockwool, Busa Peredam | Pemilik usaha |
| A5 | **Kantor & ruang meeting** *(dekat dengan yang sekarang)* | Obrolan bocor antar-ruang → partisi glasswool → rapat privat | Glasswool Slab (partisi dinding) | Kantor |
| A6 | **Plafon akustik komersial** | Restoran/minimarket/lobi riuh bergema → plafon gypsum akustik berlubang → ruang nyaman dan tetap elegan | Gypsum Akustik (Sounerbel R8/R1, Jayaboard Sopran) | Restoran, minimarket, lobi |
| A7 | **Masjid, aula & sekolah** | Ceramah/pelajaran bergema dan tidak jelas → panel penyerap gema → suara jernih | Gypsum Akustik, Panel/Busa | DKM, sekolah |
| A8 | **Mesin, genset & AC berisik** | Dengung mesin/ducting AC mengganggu → flexible duct dan peredam → lebih senyap | Flexible Duct, Rockwool | Pabrik, gedung |

**Porsi usulan per minggu:** sekitar 60% A1–A3, 25% A4/A5/A7, dan 15% A6/A8.

## 5. Perubahan konfigurasi VI (untuk eksekutor)

> ⚠️ **Baca bagian 7 dulu.** Mesin Editorial belum mendukung lokasi per klip untuk karakter 3D. Konfigurasi `planner_driven` di bawah ini baru berlaku **setelah perubahan kode**. Untuk sekarang, pakai cara "beberapa VI per kelompok latar" di bagian 7.

Ubah lewat menu Visual Identity atau `cf_update_visual_identity`. Buat **versi baru** dan jangan timpa versi 3, supaya bisa kembali jika hasilnya jelek.

### 5a. Solusi Thermal (Reno)

**Code Sebelum (Current/Before):**
```json
"environment": {
  "preset_key": "custom",
  "custom_description": "modern factory warehouse with corrugated metal roof, cross-section roof insulation diagram, bright warm sunbeams contrasting with cool blue conditioned interior",
  "props": ["infrared thermal tablet", "digital temperature display", "3D cutaway roof model"],
  "background_density": "balanced"
},
"metaphor_engine": { "enabled": true, "pattern": "concept_to_object_to_action" }
```

**Code Sesudah (Proposed/After):**
```json
"environment": {
  "preset_key": "custom",
  "policy": "planner_driven",
  "custom_description": "Fallback only: modern warehouse with corrugated metal roof when planner specifies no place",
  "fallback_location": "Modern Indonesian warehouse interior with corrugated metal roof",
  "props": ["infrared thermal tablet scanner", "digital temperature display"],
  "background_density": "balanced"
},
"metaphor_engine": {
  "enabled": true, "mode": "hook_only",
  "pattern": "concept_to_object_to_action",
  "environment_policy": "planner_driven"
},
"signature_accents": [
  "warm solar-orange heat glow on the hot side vs cool azure glow on the insulated side",
  "infrared thermal scanner showing temperature drop"
]
```
- **Yang tetap:** wajah Reno, helm biru, jumpsuit navy-oranye, kacamata, gaya 3D, kamera, larangan orang tambahan.
- **Ciri khas yang dibawa ke semua latar:** kontras **oranye panas vs biru sejuk**. Sebelumnya ini terikat ke atap, sekarang dipakai untuk pipa, tangki, AC, dan latar lain.
- **Cahaya:** ikuti waktu dalam cerita, tetap terang.

### 5b. Ruang Akustik (Maya)

**Code Sebelum (Current/Before):**
```json
"environment": {
  "custom_description": "luxury modern conference room and acoustic studio with dark 3D geometric acoustic wall panels, vertical walnut wood slats, and peaceful ambient evening lighting"
},
"lighting": { "contrast": "soft", "custom_description": "warm ambient interior architectural lighting with subtle neon electric cyan accents..." },
"mode_routing": { "mechanism": "symbolic_surrealism" },
"style": { "custom_description": "... quiet luxury aesthetic lighting" }
```

**Code Sesudah (Proposed/After):**
```json
"environment": {
  "policy": "planner_driven",
  "custom_description": "Fallback only: modern home studio room with acoustic wall panels when planner specifies no place",
  "fallback_location": "Bright modern Indonesian home studio room with acoustic foam panels"
},
"lighting": {
  "contrast": "medium",
  "custom_description": "Bright clean interior light adapting to the scene's time of day, never dark or gloomy, with electric cyan accents on sound waves"
},
"mode_routing": { "mechanism": "isometric_society" },
"style": { "custom_description": "Pixar and DreamWorks style elegant 3D animation, charming expressive female character, bright friendly educational lighting" },
"metaphor_engine": { "enabled": true, "mode": "hook_only", "environment_policy": "planner_driven" },
"signature_accents": [
  "visible sound waves: chaotic red-orange waves leaking through walls become calm cyan waves after treatment",
  "digital decibel meter showing the dB drop"
]
```
- **Yang tetap:** wajah Maya, rambut bob, blazer navy dengan aksen cyan, headphone.
- **Yang berubah:** suasana "quiet luxury" yang temaram diganti terang dan akrab. Penjelasan cara kerja tidak lagi simbolis/surealis, tetapi memakai diagram potongan dinding seperti Thermal.
- **Ciri khas yang dibawa ke semua latar:** **suara dibuat terlihat**. Gelombang merah yang bocor berubah jadi gelombang cyan yang tenang, ditambah angka desibel yang turun. Ini padanan "oranye vs biru" milik Reno.

## 6. Agar latar benar-benar bergilir

VI hanya **mengizinkan** latar berganti. Yang **memilih** latarnya adalah cerita: Content Planner Scene Brief, atau hook pada Multiplier. Karena itu:
1. **Brand Profile:** tambahkan Peta Latar (bagian 3 & 4) ke `editorial_brand_context`, dan perbarui daftar produk sesuai katalog. Sekarang Thermal hanya menyebut 5 produk, padahal belum ada Rockwool Pipe, Ceramic Fiber, Greenwool, Flexible Duct, dan Insulflex. Ruang Akustik belum menyebut Gypsum Akustik dan Busa Wedge.
2. **Pilar konten:** tambahkan pilar baru, misalnya Thermal "Isolasi Pipa, AC & Industri" dan Akustik "Plafon & Ruang Publik".
3. **Hook menyebut tempat dengan jelas**, misalnya *"AC di kamar netes terus?"* atau *"Jam 11 malam, suara tetangga tembus dinding…"*. Dari uji DapurBotani, lokasi baru berganti jika hook menyebut tempatnya.
4. **Jalur CFA / preset:** pastikan rotasi topik per minggu mengikuti porsi di bagian 3 & 4.

## 7. Hasil cek mesin (17 Nov 2026) — PENTING, mengubah cara penerapan

**Mesin yang dipakai:** Auto Pipeline → **Editorial Campaign** (`editorial_campaign`), preset `solusi_thermal_id` dan `ruang_akustik_id`. Setiap jadwal berisi satu kata kunci, dan VI dipilih per jadwal lewat `pipeline_config.visual_identity_preset_id`.

**Masalah:** untuk karakter 3D (Reno/Maya), fitur "lokasi ikut cerita" (Scene Director) **sengaja dimatikan oleh kode**:
- `lib/prompts.js:1944`: `isSceneDirectorActive = !isStylizedCharacter && ...`, artinya untuk karakter 3D nilainya selalu mati.
- `lib/prompts.js:2295–2297`: lokasi diambil dari `environment.custom_description` milik VI, lalu `lib/prompts.js:2348/2354` menempelkannya apa adanya ke `(Environment: …)` di **setiap klip**.
- Akibatnya, jika VI diubah ke `planner_driven` dengan teks "Fallback only: …", teks itu akan **ikut tertempel mentah** ke semua klip. Ini kasus yang sama dengan DapurBotani "selalu di meja kayu". **Jangan terapkan bagian 5 apa adanya.**

### Cara yang bisa langsung jalan TANPA ubah kode (direkomendasikan sekarang)
Buat **beberapa VI per kelompok latar** dengan karakter yang sama persis. Yang diubah hanya `environment`, `props`, dan `lighting`. Lalu pilih VI yang cocok di setiap jadwal sesuai kata kuncinya.

| VI baru | Dipakai untuk kata kunci | Kelompok latar |
|---|---|---|
| Reno – Atap Rumah | insulasi atap rumah, atap seng panas | T1 |
| Reno – Gudang & Pabrik *(VI v3 sekarang)* | peredam panas gudang/pabrik | T2 |
| Reno – Kandang | atap kandang ayam panas | T3 |
| Reno – AC & Ducting | pipa AC netes, isolasi pipa AC | T4 |
| Reno – Pipa & Boiler Industri | isolasi pipa uap, rockwool pipe, boiler | T5–T6 |
| Reno – Tungku | ceramic fiber, tungku peleburan | T7 |
| Maya – Kamar & Kos | suara tetangga, kamar kedap suara | A1 |
| Maya – Studio Rumahan | studio drum/podcast, busa telur | A2–A3 |
| Maya – Kafe/Karaoke/Kantor | ruang karaoke, partisi kantor | A4–A5 |
| Maya – Plafon & Ruang Publik | gypsum akustik, gema masjid/restoran | A6–A7 |

Kekurangannya: dalam satu video lokasinya tetap satu, belum berganti dari hook ke hasil. Tetapi antar-video latarnya sudah bervariasi, dan itu yang paling dibutuhkan sekarang.

### Cara lengkap (perlu ubah kode — tugas Antigravity, nanti)
Izinkan karakter 3D memakai lokasi per klip saat VI `environment.policy = planner_driven`, dengan pola yang sama seperti perbaikan Multiplier v2.48.24 (`lib/prompts.js:3978–3985`). Model memilih lokasi per babak cerita dan mencatat `location_en` per adegan, bukan menempel teks VI apa adanya. Setelah itu baru bagian 5 bisa diterapkan.

### Temuan lain saat cek
- **Ruang Akustik tidak punya jadwal aktif lagi.** Ke-21 jadwal "Week 1" (11–17 Nov) berstatus selesai. Solusi Thermal tinggal 2 jadwal aktif. Jika jadwal Week 2 tidak dibuat, produksi kedua brand berhenti setelah hari ini.
- **Kata kunci Week 1 Thermal semuanya tentang atap/glasswool/bubble foil.** Tidak ada kata kunci pipa, AC, boiler, atau tungku. Diversifikasi latar harus dimulai dari **daftar kata kunci Week 2**.
- **Preset `ruang_akustik_id` menyimpan sisa pengaturan yang bertentangan** di `visual_swap`: `subject_demographic: syari_classic`, `wardrobe_style: amber_terracotta`, `visual_style_preset: 3d_claymation_cozy`, `character_concept: faceless`. VI Maya kemungkinan menimpanya, tetapi ini **belum diverifikasi**. Sebaiknya dirapikan agar tidak bocor ke prompt.
- Untuk adegan pabrik/pipa/tungku, pastikan guardrail "tidak ada orang tambahan" tidak membuat latar industri terlihat kosong secara tidak wajar. Jika perlu, pekerja latar boleh tampil tanpa wajah (`allowed_faceless`).

## 8. Klaim produk — batasi sesuai katalog

Pakai angka katalog apa adanya dan jangan dilebih-lebihkan, misalnya Rockwool hingga 650°C, Ceramic Fiber 1260–1430°C, emisivitas foil 0,03, pantulan 96–97%. Untuk klaim "busa telur efektif hingga 80%", sebutkan sebagai klaim produsen, bukan janji hasil.

## 9. Cara menilai berhasil

Jalankan 2 minggu, lalu bandingkan **rata-rata views per video** dan jumlah DM/konsultasi dengan 2 minggu sebelumnya, per kelompok latar. Kelompok latar yang paling banyak ditonton porsinya dinaikkan.
