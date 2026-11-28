import { generateImage, getTaskStatus } from './webhook-client.js';
import { buildGlabsImageLaneKey, waitAndReserveGlabsSubmitSlot } from './glabs-image-lane-service.js';
import { clampProductRefStaggerSec } from './product-ref-lane-settings.js';

/**
 * Submits T2I tasks sequentially via the atomic PostgreSQL submit stagger gate,
 * then polls all submitted tasks in parallel and invokes callbacks as each finishes.
 */
export async function runStaggeredT2iBatch({
  tasks = [],
  staggerSec = 12,
  pollIntervalMs = 2000,
  maxAttempts = 60,
  onSubmitted = null,
  onCompleted = null,
  onFailed = null,
  waitSlotFn = waitAndReserveGlabsSubmitSlot,
  generateImageFn = generateImage,
  getTaskStatusFn = getTaskStatus,
  sleepFn = (ms) => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const effectiveStaggerSec = clampProductRefStaggerSec(staggerSec, 12);
  const submitted = [];

  for (const task of tasks) {
    const laneKey = task.laneKey || buildGlabsImageLaneKey(task.webhookOverride);
    try {
      await waitSlotFn(laneKey, effectiveStaggerSec);
      const submitResult = task.submit
        ? await task.submit({ skipDelay: true, laneKey })
        : await generateImageFn({ ...task.providerRequest, skipDelay: true });

      if (!submitResult?.task_id) {
        const errMsg = 'Provider tidak mengembalikan task_id.';
        if (onFailed) {
          await onFailed({ task, taskId: null, error: errMsg, lastStatus: 'submit_failed', submitResult });
        }
        continue;
      }

      const entry = {
        task,
        taskId: submitResult.task_id,
        submitResult,
        completed: false,
        failed: false,
        files: null,
        lastStatus: 'pending',
        error: null
      };
      submitted.push(entry);

      if (onSubmitted) {
        await onSubmitted({ task, taskId: submitResult.task_id, submitResult });
      }
    } catch (err) {
      if (onFailed) {
        await onFailed({
          task,
          taskId: null,
          error: err?.message || 'Submit failed',
          lastStatus: 'submit_error',
          err
        });
      }
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (submitted.every(entry => entry.completed || entry.failed)) {
      break;
    }
    await sleepFn(pollIntervalMs);

    for (const entry of submitted) {
      if (entry.completed || entry.failed) continue;
      try {
        const statusResult = await getTaskStatusFn(entry.taskId);
        const status = String(statusResult?.status || '').toLowerCase();
        entry.lastStatus = status || 'unknown';

        if (status === 'completed' || status === 'succeeded') {
          entry.completed = true;
          entry.files = statusResult.results || statusResult.files || [];
          if (onCompleted) {
            await onCompleted({
              task: entry.task,
              taskId: entry.taskId,
              files: entry.files,
              statusResult
            });
          }
        } else if (status === 'failed') {
          entry.failed = true;
          entry.error = statusResult?.error || statusResult?.message || statusResult?.detail || 'provider returned failed';
          if (onFailed) {
            await onFailed({
              task: entry.task,
              taskId: entry.taskId,
              error: entry.error,
              lastStatus: entry.lastStatus,
              statusResult
            });
          }
        }
      } catch (pollErr) {
        entry.lastStatus = 'poll_error';
        entry.error = pollErr?.message || 'Polling error';
      }
    }
  }

  for (const entry of submitted) {
    if (!entry.completed && !entry.failed) {
      entry.failed = true;
      entry.error = entry.error || `Polling timeout after ${Math.round((maxAttempts * pollIntervalMs) / 1000)}s (lastStatus=${entry.lastStatus})`;
      if (onFailed) {
        await onFailed({
          task: entry.task,
          taskId: entry.taskId,
          error: entry.error,
          lastStatus: entry.lastStatus
        });
      }
    }
  }

  return submitted;
}
