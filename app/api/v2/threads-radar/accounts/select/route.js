import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setSelectedThreadsAccount } from '@/lib/threads-affiliate-repository';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function POST(req) {
  try {
    const tenantId = getTenantId(req);
    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Field accountId wajib diisi.' }, { status: 400 });
    }

    const updatedAccount = await setSelectedThreadsAccount(tenantId, accountId);

    return NextResponse.json({
      success: true,
      message: `Akun aktif Threads berhasil diubah ke @${updatedAccount.username || updatedAccount.account_id}.`,
      data: updatedAccount
    });
  } catch (error) {
    console.error('[API Threads Accounts Select Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

