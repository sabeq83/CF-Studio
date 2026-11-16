import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { withTenantContext } from '@/lib/auth';
import { getProductById, updateProduct } from '@/lib/product-repository';
import { createJob } from '@/lib/db';
import { validateRawProductImage } from '@/lib/product-validation';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID produk tidak valid.' }, { status: 400 });
    }

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

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

    if (!['candidate', 'upload', 'rescrape'].includes(source)) {
      return NextResponse.json({
        success: false,
        error: `Sumber penggantian foto '${source}' tidak valid. Gunakan 'candidate', 'upload', atau 'rescrape'.`
      }, { status: 400 });
    }

    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const rawDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw');
    if (!fs.existsSync(rawDir)) {
      fs.mkdirSync(rawDir, { recursive: true });
    }

    // 1. Opsi Rescrape Otomatis
    if (source === 'rescrape') {
      const sourceUrl = product.source_url || product.input_source;
      if (!sourceUrl || !sourceUrl.startsWith('http')) {
        return NextResponse.json({
          success: false,
          error: 'Produk tidak memiliki source_url yang valid untuk scrape ulang.'
        }, { status: 400 });
      }

      const job = await createJob('product_scraper', {
        urls: [sourceUrl],
        refresh_photo: true,
        reserved_ids: { [sourceUrl]: id }
      });

      await updateProduct(id, {
        photo_status: 'processing',
        photo_provider: 'scraper',
        photo_task_id: String(job?.id || '')
      });

      return NextResponse.json({
        success: true,
        mode: 'rescrape',
        job_id: job?.id
      });
    }

    // 2. Opsi Pilih dari Kandidat Listing
    if (source === 'candidate') {
      const idxNum = Number(candidateIndex);
      if (Number.isNaN(idxNum) || idxNum < 0) {
        return NextResponse.json({
          success: false,
          error: 'candidate_index wajib berupa angka >= 0.'
        }, { status: 400 });
      }

      let audit = null;
      try {
        const rawObj = JSON.parse(product.raw_response || '{}');
        audit = rawObj.photo_selection_audit;
      } catch (_) {}

      const candidateList = Array.isArray(audit?.evaluated) ? audit.evaluated : [];
      const selectedCand = candidateList.find(c => Number(c.index) === idxNum);

      if (!selectedCand) {
        return NextResponse.json({
          success: false,
          error: `Kandidat #${idxNum} tidak ditemukan atau belum ada foto listing tersimpan.`
        }, { status: 400 });
      }

      const rawFilename = `raw_${id}_${ts}.png`;
      const rawAbsPath = path.join(rawDir, rawFilename);
      let fileReady = false;

      // Coba ambil dari local_path terlebih dahulu
      if (selectedCand.local_path) {
        const localCandAbs = path.join(process.cwd(), 'public', selectedCand.local_path);
        if (fs.existsSync(localCandAbs)) {
          fs.copyFileSync(localCandAbs, rawAbsPath);
          fileReady = true;
        }
      }

      // Jika belum ada di disk lokal, unduh dari URL kandidat
      if (!fileReady && selectedCand.url && selectedCand.url.startsWith('http')) {
        try {
          const { downloadECommerceImage } = await import('@/lib/url-scraper');
          await downloadECommerceImage(selectedCand.url, rawAbsPath);
          fileReady = fs.existsSync(rawAbsPath);
        } catch (dlErr) {
          console.warn('[Photo Replace] Gagal mengunduh URL kandidat:', dlErr.message);
        }
      }

      if (!fileReady) {
        return NextResponse.json({
          success: false,
          error: 'Gagal memuat file gambar untuk kandidat yang dipilih.'
        }, { status: 500 });
      }

      const relativeRawPath = `/uploads/products/raw/${rawFilename}`;
      const job = await createJob('product_photo_replace', {
        product_id: id,
        raw_path: relativeRawPath,
        origin: 'candidate',
        run_crop: true
      });

      await updateProduct(id, {
        photo_status: 'processing',
        photo_provider: 'photo_replace',
        photo_task_id: String(job?.id || '')
      });

      return NextResponse.json({
        success: true,
        mode: 'candidate',
        job_id: job?.id
      });
    }

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

    return NextResponse.json({ success: false, error: 'Aksi tidak diketahui.' }, { status: 400 });
  } catch (error) {
    console.error('[API Product Photo Replace] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
