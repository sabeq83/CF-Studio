# Usulan Solusi 3 Lapisan: Blueprint–Product Smart Matcher & Kuota Harian 2+2 Video Multiplier

**Tanggal:** 23 November 2026  
**Target Brand:** `nutribake`, `dapurbotani`, `siasatsehat` (4 video/hari/brand = 12 video/hari)  
**Komposisi Harian per Brand:** 2 video product bridging **Alat Dapur** + 2 video product bridging **Bahan Resep**  
**Dokumen Terkait:** [DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md](DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md)

---

## 1. Latar Belakang & Akar Masalah (Temuan Audit Staging)

Berdasarkan pembacaan langsung terhadap **213 blueprint `deconstructed`** di Deconstruction Lab, **270 produk** di `product_extractions`, relasi `brand_products`, dan **42 jadwal aktif `multiplier_campaign`** di environment Staging (`default_tenant`):

1. **Stok Blueprint Sangat Cukup, Tapi Sulit Dihafal:**
   - Total **213 blueprint**: `Baking` (86), `Health` (86), `Cooking` (32), `Skincare` (8), `Home Care` (1).
   - Dari jumlah tersebut, **~195 blueprint** adalah konten pangan/minuman/herbal yang layak dipakai oleh ketiga brand (sisanya ~18 blueprint bertema perawatan luar/topikal/home care tidak cocok untuk `nutribake` dan hanya relevan terbatas untuk bahan tertentu).
2. **Data Kesiapan Produk Brand Tidak Seimbang:**
   - `nutribake`: **68 produk** ter-mapping (**26 alat dapur**, **42 bahan resep**).
   - `dapurbotani`: **128 produk** ter-mapping (**48 alat dapur**, **80 bahan resep**).
   - `siasatsehat`: **18 produk** ter-mapping (**0 alat dapur**, **18 bahan resep**). Padahal di katalog utama ada **62 alat dapur unmapped** yang belum ditautkan ke brand mana pun.
3. **Jadwal Multiplier Aktif Belum Memakai Product Bridging:**
   - Seluruh **42 jadwal aktif `multiplier_campaign`** (14 jadwal/brand = 2 video/hari) saat ini memiliki `product_id = null` dan `bridging_mode = null`.
4. **Celah UI/Sistem di CF Studio Saat Ini:**
   - `re_deconstructed_assets` sebenarnya sudah menyimpan `product_ideas_json` (`low_ticket` & `high_ticket`), `original_storyboard_json` (aksi memasak per adegan), `tags`, `core_problem`, dan `core_solution` (lihat `app/api/v2/deconstruct/route.js`).
   - Namun pada [Auto Pipeline](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js#L4304-L4317) (`app/auto-pipeline/page.js`, termasuk modal jadwal di baris `7839-7980`) dan [MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js), pencarian blueprint hanya mencocokkan string mentah. Belum ada **klasifikasi peran produk (`alat_dapur` vs `bahan_resep`)**, **pencocokan otomatis ke produk riil katalog**, ataupun **rekomendasi pasangan per brand**.

---

## 2. Usulan Solusi (3 Lapisan: Dari Langsung Jalan hingga Otomatis)

### Lapisan 1 — Solusi Operasional Segera (0 Kode, Bisa Jalan Hari Ini)

Fokus pada pembenahan data mapping dan penggunaan matriks awal 12 video/hari:

1. **Lengkapi Mapping Alat Dapur (`brand_products`) untuk `siasatsehat` & `nutribake`/`dapurbotani`:**
   - Tautkan minimal 8–12 alat dapur yang **sudah ada** di `product_extractions` ke `siasatsehat` (mis. `pe_1784449324420_841` *Borosilicate Teko Kaca Infuser*, `pe_1780712278685` *Blender Philips HR2042/13*, `pe_1781420171521_196` *SAMONO Blender Chopper MC200*, `pe_1781360120731_877` *Alat Pemeras Jeruk Lemon Stainless*, `pe_1781358280332_962` *Panci Kaca Borosilicate Gagang Kayu*, `pe_migrated_1781147137160_952` *Saringan Ayakan Bulat Stainless*).
   - Tambahkan **30 alat dapur baru (Rp 20K–500K)** sesuai daftar di [DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md](DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md) untuk menutup celah alat yang paling sering diminta blueprint (Electric Health Pot, Air Fryer Low Watt, Hand Blender, Kompor Induksi Mini, Mortar Granit, Gelas Kaca Borosilikat, Saringan Jamu, dll.).

2. **Matriks Contoh Siap Pakai (4 Video/Hari × 3 Brand = 12 Video):**

| Brand | Slot | Jenis Bridging | Blueprint ID & URL | Produk Katalog Pasangan |
|---|---|---|---|---|
| `nutribake` | 1 | Alat Dapur | `53c70747` — [Reel DZ90alTJO2Y](https://www.instagram.com/reel/DZ90alTJO2Y/) (Brownies kukus) | `pe_sync_1781148697788_410` — *SAMONO Stand Hand Mixer 2in1* |
| `nutribake` | 2 | Alat Dapur | `c9ae15ab` — [Reel 1366745295563316](https://www.facebook.com/reel/1366745295563316/) (Roti kentang tanpa tepung) | `pe_1782648830415_399` — *DELAPAN Baking Paper Non-Stick Silicone* |
| `nutribake` | 3 | Bahan Resep | `e39e9297` — [Reel 2378155285996433](https://www.facebook.com/reel/2378155285996433/) (Brownies alpukat sehat) | `pe_1786588017962_4710` — *Premix Cocoa Powder Premium* |
| `nutribake` | 4 | Bahan Resep | `74c450a8` — [Reel 2042518859691905](https://www.facebook.com/reel/2042518859691905/) (Sweet potato brownies) | `pe_1781998087509_929` — *Beorganik Peanut Butter* |
| `dapurbotani` | 1 | Alat Dapur | `2375eebd` — [Reel 997334649544212](https://www.facebook.com/reel/997334649544212/) (Es krim cokelat sehat) | `pe_jit_1781339979313_564` — *Food Processor Chopper Multifungsi* |
| `dapurbotani` | 2 | Alat Dapur | `a42b1309` — [Reel 1674737060234737](https://www.facebook.com/reel/1674737060234737/) (Banana peanut butter ice cream) | `pe_1781356381805_446` — *Sendok Es Krim Stainless Steel* |
| `dapurbotani` | 3 | Bahan Resep | `1f80f094` — [Reel 1606250437724302](https://www.facebook.com/reel/1606250437724302/) (Seduhan kunyit lemon madu) | `pe_1782444159898_590` — *Nutrifarm Kunyit Bubuk* |
| `dapurbotani` | 4 | Bahan Resep | `a62b0893` — [Reel 1461665122307925](https://www.facebook.com/reel/1461665122307925/) (Smoothie lemon jahe chia) | `pe_sync_1781148697787_757` — *Nutrifarm Chia Seeds* |
| `siasatsehat` | 1 | Alat Dapur | `ba977b0a` — [Reel 26908773132106731](https://www.facebook.com/reel/26908773132106731/) (Teh rebusan cengkeh nipis) | `pe_1784449324420_841` — *Borosilicate Teko Kaca Infuser* *(perlu di-map ke siasatsehat)* |
| `siasatsehat` | 2 | Alat Dapur | `bd18c93e` — [Reel 958511893251871](https://www.facebook.com/reel/958511893251871/) (Jus wortel timun lemon) | `pe_1780712278685` — *Blender Philips HR2042/13* *(perlu di-map ke siasatsehat)* |
| `siasatsehat` | 3 | Bahan Resep | `036ce860` — [Reel 1309181754271401](https://www.facebook.com/reel/1309181754271401/) (Iced matcha latte diet) | `pe_1784449324420_662` — *Nutrifarm Organic Premium Matcha Powder* |
| `siasatsehat` | 4 | Bahan Resep | `19704bd0` — [Reel 834758635847779](https://www.facebook.com/reel/834758635847779/) (Rebusan jahe kayu manis) | `pe_1783235604763_116` — *Nutrifarm Kayu Manis Bubuk* |

---

### Lapisan 2 — Solusi Sistemik di CF Studio: Blueprint–Product Smart Matcher

Tujuan: **Pengguna tidak perlu menghafal** blueprint A cocok dengan produk apa atau brand mana. Sistem menghitung kecocokan secara otomatis dan menampilkannya di UI.

#### 2.1 Klasifikasi Peran Produk (`promo_role`)
- Tambah field/tag peran promosi pada `product_extractions` (atau `brand_products`):
  - `alat_dapur` (peralatan masak, elektronik dapur, wadah, cetakan, alat bantu prep)
  - `bahan_resep` (bahan baku, rempah, superfood, pemanis, tepung, teh)
  - `lainnya` (kapsul siap minum, produk non-dapur/topikal)
- Auto-klasifikasi awal berdasarkan `category` + nama produk, dengan opsi override manual di halaman Product Database (`/products`).

#### 2.2 Blueprint Compatibility Indexer (Backend)
- Buat modul indexer (mis. `lib/blueprint-product-matcher.js`) yang berjalan:
  1. Otomatis setiap kali sebuah video selesai didekonstruksi (`status = 'deconstructed'`), dan
  2. Sebagai backfill sekali jalan untuk **213 blueprint** yang sudah ada (serta ter-refresh saat ada produk baru ditambahkan).
- Cara kerja pencocokan (kombinasi rule/keyword + AI ringan bila perlu):
  - Baca `niche`, `tags`, `core_problem`, `core_solution`, `original_storyboard_json`, dan `product_ideas_json`.
  - Ekstrak **metode/aksi visual** (mis. `blender/smoothie`, `oven/bake`, `kukus/steamer`, `rebus/seduh`, `sangrai/skillet`, `parut/saring/peras`, `wadah/jar`) serta **bahan dominan** (`cocoa`, `oat`, `chia`, `kunyit`, `jahe`, `kayu manis`, `matcha`, `madu`, `cengkeh`, `rosella`, `peanut butter`, `yogurt`).
  - Hitung skor kecocokan ke setiap produk di `product_extractions` yang aktif pada masing-masing brand (`nutribake`, `dapurbotani`, `siasatsehat`), lalu simpan hasil top-match ke tabel relasi (mis. `blueprint_product_matches`: `deconstruct_asset_id`, `brand_id`, `product_id`, `promo_role`, `match_score`, `match_reason`).
  - Tandai pula blueprint non-pangan (`Skincare`, `Home Care`, topikal rambut/gigi/sendi) agar tidak direkomendasikan ke brand kuliner seperti `nutribake`.

#### 2.3 Peningkatan UI di 3 Halaman Utama
*(Catatan SOP: wajib buat mockup HTML di `public/mockup_*.html` dan review di Staging sebelum implementasi kode React/Next.js.)*

1. **Deconstruct Lab ([app/deconstruct/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/deconstruct/page.js)):**
   - Tampilkan **badge kecocokan** di kartu/baris setiap blueprint, contoh:
     - `NutriBake: 3 Alat · 5 Bahan`
     - `SiasatSehat: 2 Alat · 4 Bahan`
   - Tambah filter dropdown cepat: **Brand Fit** (`Semua` / `nutribake` / `dapurbotani` / `siasatsehat`) dan **Jenis Bridging** (`Alat Dapur` / `Bahan Resep`).

2. **Multiplier Labs ([MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js)) & Auto Pipeline ([app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js)):**
   - Saat pengguna memilih **Brand** + **Blueprint**, dropdown **Target Produk** otomatis menampilkan section teratas: **"⭐ Direkomendasikan untuk Blueprint Ini"** yang dikelompokkan menjadi **Alat Dapur Cocok** dan **Bahan Resep Cocok** beserta alasan singkatnya (mis. *"Adegan 3 memblender buah & es"* / *"Ide blueprint menyebut saringan & panci rebus"*).
   - Tambah filter cepat di pemilih blueprint: *"Hanya blueprint yang cocok untuk Alat Dapur"* / *"Hanya blueprint yang cocok untuk Bahan Resep"*.

3. **MCP Tool Support (`cf-studio`):**
   - Perbarui `cf_list_deconstructed_assets` / `cf_search_blueprints` (atau tambah parameter `brand_id` & `promo_role`) agar operator AI / CFA langsung mendapat daftar blueprint beserta pasangan `product_id` terbaiknya tanpa perlu menebak.

---

### Lapisan 3 — Autopilot Kuota Harian 2+2 per Brand (12 Video/Hari Tanpa Pilih Manual)

Setelah Lapisan 1 & 2 siap, produksi harian bisa diotomasi dengan **Smart Daily Quota (2 Alat + 2 Bahan)**:

1. **Konsep Slot Harian per Brand (Total 12 Slot/Hari):**
   - **Slot 1 (Pagi — Alat Dapur #1)**: misalnya jam tayang `06:15` WIB.
   - **Slot 2 (Siang — Bahan Resep #1)**: misalnya jam tayang `11:30` WIB.
   - **Slot 3 (Sore — Alat Dapur #2)**: misalnya jam tayang `16:15` WIB.
   - **Slot 4 (Malam — Bahan Resep #2)**: misalnya jam tayang `19:30` WIB.

2. **Aturan Rotasi Anti-Duplikat & Anti-Bosan:**
   - **Anti-Duplikat Blueprint:** Jangan memakai `deconstruct_asset_id` yang sama pada brand yang sama dalam **14 hari terakhir** (dengan ~195 blueprint pangan tersedia, 1 brand memakai 4 blueprint/hari baru berulang setelah ~48 hari, atau ~24 hari jika lintas brand dirotasi terpisah).
   - **Anti-Duplikat Produk:** Produk yang dipromosikan tidak boleh sama dengan 3–5 hari terakhir pada brand yang sama (memanfaatkan 26–48+ alat dapur dan 18–80 bahan per brand).
   - **Aturan Bridging (`kb/MULTIPLIER_BRIDGING_GUIDE.md`):**
     - Produk **tidak disebut** sebelum `bridge_at_clip` (default klip 2 untuk 4 klip, atau klip 3 untuk 6+ klip).
     - Pastikan setiap produk yang ikut rotasi sudah lolos foto bersih (`clean_photo_url`) dan `product_truth` berbahasa Inggris agar visual I2V/T2I konsisten.

3. **Integrasi dengan 42 Jadwal Aktif Saat Ini:**
   - 42 jadwal `multiplier_campaign` eksisting (2 video/hari/brand yang masih `product_id = null`) dapat:
     - **Opsi A:** Ditingkatkan (*upgrade*) menjadi 2 slot harian ber-bridging (mis. 1 Alat Dapur + 1 Bahan Resep), lalu ditambah 2 slot baru per brand (total 4 video/hari/brand = 84 jadwal mingguan atau 12 slot autopilot rotasi harian).
     - **Opsi B:** Menggunakan fitur **Auto-Select Next Matching Blueprint + Product** pada runner jadwal (`lib/auto-pipeline-scheduler-runner.js`) sehingga cukup 4 jadwal recurring per brand (`Slot Alat 1`, `Slot Alat 2`, `Slot Bahan 1`, `Slot Bahan 2`) tanpa perlu membuat puluhan baris jadwal statis per hari.

---

## 3. Urutan Eksekusi yang Disarankan

1. **Input & Mapping Produk** *(Anda)*: Masukkan 30 alat dapur baru dari [DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md](DAFTAR_30_ALAT_DAPUR_BLUEPRINT_20K_500K.md) + map alat unmapped ke `siasatsehat`, `nutribake`, dan `dapurbotani`.
2. **Desain & Mockup UI Smart Matcher** *(Tahap 1 Kode)*: Buat mockup HTML di `public/mockup_*.html` untuk filter `Alat Dapur` / `Bahan Resep` & rekomendasi produk di Auto Pipeline / Multiplier Labs untuk direview di Staging.
3. **Implementasi Matcher & Backfill 213 Blueprint** *(Tahap 2 Kode)*: Tambah `promo_role`, jalankan indexer kecocokan untuk seluruh 213 blueprint, dan aktifkan rekomendasi di UI + MCP.
4. **Uji Coba & Aktivasi Kuota 2+2 Harian** *(Tahap 3)*: Jalankan 1 hari uji coba (12 video) pada Dev/Staging sebelum mengaktifkan jadwal rutin penuh.
