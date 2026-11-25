# Usulan: Penanganan Task Gagal, Macet, & Approval via CF Studio MCP

> **Tanggal:** 25 November 2026  
> **Konteks:** Tindak lanjut [LAPORAN_AUDIT_STAGING_KONTEN_20261125.md](../laporan/LAPORAN_AUDIT_STAGING_KONTEN_20261125.md)  
> **Referensi Kode:** `apps/mcp/tools.mjs`, `app/api/v2/multiplier/route.js`, `app/api/v2/multiplier/[id]/retry/route.js`, `app/api/v2/multiplier/[id]/approve/route.js`

---

## 1. Ringkasan Jawaban: Apakah MCP Bisa Menangani yang Gagal?

**Bisa sebagian (untuk kasus `failed` murni & retry publish), tetapi BELUM bisa menangani task macet (`stuck`), approval Multiplier (`mul_*`), dan pemantauan `needs_review` secara akurat.**

| Jenis Kendala di Audit 25 Nov 2026 | Contoh Kasus | Status MCP Saat Ini | Penjelasan Teknis |
|---|---|---|---|
| **Produksi `failed`** | `mul_261125_lev63s`, `mul_261125_6a01u2`, `mul_261125_11bxrg` | ✅ **Bisa** | Via `cf_retry_multiplier_task` (`smart_resume` / `restart_all`). Perlu `cf_switch_tenant` dulu untuk `tnt_sy-dodot_4ba27b`. |
| **Publish `needs_review`** | `pub_1795548430506_660e1252`, `pub_1795548430514_5b36b34a`, `pub_1795561221242_5bddf5ab` | ✅ **Bisa di-retry**, ⚠️ **Sulit dideteksi** | `cf_retry_publishing_job` bisa me-retry, namun `cf_list_publishing_jobs` tidak punya filter `status: "needs_review"` (hanya `pending`, `processing`, `completed`, `failed`, `all`). |
| **Produksi `waiting_approval` (`mul_*`)** | `mul_261125_h6c6p0` | ❌ **Belum bisa** | `cf_approve_job` (`apps/mcp/tools.mjs:2077`) hanya mendukung `cst_*`, `opc_*`, `item_id`, dan `ocj_*`, belum memanggil `/api/v2/multiplier/[id]/approve`. |
| **Produksi macet (`generating_t2i` / `generating_visuals`)** | `mul_261125_pa2dv7` (macet sejak restart PM2 17:51 WIB), `mul_261125_0nswuo` | ❌ **Belum bisa** | `PATCH /api/v2/multiplier` (`app/api/v2/multiplier/route.js:141`) menolak status selain `'failed'` dengan HTTP `409`. |
| **Retry ke stage spesifik (`tts`/`ffmpeg`/`t2i`)** | `mul_261125_11bxrg` (MP3 korup di disk) | ❌ **Belum bisa** | `cf_retry_multiplier_task` hanya menerima `smart_resume` / `restart_all`, belum mengekspos `POST /api/v2/multiplier/[id]/retry` yang punya parameter `stage`. |
| **Health check cluster via MCP** | `cf_get_cluster_health` | ❌ **Error 500** | Mengembalikan `Converting circular structure to JSON (Timeout / TimersList)`. |

---

## 2. Usulan Perbaikan (4 Poin Prioritas)

### Usulan 1 — Tambah Dukungan `mul_*` di `cf_approve_job`
- **Masalah:** `mul_261125_h6c6p0` (`waiting_approval`) tidak bisa di-approve lewat MCP meskipun endpoint `POST /api/v2/multiplier/[id]/approve` sudah tersedia.
- **Solusi:** Tambahkan cabang `if (job_id.startsWith('mul_'))` di `cf_approve_job` (`apps/mcp/tools.mjs`) untuk memanggil `POST /api/v2/multiplier/${encodeURIComponent(job_id)}/approve`.

### Usulan 2 — Dukungan `force` / Pemulihan Task Macet di `cf_retry_multiplier_task`
- **Masalah:** Task yang terputus saat server restart (seperti `mul_261125_pa2dv7` di `generating_t2i`) tertahan selamanya di status in-progress dan ditolak oleh guard `task.status !== 'failed'`.
- **Solusi:**
  1. Tambahkan parameter opsional `force: z.boolean().default(false)` dan `stage: z.enum(['remaking','t2i','tts','visuals','ffmpeg','cloud']).optional()` pada `cf_retry_multiplier_task`.
  2. Di `PATCH /api/v2/multiplier` (`action: 'retry_task'`), izinkan `force: true` untuk mereset task yang berstatus in-progress (`generating_t2i`, `generating_audio`, `generating_visuals`, `ffmpeg_muxing`, `uploading_assets`, `remaking`), atau arahkan ke `POST /api/v2/multiplier/[id]/retry` jika `stage` diisi.

### Usulan 3 — Tambah Status `needs_review` & `scheduled` di `cf_list_publishing_jobs`
- **Masalah:** `cf_list_publishing_jobs` (`apps/mcp/tools.mjs:2192`) membatasi `status` ke `['pending', 'processing', 'completed', 'failed', 'all']`, sehingga laporan harian yang mengecek `status: "failed"` melewatkan kegagalan Repliz/TikTok yang berstatus `needs_review` (seperti `mul_261125_o53mlp` FB & YT).
- **Solusi:** Perbarui enum `status` pada `cf_list_publishing_jobs` menjadi `['pending', 'processing', 'scheduled', 'completed', 'failed', 'needs_review', 'all']` (atau tambahkan ringkasan `needs_review` di response `all`).

### Usulan 4 — Perbaiki Serialisasi JSON pada `cf_get_cluster_health`
- **Masalah:** `cf_get_cluster_health` mengembalikan error 500 `Converting circular structure to JSON (Timeout)` karena objek `Timeout` Node.js ikut terserialisasi dalam response API health.
- **Solusi:** Bersihkan objek return di endpoint health cluster agar hanya mengembalikan primitive/plain object (tanpa handle `Timeout`/`TimersList`).

---

## 3. Langkah Operasional Sementara (Untuk Kasus Hari Ini)

Sambil menunggu usulan di atas diimplementasikan:
1. **Jalankan via MCP sekarang:**
   - `cf_retry_multiplier_task` untuk `mul_261125_lev63s`, `mul_261125_11bxrg` (di `default_tenant`), dan `mul_261125_6a01u2` (setelah `cf_switch_tenant` ke `tnt_sy-dodot_4ba27b`).
   - `cf_retry_publishing_job` untuk `pub_1795548430506_660e1252` (FB) dan `pub_1795548430514_5b36b34a` (YT) milik `mul_261125_o53mlp`.
2. **Jalankan via UI Staging (`http://100.95.245.55:5010`):**
   - Approve `mul_261125_h6c6p0` di Multiplier Lab.
   - Retry manual `mul_261125_pa2dv7` (macet di `generating_t2i` sejak restart PM2 `17:51 WIB`).
