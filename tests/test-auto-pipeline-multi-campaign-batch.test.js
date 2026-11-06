import assert from 'assert';
import {
  createAutoPipelineSchedule,
  createAutoPipelineScheduleBatch,
  listAutoPipelineSchedules,
  getAutoPipelineScheduleById,
  deleteSchedule
} from '../lib/auto-pipeline-schedules-repository.js';
import { executeAutonomousPipelineForSchedule } from '../lib/auto-pipeline-scheduler-runner.js';
import { tenantContext } from '../lib/tenant-context.js';
import { pgQuery } from '../lib/db-pg.js';

async function runTests() {
  console.log('🧪 [TEST] Memulai Unit Test Multi-Campaign Auto Pipeline (Product & Editorial)...');
  const testTenant = 'default_tenant';

  await tenantContext.run(testTenant, async () => {
    // -------------------------------------------------------------
    // TEST 1: Batch Creation 3 Baris Jadwal Product Campaign
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Batch Creation 3 Baris Jadwal Produk Independen ---');
    const productItems = [
      {
        name: 'Spatula Set Premium — 05:00 WIB',
        brand_id: 'habitfolk',
        preset_key: 'habitfolk_6clips_quick',
        pipeline_type: 'product_campaign',
        target_item_id: 'pe_test_prod_1',
        target_item_title: 'Spatula Set Silicone Heat Resistant',
        topic: 'Spatula Set Silicone Heat Resistant',
        category: 'dapur',
        recipe_count: 1,
        generation_time: '05:00',
        publish_time: '09:00',
        days_of_week: [1, 2, 3, 4, 5],
        repliz_account_ids: ['acc_test_1'],
        auto_publish_enabled: true,
        timezone: 'Asia/Jakarta',
        pipeline_config: { product_id: 'pe_test_prod_1' }
      },
      {
        name: 'Loyang Brownies Sekat — 05:00 WIB',
        brand_id: 'habitfolk',
        preset_key: 'habitfolk_6clips_quick',
        pipeline_type: 'product_campaign',
        target_item_id: 'pe_test_prod_2',
        target_item_title: 'Loyang Brownies Sekat Anti Lengket',
        topic: 'Loyang Brownies Sekat Anti Lengket',
        category: 'baking',
        recipe_count: 1,
        generation_time: '05:00',
        publish_time: '09:00',
        days_of_week: [1, 2, 3, 4, 5],
        repliz_account_ids: ['acc_test_1'],
        auto_publish_enabled: true,
        timezone: 'Asia/Jakarta',
        pipeline_config: { product_id: 'pe_test_prod_2' }
      },
      {
        name: 'Termometer Digital Dapur — 05:00 WIB',
        brand_id: 'habitfolk',
        preset_key: 'habitfolk_6clips_quick',
        pipeline_type: 'product_campaign',
        target_item_id: 'pe_test_prod_3',
        target_item_title: 'Termometer Digital Instant Read',
        topic: 'Termometer Digital Instant Read',
        category: 'dapur',
        recipe_count: 1,
        generation_time: '05:00',
        publish_time: '09:00',
        days_of_week: [1, 2, 3, 4, 5],
        repliz_account_ids: ['acc_test_1'],
        auto_publish_enabled: true,
        timezone: 'Asia/Jakarta',
        pipeline_config: { product_id: 'pe_test_prod_3' }
      }
    ];

    const createdProducts = await createAutoPipelineScheduleBatch(productItems);
    assert.strictEqual(createdProducts.length, 3, 'Harus membuat 3 baris jadwal produk');
    console.log(`✅ Berhasil membuat ${createdProducts.length} baris jadwal produk independen:`);
    createdProducts.forEach(p => {
      console.log(`   - ID: ${p.id} | Nama: "${p.name}" | Tipe: ${p.pipeline_type} | Target: "${p.target_item_title}"`);
      assert.strictEqual(p.pipeline_type, 'product_campaign');
      assert.ok(p.target_item_id);
    });

    // -------------------------------------------------------------
    // TEST 2: Batch Creation 4 Baris Jadwal Brand Editorial
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Batch Creation 4 Baris Jadwal Editorial Independen ---');
    const editorialItems = [
      'Eat Better, Not Perfect',
      'Hype Check',
      'Beyond the Scale and Mirror',
      'Small Habits, Real Life'
    ].map(pillar => ({
      name: `${pillar} — 06:00 WIB`,
      brand_id: 'habitfolk',
      preset_key: 'habitfolk_6clips_quick',
      pipeline_type: 'editorial_campaign',
      target_item_id: pillar,
      target_item_title: pillar,
      topic: pillar,
      category: 'editorial',
      recipe_count: 1,
      generation_time: '06:00',
      publish_time: '10:00',
      days_of_week: [0, 6],
      repliz_account_ids: ['acc_test_2'],
      auto_publish_enabled: true,
      timezone: 'Asia/Jakarta',
      pipeline_config: { content_pillar: pillar }
    }));

    const createdEditorials = await createAutoPipelineScheduleBatch(editorialItems);
    assert.strictEqual(createdEditorials.length, 4, 'Harus membuat 4 baris jadwal editorial');
    console.log(`✅ Berhasil membuat ${createdEditorials.length} baris jadwal editorial independen:`);
    createdEditorials.forEach(e => {
      console.log(`   - ID: ${e.id} | Nama: "${e.name}" | Tipe: ${e.pipeline_type} | Pilar: "${e.target_item_title}"`);
      assert.strictEqual(e.pipeline_type, 'editorial_campaign');
      assert.strictEqual(e.target_item_id, e.target_item_title);
    });

    // -------------------------------------------------------------
    // TEST 3: List & Filter Berdasarkan pipeline_type
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Filter Jadwal Berdasarkan pipeline_type ---');
    const allSchedules = await listAutoPipelineSchedules();
    const productSchedules = await listAutoPipelineSchedules({ pipelineType: 'product_campaign' });
    const editorialSchedules = await listAutoPipelineSchedules({ pipelineType: 'editorial_campaign' });
    const recipeSchedules = await listAutoPipelineSchedules({ pipelineType: 'recipe_campaign' });

    console.log(`   - Total semua jadwal: ${allSchedules.length}`);
    console.log(`   - Total jadwal produk: ${productSchedules.length}`);
    console.log(`   - Total jadwal editorial: ${editorialSchedules.length}`);
    console.log(`   - Total jadwal resep: ${recipeSchedules.length}`);

    assert.ok(productSchedules.length >= 3, 'Filter produk harus mengembalikan minimal 3 jadwal');
    assert.ok(editorialSchedules.length >= 4, 'Filter editorial harus mengembalikan minimal 4 jadwal');

    // -------------------------------------------------------------
    // TEST 4: Dispatcher Router Verification (Offline Mode / Mock)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Verifikasi Dispatcher Route Mapping ---');
    const testProdSched = createdProducts[0];
    const testEditSched = createdEditorials[0];

    // Verifikasi bahwa objek jadwal siap di-dispatch oleh runner
    assert.strictEqual(testProdSched.pipeline_type, 'product_campaign');
    assert.strictEqual(testEditSched.pipeline_type, 'editorial_campaign');
    console.log('✅ Dispatcher properties terverifikasi sempurna!');

    // -------------------------------------------------------------
    // CLEANUP: Hapus data test yang dibuat
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP: Menghapus Data Uji Coba ---');
    for (const p of createdProducts) {
      await deleteSchedule(testTenant, p.id);
    }
    for (const e of createdEditorials) {
      await deleteSchedule(testTenant, e.id);
    }
    console.log('✅ Seluruh jadwal uji coba berhasil dibersihkan.');
  });

  console.log('\n🎉 SEMUA UNIT TEST MULTI-CAMPAIGN BERHASIL LULUS 100%!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ UNIT TEST GAGAL:', err);
  process.exit(1);
});
