/**
 * scripts/heal-scheduled-caption-duplicates.js
 *
 * Skrip Auto-Heal untuk membersihkan duplikasi blok CTA dan hashtag
 * pada item content_flow_items dan antrean publishing_jobs yang sudah terlanjur
 * digenerate sebelum rilis v2.38.1.
 *
 * Penggunaan:
 *   node scripts/heal-scheduled-caption-duplicates.js [--schema staging|dev|public] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { stripCtaAndHashtags, buildPlatformAdaptiveCaptions } from '../lib/smart-affiliate-package-builder.js';

// Load .env.local jika ada dan process.env belum terisi
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvLocal();

const { Pool } = pg;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const schemaArgIdx = args.indexOf('--schema');
const targetSchema = schemaArgIdx !== -1 && args[schemaArgIdx + 1] ? args[schemaArgIdx + 1] : 'staging';

console.log(`[Auto-Heal] Memulai sanitasi caption duplicate...`);
console.log(`[Auto-Heal] Schema: "${targetSchema}" | Mode: ${isDryRun ? 'DRY-RUN (Simulasi)' : 'APPLY (Live Update)'}`);

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 10000
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Cari content_flow_items yang memiliki duplikasi CTA
    const cfQuery = `
      SELECT id, campaign_title, social_media_package_json
      FROM ${targetSchema}.content_flow_items
      WHERE social_media_package_json IS NOT NULL
        AND (
          social_media_package_json->>'caption_bio' LIKE '%👉 Info Bahan/Produk%👉 Info Bahan/Produk%'
          OR social_media_package_json->>'caption_facebook' LIKE '%🛒 Rekomendasi%🛒 Rekomendasi%'
          OR social_media_package_json->>'caption_bio' LIKE '%👉 Info Produk%👉 Info Produk%'
        )
    `;
    const cfRes = await client.query(cfQuery);
    console.log(`\n[Auto-Heal] Ditemukan ${cfRes.rows.length} item content_flow_items dengan duplikasi CTA di schema ${targetSchema}.`);

    const processedJobIds = new Set();

    for (const item of cfRes.rows) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Processing CF Item: ${item.id} - "${item.campaign_title}"`);
      const rawPkg = typeof item.social_media_package_json === 'string'
        ? JSON.parse(item.social_media_package_json)
        : item.social_media_package_json;

      const rawBase = rawPkg.caption || rawPkg.caption_bio || '';
      const cleanBase = stripCtaAndHashtags(rawBase);
      const hashtags = Array.isArray(rawPkg.hashtags) ? rawPkg.hashtags : [];
      const matchedProduct = rawPkg.matched_product || null;

      const adapted = buildPlatformAdaptiveCaptions({
        baseCaption: cleanBase,
        hashtags,
        matchedProduct
      });

      const updatedPkg = {
        ...rawPkg,
        caption: cleanBase,
        caption_facebook: adapted.caption_facebook,
        caption_bio: adapted.caption_bio,
        caption_universal: adapted.caption_universal,
        hashtags: adapted.hashtags
      };

      console.log(`[Auto-Heal] Hasil Sanitasi Caption Bio:`);
      console.log(`  Panjang sebelum: ${rawPkg.caption_bio?.length || 0} karakter`);
      console.log(`  Panjang sesudah: ${adapted.caption_bio?.length || 0} karakter`);
      console.log(`  Jumlah '👉 Info Bahan/Produk': ${(adapted.caption_bio.match(/👉 Info Bahan\/Produk:/g) || []).length}`);

      if (!isDryRun) {
        await client.query(
          `UPDATE ${targetSchema}.content_flow_items SET social_media_package_json = $1 WHERE id = $2`,
          [JSON.stringify(updatedPkg), item.id]
        );
        console.log(`  ✓ Berhasil memperbarui content_flow_items: ${item.id}`);
      }

      // 2. Periksa dan perbarui publishing_jobs yang terkait dengan CF item ini
      const jobsRes = await client.query(
        `SELECT id, platform, status, scheduled_at, caption_snapshot FROM ${targetSchema}.publishing_jobs WHERE content_id = $1`,
        [item.id]
      );

      console.log(`  Terkait dengan ${jobsRes.rows.length} publishing_jobs:`);
      for (const job of jobsRes.rows) {
        processedJobIds.add(job.id);
        let newCaption = adapted.caption_universal;
        if (job.platform === 'facebook') {
          newCaption = adapted.caption_facebook;
        } else if (['instagram', 'tiktok', 'youtube'].includes(job.platform)) {
          newCaption = adapted.caption_bio;
        }

        const oldLen = job.caption_snapshot?.length || 0;
        const newLen = newCaption?.length || 0;
        console.log(`    - Job ${job.id} (${job.platform}, status: ${job.status}, sched: ${job.scheduled_at})`);
        console.log(`      Caption len: ${oldLen} -> ${newLen}`);

        if (!isDryRun) {
          await client.query(
            `UPDATE ${targetSchema}.publishing_jobs SET caption_snapshot = $1 WHERE id = $2`,
            [newCaption, job.id]
          );
          console.log(`      ✓ Updated publishing_jobs: ${job.id}`);
        }
      }
    }

    // 3. Scan mandiri untuk publishing_jobs yang masih scheduled dan memiliki duplikasi yang belum diproses
    console.log(`\n--------------------------------------------------`);
    console.log(`[Auto-Heal] Memeriksa scheduled publishing_jobs yang belum diproses...`);
    const remainingJobsRes = await client.query(`
      SELECT id, content_id, platform, status, caption_snapshot
      FROM ${targetSchema}.publishing_jobs
      WHERE status IN ('scheduled', 'pending')
        AND (
          caption_snapshot LIKE '%👉 Info Bahan/Produk%👉 Info Bahan/Produk%'
          OR caption_snapshot LIKE '%🛒 Rekomendasi%🛒 Rekomendasi%'
          OR caption_snapshot LIKE '%👉 Info Produk%👉 Info Produk%'
        )
    `);

    const unhandledJobs = remainingJobsRes.rows.filter(j => !processedJobIds.has(j.id));
    console.log(`[Auto-Heal] Ditemukan ${unhandledJobs.length} standalone scheduled jobs dengan caption ganda tersisa.`);

    for (const job of unhandledJobs) {
      console.log(`Sanitizing standalone job ${job.id} (${job.platform})...`);
      const cleanText = stripCtaAndHashtags(job.caption_snapshot);
      const adapted = buildPlatformAdaptiveCaptions({
        baseCaption: cleanText,
        hashtags: []
      });
      const finalCaption = job.platform === 'facebook' ? adapted.caption_facebook : adapted.caption_bio;

      if (!isDryRun) {
        await client.query(
          `UPDATE ${targetSchema}.publishing_jobs SET caption_snapshot = $1 WHERE id = $2`,
          [finalCaption, job.id]
        );
        console.log(`  ✓ Updated job ${job.id}`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`[Auto-Heal] Selesai! Semua caption duplikat telah berhasil dibersihkan.`);
    console.log(`==================================================\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[Auto-Heal] Gagal menjalankan auto-heal:', err);
  process.exit(1);
});
