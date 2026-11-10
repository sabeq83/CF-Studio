import { getPgPool, pgQuery } from '../lib/db-pg.js';
import { listReplizAccounts, searchReplizThreadsContent, redactCredentials } from '../lib/repliz-client.js';

async function getTenantReplizSetting(key, tenantId = null) {
  const schema = process.env.PG_SEARCH_PATH?.split(',')[0] || 'staging';
  let query = `SELECT setting_value FROM ${schema}.tenant_settings WHERE setting_key = $1`;
  let params = [key];
  if (tenantId) {
    query += ` AND tenant_id = $2`;
    params.push(tenantId);
  }
  query += ` ORDER BY CASE WHEN tenant_id = 'tnt_pt-gim-sosmed_62d0d9' THEN 1 WHEN tenant_id = 'default_tenant' THEN 2 ELSE 3 END LIMIT 1`;
  try {
    const res = await pgQuery(query, params);
    return res.rows[0]?.setting_value || null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('=== Uji Coba Repliz Threads Search API (Fase 1 Smoke Test) ===\n');

  // Pastikan pool terinisialisasi
  getPgPool();

  const tenantArg = process.argv.find(a => a.startsWith('--tenant='))?.split('=')[1] || 'tnt_pt-gim-sosmed_62d0d9';
  console.log(`Menggunakan konteks tenant: ${tenantArg} (schema: ${process.env.PG_SEARCH_PATH || 'staging'})`);

  const accessKey = process.env.REPLIZ_ACCESS_KEY || await getTenantReplizSetting('repliz_access_key', tenantArg);
  const secretKey = process.env.REPLIZ_SECRET_KEY || await getTenantReplizSetting('repliz_secret_key', tenantArg);
  const apiUrl = process.env.REPLIZ_API_URL || await getTenantReplizSetting('repliz_api_url', tenantArg) || 'https://api.repliz.com';

  if (!accessKey || !secretKey) {
    console.error('❌ Error: Kredensial Repliz (accessKey & secretKey) belum dikonfigurasi di database tenant_settings atau .env.local.');
    process.exit(1);
  }

  const credentials = { apiUrl, accessKey, secretKey };
  console.log('1. Menguji koneksi & mengambil daftar akun terhubung di Repliz...');

  let accounts = [];
  try {
    accounts = await listReplizAccounts(credentials);
    console.log(`   ✓ Berhasil terhubung ke Repliz! Ditemukan total ${accounts.length} akun terdaftar.`);
  } catch (err) {
    console.error(`   ❌ Gagal terhubung ke Repliz: ${redactCredentials(err.message)}`);
    process.exit(1);
  }

  // Cari akun dengan platform 'threads' (di Repliz field-nya adalah 'type' atau 'platform')
  const threadsAccounts = accounts.filter(acc => {
    const platform = String(acc.type || acc.platform || '').toLowerCase();
    return platform === 'threads';
  });

  console.log(`\n2. Memeriksa Akun Threads: Ditemukan ${threadsAccounts.length} akun Threads.`);
  if (threadsAccounts.length === 0) {
    console.warn('   ⚠️ Tidak ada akun Threads yang terhubung di Repliz saat ini.');
    console.log('   Daftar akun yang ada:');
    accounts.forEach(a => console.log(`   - Platform: ${a.platform}, Username: ${a.username || a.name || a._id}, Status: ${a.status}`));
    console.log('\n💡 Rekomendasi: Hubungkan akun Threads di workspace Repliz agar pencarian publik dapat dijalankan.');
    process.exit(0);
  }

  const targetAccount = threadsAccounts[0];
  const accountId = targetAccount._id || targetAccount.id;
  console.log(`   ✓ Menggunakan akun Threads: @${targetAccount.username || targetAccount.name} (ID: ${accountId})`);

  const testKeyword = 'kamar panas';
  console.log(`\n3. Melakukan pencarian keyword "${testKeyword}" di Threads via Repliz...`);

  try {
    const searchRes = await searchReplizThreadsContent(credentials, {
      accountId,
      search: testKeyword,
      sort: 'RECENT',
      mode: 'KEYWORD'
    });

    console.log('   ✓ Panggilan API Berhasil!');
    const docs = searchRes?.docs || searchRes?.data || [];
    console.log(`   ✓ Total hasil ditemukan: ${docs.length} postingan.`);

    if (docs.length > 0) {
      console.log('\n--- Contoh 3 Postingan Teratas ---');
      docs.slice(0, 3).forEach((item, idx) => {
        console.log(`\n[Post ${idx + 1}]`);
        console.log(`ID: ${item.id}`);
        console.log(`Penulis: ${item.owner?.name || 'Anonim'} (@${item.owner?.id || '-'})`);
        console.log(`Waktu: ${item.createdAt || '-'}`);
        console.log(`URL: ${item.url || '-'}`);
        console.log(`Teks: "${(item.description || item.text || '').slice(0, 150)}..."`);
      });
    }

    console.log('\n🎉 VALIDASI FASE 1 SUKSES: Akun Repliz Anda 100% mendukung API Search Content Threads!');
  } catch (searchErr) {
    console.error(`\n❌ Gagal melakukan pencarian Threads via Repliz:`);
    console.error(`Status HTTP: ${searchErr.status || '-'}`);
    console.error(`Pesan Error: ${redactCredentials(searchErr.message)}`);
    if (searchErr.status === 403 || String(searchErr.message).toLowerCase().includes('gold') || String(searchErr.message).toLowerCase().includes('plan')) {
      console.warn('\n⚠️ Catatan: Fitur ini membutuhkan workspace Repliz tier Gold+ (Research API Add-on).');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
