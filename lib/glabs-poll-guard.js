/**
 * lib/glabs-poll-guard.js
 *
 * Guard bersama untuk polling & download klip G-Labs pada Pillar & RE Campaign:
 * - Timeout fetch agar koneksi ke host/IP worker lama yang mati gagal cepat.
 * - Deteksi URL kadaluarsa (>24 jam & gagal konek) serta batas maksimal retry
 *   network error agar item zombie tidak berputar selamanya di scheduler.
 */

export const GLABS_CLIP_DOWNLOAD_TIMEOUT_MS = 15_000;
export const GLABS_STALE_TASK_AGE_MS = 24 * 60 * 60 * 1000;
export const GLABS_MAX_POLL_NETWORK_RETRIES = 6;

const NETWORK_ERR_CODES = new Set([
  'EHOSTUNREACH',
  'ECONNREFUSED',
  'ENETUNREACH',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
  'ABORT_ERR',
]);

export function isTransientGlabsNetworkError(err) {
  if (!err) return false;
  const code = String(err.code || err.cause?.code || '').trim();
  const name = String(err.name || '').trim();
  const msg = String(err.message || '');
  if (NETWORK_ERR_CODES.has(code)) return true;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return /fetch failed|EHOSTUNREACH|ECONNREFUSED|ENETUNREACH|ETIMEDOUT|timeout|aborted/i.test(msg);
}

/**
 * Mengevaluasi error polling/download satu task G-Labs.
 * Mengembalikan `fatal: true` bila HTTP 404/410, atau error jaringan pada task
 * berusia > 24 jam (misal URL mengarah ke IP G-Labs lama yang sudah mati).
 */
export function evaluateGlabsPollFailure({ err, taskId = '', taskCreatedAt = null, nowMs = Date.now() } = {}) {
  const status = Number(err?.status || 0);
  if (status === 404 || status === 410) {
    return {
      fatal: true,
      isNetworkError: false,
      markGlabsFailed: true,
      reason: `Task ${taskId || '-'} clip file expired/not found on GLabs (HTTP ${status})`,
    };
  }

  const isNetworkError = isTransientGlabsNetworkError(err);
  if (isNetworkError && taskCreatedAt) {
    const createdMs = new Date(taskCreatedAt).getTime();
    if (Number.isFinite(createdMs) && nowMs - createdMs >= GLABS_STALE_TASK_AGE_MS) {
      return {
        fatal: true,
        isNetworkError: true,
        markGlabsFailed: true,
        reason: `Task ${taskId || '-'} unreachable/expired (>24h old host): ${err?.message || 'fetch failed'}`,
      };
    }
  }

  return {
    fatal: false,
    isNetworkError,
    markGlabsFailed: false,
    reason: err?.message || 'Polling error',
  };
}

/**
 * Menghitung apakah kegagalan jaringan berulang pada polling sudah melewati batas.
 */
export function evaluatePollRetryBudget({
  networkErrorsInTick = 0,
  currentRetryCount = 0,
  maxRetries = GLABS_MAX_POLL_NETWORK_RETRIES,
} = {}) {
  if (networkErrorsInTick <= 0) {
    return { exceedLimit: false, nextRetryCount: 0, shouldPersistRetry: false };
  }
  const nextRetryCount = Number(currentRetryCount || 0) + 1;
  return {
    exceedLimit: nextRetryCount >= maxRetries,
    nextRetryCount,
    shouldPersistRetry: true,
  };
}

/**
 * Mencegah item yang workflow_status-nya sudah 'completed' (mis. zombie lama)
 * tetap dipolling ulang di visual_status = 'processing'.
 */
export function shouldSkipZombiePillarPoll(item = {}) {
  return String(item?.workflow_status || '').trim().toLowerCase() === 'completed'
    && String(item?.visual_status || '').trim().toLowerCase() === 'processing';
}
