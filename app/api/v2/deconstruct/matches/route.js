import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  getMatchesForBlueprint,
  indexBlueprintMatchesForAsset,
  backfillBlueprintProductMatches,
} from '@/lib/blueprint-product-matcher';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = getActiveTenantId();
    const blueprintId = searchParams.get('blueprint_id') || searchParams.get('deconstruct_asset_id');
    const brandId = searchParams.get('brand_id') || searchParams.get('brand') || null;
    const promoRole = searchParams.get('promo_role') || null;
    const limit = Number(searchParams.get('limit') || 20);

    if (!blueprintId) {
      return NextResponse.json({ success: false, error: 'blueprint_id wajib diisi' }, { status: 400 });
    }

    let matches = await getMatchesForBlueprint({
      tenantId,
      blueprintId,
      brandId,
      promoRole,
      limit,
    });

    // Jika blueprint ini belum pernah diindeks sama sekali, jalankan indeks on-demand 1x
    if (matches.length === 0) {
      try {
        await indexBlueprintMatchesForAsset(blueprintId, tenantId);
        matches = await getMatchesForBlueprint({
          tenantId,
          blueprintId,
          brandId,
          promoRole,
          limit,
        });
      } catch (indexErr) {
        console.warn('[Deconstruct Matches GET] On-demand index notice:', indexErr.message);
      }
    }

    const alatDapur = matches.filter(m => m.promo_role === 'alat_dapur');
    const bahanResep = matches.filter(m => m.promo_role === 'bahan_resep');

    return NextResponse.json({
      success: true,
      blueprint_id: blueprintId,
      brand_id: brandId || 'all',
      matches,
      grouped: {
        alat_dapur: alatDapur,
        bahan_resep: bahanResep,
      },
    });
  } catch (error) {
    console.error('[Deconstruct Matches GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = getActiveTenantId();
    const blueprintId = body.blueprint_id || body.deconstruct_asset_id || null;

    if (blueprintId) {
      const result = await indexBlueprintMatchesForAsset(blueprintId, tenantId);
      return NextResponse.json({ success: true, mode: 'single', ...result });
    }

    const result = await backfillBlueprintProductMatches(tenantId);
    return NextResponse.json({ success: true, mode: 'backfill', ...result });
  } catch (error) {
    console.error('[Deconstruct Matches POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
