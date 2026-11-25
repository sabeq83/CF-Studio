import { NextResponse } from 'next/server';
import {
  requireWebSuperadmin,
  rotateOperatorCredentialToken
} from '@/lib/operator-credentials-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  try {
    const actor = await requireWebSuperadmin(request);
    const { id } = await context.params;
    const result = await rotateOperatorCredentialToken(id, actor);
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
