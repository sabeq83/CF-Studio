# Laporan Audit Staging — Status Pembuatan & Publishing Konten (2026-11-25)

> **Waktu Audit:** Rabu, 25 November 2026 pukul **19:21 WIB**  
> **Pembanding:** [laporan-pembuatan-konten-2026-11-25.md](file:///Users/sabeqmmursyid/cf-autopipeline/laporan/laporan-pembuatan-konten-2026-11-25.md) (diambil pukul 18:08 WIB)  
> **Sumber Data Langsung:** PostgreSQL `100.78.186.123:5432/maknaflow_db` schema `staging` (`re_multiplier_tasks`, `auto_pipeline_jobs`, `auto_pipeline_schedules`, `content_flow_items`, `publishing_jobs`, `glabs_tasks`) & PM2 Mac Mini Staging (`100.95.245.55`).

---

## 1. Ringkasan Eksekutif

Dari **26 slot** yang dicatat pada laporan pukul `18:08 WIB`:

| Brand | Tenant | Total Slot | Selesai (`completed`) | Masih Proses / Macet | Waiting Approval | Gagal Produksi (`failed`) | Paused | Gagal Publish (`needs_review`) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **NutriBake** | `default_tenant` | 10 | **9** *(+1)* | **1** (`generating_visuals`) | 0 | **0** *(-1)* | 0 | *(1 job terpisah: `cst_5bd6527307c8` TT)* |
| **Dapur Botani** | `default_tenant` | 10 | **6** *(+3)* | **1** (`generating_t2i` macet) | **1** | **2** (`visuals`, `tts`) | 0 | 0 |
| **NutriBlend** | `tnt_sy-dodot_4ba27b` | 3 | **2** | 0 | 0 | **1** (`visuals`) | 0 | 0 |
| **Siasat Sehat** | `default_tenant` | 2 | **2** | 0 | 0 | 0 | 0 | **2 job** (`mul_261125_o53mlp` FB & YT) |
| **HabitFolk** | `default_tenant` | 1 | 0 | 0 | 0 | 0 | **1** *(bukan error)* | 0 |
| **TOTAL** | **2 Tenant** | **26** | **19** | **2** | **1** | **3** | **1** | **2 slot (+1 di luar daftar)** |

### Jawaban Singkat: **Ya, masih ada yang gagal.**
1. **3 task produksi masih `failed`:** `mul_261125_lev63s` (`visuals`), `mul_261125_6a01u2` (`visuals`), dan kegagalan baru `mul_261125_11bxrg` (`tts` — `ffmpeg` exit code `-22`).
2. **1 task produksi macet di `generating_t2i`:** `mul_261125_pa2dv7` (terputus saat PM2 Staging restart ~17:51 WIB), sementara `mul_261125_0nswuo` sudah lanjut ke `generating_visuals` (3/4 G-Labs selesai, 1 `processing` per 19:19 WIB).
3. **1 task masih `waiting_approval`:** `mul_261125_h6c6p0`.
4. **3 job publishing berstatus `needs_review` hari ini** (tidak tercatat di laporan 18:08 WIB): `mul_261125_o53mlp` (Siasat Sehat — FB & YT `Repliz API Error: fetch failed`) dan `cst_5bd6527307c8` (NutriBake — TikTok rate-limit OpenAPI 24 jam).
5. **HabitFolk (`02:00`) tidak gagal/terlewat oleh bug:** seluruh 7 jadwal `HabitFolk` di `auto_pipeline_schedules` memang berstatus `paused`.

---

## 2. Perubahan Status Sejak Laporan 18:08 WIB

| Campaign ID | Brand | Slot | Status 18:08 WIB | Status 19:21 WIB | Keterangan |
|---|---|---|---|---|---|
| `mul_261125_dl979n` | NutriBake | `13:00` Tepung Almond | ❌ `failed` (`visuals`) | ✅ `completed` | Pulih & terjadwal publish `2026-11-26 07:15` (FB) |
| `mul_261125_0nswuo` | NutriBake | `13:40` Peanut Butter | ⏳ `generating_t2i` | 🔄 `generating_visuals` | T2I selesai; 3/4 task G-Labs (`102b4b65`, `a2c39b3c`, `687803a7`) `completed`, 1 (`c5377713`) `processing` (dibuat `19:19` WIB) |
| `mul_261125_714xul` | Dapur Botani | `18:00` Recurring Sore | 🔄 `ffmpeg_muxing` | ✅ `completed` | Terjadwal publish `2026-11-26 16:11` (FB, IG, TT, YT) |
| `mul_261125_11bxrg` | Dapur Botani | `18:15` metori Hand Blender | 🕒 Belum jatuh tempo | ❌ `failed` (`tts`) | **Kegagalan baru** saat concat audio `ffmpeg` (`libmp3lame` `-22`) |
| `mul_261125_9rljmw` | Dapur Botani | `18:30` Madu Hutan Murni | 🕒 Belum jatuh tempo | ✅ `completed` | Terjadwal publish `2026-11-26 19:00` (FB, IG) |
| `mul_261125_tly9jg` | Dapur Botani | `18:45` Clarity Vent Kotak Kaca | 🕒 Belum jatuh tempo | ✅ `completed` | Terjadwal publish `2026-11-26 20:30` (FB, IG) |

---

## 3. Daftar Lengkap Masalah Aktif di Server Staging

### A. Produksi Gagal (`re_multiplier_tasks.status = 'failed'`) — 3 Task
1. **`mul_261125_lev63s`** — Dapur Botani (`01:20`, Recurring Sore Rabu)
   - `failed_stage`: `visuals`
   - Error: `One or more G-Labs video generation tasks failed.` (`glabs_tasks`: `7ace7b57` `failed`, `dbf1112f` & `61695c1a` tertinggal `processing`).
2. **`mul_261125_6a01u2`** — NutriBlend / `tnt_sy-dodot_4ba27b` (`14:40`, Teh Bunga Telang)
   - `failed_stage`: `visuals`
   - Error: `One or more G-Labs video generation tasks failed.` (`glabs_tasks`: 5/6 `completed`, `df013fbc` `failed`).
3. **`mul_261125_11bxrg`** — Dapur Botani (`18:15`, metori Hand Blender) **[BARU]**
   - `failed_stage`: `tts`
   - Error: `ffmpeg` gagal menggabungkan 6 klip MP3 (`tts_clip_mult_mul_261125_11bxrg_0..5.mp3` ke `tts_multiplier_combined_mul_261125_11bxrg.mp3`):
     `[enc:libmp3lame] Error encoding a frame: Invalid argument` (`Task finished with error code: -22`). Keenam file MP3 sumber ada di disk (`81KB–119KB`), kemungkinan salah satu klip memiliki format/header/frame korup atau mismatch sample rate saat filter `concat`.

### B. Produksi Macet / Menunggu
4. **`mul_261125_pa2dv7`** — Dapur Botani (`17:45`, Jahe Merah Bubuk)
   - Status: `generating_t2i` (`t2i_images_json` masih `NULL`).
   - Penyebab: PM2 `maknaflow-staging-api` dan `maknaflow-staging-ui` mengalami restart sekitar pukul `17:51 WIB` (uptime `89m` saat audit pukul `19:21 WIB`), sehingga proses T2I yang mulai `17:45 WIB` terputus.
5. **`mul_261125_0nswuo`** — NutriBake (`13:40`, Peanut Butter)
   - Status: `generating_visuals` (sedang berjalan aktif; 3/4 G-Labs task sudah `completed`, sisa `c5377713` masih `processing`). Perlu dipantau beberapa menit ke depan apakah selesai otomatis.
6. **`mul_261125_h6c6p0`** — Dapur Botani (`17:00`, Recurring Pagi)
   - Status: `waiting_approval`
   - Catatan sistem: `Audit verdict=revise menghasilkan revised_script (4 klip) tidak cocok dengan jumlah scene (3 klip); revisi diabaikan.` Perlu review/approve manual dari operator.

### C. Kegagalan Publishing (`publishing_jobs.status = 'needs_review'`) — 3 Job
7. **`mul_261125_o53mlp`** — Siasat Sehat (`02:20`, target tayang `2026-11-25 16:19 WIB`)
   - Di `re_multiplier_tasks` dan `content_flow_items` tercatat `Completed`, **tetapi** kedua job publish-nya gagal di Repliz:
     - `pub_1795548430506_660e1252` (**Facebook**): `REPLIZ_UNKNOWN_ERROR` — `Repliz API Error: fetch failed`
     - `pub_1795548430514_5b36b34a` (**YouTube**): `REPLIZ_UNKNOWN_ERROR` — `Repliz API Error: fetch failed`
8. **`cst_5bd6527307c8`** — NutriBake (`[Custom Storyboard] [CFA] Beda Rolled Oat vs Oat Instan Saat Sarapan`, target tayang `2026-11-25 07:20 WIB`)
   - `pub_1795561221242_5bddf5ab` (**TikTok**): `REPLIZ_UNKNOWN_ERROR` — `This TikTok creator has made too many posts via OpenAPI in the last 24 hours, so this publishing attempt is blocked to minimize spam.`

### D. Catatan Verifikasi Lainnya
- **HabitFolk (`02:00`):** Bukan kegagalan scheduler. Seluruh 7 jadwal `HabitFolk` di `auto_pipeline_schedules` berstatus `paused` (terakhir berjalan `2026-11-11 02:00` untuk `opc_261111_kltluz`).
- **Jadwal NutriBlend:** Seluruh 19 jadwal `active` di `tnt_sy-dodot_4ba27b` memiliki nama unik (`19/19` distinct, tidak ada duplikat).
- **Proses Staging Mac Mini:** `maknaflow-staging-api`, `maknaflow-staging-ui`, dan `maknaflow-staging-mcp` semuanya `online` (uptime `89m`).

---

## 4. Rekomendasi Tindak Lanjut

1. **Retry 3 task produksi yang `failed`:** `mul_261125_lev63s`, `mul_261125_6a01u2`, dan `mul_261125_11bxrg` (untuk `11bxrg`, cek jika perlu re-generate TTS atau normalisasi sample rate sebelum `concat`).
2. **Reset/Retry task macet T2I:** `mul_261125_pa2dv7` (terputus akibat restart PM2 `17:51 WIB`).
3. **Pantau `mul_261125_0nswuo`:** Jika `c5377713` tidak selesai dalam 10–15 menit, lakukan retry.
4. **Approve / Review `mul_261125_h6c6p0`** di UI Multiplier Lab.
5. **Retry Publishing Jobs (`needs_review`):**
   - `pub_1795548430506_660e1252` (FB) dan `pub_1795548430514_5b36b34a` (YT) untuk `mul_261125_o53mlp` (Siasat Sehat).
   - `pub_1795561221242_5bddf5ab` (TT `cst_5bd6527307c8` NutriBake) setelah kuota 24 jam OpenAPI TikTok longgar atau publish manual via aplikasi TikTok.
