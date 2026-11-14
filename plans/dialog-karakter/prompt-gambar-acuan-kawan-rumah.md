# Gambar Acuan Karakter Kawan Rumah — Temuan & Prompt

> Tanggal: 2026-11-14 · Penulis: Claude (reviewer) · Cek baca-saja di kode v2.48.6 + DB staging.

## 1. Temuan

### Cara ptgim_sosmed menjaga konsistensi
- Setiap karakter (Reno, Maya, Bima) punya **gambar acuan (character sheet)** yang **diunggah** (`source_type: upload`), bukan dibuat di aplikasi.
- Gambar disimpan di dua tempat:
  - `visual_reference_assets` dengan pemilik VI, peran `character_sheet`;
  - `universe_characters.reference_image_path` di **Universe** masing-masing.
- Setiap VI ptgim hanya berisi **1 karakter**.

### Kenapa ini belum bisa langsung ditiru untuk Kawan Rumah
1. **Gambar acuan karakter hanya dikirim ke pembuat start frame bila kampanye memakai Universe** (`content_world = cartoon_universe`, `scheduler-processors.js` ±6368–6461). Acuan diambil dari karakter di Universe; dari VI hanya acuan `visual_style` yang dipakai. Kawan Rumah memakai jalur VI stylized 3D, jadi **saat ini tidak ada gambar acuan karakter yang terkirim**, walaupun character sheet diunggah di VI.
2. **VI hanya bisa menyetujui 1 gambar per peran** (indeks unik `idx_vra_one_approved`). Untuk 3 karakter lewat VI, satu-satunya cara adalah **1 gambar berisi ketiganya (lineup)**.
3. **Pembuat gambar acuan di aplikasi akan membuat karakter TANPA WAJAH** (`lib/reference-asset-prompt-builder.js`):
   - `isHuman` selalu true bila pemiliknya VI (juga untuk karakter dengan `depiction_mode = normal`). Akibatnya ditambahkan "faceless character sheet, omitting facial features" dan larangan `eyes, nose, mouth`. Mata dan mulut Si Wajan dilarang.
   - `demographic_key: custom` membuat fungsi `DEMOGRAPHIC_PRESETS.custom` ikut tertulis sebagai teks di prompt (sampah).
   - Kolom prompt kustom menghapus kata `smile`, `visible eyes`, `detailed eyes`, `front face`.
   - Kemungkinan inilah sebabnya ptgim memakai gambar unggahan.
4. **MCP tidak punya alat untuk membuat/mengunggah gambar acuan.** Pembuatan gambar tidak bisa dipicu dari Claude.

### Rekomendasi
- **Sekarang:** buat 3 gambar karakter + 1 gambar lineup di luar aplikasi (Gemini / Google ImageFX / Whisk) memakai prompt di Bagian 2. Pilih yang terbaik, lalu simpan.
- **Agent (perbaikan, bagian dari D-7):**
  - (a) Perbaiki `reference-asset-prompt-builder.js`: deteksi manusia dari `subject.kind`; tidak memaksa faceless untuk `stylized_3d_character`/kartun; tangani `custom`; sanitizer kata wajah hanya untuk subjek manusia faceless.
  - (b) Kirim gambar acuan karakter ke start frame untuk jalur VI stylized 3D. Pilih salah satu:
    - **Opsi 1 (disarankan, memakai yang sudah ada):** buat **Universe "Kawan Rumah"** dengan 3 karakter (`si_wajan`, `sponge`, `sapu`), masing-masing dengan unggahan identity/character_sheet sendiri, dan hubungkan VI ke Universe tersebut (`subject.universe_profile_id`). Pastikan jalur resolver karakter berjalan untuk kampanye stylized yang punya Universe, termasuk memilih karakter per klip berdasarkan `voice_segments`/`characters`.
    - **Opsi 2:** `character_refs` per karakter di VI (rencana D-7).
  - Keduanya cocok dengan UI yang hanya punya 1 kolom prompt: Universe memberi **1 kolom per karakter**.

---

## 2. Prompt gambar acuan (pakai di Gemini / ImageFX / Whisk)

Tips:
- Buat 3–4 variasi per prompt. Pilih yang paling bersih: latar polos dan wujud jelas.
- Simpan ukuran persegi atau 3:4.
- Jangan ada teks atau logo di gambar.

### A. Si Wajan (karakter utama)
```
Character model sheet of "Si Wajan", a charming Pixar-style 3D animated character: a round non-stick frying pan with a matte black body and a terracotta-colored wooden handle that it uses like an arm. Big expressive cartoon eyes on the pan body, small friendly mouth, soft rosy cheeks. Show four views on one sheet: front view, three-quarter view, side view, and back view, plus three small expression close-ups (happy, tired and complaining, surprised). Same exact colors, shape and proportions in every view. Glossy Pixar-quality rendering, soft ambient studio lighting, plain warm cream background, clean layout, no text, no labels, no logos, no humans, no hands.
```

### B. Sponge
```
Character model sheet of "Sponge", a cute Pixar-style 3D animated character: a rectangular kitchen dish sponge with a soft yellow top layer and a rough sage-green scrub layer on the bottom, small round expressive eyes and a wide friendly smile, tiny soft foam bubbles around it. Show four views on one sheet: front view, three-quarter view, side view, and back view, plus three small expression close-ups (calm and kind, laughing, worried). Same exact colors, shape and proportions in every view. Glossy Pixar-quality rendering, soft ambient studio lighting, plain warm cream background, clean layout, no text, no labels, no logos, no humans, no hands.
```

### C. Sapu
```
Character model sheet of "Sapu", a cheeky Pixar-style 3D animated character: a traditional Indonesian ijuk broom with a sage-green handle and brown natural fiber bristles bound with twine, thick expressive eyebrows, lively cartoon eyes and a cheeky grin on the upper bristle area. Show four views on one sheet: front view, three-quarter view, side view, and back view, plus three small expression close-ups (cheeky, annoyed, laughing). Same exact colors, shape and proportions in every view. Glossy Pixar-quality rendering, soft ambient studio lighting, plain warm cream background, clean layout, no text, no labels, no logos, no humans, no hands.
```

### D. Lineup ketiganya (untuk 1 slot `character_sheet` di VI + acuan skala)
```
Character lineup of three Pixar-style 3D animated household characters standing side by side on a warm cream background, correct relative scale: (1) "Si Wajan", a round non-stick frying pan with a matte black body, terracotta wooden handle used like an arm, big expressive eyes, small mouth, rosy cheeks; (2) "Sponge", a small rectangular dish sponge with a yellow top layer and sage-green scrub layer, small round eyes, wide friendly smile; (3) "Sapu", a tall traditional Indonesian ijuk broom with sage-green handle and brown fiber bristles bound with twine, thick eyebrows, cheeky grin. All three facing the camera in a friendly pose. Glossy Pixar-quality rendering, soft ambient lighting, warm cream, terracotta and sage green palette, clean layout, no text, no labels, no logos, no humans, no hands.
```

Setelah gambar dipilih:
- Lineup (D) bisa diunggah ke VI Kawan Rumah → bagian gambar acuan → peran **character_sheet** → setujui.
- Gambar A–C disimpan untuk Universe (Opsi 1) atau `character_refs` (Opsi 2), setelah agent menyiapkan jalurnya.
- Ingat: untuk saat ini, unggahan di VI **belum** ikut terkirim ke start frame (temuan 1).
