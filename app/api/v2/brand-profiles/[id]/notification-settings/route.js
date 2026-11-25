import { NextResponse } from 'next/server';
import { getBrandProfile } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import {
  getBrandNotificationPreference,
  saveBrandNotificationPreference
} from '@/lib/brand-notification-service';

export const dynamic = 'force-dynamic';

function canReadBrand(user, id) {
  if (user.isOperator) return true;
  return user.role === 'admin' || (user.assignedBrandIds || []).includes(id);
}

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

export const GET = withTenantContext(async (_req, { params }, user) => {
  try {
    const { id } = await params;
    if (!canReadBrand(user, id)) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    const profile = await getBrandProfile(id);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    const settings = await getBrandNotificationPreference(user.tenantId, id);
    return NextResponse.json({
      success: true,
      brand: { id: profile.id, brand_name: profile.brand_name },
      settings
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  try {
    if (!canManageBrandNotifications(user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const profile = await getBrandProfile(id);
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    const body = await req.json();
    const settings = await saveBrandNotificationPreference(user.tenantId, id, body || {}, user.id || user.actor || 'admin');
    return NextResponse.json({
      success: true,
      brand: { id: profile.id, brand_name: profile.brand_name },
      settings
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
