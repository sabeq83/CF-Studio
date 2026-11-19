# Instruksi Antigravity — Hotfix Scraper `normalizeUrl` + Perbaikan Tombol URL Kurator Radar Produk

Tanggal: 19 November 2026
Penyusun: Claude (reviewer/planner). Eksekutor: Antigravity.
Bacaan wajib:
- `catatan-kerja/usulan/USULAN_PERBAIKAN_RADAR_PRODUK_PROMOSI_GAGAL.md` (diagnosis lengkap, §2 dan §3)
- `catatan-kerja/usulan/USULAN_PERBAIKAN_PROMOSI_RADAR_PRODUK_NORMALIZE_URL.md` (diff hotfix)
- Kartu `sot/menus/kartu/products.md` dan `sot/menus/kartu/product-radar.md`

Pekerjaan ini terdiri dari **dua bagian terpisah dengan jalur branch berbeda**. Kerjakan **Bagian A dulu sampai selesai di Staging**, baru Bagian B.

---

## Aturan Umum (AGENTS.md)

- `git branch --show-current` sebelum mengedit. Satu branch = satu perbaikan.
- Tidak ada kredensial di kode, test, atau dokumen. Token/kunci diambil dari env; untuk mock gunakan string netral.
- `implementation_plan.md` wajib memuat `## Execution Task List` (checkbox diperbarui real-time) dan potongan kode Sebelum/Sesudah. `implementation_plan.md` saat ini sudah berisi rencana hotfix (`hotfix/scraper-normalize-url`). **Lanjutkan rencana itu** dan tambahkan butir-butir Bagian A di bawah yang belum ada; jangan membuat rencana kedua yang bertabrakan.
- Deploy Production **dilarang**. Deploy Staging hanya dari SHA `main` dan atas persetujuan pengguna.
- Laporan ke pengguna dalam Bahasa Indonesia sederhana (pengguna adalah marketer).

---

## BAGIAN A — Hotfix Scraper (jalur Hotfix, `hotfix/scraper-normalize-url`)

### Masalah
Sejak v2.56.0, semua penambahan **produk baru** lewat URL (Radar Produk, tambah URL di Database Produk, Batch Scraper) gagal di langkah simpan dengan `ReferenceError: normalizeUrl is not defined` (`lib/scheduler-processors.js:9757` & `:9759`). Di Staging: job #10 (Texania SET), #11 (ecentio), dan #12 (VITAMEAL) gagal, masing-masing dicoba 3–4 kali. Setiap percobaan memakai kuota scrape, AI, dan foto G-Labs.

### Langkah
1. **Perbaikan inti**: ganti `normalizeUrl(` → `normalizeProductUrl(` di dua baris tersebut (import sudah ada di baris 28). Pastikan pencocokan `url_affiliates_map` tetap benar untuk kunci URL mentah dari form/CSV.
2. **Sapu sisa**: `grep -rn "normalizeUrl(" lib app` harus kosong dari pemanggilan tanpa definisi. Jalankan `npx eslint lib/scheduler-processors.js --rule 'no-undef:error'` dan laporkan hasilnya. Jika aman, aktifkan `no-undef` sebagai error di konfigurasi ESLint untuk folder `lib/` (bila ini memunculkan banyak temuan lain, **jangan** perbaiki semuanya di hotfix ini — cukup laporkan daftar temuannya).
3. **Test regresi jalur insert produk baru** (`tests/product-scraper-insert-new.test.js`). Celah inilah yang membuat bug lolos: test sebelumnya hanya memeriksa route dan pembuatan job.
   - Jalankan `processProductScraperJob` dengan Playwright, AI, dan G-Labs di-mock, untuk URL yang **belum ada** di katalog.
   - Kasus 1: `url_affiliates_map: {}` → baris `product_extractions` terbentuk dengan `id` = `reserved_ids[url]` dan `affiliate_link = ''`.
   - Kasus 2: peta berisi URL yang sama dengan variasi (query string/garis miring akhir) → `affiliate_link` terisi.
   - Kasus 3: URL yang sudah ada (jalur *repair*) tetap berjalan seperti sebelumnya.
   - Pastikan test **gagal** pada kode lama (sebelum langkah 1) dan **lulus** setelahnya. Laporkan keduanya.
4. **Jangan ulangi kesalahan program** (boleh di hotfix ini bila kecil, atau usulkan sebagai branch terpisah): bila job `product_scraper` gagal karena `ReferenceError`/`TypeError` (kesalahan kode, bukan jaringan/halaman), tandai `failed` pada percobaan pertama, tanpa mencoba ulang. Sertakan test.
5. `npm run build` + test terkait → merge ke `main` → `npm run release-non-interactive -- --type patch --title "Perbaikan Scraper Produk Baru" --points "Memperbaiki gagal simpan produk baru (normalizeUrl is not defined)|Test regresi jalur insert produk baru|..."`.
6. 🛑 **Minta persetujuan pengguna** sebelum deploy Staging: `npm run deploy:staging -- --ref <full-sha-main> --apply --confirm-staging`. Jalankan verifikasi wajib (current, manifest, HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH`, `PGPOOL_MAX`).
7. **Bawa ke branch fitur aktif**: `git merge main` di tiap `fitur/*` yang masih berjalan, lalu push.

### Pemulihan data (setelah hotfix di Staging, atas persetujuan)
- Jangan memicu ulang promosi sendiri. Minta pengguna menekan **↻ Coba Lagi** di Radar untuk 3 kandidat: `prc_427f8d35…` (VITAMEAL), `prc_9cb64e5e…` (ecentio), `prc_6833ab36…` (Texania SET).
- Verifikasi: retry memakai `reserved_product_id` yang sama, hanya **satu** job baru per kandidat, produk muncul di `product_extractions` dan Database Produk, status kandidat menjadi `in_catalog` atau `needs_review`.
- **Foto yatim**: daftar file di `public/uploads/products/` (shared Staging) yang terkait ID cadangan job #10–#12 dari percobaan gagal. **Laporkan daftarnya saja; hapus hanya setelah pengguna setuju.** Hati-hati: setelah retry, file baru dengan ID yang sama akan dipakai produk — bedakan berdasarkan timestamp nama file.

### Kartu menu (dalam commit rilis)
- `products.md` & `product-radar.md`: perbarui tanggal/versi; catat bahwa jalur insert produk baru kini punya test regresi.

---

## BAGIAN B — Perbaikan Tombol URL Kurator (jalur Fitur, `fitur/radar-url-kurator`)

Mulai **setelah Bagian A di `main`**: `git checkout main && git pull && git checkout -b fitur/radar-url-kurator`.

### Masalah (sudah dikonfirmasi pengguna)
Pengguna menekan **"✓ Simpan & Tandai Terverifikasi"** pada kandidat yang URL risetnya sudah ada, tetapi URL tidak tersimpan.
- `app/product-radar/CandidateDetailDrawer.js:61`: kolom diisi `curated_data.target_url || ''`, sehingga **kosong** bila belum pernah disimpan, walau URL riset ada (URL riset hanya tampil sebagai tautan di baris 464–471).
- `:100–104`: `handleSaveUrl` berhenti bila kolom kosong, hanya dengan toast singkat, **tanpa memanggil server** (karena itu log server bersih).
- Satu-satunya jalan adalah tombol kecil "Salin URL Riset ke Input" (`:481–489`), yang mudah terlewat.

### Langkah 1 — Mockup dulu 🛑
Perbarui `public/mockup_radar_produk.html` (token semantik mandiri, light/dark), sinkronkan ke Staging, dan berikan tautan `http://100.95.245.55:5010/mockup_radar_produk.html`. Tampilkan kondisi berikut di laci detail:
1. **Target kosong + URL riset ada** → tombol utama berlabel **"✓ Verifikasi URL Riset"** dan langsung menyimpan `target_url = source_url`.
2. **Kolom diisi URL lain** → label **"✓ Simpan URL Kurator & Tandai Terverifikasi"**, dengan penanda **"● Belum disimpan"**.
3. **Target kosong + tanpa URL riset** → tombol nonaktif + pesan menetap di bawah kolom: "Isi URL listing yang benar".
4. Pesan sukses/gagal tampil **di dekat tombol** (tidak hanya toast/atas laci).
5. **Simpan Edit Kurator** tidak menghapus URL yang sedang diketik (lihat Langkah 2 butir 3).
6. Klik **Masukkan ke Database Produk** saat ada URL belum disimpan → dialog: **Simpan & Masukkan** / **Pakai URL tersimpan** / **Batal**. Dialog konfirmasi promosi menampilkan URL yang **benar-benar dipakai** beserta sumbernya (Kurator/Riset).
7. Menutup laci atau berpindah kandidat (◀ ▶) dengan perubahan belum disimpan → peringatan.

Hapus tombol "Salin URL Riset ke Input" dari mockup.
**🛑 Berhenti dan tunggu persetujuan pengguna atas mockup.**

### Langkah 2 — Implementasi (setelah mockup disetujui)
1. `handleSaveUrl`: bila kolom kosong dan `candidate.source_url` ada → kirim `target_url: candidate.source_url`. Bila keduanya kosong → jangan kirim; tampilkan pesan menetap.
2. State `isUrlDirty = targetUrl.trim() !== (candidate.curated_data?.target_url || '')`. Gunakan untuk label tombol, penanda, dialog promosi, dan peringatan tutup/pindah.
3. `handleSaveCurator`: bila `isUrlDirty`, ikut kirim `target_url` dalam PATCH yang sama. Bila tidak, **pertahankan** isi kolom URL (jangan ditimpa `syncFormFromCandidate` dengan nilai server bila pengguna sedang mengetik).
4. **Server — promote menghormati revisi**: `POST /api/v2/product-research/candidates/[id]/promote` (dan bulk-promote per item) menerima `expected_revision` opsional. Kembalikan 409 bila revisi berubah sejak laci dibuka. Laci mengirim `candidate.revision`.
5. **Kandidat berstatus `failed`** boleh mengganti URL kurator. Retry memakai URL terbaru dengan `reserved_product_id` yang sama (cek `claimCandidatePromotion`, `lib/product-research-repository.js:628`). Bila URL berubah dan produk dengan ID cadangan belum terbentuk, tetap pakai ID yang sama; jangan membuat ID baru.
6. Pakai token semantik `app/theme.css` saja; tidak ada warna hardcoded.

### Langkah 3 — Test
- Komponen/unit: kandidat `official` dengan `source_url` terisi dan target kosong → klik tombol utama → PATCH dengan `target_url = source_url` dan `url_status = 'user'`.
- Simpan Edit Kurator saat URL diketik → URL ikut tersimpan / tidak hilang.
- API: PATCH URL → `effective_url` = URL kurator; promote dengan `expected_revision` usang → 409; retry kandidat `failed` setelah ganti URL → job baru memakai URL baru dan `reserved_product_id` lama.
- `npm run build` + lint.

### Langkah 4 — Dev 🛑
Commit, push, lalu `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`. Laporkan ke pengguna:
- Tautan `http://100.95.245.55:5020/product-radar`
- Daftar cek singkat: (1) buka kandidat dengan URL riset → tekan "Verifikasi URL Riset" → tersimpan; (2) ketik URL lain → penanda muncul → simpan; (3) ketik URL lalu tekan Simpan Edit Kurator → URL tidak hilang; (4) ketik URL tanpa simpan → klik Masukkan → dialog muncul.
- Tidak ada perubahan database.

Naik Staging hanya setelah pengguna menyatakan lolos uji Dev (minimal 1 hari atau pengecualian eksplisit) → merge `--no-ff` ke `main` → rilis patch → deploy Staging. Perbarui kartu `product-radar.md` dalam commit rilis.

---

## Di Luar Cakupan
Perubahan alur ingest TeleRadar, bulk approval selain penambahan `expected_revision`, perbaikan temuan `no-undef` lain di luar `normalizeUrl`, deployment Production.
