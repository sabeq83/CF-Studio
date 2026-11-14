# Laporan Uji Staging — K7.1 Fixes (`v2.48.2`)

- **Tanggal:** 2026-11-14
- **Rilis / Tag / SHA:** `v2.48.2` (`f64476b9a909ec9b84d3135954e86efbb3aa996d`)
- **Lingkungan Uji:** Mac Mini Staging (`http://100.95.245.55:5010`, API port `7010`, `release_id=20261114T104441Z-f64476b9a909`, schema PostgreSQL `staging`, `PGPOOL_MAX=3`).
- **Status Kampanye Uji (`opc_k71_staging_jalur_b_261114`):** Dimulai `17:49:44 WIB` (kloning 6 item `opc_261108_8618kc` `#2051–#2056` → `#2159–#2164`, VI `dapurbotani_identity_v3`), lalu **di-pause oleh pengguna pukul ~17:59:58 WIB** untuk keperluan laporan awal (`#2159` sudah selesai start frame, TTS, & 6 klip video G-Labs Veo; `#2160` selesai storyboard + W-REF + C1–C5; `#2161–#2164` belum jalan).
- **Status Flag Staging & Production Guard:**
  - Flag `default_tenant` Staging selama uji: `planner_scene_director='on'`, `metaphor_kit_engine='on'`, `start_frame_visual_qc='report_only'`, `start_frame_visual_qc_batch='on'`, `start_frame_visual_qc_model='gemini-3.1-flash-lite'`, `gemini_quota_brake='on'`, `enable_vo_audit='1'`.
  - Setelah kampanye di-pause, flag Staging sudah **dikembalikan** ke kondisi awal (`planner_scene_director='off'`, `start_frame_visual_qc_batch='off'`) dan PM2 direstart (`UI HTTP 200`).
  - **Production** (`~/maknaflow-production`, port `5000/6000`, schema `public`) **tidak disentuh / tidak dideploy**, dan `public.tenant_settings` bersih (`0` baris flag eksperimen). *(Sesuai K7.1-D, kolom aditif `public.api_key_usages.model_name` dibiarkan tetap ada sebagai catatan rilis).*

---

## 1. Ringkasan Verifikasi Lokal Sebelum Rilis (`v2.48.2`)

- **Tes unit & regresi (10 file suite K7.1, Scene Director, Batch QC, Metaphor, Base64):** `41/41 lulus, 0 gagal` (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev node --test --test-force-exit ...`).
- **Build produksi lokal:** `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build` selesai exit `0`.
- *(Catatan: `bridge-prompt-snapshot.test.js` masih memakai snapshot `v2.44.3` pre-`finishing_plan` dan tidak diubah; `test:opc:start-frame-reference` gagal pada pola regex historis `isBridgeClip` di `scheduler-processors.js` yang sebelumnya sudah dipindah ke `opc-start-frame-request.js`.)*

---

## 2. Evaluasi Kriteria K7.1 (Hasil Aktual di Staging s.d. Pause)

| Kriteria K7.1 | Target | Hasil Teramati (`#2159–#2160`) | Status |
|---|---|---|---|
| **K7.1-A: Warna baju sama di semua klip bertangan (termasuk C5–C6 produk)** | ≥ 5 / 6 video | **#2159:** C2, C4, C5, C6 konsisten *Deep Charcoal Linen* polos (C1 `hook_only` tanpa W-REF, C3 makro toples bawang).<br>**#2160:** C2, C3, C4, C5 konsisten *Charcoal Grey Linen* persis hingga kancing manset (C1 `hook_only`, C6 belum jalan karena pause). | **TERBUKTI PADA 2/2 ITEM AKTIF** *(4/6 item belum jalan karena pause)* |
| **K7.1-A: W-REF tersimpan dengan ekstensi & MIME valid + Multi-Ref C5–C6** | Valid JPG/PNG + `reference_count = 2` di C5–C6 | `wardrobe_ref_2159.jpg` & `wardrobe_ref_2160.jpg` tersimpan sbg JPEG valid.<br>Audit `#2159`: `[0, 1, 0, 1, 2, 2]`.<br>Audit `#2160`: `[0, 1, 1, 1, 2]` (C6 paused). | **PASS** |
| **K7.1-B: Adegan malam tanpa jendela siang terang** | 0 frame jendela siang di item `night` | Item **#2159 (`night`)** C1, C2, C5, C6 memakai gorden tertutup / jendela malam hitam pekat & lampu interior hangat (0 cahaya siang). Kontras jelas vs **#2160 (`morning`)** dapur pagi terang. | **PASS (`#2159`)** |
| **K7.1-C: Naskah tanpa klaim organ/penyakit (termasuk akhiran `-mu`/`-nya`)** | 6 / 6 lolos regex (auto-rewrite bila perlu) | **#2159** (`"jantung"`) & **#2160** (`"jantungmu"`) keduanya tertangkap pre-TTS, otomatis direwrite Gemini (1 call), lulus regex (`remaining_violations: []`), `compliance_status='pass'`, tidak terhenti di `paused_compliance`. | **PASS (`#2159–#2160`)** |
| **K7.1-C: Audit VO searah dengan regex** | 0 kasus "regex blokir tapi audit pass" | Unit test `K7.1-C` PASS; kedua item Staging pasca-rewrite sama-sama `pass` tanpa kontradiksi. | **PASS** |
| **K7.1-D: Pengaman skema tes lokal** | `PG_SEARCH_PATH` wajib `dev`/`staging` | Helper `assertSafeTestDbEnv()` aktif pada `getPgPool()` saat `NODE_TEST_CONTEXT` aktif (gagal keras bila kosong/`public`). | **PASS** |
| **Video penuh selesai & tautan Nextcloud** | ≥ 5 / 6 video | Dihentikan lebih awal via pause pengguna saat `#2159` selesai download 6 klip Veo (`/temp/opc_glabs_2159_clip_0..5.mp4`, folder Nextcloud dibuat) namun **belum masuk antrean `pillar_ffmpeg`** (`ffmpeg_status='pending'`). | **BELUM SELESAI (PAUSED)** |
| **Batch QC `on` menyimpan verdict ke DB** | 1 call / item, `start_frame_qc` tersimpan | **TEMUAN BUG BARU:** Panggilan Gemini Batch QC `#2159` sukses `200 OK` (1× retry `503`), **tetapi gagal simpan ke DB** karena `parsed = mergeBatchStartFrameQcTelemetry(...)` di `lib/scheduler-processors.js:6753` memicu `Assignment to constant variable` (`const parsed` di baris `5784`). | **FAIL (BUG DITEMUKAN)** |

---

## 3. Contact Sheet Visual & Pemeriksaan Frame (`W-REF` + `C1–C6`)

File contact sheet terverifikasi secara visual:
- [contact_sheet_k71_jalur_b_wref_c1_c6.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_k71_jalur_b_wref_c1_c6.png)

### Hasil Pengamatan Visual Langsung:
1. **Bukti Perbaikan K7.1-A (Baju Tidak Lagi Berubah Warna di C2–C6):**
   - **#2159 (`Deep Charcoal Linen`):** `wardrobe_ref_2159.jpg` menampilkan atasan linen charcoal gelap polos. Klip **C2, C4, C5, dan C6** semuanya mengenakan linen charcoal gelap polos yang senada — termasuk **C5** (tangan + mug + toples **GarliBee**) dan **C6** (tangan memegang toples **GarliBee**). *(Catatan visual minor: di `C2`, framing `neck-down` menampakkan bagian leher tanpa kepala agar tetap faceless; layak dipoles nanti jika ingin lebih natural hanya sebatas bahu-meja).*
   - **#2160 (`morning`):** `wardrobe_ref_2160.jpg` menampilkan lengan linen abu-abu charcoal gelap bermanset kancing. Klip **C2, C3, C4, dan C5** (membuka tutup toples **GarliBee**) mempertahankan warna dan model manset yang sama persis dengan `W-REF`.
   - **C1 (`hook_only`):** Baik pada `#2159` maupun `#2160`, C1 tidak mengirim `W-REF` (`reference_count = 0`) sesuai aturan `hook_only`.
   - **GarliBee Clean Ref Check:** Foto bersih produk (`clean_default_tenant_pe_1793545394035_6698_1793832949845.png`) sudah diperiksa langsung (`background putih polos, hanya toples GarliBee label hitam tanpa tangan/baju orang`). Pada C5–C6 kedua item, produk ter-render rapi beserta baju `W-REF`.
2. **Bukti Perbaikan K7.1-B (Pencahayaan Malam `#2159` vs Pagi `#2160`):**
   - **#2159 (`night`):** C1 (lampu meja hangat + gorden malam gelap), C2 (tirai tertutup + lampu sudut malam), C5 (jendela belakang hitam pekat malam + lampu lantai hangat), C6 (ruang keluarga malam temaram hangat) — **tidak ada jendela siang terang**.
   - **#2160 (`morning`):** Pencahayaan dapur pagi alami terang konsisten dengan brief `morning`.

### Tabel Audit Pengiriman Referensi (`staging.opc_start_frame_request_audits`)
| Item | C1 | C2 | C3 | C4 | C5 (Produk + W-REF) | C6 (Produk + W-REF) |
|---|---|---|---|---|---|---|
| **#2159** | `0` (`hook_only`) | `1` (`W-REF`) | `0` (`macro` toples bawang) | `1` (`W-REF`) | **`2`** (`clean_photo_url` + `W-REF`) | **`2`** (`clean_photo_url` + `W-REF`) |
| **#2160** | `0` (`hook_only`) | `1` (`W-REF`) | `1` (`W-REF`) | `1` (`W-REF`) | **`2`** (`clean_photo_url` + `W-REF`) | *(paused)* |

---

## 4. Progres Status Item & Aset Output (`opc_k71_staging_jalur_b_261114`)

| Item | Asal | Generation | Start Frame | TTS | Visual (G-Labs) | FFmpeg | Folder Nextcloud / File |
|---|---|---|---|---|---|---|---|
| **#2159** | `#2051` | `completed` | `completed` (`6/6`) | `completed` | `completed` (`6/6` klip `/temp/opc_glabs_2159_clip_0..5.mp4`) | `pending` *(terjeda saat pause)* | `/MAKNA_Assets/ASET_DAPURBOTANI/OPC_Campaign_opc_k71_staging_jalur_b_261114/OPC-[STAGING K7.1 JALUR B] Scene Director ON + dapurbotani_identity_v3 (Batch ON)-001` *(MP4 final belum ter-render)* |
| **#2160** | `#2052` | `processing` | `partial` (`5/6` file terunduh) | `pending` | `pending` | `pending` | — |
| **#2161–#2164** | `#2053–#2056` | `pending` | `pending` | `pending` | `pending` | `pending` | — |

*(Tautan Nextcloud share URL untuk `#2159–#2164`: belum tersedia karena kampanye di-pause sebelum `pillar_ffmpeg` dijalankan.)*

---

## 5. Bukti Perbaikan Naskah Otomatis K7.1-C (`vo_compliance_auto_rewrite`)

1. **Item #2159 (`#2051`):**
   - **Token terdeteksi:** `["jantung"]`
   - **Sebelum:** `"Kesehatan jantung terjaga sejak malam hari dengan langkah alami."`
   - **Sesudah (1× rewrite otomatis):** `"Kenyamanan fisik terjaga sejak malam hari dengan rutinitas hangat alami."`
   - **Verdict akhir:** `compliance_status = 'pass'` (`remaining_violations: []`), lolos ke TTS & Veo.
2. **Item #2160 (`#2052`):**
   - **Token terdeteksi:** `["jantungmu"]` *(sebelum K7.1 lolos menjadi video `#2154`!)*
   - **Sebelum:** `"Awali akhir pekan dengan kebaikan alami untuk jantungmu."`
   - **Sesudah (1× rewrite otomatis):** `"Awali akhir pekan dengan kebaikan alami untuk kenyamanan tubuhmu."`
   - **Verdict akhir:** `compliance_status = 'pass'` (`remaining_violations: []`), langsung masuk antrean Start Frame tanpa `paused_compliance`.

### Sumber Kata `"jantung"` & Usulan Pengaman di Content Planner
- Semua 6 baris sumber pada `opc_261108_8618kc` (`#2051–#2056`) sudah membawa `"jantung"` / `"jantungmu"` di level input `row_creative_payload` (`promotion_context`, `custom_hook`, `ws_matrix`, dan `context`) serta `campaign.custom_hook` yang berasal dari Content Planner.
- **Usulan desain (belum diterapkan):** Tambahkan *soft-blocker / warning validator* memakai `scanLexicon()` + opsi *"Haluskan Otomatis untuk TikTok"* langsung saat pengguna menyimpan atau mengekspor `custom_hook` / `promotion_context` di Content Planner, agar kata organ/penyakit bersih sebelum antrean produksi berjalan.

---

## 6. Hitungan Panggilan Gemini (`[GEMINI_CALL]` vs `staging.api_key_usages`)

Periode uji: `2026-11-14 17:49:44 WIB` s.d. pause `~18:00 WIB`.

### A. Log Aplikasi `[GEMINI_CALL]` (6 panggilan tercatat)
| Item | Stage | Model | Attempt & Status |
|---|---|---|---|
| **#2159** | `PRODUCT_CAMPAIGN_CREATIVE` (Storyboard) | `gemini-3.5-flash-lite` | `attempt=1` → `200 OK` |
| **#2159** | `PRODUCT_CAMPAIGN_CREATIVE` (VO Auto-Rewrite 1×) | `gemini-3.5-flash-lite` | `attempt=1` → `200 OK` |
| **#2159** | `start_frame_visual_qc_batch` (Batch 6 frame) | `gemini-3.1-flash-lite` | `attempt=1` → `503` *(retry)* |
| **#2159** | `start_frame_visual_qc_batch` (Batch 6 frame) | `gemini-3.1-flash-lite` | `attempt=2` → `200 OK` |
| **#2160** | `PRODUCT_CAMPAIGN_CREATIVE` (Storyboard) | `gemini-3.5-flash-lite` | `attempt=1` → `200 OK` |
| **#2160** | `PRODUCT_CAMPAIGN_CREATIVE` (VO Auto-Rewrite 1×) | `gemini-3.5-flash-lite` | `attempt=1` → `200 OK` |

### B. Delta Tabel `staging.api_key_usages` (`2026-11-14`)
| Model | Sebelum Uji | Sesudah Uji | Delta |
|---|---:|---:|---:|
| `gemini-3.5-flash-lite` | `14` | `18` | **`+4`** |
| `gemini-3.1-flash-lite` | `45` | `47` | **`+2`** |
| Model lain (`2.5-flash`, `2.5-flash-lite`, `3.6-flash`) | `176` | `176` | `0` |
| **Total Delta** | **235** | **241** | **`+6` (`= 6` log `[GEMINI_CALL]`)** |

**Kesimpulan kuota:** Perhitungan `[GEMINI_CALL]` **cocok 1:1** dengan pencatatan DB `staging.api_key_usages` (`6` vs `6`), serta tidak ada lagi panggilan QC per-klip (6×) karena `start_frame_visual_qc_batch = on` hanya memakai **1 panggilan sukses** per item.

---

## 7. Temuan Bug & Saran Tindak Lanjut Sebelum Langkah 2 Panel Eksperimen

1. **Bug Wajib Diperbaiki (1 baris) di `lib/scheduler-processors.js`:**
   - Pada baris `5784`, ubah `const parsed = sanitizeAiDirectiveLeak(...)` menjadi `let parsed = ...` agar assignment `parsed = mergeBatchStartFrameQcTelemetry(...)` di baris `6753` (saat `start_frame_visual_qc_batch = 'on'`) tidak melempar `TypeError: Assignment to constant variable`, sehingga laporan Batch QC tersimpan ke `result_json`.
   - Tambahkan pula 1 unit test khusus jalur `batchMode === 'on'` pada fungsi processor / helper terkait.
2. **Polesan Opsional Framing C2 `#2159`:**
   - Pada `contact_sheet_k71_jalur_b_wref_c1_c6.png` cell `#2159 C2`, framing agak tinggi sehingga menampakkan garis leher tanpa kepala (`strict neck-down`). Ini bisa dihaluskan di template prompt bila diinginkan, namun tidak memengaruhi fungsi utama.
3. **Menunggu Review Pengguna:**
   - Setelah laporan ini ditinjau (dan memutuskan apakah bug `let parsed` ikut dibereskan/diuji singkat atau lanjut langsung), barulah masuk ke **Langkah 2** implementasi panel **Fitur Eksperimen** sesuai mockup `v2.48.1`.

