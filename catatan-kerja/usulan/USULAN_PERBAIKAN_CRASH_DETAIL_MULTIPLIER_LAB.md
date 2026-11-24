# Usulan Perbaikan: Halaman Detail Kampanye `mul_261124_4eeox4` Error (`This page couldn't load`)

**Tanggal:** 24 November 2026  
**ID Kasus:** `mul_261124_4eeox4` (`nutribake - Multiplier (Beorganik Peanut Butter): Trik Nyemil Malam Tanpa Takut Kancing Celana Sesak`)  
**Scope Pemeriksaan:** PostgreSQL `staging` & `dev` (`re_multiplier_tasks`), log PM2 (`staging-ui`, `dev-ui`), dan kode [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js) + [lib/bridging/bridge-plan.js](file:///Users/sabeqmmursyid/_cfstudio/lib/bridging/bridge-plan.js)

---

## 1. Hasil Investigasi Fakta

1. **Letak Data Kampanye `mul_261124_4eeox4`:**
   - Di database **`staging.re_multiplier_tasks`**, query `id = 'mul_261124_4eeox4' OR batch_id = 'mul_261124_4eeox4'` mengembalikan **0 baris**. Tugas terbaru di Staging saat pemeriksaan adalah `mul_261124_g01gb0` (23 Nov 2026 19:23).
   - Data **`mul_261124_4eeox4` sebenarnya berada di database `dev` (`dev.re_multiplier_tasks`)** pada server **Dev (`5020/7020`)**, sedang berjalan di tahap `generating_audio`, dan seluruh 6 start frame T2I sudah terbentuk dengan referensi `cleaned_photo_url` (SHA256 `4bb2b7283c01`) pada klip 4 & 6.

2. **Akar Masalah Kode di Halaman Detail Multiplier Lab (`app/multiplier-lab/[id]/page.js`):**
   - **Bug Fatal P3 (Menjatuhkan Halaman Saat Baris Detail Dibuka di Dev / Branch Fitur):**  
     Pada [app/multiplier-lab/[id]/page.js#L1460](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js#L1460), blok *Start Frame Grid Preview* memanggil:
     ```js
     const segRole = sfBridgePlan.getClipRole(cidx + 1);
     ```
     Padahal helper `resolveBridgePlan(...)` di [lib/bridging/bridge-plan.js#L301-L321](file:///Users/sabeqmmursyid/_cfstudio/lib/bridging/bridge-plan.js#L301-L321) **tidak mengekspor metode `getClipRole`**. Nama metode resminya adalah **`zoneOf(clipIndex)`** (seperti yang sudah dipakai di baris `1627`: `multPlan.zoneOf(sidx + 1)`). Akibatnya, saat grid Start Frame (`hybrid_lock`) dirender di browser, React langsung melempar **`TypeError: sfBridgePlan.getClipRole is not a function`** dan memicu layar error browser (`This page couldn’t load`).
   - **Celah JSON Parse Tidak Defensif (`JSON.parse` Tanpa `try/catch`):**  
     Beberapa titik di `app/multiplier-lab/[id]/page.js` memanggil `JSON.parse(...)` tanpa `try/catch` saat render komponen utama, antara lain baris `571–573` (`bridging_config_json`, `vso_config_json`, `audio_config_json`), baris `1280` (`original_storyboard_json`), baris `1453` & `2308` (`t2i_images_json`), dan baris `2105` (`vo_quality_score_json`). Jika salah satu kolom tersimpan sebagai string korup/parsial atau sudah bertipe object, render halaman langsung crash.
   - **Belum Ada Empty State Spesifik Saat Batch Tidak Ada di Environment Aktif:**  
     Bila user membuka `/multiplier-lab/mul_261124_4eeox4` di port Staging (`5010`) padahal batch dibuat di Dev (`5020`) (atau sebaliknya), `tasks` bernilai `[]` tanpa pesan diagnostik yang menjelaskan bahwa ID batch tersebut tidak ditemukan di database environment ini.

---

## 2. Usulan Perbaikan

### P1 — Perbaiki Method Call `sfBridgePlan.zoneOf(...)` & Guard Render Grid Start Frame (Hotfix Mendesak Branch `fitur/multiplier-bridging-foto`)
1. Ubah baris `1460` di [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js) dari:
   ```js
   const segRole = sfBridgePlan.getClipRole(cidx + 1);
   ```
   menjadi:
   ```js
   const segRole = sfBridgePlan.zoneOf(cidx + 1);
   ```
2. Pastikan pemanggilan `JSON.parse(task.t2i_images_json)` dan parsing config di halaman menggunakan helper defensif bersama (`safeJsonParse(value, fallback)`):
   - Menangani `null` / `undefined`, tipe sudah berupa objek/array, maupun string JSON yang tidak valid agar halaman tidak pernah *blank/crash* saat polling progres berlangsung.

### P2 — Tambahkan Banner Empty State Saat `batchId` Tidak Ditemukan di Environment Aktif
- Di [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js), ketika `!loading && tasks.length === 0`, tampilkan banner informatif yang menyatakan bahwa batch `id` tidak ditemukan pada environment/tenant yang sedang dibuka (serta tombol kembali ke `/multiplier-lab`), sehingga user tidak bingung membedakan data Dev vs Staging.

### P3 — Unit Test Anti-Regresi Kontrak `app/multiplier-lab/[id]/page.js`
- Tambahkan assertion di [tests/multiplier-start-frame-identity.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/multiplier-start-frame-identity.test.mjs) yang memverifikasi:
  1. Tidak ada lagi pemanggilan method non-eksisten `.getClipRole(` di `app/multiplier-lab/[id]/page.js` maupun seluruh `app/` + `lib/`.
  2. `resolveBridgePlan(...).zoneOf(...)` mengembalikan `'intro'` / `'recall'` untuk klip bridging dan `'pre'` / `'gap'` / `'post'` untuk klip non-bridging.

---

## 3. Rencana Eksekusi Jika Disetujui
1. Karena `mul_261124_4eeox4` dan bug `getClipRole` saat ini aktif di branch `fitur/multiplier-bridging-foto` (ter-deploy di **Dev `5020`**), perbaikan P1–P3 dikerjakan di `fitur/multiplier-bridging-foto`.
2. Verifikasi unit test (`PG_SEARCH_PATH=dev node --test ...`) & `next build` lokal.
3. Commit, push `fitur/multiplier-bridging-foto`, deploy ulang ke **Dev (`5020`)**, dan cek ulang halaman `http://100.95.245.55:5020/multiplier-lab/mul_261124_4eeox4`.
4. (Jika diperlukan ke **Staging `5010`** untuk pencegahan JSON parse & empty-state sebelum `fitur/multiplier-bridging-foto` siap naik: dapat dipecah menjadi hotfix kecil atau ikut digabung setelah uji Dev lolos sesuai persetujuan pengguna.)
