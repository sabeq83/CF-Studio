# Implementation Plan: Pemulihan Task Gagal/Macet, Approval Multiplier, Filter `needs_review`, & Perbaikan `cf_get_cluster_health` MCP

**Sumber Usulan:** [USULAN_PENANGANAN_GAGAL_DAN_STUCK_VIA_MCP.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_PENANGANAN_GAGAL_DAN_STUCK_VIA_MCP.md)  
**Target Branch Kerja:** `hotfix/mcp-recovery-tools` (dibuat dari `main` sesuai SOP Alur 2: Hotfix Staging)  
**Lingkungan Uji Target:** Unit test lokal (`PG_SEARCH_PATH=dev`), `npm run test:mcp`, `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, lalu merge ke `main`, `npm run release-non-interactive -- --type patch`, dan deploy atomic ke **Staging (`5010`/`7010`)** untuk pengujian langsung di Staging (tanpa migrasi database).

> [!NOTE]
> **Tanpa Migrasi Database & Tanpa Perubahan UI:** Seluruh perubahan hanya menyentuh lapisan MCP (`apps/mcp/tools.mjs`, `apps/mcp/README.md`), API/helper Multiplier (`lib/multiplier-artifacts.js`, `app/api/v2/multiplier/route.js`, `app/api/v2/multiplier/[id]/retry/route.js`), dan serialisasi runtime worker (`lib/content-automation-worker.js`, `lib/content-automation-notification-worker.js`).

---

## Execution Task List

### Tahap 0: Persiapan Branch
- [x] Pastikan `main` bersih/terbaru lalu buat branch baru dari `main` (`git checkout -b hotfix/mcp-recovery-tools`)

### Tahap 1: Helper Bersama & API Recovery Multiplier (`force` & `stage`)
- [x] Tambahkan helper `resolveMultiplierStageRetryTarget()` di [lib/multiplier-artifacts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-artifacts.js) memakai `FAILED_CODE_TO_WORKER_STATUS` dan validasi artefak (`ffmpeg`, `cloud`) agar tidak ada duplikasi antara route `PATCH` dan `POST`
- [x] Perbarui [app/api/v2/multiplier/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/route.js) (`action === 'retry_task'`) agar mendukung parameter opsional `force` (mengizinkan pemulihan status in-progress macet) dan `stage` (`remaking`, `t2i`, `tts`, `visuals`, `ffmpeg`, `cloud`)
- [x] Refaktor [app/api/v2/multiplier/[id]/retry/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/multiplier/%5Bid%5D/retry/route.js) agar menggunakan `resolveMultiplierStageRetryTarget()`

### Tahap 2: Perbaikan Serialisasi JSON `cf_get_cluster_health`
- [x] Perbarui `getContentAutomationRuntime()` di [lib/content-automation-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/content-automation-worker.js) agar tidak men-spread `state.interval` (objek `Timeout` Node.js yang circular)
- [x] Perbarui `getContentAutomationNotificationRuntime()` di [lib/content-automation-notification-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/content-automation-notification-worker.js) agar tidak men-spread `state.interval`

### Tahap 3: Pembaruan MCP Tools (`apps/mcp/tools.mjs` & `apps/mcp/README.md`)
- [x] Tambahkan cabang `job_id.startsWith('mul_')` pada `cf_approve_job` menuju `POST /api/v2/multiplier/[id]/approve`
- [x] Tambahkan parameter opsional `force` dan `stage` pada `cf_retry_multiplier_task`
- [x] Tambahkan `'scheduled'` dan `'needs_review'` pada enum `status` di `cf_list_publishing_jobs`
- [x] Perbarui dokumentasi ringkas pada [apps/mcp/README.md](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/README.md)

### Tahap 4: Pengujian & Build Verifikasi
- [x] Tambahkan test MCP baru di [apps/mcp/test/mcp.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/test/mcp.test.mjs) (`cf_approve_job` untuk `mul_*`, `cf_retry_multiplier_task` dengan `force` + `stage`, `cf_list_publishing_jobs` dengan `needs_review` + `scheduled`)
- [x] Tambahkan unit test backend [tests/mcp-recovery-tools.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/mcp-recovery-tools.test.mjs) untuk memverifikasi `resolveMultiplierStageRetryTarget()`, `getContentAutomationRuntime()`, dan `getContentAutomationNotificationRuntime()` bebas error circular JSON
- [x] Jalankan `npm run test:mcp`, `PG_SEARCH_PATH=dev node --test tests/mcp-recovery-tools.test.mjs tests/test-mcp-tools-parity.test.js`, dan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`

---

## Rincian Perubahan Kode (Before & After Code Snippets)

### 1. `lib/multiplier-artifacts.js`

**Code Sebelum (Current/Before):**
```js
  const recommendedStage = resolveMultiplierResumeStage(task, artifacts);
  artifacts.recommended_resume_stage = recommendedStage;
  artifacts.recommended_resume_label = MULTIPLIER_STAGE_LABELS[recommendedStage] || recommendedStage;

  return artifacts;
}
```

**Code Sesudah (Proposed/After):**
```js
import {
  FAILED_CODE_TO_WORKER_STATUS,
  MULTIPLIER_STAGE_LABELS,
  parseJsonSafe,
  resolveMultiplierResumeStage,
} from './multiplier-resume.js';

// ... di bagian bawah file:

  const recommendedStage = resolveMultiplierResumeStage(task, artifacts);
  artifacts.recommended_resume_stage = recommendedStage;
  artifacts.recommended_resume_label = MULTIPLIER_STAGE_LABELS[recommendedStage] || recommendedStage;

  return artifacts;
}

const VALID_RETRY_STAGES = new Set(['remaking', 't2i', 'tts', 'visuals', 'ffmpeg', 'cloud']);

/**
 * Memetakan `stage` retry eksplisit menjadi status worker berikutnya beserta validasi artefak.
 */
export function resolveMultiplierStageRetryTarget(task = {}, stage, dbGlabsTasks = null) {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  if (!VALID_RETRY_STAGES.has(normalizedStage)) {
    return {
      ok: false,
      statusCode: 400,
      error: `Stage retry '${stage}' tidak valid. Pilihan: remaking, t2i, tts, visuals, ffmpeg, cloud.`,
    };
  }

  const artifacts = inspectMultiplierTaskArtifacts(task, dbGlabsTasks);
  if (normalizedStage === 'ffmpeg' && !artifacts.has_visual_clips) {
    return {
      ok: false,
      statusCode: 409,
      error: 'Klip video G-Labs belum lengkap untuk langsung menjalankan FFmpeg Muxing. Gunakan Lanjutkan / Visuals terlebih dahulu.',
      artifacts,
    };
  }
  if (normalizedStage === 'cloud' && !artifacts.has_final_video) {
    return {
      ok: false,
      statusCode: 409,
      error: 'File video master hasil FFmpeg belum ditemukan di disk; jalankan FFmpeg Muxing terlebih dahulu.',
      artifacts,
    };
  }

  const nextStatus = FAILED_CODE_TO_WORKER_STATUS[normalizedStage] || 'pending_resolution';
  return {
    ok: true,
    stage: normalizedStage,
    nextStatus,
    label: MULTIPLIER_STAGE_LABELS[nextStatus] || nextStatus,
    artifacts,
  };
}
```

---

### 2. `app/api/v2/multiplier/route.js`

**Code Sebelum (Current/Before):**
```js
    if (action === 'retry_task') {
      const { dbRun } = await import('@/lib/db');
      const targetTaskId = taskId || id;
      if (!targetTaskId) {
        return NextResponse.json({ success: false, error: 'taskId wajib disertakan untuk aksi retry_task' }, { status: 400 });
      }

      const task = await getMultiplierTaskById(targetTaskId);
      if (!task) {
        return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
      }
      if (task.status !== 'failed') {
        return NextResponse.json({
          success: false,
          error: `Task ${targetTaskId} berstatus '${task.status}', hanya task 'failed' yang bisa di-retry.`
        }, { status: 409 });
      }

      const mode = body.mode === 'restart_all' ? 'restart_all' : 'smart_resume';
      let nextStatus = 'pending_resolution';
      let resumedLabel = 'Dari Awal';
      let artifacts = null;

      if (mode === 'smart_resume') {
        const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [targetTaskId]);
        artifacts = inspectMultiplierTaskArtifacts(task, glabsTasks);
        nextStatus = artifacts.recommended_resume_stage || 'pending_resolution';
        resumedLabel = artifacts.recommended_resume_label || nextStatus;
      }

      const result = await dbRun(`
        UPDATE re_multiplier_tasks
        SET status = ?, error_message = NULL, failed_stage = NULL
        WHERE id = ? AND status = 'failed'
      `, [nextStatus, targetTaskId]);

      return NextResponse.json({
        success: true,
        resumed_stage: nextStatus,
        resumed_label: resumedLabel,
        mode,
        artifacts,
        message: mode === 'restart_all'
          ? `Task ${targetTaskId} diulang dari awal (pending_resolution).`
          : `Task ${targetTaskId} dilanjutkan langsung dari tahap ${resumedLabel} (${nextStatus}).`,
        affected: result.changes || result.rowCount || 0
      });
    }
```

**Code Sesudah (Proposed/After):**
```js
    if (action === 'retry_task') {
      const { dbRun } = await import('@/lib/db');
      const { resolveMultiplierStageRetryTarget } = await import('@/lib/multiplier-artifacts');
      const IN_PROGRESS_STUCK_STATUSES = new Set([
        'pending_resolution',
        'resolving_product',
        'remaking',
        'generating_t2i',
        'generating_audio',
        'generating_visuals',
        'ffmpeg_muxing',
        'uploading_assets',
      ]);

      const targetTaskId = taskId || id;
      if (!targetTaskId) {
        return NextResponse.json({ success: false, error: 'taskId wajib disertakan untuk aksi retry_task' }, { status: 400 });
      }

      const task = await getMultiplierTaskById(targetTaskId);
      if (!task) {
        return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
      }

      const force = Boolean(body.force);
      const canRecoverStuck = force && IN_PROGRESS_STUCK_STATUSES.has(task.status);
      if (task.status !== 'failed' && !canRecoverStuck) {
        return NextResponse.json({
          success: false,
          error: `Task ${targetTaskId} berstatus '${task.status}', hanya task 'failed' (atau task in-progress macet dengan force=true) yang bisa di-retry.`
        }, { status: 409 });
      }

      const requestedStage = typeof body.stage === 'string' && body.stage.trim() ? body.stage.trim() : null;
      const mode = body.mode === 'restart_all' ? 'restart_all' : 'smart_resume';
      let nextStatus = 'pending_resolution';
      let resumedLabel = 'Dari Awal';
      let artifacts = null;

      if (requestedStage) {
        const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [targetTaskId]);
        const target = resolveMultiplierStageRetryTarget(task, requestedStage, glabsTasks);
        if (!target.ok) {
          return NextResponse.json({ success: false, error: target.error, artifacts: target.artifacts || null }, { status: target.statusCode || 400 });
        }
        nextStatus = target.nextStatus;
        resumedLabel = target.label;
        artifacts = target.artifacts;
      } else if (mode === 'smart_resume') {
        const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [targetTaskId]);
        artifacts = inspectMultiplierTaskArtifacts(task, glabsTasks);
        nextStatus = artifacts.recommended_resume_stage || 'pending_resolution';
        resumedLabel = artifacts.recommended_resume_label || nextStatus;
      }

      const result = nextStatus === 'ffmpeg_muxing'
        ? await dbRun(`
            UPDATE re_multiplier_tasks
            SET status = ?, error_message = NULL, failed_stage = NULL, ffmpeg_output_path = NULL
            WHERE id = ? AND status = ?
          `, [nextStatus, targetTaskId, task.status])
        : await dbRun(`
            UPDATE re_multiplier_tasks
            SET status = ?, error_message = NULL, failed_stage = NULL
            WHERE id = ? AND status = ?
          `, [nextStatus, targetTaskId, task.status]);

      return NextResponse.json({
        success: true,
        resumed_stage: nextStatus,
        resumed_label: resumedLabel,
        mode: requestedStage ? `stage:${requestedStage}` : mode,
        forced: canRecoverStuck,
        artifacts,
        message: requestedStage
          ? `Task ${targetTaskId} ditrigger ulang pada tahap ${resumedLabel} (${nextStatus}).`
          : (mode === 'restart_all'
              ? `Task ${targetTaskId} diulang dari awal (pending_resolution).`
              : `Task ${targetTaskId} dilanjutkan langsung dari tahap ${resumedLabel} (${nextStatus}).`),
        affected: result.changes || result.rowCount || 0
      });
    }
```

---

### 3. `app/api/v2/multiplier/[id]/retry/route.js`

**Code Sebelum (Current/Before):**
```js
import { inspectMultiplierTaskArtifacts } from '@/lib/multiplier-artifacts';
...
    const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [id]);
    const artifacts = inspectMultiplierTaskArtifacts(task, glabsTasks);

    let nextStatus = 'pending_resolution';
    if (stage === 'remaking') nextStatus = 'remaking';
    else if (stage === 't2i') nextStatus = 'generating_t2i';
    else if (stage === 'tts') nextStatus = 'generating_audio';
    else if (stage === 'visuals') nextStatus = 'generating_visuals';
    else if (stage === 'ffmpeg') {
      if (!artifacts.has_visual_clips) {
        return NextResponse.json({
          success: false,
          error: 'Klip video G-Labs belum lengkap untuk langsung menjalankan FFmpeg Muxing. Gunakan Lanjutkan / Visuals terlebih dahulu.'
        }, { status: 409 });
      }
      nextStatus = 'ffmpeg_muxing';
    } else if (stage === 'cloud') {
      if (!artifacts.has_final_video) {
        return NextResponse.json({
          success: false,
          error: 'File video master hasil FFmpeg belum ditemukan di disk; jalankan FFmpeg Muxing terlebih dahulu.'
        }, { status: 409 });
      }
      nextStatus = 'uploading_assets';
    }
```

**Code Sesudah (Proposed/After):**
```js
import { resolveMultiplierStageRetryTarget } from '@/lib/multiplier-artifacts';
...
    const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [id]);
    const target = resolveMultiplierStageRetryTarget(task, stage, glabsTasks);
    if (!target.ok) {
      return NextResponse.json({ success: false, error: target.error }, { status: target.statusCode || 400 });
    }
    const nextStatus = target.nextStatus;
```

---

### 4. `lib/content-automation-worker.js` & `lib/content-automation-notification-worker.js`

**Code Sebelum (Current/Before) — `lib/content-automation-worker.js:85`:**
```js
export function getContentAutomationRuntime(){return {...state,running:Boolean(state.interval)};}
```

**Code Sesudah (Proposed/After) — `lib/content-automation-worker.js:85`:**
```js
export function getContentAutomationRuntime(){return {running:Boolean(state.interval),processing:Boolean(state.running),lastTick:state.lastTick||null,lastError:state.lastError||null};}
```

**Code Sebelum (Current/Before) — `lib/content-automation-notification-worker.js:12`:**
```js
export function getContentAutomationNotificationRuntime(){return {...state,running:Boolean(state.interval)};}
```

**Code Sesudah (Proposed/After) — `lib/content-automation-notification-worker.js:12`:**
```js
export function getContentAutomationNotificationRuntime(){return {running:Boolean(state.interval),processing:Boolean(state.running),lastTick:state.lastTick||null,lastError:state.lastError||null,lastSentAt:state.lastSentAt||null};}
```

*(Catatan: Mengeluarkan `state.interval` dari object return menghilangkan `Timeout` / `TimersList` circular reference saat `/api/v2/system-health` diserialisasi ke JSON oleh `NextResponse.json(...)`.)*

---

### 5. `apps/mcp/tools.mjs`

#### 5A. `cf_approve_job` (tambah cabang `mul_*`)

**Code Sebelum (Current/Before):**
```js
  register(
    'cf_approve_job',
    'Approve pending campaign review items (operator jobs ocj_* or custom storyboards cst_*) to proceed to production rendering.',
    {
      job_id: z.string().trim().min(1).max(128),
      review_revision: z.union([z.number().int().min(1), z.string()]).optional(),
      review_sha256: z.string().optional()
    },
    false,
    ({ job_id, review_revision, ...body }) => {
      if (job_id.startsWith('cst_') || job_id.startsWith('opc_') || /^\d+$/.test(job_id)) {
        return fetchPillarStoryboardSummary(request, job_id, { includeItems: true }).then(summary => {
          if (!summary?.success) return summary;
          const targetItemId = summary.item_id;
          if (!targetItemId) return { success: false, error: `Tidak ditemukan item pada ${job_id}.` };
          return request(`/api/v2/pillar-campaigns/items/${encodeURIComponent(String(targetItemId))}/approve`, {
            body: {
              review_revision: review_revision !== undefined ? String(review_revision) : (summary.review_revision || ''),
              new_video_plan: summary.items?.[0]?.new_video_plan_json ? JSON.parse(summary.items[0].new_video_plan_json) : [],
              video_dna: summary.items?.[0]?.video_dna_json ? JSON.parse(summary.items[0].video_dna_json) : {}
            }
          });
        });
      }
      return request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/approve`, {
        body: { review_revision, ...body }
      });
    }
  );
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_approve_job',
    'Approve pending campaign review items (operator jobs ocj_*, custom storyboards cst_*, OPC opc_*, or Multiplier tasks mul_*) to proceed to production rendering.',
    {
      job_id: z.string().trim().min(1).max(128),
      review_revision: z.union([z.number().int().min(1), z.string()]).optional(),
      review_sha256: z.string().optional()
    },
    false,
    ({ job_id, review_revision, ...body }) => {
      if (job_id.startsWith('mul_')) {
        return request(`/api/v2/multiplier/${encodeURIComponent(job_id)}/approve`, {
          body: {}
        });
      }
      if (job_id.startsWith('cst_') || job_id.startsWith('opc_') || /^\d+$/.test(job_id)) {
        return fetchPillarStoryboardSummary(request, job_id, { includeItems: true }).then(summary => {
          if (!summary?.success) return summary;
          const targetItemId = summary.item_id;
          if (!targetItemId) return { success: false, error: `Tidak ditemukan item pada ${job_id}.` };
          return request(`/api/v2/pillar-campaigns/items/${encodeURIComponent(String(targetItemId))}/approve`, {
            body: {
              review_revision: review_revision !== undefined ? String(review_revision) : (summary.review_revision || ''),
              new_video_plan: summary.items?.[0]?.new_video_plan_json ? JSON.parse(summary.items[0].new_video_plan_json) : [],
              video_dna: summary.items?.[0]?.video_dna_json ? JSON.parse(summary.items[0].video_dna_json) : {}
            }
          });
        });
      }
      return request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/approve`, {
        body: { review_revision, ...body }
      });
    }
  );
```

#### 5B. `cf_list_publishing_jobs` (tambah `needs_review` dan `scheduled`)

**Code Sebelum (Current/Before):**
```js
  register(
    'cf_list_publishing_jobs',
    'Monitor social media publishing job statuses and view live links.',
    {
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
      platform: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_list_publishing_jobs',
    'Monitor social media publishing job statuses (including scheduled and needs_review failures) and view live links.',
    {
      status: z.enum(['pending', 'processing', 'scheduled', 'completed', 'failed', 'needs_review', 'all']).default('all'),
      platform: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
```

#### 5C. `cf_retry_multiplier_task` (tambah `force` dan `stage`)

**Code Sebelum (Current/Before):**
```js
  register(
    'cf_retry_multiplier_task',
    'Retry a failed Multiplier Lab task. By default smart-resumes from the latest completed stage (e.g. ffmpeg_muxing when clips already exist); pass mode="restart_all" to restart from pending_resolution.',
    {
      task_id: z.string().trim().min(1).max(128),
      mode: z.enum(['smart_resume', 'restart_all']).optional()
    },
    false,
    ({ task_id, mode }) => request('/api/v2/multiplier', {
      method: 'PATCH',
      body: { action: 'retry_task', taskId: task_id, ...(mode ? { mode } : {}) }
    })
  );
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_retry_multiplier_task',
    'Retry a failed (or stuck in-progress when force=true) Multiplier Lab task. Supports mode ("smart_resume" | "restart_all") or explicit stage ("remaking" | "t2i" | "tts" | "visuals" | "ffmpeg" | "cloud").',
    {
      task_id: z.string().trim().min(1).max(128),
      mode: z.enum(['smart_resume', 'restart_all']).optional(),
      force: z.boolean().optional(),
      stage: z.enum(['remaking', 't2i', 'tts', 'visuals', 'ffmpeg', 'cloud']).optional()
    },
    false,
    ({ task_id, mode, force, stage }) => request('/api/v2/multiplier', {
      method: 'PATCH',
      body: {
        action: 'retry_task',
        taskId: task_id,
        ...(mode ? { mode } : {}),
        ...(force !== undefined ? { force } : {}),
        ...(stage ? { stage } : {})
      }
    })
  );
```
