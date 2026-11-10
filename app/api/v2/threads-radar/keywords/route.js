import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  listMonitoringKeywords, 
  addMonitoringKeyword, 
  deleteMonitoringKeyword,
  toggleMonitoringKeyword 
} from '@/lib/threads-affiliate-repository';

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
    const keywords = await listMonitoringKeywords(tenantId);
    return NextResponse.json({ success: true, data: keywords });
  } catch (err) {
    console.error('[API Threads Keywords GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const tenantId = getTenantId(req);
    const body = await req.json();
    const { keyword, category = 'general', intervalMinutes = 30 } = body;

    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ success: false, error: 'Kata kunci tidak boleh kosong' }, { status: 400 });
    }

    const created = await addMonitoringKeyword(tenantId, {
      keyword: keyword.trim(),
      category,
      intervalMinutes: parseInt(intervalMinutes, 10) || 30
    });

    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    console.error('[API Threads Keywords POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const tenantId = getTenantId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id wajib disertakan' }, { status: 400 });
    }

    const deleted = await deleteMonitoringKeyword(tenantId, id);
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error('[API Threads Keywords DELETE Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const tenantId = getTenantId(req);
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter id wajib disertakan' }, { status: 400 });
    }

    const updated = await toggleMonitoringKeyword(tenantId, id);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[API Threads Keywords PATCH Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
