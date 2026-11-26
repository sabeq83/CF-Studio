import { NextResponse } from 'next/server';
import { listPublicAffiliateCatalog } from '@/lib/public-affiliate-catalog-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand') || '';
    const search = searchParams.get('search') || '';

    const data = await listPublicAffiliateCatalog({ brandId, search });
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[Public Affiliate Catalog GET Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat katalog produk affiliate.' },
      { status: 500 }
    );
  }
}
