#!/usr/bin/env node
/**
 * scripts/fix-photo-audit-bloat.mjs
 * 
 * R1 Data Fix Script:
 * Memperbaiki baris database product_extractions yang memiliki raw_response membengkak (> 100KB)
 * akibat buffer biner kandidat foto yang tersimpan di photo_selection_audit.evaluated.
 * 
 * Pemakaian:
 *   node scripts/fix-photo-audit-bloat.mjs --schema staging            # Mode dry-run (default)
 *   node scripts/fix-photo-audit-bloat.mjs --schema staging --apply    # Terapkan perubahan
 */

import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { toAuditCandidate } from '../lib/product-photo-picker.js';

export function compactRawResponse(rawResponseStr) {
  if (!rawResponseStr || typeof rawResponseStr !== 'string') return null;
  try {
    const data = JSON.parse(rawResponseStr);
    if (!data.photo_selection_audit) return null;

    let modified = false;
    const audit = data.photo_selection_audit;

    if (Array.isArray(audit.evaluated)) {
      const compactedEvaluated = audit.evaluated.map(cand => {
        // Cek apakah ada field biner atau buffer
        if (cand.buffer || cand.localPath || cand.tempPath || (typeof cand.buffer === 'object')) {
          modified = true;
        }
        return toAuditCandidate(cand);
      });
      audit.evaluated = compactedEvaluated;
    }

    if (audit.selectedCandidate) {
      if (audit.selectedCandidate.buffer || audit.selectedCandidate.localPath) {
        modified = true;
      }
      audit.selectedCandidate = toAuditCandidate(audit.selectedCandidate);
    }

    if (data.photo_selection_audit.evaluation) {
      // Hapus nested evaluation duplikat jika ada
      delete data.photo_selection_audit.evaluation;
      modified = true;
    }

    return modified ? JSON.stringify(data) : null;
  } catch (err) {
    return null;
  }
}

async function run({ pool, targetSchema, isApply } = {}) {
  console.log(`================================================================`);
  console.log(`🛠️ DATA FIX: PRUNE PHOTO AUDIT BLOAT`);
  console.log(`Schema: ${targetSchema}`);
  console.log(`Mode: ${isApply ? '🚀 APPLY (Menulis ke database)' : '🔍 DRY-RUN (Hanya simulasi)'}`);
  console.log(`================================================================\n`);

  try {
    const client = await pool.connect();
    // Set search_path sesuai schema target
    await client.query(`SET search_path TO ${targetSchema}`);

    // Query produk dengan raw_response > 100KB dan memuat photo_selection_audit
    const query = `
      SELECT id, product_name, length(raw_response) as orig_len, raw_response
      FROM product_extractions
      WHERE length(raw_response) > 100000
        AND raw_response LIKE '%photo_selection_audit%'
      ORDER BY orig_len DESC
    `;

    const { rows } = await client.query(query);
    console.log(`Ditemukan ${rows.length} produk dengan raw_response membengkak (> 100KB).\n`);

    if (rows.length === 0) {
      console.log(`✅ Tidak ada produk yang memerlukan perbaikan audit bloat.`);
      client.release();
      await pool.end();
      return;
    }

    let totalSavedBytes = 0;

    for (const row of rows) {
      const compacted = compactRawResponse(row.raw_response);
      if (!compacted) {
        console.log(`- [Lewati] ID: ${row.id} - ${row.product_name} (Tidak ada buffer biner terdeteksi).`);
        continue;
      }

      const beforeLen = row.orig_len;
      const afterLen = compacted.length;
      const saved = beforeLen - afterLen;
      totalSavedBytes += saved;

      const beforeKb = (beforeLen / 1024).toFixed(1);
      const afterKb = (afterLen / 1024).toFixed(1);
      const reduction = (((beforeLen - afterLen) / beforeLen) * 100).toFixed(1);

      console.log(`- ID: ${row.id} | ${row.product_name}`);
      console.log(`  Ukuran: ${beforeKb} KB ➔ ${afterKb} KB (Hemat: ${reduction}%)`);

      if (isApply) {
        await client.query(
          `UPDATE product_extractions SET raw_response = $1 WHERE id = $2`,
          [compacted, row.id]
        );
        console.log(`  ✅ Berhasil diperbarui di database.`);
      }
    }

    console.log(`\n----------------------------------------------------------------`);
    console.log(`Total Penghematan: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
    if (!isApply) {
      console.log(`ℹ️ Ini adalah simulasi DRY-RUN. Jalankan dengan flag --apply untuk menyimpan.`);
    } else {
      console.log(`🎉 Seluruh data berhasil dipadatkan!`);
    }
    console.log(`================================================================`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Terjadi kesalahan:', err);
    await pool.end();
    process.exit(1);
  }
}

// Jalankan jika dieksekusi langsung dari CLI
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const schemaIndex = args.indexOf('--schema');
  const targetSchema = schemaIndex !== -1 ? args[schemaIndex + 1] : null;

  if (!targetSchema || !['dev', 'staging'].includes(targetSchema)) {
    console.error('❌ Error: Parameter --schema dev atau --schema staging WAJIB diberikan.');
    console.error('⚠️ Larangan: Schema public (production) DILARANG KERAS untuk keamanan data.');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST || '100.78.186.123',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'makna_user',
    password: process.env.DB_PASSWORD || 'maknagridpass',
    database: process.env.DB_NAME || 'maknaflow_db'
  });

  run({ pool, targetSchema, isApply });
}
