/**
 * Script Injeksi Link Affiliate dari Google Sheets ke Staging & Dev (Tahap 1)
 * 
 * Penggunaan:
 *   node scripts/inject-sheets-affiliate-links.js --dry-run
 *   node scripts/inject-sheets-affiliate-links.js --apply
 */

import crypto from 'crypto';
import { getPgPool } from '../lib/db-pg.js';

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  
  function parseLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(row);
  }
  return rows;
}

async function fetchSheetCsv(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  return parseCsv(text);
}

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractShopeeId(url) {
  if (!url) return null;
  const m1 = url.match(/product\/(\d+)\/(\d+)/);
  if (m1) return `${m1[1]}/${m1[2]}`;
  const m2 = url.match(/-i\.(\d+)\.(\d+)/);
  if (m2) return `${m2[1]}/${m2[2]}`;
  return null;
}

async function runInjection() {
  console.log('================================================================');
  console.log(`🚀 INJEKSI LINK AFFILIATE: GOOGLE SHEETS -> DATABASE (${isDryRun ? 'SIMULASI / DRY-RUN' : 'MODE EKSEKUSI NYATA'})`);
  console.log('================================================================\n');

  // 1. Fetch data dari kedua Google Spreadsheet
  console.log('📥 Mengunduh data Google Spreadsheet...');
  const [s1Dapur, s1Nutri, s1Siasat, s2Dapur, s2Nutri] = await Promise.all([
    fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2045330038'),
    fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2109968635'),
    fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '517124521'),
    fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '0'),
    fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '2115963239')
  ]);

  console.log(`✓ Sheet 1: DapurBotani (${s1Dapur.length}), NutriBake (${s1Nutri.length}), SiasatSehat (${s1Siasat.length})`);
  console.log(`✓ Sheet 2: DapurBotani (${s2Dapur.length}), NutriBake (${s2Nutri.length})`);

  // Target brand configs
  const brandConfigs = [
    {
      brandKey: 'dapurbotani',
      displayName: 'DapurBotani',
      sheet1Rows: s1Dapur,
      sheet2Rows: s2Dapur
    },
    {
      brandKey: 'nutribake',
      displayName: 'NutriBake',
      sheet1Rows: s1Nutri,
      sheet2Rows: s2Nutri
    },
    {
      brandKey: 'siasatsehat',
      displayName: 'SiasatSehat',
      sheet1Rows: s1Siasat,
      sheet2Rows: []
    }
  ];

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const schemas = ['staging', 'dev'];

    for (const schema of schemas) {
      console.log(`\n======================================================`);
      console.log(`📦 MEMPROSES SKEMA DATABASE: ${schema.toUpperCase()}`);
      console.log(`======================================================`);

      // Fetch Brand Profiles
      const bpRows = (await client.query(
        `SELECT id, brand_name FROM ${schema}.brand_profiles WHERE tenant_id = 'default_tenant'`
      )).rows;
      const brandIdMap = {};
      bpRows.forEach(b => { brandIdMap[b.brand_name.toLowerCase()] = b.id; });

      // Fetch Products
      const dbProds = (await client.query(
        `SELECT id, product_name, source_url FROM ${schema}.product_extractions WHERE tenant_id = 'default_tenant'`
      )).rows;

      console.log(`✓ ${schema}.product_extractions: ${dbProds.length} produk`);

      // Build product indexes
      const dbByShopeeId = new Map();
      const dbByNormName = new Map();
      const dbAll = [];

      dbProds.forEach(p => {
        const sId = extractShopeeId(p.source_url);
        if (sId) dbByShopeeId.set(sId, p);
        const nName = normalize(p.product_name);
        dbByNormName.set(nName, p);
        dbAll.push({ ...p, normName: nName, shopeeId: sId });
      });

      function findProduct(name, productUrl) {
        if (productUrl) {
          const sId = extractShopeeId(productUrl);
          if (sId && dbByShopeeId.has(sId)) return dbByShopeeId.get(sId);
        }
        const norm = normalize(name);
        if (dbByNormName.has(norm)) return dbByNormName.get(norm);
        
        // Token match
        const tokens = norm.split(' ').filter(t => t.length > 2);
        let bestMatch = null;
        let maxMatch = 0;
        for (const item of dbAll) {
          let matchCount = 0;
          for (const t of tokens) {
            if (item.normName.includes(t)) matchCount++;
          }
          const score = matchCount / Math.max(tokens.length, item.normName.split(' ').length);
          if (matchCount >= 2 && score > 0.45 && score > maxMatch) {
            maxMatch = score;
            bestMatch = item;
          }
        }
        return bestMatch;
      }

      // Fetch existing brand_products
      const existingBp = (await client.query(`
        SELECT product_id, brand_profile_id, affiliate_link
        FROM ${schema}.brand_products
        WHERE tenant_id = 'default_tenant' AND affiliate_link IS NOT NULL AND affiliate_link != ''
      `)).rows;

      const existingSet = new Set();
      existingBp.forEach(r => existingSet.add(`${r.brand_profile_id}:${r.product_id}`));
      console.log(`✓ ${schema}.brand_products aktif saat ini: ${existingBp.length} relasi`);

      let totalInjectedThisSchema = 0;

      for (const bConfig of brandConfigs) {
        const brandProfileId = brandIdMap[bConfig.brandKey];
        if (!brandProfileId) {
          console.warn(`⚠️ Brand Profile "${bConfig.brandKey}" tidak ditemukan di ${schema}.brand_profiles!`);
          continue;
        }

        // Gabungkan entries Sheet 1 & Sheet 2 (Sheet 1 diutamakan)
        const entries = new Map();
        bConfig.sheet1Rows.forEach(r => {
          const name = (r['Nama Produk'] || '').trim();
          const aff = (r['Link Aff'] || '').trim();
          const pUrl = (r['Link Product'] || '').trim();
          if (name && aff) entries.set(normalize(name), { name, aff, pUrl });
        });
        bConfig.sheet2Rows.forEach(r => {
          const name = (r['Nama Produk'] || '').trim();
          const aff = (r['Link Aff'] || '').trim();
          const norm = normalize(name);
          if (norm && aff && !entries.has(norm)) {
            entries.set(norm, { name, aff, pUrl: null });
          }
        });

        // Kumpulkan produk yang link-nya belum ada di DB
        const toInsert = [];
        let skippedAlreadyExists = 0;
        let notInDb = 0;

        for (const [norm, item] of entries.entries()) {
          const product = findProduct(item.name, item.pUrl);
          if (!product) {
            notInDb++;
            continue;
          }

          const linkKey = `${brandProfileId}:${product.id}`;
          if (existingSet.has(linkKey)) {
            skippedAlreadyExists++;
            continue;
          }

          toInsert.push({
            productId: product.id,
            productName: product.product_name,
            affiliateLink: item.aff,
            landingPageUrl: item.pUrl || product.source_url || null
          });
          // Tambahkan ke existingSet sementara agar tidak duplikat dalam 1 batch
          existingSet.add(linkKey);
        }

        console.log(`\n👉 Brand ${bConfig.displayName}:`);
        console.log(`   - Link sudah ada di DB: ${skippedAlreadyExists}`);
        console.log(`   - Produk belum ada di tabel product_extractions: ${notInDb}`);
        console.log(`   - 🎯 Target Injeksi Link Baru: ${toInsert.length}`);

        if (toInsert.length > 0 && !isDryRun) {
          await client.query('BEGIN');
          for (const item of toInsert) {
            const bpId = crypto.randomUUID();
            await client.query(`
              INSERT INTO ${schema}.brand_products (
                id, tenant_id, brand_profile_id, product_id, affiliate_link,
                landing_page_url, notes, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET
                affiliate_link = EXCLUDED.affiliate_link,
                landing_page_url = COALESCE(${schema}.brand_products.landing_page_url, EXCLUDED.landing_page_url),
                is_active = TRUE,
                updated_at = NOW()
            `, [
              bpId,
              'default_tenant',
              brandProfileId,
              item.productId,
              item.affiliateLink,
              item.landingPageUrl,
              'Imported from Google Sheets (Tahap 1)',
              true
            ]);
          }
          await client.query('COMMIT');
          console.log(`   ✅ Berhasil menginjeksi ${toInsert.length} link ke ${schema}.brand_products!`);
        }

        totalInjectedThisSchema += toInsert.length;
      }

      console.log(`\n🎉 Total Link Baru di ${schema}: ${totalInjectedThisSchema} link affiliate.`);
      
      if (!isDryRun) {
        const finalCount = (await client.query(`
          SELECT count(*) FROM ${schema}.brand_products 
          WHERE tenant_id = 'default_tenant' AND is_active = TRUE AND affiliate_link IS NOT NULL AND affiliate_link != ''
        `)).rows[0].count;
        console.log(`📊 Total Relasi Aktif di ${schema}.brand_products Sekarang: ${finalCount}`);
      }
    }

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('💡 SIMULASI (DRY-RUN) SELESAI!');
      console.log('Tidak ada perubahan yang ditulis ke database.');
      console.log('Untuk mengeksekusi secara nyata, jalankan:');
      console.log('  node scripts/inject-sheets-affiliate-links.js --apply\n');
      console.log('================================================================');
    } else {
      console.log('\n================================================================');
      console.log('🌟 EKSEKUSI TAHAP 1 SELESAI DAN BERHASIL DI-COMMIT KE DATABASE!');
      console.log('================================================================\n');
    }

  } catch (err) {
    if (!isDryRun) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Terjadi kesalahan! Transaksi dibatalkan (ROLLBACK):', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runInjection().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

