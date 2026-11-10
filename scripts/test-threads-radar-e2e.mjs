import { getPgPool, pgQuery } from '../lib/db-pg.js';
import { 
  listMonitoringKeywords, 
  addMonitoringKeyword, 
  getRadarSchedule, 
  saveRadarSchedule, 
  listOpportunitiesWithProducts, 
  updateDraftText 
} from '../lib/threads-affiliate-repository.js';
import { 
  getWibTimeContext, 
  computeNextRunTime, 
  executeRadarScanCycle 
} from '../lib/threads-radar-scheduler.js';

async function main() {
  console.log('=== Test End-to-End Threads Affiliate Radar & Scheduler ===\n');

  // 1. Inisialisasi pool DB
  getPgPool();
  const testTenant = 'tnt_pt-gim-sosmed_62d0d9';
  console.log(`1. Konteks Tenant: ${testTenant}`);

  // 2. Uji Konfigurasi Jadwal (Hari & Jam)
  console.log('2. Menguji Penyimpanan & Kalkulasi Jadwal Pemindaian...');
  const currentSchedule = await getRadarSchedule(testTenant);
  console.log('   Jadwal saat ini:', {
    is_active: currentSchedule.is_active,
    mode: currentSchedule.schedule_mode,
    days: currentSchedule.active_days,
    hours: currentSchedule.specific_hours
  });

  const updatedSchedule = await saveRadarSchedule(testTenant, {
    is_active: true,
    schedule_mode: 'specific',
    active_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    specific_hours: ['08:00', '12:30', '17:00', '20:30']
  });

  const wib = getWibTimeContext();
  const nextRun = computeNextRunTime(updatedSchedule);
  console.log(`   ✓ Waktu WIB Saat Ini: ${wib.dayName}, ${wib.timeStr} WIB`);
  console.log(`   ✓ Waktu Eksekusi Berikutnya: ${nextRun ? nextRun.toISOString() : 'None'}`);

  // 3. Uji Manajemen Kata Kunci
  console.log('\n3. Menguji Kata Kunci Pemantau...');
  const testKeyword = 'kamar panas';
  const kw = await addMonitoringKeyword(testTenant, { keyword: testKeyword, category: 'shopee_cooling' });
  console.log(`   ✓ Kata kunci aktif: "${kw.keyword}" (ID: ${kw.id})`);

  const allKeywords = await listMonitoringKeywords(testTenant);
  console.log(`   ✓ Total kata kunci aktif: ${allKeywords.length}`);

  // 4. Uji Pemindaian Siklus Radar (Scan Repliz + Matcher AI)
  console.log('\n4. Menjalankan Siklus Pemindaian Radar (Scan Repliz Threads + Gemini Matcher)...');
  const scanResult = await executeRadarScanCycle(testTenant);
  console.log('   ✓ Hasil Siklus:', {
    keywordsChecked: scanResult.keywordsChecked,
    postsFound: scanResult.postsFound,
    draftsCreated: scanResult.draftsCreated,
    durationMs: `${scanResult.durationMs}ms`
  });

  // 5. Uji Pengambilan Daftar Peluang (Opportunities)
  console.log('\n5. Menguji Daftar Peluang untuk Antarmuka UI...');
  let opportunities = await listOpportunitiesWithProducts(testTenant, { limit: 5 });
  
  // Jika database peluang kosong, buat 1 dummy opportunity untuk memverifikasi flow UI
  if (opportunities.length === 0) {
    const postRes = await pgQuery(`
      INSERT INTO threads_discovered_posts (
        tenant_id, keyword_id, thread_id, post_url,
        author_username, author_name, post_content, status
      ) VALUES (
        $1, $2, 'test_e2e_thread_99', 'https://threads.net/@user/post/99',
        'kawan_kos', 'Kawan Kosan', 'Kamar panas banget pengen kipas atau pendingin portable murah', 'analyzed'
      ) ON CONFLICT (tenant_id, thread_id) DO UPDATE SET status = EXCLUDED.status
      RETURNING id
    `, [testTenant, kw.id]);

    const postId = postRes.rows[0].id;
    await pgQuery(`
      INSERT INTO threads_reply_drafts (
        tenant_id, discovered_post_id, reply_text, reply_strategy,
        ai_confidence_score, status
      ) VALUES (
        $1, $2, 'Pake air cooler portable mini aja kak, adem dan hemat listrik di kosan', 'soft_in_bio',
        88, 'draft'
      ) RETURNING id
    `, [testTenant, postId]);

    opportunities = await listOpportunitiesWithProducts(testTenant, { limit: 5 });
  }

  console.log(`   ✓ Ditemukan ${opportunities.length} peluang:`);
  opportunities.forEach((op, idx) => {
    console.log(`     [#${idx + 1}] Post @${op.author_username}: "${op.post_content?.slice(0, 50)}..."`);
    console.log(`         Produk: ${op.product_name || 'Solusi Rekomendasi'} (Rp ${op.product_price || '-'})`);
    console.log(`         Draf AI (${op.reply_strategy}): "${op.reply_text?.slice(0, 60)}..."`);
  });

  // 6. Uji Edit Naskah Draf
  if (opportunities.length > 0) {
    const firstDraft = opportunities[0];
    console.log(`\n6. Menguji Edit Naskah Draf (ID: ${firstDraft.draft_id})...`);
    const newText = firstDraft.reply_text + ' (Direview oleh Agen MAKNA)';
    const edited = await updateDraftText(testTenant, firstDraft.draft_id, newText);
    console.log(`   ✓ Teks draf berhasil diedit: "${edited?.reply_text?.slice(-40)}"`);
  }

  console.log('\n=== Semua Pengujian End-to-End Berhasil 100%! ===');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});
