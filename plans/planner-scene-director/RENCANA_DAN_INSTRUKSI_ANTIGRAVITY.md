# Bongkar Cetakan: Planner → Storyboard ("Scene Director")

> Status: **RENCANA + INSTRUKSI untuk Agent Antigravity — belum ada perubahan kode.**
> Tanggal: 2026-11-14 · Basis: `main @ 7cb97ff` (v2.46.1)
> Bukti masalah: `plans/visual-metaphor-world/TEMUAN_PLANNER_VS_STORYBOARD.md`
> Usulan metafor 3-lapis (`ANALISA_POLA_METAFOR_3_PRODUK.md`) **ditunda**. Fokus fase ini hanya membongkar cetakan.

---

## 1. Masalah (ringkas)
Content Planner menghasilkan baris yang beragam (CEP, W's Matrix, Context, VFO, 30 Strategic Angle, Hook, Visual Action). Tetapi storyboard dan prompt selalu jatuh ke **cetakan adegan yang sama** di **set brand yang sama**. Bukti: campaign `opc_261108_8618kc` (6 baris dengan 6 konteks berbeda: ruang keluarga malam, dapur akhir pekan, ruang makan siang, pantry pagi bersama suami, kamar tidur malam, teras sore). Keenam video punya urutan identik: *bawang di slate → cangkir teh → 3D sel → meja kosong + lilin → tangan buka toples → packshot slate*.

## 2. Akar penyebab di kode (sudah diverifikasi reviewer)

| # | Penyebab | Lokasi | Mekanisme |
|---|---|---|---|
| R1 | **Posisi klip → fungsi naratif → gaya visual dikunci** | `lib/visual-identity-allocator.js` `allocateClipsToNarrativeModes` + tabel `buildVisualIdentityPromptSection` | Klip 1 selalu *hook*, 2 *context*, 3 *mechanism*, 4–5 *consequence/evidence*, 6 *conclusion*. Setiap fungsi dipetakan ke 1 gaya VI. Hasilnya cetakan 6 slot yang sama untuk semua baris |
| R2 | **Deskripsi gaya membawa lokasi** | `lib/visual-language-catalog.js` | `culinary_cinematic` = *"Artisanal kitchen, culinary cooking action…"*. Setiap klip bergaya kuliner otomatis ditarik ke dapur |
| R3 | **Latar & properti brand dikunci, menimpa konteks planner** | `allocator.js` (blok ENVIRONMENT MANDATE, "DILARANG KERAS menyimpang dari latar…"), tuple `(Location: [MANDATE 33 - Verbatim Scene Lock])` di few-shot `prompts.js` | Item dengan konteks "kamar tidur malam" tetap digambar "apothecary black slate" |
| R4 | **Konteks planner hanya jadi teks rujukan, tidak jadi instruksi per klip** | `prompts.js` `strategicPlanningSection` (±`:1945`); `visual_action_guideline` hanya untuk klip 1 (±`:3220`) | Blok VI berlabel *MANDATORY CONTRACT* mengalahkan blok planner untuk urusan visual |
| R5 | **Tokoh dan situasi dibuang** | aturan faceless + "pure object" | "Bunda duduk merenung" berubah jadi still-life benda. When/While/How-Feeling tidak terlihat |
| R6 | **Strategic Angle tidak punya format visual** | 30 angle di `kb/STRATEGIC_FRAMEWORKS_v47.9.md` | *Math Whiz*, *Caregiver*, *Scientific Proof* hanya menjadi label/hook teks. Di dokumen lama, setiap angle punya bentuk visual sendiri |
| R7 | **Slot 3D selalu ada** | routing VI `mechanism → 3d_bio_cellular` + auto-inject `has3dClues` | Semua video punya "jeda 3D" di tengah |

## 3. Prinsip solusi
**Planner menentukan APA, DI MANA, KAPAN, SIAPA. Visual Identity menentukan BAGAIMANA tampilannya.**

| Diputuskan oleh Planner (per baris) | Diputuskan oleh Visual Identity (per brand) |
|---|---|
| Lokasi & waktu (dari Context + W's *Where/When*) | Gaya cahaya/color grading, tekstur, finishing |
| Properti situasi (W's *While/With What*) | Wardrobe & aturan lengan, faceless |
| Emosi/ritme (W's *How Feeling*, VFO) | Product Truth (bentuk produk) |
| Alur & format visual (Strategic Angle) | Palet warna & aksen brand |
| Aksi tangan (Visual Action) | Batas kepatuhan |

---

## 4. Desain (5 komponen)

### K1. Scene Brief per baris (deterministik, sebelum prompt dibangun)
Modul baru `lib/scene-brief.js`: `buildSceneBrief(row, viConfig, product)` →
```js
{
  location: 'family living room corner',      // dari context / W's Where; fallback VI env
  time_of_day: 'night',                       // dari W's When / context
  lighting_mood: 'warm table lamp, dim',      // turunan time_of_day, di-"skin" oleh gaya cahaya VI
  situational_props: ['family photo frame', 'warm mug', 'reading glasses'],  // dari While/With What + context
  feeling: 'quiet worry about long-term health',
  protagonist: { presence: 'hands_acting', who: 'mother', sleeve_policy: 'wrists_covered' },
  angle_format_key: 'caregiver_young_old_hands', // dari K3
  source_trace: { location: 'context', time: 'ws_matrix.when', ... }       // jejak untuk debug/UI
}
```
- Parser kata kunci ID/EN untuk lokasi (dapur, kamar, ruang keluarga, teras, kantor, mobil, kafe, kosan, masjid/sajadah, gym, dan sebagainya) serta waktu (pagi/siang/sore/malam/subuh).
- Bila tidak terdeteksi, fallback ke latar VI (perilaku lama).
- **Tanpa panggilan AI tambahan** (menjaga prinsip single-pass).

### K2. Hierarki prompt baru: Scene Brief > VI untuk lokasi
- Blok baru `🎬 SCENE DIRECTOR (WAJIB PER KLIP)` disuntikkan **sebelum** blok VI. Isinya: lokasi, waktu, properti, emosi, dan aksi tangan per klip.
- Blok VI diubah menjadi **"BRAND LOOK"**: gaya cahaya, warna, tekstur, wardrobe, dan product truth tetap berlaku. **Lokasi dan properti VI hanya menjadi fallback.**
- `environment.policy` (field yang sudah ada dari F2) mendapat nilai baru `planner_driven`. Bila aktif, kalimat "DILARANG KERAS menyimpang dari latar…" dan tuple `Verbatim Scene Lock` diganti dengan "lokasi mengikuti Scene Brief baris ini, konsisten di dalam satu video".
- Hapus kata lokasi dari deskripsi gaya di katalog. Contoh: `culinary_cinematic` → *"food & ingredient handling aesthetic, appetizing texture and warm light"* (tanpa "artisanal kitchen"). **Perhatian:** perubahan katalog berdampak global. Lakukan di balik flag (pakai teks katalog alternatif saat flag aktif) atau buktikan aman dengan snapshot.

### K3. Format visual per Strategic Angle (30 angle)
File data `lib/angle-visual-formats.js`: setiap angle → *format visual* (bentuk alur + adegan kunci). Draf awal (marketer/pengguna boleh merevisi):

| Angle | Format visual |
|---|---|
| The Math Whiz | Perbandingan biaya: struk/nota menumpuk vs 1 produk; kalkulator; uang kertas melayang |
| The Scientific Proof | Uji sederhana ala dapur: dua gelas berdampingan, sebelum/sesudah |
| The Blind Test | Dua wadah tanpa label, tangan memilih, reveal |
| The Stress Test | Produk diuji kondisi ekstrem (panas, lama, dikocok) |
| The Comparison (David vs Goliath) | Produk kecil sederhana vs deretan botol kimia besar |
| The Caregiver | Tangan muda merawat tangan tua (keduanya lengan tertutup) |
| The Origin Story | Bahan mentah dari sumbernya → proses → jar |
| The Heritage | Wadah/benda tradisional, resep warisan, kain batik |
| The Life Hack | POV cepat 3 langkah, jam/timer di frame |
| The Minimalist | Satu benda, latar bersih, gerakan pelan |
| The Sensory ASMR | Makro suara & tekstur: tuang, retak, aduk |
| The Pure Relief | Tegang → lega: bahu turun, napas, uap hangat |
| The Safe Haven | Ritual malam hangat: lampu meja, selimut, cangkir |
| The Guilty Pleasure | Godaan makanan (gorengan/martabak) → penyeimbang |
| The Problem You Didn't Know | Reveal "tersembunyi": senter, kaca pembesar, membalik benda |
| The Intellectual Flex | Mitos vs fakta: kartu terbalik, coretan, catatan |
| The Magic Moment | Satu transformasi visual dramatis (warna mekar, kristal larut) |
| The Second Chance | Barang lama dipulihkan / restart (kalender baru, sepatu lama dipakai lagi) |
| The Rebel Choice | Menyingkirkan kebiasaan umum (botol kimia digeser), memilih alami |
| The Revenge | Kembali ke aktivitas yang dulu terhambat (sepatu lari, tangga) |
| The Status Signal | Detail premium: jam tangan, meja rapi, tas kerja |
| The Secret Club | "Rahasia" komunitas: amplop, kotak, bisikan teks |
| The Belonging | Momen bersama: banyak cangkir di meja, piring berbagi |
| The FOMO | Hitung mundur, stok menipis, keranjang belanja |
| The Bundle Logic | Paket hemat tersusun, perbandingan isi |
| The One-Feature Obsession | Zoom terus ke satu fitur/bahan |
| The Taste Maker | Kreasi resep estetik (mocktail, plating) |
| The Artist | Proses racik yang indah, gerakan presisi |
| The Alpha | Ritme cepat, tegas, aktivitas produktif |
| The Absurdity | Kontras lucu/tak terduga (komedi visual) |

Format **menentukan alur** klip (beat), sehingga dua baris dengan angle berbeda tidak lagi punya urutan adegan yang sama.

### K4. Ganti alokasi posisi-tetap (R1, R7)
- Saat flag aktif, tabel *"Klip N → Fungsi → Gaya"* diganti dengan **beat dari format angle (K3)**, dan setiap beat memilih gaya VI yang paling cocok.
- **Slot 3D tidak wajib**: maksimal 1 klip, dan hanya bila angle bersifat edukasi/sains (*Scientific Proof, Intellectual Flex, Problem You Didn't Know, One-Feature Obsession*). Untuk angle emosional/aspirasional, 0 klip 3D.
- Konsistensi dengan F1/F2 (mode metaforik): bila kit metafor aktif, kit tetap menentukan dunia benda. Scene Brief menyumbang **situasi persona** (misal "malam di kamar") hanya untuk klip konteks, tanpa merusak kit.

### K5. Diversity Guard per campaign (report-only dulu)
- Setelah semua item satu campaign punya storyboard, hitung **sidik jari** tiap video (lokasi per klip + jenis adegan per klip). Bila ≥3 video punya urutan yang sama atau lokasi yang sama >70%, tandai di `result_json` + UI ("terlalu mirip dengan item #…").
- Mode `report_only` dulu. `enforce` (regenerate item yang terlalu mirip) menyusul setelah terbukti.

### K6. Visual Identity menjadi "Kartu Identitas Brand"
Lihat `plans/planner-scene-director/VI_SEBAGAI_IDENTITAS_BRAND.md`. Ringkasnya: VI format baru hanya memuat identitas (talent/tangan, aturan aurat & wajah, palet wardrobe yang dirotasi, palet warna, karakter cahaya tanpa waktu, finishing, signature kecil, batas gaya). Lokasi VI hanya cadangan. `mode_routing` per posisi, properti wajib, dan aksi dihapus dari VI format baru. `visual_signature` Brand Profile diabaikan untuk lokasi/3D saat VI format baru aktif. **VI lama tidak diubah.** VI format baru dibuat sebagai preset terpisah. **Draf isi kartu menunggu review pengguna** sebelum dibuat di staging.

---

## 5. Batasan & keselamatan
- Semua di balik flag per tenant **`planner_scene_director`** (`getSetting(..., false)`, tanpa fallback default_tenant). Flag off = prompt identik byte-per-byte dengan sekarang, dan snapshot lama tidak boleh diubah.
- **Single-pass** tetap: tidak ada panggilan AI tambahan untuk Scene Brief. Diversity Guard hanya membandingkan teks.
- Faceless, aturan lengan, larangan produk pre-bridge, kepatuhan klaim, dan QC visual F2.1 tetap berlaku.
- Path Strategic Campaign, Reverse Engineering, dan Multiplier **tidak disentuh** di fase ini. Cakupan: Pillar/OPC (product campaign & brand editorial).
- VI dan system preset yang ada tidak diubah datanya.

## 6. Kriteria sukses (uji ulang 6 baris yang sama)
Generate ulang 6 baris dari `opc_261108_8618kc` (atau duplikat campaign-nya) dengan flag on, lalu bandingkan dengan hasil lama:

| Kriteria | Target |
|---|---|
| Lokasi klip konteks sesuai konteks planner | ≥5/6 video |
| Tidak ada 2 video dengan urutan adegan sama | 6/6 unik |
| Video dengan slot 3D | ≤2/6 (hanya angle edukasi) |
| Situasi terlihat (properti When/While muncul di frame) | ≥5/6 |
| Kepatuhan (wajah, lengan, botol pre-bridge) | 0 pelanggaran |
| Diversity Guard menandai batch lama sebagai "mirip" dan batch baru "beragam" | Ya |

---

## 7. INSTRUKSI UNTUK AGENT ANTIGRAVITY

### Mandat
1. Baca `AGENTS.md`, dokumen ini, `plans/visual-metaphor-world/TEMUAN_PLANNER_VS_STORYBOARD.md`, serta kode terkait (`lib/prompts.js` [`buildPillarSharedPromptContext`, `strategicPlanningSection`, `dynamicPromptFields`, `buildOrganicPillarPrompt`], `lib/visual-identity-allocator.js`, `lib/visual-language-catalog.js`, `lib/kb/dynamic-story-curve.js`, `lib/metaphor-policy.js`, `lib/metaphor-world-kits.js`, `lib/scheduler-processors.js` `processPillarGenerator`, `kb/STRATEGIC_FRAMEWORKS_v47.9.md`).
2. **Verifikasi R1–R7** di kode aktual. Bila ada yang tidak sesuai, catat di plan.
3. Tulis `plans/planner-scene-director/implementation_plan.md` sesuai SOP (Code Sebelum/Sesudah per file + `## Execution Task List`), **sebelum** coding.
4. Implementasi K1–K5 di balik flag `planner_scene_director`, dengan tes:
   - `buildSceneBrief`: ≥15 contoh konteks nyata dari planner (ambil dari staging read-only atau fixture), deteksi lokasi/waktu/properti, fallback VI.
   - Flag off → snapshot prompt lama identik.
   - Flag on → blok Scene Director muncul, lock lokasi VI hilang, gaya katalog tanpa kata lokasi, tidak ada slot 3D untuk angle emosional.
   - Format angle: semua 30 angle punya format, dan dua angle berbeda menghasilkan beat berbeda.
   - Diversity Guard: batch fixture "mirip" ditandai, batch "beragam" tidak.
   - Regresi F1/F2/F2.1 + suite inti + `npm run build`.
5. Buat `plans/planner-scene-director/prompt-diff.md`: prompt sebelum/sesudah untuk 2 baris (`2053` ruang makan siang & `2055` kamar tidur malam).
6. **Berhenti sebelum rilis/deploy** dan laporkan ke pengguna dengan **bahasa sederhana** (pengguna adalah marketer): apa yang berubah, contoh sebelum/sesudah dalam kalimat biasa, risiko, dan permintaan izin uji staging.

### Uji staging (hanya setelah izin)
Rilis sesuai SOP → deploy staging → flag hanya di `default_tenant` → generate ulang 6 baris campaign `opc_261108_8618kc` (duplikat, jangan menimpa yang lama) → contact sheet 6×6 berdampingan (lama vs baru) + tabel kriteria sukses §6.

### Berhenti dan tanya bila
- Perubahan katalog gaya ternyata memengaruhi brand lain saat flag off.
- Scene Brief butuh panggilan AI tambahan agar akurat (melanggar single-pass). Ajukan opsi dulu.
- Konflik dengan perubahan lain di working tree.
