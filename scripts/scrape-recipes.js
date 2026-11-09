#!/usr/bin/env node

/**
 * CLI Tool: Recipe URL Scraper
 * Ekstraksi massal title, category, dan URL dari listing resep (contoh: Cookpad).
 *
 * Penggunaan:
 *   node scripts/scrape-recipes.js --url "https://cookpad.com/id/cari/brownies" --pages 2 --out brownies.csv
 *
 * Argumen:
 *   --url <url>         Target listing URL (Wajib)
 *   --pages <num>       Jumlah halaman yang akan di-crawl (Default: 1)
 *   --category <cat>    Kategori resep (Default: auto-detect dari URL)
 *   --out <filepath>    Nama file output CSV/TSV/JSON (Opsional)
 *   --tsv               Gunakan format TSV (Tab-Separated) alih-alih CSV
 *   --json              Gunakan format JSON alih-alih CSV
 */

import fs from 'fs';
import path from 'path';
import { scrapeRecipeListingUrl, formatRecipesToCsv, formatRecipesToTsv } from '../lib/scrapers/index.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: '',
    pages: 1,
    category: '',
    out: '',
    tsv: false,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg === '--pages' && i + 1 < args.length) {
      options.pages = parseInt(args[++i], 10) || 1;
    } else if (arg === '--category' && i + 1 < args.length) {
      options.category = args[++i];
    } else if (arg === '--out' && i + 1 < args.length) {
      options.out = args[++i];
    } else if (arg === '--tsv') {
      options.tsv = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('\n==================================================');
  console.log('   🍳 MAKNA Flow — Recipe URL Scraper CLI');
  console.log('==================================================\n');

  if (!options.url) {
    console.error('❌ Error: Parameter --url wajib diisi!');
    console.log('\nContoh penggunaan:');
    console.log('  node scripts/scrape-recipes.js --url "https://cookpad.com/id/cari/brownies" --pages 2 --out brownies.csv\n');
    process.exit(1);
  }

  console.log(`🎯 Target URL : ${options.url}`);
  console.log(`📄 Halaman    : ${options.pages} page(s)`);
  if (options.category) console.log(`🏷️  Kategori   : ${options.category} (manual override)`);

  const startTime = Date.now();
  console.log('\n⏳ Memulai proses ekstraksi...');

  try {
    const result = await scrapeRecipeListingUrl({
      url: options.url,
      pages: options.pages,
      customCategory: options.category
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Selesai dalam ${duration}s!`);
    console.log(`📊 Total URL Terekstrak : ${result.total_scraped} resep`);
    console.log(`🏷️  Kategori Terpilih   : "${result.category}"`);
    console.log(`🌐 Sumber Platform     : ${result.source.toUpperCase()}`);

    if (result.items.length === 0) {
      console.log('⚠️ Tidak ada resep yang ditemukan pada URL tersebut.');
      return;
    }

    console.log('\n📋 Contoh 5 Hasil Ekstraksi:');
    result.items.slice(0, 5).forEach((item, idx) => {
      console.log(`  [${idx + 1}] ${item.title}`);
      console.log(`      Kategori: ${item.category} | URL: ${item.url}`);
    });

    // Output formatting
    let outputContent = '';
    let defaultExt = '.csv';

    if (options.json) {
      outputContent = JSON.stringify(result, null, 2);
      defaultExt = '.json';
    } else if (options.tsv) {
      outputContent = formatRecipesToTsv(result.items);
      defaultExt = '.tsv';
    } else {
      outputContent = formatRecipesToCsv(result.items);
      defaultExt = '.csv';
    }

    if (options.out) {
      const targetPath = path.resolve(process.cwd(), options.out);
      fs.writeFileSync(targetPath, outputContent, 'utf8');
      console.log(`\n💾 File berhasil disimpan ke: ${targetPath}`);
    } else {
      const defaultFilename = `recipes_${result.category}_${Date.now()}${defaultExt}`;
      const defaultPath = path.resolve(process.cwd(), defaultFilename);
      fs.writeFileSync(defaultPath, outputContent, 'utf8');
      console.log(`\n💾 (Otomatis) File disimpan ke: ${defaultPath}`);
    }
  } catch (err) {
    console.error(`\n❌ Ekstraksi gagal: ${err.message}`);
    process.exit(1);
  }
}

main();
