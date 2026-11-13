# Instruksi Agent: Perbaikan Narasi VO (Kampanye Pilar & Multiplier)

Dokumen ini adalah instruksi kerja. Dokumen acuannya:
- `USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md`: analisa 65 naskah dan akar masalah (U1–U10).
- `plans/vo-narasi-reference/HASIL_UJI_PROMPT_VO.md`: hasil uji A/B di staging.
- `plans/vo-narasi-reference/newprompts.mjs`: **prompt v2 yang sudah diuji**, acuan teks prompt.
- `plans/vo-narasi-reference/harness.mjs` + `score.py`: alat uji ulang dan skor.

## Konteks penting

- **Server staging dipakai untuk produksi harian.** Setiap rilis ke staging langsung dipakai konten brand. Karena itu semua perubahan perilaku naskah **wajib di balik flag** dengan default **off** (lihat bagian Flag).
- Masalahnya: naskah VO Gemini mengambang, tidak berisi tips yang bisa dipraktikkan, keyword tidak dijawab, multiplier kehilangan takaran, dan klaim medis lolos ke TTS.
- Prinsip perbaikan: **isi dulu, baru gaya.** Gemini harus menyusun isi konkret (takeaways), naskah menyampaikan isi itu satu poin per klip, lalu validator menolak naskah yang tidak memuatnya.

## Langkah wajib sebelum coding

1. Baca keempat file acuan di atas.
2. Buat `vo_narasi_implementation_plan.md` dengan tracker Fase V0–V5 di bawah, lengkap dengan **Code Sebelum/Sesudah** per file, sama seperti format `finishing_pass_implementation_plan.md`.
3. Catat di plan hasil **audit model Gemini per tenant** (V0-3) sebelum fase lain dikerjakan.
4. Laporkan plan dan **berhenti**. Tunggu persetujuan user.

## Aturan umum

- Satu fase satu rilis, dengan tag versi seperti biasa.
- **Jangan memproses ulang** item atau video yang sudah `Completed`. Perubahan hanya berlaku untuk generasi baru.
- **Jangan mengubah aturan prompt visual** (faceless, kinetics, anatomy lock, T2I/I2V, start frame). Lingkup pekerjaan ini hanya naskah VO, planner isi, validator, dan kepatuhan.
- **Teks tidak boleh dikarang.** Angka spesifik brand atau produk (harga, ukuran, takaran) hanya boleh berasal dari data. Jika data kosong, pakai pegangan non-angka atau tandai `needs_data`.
- Jangan mengubah pengaturan model Gemini atau API key tanpa persetujuan user.
- Semua prompt baru juga harus berlaku untuk `target_language = en-US` (Habitfolk).

## Flag

Tambahkan ke `preset.workflow` (pola yang sama dengan `finishing_template`), dengan override per campaign:

| Flag | Nilai | Default |
|---|---|---|
| `vo_content_contract` | `off` / `on` | `off` |
| `vo_quality_gate` | `off` / `warn` / `enforce` | `off` |

- `vo_content_contract = on`: planner isi + Kontrak Isi VO (pilar) dan Kontrak Resep Sumber (multiplier) aktif.
- `vo_quality_gate = warn`: validator jalan dan skornya disimpan, tetapi tidak memblokir. `enforce`: 1× regenerate terarah, lalu status `review` jika masih gagal.
- Tampilkan kedua flag di UI Presets dan MCP (`cf_update_preset`), dibangun dari satu sumber, seperti registry template.
- Campaign dan preset lama tidak berubah (flag kosong = `off`).

Pengecualian: perbaikan bug kepatuhan **V0** berlaku langsung tanpa flag, karena menyangkut klaim medis yang sudah lolos ke suara.

---

## Fase V0: Kepatuhan & audit model (tanpa flag)

**V0-1. Audit kepatuhan multiplier tidak sampai ke TTS** (`lib/re-multiplier-worker.js` ±600–640, 904)
- Saat ini hasil `auditScriptForTikTok` disimpan ke `voice_over`, sedangkan TTS membaca `narration_transcript`, dan `selected_vo_version` tetap `original`.
- Audit hanya boleh menerima teks VO per scene (tanpa caption). Petakan `revised_script` per scene dengan validasi jumlah; jika jumlahnya tidak cocok, abaikan hasil audit dan catat warning.
- Tolak hasil audit yang memuat emoji, bullet (`•`, `-` di awal baris), atau label seperti "Bahan & Takaran:". Bukti kontaminasi: task `mul_261114_dvz288`, `mul_261113_0jbsl8`, `mul_261111_0wg4fz`.
- Jika `verdict` = `revise`/`fail`: TTS memakai versi revisi yang lolos pemeriksaan di atas. Jika versi revisi tidak valid, task masuk status review dan tidak auto-publish.

**V0-2. Filter klaim di naskah dan hook**
- Jalankan `isHerbalMedicalClaimPhrase` plus daftar tambahan (lemak visceral, bakar lemak, rontokkan lemak, racun, detoks/detox, ginjal, paru-paru, gula darah, kolesterol, kanker, tumor, metabolisme, imun, obat, menyembuhkan, asam urat, hipertensi, jantung) pada:
  - `narration_transcript` multiplier sebelum TTS;
  - `voiceover[].narration` pilar sebelum TTS;
  - `hook` hasil planner Call 2 (`lib/content-planner-engine.js` ±797–880). Hook yang kena ditulis ulang oleh planner, bukan dikunci ke VO. Contoh lolos saat ini: "Menjaga kesehatan jantung keluarga dimulai dari…" (Garlibee).
- Simpan daftar sebagai konstanta terpusat yang dipakai bersama oleh validator finishing yang sudah ada. Jangan menduplikasi.
- Berlaku untuk brand/preset dengan produk atau niche kesehatan/herbal (pakai penanda yang sudah ada, misalnya `isHerbalProduct` / niche `Health`).

**V0-3. Audit model Gemini per tenant (baca saja, jangan ubah)**
- Uji menunjukkan pemanggilan untuk `default_tenant` berjalan di `gemini-3.5-flash-lite` dan PT GIM sering di `gemini-2.5-flash`, padahal `MODULE_MODEL_MATRIX` menetapkan `gemini-3.6-flash`.
- Catat di plan, per tenant: `gemini_api_tier`, `gemini_model_primary`, `gemini_model_fallback`, `gemini_smart_routing`, dan model yang benar-benar terpakai pada 20 generasi terakhir (dari log).
- Usulkan perbaikan di plan, tetapi **jangan ubah** setting. Keputusan ada di user.

**Test V0:** unit test pemetaan audit (jumlah scene beda, caption bocor, emoji), filter klaim pada 5 kalimat nyata di atas, dan test bahwa TTS memakai versi revisi saat `verdict` = `revise`.

## Fase V1: Planner isi (payload)

**Tujuan:** setiap baris planner membawa isi yang harus disampaikan VO.

1. Tambahkan field ke output Call 1 (Skeleton) di `lib/content-planner-engine.js`, simpan di `content_planner_rows`, dan teruskan ke `row_creative_payload`:
   ```json
   "search_intent": "...",
   "search_answer": "≤20 kata, jawaban langsung",
   "takeaways": [{"point":"tindakan penonton","anchor":"pegangan konkret","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}],
   "clip_plan": [{"clip":2,"role":"jawaban|poin|contoh|cara_cek|kesalahan","takeaway_index":0}],
   "needs_data": ["..."]
   ```
2. Aturan prompt diambil dari `buildPayloadPlannerPrompt()` di `newprompts.mjs` (versi v2):
   - maksimal 3 takeaways;
   - `point` adalah tindakan penonton, bukan fakta produksi;
   - takeaway pertama menjawab keyword;
   - angka kosmetik dilarang;
   - aturan kejujuran data;
   - untuk herbal: cara pakai, bukan klaim.
3. **`clip_plan` wajib untuk video > 5 klip.** Uji Sasyahouse 8 klip menunjukkan isi habis di klip 4 tanpa rencana per klip. Setiap klip isi harus punya peran (poin → contoh → cara cek → kesalahan).
4. **Fallback:** item yang dibuat tanpa planner (atau baris lama tanpa payload) memakai satu panggilan Gemini tambahan saat generasi OPC dengan prompt yang sama, seperti di harness. Hasilnya disimpan ke `result_json.content_payload`.
5. Tampilkan `takeaways` dan `search_answer` di UI baris planner (bisa diedit operator sebelum produksi).
6. Jalur Keyword Editorial dari `lib/autonomous-engine.js` (±732, ±812) melewati planner. Pastikan payload ikut terbawa.

## Fase V2: Kontrak Isi VO pilar

Di `buildOrganicPillarPrompt` (`lib/prompts.js` ±2850) **hanya saat `vo_content_contract = on`**. Acuannya `patchPillarPrompt()` di `newprompts.mjs`, tetapi diimplementasikan sebagai bagian builder, bukan tambalan string:
1. Sisipkan seksi **KONTRAK ISI VO** sebelum "FONDASI KREATIF", berisi pertanyaan penonton, jawaban langsung, takeaways, dan `clip_plan`.
2. Ganti blok "CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE" dengan alur berbasis isi. Kata transisi (Padahal, Masalahnya, Nah, Di titik inilah, Di sinilah, Hasilnya, Makanya) maksimal 1 per naskah, dan dilarang pembuka yang sama di dua klip berurutan.
3. Narrative mode:
   - tambahkan mode **`Tips/Tutorial`** (default untuk Keyword Editorial dan angle Life Hack / Math Whiz / Problem You Didn't Know);
   - di Storytelling, ganti "Melukiskan suasana, proses, atau dinamika topik…" dengan "menyampaikan takeaways satu poin per klip";
   - di Storytelling, ganti "penutup hangat dan reflektif" dengan "ringkas poin terpenting + CTA".
4. Kontrak anchor: pegangan **wajib diucapkan dengan isi yang sama**, tidak boleh diringkas menjadi kata umum.
5. Daftar kata samar (efektif, maksimal, optimal, tepat, sempurna, berkualitas, pilihan, terbaik, alami, kebugaran, nyaman, praktis, secukupnya, sebentar, beberapa) hanya boleh dipakai jika kalimat yang sama memuat pegangan. Simpan sebagai konstanta terpusat (ID + padanan EN).
6. Hint `narration` scene 2 di skema output diganti dari "diawali partikel wacana" menjadi "memuat jawaban langsung / takeaway pertama".
7. Saat flag `off`, output prompt **harus identik byte-per-byte** dengan versi sekarang. Buat snapshot test.

## Fase V3: Kontrak Resep Sumber multiplier

Di `buildMultiplierPhase2Prompt` (`lib/prompts.js` ±3419) saat `vo_content_contract = on`. Acuannya `patchMultiplierPrompt()`:
1. Output JSON tambahan `source_recipe_lock` {ingredients:[{name, amount}], timed_steps:[]} dan `on_screen_amounts`.
2. Semua bahan inti disebut dengan nama asli. Kata pengganti seperti "bahan pilihan", "bahan alami", dan "rempah ini" dilarang.
3. Durasi kunci sumber (rendam semalaman, rebus sampai menyusut setengah, dsb.) wajib diucapkan. Takaran boleh dipindah ke `on_screen_amounts`.
4. Teruskan `on_screen_amounts` ke `finishing_plan` (layer `tips`/chip bahan) bila template finishing aktif, agar angka tampil di layar.
5. Mode tanpa bridging: tidak boleh ada merek di VO (contoh lolos saat ini: "Nutrifarm Sari Lemon Murni" di `mul_261113_0jbsl8`).
6. Di Storytelling, ganti "Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran" dengan "Fokus pada langkah yang bisa ditiru: bahan, takaran, durasi, tanda selesai."

## Fase V4: Validator + regenerate terarah

Buat modul `lib/vo-quality-validator.js` (fungsi murni + test), dipanggil setelah JSON VO diterima di jalur pilar, multiplier, dan resep. Logika awal ada di `score.py`; perbaiki deteksinya (tokenisasi kalimat, ID + EN).

| Cek | Batas lolos |
|---|---|
| Klip isi berpegangan (angka/takaran/durasi/urutan/titik/kriteria) | ≥ 60% |
| Anchor dari payload/lock muncul di naskah (pencocokan token inti) | ≥ 80% anchor |
| Kata samar tanpa pegangan | ≤ 2 per naskah |
| Kata transisi formula | ≤ 1, tanpa pembuka sama berurutan |
| Keyword: jawaban (token `search_answer`) di klip 2 | wajib |
| Multiplier: bahan `source_recipe_lock` disebut | 100% |
| Klaim (daftar V0-2) | 0 |
| Kata per klip | ≤ batas `words_per_clip` |

- `warn`: simpan skor ke `result_json.vo_quality` dan tampilkan badge skor di halaman review campaign dan multiplier.
- `enforce`: jika gagal, lakukan 1× regenerate dengan daftar pelanggaran spesifik dalam prompt ("klip 3 tidak memuat 'tambah sepuluh persen'"). Jika masih gagal, status menjadi `review` dan tidak auto-publish/schedule.
- Tambahkan ringkasan skor rata-rata per brand per minggu (endpoint atau MCP baca) untuk pemantauan.

## Fase V5: Data produk & resep

1. Tambahkan field produk: `cara_pakai`, `takaran_label`, `penyimpanan`, `rasa_tekstur`, `fakta_produksi`. Planner memakai `cara_pakai` sebagai instruksi dan `fakta_produksi` hanya sebagai informasi (uji Garlibee: "fermentasi 3 bulan" sempat menjadi perintah untuk penonton).
2. Jalur resep OPC (`lib/recipe-production-adapter.js` dan builder resep terkait): setiap langkah masak wajib punya parameter (suhu/api, waktu, takaran, atau tanda selesai). Klip pengisi dilarang (menyiapkan gelas kosong, menancapkan sedotan, "lihat cantiknya"), dan langkah kecil digabung. Contoh lemah saat ini: Habitfolk "Air fry until golden", Nutriblend 15 klip dengan 4–5 klip pengisi.
3. Isi field produk Garlibee hanya dari data yang ada. Jika kosong, laporkan ke user sebagai daftar data yang dibutuhkan; jangan mengarang.

## Verifikasi per fase

- Unit test untuk semua fungsi baru, dan snapshot test prompt dengan flag `off` (identik dengan sekarang).
- Uji ulang memakai `plans/vo-narasi-reference/harness.mjs` pada 6 kasus acuan (`opc_2123`, `opc_2106`, `opc_2116`, Sasyahouse "Anak Rantau 101", `mul_261114_dvz288`, `mul_261113_lu12u7`), ditambah 2 kasus baru per brand untuk 7 brand (Siasat Sehat, Dapur Botani, Habitfolk, Sasyahouse, Nutriblend, Ruang Akustik ID, Solusi Thermal ID).
  - Harness hanya membaca DB dan memanggil Gemini.
  - **Tulis output di luar folder release** (pakai path absolut). Di uji sebelumnya file sempat tertulis ke folder release karena `process.chdir`.
- Laporkan tabel skor lama vs baru per kasus, beserta model yang terpakai per panggilan.
- Setelah V2 dan V4 dirilis, user yang memutuskan flag dinyalakan untuk brand mana. Agent tidak menyalakan flag di preset produksi.

## Ringkasan tracker

| Fase | Isi | Flag |
|---|---|---|
| V0 | Audit multiplier → TTS, filter klaim (VO + hook planner), audit model per tenant | tanpa flag |
| V1 | Planner isi: `search_answer`, `takeaways`, `clip_plan`, fallback payload saat generasi | bawaan, hanya dipakai saat flag `on` |
| V2 | Kontrak Isi VO pilar + mode Tips/Tutorial | `vo_content_contract` |
| V3 | Kontrak Resep Sumber multiplier + `on_screen_amounts` | `vo_content_contract` |
| V4 | Validator + regenerate terarah + skor per brand | `vo_quality_gate` |
| V5 | Field data produk + parameter langkah resep | – |

Aturan lain tetap berlaku: satu fase per rilis, item `Completed` tidak diproses ulang, teks tidak boleh dikarang, dan pengaturan model atau flag produksi adalah keputusan user.
