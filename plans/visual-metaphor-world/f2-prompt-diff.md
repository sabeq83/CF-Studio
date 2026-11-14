# F1 + F2 Prompt Diff — DapurBotani (Lokal, Tanpa Gemini / DB)

Skenario uji: 1 baris campaign OPC `DapurBotani` (`Kolesterol & Lemak Gorengan Harian`, `target_clips_count=6`, `bridge_at_clip=3`, `bridge_duration_clips=1`, `visual_style=metaphoric_faceless`) menggunakan seed kit `grease_in_water`.

## Ringkasan 3 Mode

| Aspek | (a) Flag OFF + VI Default | (b) Flag ON + VI Default | (c) Flag ON + VI Semua Switch Aktif |
|---|---|---|---|
| Panjang prompt (chars) | 40619 | 43295 | 44680 |
| Mode 3d_bio_cellular di allocator | ADA (perilaku lama) | DI-REMAP / HILANG | DI-REMAP / HILANG |
| Latar brand locked (DILARANG menyimpang) | YA | YA | TIDAK |
| Inject kit.environment (Bright Indonesian home kitchen, ...) | TIDAK | YA | YA |
| Pre-bridge Clip 2 tangan syar'i (Modest female hands) | TIDAK | TIDAK | YA |
| Teks ABSOLUTELY ZERO HANDS di tuple/mandate metafora | Ada (legacy) | Ada (object-only pre-bridge) | **TIDAK ADA di tuple/mandate** |
| Produk di dalam dunia metafora (inside_metaphor) | TIDAK | TIDAK | YA |
| Lighting arc (arc.from -> arc.to) | TIDAK | TIDAK | YA |
| Larangan produk pre-bridge (strictly no product shown) | TETAP ADA | TETAP ADA | TETAP ADA |

## Diff (a) Flag OFF + VI Default ➔ (b) Flag ON + VI Default

### Baris dihapus dari (a)
```diff
- * Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "3d_bio_cellular"
-   -> Panduan Estetika: High-end 3D bio-cellular CGI simulations of microscopic cellular cross-sections, soft tissue healing, and pathology mechanisms.
-       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Macro closeup, 85mm f/1.8 lens, shallow depth of field, 8K cinematic object photography). [LAYER 2: OBJECT TRUTH & METAPHOR] (Object Anchor: Minyak kuning kental mengambang di gelas air bening), (Geometric Truth: strictly no product shown in opening hook). [LAYER 3: SCENE & LIGHT] (Environment: Honed white limestone minimalist surface, soft natural diffused daylight, macro 85mm lens.), (Lighting: dramatic chiaroscuro with warm golden rim light). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: suspended in dynamic macro stillness)."
-       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Extreme macro product portrait, shallow depth of field, 8K resolution). [LAYER 2: PRODUCT TRUTH & TACTILE CRAFT] (Product Truth: [High fidelity raw packaging geometry and amber glossy texture of the product]), (Tactile Craft: Faceless hands interacting with pure natural textures), (Biometric Anchor: [POV delicate hands in modest soft linen]). [LAYER 3: SCENE & LIGHT] (Environment: Honed white limestone minimalist surface, soft natural diffused daylight, macro 85mm lens.), (Lighting: directional 3500K warm organic beam)."
```

### Baris ditambahkan di (b)
```diff
+ * Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "symbolic_surrealism"
+   -> Panduan Estetika: Metaphorical concept translation using physical scale shifts, surreal balance, and symbolic physical objects.
+ 🌍 METAPHOR WORLD KIT: "Minyak Bandel di Gelas Air" (Kitchen Science Demo)
+ - Dunia benda (WAJIB konsisten di seluruh klip VIDEO INI): A clear drinking glass of water on a bright white ceramic Indonesian kitchen table
+ - Latar: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table
+ - Peta beat pre-bridging (object-only, fisika mandiri):
+   * PROBLEM  → A thick stream of dark-yellow used frying oil pours into clear water, swirling stubbornly at the top and refusing to dissolve
+   * THREAT   → Extreme close-up of a heavy greasy yellow layer clinging together and coating the inner rim of the clear glass
+   * STRUGGLE → The liquid churns violently as an unseen vortex spins the water, forcing oil droplets to collide without merging
+   * FAILURE  → Motion halts; the yellow oil immediately snaps back into a thick, cloudy floating film over the dull water below
+ - Beat solusi (mulai Klip 3): REACTION → Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly; RESULT → Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly
+ - Pemetaan beat ke 6 klip:
+   * Klip 1 [PROBLEM]: A thick stream of dark-yellow used frying oil pours into clear water, swirling stubbornly at the top and refusing to dissolve
+   * Klip 2 [STRUGGLE]: The liquid churns violently as an unseen vortex spins the water, forcing oil droplets to collide without merging
+   * Klip 3 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 4 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 5 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 6 [RESULT]: Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly
+ - Arc lighting: harsh high-contrast greasy side light with slightly dim kitchen shadows ➔ high-key fresh morning window daylight
+ - Palet SFX: thick liquid pour, low tense drone, liquid vortex churn, soft sink plop, bright glass chime
+ - Jembatan VO (wajib 1 kalimat analogi, gaya bahasa boleh disesuaikan): "Bayangkan minyak yang menolak larut ini seperti pola makan tinggi gorengan dan santan yang perlu kita imbangi setiap hari."
+ - Kepatuhan: Dilarang klaim membakar/membuang lemak tubuh atau membersihkan darah. Gunakan "membantu menjaga" atau "pendamping pola makan".
+       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Macro closeup, 85mm f/1.8 lens, shallow depth of field, 8K cinematic object photography). [LAYER 2: OBJECT TRUTH & METAPHOR] (Object Anchor: Minyak kuning kental mengambang di gelas air bening), (Geometric Truth: strictly no product shown in opening hook). [LAYER 3: SCENE & LIGHT] (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table), (Lighting: dramatic chiaroscuro with warm golden rim light). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: suspended in dynamic macro stillness)."
+       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Extreme macro product portrait, shallow depth of field, 8K resolution). [LAYER 2: PRODUCT TRUTH & TACTILE CRAFT] (Product Truth: [High fidelity raw packaging geometry and amber glossy texture of the product]), (Tactile Craft: Faceless hands interacting with pure natural textures), (Biometric Anchor: [POV delicate hands in modest soft linen]). [LAYER 3: SCENE & LIGHT] (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table), (Lighting: directional 3500K warm organic beam)."
```

## Diff (a) Flag OFF + VI Default ➔ (c) Flag ON + VI Semua 4 Switch Aktif

### Baris dihapus dari (a)
```diff
- Sistem Visual Identity Aktif: "DapurBotani 3D Bio-Cellular Apothecary"
- * Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "3d_bio_cellular"
-   -> Panduan Estetika: High-end 3D bio-cellular CGI simulations of microscopic cellular cross-sections, soft tissue healing, and pathology mechanisms.
- - Latar Setting Utama : Dark matte black slate apothecary bench with antique brass mortar
- - Properti Kunci      : brass_scale, mortar_pestle
- - DILARANG KERAS menyimpang dari latar setting visual identity di atas (misal jika visual identity menetapkan corkboard/pinboard matrix, DILARANG menggantinya menjadi meja kayu arsip biasa atau dapur).
- 🚨 KHUSUS KLIP 1 s/d 2 (METAFORA OBJEK PRE-BRIDGING — 100% PURE ISOLATED OBJECT ONLY):
- - DILARANG KERAS menuliskan "(Biometric Anchor: ...)" atau "(Wardrobe: ...)" pada Klip 1 s/d 2!
- - DILARANG KERAS menampilkan tangan, lengan, jari, atau bagian tubuh manusia mana pun pada Klip 1 s/d 2!
- - Khusus Klip 1 (Opening Hook Masalah): WAJIB 100% PURE ISOLATED OBJECT ONLY (objek fisik makro mandiri sebagai simbol masalah atau visualisasi konkret).
- - PADA KLIP 2 s/d 2 (EMPATI & KONTEKS DUNIA NYATA):
-   * DILARANG MONOTON! DILARANG mengulang-ulang tabung lab, wadah kaca optik, silinder, atau studio void gelap di seluruh klip!
-   * WAJIB MENAMPILKAN ELEMEN & LATAR DUNIA NYATA YANG SESUAI DENGAN W'S MATRIX & CONTEXT:
-     - Contoh Setting: Sudut meja sarapan pagi hangat, meja makan keluarga, meja nakas kamar tidur malam hari dengan dokumen cek lab, meja kerja modern dengan laptop/agenda, atau pantry dapur herbal artisanal.
-     - Contoh Objek Nyata: Cangkir teh beruap, wajan panas dengan minyak jenuh, kotak bekal, piring saji keramik, bawang tunggal mentah di atas talenan kayu, mangkuk madu alami, atau bahan herbal segar.
-   1. (Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, NO FINGERS, NO HUMAN PRESENCE WHATSOEVER)
-   2. (Object Truth & Context: [Deskripsi objek fisik makro konkret atau adegan situasi nyata sesuai W'S Matrix baris ini])
-   4. (Physical Kinetics: [Fenomena fisik/pergerakan kamera mandiri — gravitasi murni, uap mengepul, pencahayaan alami])
-   5. (Environment: [Latar ruangan nyata yang estetik dan hangat sesuai W'S Matrix baris ini — BUKAN void laboratorium monoton])
-   6. (Lighting: dramatic chiaroscuro with warm golden rim light or soft natural ambient)
- - Baru pada Klip 3 ke atas diizinkan menuliskan (Biometric Anchor: POV close-up culinary framing focusing strictly on delicate hands), (Wardrobe: Loose sage-linen modest tunic sleeves covered to wrists), dan (Product Truth: ...).
- - PADA KLIP 1 s/d 2 (PRE-BRIDGING ISOLATION):
-   1. (Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, NO FINGERS, ZERO HUMAN PRESENCE)
-   2. (Object Truth & Metaphor: [Deskripsi objek fisik makro yang bergerak mandiri])
-   4. (Physical Kinetics: [Fenomena fisika/fluida mandiri tanpa disentuh manusia])
-   5. (Environment: [Latar ruangan nyata kontekstual sesuai W'S Matrix baris ini — misal meja makan, meja nakas kamar tidur, meja sarapan, meja kerja, pantry botani — BUKAN void laboratorium monoton])
-   6. (Lighting: soft natural light)
-   1. (Biometric Anchor: POV close-up culinary framing focusing strictly on delicate hands)
-   4. (Action & Craft: [Deskripsi tindakan fisik tangan POV berinteraksi secara autentik dengan produk])
-   5. (Environment: [Latar ruangan & suasana meja kerja secara rinci])
-   6. (Lighting: soft natural light)
- 🚨 OBJECT-CENTRIC METAPHOR MANDATE (100% PURE OBJECT PRE-BRIDGING — ZERO HANDS / GROUNDED REAL-LIFE CONTEXT)
- Kampanye ini menggunakan gaya visual Metafora Objek Murni (Pure Isolated Object):
-    - PADA KLIP METAFORA PRE-BRIDGING (KLIP 1 s/d 2): DILARANG KERAS memunculkan TANGAN, LENGAN, JARI, atau bagian tubuh manusia mana pun! Tidak boleh ada orang/tangan yang memegang atau menggerakkan benda. Benda harus tampak terisolasi dan berinteraksi secara mandiri melalui hukum fisika murni.
-    - Suasana & Background Pre-Bridging: Selaras dengan situasi nyata di Content Planner (W'S Matrix) — misal: sudut meja nakas kamar tidur, meja sarapan pagi dengan cangkir teh beruap, wajan panas di atas kompor, toples fermentasi alami di pantry herbal, atau meja kerja modern di jam istirahat.
-    - Interaksi Tangan POV (HANYA Klip Solusi/Konsumsi Belakang): Tangan POV hanya boleh muncul pada klip produk/konsumsi (Klip 3 ke atas). Klip 1 s/d 2 WAJIB MURNI BENDA TANPA TANGAN.
-       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Macro closeup, 85mm f/1.8 lens, shallow depth of field, 8K cinematic object photography). [LAYER 2: OBJECT TRUTH & METAPHOR] (Object Anchor: Minyak kuning kental mengambang di gelas air bening), (Geometric Truth: strictly no product shown in opening hook). [LAYER 3: SCENE & LIGHT] (Environment: Honed white limestone minimalist surface, soft natural diffused daylight, macro 85mm lens.), (Lighting: dramatic chiaroscuro with warm golden rim light). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: suspended in dynamic macro stillness)."
-       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Extreme macro product portrait, shallow depth of field, 8K resolution). [LAYER 2: PRODUCT TRUTH & TACTILE CRAFT] (Product Truth: [High fidelity raw packaging geometry and amber glossy texture of the product]), (Tactile Craft: Faceless hands interacting with pure natural textures), (Biometric Anchor: [POV delicate hands in modest soft linen]). [LAYER 3: SCENE & LIGHT] (Environment: Honed white limestone minimalist surface, soft natural diffused daylight, macro 85mm lens.), (Lighting: directional 3500K warm organic beam)."
```

### Baris ditambahkan di (c)
```diff
+ Sistem Visual Identity Aktif: "DapurBotani Metaphor World Test"
+ * Klip 3         [Fungsi: MECHANISM] ➔ Mode Visual: "symbolic_surrealism"
+   -> Panduan Estetika: Metaphorical concept translation using physical scale shifts, surreal balance, and symbolic physical objects.
+ - Latar Setting Utama : Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table
+ - LATAR MENGIKUTI METAPHOR WORLD: "Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table". Konsisten di seluruh klip VIDEO INI. Latar brand (Dark matte black slate apothecary bench with antique brass mortar) HANYA referensi nuansa warna/material, BUKAN lokasi wajib dan properti brand tidak dipaksakan.
+ 🚨 KHUSUS KLIP 1 s/d 2 (METAFORA DUNIA BENDA — "A clear drinking glass of water on a bright white ceramic Indonesian kitchen table"):
+ - Klip 1: tetap object-only hook (benda fisik murni tanpa tangan sebagai opening hook).
+ - Klip 2 s/d 2: tangan syar'i (lengan panjang menutup pergelangan, Loose sage-linen modest tunic sleeves covered to wrists) BOLEH berakting dengan benda metafora: A modest long-sleeved hand covering the wrist stirs the oily glass aggressively with a stainless spoon.
+ - DILARANG KERAS menampilkan wajah manusia atau kulit lengan telanjang!
+   1. Klip 1 (Hook Object-Only): (Presence Truth: Pure isolated object hook only — no hands in Clip 1 opening frame)
+   1b. Klip 2 s/d 2: (Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms), (Wardrobe: Loose sage-linen modest tunic sleeves covered to wrists)
+   2. (Object Truth & Context: [Deskripsi objek dunia metafora "A clear drinking glass of water on a bright white ceramic Indonesian kitchen table" sesuai beat])
+   4. (Physical Kinetics: [Aksi fisik / fenomena benda metafora sesuai beat])
+   5. (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table — WAJIB SAMA di seluruh klip VIDEO INI)
+   6. (Lighting: harsh high-contrast greasy side light with slightly dim kitchen shadows)
+ - TETAP di dunia benda yang sama (Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table) — DILARANG pindah ke studio/latar brand terpisah!
+ - Produk tampil sebagai agen perubahan di dalam metafora: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly.
+ - Klip terakhir (Klip 6): Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly + botol/kemasan utuh (Product Truth Lock) diambil tangan syar'i.
+ - Pencahayaan (Lighting: transisi harsh high-contrast greasy side light with slightly dim kitchen shadows ➔ high-key fresh morning window daylight hingga high-key fresh morning window daylight).
+ - PADA KLIP 1 s/d 2 (PRE-BRIDGING ISOLATION PRODUK):
+   1. Klip 1 (Hook Object-Only): (Presence Truth: Pure isolated object hook only — no hands in Clip 1 opening frame)
+      Klip 2 s/d 2: (Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms) & (Wardrobe: Loose sage-linen modest tunic sleeves covered to wrists)
+   2. (Object Truth & Metaphor: [Deskripsi objek fisik dunia metafora "A clear drinking glass of water on a bright white ceramic Indonesian kitchen table"])
+   4. (Physical Kinetics: [Klip 1: fenomena fisika mandiri; Klip 2+: aksi tangan syar'i pada benda metafora tanpa menampilkan wajah atau lengan terbuka])
+   5. (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table)
+   6. (Lighting: harsh high-contrast greasy side light with slightly dim kitchen shadows)
+   1. (Biometric Anchor: (Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms))
+   4. (Action & Craft: [Produk berperan sebagai agen perubahan di dalam metafora (Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly), dan di Klip 6 hasil bersih (Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly) + botol utuh])
+   5. (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table)
+   6. (Lighting: Klip bridging smooth transition from harsh high-contrast greasy side light with slightly dim kitchen shadows toward high-key fresh morning window daylight; Klip terakhir high-key fresh morning window daylight)
+ 🚨 METAPHOR WORLD MANDATE (TANGAN SYAR'I AKTIF / PRODUK DI DALAM METAFORA)
+ Kampanye ini menggunakan gaya visual Metaphor World Kit (satu dunia metafora utuh dari awal hingga akhir video):
+    - PADA KLIP 1 (Opening Hook): Tetap 100% object-only (hook benda murni tanpa tangan). Mulai Klip 2 ke atas, tangan syar'i (lengan panjang menutup pergelangan) BOLEH berakting pada benda metafora. DILARANG keras memunculkan wajah manusia atau kulit lengan telanjang!
+    - Suasana & Background Video Ini: WAJIB konsisten di dunia latar "Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table" dari Klip 1 sampai Klip 6.
+    - Interaksi Tangan Syar'i & Produk: Klip 1 tetap object-only; Klip 2 ke atas tangan syar'i (wrists covered) aktif menggerakkan aksi benda metafora, dan pada klip produk (Klip 3 ke atas) produk masuk KE DALAM dunia metafora yang sama sebagai agen perubahan.
+ 🌍 METAPHOR WORLD KIT: "Minyak Bandel di Gelas Air" (Kitchen Science Demo)
+ - Dunia benda (WAJIB konsisten di seluruh klip VIDEO INI): A clear drinking glass of water on a bright white ceramic Indonesian kitchen table
+ - Latar: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table
+ - Peta beat pre-bridging (object-only, fisika mandiri):
+   * PROBLEM  → A thick stream of dark-yellow used frying oil pours into clear water, swirling stubbornly at the top and refusing to dissolve
+   * THREAT   → Extreme close-up of a heavy greasy yellow layer clinging together and coating the inner rim of the clear glass
+   * STRUGGLE → The liquid churns violently as an unseen vortex spins the water, forcing oil droplets to collide without merging
+   * FAILURE  → Motion halts; the yellow oil immediately snaps back into a thick, cloudy floating film over the dull water below
+ - Beat solusi (mulai Klip 3): REACTION → Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly; RESULT → Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly
+ - Pemetaan beat ke 6 klip:
+   * Klip 1 [PROBLEM]: A thick stream of dark-yellow used frying oil pours into clear water, swirling stubbornly at the top and refusing to dissolve
+   * Klip 2 [STRUGGLE]: The liquid churns violently as an unseen vortex spins the water, forcing oil droplets to collide without merging
+   * Klip 3 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 4 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 5 [REACTION]: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly
+   * Klip 6 [RESULT]: Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly
+ - Arc lighting: harsh high-contrast greasy side light with slightly dim kitchen shadows ➔ high-key fresh morning window daylight
+ - Palet SFX: thick liquid pour, low tense drone, liquid vortex churn, soft sink plop, bright glass chime
+ - Jembatan VO (wajib 1 kalimat analogi, gaya bahasa boleh disesuaikan): "Bayangkan minyak yang menolak larut ini seperti pola makan tinggi gorengan dan santan yang perlu kita imbangi setiap hari."
+ - Kepatuhan: Dilarang klaim membakar/membuang lemak tubuh atau membersihkan darah. Gunakan "membantu menjaga" atau "pendamping pola makan".
+       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Macro closeup, 85mm f/1.8 lens, shallow depth of field, 8K cinematic object photography). [LAYER 2: OBJECT TRUTH & METAPHOR] (Object Anchor: Minyak kuning kental mengambang di gelas air bening), (Geometric Truth: strictly no product shown in opening hook). [LAYER 3: SCENE & LIGHT] (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table), (Lighting: harsh high-contrast greasy side light with slightly dim kitchen shadows). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: suspended in dynamic macro stillness)."
+       "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Extreme macro product portrait, shallow depth of field, 8K resolution). [LAYER 2: PRODUCT TRUTH & TACTILE CRAFT] (Product Truth: [High fidelity raw packaging geometry and amber glossy texture of the product]), (Tactile Craft: Fine bone-white herbal powder settles gently onto the oil surface; the greasy film breaks into dense clumps that sink cleanly), (Biometric Anchor: POV close-up culinary framing focusing strictly on delicate hands), (Wardrobe: Loose sage-linen modest tunic sleeves covered to wrists). [LAYER 3: SCENE & LIGHT] (Environment: Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table), (Lighting: smooth transition from harsh high-contrast greasy side light with slightly dim kitchen shadows toward high-key fresh morning window daylight)."
```
