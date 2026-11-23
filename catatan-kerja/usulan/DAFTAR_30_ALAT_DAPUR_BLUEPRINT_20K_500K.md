# Daftar 30 Produk Alat Dapur & Alat Masak (Rp 20.000 – Rp 500.000)

Disusun berdasarkan audit terhadap **213 blueprint `deconstructed`** di Deconstruction Lab, **270 produk** di katalog (`121` alat dapur eksisting), dan kebutuhan **product bridging 2+2 harian** untuk brand **`nutribake`**, **`dapurbotani`**, dan **`siasatsehat`** (environment Staging `default_tenant`, 23 November 2026).

Seluruh 30 produk di bawah ini:
- Berada pada rentang harga **Rp 20.000 – Rp 500.000**.
- **Belum ada** di antara 121 alat dapur yang sudah terdaftar di katalog.
- Diprioritaskan berdasarkan frekuensi kemunculan di `product_ideas_json` dan aksi adegan pada `original_storyboard_json` dari 213 blueprint.

---

## Ringkasan Audit Kesiapan Blueprint & Katalog

- **Total blueprint `deconstructed` (`default_tenant`)**: 213 (`Baking`: 86, `Health`: 86, `Cooking`: 32, `Skincare`: 8, `Home Care`: 1).
- **Mapping produk brand saat ini (`brand_products`)**:
  - `nutribake`: 68 produk (26 alat dapur, 42 bahan resep)
  - `dapurbotani`: 128 produk (48 alat dapur, 80 bahan resep)
  - `siasatsehat`: 18 produk (**0 alat dapur**, 18 bahan resep)
- **Jadwal aktif `multiplier_campaign` saat ini**: 42 jadwal (14 per brand), seluruhnya masih `product_id = null`.

---

## A. Alat Elektronik & Pemasak Utama (Rp 85.000 – Rp 500.000)

*Kategori High-Impact Bridging — cocok untuk video hero shot alat bekerja langsung.*

| No | Nama Produk | Kisaran Harga | Kata Kunci Cari Marketplace | Cocok ke Brand | Blueprint Terkait (Contoh ID) |
|---:|---|---|---|---|---|
| 1 | Electric Health Pot / Teko Kaca Perebus Herbal Otomatis 1.5L | Rp 190.000 – Rp 450.000 | `electric health pot teko kaca herbal` | `siasatsehat`, `dapurbotani` | ~33 blueprint rebusan herbal/teh (`ba977b0a`, `c589de7b`, `60b4ea6e`) |
| 2 | Air Fryer Digital Low Watt 3.5L–4.5L (Mode Bake) | Rp 320.000 – Rp 500.000 | `air fryer digital low watt 4 liter` | `nutribake`, `dapurbotani` | ~43 blueprint baking diet & panggang sehat (`b4526381`, `c9ae15ab`) |
| 3 | Oven Listrik Low Watt 20L–25L (Pelengkap Finito 12L) | Rp 380.000 – Rp 500.000 | `oven listrik low watt 20 liter baking` | `nutribake` | ~68 blueprint baking kue/roti/brownies loyang standar (`e39e9297`, `272f3a5f`) |
| 4 | Gooseneck Electric Kettle Pengatur Suhu (Leher Angsa) | Rp 180.000 – Rp 400.000 | `gooseneck electric kettle pengatur suhu` | `siasatsehat`, `dapurbotani` | Seduhan teh herbal, rosella, kayu manis, matcha, cokelat diet (`f4f92995`, `ca7c1631`) |
| 5 | Hand Blender / Immersion Blender Stick Stainless | Rp 180.000 – Rp 420.000 | `hand blender stick stainless` | `nutribake`, `dapurbotani`, `siasatsehat` | ~77 blueprint smoothie, mousse, mayones sehat, puree ubi (`b94ac22f`, `f7087bc6`) |
| 6 | Kompor Induksi Mini / Kompor Listrik Portable Low Watt | Rp 220.000 – Rp 450.000 | `kompor induksi mini low watt` | `siasatsehat`, `dapurbotani` | ~21 blueprint rebusan panci kaca/jamu estetik (`7b77ae93`, `774898d6`) |
| 7 | Slow Juicer Mini Portable / Cold Press Juicer Compact | Rp 350.000 – Rp 500.000 | `slow juicer mini cold press` | `siasatsehat`, `dapurbotani` | ~33 blueprint jus detoks apel, seledri, wortel, bit (`bd18c93e`, `dc2a97db`) |
| 8 | Blender Portable USB 6 Mata Pisau Heavy Duty (500ml) | Rp 120.000 – Rp 240.000 | `blender portable usb 6 mata pisau` | `siasatsehat`, `dapurbotani`, `nutribake` | Blueprint smoothie fokus/diet & es krim buah (`a62b0893`, `5563f008`) |
| 9 | Electric Spice & Coffee Grinder Mini Stainless | Rp 120.000 – Rp 250.000 | `grinder bumbu kering elektrik stainless` | `dapurbotani`, `siasatsehat` | Blueprint giling biji adas, jintan, fenugreek, cengkeh (`fe622eac`, `3d05da8f`) |
| 10 | Egg Cooker / Alat Rebus Telur Elektrik Otomatis | Rp 85.000 – Rp 160.000 | `egg cooker alat rebus telur elektrik` | `nutribake`, `dapurbotani` | Blueprint mousse & mayones berbahan telur rebus (`b94ac22f`, `9be03ea6`) |

---

## B. Panci, Wajan & Wadah Tahan Panas/Dingin (Rp 30.000 – Rp 320.000)

*Kategori Core Kitchen & Aesthetic Prop — sangat kuat di visual ASMR & shot meja dapur.*

| No | Nama Produk | Kisaran Harga | Kata Kunci Cari Marketplace | Cocok ke Brand | Blueprint Terkait (Contoh ID) |
|---:|---|---|---|---|---|
| 11 | Wajan Cast Iron Skillet / Ceramic Anti Lengket 20cm | Rp 130.000 – Rp 320.000 | `wajan cast iron skillet 20cm` | `dapurbotani`, `siasatsehat`, `nutribake` | ~7 blueprint sangrai kunyit/rempah, wrap, cabbage roll (`c11f749a`, `7212de0e`) |
| 12 | Panci Susu / Milk Pot Enamel/Keramik Gagang Kayu 16–18cm | Rp 85.000 – Rp 190.000 | `panci susu enamel gagang kayu 16cm` | `siasatsehat`, `dapurbotani`, `nutribake` | ~28 blueprint rebusan rempah, custard, lelehan ganache (`3e3aa73c`, `7a68e7ce`) |
| 13 | Cobek & Ulekan Batu Granit / Mortar & Pestle Estetik | Rp 75.000 – Rp 180.000 | `mortar pestle granit ulekan batu` | `dapurbotani`, `siasatsehat` | Blueprint tumbuk bawang, cengkeh, rempah (selaras visual signature `dapurbotani`) |
| 14 | Talenan Kayu Jati Solid / Wooden Serving Board Estetik | Rp 55.000 – Rp 180.000 | `talenan kayu jati serving board` | `nutribake`, `dapurbotani` | ~16 blueprint potong kue, brownies, buah, & plating (`79b81fdf`, `abc3d61c`) |
| 15 | Set Mangkuk Ramekin Keramik Oven-Safe (Isi 4–6) | Rp 50.000 – Rp 130.000 | `mangkuk ramekin keramik oven` | `nutribake` | Blueprint mug cake, crème brûlée, pudding air fryer (`7a68e7ce`, `2bf2f872`) |
| 16 | Gelas Kaca Ribbed / Mug Kaca Borosilikat Estetik 350ml | Rp 30.000 – Rp 85.000 | `gelas kaca ribbed borosilikat` | `siasatsehat`, `dapurbotani` | ~91 blueprint seduhan teh herbal, iced matcha, latte diet (`036ce860`) |
| 17 | Mason Jar Kaca Tutup Bambu + Sedotan Kaca | Rp 35.000 – Rp 80.000 | `mason jar kaca tutup bambu sedotan` | `nutribake`, `siasatsehat`, `dapurbotani` | Blueprint chia pudding, overnight oats, infused water (`d8c838de`, `f907fa44`) |
| 18 | Wadah Kaca Borosilikat Freezer-Safe (Box Es Krim Sehat) | Rp 65.000 – Rp 160.000 | `wadah kaca borosilikat freezer es krim` | `nutribake`, `dapurbotani` | Blueprint cottage cheese ice cream, sorbet mangga/nanas (`b642c300`, `2375eebd`) |
| 19 | Gelas Takar Kaca Borosilikat 250ml–500ml (Skala ml & cup) | Rp 35.000 – Rp 75.000 | `gelas takar kaca borosilikat 500ml` | `nutribake`, `siasatsehat`, `dapurbotani` | Blueprint baking & takaran air rebusan resep tepat (`d8c838de`) |
| 20 | Meja Putar Kue (Cake Turntable) + Offset Spatula Poles | Rp 55.000 – Rp 140.000 | `meja putar kue turntable spatula` | `nutribake` | Blueprint cake decorating & frosting (`e081f143`, `09924bfd`) |

---

## C. Alat Bantu Prep, Saring & Baking Kecil (Rp 20.000 – Rp 95.000)

*Kategori Impulse Buy / Low-Ticket — sangat mudah diselipkan di adegan persiapan atau penyajian.*

| No | Nama Produk | Kisaran Harga | Kata Kunci Cari Marketplace | Cocok ke Brand | Blueprint Terkait (Contoh ID) |
|---:|---|---|---|---|---|
| 21 | Saringan Teh & Jamu Stainless Mesh Halus Gagang Panjang | Rp 20.000 – Rp 45.000 | `saringan teh jamu stainless halus` | `siasatsehat`, `dapurbotani` | ~52 blueprint saring rebusan cengkeh, kunyit, jus detoks (`ba977b0a`) |
| 22 | Balloon Whisk / Pengocok Adonan Stainless Tebal | Rp 20.000 – Rp 45.000 | `whisk pengocok telur adonan stainless` | `nutribake`, `dapurbotani` | ~63 blueprint aduk manual brownies 1 telur/tanpa mixer (`53c70747`) |
| 23 | Parutan Jahe & Kunyit Mini Stainless / Keramik | Rp 20.000 – Rp 50.000 | `parutan jahe kunyit mini stainless` | `siasatsehat`, `dapurbotani` | Blueprint parut jahe/kunyit/biji alpukat (`f1eb4041`, `6aa49da0`) |
| 24 | Potato Masher Stainless (Penghalus Kentang, Ubi & Pisang) | Rp 25.000 – Rp 65.000 | `potato masher stainless penghalus kentang` | `nutribake`, `dapurbotani` | ~6 blueprint roti kentang & brownies ubi/pisang (`c9ae15ab`, `74c450a8`) |
| 25 | Chasen Matcha Whisk Bambu + Sendok Takar (Matcha Set) | Rp 45.000 – Rp 95.000 | `chasen matcha whisk bambu set` | `siasatsehat`, `nutribake`, `dapurbotani` | Blueprint iced matcha latte (`036ce860`) & minuman serbuk |
| 26 | Cetakan Silikon Batang Cokelat / Energy Bar & Praline | Rp 25.000 – Rp 65.000 | `cetakan silikon coklat batang bar` | `nutribake`, `dapurbotani` | Blueprint cokelat sehat, truffles, protein bar (`6b8c12c0`, `11244f37`) |
| 27 | Pizza Cutter Wheel Stainless (Pemotong Adonan Roll & Pizza) | Rp 20.000 – Rp 50.000 | `pizza cutter wheel stainless` | `nutribake`, `dapurbotani` | Blueprint cinnamon rolls & pizza ubi (`51ec8ac6`, `45231945`) |
| 28 | Kitchen Torch Mini Gas (Pemantik Caramel / Crème Brûlée) | Rp 45.000 – Rp 95.000 | `kitchen torch gas mini kue` | `nutribake` | Blueprint dessert karamel / crème brûlée (`14d079c5`) |
| 29 | Spring Cookie Scoop Stainless (Sendok Takar Adonan & Es Krim) | Rp 25.000 – Rp 65.000 | `cookie scoop stainless es krim` | `nutribake`, `dapurbotani` | ~26 blueprint cookies & es krim (`bc59196f`, `40df34dc`) |
| 30 | Set Sendok Takar Stainless + Penjepit Makanan Silikon | Rp 25.000 – Rp 60.000 | `sendok takar ukur stainless set` | `nutribake`, `dapurbotani`, `siasatsehat` | Universal untuk takaran rempah/chia & angkat kukusan |

---

## Catatan Penting: Alat yang Sudah Ada di Database (Jangan Input Ulang)

Sebagian alat dapur penting sebenarnya **sudah masuk tabel `product_extractions`**, tetapi belum ter-mapping ke brand di `brand_products` (khususnya `siasatsehat` yang masih **0 alat dapur**):

- `pe_1780712278685` — *Blender Philips 3000 Series HR2042/13*
- `pe_1784449324420_841` — *Borosilicate Teko Kaca dengan Tutup Kayu dan Infuser*
- `pe_1781420171521_196` — *SAMONO Blender Chopper Elektrik MC200*
- `pe_1781360120731_877` — *Alat Pemeras Jeruk Lemon Stainless*
- `pe_1795244192996_846` — *Sinda Steamer 30 cm 2 Susun*
- `pe_1795092448042_8649` — *PANOVA Stock Pot Stainless Steel 20cm*
- `pe_1781420173223_989` — *Goto Shane Milk Frother Portable*
- `pe_1782648834064_82` — *Timbangan Dapur Digital SF-400 10kg*
- `pe_1781420173675_405` — *Oven Listrik Finito 12L Minimalis*
- `pe_1781358280332_962` — *Panci Kaca Borosilicate Gagang Kayu* (sudah map ke `dapurbotani`, layak di-map juga ke `siasatsehat`)
