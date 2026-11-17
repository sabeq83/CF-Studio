# Implementation Plan — Week 2 PT GIM lewat Jalur CFA (Solusi Thermal ID & Ruang Akustik ID)

Tanggal: 17 November 2026 · Tenant: PT GIM Sosmed (`tnt_pt-gim-sosmed_62d0d9`)
Dasar: [USULAN_VI_MULTI_LATAR_PTGIM.md](catatan-kerja/usulan/USULAN_VI_MULTI_LATAR_PTGIM.md) dan Katalog PT Global Isolasi Mandiri 2024

> [!IMPORTANT]
> **Status: MENUNGGU PERSETUJUAN.** Belum ada yang diubah di CF Studio, CFA, maupun kode.
> Perubahan data CF Studio (brand profile, VI, preset) dan jalur CFA dilakukan Claude **setelah rencana ini disetujui**. Perubahan kode Editorial Campaign hanya ditulis sebagai instruksi untuk Antigravity.

---

## Tujuan

Week 2 (mulai 18 Nov 2026) kedua brand diproduksi lewat **CF Autopipeline (CFA)**, bukan jadwal Editorial Campaign, agar latar video bervariasi sesuai produk di katalog: atap, AC, pipa industri, tungku, kamar, studio, plafon, dan lainnya.

**Kenapa CFA bisa bervariasi:** di jalur **edukasi**, Claude menulis prompt gambar setiap klip sendiri (`direct_passthrough`) ditambah blok gaya brand. Latar dipilih per video dari daftar `lokasi` jalur. Mesin Editorial mengunci satu latar untuk karakter 3D (`lib/prompts.js:1944`), sedangkan CFA tidak melewati kunci itu.

## Fakta hasil pengecekan (17 Nov)

| Hal | Kondisi | Dampak ke rencana |
|---|---|---|
| Lingkungan CF Studio yang dipakai | MCP laptop → `100.95.245.55:5010`, CFA Mac Mini → `127.0.0.1:5010`. **Keduanya Staging.** | Semua perubahan Tahap 1–3 ada di Staging, tempat yang sama dengan produksi konten. Perbaikan Antigravity cukup sampai deploy Staging. |
| CFA aktif | Berjalan di **Mac Mini** (`masbenu@100.95.245.55:~/cf-autopipeline`). Salinan di laptop hanya untuk pengembangan dan helper-nya gagal membaca kredensial. | Semua perintah jalur dijalankan lewat SSH ke Mac Mini. |
| Brand PT GIM di CFA | Belum terdaftar (baru `habitfolk`, `nutribake`, `dapurbotani`). | Perlu `tambah-brand` untuk 2 brand. |
| Kapasitas CFA | `maks_video_per_hari = 8`. Jalur aktif sudah 8 (7 live + 1 draft). | **Penuh.** Perlu keputusan pengguna (K1). |
| Katalog produk PT GIM di CF Studio | **Kosong** (0 produk). | Jalur jenis `produk` (reveal foto produk asli) belum bisa. Mulai dari jalur **edukasi**. |
| Jadwal Editorial | Ruang Akustik 0 aktif, Thermal 2 aktif. Semuanya "Week 1". | Tidak dibuat Week 2 Editorial. |
| Preset `ruang_akustik_id` | Menyimpan sisa pengaturan lama (`syari_classic`, `amber_terracotta`, `3d_claymation_cozy`, `faceless`). | Preset CFA dibuat baru dan bersih. |

---

## Keputusan pengguna (dijawab 17 Nov 2026)

| # | Pertanyaan | Keputusan |
|---|---|---|
| **K1** | Kapasitas CFA penuh (8/8) | Naikkan `maks_video_per_hari` ke **30**. `maks_produksi_per_putaran` (8) dicek ulang agar 14 video/hari tetap terkirim. |
| **K2** | Video per hari per brand | **3/hari/brand** (21/minggu/brand, total 6/hari PT GIM) |
| **K3** | CTA video & caption | **Arahkan ke WhatsApp yang ada di bio**, mis. VO penutup "Konsultasi gratis, klik WA di bio ya!". Caption: "Konsultasi & penawaran: chat WA di bio." Nomor WA tidak ditulis. |
| **K4** | Mode publish | Video uji tidak dipublikasikan. **Langsung `live` setelah uji dinilai lolos.** |
| **K5** | Jadwal CFA | Pengguna yang mengatur sendiri di Mac Mini. Claude tidak menyalakan jadwal. |

---

## Rincian per tahap

### Tahap 1 — Perbaiki Brand Profile (CF Studio, via `cf_update_brand_profile`)

Kolom yang diubah, untuk kedua brand:

| Kolom | Sebelum | Sesudah (ringkas) |
|---|---|---|
| `editorial_brand_context` | Thermal: 5 produk, fokus atap. Akustik: 6 produk, tanpa gypsum. | Daftar produk lengkap sesuai katalog + **Peta Latar** (T1–T7 / A1–A8) + sasaran pembeli per latar |
| `editorial_content_pillars_json` | 7 pilar | 7 pilar lama + Thermal: **"Isolasi Pipa, AC & Industri"**, Akustik: **"Plafon & Ruang Publik"** |
| `visual_signature` | Thermal: "industrial building, hot metal roof" | Ciri karakter + kontras oranye-biru, **tanpa mengunci atap** |
| | Akustik: "dark navy interior… cinematic" | Ciri karakter + gelombang suara merah→cyan, **tanpa mengunci ruang mewah** |
| `presenter_name` / `presenter_role` | kosong | Reno – Thermal Engineer / Maya – Acoustic Architect |
| `brand_color` | kosong | Thermal `#FF6B35`, Akustik `#06B6D4` (warna aksen di VI) |
| `brand_tagline` | kosong | Thermal: "Panas Turun, Nyaman Naik". Akustik: "Tenang Itu Bisa Dirancang" (draf, minta persetujuan) |
| `default_cta_tiktok/facebook/youtube` | kosong | "Konsultasi gratis & penawaran: klik WA di bio ya!" (K3) |
| `brand_location` | kosong | "Sidoarjo, Jawa Timur — melayani pengiriman ke seluruh Indonesia" (dikonfirmasi pengguna, diterapkan 17 Nov) |

**Contoh Code Sebelum (Current/Before)** — Solusi Thermal `visual_signature`:
```text
Photorealistic industrial building, hot metal roof, visible heat waves, thermal insulation layer, scientific cutaway visualization, orange-to-blue temperature contrast, clean technical graphics, cinematic lighting, realistic material texture.
```
**Code Sesudah (Proposed/After):**
```text
Stylized 3D Pixar-style educational animation starring Reno the Thermal Engineer. Signature: solar-orange heat glow on the hot side vs cool azure glow on the insulated side, infrared thermal scanner readings, clean cutaway diagrams. Settings rotate with the story: house roofs, warehouses, livestock barns, AC pipes and ducts, industrial steam pipes, boilers, furnaces.
```

### Tahap 2 — Riset kata kunci

- Riset web (WebSearch) kata kunci bahasa Indonesia yang dicari calon pembeli: pertanyaan masalah, perbandingan, harga, dan "cara". Dipetakan ke kelompok latar.
- **Target:** Thermal ±40 kata kunci (T1–T3 ±50%, T4 ±30%, T5–T7 ±20%). Akustik ±40 kata kunci (A1–A3 ±60%, A4/A5/A7 ±25%, A6/A8 ±15%).
- Kata kunci Week 1 tidak diulang (21 + 20 kata kunci di jadwal Editorial).
- **Keluaran:**
  - `kata_kunci/solusithermal.txt` dan `kata_kunci/ruangakustik.txt` di Mac Mini (satu per baris, baris pertama komentar `#`)
  - Salinan laporan di `catatan-kerja/laporan/RISET_KATA_KUNCI_PTGIM_W2.md` (kata kunci + kelompok latar + alasan)

### Tahap 3 — Preset, VI & Jalur CFA baru

**3a. Preset baru** (`cf_clone_preset` dari preset lama, lalu `cf_update_preset`). Preset lama dibiarkan apa adanya.

| | `solusi_thermal_cfa` | `ruang_akustik_cfa` |
|---|---|---|
| Klip × durasi | 5 × 8 detik (hook → masalah → cara kerja → solusi → CTA) | sama |
| Kata VO per klip | 17–19 (sama dengan sekarang) | sama |
| `mandatory_outro_line` | "Konsultasi gratis, klik WA di bio ya!" | sama |
| `visual_swap` | Bersih: hanya `visual_identity_preset_id` VI baru | Bersih, sisa `syari_classic`/`claymation`/`faceless` **dihapus** |
| `approval_mode` | none | none |

**Code Sebelum (Current/Before)** — `ruang_akustik_id.visual_swap`:
```json
{"is_vso_active":true,"character_concept":"faceless","subject_demographic":"syari_classic","wardrobe_style":"amber_terracotta","lighting_style":"window_daylight","visual_style_preset":"3d_claymation_cozy","visual_identity_preset_id":"ptgim_vi_ruang_akustik_v1_tnt_pt_gim_sosmed_62d0d9"}
```
**Code Sesudah (Proposed/After)** — `ruang_akustik_cfa.visual_swap`:
```json
{"is_vso_active":true,"visual_identity_preset_id":"<VI Maya v4>"}
```

**3b. VI versi 4** (`cf_create_visual_identity`, VI v3 tidak diubah)
- Karakter, pakaian, gaya 3D, dan guardrail **sama persis** dengan v3.
- `environment.custom_description` dinetralkan: "setting follows the scene description".
- Lighting terang (Maya: contrast `soft` → `medium`, buang "quiet luxury"). Mekanisme Maya `symbolic_surrealism` → diagram potongan.
- **Catatan:** pada `direct_passthrough`, peran VI terhadap prompt gambar **perlu dicek di kode** (Tahap 3d). Jika VI tidak dipakai, identitas karakter dijaga lewat `blok_gaya_t2i` (3c).

**3c. Daftar brand & jalur CFA** (di Mac Mini, lewat helper `antrean.py`, status awal `draft`)
- `tambah-brand solusithermal 22341d47-…` dan `tambah-brand ruangakustik d3eae712-…` dengan `--tenant pt-gim-sosmed`.
- `panduan_brand`: nada edukatif-ramah, bahasa sederhana, klaim hanya dari katalog (bagian 8 usulan), tanpa testimoni karangan.
- `blok_gaya_t2i` mengunci identitas karakter di setiap klip:

**Code Sesudah (Proposed/After)** — `blok_gaya_t2i` Solusi Thermal (draf):
```text
Vertical 9:16 portrait composition. Pixar and DreamWorks style charming stylized 3D animation, premium soft-matte render. Exactly one main character: Reno, a friendly young Indonesian male Thermal Engineer with smart glasses, neat hair under an electric blue safety helmet, dark navy technical jumpsuit with bright solar-orange thermo stripes, holding an infrared thermal tablet when relevant. Same face, outfit and proportions in every scene. Signature visual: warm solar-orange heat glow on the hot side versus cool azure glow on the insulated side; clean cutaway diagrams for mechanisms. Bright, readable lighting, never gloomy. No extra main characters, no readable brand logos, no text overlays, no photorealistic humans.
```
(Maya: struktur sama. Rambut bob gelap, blazer navy aksen cyan, headphone studio di leher, gelombang suara merah→cyan, angka desibel.)

- **Jalur** `solusithermal-edukasi` dan `ruangakustik-edukasi`:
  - `jenis: edukasi`, preset & VI baru, `topik` = file Tahap 2
  - `lokasi` = daftar latar dari Peta Latar (dalam bahasa Inggris, contoh di bawah)
  - `sudut_wajib` memuat aturan cerita: hook di tempat masalah terjadi; cara kerja dengan diagram potongan; satu karakter utama Reno/Maya; CTA sesuai K3
  - `video_per_hari = 3` (K2), `publish.jam = sebar`, `publish.mode = draft` selama uji (→ `live` setelah uji lolos, K4)
  - Akun Repliz 4 platform (IG, TikTok, FB, YT) diambil dengan `cari akun`

**Contoh `lokasi` Solusi Thermal:**
```json
["Indonesian house upstairs bedroom under a hot metal roof", "small shophouse (ruko) top floor", "warehouse under corrugated zincalume roof", "chicken farm barn with metal roof", "living room with dripping split AC indoor unit and ceiling", "office ceiling space with AC ducting", "factory steam pipe rack", "industrial boiler room with hot tank", "metal casting furnace area"]
```

**3d. Penyesuaian skill `cfa-penulis`** (file skill pengguna, di laptop **dan** Mac Mini). Perlu persetujuan karena mengubah perilaku semua jalur.

**Code Sebelum (Current/Before)** — `cfa-penulis/SKILL.md`, jalur edukasi:
```text
Semua `scene_t2i` berlangsung di lokasi itu, dengan benda-benda khas lokasi sebagai pencerita (...). Tanpa orang; paling banyak satu tangan di tepi bingkai.
```
**Code Sesudah (Proposed/After):**
```text
Semua `scene_t2i` berlangsung di lokasi itu, dengan benda-benda khas lokasi sebagai pencerita (...). Tanpa orang; paling banyak satu tangan di tepi bingkai — KECUALI bila `blok_gaya_t2i` jalur menetapkan satu karakter utama (mis. Reno/Maya): tampilkan karakter itu sebagai satu-satunya tokoh utama di setiap adegan, tanpa orang lain, dan klip cara kerja boleh berupa diagram potongan bergaya 3D.
```
Juga dicek: apakah `direct_passthrough` di CF Studio memakai VI (identitas karakter) atau hanya prompt dari naskah. Cukup dibaca di kode, tidak diubah.

### Tahap 3e — Kunci wajah Reno & Maya (Character Lock)

**Masalah:** VI Reno/Maya v3 hanya menjaga wajah lewat teks (`subject.universe_profile_id = null`, `character_keys = []`). Setiap klip digambar ulang dari deskripsi, sehingga wajah bisa bergeser.

**Fitur yang sudah ada di CF Studio:** Character Lock (`lib/cartoon-reference-resolver.js:425–450`). Karakter Universe yang punya `identity_reference_path` / `reference_image_path` dikirim sebagai gambar acuan di setiap klip (dipanggil dari `lib/opc-start-frame-request.js`).

Langkah:
1. **Siapkan gambar acuan resmi** untuk Reno dan Maya (lembar karakter: wajah depan + badan penuh, latar polos). Ada dua pilihan:
   - (a) frame terbaik dari video Week 1 yang dipilih pengguna;
   - (b) gambar baru khusus lembar karakter, dibuat dari deskripsi VI.
   Pengguna memilih versi final.
2. **Buat Universe "PT GIM Presenters"** (tipe `fictional`) berisi karakter `reno` dan `maya`, dengan deskripsi visual dari VI dan gambar acuan. Menu Universe **belum ada di MCP**, jadi dilakukan lewat UI `/settings/universes` dengan panduan Claude. Bila UI tidak menyediakan unggah gambar acuan, catat sebagai temuan, karena jalur DB langsung butuh persetujuan terpisah.
3. **Sambungkan ke VI v4** (Tahap 3b):

**Code Sebelum (Current/Before)** — `subject` VI v3:
```json
"subject": { "kind": "stylized_3d_character", "universe_profile_id": null, "universe_slug": null, "universe_name": null, "character_keys": [], "character_count": 1 }
```
**Code Sesudah (Proposed/After)** — `subject` VI v4:
```json
"subject": { "kind": "stylized_3d_character", "universe_profile_id": "<id Universe PT GIM Presenters>", "universe_slug": "<slug>", "universe_name": "PT GIM Presenters", "character_keys": ["reno"], "character_count": 1 }
```
(Maya: `"character_keys": ["maya"]`)

4. **Cek di kode** (baca saja) apakah jalur CFA edukasi (`direct_passthrough` → `/api/v2/recipes/autonomous-pipeline`) ikut melewati `opc-start-frame-request.js` sehingga gambar acuan benar-benar terkirim. Cari log `[CharacterLock Async] Clip N: characters=reno_thermal_engineer refs=1` saat uji.
5. **Bila CFA edukasi tidak melewati Character Lock**, ada dua cadangan untuk dibahas bersama pengguna:
   - (a) jalur PT GIM memakai jenis pengiriman yang mendukung gambar acuan;
   - (b) tambahkan ke instruksi Antigravity (Tahap 5): `direct_passthrough` menyertakan gambar acuan karakter dari VI.

**Kriteria lolos tambahan di Tahap 4:** log `[CharacterLock]` muncul dengan `refs=1` di setiap klip, dan wajah Reno/Maya terlihat sama di semua klip dan semua video uji.

### Temuan Tahap 3 (17 Nov) — Character Lock di jalur CFA edukasi

- CFA edukasi mengirim `pipeline_type: custom_storyboard` + `prompt_mode: direct_passthrough` (`~/cf-autopipeline/bin/cfa_produksi.py:51–64`).
- `lib/custom-storyboard-pipeline.js:415` membuat kampanye dengan **`visual_overrides_json: null`**. Hanya `visual_identity_preset_id` yang disimpan.
- Item passthrough langsung `generation_status: completed` (`:487`), jadi tidak melewati `processPillarGenerator` (`lib/scheduler-processors.js:5284`, `:6417–6423`). Di sana VI di-resolve dari preset id dan dikirim ke `hasStylizedUniverseLink`.
- `buildOpcStartFrameRequest` (`lib/opc-start-frame-request.js:244`) hanya membaca `campaign.visual_overrides_json`. Jika null, `shouldResolveReferences = false`, sehingga **gambar acuan karakter tidak dilampirkan**.
- **Kesimpulan:** pada jalur CFA edukasi saat ini, wajah Reno/Maya hanya dijaga lewat teks (`blok_gaya_t2i` + prompt). Bukti akhir: log `[CharacterLock]` pada video uji (diperkirakan tidak muncul).
- **Pilihan:**
  - **A.** Uji sekarang dengan teks saja dan nilai seberapa besar pergeseran wajah.
  - **B.** Ubah skrip CFA agar mengirim mode `gemini_engineer` tanpa produk + `setting_hint` per klip. VI di-resolve oleh generator sehingga Character Lock berpeluang aktif, tetapi latar bisa kembali terkunci VI untuk karakter 3D (perlu uji).
  - **C.** Perbaikan CF Studio oleh Antigravity: passthrough ikut membawa snapshot VI, sehingga Character Lock aktif. Masuk Tahap 5.

### Tahap 4 — Video uji

- Buat **2 item uji per brand (total 4 video)**, dengan latar sengaja berbeda:
  - **Thermal:** 1 × T4 (pipa AC menetes) + 1 × T5 (pipa uap pabrik)
  - **Akustik:** 1 × A1 (kamar kos, tetangga berisik) + 1 × A6 (plafon akustik restoran)
- **Alur:** `cfa-riset` (khusus item uji) → `cfa-penulis` → `cek-naskah` → `cfa-produksi --jalur …`. **Tidak dipublikasikan**, hanya ditonton pengguna.
- **Kriteria lolos:**
  1. Wajah dan pakaian Reno/Maya konsisten di semua klip
  2. Latar sesuai kata kunci dan berbeda antar-video
  3. Tidak ada orang lain atau teks rusak
  4. VO dan klaim sesuai katalog
  5. CTA benar
- **Jika karakter tidak konsisten:** coba varian dengan VI v4 aktif atau gambar acuan karakter. Laporkan sebelum lanjut.
- Laporan: `catatan-kerja/laporan/LAPORAN_UJI_CFA_PTGIM.md` (link video + catatan per kriteria).

### Tahap 4b — Perbaikan latar Maya & angka dB (17 Nov)
- [x] **4b.1** — R1 aturan LOKASI KONSISTEN di `sudut_wajib` kedua jalur
- [x] **4b.2** — R2/R3 `blok_gaya_t2i` Maya (charming, interior sederhana, tanpa angka) + pengaman serupa untuk Reno
- [x] **4b.3** — Uji ulang 2 video Maya 18 Nov (2231, 2232): latar stabil, angka dB hilang → lolos
- [ ] **4b.4** — R4 outro lebih panjang (menunggu keputusan pengguna)

### Tahap 5 — Instruksi Antigravity: Editorial Campaign latar variatif

File baru: `catatan-kerja/instruksi-agent/antigravity_editorial_latar_variatif_karakter3d_instructions.md`, berisi:
- **Akar masalah:** `lib/prompts.js:1944` (`isSceneDirectorActive = !isStylizedCharacter && …`) dan `2295–2297`, `2348/2354` (lokasi VI ditempel apa adanya ke setiap klip).
- **Perbaikan:** untuk VI `environment.policy = planner_driven` dengan karakter 3D, lokasi dipilih per babak cerita dan `location_en` dicatat per adegan, mengikuti pola perbaikan Multiplier v2.48.24 (`lib/prompts.js:3978–3985`). Disertai Code Sebelum/Sesudah.
- Uji regresi: DapurBotani (identity_card manusia) tidak berubah. Reno/Maya Editorial menghasilkan latar berbeda per klip.
- Ditambahkan ke `_DAFTAR_ISI.md`.

### Tahap 5b — Eksekusi opsi C oleh Claude (Antigravity error, diminta pengguna 17 Nov)
Instruksi: `catatan-kerja/instruksi-agent/antigravity_character_lock_custom_storyboard_instructions.md`
- [x] **5b.1** — Ubah `lib/custom-storyboard-pipeline.js`: resolve & simpan snapshot VI (`visual_overrides_json`, versi VI)
- [x] **5b.2** — Verifikasi pemanggil `buildOpcStartFrameRequest` memakai kampanye dari DB
- [x] **5b.3** — Unit test `tests/custom-storyboard-character-lock.test.js` + regresi custom storyboard
- [x] **5b.4** — `npm run build` (DISABLE_AUTO_MIGRATIONS=true)
- [x] **5b.5** — Rilis patch v2.50.2 (`7ef02a6`, tag `v2.50.2`) + push ke GitHub (17 Nov)
- [x] **5b.6** — Deploy Dev atomic → verifikasi (release `20261117T025317Z-7ef02a6b2bd0`, UI 5020 = 200, API 7020 `/health` = 200, PM2 online)
- [x] **5b.7** — Deploy Staging atomic 09:58 WIB (release `20261117T025550Z-7ef02a6b2bd0`; antrean kosong, 0 item CFA diproduksi). Verifikasi: `current` → rilis baru, UI 5010 = 200, API 7010 `/health` = 200, PM2 ui/api/mcp online dengan `pm_cwd` rilis baru, `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`
- [x] **5b.8** — Uji nyata Staging lolos: `cst_24aa4768bccb` (item #2226) → `[CharacterLock Async] Clip 1 & 2: characters=reno_thermal_engineer refs=1`, `model=nano_banana_pro`; latar ikut adegan. Laporan: `catatan-kerja/laporan/LAPORAN_CHARACTER_LOCK_CUSTOM_STORYBOARD.md`

### Tahap 6 — Go-live Week 2

- Setelah uji lolos (K4: langsung live): jalur `aktif=true`, `publish.mode=live`, `maks_video_per_hari=30` (K1), `video_per_hari=3` (K2), `riset=mingguan` (`riset_hari=senin`; untuk Week 2 pertama, `plan-minggu` dijalankan manual sekali).
- Pengguna menyalakan/menyesuaikan jadwal CFA di Mac Mini (K5).
- Perbarui usulan, kartu menu bila ada perubahan perilaku, dan memori.

---

## Risiko

| Risiko | Mitigasi |
|---|---|
| Karakter 3D berubah wajah antar-klip | **Character Lock** dengan gambar acuan resmi (Tahap 3e) + blok gaya teks. Dibuktikan lewat log dan video uji (Tahap 4). |
| Menu Universe belum ada di MCP / unggah gambar acuan tidak tersedia di UI | Dikerjakan lewat UI dengan panduan. Bila buntu, dilaporkan dulu dan jalur DB tidak dipakai tanpa persetujuan. |
| Kuota G-Labs: +6 video/hari (total CFA ±14/hari) | Cek sisa kuota sebelum go-live. Bila kurang, laporkan sebelum aktivasi. |
| `maks_produksi_per_putaran` = 8 bisa menahan antrean | Cek jumlah putaran produksi per hari. Naikkan bila perlu (atas persetujuan). |
| Mengubah skill `cfa-penulis` berdampak ke jalur lain | Perubahan bersyarat (hanya bila jalur punya karakter utama). Jalur lain tidak terpengaruh. |
| Klaim teknis berlebihan (suhu, persen) | Hanya angka katalog. `frasa_terlarang` untuk klaim "pasti/100% kedap". |

---

## Execution Task List

### Persiapan
- [x] **P1** — Arsipkan rencana lama ke `catatan-kerja/rencana/`
- [x] **P2** — Pengguna menjawab K1–K5
- [ ] **P3** — Cek koneksi helper CFA di Mac Mini (`antrean.py jalur`) dan sisa kuota G-Labs

### Tahap 1 — Brand Profile
- [x] **1.1** — Susun isian baru kedua brand (konteks, pilar, visual signature, presenter, warna, tagline, CTA, lokasi)
- [x] **1.2** — Tunjukkan draf tagline & CTA ke pengguna → persetujuan (disetujui 17 Nov)
- [x] **1.3** — Terapkan via `cf_update_brand_profile`, lalu baca ulang untuk verifikasi (17 Nov, semua kolom terverifikasi; cadangan: `catatan-kerja/arsip-keluaran/backup_brand_profile_ptgim_20261117.json`)

### Tahap 2 — Riset kata kunci
- [x] **2.1** — Riset web kata kunci per kelompok latar (Thermal 43, Akustik 43; sumber: autocomplete Google ID)
- [x] **2.2** — Saring duplikat dengan kata kunci Week 1 (0 duplikat dari 41)
- [x] **2.3** — Tulis laporan riset `catatan-kerja/laporan/RISET_KATA_KUNCI_PTGIM_W2.md` + daftar isi
- [x] **2.4** — Buat file `kata_kunci/solusithermal.txt` & `ruangakustik.txt` di Mac Mini (terverifikasi)

### Tahap 3 — Preset, VI & Jalur
- [x] **3.1** — Clone & rapikan preset `solusi_thermal_cfa`, `ruang_akustik_cfa` (17 Nov, revisi 2). Catatan: `cf_clone_preset` mengganti seluruh bagian yang di-override, sehingga dipulihkan dengan `cf_update_preset` berisi config lengkap.
- [x] **3.2** — Buat VI v4 Reno `vi_mwk2cm17_3b3a3166` & Maya `vi_mwk2cm33_0c9f088c` (v3 tetap)
- [x] **3.3** — Cek peran VI pada `direct_passthrough` di kode → **temuan: Character Lock kemungkinan besar TIDAK aktif** di jalur ini (lihat "Temuan Tahap 3")
- [x] **3.4** — `cfa-penulis/SKILL.md` diberi pengecualian jalur berkarakter (pemicu: `sudut_wajib` memuat "KARAKTER UTAMA: <nama>"), laptop & Mac Mini identik (md5 `c8e970af…`)
- [x] **3.5** — Brand `solusithermal` & `ruangakustik` terdaftar di CFA Mac Mini (tenant `tnt_pt-gim-sosmed_62d0d9`, id-ID) + `panduan_brand` + `blok_gaya_t2i` (cadangan `config.json.bak-20261117-ptgim`)
- [x] **3.6** — Jalur `solusithermal-edukasi` & `ruangakustik-edukasi` tersimpan & lolos validasi (preset CFA, VI v4, 4 akun Repliz aktif, jam sebar 07:00–20:00, mode draft, video_per_hari=2 untuk uji). `maks_video_per_hari` CFA dinaikkan 8 → 30 (K1)

### Tahap 3e — Kunci wajah (Character Lock)
- [x] **3e.1** — Gambar acuan Reno & Maya: **sudah ada** (`/uploads/reference_assets/ptgim_reno_character_sheet.jpg`, `ptgim_maya_character_sheet.jpg`, 1376×768, HTTP 200 di Staging; sama dengan screenshot pengguna)
- [x] **3e.2** — Universe **sudah ada** di Staging (bukan dibuat baru): `ptgim_univ_solusi_thermal_tnt_pt_gim_sosmed_62d0d9` (slug `solusi-thermal-id`, karakter `reno_thermal_engineer`) dan `ptgim_univ_ruang_akustik_tnt_pt_gim_sosmed_62d0d9` (slug `ruang-akustik-id`, karakter `maya_acoustic_architect`)
- [x] **3e.3** — Disambungkan ke VI v4 Reno & Maya (`subject.universe_profile_id`, `universe_slug`, `character_keys`), VI versi 2 (17 Nov).
- [x] **3e.3b** — Atas persetujuan pengguna, VI v3 (Editorial) juga disambungkan → versi 4 (17 Nov). Cadangan: `catatan-kerja/arsip-keluaran/backup_vi_v3_ptgim_20261117.json`. Efek: kampanye Editorial baru masuk `content_world = cartoon_universe` (`lib/pillar-campaign-ingest.js:179, 277`) dengan Character Lock aktif. Dua jadwal Editorial Thermal aktif (generate 12:05 & 12:20 WIB, 17 Nov) menjadi uji nyata pertama.
- ⚠️ **Risiko:** gambar acuan berlatar pabrik (Reno) dan kantor (Maya). Model start frame bisa ikut meniru latar itu sehingga latar kurang bervariasi. Dinilai di Tahap 4; jika terjadi, buat lembar karakter berlatar polos.
- [x] **3e.4** — Jalur CFA edukasi tidak melewati Character Lock → diperbaiki di v2.50.2 (opsi C)
- [x] **3e.5** — Dikerjakan langsung oleh Claude (Antigravity error), terbukti di Staging

### Tahap 4 — Video uji
- [x] **4.1** — 4 item uji dibuat (T4 ac netes air di indoor, T5 isolasi pipa steam, A1 suara tetangga terdengar, A6 plafon peredam suara hujan)
- [x] **4.2** — Riset (1 pencarian/topik, fakta bersumber) → naskah (5 klip, VO 18–22 kata, klip 5 = outro) → `cek-naskah` lolos semua
- [x] **4.3** — Produksi 4 video selesai (`cst_cbe176164a21`/2227, `cst_c7f9daf7c96b`/2228, `cst_d26797eeee78`/2229, `cst_df4507476942`/2230); Character Lock aktif 20/20 klip
- [x] **4.4** — `catatan-kerja/laporan/LAPORAN_UJI_CFA_PTGIM.md` + lembar kontak; menunggu penilaian pengguna (temuan: latar Maya bergeser, angka dB melayang, VO klip 5 pendek)

### Tahap 5 — Instruksi Antigravity
- [x] **5.0** — Tulis instruksi opsi C: Character Lock untuk custom storyboard → `catatan-kerja/instruksi-agent/antigravity_character_lock_custom_storyboard_instructions.md` (17 Nov)
- [ ] **5.1** — Tulis instruksi Editorial latar variatif untuk karakter 3D + daftar isi

### Tahap 6 — Go-live
- [x] **6.1** — Go-live 17 Nov ±11:10 WIB: kedua jalur `video_per_hari=3`, `publish.mode=live`, `riset=mingguan` (`riset_hari=senin`); batas CFA 30. `plan-minggu --paksa` membuat 40 item 18–24 Nov (21 Thermal, 19 Akustik). Item 18 Nov diriset, ditulis & diproduksi manual (2231–2236). Dijadwalkan live: AC netes 17/11 11:47, pipa uap 17/11 20:00, busa telur 18/11 07:00, studio drum 18/11 20:00. 2 video Maya uji pertama ditahan (`perlu_review`). Video 18 Nov lain juga terjadwal live: atap panas 07:00, kamar atas 13:30, kandang ayam 20:00 (Thermal); kamar kos 13:30 (Akustik) — start frame 2233–2236 belum dicek visual.
- [ ] **6.2** — Pengguna memastikan jadwal CFA di Mac Mini (riset/penulis/produksi/publish) berjalan harian agar item 19–24 Nov diproses H-1
- [ ] **6.3** — Perbarui usulan, kartu menu (bila perlu), dan memori
