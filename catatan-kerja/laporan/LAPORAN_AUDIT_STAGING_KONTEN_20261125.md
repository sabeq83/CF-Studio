# Laporan Audit Staging — Status Pembuatan & Publishing Konten (2026-11-25)

> **Waktu Audit Awal:** Rabu, 25 November 2026 pukul **19:21 WIB** (via DB Staging)  
> **Pembaruan Audit Terakhir:** Rabu, 25 November 2026 pukul **20:15 WIB** (**100% via MCP Staging `v2.64.1`**)  
> **Pembanding:** [laporan-pembuatan-konten-2026-11-25.md](file:///Users/sabeqmmursyid/cf-autopipeline/laporan/laporan-pembuatan-konten-2026-11-25.md) (diambil pukul 18:08 WIB)  
> **Sumber Data MCP (`v2.64.1`):** `cf_get_cluster_health`, `cf_switch_tenant`, `cf_list_multiplier_tasks`, `cf_list_publishing_jobs` (`status: "needs_review"`, `"scheduled"`, `"all"`), `cf_list_content_flow`, `cf_list_schedules`.

---

## 1. Ringkasan Eksekutif (Per 20:15 WIB via MCP)

Dari **26 slot** yang dicatat pada laporan pukul `18:08 WIB`:

| Brand | Tenant | Total Slot | Selesai (`completed`) | Macet | Waiting Approval | Gagal Produksi (`failed`) | Paused | Gagal Publish (`needs_review`) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **NutriBake** | `default_tenant` | 10 | **10** *(+2)* | **0** | 0 | **0** *(-1)* | 0 | *(1 job terpisah: `opc_2389` TT)* |
| **Dapur Botani** | `default_tenant` | 10 | **7** *(+4)* | **0** *(-1)* | **2** *(+1)* | **1** (`tts`) | 0 | 0 |
| **NutriBlend** | `tnt_sy-dodot_4ba27b` | 3 | **2** | 0 | 0 | **1** (`visuals`) | 0 | 0 |
| **Siasat Sehat** | `default_tenant` | 2 | **2** | 0 | 0 | 0 | 0 | **2 job** (`mul_261125_o53mlp` FB & YT) |
| **HabitFolk** | `default_tenant` | 1 | 0 | 0 | 0 | 0 | **1** *(bukan error)* | 0 |
| **TOTAL** | **2 Tenant** | **26** | **21** | **0** | **2** | **2** | **1** | **2 slot (+1 di luar daftar)** |

### Kesimpulan Status Pukul 20:15 WIB:
1. **Tidak ada lagi task produksi yang macet (`generating_t2i` / `generating_visuals` = 0).**
2. **21 dari 26 slot (80,8%) sudah `completed`** dan terhubung ke antrean publish (`scheduled` / `published`).
3. **Masih ada 2 task `failed`:**
   - `mul_261125_6a01u2` (NutriBlend `14:40` — `visuals`)
   - `mul_261125_11bxrg` (Dapur Botani `18:15` — `tts`, error terbaru setelah retry: `duplicate key value violates unique constraint "tts_studio_batches_pkey"`)
4. **Ada 2 task `waiting_approval`:** `mul_261125_h6c6p0` dan `mul_261125_pa2dv7` (sebelumnya macet di `generating_t2i`, kini siap di-approve).
5. **Masih ada 3 job publishing `needs_review` untuk jadwal 25 Nov** (kini terdeteksi langsung oleh `cf_list_publishing_jobs(status: "needs_review")`):
   - `mul_261125_o53mlp` (Siasat Sehat — FB `pub_1795548430506_660e1252` & YT `pub_1795548430514_5b36b34a`, `Repliz API Error: fetch failed`)
   - `opc_2389` / `cst_5bd6527307c8` (NutriBake — TikTok `pub_1795561221242_5bddf5ab`, limit 24 jam OpenAPI TikTok)
   *(Catatan: total `needs_review` historis di `default_tenant` berjumlah 10 job termasuk 7 job lama tgl 11–24 Nov; di `tnt_sy-dodot_4ba27b` berjumlah 0.)*
6. **Health Check MCP (`cf_get_cluster_health`):** `success: true`, `contentAutomation.running: true`, `contentAutomationNotifications.running: true` (error `500` teratasi di `v2.64.1`).

---

## 2. Perkembangan Status (`18:08` → `19:21` → `20:15 WIB`)

| Campaign ID | Brand | Slot | 18:08 WIB | 19:21 WIB | 20:15 WIB (MCP) | Keterangan |
|---|---|---|---|---|---|---|
| `mul_261125_dl979n` | NutriBake | `13:00` Tepung Almond | ❌ `failed` (`visuals`) | ✅ `completed` | ✅ `completed` | `scheduled` FB `2026-11-26 07:15 WIB` (`pub_1795605305491_5f109994`) |
| `mul_261125_0nswuo` | NutriBake | `13:40` Peanut Butter | ⏳ `generating_t2i` | 🔄 `generating_visuals` | ✅ `completed` | Pulih; `scheduled` FB `2026-11-26 19:45 WIB` (`pub_1795609636506_073a5765`) |
| `mul_261125_lev63s` | Dapur Botani | `01:20` Recurring Sore | ❌ `failed` (`visuals`) | ❌ `failed` (`visuals`) | ✅ `completed` | Pulih; `scheduled` FB/IG/TT/YT `2026-11-26 16:11 WIB` |
| `mul_261125_pa2dv7` | Dapur Botani | `17:45` Jahe Merah Bubuk | 🔄 `generating_t2i` | ⏳ `generating_t2i` | 👀 `waiting_approval` | Keluar dari status macet, menunggu approval |
| `mul_261125_714xul` | Dapur Botani | `18:00` Recurring Sore | 🔄 `ffmpeg_muxing` | ✅ `completed` | ✅ `completed` | `scheduled` FB/IG/TT/YT `2026-11-26 16:11 WIB` |
| `mul_261125_11bxrg` | Dapur Botani | `18:15` metori Hand Blender | 🕒 Belum jatuh tempo | ❌ `failed` (`tts` ffmpeg `-22`) | ❌ `failed` (`tts` PK) | Retry terkena `duplicate key value violates unique constraint "tts_studio_batches_pkey"` |
| `mul_261125_9rljmw` | Dapur Botani | `18:30` Madu Hutan Murni | 🕒 Belum jatuh tempo | ✅ `completed` | ✅ `completed` | `scheduled` FB/IG `2026-11-26 19:00 WIB` |
| `mul_261125_tly9jg` | Dapur Botani | `18:45` Clarity Vent Kotak Kaca | 🕒 Belum jatuh tempo | ✅ `completed` | ✅ `completed` | `scheduled` FB/IG `2026-11-26 20:30 WIB` |

---

## 3. Daftar Masalah Aktif Tersisa (Per 20:15 WIB)

### A. Produksi `failed` — 2 Task
1. **`mul_261125_6a01u2`** — NutriBlend (`tnt_sy-dodot_4ba27b`, `14:40` Teh Bunga Telang)
   - `failed_stage`: `visuals` — `One or more G-Labs video generation tasks failed.`
   - Penanganan: bisa langsung di-retry via `cf_retry_multiplier_task(task_id: "mul_261125_6a01u2")` (setelah `cf_switch_tenant` ke `tnt_sy-dodot_4ba27b`).
2. **`mul_261125_11bxrg`** — Dapur Botani (`default_tenant`, `18:15` metori Hand Blender)
   - `failed_stage`: `tts`
   - Error terbaru: `duplicate key value violates unique constraint "tts_studio_batches_pkey"` (batch TTS `mult_mul_261125_11bxrg` sudah ada dari percobaan sebelumnya saat `ffmpeg` gagal `libmp3lame` `-22`, sehingga retry masuk ke `generating_audio` gagal insert `tts_studio_batches` baru).

### B. Menunggu Approval (`waiting_approval`) — 2 Task
3. **`mul_261125_h6c6p0`** — Dapur Botani (`17:00`, Recurring Pagi)
   - Catatan audit: `Audit verdict=revise menghasilkan revised_script (4 klip) tidak cocok dengan jumlah scene (3 klip); revisi diabaikan.`
4. **`mul_261125_pa2dv7`** — Dapur Botani (`17:45`, Jahe Merah Bubuk)
   - Baru berpindah dari `generating_t2i` ke `waiting_approval` dan siap ditinjau/disetujui.
   - Penanganan: keduanya bisa di-approve melalui `cf_approve_job(job_id: "mul_...")` (`v2.64.1`) setelah operator meninjau naskah.

### C. Publishing Gagal (`needs_review`) — 3 Job Hari Ini (`default_tenant`)
5. **`mul_261125_o53mlp`** (Siasat Sehat `02:20`, target `2026-11-25 16:19 WIB`):
   - `pub_1795548430506_660e1252` (Facebook) — `Repliz API Error: fetch failed`
   - `pub_1795548430514_5b36b34a` (YouTube) — `Repliz API Error: fetch failed`
   - Penanganan: bisa langsung di-retry via `cf_retry_publishing_job`.
6. **`opc_2389`** (`cst_5bd6527307c8`, NutriBake `2026-11-25 07:20 WIB`):
   - `pub_1795561221242_5bddf5ab` (TikTok) — limit posting 24 jam OpenAPI TikTok.

### D. Verifikasi Tambahan via MCP
- **HabitFolk (`02:00`):** Terkonfirmasi lewat `cf_list_schedules` bahwa seluruh 7 jadwal `HabitFolk` memang berstatus `paused` (terakhir `opc_261111_kltluz`).
- **Publishing Scheduled:** `cf_list_publishing_jobs(status: "scheduled")` mencatat **32 job** di `default_tenant` dan **2 job** di `tnt_sy-dodot_4ba27b` (`mul_261125_qyznfz` & `mul_261125_41p33c`).
