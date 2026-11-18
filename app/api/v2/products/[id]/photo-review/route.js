import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getProductById, updateProduct } from '@/lib/product-repository';

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

    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      // Body opsional jika hanya POST ke endpoint
    }

    const action = body.action || 'approve';

    if (action === 'revert_previous') {
      const previousCleanUrl = product.previous_clean_photo_url;
      if (!previousCleanUrl) {
        return NextResponse.json({
          success: false,
          error: 'Foto bersih sebelumnya tidak tersedia untuk produk ini.'
        }, { status: 409 });
      }

      const updates = {
        clean_photo_url: previousCleanUrl,
        cleaned_photo_url: previousCleanUrl,
        photo_url: previousCleanUrl,
        active_photo: 'cleaned_photo_url',
        previous_clean_photo_url: null,
        photo_model: product.previous_photo_model || null,
        previous_photo_model: null,
        photo_engine_request: null,
        photo_status: 'approved',
        photo_error: null,
        photo_reviewed_at: new Date().toISOString()
      };

      const updated = await updateProduct(id, updates);

      return NextResponse.json({
        success: true,
        message: 'Foto produk dikembalikan ke versi bersih sebelumnya.',
        product: updated
      });
    }

    if (action !== 'approve') {
      return NextResponse.json({ success: false, error: `Action '${action}' tidak didukung. Gunakan 'approve' atau 'revert_previous'.` }, { status: 400 });
    }

    // R6: Hanya boleh disetujui jika berstatus needs_review
    if (product.photo_status !== 'needs_review') {
      return NextResponse.json({
        success: false,
        error: `Hanya foto berstatus needs_review yang dapat disetujui (Status saat ini: ${product.photo_status || 'approved'}).`
      }, { status: 409 });
    }

    const updates = {
      photo_status: 'approved',
      photo_error: null,
      photo_reviewed_at: new Date().toISOString()
    };

    // Arahkan ke foto clean jika tersedia
    const cleanUrl = product.cleaned_photo_url || product.clean_photo_url;
    if (cleanUrl) {
      updates.active_photo = 'cleaned_photo_url';
      updates.photo_url = cleanUrl;
    }

    const updated = await updateProduct(id, updates);

    return NextResponse.json({
      success: true,
      message: 'Foto produk berhasil disetujui.',
      product: updated
    });
  } catch (error) {
    console.error('[API Product Photo Review] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
