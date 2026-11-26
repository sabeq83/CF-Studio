import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  BASE_PRODUCTS_UPLOAD_DIR,
  TRANSPARENT_1X1_GIF_BUFFER,
  resolveSafeProductUploadFile
} from '@/lib/product-image-storage';
import { isProductPhotoAllowedForTenant } from '@/lib/public-affiliate-catalog-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    const resolved = resolveSafeProductUploadFile(relativePath, { baseDir: BASE_PRODUCTS_UPLOAD_DIR });
    if (resolved.error) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }

    const allowed = await isProductPhotoAllowedForTenant(resolved.cleanPath);
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Unauthorized path' }, { status: 403 });
    }

    if (resolved.missing) {
      return new NextResponse(TRANSPARENT_1X1_GIF_BUFFER, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache',
          'X-Image-Missing': 'true'
        }
      });
    }

    const fileBuffer = fs.readFileSync(resolved.resolvedPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': resolved.contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('[Public Affiliate Catalog Image GET Error]:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat gambar produk.' }, { status: 500 });
  }
}
