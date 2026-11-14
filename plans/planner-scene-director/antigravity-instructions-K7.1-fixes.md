# Instruksi Antigravity — K7.1: Perbaikan Jalur B (Baju, Malam, Klaim Jantung)

> Tanggal: 2026-11-14 · Penulis: Claude (reviewer) · Eksekutor: Antigravity
> Dasar: `stage-k7-staging-report.md` (v2.48.0 → v2.48.1), contact sheet Jalur B, dan cek baca-saja ke `staging.pillar_campaign_items` #2153–#2158.
> Lingkup: **Staging saja.** Production tidak dipakai pengguna, jadi **jangan dideploy**.
> Setelah K7.1 lolos uji: kerjakan Langkah 2 dari `USULAN_PANEL_FITUR_EKSPERIMEN.md`. Mockup panel **sudah disetujui** pengguna.

---

## Ringkasan masalah (bahasa pengguna)
| # | Masalah yang terlihat di video | Penyebab yang ditemukan reviewer |
|---|---|---|
| K7.1-A | Warna baju berganti-ganti antarklip, dan klip produk (C5–C6) hampir selalu jadi biru dongker | Warna baju tidak pernah ditulis di instruksi gambar Jalur B |
| K7.1-B | Adegan malam masih menampilkan jendela terang siang (#2153, #2157) | Kalimat cahaya bawaan VI `window_daylight` tetap masuk ke `[LAYER 3]` |
| K7.1-C | 5 dari 6 naskah menulis klaim jantung; #2154 lolos lewat kata "jantungmu" | Penulis naskah mengabaikan larangan, audit VO meluluskan, dan regex `\b…\b` tidak menangkap akhiran -mu/-nya |
| K7.1-D | Tes lokal ikut mengubah skema `public` | Tes berjalan tanpa `DISABLE_AUTO_MIGRATIONS=true` ke DB pusat |

---

## K7.1-A — Kunci warna baju di Jalur B

**Temuan kode** (`lib/opc-start-frame-request.js`):
- `applyModestPresenceAndWardrobe(...)` hanya menyisipkan `(Wardrobe: <warna>)` pada cabang `hasPolicyOverride` (jalur metafora penuh).
- Di Jalur B (kartu `*_identity_v3`, mode metafora `hook_only`), klip 2 ke atas masuk cabang `policy.active && modest_hands_active && !isClip1`. Cabang ini hanya mengganti `Presence Truth` dan **tidak menyentuh `Wardrobe`**.
- Klip produk (post-bridge) hanya diproses bila `hasPolicyOverride`, jadi warna juga tidak disisipkan di sana.
- `variety` dihitung ulang dengan `resolveVideoVariety(item.id)` **tanpa** `paletteEntries` VI. Warnanya bisa berbeda dari `resolved_wardrobe_color` yang dipakai untuk membuat `wardrobe_ref_<id>.png`.

**Yang harus dikerjakan:**
1. **Satu sumber warna.** Ambil warna dari `resolved_wardrobe_color` (result_json/campaign) yang sama dengan W-REF. Hanya bila nilai itu kosong, panggil `resolveVideoVariety` dengan `paletteEntries` dan `sleevePolicy` dari VI aktif. Simpan hasilnya kembali agar semua klip memakai nilai yang sama.
2. **Sisipkan di semua klip yang menampilkan tangan atau lengan**, termasuk:
   - Jalur B pre-bridge (`hook_only`, klip ≥ 2);
   - Jalur B post-bridge (klip produk), **termasuk saat `product_ref` ikut dikirim**;
   - kecuali: klip 1 `hook_only` (tanpa manusia) dan klip `3d_bio_cellular` / `symbolic_surrealism`.
3. **Format teks wajib menyebut nama warna dan bahannya**, misalnya `(Wardrobe: loose opaque modest long-sleeve gamis in Terracotta Clay linen, fitted cuffs at wrists, identical color in every clip)`.
4. **Klip produk dengan `product_ref`:** tambahkan kalimat penegas bahwa warna lengan **tidak boleh mengikuti** foto referensi produk, misalnya `(Wardrobe Lock Priority: sleeve color must match the wardrobe reference, ignore any clothing color seen in the product reference)`. Cek juga foto `product_ref` GarliBee: bila foto itu berisi lengan biru dongker, catat di laporan sebagai penyebab tambahan.
5. **W-REF ikut dikirim sebagai referensi gambar** di setiap klip bertangan (bila model dan G-Labs mendukung multi-referensi). Laporkan apakah W-REF benar-benar terkirim, dengan bukti dari log request.

**Tes unit:**
- Jalur B klip 2–6 (non-3D) → `t2i_prompt` berisi nama warna yang **sama persis** dengan `resolved_wardrobe_color`.
- Klip 1 `hook_only` dan klip 3D → tidak ada `(Wardrobe:`.
- Jalur A (metafora penuh) → hasil tidak berubah (regresi).

---

## K7.1-B — Malam benar-benar malam

**Temuan kode:**
- Scene Director hanya **meminta** Gemini (prompts.js ±baris 2041) memakai tirai tertutup.
- Kalimat `LIGHTING_PRESETS.window_daylight` (*"illuminated by soft natural daylight coming from a side window…"*) dari VI tetap disisipkan ke `[LAYER 3: SCENE & LIGHT]`. Kalimat bawaan ini mengalahkan permintaan tadi.

**Yang harus dikerjakan:**
1. **Pembersihan deterministik** di `buildOpcStartFrameRequest`: bila `sceneBrief.time_key === 'night'`, hapus atau ganti frasa siang:
   - `natural daylight`, `daylight`, `side window`, `sunlight`, `morning light`, `golden hour`, `sunny`.
   - Penggantinya: `(Lighting: night interior, curtains fully closed, dark window glass, warm 3000K interior lamps, hands clearly lit)`.
2. Terapkan juga pada `i2v_prompt` / `t2v_prompt` jika memuat frasa yang sama.
3. Untuk `time_key` `evening`/`afternoon`: biarkan, tapi jangan sampai berisi `morning`.
4. **QC:** pastikan rubric batch QC memakai `time_of_day_mismatch` dari K7.5 dan Pemeriksa Sekaligus menandai jendela terang di adegan malam.

**Tes unit:** prompt malam dengan preset `window_daylight` → hasil akhir tanpa kata `daylight` / `side window`, dan berisi `curtains fully closed`.

---

## K7.1-C — Klaim jantung: perketat, jangan longgarkan

**Fakta dari data staging:** semua naskah #2153–#2158 dibuka dengan klaim jantung:
- "Kesehatan jantung terjaga sejak malam hari…"
- "…kebaikan alami untuk jantungmu"
- "…jantung yang selalu prima"

Untuk produk herbal, ini klaim medis. **Blokir pre-TTS sudah benar.** Rekomendasi agent untuk "menyelaraskan" **tidak boleh** berarti melonggarkan regex.

**Yang harus dikerjakan:**
1. **Tutup celah akhiran** di `HERBAL_MEDICAL_CLAIM_TOKENS_RE` (`lib/tiktok-compliance-service.js`):
   - Kata organ/penyakit harus tertangkap juga dengan akhiran `-mu`, `-nya`, `-ku`, `-lah`. Contoh: `jantungmu`, `jantungnya`, `kolesterolnya`, `paru-parumu`.
   - Hati-hati agar tidak menangkap kata lain yang tidak berhubungan. Tambahkan tes negatif.
2. **Cegah sejak penulis naskah:**
   - Bila topik Planner atau `ws_matrix` menyebut jantung (`kesehatan_jantung` / `sirkulasi_darah`), tambahkan instruksi tegas ke prompt storyboard: *jangan menyebut organ atau penyakit; fokus pada kebiasaan hangat malam, cara pakai, rasa, dan momen keluarga*. Pakai `compliance_note` dari `metaphor-world-kits.js` (±baris 746).
   - Setelah storyboard jadi, jalankan `findVoClaimViolations` pada **semua** narasi. Bila ada pelanggaran, lakukan **1× perbaikan otomatis** (tulis ulang kalimat yang kena saja) sebelum masuk TTS. Hanya bila tetap gagal → `paused_compliance` seperti sekarang.
   - Catat jumlah panggilan Gemini tambahan (maks +1 per video) di `[GEMINI_CALL]`.
3. **Audit VO harus searah dengan regex:**
   - `auditVoiceoverCompliance` meluluskan 6/6 naskah ber-klaim jantung dengan skor 15.
   - Ubah supaya: bila `findVoClaimViolations` menemukan kata terlarang, status audit **tidak boleh `pass`**. Gunakan `fail`/`needs_rewrite` dan cantumkan kata yang kena di `compliance_log_json`.
4. **Laporkan** sumber kata "jantung": dari judul atau angle Planner `opc_261108_8618kc`, atau dari penulis naskah. Bila dari Planner, usulkan (jangan langsung ubah) perbaikan di gerbang hook Planner.

**Tes unit:**
- `findVoClaimViolations('…untuk jantungmu')` → berisi `jantungmu`.
- Kalimat netral ("hangatkan malam keluarga dengan madu bawang") → kosong.
- Audit VO dengan teks ber-klaim → bukan `pass`.

---

## K7.1-D — Pengaman tes lokal (prioritas rendah)
- Semua tes lokal yang menyentuh DB pusat wajib memakai `DISABLE_AUTO_MIGRATIONS=true` dan `PG_SEARCH_PATH=dev` (atau `staging`), **tidak pernah** `public`.
- Tambahkan pengecekan di helper tes: bila `PG_SEARCH_PATH` kosong atau `public` → tes berhenti dengan pesan jelas.
- Perubahan skema `public.api_key_usages` yang sudah terjadi **dibiarkan** (tabel kosong, production tidak dipakai, dan akan cocok saat production nanti diperbarui). Cukup dicatat di release notes.

---

## Uji staging (setelah tes unit lulus)
**Konfigurasi `default_tenant` staging selama uji, lalu kembalikan seperti semula setelahnya:**
- `planner_scene_director = on`
- `metaphor_kit_engine = on`
- `start_frame_visual_qc = report_only`
- `start_frame_visual_qc_batch = on` (bukan shadow; terbukti lebih akurat dan hemat)
- `start_frame_visual_qc_model = gemini-3.1-flash-lite`
- `gemini_quota_brake = on`
- `enable_vo_audit = 1`

**Data:** kloning ulang 6 item `opc_261108_8618kc` (#2051–#2056) dengan VI `dapurbotani_identity_v3` dan pipeline penuh (TTS, G-Labs, FFmpeg; social post mati).

**Kriteria lolos:**
| Kriteria | Target |
|---|---|
| Warna baju sama di semua klip bertangan (termasuk C5–C6 produk) | ≥ 5 / 6 video, dibuktikan dengan Pemeriksa Sekaligus `wardrobe_color_same_all_clips = true` dan contact sheet |
| Warna klip = warna W-REF | ≥ 5 / 6 |
| Adegan malam tanpa jendela terang | 0 frame jendela siang di item `night` |
| Naskah tanpa klaim organ/penyakit | 6 / 6 lolos regex (setelah perbaikan otomatis bila perlu) |
| Audit VO searah dengan regex | 0 kasus "regex blokir tapi audit pass" |
| Video penuh selesai | ≥ 5 / 6 (kegagalan G-Labs/Veo dicatat terpisah) |
| Panggilan Gemini per video | ≈ 2–3 (1 storyboard + 1 batch QC + maks 1 perbaikan naskah), dibuktikan dengan `[GEMINI_CALL]` = `api_key_usages` |
| Regresi Jalur A | Tes unit Jalur A tetap lulus |

**Laporan:**
- tulis ke `plans/planner-scene-director/stage-k7.1-staging-report.md`;
- contact sheet W-REF + C1–C6 per item;
- tautan Nextcloud video yang selesai;
- contoh kalimat naskah sebelum dan sesudah perbaikan otomatis;
- hitungan panggilan Gemini.

Bahasa ringkasan untuk pengguna: sederhana, tanpa istilah teknis.

## Urutan & rilis
1. Kerjakan K7.1-A → B → C → D. Tes unit dan `DISABLE_AUTO_MIGRATIONS=true npm run build` harus lulus.
2. Rilis patch (`npm run release-non-interactive -- --type patch …`), lalu deploy **staging saja** dengan SHA lengkap.
3. Jalankan uji staging dan tulis laporan. **Berhenti, tunggu review.**
4. Setelah disetujui: Langkah 2 panel Fitur Eksperimen (React + API + tes), mengikuti mockup `v2.48.1` yang sudah disetujui.
