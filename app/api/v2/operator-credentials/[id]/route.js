import { NextResponse } from 'next/server';
import {
  requireWebSuperadmin,
  updateOperatorCredential,
  deleteOperatorCredential
} from '@/lib/operator-credentials-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request, context) {
  try {
    const actor = await requireWebSuperadmin(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await updateOperatorCredential(id, body, actor);
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const actor = await requireWebSuperadmin(request);
    const { id } = await context.params;
    const result = await deleteOperatorCredential(id, actor);
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
