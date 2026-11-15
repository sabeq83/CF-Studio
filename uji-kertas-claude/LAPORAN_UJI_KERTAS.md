# Uji Kertas Auto Pipeline Versi Claude — Agent 1, 2, 3

> Tanggal: 15 Nov 2026 · Brand uji: **HabitFolk** (resep air fryer, bahasa Inggris)
> Kata kunci diambil dari jadwal HabitFolk yang sudah ada di CF Studio (`recipe_campaign`, status paused).
> Pembanding: hasil Gemini nyata untuk **"air fryer chicken wings recipe"** (kampanye `opc_261111_kltluz`, item 2074, sudah Completed).
> Tidak ada kode yang diubah dan tidak ada yang dikirim ke G-Labs. Ini murni uji di atas kertas.

---

## Ringkasan hasil

| Hal yang diuji | Gemini (sekarang) | Claude (uji kertas) |
|---|---|---|
| Riset | Tidak ada tahap riset terpisah, ide langsung dari 1 panggilan | Riset web nyata per kata kunci, sumber dicatat, sumber spam dibuang |
| Hook | Kalimat caption dipakai ulang jadi hook ("Stop ordering takeout!…") | Hook dibangun dari temuan riset (perdebatan, kesalahan umum, rahasia) |
| Isi VO | Instruksi umum, **tanpa angka suhu/waktu** | Ada suhu, waktu, dan suhu matang yang aman (165°F ayam, 145°F salmon) |
| Caption/resep | **Ada "bocoran" deskripsi properti visual** ke teks resep, mis. *"matte dark-grey heat-resistant silicone tongs"*, *"28cm matte black cast-aluminum skillet with a light oak wooden handle"*. Penonton membaca kalimat aneh ini | Bahasa resep normal. Detail properti hanya ada di prompt gambar |
| Prompt T2I | Panjang (±1.500 huruf/klip), menyebut *"Product Truth: registered products, label locked"* padahal resep ini **tidak punya produk** | Dipisah: **blok gaya brand** (ditulis sekali, dipakai semua klip) + **adegan per klip** (pendek). Tidak ada baris produk kalau tidak ada produk |
| Prompt I2V | Rapi (2 ketukan gerak + SFX) | Format sama, gerakan lebih spesifik ke aksi resep |

**Kesimpulan:** kualitas naskah Claude lebih tajam dan lebih benar secara fakta, dan masalah "bocoran properti ke caption" di Gemini hilang. Format output tetap bisa dibuat sama persis dengan yang dipakai antrean produksi CF Studio (8 klip, `new_vo`, `visual_action`, `t2i_prompt`, `i2v_prompt`). Contoh JSON-nya ada di [contoh_output_wings.json](contoh_output_wings.json).

**Yang belum terbukti:** apakah prompt Claude menghasilkan **gambar/video** yang lebih bagus di G-Labs. Itu baru bisa diketahui dengan uji produksi 1–2 video sungguhan.

---

## Temuan penting di output Gemini (item 2074)

1. **Properti visual bocor ke resep yang dibaca penonton.** Langkah resep di caption berisi "Toss well with matte dark-grey heat-resistant silicone tongs" dan "melt butter in the 28cm matte black cast-aluminum skillet with a light oak wooden handle". Ini deskripsi untuk gambar, bukan untuk manusia. Kemungkinan karena Gemini menulis resep dan prompt visual dalam satu panggilan yang sama.
2. **Hook = kalimat pertama caption.** VO klip 1 sama persis dengan pembuka caption. Tidak ada rasa penasaran.
3. **VO tanpa angka.** "Load your air fryer basket, then set for the first crisping" — penonton tidak tahu berapa derajat dan berapa menit.
4. **Baris produk di resep tanpa produk.** Prompt T2I menyebut "Product Truth: High fidelity photography of registered products, label geometry locked" padahal HabitFolk tidak sedang mempromosikan produk.

---

## AGENT 1 — Hasil riset (yang akan disimpan ke tabel `keyword_research`)

| Kata kunci | Sudut pandang terkuat | Fakta kunci yang dipakai | Catatan sumber |
|---|---|---|---|
| air fryer chicken wings recipe | Perdebatan **baking powder vs cornstarch** | Kering-kan sayap dulu; cornstarch lebih disukai rasanya; satu lapis; 380°F lalu naik 400°F; matang 165°F | Budget Bytes, The Takeout, Get On My Plate. Situs spam dibuang |
| air fryer salmon recipe | **Kesalahan #1: kelamaan dimasak** | 400°F, 8–12 menit tergantung tebal; matang 145°F (USDA); jangan penuh-penuhi keranjang | Tasting Table, The Daily Meal, Chowhound |
| air fryer shrimp recipe | **Langsung dari beku, tanpa dicairkan** | Beku mentah ±9–12 menit, sudah dicairkan ±6–8 menit; kocok di tengah; bentuk "C" = pas, "O" = kematangan | Recipe This, Running to the Kitchen, Tasting Table |
| air fryer chicken breast recipes | **"Bukan salah air fryer-nya" — 2 langkah yang dilewatkan** | Brine 30 menit; 375°F; balik di tengah; matang 165°F; istirahatkan 5–10 menit | Well Plated, Skinnytaste, Simply Home Cooked |
| air fryer chicken tenders recipe | **Rahasia: sangrai panko dulu** | Panko tanpa minyak jadi pucat; tepung → telur → panko; 400°F; matang 165°F | Spend With Pennies, The Real Food Dietitians, Striped Spatula |

Catatan Agent 1: klaim "viral/trending" **tidak bisa dibuktikan** dari hasil pencarian, jadi tidak dipakai di naskah. Beberapa situs berisi angka statistik tanpa sumber (mis. halaman alibaba.com), dan angka itu dibuang.

---

## AGENT 2 — Naskah (hook, storyboard, VO, aksi visual, caption)

Format: 8 klip × ±8 detik, mengikuti format HabitFolk yang sudah ada (klip 8 = CTA aplikasi).

### 1) Air Fryer Chicken Wings — *"Cornstarch beats baking powder"*

| Klip | VO | Aksi visual |
|---|---|---|
| 1 (Hook) | Most wing recipes say baking powder. Chefs say cornstarch. Here's the crispiest way to make wings in your air fryer. | Close-up sayap matang keemasan dipatahkan, kulit renyah retak, uap naik |
| 2 | Pat the wings bone-dry. Any moisture left on the skin turns into steam, not crunch. | Tisu dapur menekan sayap mentah di atas talenan |
| 3 | One tablespoon of cornstarch, garlic powder, smoked paprika and salt. Toss until every wing looks dusty. | Bumbu ditabur ke mangkuk, sayap diaduk sampai berlapis merata |
| 4 | Single layer, no overlapping. Air fry at 380 degrees for 15 minutes. | Sayap disusun berjarak di keranjang air fryer |
| 5 | Flip, then crank it to 400 for another 10 to 12 minutes, until deep golden and 165 inside. | Sayap dibalik dengan penjepit, warna sudah keemasan |
| 6 | Meanwhile, melt butter with fresh garlic and chili flakes. One minute, don't let it brown. | Mentega meleleh di wajan, bawang putih cincang masuk, berbuih |
| 7 | Toss the hot wings in the garlic butter. Listen to that. | Sayap panas diaduk dengan saus mentega mengkilap (momen ASMR) |
| 8 (CTA) | Want more air fryer recipes? Get the app through the link in my bio. | Piring saji sayap dengan peterseli, tangan mengambil satu |

**Caption (pembuka):** Cornstarch, not baking powder. That's the difference between "pretty crispy" and shatter-crisp air fryer wings. 🍗
*(Diikuti resep lengkap: bahan, langkah, tips, dengan format yang sama seperti caption HabitFolk sekarang, tapi tanpa deskripsi properti.)*
**Hashtags:** #AirFryerWings #CrispyWings #GarlicButterWings #AirFryerRecipes #WingNight #EasyDinner #GameDayFood #HomeCooking

### 2) Air Fryer Salmon — *"Kesalahan nomor satu"*

| Klip | VO | Aksi visual |
|---|---|---|
| 1 (Hook) | The number one air fryer salmon mistake? Cooking it too long. Here's the 10-minute fix. | Salmon glazed dibelah garpu, bagian dalam lembap dan berlapis |
| 2 | Pat a one-inch fillet dry. Brush with a little oil, then salt, pepper and garlic powder. | Fillet ditepuk kering, dioles kuas minyak |
| 3 | For the glaze: honey, soy sauce, Dijon and a squeeze of lemon. Stir until glossy. | Saus diaduk di mangkuk kecil, kilau madu |
| 4 | Preheat to 400. Fillets skin-side down, with space between them. | Fillet ditaruh berjarak di keranjang |
| 5 | Brush on half the glaze and air fry 8 to 10 minutes for a one-inch fillet. | Glaze dioles, keranjang didorong masuk |
| 6 | Check the thickest part. 145 degrees, or it flakes easily with a fork. Pull it right away. | Termometer ditusuk ke bagian tebal |
| 7 | Last brush of glaze, a squeeze of lemon, sesame and green onion. | Taburan wijen dan daun bawang, perasan lemon |
| 8 (CTA) | Want more air fryer recipes? Get the app through the link in my bio. | Salmon di atas nasi, sendok masuk ke bingkai |

**Caption (pembuka):** Dry salmon isn't a recipe problem, it's a timing problem. 10 minutes, one thermometer, perfectly flaky every time. 🐟
**Hashtags:** #AirFryerSalmon #HoneyGarlicSalmon #EasyDinner #HealthyDinner #AirFryerRecipes #SalmonRecipe #15MinuteMeals

### 3) Air Fryer Shrimp — *"Langsung dari freezer"*

| Klip | VO | Aksi visual |
|---|---|---|
| 1 (Hook) | No time to thaw? Air fry shrimp straight from frozen. Dinner in about 12 minutes. | Udang beku dituang dari kantong, lalu potong ke udang matang mengkilap |
| 2 | Rinse the frozen shrimp under cold water to knock off the ice glaze, then pat dry. | Udang dibilas di saringan, lalu ditepuk kering |
| 3 | Toss with olive oil, garlic powder, paprika, chili flakes and salt. | Udang diaduk dengan bumbu merah |
| 4 | Single layer at 400. Frozen takes about 9 to 12 minutes. Thawed, just 6 to 8. | Udang disusun satu lapis di keranjang |
| 5 | Shake halfway. They're done when they curl into a C. An O means overcooked. | Keranjang dikocok; close-up udang bentuk C |
| 6 | Melt butter with lemon juice and chopped parsley. | Mentega leleh, lemon diperas |
| 7 | Toss and serve over rice, in tacos, or straight off the tray. | Udang di atas nasi dan taco |
| 8 (CTA) | Want more air fryer recipes? Get the app through the link in my bio. | Tangan mengambil udang dari piring |

**Caption (pembuka):** Forgot to thaw the shrimp? Good news, you don't have to. 🍤
**Hashtags:** #AirFryerShrimp #GarlicButterShrimp #QuickDinner #FrozenShrimp #AirFryerRecipes #WeeknightDinner

### 4) Air Fryer Chicken Breast — *"Bukan salah air fryer-nya"*

| Klip | VO | Aksi visual |
|---|---|---|
| 1 (Hook) | Dry air fryer chicken breast? It's not the air fryer. It's the two steps you're skipping. | Dada ayam diiris, sari daging terlihat mengalir |
| 2 | Step one: a quick brine. Four cups of water, a quarter cup of salt, 30 minutes. | Dada ayam direndam di mangkuk air garam |
| 3 | Pat it dry, rub with oil, smoked paprika, garlic, a little brown sugar and salt. | Bumbu digosok ke daging |
| 4 | Air fry at 375 for about 9 minutes, then flip. | Daging dibalik di keranjang |
| 5 | Step two: use a thermometer. 165 degrees at the thickest part, and stop right there. | Termometer menunjukkan suhu |
| 6 | Rest it for 5 minutes, so the juices stay in the chicken, not on your board. | Daging istirahat di talenan |
| 7 | Now slice. That's what juicy air fryer chicken looks like. | Irisan close-up, permukaan lembap |
| 8 (CTA) | Want more air fryer recipes? Get the app through the link in my bio. | Irisan ayam di atas salad |

**Caption (pembuka):** Your air fryer isn't drying out your chicken. These two skipped steps are. 🐔
**Hashtags:** #AirFryerChicken #JuicyChicken #ChickenBreast #MealPrep #HighProtein #AirFryerRecipes

### 5) Air Fryer Chicken Tenders — *"Rahasia panko"*

| Klip | VO | Aksi visual |
|---|---|---|
| 1 (Hook) | Crispy chicken tenders, no deep frying. The secret is toasting the panko first. | Tender dipatahkan, kerak renyah berbunyi |
| 2 | Toast panko with one tablespoon of oil until golden. That's where the color comes from. | Panko diaduk di wajan, berubah keemasan |
| 3 | Pat the tenders dry, then season with salt, pepper and garlic powder. | Tender ditepuk kering, dibumbui |
| 4 | Flour, then egg, then toasted panko. Press it on firmly. | Proses celup tiga tahap |
| 5 | Preheat to 400. Single layer, with a light spray on top. | Tender disusun, semprotan minyak tipis |
| 6 | Air fry 10 to 12 minutes, flipping halfway, until 165 inside. | Tender dibalik, sudah keemasan |
| 7 | Snap one in half. Crunchy outside, juicy inside. Honey mustard on the side. | Tender dicocol ke saus |
| 8 (CTA) | Want more air fryer recipes? Get the app through the link in my bio. | Piring tender dengan saus |

**Caption (pembuka):** The reason air fryer tenders come out pale: raw panko. Toast it first. 🔥
**Hashtags:** #AirFryerChickenTenders #ChickenTenders #KidFriendly #CrispyChicken #AirFryerRecipes #EasyDinner

---

## AGENT 3 — Prompt T2I & I2V

### Perubahan cara menyusun prompt
Gemini menulis ulang seluruh gaya brand di setiap klip (±1.500 huruf). Di versi Claude, prompt disusun dari 2 bagian:

1. **Blok gaya brand HabitFolk** — diambil dari Visual Identity yang sudah ada, ditulis **sekali** oleh program, otomatis ditempel di depan setiap klip.
2. **Adegan per klip** — yang ditulis Claude, pendek dan fokus ke aksi klip itu.

Keuntungannya: gaya antar klip lebih konsisten, Claude lebih murah (tidak menulis ulang teks yang sama 8 kali), dan tidak ada baris yang salah tempat (mis. baris produk di resep tanpa produk).

**Blok gaya brand (sama untuk semua klip, disusun program):**
```
(VERTICAL 9:16) --ar 9:16 --no landscape. Photorealistic culinary photography, top-down 45-degree tabletop macro, 100mm macro lens, shallow depth of field. Polished white Carrara marble countertop with soft grey veining, natural oak cutting board, clear glass ramekins, stainless steel prep bowls, dark grey silicone tongs. Soft morning window light from the side, warm appetizing color grade. A chef in charcoal linen sleeves only as soft blur in the background, hands never sharp or prominent. No text, no logos, no packaging.
```

### Prompt per klip — Chicken Wings (lengkap)

| Klip | Adegan T2I (ditulis Claude) | Gerak I2V + SFX (ditulis Claude) |
|---|---|---|
| 1 | Extreme close-up of one golden, crackly air-fried chicken wing being pulled apart above a bowl of glossy garlic-butter wings, steam rising, crisp skin flakes mid-air. | 0–2s: slow push-in as the wing splits, skin cracks. 2–4s: steam curls upward, gentle rack focus to the bowl. SFX: sharp crunch, soft sizzle. |
| 2 | Raw chicken wings on the oak board, a folded paper towel pressing down on them, damp spots visible on the towel. | 0–2s: towel presses and lifts. 2–4s: camera tilts to dry, matte wing skin. SFX: paper rustle. |
| 3 | Stainless bowl of raw wings with a cloud of cornstarch, paprika and garlic powder falling onto them, wings half coated. | 0–2s: spices fall in slow motion. 2–4s: tongs toss wings until evenly dusted. SFX: powder whoosh, light clatter. |
| 4 | Air fryer basket viewed from above, seasoned wings arranged in one neat layer with gaps between each piece. | 0–2s: last wing placed into a gap. 2–4s: basket slides out of frame toward the fryer. SFX: basket click, fan hum. |
| 5 | Half-cooked golden wings in the basket, tongs flipping one wing to show the browned underside. | 0–2s: wing flips over. 2–4s: slow push-in on blistered, golden skin. SFX: crackling fat. |
| 6 | Small dark skillet with melting butter, minced garlic and red chili flakes, gentle foam on the surface. | 0–2s: garlic drops into the butter. 2–4s: foam bubbles spread, slight steam. SFX: soft sizzle. |
| 7 | Crispy wings in the stainless bowl, garlic butter being poured over them in a glossy ribbon. | 0–2s: butter ribbon coats the wings. 2–4s: tongs toss, wings glisten. SFX: loud sizzle, sticky toss. |
| 8 | Warm terracotta stoneware bowl of finished garlic-butter wings with chopped parsley, one wing slightly lifted. | 0–2s: slow orbit around the bowl. 2–4s: wing lifts out of frame. SFX: soft crunch, light ambient kitchen. |

### Prompt per klip — 4 kata kunci lain (adegan T2I ringkas, gerak I2V mengikuti pola yang sama)

**Salmon:** 1) Fork splitting a honey-glazed salmon fillet, moist flaky layers inside, steam. · 2) Brush applying oil to a dry raw fillet on oak board. · 3) Glossy honey-soy-Dijon glaze stirred in a glass ramekin. · 4) Two fillets skin-side down with space in the basket. · 5) Brush spreading glaze over fillets in the basket. · 6) Instant-read thermometer in the thickest part of a cooked fillet. · 7) Sesame seeds and green onion falling on glazed salmon, lemon squeeze. · 8) Salmon over white rice in a stoneware bowl.

**Shrimp:** 1) Frozen shrimp pouring from a bag, cut to glossy cooked shrimp. · 2) Frozen shrimp under cold running water in a steel strainer. · 3) Shrimp tossed with paprika, chili flakes and oil in a bowl. · 4) Single layer of seasoned shrimp in the basket. · 5) Macro of a perfectly C-curled pink shrimp next to an overcooked O-curled one. · 6) Butter melting with lemon juice and parsley in a skillet. · 7) Garlic-butter shrimp over rice and in two small tacos. · 8) Hand picking one shrimp from a serving plate.

**Chicken breast:** 1) Knife slicing a golden chicken breast, juicy cross-section. · 2) Chicken breast submerged in a clear glass bowl of salt brine. · 3) Paprika rub pressed into the meat. · 4) Tongs flipping a breast in the basket. · 5) Thermometer in the thickest part of a cooked breast. · 6) Breast resting on the oak board. · 7) Macro of moist slices fanned out. · 8) Slices over a fresh green salad.

**Chicken tenders:** 1) Golden tender snapped in half, crunchy crust, steam. · 2) Panko toasting golden in a skillet. · 3) Raw tenders patted dry and seasoned. · 4) Tender passing through flour, egg, toasted panko. · 5) Tenders in one layer, light oil mist from above. · 6) Tongs flipping golden tenders in the basket. · 7) Tender dipped into honey mustard. · 8) Plate of tenders with a sauce ramekin.

---

## Perkiraan biaya jika dijalankan otomatis

Untuk 5 kata kunci ini (riset ±1 pencarian per kata kunci + naskah + prompt): **± $2–3 total**, atau ± $0,40–0,60 per video. Belum termasuk biaya G-Labs dan TTS yang sudah ada sekarang.

## Rekomendasi langkah berikutnya

1. **Uji produksi 1 video:** kirim naskah + prompt "Chicken Wings" versi Claude ke antrean produksi yang ada (TTS → G-Labs → render), lalu bandingkan videonya dengan item 2074 versi Gemini. Ini butuh persetujuan karena memakai kuota G-Labs.
2. **Perbaikan cepat untuk Gemini sekarang (terpisah dari proyek Claude):** pisahkan teks resep dari deskripsi properti visual, supaya caption tidak berisi "matte dark-grey heat-resistant silicone tongs".
3. Kalau hasil video setara atau lebih baik → lanjut ke MVP `pipeline_type = 'claude_keyword'` (lihat [USULAN_AUTOPIPELINE_VERSI_CLAUDE.md](../USULAN_AUTOPIPELINE_VERSI_CLAUDE.md)).

---

### Sumber riset
- Wings: [Budget Bytes](https://www.budgetbytes.com/crispy-air-fryer-chicken-wings/), [The Takeout](https://www.thetakeout.com/1899842/extra-crispy-skin-air-fryer-chicken-wings/), [Get On My Plate](https://getonmyplate.com/crispy-air-fryer-chicken-wings-with-cornstarch/), [Chew Out Loud](https://www.chewoutloud.com/air-fryer-chicken-wings-extra-crispy)
- Salmon: [Tasting Table](https://www.tastingtable.com/2203868/salmon-air-fryer-mistakes/), [The Daily Meal](https://www.thedailymeal.com/1853946/mistakes-everyone-makes-air-fryer-salmon), [Chowhound](https://chowhound.com/1607172/how-long-cook-salmon-air-fryer)
- Shrimp: [Recipe This](https://recipethis.com/how-long-to-cook-shrimp-in-air-fryer/), [Running to the Kitchen](https://www.runningtothekitchen.com/air-fryer-frozen-shrimp), [Tasting Table](https://www.tastingtable.com/1682614/thaw-frozen-shrimp-air-fryer/)
- Chicken breast: [Well Plated](https://wellplated.com/air-fryer-chicken-breast), [Skinnytaste](https://www.skinnytaste.com/air-fryer-chicken-breast), [Simply Home Cooked](https://simplyhomecooked.com/juicy-air-fryer-chicken-breast/)
- Tenders: [Spend With Pennies](https://www.spendwithpennies.com/air-fryer-chicken-tenders/), [The Real Food Dietitians](https://therealfooddietitians.com/air-fryer-chicken-tenders/), [Striped Spatula](https://stripedspatula.com/air-fryer-chicken-tenders/)
