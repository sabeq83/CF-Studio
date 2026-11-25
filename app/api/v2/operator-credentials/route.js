import { NextResponse } from 'next/server';
import {
  requireWebSuperadmin,
  listOperatorCredentials,
  createOperatorCredential
} from '@/lib/operator-credentials-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requireWebSuperadmin(request);
    const data = await listOperatorCredentials();
    return NextResponse.json({ success: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request) {
  try {
    const actor = await requireWebSuperadmin(request);
    const body = await request.json().catch(() => ({}));
    const result = await createOperatorCredential(body, actor);
    return NextResponse.json(
      { success: true, ...result },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
