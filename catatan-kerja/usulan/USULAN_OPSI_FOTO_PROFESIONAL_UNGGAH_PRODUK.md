# USULAN — Opsi Foto Profesional Siap Pakai pada Modal Ganti Foto Produk (Database Produk)

**Tanggal Usulan**: 20 November 2026  
**Status**: Usulan & Mockup Siap Direview Pengguna  
**Target Menu**: Database Produk (`/products`)  
**Mockup Live Staging**: [http://100.95.245.55:5010/mockup_ganti_foto_unggah_profesional.html](http://100.95.245.55:5010/mockup_ganti_foto_unggah_profesional.html)  
**File Mockup Lokal**: `public/mockup_ganti_foto_unggah_profesional.html`  

---

## 1. Latar Belakang & Masalah

Pada menu **Database Produk** (`/products`), kurator sering kali perlu memperbarui atau mengganti foto produk melalui tombol **"Ganti Foto"** yang membuka modal **"🔄 Ganti Foto Produk"**.

Modal tersebut menyediakan 3 pilihan tab:
1. **1. Foto Scraper (Asli)** — Memilih dari daftar foto hasil scraping marketplace.
2. **2. Unggah Sendiri** — Mengunggah file foto dari perangkat lokal komputer kurator.
3. **3. Generate AI Studio** — Meminta Gemini/G-Labs menghasilkan foto produk studio baru.

### Masalah pada Tab "2. Unggah Sendiri" Saat Ini:
Ketika kurator memilih tab **Unggah Sendiri** dan mengunggah foto, sistem saat ini **selalu** memasukkan foto tersebut ke antrean background worker (`job_type: 'product_photo_replace'`) melalui `POST /api/v2/products/[id]/photo-replace`.

Antrean tersebut (`processProductPhotoReplace` -> `processProductPhotoFromRaw` di `lib/scheduler-processors.js`) **secara sepihak dan tanpa syarat selalu mengeksekusi**:
1. **Background Removal Otomatis (`createCleanProductShot`)**: Menggunakan `@imgly/background-removal-node` untuk memotong dan menghapus latar belakang gambar.
2. **AI Vision Inspection (`checkPhotoPersonAndText`)**: Memanggil Gemini Vision untuk mengecek apakah ada teks atau manusia.
3. **Pemberian Flag `needs_review` atau Auto AI Polish**: Jika AI Vision mendeteksi teks (meskipun hanya label resmi kemasan), status foto diubah menjadi `needs_review` atau memicu regenerasi AI Studio (`recreateProductPhotoWithAI`) yang mengganti foto tersebut dengan hasil render AI.

### Dampak Buruk di Lapangan:
1. **Merusak Foto Profesional**: Banyak kurator/brand sudah memiliki foto produk hasil pemotretan fotografer profesional (misal: kemasan di atas alas marmer/kayu estetik, foto packshot berbayang halus/natural contact shadow, atau PNG transparan yang sudah dipotong presisi). Algoritma rembg `@imgly` sering kali memotong tepi botol, merusak refleksi kaca, dan menghapus bayangan alami fotografer.
2. **Membuang Waktu & Biaya API**: Status foto produk berubah menjadi `processing` dan membutuhkan waktu beberapa puluh detik untuk menyelesaikan job queue dan panggilan Gemini Vision, padahal foto dari kurator sudah 100% siap pakai.
3. **False Positive & Foto Terganti**: Foto profesional kurator bisa dicap `needs_review` atau diganti secara otomatis oleh AI Studio jika Gemini mendeteksi tulisan merk pada label kemasan.

---

## 2. Sasaran & Solusi yang Diusulkan

Menambahkan opsi checkbox/toggle interaktif pada Tab **"2. Unggah Sendiri"**:
> **`[✓] Foto ini sudah siap pakai / profesional (Gunakan langsung tanpa hapus latar & generate AI)`**

### Perilaku Saat Opsi Dicentang (Default: Dicentang):
1. **Penyimpanan Langsung (Synchronous)**: Foto langsung disimpan ke folder penyimpanan produk (`/uploads/products/clean/` dan arsip di `/uploads/products/raw/`).
2. **Update Database Instan**: Field `photo_url` dan `clean_photo_url` di tabel `product_extractions` langsung diperbarui dengan URL foto baru, `photo_status` diset langsung ke `'approved'`, `photo_provider` diset ke `'manual_upload'`, dan `photo_reviewed_at` dicatat ke waktu sekarang (`NOW()`).
3. **Zero Queue & Zero AI Cost**: Tidak ada pembuatan job di background scheduler, tidak ada komputasi rembg, dan tidak ada token Gemini Vision yang terpakai.
4. **Respon Cepat ke UI**: Modal langsung menutup dan kartu produk di frontend langsung menampilkan foto baru berstatus *Approved* dalam hitungan detik.

### Perilaku Saat Opsi TIDAK Dicentang:
- Tetap menjalankan alur lama: foto dianggap foto mentah (raw snapshot kamera HP kurator) yang membutuhkan penghapusan latar belakang otomatis oleh mesin rembg `@imgly`.

---

## 3. Rincian Teknis Perubahan

### A. Frontend: Modal Ganti Foto Produk (`app/products/page.js`)
- Tambahkan state lokal di komponen modal: `const [directUse, setDirectUse] = useState(true);`.
- Di dalam Tab **"2. Unggah Sendiri"** (sekitar baris 3150–3220), tambahkan elemen kontrol semantik:
  ```jsx
  <div style={{
    marginTop: '16px',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: directUse ? 'var(--status-success-soft)' : 'var(--surface-raised)',
    border: `1px solid ${directUse ? 'var(--status-success)' : 'var(--border-subtle)'}`,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }} onClick={() => setDirectUse(!directUse)}>
    <input
      type="checkbox"
      id="direct_use_toggle"
      checked={directUse}
      onChange={(e) => setDirectUse(e.target.checked)}
      style={{ marginTop: '3px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
    />
    <div>
      <label htmlFor="direct_use_toggle" style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
        Foto ini sudah siap pakai / profesional
      </label>
      <span style={{ fontSize: '0.75rem', color: directUse ? 'var(--status-success)' : 'var(--text-muted)' }}>
        {directUse 
          ? '✓ Gunakan langsung tanpa hapus latar belakang, tanpa antrean worker, dan tanpa AI regenerasi.' 
          : '⚡ Sistem akan otomatis menghapus latar belakang & membersihkan foto via AI.'}
      </span>
    </div>
  </div>
  ```
- Saat submit form upload, kirimkan `formData.append('direct_use', directUse ? 'true' : 'false')`.

### B. Backend: Endpoint Ganti Foto (`app/api/v2/products/[id]/photo-replace/route.js`)
- Baca parameter `const directUse = formData.get('direct_use') === 'true';`.
- Jika `directUse === true` dan `source === 'upload'`:
  1. Simpan buffer file gambar ke:
     - `public/uploads/products/clean/prod_${id}_${Date.now()}_clean.${ext}`
     - `public/uploads/products/raw/prod_${id}_${Date.now()}_raw.${ext}`
  2. Eksekusi query update langsung:
     ```sql
     UPDATE product_extractions
     SET 
       photo_url = $1,
       clean_photo_url = $1,
       photo_status = 'approved',
       photo_provider = 'manual_upload',
       photo_reviewed_at = NOW(),
       photo_history = jsonb_insert(
         COALESCE(photo_history, '[]'::jsonb), 
         '0', 
         $2::jsonb
       ),
       updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4
     ```
  3. Kembalikan respons instan:
     ```json
     {
       "success": true,
       "message": "Foto profesional berhasil dipasang langsung sebagai foto utama produk.",
       "data": {
         "photo_url": cleanUrl,
         "clean_photo_url": cleanUrl,
         "photo_status": "approved",
         "mode": "direct"
       }
     }
     ```
  4. Lewati (skip) pembuatan background job `createScheduledJob('product_photo_replace', ...)`.

---

## 4. Simulasi & Verifikasi Mockup Interaktif

Sesuai SOP Mockup HTML Sebelum Perbaikan UI, mockup mandiri telah dibuat dan disinkronkan ke Staging Mac Mini:

- **Tautan Mockup Staging**:  
  👉 **[http://100.95.245.55:5010/mockup_ganti_foto_unggah_profesional.html](http://100.95.245.55:5010/mockup_ganti_foto_unggah_profesional.html)**
- **Fitur Unggulan Mockup**:
  1. **Simulasi Tab Modal Lengkap**: Menampilkan 3 tab ganti foto dengan fokus interaktif pada tab *2. Unggah Sendiri*.
  2. **Toggle Interaktif Real-Time**: Pengguna dapat mencentang/membatalkan opsi "Foto Siap Pakai / Profesional" dan melihat perubahan deskripsi status serta alur pipeline secara visual.
  3. **Drag & Drop & File Picker**: Mendukung drop gambar langsung di browser untuk menguji tampilan preview foto.
  4. **Komparasi Visual (Before vs After)**: Memperlihatkan perbedaan foto yang dipasang langsung vs foto yang rusak/terdistorsi akibat rembg paksa.
  5. **Tema Dinamis**: Mendukung pengujian dalam Light Mode dan Dark Mode sesuai Universal Semantic Design Tokens.

---

## 5. Rencana Penerapan (Branch & Deployment)

1. **Branch**: `fitur/opsi-foto-profesional-produk` (dibuat dari `main`).
2. **Pengujian Lokal**:
   - Uji upload foto dengan opsi "Gunakan Langsung" tercentang: verifikasi file tersimpan di `/uploads/products/clean/`, record di DB berstatus `approved`, tanpa ada job di scheduler queue.
   - Uji upload foto tanpa opsi dicentang: verifikasi bahwa jalur background rembg tetap berfungsi normal untuk foto mentah non-profesional.
3. **Deployment ke Dev**:
   - `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`
   - Uji di lingkungan Dev (`http://100.95.245.55:5020/products`).
4. **Persetujuan Pengguna & Promosi ke Staging**:
   - Setelah kurator mengonfirmasi kepuasan di Dev, lakukan merge ke `main` dan deploy ke Staging via atomic deployment.
