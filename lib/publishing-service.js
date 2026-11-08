import { getActiveTenantId } from './tenant-context.js';
import {
  createPublishingJobs,
  getPublishingAccountById,
  recordPublishingAccountHealth
} from './publishing-repository.js';
import { validateScheduleRequest } from './publishing-contract.js';
import { getSetting } from './db.js';
import { getReplizAccount } from './repliz-client.js';
import { verifyPublishingStagingReady } from './publishing-drive-staging.js';
import { pgQuery } from './db-pg.js';

/**
 * Shared service to validate, auto-reconnect, stage, and enqueue publishing jobs.
 * Used identically by `/api/v2/publishing/jobs` and ContentFlow Studio approval dispatch.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} [params.userId]
 * @param {Object} params.rawBody
 * @returns {Promise<{ success: boolean, message: string, data: Array }>}
 */
export async function schedulePublishingJobs({ tenantId, userId = null, rawBody }) {
  if (!tenantId) {
    tenantId = getActiveTenantId() || 'default_tenant';
  }

  const validated = validateScheduleRequest(rawBody);

  const accountsMap = {};
  for (const accId of validated.account_ids) {
    const acc = await getPublishingAccountById(tenantId, accId);
    if (acc) accountsMap[accId] = acc;
  }

  const targets = validated.account_ids.map(accId => {
    const acc = accountsMap[accId];
    const platform = (acc?.platform || '').toLowerCase();

    // Platform-Adaptive Caption: Facebook gets clickable Shopee link, Non-FB gets 100% Link di Bio!
    let selectedCaption = validated.caption;
    if (validated.platform_captions && validated.platform_captions[platform]) {
      selectedCaption = validated.platform_captions[platform];
    } else if (platform === 'facebook' && validated.caption_facebook) {
      selectedCaption = validated.caption_facebook;
    } else if (platform && platform !== 'facebook' && validated.caption_bio) {
      selectedCaption = validated.caption_bio;
    }

    return {
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      title: validated.title,
      caption: selectedCaption,
      mediaUrl: validated.media_url,
      scheduledAt: validated.schedules?.[accId] || validated.scheduled_at,
      approvalStatus: 'not_required',
      isAiGenerated: !!validated.is_ai_generated
    };
  });

  let requiresReplizStaging = false;
  for (const accId of validated.account_ids) {
    let acc = accountsMap[accId];
    if (!acc) continue;

    if (acc.provider === 'repliz') {
      if (validated.media_type !== 'text_only') {
        requiresReplizStaging = true;
      }

      // Live Auto-Reconnect & Health Probe jika akun lokal tercatat disconnected
      if (acc.status === 'disconnected') {
        try {
          const url = (await getSetting('repliz_api_url')) || 'https://api.repliz.com';
          const accessKey = await getSetting('repliz_access_key');
          const secretKey = await getSetting('repliz_secret_key');
          if (accessKey && secretKey) {
            const remoteAcc = await getReplizAccount({ apiUrl: url, accessKey, secretKey }, acc.provider_account_id);
            const isConnected = remoteAcc && remoteAcc.isConnected !== false && remoteAcc.status !== 'disconnected';
            if (isConnected) {
              acc = await recordPublishingAccountHealth(tenantId, acc.id, {
                isConnected: true,
                lastErrorCode: null,
                lastErrorMessage: null
              });
              console.log(`[Publishing Service] Auto-reconnected Repliz account ${acc.display_name} (${acc.id})`);
            } else {
              const err = new Error(`Akun ${acc.display_name} (${acc.platform.toUpperCase()}) terputus di Repliz. Silakan hubungkan ulang (reconnect) akun Anda di Repliz, lalu coba kembali.`);
              err.code = 'REPLIZ_ACCOUNT_DISCONNECTED';
              err.status = 409;
              err.reconnectUrl = 'https://repliz.com/user/account';
              throw err;
            }
          }
        } catch (probeErr) {
          if (probeErr.code === 'REPLIZ_ACCOUNT_DISCONNECTED') throw probeErr;
          console.warn('[Publishing Service] Gagal live probe Repliz account:', probeErr.message);
          const err = new Error(`Akun ${acc.display_name} (${acc.platform.toUpperCase()}) terputus di Repliz. Silakan hubungkan ulang akun Anda di Repliz.`);
          err.code = 'REPLIZ_ACCOUNT_DISCONNECTED';
          err.status = 409;
          err.reconnectUrl = 'https://repliz.com/user/account';
          throw err;
        }
      }
    }
  }

  if (requiresReplizStaging) {
    await verifyPublishingStagingReady({ bypassCache: true, tenantId });
  }

  const createdJobs = await createPublishingJobs({
    tenantId,
    userId,
    contentId: validated.content_id,
    targets
  });

  // AUTO-SYNC ContentFlow: tandai 'Scheduled' segera setelah job dibuat
  if (validated.content_id && createdJobs.length > 0) {
    try {
      const platforms = [...new Set(createdJobs.map(j => j.platform).filter(Boolean))];
      const platformColumnMap = {
        facebook:  'facebook_status',
        instagram: 'instagram_status',
        tiktok:    'tiktok_status',
        youtube:   'youtube_status',
        threads:   'threads_status',
        linkedin:  'linkedin_status'
      };
      for (const platform of platforms) {
        const col = platformColumnMap[platform];
        if (!col) continue;
        await pgQuery(
          `UPDATE content_flow_items
           SET ${col} = 'Scheduled', updated_at = CURRENT_TIMESTAMP
           WHERE video_id = $1 AND tenant_id = $2`,
          [validated.content_id, tenantId]
        );
      }
      console.log(`[Publishing Service] Auto-synced ContentFlow to Scheduled for ${validated.content_id} (${platforms.join(', ')})`);
    } catch (syncErr) {
      console.warn('[Publishing Service] Gagal auto-sync ContentFlow status:', syncErr.message);
    }
  }

  return {
    success: true,
    message: `Berhasil menjadwalkan ${createdJobs.length} posting publikasi.`,
    data: createdJobs
  };
}
