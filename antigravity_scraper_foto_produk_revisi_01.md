# Revisi 01: Scraper Foto Produk (setelah v2.49.1) + Tinjau & Ganti Foto di UI

> Berlaku untuk `antigravity_scraper_foto_produk_instructions.md`. Baca dokumen induk dulu, lalu dokumen ini. Jika bertentangan, **dokumen ini yang berlaku**.

## Mandat

Rilis v2.49.1 (`cfcded4` + `49a8aea`) sudah memperbaiki inti masalah: foto Habarlic kini tanpa wajah endorser. Hasil review menemukan **4 celah** di backend dan 1 masalah kualitas crop (R1–R5). Pengguna juga meminta **dua fitur UI baru** di katalog produk:

1. **Tombol persetujuan** untuk foto berstatus `needs_review` (R6).
2. **Fitur ganti foto** di UI (R7).

Kerjakan R1–R7 berurutan. Tetap di lingkup foto produk.

## Pengingat penting

v2.49.1 dirilis dan dideploy ke staging tanpa jeda persetujuan, padahal instruksi induk mewajibkannya. Untuk revisi ini aturannya tetap: **kode + uji lokal + commit lokal, lalu berhenti dan minta izin pengguna** sebelum `release-non-interactive`, push, tag, deploy, atau menjalankan skrip data di staging. Satu-satunya pengecualian adalah sinkronisasi file mockup HTML (lihat R6/R7, langkah mockup).

---

## R1. Catatan audit foto membengkak 2,5 MB per produk (paling serius)

**Bukti:** di staging, `raw_response` Habarlic (`pe_1794803911352_653`) berukuran **2.539.305 karakter**. Isinya `photo_selection_audit.evaluated[]` yang memuat `buffer` gambar mentah setiap kandidat. Akibatnya `cf_get_product_detail` untuk Habarlic gagal dibaca agen (respons 2,5 MB melebihi batas token MCP), dan database ikut membengkak.

**Sebab:** `lib/product-photo-picker.js` → `evaluateCandidateScores()` memakai `...cand`, padahal `cand` dari `downloaded[]` berisi `buffer`, `localPath`, `mimeType`. Hasil ini disimpan di `lib/scheduler-processors.js` sebagai `photo_selection_audit: photoPickerResult?.evaluation`.

**Perbaikan:**
1. Simpan audit dalam bentuk ringkas saja (whitelist field, bukan spread):
   ```js
   { index, url, source, w, h, has_person, text_overlay, is_infographic, product_visible, score, isAcceptable }
   ```
   Lakukan pemangkasan di satu tempat (mis. helper `toAuditCandidate()`), dan pastikan `selectedCandidate` yang disimpan juga ringkas.
2. **Skrip perbaikan data** `scripts/fix-photo-audit-bloat.mjs`:
   - Default **dry-run**: daftar produk yang `length(raw_response) > 100000` dan memuat `photo_selection_audit`, beserta ukuran sebelum/sesudah.
   - `--apply`: tulis ulang `raw_response` dengan audit ringkas. Kolom lain tidak boleh berubah. Tidak ada penghapusan baris.
   - Wajib menerima `--schema dev|staging` dan menolak `public` (production).
   - Menjalankannya di staging **butuh izin pengguna** (laporkan hasil dry-run dulu).
3. **Tes:** audit untuk 6 kandidat (masing-masing buffer 200 KB) menghasilkan `JSON.stringify(...)` < 20 KB, dan tidak ada key `buffer`/`localPath`.

## R2. Kondisi gagal masih ditandai `approved`

Sudah dibuktikan dengan menjalankan `decidePhotoStatus()` langsung:

| Kondisi | Hasil sekarang | Seharusnya |
|---|---|---|
| Semua kandidat ditolak karena infografis/teks tebal (tanpa orang) | `approved` | `needs_review` |
| Semua kandidat gagal diunduh (`reason: 'gagal mengunduh semua kandidat gambar'`) | `approved` | `needs_review` |
| Tidak ada pemeriksaan akhir (`finalCheck = null`), mis. hapus latar gagal sehingga foto mentah dipakai sebagai clean | `approved` | `needs_review` |

**Perbaikan** di `decidePhotoStatus()` (`lib/product-photo-picker.js`) dan pemanggilnya (`lib/scheduler-processors.js`):
1. `pickerNeedsReview === true` → **selalu** `needs_review`, dengan `photo_error = pickerReason`. Hapus syarat daftar alasan tertentu.
2. Saat foto baru diproses pada run ini tetapi `finalCheck` kosong → `needs_review`, `photo_error = 'pemeriksaan akhir foto tidak berjalan'`.
3. Penghapusan latar gagal (catch `bgErr`) → `needs_review`, `photo_error = 'hapus latar belakang gagal'`.
4. **Tes:** tambahkan ketiga kasus di tabel ke `tests/product-photo-picker.test.js`.

## R3. `refresh_photo` bisa mengosongkan foto lama

Di mode `refresh_photo`, kalau unduhan foto baru gagal, `rawPhotoPath`, `cleanPhotoPath`, dan `generatedPhotoPath` bernilai `null`, lalu `photoOnlyUpdates` menimpa kolom foto produk dengan `null`. Produk jadi tanpa foto (file lama masih ada di disk, tetapi tautannya hilang).

**Perbaikan:**
1. Jika foto raw baru **tidak** berhasil didapat pada mode refresh → **jangan ubah kolom foto apa pun**, kecuali mengisi `photo_error = 'refresh foto gagal: <alasan singkat>'`. `photo_status` lama tetap.
2. Hanya timpa kolom yang benar-benar menghasilkan file baru (raw/clean/generated). Kalau G-Labs gagal, `generated_photo_url` lama **tidak** dihapus. Jika foto lama itu berasal dari foto bermasalah, set `active_photo` ke `cleaned_photo_url` baru.
3. Nama file baru memakai akhiran waktu (mis. `raw_<id>_<yyyymmddHHMMss>.png`) agar file lama tidak tertimpa dan masih bisa dipulihkan. Terapkan sama untuk clean dan generated.
4. **Tes:** fungsi murni `buildRefreshPhotoUpdates({ existing, newRaw, newClean, newGenerated, status, error })` dengan kasus: unduhan gagal → hanya `photo_error`; G-Labs gagal → `generated_photo_url` tidak ada di update.

## R4. Mode perbaikan biasa bisa membatalkan status `needs_review`

Objek `data` di `processProductScraper()` selalu menyertakan `photo_status`/`photo_error`. Pada repair biasa yang hanya melengkapi metadata atau foto studio (`needsRaw = needsClean = false`), `decidePhotoStatus({})` menghasilkan `approved` dan menimpa status `needs_review` yang sudah ada.

**Perbaikan:**
1. Sertakan `photo_status`/`photo_error` di `data` **hanya jika** run ini benar-benar memproses raw atau clean baru.
2. Jika status lama `needs_review` dan tidak ada foto baru, **jangan** jalankan G-Labs polish untuk produk itu.
3. **Tes:** repair biasa dengan `needsRaw = needsClean = false` tidak menyertakan `photo_status` di update.

## R5. Kualitas crop: kotak terpotong dan resolusi turun

**Bukti:** foto akhir Habarlic hanya 571×580 px (sumber 1200 px), dan kotak kemasan di sisi kanan terpotong. Prompt crop masih memuat kalimat lama *"Return the bounding box … for only that ONE item"*, sehingga set botol + kotak dipaksa menjadi satu objek.

**Perbaikan** di `cropPrompt` (`lib/scheduler-processors.js`, tahap 1b):
1. Ganti instruksi "SINGLE … ONE item" dengan: *"Box the complete product package set shown (for example the bottle together with its box). If several identical variants appear side by side, box only one complete set. Exclude any people, faces, hands, models, logos/badges and promotional text."*
2. Tambahkan padding 6% di setiap sisi (dibatasi tepi gambar) sebelum `sharp.extract`.
3. Jika hasil crop < 800 px pada sisi terpanjang **dan** sumbernya ≥ 1000 px, atau luas crop < 25% gambar, **lewati crop** dan pakai gambar utuh (rembg tetap jalan). Catat keputusan ini di log.
4. Jangan menimpa file raw asli dengan hasil crop. Simpan crop sebagai file terpisah (mis. `raw_<id>_<ts>_crop.png`) agar raw asli tetap tersedia untuk R7.
5. Uji dry-run pada Habarlic: kotak dan botol utuh, sisi terpanjang ≥ 1000 px.

---

## R6. UI: tombol persetujuan foto `needs_review`

### Backend
1. Endpoint baru `POST /api/v2/products/[id]/photo-review` (pakai `withTenantContext`, cek kepemilikan tenant dengan `getProductById`). Body: `{ "action": "approve" }`.
   - Hanya boleh jika `photo_status` sekarang `needs_review`. Selain itu → 409 dengan pesan jelas.
   - Set `photo_status = 'approved'`, `photo_error = null`, `photo_reviewed_at = NOW()`. Jika ada `cleaned_photo_url`, set `active_photo = 'cleaned_photo_url'` dan `photo_url` sesuai.
   - **Jangan** memakai `PUT /api/v2/products/[id]` untuk ini, karena PUT selalu mengosongkan `t2i_prompt` dan `i2v_action_prompt` (`filteredUpdate.i2v_action_prompt = null; filteredUpdate.t2i_prompt = null;`).
   - Tidak menjalankan G-Labs otomatis. Foto clean yang disetujui sudah cukup sebagai referensi.
2. Tambahkan `photo_status`, `photo_error`, `photo_reviewed_at` ke respons daftar produk jika belum ada (cek `GET /api/v2/products`).

### UI (`app/products/page.js`, kartu produk ~baris 1230 dst.)
1. Jika `photo_status === 'needs_review'`: tampilkan badge **"⚠️ Foto perlu ditinjau"** di dekat badge status yang sudah ada, plus alasan dari `photo_error` (teks kecil, `var(--status-warning)` / `var(--status-warning-soft)`).
2. Dua tombol di kartu itu: **"Setujui Foto"** dan **"Ganti Foto"** (R7).
3. "Setujui Foto" membuka dialog konfirmasi berisi foto clean ukuran besar, alasan peninjauan, dan peringatan *"Pastikan tidak ada wajah orang atau tokoh publik di foto."* Tombol: **Setujui** / **Batal**. Setelah sukses: toast, lalu `fetchProducts()`.
4. Filter cepat di atas daftar: **"Perlu ditinjau (N)"** untuk menampilkan hanya produk `needs_review`.
5. Hanya pakai token CSS semantik dari `app/theme.css` (tanpa warna hex/rgb). Harus rapi di mode terang dan gelap.

## R7. UI: fitur ganti foto produk

Catatan kondisi sekarang: fungsi `handleUploadPhoto()` (`app/products/page.js:268`) sudah ada dan memanggil `POST /api/v2/products/image`, tetapi **tidak dipakai** oleh tombol mana pun. Unggah foto via endpoint itu juga hanya menyimpan file dan menandai `needs_review` tanpa membuat foto clean. Endpoint itu dipakai MCP `cf_upload_product_photo`, jadi **jangan ubah perilakunya**. Buat jalur baru.

### Tiga cara ganti foto (satu modal "Ganti Foto", tiga tab)
1. **Pilih dari foto listing.** Tampilkan kandidat galeri hasil scrape terakhir beserta label AI (Ada orang / Teks tebal / Infografis / Skor). Kandidat yang ditolak AI tetap bisa dipilih, tetapi diberi tanda peringatan.
   - Agar ini bisa dilakukan, picker (R1) harus **menyimpan file kandidat** yang sudah diunduh ke `public/uploads/products/candidates/<productId>/cand_<index>.<ext>` (folder `uploads` sudah di `shared/`), bukan menghapusnya. Saat refresh berikutnya, ganti isi folder itu. URL Tokopedia bertanda tangan kedaluwarsa, jadi jangan mengandalkan URL CDN untuk pilihan di kemudian hari.
   - Audit ringkas (R1) menyimpan `local_path` tiap kandidat.
   - Untuk produk tanpa kandidat tersimpan (produk lama), tampilkan pesan *"Belum ada foto listing tersimpan, gunakan Ambil Ulang Otomatis."*
2. **Unggah foto sendiri** (JPG/PNG/WebP, maks 15 MB, validasi dengan `validateRawProductImage`).
3. **Ambil ulang otomatis.** Memicu scrape dengan `refresh_photo: true` untuk `source_url` produk (pakai alur route scrape yang sudah ada). Nonaktifkan tab ini jika produk tidak punya `source_url`.

### Backend
1. Endpoint baru `POST /api/v2/products/[id]/photo-replace`:
   - `source: 'candidate'` + `candidate_index`, atau `source: 'upload'` + file (multipart), atau `source: 'rescrape'`.
   - Untuk candidate/upload: simpan sebagai raw baru (nama file berakhiran waktu, file lama tidak ditimpa), set `photo_status = 'processing'`, lalu buat job **`product_photo_replace`** `{ product_id, raw_path, origin: 'candidate'|'upload' }`. Kembalikan `job_id`.
2. Ekstrak tahap foto dari `processProductScraper()` (crop → rembg → pemeriksaan akhir → status) ke fungsi bersama, mis. `processProductPhotoFromRaw({ productId, rawAbsPath, runCrop })` di `lib/product-photo-picker.js` atau modul baru. Pakai fungsi ini di scraper **dan** di processor job baru, supaya logikanya tidak dobel. Daftarkan job baru di registry job yang sudah ada dengan pola yang sama seperti `product_scraper`.
   - `runCrop`: `true` untuk candidate, `false` untuk unggahan pengguna (pengguna biasanya sudah memilih foto yang pas).
   - Pemeriksaan akhir P4 tetap jalan. Bersih → `approved` + `photo_reviewed_at = NOW()` (karena dipilih manusia). Masih ada orang/teks → `needs_review` dengan alasan; pengguna bisa menyetujui manual lewat R6.
   - G-Labs tidak dijalankan otomatis di jalur ini.
   - Gagal di tahap mana pun → foto lama **tidak** berubah, `photo_status` dikembalikan ke nilai sebelumnya, `photo_error` berisi alasan.
3. Hati-hati dengan `lib/product-bulk-worker.js` (~baris 411–419): status `processing` tanpa `photo_task_id` lebih dari 10 menit di-reset menjadi `failed`. Pastikan job selesai jauh sebelum itu, atau isi `photo_task_id` dengan id job agar tidak salah reset.

### UI
1. Tombol **"Ganti Foto"** tersedia di semua kartu produk (bukan hanya `needs_review`), mis. di samping tombol edit atau di area foto.
2. Modal tiga tab seperti di atas. Ada pratinjau "Foto sekarang" vs "Foto pilihan" sebelum konfirmasi.
3. Selama `processing`, kartu menampilkan status memproses. Polling yang sudah ada (`hasBulkQueueActive` mencakup `processing`) dipakai ulang.
4. Token CSS semantik saja; terang dan gelap harus rapi.

### Mockup dulu (SOP `AGENTS.md`)
Sebelum menulis kode React untuk R6/R7:
1. Buat `public/mockup_foto_produk_review.html` (self-contained, token desain mandiri, contoh data Habarlic dengan badge `needs_review`, dialog Setujui, modal Ganti Foto tiga tab, filter "Perlu ditinjau").
2. Sinkronkan **hanya file mockup itu** ke staging agar bisa dibuka di `http://100.95.245.55:5010/mockup_foto_produk_review.html`. Tanpa build, tanpa restart PM2, tanpa deploy release. Jika cara itu tidak memungkinkan tanpa deploy, kirim file mockup ke pengguna dan minta pengguna memilih caranya.
3. **Tunggu persetujuan pengguna atas mockup** sebelum mengerjakan kode UI. Backend R1–R5 boleh dikerjakan sambil menunggu.

---

## Tes yang wajib ditambahkan

- R1: audit ringkas < 20 KB, tanpa `buffer`/`localPath`; dry-run skrip perbaikan data mendeteksi baris besar (pakai DB mock atau fungsi transformasi murni).
- R2: tiga kasus `needs_review` di tabel R2.
- R3: `buildRefreshPhotoUpdates` (unduhan gagal, G-Labs gagal).
- R4: repair biasa tanpa foto baru tidak menyertakan `photo_status`.
- R5: fungsi murni `computeCropBox({ coords, width, height })` (padding 6%, batas tepi, aturan lewati crop).
- R6: endpoint photo-review menolak status selain `needs_review` (409), dan tidak menyentuh `t2i_prompt`/`i2v_action_prompt`.
- R7: validasi body photo-replace (source tidak dikenal → 400, candidate_index di luar jangkauan → 400, rescrape tanpa `source_url` → 400); kegagalan job tidak mengubah foto lama.
- Jalankan juga: `node --test tests/url-scraper-tokopedia-images.test.js tests/product-photo-picker.test.js tests/base64-image-reference.test.js`, `npm run test:product-catalog`, `npm run test:mcp`, `npm run build`.

## Kriteria selesai

Lokal:
- [ ] Semua tes di atas lulus, build berhasil.
- [ ] Dry-run Habarlic: audit tersimpan < 20 KB, crop memuat botol + kotak utuh, sisi terpanjang ≥ 1000 px, status `approved`.
- [ ] Dry-run kasus negatif (Cottonology, semua foto berisi model) → `needs_review`.
- [ ] Mockup sudah disetujui pengguna, lalu UI di-review di lokal: badge, dialog Setujui, modal Ganti Foto tiga tab, filter "Perlu ditinjau", mode terang dan gelap.

Staging (**hanya setelah izin pengguna**):
- [ ] Skrip `fix-photo-audit-bloat` dijalankan (`--schema staging --apply`). `cf_get_product_detail` Habarlic bisa dibaca normal (respons < 50 KB).
- [ ] Produk uji bisa disetujui lewat tombol, dan `t2i_prompt` tidak hilang.
- [ ] Ganti foto lewat ketiga tab berhasil pada produk uji. Foto lama masih ada di disk.
- [ ] Laxing (`pe_1794802696381_879`) tidak berubah.

## Larangan (tambahan dari dokumen induk, yang lama tetap berlaku)

- Jangan rilis, push, tag, deploy, atau menjalankan skrip data di staging tanpa izin eksplisit pengguna di chat. Production dilarang.
- Jangan menghapus produk, dan jangan menghapus file foto lama (raw/clean/generated). Cukup ganti tautannya.
- Jangan mengubah perilaku `POST /api/v2/products/image`, `PUT /api/v2/products/[id]`, `regenerate-photos`, `product-bulk-worker`, dan tool MCP yang sudah ada, kecuali yang tertulis di sini.
- Jangan memblokir alur produksi konten (OPC/RE/Multiplier/Recipe) berdasarkan `needs_review` dalam revisi ini. Cukup tandai di katalog. Jika menurutmu perlu diblokir, tulis sebagai usulan di laporan.
- Tanpa warna hardcoded di UI. Tanpa secret di kode, tes, atau mockup.

## Format laporan balik

Bahasa Indonesia sederhana untuk marketer:
1. Ringkasan 3–5 kalimat.
2. Status R1–R7 (selesai / sebagian / belum + alasan satu baris).
3. Link mockup dan status persetujuannya.
4. Hasil tes, build, dan dry-run (Habarlic: ukuran audit, resolusi, path foto; kasus negatif).
5. Hasil dry-run skrip perbaikan data (berapa produk terdampak, ukuran sebelum/sesudah). **Belum dijalankan di staging.**
6. File yang diubah/ditambah, dan commit lokal (hash + branch).
7. Risiko dan catatan.
8. Pertanyaan izin: *"Boleh saya rilis patch, deploy ke staging, lalu jalankan skrip perbaikan data Habarlic?"* Tunggu jawaban.
