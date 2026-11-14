# Laporan Uji Staging Tahap H — Metaphor World Kit F2.1 (`v2.46.1`)

- **Tanggal:** 2026-11-14
- **Rilis / Tag / SHA:** `v2.46.1` (`7cb97ffc8ed2c93e954c1a63bbb358eb3fd38b22`)
- **Lingkungan Uji:** Mac Mini Staging (`http://100.95.245.55:5010`, API `7010`, schema PostgreSQL `staging`, `PGPOOL_MAX=3`, release `20261114T034755Z-7cb97ffc8ed2`)
- **Status Production:** **Tidak tersentuh** (`public` & port `5000`/`6000` tidak dideploy/dimodifikasi)
- **Feature Flags (`default_tenant` saja):**
  - `metaphor_kit_engine = 'on'`
  - `start_frame_visual_qc = 'report_only'`

---

## 1. Ringkasan Campaign Uji Staging

1. **Batch 7 Video Campuran (`opc_261114_f21b7`):** Item `#2133` – `#2139` (`compact_prompts: false`, `vi_dapurbotani_metaphor_world_test`, produk `GarliBee — Honey Infused Solo Garlic`).
   - 7/7 item menyelesaikan **42 / 42 Start Frames (`completed`)** + **42 / 42 panggilan Vision QC (`report_only`)** dengan **7 kit berbeda**.
   - 5 video selesai penuh menjadi `.mp4` saat snapshot laporan diambil (`opc_final_2133.mp4`, `2134.mp4`, `2135.mp4`, `2137.mp4`, `2138.mp4`), `#2139` sudah masuk tahap `ffmpeg` (`processing`), dan `#2136` sempat terhenti pada 1 klip G-Labs (`ee7ad330`: `PUBLIC_ERROR_USER_MINOR`).
2. **Video A/B `compact_prompts = ON` (`opc_261114_f21ab`):** Item `#2140` (`oil_powder_emulsify`, `compact_prompts: true`).
   - 6/6 Start Frames + 6 panggilan Vision QC + 6 klip Veo + TTS selesai (sempat ditahan filter kata `"lemak"` di pre-TTS lalu diloloskan setelah diganti `"minyak"`; gagal di `ffmpeg` pasca-TTS karena ketidakcocokan batch TTS awal).

---

## 2. Tabel Kriteria Sukses Tahap H (Audit 42 Start Frames `#2133`–`#2139`)

| Kriteria | Target | Hasil Nyata Staging (`#2133`–`#2139`) | Status | Catatan Inspeksi |
|---|---|---|---|---|
| **Klip 1 tanpa manusia** | **7 / 7** | **7 / 7** (`+ #2140 = 8 / 8`) | **Lulus (Naik dari 1/7 → 7/7)** | Seluruh Klip 1 memiliki `hand_count = 0`. Perbaikan penghapusan `"hands only"` pada `buildOpcStartFrameRequest` berhasil 100%. *(Catatan minor: `visual_action_guideline` input di `#2138` sempat mengarahkan Klip 1 ke spons dapur sebelum Klip 2–6 kembali ke pot tanah retak).* |
| **Lengan terbuka (Start Frame)** | **0 frame** | **0 / 42 frame** di batch `#2133`–`#2139` *(1 temuan pada A/B `#2140` C5)* | **Lulus di Batch 7×6** | Seluruh 35 frame Klip 2–6 pada batch `#2133`–`#2139` memakai lengan panjang manset tertutup rapat hingga pergelangan. Pada `#2140` C5 (uji A/B), lengan tersingkap ke tengah lengan bawah dan langsung tertangkap oleh Vision QC (`exposed_forearm: true`). |
| **Tangan > 2 (Start Frame)** | **0 setelah QC; catat temuan** | **0 / 42 frame** (`0 / 48` termasuk `#2140`) | **Lulus** | Vision QC melaporkan `hand_count <= 2` di seluruh 48 frame. *(Catatan wajah/dagu: Vision QC menangkap 1 potensi tepi profil di `#2133` C2; tidak ada fitur wajah penuh di 42 frame).* |
| **Botol/toples pre-bridge (Klip 1–2)** | **0** | **0 / 14 toples GarliBee** *(1 botol sabun polos kabur di pinggir bak cuci `#2139` C2 tertangkap QC)* | **Nyaris Sempurna** | 0 kemasan/toples GarliBee sebelum Klip 3. Di `#2139` C2, botol sabun dapur putih polos ikut terekam di pojok kanan meja wastafel dan terdeteksi oleh Vision QC. |
| **Klip terakhir (Clip 6 Hero) menampilkan benda metafora sama dlm kondisi bersih + produk** | **≥ 6 / 7** | **6 / 7** (`#2133, #2135, #2136, #2137, #2138, #2139`) | **Lulus** | Fitur **Hero Product Finale** memunculkan toples GarliBee pada **7 / 7 Klip 6** (`#2135` cermin/meja bersih, `#2137` wastafel kilap, `#2138` tanaman subur, `#2139` tupperware bening bersih, `#2133` piring bersih, `#2136` meja bersih). Hanya `#2134` C6 yang bergeser ke gelas teh herbal. |
| **Produk terlihat "bekerja" di Klip Bridge (Clip 3)** | **≥ 6 / 7** | **5 / 7** (`#2134, #2136, #2137, #2138, #2139`; `+ #2140 = 6 / 8`) | **Mendekati Target** | `#2137` (menuang madu ke saringan wastafel), `#2134`/`#2136`/`#2138`/`#2139` (menyendok/meneteskan madu & bawang lanang aktif). Hanya `#2133` C3 dan `#2135` C3 yang masih memegang toples tertutup. |
| **Kombinasi warna lengan & sudut kamera berbeda** | **≥ 4 dari 7** | **7 / 7 unik** (`4` warna × `4` sudut) | **Lulus (Melampaui)** | `#2133` `muted_maroon`/`eye_level_side`, `#2134` `ivory`/`overhead_top_down`, `#2135` `muted_maroon`/`macro_diagonal`, `#2136` `navy`/`overhead_top_down`, `#2137` `light_grey`/`macro_diagonal`, `#2138` `navy`/`eye_level_side`, `#2139` `light_grey`/`three_quarter_front`. |

---

## 3. Hasil Uji A/B `compact_prompts` (`#2133 OFF` vs `#2140 ON`)

| Metrik | `#2133` (`compact_prompts = OFF`) | `#2140` (`compact_prompts = ON`) |
|---|---|---|
| **Panjang Final `t2i_prompts` per Klip (karakter)** | `892, 1077, 1684, 1230, 1230, 1347` (rata-rata **1.243**) | `935, 1054, 1652, 1253, 1253, 1382` (rata-rata **1.255**) |
| **Kepatuhan Lengan & Benda** | 6/6 lengan tertutup | 1 frame (`C5`) lengan tersingkap |
| **Kesimpulan A/B** | Pembungkus injeksi deterministik pasca-LLM (`[CAMERA FRAMING]`, `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]`, `Presence Truth`, `Wardrobe`, `[LAYER 1..4]`) menyumbang ~750–900 karakter tetap di atas teks LLM, sehingga flag `compact_prompts = ON` saja hanya memendekkan bagian deskripsi inti dan tidak menurunkan total panjang prompt akhir secara signifikan. |

---

## 4. Audit Vision QC (`report_only`) & Temuan Penting Sebelum Mengaktifkan `enforce`

- **Total Panggilan Vision QC:** **48 panggilan** (`6` per video × `8` video), **0 error / 0 timeout**, biaya tetap sangat rendah sesuai estimasi.
- **Halusinasi Nyata yang Berhasil Ditangkap QC:**
  1. `#2133` C2: terdeteksi tepi profil atas (`visible_face: true`).
  2. `#2139` C2: terdeteksi botol putih polos di pojok sink (`pre_bridge_product: true`).
  3. `#2140` C5: terdeteksi lengan tersingkap (`exposed_forearm: true`).
- **Temuan Penting pada Rubrik `StartFrameQC` untuk Klip 3 & Klip 6 (WAJIB diperbaiki sebelum pindah ke mode `enforce`):**
  - Pada `#2133`, `#2134`, `#2135`, `#2136`, `#2138`, `#2139`, Vision QC masih memberi false-positive `pre_bridge_product: true` dan `foreign_objects: true` pada **Clip 3 (Bridge)** dan **Clip 6 (Hero Finale)** karena prompt QC [`buildStartFrameQcPrompt`](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js#L89-L131) masih menuliskan aturan `"Expected Metaphor World: <dirty object_world>"` dan field skema JSON bernama `pre_bridge_product` yang membingungkan Gemini Vision saat menilai gambar yang memang **wajib** memuat toples GarliBee & hasil bersih.
  - **Rekomendasi sebelum menyalakan `start_frame_visual_qc = enforce`:** perbarui `buildStartFrameQcPrompt` & nama perilaku pengecekan Clip 3/6 agar saat `expectsProduct = true` (Bridge & Hero Finale), kemunculan toples GarliBee + bawang lanang/madu & latar bersih dianggap **valid** (`pre_bridge_product` diabaikan penuh dan `foreign_objects` hanya memeriksa benda asing di luar produk + dunia kit yang sudah bersih).

---

## 5. Artefak Contact Sheet

- **Matriks Batch 7×6 (`#2133`–`#2139` × Klip 1–6):** `contact_sheet_f21_7x6.png`
- **Perbandingan A/B `compact_prompts` (`#2133` vs `#2140`):** `contact_sheet_f21_ab_compact.png`

