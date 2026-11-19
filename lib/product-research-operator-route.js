import { authenticateOperator, runAsOperatorTenant } from './operator-auth.js';

/**
 * Pembungkus route operator Radar Produk: autentikasi scope eksplisit,
 * konteks tenant dari kredensial, dan format error seragam.
 */
export async function runOperatorRadarRoute(request, requiredScope, handler) {
  try {
    const identity = await authenticateOperator(request, requiredScope);
    const result = await runAsOperatorTenant(identity, () => handler(identity));
    return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[Operator Product Research Route Error]:', error);
    return Response.json(
      {
        success: false,
        code: error.code || 'PRODUCT_RESEARCH_OPERATOR_FAILED',
        error: status < 500 ? error.message : 'Gagal memproses permintaan Radar Produk.'
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    const err = new Error('Body JSON tidak valid.');
    err.status = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}
