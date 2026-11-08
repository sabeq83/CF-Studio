/**
 * Detailed Matching and Comparison Script
 * Matches Google Sheets 1 & 2 against Staging and Dev DB
 */
import { getPgPool } from '../lib/db-pg.js';

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

async function main() {
  console.log('--- 1. LOADING DATA ---');
  // Fetch Sheets
  const s1Dapur = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2045330038');
  const s1Nutri = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '2109968635');
  const s1Siasat = await fetchSheetCsv('1FlRBdGAmi6YnHOTwF8kuKhvoRbMybFPcTAqN6iAv9Rg', '517124521');

  const s2Dapur = await fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '0');
  const s2Nutri = await fetchSheetCsv('1pQtLkEf0BlKTQEc5tHSp-LUlT5PSPu_UZkcFywxEM9g', '2115963239');

  console.log(`Sheet 1: Dapur=${s1Dapur.length}, Nutri=${s1Nutri.length}, Siasat=${s1Siasat.length}`);
  console.log(`Sheet 2: Dapur=${s2Dapur.length}, Nutri=${s2Nutri.length}`);

  const pool = getPgPool();
  
  // Staging products
  const dbProds = (await pool.query(
    `SELECT id, product_name, source_url, affiliate_link FROM staging.product_extractions WHERE tenant_id = 'default_tenant'`
  )).rows;
  console.log(`Staging DB (default_tenant) products: ${dbProds.length}`);

  // Staging Brand Profiles
  const brandProfiles = (await pool.query(
    `SELECT id, brand_name FROM staging.brand_profiles WHERE tenant_id = 'default_tenant'`
  )).rows;
  const bpMap = {};
  brandProfiles.forEach(b => { bpMap[b.brand_name.toLowerCase()] = b.id; });
  console.log('Brand Profiles:', bpMap);

  // Staging Brand Products (existing links)
  const existingBpRows = (await pool.query(`
    SELECT bp.product_id, bp.brand_profile_id, b.brand_name, bp.affiliate_link, bp.is_active, p.product_name
    FROM staging.brand_products bp
    JOIN staging.brand_profiles b ON bp.brand_profile_id = b.id
    JOIN staging.product_extractions p ON bp.product_id = p.id
    WHERE bp.tenant_id = 'default_tenant'
  `)).rows;

  // Index existing brand products: key = `${brand_name.toLowerCase()}:${product_id}`
  const existingBpMap = new Map();
  existingBpRows.forEach(r => {
    existingBpMap.set(`${r.brand_name.toLowerCase()}:${r.product_id}`, r);
  });

  // DB Product Indexes
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

  function findProductInDb(name, productUrl) {
    // 1. By Shopee ID
    if (productUrl) {
      const sId = extractShopeeId(productUrl);
      if (sId && dbByShopeeId.has(sId)) {
        return { product: dbByShopeeId.get(sId), matchType: 'shopee_id' };
      }
    }
    // 2. By Exact Normalized Name
    const norm = normalize(name);
    if (dbByNormName.has(norm)) {
      return { product: dbByNormName.get(norm), matchType: 'exact_name' };
    }
    // 3. By Fuzzy / Substring / Token Match
    const tokens = norm.split(' ').filter(t => t.length > 2);
    let bestMatch = null;
    let maxMatch = 0;
    for (const item of dbAll) {
      let matchCount = 0;
      for (const t of tokens) {
        if (item.normName.includes(t)) matchCount++;
      }
      const score = matchCount / Math.max(tokens.length, item.normName.split(' ').length);
      if (matchCount >= 2 && score > 0.4 && score > maxMatch) {
        maxMatch = score;
        bestMatch = item;
      }
    }
    if (bestMatch) {
      return { product: bestMatch, matchType: 'fuzzy_tokens' };
    }
    return { product: null, matchType: 'none' };
  }

  // Audit function per brand
  function auditBrand(brandName, s1Rows, s2Rows) {
    console.log(`\n======================================================`);
    console.log(`🔎 AUDIT BRAND: ${brandName.toUpperCase()}`);
    console.log(`======================================================`);
    
    // Combine Sheet 1 and Sheet 2 for this brand
    // For DapurBotani & NutriBake: Sheet 1 has Link Product, Sheet 2 has 2 columns
    const combinedEntries = new Map(); // key: norm(product_name)

    // Process Sheet 1 first
    s1Rows.forEach(r => {
      const name = (r['Nama Produk'] || '').trim();
      const aff = (r['Link Aff'] || '').trim();
      const prodUrl = (r['Link Product'] || '').trim();
      const norm = normalize(name);
      if (norm) {
        combinedEntries.set(norm, {
          name,
          affLinkS1: aff,
          affLinkS2: null,
          productUrl: prodUrl,
          source: 'sheet1'
        });
      }
    });

    // Process Sheet 2
    s2Rows.forEach(r => {
      const name = (r['Nama Produk'] || '').trim();
      const aff = (r['Link Aff'] || '').trim();
      const norm = normalize(name);
      if (norm) {
        if (combinedEntries.has(norm)) {
          const entry = combinedEntries.get(norm);
          entry.affLinkS2 = aff;
          entry.source = 'both';
        } else {
          combinedEntries.set(norm, {
            name,
            affLinkS1: null,
            affLinkS2: aff,
            productUrl: null,
            source: 'sheet2'
          });
        }
      }
    });

    console.log(`Total item unik terdaftar di Sheets untuk ${brandName}: ${combinedEntries.size}`);

    let matchedInDb = 0;
    let notInDb = 0;
    let alreadyLinkedWithSameLink = 0;
    let alreadyLinkedWithDifferentLink = 0;
    let missingLinkInDb = 0;

    const missingLinkList = [];
    const differentLinkList = [];
    const notInDbList = [];

    for (const [norm, item] of combinedEntries.entries()) {
      const { product, matchType } = findProductInDb(item.name, item.productUrl);
      const chosenAffLink = item.affLinkS1 || item.affLinkS2;

      if (product) {
        matchedInDb++;
        const linkKey = `${brandName.toLowerCase()}:${product.id}`;
        const existing = existingBpMap.get(linkKey);

        if (existing && existing.affiliate_link) {
          if (existing.affiliate_link === chosenAffLink) {
            alreadyLinkedWithSameLink++;
          } else {
            alreadyLinkedWithDifferentLink++;
            differentLinkList.push({
              productId: product.id,
              dbProductName: product.product_name,
              sheetProductName: item.name,
              dbLink: existing.affiliate_link,
              sheetLink: chosenAffLink,
              source: item.source,
              matchType
            });
          }
        } else {
          missingLinkInDb++;
          missingLinkList.push({
            productId: product.id,
            dbProductName: product.product_name,
            sheetProductName: item.name,
            chosenAffLink,
            affLinkS1: item.affLinkS1,
            affLinkS2: item.affLinkS2,
            productUrl: item.productUrl,
            source: item.source,
            matchType
          });
        }
      } else {
        notInDb++;
        notInDbList.push({
          sheetProductName: item.name,
          chosenAffLink,
          productUrl: item.productUrl,
          source: item.source
        });
      }
    }

    console.log(`- Produk terhubung dengan database: ${matchedInDb}`);
    console.log(`  * Link Aff SUDAH ADA & SESUAI di DB: ${alreadyLinkedWithSameLink}`);
    console.log(`  * Link Aff SUDAH ADA tapi BEDA URL: ${alreadyLinkedWithDifferentLink}`);
    console.log(`  * 🚨 Link Aff BELUM MASUK di DB: ${missingLinkInDb}`);
    console.log(`- Produk di Sheet tetapi BELUM ADA di database produk (product_extractions): ${notInDb}`);

    return {
      brandName,
      totalEntries: combinedEntries.size,
      matchedInDb,
      alreadyLinkedWithSameLink,
      alreadyLinkedWithDifferentLink,
      differentLinkList,
      missingLinkInDb,
      missingLinkList,
      notInDb,
      notInDbList
    };
  }

  const auditDapur = auditBrand('dapurbotani', s1Dapur, s2Dapur);
  const auditNutri = auditBrand('nutribake', s1Nutri, s2Nutri);
  const auditSiasat = auditBrand('siasatsehat', s1Siasat, []);

  console.log('\n======================================================');
  console.log('📌 RINGKASAN SELURUH BRAND:');
  console.log('======================================================');
  console.table([
    {
      Brand: 'DapurBotani',
      Total_Sheet: auditDapur.totalEntries,
      Matched_DB: auditDapur.matchedInDb,
      Sudah_Ada: auditDapur.alreadyLinkedWithSameLink,
      Beda_Link: auditDapur.alreadyLinkedWithDifferentLink,
      BELUM_MASUK: auditDapur.missingLinkInDb,
      Produk_Belum_Ada_Di_DB: auditDapur.notInDb
    },
    {
      Brand: 'NutriBake',
      Total_Sheet: auditNutri.totalEntries,
      Matched_DB: auditNutri.matchedInDb,
      Sudah_Ada: auditNutri.alreadyLinkedWithSameLink,
      Beda_Link: auditNutri.alreadyLinkedWithDifferentLink,
      BELUM_MASUK: auditNutri.missingLinkInDb,
      Produk_Belum_Ada_Di_DB: auditNutri.notInDb
    },
    {
      Brand: 'SiasatSehat',
      Total_Sheet: auditSiasat.totalEntries,
      Matched_DB: auditSiasat.matchedInDb,
      Sudah_Ada: auditSiasat.alreadyLinkedWithSameLink,
      Beda_Link: auditSiasat.alreadyLinkedWithDifferentLink,
      BELUM_MASUK: auditSiasat.missingLinkInDb,
      Produk_Belum_Ada_Di_DB: auditSiasat.notInDb
    }
  ]);

  console.log('\n--- DETAIL PERBEDAAN LINK AFFILIATE (DB VS SHEET) ---');
  if (auditDapur.differentLinkList.length > 0) {
    console.log('DapurBotani Different Links:');
    console.table(auditDapur.differentLinkList.map(d => ({
      product: d.dbProductName.slice(0, 25),
      dbLink: d.dbLink,
      sheetLink: d.sheetLink
    })));
  }
  if (auditNutri.differentLinkList.length > 0) {
    console.log('NutriBake Different Links:');
    console.table(auditNutri.differentLinkList.map(d => ({
      product: d.dbProductName.slice(0, 25),
      dbLink: d.dbLink,
      sheetLink: d.sheetLink
    })));
  }
  if (auditSiasat.differentLinkList.length > 0) {
    console.log('SiasatSehat Different Links:');
    console.table(auditSiasat.differentLinkList.map(d => ({
      product: d.dbProductName.slice(0, 25),
      dbLink: d.dbLink,
      sheetLink: d.sheetLink
    })));
  }

  // Output sample missing items
  console.log('\n--- CONTOH 5 LINK AFF BELUM MASUK (DAPURBOTANI) ---');
  console.table(auditDapur.missingLinkList.slice(0, 5).map(m => ({
    dbName: m.dbProductName.slice(0, 25),
    sheetName: m.sheetProductName.slice(0, 25),
    affLink: m.chosenAffLink,
    matchType: m.matchType
  })));

  console.log('\n--- CONTOH 5 LINK AFF BELUM MASUK (NUTRIBAKE) ---');
  console.table(auditNutri.missingLinkList.slice(0, 5).map(m => ({
    dbName: m.dbProductName.slice(0, 25),
    sheetName: m.sheetProductName.slice(0, 25),
    affLink: m.chosenAffLink,
    matchType: m.matchType
  })));

  console.log('\n--- CONTOH 5 LINK AFF BELUM MASUK (SIASATSEHAT) ---');
  console.table(auditSiasat.missingLinkList.slice(0, 5).map(m => ({
    dbName: m.dbProductName.slice(0, 25),
    sheetName: m.sheetProductName.slice(0, 25),
    affLink: m.chosenAffLink,
    matchType: m.matchType
  })));

  await pool.end();
}

main().catch(console.error);
