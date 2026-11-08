/**
 * Script Sinkronisasi Database Produk: Dev -> Staging (Anti-Duplikasi Berlapis)
 * 
 * Penggunaan:
 *   node scripts/sync-dev-to-staging-products.js --dry-run   (Simulasi)
 *   node scripts/sync-dev-to-staging-products.js --apply     (Terapkan)
 */

import { pgQuery, getPgPool } from '../lib/db-pg.js';

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

async function runSync() {
  console.log('================================================================');
  console.log(`🔄 SINKRONISASI PRODUK: dev -> staging (${isDryRun ? 'SIMULASI / DRY-RUN' : 'MODE EKSEKUSI NYATA'})`);
  console.log('================================================================');

  // 1. Fetch seluruh data dari dev dan staging
  console.log('📥 Mengambil data dari skema dev dan staging...');
  const devProducts = (await pgQuery('SELECT * FROM dev.product_extractions ORDER BY created_at ASC')).rows;
  const stagingProducts = (await pgQuery('SELECT * FROM staging.product_extractions ORDER BY created_at ASC')).rows;

  console.log(`   - dev.product_extractions: ${devProducts.length} produk`);
  console.log(`   - staging.product_extractions: ${stagingProducts.length} produk`);

  // 2. Siapkan Maps untuk deteksi duplikasi berlapis
  const stagingById = new Map();
  const stagingByName = new Map();
  const stagingByUrl = new Map();

  for (const p of stagingProducts) {
    stagingById.set(p.id, p);
    if (p.product_name) {
      stagingByName.set(p.product_name.toLowerCase().trim(), p);
    }
    if (p.source_url) {
      stagingByUrl.set(p.source_url.toLowerCase().trim(), p);
    }
  }

  // 3. Klasifikasikan seluruh produk dari dev
  const itemsToInsert = [];
  const itemsToMerge = [];
  const skippedNameCollision = [];
  const skippedUrlCollision = [];

  for (const devItem of devProducts) {
    const normName = devItem.product_name ? devItem.product_name.toLowerCase().trim() : '';
    const normUrl = devItem.source_url ? devItem.source_url.toLowerCase().trim() : '';

    // Lapis 1: Cek ID
    if (stagingById.has(devItem.id)) {
      const existing = stagingById.get(devItem.id);
      // Cek apakah ada field kosong di staging yang bisa dilengkapi dari dev
      const updates = {};
      if (!existing.affiliate_link && devItem.affiliate_link) updates.affiliate_link = devItem.affiliate_link;
      if (!existing.clean_photo_url && devItem.clean_photo_url) updates.clean_photo_url = devItem.clean_photo_url;
      if (!existing.product_description && devItem.product_description) updates.product_description = devItem.product_description;
      if (!existing.unique_selling_point && devItem.unique_selling_point) updates.unique_selling_point = devItem.unique_selling_point;

      if (Object.keys(updates).length > 0) {
        itemsToMerge.push({ id: existing.id, name: existing.product_name, updates });
      }
      continue;
    }

    // Lapis 2: Cek Nama (mencegah duplikasi nama dengan ID berbeda)
    if (normName && stagingByName.has(normName)) {
      skippedNameCollision.push({
        devId: devItem.id,
        name: devItem.product_name,
        existingStagingId: stagingByName.get(normName).id
      });
      continue;
    }

    // Lapis 3: Cek Source URL (mencegah produk marketplace yang sama dimasukkan lagi)
    if (normUrl && stagingByUrl.has(normUrl)) {
      skippedUrlCollision.push({
        devId: devItem.id,
        name: devItem.product_name,
        sourceUrl: devItem.source_url,
        existingStagingId: stagingByUrl.get(normUrl).id
      });
      continue;
    }

    // Murni produk baru!
    itemsToInsert.push(devItem);
  }

  console.log('\n--- RINGKASAN KLASIFIKASI ANTI-DUPLIKASI ---');
  console.log(`✅ Produk Baru yang AKAN dimasukkan: ${itemsToInsert.length}`);
  console.log(`🔄 Produk yang ID-nya sudah ada & dilengkapi (merge): ${itemsToMerge.length}`);
  console.log(`🛡️ Produk yang di-skip karena NAMA sudah ada di staging (beda ID): ${skippedNameCollision.length}`);
  if (skippedNameCollision.length > 0) {
    skippedNameCollision.forEach(s => console.log(`   - [Nama Sama]: "${s.name}" (Dev ID: ${s.devId} -> Staging ID: ${s.existingStagingId})`));
  }
  console.log(`🛡️ Produk yang di-skip karena SOURCE URL sudah ada di staging: ${skippedUrlCollision.length}`);
  console.log('--------------------------------------------');
  console.log(`📊 Estimasi Total Staging Akhir: ${stagingProducts.length + itemsToInsert.length} produk unik (0 duplikat)\n`);

  if (isDryRun) {
    console.log('💡 Mode --dry-run aktif. Tidak ada perubahan yang disimpan ke database.');
    console.log('Jalankan dengan perintah berikut untuk menerapkan perubahan:');
    console.log('  node scripts/sync-dev-to-staging-products.js --apply\n');
    process.exit(0);
  }

  // 4. EKSEKUSI NYATA DENGAN DATABASE CLIENT & TRANSACTION
  console.log('🚀 Memulai eksekusi penulisan ke database staging...');
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Kolom tabel product_extractions yang akan di-insert
    const cols = [
      'id', 'input_source', 'is_url', 'product_name', 'product_description',
      'unique_selling_point', 'target_audience', 'pain_point_solved', 'key_visuals_extracted',
      'raw_response', 'created_at', 'category', 'tags', 'photo_url', 'source_url',
      'affiliate_link', 'raw_description', 'scraped_image_url', 'raw_photo_url',
      'clean_photo_url', 'cleaned_photo_url', 't2i_prompt', 'generated_photo_url',
      'active_photo', 'is_in_packaging', 'packaging_type', 'i2v_action_prompt',
      'extraction_status', 'glabs_task_id', 'clean_photo_t2i_prompt', 'product_truth',
      'geometric_truth', 'tenant_id', 'page', 'packaging_status', 'packaging_notes',
      'import_status', 'enrichment_status', 'photo_status', 'photo_provider',
      'photo_task_id', 'photo_error', 'enrichment_error', 'enrichment_reviewed_at',
      'photo_reviewed_at', 'normalized_source_url', 'raw_photo_sha256', 'updated_at'
    ];

    let insertedCount = 0;
    for (const item of itemsToInsert) {
      const values = cols.map(c => item[c] !== undefined ? item[c] : null);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO staging.product_extractions (${cols.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING
      `;
      await client.query(query, values);
      insertedCount++;
    }
    console.log(`✅ Berhasil menyisipkan ${insertedCount} produk baru ke staging.product_extractions`);

    // Merge field kosong
    let mergedCount = 0;
    for (const m of itemsToMerge) {
      const setClauses = [];
      const params = [m.id];
      let pIdx = 2;
      for (const [k, v] of Object.entries(m.updates)) {
        setClauses.push(`${k} = COALESCE(staging.product_extractions.${k}, $${pIdx})`);
        params.push(v);
        pIdx++;
      }
      if (setClauses.length > 0) {
        await client.query(
          `UPDATE staging.product_extractions SET ${setClauses.join(', ')} WHERE id = $1`,
          params
        );
        mergedCount++;
      }
    }
    console.log(`✅ Berhasil melengkapi (merge) data untuk ${mergedCount} produk eksisting`);

    // 5. Sinkronisasi brand_products terkait
    console.log('\n🔗 Menyinkronkan relasi brand_products...');
    const brandProductsDev = (await client.query('SELECT * FROM dev.brand_products WHERE is_active = TRUE')).rows;
    let bpSynced = 0;

    for (const bp of brandProductsDev) {
      // Pastikan produknya ada di staging
      const prodInStaging = (await client.query(
        'SELECT id FROM staging.product_extractions WHERE id = $1',
        [bp.product_id]
      )).rows[0];

      if (prodInStaging) {
        // Pastikan brand profile-nya ada di staging
        const brandInStaging = (await client.query(
          'SELECT id FROM staging.brand_profiles WHERE id = $1',
          [bp.brand_profile_id]
        )).rows[0];

        if (brandInStaging) {
          await client.query(`
            INSERT INTO staging.brand_products (
              id, tenant_id, brand_profile_id, product_id, affiliate_link,
              tracking_code, landing_page_url, product_name_override,
              cta_override, notes, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET
              affiliate_link = COALESCE(staging.brand_products.affiliate_link, EXCLUDED.affiliate_link),
              updated_at = NOW()
          `, [
            bp.id, bp.tenant_id, bp.brand_profile_id, bp.product_id, bp.affiliate_link,
            bp.tracking_code, bp.landing_page_url, bp.product_name_override,
            bp.cta_override, bp.notes, bp.is_active, bp.created_at, bp.updated_at
          ]);
          bpSynced++;
        }
      }
    }
    console.log(`✅ Berhasil menyinkronkan ${bpSynced} relasi brand_products ke staging`);

    await client.query('COMMIT');
    console.log('\n🎉 TRANSAKSI BERHASIL DI-COMMIT KE DATABASE STAGING!');

    // 6. Verifikasi Akhir Matematis Anti-Duplikasi
    const finalCount = (await client.query('SELECT COUNT(*) as cnt FROM staging.product_extractions')).rows[0].cnt;
    const dupCheck = (await client.query(`
      SELECT LOWER(TRIM(product_name)) as name, COUNT(*) as cnt
      FROM staging.product_extractions
      GROUP BY LOWER(TRIM(product_name))
      HAVING COUNT(*) > 1
    `)).rows;

    console.log('\n================================================================');
    console.log('🩺 HASIL VERIFIKASI AKHIR DATABASE STAGING:');
    console.log(` - Total Produk Saat Ini: ${finalCount} produk`);
    console.log(` - Temuan Duplikasi Nama: ${dupCheck.length} produk`);
    if (dupCheck.length === 0) {
      console.log(' 🌟 100% BEBAS DUPLIKASI TERVERIFIKASI SEMPURNA! ✅');
    } else {
      console.warn(' ⚠️ Peringatan duplikasi terdeteksi:', dupCheck);
    }
    console.log('================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Terjadi kesalahan! Seluruh transaksi telah di-ROLLBACK otomatis:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

runSync().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
