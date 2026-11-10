import { executeAutonomousThreadsSeriesPipeline } from '../lib/threads-series-pipeline.js';
import { pgQuery } from '../lib/db-pg.js';

async function runTest() {
  console.log('=== Test Eksekusi Threads Series Pipeline ===');
  
  try {
    const result = await executeAutonomousThreadsSeriesPipeline({
      schedule: {
        id: `test_${Date.now()}`,
        auto_publish_enabled: false // Jangan publish beneran ke repliz saat unit test
      },
      pipelineConfig: {
        post_objective: 'personal_product',
        personal_product_name: 'Kost Sasya House Exclusive Paviliun',
        personal_product_cta: 'DM langsung ke Instagram @sasyahouse atau WA 0812345678 untuk jadwal survei!',
        visual_mode: 'none' // Text-only mode untuk test cepat
      },
      tenantId: 'tnt_sy-benu_415f99',
      targetPublishIso: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });

    console.log('Pipeline Result:', {
      success: result.success,
      post_id: result.post_id,
      theme: result.theme,
      status: result.status,
      series_count: result.series?.length,
      scheduled_at: result.scheduled_at
    });

    // Verifikasi data di database
    const dbCheck = await pgQuery('SELECT * FROM threads_series_posts WHERE id = $1', [result.post_id]);
    if (dbCheck.rowCount > 0) {
      const row = dbCheck.rows[0];
      console.log('✅ DB Record Verified:');
      console.log(`- ID: ${row.id}`);
      console.log(`- Theme: ${row.theme}`);
      console.log(`- Objective: ${row.post_objective}`);
      console.log(`- Series Count: ${row.series_count}`);
      console.log(`- Part 1 (Hook): ${row.part_1_text.slice(0, 80)}...`);
      console.log(`- Part 5 (CTA): ${row.part_5_text.slice(0, 80)}...`);
    } else {
      throw new Error('Record tidak ditemukan di database threads_series_posts!');
    }

    console.log('=== Test Pipeline Selesai & Berhasil 100%! ===');
    process.exit(0);
  } catch (err) {
    console.error('❌ Pipeline Test Error:', err);
    process.exit(1);
  }
}

runTest();
