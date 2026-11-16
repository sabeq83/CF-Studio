# Usulan Pengembangan: Finishing Video CF Studio (Motion Text & Animasi)

Tanggal: 13 Nov 2026 · Status: usulan disetujui untuk dikerjakan, belum ada kode yang diubah

Tujuan: menaikkan retensi (3 detik pertama dan rata-rata durasi tonton) lewat sentuhan akhir video, tanpa mengulang generate video AI.

Dokumen terkait:
- Mockup interaktif: https://claude.ai/artifact/CdWRnLwNv1pJj4dGg1CvjB (tab Resep dan Wellness)
- Source mockup (acuan visual dan timing): `mockup_finishing_preview.html` di root repo
- Instruksi eksekusi: `antigravity_finishing_pass_instructions.md` di root repo

---

## 1. Kondisi saat ini (hasil baca kode)

Alur render ada di `lib/video-studio-processor.js` → `processTtsStudioMuxing()` (dipakai OPC, RE, Multiplier):

```
per klip:  video AI + VO  → processVideoMuxing (sync stretch/loop/freeze)   [encode #1]
           + motion text  → PNG Sharp/SVG 15fps → ffmpeg overlay             [encode #2]
gabung:    xfade video + acrossfade audio (+ BGM opsional)                    [encode #3]
```

Motion text: `lib/motion-text-engine.js` → `generateMotionTextFrames()`, 3 gaya (`floating_white_yellow`, `floating_black_on_white`, `minimal_white`).

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| K1 | Waktu kata ditebak: semua kata dibagi rata dalam 75% durasi klip, bukan dari waktu ucapan asli. Belum ada word timestamp dari TTS mana pun (ElevenLabs masih memakai endpoint biasa, bukan `/with-timestamps`) | `motion-text-engine.js:88-91`, `elevenlabs-tts.js:75` | Teks bisa mendahului atau tertinggal dari suara |
| K2 | Parameter `effect` (pop_bounce/typewriter), `tag`, `brand` dikirim tapi **tidak dipakai**. Efek hook/story/CTA di setting campaign tidak berpengaruh | `video-studio-processor.js:705-717` | Setting UI tidak berpengaruh ke hasil |
| K3 | Semua kata VO tampil, ukuran kecil (4,8% lebar, sekitar 35px di 720p), selalu di bawah. Tidak ada hierarki penekanan | `motion-text-engine.js:102` | Tidak ada kata yang "menonjol" |
| K4 | Teks dibakar **per klip sebelum xfade**, jadi saat transisi dua kalimat tampil bertumpuk (ghosting). `acrossfade` juga memotong ujung VO | `video-studio-processor.js:724, 795` | Terlihat jelas di kedua sampel |
| K5 | Overlay 15fps di atas video 24/30fps | `video-studio-processor.js:717` | Animasi patah-patah |
| K6 | Font `Inter` hanya disebut lewat nama, tidak ada file font. Jika tidak terpasang di server, librsvg memakai font sistem | `motion-text-engine.js` | Gaya font tidak terkendali |
| K7 | Lebar pill (gaya hitam-putih) ditebak dari jumlah huruf | `motion-text-engine.js:200` | Pill tumpang tindih |
| K8 | Tidak ada normalisasi loudness | seluruh pipeline | Lihat A3 |
| K9 | Tiga kali re-encode (CRF 20 lalu default) | — | Kualitas turun, render lebih lama |
| K10 | ffmpeg di Mac ini **tidak punya** filter `ass/subtitles/drawtext` (tanpa libass/freetype). `zoompan` dan `loudnorm` tersedia | `/opt/homebrew/bin/ffmpeg` | Jalur ASS butuh build ffmpeg ulang, jadi lebih baik tetap SVG/Remotion |
| K11 | **Remotion sudah terpasang** (`lib/remotion-engine.js`, `remotion/components/KineticHeadline.jsx`, `CtaBanner.jsx`), tapi baru dipakai untuk explainer tanpa video AI | `remotion/` | Fondasi animasi kelas CapCut sudah ada |

## 2. Analisa video sampel ContentFlow Hub

**A. `opc_2117`**: dapurbotani, Garlibee Madu Bawang Lanang, 14,5 dtk, 4 klip × ~4 dtk, gaya `floating_white_yellow`

1. **Frame pertama hanya berisi kata "HASIL".** Tidak ada judul hook, padahal 0–1 dtk menentukan orang berhenti scroll, dan frame ini juga jadi thumbnail.
2. Caption kecil di bawah, penuh satu kalimat, tampil di **setiap frame**. Tidak ada kata yang ditekankan ("KOLESTEROL", "MADU MENTAH", "BAWANG LANANG" tampil sama dengan kata lain).
3. Ghosting saat transisi, misalnya detik ~6 dan ~11: dua kalimat terlihat bertumpuk.
4. Visual tenang dan statis (hijab membelakangi, gerak lambat), tanpa zoom atau punch-in. Bagus untuk estetika, tapi energinya rendah untuk retensi.
5. Produk (toples) terlihat di klip 2–3, tapi **tidak ada nama atau kartu produk** di layar. CTA "link di bio" hanya berupa teks caption biasa.
6. Loudness **-24 LUFS** (target TikTok/Reels sekitar -14). Suara jauh lebih pelan daripada video lain di feed.

**B. `multiplier_mul_261113_qt67yl`**: nutribake, Brownies Cocoa, 18 dtk, gaya `floating_black_on_white`

1. **Bug: tag jeda TTS `<#1.0#>` muncul di layar** (detik ~10–12). Regex di `tts-text-sanitizer.js` sebenarnya cocok untuk bentuk ini. Kemungkinan teks sampai dalam bentuk lain (ter-escape atau ada karakter lain), atau versi kode di server produksi belum sama. Perlu dicek di Mac mini.
2. Pill menumpuk dan rapat (K7). Teks 3–4 baris menutupi area adonan yang sedang diaduk.
3. Ini video resep, dan **data bahan sudah ada** di `recipe_text_markdown` (2 pisang, 1 telur, 3 sdm cocoa…), tapi tidak tampil sebagai overlay. Penonton resep sering menjeda video untuk melihat bahan, dan itu sinyal retensi yang bagus.
4. Frame 0 = "PUNYA". Hook "Brownies tanpa gula cuma 3 bahan" (sudah ada di field `hook`) tidak muncul di layar.
5. Loudness -24,4 LUFS.

## 3. Jawaban pertanyaan

### Q1. Motion text hanya untuk kata penting, besar, font khusus, durasi singkat: **BISA**

Konsep **"Keyword Punch"**: 1–2 kata kunci per klip muncul besar di tengah layar selama 0,6–1,2 detik, tepat saat kata itu diucapkan, lalu hilang.

Tiga syarat:

1. **Waktu kata yang akurat** (memperbaiki K1)
   - ElevenLabs: ganti ke endpoint `/v1/text-to-speech/{voice}/with-timestamps` (mengembalikan alignment per karakter). Biaya sama.
   - Gemini/MiniMax: jalankan forced alignment lokal, yaitu `whisper.cpp` (model `small`, word-level timestamps) di Mac mini, per file audio klip. Sekitar 1–2 detik per klip.
   - Simpan sebagai `word_timings_json` di tabel klip TTS. Jika gagal, kembali ke estimasi sekarang.

2. **Pemilihan kata kunci** di tahap storyboard (LLM, satu field tambahan per scene):
   ```json
   "emphasis": [
     { "text": "3 BAHAN", "type": "number" },
     { "text": "TANPA GULA", "type": "benefit" }
   ]
   ```
   Aturan validasi: harus substring persis dari VO scene itu, 1–3 kata, maksimal 2 per klip. Prioritas: angka, nama produk, negasi ("TANPA…"), kata nyeri/masalah, kata hasil ("FUDGY").
   **Compliance:** untuk produk herbal, kata klaim kesehatan (mis. "KOLESTEROL", "JANTUNG") **tidak boleh** dijadikan punch yang dikaitkan dengan produk. Jalankan lewat aturan `herbal-compliance` yang sudah ada. Punch diarahkan ke kata non-klaim ("MADU MENTAH", "RUTINITAS PAGI").

3. **Gaya visual**
   - Ukuran 11–16% lebar layar (3× lebih besar dari sekarang), posisi di sekitar 35–45% tinggi layar (area mata, aman dari UI TikTok).
   - Font tebal yang dipasang sebagai file di server: contoh **Anton**, **Bebas Neue**, **Montserrat Black**, **Poppins ExtraBold** (semua lisensi OFL, gratis untuk komersial).
   - Warna berdasarkan `type`: number = kuning, benefit = hijau limau, alarm/masalah = merah, produk = warna brand dari Visual Identity.
   - Animasi: pop (skala 0 → 115% → 100% dalam 5 frame), sedikit miring/rotasi, shake untuk tipe alarm, lalu keluar cepat.
   - SFX "pop/whoosh" pendek pada timestamp kata, otomatis diredam di bawah VO.

**Mode caption baru** (field campaign `caption_mode`):
| Mode | Isi |
|---|---|
| `full` | Seperti sekarang (untuk kompatibilitas) |
| `keyword_only` | Hanya Keyword Punch, tanpa subtitle |
| `hybrid` ⭐ rekomendasi | Subtitle kecil per potongan 2–4 kata (bukan kalimat yang terus menumpuk) + Keyword Punch besar |

### Q2. Animasi di atas video AI (tanpa generate ulang): **BISA**

Semua lapisan di bawah memakai data yang **sudah ada** di DB, jadi tidak ada klaim baru:

| Lapisan | Isi | Sumber data | Paling cocok untuk |
|---|---|---|---|
| **Hook Card** (0–1,5 dtk) | Judul besar dari `hook` (tanpa `#Shorts`), muncul di frame 0 | `content_flow_items.hook` | Semua, terutama thumbnail |
| **Ingredient Pop** | Saat VO menyebut "pisang", muncul chip "🍌 2 buah pisang" dengan animasi slide-in, lalu menumpuk jadi checklist | `recipe_text_markdown` bagian Bahan + word timings | Resep (nutribake, sasyahouse) |
| **Step Counter** | Badge "LANGKAH 2/5" di pojok | Langkah resep | Resep |
| **Product Card** | Foto produk (`*_product_image.png` sudah ikut di bundle) + nama, masuk saat produk pertama kali disebut | `product_id` → foto bersih | OPC, Multiplier |
| **CTA Animasi** | Panah memantul + "Cek keranjang kuning 👇" / "Link di bio" sesuai platform, 2 dtk terakhir | CTA per platform di naskah | Semua |
| **Camera motion** | Punch-in 1.0→1.08 saat kata kunci, Ken Burns lambat di klip statis, shake kecil di hook | ffmpeg `zoompan`/`scale+crop` (tersedia) | Visual tenang seperti dapurbotani |
| **Progress bar** | Garis tipis di atas yang terisi sepanjang video | Durasi | Semua (dorong tonton sampai habis) |
| **Transisi** | Ganti `fade` lembut dengan cut + flash/whip singkat. Teks tidak ikut di-crossfade | — | Semua |
| **Sticker/emoji** | ✅ ❌ 🔥 kecil di samping punch | Tipe emphasis | Opsional |

## 4. Arsitektur yang diusulkan

Pindahkan semua teks dan animasi ke **satu "Finishing Pass" setelah video digabung**, dengan timeline global. Ini otomatis menghilangkan ghosting (K4) dan mengurangi re-encode (K9).

```
[1] Storyboard LLM  → + finishing_plan (emphasis, hook_title, overlay hints)  ← divalidasi compliance
[2] TTS             → + word_timings_json per klip (ElevenLabs timestamps / whisper.cpp)
[3] Mux per klip    → video+VO saja, TANPA teks (intermediate pakai CRF 16 atau lossless)
[4] Concat          → base.mp4 + offset tiap klip → timeline global (kata + detik absolut)
[5] Finishing Pass  → Remotion "FinishingComposition":
                        <OffthreadVideo src=base.mp4/> + HookCard + Captions + KeywordPunch
                        + IngredientPop + ProductCard + CTA + ProgressBar
[6] Audio master    → SFX pada timestamp + loudnorm I=-14 LUFS, TP=-1.0
[7] QA otomatis     → frame 0 berisi teks hook? ada tag markup bocor (<#, [, (breath)? teks di safe zone?
```

**Kenapa Remotion untuk langkah [5]:** sudah terpasang, animasi `spring()` setara CapCut, font lewat `@remotion/google-fonts` atau file lokal (memperbaiki K6), dan ukuran teks bisa diukur dengan `measureText` (memperbaiki K7). Komponen `KineticHeadline` dan `CtaBanner` bisa dipakai ulang. Perkiraan render 720p untuk video 15–30 dtk: sekitar 1–2 menit di Mac mini.
**Alternatif lebih ringan:** perluas engine Sharp/SVG yang ada (render di timeline global dengan fps sama dengan video). Lebih cepat dibangun, tapi animasi terbatas.

Contoh input timeline (video brownies):
```json
{
  "hook_title": "BROWNIES TANPA GULA\nCUMA 3 BAHAN",
  "captions": [{ "t": 0.12, "end": 0.95, "text": "Punya banyak pisang" }, "..."],
  "punches": [
    { "t": 1.10, "text": "PISANG MATANG", "type": "benefit" },
    { "t": 11.4, "text": "TANPA GULA", "type": "benefit" },
    { "t": 15.2, "text": "FUDGY!", "type": "number" }
  ],
  "ingredients": [
    { "t": 1.10, "label": "🍌 2 pisang matang" },
    { "t": 3.20, "label": "🥚 1 telur" },
    { "t": 6.40, "label": "🍫 3 sdm cocoa" }
  ],
  "product_card": { "t": 9.8, "image": "product_clean.png", "name": "Premix Cocoa Powder Premium" },
  "cta": { "t": 16.0, "text": "Cek keranjang kuning 👇" }
}
```

## 4b. Template finishing (hasil mockup)

Dua template sudah dibuktikan di mockup memakai klip AI dan VO asli. Semua ukuran di bawah relatif terhadap frame 9:16: `cqw` = % lebar, `cqh` = % tinggi. Pada 720×1280, 1 cqw = 7,2 px dan 1 cqh = 12,8 px.

### Aturan bersama (semua template)

| Elemen | Aturan |
|---|---|
| Base video | Klip digabung dengan **cut** (tanpa xfade). Tiap klip dipotong/di-stretch mengikuti durasi VO klip itu + 0,25 dtk. Audio `loudnorm I=-14:TP=-1.0:LRA=11` |
| Subtitle | Potongan 2–4 kata (putus di tanda baca, maks ~15 huruf per potongan, tidak melewati batas klip). Posisi top 69cqh, Montserrat 900, 6,6cqw, huruf kapital, stroke hitam 0,55cqw. Kata aktif berwarna aksen + skala 1,08. Kata yang sedang di-punch tidak ikut tampil di subtitle. Subtitle disembunyikan saat punch tampil |
| Keyword punch | Anton 16cqw, top 40cqh, stroke hitam 0,6cqw. Masuk dengan pop (back-out, 0,2 dtk), rotasi ±2–3°, keluar 0,15 dtk. Durasi = max(akhir kata + 0,35, awal + 1,0) dtk. Maksimal 2 per klip. Warna per jenis: problem putih (+ goyang 0,3 dtk), benefit #9df27a, product warna brand, cta #ffe14d, result #ffcc3d |
| Gerak kamera | Zoom pelan 1,00→1,045 per klip. Punch-in +0,07 saat punch mulai (naik 0,12 dtk, turun eksponensial ~0,8 dtk). Goyang kecil 0,35 dtk pertama. Titik pusat 50% / 45% |
| Flash | Putih, opasitas 0,55→0 selama 0,12 dtk di setiap cut |
| Progress bar | Tinggi 0,9cqw di tepi atas, warna aksen |
| SFX | whoosh di awal dan setiap cut, pop di setiap punch dan saat kartu produk masuk, tick saat bahan muncul. Diredam di bawah VO |
| Zona aman | Hindari: atas 0–8cqh (UI), kanan 85–100cqw pada 45–85cqh (ikon), bawah 87–100cqh (caption, nama akun, keranjang) |
| Compliance | Kata klaim kesehatan (kolesterol, jantung, gula darah, obat, menyembuhkan) **tidak boleh** jadi punch atau hook card yang ditempel ke produk herbal. Kartu produk herbal wajib memuat "Pangan olahan, bukan obat" |

### Template `calm_wellness` (contoh: dapurbotani · GarliBee, opc_2117)

| Layer | Spesifikasi |
|---|---|
| Hook card | 0–1,75 dtk, top 30cqh. Baris 1 putih Anton 13cqw ("HASIL LAB"), baris 2 di blok aksen Anton 15cqw miring -2,5° ("NAIK LAGI?"). Subtitle disembunyikan selama hook card |
| Punch | "JAGA MAKAN?" (problem), "DUKUNGAN EKSTRA" (benefit), "MADU MENTAH", "BAWANG LANANG" (product), "HARI INI" (cta) |
| Kartu produk | Kartu putih kiri atas (left 5cqw, top 13cqh), foto produk bersih 17cqw, label "YANG AKU PAKAI", nama produk, "Pangan olahan, bukan obat". Slide dari kiri 0,35 dtk, dari kata "madu" sampai akhir klip 3 |
| CTA | Panah ▲ memantul + pill "LINK DI BIO", top 20cqh, dari kata "link" sampai akhir |
| Aksen | #f2b632 (emas GarliBee) |

### Template `recipe_pop` (contoh: nutribake · Premix Cocoa, mul_261113_qt67yl)

| Layer | Spesifikasi |
|---|---|
| Hook card | 0–2,15 dtk, top 33cqh, baris 1 Anton 8,6cqw ("BROWNIES TANPA GULA"), baris 2 blok aksen 11cqw ("CUMA 3 BAHAN"). Subtitle **tetap tampil** |
| Daftar bahan | Kiri atas (left 4,5cqw, top 12cqh). Header "BAHAN n/N". Tiap bahan berupa chip krem dengan tanda ✓, slide dari kiri 0,3 dtk tepat saat VO menyebut bahan itu. Chip terbaru berwarna aksen selama 0,6 dtk. Hilang di akhir langkah terakhir sebelum produk masuk |
| Penanda langkah | Kanan atas (right 4,5cqw, top 12cqh): "LANGKAH n/N" + nama langkah singkat. Satu langkah per klip, klip hasil akhir tanpa penanda |
| Ajakan simpan | Pill putih top 56cqh "📌 Simpan dulu, resep lengkap di caption", di klip langkah ke-4 (sekitar 40% durasi). Disembunyikan saat punch tampil |
| Kartu produk | Seperti wellness tetapi top 28cqh (di bawah penanda langkah), label "BAHAN KUNCI", deskripsi singkat dari data produk ("Tanpa gula · 100 gram"). Dari kata nama produk sampai akhir klip produk |
| Punch | Hanya 2: "TANPA TAMBAHAN GULA" (benefit), "FUDGY!" (result) |
| CTA | Pill "CEK KERANJANG KUNING" + panah ▼ memantul, top 47cqh, dari kata "produk" sampai akhir |
| Aksen | #ffcc3d |

### Data finishing per video (`finishing_plan`)

Dihasilkan di tahap storyboard (LLM), divalidasi server, disimpan di item:

```json
{
  "template": "recipe_pop",
  "hook": { "line1": "Brownies tanpa gula", "line2": "cuma 3 bahan" },
  "punches": [ { "phrase": "tanpa tambahan gula", "type": "benefit", "clip": 5 } ],
  "ingredients": [ { "trigger": "pisang", "label": "2 pisang matang" } ],
  "steps": ["Lumatkan", "Masukkan telur", "Ayak cocoa", "Aduk rata", "Tuang & panggang", null],
  "save_prompt": { "clip": 4, "text": "📌 Simpan dulu, resep lengkap di caption" },
  "product_card": { "trigger": "premix", "tag": "BAHAN KUNCI", "desc": "Tanpa gula · 100 gram" },
  "cta": { "trigger": "produk", "text": "Cek keranjang kuning", "direction": "down" }
}
```

Aturan validasi: setiap `phrase` dan `trigger` wajib ada persis di teks VO klip terkait (setelah markup TTS dibersihkan). Bahan dan deskripsi produk hanya boleh dari data resep/produk yang ada, tidak boleh dikarang. Jika validasi gagal, layer itu dilewati dan render tetap jalan.

## 5. Tahapan kerja

**Fase 0: perbaikan cepat (1–2 hari, tanpa arsitektur baru)**
1. `loudnorm` -14 LUFS di encode final (dampak besar, satu baris filter).
2. Usut bug tag `<#1.0#>` bocor + QA regex sebelum render.
3. Overlay fps disamakan dengan fps video.
4. Ukuran caption naik ke sekitar 7%, potongan 2–4 kata (bukan kalimat yang terus menumpuk), stroke lebih tebal.
5. Hook title di frame 0 (overlay statis 1,5 dtk dari field `hook`).
6. Default transisi `cut` (atau render teks setelah concat) supaya tidak ada ghosting.
7. Pasang 2–3 file font OFL di server dan pakai di SVG.

**Fase 1: Keyword Punch (3–5 hari)**
Word timestamps berjenjang: (1) ElevenLabs `/with-timestamps`, (2) whisper.cpp lokal, (3) cadangan: rentang bicara dari `silencedetect` lalu kata dibagi berdasarkan panjang huruf (cara ini yang dipakai mockup, hasilnya sudah cukup pas). Field `finishing_plan` di storyboard + validasi compliance, mode `hybrid`, SFX pop.

**Fase 2: Overlay data (4–6 hari)**
Ingredient Pop + Step Counter (resep), Product Card, CTA animasi, camera punch-in pada kata kunci.

**Fase 3: Finishing Pass Remotion + template per niche (1–2 minggu)**
Template: `recipe_pop` (nutribake/sasyahouse), `calm_wellness` (dapurbotani: animasi halus, warna earthy), `product_hard_sell`. Pilihan disimpan di preset/Visual Identity.

**Field campaign/preset baru:** `caption_mode`, `emphasis_font`, `finishing_template`, `camera_motion` (off/subtle/punchy), `loudness_target`, `hook_card` (on/off).

## 6. Cara mengukur

- A/B per konten: render 2 versi (sekarang vs Fase 0/1) untuk naskah yang sama, unggah ke akun berbeda atau jam serupa.
- Metrik: **view 3 detik / impresi**, **rata-rata % ditonton**, **% tonton sampai habis**, klik keranjang. Jangan hanya melihat jumlah view.
- Ambang lanjut: jika rata-rata % ditonton naik ≥10% relatif setelah ~20 video per varian, jadikan default.

## 7. Risiko

- **Compliance herbal:** teks besar memperkuat klaim. Kata punch wajib lolos aturan herbal (tanpa "obat", "menurunkan kolesterol", dll.).
- **Waktu render:** Remotion menambah sekitar 1–2 menit per video, dan antrean ffmpeg saat ini satu job sekaligus (`ffmpegStudioQueueActive`). Perlu dipertimbangkan worker terpisah.
- **Over-design:** terlalu banyak elemen menurunkan kesan natural. Untuk akun "tenang" seperti dapurbotani pakai template halus, jangan disamakan dengan template resep.
