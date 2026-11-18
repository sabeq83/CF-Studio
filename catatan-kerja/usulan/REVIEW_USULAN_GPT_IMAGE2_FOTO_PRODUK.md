# Review & Penyempurnaan: Usulan GPT Image 2 untuk Foto Produk

Tanggal: 18 November 2026
Yang direview: `implementation_plan.md` (usulan Codex, "GPT Image 2 Khusus Foto Studio Produk")
Reviewer: Claude (cek langsung ke kode + dokumentasi G-Labs bagian 5.5)
Status: usulan saja; belum ada kode yang diubah.

---

## Kesimpulan singkat

Arah usulan Codex **sudah benar dan aman**: GPT hanya untuk foto produk, video tetap Nano Banana, tidak ada pindah model diam-diam, tidak perlu ubah database, dan lewat jalur Dev dulu. Temuan Codex tentang kode juga **terbukti benar** (lihat bagian A).

Tapi ada **7 lubang** yang perlu ditambal sebelum dikerjakan. Tiga di antaranya bisa membuat pengguna bingung ("sudah pilih GPT kok hasilnya masih Nano Banana?") atau membuat hasil foto hilang tanpa kabar.

---

## A. Klaim Codex yang sudah saya cek — BENAR

| Klaim Codex | Hasil cek |
|---|---|
| Setting `product_photo_glabs_model` dibaca di API tapi **tidak pernah disimpan** | Benar. `app/api/settings/route.js:230-231` hanya menyimpan provider & model Gemini. |
| Provider G-Labs selalu memakai endpoint Nano Banana | Benar. `lib/product-photo-providers/glabs.js:11` selalu `generateImage`. |
| Model selain 3 Nano Banana otomatis diubah jadi Nano Banana 2 | Benar. `lib/webhook-client.js:298-305`. Jadi GPT memang wajib lewat jalur sendiri. |
| Scraper mengunci Nano Banana Pro rasio 9:16 | Benar. `lib/scheduler-processors.js:9487-9492`. |
| Polling bulk hanya mengambil `photo_provider = 'glabs'` | Benar. `lib/product-bulk-worker.js:316-324`. Keputusan Codex agar provider tetap `glabs` sudah tepat. |
| Endpoint GPT: `POST /api/openai/generate`, 1 gambar/request, tanpa field model | Benar sesuai dokumen G-Labs 5.5. Nilai `quality: high`, `prompt_mode: direct`, `reasoning: none`, `web_search: false` semuanya valid. |

---

## B. Lubang yang perlu ditambal (urut dari paling penting)

### B1. Pilihan GPT bisa diabaikan oleh "ingatan" per produk — PENTING
**Masalahnya:** Sistem mengingat provider terakhir **per produk** (`lib/product-photo-service.js:35`: kalau produk punya `photo_provider`, itu yang dipakai, bukan setting tenant). Tombol "Generate ulang" juga bisa menulis provider ke produk (`app/api/v2/products/regenerate-photos/route.js`).
Akibatnya: produk yang dulu dibuat lewat **Gemini** akan **tetap ke Gemini** walau Settings sudah diganti ke GPT. Pengguna mengira GPT jalan, padahal tidak.

**Usulan:** Tambahkan ke rencana:
- Aturan jelas: provider per produk hanya dipakai bila pengguna **sengaja memilihnya** saat generate ulang; kalau tidak, ikut Settings tenant.
- Di kartu produk / log, tampilkan **model yang benar-benar dipakai** (lihat B4), supaya kelihatan kalau ada yang "nyasar".

### B2. Scraper: GPT lebih lambat, hasil bisa hilang diam-diam — PENTING
**Masalahnya:** Scraper menunggu hasil maksimal **40 × 3 detik = 2 menit** (`scheduler-processors.js:9496`), lalu menyerah **tanpa mencatat apa pun**; task-nya tidak disimpan, jadi hasil yang selesai belakangan terbuang. Kegagalan juga hanya ditulis di log server (`console.warn`). Dokumen G-Labs menyebut gambar butuh "beberapa detik sampai beberapa menit", dan GPT kualitas *high* biasanya di ujung atas.
Ini **bertentangan** dengan janji rencana "kegagalan terlihat dan dapat diulang".

**Usulan (pilih salah satu, saya sarankan opsi 1):**
1. **Tahap 1: GPT hanya untuk bulk & generate ulang**; scraper tetap Nano Banana seperti sekarang. Lebih sederhana, risiko kecil. Scraper menyusul di tahap 2.
2. Kalau scraper tetap ikut: perpanjang tunggu untuk GPT (mis. 5 menit) **dan** catat kegagalan/timeout ke produk (`photo_error`) supaya muncul di UI.

### B3. Rasio 1:1 di scraper mengubah foto utama produk
**Masalahnya:** Di scraper, hasil "studio" menjadi foto utama (`photo_url = generatedPhotoPath || ...`, baris ±9552) yang selama ini **9:16**. Codex memaksa GPT ke **1:1**, padahal dokumen G-Labs menyatakan GPT **mendukung 9:16**. Jadi pemaksaan 1:1 di scraper tidak perlu dan mengubah bentuk foto yang sudah biasa dipakai.

**Usulan:** GPT mengikuti rasio jalurnya: bulk/generate ulang **1:1**, scraper **9:16** (kalau scraper ikut, lihat B2).

### B4. Tidak ada catatan "foto ini dibuat model apa"
**Masalahnya:** Database hanya menyimpan `photo_provider = 'glabs'`. Setelah GPT dipakai, tidak bisa dibedakan foto mana hasil GPT dan mana Nano Banana. Padahal pengguna perlu membandingkan kualitas, dan jendela banding foto (v2.52.0) baru saja dibuat.

**Usulan (tanpa migrasi):** Simpan nama model di kolom JSON yang sudah ada (mis. `raw_response` / metadata foto) atau minimal di log bulk: `model=gpt_image_2`. Tampilkan sebagai label kecil di jendela banding: "Foto baru: GPT Image 2 · Foto lama: Nano Banana Pro". Codex perlu cek dulu kolom JSON mana yang aman dipakai.

### B5. Bulk 50 produk sekaligus bisa menghabiskan kuota akun ChatGPT
**Masalahnya:** Generate ulang mengizinkan **50 produk per request**. Dokumen G-Labs: kapasitas = jumlah akun ChatGPT aktif × 5 pekerjaan. Dengan 1 akun, 45 request sisanya bisa ditolak/menumpuk, dan akun ChatGPT berisiko kena limit.

**Usulan:**
- Kirim GPT **bertahap** (mis. maksimal 3–5 berjalan bersamaan per tenant), memakai jeda aman yang sudah ada (`applyRandomDelay('image')`).
- Di UI, saat GPT dipilih, tampilkan catatan: "GPT Image 2 memakai akun ChatGPT di G-Labs; proses banyak produk akan berjalan bertahap."

### B6. Produk tanpa foto mentah lokal akan selalu gagal di GPT
**Masalahnya:** Generate ulang menerima produk yang hanya punya `scraped_image_url` (link luar), tapi worker hanya membaca foto lokal `/uploads/...`. Untuk Nano Banana, ini diam-diam jadi "gambar dari teks saja" (ini sebenarnya bug lama). Untuk GPT, rencana sudah benar memilih "gagal jelas" — tapi pengguna akan melihat banyak produk gagal tanpa tahu sebabnya.

**Usulan:** Pesan gagal yang jelas: "Foto mentah belum tersimpan di server — upload foto mentah dulu." Opsional: unduh `scraped_image_url` sebagai referensi sebelum kirim ke GPT.

### B7. Unduh hasil bisa salah alamat bila worker G-Labs lebih dari satu
**Masalahnya:** `pollGlabsPhotoTask` memanggil `getFileUrl(imageFile)` **tanpa** `taskId` (`glabs.js:35`), jadi unduhan selalu ke worker default, bukan worker yang mengerjakan. Fungsi cadangan pencarian berdasarkan nama file memakai `require()` di file ESM, yang kemungkinan besar diam-diam gagal. Scraper sudah benar (mengirim `task_id`).

**Usulan:** Perbaiki jadi `getFileUrl(imageFile, taskId)` — satu baris, berlaku untuk GPT dan Nano Banana. Sekalian: pola file `/\.(png|jpg|webp)$/` tambahkan `jpeg`, dan pesan gagal ambil dari `error` G-Labs, bukan teks umum "G-Labs task gagal".

---

## C. Hal kecil / penyederhanaan

1. **Dropdown "Ikuti model gambar umum"**: model umum itu sebenarnya untuk start frame video. Saran label: "Sama dengan model start frame (Nano Banana)" agar tidak membingungkan.
2. **Provider Gemini aktif**: Codex mengusulkan provider otomatis diubah ke G-Labs saat GPT dipilih. Setuju, tapi tampilkan **konfirmasi** ("Provider foto akan diganti dari Gemini ke G-Labs") — jangan diganti diam-diam.
3. **Prompt GPT**: rencana menggabungkan pengunci identitas + prompt hasil AI. Setuju. Tambahan: karena `prompt_mode: direct` (prompt dipakai apa adanya), **jangan** lewatkan prompt ke `sanitizeImagePrompt` milik Flow. Codex sudah menyebut ini — pertahankan.
4. **Foto GPT dipakai lagi untuk video**: foto clean jadi bahan referensi start frame video (`product-reference-resolver.js`, `custom-storyboard-pipeline.js`). Jadi uji live di Dev sebaiknya juga **membuat 1 start frame** dari foto GPT, untuk memastikan hasilnya cocok dipakai Nano Banana (resolusi GPT ~1,57 MP, tanpa upscale).
5. **Test default**: `getTaskStatus` di mode test selalu mengembalikan `succeeded`, padahal kode memeriksa `completed`. Tes baru harus memakai mock fetch sendiri (Codex sudah menyebut mock fetch — bagus), jangan bergantung pada jalur test bawaan itu.

---

## D. Usulan urutan tahap (lebih ramping)

**Tahap 1 (rilis pertama):**
- Settings: simpan & validasi pilihan model foto produk (+ perbaikan B1 aturan per-produk).
- GPT untuk **bulk & generate ulang** saja, 1:1, kirim bertahap (B5), pesan gagal jelas (B6), catat model (B4), perbaikan unduh (B7).
- Scraper **tidak diubah**.

**Tahap 2 (setelah Tahap 1 terbukti di Dev/Staging):**
- Scraper ikut memakai pilihan model, rasio 9:16, tunggu lebih lama + catat gagal (B2, B3).

Alasan: Tahap 1 sudah menjawab kebutuhan utama (foto studio produk pakai GPT), dengan perubahan file paling sedikit, dan semua jalur yang tersentuh sudah punya mekanisme simpan-gagal-ulang yang rapi.

---

## D2. Revisi arah (keputusan pengguna, 18 Nov 2026) — MENGGANTIKAN bagian D

**1. Foto scraper dibuat square (1:1).**
Bisa. Cukup ubah `aspect_ratio: '9:16'` menjadi `'1:1'` di `lib/scheduler-processors.js:9490` (scraper tetap Nano Banana Pro). Foto bulk & generate ulang sudah 1:1, jadi semua foto produk jadi seragam. Video aman: start frame tetap 9:16 dan foto produk hanya dipakai sebagai referensi. Hanya berlaku untuk produk yang di-scrape setelah perubahan; foto lama tidak diubah. Dikerjakan sebagai perubahan terpisah (branch sendiri), bukan bagian fitur GPT.

**2. GPT hanya lewat tombol manual di kartu produk.**
Bisa, dan lebih hemat kuota & lebih sederhana dari rencana Codex.
- Kartu produk sudah punya tombol generate ulang (`handleRegeneratePhoto`, `app/products/page.js:670`). Tambahkan pilihan kedua: **"Generate ulang dengan GPT"**. Tombol lama tetap Nano Banana.
- Tombol massal (pilih banyak produk) **tidak** mendapat opsi GPT. API menolak GPT bila `ids` lebih dari 1.
- **Tidak perlu** dropdown model di Settings, dan scraper/bulk otomatis tidak disentuh. Poin B1, B2, B3, B5 gugur.
- Pilihan "GPT" harus terbawa dari tombol ke worker. Opsi yang disarankan: kolom kecil baru `photo_model` di `product_extractions` (migrasi hanya-menambah, aman; wajib diberitahukan sebelum naik Staging sesuai SOP). Kolom ini sekaligus menjawab B4 (label model di jendela banding). Alternatif tanpa migrasi: simpan di kolom JSON yang sudah ada — Codex perlu cek dulu mana yang aman.
- Setelah selesai, kolom kembali dianggap kosong, sehingga generate ulang berikutnya kembali ke Nano Banana kecuali tombol GPT diklik lagi.
- Tetap berlaku: B4 (label model), B6 (gagal jelas jika foto mentah tidak ada di server), B7 (perbaikan unduh), tanpa pindah ke Nano Banana bila GPT gagal, dan foto lama tetap aman lewat jendela banding/revert v2.52.0.

## E. Tambahan untuk Execution Task List Codex

- [ ] Ubah aturan `resolveProductPhotoProvider`: provider per produk hanya bila dipilih eksplisit (B1).
- [ ] Simpan & tampilkan model efektif di foto/jendela banding (B4).
- [ ] Batasi GPT berjalan bersamaan + jeda aman (B5).
- [ ] Pesan gagal jelas untuk produk tanpa foto mentah lokal (B6).
- [ ] `getFileUrl(file, taskId)` + pola `jpeg` + pesan error asli G-Labs (B7).
- [ ] Putuskan scraper: Tahap 2 (disarankan) atau sekarang dengan rasio 9:16 + timeout 5 menit + catat gagal (B2, B3).
- [ ] Uji live Dev: 1 produk GPT → cek foto → buat 1 start frame dari foto itu.
