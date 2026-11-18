# INSTRUKSI ANTIGRAVITY — Sinkronkan `main` ke `fitur/scraper-foto-galeri-r02` & Selesaikan Bentrok

Tanggal: 18 November 2026 · Dari: Claude (reviewer/planner) · Untuk: Antigravity (eksekutor fitur scraper)
Dasar SOP: AGENTS.md → "SOP Alur Branch Dev vs Staging", Alur 2 Hotfix langkah 4 (*hotfix wajib dibawa ke branch fitur yang masih aktif*).

---

## 1. Latar Belakang

- `main` sudah maju **36 commit** sejak branch `fitur/scraper-foto-galeri-r02` dibuat dari `v2.50.4` (`b73ebd2`). Di dalamnya ada:
  - v2.52.0 kartu produk & jendela banding,
  - v2.53.0 scraper square + tombol GPT Image 2,
  - v2.54.0 Batch Scraper,
  - **v2.54.1 hotfix start frame** (`bec6b73`, sudah di Staging).
- Hotfix v2.54.1 wajib ikut ke branch fitur ini supaya bug start frame tidak muncul lagi saat fitur nanti digabung.
- Uji coba `git merge-tree` menunjukkan **3 file bentrok**:

| File | Jenis bentrok |
|---|---|
| `app/api/v2/products/[id]/route.js` | **kode**: dua implementasi untuk fungsi yang sama |
| `implementation_plan.md` | dokumen: dua rencana aktif |
| `catatan-kerja/_DAFTAR_ISI.md` | dokumen: baris tambahan di dua sisi |

- Tergabung otomatis tanpa bentrok, tetapi **wajib ditinjau**: `lib/scheduler-processors.js`, `lib/product-bulk-worker.js`. Kedua file ini juga diubah besar oleh Batch Scraper (v2.54.0) dan hotfix start frame (v2.54.1).

---

## 2. Langkah Kerja

```bash
git checkout fitur/scraper-foto-galeri-r02
git pull
git merge main          # akan berhenti dengan 3 konflik
```

### 2.1 `app/api/v2/products/[id]/route.js` (keputusan: **pakai versi `main` sebagai dasar**)

Isi kedua sisi:
- **`main`** (`09b2e06`, `a810fc6`):
  - `import { isRetryableGeminiError } from '@/lib/gemini';`
  - `previous_clean_photo_url` ditambahkan ke `urlKeys`;
  - path yang sudah diawali `/api/` tidak dibungkus ulang;
  - `product.enrichment_retryable = isRetryableGeminiError(product.enrichment_error);`
- **fitur** (`8e2effc`, S9): menghitung `enrichment_retryable` sendiri dengan pencocokan teks (`quota`, `rate limit`, `resource_exhausted`, `429`, `503`), hanya bila `enrichment_status === 'failed'`, dan menambah `enrichment_retry_hint`.

Penyelesaian yang diminta:
1. Pertahankan seluruh perubahan `main` (import, `urlKeys`, cek `/api/`).
2. **Jangan** memakai pencocokan teks buatan sendiri. Pendeteksi error yang bisa diulang harus satu sumber, yaitu `isRetryableGeminiError` (aturan pusat model Gemini).
3. Ambil dari fitur hanya dua hal yang belum ada di `main`: syarat `enrichment_status === 'failed'` dan `enrichment_retry_hint`.

Hasil akhir yang diharapkan (bagian GET):
```js
    const urlKeys = ['photo_url', 'raw_photo_url', 'clean_photo_url', 'cleaned_photo_url', 'generated_photo_url', 'previous_clean_photo_url'];
    for (const key of urlKeys) {
      if (product[key] && !product[key].startsWith('http') && !product[key].startsWith('/api/')) {
        product[key] = `/api/v2/products/image?path=${encodeURIComponent(product[key])}`;
      }
    }
    // S9: retryable hanya untuk enrichment yang gagal karena kuota/rate limit/503 (aturan pusat isRetryableGeminiError)
    product.enrichment_retryable = product.enrichment_status === 'failed' && isRetryableGeminiError(product.enrichment_error);
    product.enrichment_retry_hint = product.enrichment_retryable ? 'Jalankan cf_enrich_product untuk mengulang' : null;
    return NextResponse.json({ success: true, data: product });
```
4. Sesuaikan `tests/product-enrichment-retryable.test.js` (milik fitur) agar menguji hasil di atas. Kasus `429`/`quota`/`503` harus tetap `true` lewat `isRetryableGeminiError`. Sudah dicek: `isRetryableGeminiError` (`lib/gemini.js:1560`) mengenali `429`, `503`, `rate limit`, `resource_exhausted`, `quota exceeded`, dan `quota_exhausted`. Satu-satunya pola S9 yang belum dikenali adalah kata **`quota` saja**. Bila tes S9 membutuhkannya, tambahkan di `isRetryableGeminiError`, bukan di route.

> ⚠️ Perhatian perubahan perilaku: di `main` saat ini `enrichment_retryable` bisa `true` walau status bukan `failed`. Dengan penyelesaian di atas, nilainya hanya `true` untuk status `failed`. Cek pemakai field ini di UI (`app/products/page.js`, kartu produk B1–B6) dan MCP (`apps/mcp`) supaya tombol "ulangi enrich" tetap muncul di kondisi yang benar.

### 2.2 `implementation_plan.md` (keputusan: **dua rencana aktif dipisah**)
- Versi `main` berisi rencana CFA + hotfix start frame. Bagian A masih punya tugas terbuka (pantauan malam pertama), jadi rencana ini **tetap di root**.
- Rencana scraper revisi 02 milik fitur dipindah ke `catatan-kerja/rencana/scraper_foto_galeri_r02_implementation_plan.md`, dengan catatan status **"AKTIF — fitur/scraper-foto-galeri-r02"** di baris paling atas. Checklist eksekusinya tetap diperbarui di file itu.
- Ambil versi `main` untuk `implementation_plan.md`: `git checkout --theirs implementation_plan.md`. Saat `git merge main`, "theirs" adalah `main`.

### 2.3 `catatan-kerja/_DAFTAR_ISI.md` (keputusan: **gabungkan keduanya**)
- Pertahankan semua baris dari kedua sisi; jangan ada yang hilang.
- Tambahkan baris untuk file rencana yang dipindah pada langkah 2.2, di bagian `## RENCANA`.

### 2.4 Tinjau hasil gabung otomatis (wajib, walau tanpa konflik)
- `lib/scheduler-processors.js`: pastikan perubahan fitur (11 baris di alur scraper) tetap berjalan bersama:
  - Batch Scraper v2.54.0 (`88b700a`: S3/S5/S6, maks 1 job scraper);
  - generative polish `nano_banana_2` 1:1 (`cfa7609`);
  - blok hotfix start frame v2.54.1 (antre ulang klip kosong di `processPillarGenerator`). Bagian ini **jangan diubah**.
- `lib/product-bulk-worker.js`: pastikan perubahan fitur tidak bertabrakan dengan pengaman Batch Scraper (batas 50 URL/CSV, 1 job aktif).
- Catatan penamaan: Batch Scraper memakai kode S3/S5/S6, revisi 02 memakai S5–S9. Ini dua seri berbeda. Pastikan tidak ada fungsi yang tanpa sengaja tertimpa karena nama/kode sama, terutama "kegagalan foto studio tercatat (S5)" milik Batch Scraper.

### 2.5 Verifikasi
```bash
node --test tests/product-photo-picker.test.js tests/product-photo-rubric.test.js \
  tests/product-photo-crop-rembg.test.js tests/product-enrichment-retryable.test.js \
  tests/product-batch-scraper.test.js
node --env-file=.env.local --test tests/start-frame-hotfix-20261118.test.js
DISABLE_AUTO_MIGRATIONS=true npm run build
```
Semua harus lulus. Bila ada tes lama yang gagal karena perubahan `main`, perbaiki tesnya **hanya** bila perilaku baru memang disengaja (lihat changelog v2.52.0–v2.54.1). Jangan mengubah kode `main` untuk membuat tes fitur lulus.

### 2.6 Commit, push, deploy Dev
```bash
git add -A && git commit    # pesan: "merge: sinkron main (v2.54.1) ke fitur/scraper-foto-galeri-r02 + selesaikan konflik"
git push
npm run deploy:dev:atomic -- --ref <full-sha-branch-fitur> --apply --confirm-dev
```
Catatan: Dev saat ini menjalankan rilis hotfix (`c338af5`). Deploy branch fitur akan menggantinya; ini aman karena hotfix sudah ikut di dalam merge.

---

## 3. Larangan
- **DILARANG** `npm run release` di branch fitur, dan **DILARANG** deploy branch fitur ke Staging.
- **DILARANG** mengubah file hotfix start frame (`lib/pillar-start-frame-service.js`, `lib/start-frame-worker.js`, `lib/glabs-image-lane-service.js`, `lib/campaign-scheduler.js`, `app/api/v2/pillar-campaigns/**`) kecuali bentrok memaksa. Bila terpaksa, laporkan dulu ke pengguna.
- Jangan memakai `git merge -X ours/theirs` untuk seluruh merge; selesaikan per file seperti di atas.
- Jangan menghapus branch fitur; branch masih aktif.

## 4. Laporan ke Pengguna (setelah selesai)
Kirim ringkasan singkat berbahasa sederhana:
1. Konflik apa saja yang diselesaikan dan keputusan per file.
2. Hasil tes dan build.
3. SHA yang dideploy ke Dev + daftar uji singkat fitur galeri/rubrik/clean review di `http://100.95.245.55:5020`.
4. Hal yang perlu keputusan pengguna (mis. perubahan perilaku `enrichment_retryable` di 2.1).
