# Laporan Uji Staging — K7 Polish, Catatan Pra-Rilis, & Uji Jalur A + B (`v2.48.0` → `v2.48.1`)

- **Tanggal:** 2026-11-14
- **Rilis / Tag / SHA:**
  - `v2.48.0` (`2ed6c3bdc3fd52b8bb5a27d431cec6b79fa1b0da`): Catatan Reviewer Pra-Rilis K7 (`America/Los_Angeles` PST/PDT, saklar `gemini_quota_brake`, `start_frame_visual_qc_batch` mode `off | shadow | on`, rilis awal ke Staging `release_id=20261114T082044Z-2ed6c3bdc3fd`).
  - `v2.48.1` (`ca5b5ba2956ec3b0b2c4c163962f0a07e5e8b7ad`): Perbaikan bug hasil temuan awal Jalur A (`compareBatchVsPerClipQc` named args untuk `shadow_diff`, penggantian opsi `gemini-2.5-flash-lite` dengan `gemini-3.1-flash-lite` yang aktif HTTP 200, regression test, serta mockup [mockup_fitur_eksperimen.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_fitur_eksperimen.html)), dideploy ke Staging (`release_id=20261114T090657Z-ca5b5ba2956e`).
- **Lingkungan Uji:** Mac Mini Staging (`http://100.95.245.55:5010`, API port `7010`, schema PostgreSQL `staging`, `PGPOOL_MAX=3`, PM2 `maknaflow-staging-ui` & `maknaflow-staging-api`).
- **Status Production:** Server Production (`~/maknaflow-production`, port `5000`/`6000`) **tidak disentuh / tidak dideploy**, dan `public.tenant_settings` tidak memiliki flag eksperimen baru (`0` baris flag baru). *(Catatan transparan: saat tes unit dijalankan secara lokal tanpa flag skip migrasi, kolom aditif `model_name` pada `public.api_key_usages` ikut terbuat otomatis oleh startup check dengan `0` baris terpakai; migrasi indeks unik `api_key_usages_date_key_model_uq` pada `public` baru akan berjalan otomatis saat rilis ini dideploy ke Production nanti.)*

---

## 1. Catatan Reviewer Pra-Rilis K7 & Perbaikan Sebelum Deploy

1. **Timezone Reset Kuota Gemini (`America/Los_Angeles`, Auto-DST PST/PDT):**
   - [lib/db.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js) mengekspor `getGeminiQuotaDateStr()` dan `getGeminiQuotaResetWibInfo()` memakai `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })`.
   - Tanggal kuota harian berganti pukul `15:00 WIB` saat PST dan `14:00 WIB` saat PDT (diuji unit pada `2026-11-14T03:00:00Z` / `10:00 WIB` → `2026-11-13` / `15:00 WIB`, dan skenario DST `2026-07-15T06:30:00Z` → `2026-07-14` / `14:00 WIB`).
2. **Saklar `gemini_quota_brake` & Transparansi Hitungan Retry:**
   - [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) membaca `gemini_quota_brake` per tenant (default `'on'`, `'off'` menonaktifkan jeda antrean).
   - Pesan status jeda dan banner Settings menampilkan perkiraan jam reset WIB serta catatan bahwa retry `503`/`429` ikut dihitung secara konservatif.
3. **Backup & Verifikasi Skema Staging:**
   - Tabel cadangan `staging.api_key_usages_backup_20261114` (`1899` baris) dibuat sebelum migrasi `model_name` dan indeks unik `api_key_usages_date_key_model_uq` pada `staging.api_key_usages`.
4. **Temuan Uji Live Gemini Model & Patch `v2.48.1`:**
   - Dari uji panggil langsung `generateContent` terhadap API Key aktif pool: `gemini-2.5-flash-lite` mengembalikan **HTTP 404** (membuat setiap panggilan QC di Jalur A jatuh ke fallback `gemini-3.6-flash` = 2 panggilan per audit), sedangkan **`gemini-3.1-flash-lite`**, `gemini-2.5-flash`, `gemini-3.5-flash-lite`, dan `gemini-3.6-flash` merespons **HTTP 200 OK**.
   - [app/settings/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/page.js) diperbarui untuk mengganti opsi dropdown yang gagal dengan model terverifikasi (`gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.6-flash`), dan [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) diperbaiki agar memanggil `compareBatchVsPerClipQc({ perClipVerdicts, batchVerdicts })` secara bernama.
5. **Verifikasi Lokal & Mockup UI:**
   - 6 suite unit test K7/Scene Director/QC ([k7-pool-observability-vo.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/k7-pool-observability-vo.test.js), [k7-qc-batch-rubric.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/k7-qc-batch-rubric.test.js), [k7-scene-director-polish.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/k7-scene-director-polish.test.js), [metaphor-f21-anti-hallucination.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/metaphor-f21-anti-hallucination.test.js), [scene-director-prompt.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/scene-director-prompt.test.js), [start-frame-visual-qc.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/start-frame-visual-qc.test.js)) setelah edit terakhir: **32/32 lulus, 0 gagal**; `DISABLE_AUTO_MIGRATIONS=true npm run build` exit `0`. *(Dalam run terpisah sebelumnya, 15 suite K7/modul terkait juga lulus `54/54`, sedangkan `tests/gemini-waterfall-chain.test.js` gagal 4 assertion karena mengharapkan urutan waterfall model versi lama.)*
   - Mockup interaktif Langkah 1 [USULAN_PANEL_FITUR_EKSPERIMEN.md](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/USULAN_PANEL_FITUR_EKSPERIMEN.md) kini aktif `HTTP 200` di Staging: http://100.95.245.55:5010/mockup_fitur_eksperimen.html ([mockup_fitur_eksperimen.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_fitur_eksperimen.html)).

---

## 2. Hasil Kampanye Uji Staging

### A. Jalur A — Metafora (`opc_k7_staging_jalur_a_261114`)
- **Konfigurasi:** `planner_scene_director = 'off'`, `metaphor_kit_engine = 'on'`, `start_frame_visual_qc = 'report_only'`, `start_frame_visual_qc_batch = 'shadow'`, `start_frame_visual_qc_model = 'gemini-2.5-flash-lite'` *(saat itu `v2.48.0`, fallback ke `gemini-3.6-flash`)*, VI `vi_dapurbotani_metaphor_world_test`.
- **Sumber Kloning:** 4 item `opc_261114_f21b7` (`#2133, #2135, #2138, #2139`) → (`#2149`–`#2152`), `enable_tts = 1, enable_glabs = 1, enable_ffmpeg = 1, enable_social_post = 0`.

| Item Baru | Asal | Kit Metafora & Baju | Status Video | Tautan Nextcloud & File Akhir |
|---|---|---|---|---|
| **#2149** | `#2133` | Kertas minyak gorengan · `Deep Navy Cotton` | **Completed** | http://100.78.186.123/index.php/s/bQoPsyGBy6wWnWD (`/temp/opc_final_2149.mp4`) |
| **#2150** | `#2135` | Karpet berdebu · `Terracotta Clay Linen` | **Visual Gagal di Klip 5** | 6 start frame + QC + TTS selesai; G-Labs Veo I2V Klip 5 (`Task 7a6974fa`) gagal `PUBLIC_ERROR_USER_MINOR` |
| **#2151** | `#2138` | Potongan apel · `Deep Sage Linen` | **Completed** | http://100.78.186.123/index.php/s/bTyacxD49ZWg2Pc (`/temp/opc_final_2151.mp4`) |
| **#2152** | `#2139` | Dua mangkuk minyak · `Deep Navy Cotton` | **Completed** | http://100.78.186.123/index.php/s/p6icxqC9Bg75cTf (`/temp/opc_final_2152.mp4`) |

### B. Jalur B — Scene Director (`opc_k7_staging_jalur_b_261114`)
- **Konfigurasi:** `planner_scene_director = 'on'`, `metaphor_kit_engine = 'on'`, `start_frame_visual_qc = 'report_only'`, `start_frame_visual_qc_batch = 'shadow'`, `start_frame_visual_qc_model = 'gemini-3.1-flash-lite'`, `gemini_quota_brake = 'on'`, VI `dapurbotani_identity_v3`, `enable_vo_audit = 1`, `enable_tts = 1, enable_glabs = 1, enable_ffmpeg = 1, enable_social_post = 0`.
- **Sumber Kloning:** 6 item `opc_261108_8618kc` (`#2051`–`#2056`) → (`#2153`–`#2158`).

| Item Baru | Asal | Lokasi & Waktu (`resolved_scene_brief`) | Audit VO | Status Akhir | Tautan Nextcloud / Alasan Berhenti |
|---|---|---|---|---|---|
| **#2153** | `#2051` | Ruang keluarga (`night`) · *Terracotta Clay* | `pass (15)` | **T2I + QC + W-Ref selesai; berhenti pre-TTS** | Diblokir pre-TTS oleh regex `\bjantung\b` (`tts_status = 'paused_compliance'`) |
| **#2154** | `#2052` | Meja dapur (`morning`) · *Muted Sage Green* | `pass (15)` | **Completed (MP4 Penuh)** | http://100.78.186.123/index.php/s/intYyqHBY9x9wid (`/temp/opc_final_2154.mp4`) *(menulis `"jantungmu"`)* |
| **#2155** | `#2053` | Ruang makan (`midday`) · *Warm Espresso Mocca* | `pass (15)` | **T2I + QC + W-Ref selesai; berhenti pre-TTS** | Diblokir pre-TTS oleh regex klaim medis/herbal (`tts_status = 'paused_compliance'`) |
| **#2156** | `#2054` | Meja pantry (`morning`) · *Terracotta Clay* | `pass (15)` | **T2I + QC + W-Ref selesai; berhenti pre-TTS** | Diblokir pre-TTS oleh regex klaim medis/herbal (`tts_status = 'paused_compliance'`) |
| **#2157** | `#2055` | Kamar tidur (`night`) · *Deep Charcoal Linen* | `pass (15)` | **T2I + QC + W-Ref selesai; berhenti pre-TTS** | Diblokir pre-TTS oleh regex klaim medis/herbal (`tts_status = 'paused_compliance'`) |
| **#2158** | `#2056` | Ruang keluarga/teras (`afternoon`) · *Terracotta Clay* | `pass (15)` | **T2I + QC + W-Ref selesai; berhenti pre-TTS** | Diblokir pre-TTS oleh regex klaim medis/herbal (`tts_status = 'paused_compliance'`) |

### C. Tautan Contact Sheet (Diperiksa Secara Visual)
- **Jalur A Sebelum vs Sesudah (`#2133, #2135, #2138, #2139` vs `#2149`–`#2152`):** [contact_sheet_k7_jalur_a_before_after.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_k7_jalur_a_before_after.png)
- **Jalur A Ringkas 4×6 (`#2149`–`#2152`):** [contact_sheet_k7_jalur_a_4x6.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_k7_jalur_a_4x6.png)
- **Jalur B 6×7 (`W-REF` + Klip 1–6 pada `#2153`–`#2158`):** [contact_sheet_k7_jalur_b_6x6.png](file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_k7_jalur_b_6x6.png)

---

## 3. Evaluasi Kriteria K7 & Akar Masalah Temuan Baru

| Kriteria Uji K7 | Jalur A (Metafora) | Jalur B (Scene Director) | Penjelasan & Bukti Observasi |
|---|---|---|---|
| **Lokasi beragam sesuai Planner** | N/A | **Lolos (5–6 / 6)** | Ruang keluarga malam, meja dapur pagi, ruang makan siang, pantry pagi, kamar tidur malam, ruang keluarga sore. |
| **Klip 1 hook tanpa pose pasif / fokus objek** | **Lolos 4/4** | **Campuran** | Jalur A: 4/4 Klip 1 murni objek metafora tanpa tangan. Jalur B: `#2157 C1` bebas tangan; Klip 1 lain menampilkan tangan berinteraksi dengan objek/lampu/buku. |
| **Warna baju konsisten & sesuai target** | **Lolos 4/4 (6/6 klip identik)** | **Belum lolos (0/6 konsisten)** | Meskipun `wardrobe_ref_2153..2158.png` berhasil dibuat dengan warna solid yang benar, teks `(Wardrobe: ...)` pada `t2i_prompt` Jalur B (`dapurbotani_identity_v3`) **tidak mencantumkan nama warna `resolved_wardrobe_color`**, sehingga warna lengan berganti hampir setiap klip terutama di Klip 5–6 saat `product_ref` ikut dipakai. |
| **Gamis lengan panjang / 0 wajah & leher** | **Lolos** | **Lolos** | Tidak ada wajah maupun leher terlihat di seluruh 60 start frame (24 Jalur A + 36 Jalur B); seluruh frame terpotong di bawah dada. |
| **Malam tirai tertutup (0 jendela siang)** | N/A | **Belum konsisten** | Meski `resolved_scene_brief.time_key === 'night'`, teks `[LAYER 3]` `t2i_prompt` pada `#2153` & `#2157` masih memuat kalimat bawaan VI *"illuminated by soft natural daylight coming from a side window"*, sehingga jendela terang siang hari tetap muncul di beberapa frame malam (`#2153 C2/C4/C5/C6`, `#2157 C2/C5`). |
| **Toples produk pre-bridge** | **0 pelanggaran** | **0 pelanggaran** | Produk `GarliBee` baru muncul pada slot bridge (`C3 & C6` di Jalur A, `C5 & C6` di Jalur B). |
| **False positive QC** | Per-clip: **ada** / Batch: **0** | Per-clip: **ada** / Batch: **0** | Di Jalur A, per-clip salah memflag pergelangan tangan padahal manset baju menutup rapi; di Batch QC tidak ada false positive serupa. Catatan minor non-baju: `#2149 C5` menampilkan gelas teh pengganti kertas minyak; `#2155 C3` memunculkan 1 frame 3D seluler. |
| **Video penuh selesai** | **3 / 4 selesai** (`#2150` gagal Veo C5) | **1 / 6 selesai** (`5/6` berhenti pre-TTS) | `#2149, #2151, #2152, #2154` selesai hingga `/temp/opc_final_*.mp4` dan tautan publik Nextcloud. |
| **Audit VO (`enable_vo_audit = 1`)** | `skipped` | **6 / 6 tersimpan (`pass`, `15`)** | `compliance_status` & `compliance_score` INTEGER sukses tersimpan tanpa error `"low"`. Namun `auditVoiceoverCompliance` meluluskan naskah sementara regex pre-TTS `\bjantung\b` tetap memblokir 5/6 item. |

---

## 4. Perbandingan Batch QC vs Per-Clip QC (`shadow` mode) & Audit Panggilan Gemini

| Uji / Dataset | Per-Clip QC (`6` call) | Batch QC (`1` call) | Kecocokan (`shadow_diff`) | Evaluasi Akurasi |
|---|---|---|---|---|
| **Fixture K7.9 (`#2133/#2139/#2140`)** | Meloloskan outlier baju (`C3`) | Menangkap outlier baju (`C3`) | `5 / 6` (unit test) | Unit test [k7-qc-batch-rubric.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/k7-qc-batch-rubric.test.js) lulus. |
| **Jalur A (`#2149`–`#2152`)** | Menandai gagal `9/24` klip (mayoritas false positive pergelangan) | Meluluskan bersih & mencatat `wardrobe_color_same_all_clips: true` (4/4) | `#2149`: `3/6`, `#2150`: `6/6`, `#2151`: `4/6`, `#2152`: `3/6` *(dihitung dari data tersimpan pra-`v2.48.1`)* | Batch QC menghilangkan false positive pergelangan dan konsisten melihat keseluruhan baju. |
| **Jalur B (`#2153`–`#2158`, `gemini-3.1-flash-lite`)** | Gagal menangkap perubahan warna baju di `#2156 C5/C6` & `#2157 C3` | **6 / 6 akurat mendeteksi `wardrobe_color_same_all_clips = false`** dan menyebut warna nyasar dengan tepat | `#2153`: `5/6`, `#2154`: `5/6`, `#2155`: `4/6`, `#2156`: `4/6`, `#2157`: `5/6`, `#2158`: `6/6` | Batch QC terbukti lebih akurat mendeteksi konsistensi baju antarklip dan hanya memakai **1 call Vision** per video (hemat 5 call bila mode `'on'`). |

### Parity Log `[GEMINI_CALL]` vs `staging.api_key_usages`
- **Jalur A (`4` item):** Total `63` baris `[GEMINI_CALL]` (`4` creative, `4+4` batch `404`+`200`, `24+24+3` per-clip `404`+`200`+`503`). Kegagalan model `gemini-2.5-flash-lite` (HTTP 404) tercatat persis **`28`** baris di log = **`28`** di `staging.api_key_usages`.
- **Jalur B (`6` item):** Total **`59`** baris `[GEMINI_CALL]`:
  - `gemini-3.5-flash-lite`: `2` (HTTP 200) + `8` (HTTP 503) = **`10`**
  - `gemini-3.1-flash-lite`: `42` (HTTP 200) + `3` (HTTP 503) = **`45`**
  - `gemini-3.6-flash`: **`4`** (HTTP 200)
  - **Delta `staging.api_key_usages`** sebelum vs sesudah Jalur B: `+10`, `+45`, `+4` = **total `+59` (100% cocok `59 = 59`)**.

---

## 5. Status Flag Akhir Staging & Rekomendasi Langkah Berikutnya

Seluruh flag eksperimen baru pada `default_tenant` di Staging sudah dikembalikan aman (dan PM2 Staging direstart untuk menyegarkan `settingsCache`):
- `planner_scene_director = 'off'`
- `start_frame_visual_qc_batch = 'off'`
- `start_frame_visual_qc = 'report_only'`
- `start_frame_visual_qc_model = 'gemini-3.1-flash-lite'`
- `gemini_quota_brake = 'on'`

**Rekomendasi sebelum Jalur B diaktifkan penuh atau Production diupdate:**
1. **Injeksi Warna Baju Eksplisit di Jalur B:** Saat `planner_scene_director = 'on'`, tulis nama warna `resolved_wardrobe_color` (mis. *Terracotta Clay*, *Muted Sage Green*) secara eksplisit di segmen `(Wardrobe: ...)` pada `t2i_prompt` untuk semua klip (seperti pada Jalur A), bukan hanya mengandalkan `wardrobe_ref`.
2. **Sinkronisasi Pencahayaan Malam vs Preset VI:** Saat `sceneBrief.time_key === 'night'`, cegah teks bawaan *"illuminated by soft natural daylight coming from a side window"* masuk ke `[LAYER 3: SCENE & LIGHT]` agar latar malam benar-benar memakai tirai gelap & lampu ruangan 3000K.
3. **Harmonisasi Guard Pre-TTS vs VO Audit:** Selaraskan kebijakan regex `\bjantung\b` di pre-TTS (`findVoClaimViolations`) dengan hasil `auditVoiceoverCompliance` (serupa review kata `"lemak"` sebelumnya).
4. **Review Mockup UI:** Tinjau http://100.95.245.55:5010/mockup_fitur_eksperimen.html untuk menyetujui desain tab **🧪 Fitur Eksperimen** sebelum implementasi React & API dimulai.

