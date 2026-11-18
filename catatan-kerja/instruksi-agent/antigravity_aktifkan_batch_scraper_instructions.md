# Instruksi Antigravity — Aktifkan Kembali Tombol Batch Scraper (Menu Database Produk)

Tanggal: 18 November 2026
Dari: Claude (reviewer/planner) — untuk dieksekusi Antigravity
Menu: Products / Database Produk (`app/products/page.js`). Kartu menu: `sot/menus/kartu/products.md`.

---

## 0. Latar belakang (hasil baca kode)

- Tombol **"🔒 Batch Scraper (Locked)"** di header halaman produk (`app/products/page.js` ±baris 912–931) dikunci dengan `disabled` sejak **v2.2.200 (5 Agustus 2026)**. Changelog hanya menulis "Lock Batch Scraper button", tanpa alasan teknis.
- **Hanya tombolnya yang dimatikan.** Bagian lain masih utuh dan terpakai:
  - Modal "⚡ Batch Product Scraper" masih ada (±baris 2092–2232): input URL/CSV, kategori, tag, dan centang "Perbaiki & Lengkapi". Masalahnya, tidak ada satu pun pemanggil `setShowScraperModal(true)`.
  - `handleSubmitScraper` (±baris 535) → `POST /api/v2/products/scrape` → job antrean `product_scraper` → `processProductScraper` (`lib/scheduler-processors.js:9060`).
  - API dan job yang sama **masih dipakai** oleh fitur "Rescrape" di modal Ganti Foto, jadi jalur belakangnya hidup.
  - Antrean `product_scraper` default `is_enabled: 0, mode: manual`, tetapi job manual **tetap diproses** (`lib/scheduler.js` ±baris 407–414: "runs manual triggers even if queue is disabled").
- Setelah perbaikan scraper (fitur/scraper-foto-square), setiap URL baru otomatis membuat **foto studio Nano Banana 2 (1:1)**. Artinya 1 batch berisi 50 URL = sampai 50 generasi gambar G-Labs + 50 panggilan Gemini.

## 1. Aturan main

1. **Urutan branch (penting):** Dev hanya punya satu slot. Bagian B (`fitur/gpt-regenerate-manual`) sedang masa uji di Dev sejak 18 Nov 2026. **Jangan** deploy branch ini ke Dev sebelum Bagian A dan B digabung ke `main`, karena akan menimpa B yang sedang diuji. Setelah A dan B masuk `main`, buat `fitur/aktifkan-batch-scraper` dari `main` terbaru. Kalau pengguna minta lebih cepat, tanyakan dulu dan jelaskan risikonya.
2. **Mockup dulu** (SOP Mockup HTML). Jangan mengubah `app/**` sebelum pengguna menyetujui mockup.
3. Hanya token warna `app/theme.css`. Tombol lama memakai `rgba(30, 41, 59, 0.5)` dan `#334155`; ini **wajib** diganti token.
4. Tanpa `npm run release` di branch fitur. Deploy Dev dengan full SHA. Staging hanya setelah lolos uji + gate 1 hari (atau izin percepatan).
5. Centang progres di `implementation_plan.md` (buat rencana baru dengan Before/After, setelah rencana GPT selesai diarsipkan).
6. Lapor ke pengguna dalam Bahasa Indonesia sederhana.

---

## 2. Tahap 1 — Aktifkan tombol + pengaman kuota & data (WAJIB)

### 2.1 Mockup
- [ ] Buat `public/mockup_batch_scraper_aktif.html` (mandiri, token light/dark, tanpa API). Isinya:
  1. Header halaman produk: tombol **"⚡ Batch Scraper"** aktif di samping "➕ Add Product", dengan gaya senada.
  2. Modal Batch Scraper apa adanya, ditambah perubahan 2.2-D (centang "Perbaiki & Lengkapi" **default mati** + catatan kuota).
  3. Catatan di bawah tombol kirim: "Setiap produk baru membuat 1 foto studio (Nano Banana 2) dan memakai kuota G-Labs & Gemini. Maks 50 URL."
  4. Simulasi kirim → toast "X produk baru dimasukkan ke antrean" → banner "Scraper aktif di latar belakang".
- [ ] Sinkron ke public runtime Staging (cek SOT current/shared), verifikasi HTTP 200 di `http://100.95.245.55:5010/mockup_batch_scraper_aktif.html`, lalu **BERHENTI** dan tunggu persetujuan.

### 2.2 Implementasi (setelah mockup disetujui)

**A. Aktifkan tombol — `app/products/page.js` (±912–931)**

Code Sebelum:
```jsx
<button
  className="btn"
  disabled
  style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155', color: 'var(--text-muted)', ..., cursor: 'not-allowed', ... }}
>
  🔒 Batch Scraper (Locked)
</button>
```
Code Sesudah:
```jsx
<button
  type="button"
  className="btn btn-secondary"
  onClick={() => setShowScraperModal(true)}
  disabled={isSubmittingScraper}
  title="Tempel hingga 50 link Shopee/Tokopedia untuk ditambahkan otomatis"
  style={{ /* samakan bentuk dengan tombol Add Product; warna HANYA token, mis. var(--surface-interactive), var(--border-strong), var(--text-primary) */ }}
>
  ⚡ Batch Scraper
</button>
```

**B. Batas 50 URL ditegakkan di API — `app/api/v2/products/scrape/route.js`**
UI menulis "Maks 50 URL", tapi API tidak membatasi daftar URL manual (CSV dibatasi 50 hanya di sisi browser).

Code Sebelum:
```js
const uniqueUrls = Array.from(new Set(urlList));
```
Code Sesudah:
```js
const uniqueUrls = Array.from(new Set(urlList));
if (uniqueUrls.length > 50) {
  return NextResponse.json({ success: false, error: `Maksimal 50 URL per batch. Anda memasukkan ${uniqueUrls.length}.` }, { status: 400 });
}
// CSV: terapkan batas yang sama pada uniqueCsvRows
```

**C. CSV jangan menghapus link afiliasi & wajib filter tenant — route yang sama**
Saat ini baris CSV dengan kolom afiliasi **kosong** akan menimpa link afiliasi lama menjadi `''`. UPDATE-nya juga tanpa `tenant_id`.

Code Sebelum:
```js
await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ?').run(affiliate, existing.id);
updatedCount++;
```
Code Sesudah:
```js
if (affiliate) {
  await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ? AND tenant_id = ?')
    .run(affiliate, existing.id, activeTenant);
  updatedCount++;
}
```

**D. "Perbaiki & Lengkapi" default MATI — `app/products/page.js` (±baris 89 & teks ±2213–2217)**
Alasan: pengecekan "data rumpang" menganggap produk tanpa `generated_photo_url` sebagai belum lengkap. Padahal pipeline foto baru **sengaja tidak menulis** kolom itu. Akibatnya, menempel URL produk lama bisa memicu scrape ulang + foto studio baru untuk hampir semua produk, sehingga kuota terbuang.

Code Sebelum:
```js
const [repairMode, setRepairMode] = useState(true);
// teks: "...kekurangan aset visual (raw/clean/studio) atau USP/Kemasan akan di-scrape ulang/dilengkapi secara otomatis."
```
Code Sesudah:
```js
const [repairMode, setRepairMode] = useState(false);
// teks: "...akan di-scrape ulang. Memakai kuota G-Labs & Gemini untuk setiap produk yang diperbaiki. Biarkan mati bila hanya menambah produk baru."
```
Default API (`repair_mode = true`) **tidak diubah**, karena fitur Rescrape di modal Ganti Foto mengandalkannya.

**E. Kartu menu** `sot/menus/kartu/products.md`: tambahkan butir "Tombol Batch Scraper aktif kembali (maks 50 URL/CSV, centang Perbaiki default mati, CSV tidak menimpa afiliasi kosong)". Perbarui tanggal/versi saat rilis.

### 2.3 Tes & verifikasi
- [ ] Tes API (baru/perluas yang ada, mis. `tests/product-scraper-tenant.test.js`):
  - 51 URL → 400, dan tidak ada job dibuat.
  - CSV dengan afiliasi kosong → link afiliasi lama tetap.
  - UPDATE afiliasi tidak menyentuh produk tenant lain.
  - URL produk yang sudah ada + repair mati → dilewati, tidak ada job.
- [ ] Lint/build lulus. Deploy Dev (full SHA), verifikasi sesuai SOT.
- [ ] Uji live di Dev dengan **2–3 URL saja** (1 baru, 1 yang sudah ada): produk baru muncul lengkap dengan foto studio 1:1, produk lama dilewati, banner progres tampil dan hilang sendiri.
- [ ] Laporkan ke pengguna: link Dev, daftar cek, dan tanggal mulai uji.

---

## 2B. Tahap 1B — S3, S5, S6 (DISETUJUI pengguna 18 Nov 2026)

Kerjakan di branch yang sama (`fitur/aktifkan-batch-scraper`), sesudah Tahap 1 dan dalam satu masa uji Dev. Ketiganya tidak mengubah tampilan besar, jadi cukup disebut di mockup Tahap 1 sebagai catatan (S5 menambah satu baris keterangan di kartu produk; tampilkan di mockup). Tambahkan Before/After ke `implementation_plan.md` sebelum mengedit.

### S3 — Satu aturan "data rumpang" untuk API dan worker
**Masalah:** Ada dua pengecekan berbeda:
- API `app/api/v2/products/scrape/route.js` → `checkMissingComponents` (raw, `cleaned_photo_url`, `generated_photo_url`, USP, kemasan).
- Worker `lib/scheduler-processors.js` ±9147–9155 (raw, `cleaned_photo_url`, `generated_photo_url`, USP, kemasan, `t2i_prompt`, `i2v_action_prompt`).

Keduanya mewajibkan `generated_photo_url`, padahal pipeline foto baru sengaja tidak menulis kolom itu. Keduanya juga hanya melihat `cleaned_photo_url`, padahal pipeline baru menulis `clean_photo_url` + `cleaned_photo_url`.

**Perbaikan:**
- Buat satu fungsi bersama, mis. `lib/product-completeness.js` → `assessProductCompleteness(product, { fileExists })`, yang mengembalikan `{ needsRaw, needsClean, needsStudio, needsMetadata, anyMissing }`.
- Aturan:
  - `needsRaw` = file raw tidak ada.
  - `needsClean` = **tidak ada** file di `cleaned_photo_url` **maupun** `clean_photo_url`.
  - `needsStudio` = **tidak ada** file studio (`generated_photo_url`) **dan** tidak ada foto bersih. Produk dengan foto bersih dianggap cukup, foto studio tidak diwajibkan.
  - `needsMetadata` = USP / `packaging_type` / `t2i_prompt` / `i2v_action_prompt` kosong (pakai daftar worker yang lebih lengkap, agar API dan worker sepakat).
- API dan worker sama-sama memakai fungsi ini. SELECT di API perlu menambah kolom `clean_photo_url, t2i_prompt, i2v_action_prompt`.
- Jalur `refresh_photo` (Rescrape di Ganti Foto) **tidak berubah**: tetap memaksa semua `true`.
- Tes unit fungsi ini, minimal 4 kasus: produk pipeline baru (clean ada, studio kosong) → tidak rumpang; tanpa raw → rumpang; metadata kosong → rumpang; file tercatat di DB tapi hilang di disk → rumpang.
- Setelah S3 lulus, laporkan ke pengguna bahwa centang "Perbaiki" sudah aman dinyalakan. Default tetap **mati** sampai pengguna memutuskan lain.

### S5 — Kegagalan foto studio tercatat di produk
**Masalah:** Blok Generative Polish (`lib/scheduler-processors.js` ±9478–9535) menunggu maks 40×3 detik. Saat gagal, timeout, gagal unduh, atau error, ia hanya menulis `console.warn`, lalu produk tersimpan tanpa foto studio dan tanpa keterangan apa pun.

**Perbaikan:**
- Simpan hasil polish di variabel `studioPolish = { status: 'completed'|'failed'|'timeout'|'skipped', model: 'nano_banana_2', task_id, error }`, diisi di setiap cabang: sukses, `failed` (pakai pesan asli G-Labs dari `statusRes.error`/`error_detail`), habis 40 putaran tanpa selesai (`timeout`), unduhan `!ok`, dan `catch`.
- Simpan ke `raw_response.studio_polish` (kolom JSON yang sudah ada, **tanpa migrasi**).
- **Jangan** mengubah `photo_status` dan jangan mengisi `photo_error` dengan kegagalan studio. Foto bersih tetap sah, dan `photo_error` dipakai keputusan review foto. Perhatikan juga cabang R4 (±9600) yang menghapus field foto saat repair biasa: `raw_response.studio_polish` tetap boleh ditulis.
- UI kartu/jendela tinjau produk: bila `raw_response.studio_polish.status` adalah `failed`/`timeout`, tampilkan satu baris kecil berwarna `var(--status-warning)`: "Foto studio gagal dibuat (alasan) — foto bersih tetap dipakai." Pastikan API list/detail produk sudah mengembalikan field ini (cek `raw_response` ikut terkirim atau tambahkan field turunan `studio_polish_status`).
- Waktu tunggu 2 menit **tidak diubah** (Nano Banana 2 biasanya cepat). Tujuannya hanya membuat kegagalan terlihat.
- Tes: mock `getTaskStatus` → `failed` dan → selalu `pending` (timeout). Pastikan `raw_response.studio_polish` terisi benar dan `photo_status` tidak berubah.

### S6 — Maksimal 1 job scraper berjalan sekaligus
**Masalah:** `processQueue` di `lib/scheduler.js` (±240) boleh mengklaim 3 job per tick untuk antrean non-AI. Job berjalan **tanpa ditunggu** (`executeJob` async), dan tick berulang tiap 30 detik. Akibatnya job dari tick sebelumnya tidak dihitung, sehingga batch besar (3 job × 20 URL) bisa menjalankan beberapa Chromium + G-Labs paralel. Kunci `job_<id>` per job tidak mencegah ini.

**Perbaikan:**
- Tambahkan batas per antrean, mis. `const QUEUE_CONCURRENCY = { product_scraper: 1 };`.
- Tambahkan penghitung berjalan di memori, mis. `state.runningByQueue[queueName]`: naik saat job diklaim, turun di `finally` saat job selesai/gagal (cari blok `finally` yang sudah melepas `lockKey`).
- Di `processQueue`: `const cap = QUEUE_CONCURRENCY[queueName] ?? (isAiQueue ? 2 : 3);` lalu klaim hanya bila `running < cap`.
- Antrean lain **tidak berubah** perilakunya (cap default sama seperti sekarang; hanya kini dihitung lintas tick, jadi verifikasi tidak ada antrean lain yang mendadak melambat; kalau ragu, terapkan penghitung lintas tick **hanya** untuk antrean yang ada di `QUEUE_CONCURRENCY`).
- Job berikutnya tetap menunggu di antrean (status `pending`) dan diambil otomatis setelah yang berjalan selesai. Rescrape satu produk dari Ganti Foto juga ikut antre, jadi sebutkan di laporan bahwa rescrape bisa menunggu batch yang sedang berjalan.
- Tes: simulasikan 3 job `product_scraper` pending + 2 tick → hanya 1 berstatus `running`; setelah selesai → job kedua diklaim.

### Verifikasi Tahap 1B di Dev
- Kirim batch 3 URL produk lama pipeline baru (clean ada, studio kosong) dengan "Perbaiki" **dinyalakan** → semua dilewati (S3).
- Kirim 2 batch kecil berurutan → log menunjukkan job kedua menunggu sampai job pertama selesai (S6).
- Bila memungkinkan tanpa membuang kuota: matikan sementara worker G-Labs di Dev atau pakai produk uji, lalu pastikan keterangan "Foto studio gagal dibuat" muncul (S5). Kalau tidak memungkinkan, cukup tes unit + jelaskan di laporan.

---

## 3. Tahap 2 — Usulan penyempurnaan lain (JANGAN dikerjakan sebelum pengguna memilih)

> S3, S5, S6 sudah disetujui dan dipindah ke Tahap 1B. Sisa yang menunggu keputusan: S1, S2, S4, S7.

Daftar ini usulan Claude. Kerjakan hanya poin yang disetujui pengguna, di branch terpisah, dengan rencana Before/After + mockup bila menyentuh UI.

| # | Usulan | Manfaat | Ukuran |
|---|---|---|---|
| S1 | **Ringkasan sebelum kirim**: "12 produk baru, 5 sudah lengkap (dilewati), 3 akan diperbaiki — perkiraan 15 foto studio". Tombol kirim setelah ringkasan. | Tahu kuota yang terpakai sebelum terlanjur | Sedang (API mode `dry_run`) |
| S2 | **Pilihan "Buat foto studio otomatis"** per batch (bisa dimatikan; foto bersih tetap dibuat). Foto studio bisa dibuat belakangan per produk lewat tombol regenerate. | Hemat kuota G-Labs untuk batch besar | Kecil–sedang |
| S3 | **Samakan & perbaiki aturan "data rumpang"**: API dan worker memakai satu fungsi yang sama; foto dianggap lengkap bila `clean_photo_url`/`cleaned_photo_url` ada, tanpa mewajibkan `generated_photo_url`. | Centang "Perbaiki" aman dinyalakan lagi | Kecil |
| S4 | **Daftar hasil per URL** setelah batch selesai: berhasil / gagal + alasan (404, diblokir marketplace, foto gagal), dengan tombol "Ulangi yang gagal". Data `scrapeErrors` sudah ada di worker, hanya belum ditampilkan. | Tidak ada produk hilang diam-diam | Sedang |
| S5 | **Foto studio gagal/timeout dicatat** ke produk (`photo_error`), tidak hanya di log server. Saat ini scraper menunggu maks 2 menit lalu diam. | Konsisten dengan janji "gagal terlihat" | Kecil |
| S6 | **Batasi 1 job scraper berjalan sekaligus.** Saat ini antrean non-AI boleh 3 job paralel × 20 URL, artinya 3 browser Chromium + lonjakan G-Labs di Mac Mini. | Server lebih stabil, risiko diblokir marketplace turun | Kecil |
| S7 | **Validasi link di browser**: tandai link yang bukan Shopee/Tokopedia atau duplikat sebelum dikirim, tampilkan hitungan "23/50". | Mengurangi job gagal | Kecil |

Rekomendasi Claude bila ingin bertahap: **S3 + S5 + S6** dulu (kecil, menutup pemborosan & kegagalan diam-diam), lalu **S1 + S2** (kontrol kuota), lalu **S4 + S7**.

## 4. Kapan berhenti dan bertanya

- Setelah mengirim link mockup (wajib).
- Bila A/B belum masuk `main` tetapi diminta deploy ke Dev.
- Bila ada alasan teknis penguncian yang ditemukan di riwayat git/kode (mis. masalah server saat scraping massal). Laporkan dulu sebelum mengaktifkan.
- Bila ada file di luar daftar ini yang perlu diubah.
