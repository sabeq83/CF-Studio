# Rencana Perbaikan: Infinite Loop `[Pillar Glabs] Polling error: fetch failed` (Zombie Item `#293`) & Status Kampanye `opc_261124_tkv7cr`

**Tanggal:** 24 November 2026  
**Server Terdampak:** Dev (`5020/7020`, schema `dev`)  
**Status:** Rencana Perbaikan (Menunggu Persetujuan Eksekusi)

---

## 1. Hasil Investigasi Server Dev

### A. Status Kampanye Aktif Pengguna: `opc_261124_tkv7cr` (Item `#370`) — Normal
Kampanye **`opc_261124_tkv7cr`** (*[Product Campaign] umum - Meja Tamu Marmer Putih Rangka Emas*, mode `no_vo` + `hybrid_lock`) **tidak mengalami error tersebut** dan sedang berjalan normal:
- Storyboard dan seluruh **6 Start Frame** (`opc_start_frame_370_clip_1..6_*.jpg`) selesai digenerate pada pukul `11:06:07` (`start_frame_status = 'completed'`, `6/6`).
- Tahap TTS dilewati bersih sesuai mode Tanpa VO (`tts_status = 'skipped'`) pukul `11:06:15`.
- Klip visual sudah dikirim ke G-Labs pada `11:06:30–11:07:40` (`visual_status = 'processing'`, `visual_tasks_json` terisi).

### B. Sumber Asli Error Log: Zombie Item `#293` (`opc_260922_hi2aiw`)
Log error yang berulang (`[04.51.08]`..`[04.52.01]` dan masih terus berulang hingga `11:02:48` di `dev-ui.err.log`) berasal dari **item lama `#293`** milik kampanye **`opc_260922_hi2aiw`** (*[ Recipe OPC 20260922 ] - nutribake - Brownies Fudgy Rendah Kalori -02*, berstatus `running` sejak 22 September 2026):
- Pada tabel `dev.pillar_campaign_items`, item `#293` berada dalam kondisi inkonsisten:
  - `workflow_status = 'completed'`, `generation_status = 'completed'`, `tts_status = 'completed'`, **`visual_status = 'processing'`**, `ffmpeg_status = 'pending'`.
- Pada `visual_tasks_json` item `#293`, klip ke-1 s.d. ke-15 menunjuk ke `glabs_tasks` tanggal **22 September 2026** dengan `status = 'completed'` dan `video_url = 'http://100.82.154.57:8765/api/files/...'` (**IP worker G-Labs lama yang sudah tidak aktif**, karena worker sekarang berjalan di `100.64.70.61:8765`).

---

## 2. Akar Masalah Kode Penyebab *Infinite Zombie Loop*

1. **`catch (pollErr)` Tidak Menghentikan Loop Saat `fetch failed` ([lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L7790-L7841)):**
   - Saat `downloadAndUploadPillarClip` ([line 11086](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L11086)) menjalankan `fetch(cachedTask.video_url)` ke IP mati `100.82.154.57:8765`, Node melempar `TypeError: fetch failed`.
   - Blok `catch (pollErr)` ([line 7825-7835](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L7825-L7835)) hanya menandai `anyFailed = true` jika `pollErr.status === 404 || pollErr.status === 410`. Karena error jaringan `fetch failed` tidak punya `.status`, ia membiarkan `visual_status = 'processing'` selamanya dan mengulang download ke-15 klip mati tersebut terus-menerus (pola yang sama juga ada di jalur RE Campaign [line 3649-3652](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L3649-L3652)).
2. **Tidak Ada Batas Timeout / Retry pada Unduhan Klip & Polling Jaringan:**
   - Setiap siklus polling memanggil `fetch(url)` ke host yang tak terjangkau hingga belasan kali berturut-turut (~2,5–3,5 menit per putaran `pillar_glabs_poll`), memenuhi log error dan membebani event loop scheduler.
3. **Scheduler Memproses Item yang `workflow_status`-nya Sudah `'completed'` ([lib/campaign-scheduler.js](file:///Users/sabeqmmursyid/_cfstudio/lib/campaign-scheduler.js#L598-L655)):**
   - Walaupun `item #293` berstatus `workflow_status = 'completed'`, karena `isPillarItemFinished` melihat `visual_status = 'processing'` dan kampanye bertipe `full_autopilot`, scheduler tetap menjalankan `pillar_glabs_poll` tanpa henti.

---

## 3. Rencana Perbaikan

### Tahap 1 — Cleanup Data Zombie di Server Dev (`dev` schema)
- Hentikan loop pada item `#293` (dan cek kampanye `opc_260922_hi2aiw`):
  - Ubah item `#293` ke `visual_status = 'failed'`, `ffmpeg_status = 'failed'`, `review_reason = 'Zombie G-Labs URLs expired (old host 100.82.154.57)'` (serta hentikan status `running` pada `opc_260922_hi2aiw` jika tidak ada item aktif lain).
- Efek: log `dev-ui.err.log` bersih seketika dan kampanye aktif seperti `opc_261124_tkv7cr` (`#370`) berjalan tanpa noise.

### Tahap 2 — Batas Retry Network Error & Timeout Download G-Labs ([lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js))
1. **Tambahkan `AbortSignal.timeout(15_000)`** pada `fetch(url)` di `downloadAndUploadPillarClip` dan `downloadAndUploadReClip` agar host mati gagal cepat (fail-fast) tanpa memblokir tick scheduler berlama-lama.
2. **Penanganan Fatal/Retry-Bounded untuk `fetch failed` & Network Errors pada `pillar_glabs_poll` & RE `glabs_poll`:**
   - Buat helper bersama untuk mendeteksi error konektivitas host (`EHOSTUNREACH`, `ECONNREFUSED`, `ENETUNREACH`, `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`, atau `fetch failed`) dan memeriksa umur `glabs_tasks.created_at`.
   - Jika `cachedTask.video_url` gagal diunduh karena error jaringan **dan** usia task > 24 jam (URL pekerja lama/mati), langsung anggap task tersebut kadaluarsa/mati (`anyFailed = true`) dan tandai status task G-Labs gagal agar **langsung berhenti di percobaan pertama**.
   - Untuk task baru (< 24 jam) yang terkena error jaringan sementara, gunakan pelacakan retry (`retry_count` di `pillar_campaign_items` / `re_campaign_items`) dengan batas maksimal (mis. **5–8 kali siklus polling berturut-turut gagal jaringan**): bila melewati batas, hentikan loop dengan `visual_status = 'failed'` dan `throw` pesan error yang jelas alih-alih loop tanpa akhir.

### Tahap 3 — Guard Scheduler untuk Item `workflow_status === 'completed'` ([lib/campaign-scheduler.js](file:///Users/sabeqmmursyid/_cfstudio/lib/campaign-scheduler.js))
- Pada loop eksekusi Pillar (`line 598-602`): jika `currentItem.workflow_status === 'completed'`, lewati item tersebut dari penjadwalan tahap produksi (atau hanya proses jika `workflow_status === 'production_processing'`), sehingga item lama yang sudah ditandai `completed` tidak dapat menyangkut lagi di `pillar_glabs_poll`.

### Tahap 4 — Verifikasi Unit Test & Deploy ke Dev
- Tambahkan unit test (simulasi `fetch failed` URL kadaluarsa & batas retry polling, plus guard `workflow_status === 'completed'`).
- Jalankan unit test lokal (`PG_SEARCH_PATH=dev node --test ...`) dan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`.
- Eksekusi cleanup `#293` pada Dev DB, lalu deploy perbaikan ke Dev (`5020/7020`).
