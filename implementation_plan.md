# Implementation Plan: Opsi Foto Profesional Siap Pakai pada Modal Ganti Foto Produk

**Branch**: `fitur/opsi-foto-profesional-produk`  
**Menu Target**: Database Produk (`/products`)  
**Tujuan**: Memberikan opsi kepada kurator untuk menggunakan foto yang diunggah secara langsung tanpa paksaan pemrosesan background removal (@imgly), AI Vision inspection (Gemini), antrean worker, atau AI regeneration.

---

## Proposed Changes

### 1. Frontend: Modal Ganti Foto Produk (`app/products/page.js`)
- Menambahkan state `replaceDirectUse` (default `true`) untuk mengontrol opsi foto profesional/siap pakai.
- Menambahkan elemen UI checkbox / card interaktif pada tab "2. Unggah Sendiri" dengan semantic design tokens.
- Mengirimkan parameter `direct_use` ke backend endpoint `POST /api/v2/products/[id]/photo-replace`.
- Menangani respons instan: menampilkan toast sukses langsung tanpa jeda antrean jika mode `direct`.

### 2. Backend: Endpoint Ganti Foto (`app/api/v2/products/[id]/photo-replace/route.js`)
- Membaca parameter `direct_use` dari `FormData` atau JSON body.
- Pada `source === 'upload'`, jika `direct_use === true`:
  - Simpan file ke folder `public/uploads/products/raw/` (arsip) dan `public/uploads/products/clean/` (siap pakai).
  - Update langsung record `product_extractions` via `updateProduct()`:
    - `raw_photo_url`, `clean_photo_url`, `cleaned_photo_url`, `photo_url`
    - `photo_status = 'approved'`, `photo_provider = 'manual_upload'`
    - `photo_reviewed_at = NOW()`, `previous_clean_photo_url`
  - Mengembalikan respons instan HTTP 200 `{ success: true, mode: 'direct', ... }`.
  - Melewati pembuatan antrean scheduler `product_photo_replace`.

---

## Code Sebelum & Sesudah (Before & After Code Snippets)

### File 1: `app/products/page.js`

#### Code Sebelum (Current/Before):
```jsx
// Line 140
const [replaceModalProduct, setReplaceModalProduct] = useState(null);
const [replaceTab, setReplaceTab] = useState(1); // 1: Listing, 2: Upload, 3: Rescrape
const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);
const [customUploadFile, setCustomUploadFile] = useState(null);
const [customUploadPreview, setCustomUploadPreview] = useState(null);
const [isSubmittingReplace, setIsSubmittingReplace] = useState(false);
...
// Line 244-252 (di dalam handleExecuteReplacePhoto)
} else if (replaceTab === 2) {
  if (!customUploadFile) {
    throw new Error('Pilih file gambar terlebih dahulu');
  }
  const formData = new FormData();
  formData.append('source', 'upload');
  formData.append('file', customUploadFile);
  body = formData;
}
...
// Line 268-273
if (data.success) {
  showToast('⏳ Penggantian foto sedang diproses di background...');
  setReplaceModalProduct(null);
  setCustomUploadFile(null);
  setCustomUploadPreview(null);
  fetchProducts();
}
...
// Line 3227-3232 (di dalam replaceTab === 2)
{customUploadFile && (
  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--status-success)' }}>
    ✅ File terpilih: <strong>{customUploadFile.name}</strong> ({(customUploadFile.size / 1024 / 1024).toFixed(2)} MB)
  </div>
)}
```

#### Code Sesudah (Proposed/After):
```jsx
// Line 140
const [replaceModalProduct, setReplaceModalProduct] = useState(null);
const [replaceTab, setReplaceTab] = useState(1); // 1: Listing, 2: Upload, 3: Rescrape
const [selectedCandidateIdx, setSelectedCandidateIdx] = useState(0);
const [customUploadFile, setCustomUploadFile] = useState(null);
const [customUploadPreview, setCustomUploadPreview] = useState(null);
const [replaceDirectUse, setReplaceDirectUse] = useState(true);
const [isSubmittingReplace, setIsSubmittingReplace] = useState(false);
...
// Line 244-252 (di dalam handleExecuteReplacePhoto)
} else if (replaceTab === 2) {
  if (!customUploadFile) {
    throw new Error('Pilih file gambar terlebih dahulu');
  }
  const formData = new FormData();
  formData.append('source', 'upload');
  formData.append('file', customUploadFile);
  formData.append('direct_use', replaceDirectUse ? 'true' : 'false');
  body = formData;
}
...
// Line 268-273
if (data.success) {
  if (data.mode === 'direct') {
    showToast('✅ Foto profesional berhasil diterapkan langsung!');
  } else {
    showToast('⏳ Penggantian foto sedang diproses di background...');
  }
  setReplaceModalProduct(null);
  setCustomUploadFile(null);
  setCustomUploadPreview(null);
  setReplaceDirectUse(true);
  fetchProducts();
}
...
// Line 3227-3260 (di dalam replaceTab === 2)
{customUploadFile && (
  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--status-success)' }}>
    ✅ File terpilih: <strong>{customUploadFile.name}</strong> ({(customUploadFile.size / 1024 / 1024).toFixed(2)} MB)
  </div>
)}

<div
  style={{
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: replaceDirectUse ? 'var(--status-success-soft)' : 'var(--surface-raised)',
    border: `1px solid ${replaceDirectUse ? 'var(--status-success)' : 'var(--border-subtle)'}`,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }}
  onClick={() => setReplaceDirectUse(!replaceDirectUse)}
>
  <input
    type="checkbox"
    id="replace_direct_use_toggle"
    checked={replaceDirectUse}
    onChange={(e) => setReplaceDirectUse(e.target.checked)}
    style={{ marginTop: '3px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
    onClick={(e) => e.stopPropagation()}
  />
  <div style={{ userSelect: 'none' }}>
    <label htmlFor="replace_direct_use_toggle" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
      Foto ini sudah siap pakai / profesional
    </label>
    <span style={{ fontSize: '11px', color: replaceDirectUse ? 'var(--status-success)' : 'var(--text-muted)', lineHeight: 1.35, display: 'block', marginTop: '2px' }}>
      {replaceDirectUse
        ? '✓ Gunakan langsung tanpa hapus latar belakang, tanpa antrean worker, dan tanpa AI regenerasi.'
        : '⚡ Sistem akan otomatis menghapus latar belakang & membersihkan foto via AI.'}
    </span>
  </div>
</div>
```

---

### File 2: `app/api/v2/products/[id]/photo-replace/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Line 25-39
const contentType = req.headers.get('content-type') || '';
let source = '';
let candidateIndex = null;
let uploadFile = null;

if (contentType.includes('multipart/form-data')) {
  const formData = await req.formData();
  source = formData.get('source') || '';
  candidateIndex = formData.get('candidate_index');
  uploadFile = formData.get('file') || formData.get('photo');
} else {
  const body = await req.json();
  source = body.source || '';
  candidateIndex = body.candidate_index;
}
...
// Line 163-206
// 3. Opsi Unggah Foto Sendiri
if (source === 'upload') {
  if (!uploadFile || typeof uploadFile.arrayBuffer !== 'function') {
    return NextResponse.json({
      success: false,
      error: 'File foto produk wajib diunggah untuk opsi upload.'
    }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());
  const validation = validateRawProductImage(fileBuffer, uploadFile.name);
  if (!validation.valid) {
    return NextResponse.json({
      success: false,
      error: validation.error || 'Format atau ukuran file tidak valid (JPG/PNG/WebP maks 20MB).'
    }, { status: 400 });
  }

  const rawFilename = `raw_${id}_${ts}.png`;
  const rawAbsPath = path.join(rawDir, rawFilename);
  fs.writeFileSync(rawAbsPath, fileBuffer);

  const relativeRawPath = `/uploads/products/raw/${rawFilename}`;
  // Unggahan pengguna tidak perlu di-crop otomatis (run_crop: false)
  const job = await createJob('product_photo_replace', {
    tenant_id: activeTenant,
    product_id: id,
    raw_path: relativeRawPath,
    origin: 'upload',
    run_crop: false
  });

  await updateProduct(id, {
    photo_status: 'processing',
    photo_provider: 'photo_replace',
    photo_task_id: String(job?.id || '')
  });

  return NextResponse.json({
    success: true,
    mode: 'upload',
    job_id: job?.id
  });
}
```

#### Code Sesudah (Proposed/After):
```javascript
// Line 25-41
const contentType = req.headers.get('content-type') || '';
let source = '';
let candidateIndex = null;
let uploadFile = null;
let directUse = false;

if (contentType.includes('multipart/form-data')) {
  const formData = await req.formData();
  source = formData.get('source') || '';
  candidateIndex = formData.get('candidate_index');
  uploadFile = formData.get('file') || formData.get('photo');
  directUse = formData.get('direct_use') === 'true' || formData.get('direct_use') === true;
} else {
  const body = await req.json();
  source = body.source || '';
  candidateIndex = body.candidate_index;
  directUse = body.direct_use === true || body.direct_use === 'true';
}
...
// Line 163-228
// 3. Opsi Unggah Foto Sendiri
if (source === 'upload') {
  if (!uploadFile || typeof uploadFile.arrayBuffer !== 'function') {
    return NextResponse.json({
      success: false,
      error: 'File foto produk wajib diunggah untuk opsi upload.'
    }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());
  const validation = validateRawProductImage(fileBuffer, uploadFile.name);
  if (!validation.valid) {
    return NextResponse.json({
      success: false,
      error: validation.error || 'Format atau ukuran file tidak valid (JPG/PNG/WebP maks 20MB).'
    }, { status: 400 });
  }

  const rawFilename = `raw_${id}_${ts}.png`;
  const rawAbsPath = path.join(rawDir, rawFilename);
  fs.writeFileSync(rawAbsPath, fileBuffer);
  const relativeRawPath = `/uploads/products/raw/${rawFilename}`;

  // JIKA DIRECT USE: Foto profesional siap pakai langsung diterapkan
  if (directUse) {
    const cleanDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'clean');
    if (!fs.existsSync(cleanDir)) {
      fs.mkdirSync(cleanDir, { recursive: true });
    }
    const cleanFilename = `clean_${id}_${ts}.png`;
    const cleanAbsPath = path.join(cleanDir, cleanFilename);
    fs.writeFileSync(cleanAbsPath, fileBuffer);

    const relativeCleanPath = `/uploads/products/clean/${cleanFilename}`;
    const previousClean = product.clean_photo_url || product.cleaned_photo_url || null;

    const updates = {
      raw_photo_url: relativeRawPath,
      clean_photo_url: relativeCleanPath,
      cleaned_photo_url: relativeCleanPath,
      photo_url: relativeCleanPath,
      active_photo: 'cleaned_photo_url',
      previous_clean_photo_url: previousClean,
      photo_status: 'approved',
      photo_provider: 'manual_upload',
      photo_error: null,
      photo_task_id: null,
      photo_reviewed_at: new Date().toISOString()
    };

    const updated = await updateProduct(id, updates);

    return NextResponse.json({
      success: true,
      mode: 'direct',
      message: 'Foto profesional berhasil dipasang langsung sebagai foto utama produk.',
      data: {
        photo_url: relativeCleanPath,
        clean_photo_url: relativeCleanPath,
        photo_status: 'approved'
      },
      product: updated
    });
  }

  // JIKA NON-DIRECT: Jalankan alur background worker lama (rembg otomatis)
  const job = await createJob('product_photo_replace', {
    tenant_id: activeTenant,
    product_id: id,
    raw_path: relativeRawPath,
    origin: 'upload',
    run_crop: false
  });

  await updateProduct(id, {
    photo_status: 'processing',
    photo_provider: 'photo_replace',
    photo_task_id: String(job?.id || '')
  });

  return NextResponse.json({
    success: true,
    mode: 'upload',
    job_id: job?.id
  });
}
```

---

## Execution Task List

- [x] Task 1: Buat dan periksa branch `fitur/opsi-foto-profesional-produk`
- [x] Task 2: Modifikasi backend `app/api/v2/products/[id]/photo-replace/route.js` untuk mendukung `direct_use`
- [x] Task 3: Modifikasi frontend `app/products/page.js` untuk menambahkan state & toggle kontrol Foto Profesional
- [x] Task 4: Uji fungsional lokal (unit test / integration test script)
- [x] Task 5: Perbarui kartu menu `sot/menus/kartu/products.md` sesuai SOP Konteks Menu
- [x] Task 6: Commit perubahan dan push branch `fitur/opsi-foto-profesional-produk` ke remote GitHub
- [ ] Task 7: Deploy ke Server Dev Mac Mini (port 5020/7020) via Atomic Deployment dan verifikasi kesehatan
