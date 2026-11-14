# Visual Identity Hanya Sebagai Identitas Brand

> Tanggal: 2026-11-14 · Status: ANALISA & USULAN (belum ada perubahan kode/data)
> Sumber (read-only): VI `dapurbotani_apothecary_3d_female`, `dapurbotani_apothecary_3d_male`, `siasatsehat_clinical_biohack_3d` (tenant `default_tenant`); brand profile NutriBlend (tenant `tnt_sy-dodot_4ba27b`). **NutriBlend belum punya Visual Identity**: brand profile-nya hanya berisi `visual_signature: "clean aesthetic"`.
> Terkait: `RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md` (Scene Director). Dokumen ini menjadi **komponen K6** dari rencana tersebut.

## 1. Jawaban singkat
**Ya, Visual Identity perlu diubah.** Scene Director (planner menentukan adegan) hanya akan efektif bila VI berhenti mendikte lokasi, properti, waktu, dan urutan adegan. Saat ini sebagian besar isi VI adalah **"set syuting"**, bukan **"identitas brand"**.

## 2. Isi VI sekarang: mana identitas, mana set syuting

| Bagian VI | Isi DapurBotani (female) | Sifat | Nasib |
|---|---|---|---|
| Talent/tangan | Tangan wanita Asia Tenggara, lengan tertutup | Identitas | ✅ Tetap |
| Wardrobe | Linen mocca, **satu warna mutlak** di semua video | Identitas, tapi terlalu kaku | 🔁 Jadi **palet 3–5 warna** (konsisten per video, berganti antar video) |
| Guardrail | Tanpa wajah, tanpa lengan terbuka | Identitas | ✅ Tetap |
| Palet warna / finishing | Soft matte, warm | Identitas | ✅ Tetap |
| **Lokasi** | "Artisanal apothecary studio, black slate stone…" | Set syuting | ❌ Pindah ke planner (VI hanya fallback) |
| **Properti** | Granite mortar, amber dropper, extraction glassware | Set syuting | ❌ Pindah ke planner |
| **Material** | Slate hitam, granit, botol amber | Set syuting | ❌ Hapus (atau jadi aksen kecil opsional) |
| **Cahaya** | "Golden **morning** window light 3500K" | Campuran: karakter cahaya (identitas) + waktu (adegan) | 🔁 Simpan karakter ("hangat alami"), waktunya dari planner |
| **Urutan gaya per klip** (`mode_routing`) | Klip 3 = 3D, dst. | Cetakan | ❌ Hapus, diganti format angle (Scene Director) |
| **Gaya khusus** | "3D organ healing simulations" | Cetakan | 🔁 Jadi "gaya yang diizinkan + batas" (mis. 3D maks 1 klip, hanya angle edukasi) |
| **Framing kamera** | Selalu tangan close-up makro | Cetakan | 🔁 Jadi "framing yang diizinkan" (makro, POV, meja atas, medium) |
| Subject description | "...hands manipulating botanicals on the tabletop" | Aksi adegan | ❌ Aksi dari planner |
| Negative wajib | "messy kitchen", "white marble" | Melarang lokasi | 🔁 Hanya larangan identitas (wajah, lengan terbuka, warna norak) |

### Temuan penting per brand

**DapurBotani**: brand-nya *"resep sehat sederhana, praktis, bahan mudah ditemukan, untuk masyarakat Indonesia"*. Tapi VI-nya *apotek mewah gelap + simulasi 3D organ*. Visual tidak mencerminkan brand. Varian VI **male** memakai tangan **Caucasian** dengan lengan digulung, sementara brand menargetkan audiens Indonesia. Perlu dikonfirmasi apakah memang disengaja.

**SiasatSehat**: brand-nya *"resep wellness rumahan, rempah & buah, alat dapur sederhana (panci kaca, ulekan, saringan)"*. Tapi VI-nya *laboratorium biohacking*: titanium, gelas lab, micro-cement, dan **melarang** "home kitchen, rustic wood, clay pottery". **VI justru melarang dunia brand-nya sendiri.** Ini kontradiksi terbesar.

**NutriBlend**: belum ada VI. Brand-nya *minuman sehat modern (smoothie, protein shake, jus, kopi sehat), alat sederhana, mudah dibuat di rumah*. Ini kesempatan untuk langsung membuat VI dengan format baru.

**Catatan teknis:** kolom **visual_signature di Brand Profile** juga ikut menyuntikkan set syuting ke prompt. Contohnya, DapurBotani: "black slate… 3D bio-cellular CGI". Sistem bahkan memakai teks ini untuk otomatis mengaktifkan mode 3D. Kolom ini perlu dibersihkan bersama VI.

## 3. Bentuk baru: "Kartu Identitas Brand" (8 isian)

| # | Isian | Contoh pertanyaan untuk marketer |
|---|---|---|
| 1 | **Talent & tangan** | Tangan siapa yang mewakili brand? (wanita/pria, warna kulit, kuku, aksesori) |
| 2 | **Aturan aurat & wajah** | Lengan tertutup? Tanpa wajah? |
| 3 | **Palet wardrobe** | 3–5 warna baju yang "brand banget" (dirotasi antar video) |
| 4 | **Palet warna brand** | Warna dominan + 1 warna aksen |
| 5 | **Karakter cahaya** | Hangat-alami / cerah-segar / lembut-pastel (tanpa menyebut pagi/malam) |
| 6 | **Tekstur & finishing** | Film natural / bersih komersial / grain halus |
| 7 | **Signature kecil** (opsional) | 1–2 elemen kecil yang boleh muncul di mana saja sebagai "tanda tangan" brand (mis. serbet linen hijau sage, sendok kayu) |
| 8 | **Batas gaya** | Gaya yang boleh/tidak (3D boleh maks 1 klip? kartun tidak boleh?) + larangan identitas |
| + | **Lokasi cadangan** | Dipakai **hanya** bila planner tidak menyebut lokasi |

Yang **tidak lagi** ada di VI: lokasi wajib, properti wajib, waktu, urutan gaya per klip, dan aksi.

## 4. Draf Kartu Identitas (untuk direview pengguna)

> **Keputusan pengguna 2026-11-14:** DapurBotani = tangan wanita bergamis lengan panjang; SiasatSehat = tangan pria Indonesia (menggantikan tangan Caucasian); NutriBlend = tangan wanita berkaus lengan panjang.

### DapurBotani
1. **Tangan wanita muslimah Indonesia memakai gamis lengan panjang** (lengan longgar sampai pergelangan), kulit sawo matang terang, kuku rapi natural. *Ini ciri khas brand: wajib di semua video.*
2. Tanpa wajah, lengan menutup pergelangan
3. Palet gamis (bergantian antar video, sama dalam satu video): hijau sage, krem, mocca, putih gading, terakota lembut
   - Varian VI **male** (`dapurbotani_apothecary_3d_male`) tidak dipakai di format baru. Data lama dibiarkan (tidak dihapus).
4. Warna brand: hijau daun + krem; aksen kuning madu
5. Cahaya: hangat & alami, seperti rumah yang nyaman
6. Finishing: film natural, tekstur nyata, tidak mengilap berlebihan
7. Signature: serbet/kain linen hijau sage, wadah kaca bening sederhana
8. Batas: 3D maks 1 klip & hanya topik edukasi; tidak kartun; tidak gelap-suram
   - Lokasi cadangan: dapur rumah Indonesia yang terang dan rapi

### SiasatSehat
1. **Tangan pria Indonesia dewasa**, kulit sawo matang, kuku bersih rapi (menggantikan tangan pria Caucasian di VI lama). *Ciri khas brand: wajib di semua video.*
2. Tanpa wajah; kemeja/kaus dengan lengan boleh digulung sampai siku (lengan bawah pria bukan aurat). Tetap tanpa perhiasan mencolok
3. Palet baju (bergantian antar video): abu arang, navy, putih, hijau zaitun, denim
4. Warna brand: putih bersih + hijau rempah; aksen jingga kunyit
5. Cahaya: bersih & segar, terang alami
6. Finishing: bersih, tajam, "proses yang memuaskan dilihat"
7. Signature: panci/gelas kaca bening tempat proses terlihat (sesuai pilar *Healthy Tools*)
8. Batas: 3D maks 1 klip untuk mitos/fakta; dilarang gaya lab futuristik sebagai default
   - Lokasi cadangan: meja dapur rumah yang terang

### NutriBlend (baru)
1. **Tangan wanita muda Indonesia memakai kaus lengan panjang** (pas badan, kasual-sporty), kulit sawo matang, kuku rapi natural. *Ciri khas brand: wajib di semua video.*
2. Tanpa wajah; lengan kaus menutup pergelangan
3. Palet kaus (bergantian antar video): putih, hijau mint, peach, abu muda, lilac
4. Warna brand: cerah segar (hijau, oranye buah); aksen pink buah naga
5. Cahaya: cerah & energik
6. Finishing: bersih komersial, warna buah hidup, tetesan embun dingin
7. Signature: gelas tinggi bening + sedotan, blender
8. Batas: tanpa 3D anatomi; gaya cepat & segar
   - Lokasi cadangan: pantry modern yang terang

## 4b. Menjaga warna baju konsisten dalam 1 video (wajib diimplementasikan)
Palet berganti **antar video**, tetapi **dalam satu video** warna harus identik di semua klip. Mekanisme berlapis:
1. **Dipilih sekali, di awal.** Warna dipilih sistem (bukan AI penulis storyboard) secara deterministik dari palet berdasarkan ID item. Hasilnya sama setiap kali item di-generate ulang. Simpan di `result_json` (mis. `resolved_wardrobe_color`).
2. **Kalimat warna yang sama persis disuntikkan ke setiap klip.** Contoh: "solid sage green loose long-sleeve gamis, plain fabric, no pattern". Dipasang lewat mekanisme penguncian Wardrobe yang sudah ada (penggantian tag `(Wardrobe: …)` di semua prompt gambar & video). AI tidak boleh menulis warnanya sendiri.
3. **Nama warna yang tegas & kain polos.** Palet memakai deskripsi warna yang tidak ambigu (mis. "sage green" + padanan sederhana, bukan "terakota lembut" saja), kain polos tanpa motif. Warna yang sering melenceng di model gambar ditandai dan dihindari.
4. **Gambar referensi lengan per video (opsional, kuat).** Buat 1 gambar referensi "tangan + lengan baju" per video, lalu kirim sebagai referensi ke semua start frame video itu (pola yang sama dengan referensi produk).
5. **Dicek otomatis.** Pemeriksa gambar F2.1 ditambah satu cek: warna lengan di tiap start frame sama dengan `resolved_wardrobe_color`. Bila melenceng, frame dibuat ulang (mengikuti alur QC yang sudah ada).
6. **Video dibuat dari start frame** (image-to-video), sehingga warna di video mengikuti gambar awal yang sudah lolos cek.

## 5. Cara transisi yang aman
1. **VI lama tidak dihapus atau diubah.** Buat VI baru format "Kartu Identitas" sebagai preset terpisah, misalnya `dapurbotani_identity_v3`.
2. Sistem mengenali VI format baru, dan Scene Director otomatis mengambil alih lokasi, properti, waktu, dan alur.
3. Uji di staging: 6 baris yang sama, VI lama vs VI kartu identitas.
4. Bila lolos, campaign baru beralih ke VI kartu identitas. Campaign lama tetap jalan dengan VI lama.
5. Bersihkan `visual_signature` Brand Profile menjadi deskripsi identitas (tanpa lokasi/3D), atau biarkan sistem mengabaikannya saat VI kartu identitas aktif.

## 6. Keputusan yang dibutuhkan dari pengguna
1. Setuju dengan bentuk "Kartu Identitas Brand" 8 isian?
2. Review draf kartu untuk 3 brand (warna, talent, signature, batas 3D).
3. ~~Talent & lengan~~ → **DIPUTUSKAN 2026-11-14** (lihat catatan di §4).
4. Masih terbuka: palet warna, signature kecil, dan batas 3D di draf §4. Default draf dipakai bila pengguna tidak merevisi.
