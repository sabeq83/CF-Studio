# Usulan: Perbaikan Kartu Produk — Tombol Enrich, Tampilan Foto G-Labs, dan Truth Berbahasa Inggris

Tanggal: 17 November 2026 · Versi aplikasi saat dicek: v2.51.0 (staging) · Menu: Product Database (`/products`)

Status: **usulan, belum dikerjakan**. Kode belum diubah.

---

## Masalah 1 — Tombol "AI Enrichment" hilang dari kartu produk

**Penyebab (sudah dicek di kode):**
- Tombol per kartu "🧠 Re-Enrich AI" terhapus saat redesain kartu sederhana pada **v2.35.15 (8 Nov 2026, commit `700d077`)**.
- Fungsinya masih ada di `app/products/page.js` (`handleReEnrichProduct`, ~baris 555), tetapi tidak dipanggil tombol mana pun.
- Yang tersisa hanya tombol massal "🧠 Re-Enrich AI" di bilah atas, dan tombol itu baru muncul setelah produk dicentang.
- Tombol di kartu sekarang hanya: ✅ Setujui · 🔄 Ganti Foto · Edit.

**Usulan:**
- Kembalikan tombol **"🧠 Enrich AI"** di baris tombol kartu, di samping Ganti Foto dan Edit.
- Tombol memanggil `handleReEnrichProduct(p.id)` yang sudah ada.
- Selama enrichment berjalan (`pending`/`processing`), tombol berubah menjadi "Enriching…" dan tidak bisa diklik.
- Bila enrichment gagal karena model sibuk (`enrichment_retryable = true`), label tombol menjadi **"Coba lagi"**.

---

## Masalah 2 — Foto hasil G-Labs tidak terlihat sebelum disetujui

**Penyebab (sudah dicek di kode dan data staging, contoh: Cuculemon Tumbler):**
1. Hasil G-Labs disimpan ke kolom foto clean (`clean_photo_url`) dengan status `needs_review`. Penanda foto aktif (`active_photo`) tetap **`raw_photo_url`**.
2. Thumbnail kartu mengikuti penanda itu, sehingga yang tampil **foto mentah**, bukan hasil G-Labs (`app/products/page.js` ~1353).
3. Kartu tidak punya tombol untuk berpindah ke "Hasil AI".
4. Modal Edit/Detail produk sama sekali tidak menampilkan foto yang tersimpan. Isinya hanya kolom unggah foto mentah baru.
5. Hasil G-Labs hanya bisa dilihat di jendela "✅ Setujui" (180px). Pengguna tidak tahu jendela itu berisi foto hasil.
6. Tambahan: hasil G-Labs **menimpa** foto clean sebelumnya (hasil hapus-latar). Jika hasil G-Labs jelek, tidak ada jalan kembali ke foto sebelumnya.

**Usulan (sederhana):**
- **Kartu:**
  - Thumbnail menampilkan **hasil terbaru** (foto clean/G-Labs) bila ada, termasuk saat masih `needs_review`.
  - Tambahkan label kecil di thumbnail: "Perlu ditinjau" (kuning) atau "Disetujui" (hijau).
  - Tambahkan sakelar kecil **Asli | Hasil AI** di bawah thumbnail.
  - Klik thumbnail membuka **jendela banding**.
- **Jendela banding** (dipakai juga oleh tombol ✅ Setujui):
  - Foto **Asli** dan **Hasil AI** berdampingan dalam ukuran besar.
  - Keterangan sumber: G-Labs atau Gemini, beserta tanggal.
  - Tiga tombol:
    - **Setujui**
    - **Ganti Foto** (alur yang sudah ada)
    - **Ulangi Generate**, yang memanggil `regenerate-photos` untuk produk ini
- **Modal Edit produk:** di tab foto, tampilkan foto Asli dan Hasil AI yang tersimpan (hanya tampilan, bisa diperbesar).
- **Opsional (perlu kolom baru, butuh izin karena mengubah database):**
  - Sebelum hasil G-Labs menimpa, simpan foto clean lama ke `previous_clean_photo_url`.
  - Tambahkan tombol **"Tolak, pakai foto sebelumnya"**.
  - Jika tidak dipilih, pengguna tetap bisa memakai Ganti Foto atau Ulangi Generate.

Sesuai SOP: buat **mockup** `public/mockup_kartu_produk_foto_enrich.html` dulu, kirim linknya ke pengguna, lalu baru pasang di aplikasi setelah disetujui.

---

## Masalah 3 — Product Truth & Geometric Truth masih berbahasa Indonesia

**Penyebab (sudah dicek):**
- Enrichment produk sekarang memakai prompt di `lib/product-bulk-worker.js` (`buildEnrichmentPrompt`, ~baris 214):
  - Prompt itu berbahasa Indonesia.
  - Mendefinisikan `product_truth` sebagai "fakta nyata produk dari perspektif konsumen".
  - **Tidak** mewajibkan Bahasa Inggris untuk kedua Truth. Aturan "Bahasa Inggris" hanya berlaku untuk prompt foto.
- Sebenarnya sudah ada prompt yang benar di `lib/prompts.js` → `buildBatchProductTruthsPrompt` (~baris 4772):
  - Mewajibkan Bahasa Inggris.
  - Mendefinisikan Truth sebagai **kunci visual untuk T2I/I2V**: warna, logo, tutup, bentuk 3D, material.
  - Tetapi **prompt ini tidak dipakai di mana pun**.
- Data staging terbaru (Cuculemon, Texania, Habarlic, Laxing, Club Sehat, Trivico): semua Truth berbahasa Indonesia.
- Truth disuntikkan ke kontrak prompt video yang berbahasa Inggris (`buildProductTruthContractSection` di `lib/prompts.js`). Hasilnya, prompt T2I bercampur dua bahasa.

**Usulan:**
1. Ubah `buildEnrichmentPrompt` agar:
   - `product_truth` dan `geometric_truth` **wajib Bahasa Inggris**.
   - Definisinya mengikuti `buildBatchProductTruthsPrompt`:
     - Product Truth = tampilan luar kemasan (warna dominan, letak logo, teks utama, jenis tutup), 3–4 kalimat.
     - Geometric Truth = bentuk 3D dan material, 2–3 kalimat.
   - Aturan wajib patuh `packaging_type` tetap berlaku.
   - USP dan kategori tetap Bahasa Indonesia, karena dipakai naskah VO.
2. Tambahkan penjaga sederhana: jika hasil Truth terdeteksi berbahasa Indonesia (kata umum seperti "dan", "yang", "dengan", "berbentuk", "kemasan"), ulangi sekali dengan perintah terjemah ke Inggris.
3. Di modal Edit, beri keterangan kecil di kolom Truth: *"Ditulis dalam Bahasa Inggris — dipakai langsung untuk prompt gambar/video."*
4. **Data lama:** buat skrip `scripts/translate-product-truths.mjs`.
   - Hanya menerjemahkan dua kolom Truth yang terdeteksi Indonesia. USP dan foto tidak disentuh.
   - Jalankan dry-run dulu per tenant: tampilkan tabel sebelum → sesudah.
   - `--apply` hanya setelah pengguna setuju.
   - Alasan tidak memakai Re-Enrich massal: Re-Enrich juga menimpa USP, kategori, dan prompt foto yang mungkin sudah diedit manual.

---

## Pembagian kerja (usulan)

| Branch | Isi | Catatan |
|---|---|---|
| `hotfix/truth-bahasa-inggris` | Masalah 3 (prompt + penjaga + skrip dry-run) | Tanpa UI, bisa langsung. Data lama diterjemahkan setelah izin. |
| `hotfix/kartu-produk-foto-enrich` | Masalah 1 + 2 (UI kartu, jendela banding, modal Edit) | Mockup dulu, lalu uji di Dev. |

Larangan umum:
- Jangan mengubah data staging tanpa izin.
- Jangan menghapus foto atau produk.
- Gunakan hanya token CSS semantik.
- Kolom database baru (opsi `previous_clean_photo_url`) hanya boleh ditambahkan setelah pengguna setuju.
