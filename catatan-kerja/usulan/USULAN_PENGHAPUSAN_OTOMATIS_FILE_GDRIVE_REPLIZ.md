# Analisa & Usulan: Mekanisme Penghapusan File Video di Folder Google Drive `REPLIZ Publishing`

**Tanggal**: 26 November 2026  
**Status**: Analisa & Usulan (menunggu keputusan sebelum implementasi)  
**Konteks**: Folder Google Drive `REPLIZ Publishing` (ID aktif Staging: `16tYiX6tnU7G4ommkq_dWBD705OMkzpyR`)

---

## 1. Ringkasan Eksekutif & Jawaban Langsung

**Pertanyaan:** *Apakah file video di folder Google Drive `REPLIZ Publishing` sudah bisa dihapus segera setelah proses penjadwalan ke Repliz (`POST /public/schedule`) terlaksana?*

**Jawaban singkat:** **TIDAK BOLEH dihapus saat baru selesai penjadwalan (`status = 'scheduled'`).**

**Alasan teknis (terbukti di log & database Staging):**
Saat CF Studio menjadwalkan konten ke Repliz (`createReplizSchedule` → `POST /public/schedule`), **Repliz tidak langsung mengunduh dan menyimpan salinan video saat itu juga.** Repliz hanya menyimpan URL Google Drive tersebut, lalu **baru mengunduh file video dari Google Drive ketika jam tayang (`scheduled_at`) tiba** (dan mengunduh ulang bila terjadi *retry*).

Jika file di Google Drive langsung dihapus sesaat setelah penjadwalan dibuat:
1. Pada saat jam tayang tiba, server Repliz akan gagal mengunduh (`Download failed: 404 Not Found`) dan posting ke TikTok / Instagram / Facebook / YouTube akan **gagal**.
2. Jika terjadi gangguan sementara saat tayang dan perlu *retry*, file sudah hilang.

**Kapan file baru AMAN dihapus?**
File baru aman dihapus **setelah status job benar-benar selesai tayang atau dibatalkan**, yaitu:
- **`published` / `draft_created`** → aman dihapus **segera / dengan *grace period* singkat** (mis. **1–2 jam** setelah selesai tayang, bukan menunggu 14 hari seperti sekarang).
- **`cancelled`** → aman dihapus **segera / 1 jam** setelah dibatalkan (karena API cancel di `app/api/v2/publishing/jobs/[id]/route.js` juga sudah memanggil `deleteReplizSchedule`).
- **`failed` / `needs_review`** → **jangan langsung dihapus 0 jam**, beri masa retensi (mis. **3–7 hari**) agar operator masih sempat melakukan *Retry* tanpa perlu re-upload, lalu otomatis dihapus setelah masa retensi lewat.

---

## 2. Bukti Forensik dari Codebase & Database Staging

### 2.1 Bukti Kapan Repliz Mengunduh File Google Drive
Dari tabel `publishing_jobs` dan `publishing_attempts` pada schema `staging` (`100.78.186.123:5432/maknaflow_db`), ditemukan kasus nyata pada 20 November 2026:

1. **Job `pub_1795200065182_daf3869f` (TikTok) & `pub_1795200065190_665c2430` (YouTube):**
   - `18:41:28 UTC` & `18:41:46 UTC`: CF Studio selesai memanggil `POST /public/schedule` ke Repliz untuk jadwal tayang `23:15:00 UTC` (**4,5 jam kemudian**). Status di CF Studio menjadi `scheduled` (`delegated_to_repliz`).
   - `23:15:03 UTC` (**tepat saat jam tayang tiba**, 4,5 jam setelah penjadwalan): Repliz melaporkan error:
     `Download failed: connect ETIMEDOUT 74.125.200.132:443`  
     *(Catatan: `74.125.200.132` adalah IP server Google Drive).*
   - `23:16:08 UTC`: CF Studio menjalankan `retryReplizSchedule`, Repliz mengunduh ulang video dari Google Drive, lalu pada `23:17:18 UTC` & `23:18:18 UTC` barulah berhasil `published`.

Kesimpulan bukti: **URL Google Drive wajib tetap hidup sejak waktu penjadwalan hingga `published` (atau `cancelled`).**

### 2.2 Kondisi Mekanisme Cleanup yang Sudah Ada Saat Ini
CF Studio sebenarnya **sudah memiliki** worker penghapusan otomatis di `lib/publishing-media-cleanup-worker.js` yang dijalankan oleh `startPublishingWorker()` di `lib/publishing-worker.js` setiap **1 jam** (`3600000 ms`), terhubung ke tabel `publishing_media_staging` (`lib/db-pg.js`, `lib/publishing-repository.js`). Worker ini terbukti aktif dan sudah menghapus **1.771 record** lama hingga `2026-11-25T23:33:45Z`.

Namun, hasil audit database Staging per **26 November 2026** menunjukkan masih ada **1.032 file aktif (`deleted_at IS NULL`)** yang menumpuk di folder `REPLIZ Publishing` (`16tYiX6tnU7G4ommkq_dWBD705OMkzpyR`):

| Tenant | Status Job | Jumlah File Belum Dihapus | Keterangan |
|---|---|---:|---|
| `default_tenant` | `published` | 569 | Tertua `2026-11-12` (menunggu retensi 14 hari habis) |
| `tnt_pt-gim-sosmed_62d0d9` | `published` | 360 | Tertua `2026-11-12` (menunggu retensi 14 hari habis) |
| `tnt_sy-dodot_4ba27b` | `published` | 1 | `2026-11-25` |
| `default_tenant` | `scheduled` | 32 | Masih menunggu jadwal tayang (wajib dipertahankan) |
| `tnt_pt-gim-sosmed_62d0d9` | `scheduled` | 24 | Masih menunggu jadwal tayang (wajib dipertahankan) |
| `tnt_sy-dodot_4ba27b` | `scheduled` | 2 | Masih menunggu jadwal tayang (wajib dipertahankan) |
| `default_tenant` | `cancelled` | 16 | Sudah batal sejak `2026-11-15`–`16`, menunggu 14 hari |
| `tnt_pt-gim-sosmed_62d0d9` | `cancelled` | 16 | Sudah batal sejak `2026-11-17`–`22`, menunggu 14 hari |
| `default_tenant` | `needs_review` | 10 | **3 sudah lewat 14 hari** tapi tidak pernah terhapus |
| `tnt_pt-gim-sosmed_62d0d9` | `needs_review` | 1 | **1 sudah lewat 14 hari** tapi tidak pernah terhapus |
| **Total di Google Drive** | | **1.031** | *(+ 1 item `cloudflare_r2` status `retry_wait` = 1.032 total row aktif)* |

### 2.3 Akar Masalah Penumpukan File (6 Celah Teknis)

1. **Retensi Rata 14 Hari Sejak Upload (`PUBLISHING_DRIVE_RETENTION_DAYS=14`) — Penyebab 93% Penumpukan:**
   - Di `lib/publishing-drive-staging.js:440`, setiap file diberi `expires_at = created_at + 14 hari`.
   - Di `lib/publishing-repository.js:1216-1228`, `listExpiredMediaStaging()` mensyaratkan **dua kondisi sekaligus**: `s.expires_at <= CURRENT_TIMESTAMP` **DAN** `j.status IN ('published', 'failed', 'cancelled', 'draft_created')`.
   - Akibatnya, video yang sudah **sukses `published` hari ini** tetap tertahan di Google Drive selama **14 hari penuh**! Saat ini ada **930 file `published` + 32 file `cancelled` (962 file)** yang sebenarnya sudah selesai tetapi mengantre 14 hari.

2. **Upload Duplikat 4x per Video (`1 content_id` = 4 file identik di Drive):**
   - Di `lib/publishing-drive-staging.js:426`, file di-upload dengan nama `publishing_${job.id}_${job.platform}.mp4` dan key idempotensi `appProperties.jobId`.
   - Ketika 1 video dijadwalkan ke 4 platform (`facebook`, `instagram`, `tiktok`, `youtube`), sistem mengunggah **4 salinan file video yang sama persis** ke Google Drive (terbukti di DB Staging: `drive_files_per_content = 4` pada ratusan `content_id`).

3. **Status `needs_review` Tidak Masuk Daftar Pembersihan:**
   - Hampir semua kegagalan Repliz saat ini berstatus `needs_review`, bukan `failed`.
   - Query `listExpiredMediaStaging()` hanya mengecek `('published', 'failed', 'cancelled', 'draft_created')`, sehingga file milik job `needs_review` (4 item di Staging sudah lewat 14 hari) tidak akan pernah terhapus selamanya.

4. **Bug Multi-Tenant & Shared Drive di `lib/publishing-media-cleanup-worker.js`:**
   - Di baris 42, `getAuthorizedClient()` dipanggil **satu kali di luar loop**, tanpa `tenantContext.run(item.tenant_id, ...)`. Saat ini masih lolos karena 5 tenant di Staging kebetulan memakai akun Google yang sama (`sabeq83@gmail.com`), namun akan gagal bila ada tenant dengan akun Google berbeda.
   - Di baris 67, `driveClient.files.delete({ fileId: item.external_file_id })` belum menyertakan `supportsAllDrives: true`.

5. **File Yatim (*Orphaned Files*) Akibat `ON DELETE CASCADE` & Upload Lama:**
   - Tabel `publishing_media_staging` memiliki `REFERENCES publishing_jobs(id) ON DELETE CASCADE` (`lib/db-pg.js:1918`). Jika job dihapus lewat `deletePublishingJobById()` atau `clearFailedPublishingJobs()` (`lib/publishing-repository.js:807-843`), baris tracking di `publishing_media_staging` ikut terhapus sebelum file di Google Drive dihapus.
   - Di DB Staging juga tercatat **12 job lama** dengan URL Drive tanpa baris di `publishing_media_staging`, serta potensi file sisa smoke-test/upload lama yang tidak lagi terlacak tabel DB.

6. **Throughput Terbatas (20 file / jam) & Tidak Ada Trigger Manual:**
   - Worker hanya mengambil `LIMIT 20` per 1 jam. Untuk 1.000 file backlog, butuh ~50 jam (lebih dari 2 hari) untuk habis.
   - Belum ada tombol/endpoint/tool MCP untuk melihat jumlah file staging aktif di Drive atau memicu pembersihan segera.

*(Catatan tambahan terkait provider staging: di Staging, `default_tenant` secara eksplisit memilih `repliz_media_staging_provider = 'google_drive'`, sedangkan tenant lain seperti `tnt_pt-gim-sosmed_62d0d9` dan `tnt_sy-dodot_4ba27b` belum memiliki konfigurasi R2 sendiri sehingga `getEffectiveStagingProvider()` otomatis jatuh ke Google Drive).*

---

## 3. Usulan Mekanisme Penghapusan yang Diusulkan

### Prinsip Desain Utama
1. **Jangan hapus saat baru `scheduled`** — pertahankan file sampai publikasi benar-benar selesai (`published` / `draft_created`) atau dibatalkan (`cancelled`), karena Repliz baru mengunduh saat jam tayang tiba.
2. **Retensi Berbasis Status (Status-Aware Retention)** — tidak lagi menyamaratakan 14 hari untuk semua kondisi:
   - **`published` / `draft_created`**: hapus **otomatis setelah grace period singkat** (usulan default: **2 jam** setelah `published_at` / `updated_at`, dapat dikonfigurasi via env `PUBLISHING_STAGING_PUBLISHED_GRACE_HOURS=2`).
   - **`cancelled`**: hapus **otomatis setelah grace period 1 jam** (atau segera setelah cancel dipastikan tidak dipakai job lain).
   - **`failed` / `needs_review`**: simpan selama **3 hari** (`PUBLISHING_STAGING_FAILED_RETENTION_DAYS=3`, bukan 14 hari dan bukan 0 jam) agar masih bisa di-retry oleh operator/MCP, lalu hapus otomatis.
   - **`scheduled` / `processing` / `retry_wait` / `verifying`**: **DILARANG dihapus** selama job masih aktif! (Bahkan jika `scheduled_at` masih 20 hari ke depan, file tetap aman karena syarat penghapusan tetap mewajibkan status non-aktif/terminal).
3. **File sumber asli di Nextcloud tidak pernah disentuh** — tetap menjaga invarian keamanan worker.

### Rincian Perbaikan yang Diusulkan (5 Komponen)

#### Komponen A — Pembersihan Otomatis Cepat Pasca-Tayang (`lib/publishing-repository.js` & `lib/publishing-media-cleanup-worker.js`)
- Ubah query `listExpiredMediaStaging(limit)` agar mengevaluasi aturan berbasis status:
  - `j.status IN ('published', 'draft_created')` dan `COALESCE(j.published_at, j.updated_at, s.verified_at) <= NOW() - INTERVAL '<grace_hours> hours'` (default 2 jam)
  - `j.status = 'cancelled'` dan `COALESCE(j.cancelled_at, j.updated_at) <= NOW() - INTERVAL '1 hour'`
  - `j.status IN ('failed', 'needs_review')` dan `j.updated_at <= NOW() - INTERVAL '<failed_days> days'` (default 3 hari)
- Percepat worker cleanup:
  - Interval tick tetap ringan atau dipercepat menjadi setiap **15–30 menit** (`PUBLISHING_MEDIA_CLEANUP_INTERVAL_MS=1800000`) dengan batch **`50` item per tick** (atau loop hingga habis dengan batas aman maks 200 item/tick agar backlog cepat terkuras tanpa kena rate limit Google Drive).
- **Ref-counting aman sebelum hapus:** sebelum menghapus `external_file_id`, pastikan tidak ada baris `publishing_jobs` lain yang masih aktif (`status NOT IN ('published','draft_created','cancelled','failed','needs_review')`) yang masih memakai URL / `external_file_id` tersebut.
- **Perbaikan multi-tenant & Shared Drive:** bungkus eksekusi penghapusan per item di dalam `tenantContext.run(item.tenant_id, ...)` dan gunakan `drive.files.delete({ fileId: item.external_file_id, supportsAllDrives: true })`. *(Catatan: `files.delete` di Google Drive API menghapus permanen tanpa masuk Trash).*

#### Komponen B — Deduplikasi Upload per Video (Opsional tapi Sangat Efektif: Hemat Ruang & Kuota 75%)
- Saat menjadwalkan 1 video ke 4 platform (`facebook`, `instagram`, `tiktok`, `youtube`), cukup upload **1 kali** ke Google Drive dengan kunci idempotensi berbasis `tenant_id + content_id + source_hash` (bukan `jobId`), atau reuse `external_file_id` dari job lain dengan `content_id` & `media_url_snapshot` sumber yang sama yang masih `verified` dan `deleted_at IS NULL`.
- Dikombinasikan dengan ref-counting di Komponen A, file baru dihapus setelah **keempat platform selesai** (`published` / `cancelled` / lewat masa retensi `needs_review`).
- Dampak langsung: jumlah file di folder `REPLIZ Publishing` dan waktu upload/bandwidth turun hingga **4x lipat**.

#### Komponen C — Penanganan File Yatim (*Orphan Prevention & Orphan Sweep*)
1. **Cegah orphan baru:** Sebelum `deletePublishingJobById()` atau `clearFailedPublishingJobs()` menghapus row di PostgreSQL, antrekan atau tandai file staging terkait (atau hapus file Drive-nya terlebih dahulu sebelum `DELETE FROM publishing_jobs`).
2. **Orphan Sweep berkala (aman dengan scope `drive.file`):**
   - Sediakan fungsi `sweepOrphanedReplizDriveFiles({ dryRun = true, minAgeHours = 24 })` yang memindai isi folder `repliz_drive_folder_id` melalui `drive.files.list` (hanya file yang dibuat oleh app karena scope `drive.file`).
   - File dianggap aman dihapus jika:
     - Umurnya > `minAgeHours` (default 24 jam, sehingga tidak pernah menyentuh file yang baru diupload), **DAN**
     - `fileId` **tidak terhubung** dengan `publishing_jobs` mana pun yang masih aktif (`scheduled`, `processing`, `retry_wait`, `verifying`, `waiting_media`, `uploading_media`, `creating_container`), **DAN**
     - Jika terhubung ke job `failed`/`needs_review`, umurnya sudah melewati `failed_days` (3 hari).

#### Komponen D — Kontrol Manual di UI Settings & Endpoint API (+ Opsional MCP)
- Tambahkan panel ringkas **"Status & Pembersihan Staging Media"** di halaman `/settings` (kartu Google Drive / Repliz Integration) dan endpoint `POST /api/v2/publishing/staging/cleanup` (atau `GET` untuk statistik):
  - Menampilkan ringkasan real-time: jumlah file siap hapus (`published` / `cancelled`), file menunggu jadwal (`scheduled`), dan file tertahan (`needs_review` / `failed`).
  - Tombol **"🧹 Bersihkan File Selesai Sekarang"** (menghapus hanya file `published`/`cancelled` + orphan aman, tanpa menyentuh jadwal aktif).
  - Pengaturan/opsi retensi bila diperlukan, plus opsi migrasi tenant lain ke Cloudflare R2 bila ingin menghentikan ketergantungan pada Google Drive sepenuhnya.

---

## 4. Perbandingan Pilihan Kebijakan Grace Period

| Opsi | Aturan Hapus `published` / `cancelled` | Aturan Hapus `failed` / `needs_review` | Kelebihan | Risiko / Catatan |
|---|---|---|---|---|
| **Opsi 1 (Direkomendasikan)** | **2 jam** setelah `published` (`1 jam` setelah `cancelled`) | **3 hari** setelah gagal | Aman dari edge-case sinkronisasi status, masih bisa retry job gagal dalam 3 hari, folder Drive tetap hampir kosong (~hanya berisi antrean jadwal hari ini/besok). | Menyisakan sedikit file sementara (~puluhan file aktif, turun >90% dari 1.031 file). |
| **Opsi 2 (Agresif / Instan)** | **0 menit** langsung saat `markPublishingResult('published')` | **24 jam** setelah gagal | Folder paling bersih seketika setelah tayang. | Jika worker sedang gagal menghapus karena limit Google API sesaat, tetap butuh background worker; untuk `needs_review` waktu retry cuma 1 hari. |
| **Opsi 3 (Pindah 100% ke Cloudflare R2)** | Sama seperti Opsi 1, tapi file tidak lagi masuk Google Drive | Sama seperti Opsi 1 | Folder Google Drive `REPLIZ Publishing` nol file baru selamanya. | Perlu mengaktifkan/mengisi kredensial R2 di seluruh tenant atau fallback global ke R2, dan tetap butuh cleanup bucket R2 agar storage R2 tidak penuh. |

> **Rekomendasi:** Jalankan **Opsi 1** (Komponen A + C + D, ditambah Komponen B jika disetujui) karena langsung membersihkan ~962 file backlog yang sudah `published`/`cancelled` saat ini di Staging dengan aman, sekaligus memperbaiki bug multi-tenant dan `needs_review`. Jika ingin sekalian memindahkan semua tenant ke R2 (Opsi 3), perbaikan cleanup worker ini tetap bermanfaat karena tabel `publishing_media_staging` dan `publishing-media-cleanup-worker.js` juga membersihkan file Cloudflare R2!

---

## 5. Rencana Langkah Selanjutnya (Jika Disetujui)

1. **Konfirmasi Pengguna:**
   - Setuju dengan grace period **2 jam** setelah `published`, **1 jam** setelah `cancelled`, dan **3 hari** untuk `failed`/`needs_review`?
   - Apakah ingin menyertakan **deduplikasi 1 file untuk multi-platform** (Komponen B) dan **tombol Bersihkan Sekarang di Settings** (Komponen D)?
   - Apakah setelah rilis ingin dilakukan **pembersihan backlog** (~962 file `published`/`cancelled` + orphan aman yang sudah ada di folder `REPLIZ Publishing` Staging)?
2. **Alur Pengerjaan (sesuai SOP CF Studio):**
   - Jika ada perubahan UI di `/settings` → buat branch `fitur/repliz-drive-cleanup`, buat mockup HTML (`public/mockup_*.html`) di Tahap 1 untuk review, lalu implementasi backend + UI + unit test, deploy & uji di Dev (`5020`), dan setelah lolos baru merge ke `main` & deploy ke Staging (`5010`).
   - Jika hanya perubahan backend worker terlebih dahulu (tanpa UI) → cukup implementasi backend + unit test di branch `fitur/repliz-drive-cleanup`, uji di Dev (`5020`), lalu naik ke Staging (`5010`).
