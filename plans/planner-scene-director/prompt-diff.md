# Prompt Before vs After Diff: Items 2053 & 2055 (opc_261108_8618kc)

Perbandingan langsung output `buildOrganicPillarPrompt` pada **Sebelum (`planner_scene_director = off` + VI lama)** vs **Sesudah (`planner_scene_director = on` + K6 `dapurbotani_identity_v3` + R1–R6 fixes)**.

---

## Item 2053 — Ruang Makan Siang (The Intellectual Flex)

| Aspek | Sebelum (Flag OFF) | Sesudah (Flag ON + Identity Card + R1–R6) |
|---|---|---|
| Seksi Scene Director | Tidak ada | Muncul DI ATAS Brand Look |
| Mengandung "DILARANG KERAS menyimpang dari latar" | Ya | Tidak |
| Jumlah klip 3D di Beat / Mode Routing | Dipaksa di mechanism / DUAL-REALM | 1 klip |

### 1. Sebelum — Visual Identity Contract
```text
========================================================================
🎨 VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING (MANDATORY CONTRACT)
========================================================================
Sistem Visual Identity Aktif: "Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Female"
Gaya Visual Utama (Primary Style): "culinary_cinematic"
Gaya Pendukung (Supporting Modes): cinematic_realistic, symbolic_surrealism, 3d_bio_cellular

🚨 ATURAN PENUGASAN MODE VISUAL DINAMIS PER-KLIP (Total 6 Klip):
Anda WAJIB menerapkan mode visual berikut pada deskripsi visual storyboard dan prompt T2I/I2V di setiap klip:
* Klip 1         [Fungsi: HOOK] ➔ Mode Visual: "culinary_cinematic"
  -> Panduan Estetika: Artisanal kitchen, culinary cooking action, fresh organic ingredients, and appetizing warm lighting.
* Klip 2         [Fungsi: CONTEXT] ➔ Mode Visual: "culinary_cinematic"
  -> Panduan Estetika: Artisanal kitchen, culinary cooking action, fresh organic ingredients, and appetizing warm lighting.
* Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "3d_bio_cellular"
  -> Panduan Estetika: High-end 3D bio-cellular CGI simulations of microscopic cellular cross-sections, soft tissue healing, and pathology mechanisms.
* Klip 4–5       [Fungsi: CONSEQUENCE] ➔ Mode Visual: "cinematic_realistic"
  -> Panduan Estetika: Realistic cinematic film aesthetic with natural lighting, subtle film grain, and high aesthetic quality for general/lifestyle
```

### 2. Sesudah — Scene Director + Brand Look
```text
========================================================================
🎬 SCENE DIRECTOR (WAJIB PER KLIP — MENENTUKAN WHAT, WHERE, WHEN, WHO)
========================================================================
ATURAN HIERARKI KONTEKS (PLANNER MEMEGANG KENDALI ADEGAN):
- Lokasi Adegan Wajib : ruang makan rumah (Prompt EN: "tidy Indonesian home dining room table")
- Waktu & Cahaya Wajib: Siang hari ➔ bright crisp midday indoor ambient daylight (5200K) filtering cleanly across the room (no dim dusk or amber bedtime lamp)
- Aktor & Tangan POV  : Bunda (tangan wanita Indonesia dewasa) (wajib lengan panjang sopan menutup hingga pergelangan tangan, STRICTLY FACELESS)
- Emosi & Situasi     : Merasa cepat lelah dan cemas memikirkan stamina serta kesehatan jantung yang mulai menurun
- Properti Situasional: clean ceramic side plate and spoon, small wooden spoon or compact wooden board
- Strategic Angle     : "The Intellectual Flex" (EGO — Pola Khas: curious inspection, neat notes/glass/ingredient comparison, maximum 1 brief micro-mechanism cutaway)
- Panduan Aksi Awal   : Fokus pada situasi ruangan dan aksi tangan dengan properti situasional tanpa produk sebelum klip bridge
- Panduan Aksi Bridge (KHUSUS Klip 5+ saat bridging produk, DILARANG muncul di Klip 1–4): Kamera melakukan close-up pada tangan yang mengambil sendok berisi madu dan satu siung bawang lanang dari jar Garlibee, diletakkan perlahan di atas piring kecil di meja makan.

📋 RENCANA BEAT PER KLIP (6 Klip — DILARANG BERPINDAH KE LOKASI STUDIO LAIN):
- Klip 1 [Smart Question Hook | Mode: cinematic_realistic]: Close-up situasi cerdas saat tokoh mengamati detail yang sering terlewat orang lain (Tetap berlatar "tidy Indonesian home dining room table" dengan tangan aktif sesuai situasi)
- Klip 2 [Surface Myth vs Logic | Mode: cinematic_realistic]: Aktivitas nyata di ruang situasi yang menunjukkan mengapa cara asal-asalan sering keliru (Tetap berlatar "tidy Indonesian home dining room table" dengan tangan aktif sesuai situasi)
- Klip 3 [Micro-Mechanism Insight | Mode: 3d_bio_cellular]: Penjelasan visual mekanisme inti (maks 1 klip 3D seluler/sirkulasi bila relevan topik)
- Klip 4 [Informed Adjustment | Mode: cinematic_realistic]: Tangan mempraktikkan langkah terukur dengan pengeta
```

---

## Item 2055 — Kamar Tidur Malam (The Minimalist)

| Aspek | Sebelum (Flag OFF) | Sesudah (Flag ON + Identity Card + R1–R6) |
|---|---|---|
| Seksi Scene Director | Tidak ada | Muncul DI ATAS Brand Look |
| Mengandung "DILARANG KERAS menyimpang dari latar" | Ya | Tidak |
| Jumlah klip 3D di Beat / Mode Routing | Dipaksa di mechanism / DUAL-REALM | 0 klip |
| R1 Kebocoran "Toples Garlibee" di Panduan Aksi Awal | Bocor langsung | Dipisah ke Panduan Aksi Bridge Klip 5+ |
| R2 Properti kaca/tumbler dari kata "toples" | Bocor | Tidak ada |
| R3 Pencahayaan malam DapurBotani | Dim / deep shadows | Well-lit 3000K, no dark murky gloom |

### 1. Sebelum — Visual Identity Contract
```text
========================================================================
🎨 VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING (MANDATORY CONTRACT)
========================================================================
Sistem Visual Identity Aktif: "Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Female"
Gaya Visual Utama (Primary Style): "culinary_cinematic"
Gaya Pendukung (Supporting Modes): cinematic_realistic, symbolic_surrealism, 3d_bio_cellular

🚨 ATURAN PENUGASAN MODE VISUAL DINAMIS PER-KLIP (Total 6 Klip):
Anda WAJIB menerapkan mode visual berikut pada deskripsi visual storyboard dan prompt T2I/I2V di setiap klip:
* Klip 1         [Fungsi: HOOK] ➔ Mode Visual: "culinary_cinematic"
  -> Panduan Estetika: Artisanal kitchen, culinary cooking action, fresh organic ingredients, and appetizing warm lighting.
* Klip 2         [Fungsi: CONTEXT] ➔ Mode Visual: "culinary_cinematic"
  -> Panduan Estetika: Artisanal kitchen, culinary cooking action, fresh organic ingredients, and appetizing warm lighting.
* Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "3d_bio_cellular"
  -> Panduan Estetika: High-end 3D bio-cellular CGI simulations of microscopic cellular cross-sections, soft tissue healing, and pathology mechanisms.
* Klip 4–5       [Fungsi: CONSEQUENCE] ➔ Mode Visual: "cinematic_realistic"
  -> Panduan Estetika: Realistic cinematic film aesthetic with natural lighting, subtle film grain, and high aesthetic quality for general/lifestyle
```

### 2. Sesudah — Scene Director + Brand Look
```text
========================================================================
🎬 SCENE DIRECTOR (WAJIB PER KLIP — MENENTUKAN WHAT, WHERE, WHEN, WHO)
========================================================================
ATURAN HIERARKI KONTEKS (PLANNER MEMEGANG KENDALI ADEGAN):
- Lokasi Adegan Wajib : kamar tidur yang tenang (Prompt EN: "quiet cozy home bedroom with wooden bedside nightstand")
- Waktu & Cahaya Wajib: Malam hari ➔ well-lit warm 3000K indoor bedside or evening room lamp light keeping hands and objects clearly visible with soft natural shadows (no dark murky gloom, strictly night ambiance without morning window sunlight)
- Aktor & Tangan POV  : Bunda (tangan wanita Indonesia dewasa) (wajib lengan panjang sopan menutup hingga pergelangan tangan, STRICTLY FACELESS)
- Emosi & Situasi     : Ingin merasa tenang dan terlindungi dari rasa cemas masalah kesehatan
- Properti Situasional: warm wooden family photo frame, soft glowing bedside table lamp
- Strategic Angle     : "The Minimalist" (EGO — Pola Khas: decluttering extra items, quiet negative space, keeping one essential calm object)
- Panduan Aksi Awal   : Kamera mengambil sudut eye-level yang tenang di kamar tidur.
- Panduan Aksi Bridge (KHUSUS Klip 5+ saat bridging produk, DILARANG muncul di Klip 1–4): Toples Garlibee Madu Bawang Lanang diletakkan di samping bingkai foto keluarga, diterangi cahaya lampu tidur yang lembut.

📋 RENCANA BEAT PER KLIP (6 Klip — DILARANG BERPINDAH KE LOKASI STUDIO LAIN):
- Klip 1 [Clutter to Calm Shift | Mode: cinematic_realistic]: Tangan merapikan atau menyingkirkan banyak benda berlebih sehingga menyisakan ruang tenang (Tetap berlatar "quiet cozy home bedroom with wooden bedside nightstand" dengan tangan aktif sesuai situasi)
- Klip 2 [Mental & Surface Overload | Mode: cinematic_realistic]: Situasi kamar/meja berantakan oleh banyak pilihan yang memicu rasa cemas ringan (Tetap berlatar "quiet cozy home bedroom with wooden bedside nightstand" dengan tangan aktif sesuai situasi)
- Klip 3 [One Essential Focus | Mode: cinematic_realistic]: Fokus tunggal pada satu kebiasaan inti tanpa langkah berlapis-lapis yang merepotkan (Tetap berlatar "quiet cozy home bedroom with wooden bedside nightstand" dengan tangan aktif sesuai situasi)
- Klip 4 [Breathin
```