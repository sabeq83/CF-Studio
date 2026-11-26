/**
 * Publishing Media Cleanup Worker Module
 * Background worker responsible for purging Google Drive & R2 staging files
 * using status-aware retention (published/draft_created, cancelled, failed/needs_review)
 * and safe ref-counting across sibling jobs sharing the same external_file_id.
 *
 * CRITICAL SAFETY INVARIANT:
 * This worker ONLY purges temporary staging copies on Google Drive / R2.
 * It NEVER touches, modifies, or deletes the original source media on Nextcloud.
 */

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
      console.warn(`[Publishing Media Cleanup] Google client not available for tenant ${key}:`, authErr.message);
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
  policyOverrides = {},
  tenantIds = null,
  driveClientFactory = null,
  r2DeleteFn = null
} = {}) {
  if (isCleaningTick) return { processed: 0, deleted: 0, errors: 0 };
  isCleaningTick = true;

  let processed = 0;
  let deleted = 0;
  let errors = 0;

  try {
    const driveClientCache = new Map();
    const deletedPhysicalFiles = new Set();
    const effectivePolicy = tenantIds ? { ...policyOverrides, tenantIds } : policyOverrides;

    while (processed < maxPerTick) {
      const remaining = Math.min(batchLimit, maxPerTick - processed);
      const expiredItems = await listExpiredMediaStaging(remaining, effectivePolicy);
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
                const deleter = r2DeleteFn || deleteObjectFromR2;
                await deleter({ key: item.external_file_id, tenantId: item.tenant_id });
              } catch (delErr) {
                console.warn(`[Publishing Media Cleanup] Warning deleting R2 file ${item.external_file_id}:`, delErr.message);
              }
            } else if (item.provider === 'google_drive' && item.external_file_id) {
              const driveClient = driveClientFactory
                ? await driveClientFactory(item.tenant_id)
                : await getDriveClientForTenant(item.tenant_id, driveClientCache);
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
            deleted += markedRows.length;
            progressInBatch += markedRows.length;
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

/**
 * Start periodic cleanup timer (default every 30 minutes).
 */
export function startPublishingMediaCleanupWorker(intervalMs = 1800000) {
  if (!isPublishingWorkerEnabled()) {
    return null;
  }

  if (cleanupIntervalHandle) {
    return cleanupIntervalHandle;
  }

  console.log(`🧹 Starting MAKNA Publishing Media Cleanup Worker (interval: ${intervalMs}ms)...`);
  runPublishingMediaCleanupTick().catch(err => console.error('[Cleanup Initial Tick Error]:', err));

  cleanupIntervalHandle = setInterval(runPublishingMediaCleanupTick, intervalMs);
  return cleanupIntervalHandle;
}

/**
 * Stop periodic cleanup timer.
 */
export function stopPublishingMediaCleanupWorker() {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
    console.log('🛑 MAKNA Publishing Media Cleanup Worker stopped.');
  }
}
