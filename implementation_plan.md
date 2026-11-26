# Implementation Plan: Penghapusan Otomatis Berbasis Status & Deduplikasi File Staging Google Drive (`REPLIZ Publishing` — Komponen A + B)

**Sumber Usulan:** [USULAN_PENGHAPUSAN_OTOMATIS_FILE_GDRIVE_REPLIZ.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_PENGHAPUSAN_OTOMATIS_FILE_GDRIVE_REPLIZ.md)  
**Target Branch Kerja:** `fitur/repliz-drive-cleanup` (dibuat dari `main` terbaru sesuai SOP Alur 1 — Fitur Baru)  
**Lingkungan Uji Target:** Unit test lokal (`PG_SEARCH_PATH=dev`), `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, lalu deploy atomic ke **Dev (`5020`/`7020`)** untuk verifikasi sebelum persetujuan naik ke Staging (`5010`/`7010`).

> [!NOTE]
> **Tanpa Migrasi Database & Tanpa Perubahan UI:** Seluruh perubahan hanya menyentuh lapisan repository, worker cleanup, Drive staging helper, dan unit test (`lib/publishing-repository.js`, `lib/publishing-media-cleanup-worker.js`, `lib/drive-uploader.js`, `lib/publishing-drive-staging.js`, `lib/publishing-worker.js`, `tests/publishing-drive-staging.test.js`). Tidak ada perubahan skema PostgreSQL maupun komponen UI, sehingga tidak memerlukan mockup HTML Tahap 1.

---

## Execution Task List

### Tahap 0: Persiapan Branch
- [x] Pastikan berada di `main` terbaru (`git checkout main && git pull`) lalu buat branch fitur baru `fitur/repliz-drive-cleanup`

### Tahap 1: Komponen A — Pembersihan Otomatis Berbasis Status & Ref-Counting Aman
- [x] Perbarui `listExpiredMediaStaging()` dan tambahkan `markMediaStagingDeletedByExternalFile()` di [lib/publishing-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/publishing-repository.js) dengan aturan grace period per status (`published`/`draft_created`: 2 jam, `cancelled`: 1 jam, `failed`/`needs_review`: 3 hari, `scheduled`/`processing`/`retry_wait`/`verifying`: tidak pernah dihapus) serta guard *ref-counting* `NOT EXISTS` agar file yang masih dipakai job lain tidak terhapus prematur
- [x] Perbarui `runPublishingMediaCleanupTick()` di [lib/publishing-media-cleanup-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/publishing-media-cleanup-worker.js) agar membungkus tiap item di dalam `tenantContext.run(item.tenant_id, ...)`, menambahkan `supportsAllDrives: true` saat `files.delete`, memproses batch lebih besar secara aman untuk menguras backlog, dan menandai seluruh baris staging yang berbagi `(provider, external_file_id)` sebagai `deleted`
- [x] Perbarui default interval cleanup worker di [lib/publishing-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/publishing-worker.js) dari 60 menit menjadi 30 menit (`1800000` ms, tetap dapat di-override via `PUBLISHING_MEDIA_CLEANUP_INTERVAL_MS`)

### Tahap 2: Komponen B — Deduplikasi Upload 1 File per Video Lintas Platform
- [x] Perbarui `uploadToDriveStaging()` di [lib/drive-uploader.js](file:///Users/sabeqmmursyid/_cfstudio/lib/drive-uploader.js) agar mendukung pencarian idempoten berdasarkan `appProperties.mediaKey` (prioritas sebelum `appProperties.jobId`) sehingga beberapa job lintas platform untuk video yang sama cukup mengunggah 1 file ke folder `REPLIZ Publishing`
- [x] Tambahkan helper `buildReplizMediaDedupKey()` dan perbarui `stageMediaToDrive()` di [lib/publishing-drive-staging.js](file:///Users/sabeqmmursyid/_cfstudio/lib/publishing-drive-staging.js) untuk menyertakan `mediaKey` (`sha256(tenantId | contentId | sourceUrl)`) pada `appProperties` dan menyimpan baris `publishing_media_staging` untuk masing-masing `job_id`

### Tahap 3: Pengujian, Verifikasi Build, & Deploy Dev
- [x] Tambahkan regression test di [tests/publishing-drive-staging.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/publishing-drive-staging.test.js) untuk memverifikasi: (a) grace period 2 jam `published` & 1 jam `cancelled`, (b) `needs_review` tertahan hingga 3 hari lalu terhapus, (c) `scheduled` tidak terhapus, (d) ref-counting menahan hapus jika ada sibling job masih `scheduled`, (e) multi-tenant context cleanup, dan (f) deduplikasi `mediaKey` lintas platform
- [x] Jalankan unit test (`PG_SEARCH_PATH=dev node --test tests/publishing-drive-staging.test.js tests/publishing-scheduler.test.js tests/publishing-repository-query.test.js`) dan build lokal (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`)
- [x] Commit dan push branch `fitur/repliz-drive-cleanup`, lalu deploy ke **Dev (`5020`/`7020`)** memakai `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev` dan verifikasi worker aktif

---

## Rincian Perubahan Kode (Before & After Code Snippets)

### 1. `lib/publishing-repository.js`

**Code Sebelum (Current/Before):**
```js
/**
 * Ambil daftar file media staging yang telah melewati masa retensi (expires_at <= NOW)
 * dan parent job-nya berstatus terminal (published, failed, cancelled, draft_created).
 */
export async function listExpiredMediaStaging(limit = 20) {
  const res = await pgQuery(`
    SELECT s.*, j.status as job_status
    FROM publishing_media_staging s
    JOIN publishing_jobs j ON j.id = s.job_id
    WHERE s.deleted_at IS NULL
      AND s.expires_at <= CURRENT_TIMESTAMP
      AND j.status IN ('published', 'failed', 'cancelled', 'draft_created')
    ORDER BY s.expires_at ASC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

/**
 * Tandai record media staging sebagai telah dihapus.
 */
export async function markMediaStagingDeleted(id) {
  const res = await pgQuery(`
    UPDATE publishing_media_staging
    SET deleted_at = CURRENT_TIMESTAMP, status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [id]);
  return res.rows[0] || null;
}
```

**Code Sesudah (Proposed/After):**
```js
function resolveMediaRetentionPolicy({
  publishedGraceHours = process.env.PUBLISHING_STAGING_PUBLISHED_GRACE_HOURS,
  cancelledGraceHours = process.env.PUBLISHING_STAGING_CANCELLED_GRACE_HOURS,
  failedRetentionDays = process.env.PUBLISHING_STAGING_FAILED_RETENTION_DAYS
} = {}) {
  const parsedPublished = Number.parseInt(publishedGraceHours ?? '2', 10);
  const parsedCancelled = Number.parseInt(cancelledGraceHours ?? '1', 10);
  const parsedFailed = Number.parseInt(failedRetentionDays ?? '3', 10);

  return {
    publishedHours: Number.isFinite(parsedPublished) && parsedPublished >= 0 ? parsedPublished : 2,
    cancelledHours: Number.isFinite(parsedCancelled) && parsedCancelled >= 0 ? parsedCancelled : 1,
    failedDays: Number.isFinite(parsedFailed) && parsedFailed >= 0 ? parsedFailed : 3
  };
}

/**
 * Ambil daftar file media staging yang sudah aman dihapus berdasarkan status job,
 * masa retensi/grace period, serta ref-counting agar file yang masih dipakai job lain
 * yang belum selesai tidak terhapus prematur.
 */
export async function listExpiredMediaStaging(limit = 50, policyOverrides = {}) {
  const { publishedHours, cancelledHours, failedDays } = resolveMediaRetentionPolicy(policyOverrides);

  const res = await pgQuery(`
    SELECT s.*, j.status as job_status
    FROM publishing_media_staging s
    JOIN publishing_jobs j ON j.id = s.job_id
    WHERE s.deleted_at IS NULL
      AND j.status IN ('published', 'draft_created', 'cancelled', 'failed', 'needs_review')
      AND (
        s.expires_at <= CURRENT_TIMESTAMP
        OR (
          j.status IN ('published', 'draft_created')
          AND COALESCE(j.published_at, j.updated_at, s.verified_at, s.created_at)
              <= CURRENT_TIMESTAMP - ($2::text || ' hours')::INTERVAL
        )
        OR (
          j.status = 'cancelled'
          AND COALESCE(j.cancelled_at, j.updated_at, s.verified_at, s.created_at)
              <= CURRENT_TIMESTAMP - ($3::text || ' hours')::INTERVAL
        )
        OR (
          j.status IN ('failed', 'needs_review')
          AND COALESCE(j.updated_at, s.verified_at, s.created_at)
              <= CURRENT_TIMESTAMP - ($4::text || ' days')::INTERVAL
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM publishing_media_staging s2
        JOIN publishing_jobs j2 ON j2.id = s2.job_id
        WHERE s2.provider = s.provider
          AND s2.external_file_id = s.external_file_id
          AND s2.deleted_at IS NULL
          AND (
            j2.status NOT IN ('published', 'draft_created', 'cancelled', 'failed', 'needs_review')
            OR (
              s2.expires_at > CURRENT_TIMESTAMP
              AND NOT (
                (j2.status IN ('published', 'draft_created')
                  AND COALESCE(j2.published_at, j2.updated_at, s2.verified_at, s2.created_at)
                      <= CURRENT_TIMESTAMP - ($2::text || ' hours')::INTERVAL)
                OR (j2.status = 'cancelled'
                  AND COALESCE(j2.cancelled_at, j2.updated_at, s2.verified_at, s2.created_at)
                      <= CURRENT_TIMESTAMP - ($3::text || ' hours')::INTERVAL)
                OR (j2.status IN ('failed', 'needs_review')
                  AND COALESCE(j2.updated_at, s2.verified_at, s2.created_at)
                      <= CURRENT_TIMESTAMP - ($4::text || ' days')::INTERVAL)
              )
            )
          )
      )
    ORDER BY COALESCE(j.published_at, j.cancelled_at, j.updated_at, s.expires_at) ASC
    LIMIT $1
  `, [limit, String(publishedHours), String(cancelledHours), String(failedDays)]);
  return res.rows;
}

/**
 * Tandai record media staging sebagai telah dihapus.
 */
export async function markMediaStagingDeleted(id) {
  const res = await pgQuery(`
    UPDATE publishing_media_staging
    SET deleted_at = CURRENT_TIMESTAMP, status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [id]);
  return res.rows[0] || null;
}

/**
 * Tandai seluruh record media staging yang berbagi external_file_id yang sama sebagai telah dihapus.
 */
export async function markMediaStagingDeletedByExternalFile(provider, externalFileId) {
  const res = await pgQuery(`
    UPDATE publishing_media_staging
    SET deleted_at = CURRENT_TIMESTAMP, status = 'deleted', updated_at = CURRENT_TIMESTAMP
    WHERE provider = $1 AND external_file_id = $2 AND deleted_at IS NULL
    RETURNING *
  `, [provider, externalFileId]);
  return res.rows;
}
```

---

### 2. `lib/publishing-media-cleanup-worker.js`

**Code Sebelum (Current/Before):**
```js
import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.js';
import { listExpiredMediaStaging, markMediaStagingDeleted } from './publishing-repository.js';
import { isPublishingWorkerEnabled } from './node-config.js';
import { deleteObjectFromR2 } from './cloudflare-r2-client.js';

let cleanupIntervalHandle = null;
let isCleaningTick = false;

/**
 * Single tick execution for expired Google Drive media staging cleanup.
 * @returns {Promise<{ processed: number, deleted: number, errors: number }>}
 */
export async function runPublishingMediaCleanupTick() {
  if (isCleaningTick) return { processed: 0, deleted: 0, errors: 0 };
  isCleaningTick = true;

  let processed = 0;
  let deleted = 0;
  let errors = 0;

  try {
    const expiredItems = await listExpiredMediaStaging(20);
    if (!expiredItems || expiredItems.length === 0) {
      return { processed: 0, deleted: 0, errors: 0 };
    }

    let driveClient = null;
    const hasDriveItems = expiredItems.some(i => i.provider === 'google_drive');
    if (hasDriveItems) {
      try {
        const auth = getAuthorizedClient();
        driveClient = google.drive({ version: 'v3', auth });
      } catch (authErr) {
        console.warn('[Publishing Media Cleanup] Google client not available for cleanup:', authErr.message);
      }
    }

    for (const item of expiredItems) {
      processed++;
      try {
        if (item.provider === 'cloudflare_r2' && item.external_file_id) {
          try {
            console.log(`[Publishing Media Cleanup] Purging expired R2 staging file ${item.external_file_id} for job ${item.job_id}...`);
            await deleteObjectFromR2({ key: item.external_file_id, tenantId: item.tenant_id });
          } catch (delErr) {
            console.warn(`[Publishing Media Cleanup] Warning deleting R2 file ${item.external_file_id}:`, delErr.message);
          }
        } else if (item.provider === 'google_drive' && item.external_file_id) {
          if (!driveClient) {
            console.warn(`[Publishing Media Cleanup] Skipping Google Drive item ${item.id}: drive client unavailable.`);
            errors++;
            continue;
          }
          try {
            console.log(`[Publishing Media Cleanup] Purging expired Drive staging file ${item.external_file_id} for job ${item.job_id}...`);
            await driveClient.files.delete({ fileId: item.external_file_id });
          } catch (delErr) {
            const status = delErr?.status || delErr?.code || delErr?.response?.status;
            // 404 means already deleted on Drive, treat as successful deletion
            if (status !== 404 && !delErr?.message?.includes('File not found')) {
              throw delErr;
            }
          }
        }

        await markMediaStagingDeleted(item.id);
        deleted++;
        console.log(`[Publishing Media Cleanup] Marked media staging ${item.id} as deleted.`);
      } catch (itemErr) {
        errors++;
        console.error(`[Publishing Media Cleanup] Error purging staging item ${item.id} (job ${item.job_id}):`, itemErr.message);
      }
    }
  } catch (tickErr) {
    console.error('[Publishing Media Cleanup Tick Error]:', tickErr.message);
  } finally {
    isCleaningTick = false;
  }

  return { processed, deleted, errors };
}
```

**Code Sesudah (Proposed/After):**
```js
import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.js';
import {
  listExpiredMediaStaging,
  markMediaStagingDeleted,
  markMediaStagingDeletedByExternalFile
} from './publishing-repository.js';
import { isPublishingWorkerEnabled } from './node-config.js';
import { deleteObjectFromR2 } from './cloudflare-r2-client.js';
import { tenantContext } from './tenant-context.js';

let cleanupIntervalHandle = null;
let isCleaningTick = false;

const CLEANUP_BATCH_LIMIT = parseInt(process.env.PUBLISHING_MEDIA_CLEANUP_BATCH_SIZE || '50', 10);
const CLEANUP_MAX_PER_TICK = parseInt(process.env.PUBLISHING_MEDIA_CLEANUP_MAX_PER_TICK || '200', 10);

async function getDriveClientForTenant(tenantId, cache) {
  const key = tenantId || 'default_tenant';
  if (cache.has(key)) return cache.get(key);

  const client = await tenantContext.run(key, async () => {
    try {
      const auth = getAuthorizedClient();
      return google.drive({ version: 'v3', auth });
    } catch (authErr) {
      console.warn(`[Publishing Media Cleanup] Google client unavailable for tenant ${key}:`, authErr.message);
      return null;
    }
  });
  cache.set(key, client);
  return client;
}

/**
 * Single tick execution for status-aware Google Drive & R2 media staging cleanup.
 * @returns {Promise<{ processed: number, deleted: number, errors: number }>}
 */
export async function runPublishingMediaCleanupTick({
  batchLimit = CLEANUP_BATCH_LIMIT,
  maxPerTick = CLEANUP_MAX_PER_TICK,
  policyOverrides = {}
} = {}) {
  if (isCleaningTick) return { processed: 0, deleted: 0, errors: 0 };
  isCleaningTick = true;

  let processed = 0;
  let deleted = 0;
  let errors = 0;

  try {
    const driveClientCache = new Map();
    const deletedPhysicalFiles = new Set();

    while (processed < maxPerTick) {
      const remaining = Math.min(batchLimit, maxPerTick - processed);
      const expiredItems = await listExpiredMediaStaging(remaining, policyOverrides);
      if (!expiredItems || expiredItems.length === 0) break;

      let progressInBatch = 0;

      for (const item of expiredItems) {
        processed++;
        const fileKey = `${item.provider}:${item.external_file_id}`;

        try {
          if (!deletedPhysicalFiles.has(fileKey)) {
            if (item.provider === 'cloudflare_r2' && item.external_file_id) {
              try {
                console.log(`[Publishing Media Cleanup] Purging R2 staging file ${item.external_file_id} (${item.job_status}) for job ${item.job_id}...`);
                await deleteObjectFromR2({ key: item.external_file_id, tenantId: item.tenant_id });
              } catch (delErr) {
                console.warn(`[Publishing Media Cleanup] Warning deleting R2 file ${item.external_file_id}:`, delErr.message);
              }
            } else if (item.provider === 'google_drive' && item.external_file_id) {
              const driveClient = await getDriveClientForTenant(item.tenant_id, driveClientCache);
              if (!driveClient) {
                console.warn(`[Publishing Media Cleanup] Skipping Google Drive item ${item.id} (tenant ${item.tenant_id}): drive client unavailable.`);
                errors++;
                continue;
              }
              try {
                console.log(`[Publishing Media Cleanup] Purging Drive staging file ${item.external_file_id} (${item.job_status}) for job ${item.job_id}...`);
                await driveClient.files.delete({
                  fileId: item.external_file_id,
                  supportsAllDrives: true
                });
              } catch (delErr) {
                const status = delErr?.status || delErr?.code || delErr?.response?.status;
                // 404 means already deleted on Drive, treat as successful deletion
                if (status !== 404 && !delErr?.message?.includes('File not found')) {
                  throw delErr;
                }
              }
            }
            deletedPhysicalFiles.add(fileKey);
          }

          if (item.external_file_id) {
            const markedRows = await markMediaStagingDeletedByExternalFile(item.provider, item.external_file_id);
            deleted += markedRows.length || 1;
            progressInBatch += markedRows.length || 1;
          } else {
            await markMediaStagingDeleted(item.id);
            deleted++;
            progressInBatch++;
          }
          console.log(`[Publishing Media Cleanup] Marked media staging ${item.id} (file ${item.external_file_id}) as deleted.`);
        } catch (itemErr) {
          errors++;
          console.error(`[Publishing Media Cleanup] Error purging staging item ${item.id} (job ${item.job_id}):`, itemErr.message);
        }
      }

      if (expiredItems.length < remaining || progressInBatch === 0) {
        break;
      }
    }
  } catch (tickErr) {
    console.error('[Publishing Media Cleanup Tick Error]:', tickErr.message);
  } finally {
    isCleaningTick = false;
  }

  return { processed, deleted, errors };
}
```

---

### 3. `lib/publishing-worker.js`

**Code Sebelum (Current/Before):**
```js
  // Start periodic staging media cleanup worker
  try {
    const cleanupIntervalMs = parseInt(process.env.PUBLISHING_MEDIA_CLEANUP_INTERVAL_MS || '3600000', 10);
    startPublishingMediaCleanupWorker(cleanupIntervalMs);
  } catch (cleanErr) {
    console.warn('[Publishing Worker] Failed to start media cleanup worker:', cleanErr.message);
  }
```

**Code Sesudah (Proposed/After):**
```js
  // Start periodic staging media cleanup worker (default 30 menit)
  try {
    const cleanupIntervalMs = parseInt(process.env.PUBLISHING_MEDIA_CLEANUP_INTERVAL_MS || '1800000', 10);
    startPublishingMediaCleanupWorker(cleanupIntervalMs);
  } catch (cleanErr) {
    console.warn('[Publishing Worker] Failed to start media cleanup worker:', cleanErr.message);
  }
```

---

### 4. `lib/drive-uploader.js`

**Code Sebelum (Current/Before):**
```js
  // Cek apakah file sudah pernah diupload untuk jobId ini (idempoten)
  if (appProperties.jobId) {
    try {
      const q = `'${folderId}' in parents and appProperties has { key='jobId' and value='${appProperties.jobId}' } and trashed=false`;
      const searchRes = await drive.files.list({
        q,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, appProperties)'
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        const existing = searchRes.data.files[0];
        const directDownloadUrl = formatGoogleDriveDirectUrl(existing.id);
        console.log(`[Drive Upload] Reused existing upload for job ${appProperties.jobId} → fileId=${existing.id}`);
        return { fileId: existing.id, directDownloadUrl };
      }
    } catch (e) {
      console.warn('[Drive Uploader] Idempotency lookup failed, proceeding to upload:', e.message);
    }
  }
```

**Code Sesudah (Proposed/After):**
```js
  // Cek idempoten: prioritaskan mediaKey (dedup lintas platform untuk video sama), fallback ke jobId
  const lookupProp = appProperties.mediaKey
    ? { key: 'mediaKey', value: appProperties.mediaKey, label: `mediaKey ${appProperties.mediaKey}` }
    : (appProperties.jobId
      ? { key: 'jobId', value: appProperties.jobId, label: `job ${appProperties.jobId}` }
      : null);

  if (lookupProp) {
    try {
      const q = `'${folderId}' in parents and appProperties has { key='${lookupProp.key}' and value='${lookupProp.value}' } and trashed=false`;
      const searchRes = await drive.files.list({
        q,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, appProperties)'
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        const existing = searchRes.data.files[0];
        // Pastikan permission publik masih aktif agar aman untuk reuse
        await drive.permissions.create({
          fileId: existing.id,
          supportsAllDrives: true,
          requestBody: { role: 'reader', type: 'anyone' },
        }).catch(() => {});
        const directDownloadUrl = formatGoogleDriveDirectUrl(existing.id);
        console.log(`[Drive Upload] Reused existing upload for ${lookupProp.label} → fileId=${existing.id}`);
        return { fileId: existing.id, directDownloadUrl, reused: true };
      }
    } catch (e) {
      console.warn('[Drive Uploader] Idempotency lookup failed, proceeding to upload:', e.message);
    }
  }
```

---

### 5. `lib/publishing-drive-staging.js`

**Code Sebelum (Current/Before):**
```js
import { google } from 'googleapis';
import { getAuthorizedClient, verifyGoogleConnection } from './google-auth.js';
...
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
```

**Code Sesudah (Proposed/After):**
```js
import crypto from 'crypto';
import { google } from 'googleapis';
import { getAuthorizedClient, verifyGoogleConnection } from './google-auth.js';
...
/**
 * Bangun kunci deduplikasi stabil lintas platform untuk 1 sumber video yang sama
 * dalam tenant & folder tujuan yang sama.
 */
export function buildReplizMediaDedupKey({ tenantId = 'default_tenant', contentId = '', sourceUrl = '' } = {}) {
  const normalizedSource = String(sourceUrl || '').trim();
  const normalizedContent = String(contentId || '').trim();
  if (!normalizedSource) return '';
  return crypto
    .createHash('sha256')
    .update(`${tenantId}|${normalizedContent}|${normalizedSource}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Stage media to Google Drive (with cross-platform deduplication by mediaKey).
 */
export async function stageMediaToDrive(job) {
  const ready = await verifyPublishingDriveReady({ bypassCache: true });
  const folderId = ready.folderId;
  const tenantId = String(job.tenant_id || 'default_tenant');
  const sourceUrl = normalizeNextcloudDownloadUrl(job.media_url_snapshot);
  const mediaKey = buildReplizMediaDedupKey({
    tenantId,
    contentId: job.content_id || '',
    sourceUrl
  });

  const safeContentSlug = String(job.content_id || job.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  const filename = mediaKey
    ? `publishing_${safeContentSlug}_${mediaKey.slice(0, 8)}.mp4`
    : `publishing_${job.id}_${job.platform || 'video'}.mp4`;

  const appProperties = {
    jobId: String(job.id),
    tenantId,
    contentId: String(job.content_id || ''),
    ...(mediaKey ? { mediaKey } : {})
  };

  console.log(`[Drive Staging] Staging media for job ${job.id} (mediaKey=${mediaKey || 'none'}) to folder ${folderId}...`);
  const uploaded = await uploadUrlToPublicDrive(sourceUrl, filename, folderId, { appProperties });

  console.log(`[Drive Staging] Running anonymous probe on ${uploaded.directDownloadUrl}...`);
  await verifyAnonymousDriveDownload(uploaded.directDownloadUrl);
  console.log(`[Drive Staging] Anonymous probe passed for job ${job.id}!`);

  const retentionDays = parseInt(process.env.PUBLISHING_DRIVE_RETENTION_DAYS || '14', 10);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString();
```

---

### 6. `tests/publishing-drive-staging.test.js`

**Code Sebelum (Current/Before):**
```js
test('Drive Staging: runPublishingMediaCleanupTick purges expired items and marks deleted in DB without touching Nextcloud', async () => {
  ...
});
```

**Code Sesudah (Proposed/After):**
```js
// Pertahankan test existing, lalu tambahkan test baru di bawahnya:
test('Drive Staging: listExpiredMediaStaging enforces status-aware grace period (published 2h, cancelled 1h, needs_review 3d, scheduled never)', async () => {});
test('Drive Staging: listExpiredMediaStaging & cleanup hold shared external_file_id until all sibling jobs are eligible', async () => {});
test('Drive Staging: buildReplizMediaDedupKey produces identical key across platforms and changes when sourceUrl changes', () => {});
test('Drive Staging: runPublishingMediaCleanupTick uses per-item tenant context and supportsAllDrives=true', async () => {});
```
