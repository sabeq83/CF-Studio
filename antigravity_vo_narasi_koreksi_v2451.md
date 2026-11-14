# Instruksi Koreksi v2.45.1: Perbaikan Narasi VO

Tanggal: 14 Nov 2026 · Berlaku untuk: hasil rilis v2.45.0 (commit `5b42ad7`) · Acuan: `antigravity_vo_narasi_instructions.md`

## 0. Konteks dan aturan kerja (wajib dibaca)

- Server **staging adalah produksi harian**. v2.45.0 belum di-deploy ke staging dan **jangan di-deploy** sampai koreksi di bawah selesai dan disetujui.
- Pada tahap sebelumnya, tugasnya hanya membuat dokumen dan berhenti. Tetapi kode ditulis, dirilis, dan tag di-push tanpa persetujuan. Untuk tahap ini:
  1. Kerjakan koreksi K1–K5 di branch `fix/vo-v2451`, bukan langsung di `main`.
  2. Jalankan seluruh verifikasi di bagian 3.
  3. Kirim laporan, lalu **berhenti**. Jangan merge ke `main`, jangan rilis, jangan deploy, jangan ubah setting tenant atau preset di DB.
- Jangan ubah `gemini_model_primary` / `gemini_model_fallback`. V0-3 tetap menunggu keputusan user.

## 1. Hasil review v2.45.0 (yang sudah benar, jangan diubah)

- Prompt pilar, multiplier, dan mandat resep saat flag off identik dengan v2.44.22 (sudah dicek dengan 212 kombinasi input).
- Pemetaan audit multiplier V0-1, ambang validator V4, migrasi kolom (`ADD COLUMN IF NOT EXISTS`, default `'off'`), dan scoping tenant di API baru sudah sesuai.

## 2. Koreksi

### K1. Content Editor planner harus mati saat flag off (wajib)

**Lokasi:** `lib/content-planner-engine.js` ±971–1040 (blok "V1: Content Editor step", `CHUNK_SIZE = 6`).

**Masalah:** blok ini berjalan untuk semua planner tanpa memeriksa `vo_content_contract`. Akibatnya setiap pembuatan planner menambah satu panggilan Gemini per 6 baris, padahal hasilnya tidak dipakai prompt selama flag off.

**Perbaikan:**
- Jalankan blok hanya jika `vo_content_contract` efektif untuk planner/preset ini `=== 'on'`. Gunakan resolver yang sama dengan yang dipakai saat ingest (`lib/vo-contract-registry.js`), jangan membuat logika baru.
- Jika off: `contentPayloadBySeq` kosong dan `content_payload_json` disimpan `NULL` (kecuali row sudah membawa `content_payload` dari sumber lain).
- Filter klaim hook V0-2 (±949) **tetap berjalan tanpa flag**, sesuai instruksi awal.

**Test:** unit test dengan `callGeminiJson` di-mock:
- saat flag off, Content Editor tidak dipanggil sama sekali (0 panggilan);
- saat flag on, Content Editor dipanggil `ceil(rows/6)` kali.

### K2. Item yang diblokir klaim harus terlihat dan bisa dilanjutkan dari UI (wajib)

**Lokasi:**
- pilar `lib/scheduler-processors.js` ±6583 (`tts_status: 'paused_compliance'`, `review_state: 'vo_claim_blocked'`);
- pilar gate kualitas ±6226 (`review_state: 'vo_quality_blocked'`);
- multiplier `lib/re-multiplier-worker.js` ±1028;
- UI `app/pillar-campaigns/[id]/page.js` (fungsi status ±690–770 dan ±1811) dan `app/multiplier-lab/[id]/page.js`.

**Masalah:** nilai `paused_compliance`, `vo_claim_blocked`, dan `vo_quality_blocked` tidak dikenali UI, dan `review_reason` tidak ditampilkan. Data uji 70 naskah lama: 5 dari 9 naskah Dapur Botani akan diblokir (kolesterol, jantung, imun). Pemblokirannya benar, tetapi kampanye autopilot akan berhenti tanpa penjelasan.

**Perbaikan:**
1. Badge status khusus di kartu item pilar:
   - "🚫 Diblokir: klaim kesehatan" untuk `vo_claim_blocked` / `paused_compliance`;
   - "⚠️ VO di bawah standar" untuk `vo_quality_blocked`.

   Pakai token warna `var(--status-danger)` / `var(--status-warning)` yang sudah ada.
2. Tampilkan `review_reason` (kata yang kena) di kartu item dan di modal edit VO.
3. Jalur lanjut yang jelas:
   - Setelah user menyimpan VO yang sudah diedit (`app/api/v2/pillar-campaigns/items/[itemId]/voiceover/route.js`), reset `tts_status` ke `pending` **dan** kosongkan `review_state` / `review_reason` blokir. Cek: route ini sudah me-reset `tts_status`, tambahkan pembersihan `review_state`.
   - Multiplier: tampilkan `error_message` blokir di halaman task. Approve tanpa edit tetap boleh diblokir ulang, tetapi pesannya harus terlihat.
4. Hitung item yang diblokir di ringkasan kampanye (angka "diblokir klaim" di samping hitungan gagal), supaya terlihat dari daftar kampanye.

**Test:**
- render/unit test fungsi status untuk ketiga `review_state`;
- test bahwa simpan VO membersihkan `review_state` blokir.

### K3. Deteksi mode narasi saat flag off harus sama dengan versi lama (wajib)

**Lokasi:** `lib/pillar-campaign-ingest.js` ±28–50 (`autoDetectNarrativeMode`).

**Masalah:** string `text` sekarang juga memuat `row.context` dan `row.content_subject` di kedua cabang. Saat flag off, lebih banyak baris berpindah ke "Educational Review" dibanding v2.44.22.

**Perbaikan:** saat `voContentContract !== 'on'`, `text` hanya memakai `pillar`, `category_cep`, `vfo`, dan `strategic_angle` (persis seperti versi lama). `context` dan `content_subject` hanya dipakai di cabang flag on.

**Test:** tabel minimal 10 baris planner nyata (ambil dari DB secara baca-saja). Hasil `autoDetectNarrativeMode(row)` versi lama harus sama dengan `autoDetectNarrativeMode(row, {voContentContract:'off'})` versi baru. Versi lama bisa diambil dari `git show 7e4d5b4:lib/pillar-campaign-ingest.js`.

### K4. Deteksi niche herbal/kesehatan memakai penanda yang sudah ada (wajib)

**Lokasi:** `lib/tiktok-compliance-service.js` ±301 (`resolveIsHerbalOrHealthTarget`). Resolver lama `resolveIsHerbalProduct` ada di ±323.

**Masalah:**
- Regex memakai `\b...\b`, sehingga nama brand gabungan seperti `siasatsehat` tidak terdeteksi. Di data uji, Siasat Sehat hanya terdeteksi di 2 dari 14 naskah.
- Fungsi ini juga menduplikasi daftar dari `resolveIsHerbalProduct`, padahal instruksi awal meminta memakai penanda yang sudah ada.

**Perbaikan:**
1. Satukan daftar token herbal/kesehatan ke satu konstanta yang dipakai `resolveIsHerbalProduct` dan `resolveIsHerbalOrHealthTarget`. Jangan menduplikasi.
2. Cocokkan token tanpa `\b` (substring, case-insensitive), sama seperti `resolveIsHerbalProduct`.
3. Tambahkan sumber penanda niche yang sudah ada di data brand/preset, misalnya `knowledge_domain` atau niche brand profile, jika field tersebut ada. Jangan menambah kolom baru.
4. Di laporan, sertakan tabel 7 brand (Siasat Sehat, Dapur Botani, Habitfolk, Sasyahouse, NutriBlend, Ruang Akustik, Solusi Thermal) dengan hasil deteksi masing-masing. **Jangan putuskan sendiri** apakah NutriBlend masuk niche kesehatan; tandai sebagai pertanyaan untuk user.

**Test:** unit test untuk `siasatsehat`, `Siasat Sehat`, `Dapur Botani` + rempah, dan produk alat dapur (harus false). Ditambah test bahwa kata "lemak" pada brand non-herbal tidak memblokir.

### K5. Perbaiki dokumen plan

**Lokasi:** `vo_narasi_implementation_plan.md` baris 12.

- Ganti status dokumen agar sesuai kenyataan: "Diimplementasi di v2.45.0, belum di-deploy; koreksi v2.45.1 berjalan".
- Tambahkan bagian "Koreksi v2.45.1" dengan tracker K1–K5.
- Catat juga bahwa overlay finishing multiplier sekarang membaca `finishing_plan` walaupun flag off (`resolvePreRenderFinishingMeta` fallback `bridging.finishing_plan`). Sebutkan apakah ini disengaja. Jika tidak, batasi ke flag on.

## 3. Verifikasi wajib sebelum lapor

1. **Pembanding prompt flag off terhadap v2.44.22:** `plans/vo-narasi-reference/compare-flag-off.mjs` (cara pakai ada di kepala file). Hasil wajib `pillar 0 / 192`, `multiplier 0 / 16`, `recipe 0 / 4`. Snapshot test lama hanya membandingkan kode baru dengan dirinya sendiri, jadi tidak cukup.
2. Semua test `tests/vo-*.test.mjs` plus test baru K1–K4, dijalankan dengan `DISABLE_AUTO_MIGRATIONS=true node --test --test-concurrency=1 ...`.
3. `npm run test:operator-presets` dan `DISABLE_AUTO_MIGRATIONS=true npm run build`.
4. Jangan menjalankan harness atau script apa pun yang menulis ke DB staging atau ke folder release.

## 4. Format laporan

- Daftar file yang diubah per K1–K5, dengan potongan kode sebelum/sesudah yang ringkas.
- Output perintah verifikasi (angka lulus/gagal, termasuk output pembanding).
- Tabel deteksi niche 7 brand (K4) dan pertanyaan tentang NutriBlend.
- Nama branch dan hash commit. **Belum di-merge, belum dirilis, belum di-deploy.**
