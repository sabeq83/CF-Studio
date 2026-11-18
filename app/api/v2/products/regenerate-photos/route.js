import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';
import { getProductById } from '@/lib/product-repository';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v2/products/regenerate-photos
 * Body: { ids: string[], provider?: 'gemini'|'glabs'|'system_default' }
 *
 * Hanya mengantrikan pekerjaan foto.
 * - Reference selalu raw_photo_url (bukan clean/rembg lama)
 * - Tidak menjalankan Gemini atau G-Labs di dalam request ini
 * - Worker (product-bulk-worker) yang memproses queue
 * - Hasil adalah foto Clean baru, disimpan ke clean_photo_url
 * - TIDAK menulis ke generated_photo_url atau active_photo
 */
export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { ids, provider, engine } = body;
    const tenantId = getActiveTenantId();

    const ALLOWED_ENGINES = [undefined, null, 'gpt_image_2'];
    if (!ALLOWED_ENGINES.includes(engine)) {
      return NextResponse.json({ success: false, error: 'Engine tidak dikenal.' }, { status: 400 });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar ID produk wajib dikirim.' }, { status: 400 });
    }

    if (engine === 'gpt_image_2' && ids.length !== 1) {
      return NextResponse.json({ success: false, error: 'GPT hanya untuk 1 produk per klik.' }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 produk per request.' }, { status: 400 });
    }

    const results = [];
    const resolvedProvider = engine === 'gpt_image_2'
      ? 'glabs'
      : ((provider && provider !== 'system_default') ? provider : null);
    const requestedEngine = engine === 'gpt_image_2' ? 'gpt_image_2' : null;

    for (const id of ids) {
      try {
        // Verifikasi produk ada dan milik tenant ini
        const product = await getProductById(id);
        if (!product) {
          results.push({ id, status: 'not_found' });
          continue;
        }

        // Tolak bila produk sedang pending atau processing agar tidak dobel kirim
        if (['pending', 'processing'].includes(product.photo_status)) {
          if (ids.length === 1) {
            return NextResponse.json({
              success: false,
              error: 'Foto produk sedang dalam antrean atau diproses. Tunggu sampai selesai.'
            }, { status: 409 });
          }
          results.push({ id, status: 'skipped', reason: 'Foto produk sedang diproses' });
          continue;
        }

        if (engine === 'gpt_image_2') {
          if (!String(product.raw_photo_url || '').startsWith('/uploads')) {
            results.push({
              id,
              status: 'skipped',
              reason: 'Foto mentah belum tersimpan di server — upload foto mentah dulu.'
            });
            continue;
          }
        } else if (!product.raw_photo_url && !product.scraped_image_url) {
          // Jalur reguler: produk harus punya raw_photo_url (lokal atau URL)
          results.push({ id, status: 'skipped', reason: 'Tidak ada raw photo tersedia' });
          continue;
        }

        // Antrikan: set photo_status = pending, agar worker mengambil dan memproses
        // Jangan hapus clean_photo_url lama sebelum hasil baru selesai
        const params = [id, tenantId, requestedEngine];
        let providerSetSql = '';
        if (resolvedProvider) {
          params.push(resolvedProvider);
          providerSetSql = `photo_provider = $${params.length},`;
        }

        const updateRes = await pgQuery(`
          UPDATE product_extractions
          SET photo_status = 'pending',
              photo_error = NULL,
              photo_engine_request = $3,
              ${providerSetSql}
              extraction_status = 'pending_image',
              updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id
        `, params);

        if (updateRes.rowCount > 0) {
          results.push({
            id,
            status: 'queued',
            provider: resolvedProvider || 'system_default',
            engine: requestedEngine
          });
        } else {
          results.push({ id, status: 'not_found' });
        }
      } catch (err) {
        console.error(`[Regenerate Photo Queue Error] ID ${id}:`, err.message);
        results.push({ id, status: 'error', error: err.message });
      }
    }

    const queuedCount = results.filter(r => r.status === 'queued').length;

    return NextResponse.json({
      success: true,
      message: `${queuedCount} produk dimasukkan ke antrean foto ulang.`,
      results
    });

  } catch (err) {
    console.error('[Regenerate Photos API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
