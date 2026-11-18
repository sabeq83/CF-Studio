# Instruksi Antigravity — Tombol GPT Image 2 Manual & Foto Scraper Square

Tanggal: 18 November 2026
Dari: Claude (reviewer/planner) — untuk dieksekusi Antigravity
Rencana sumber (WAJIB dibaca utuh dulu): `implementation_plan.md` di folder utama proyek.
Latar belakang review: `catatan-kerja/usulan/REVIEW_USULAN_GPT_IMAGE2_FOTO_PRODUK.md` (bagian B dan D2).

---

## 0. Aturan main (jangan dilanggar)

1. **Mockup HTML dulu, kode belakangan.** Untuk perubahan UI (Bagian B), **DILARANG** menyentuh `app/**` sebelum mockup disajikan di Staging dan **pengguna menyatakan setuju secara eksplisit**. Berhenti dan tunggu jawaban pengguna setelah mengirim link mockup.
2. **Branch, bukan main.** Cek `git branch --show-current` sebelum mengedit. Bagian A di `fitur/scraper-foto-square`, Bagian B di `fitur/gpt-regenerate-manual`, masing-masing dibuat dari `main` terbaru. **Tanpa** `npm run release` di branch fitur.
3. **Satu branch = satu bagian.** Jangan mencampur A dan B.
4. **Token warna saja.** Semua UI dan mockup memakai token `app/theme.css` (`var(--surface)`, `var(--text-primary)`, dst.). Dilarang hex/rgb statis. Harus rapi di light dan dark mode.
5. **Tanpa secret.** Jangan menulis API key, cookie, atau base64 gambar ke kode, log, mockup, atau dokumen.
6. **Tanpa fallback diam-diam.** GPT gagal → foto lama tetap, pesan jelas. Jangan pindah otomatis ke Nano Banana.
7. **Deploy hanya ke Dev** dengan full SHA yang sudah di-push. Staging hanya setelah pengguna menyatakan lolos uji Dev + gate 1 hari (atau izin percepatan). Production dilarang.
8. **Perbarui `implementation_plan.md`**: centang `- [x]` di `## Execution Task List` setiap selesai satu tahap.
9. Baca panduan Next.js terkait di `node_modules/next/dist/docs/` sebelum mengubah file `app/**` (lihat AGENTS.md).
10. Laporkan ke pengguna dalam **Bahasa Indonesia sederhana** (pengguna marketer, bukan programmer).

---

## 1. Tahap Persiapan

- [ ] Baca `implementation_plan.md` utuh.
- [ ] Cek daftar model image di worker G-Labs yang terpasang (`ssh vibe-server`, atau endpoint model/health G-Labs). Pengguna menyebut "Nano Banana 2.1"; dokumen G-Labs hanya mengenal `nano_banana_pro`, `nano_banana_2`, `nano_banana_2_lite`, dan ID tak dikenal **diam-diam** jatuh ke `nano_banana_2`.
  - Ada ID resmi untuk 2.1 → laporkan ke pengguna, pakai ID itu, dan tambahkan ke `normalizeGlabsImageModel` di `lib/webhook-client.js`.
  - Tidak ada → pakai `nano_banana_2` (default rencana).
- [ ] Cek endpoint `POST /api/openai/generate` tersedia di versi G-Labs terpasang dan akun ChatGPT sudah login. Catat versinya. **Jangan** menjalankan generasi berbayar pada tahap ini.

---

## 2. Bagian A — `fitur/scraper-foto-square` (tanpa UI, tanpa migrasi)

Ikuti `implementation_plan.md` bagian A1–A3.

- [ ] `git checkout main && git pull && git checkout -b fitur/scraper-foto-square`
- [ ] `lib/scheduler-processors.js`, blok Generative Polish (±baris 9468–9492): model `nano_banana_pro` → `nano_banana_2` (atau ID 2.1 hasil cek), rasio `9:16` → `1:1`. Perbarui komentar dan log.
- [ ] Audit pemakai `generated_photo_url` (cari dengan grep; jangan membaca file besar utuh) untuk asumsi rasio 9:16 di thumbnail atau tampilan.
- [ ] Perbarui `sot/menus/kartu/products.md` (A2).
- [ ] Commit, push, deploy Dev:
  `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`
- [ ] Verifikasi sesuai SOT deployment (current, PM2 online, `pm_cwd`, HTTP 200 UI/API).
- [ ] Laporkan ke pengguna: link Dev `http://100.95.245.55:5020` + cek uji:
  1. Scrape 1 URL produk → foto studio berbentuk kotak.
  2. Kartu produk dan thumbnail tampil wajar.
  3. Buat 1 start frame dari produk itu → video tetap 9:16 dan produk terbaca benar.
- [ ] Tunggu pernyataan lolos uji dari pengguna. Baru setelah itu merge ke main, release, dan deploy Staging (Alur 1 SOP).

---

## 3. Bagian B — `fitur/gpt-regenerate-manual`

### 3.1 MOCKUP DULU (wajib, sebelum kode aplikasi)

- [ ] `git checkout main && git pull && git checkout -b fitur/gpt-regenerate-manual`
- [ ] Buat `public/mockup_tombol_gpt_banding_produk.html`. File harus **mandiri** (token CSS light/dark disalin dari `app/theme.css` ke dalam file; tanpa library luar; tanpa memanggil API). Isi minimal:
  1. **Jendela tinjau/banding foto** meniru tampilan modal di `app/products/page.js` (±baris 2370–2700): foto lama di kiri, foto baru di kanan.
  2. **Label model** di bawah tiap foto, contoh: "Foto baru: GPT Image 2" dan "Foto lama: Nano Banana". Label disembunyikan bila model tidak diketahui.
  3. **Deretan tombol**: 🔄 Ganti Foto · ✨ Ulangi Generate · **🧠 Ulangi dengan GPT** (baru) · ↩ Kembalikan foto lama.
  4. **Simulasi klik GPT**: dialog konfirmasi ("Memakai kuota akun ChatGPT. Foto sekarang tetap disimpan dan bisa dikembalikan.") → kartu berstatus "Sedang dibuat dengan GPT…" → hasil muncul beserta label.
  5. **Simulasi gagal**: pesan error jelas, dan foto lama tetap tampil.
  6. **Kondisi nonaktif**: tombol GPT abu-abu dengan keterangan "Foto mentah belum tersimpan di server" (sediakan sakelar simulasi).
  7. **Sakelar light/dark** untuk menguji kontras.
  8. Catatan kecil: "Tombol GPT hanya untuk 1 produk. Tombol massal tetap Nano Banana."
- [ ] Sinkronkan **hanya file mockup** ke folder public runtime Staging. Baca dulu `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` untuk memastikan lokasi yang benar (`current/public` vs `shared/`). Jangan deploy kode.
- [ ] Verifikasi `curl -I http://100.95.245.55:5010/mockup_tombol_gpt_banding_produk.html` → HTTP 200.
- [ ] Commit mockup ke branch fitur.
- [ ] **BERHENTI.** Kirim link ke pengguna beserta daftar yang perlu dicoba (poin 4–7 di atas), lalu tunggu persetujuan. Revisi mockup bila diminta, ulangi sinkron, lalu tunggu lagi.

### 3.2 Implementasi (hanya setelah mockup disetujui)

Ikuti `implementation_plan.md` B1–B7 persis, termasuk potongan Before/After.

- [ ] **B1 Migrasi**: 3 kolom `photo_engine_request`, `photo_model`, `previous_photo_model` (`ADD COLUMN IF NOT EXISTS`) di `lib/db-pg.js`. Cari tahu cara migrasi dijalankan di Dev/Staging (build memakai `DISABLE_AUTO_MIGRATIONS=true`) dan tulis caranya di laporan. Cek juga skema SQLite/test yang perlu ikut.
- [ ] **B2 API** `app/api/v2/products/regenerate-photos/route.js`: parameter `engine`. GPT hanya untuk 1 id. GPT tanpa raw lokal (`/uploads...`) → skipped dengan pesan jelas. Tolak produk yang sedang pending/processing. Tombol biasa selalu mengosongkan `photo_engine_request`.
- [ ] **B3 Worker** `lib/product-bulk-worker.js`: SELECT kolom baru. Bila GPT → prompt `buildGptProductPrompt`, adapter GPT, `photo_provider='glabs'`. Saat simpan, isi `photo_model` dan `previous_photo_model`, lalu kosongkan `photo_engine_request`. Saat gagal, tulis pesan asli G-Labs ke `photo_error`. Jalur lama tidak berubah.
- [ ] **B4 Provider** `lib/product-photo-providers/glabs.js`: parameter `engine`, `getFileUrl(imageFile, taskId)`, pola `jpe?g`, pesan error asli.
- [ ] **B5 Helper** `generateProductPhotoWithOpenAI` di `lib/webhook-client.js`: `/api/openai/generate`, body `1:1 / high / direct / none / web_search false`, tanpa field `model`, **tanpa** `sanitizeImagePrompt`, tanpa BullMQ, tanpa fallback. Simpan route task (`saveGlabsTaskRoute`) dan pakai `applyRandomDelay('image')`. Fungsi lama tidak diubah.
- [ ] **B6 Prompt** `buildGptProductPrompt` di `lib/product-photo-service.js`.
- [ ] **B7 UI** `app/products/page.js`: tombol dan label persis seperti mockup yang disetujui. Pastikan API list/detail produk mengembalikan 3 kolom baru. Tombol massal tidak berubah. Tool MCP `cf_regenerate_product_photo` tidak berubah.

### 3.3 Tes & build

- [ ] Buat `tests/product-photo-gpt-manual.test.js` sesuai B9, memakai **mock fetch sendiri**. Jangan bergantung pada `getTaskStatus` mode test, karena ia mengembalikan `succeeded`, bukan `completed`.
- [ ] Jalankan tes foto produk yang sudah ada (mis. `scripts/test-product-pipeline.js`) + tes baru + lint/build. Semua harus lulus. Laporkan output aslinya bila ada yang gagal.

### 3.4 Dev & uji live terbatas

- [ ] Perbarui `sot/menus/kartu/products.md` (B10). Commit, push, deploy Dev dengan full SHA, lalu verifikasi sesuai SOT.
- [ ] Uji live **1 produk saja** berlabel jelas: Ulangi Generate (Nano Banana) → Ulangi dengan GPT → banding menampilkan dua foto + label → Kembalikan foto lama berfungsi → Ulangi Generate biasa kembali ke Nano Banana.
- [ ] Buat 1 start frame dari foto GPT, lalu cek produknya terbaca benar.
- [ ] Laporkan ke pengguna: link Dev, daftar cek, tanggal mulai masa uji, dan **pemberitahuan migrasi 3 kolom** (rollback kode tidak menghapus kolom; kolom kosong aman diabaikan).
- [ ] Tunggu pernyataan lolos uji + gate 1 hari. Lalu merge `--no-ff` ke main, `npm run release-non-interactive -- --type minor --title "..." --points "..."`, verifikasi tag, deploy SHA rilis ke Staging, verifikasi, dan hapus branch.

---

## 4. Penutup

- [ ] Hapus mockup dari Staging hanya bila pengguna meminta.
- [ ] Arsipkan `implementation_plan.md` ke `catatan-kerja/rencana/` setelah semua selesai, lalu perbarui `catatan-kerja/_DAFTAR_ISI.md`.
- [ ] Tulis laporan singkat di `catatan-kerja/laporan/` (apa yang berubah, hasil uji, versi rilis) dan daftarkan di daftar isi.

## 5. Kapan harus berhenti dan bertanya ke pengguna

- Setelah link mockup dikirim (wajib).
- Model "Nano Banana 2.1" ternyata punya ID lain, atau endpoint `/api/openai/generate` tidak tersedia di worker.
- Migrasi tidak bisa dijalankan dengan cara yang jelas di Dev/Staging.
- Ada file lain di luar rencana yang perlu diubah: tambahkan Before/After ke `implementation_plan.md` dulu, lalu laporkan.
- Ada tes lama yang gagal dan tidak terkait perubahan ini.
