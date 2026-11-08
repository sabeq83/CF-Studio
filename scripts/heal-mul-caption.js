/**
 * Auto-Heal Script for mul_261108_s6so1p
 * Memperbarui caption Facebook dengan link Shopee aktif dari produk brand Nutribake
 */

import { getDb, dbRun, dbGet, dbAll } from '../lib/db.js';
import { buildPlatformAdaptiveCaptions, selectBestProductMatch } from '../lib/smart-affiliate-package-builder.js';

async function healMultiplierCaption(taskId = 'mul_261108_s6so1p') {
  console.log(`[Auto-Heal] Memulai perbaikan caption untuk task: ${taskId}...`);
  const db = getDb();

  const task = await dbGet('SELECT * FROM re_multiplier_tasks WHERE id = ?', [taskId]);
  if (!task) {
    console.warn(`[Auto-Heal] Task ${taskId} tidak ditemukan di schema aktif.`);
    return;
  }

  console.log(`[Auto-Heal] Task ditemukan: "${task.campaign_name}" (Brand: ${task.account_name})`);

  // 1. Ambil produk aktif brand Nutribake
  const brandProducts = await dbAll(`
    SELECT bp.product_id, bp.affiliate_link, pe.product_name, pe.category, pe.unique_selling_point
    FROM brand_products bp
    JOIN product_extractions pe ON bp.product_id = pe.id
    LEFT JOIN brand_profiles bp_prof ON bp.brand_profile_id = bp_prof.id
    WHERE (bp.brand_profile_id = ? OR bp_prof.brand_name ILIKE ?)
      AND bp.is_active = TRUE
      AND bp.affiliate_link IS NOT NULL
      AND bp.affiliate_link != ''
  `, [task.brand_profile_id || '940e766b-76d0-49b7-b6d5-01dfb0041d40', `%${task.account_name || 'nutribake'}%`]);

  console.log(`[Auto-Heal] Ditemukan ${brandProducts.length} produk aktif dengan link Shopee.`);

  if (brandProducts.length === 0) {
    console.warn('[Auto-Heal] Tidak ada produk aktif dengan link Shopee untuk brand ini.');
    return;
  }

  // 2. Cocokkan produk terbaik dengan topik brownies camilan
  const topic = task.campaign_name || 'Solusi Cepat Camilan Sore Tanpa Terigu Buat Pekerja Kantoran';
  const matchedProduct = selectBestProductMatch({
    products: brandProducts,
    topic
  });

  console.log(`[Auto-Heal] Produk terpilih: "${matchedProduct.product_name}" (Link: ${matchedProduct.affiliate_link})`);

  // 3. Bangun paket caption adaptif
  const baseCaption = 'Jam 4 sore emang paling rawan lapar mata di kantor. Daripada jajan sembarangan yang bikin lemas, yuk bikin camilan sehat tanpa terigu ini! Cuma pakai pisang, telur, dan cokelat bubuk, rasanya tetap legit dan pastinya ramah buat energi sore kamu. Simpan resepnya sekarang juga! ✨';
  const hashtags = ['#Shorts', '#CamilanSehat', '#ResepTanpaTerigu', '#BrowniesSehat', '#TipsKesehatan'];

  const adapted = buildPlatformAdaptiveCaptions({
    baseCaption,
    hashtags,
    matchedProduct
  });

  // 4. Update bridging_config_json
  let bridging = {};
  try {
    bridging = JSON.parse(task.bridging_config_json || '{}');
  } catch (_) {}

  bridging.social_media_package = {
    title: task.yt_title || 'Solusi Cepat Camilan Sore Tanpa Terigu Buat Pekerja Kantoran #Shorts',
    ...adapted
  };

  await dbRun(`
    UPDATE re_multiplier_tasks
    SET new_caption = ?, bridging_config_json = ?
    WHERE id = ?
  `, [adapted.caption_facebook, JSON.stringify(bridging), taskId]);

  console.log(`[Auto-Heal] Berhasil memperbarui task ${taskId}!`);
  console.log(`[Auto-Heal] Caption Facebook Baru:\n---\n${adapted.caption_facebook}\n---`);
  console.log(`[Auto-Heal] Caption Bio Baru:\n---\n${adapted.caption_bio}\n---`);
}

// Eksekusi jika dijalankan langsung
healMultiplierCaption()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[Auto-Heal] Error:', err);
    process.exit(1);
  });
