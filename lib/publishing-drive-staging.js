/**
 * Publishing Drive Staging Service Module
 * Handles readiness check, idempotent media upload to Google Drive for Repliz publishing,
 * anonymous download probe verification, staging media lifecycle tracking, and folder auto-provisioning.
 */

import { google } from 'googleapis';
import { getAuthorizedClient, verifyGoogleConnection } from './google-auth.js';
import { getSetting, setSetting } from './db.js';
import { uploadUrlToPublicDrive, verifyAnonymousDriveDownload } from './drive-uploader.js';
import { getActiveTenantId } from './tenant-context.js';
import { getR2Config, uploadVideoBufferToR2 } from './cloudflare-r2-client.js';
import {
  saveMediaStaging,
  getMediaStagingByJob,
  listExpiredMediaStaging,
  markMediaStagingDeleted
} from './publishing-repository.js';

const readinessCache = new Map();

/**
 * Normalize and validate Google Drive folder ID or URL
 * @param {string} input - Folder ID or full URL
 * @returns {string} - Clean folder ID
 */
export function normalizeDriveFolderId(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // If it's a full Google Drive URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname.includes('drive.google.com')) {
        throw new Error('URL harus berasal dari domain drive.google.com');
      }
      // Match /drive/folders/<id> or /drive/u/0/folders/<id>
      const folderMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch && folderMatch[1]) {
        return folderMatch[1];
      }
      // Match query id: ?id=<id>
      const idParam = parsed.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]{10,60}$/.test(idParam)) {
        return idParam;
      }
      throw new Error('URL Google Drive tidak memuat Folder ID yang valid.');
    } catch (e) {
      throw new Error(e.message || 'Format URL Google Drive tidak valid.');
    }
  }

  // If it's a direct Folder ID (base64url characters, typically 15-50 chars)
  if (/^[a-zA-Z0-9_-]{10,60}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error('Format Folder ID Google Drive tidak valid (hanya karakter alfanumerik, underscore, dan dash).');
}

/**
 * Invalidate scoped readiness cache
 * @param {string} [tenantId]
 */
export function invalidatePublishingDriveReadiness(tenantId = null) {
  if (!tenantId) {
    readinessCache.clear();
  } else {
    for (const key of readinessCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        readinessCache.delete(key);
      }
    }
  }
}

/**
 * Check if a media URL belongs to Nextcloud hosts
 */
export function isNextcloudMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const nextcloudHosts = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || 'cloud.ast402.my.id,100.78.186.123').split(',').map(h => h.trim());
    return nextcloudHosts.includes(parsed.hostname) || parsed.pathname.includes('/index.php/s/') || parsed.pathname.startsWith('/s/');
  } catch {
    return false;
  }
}

/**
 * Normalizes Nextcloud share URLs to direct binary download URLs (/download)
 * and resolves internal base IP for server-side fetching when applicable.
 */
export function normalizeNextcloudDownloadUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const nextcloudHosts = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || 'cloud.ast402.my.id,100.78.186.123').split(',').map(h => h.trim());
    const isNc = nextcloudHosts.includes(parsed.hostname) || parsed.pathname.includes('/index.php/s/') || parsed.pathname.startsWith('/s/');

    if (!isNc) return rawUrl;

    const nextcloudInternalBase = process.env.NEXTCLOUD_INTERNAL_BASE || 'http://100.78.186.123';
    let pathname = parsed.pathname;

    // Jika public share URL belum berakhiran /download, tambahkan agar mengembalikan binary MP4 asli bukan HTML viewer
    if (/\/s\/[a-zA-Z0-9]+(?:\/)?$/.test(pathname)) {
      pathname = pathname.replace(/\/+$/, '') + '/download';
    }

    return `${nextcloudInternalBase}${pathname}${parsed.search}`;
  } catch {
    return rawUrl;
  }
}

/**
 * Find existing folder created by the app with appProperties
 */
async function findAppCreatedPublishingFolder(drive) {
  try {
    const res = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='maknaPurpose' and value='repliz-publishing' }",
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id, name, mimeType, trashed, driveId, capabilities(canAddChildren))'
    });

    const activeFolders = (res.data?.files || []).filter(f => !f.trashed && f.capabilities?.canAddChildren !== false);
    return activeFolders[0] || null;
  } catch (err) {
    console.warn('[Drive Staging] Search app-created folder warning:', err.message);
    return null;
  }
}

/**
 * Ensure publishing folder exists:
 * Finds existing app-created folder or creates a new dedicated 'REPLIZ Publishing' folder.
 * Saves validated folder ID to settings atomik per tenant.
 */
export async function ensurePublishingDriveFolder() {
  const authState = await verifyGoogleConnection();
  if (!authState.connected) {
    const err = new Error(authState.message || 'Koneksi Google Drive belum terhubung.');
    err.code = authState.state === 'reauth_required' ? 'GOOGLE_REAUTH_REQUIRED' : 'GOOGLE_NOT_CONNECTED';
    err.reconnectUrl = authState.reconnectUrl || `/api/google/auth?returnTo=${encodeURIComponent('/settings')}`;
    throw err;
  }

  if (!authState.driveFileScopeGranted) {
    const err = new Error('Izin akses Google Drive (drive.file) belum diberikan pada akun Google.');
    err.code = 'GOOGLE_DRIVE_SCOPE_MISSING';
    err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/settings')}`;
    throw err;
  }

  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Check if an app-created folder already exists
  const existingFolder = await findAppCreatedPublishingFolder(drive);
  if (existingFolder) {
    console.log(`[Drive Staging] Reusing existing app-created folder: ${existingFolder.id} (${existingFolder.name})`);
    await setSetting('repliz_drive_folder_id', existingFolder.id);
    invalidatePublishingDriveReadiness(getActiveTenantId());
    return {
      id: existingFolder.id,
      name: existingFolder.name || 'REPLIZ Publishing',
      created: false,
      writable: true
    };
  }

  // 2. Create new app-owned folder with appProperties
  console.log('[Drive Staging] Creating new dedicated folder REPLIZ Publishing via OAuth app...');
  const createRes = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: 'REPLIZ Publishing',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        maknaPurpose: 'repliz-publishing',
        version: '1'
      }
    },
    fields: 'id, name, mimeType, trashed, driveId, capabilities(canAddChildren)'
  });

  const newFolder = createRes.data;
  if (!newFolder || !newFolder.id) {
    throw new Error('Gagal membuat folder Google Drive REPLIZ Publishing.');
  }

  await setSetting('repliz_drive_folder_id', newFolder.id);
  invalidatePublishingDriveReadiness(getActiveTenantId());

  console.log(`[Drive Staging] Dedicated folder created successfully: ${newFolder.id}`);
  return {
    id: newFolder.id,
    name: newFolder.name || 'REPLIZ Publishing',
    created: true,
    writable: newFolder.capabilities?.canAddChildren !== false
  };
}

/**
 * Actively verify that Google Drive is ready for Repliz publishing.
 * Validates OAuth tokens, folder existence, trashed status, and write capabilities.
 * Throws structured Error with error.code and error.status on failure.
 */
export async function verifyPublishingDriveReady({ bypassCache = false } = {}) {
  const tenantId = getActiveTenantId() || 'default_tenant';
  const now = Date.now();

  // 1. Verify OAuth token
  const authState = await verifyGoogleConnection();
  if (!authState.connected) {
    const err = new Error(authState.message || 'Koneksi Google Drive tidak valid.');
    err.code = authState.state === 'reauth_required' ? 'GOOGLE_REAUTH_REQUIRED' : 'GOOGLE_NOT_CONNECTED';
    err.status = authState.state === 'reauth_required' ? 409 : 503;
    err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/content-flow?view=publishing')}`;
    throw err;
  }

  if (!authState.driveFileScopeGranted) {
    const err = new Error('Izin akses Google Drive (drive.file) belum diberikan.');
    err.code = 'GOOGLE_DRIVE_SCOPE_MISSING';
    err.status = 409;
    err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/settings')}`;
    throw err;
  }

  // 2. Verify folder ID setting
  const rawFolderSetting = getSetting('repliz_drive_folder_id') || process.env.MAKNA_PUBLISHING_DRIVE_FOLDER_ID || '';
  let folderId = '';
  try {
    folderId = normalizeDriveFolderId(rawFolderSetting);
  } catch (_) {
    folderId = '';
  }

  if (!folderId) {
    const err = new Error('Folder Google Drive untuk Repliz belum dikonfigurasi. Klik tombol "Buat/Perbaiki Folder REPLIZ Publishing" di Settings.');
    err.code = 'GOOGLE_DRIVE_FOLDER_MISSING';
    err.status = 409;
    throw err;
  }

  const cacheKey = `${tenantId}:${authState.email || 'none'}:${folderId}`;
  if (!bypassCache && readinessCache.has(cacheKey)) {
    const cached = readinessCache.get(cacheKey);
    if (now - cached.timestamp < 30000) {
      return cached.data;
    }
  }

  // 3. Verify folder in Google Drive
  let folderRes;
  try {
    const auth = getAuthorizedClient();
    const drive = google.drive({ version: 'v3', auth });
    folderRes = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, trashed, driveId, capabilities(canAddChildren, canShare)'
    });
  } catch (apiErr) {
    const status = apiErr?.status || apiErr?.code || apiErr?.response?.status;
    const isRevoked = apiErr?.message?.includes('invalid_grant') || apiErr?.message?.includes('revoked');
    if (isRevoked) {
      const err = new Error('Koneksi Google perlu dihubungkan ulang.');
      err.code = 'GOOGLE_REAUTH_REQUIRED';
      err.status = 409;
      err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/content-flow?view=publishing')}`;
      throw err;
    }

    if (status === 404 || apiErr?.message?.includes('notFound') || apiErr?.message?.includes('File not found')) {
      const err = new Error(`Folder Google Drive (${folderId}) tidak dapat diakses oleh aplikasi MAKNA. Karena izin akses menggunakan scope least-privilege (drive.file), folder manual di browser tidak otomatis visible ke aplikasi. Silakan klik tombol "Buat/Perbaiki Folder REPLIZ Publishing" di Settings.`);
      err.code = 'GOOGLE_DRIVE_FOLDER_NOT_VISIBLE_TO_APP';
      err.status = 409;
      throw err;
    }

    if (status === 403) {
      const err = new Error(`Izin akses folder Google Drive ditolak (${apiErr.message}). Pastikan akun memiliki izin.`);
      err.code = 'GOOGLE_DRIVE_PERMISSION_ERROR';
      err.status = 409;
      throw err;
    }

    const err = new Error(`Layanan Google Drive sementara tidak dapat diakses (${apiErr.message})`);
    err.code = 'GOOGLE_DRIVE_TEMPORARILY_UNAVAILABLE';
    err.status = 503;
    throw err;
  }

  const folder = folderRes?.data;
  if (!folder || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') {
    const err = new Error('Folder Google Drive tujuan telah dihapus (trashed) atau bukan bertipe folder.');
    err.code = 'GOOGLE_DRIVE_FOLDER_INVALID';
    err.status = 409;
    throw err;
  }

  if (folder.capabilities && folder.capabilities.canAddChildren === false) {
    const err = new Error('Akun Google tidak memiliki izin menulis (canAddChildren) pada folder Google Drive.');
    err.code = 'GOOGLE_DRIVE_FOLDER_NOT_WRITABLE';
    err.status = 409;
    throw err;
  }

  const result = {
    state: 'connected',
    connected: true,
    folderId: folder.id,
    folderName: folder.name || 'REPLIZ Publishing',
    canAddChildren: folder.capabilities?.canAddChildren !== false,
    checkedAt: new Date().toISOString()
  };

  readinessCache.set(cacheKey, { timestamp: now, data: result });
  return result;
}

/**
 * Get readiness status safely without throwing (for status endpoints & settings UI)
 */
export async function getPublishingDriveReadiness({ bypassCache = false } = {}) {
  try {
    return await verifyPublishingDriveReady({ bypassCache });
  } catch (err) {
    return {
      state: err.code || 'GOOGLE_DRIVE_ERROR',
      connected: false,
      code: err.code || 'GOOGLE_DRIVE_ERROR',
      error: err.message,
      reconnectUrl: err.reconnectUrl || null
    };
  }
}


/**
 * Resolves the chosen staging provider ('cloudflare_r2' or 'google_drive').
 * Defaults to 'cloudflare_r2' if configured, otherwise falls back gracefully.
 */
export async function getEffectiveStagingProvider(tenantId = getActiveTenantId()) {
  const chosen = getSetting('repliz_media_staging_provider');
  if (chosen === 'google_drive') return 'google_drive';
  if (chosen === 'cloudflare_r2') return 'cloudflare_r2';

  // If not explicitly set, prefer R2 if configured
  const r2 = await getR2Config(tenantId);
  if (r2.isConfigured) return 'cloudflare_r2';

  // Fallback to Google Drive if credentials exist
  const googleTokens = getSetting('google_tokens');
  if (googleTokens) return 'google_drive';

  return 'cloudflare_r2';
}

/**
 * Verify readiness of the active media staging provider (R2 or Google Drive).
 */
export async function verifyPublishingStagingReady({ bypassCache = false, tenantId = getActiveTenantId() } = {}) {
  const provider = await getEffectiveStagingProvider(tenantId);
  if (provider === 'cloudflare_r2') {
    const r2 = await getR2Config(tenantId);
    if (!r2.isConfigured) {
      const err = new Error('Cloudflare R2 belum dikonfigurasi. Silakan isi Account ID, Access Key ID, dan Secret Access Key di menu Settings.');
      err.code = 'R2_STAGING_NOT_CONFIGURED';
      err.status = 409;
      err.provider = 'cloudflare_r2';
      throw err;
    }
    return {
      provider: 'cloudflare_r2',
      state: 'connected',
      connected: true,
      bucketName: r2.bucketName,
      publicDomain: r2.publicDomain,
      checkedAt: new Date().toISOString()
    };
  }

  const driveReady = await verifyPublishingDriveReady({ bypassCache });
  return {
    ...driveReady,
    provider: 'google_drive'
  };
}

/**
 * Get readiness status safely without throwing (for status endpoints & settings UI)
 */
export async function getPublishingStagingReadiness({ bypassCache = false, tenantId = getActiveTenantId() } = {}) {
  try {
    return await verifyPublishingStagingReady({ bypassCache, tenantId });
  } catch (err) {
    return {
      provider: err.provider || 'unknown',
      state: err.code || 'STAGING_ERROR',
      connected: false,
      code: err.code || 'STAGING_ERROR',
      error: err.message,
      reconnectUrl: err.reconnectUrl || null
    };
  }
}

/**
 * Stage media to Google Drive (legacy fallback).
 */
export async function stageMediaToDrive(job) {
  const ready = await verifyPublishingDriveReady({ bypassCache: true });
  const folderId = ready.folderId;
  const sourceUrl = normalizeNextcloudDownloadUrl(job.media_url_snapshot);

  const filename = `publishing_${job.id}_${job.platform || 'video'}.mp4`;
  const appProperties = {
    jobId: String(job.id),
    tenantId: String(job.tenant_id || 'default_tenant'),
    contentId: String(job.content_id || '')
  };

  console.log(`[Drive Staging] Uploading media for job ${job.id} to folder ${folderId}...`);
  const uploaded = await uploadUrlToPublicDrive(sourceUrl, filename, folderId, { appProperties });

  console.log(`[Drive Staging] Running anonymous probe on ${uploaded.directDownloadUrl}...`);
  await verifyAnonymousDriveDownload(uploaded.directDownloadUrl);
  console.log(`[Drive Staging] Anonymous probe passed for job ${job.id}!`);

  const retentionDays = parseInt(process.env.PUBLISHING_DRIVE_RETENTION_DAYS || '14', 10);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString();

  try {
    await saveMediaStaging({
      tenantId: job.tenant_id || 'default_tenant',
      jobId: job.id,
      provider: 'google_drive',
      externalFileId: uploaded.fileId,
      publicUrl: uploaded.directDownloadUrl,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      expiresAt
    });
  } catch (dbErr) {
    console.warn(`[Drive Staging] Failed to save media staging row for job ${job.id}:`, dbErr.message);
  }

  return uploaded;
}

/**
 * Stage media to Cloudflare R2 (recommended modern staging, custom domain CDN).
 */
export async function stageMediaToR2(job) {
  const tenantId = job.tenant_id || getActiveTenantId();
  const r2 = await getR2Config(tenantId);
  if (!r2.isConfigured) {
    const err = new Error('Cloudflare R2 belum dikonfigurasi. Silakan lengkapi Account ID, Access Key ID, dan Secret Access Key di Settings > Repliz Integration.');
    err.code = 'R2_STAGING_NOT_CONFIGURED';
    err.status = 409;
    throw err;
  }

  let sourceUrl = normalizeNextcloudDownloadUrl(job.media_url_snapshot);

  console.log(`[R2 Staging] Fetching source media for job ${job.id} from ${sourceUrl}...`);
  let buffer;
  let contentType = 'video/mp4';

  if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
    const fetchRes = await fetch(sourceUrl, { redirect: 'follow' });
    if (!fetchRes.ok) {
      throw new Error(`Gagal mengunduh media sumber dari ${sourceUrl}: HTTP ${fetchRes.status}`);
    }
    const ct = fetchRes.headers.get('content-type') || '';
    const arrayBuf = await fetchRes.arrayBuffer();
    buffer = Buffer.from(arrayBuf);

    // Guard: Deteksi apakah file yang terunduh adalah dokumen web HTML (bukan biner media)
    const headSample = buffer.slice(0, 100).toString('utf8').toLowerCase();
    if (ct.includes('text/html') || headSample.includes('<!doctype html') || headSample.includes('<html')) {
      throw new Error(`Media sumber mengembalikan dokumen HTML Nextcloud (bukan file video biner valid). Periksa tautan sumber: ${sourceUrl}`);
    }

    if (ct && !ct.includes('text/')) {
      contentType = ct;
    }
  } else {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const { existsSync } = await import('fs');
    const cleanPath = sourceUrl.replace(/^\/+/, '');
    const candidates = [
      path.join(process.cwd(), 'public', cleanPath),
      path.join(process.cwd(), cleanPath),
      sourceUrl
    ];
    const resolved = candidates.find(c => c && existsSync(c));
    if (!resolved) {
      throw new Error(`File media lokal tidak ditemukan: ${sourceUrl}`);
    }
    buffer = await readFile(resolved);
  }

  const ext = contentType.includes('image') ? 'jpg' : 'mp4';
  const key = `staging/repliz_${job.id}_${Date.now()}.${ext}`;

  console.log(`[R2 Staging] Uploading ${buffer.length} bytes to R2 bucket "${r2.bucketName}" as key "${key}"...`);
  const uploaded = await uploadVideoBufferToR2({
    buffer,
    key,
    contentType,
    tenantId
  });

  const retentionDays = parseInt(process.env.PUBLISHING_DRIVE_RETENTION_DAYS || '14', 10);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString();

  try {
    await saveMediaStaging({
      tenantId,
      jobId: job.id,
      provider: 'cloudflare_r2',
      externalFileId: uploaded.key,
      publicUrl: uploaded.publicUrl,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      expiresAt
    });
  } catch (dbErr) {
    console.warn(`[R2 Staging] Failed to save media staging row for job ${job.id}:`, dbErr.message);
  }

  console.log(`[R2 Staging] ✅ Staged successfully to R2! Public URL: ${uploaded.publicUrl}`);
  return {
    fileId: uploaded.key,
    directDownloadUrl: uploaded.publicUrl
  };
}

/**
 * Main dispatcher for Repliz media staging (R2 or Google Drive).
 */
export async function stageMediaForRepliz(job) {
  const tenantId = job.tenant_id || getActiveTenantId();
  const provider = await getEffectiveStagingProvider(tenantId);

  if (provider === 'cloudflare_r2') {
    return await stageMediaToR2(job);
  }

  return await stageMediaToDrive(job);
}
