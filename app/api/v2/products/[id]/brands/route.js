import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  listProductBrands,
  upsertBrandProduct,
  deactivateBrandProduct
} from '@/lib/brand-product-repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/products/[id]/brands
 * Mendapatkan semua Brand Profile yang terhubung dengan produk ini
 */
export const GET = withTenantContext(async (req, { params }) => {
  try {
    const { id: productId } = await params;
    const associations = await listProductBrands({ productId });
    return NextResponse.json({ success: true, data: associations });
  } catch (err) {
    console.error('[GET Product Brands API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});

/**
 * POST /api/v2/products/[id]/brands
 * Menghubungkan atau memperbarui affiliate link produk untuk brand profile tertentu
 */
export const POST = withTenantContext(async (req, { params }) => {
  try {
    const { id: productId } = await params;
    const body = await req.json();
    const {
      brandProfileId,
      affiliateLink,
      trackingCode = null,
      landingPageUrl = null,
      productNameOverride = null,
      ctaOverride = null,
      notes = null,
      isActive = true
    } = body;

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'Parameter brandProfileId wajib diisi.' },
        { status: 400 }
      );
    }

    const association = await upsertBrandProduct({
      brandProfileId,
      productId,
      affiliateLink: affiliateLink ? affiliateLink.trim() : null,
      trackingCode,
      landingPageUrl,
      productNameOverride,
      ctaOverride,
      notes,
      isActive
    });

    return NextResponse.json({
      success: true,
      message: 'Hubungan Brand-Product berhasil disimpan.',
      data: association
    });
  } catch (err) {
    console.error('[POST Product Brand Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});

/**
 * PUT /api/v2/products/[id]/brands
 * Alias untuk POST / upsert
 */
export const PUT = POST;

/**
 * DELETE /api/v2/products/[id]/brands
 * Menonaktifkan link brand untuk produk ini
 */
export const DELETE = withTenantContext(async (req, { params }) => {
  try {
    const { id: productId } = await params;
    const { searchParams } = new URL(req.url);
    let brandProfileId = searchParams.get('brandProfileId');

    if (!brandProfileId) {
      try {
        const body = await req.json();
        brandProfileId = body.brandProfileId;
      } catch {
        // body may be empty
      }
    }

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'Parameter brandProfileId wajib disertakan.' },
        { status: 400 }
      );
    }

    const result = await deactivateBrandProduct({ brandProfileId, productId });

    return NextResponse.json({
      success: true,
      message: 'Link brand berhasil dinonaktifkan.',
      data: result
    });
  } catch (err) {
    console.error('[DELETE Product Brand Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});
