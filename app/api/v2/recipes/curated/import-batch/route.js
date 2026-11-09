import { NextResponse } from 'next/server.js';
import { withTenantContext } from '@/lib/auth.js';
import { processRecipeBatchSequential } from '@/lib/recipe-importer/recipe-batch-processor.js';
import { listCuratedRecipes } from '@/lib/curated-recipes-repository.js';

export const POST = withTenantContext(async (request, _ctx, user) => {
  try {
    const body = await request.json();
    const urls = body.urls || body.url_list || [];
    const autoPolish = body.auto_polish !== false && body.autoPolish !== false;
    const stylePreset = body.style_preset || body.stylePreset || 'Food Porn';
    const category = body.category || 'makanan_utama';
    const cuisine = body.cuisine || 'indonesia';
    const minDelayMs = body.min_delay_ms !== undefined ? Number(body.min_delay_ms) : 10000;
    const maxDelayMs = body.max_delay_ms !== undefined ? Number(body.max_delay_ms) : 20000;
    const tenantId = user?.tenantId || 'default_tenant';

    const result = await processRecipeBatchSequential({
      urls,
      autoPolish,
      stylePreset,
      category,
      cuisine,
      tenantId,
      minDelayMs,
      maxDelayMs
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses batch: ${result.success_count} sukses, ${result.failed_count} gagal dari total ${result.total_processed} URL.`,
      data: result
    });
  } catch (err) {
    console.error('[API Curated Recipe Batch] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Terjadi kesalahan saat memproses batch resep.'
      },
      { status: 400 }
    );
  }
});

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = user?.tenantId || 'default_tenant';
    const batchId = searchParams.get('batch_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const polishStatus = searchParams.get('polish_status') || undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const recipes = await listCuratedRecipes({
      tenantId,
      batchId,
      status,
      polishStatus,
      category,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      count: recipes.length,
      data: recipes
    });
  } catch (err) {
    console.error('[API Curated Recipe List] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal mengambil daftar pustaka resep.'
      },
      { status: 500 }
    );
  }
});

