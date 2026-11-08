/**
 * Scratch script to analyze and match Google Sheets affiliate links with Staging and Dev DB
 */
import { getPgPool } from '../lib/db-pg.js';

// Simple CSV Parser handling quotes
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

async function main() {
  console.log('Fetching Google Sheets data...');
  const s1DapurBotani = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2045330038');
  const s1NutriBake = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2109968635');
  const s1SiasatSehat = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '517124521');

  const s2DapurBotani = await fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '0');
  const s2Nutribake = await fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '2115963239');

  console.log(`Sheet 1 rows: DapurBotani=${s1DapurBotani.length}, NutriBake=${s1NutriBake.length}, SiasatSehat=${s1SiasatSehat.length}`);
  console.log(`Sheet 2 rows: DapurBotani=${s2DapurBotani.length}, NutriBake=${s2Nutribake.length}`);

  // DB queries
  const pool = getPgPool();
  
  // Staging Products
  const stgProdsRes = await pool.query(`SELECT id, product_name, source_url, affiliate_link, tenant_id FROM staging.product_extractions WHERE tenant_id = 'default_tenant'`);
  const stgProducts = stgProdsRes.rows;
  console.log(`Staging default_tenant products count: ${stgProducts.length}`);

  // Staging brand profiles
  const brandsRes = await pool.query(`SELECT id, brand_name FROM staging.brand_profiles WHERE tenant_id = 'default_tenant'`);
  const brandProfiles = {};
  brandsRes.rows.forEach(b => { brandProfiles[b.brand_name.toLowerCase()] = b.id; });
  console.log('Brand Profiles:', brandProfiles);

  // Staging brand products
  const bpRes = await pool.query(`
    SELECT bp.*, b.brand_name, p.product_name 
    FROM staging.brand_products bp
    JOIN staging.brand_profiles b ON bp.brand_profile_id = b.id
    JOIN staging.product_extractions p ON bp.product_id = p.id
    WHERE bp.tenant_id = 'default_tenant'
  `);
  const stgBrandProducts = bpRes.rows;
  console.log(`Staging default_tenant brand_products count: ${stgBrandProducts.length}`);

  // Build index of staging products
  const productByName = new Map();
  const productByUrl = new Map();
  stgProducts.forEach(p => {
    productByName.set(normalize(p.product_name), p);
    if (p.source_url) productByUrl.set(p.source_url.trim(), p);
  });

  // Build index of existing brand links: Map key: `${brand_name}:${product_id}` -> affiliate_link
  const brandLinksMap = new Map();
  stgBrandProducts.forEach(bp => {
    brandLinksMap.set(`${bp.brand_name.toLowerCase()}:${bp.product_id}`, bp.affiliate_link);
  });

  // Cross comparison helper
  function checkSheetAgainstDb(sheetRows, brandName, sheetLabel) {
    let matchedProducts = 0;
    let unmatchedProducts = [];
    let hasExistingAffLink = 0;
    let missingAffLink = [];
    let diffAffLink = [];

    sheetRows.forEach(row => {
      const pName = row['Nama Produk'] || '';
      const affLink = (row['Link Aff'] || '').trim();
      const pUrl = (row['Link Product'] || '').trim();
      
      const normName = normalize(pName);
      let pInDb = productByName.get(normName);
      if (!pInDb && pUrl) {
        pInDb = productByUrl.get(pUrl);
      }
      
      // Fuzzy substring match if not direct match
      if (!pInDb) {
        for (const [key, p] of productByName.entries()) {
          if (normName.length > 5 && (key.includes(normName) || normName.includes(key))) {
            pInDb = p;
            break;
          }
        }
      }

      if (pInDb) {
        matchedProducts++;
        const linkKey = `${brandName.toLowerCase()}:${pInDb.id}`;
        const existingLink = brandLinksMap.get(linkKey);
        
        if (existingLink) {
          hasExistingAffLink++;
          if (affLink && existingLink !== affLink) {
            diffAffLink.push({
              productName: pInDb.product_name,
              sheetName: pName,
              dbLink: existingLink,
              sheetLink: affLink
            });
          }
        } else {
          missingAffLink.push({
            productId: pInDb.id,
            productName: pInDb.product_name,
            sheetName: pName,
            sheetLink: affLink,
            productUrl: pUrl
          });
        }
      } else {
        unmatchedProducts.push({
          sheetName: pName,
          sheetLink: affLink,
          productUrl: pUrl
        });
      }
    });

    return {
      sheetLabel,
      brandName,
      totalSheetRows: sheetRows.length,
      matchedProducts,
      unmatchedProductsCount: unmatchedProducts.length,
      unmatchedProducts: unmatchedProducts.slice(0, 10),
      hasExistingAffLink,
      missingAffLinkCount: missingAffLink.length,
      missingAffLink: missingAffLink.slice(0, 10),
      diffAffLinkCount: diffAffLink.length,
      diffAffLink: diffAffLink.slice(0, 5)
    };
  }

  console.log('\n======================================================');
  console.log('📊 ANALISIS KECOCOKAN SINKRONISASI SHEET VS DATABASE:');
  console.log('======================================================\n');

  const r1Dapur = checkSheetAgainstDb(s1DapurBotani, 'dapurbotani', 'Sheet 1: SBQ-Dapur Botani');
  const r1Nutri = checkSheetAgainstDb(s1NutriBake, 'nutribake', 'Sheet 1: SBQ-NutriBake');
  const r1Siasat = checkSheetAgainstDb(s1SiasatSehat, 'siasatsehat', 'Sheet 1: SBQ-Siasat Sehat');

  const r2Dapur = checkSheetAgainstDb(s2DapurBotani, 'dapurbotani', 'Sheet 2: DapurBotani');
  const r2Nutri = checkSheetAgainstDb(s2Nutribake, 'nutribake', 'Sheet 2: Nutribake');

  console.log('1. Sheet 1 - SBQ-Dapur Botani:', {
    total: r1Dapur.totalSheetRows,
    matchedProductsInDb: r1Dapur.matchedProducts,
    unmatchedProductsNotInDb: r1Dapur.unmatchedProductsCount,
    hasExistingAffLinkInDb: r1Dapur.hasExistingAffLink,
    MISSING_AFF_LINK_IN_DB: r1Dapur.missingAffLinkCount,
    differentLinkCount: r1Dapur.diffAffLinkCount
  });

  console.log('2. Sheet 1 - SBQ-NutriBake:', {
    total: r1Nutri.totalSheetRows,
    matchedProductsInDb: r1Nutri.matchedProducts,
    unmatchedProductsNotInDb: r1Nutri.unmatchedProductsCount,
    hasExistingAffLinkInDb: r1Nutri.hasExistingAffLink,
    MISSING_AFF_LINK_IN_DB: r1Nutri.missingAffLinkCount,
    differentLinkCount: r1Nutri.diffAffLinkCount
  });

  console.log('3. Sheet 1 - SBQ-Siasat Sehat:', {
    total: r1Siasat.totalSheetRows,
    matchedProductsInDb: r1Siasat.matchedProducts,
    unmatchedProductsNotInDb: r1Siasat.unmatchedProductsCount,
    hasExistingAffLinkInDb: r1Siasat.hasExistingAffLink,
    MISSING_AFF_LINK_IN_DB: r1Siasat.missingAffLinkCount,
    differentLinkCount: r1Siasat.diffAffLinkCount
  });

  console.log('4. Sheet 2 - DapurBotani:', {
    total: r2Dapur.totalSheetRows,
    matchedProductsInDb: r2Dapur.matchedProducts,
    unmatchedProductsNotInDb: r2Dapur.unmatchedProductsCount,
    hasExistingAffLinkInDb: r2Dapur.hasExistingAffLink,
    MISSING_AFF_LINK_IN_DB: r2Dapur.missingAffLinkCount,
    differentLinkCount: r2Dapur.diffAffLinkCount
  });

  console.log('5. Sheet 2 - Nutribake:', {
    total: r2Nutri.totalSheetRows,
    matchedProductsInDb: r2Nutri.matchedProducts,
    unmatchedProductsNotInDb: r2Nutri.unmatchedProductsCount,
    hasExistingAffLinkInDb: r2Nutri.hasExistingAffLink,
    MISSING_AFF_LINK_IN_DB: r2Nutri.missingAffLinkCount,
    differentLinkCount: r2Nutri.diffAffLinkCount
  });

  // Compare Sheet 1 vs Sheet 2 for DapurBotani and NutriBake
  console.log('\n--- PERBANDINGAN SHEET 1 VS SHEET 2 ---');
  let s1s2DapurSame = 0, s1s2DapurDiff = 0, s1s2DapurMissingInS2 = 0;
  const s2DapurMap = new Map();
  s2DapurBotani.forEach(r => s2DapurMap.set(normalize(r['Nama Produk']), (r['Link Aff'] || '').trim()));
  
  s1DapurBotani.forEach(r => {
    const norm = normalize(r['Nama Produk']);
    const aff1 = (r['Link Aff'] || '').trim();
    if (s2DapurMap.has(norm)) {
      const aff2 = s2DapurMap.get(norm);
      if (aff1 === aff2) s1s2DapurSame++;
      else s1s2DapurDiff++;
    } else {
      s1s2DapurMissingInS2++;
    }
  });
  console.log(`DapurBotani (Sheet 1 vs Sheet 2): Sama link=${s1s2DapurSame}, Beda link=${s1s2DapurDiff}, Ada di S1 tapi tidak ada di S2=${s1s2DapurMissingInS2}`);

  await pool.end();
}

main().catch(console.error);
