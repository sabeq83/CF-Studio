# Usulan Perbaikan — Radar Produk: produk tidak masuk Database Produk & URL kurator tidak tersimpan

Tanggal: 19 November 2026
Lingkungan: Staging (5010), schema `staging`, tenant `default_tenant`, release `fb89bb9` (v2.57.0)
Status: hasil pemeriksaan read-only + usulan. Belum ada perubahan kode, data, atau deployment.

> **Hubungan dengan dokumen lain**: `USULAN_PERBAIKAN_PROMOSI_RADAR_PRODUK_NORMALIZE_URL.md` (ditulis terpisah, 12:36) sudah memuat diagnosis dan diff hotfix yang sama untuk Masalah 1. Dokumen ini **melengkapinya**, tidak menggantikan. Tambahannya: dampak ke Database Produk biasa (job #10), kuota terbuang karena dicoba ulang, test jalur insert baru, pengaman lint, pembersihan foto yatim, dan seluruh analisis Masalah 2 (URL kurator). Agent pelaksana memakai diff dari dokumen tersebut **ditambah** butir 2–7 di §2 dokumen ini.

---

## Ringkasan untuk Pengguna

1. **Produk tidak masuk katalog karena ada bug di mesin scraper**, bukan karena Radar. Scraper berhasil membuka halaman Tokopedia, membaca data, dan memproses foto. Lalu ia **gagal tepat saat menyimpan produk baru**, dengan pesan `normalizeUrl is not defined`. Bug ini ikut terbawa sejak rilis **v2.56.0** (19 Nov, ±10:03 WIB).
2. **Dampaknya lebih luas dari Radar**: semua penambahan produk **baru** lewat URL di Database Produk (tombol tambah URL maupun Batch Scraper) ikut gagal di Staging. Melengkapi/memperbaiki produk lama masih berjalan.
3. **Kuota terbuang**: tiap pekerjaan dicoba ulang 3–4 kali. Setiap percobaan menjalankan ulang scrape, ekstraksi AI, dan pembuatan foto studio sebelum gagal di langkah simpan. Ada 10 percobaan sia-sia untuk 3 produk.
4. **URL Listing Pilihan Kurator**: tombol "✓ Simpan & Tandai Terverifikasi" **menolak di layar** bila kolom URL kosong, padahal URL riset tampil di bawahnya. Permintaan tidak pernah sampai ke server, sehingga log bersih. Rincian dan perbaikan di §3.

---

## 1. Bukti Pemeriksaan

### Kandidat & riwayat promosi (schema `staging`)

| Kandidat | ID | URL riset | URL kurator | Status proses | Job | Error |
|---|---|---|---|---|---|---|
| VITAMEAL Mix Berry 1 Box | `prc_427f8d35…` | halaman toko `vitameal-store` | listing produk 1 box | `failed` | #12 (3×) | `normalizeUrl is not defined` |
| ecentio Tumbler Stainless Vacuum 900ml | `prc_9cb64e5e…` | (kosong) | listing ecentioindonesia …1733269059183478418 | `failed` | #11 (4×) | `normalizeUrl is not defined` |
| TEXANIA SET Wajan Anti Lengket 30cm | `prc_6833ab36…` | halaman toko | listing dapurku-houseware | `failed` (job #10) | #10 (3×) | `normalizeUrl is not defined` |

ID produk yang dicadangkan (`pe_1795065265970_195`, `pe_1795065356310_431`) **tidak ada** di `product_extractions`. Tidak ada produk ganda yang terbentuk.

Log Staging (`shared/logs/staging-ui.err.log`), contoh:
```
12:16:15 [Scheduler] product_scraper job #11 failed: normalizeUrl is not defined
12:18:32 [Scheduler] product_scraper job #12 failed: normalizeUrl is not defined
```

### Akar masalah di kode

Commit `5d3b52c` (*refaktor scrape T2/T3*) memindahkan `normalizeUrl` lokal di `lib/scheduler-processors.js` ke helper bersama `normalizeProductUrl` (`lib/product-url-normalizer.js`, sudah di-import di baris 28). Ada **dua pemanggilan lama yang terlewat** di cabang "insert produk baru":

`lib/scheduler-processors.js:9757–9759`
```js
affiliate_link: (() => {
  if (!payload?.url_affiliates_map) return '';
  const normalizedScraped = normalizeUrl(scrapedItem.url);      // ← tidak terdefinisi
  const foundKey = Object.keys(payload.url_affiliates_map).find(
    k => normalizeUrl(k) === normalizedScraped                  // ← tidak terdefinisi
  );
  ...
```
`enqueueProductScrape` (`lib/product-catalog-service.js:274/415`) **selalu** mengirim `url_affiliates_map` berupa objek, walau kosong (`{}` tetap dihitung ada). Akibatnya pemeriksaan di baris pertama tidak pernah menghentikan proses, dan kode di atas **selalu** berjalan untuk produk baru. Cabang "perbaiki produk lama" tidak menyentuh kode ini, jadi tetap berhasil.

Kenapa lolos uji: test refaktor memeriksa respons route `/api/v2/products/scrape` dan pembuatan job. **Tidak ada test yang menjalankan processor sampai insert produk baru**, dan uji live di Dev kemungkinan memakai produk yang sudah ada (jalur *repair*).

---

## 2. Usulan Perbaikan Masalah 1 (Hotfix)

Ikuti **Alur 2 — Hotfix** di AGENTS.md: branch `hotfix/scraper-normalize-url` dari `main`.

1. **Perbaikan inti (2 baris)**: ganti `normalizeUrl(` menjadi `normalizeProductUrl(` di `lib/scheduler-processors.js:9757` dan `:9759`. Sebelum itu, pastikan `normalizeProductUrl` menghasilkan kunci yang sebanding untuk URL afiliasi (`url_affiliates_map` dikunci dengan URL mentah dari form/CSV).
2. **Sapu sisa referensi**: `grep -rn "normalizeUrl(" lib app` → tidak boleh ada pemanggilan tanpa definisi. Tambahkan `no-undef` di ESLint (atau jalankan `npx eslint lib/scheduler-processors.js --rule 'no-undef:error'`) agar bug sejenis tertangkap saat build.
3. **Test regresi wajib** (`tests/product-scraper-insert-new.test.js`): jalankan processor `product_scraper` dengan hasil scrape tiruan (Playwright/AI/G-Labs di-mock) untuk **URL baru** dengan `url_affiliates_map: {}` dan dengan peta berisi satu URL. Pastikan: baris `product_extractions` terbentuk dengan `id` = `reserved_ids`, dan `affiliate_link` terisi pada kasus kedua.
4. **Hemat kuota saat gagal**: error yang pasti berulang (mis. `ReferenceError`/`TypeError` kode) jangan dicoba ulang 3–4 kali. Tandai job `failed` pada percobaan pertama bila error berjenis kesalahan program. Usulan opsional, boleh di branch terpisah bila ingin hotfix tetap minimal.
5. **Pemulihan data setelah hotfix naik Staging** (atas persetujuan pengguna):
   - Tiga kandidat (`prc_427f8d35…`, `prc_9cb64e5e…`, `prc_6833ab36…`) cukup diproses dengan tombol **Coba Lagi** di Radar. Pastikan retry memakai `reserved_product_id` yang sama dan membuat **satu** job baru.
   - Cek dan bersihkan file foto yatim dari percobaan gagal di `public/uploads/products/` untuk ID `pe_1795065265970_195`, `pe_1795065356310_431`, dan ID job #10 (daftar dulu, hapus hanya setelah persetujuan).
   - Sampaikan ke pengguna bahwa penambahan produk baru via Database Produk antara v2.56.0 dan hotfix mungkin gagal dan perlu dikirim ulang. Berdasarkan pemeriksaan, hanya job #10–#12 yang gagal.
6. Rilis `patch` dari `main` → deploy Staging (hotfix boleh tanpa pintu 1 hari, tetap atas persetujuan pengguna) → `git merge main` ke branch `fitur/*` yang aktif.
7. **Kartu `products.md` & `product-radar.md`**: tambahkan catatan bahwa jalur insert produk baru kini punya test regresi.

---

## 3. Masalah 2 — URL Listing Pilihan Kurator tidak tersimpan

### Yang sudah dipastikan
- API `PATCH /api/v2/product-research/candidates/[id]` dan `updateResearchCandidateCuration` menyimpan `curated_data.target_url` dengan benar, termasuk saat URL riset sudah ada. Ketiga kandidat di atas buktinya: masing-masing tersimpan dengan revisi 2.
- Log Staging **tidak mencatat satu pun** `[Product Research Candidate PATCH Error]`. Artinya tidak ada penyimpanan yang ditolak server (validasi URL, konflik revisi, dll.).

### Konfirmasi pengguna (19 Nov): yang ditekan adalah tombol **"✓ Simpan & Tandai Terverifikasi"**

**Akar masalah paling kuat (U0)**: `CandidateDetailDrawer.js`

- Baris 61: kolom URL diisi `curated_data.target_url || ''`. Bila kurator belum pernah menyimpan, kolom **kosong**, walaupun URL riset ada. URL riset hanya tampil sebagai teks tautan di bawah kolom (baris 464–471).
- Baris 100–104: `handleSaveUrl` langsung berhenti bila kolom kosong, dengan toast singkat *"Masukkan URL listing e-commerce terlebih dahulu."*, **tanpa mengirim apa pun ke server**.
- Satu-satunya jalan adalah menekan tombol kecil **"Salin URL Riset ke Input"** dulu (baris 481–489). Tombol ini mudah terlewat, dan tombol utama tidak memberi petunjuk.

Hasilnya, untuk kandidat yang URL risetnya sudah ada, menekan "Simpan & Tandai Terverifikasi" untuk memverifikasi URL tersebut **selalu ditolak di layar**. Ini cocok dengan semua bukti: log server bersih (permintaan tidak pernah sampai), dan hanya 3 kandidat yang tersimpan (ketiganya diisi URL lain secara manual).

**Perbaikan U0 (prioritas)**:
1. Bila `curated_data.target_url` kosong dan `source_url` ada, tombol utama memakai URL riset: kirim `target_url = source_url`. Label tombol berubah menjadi **"✓ Verifikasi URL Riset"**. Bila kolom diisi URL lain, label kembali menjadi "✓ Simpan URL Kurator & Tandai Terverifikasi".
2. Alternatif: kolom diisi otomatis dengan URL riset (diberi label abu "dari riset — belum diverifikasi"), agar pengguna bisa langsung menyimpan atau menggantinya.
3. Toast penolakan diganti pesan yang menetap di bawah kolom, dengan tautan aksi "Pakai URL riset".
4. Hapus tombol "Salin URL Riset ke Input" bila butir 1 atau 2 diterapkan.
5. Test komponen: kandidat `official` dengan `source_url` dan target kosong → tombol utama mengirim PATCH dengan `target_url = source_url`, `url_status = 'user'`.

### Celah tambahan (tetap perlu diperbaiki, dari kode yang sama)

| # | Celah | Akibat yang terlihat pengguna |
|---|---|---|
| U1 | Laci detail punya **dua tombol simpan terpisah**: "✓ Simpan & Tandai Terverifikasi" (URL) dan "Simpan Edit Kurator" (nama/deskripsi/USP). `handleSaveCurator` **tidak mengirim** `target_url`, lalu `syncFormFromCandidate` mengisi ulang semua kolom dari server. | URL yang diketik **hilang** setelah menekan "Simpan Edit Kurator", tanpa peringatan. |
| U2 | Tombol **Masukkan ke Database Produk** memakai data server, bukan isi kolom yang belum disimpan. Bila URL riset ada (status Resmi/Listing), promosi **tidak diblokir**, jadi produk dikirim memakai **URL riset**, bukan URL yang baru diketik. Bila URL riset kosong/Terdekat, tombol diblokir sehingga pengguna "terpaksa" menyimpan dulu. | Persis cocok dengan gejala "tidak bisa disimpan **ketika URL dari riset sudah ada**". |
| U3 | Tidak ada penanda "ada perubahan belum disimpan" dan tidak ada peringatan saat menutup laci / pindah kandidat (◀ ▶). | URL ketikan hilang diam-diam saat berpindah. |
| U4 | Pesan error (`errorMsg`) ditampilkan di bagian atas laci, bisa di luar layar saat pengguna berada di kartu Listing. | Bila ada penolakan, pengguna tidak melihatnya. |

### Usulan perbaikan (fitur kecil; ikuti SOP mockup UI)

1. **Perbarui mockup** `public/mockup_radar_produk.html` dulu (sinkron ke Staging), dengan perilaku berikut:
   - Penanda "● Belum disimpan" di kartu Listing bila isi kolom ≠ `curated_data.target_url`.
   - **Satu tombol "Simpan semua perubahan"** yang mengirim URL + edit kurator dalam satu PATCH (atau: tombol kurator ikut mengirim `target_url` bila kolom URL berubah).
   - Sebelum promosi: bila kolom URL berubah tetapi belum disimpan, tampilkan dialog "Simpan URL baru lalu masukkan?" dengan pilihan **Simpan & Masukkan** / **Pakai URL tersimpan** / **Batal**. Dialog konfirmasi promosi wajib menampilkan URL yang **akan benar-benar dipakai**, dengan label sumbernya (Kurator / Riset).
   - Peringatan saat menutup laci atau berpindah kandidat dengan perubahan belum disimpan.
   - Pesan error/sukses ditampilkan di dekat tombol yang ditekan (bukan hanya di atas laci).
2. **Server**: endpoint promote menerima `expected_revision` opsional dan menolak (409) bila revisi kandidat berubah sejak laci dibuka. Ini mencegah promosi memakai URL yang berbeda dari yang dilihat pengguna.
3. **Kandidat yang sudah gagal**: izinkan mengganti URL kurator saat `process_status = failed`. Retry berikutnya memakai URL terbaru, tetap dengan `reserved_product_id` yang sama (cek di `claimCandidatePromotion`).
4. **Test**: (a) PATCH URL pada kandidat berstatus `official` dengan `source_url` terisi → `effective_url` = URL kurator; (b) promote dengan `expected_revision` usang → 409; (c) unit/komponen: simpan edit kurator tidak menghapus URL ketikan.

Kerjakan di branch `fitur/radar-url-kurator` (bukan hotfix, karena mengubah UI dan perilaku), uji di Dev, lalu naik Staging dengan persetujuan.

---

## 4. Urutan yang Disarankan

1. **Hotfix scraper (§2) segera**, karena Database Produk biasa juga terdampak.
2. Setelah hotfix di Staging: pengguna menekan **Coba Lagi** pada 3 kandidat → verifikasi produk muncul di Database Produk.
3. Perbaikan UX URL kurator (§3) lewat jalur fitur dan Dev.

## 5. Konfirmasi Pengguna

Pengguna menekan **"✓ Simpan & Tandai Terverifikasi"** (19 Nov). Ini mendukung akar masalah U0 di §3. Bila setelah perbaikan U0 masih gagal saat kolom diisi URL lain, periksa ulang dengan membuka DevTools → Network pada permintaan `PATCH /api/v2/product-research/candidates/<id>`.
