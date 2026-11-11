import { NextResponse } from 'next/server';
import { getCurrentUser, isTenantMenuDisabled } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { executeAutonomousThreadsSeriesPipeline } from '@/lib/threads-series-pipeline';

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
    const user = getCurrentUser(req);
    if (isTenantMenuDisabled(user, 'threads_labs')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Modul Threads Labs dinonaktifkan untuk tenant ini.' }, { status: 403 });
    }
    const tenantId = getTenantId(req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 30), 100);

    const res = await pgQuery(
      `SELECT * FROM threads_series_posts 
       WHERE tenant_id = $1 OR tenant_id = 'tnt_sy-benu_415f99' 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [tenantId, limit]
    );

    return NextResponse.json({
      success: true,
      data: res.rows
    });
  } catch (error) {
    console.error('[API Threads Series GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = getCurrentUser(req);
    if (isTenantMenuDisabled(user, 'threads_labs')) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Modul Threads Labs dinonaktifkan untuk tenant ini.' }, { status: 403 });
    }
    const tenantId = getTenantId(req);
    const body = await req.json();

    const result = await executeAutonomousThreadsSeriesPipeline({
      schedule: {
        id: `manual_${Date.now()}`,
        auto_publish_enabled: body.auto_publish !== false,
        repliz_account_ids: body.account_id ? [body.account_id] : []
      },
      pipelineConfig: {
        account_id: body.account_id,
        account_username: body.account_username,
        post_objective: body.post_objective || 'personal_product',
        personal_product_name: body.personal_product_name,
        personal_product_cta: body.personal_product_cta,
        affiliate_product_title: body.affiliate_product_title,
        affiliate_product_link: body.affiliate_product_link,
        pure_organic_topic: body.pure_organic_topic,
        visual_mode: body.visual_mode || 'glabs'
      },
      tenantId,
      targetPublishIso: body.publish_time || new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('[API Threads Series POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
