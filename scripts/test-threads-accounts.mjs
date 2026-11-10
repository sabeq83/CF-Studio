import { 
  listConnectedThreadsAccounts, 
  syncConnectedThreadsAccounts, 
  setSelectedThreadsAccount,
  getRadarSchedule
} from '../lib/threads-affiliate-repository.js';
import { getReplizCredentials } from '../lib/threads-radar-scheduler.js';
import { listReplizAccounts } from '../lib/repliz-client.js';
import { closePgPool } from '../lib/db-pg.js';

async function main() {
  console.log('--- Testing Threads Accounts Sync & Selector ---');
  const tenantId = 'default_tenant';

  // 1. Dapatkan kredensial Repliz
  const creds = await getReplizCredentials(tenantId);
  console.log('1. Repliz Credentials resolved:', Boolean(creds.accessKey && creds.secretKey));

  // 2. Fetch live accounts dari Repliz
  const replizAccounts = await listReplizAccounts(creds);
  console.log(`2. Total akun di Repliz: ${replizAccounts.length}`);
  const threadsAccounts = replizAccounts.filter(a => a.type === 'threads' || a.platform === 'threads');
  console.log(`   Akun bertipe Threads: ${threadsAccounts.length}`);
  threadsAccounts.forEach(a => {
    console.log(`   - ID: ${a._id || a.id} | @${a.username} (${a.name}) | Status: ${a.status}`);
  });

  // 3. Sync ke PostgreSQL
  const synced = await syncConnectedThreadsAccounts(tenantId, replizAccounts);
  console.log(`3. Sinkronisasi DB berhasil, tersimpan ${synced.length} akun.`);

  // 4. Verifikasi pemilihan akun
  if (synced.length > 0) {
    const target = synced[0];
    const updated = await setSelectedThreadsAccount(tenantId, target.account_id);
    console.log(`4. Selected account: @${updated.username} (${updated.account_id})`);
    
    const sched = await getRadarSchedule(tenantId);
    console.log(`5. Schedule updated: selected_account_id = ${sched.selected_account_id}, selected_account_username = ${sched.selected_account_username}`);
  }

  const listFinal = await listConnectedThreadsAccounts(tenantId);
  console.log('6. List akun final dari DB:', listFinal.map(a => ({ id: a.account_id, user: a.username, selected: a.is_selected })));

  await closePgPool();
  console.log('--- Test Selesai dengan Sukses ---');
}

main().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
