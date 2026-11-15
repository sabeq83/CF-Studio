# Naskah Uji — NutriBake · Premix Cocoa Powder Premium (v2: konteks diet)

> Draf untuk review. **Belum dikirim ke CF Studio** dan belum memakai kuota.
> Preset: `nutribake_video_produk_reveal2kali`. Format: 6 klip × 4 detik, bahasa Indonesia, 8–9 kata per VO, reveal produk di klip 4 (perkenalan) dan klip 6 (pengingat), soft selling.
> VI: `vi_nutribake_modern_pastry`, yaitu meja quartz abu-abu hangat tanpa urat marmer, cahaya pagi, tanpa wajah (tangan saja).
> Sumber klaim produk: hanya deskripsi dan USP di katalog CF Studio (`pe_1786588017962_4710`).

**Sudut pandang:** orang yang lagi diet tetap ngidam cokelat. Masalahnya, banyak bubuk cokelat instan sudah bergula. Solusinya adalah cokelat murni tanpa gula yang manisnya bisa diatur sendiri.

**Penonton:** ibu rumah tangga dan pekerja yang sedang diet atau mengurangi gula, tapi tetap ingin minuman dan camilan cokelat.

---

## Naskah 6 klip

| Klip | Peran | Voice-over (kata) | Aksi visual | Produk tampil |
|---|---|---|---|---|
| 1 | **Hook** (keinginan + larangan) | Diet tapi ngidam cokelat? Jangan beli yang sudah manis. **(9)** | Tangan meraih segelas minuman cokelat manis berkrim tinggi tanpa merek, lalu berhenti dan menariknya menjauh di meja quartz abu-abu hangat. | Tidak |
| 2 | **Tegangan** (musuh tersembunyi) | Banyak bubuk cokelat sudah bergula, diam-diam bikin diet bocor. **(9)** | Close-up sesendok bubuk cokelat instan berwarna muda dengan butiran gula terlihat, di samping mangkuk kecil berisi gula pasir. | Tidak |
| 3 | **Solusi** | Pilih cokelat murni tanpa gula, manisnya kamu atur sendiri. **(9)** | Bubuk cokelat gelap pekat diayak ke gelas kaca bening. Awan bubuk halus melayang di cahaya pagi. | Tidak |
| 4 | **Reveal 1** (perkenalan) | Premix Cocoa Powder Premium ini tanpa gula sama sekali. **(9)** | Kemasan foil aluminium berdiri di meja quartz. Tangan menyendok bubuk cokelat gelap dari kemasan. | **Ya** |
| 5 | **Cara pakai** | Seduh jadi cokelat hangat atau brownies, pakai pemanis favoritmu. **(9)** | Air hangat dituang ke gelas berisi bubuk cokelat gelap, lalu diaduk. Di sampingnya ada mangkuk kecil pemanis dan sepotong brownies gelap. | Tidak |
| 6 | **Reveal 2** (pengingat + CTA) | Ngidam tetap terkendali, produk ori ada di keranjang ya! **(9)** | Kemasan foil di samping segelas cokelat hangat dan sepotong brownies. Tangan meletakkan sendok di samping kemasan. | **Ya** |

Total 54 kata dalam ±24 detik. Klip terakhir diakhiri kalimat outro wajib preset: *"produk ori ada di keranjang ya!"*

### Alternatif hook (klip 1)
- "Lagi ngurangin gula? Cokelat favoritmu mungkin diam-diam penuh gula." (9 kata)
- "Diet bukan berarti putus sama cokelat, asal tahu caranya." (9 kata)

---

## Paket media sosial

**Caption:**
> Lagi diet tapi ngidam cokelat? Nggak harus berhenti, cukup ganti bubuk cokelatnya. 🍫
>
> Banyak bubuk cokelat instan sudah dicampur gula. Premix Cocoa Powder Premium ini **tanpa tambahan gula**, dibuat dari biji cokelat asli. Rasa cokelatnya pekat dan aromanya kuat, jadi manisnya bisa kamu atur sendiri pakai pemanis pilihanmu.
>
> Bisa diseduh jadi cokelat hangat, dicampur ke oatmeal, atau dibuat brownies.
> Kemasan full aluminium foil, tersedia 50 gr dan 100 gr.
>
> Mau resep cokelat hangat tanpa gulanya? Tulis "MAU" di komentar 👇
> Produk ori ada di keranjang!

**Hashtag:** #NutriBake #CokelatTanpaGula #DietTanpaSiksa #NgurangiGula #MenuDiet #CocoaPowder #MinumanCokelat #BakingSehat

**CTA:** Cek keranjang · komentar "MAU" untuk resep.

---

## Batas aman konteks diet

| Boleh (sesuai data produk) | Sengaja dihindari (tidak ada datanya) |
|---|---|
| "Tanpa gula" / "tanpa tambahan gula" | "Menurunkan berat badan", "membakar lemak" |
| "Manisnya kamu atur sendiri" | "Rendah kalori", "nol kalori" |
| Diet dan ngidam sebagai **situasi penonton** | "Keto-friendly", "aman untuk diabetes" |
| "Diet bocor" sebagai bahasa sehari-hari soal gula tambahan | Angka gizi, kalori, atau karbohidrat |

Catatan:
1. **Klip 2** membahas bubuk cokelat instan secara umum, tanpa menyebut atau menampilkan merek lain.
2. **Nama produk perlu dicek.** Namanya "Premix", padahal deskripsinya menyebut murni tanpa gula dan bermerek Omura. Pastikan nama di VO klip 4 sesuai kemasan yang tampil.
3. "Tanpa gula sama sekali" di klip 4 berasal dari deskripsi: *murni tanpa tambahan gula atau lainnya*. Kalau ingin lebih hati-hati, ganti menjadi "tanpa tambahan gula, dari cokelat asli".

---

## Rencana kirim (setelah disetujui)

- Jalur: `cf_submit_custom_storyboard` dengan `product_id = pe_1786588017962_4710`, `brand_id` NutriBake, dan `preset_key = nutribake_video_produk_reveal2kali`.
- Mode prompt: **`gemini_engineer`**. VO di atas dikunci, sedangkan mesin CF Studio menyempurnakan prompt gambar dan video, termasuk menempelkan foto produk di klip 4 dan 6.
- `product_visible` = true hanya di klip 4 dan 6.
- `enable_social_post` = false, jadi tidak langsung diposting. Publikasi tetap lewat Repliz setelah dicek.
- Sebelum kirim, sebaiknya foto produk di Katalog disetujui dulu, karena statusnya masih *needs review*.
