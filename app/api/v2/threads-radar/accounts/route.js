import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  listConnectedThreadsAccounts, 
  syncConnectedThreadsAccounts, 
  getRadarSchedule 
} from '@/lib/threads-affiliate-repository';
import { getReplizCredentials } from '@/lib/threads-radar-scheduler';
import { listReplizAccounts, redactCredentials } from '@/lib/repliz-client';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function GET(req) {
  try {
    const tenantId = getTenantId(req);
    let accounts = await listConnectedThreadsAccounts(tenantId);
    const schedule = await getRadarSchedule(tenantId);

    // Auto-sync jika database lokal belum memiliki riwayat akun Threads
    if (accounts.length === 0) {
      const credentials = await getReplizCredentials(tenantId);
      if (credentials.accessKey && credentials.secretKey) {
        try {
          const rawAccounts = await listReplizAccounts(credentials);
          accounts = await syncConnectedThreadsAccounts(tenantId, rawAccounts);
        } catch (fetchErr) {
          console.warn('[API Threads Accounts GET Auto-sync Warning]:', redactCredentials(fetchErr.message));
        }
      }
    }

    const selectedAccountId = schedule?.selected_account_id 
      || accounts.find(a => a.is_selected)?.account_id 
      || (accounts[0]?.account_id || null);

    const selectedUsername = schedule?.selected_account_username 
      || accounts.find(a => a.account_id === selectedAccountId)?.username 
      || null;

    return NextResponse.json({
      success: true,
      selectedAccountId,
      selectedUsername,
      data: accounts
    });
  } catch (error) {
    console.error('[API Threads Accounts GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const tenantId = getTenantId(req);
    const credentials = await getReplizCredentials(tenantId);

    if (!credentials.accessKey || !credentials.secretKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Kredensial Repliz belum dikonfigurasi di tenant settings.' 
      }, { status: 400 });
    }

    const rawAccounts = await listReplizAccounts(credentials);
    const syncedAccounts = await syncConnectedThreadsAccounts(tenantId, rawAccounts);
    const schedule = await getRadarSchedule(tenantId);

    const selectedAccountId = schedule?.selected_account_id 
      || syncedAccounts.find(a => a.is_selected)?.account_id 
      || (syncedAccounts[0]?.account_id || null);

    const selectedUsername = schedule?.selected_account_username 
      || syncedAccounts.find(a => a.account_id === selectedAccountId)?.username 
      || null;

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${syncedAccounts.length} akun Threads dari Repliz.`,
      selectedAccountId,
      selectedUsername,
      data: syncedAccounts
    });
  } catch (error) {
    console.error('[API Threads Accounts POST Sync Error]:', redactCredentials(error.message));
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

