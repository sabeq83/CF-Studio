# Instruksi Agent AI Antigravity — Putaran Perbaikan F2.1 (Kualitas Metafora + Anti-Halusinasi)

## Konteks
Rilis `v2.46.0` (F1+F2) sudah diuji di staging (`plans/visual-metaphor-world/stage-f-staging-report.md`, campaign `opc_261114_g0zltt`). Pengguna sudah menonton ketujuh video, dan reviewer sudah memeriksa 42 start frame. Hasilnya:

**Berhasil:** 7 dunia metafora berbeda, latar terang dan rumahan, tanpa 3D, tanpa botol pre-bridge, produk tampil di dalam adegan.

**Masalah yang harus diperbaiki (urut prioritas):**

| # | Masalah | Bukti |
|---|---|---|
| P1 | **Halusinasi anatomi & objek**: muncul 3 tangan (paling sering), benda muncul tiba-tiba (mis. botol) | Laporan pengguna setelah menonton 7 video |
| P2 | **Klip 1 masih ada tangan**, sebagian **lengan terbuka** (melanggar syar'i) | 6/7 video; lengan terbuka di #2129, #2131, #2132 |
| P3 | **Cerita metafora putus di klip 4–6**: berubah jadi adegan meracik bumbu/rempah generik; tidak ada payoff "benda kembali bersih" | Hanya #2130 (wastafel) yang menutup dengan payoff benar |
| P4 | **Produk hanya dipegang, tidak "bekerja"** di klip 3. Teks reaksi kit menyebut "herbal powder", padahal produknya madu bawang tunggal (GarliBee) | Klip 3 semua video |
| P5 | **Kontras kotor → bersih tidak terasa**: hook kurang "jijik"; lighting hangat-krem sama dari klip 1 sampai 6 | #2126, #2128, #2131 lemah; arc lighting tidak terlihat di frame |
| P6 | **Risiko monoton baru**: warna lengan mocca, palet krem, dan sudut kamera atas yang sama di 7 video | Contact sheet 7×6 |

## Mandat
1. **Tulis dulu** `plans/visual-metaphor-world/implementation_plan_F2.1.md` sesuai SOP `AGENTS.md`: Code Sebelum/Sesudah per file + `## Execution Task List`. Mulai coding setelah plan tertulis.
2. Kerjakan bagian A–G di bawah, lalu **tes lokal + build**.
3. **Berhenti sebelum rilis/deploy staging** dan laporkan ke pengguna. Rilis + uji ulang staging (bagian H) hanya dengan izin eksplisit. Production dilarang.

## Prinsip Wajib (sama seperti F1+F2)
- Semua perubahan **di balik flag/policy**. Saat `metaphor_kit_engine` off dan VI default, prompt **identik byte-per-byte** dengan sebelumnya. Snapshot lama tidak boleh diubah untuk meloloskan tes.
- Larangan produk pre-bridge tetap. Mode investigatif tidak disentuh.
- Tanpa credential di source/log/dokumen. Tanpa polling SSH berulang.
- Bila source berbeda dari asumsi instruksi ini, update plan dulu, lalu edit.

---

## A. Kebersihan Prompt Anti-Halusinasi (P1) — pencegahan, paling murah, paling berdampak
Hipotesis penyebab halusinasi, yang **wajib diverifikasi dulu** pada 42 prompt `opc_261114_g0zltt`:
1. **Negasi di positive prompt memancing objeknya muncul.** Contoh: tuple `(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)` dan `ZERO HANDS` menyebut kata *bottle/jar/hands* di dalam positive prompt. Banyak model image/video (terutama yang mengabaikan negative prompt, seperti FLUX, yang sudah diakui di `opc-start-frame-request.js`) justru menggambar benda yang disebut.
2. **Terlalu banyak aktor/aksi dalam satu klip** ("satu tangan menuang sementara tangan lain memegang…") → model menambah tangan ketiga.
3. **Prompt sangat panjang dan padat objek** (mandat minimal ±1.200 karakter) → objek "bocor" antar-deskripsi.

Perbaikan (hanya berlaku saat policy metafora aktif):
- **A1. Ubah negasi menjadi framing positif.** Contoh: "camera frames only the sink basin and drain; countertop is empty and clean" menggantikan "no bottle". Kata benda yang dilarang (*bottle, jar, packaging, hands, arms, face*) **dihapus dari positive prompt** dan dipindah ke field negative prompt/`--no` **hanya bila provider mendukung**. Petakan provider mana yang mendukung (T2I start frame, G-Labs Veo) dan dokumentasikan di plan.
- **A2. Hitungan tangan eksplisit** pada klip bertangan: "one person, exactly two hands, both in long sleeves covering the wrists". Dilarang mendeskripsikan tangan orang kedua.
- **A3. Satu aksi utama per klip**, maksimal 3 objek penting per frame (selain latar).
- **A4. Eksperimen panjang prompt:** tambahkan opsi agar mode metaforik memakai prompt visual lebih ringkas (target 500–800 karakter) di balik switch terpisah (mis. `metaphor_engine.compact_prompts`, default off). Ini untuk uji A/B di staging, bukan langsung default.
- Tes: lint otomatis bahwa positive prompt klip metaforik tidak mengandung kata benda terlarang, dan klip bertangan selalu memuat frasa hitungan tangan.

## B. Klip 1 Benar-Benar Tanpa Manusia + Lengan Selalu Tertutup (P2)
- **B1.** Klip 1 saat `hands_policy = modest_hands_active`: framing positif "unattended object, close macro framing on <objek>, nobody in frame". **Tanpa** menyebut kata hands/arms (lihat A1). Sanitizer start-frame dan `applyPromptReplacements` tidak boleh menyuntikkan Anchor/Wardrobe di klip 1.
- **B2.** Klip 2+ bertangan: tuple Wardrobe **selalu** ada dan eksplisit "long sleeves covering the wrists". Bare forearm dicegah lewat framing positif ("sleeve cuff visible at the wrist").
- **B3.** Investigasi kenapa klip 1 tetap bertangan pada 6/7 video (teks prompt? start-frame builder? reuse frame?). Tulis temuannya di plan sebelum memperbaiki.

## C. Kontinuitas Metafora Sampai Akhir (P3)
- **C1.** Peta beat untuk zona produk dan pasca-bridge **wajib tetap di dunia benda yang sama**:
  - Klip bridge = INTERVENTION + REACTION (produk bekerja pada benda kotor)
  - Klip berikutnya = RESULT (benda yang **sama** kini bersih, `beats.result`)
  - Klip terakhir = HERO: benda bersih + produk + tangan mengambil produk
  - Bila jumlah klip lebih banyak, tambahkan beat "detail bersih/tekstur" atau "perbandingan sebelum-sesudah", bukan adegan meracik.
- **C2.** Larangan eksplisit di mandat untuk klip pasca-bridge saat policy aktif: tidak boleh pindah ke adegan memasak, meracik rempah, atau flat-lay bahan, kecuali kit memang bergenre resep.
- **C3.** Selidiki apakah drift berasal dari KB kuliner, brand voice DapurBotani, atau few-shot `dynamicPromptFields`. Bila ya, nonaktifkan atau beri prioritas lebih rendah saat policy aktif.

## D. Produk "Bekerja" Sesuai Bentuk Aslinya (P4)
- **D1.** Tambahkan resolusi **bentuk produk** (`product_form`): madu/cairan kental, serbuk, kapsul, cairan bening, minyak, dan lainnya. Ambil dari data produk (product truth/packaging type/nama) dengan fallback aman. Untuk GarliBee: madu kental + siung bawang tunggal.
- **D2.** Kit tidak lagi mengunci "herbal powder". `beats.reaction` memakai placeholder `{product_substance}` yang diisi sesuai `product_form`. Contoh: "a thick drizzle of golden honey with a solo garlic clove lands on the grease; the film instantly breaks apart".
- **D3.** Klip bridge menampilkan **aksi + reaksi yang terlihat**, bukan sekadar memegang toples. Product Truth Lock tetap berlaku untuk toplesnya.
- Tes: semua 28 kit lolos render teks dengan minimal 3 `product_form` berbeda tanpa sisa placeholder.

## E. Kontras Kotor → Bersih Terlihat (P5)
- **E1.** Periksa apakah `lightingTupleForClip` benar-benar sampai ke **prompt start frame** dan prompt video, atau tertimpa lighting brand/VI. Frame staging terlihat hangat-krem seragam.
- **E2.** Klip pre-bridge: lighting lebih keras/dingin/redup, close-up kotoran yang jelas (minyak mengilap, endapan, debu terlihat melayang dalam berkas cahaya). Klip pasca-bridge: high-key, bersih, cerah.
- **E3.** Perkuat `beats.problem` pada kit yang hook-nya lemah. Prioritas: `oil_powder_emulsify`, `santan_food_coma`, `carpet_deep_clean` (debu harus **terlihat**, mis. "backlit dust cloud bursting from the carpet").

## F. Variasi Antar-Video (P6)
- **F1.** Rotasi deterministik per video (berdasarkan item id), dari palet aman:
  - Warna lengan/wardrobe: 4–6 warna modest (mis. sage, navy, abu muda, putih gading, maroon pudar, mocca). Tetap **lengan menutup pergelangan**.
  - Sudut kamera dominan: top-down, eye-level samping, macro dekat, 3/4 dari depan.
- **F2.** Konsistensi tetap **di dalam satu video** (warna lengan sama di semua klip satu video).
- Tes: 7 item berurutan → minimal 4 kombinasi warna/sudut berbeda.

## G. Reviewer Visual Otomatis untuk Start Frame (P1, lapis kedua: deteksi)
Pencegahan (A–B) mengurangi halusinasi, tapi tidak bisa menghilangkannya. Tambahkan **pemeriksa gambar** sebelum start frame dikirim ke render video:
- **G1.** Modul baru (mis. `lib/start-frame-visual-qc.js`) memakai model vision (Gemini, lewat key pool yang ada) untuk memeriksa setiap start frame dengan checklist JSON:
  - jumlah tangan (>2 = gagal), jari/anggota tubuh janggal, wajah terlihat, kulit lengan terbuka
  - produk/botol/toples muncul pada klip pre-bridge
  - objek asing yang tidak ada di prompt (daftar objek yang diharapkan dikirim bersama prompt)
  - teks/watermark aneh
  - kesesuaian dengan dunia metafora klip (skor 0–1)
- **G2.** Alur: frame lulus → lanjut. Frame gagal → regenerate start frame **maks. 2×** dengan catatan koreksi otomatis ("exactly two hands, remove the jar"). Masih gagal → tandai `needs_review` dan **jangan** lanjut render video untuk klip itu. Tampilkan alasannya di UI campaign (teks saja, token CSS yang ada).
- **G3.** Di balik flag terpisah `start_frame_visual_qc` per tenant (tanpa fallback default_tenant), dengan mode `report_only` (hanya mencatat) dan `enforce` (regenerate/blok). Uji staging dimulai dari `report_only`.
- **G4.** Catat jumlah panggilan vision dan retry per campaign. Biaya tambahan harus terlihat di laporan.
- **G5.** Prompt reviewer **tidak** memuat credential. Hasil QC disimpan di `result_json` per klip.

### Di luar cakupan putaran ini (catat sebagai usulan berikutnya)
- **QC pada video hasil render** (ambil 3–5 frame per klip setelah Veo, cek tangan/objek muncul tiba-tiba). Halusinasi saat gerakan, seperti tangan ketiga muncul di tengah video, hanya bisa ditangkap di sini. Solusinya **render ulang klip tersebut**, bukan menghapus frame, karena menghapus frame membuat video tersendat. Mulai dari `report_only` setelah G terbukti.

---

## Definition of Done (sebelum minta izin staging)
1. `implementation_plan_F2.1.md` lengkap, dan checkbox dicentang real-time.
2. Tes baru untuk A–G lulus. Regresi F1+F2 (21 tes) + suite regresi inti lulus tanpa mengubah snapshot lama. `npm run build` lulus.
3. Dokumen `f2.1-prompt-diff.md`: contoh prompt 3 klip (1, bridge, terakhir) untuk 2 kit (`carpet_deep_clean`, `greasy_tupperware`) sebelum vs sesudah. Tunjukkan negasi hilang, hitungan tangan muncul, reaksi produk sesuai bentuk madu.
4. Laporan singkat ke pengguna dengan **bahasa sederhana** (pengguna adalah marketer, bukan programmer): apa yang diperbaiki, apa yang belum, dan perkiraan biaya tambahan QC per video.

## H. Uji Ulang Staging (hanya setelah izin)
- Rilis minor/patch sesuai SOP, deploy staging, flag tetap hanya `default_tenant`.
- Batch **7 video baru** DapurBotani (topik campuran) + **1 video A/B** dengan `compact_prompts` on vs off.
- QC visual mode `report_only` dulu.
- Laporan: contact sheet 7×6 + tabel kriteria sukses:

| Kriteria | Target |
|---|---|
| Klip 1 tanpa manusia | 7/7 |
| Lengan terbuka | 0 frame |
| Tangan >2 (start frame) | 0 setelah QC; catat berapa yang tertangkap QC |
| Botol/toples pre-bridge | 0 |
| Klip terakhir menampilkan benda metafora yang sama dalam kondisi bersih | ≥6/7 |
| Produk terlihat "bekerja" di klip bridge | ≥6/7 |
| Kombinasi warna lengan/sudut berbeda | ≥4 dari 7 |
