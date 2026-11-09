import { NextResponse } from 'next/server';
import { scrapeRecipeListingUrl, formatRecipesToCsv, formatRecipesToTsv } from '@/lib/scrapers/index.js';

/**
 * POST /api/recipe-scraper/crawl
 * Crawl dan ekstrak daftar URL resep (title, category, url) dari URL listing/pencarian
 * Body: { url: string, pages?: number, category?: string, format?: 'json' | 'csv' | 'tsv' }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { url, pages = 1, category = '', format = 'json' } = body || {};

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { success: false, error: 'URL listing target wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await scrapeRecipeListingUrl({
      url: url.trim(),
      pages: Number(pages) || 1,
      customCategory: category ? String(category).trim() : '',
      delayMs: 350
    });

    if (format === 'csv') {
      const csvData = formatRecipesToCsv(result.items);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="recipes_${result.category}_${Date.now()}.csv"`
        }
      });
    }

    if (format === 'tsv') {
      const tsvData = formatRecipesToTsv(result.items);
      return new NextResponse(tsvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/tab-separated-values; charset=utf-8'
        }
      });
    }

    return NextResponse.json({
      success: true,
      source: result.source,
      category: result.category,
      total_scraped: result.total_scraped,
      pages_crawled: result.pages_crawled,
      data: result.items
    });
  } catch (err) {
    console.error('[API Recipe Scraper] Crawl error:', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Terjadi kesalahan saat mengekstrak URL resep.' },
      { status: 500 }
    );
  }
}

