# Laporan Uji Staging — Planner Scene Director (K1–K6 + R1–R6) & K6 Identity Card (`v2.47.1`)

- **Tanggal:** 2026-11-14
- **Rilis / Tag / SHA:** `v2.47.1` (`9bfa082bdf936bcbcfcbf74a4bdcf7970294219f`), meneruskan rilis `v2.47.0` (`bad929c`, R1–R6 Scene Director)
- **Lingkungan Uji:** Mac Mini Staging (`http://100.95.245.55:5010`, API port `7010`, schema PostgreSQL `staging`, `PGPOOL_MAX=3`, release `20261114T062337Z-9bfa082bdf93`)
- **Status Production:** **Tidak tersentuh** (`public` & port `5000`/`6000` tidak dideploy/dimodifikasi; seluruh baris `planner_scene_director` / `start_frame_visual_qc` / `metaphor_kit_engine` di `public.tenant_settings` = `0`)
- **Feature Flags (`staging.tenant_settings` untuk `default_tenant` saja):**
  - `planner_scene_director = 'on'`
  - `metaphor_kit_engine = 'on'` *(sudah aktif sebelumnya dari Tahap F2.1)*
  - `start_frame_visual_qc = 'report_only'`

---

## 1. Perbaikan R1–R6 & Tes Lokal Sebelum Deploy

1. **Implementasi R1–R6** (sesuai [REVIEW_SCENE_DIRECTOR_K1-K6.md](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/REVIEW_SCENE_DIRECTOR_K1-K6.md)):
   - **R1:** Pemisahan `visual_action_hint` menjadi `visual_action_hint_pre_bridge` dan `visual_action_hint_bridge` di [scene-brief.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-brief.js) dan [prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) agar penyebutan toples produk tidak bocor ke Klip 1–4.
   - **R2:** Penghapusan kata produk (`toples`, `wadah kaca`, dll.) dari ekstraksi `PROP_PATTERNS` pada `situational_props`.
   - **R3:** Penyesuaian default pencahayaan malam menjadi `well-lit warm 3000K` yang terang & terbaca (`no dark murky gloom`) di [scene-brief.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-brief.js) dan `dapurbotani_identity_v3` pada [visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js).
   - **R4:** Penambahan aturan lokasi `kafe`, `mobil`, `musala/sajadah`, `kamar anak`, `meja belajar` + translasi generik `translateUnknownLocationToEn` untuk `wsWhere` yang belum dikenal.
   - **R5:** Perbaikan typo `bulk|` pada `PROP_PATTERNS` di [scene-brief.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-brief.js).
   - **R6:** Penambahan newline sebelum penutup banner prompt di [prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js).
   - **Koeksistensi Scene Director vs Metaphor Kit (`v2.47.1`):** Penambahan penjagaan di [scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), [prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), dan [visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js) (`dapurbotani_identity_v3` dan `siasatsehat_identity_v3` set `metaphor_engine.enabled: false`, `environment_policy: 'planner_driven'`) agar `metaphor_kit_engine = 'on'` tidak membajak kampanye `visual_style: 'Cinematic'`.
2. **Verifikasi Lokal (`v2.47.1`):**
   - `node --test tests/scene-brief.test.js tests/angle-visual-formats.test.js tests/scene-director-prompt.test.js tests/scene-diversity-guard.test.js tests/metaphor-policy-prompt.test.js` → **19/19 pass, 0 fail**.
   - `npm run build` → exit code `0`.

---

## 2. Ringkasan Campaign Uji Staging (`opc_261114_0j4bt2`)

- **Sumber Kloning:** 6 baris dari kampanye baseline lama `opc_261108_8618kc` (`#2051`–`#2056`) dikloning ke kampanye Staging **`opc_261114_0j4bt2`** (`#2143`–`#2148`) supaya data lama tetap utuh untuk perbandingan Before vs After.
- **Konfigurasi Uji:** VI `dapurbotani_identity_v3`, mode uji **Start Frame only** (`enable_tts = 0`, `enable_glabs = 0`, `enable_ffmpeg = 0`).
- **Status Eksekusi:** **6/6 item `completed`** dengan **36/36 Start Frame tersimpan** dan **36/36 panggilan Vision QC (`report_only`)** tanpa error.

| Item Baru | Angle Format | Lokasi & Waktu (`resolved_scene_brief`) | Warna Lengan Target (`resolved_wardrobe_color`) | Urutan `visual_mode` (Clip 1 → 6) | Vision QC (`report_only`) |
|---|---|---|---|---|---|
| **#2143** *(ex #2051)* | `The Rebel Choice` | `ruang keluarga yang hangat` (`night`) | `Earthy Olive` | `c_real, c_real, sym_surr, c_real, c_real, c_real` | **6 / 6** |
| **#2144** *(ex #2052)* | `The Second Chance` | `dapur rumah` (`morning`) | `Warm Ivory Cream` | `c_real, c_real, culinary, c_real, c_real, c_real` | **5 / 6** *(C2 flag)* |
| **#2145** *(ex #2053)* | `The Intellectual Flex` | `ruang makan rumah` (`midday`) | `Soft Mocca` | `c_real, c_real, 3d_bio_cellular, c_real, c_real, c_real` | **4 / 6** *(C3, C4 flag)* |
| **#2146** *(ex #2054)* | `The Life Hack` | `meja pantry dapur rumah` (`morning`) | `Muted Sage Green` | `c_real, c_real, c_real, c_real, c_real, c_real` | **2 / 6** *(C1–C4 flag)* |
| **#2147** *(ex #2055)* | `The Minimalist` | `kamar tidur yang tenang` (`night`) | `Dusty Terracotta` | `c_real, c_real, c_real, c_real, c_real, c_real` | **5 / 6** *(C5 flag)* |
| **#2148** *(ex #2056)* | `The Caregiver` | `ruang keluarga yang hangat` (`afternoon`) | `Dusty Terracotta` | `c_real, c_real, c_real, c_real, c_real, c_real` | **6 / 6** |

---

## 3. Evaluasi Kriteria Sukses ([RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md) §6 & R1–R6)

| Kriteria | Target | Hasil Staging (`#2143`–`#2148`) | Status | Bukti & Catatan Observasi |
|---|---|---|---|---|
| **Lokasi klip sesuai konteks planner** | ≥ 5 / 6 | **6 / 6** | **Lulus** | `#2143` ruang keluarga, `#2144` dapur, `#2145` ruang makan, `#2146` pantry, `#2147` kamar tidur, `#2148` ruang keluarga/dekat teras. Bandingkan batch lama (`#2053/#2055`) yang terkunci di batu sabak hitam + cobek. |
| **Tidak ada 2 video dengan urutan adegan sama** | 6 / 6 unik | **6 / 6 unik** | **Lulus** | Batch lama (`#2051`–`#2056`) memiliki **5/6 urutan `visual_mode` identik** (`culinary, culinary, 3d_bio_cellular, cinematic_realistic, cinematic_realistic, culinary`). Batch baru membedakan lokasi, waktu, properti, dan kombinasi mode di seluruh 6 video. |
| **Video dengan slot `3d_bio_cellular`** | ≤ 2 / 6 *(hanya edukasi)* | **1 / 6** | **Lulus** | Hanya `#2145` (*The Intellectual Flex* / angle edukasi) yang memakai 1 klip `3d_bio_cellular` (Clip 3). Lima video lain (`#2143`, `#2144`, `#2146`, `#2147`, `#2148`) memakai **0 klip 3D** (batch lama: **6 / 6** punya 3D di Clip 3). |
| **Situasi / properti *When/While* terlihat** | ≥ 5 / 6 | **5–6 / 6** | **Lulus** | Lampu meja + cangkir + dokumen + bantal sofa (`#2143`), bak cuci & meja dapur (`#2144`), meja makan siang (`#2145`), 2 cangkir & interaksi pantry bersama pasangan (`#2146`), **bingkai foto keluarga + nakas + tempat tidur (`#2147`)**, ruang keluarga dekat jendela teras (`#2148`). |
| **Waktu & pencahayaan malam tetap terang (R3)** | Terbaca jelas | **Tercapai (minor catatan)** | **Lulus w/ catatan** | `#2143` & `#2147` (`night`) memakai lampu meja/tidur 3000K hangat sehingga tangan & objek terbaca jelas tanpa gelap pekat; di beberapa frame (`#2143` C3/C6, `#2147` C1/C2/C6) cahaya jendela masih agak terang menyerupai sore/siang. |
| **Kepatuhan (wajah, lengan, botol pre-bridge)** | 0 pelanggaran | **0 wajah nyata; masih ada temuan minor** | **Parsial (lihat §4)** | Tidak ada wajah manusia nyata di 36 frame. Namun masih ada temuan minor pada botol/toples pre-bridge (`#2145` C4, `#2146` C1–C2 pantry), arms/UI di `#2145` C3 (`3d_bio_cellular`), dan pergeseran warna baju di beberapa video. |
| **Diversity Guard menandai lama "mirip" & baru "beragam"** | Ya | **Ya** | **Lulus** | `analyzeCampaignDiversity` pada `opc_261108_8618kc` (lama): `status: "warning"` (`DOMINANT_LOCATION_OVERUSE` `"unknown"` 100%, `REPEATED_BEAT_SEQUENCE` `"default\|unknown\|neutral\|6"` 6/6). Pada `opc_261114_0j4bt2` (baru): `status: "ok"`, `warnings: []`, `dominant_location_ratio: 0.33`, `repeated_sequences: []`. |

---

## 4. Audit Jujur Visual & Vision QC (`report_only`)

Dari inspeksi langsung atas ke-36 Start Frame pada contact sheet dan log `start_frame_qc`:

1. **Wajah realistis (`0 / 36` pelanggaran nyata):** Seluruh 36 frame menjaga komposisi *faceless* (*chest-down* / *hands-only*). Pada `#2147` Clip 5, Vision QC memberi flag `visible_face: true`, namun secara visual wajah yang terdeteksi berasal dari **foto keluarga di dalam bingkai foto** di atas nakas kayu, bukan wajah talent.
2. **Produk sebelum bridge (`Clip 1–4`):**
   - Peningkatan besar dibanding batch lama (mis. `OLD #2055` Clip 1 sudah menampilkan toples bertulis *"MADU BAWANG LANANG"*). `#2143`, `#2144`, `#2147`, dan `#2148` bersih di Clip 1–4.
   - **Temuan nyata:** `#2145` Clip 4 menampilkan toples kaca kecil bermadu di tepi kanan meja (`pre_bridge_product: true`), dan `#2146` (`meja pantry dapur rumah`) Clip 1–2 menampilkan toples kaca bumbu/biji di meja/rak pantry belakang (`pre_bridge_product: true` di QC).
3. **Bias Prompt Vision QC lama pada konteks Scene Director:** Skor QC rendah di `#2146` (`2/6`) dan flag `#2144` Clip 2 terjadi terutama karena prompt Vision QC saat ini masih membawa asumsi *Metaphor World* lama (menandai properti dapur/pantry sebagai `"foreign_objects"` atau `"kitchen pantry setup rather than a clean metaphor frame"`).
4. **Kualitas klip `3d_bio_cellular` (`#2145` Clip 3):** Visualisasi pembuluh darah pada lengan bawah sesuai topik edukasi, tetapi masih memunculkan aksara/garis kecil mirip HUD/UI di sekitar lengan dan sedikit bagian kulit lengan bawah yang terbuka (`weird_text_watermark: true`, `exposed_forearm: true`).
5. **Konsistensi Warna Baju/Gamis per Video (K6 Wardrobe Lock):**
   - `#2143` (`Earthy Olive`) konsisten hijau zaitun pada 5/6 klip (Clip 3 `symbolic_surrealism` bergeser ke terakota). `#2148` seragam di seluruh 6 klip (hijau zaitun/emerald tua, walau target bernama `Dusty Terracotta`).
   - `#2144` (`Warm Ivory Cream`), `#2146` (`Muted Sage Green`), dan `#2147` (`Dusty Terracotta`) masih menunjukkan kecenderungan model T2I tertarik ke zaitun/sage atau berubah warna antar-klip (terutama di `#2146`: Clip 1 cokelat tua/maroon, Clip 2 sage, Clip 3 krem, Clip 4–6 terakota/cokelat).
6. **Metadata ringan di `#2148`:** Teks awal `[CAMERA FRAMING: Strict overhead...]` masih ikut masuk ke `storyboard[*].visual_description` pada `#2148` (gambar Start Frame sendiri tetap normal).

---

## 5. Rekomendasi Tindak Lanjut Sebelum Rollout Global

1. **Perbarui rubrik `start_frame_visual_qc` (`buildStartFrameQcPrompt`):** bedakan kampanye *Scene Director* (`planner_driven`) dari *Metaphor World* agar properti ruangan alami (bak cuci dapur, cangkir pantry, nakas kamar tidur, foto keluarga dalam bingkai) tidak dianggap sebagai `foreign_objects` atau wajah talent.
2. **Perketat konsistensi warna K6 Wardrobe & aturan bebas toples pantry di Clip 1–4:** kuatkan constraint warna seragam yang benar-benar cocok dengan label palet (`Warm Ivory Cream`, `Dusty Terracotta`) dan larang toples kaca generik/bumbu di belakang meja saat *pre-bridge* pada setting pantry/ruang makan.

---

## 6. Artefak Contact Sheet & Tautan Kampanye

- **Kampanye Staging Baru:** [opc_261114_0j4bt2](http://100.95.245.55:5010/pillar-campaigns/opc_261114_0j4bt2) (`#2143`–`#2148`)
- **Kampanye Baseline Lama:** [opc_261108_8618kc](http://100.95.245.55:5010/pillar-campaigns/opc_261108_8618kc) (`#2051`–`#2056`)
- **Contact Sheet 6×6 Batch Baru:** [contact_sheet_scene_director_6x6.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_scene_director_6x6.png)
- **Contact Sheet Before vs After (`#2053/#2055` vs `#2145/#2147`):** [contact_sheet_before_after_sd.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_before_after_sd.png)

