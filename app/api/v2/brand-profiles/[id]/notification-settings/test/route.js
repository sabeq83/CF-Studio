import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBrandProfile } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import {
  enqueueBrandNotification,
  resolveBrandTelegramTarget
} from '@/lib/brand-notification-service';

export const dynamic = 'force-dynamic';

function canManageBrandNotifications(user) {
  if (user.isOperator) {
    const scopes = Array.isArray(user.scopes) ? user.scopes : [];
    return Boolean(
      user.isMaster
      || scopes.includes('automation:write')
      || scopes.includes('content:create')
      || scopes.includes('settings:write')
      || scopes.includes('*')
    );
  }
  return user.role === 'admin';
}

export const POST = withTenantContext(async (_req, { params }, user) => {
  try {
    if (!canManageBrandNotifications(user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const profile = await getBrandProfile(id);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }

    const target = await resolveBrandTelegramTarget(user.tenantId, id, { ignoreBrandEnabled: true });
    if (!target) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bot Token atau Chat ID Telegram belum dikonfigurasi. Lengkapi Bot & Grup Default Tenant terlebih dahulu.'
        },
        { status: 409 }
      );
    }

    const topicLabel = target.messageThreadId ? `Topic #${target.messageThreadId}` : 'grup utama (tanpa Topic ID)';
    const outboxItem = await enqueueBrandNotification({
      tenantId: user.tenantId,
      brandId: id,
      sourceModule: 'test',
      entityId: id,
      eventKey: `brand_test:${id}:${crypto.randomUUID()}`,
      eventType: 'test',
      title: `🔔 [${profile.brand_name}] Tes Notifikasi Telegram`,
      message: `Koneksi Telegram per brand untuk ${profile.brand_name} berhasil masuk antrean menuju ${topicLabel}.`,
      actionUrl: '/settings/brand-profiles',
      ignoreBrandEnabled: true,
      targetOverride: target
    });

    if (!outboxItem) {
      return NextResponse.json(
        { success: false, error: 'Gagal memasukkan pesan tes ke antrean outbox.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        outbox_id: outboxItem.id,
        message_thread_id: target.messageThreadId,
        message: `Tes notifikasi untuk ${profile.brand_name} masuk antrean menuju ${topicLabel}.`
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
