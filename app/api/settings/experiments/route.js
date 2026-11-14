import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { ensureDbCachesLoaded } from '@/lib/db';
import {
  canEditExperimentSettings,
  readTenantExperimentSettings,
  saveTenantExperimentSettings
} from '@/lib/experiment-settings';

export const GET = withTenantContext(async (_request, _context, user) => {
  try {
    await ensureDbCachesLoaded().catch(() => {});
    const tenantId = user?.tenantId || user?.tenant_id || 'default_tenant';
    if (!tenantId || tenantId === '__none__') {
      return NextResponse.json(
        { success: false, error: 'Silakan pilih akun/tenant aktif terlebih dahulu untuk melihat Fitur Eksperimen.' },
        { status: 400 }
      );
    }

    const data = await readTenantExperimentSettings({ tenantId });
    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      can_edit: canEditExperimentSettings(user?.role),
      data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    await ensureDbCachesLoaded().catch(() => {});
    const tenantId = user?.tenantId || user?.tenant_id || 'default_tenant';
    if (!canEditExperimentSettings(user?.role)) {
      return NextResponse.json(
        { success: false, error: 'Hanya Admin / Owner akun ini yang dapat mengubah Fitur Eksperimen.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const resetScope = body?.reset_scope ? String(body.reset_scope).trim() : null;
    const updates = body?.updates && typeof body.updates === 'object' ? body.updates : body;

    const result = await saveTenantExperimentSettings({
      tenantId,
      actor: user,
      updates,
      resetScope
    });

    const data = await readTenantExperimentSettings({ tenantId });
    return NextResponse.json({
      success: true,
      message: resetScope
        ? 'Pengaturan Fitur Eksperimen berhasil dikembalikan ke default.'
        : 'Perubahan Fitur Eksperimen berhasil disimpan untuk akun ini.',
      result,
      can_edit: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message, details: error.details || undefined },
      { status: error.status || 500 }
    );
  }
});

