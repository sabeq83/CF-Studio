import { generateImage, getFileUrl, getTaskStatus, getTaskModelInfo } from './webhook-client.js';
import { buildOpcStartFrameRequest } from './opc-start-frame-request.js';
import { createStartFrameRequestAudit, updateStartFrameRequestAudit, updateStartFrameAuditByTaskId } from './opc-start-frame-audit.js';
import { requestImageLane, attachProviderTask, heartbeatImageLane, releaseImageLane, reserveGlabsSubmitSlot } from './glabs-image-lane-service.js';
import { getDb, getSetting } from './db.js';
import { resolveProductRefLaneSettings } from './product-ref-lane-settings.js';

export function createStartFrameProviderAdapter(deps = {}) {
  const {
    generateImage: generateImageFn = generateImage,
    getFileUrl: getFileUrlFn = getFileUrl,
    getTaskStatus: getTaskStatusFn = getTaskStatus,
    getTaskModelInfo: getTaskModelInfoFn = getTaskModelInfo,
    buildOpcStartFrameRequest: buildRequestFn = buildOpcStartFrameRequest,
    createStartFrameRequestAudit: createAuditFn = createStartFrameRequestAudit,
    updateStartFrameRequestAudit: updateAuditFn = updateStartFrameRequestAudit,
    updateStartFrameAuditByTaskId: updateAuditByTaskIdFn = updateStartFrameAuditByTaskId,
    requestImageLane: requestImageLaneFn = requestImageLane,
    attachProviderTask: attachProviderTaskFn = attachProviderTask,
    heartbeatImageLane: heartbeatImageLaneFn = heartbeatImageLane,
    releaseImageLane: releaseImageLaneFn = releaseImageLane,
    reserveGlabsSubmitSlot: reserveSubmitSlotFn = reserveGlabsSubmitSlot,
    getSetting: getSettingFn = getSetting,
    getDb: getDbFn = getDb
  } = deps;

  return {
    async submit(request) {
      let context = request?.context;
      if (context?.campaignId && context?.itemId && (!context.campaign || !context.item)) {
        const db = getDbFn();
        context = {
          ...context,
          campaign: await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(context.campaignId),
          item: await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(context.itemId)
        };
      }
      if (!context) {
        const error = new Error('OPC start-frame request wajib membawa canonical context.');
        error.code = 'START_FRAME_CONTEXT_REQUIRED';
        error.status = 422;
        throw error;
      }

      const built = await buildRequestFn(context);
      const auditId = request.auditId || (built.audit ? await createAuditFn({
        ...built.audit,
        lifecycle_status: 'prepared'
      }) : null);

      const requiresProductReference = Boolean(built.audit?.requires_product_reference);
      const { laneMode: configuredProductRefLaneMode, staggerSec } = resolveProductRefLaneSettings(getSettingFn);
      const useStaggered = requiresProductReference && configuredProductRefLaneMode === 'shared_staggered';
      const laneMode = (requiresProductReference && !useStaggered) ? 'exclusive' : 'shared';

      // Request provider lane
      const laneResult = await requestImageLaneFn({
        tenantId: context.tenantId || context.campaign?.tenant_id,
        webhookOverride: built.providerRequest?.webhookOverride,
        mode: laneMode,
        ownerKind: 'start_frame_asset',
        ownerId: request.assetId || `asset_${Date.now()}`,
        campaignId: String(context.campaign?.id || context.campaignId || ''),
        campaignItemId: String(context.item?.id || context.itemId || ''),
        assetId: request.assetId || null,
        leaseSeconds: 180
      });

      const leaseId = laneResult.id || laneResult.lease?.id;
      const laneKey = laneResult.laneKey || laneResult.lease?.lane_key;

      if (!laneResult.acquired) {
        if (auditId) {
          await updateAuditFn(auditId, {
            lane_key: laneKey,
            lane_mode: laneMode,
            lane_wait_started_at: new Date()
          }).catch(() => {});
        }
        return {
          status: 'waiting_lane',
          leaseId,
          laneKey,
          laneMode
        };
      }

      if (useStaggered) {
        const slot = await reserveSubmitSlotFn(laneKey, staggerSec);
        if (!slot.allowed) {
          await releaseImageLaneFn(leaseId, 'stagger_wait').catch(() => {});
          if (auditId) {
            await updateAuditFn(auditId, {
              lane_key: laneKey,
              lane_mode: 'shared',
              lane_wait_started_at: new Date()
            }).catch(() => {});
          }
          return {
            status: 'waiting_lane',
            leaseId: null,
            laneKey,
            laneMode: 'shared',
            retryAfterMs: slot.waitMs,
            nextAllowedAt: slot.nextAllowedAt
          };
        }
      }

      // Lane acquired! Submit image generation to provider
      try {
        const providerPayload = useStaggered
          ? { ...built.providerRequest, skipDelay: true }
          : built.providerRequest;
        const result = await generateImageFn(providerPayload);
        if (!result?.task_id) {
          throw new Error('Provider tidak mengembalikan task_id.');
        }

        const requestedModel = built.audit?.requested_model || built.providerRequest?.model || 'nano_banana_2';
        const effectiveModel = result?.effective_model || requestedModel;
        const actualFingerprint = effectiveModel !== requestedModel && built.rebuildFingerprintForModel
          ? built.rebuildFingerprintForModel(effectiveModel)
          : built.audit?.request_fingerprint;

        if (effectiveModel !== requestedModel) {
          console.warn(`[StartFrame Model] Clip ${context.clipIndex} (item #${context.item?.id || context.itemId}): fallback kuota ${requestedModel} -> ${effectiveModel} (${result?.fallback_reason || 'quota'})`);
        } else {
          console.log(`[StartFrame Model] Clip ${context.clipIndex} (item #${context.item?.id || context.itemId}): model=${effectiveModel} task=${result.task_id}`);
        }

        await attachProviderTaskFn(leaseId, result.task_id);

        if (auditId) {
          await updateAuditFn(auditId, {
            provider_task_id: result.task_id,
            effective_model: effectiveModel,
            request_fingerprint: actualFingerprint,
            lane_key: laneKey,
            lane_mode: laneMode,
            lane_acquired_at: new Date(),
            lifecycle_status: 'submitted',
            provider_submitted_at: new Date()
          }).catch(() => {});
        }

        return {
          status: 'submitted',
          taskId: result.task_id,
          leaseId,
          laneKey,
          laneMode,
          auditId,
          requestedModel,
          effectiveModel,
          fallbackFrom: result?.fallback_from || null
        };
      } catch (err) {
        // If submit fails, immediately release lane lease so others aren't blocked
        await releaseImageLaneFn(leaseId, `submit_failed:${err.message?.slice(0, 100)}`).catch(() => {});
        if (auditId) {
          await updateAuditFn(auditId, {
            lifecycle_status: 'failed'
          }).catch(() => {});
        }
        throw err;
      }
    },

    async poll(taskId, { leaseId = null, auditId = null, clipIndex = null, itemId = null, context = null } = {}) {
      if (leaseId) {
        await heartbeatImageLaneFn(leaseId, { extendSeconds: 60 }).catch(() => {});
      }
      const result = await getTaskStatusFn(taskId);
      const modelInfo = result?.effective_model ? result : getTaskModelInfoFn(taskId);
      const effectiveModel = modelInfo?.effective_model || null;
      const requestedModel = modelInfo?.requested_model || null;
      const isFallback = Boolean(modelInfo?.fallback_from || (requestedModel && effectiveModel && effectiveModel !== requestedModel));

      const status = String(result?.status || '').toLowerCase();
      if (isFallback && status === 'pending') {
        console.warn(`[StartFrame Model] Clip ${clipIndex ?? '?'} (item #${itemId ?? '?'}): async fallback kuota ${modelInfo?.fallback_from || requestedModel} -> ${effectiveModel} (task=${taskId} -> ${modelInfo?.fallback_task_id || taskId}, reason=${modelInfo?.fallback_reason || 'quota'})`);
      }

      if (status === 'failed') {
        if (leaseId) {
          await releaseImageLaneFn(leaseId, 'provider_failed').catch(() => {});
        }
        if (auditId) {
          await updateAuditFn(auditId, { lifecycle_status: 'failed' }).catch(() => {});
        } else {
          await updateAuditByTaskIdFn(taskId, { lifecycle_status: 'failed' }).catch(() => {});
        }
        return {
          status: 'failed',
          error: result.error || result.message || 'Provider task failed.'
        };
      }
      if (status !== 'completed') {
        return { status: 'pending' };
      }
      const files = result.results || result.files || [];
      let filename = files.find(file => /\.(png|jpe?g|webp)$/i.test(file)) || files[0];
      if (!filename) {
        if (leaseId) {
          await releaseImageLaneFn(leaseId, 'no_image_file').catch(() => {});
        }
        return { status: 'failed', error: 'Provider selesai tanpa file gambar.' };
      }
      if (/^https?:\/\//.test(filename)) {
        filename = filename.split('/').pop();
      }

      const auditCompletion = {
        lifecycle_status: 'completed',
        provider_completed_at: new Date(),
        ...(effectiveModel ? { effective_model: effectiveModel } : {})
      };
      if (isFallback && effectiveModel) {
        console.warn(`[StartFrame Model] Clip ${clipIndex ?? '?'} (item #${itemId ?? '?'}): selesai via fallback ${modelInfo?.fallback_from || requestedModel} -> ${effectiveModel} (task=${taskId})`);
        if (context && (context.campaign || (context.campaignId && context.itemId))) {
          try {
            let rebuiltCtx = context;
            if (!rebuiltCtx.campaign || !rebuiltCtx.item) {
              const db = getDbFn();
              rebuiltCtx = {
                ...context,
                campaign: await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(context.campaignId),
                item: await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(context.itemId)
              };
            }
            const builtForActual = await buildRequestFn({ ...rebuiltCtx, modelOverride: effectiveModel });
            if (builtForActual?.audit?.request_fingerprint) {
              auditCompletion.request_fingerprint = builtForActual.audit.request_fingerprint;
            }
          } catch (_) {}
        }
      }
      if (auditId) {
        await updateAuditFn(auditId, auditCompletion).catch(() => {});
      } else {
        await updateAuditByTaskIdFn(taskId, auditCompletion).catch(() => {});
      }

      return {
        status: 'completed',
        downloadUrl: getFileUrlFn(filename, taskId),
        files,
        filename,
        effectiveModel: effectiveModel || null
      };
    }
  };
}

export const startFrameProviderAdapter = createStartFrameProviderAdapter();
