# Usulan: VI NutriBake v5 — Membakukan Tampilan Video CFA ke Visual Identity

Tanggal: 17 November 2026. Tenant: `default_tenant`. VI: `vi_nutribake_modern_pastry` (aktif v4).
Status: **usulan, belum diterapkan.** Tidak ada perubahan kode aplikasi.
Dokumen terkait: `USULAN_KONSISTENSI_VI_MULTIPLIER_NUTRIBAKE.md` (analisis Codex).

## Latar belakang

Pengguna menyukai tampilan 3 video CFA NutriBake yang tayang 17 November 2026:

| Konten | Produk | Warna baju |
|---|---|---|
| `opc_2213` Dark chocolate hangat, manisnya kamu yang atur | Nutrifarm Dark Chocolate Powder | Terracotta Clay Linen |
| `opc_2214` Sarapan sehat tanpa masak pagi-pagi | Rolled Oat Premium Sahabat | Deep Sage Linen |
| `opc_2215` Roti selai kacang, sarapan lima menit | Beorganik Peanut Butter | Terracotta Clay Linen |

Ciri yang disukai: lengan panjang sampai pergelangan dengan manset rapi, kain polos linen/katun satu warna, warna berganti antar-video tetapi tetap sama di semua klip dalam satu video, meja quartz abu hangat.

## Temuan: tampilan itu tidak berasal dari VI

- VI v4 menulis `sleeve_policy: forearms_exposed` dan wardrobe "Clean oatmeal cotton rolled sleeves".
- VI v4 **tidak punya** `wardrobe.palette`. Karena itu `resolveVideoVariety` (`lib/metaphor-policy.js`) memakai daftar bawaan `MODEST_WARDROBE_ROTATION` (Sage, Navy, Charcoal, Mocca, Maroon, Terracotta). Semua isinya lengan panjang dengan manset di pergelangan.
- Jalur CFA dan Kampanye Produk mengganti blok wardrobe dengan hasil rotasi itu (`lib/scheduler-processors.js:5693`, `lib/opc-start-frame-request.js`). Jadi hasil yang disukai muncul dari bawaan sistem, bukan dari VI.
- Multiplier tidak memakai rotasi. Multiplier membaca `wardrobe.custom_description` + `primary_color` (`lib/visual-override-resolver.js:277-298`), sehingga keluarnya oatmeal lengan digulung sesuai VI v4.

**Tujuan v5:** tuliskan tampilan CFA itu secara eksplisit di VI, supaya tidak bergantung pada bawaan sistem dan Multiplier ikut membacanya.

## Perubahan yang diusulkan (Sebelum → Sesudah)

Hanya kolom di bawah yang berubah. Kolom lain (style, kamera, pencahayaan, environment, rendering, komposisi, mode_routing) tetap sama dengan v4.

### 1. Aturan lengan

```text
Sebelum: wardrobe.sleeve_policy = "forearms_exposed"
Sesudah: wardrobe.sleeve_policy = "wrists_covered"
```

### 2. Daftar warna baju (baru)

```text
Sebelum: (tidak ada wardrobe.palette)
Sesudah: wardrobe.palette = [
  "Terracotta Clay Linen",
  "Deep Sage Linen",
  "Deep Charcoal Linen",
  "Espresso Mocca Linen",
  "Deep Maroon Cotton",
  "Deep Navy Cotton"
]
```

Daftar ini sama dengan rotasi bawaan yang menghasilkan video yang disukai. Pengguna boleh mencoret atau menambah warna. Karena ditulis sebagai teks, sistem otomatis menambahkan "loose opaque modest long-sleeve garment completely covering forearms with fitted cuffs visible at wrists, single uniform solid color, plain unprinted…" (`lib/metaphor-policy.js:87-93`). Tidak ada lagi kata "gamis/abaya" seperti di daftar bawaan, sehingga tidak bertabrakan dengan larangan busana syari.

> **Wajib bersamaan dengan poin 1.** Jika palette diisi tetapi lengan masih `forearms_exposed`, sistem akan menulis "neatly rolled-to-elbow shirt".

### 3. Deskripsi baju tetap (dipakai Multiplier)

```text
Sebelum: wardrobe.custom_description = "Clean oatmeal cotton rolled sleeves, soft-blurred in creamy bokeh background"
         wardrobe.primary_color      = "oatmeal_neutral"
         wardrobe.secondary_color    = "sand_cream"
Sesudah: wardrobe.custom_description = "Plain solid-color matte linen or cotton long-sleeve top, sleeves fully covering forearms down to the wrists with neat fitted wrist cuffs, sleeves never rolled up, single uniform color with no pattern, print, stripes or embroidery, same garment in every clip"
         wardrobe.primary_color      = "terracotta clay"
         wardrobe.secondary_color    = (dikosongkan)
```

Catatan: keinginan pengguna (17 Nov 2026) adalah warna **berganti tiap video, tetapi sama di semua klip dalam satu video**, sama seperti CFA. Multiplier belum bisa melakukannya karena tidak membaca `wardrobe.palette`. `primary_color` terracotta hanya **warna sementara** sampai Tahap 2 (perubahan kode kecil, lihat di bawah) selesai diuji. Setelah Tahap 2 aktif, Multiplier memakai palette yang sama dengan CFA.

### 4. Deskripsi tangan

```text
Sebelum: subject.custom_description = "Minimalist out-of-focus hand movement in creamy background bokeh (f/1.4), keeping 100% visual focus on rich chocolate ganache, dough texture, and crumb fractures."
Sesudah: subject.custom_description = "the same adult Indonesian woman baker in every clip, aged about 25–35, light-to-medium warm beige skin tone, smooth natural skin with normal fine creases, slender fingers, short clean unpolished nails, no rings, no bracelets, no watch, hands moving gently while the food stays the visual focus"
```

Alasan: sistem membungkus kolom ini menjadi "…forearms and hands of {isi kolom}…" (`lib/visual-override-resolver.js:235`). Isi lama berupa gaya kamera, sehingga prompt jadi "hands of Minimalist out-of-focus hand movement…" dan identitas tangan tidak jelas. Isi baru adalah deskripsi orang. Efek bokeh tetap dijaga oleh kolom kamera (`depth_of_field: shallow`, `lens_look: macro_closeup`).

**Pilihan warna kulit — DIPUTUSKAN 17 Nov 2026: A (beige terang-sedang).**
- A. `light-to-medium warm beige skin tone` (usulan Codex)
- B. `medium warm sawo matang skin tone`
- C. Tidak ditulis. Biarkan seperti video yang disukai (berisiko berubah-ubah)

Audit belum mencocokkan warna kulit pada 3 video yang disukai. Disarankan pengguna menonton ulang satu video lalu memilih yang paling mirip.

### 5. Larangan (negative prompts)

```text
Sebelum: ["human face", "syari dress", "white marble veining", "rough black slate", "herbal amber medicine bottles", "greasy surfaces"]
Sesudah: ["human face", "hijab", "headscarf", "veil", "loose flowing robe sleeves", "rolled-up sleeves", "bare forearms", "rings", "bracelets", "nail polish", "white marble veining", "rough black slate", "herbal amber medicine bottles", "greasy surfaces"]
```

"syari dress" diganti larangan yang spesifik: tetap mencegah busana syari/kerudung, tetapi tidak menolak baju lengan panjang. Ditambah larangan lengan digulung dan perhiasan supaya selaras dengan poin 1 dan 4.

## Dampak

| Jalur | Dampak |
|---|---|
| CFA NutriBake | Hampir tidak berubah. Warna kini diambil dari palette VI (isinya sama dengan bawaan). Deskripsi tangan dan larangan baru ikut terbaca. |
| Kampanye Produk NutriBake | Sama dengan CFA. |
| Multiplier NutriBake | Berubah ke lengan panjang terracotta + tangan yang jelas. Kestabilan tangan antar-klip **belum tentu** setara CFA karena preset masih pure T2V. |
| Brand lain | Tidak terpengaruh. |

## Cara menerapkan (disarankan bertahap, karena Staging = konten aktif)

1. **Uji dulu tanpa menyentuh v4.** Buat VI salinan, misalnya "NutriBake v5 (uji)", lalu isi perubahan di atas. Sambungkan **hanya** preset `multiplier_nutribake` ke salinan ini. CFA dan Kampanye Produk tetap memakai v4.
2. Buat 2 video Multiplier dari blueprint yang sama. Cek: lengan tertutup, warna sama di semua klip, tangan mirip antar-klip, meja quartz tanpa marmer.
3. Jika lolos, terapkan isi yang sama ke VI utama `vi_nutribake_modern_pastry` (naik ke v5). Setelah itu cek video CFA NutriBake pertama keesokan harinya.
4. Jika tangan Multiplier masih berubah-ubah, uji ganti mode visual preset Multiplier dari `pure_t2v` ke hybrid di Dev (sesuai SOP), terpisah dari usulan ini.

Pengubahan dilakukan lewat menu Visual Identity di Staging, atau lewat MCP `cf_update_visual_identity` / `cf_create_visual_identity` atas persetujuan pengguna.

## Log penerapan Tahap 1

**17 November 2026 (Staging, `default_tenant`)**
- [x] VI uji dibuat: `vi_mwkmjhzd_f5a40b44` (`nutribake_modern_pastry_v5_uji`, "Nutribake v5 (uji) — Lengan Panjang & Palette CFA"), berisi poin 1–5 di atas dengan warna kulit A.
- [x] Preset `multiplier_nutribake` (revisi 1 → 2) disambungkan ke VI uji. Kolom lain preset tidak berubah, termasuk mode `pure_t2v`.
- [x] VI utama `vi_nutribake_modern_pastry` v4 **tidak diubah**. CFA dan Kampanye Produk masih memakai v4.
- [ ] Uji 2 video Multiplier dan tinjau hasilnya.
  - Uji 1: `mul_261117_d11lrc` ("Hack Nyemil Malam: Bikin Choco Chips Sehat Modal Bahan Dapur"). Blueprint sama dengan `mul_261117_vc3tw3` (pembanding VI v4), VI `vi_mwkmjhzd_f5a40b44` terkonfirmasi di task, tanpa produk bridging. Dibuat 17 Nov 2026 11:45 WIB. **Diblokir sebelum TTS** karena klaim "gula darah" di hook; revisi auditor 5 baris tidak cocok dengan 3 klip. Prompt sudah memuat anchor tangan & wardrobe VI baru, tetapi lokasi tertulis "Warm Indonesian home kitchen counter during late evening" (bukan quartz) — penulis naskah Multiplier menimpa environment VI.
  - Uji 2: `mul_261117_44nefx` ("Coklat Mewah Modal Dapur: Solusi Cerdas Hemat Belanja Bulanan"), blueprint `6b8c12c0-6657-4384-bbbb-79c408cdadf5`, sudut ang_3 (hemat belanja, tanpa klaim kesehatan).
- [ ] Jika lolos: salin isi VI uji ke VI utama (v5), kembalikan preset Multiplier ke `vi_nutribake_modern_pastry`, lalu arsipkan VI uji.

**Cara membatalkan:** ubah `visual_identity_preset_id` preset `multiplier_nutribake` kembali ke `vi_nutribake_modern_pastry`.

**Catatan saat membuat VI uji:** sistem melengkapi kolom yang tidak diisi dengan nilai bawaan, misalnya `metaphor_engine.hands_policy: zero_hands` dan `environment.policy: brand_locked`. Saat memindahkan isi ke VI utama, ubah hanya kolom poin 1–5 agar nilai lain v4 tetap sama.

## Tahap 2 — Rotasi warna per-video untuk Multiplier (perubahan kode kecil)

Tujuan: Multiplier memilih satu warna dari `wardrobe.palette` VI untuk tiap video, lalu memakainya di semua klip video itu. Caranya sama dengan CFA.

- Lokasi: `lib/re-multiplier-worker.js` sekitar baris 474–489, setelah `resolveVisualOverrides`.
- Logika: jika VI punya `wardrobe.palette` dan subject manusia faceless, panggil `resolveVideoVariety(<id task>, { paletteEntries, sleevePolicy })` dari `lib/metaphor-policy.js`, lalu isi `wardrobeStyleCustom` dengan `variety.wardrobeDesc`.
- Pilihan warna ditentukan dari ID task, jadi retry otomatis mendapat warna yang sama. Simpan label warna terpilih di data task untuk audit.
- Tanpa palette di VI: perilaku lama tidak berubah. Brand lain tidak terpengaruh.
- Alur SOP: branch `fitur/multiplier-rotasi-warna` → uji di Dev (5020) → persetujuan pengguna → `main` → Staging.

Kode sebelum (ringkas):

```js
wardrobeStyle: resolvedVisuals.wardrobe_style || aesthetics.wardrobeStyle,
wardrobeStyleCustom: resolvedVisuals.wardrobe_style_custom || aesthetics.wardrobeStyleCustom || '',
```

Kode sesudah (usulan, ringkas):

```js
const viPalette = viStructured?.wardrobe?.palette;
let rotatedWardrobe = null;
if (Array.isArray(viPalette) && viPalette.length > 0) {
  const variety = resolveVideoVariety(task.id, {
    paletteEntries: viPalette,
    sleevePolicy: viStructured?.wardrobe?.sleeve_policy || 'wrists_covered'
  });
  rotatedWardrobe = variety.wardrobeDesc; // label disimpan ke task untuk audit
}
// ...
wardrobeStyle: rotatedWardrobe ? 'custom' : (resolvedVisuals.wardrobe_style || aesthetics.wardrobeStyle),
wardrobeStyleCustom: rotatedWardrobe || resolvedVisuals.wardrobe_style_custom || aesthetics.wardrobeStyleCustom || '',
```

(Nama variabel `viStructured` dan `task` perlu disesuaikan dengan kode yang ada saat implementasi.)

## Di luar cakupan (butuh perubahan kode, usulan terpisah)

- Gambar acuan tangan+baju per-video dan start frame untuk Multiplier (mode hybrid).
- Menyelaraskan nomor versi VI di kolom campaign dengan snapshot.

## Keputusan yang dibutuhkan dari pengguna

- [ ] Setuju daftar warna (poin 2), atau ada yang dicoret/ditambah
- [x] Warna Multiplier: **berganti tiap video, sama dalam satu video** (diputuskan 17 Nov 2026). Terracotta hanya sementara sampai Tahap 2 aktif.
- [ ] Setuju Tahap 2 (perubahan kode kecil di branch fitur, diuji di Dev)
- [x] Warna kulit tangan (poin 4): **A — light-to-medium warm beige** (diputuskan 17 Nov 2026)
- [ ] Setuju penerapan bertahap (uji di Multiplier dulu)
