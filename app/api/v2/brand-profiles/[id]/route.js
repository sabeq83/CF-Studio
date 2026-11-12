import { NextResponse } from 'next/server';
import { getBrandProfile, updateBrandProfile, deleteBrandProfile } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { validateBrandEditorialDefaults } from '@/lib/brand-editorial-defaults';

export const dynamic = 'force-dynamic';

function canReadBrand(user, id) {
  return user.role === 'admin' || (user.assignedBrandIds || []).includes(id);
}

export const GET = withTenantContext(async (_req, { params }, user) => {
  try {
    const { id } = await params;
    if (!canReadBrand(user, id)) {
      return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    }
    const profile = await getBrandProfile(id);
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withTenantContext(async (req, { params }, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const profile = await getBrandProfile(id);
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    const merged = { ...profile, ...body };
    const editorial = validateBrandEditorialDefaults(merged);
    await updateBrandProfile(id, { ...merged, ...editorial });
    return NextResponse.json({ success: true, id, message: 'Brand Profile updated' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.code === 'BRAND_EDITORIAL_VALIDATION' ? 400 : 500 });
  }
});

export const DELETE = withTenantContext(async (_req, { params }, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const profile = await getBrandProfile(id);
    if (!profile) return NextResponse.json({ success: false, error: 'Brand Profile not found' }, { status: 404 });
    await deleteBrandProfile(id);
    return NextResponse.json({ success: true, message: 'Brand Profile deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
