# Instruksi Agent Antigravity — K7: Polish Scene Director sebelum Produksi

> Tanggal: 2026-11-14 · Basis: `v2.47.1` (`9bfa082`) · Sumber: `stage-k1-k6-staging-report.md`, ditambah review visual reviewer atas `contact_sheet_scene_director_6x6.png` dan `contact_sheet_before_after_sd.png`.
> Aturan umum: tulis plan singkat dengan Sebelum/Sesudah di `implementation_plan.md` (bagian K7), tes lokal, lalu **berhenti sebelum rilis/deploy** dan lapor dengan bahasa sederhana. Semua perubahan hanya aktif saat `planner_scene_director = on`; perilaku saat flag `off` harus identik. Production tidak disentuh.

## Ringkasan temuan reviewer
- Masalah lokasi monoton **sudah teratasi** (6/6 lokasi sesuai planner, 3D 1/6).
- Muncul **cetakan baru**: tangan diam tergeletak di meja kayu (#2144 C4, #2146 C3–C4, #2147 C3, #2148 C4), dan semua video bernuansa kayu cokelat + lengan hijau zaitun.
- **Hook klip 1 melemah**: kartu identitas v3 mematikan metaphor engine, sehingga klip 1 menjadi still-life tenang yang tidak menghentikan scroll.
- **Warna lengan tidak terkunci**:
  - #2146 berganti 4 warna;
  - #2148 target terakota tetapi hijau;
  - #2145 C5–C6 baju hitam/navy kaus, bukan mocca gamis;
  - mayoritas tertarik ke zaitun.
- **Framing naik sampai leher**: #2145 C3/C5/C6, #2144 C3, #2148 C3, #2147 C4 (torso duduk). Kunci dada-ke-bawah F2.2 H3 tampaknya tidak berlaku di jalur Scene Director/3D.
- **Malam tidak terasa malam**: #2147 dan #2143 sebagian frame masih bercahaya jendela terang.
- **Bocor pre-bridge**: toples madu #2145 C4; deretan toples bumbu di pantry #2146 C1–C2.
- **Rubrik QC** masih memakai asumsi Metaphor World, sehingga perabot ruangan dan foto keluarga dalam bingkai dianggap pelanggaran.
- **Metadata**: `[CAMERA FRAMING: …]` bocor ke `visual_description` #2148.

## K7.1 — Tangan wajib "berakting" (anti tangan diam)
- Setiap beat live-action di `angle-visual-formats.js`/Scene Director wajib punya **satu kata kerja aksi tangan yang konkret dan berbeda** (menuang, mengaduk, melipat, mengupas, menyeka, menulis, merapikan, membuka laci, menyalakan lampu, dll.), diambil dari `while`/`visual_action_hint`/properti situasional.
- Pose pasif ("hands resting flat on table", "hands placed on lap", "hands on knees") **maksimal 1 klip per video** dan tidak boleh di klip 1, 2, atau terakhir.
- Tambahkan ke Diversity Guard: hitung klip berpose pasif per video dan per batch (report_only).
- Tes: beat plan 6 klip berisi ≥5 kata kerja aksi berbeda; frasa pasif ≤1.

## K7.2 — Hook klip 1 tetap menghentikan scroll
- Saat Scene Director aktif, **klip 1 memakai "Situational Hook"**: satu gambar pembuka yang mengejutkan atau mengusik, **di lokasi dan situasi planner**. Ini bukan still-life tenang. Contoh pola:
  - **close-up masalah:** piring sisa gorengan berminyak di meja makan siang;
  - **kontras:** tumpukan struk obat di nakas malam;
  - **aksi terhenti:** tangan menjatuhkan sendok;
  - **visual "jijik"** dari metaphor kit yang **dipindah ke lokasi planner**.
- Izinkan **metaphor kit hanya untuk klip 1 (dan opsional klip 2)** pada kartu identitas v3. Aktifkan lewat `metaphor_engine.mode = 'hook_only'` di preset v3 (default untuk `dapurbotani_identity_v3`; siasatsehat/nutriblend mengikuti). Klip 3 dst. tetap planner-driven, sehingga koeksistensi v2.47.1 tidak rusak.
- Aturan F2.1 tetap berlaku: klip 1 object-only tanpa tangan bila memakai kit metafora.
- Tes: prompt v3 + Scene Director memuat blok hook klip 1 yang menyebut lokasi planner; klip 3–6 tidak memuat dunia metafora.

## K7.3 — Kunci warna baju dengan gambar referensi lengan (§4b langkah 4–5)
- Kalimat saja terbukti gagal. Implementasikan **gambar referensi "tangan + lengan baju" per video**:
  1. buat 1 gambar per item dari `resolved_wardrobe_color` + talent kartu identitas (latar netral polos, tanpa produk);
  2. simpan path-nya di `result_json` (mis. `wardrobe_reference_image`);
  3. kirim sebagai referensi tambahan ke **semua start frame live-action** item itu, mengikuti pola referensi produk yang sudah ada.
- Pilih ulang palet DapurBotani ke warna yang **stabil di model gambar**, dengan nama tegas dan berbeda jauh satu sama lain. Contoh: `sage green`, `warm cream`, `dusty rose`, `light grey`, `navy`. Hindari dua warna yang mirip (olive vs sage) dalam satu palet. Catat warna yang sering melenceng.
- Wardrobe untuk DapurBotani harus selalu **gamis/abaya longgar**, bukan kaus atau kemeja. Masukkan kata garmen ke kalimat kunci dan ke gambar referensi.
- Aktifkan cek **kecocokan warna lengan** di Visual QC (F2.2 H4) untuk jalur Scene Director: lengan tidak cocok dengan target menghasilkan flag `wardrobe_mismatch`.
- Ukur: dari 6 video, berapa yang warna lengannya sama di semua klip **dan** sesuai target.

## K7.4 — Framing dada ke bawah di semua jalur
- Pastikan kunci framing F2.2 H3 (tepi atas frame di bawah bahu, fokus tangan) juga diterapkan di jalur Scene Director, mode `3d_bio_cellular`, `symbolic_surrealism`, dan klip bridge/hero.
- Larang pose duduk yang memperlihatkan torso + pangkuan secara penuh. Bila adegan duduk, kamera fokus ke tangan dan objek di meja.
- Klip 3D: visual mekanisme tanpa tubuh manusia berbaju, atau lengan tertutup kain sesuai kartu identitas. Larang teks/garis HUD.

## K7.5 — Malam benar-benar malam
- Saat `time_key = night`: jendela harus gelap (langit malam/tirai tertutup), tanpa cahaya matahari dari jendela. Sumber cahaya: lampu meja/lampu langit-langit hangat, tetap terang dan terbaca (R3).
- Tambahkan ke QC (report_only): `time_of_day_mismatch` bila adegan malam bercahaya siang.

## K7.6 — Tanpa toples generik sebelum bridge
- Klip pre-bridge di lokasi dapur/pantry/ruang makan: larang toples kaca, stoples bumbu, dan botol berlabel di latar. Ganti dengan properti situasi (piring, mangkuk keramik, talenan, kain lap).
- Pertahankan pemisahan R1 (`visual_action_hint_pre_bridge` vs `_bridge`).

## K7.7 — Rubrik QC khusus Scene Director
- Di `buildStartFrameQcPrompt`, bila `environment_policy = 'planner_driven'`:
  - acuan dunia = lokasi + properti situasional dari `resolved_scene_brief` (bukan dunia metafora);
  - perabot wajar di lokasi itu **bukan** `foreign_objects`;
  - wajah di dalam **foto berbingkai, poster, atau layar** bukan `visible_face` talent;
  - tetap cek: wajah talent, lengan terbuka (sesuai kartu identitas), tangan >2, produk pre-bridge, teks/watermark, `wardrobe_mismatch`, dan `time_of_day_mismatch`.
- Tes fixture: foto keluarga dalam bingkai lulus; pantry dengan perabot wajar lulus; toples GarliBee di klip 2 gagal.

## K7.8 — Bersihkan metadata
- Jangan biarkan tag `[CAMERA FRAMING: …]` dan tag injeksi lain masuk ke `storyboard[*].visual_description` yang tampil di UI.

## K7.9 — Visual QC batch: 1 panggilan untuk semua klip
- **Tujuan:** panggilan Vision QC per video turun dari N (1 per klip) menjadi **1**. Bonusnya, pemeriksa bisa menilai **konsistensi antar-klip**.
- **Mekanisme:**
  - Setelah semua start frame selesai, kirim **semua gambar dalam 1 panggilan Gemini**, dengan label urut `Clip 1 … Clip N` dan konteks per klip (fungsi klip, `expectsProduct`, lokasi/waktu Scene Director atau dunia metafora).
  - Output JSON berisi:
    - `clips[]`: verdict per klip dengan field yang sama seperti sekarang, ditambah `wardrobe_mismatch` dan `time_of_day_mismatch`;
    - `consistency`: `wardrobe_color_same_all_clips`, `location_consistent`, dan `outlier_clips[]`.
  - Klip yang ditolak (mode `enforce`) dibuat ulang, lalu **diperiksa sendiri (1 gambar per panggilan)**, sambil membandingkan dengan 1 gambar klip lain yang lolos sebagai acuan warna.
  - Bila panggilan batch gagal atau timeout, **fallback** ke pemeriksaan per klip (perilaku lama).
- **Setting:** `start_frame_visual_qc_batch = 'on' | 'off'` (default `off`). Dengan `off`, perilaku identik dengan sekarang.
- **Uji ketelitian (wajib sebelum default `on`):** jalankan **kedua cara berdampingan** (mode shadow) pada batch uji. Bandingkan per klip:
  - apakah temuan nyata yang dulu tertangkap masih tertangkap? Fixture dari F2.1: tepi wajah #2133 C2, botol sabun #2139 C2, lengan tersingkap #2140 C5;
  - selisih flag antara batch dan per klip;
  - jumlah panggilan dan token.
- Laporkan tabel perbandingan ini.

## K7.10 — Hemat kuota Gemini free tier (sumber: `plans/visual-metaphor-world/audit-panggilan-gemini-per-video.md`)
> Konteks pengguna: semua key adalah **free tier dari project berbeda**, dengan batas **20 RPD per key** (17 key = 340/hari). Yang paling mahal adalah **jumlah request**, bukan token. Saat ini 1 video = 7 request, dan 6 di antaranya dari Vision QC.

1. **Prioritaskan K7.9 (QC batch).** Target: 1 video ≈ 2 request (storyboard + 1 QC batch) saat `report_only`.
2. **Model QC terpisah dari model storyboard.**
   - Tambahkan setting `start_frame_visual_qc_model` (default = perilaku sekarang) agar Vision QC bisa memakai model Gemini ringan yang berbeda. Kuota free tier dihitung per model per project, sehingga QC tidak menghabiskan jatah storyboard.
   - Pencatatan pemakaian key (`api_key_usages`) harus **dipisah per model**: hitung dan batasi `daily_limit` per (key, model), bukan per key saja.
   - Sebelum memilih model, cek batas RPD terbaru di halaman rate limit Google AI Studio dan tulis sumbernya di laporan. Jangan berasumsi.
3. **Hitung semua percobaan HTTP**, termasuk retry 503/404 dan rotasi key, di `api_key_usages`, agar sisa kuota tidak terlihat lebih besar dari kenyataan.
4. **Rem kuota harian:**
   - Bila sisa kuota pool < 15%, item baru ditahan dengan status jelas di UI ("kuota Gemini harian hampir habis, lanjut besok"). Item tidak boleh gagal acak karena 429.
   - Tampilkan ringkas di UI/settings: terpakai hari ini / kapasitas, per model.

## K7.11 — Bug audit naskah VO tidak pernah jalan (WAJIB, bug kepatuhan)
- `lib/scheduler-processors.js` ±L5972: `campaign.enable_vo_audit === 1` selalu `false` di PostgreSQL karena kolom `bigint` dikembalikan sebagai string `'1'`. Ganti dengan pemeriksaan numerik yang aman (`Number(...) === 1`). **Cari pola `=== 1` serupa untuk kolom flag campaign lain** (`enable_tts`, `enable_glabs`, `enable_ffmpeg`, dll.) di jalur Pillar/OPC, lalu laporkan atau perbaiki.
- `lib/db.js` `updatePillarCampaignItem`: tambahkan `compliance_status`, `compliance_score`, `compliance_log_json`, `original_voiceover`, `tiktok_safe_voiceover`, dan `selected_vo_version` ke daftar kolom yang diizinkan, agar hasil audit tersimpan.
- Tes: campaign dengan `enable_vo_audit = '1'` (string) menjalankan audit; hasil audit tersimpan dan tampil di halaman detail. Naskah yang lolos pre-filter kata tetap **0 request** Gemini.

## K7.12 — Pencatatan panggilan Gemini yang seragam
- Satu baris log seragam untuk semua pemanggil Gemini (storyboard, Vision QC, audit VO, rewrite VO, TTS):
  `[GEMINI_CALL] campaign=… item=… clip=… stage=… attempt=… key_id=… model=… status=… pt=… ct=… ms=…` (tanpa isi key).
- Panggil `recordAiTokenUsage()` dengan `meta: { campaign_id, item_id, stage, clip_index }` di `generateWithImage()` (Vision QC), `tiktok-compliance-service.js`, dan modul TTS Gemini, agar semua biaya per video bisa dihitung dengan satu query.

## Uji staging (setelah izin rilis)
1. Rilis ke staging (flag tetap seperti sekarang di `default_tenant`). Untuk uji ini, nyalakan `start_frame_visual_qc_batch = 'on'` dalam mode shadow (per klip tetap jalan juga).
2. Generate **sampai video penuh** (start frame + Veo + TTS + ffmpeg), `start_frame_visual_qc = report_only`, dalam **dua jalur**:
   - **Jalur A — Metafora (narasi sudah bagus):** kloning baris `opc_261114_f21b7` item **#2133, #2135, #2138, #2139** (yang dulu framing-nya naik ke dagu). **Mode metafora dan VI tetap** (`vi_dapurbotani_metaphor_world_test`), **tanpa** Scene Director. Tujuannya mengecek K7.3 (warna/gamis), K7.4 (dada ke bawah), K7.7/K7.9 (QC) pada narasi yang sama. Bandingkan langsung dengan video lama.
   - **Jalur B — Scene Director:** kloning 6 baris `#2051`–`#2056` (boleh dikurangi jadi 3 bila antrean padat: #2053, #2054, #2055), VI `dapurbotani_identity_v3`. Tujuannya mengecek K7.1, K7.2, K7.5, K7.6.
3. Laporkan:
   - contact sheet per jalur;
   - contact sheet before/after jalur A (lama vs baru, per item);
   - link semua video `.mp4`;
   - tabel kriteria di bawah (pisahkan per jalur bila relevan);
   - tabel perbandingan QC batch vs per klip (K7.9).

| Kriteria | Target |
|---|---|
| Lokasi sesuai planner | ≥5/6 (pertahankan) |
| Klip 1 punya hook situasional yang mengusik | ≥5/6 |
| Klip pose tangan pasif | ≤1 per video |
| Warna lengan konsisten **dan** sesuai target di semua klip | ≥5/6 video |
| DapurBotani tampil bergamis | 6/6 |
| Framing naik sampai leher/wajah | 0 frame |
| Adegan malam tanpa cahaya siang di jendela | 100% klip malam |
| Toples/produk pre-bridge | 0 |
| QC false positive (perabot/foto berbingkai) | 0 |
| Video jadi tanpa macet | semua |
| Jalur A: narasi metafora tetap utuh seperti versi lama | semua |
| QC batch menangkap 3 temuan fixture F2.1 | 3/3 |
| Panggilan QC per video (batch, tanpa retry) | 1 |
| Total request Gemini per video (`report_only`, MiniMax TTS) | ≤2 (+1 bila audit VO memanggil Gemini) |
| Audit VO benar-benar jalan dan hasilnya tersimpan | semua item dengan `enable_vo_audit = 1` |
| `api_key_usages` = jumlah baris `[GEMINI_CALL]` (termasuk retry) | cocok 100% |

## Batasan
- Satu API call storyboard tetap (single-pass). Gambar referensi lengan adalah 1 generate gambar tambahan per video lewat jalur gambar yang sama. Catat dampaknya ke waktu/antrean di laporan.
- Jangan menulis secret ke file. Production tidak disentuh. Jangan polling SSH berulang.

---

## Catatan Reviewer Pra-Rilis K7 (2026-11-14)
Hasil cek reviewer:
- tes K7 15/15 lulus;
- kegagalan `bridge-prompt-snapshot` dan `gemini-waterfall-chain` **terbukti sudah ada di `v2.47.1`** (dicek pada salinan bersih HEAD), jadi bukan regresi K7.

Sebelum rilis, kerjakan 3 hal berikut:

1. **Tanggal kuota harus mengikuti reset Google (Pacific Time), bukan UTC.**
   - `api_key_usages.date` saat ini memakai `new Date().toISOString()` (tanggal UTC, reset pukul 07:00 WIB).
   - Kuota Gemini direset pada tengah malam **America/Los_Angeles** (±14:00/15:00 WIB).
   - Akibatnya, sekitar 7 jam per hari aplikasi mengira kuota sudah penuh kembali, padahal Google belum mereset. Muncul 429 beruntun, dan rem 15% tidak akurat.
   - **Perbaikan:** hitung tanggal pemakaian dan sisa kuota dengan zona `America/Los_Angeles` (otomatis mengikuti DST). Tes: pukul 10:00 WIB masih tergolong tanggal PT kemarin.
2. **Rem kuota diberi saklar.**
   - Tambahkan setting `gemini_quota_brake` (`on`/`off`, default `on`) agar pengguna bisa mematikannya cepat bila salah tahan.
   - Pesan di UI menyebut jam reset dalam **WIB**.
   - Catat di laporan: retry 503/429 ikut dihitung, sehingga hitungan aplikasi lebih konservatif daripada Google. Ini disengaja.
3. **Migrasi `api_key_usages` (model_name + ganti unique key).**
   - Migrasi berjalan otomatis saat aplikasi start dan menghapus constraint/unique index lama. Sebelum deploy staging:
     - backup tabel `staging.api_key_usages` (cukup `CREATE TABLE … AS SELECT` di schema staging);
     - pastikan proses runtime staging benar-benar menjalankan migrasi ini (build memakai `DISABLE_AUTO_MIGRATIONS=true`);
     - verifikasi index `api_key_usages_date_key_model_uq` ada dan penulisan pemakaian berhasil.
   - Tulis di catatan rilis bahwa **migrasi ini akan ikut berjalan di schema `public` saat production kelak dideploy**, supaya tidak mengejutkan. Production tetap tidak disentuh sekarang.

Setelah 3 hal di atas selesai: rilis dan deploy staging dengan semua flag baru tetap `off`, lalu jalankan rencana uji di bagian "Uji staging" (jalur A + B, QC batch mode shadow).
