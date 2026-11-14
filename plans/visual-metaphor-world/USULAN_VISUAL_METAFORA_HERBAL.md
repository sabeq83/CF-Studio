# Usulan: Visual Identity Metafora untuk Brand Herbal (DapurBotani & SiasatSehat)

> Status: **USULAN — belum ada perubahan codebase.** Perlu persetujuan sebelum implementasi.
> Tanggal: 2026-11-14

## 0. Sumber yang dianalisa

| Sumber | Cakupan |
|---|---|
| Kode | `lib/visual-identity-contract.js`, `lib/visual-identity-ai-contract.js`, `lib/visual-identity-allocator.js`, `lib/visual-override-resolver.js`, `lib/health-metaphors.js`, `lib/prompts.js` (blok metaforik 2307–2360), `lib/scheduler-processors.js:5356` |
| Staging (MCP, tenant `default_tenant`) | Brand profile `dapurbotani` & `siasatsehat`; 25 visual identity (system + tenant), termasuk `dapurbotani_apothecary_3d_female/male`, `siasatsehat_clinical_biohack_3d`, `artisanal_apothecary_metaphor`, `hydraulic_pipeline_metaphor`, `chrono_restoration_metaphor`, `luxury_rheology_metaphor` |
| Google Docs (kampanye Bundayes) | **28 dari 47 dokumen terbaca penuh.** 19 dokumen ditolak (`Permission denied`) — perlu dibuka aksesnya bila ingin dianalisa |

---

## 1. Apa yang membuat dokumen Bundayes berhasil (pola yang dipelajari)

28 dokumen itu berisi ±25 konsep berbeda, tapi semuanya memakai **tata bahasa visual yang sama**:

### 1.1 Satu video = satu "Dunia Metafora" yang dipertahankan dari klip 1 sampai akhir

| Konsep | Benda sehari-hari | Masalah tubuh yang diwakili |
|---|---|---|
| The Grease Trap / Emulsification Test | Gelas air + minyak goreng bekas | Lemak gorengan & santan |
| The Clogged Tube / Drain Unclog | Selang bening / wastafel mampet | Sembelit, pencernaan macet |
| The Carpet Clean | Karpet putih kusam + vacuum bening | Kulit kusam (racun dari dalam) |
| The Deep Pan Scrub | Wajan teflon + lemak beku | Lemak perut |
| The Greasy Tupperware | Wadah plastik berminyak merah | Lemak menempel di usus |
| The Sponge Squeeze | Spons kuning basah | Retensi cairan / water weight |
| The Absorption Barrier | Spons kering + kain filter | Penyerapan gula/karbo |
| The Magnetic Field | Serbuk besi + magnet batang | "Menarik" racun |
| The Energy Burn | Korek api + kertas basah | Metabolisme lambat |
| The Oxidation Test | Apel segar vs teroksidasi | Penuaan / antioksidan |
| The Heavy Suitcase | Koper berat berantakan | Beban tubuh, lesu |
| Turbo Jeans | Kancing jeans tegang | Perut begah |
| Cortisol Hack | Grafik osiloskop + tombol merah | Stress eating |

Yang penting: **dunia metaforanya yang menentukan properti, latar, dan lighting** — bukan brand. Karpet, wastafel, wajan, dan koper tidak pernah muncul di set yang sama, jadi tiap video terasa baru.

### 1.2 Struktur cerita (beat) yang konsisten
```
1 PROBLEM   → benda kotor/rusak diperkenalkan (gross-out, kontras tinggi)
2 THREAT    → zoom ke "musuh" (lapisan minyak, sumbatan, debu)
3 STRUGGLE  → cara umum yang gagal (mengaduk, menggosok, menepuk)
4 FAILURE   → kembali kotor → frustrasi
5 INTERVENTION → produk masuk KE DALAM metafora (serbuk ditabur, cairan dituang)
6 REACTION  → fisika yang memuaskan (menggumpal, terangkat, plong)
7 RESULT    → bersih/jernih, lighting berubah jadi high-key
8 HERO/CTA  → botol di dunia yang sudah bersih + tangan mengambil
```

### 1.3 Unsur produksi yang selalu ada
- **Tangan berakting** (lengan panjang syar'i): menepuk karpet, mengaduk, menabur. Tangan memberi *agency* dan efek ASMR.
- **Arc lighting**: dari harsh/kotor/gelap → high-key/pagi/bersih. Kontras emosi itulah payoff-nya.
- **Genre tag yang jelas**: *ASMR/Satisfying Cleaning*, *Science Demo*, *POV Foodie's Regret*, *Slice of Life*.
- **SFX-driven**: suara vakum, gurgle, "plong", ding — sebagian video tanpa VO.
- **Kalimat jembatan analogi di VO**: *"Debu yang terjebak di serat karpet ini **sama seperti** racun di bawah kulitmu."*
- **Product truth lock**: botol HDPE putih + foil emas, dengan negative prompt anti-morphing.
- **Paket thumbnail split-screen**: atas kotor (teks merah), bawah bersih + produk (teks emas).

---

## 2. Diagnosis: kenapa hasil CF Studio terasa monoton

### D1. Latar dikunci per brand, bukan per metafora (penyebab utama)
`lib/visual-identity-allocator.js:209` dan `lib/prompts.js:1122/1381/2300` mewajibkan latar dan properti identity yang **sama di semua klip dan semua video**:
```
- DILARANG KERAS menyimpang dari latar setting visual identity di atas ...
7. KONSISTENSI LATAR/LOKASI WAJIB ...
```
Di staging, semua video DapurBotani akhirnya memakai *black slate + amber dropper + granite mortar*, dan semua video SiasatSehat memakai *charcoal micro-cement + borosilicate + titanium*. Metafora apa pun yang dipilih AI terpaksa terjadi di set yang sama. Pola Bundayes justru sebaliknya: setiap metafora membawa set-nya sendiri.

### D2. Semua identity herbal berasal dari satu keluarga estetika
DapurBotani, SiasatSehat, Apothecary, Hydraulic, Chrono, dan Rheology semuanya bergaya **dark-luxury lab**: slate/walnut/obsidian/kuningan, 3200–3500K chiaroscuro, amber. Akibatnya:
- Ganti identity pun hasilnya tetap mirip.
- Tidak ada kontras kotor → bersih, padahal itu payoff utama di Bundayes.
- Bendanya tidak *relatable* (pendulum kuningan, neraca antik) dibanding wajan, gorengan, karpet, dan wastafel yang ada di rumah audiens.

### D3. Metafora kesehatan bersifat statis: satu topik = satu metafora
`lib/health-metaphors.js` berisi 22 metafora tetap yang dicocokkan dengan keyword. Topik "kolesterol" **selalu** menghasilkan *crystal disc + black garlic honey*. Belum ada rotasi, pool, atau anti-repeat per brand. Isinya pun puitis dan abstrak (pendulum, fern, amber resin), bukan benda rumah tangga.

### D4. `metaphor_engine` di schema hanya satu string
```js
// lib/visual-identity-contract.js:171
function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: ...,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action')
  };
}
```
Semua 25 identity memakai `concept_to_object_to_action`. Tidak ada field untuk genre, beat grammar, cara produk masuk ke metafora, arc lighting, atau palet SFX. Di prompt, mandatnya hanya dua kalimat umum (`allocator.js:198`).

### D5. Aturan "zero hands" dan "produk dilarang sebelum bridge" memutus metafora
`lib/prompts.js:2326`: klip pre-bridging **wajib 100% benda tanpa tangan** dan **produk dilarang**. Di Bundayes, tangan justru menggerakkan aksi, dan produk menjadi **agen transformasi di dalam metafora** (serbuk ditabur ke minyak, botol mendarat di karpet bersih). Di CF Studio, metafora dan produk menjadi dua cerita terpisah yang disambung lewat bridging, sehingga payoff "produk inilah yang membersihkan" hilang.

### D6. Konflik routing 3D bio-cellular
Identity `dapurbotani_apothecary_3d_*` me-routing `mechanism → 3d_bio_cellular`, tapi blok metaforik di `prompts.js` menulis *"DILARANG ... 3D BIO-CELLULAR"*. Model menerima perintah yang bertentangan, dan hasilnya cenderung jatuh ke "aman" (benda lab generik).

---

## 3. Usulan perbaikan sistem

### U1. Entitas baru: **Metaphor World Kit** (pengganti `health-metaphors.js` statis)
Setiap kit adalah dunia metafora lengkap yang **membawa set, properti, lighting arc, dan beat-nya sendiri**:
```js
{
  key: 'grease_in_water',
  topics: ['kolesterol', 'lemak', 'gorengan', 'santan', 'diet'],
  genre: 'kitchen_science_demo',   // asmr_cleaning | kitchen_science_demo | household_physics | pov_regret | tension_object
  object_world: 'Clear drinking glass of water on a home kitchen table',
  dirty_state: 'Thick dark-yellow used frying oil floating as a stubborn layer',
  failed_attempt: 'Metal spoon stirring aggressively; oil separates again',
  intervention: { product_form: 'capsule_powder', action: 'sprinkled onto the oil layer' },
  satisfying_physics: 'Oil breaks into heavy clumps and sinks; water turns clear',
  clean_state: 'Crystal-clear water, light refracting, morning light',
  lighting_arc: { from: 'harsh high-contrast, greasy', to: 'high-key fresh morning' },
  sfx_palette: ['thick pour', 'low drone', 'spoon clink', 'sparkle chime'],
  vo_bridge_template: 'Minyak yang menolak larut ini mirip dengan {masalah} yang ...',
  hands_policy: 'modest_hands_active',
  thumbnail: { top: 'GELAS BERMINYAK', bottom: 'JERNIH + PRODUK' },
  compliance_note: 'Hindari klaim "membakar/membuang lemak tubuh"; gunakan "membantu" / "pendamping pola makan".'
}
```
- Library awal: ±25 kit dari dokumen Bundayes, ditambah variasi baru per topik (minimal **4–6 kit per topik**).
- Disimpan di DB (`metaphor_world_kits`, per tenant + system) supaya bisa ditambah lewat UI atau AI builder.

### U2. Rotasi dan anti-repeat
- Resolver memilih **pool** kit berdasarkan topik, lalu memilih kit yang **belum dipakai di N video terakhir** brand tersebut (simpan `last_used_kit_keys` per brand).
- Opsi "seed" di Content Planner: planner menuliskan `metaphor_kit_key` per baris, sehingga 7 video dalam satu minggu otomatis memakai 7 dunia berbeda.

### U3. Pisahkan **Brand Look** dan **Scene World** di Visual Identity
| Lapis | Tetap per brand | Berubah per video (dari kit) |
|---|---|---|
| Brand Look | wardrobe/sleeve, product truth, warna aksen, finish, caption style | — |
| Scene World | — | environment, props, lighting arc, genre |

Tambahkan field `environment.policy: 'brand_locked' | 'metaphor_driven'`. Bila `metaphor_driven`, mandat di `allocator.js:209` dan `prompts.js:2300` diganti menjadi *"latar konsisten DI DALAM satu video mengikuti Metaphor World Kit"*. Konsistensi tetap dijaga, tapi per video, bukan per brand.

Before (`lib/visual-identity-allocator.js:209`):
```js
- DILARANG KERAS menyimpang dari latar setting visual identity di atas ...
```
After (usulan):
```js
${envPolicy === 'metaphor_driven' && kit
  ? `- Latar mengikuti METAPHOR WORLD "${kit.object_world}". Konsisten di seluruh klip VIDEO INI. Brand look (wardrobe, warna aksen, product truth) tetap berlaku.`
  : `- DILARANG KERAS menyimpang dari latar setting visual identity di atas ...`}
```

### U4. Perluas schema `metaphor_engine`
Before (`lib/visual-identity-contract.js:171`):
```js
return { enabled, pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action') };
```
After (usulan):
```js
return {
  enabled,
  pattern,                                   // tetap, backward-compatible
  genre_pool: ['asmr_cleaning','kitchen_science_demo','household_physics'],
  beat_grammar: 'problem_struggle_intervention_8',   // atau 7 klip
  product_entry: 'inside_metaphor',          // 'inside_metaphor' | 'after_bridge' (perilaku lama)
  hands_policy: 'modest_hands_active',       // 'zero_hands' (perilaku lama) | 'modest_hands_active'
  lighting_arc: 'dirty_to_clean',            // 'none' | 'dirty_to_clean' | 'night_to_morning'
  rotation_window: 6,                        // anti-repeat N video terakhir
  vo_bridge: true                            // wajibkan kalimat "sama seperti..."
}
```
Default untuk identity lama tetap memakai perilaku lama (`after_bridge`, `zero_hands`), jadi tidak ada regresi.

### U5. Beat grammar sebagai template prompt
Tambahkan builder `buildMetaphorBeatGrammar(kit, targetClips, bridgeAtClip)` yang memetakan 8 beat (Bagian 1.2) ke jumlah klip aktual (6/7/8/9) dan menyuntikkan isi kit ke setiap beat. Dengan begitu, mandat metaforik di `prompts.js:2326` tidak lagi generik.

### U6. Selesaikan konflik aturan
- Bila `product_entry = inside_metaphor`: produk boleh muncul di beat INTERVENTION dalam bentuk isinya (serbuk/cairan), lalu botol utuh di beat HERO. Aturan "produk dilarang pre-bridge" hanya berlaku untuk mode lama.
- Bila `hands_policy = modest_hands_active`: aturan "ZERO HANDS" diganti dengan "tangan syar'i (wrists covered) boleh berakting".
- Hapus `3d_bio_cellular` dari routing identity herbal bila mode metaforik aktif, atau sebaliknya. Jangan kirim dua perintah yang bertentangan.

### U7. Dua identity herbal baru (bukan mengganti yang lama)
1. **`herbal_household_satisfying`** — rumah Indonesia terang (dapur keramik putih, wastafel, meja makan), genre ASMR cleaning dan kitchen science, arc kotor → bersih, tangan syar'i aktif.
2. **`herbal_pov_regret`** — slice-of-life malam (martabak, gorengan, AYCE, jeans sesak) → pagi segar. Moody, lalu terang.

Identity dark-luxury yang ada tetap disimpan untuk konten "premium/edukatif", tapi tidak lagi jadi satu-satunya pilihan.

### U8. AI Visual Identity Builder
`metaphor_direction` di `visual-identity-ai-contract.js` saat ini hanya teks bebas. Usulannya: builder juga **menghasilkan 5–8 Metaphor World Kit** dari brief brand dan menyimpannya bersama identity. Brief seperti *"herbal pelangsing, audiens ibu-ibu"* langsung menghasilkan pool metafora yang siap dirotasi.

### U9. Lapisan kepatuhan klaim (penting untuk herbal)
Naskah di dokumen Bundayes memakai klaim keras (*"sedot racunnya"*, *"lemak menempel di perut, paha"*). Ini berisiko secara regulasi dan policy platform, dan bertentangan dengan brand context SiasatSehat (*"tidak disebut menyembuhkan, membersihkan organ"*). Usulannya:
- **Visual metaforanya diadopsi**, tapi kalimat jembatan VO memakai template aman: *"Bayangkan … seperti …"* dan *"membantu menjaga …"*.
- `compliance_note` per kit, plus pemeriksaan kata terlarang yang sudah ada (COMPLIANCE_GUIDE KB).

### U10. Output tambahan: thumbnail split-screen
Gunakan `kit.thumbnail` untuk menghasilkan prompt cover split atas/bawah (kotor vs bersih + produk), seperti Fase C di dokumen Bundayes.

### Prioritas implementasi (usulan)
| Fase | Isi | Dampak terhadap monoton |
|---|---|---|
| F1 | U1 + U2 (kit library + rotasi), seed dari 25 konsep Bundayes | **Tinggi** |
| F2 | U3 + U6 (environment `metaphor_driven`, resolusi konflik) | **Tinggi** |
| F3 | U4 + U5 (schema + beat grammar) | Sedang–tinggi |
| F4 | U7 + U9 (identity baru + compliance VO) | Sedang |
| F5 | U8 + U10 (AI builder kit + thumbnail) | Sedang |

Validasi: A/B pada 6 video DapurBotani (3 identity lama vs 3 dengan kit berbeda), lalu bandingkan dengan contact sheet dan retensi 3 detik pertama.

---

## 4. Tiga ide visual faceless populer di TikTok untuk afiliasi (bisa dikerjakan AI)

### Ide 1 — "Pekerja Mini" (Miniature Workers World)
**Format:** orang-orang kecil (skala figur 1:87, wajah tidak terlihat atau bergaya miniatur) bekerja di dunia benda raksasa: membersihkan "pipa" usus, menambang kristal gula, mengangkut kapsul seperti tabung gas. Format miniatur/tilt-shift ini populer karena terasa lucu, aneh, dan memuaskan untuk ditonton.
- **Kenapa cocok:** metaforanya otomatis (tubuh = pabrik/kota), tidak ada wajah manusia nyata, dan produk tampil sebagai "alat berat" atau "kiriman logistik".
- **Contoh herbal (pencernaan):** K1 para pekerja mini panik di depan pipa raksasa yang mampet → K3 sekop dan ember gagal → K5 truk mini menurunkan kapsul raksasa → K6 isi kapsul mengalir dan sumbatan jebol → K7 pekerja bersorak di pipa yang bersih → K8 botol asli berdiri di samping "kota" miniatur.
- **Di CF Studio:** subject `mascot_object`/`stylized_3d_character`, framing `extreme_scale_metaphor` (sudah ada di enum), lensa tilt-shift macro.
- **Contoh prompt T2I:** `(VERTICAL 9:16) Tilt-shift macro diorama: tiny 1:87 scale construction workers in orange vests (faces not visible, backs to camera) struggling with shovels at the mouth of a giant translucent pipe clogged with dark sludge, miniature trucks and cones, shallow depth of field, bright daylight. --no realistic human face, text`
- **Risiko:** konsistensi skala antar-klip. Kunci dengan start frame + `extreme_scale_metaphor`.

### Ide 2 — "Bahan Dapur yang Bicara" (Talking Ingredients / Object Drama)
**Format:** buah, rempah, atau organ bergaya kartun dengan wajah ekspresif berdebat atau curhat (misalnya Jahe vs Gorengan, "Lambung curhat jam 2 pagi"). Ini format drama objek AI yang banyak dipakai karena cepat dicerna dan mudah dijadikan seri.
- **Kenapa cocok:** faceless untuk manusia (wajah kartun pada objek sudah dikecualikan oleh `detectExplicitFaceViolation`), dialog bisa membawa edukasi ringan, dan produk menjadi "teman baru" yang datang menolong.
- **Contoh herbal (asam lambung):** K1 Lambung kartun mengeluh kepanasan, Kopi dan Sambal tertawa → K3 Air putih mencoba menolong tapi kewalahan → K5 Kapsul herbal datang dengan "jubah" → K7 Lambung tidur nyenyak → K8 packshot produk asli (fotorealistik, tanpa wajah).
- **Di CF Studio:** `stylized_3d_character` / `cozy_claymation` (identity `mascot_herbal_ginger_guardian` sudah ada sebagai basis), multi-speaker VO.
- **Contoh prompt T2I:** `(VERTICAL 9:16) Cozy claymation scene: an anthropomorphic stomach character with big expressive cartoon eyes, sweating and fanning itself, while a smug coffee cup and chili sauce bottle characters laugh beside it on a kitchen counter, warm soft studio light.`
- **Risiko:** jangan sampai produk ikut dikartunkan. Pakai product truth lock dan packshot fotorealistik di klip akhir.

### Ide 3 — "Racik & Ritual POV" (Hands-only ASMR Routine)
**Format:** POV dari atas, tangan syar'i saja, rutinitas yang memuaskan: *restock* toples, meracik minuman herbal pagi, atau "ritual jam 9 malam". Tidak ada narasi, yang ada SFX ASMR (tutup toples, tuang air, sendok berdenting) dan teks overlay singkat. Format routine/restock ASMR termasuk format afiliasi faceless yang paling umum di TikTok Shop.
- **Kenapa cocok:** produk afiliasi tampil natural di tangan (gelas kaca, toples, blender, saringan), sesuai dengan editorial goal SiasatSehat poin 7. Format ini juga paling mudah dikonsistenkan oleh AI.
- **Contoh (SiasatSehat):** K1 alarm jam 06.00 dan tirai dibuka (tangan) → K2 toples rempah disusun → K3 jahe diparut (ASMR) → K4 air panas dituang ke gelas bening, uap naik → K5 madu menetes slow-mo → K6 kapsul/produk diambil dari wadah → K7 gelas diangkat di depan jendela pagi → K8 *flat-lay* semua alat + produk (tautan keranjang).
- **Di CF Studio:** identity `hands_only_muslimah_sage_kitchen` / `nutribake_modern_pastry` sudah dekat. Tambahkan `lighting_arc: night_to_morning` dan palet SFX.
- **Contoh prompt T2I:** `(VERTICAL 9:16) Top-down POV, modest female hands with long sage sleeves covering wrists grating fresh ginger over a clear borosilicate glass on a bright white ceramic kitchen counter, morning window light, steam rising, ASMR aesthetic. --no face, naked arms, text`
- **Risiko:** cenderung datar bila tanpa hook. Buka dengan "benda masalah" (misalnya gorengan sisa semalam) selama 1 detik sebelum ritual dimulai.

> Ketiga ide di atas bisa digabung dengan Metaphor World Kit: Ide 1 dan 2 adalah *genre* baru untuk `genre_pool`, sedangkan Ide 3 adalah *wrapper* untuk klip HERO/CTA.

---

## 5. Keputusan yang dibutuhkan dari pengguna
1. Setuju dengan prioritas F1–F5, atau ada urutan lain?
2. Kit library disimpan di DB (bisa diedit lewat UI) atau cukup sebagai file JS dulu?
3. Buka akses 19 Google Docs yang ditolak bila ingin dimasukkan ke seed library.
4. Ide visual TikTok mana yang ingin dibuatkan mockup / test-render dulu?
