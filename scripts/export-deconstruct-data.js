import { pgQuery } from '../lib/db-pg.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const query = `
    SELECT 
      id, 
      source_url, 
      status, 
      niche, 
      original_caption, 
      created_at 
    FROM staging.re_deconstructed_assets 
    ORDER BY created_at DESC
  `;
  const res = await pgQuery(query);
  const rows = res.rows;
  console.log(`Fetched ${rows.length} rows from staging.re_deconstructed_assets.`);

  const csvEscape = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // 1. Export Simple UUID & URL CSV
  const simpleCsvRows = ['UUID,URL'];
  for (const r of rows) {
    simpleCsvRows.push(`${csvEscape(r.id)},${csvEscape(r.source_url)}`);
  }
  const simpleCsvPath = path.join(process.cwd(), 'public', 'deconstruct_uuid_url.csv');
  fs.writeFileSync(simpleCsvPath, simpleCsvRows.join('\n'));
  console.log(`✓ Saved simple UUID & URL CSV to ${simpleCsvPath}`);

  // 2. Export Full Metadata CSV
  const fullCsvRows = ['UUID,URL,Status,Niche,Created_At,Original_Caption'];
  for (const r of rows) {
    const captionClean = (r.original_caption || '').replace(/[\r\n]+/g, ' ').slice(0, 200);
    fullCsvRows.push([
      csvEscape(r.id),
      csvEscape(r.source_url),
      csvEscape(r.status),
      csvEscape(r.niche),
      csvEscape(r.created_at ? new Date(r.created_at).toISOString() : ''),
      csvEscape(captionClean)
    ].join(','));
  }
  const fullCsvPath = path.join(process.cwd(), 'public', 'deconstruct_export_full.csv');
  fs.writeFileSync(fullCsvPath, fullCsvRows.join('\n'));
  console.log(`✓ Saved full CSV to ${fullCsvPath}`);

  // 3. Export JSON
  const jsonPath = path.join(process.cwd(), 'public', 'deconstruct_export.json');
  fs.writeFileSync(jsonPath, JSON.stringify(rows.map(r => ({
    id: r.id,
    source_url: r.source_url,
    status: r.status,
    niche: r.niche,
    created_at: r.created_at
  })), null, 2));
  console.log(`✓ Saved JSON to ${jsonPath}`);

  // Also check dev schema just in case user wants dev data as well
  const devRes = await pgQuery(`
    SELECT id, source_url, status, niche, created_at 
    FROM dev.re_deconstructed_assets 
    ORDER BY created_at DESC
  `);
  console.log(`Fetched ${devRes.rows.length} rows from dev.re_deconstructed_assets.`);
  if (devRes.rows.length > 0) {
    const devCsvRows = ['UUID,URL,Status,Niche,Created_At'];
    for (const r of devRes.rows) {
      devCsvRows.push([
        csvEscape(r.id),
        csvEscape(r.source_url),
        csvEscape(r.status),
        csvEscape(r.niche),
        csvEscape(r.created_at ? new Date(r.created_at).toISOString() : '')
      ].join(','));
    }
    const devCsvPath = path.join(process.cwd(), 'public', 'deconstruct_dev_uuid_url.csv');
    fs.writeFileSync(devCsvPath, devCsvRows.join('\n'));
    console.log(`✓ Saved dev CSV to ${devCsvPath}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});

