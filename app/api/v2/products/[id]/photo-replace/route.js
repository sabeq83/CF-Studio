import { NextResponse } from 'next/server.js';
import path from 'node:path';
import fs from 'node:fs';
import { withTenantContext } from '../../../../../../lib/auth.js';
import { getProductById, updateProduct } from '../../../../../../lib/product-repository.js';
import { getActiveTenantId } from '../../../../../../lib/tenant-context.js';
import { createJob } from '../../../../../../lib/db.js';
import { validateRawProductImage } from '../../../../../../lib/product-validation.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID produk tidak valid.' }, { status: 400 });
    }

    const activeTenant = getActiveTenantId();
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

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
        tenant_id: activeTenant,
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
          const { downloadECommerceImage } = await import('../../../../../../lib/url-scraper.js');
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
        tenant_id: activeTenant,
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

      // JIKA DIRECT USE: Foto profesional siap pakai langsung diterapkan tanpa rembg & AI
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

      // JIKA NON-DIRECT: Alur lama via background scheduler (rembg otomatis)
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

    return NextResponse.json({ success: false, error: 'Aksi tidak diketahui.' }, { status: 400 });
  } catch (error) {
    console.error('[API Product Photo Replace] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
