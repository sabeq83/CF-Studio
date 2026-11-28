# Rencana Penyalinan Data Recipe Library (`curated_recipes`): `syd_admin` → `default_tenant` (Staging & Dev)

Tanggal: 28 November 2026  
Status: **Selesai Dieksekusi (28 November 2026)**

---

## 1. Hasil Audit Database Saat Ini (Read-Only)

Dari pemeriksaan langsung ke PostgreSQL `100.78.186.123:5432/maknaflow_db`:
1. **Mapping User & Tenant (`staging.users`, `staging.tenants`)**:
   - Username `syd_admin` (`usr_4cce0bf578084693`) berada pada tenant **`tnt_sy-dodot_4ba27b`** (*SY Dodot*).
2. **Isi `staging.curated_recipes`**:
   - `tnt_sy-dodot_4ba27b`: **30 resep** (contoh: *Brownies Lumer*, *Brownis Coklat Lumer*, *Brownies kukus*, berstatus `ready_for_production` & `polished`).
   - `default_tenant`: **10 resep** lama yang sudah ada (contoh: *Gulai nangka ayam*, *Ayam Taliwang*, *Ayam Tuyuhan Khas Rembang*).
   - **Overlap `source_url`**: **0 bentrok** antara 30 resep `tnt_sy-dodot_4ba27b` dan 10 resep `default_tenant`.
3. **Isi `dev.curated_recipes`**:
   - Masih **0 resep** (kosong).
4. **Batasan Skema Tabel (`curated_recipes`)**:
   - `id` adalah `PRIMARY KEY` (`curated_recipes_pkey`).
   - Oleh karena itu, penyalinan ke `default_tenant` di dalam schema `staging` yang sama **wajib membuat `id` baru** yang unik (tidak boleh memakai ulang `id` milik `tnt_sy-dodot_4ba27b`), sementara seluruh 25 kolom data resep (`source_url`, `original_title`, `polished_title`, `ingredients_raw`, `original_instructions`, `polished_instructions`, `category`, `status`, `polish_status`, dll.) disalin utuh.

---

## 2. Rencana Eksekusi yang Aman & Idempoten

### Langkah 1 — Salin 30 Resep di Schema `staging` (`tnt_sy-dodot_4ba27b` → `default_tenant`)
- **Sumber**: `staging.curated_recipes WHERE tenant_id = 'tnt_sy-dodot_4ba27b'` (30 baris).
- **Tujuan**: `staging.curated_recipes` dengan `tenant_id = 'default_tenant'`.
- **Pembuatan `id` baru deterministik**: `rcp_def_<12-char sha256(id_asal)>` agar tidak bentrok PK dengan baris `tnt_sy-dodot_4ba27b` dan aman jika dijalankan ulang.
- **Guard anti-duplikat**: Hanya menyisipkan jika `source_url` (atau kombinasi `original_title` + `tenant_id`) belum ada pada `staging.curated_recipes` untuk `tenant_id = 'default_tenant'`.
- **Reset counter pakai**: `used_in_campaign_count = 0` untuk salinan baru di `default_tenant`.
- **Data asal tetap aman**: 30 baris di `tnt_sy-dodot_4ba27b` **tidak diubah atau dihapus**.
- **Target akhir `staging.curated_recipes` (`default_tenant`)**: **10 + 30 = 40 resep**.

### Langkah 2 — Salin Resep ke Schema `dev` (`dev.curated_recipes`, `tenant_id = 'default_tenant'`)
- **Pilihan cakupan salin ke Dev** *(mohon konfirmasi pengguna)*:
  - **Opsi A (Sesuai permintaan persis — 30 resep)**: Salin hanya 30 resep hasil impor tadi (`tnt_sy-dodot_4ba27b`) ke `dev.curated_recipes` (`default_tenant`).
  - **Opsi B (Lengkap — 40 resep)**: Salin seluruh 40 resep `default_tenant` di `staging` (10 lama + 30 baru) ke `dev.curated_recipes` (`default_tenant`) supaya lingkungan Dev identik dengan Staging untuk pengujian fitur baru.
- **Guard anti-duplikat**: Cek `id` dan `source_url` di `dev.curated_recipes` untuk `tenant_id = 'default_tenant'`.

### Langkah 3 — Transaksi & Verifikasi Pasca-Salin
- Seluruh `INSERT` dijalankan dalam satu transaksi PostgreSQL (`BEGIN ... COMMIT` via `withPgTransaction`), sehingga jika ada 1 baris gagal maka seluruh perubahan otomatis di-rollback bersih.
- Verifikasi akhir (hanya `SELECT COUNT(*)` & sampel judul):
  - `staging.curated_recipes` `tnt_sy-dodot_4ba27b` tetap `30`.
  - `staging.curated_recipes` `default_tenant` menjadi `40`.
  - `dev.curated_recipes` `default_tenant` menjadi `30` (atau `40` jika memilih Opsi B).

---

## 3. File Skrip yang Akan Dipakai (Bila Disetujui)
- Membuat skrip satu kali pakai yang aman & idempoten di `scripts/arsip-scratch/copy-curated-recipes-to-default.mjs` (mendukung mode `--dry-run` dulu sebelum `--apply`), dijalankan dari lokal dengan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev`.

---

## 4. Konfirmasi Sebelum Eksekusi
1. Apakah data asal di **`tnt_sy-dodot_4ba27b` (`syd_admin`)** tetap **dibiarkan (copy)**, bukan dipindah/dihapus?
2. Untuk database **Dev (`dev.curated_recipes` `default_tenant`)**, apakah disalin **30 resep baru saja (Opsi A)** atau **semua 40 resep `default_tenant` Staging (Opsi B)**?
