# Implementation Plan: Notifikasi Telegram Per Brand (1 Grup Forum ber-Topic, 1 Pesan Gabungan, 1 Bot Per Tenant)

**Sumber Rencana:** [rencana-implementasi-notifikasi-telegram-per-brand.md](file:///Users/sabeqmmursyid/cf-autopipeline/rencana-implementasi-notifikasi-telegram-per-brand.md)  
**Target Branch Kerja:** `fitur/brand-telegram-notifications` (dibuat dari `main` sesuai SOP Alur 1: Fitur Baru)  
**Lingkungan Uji Target:** Server **Dev (`5020`/`7020`)** terlebih dahulu sebelum naik ke Staging (`5010`/`7010`).

> [!WARNING]
> **Catatan Migrasi Database & Keamanan:**
> 1. **Migrasi Database Baru (`lib/db-pg.js`):** Fitur ini menambahkan 2 tabel idempoten baru (`brand_notification_preferences` dan `studio_notification_outbox`) melalui `migrateBrandTelegramNotifications()`. Rollback kode/filesystem tidak menghapus tabel DB, sehingga wajib diinformasikan sebelum naik ke Staging.
> 2. **Fail-Open Safety:** Seluruh pemanggilan notifikasi di `auto-pipeline-scheduler-runner.js`, `publishing-worker.js`, dan `content-automation-worker.js` dibungkus `try/catch` agar kegagalan DB atau API Telegram tidak pernah menggagalkan produksi maupun publish video.
> 3. **Zero Secret Exposure:** Token bot disimpan terenkripsi (`bot_token_ciphertext`) melalui `encryptSecret()`/`decryptSecret()`, tidak pernah dikembalikan pada response API `GET`, dan seluruh placeholder di mockup/test memakai format netral (`123456789:BOT_TOKEN_PLACEHOLDER`).
> 4. **Akses API & MCP Parity:** Route `/api/v2/brand-profiles/[id]/notification-settings` memakai `withTenantContext` dengan pengecekan role `admin` (web session) atau scope operator (`automation:write` / `content:create` / `content:read` untuk GET) agar kompatibel dengan sesi web maupun MCP tools (`cf_get_brand_notification_settings`, `cf_update_brand_notification_settings`, `cf_test_brand_notification`).

---

## Execution Task List

### Tahap 0: Persiapan Branch Fitur
- [x] Pindah dari `main` ke branch baru `fitur/brand-telegram-notifications` (`git checkout -b fitur/brand-telegram-notifications`) dan arsipkan rencana sebelumnya

### Tahap 1: Mockup HTML Interaktif & Review Pengguna (WAJIB Sebelum Edit Backend & UI Utama)
- [x] Buat standalone mockup HTML [public/mockup_brand_telegram_notifications.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_brand_telegram_notifications.html) memakai 100% Semantic CSS Design Tokens (`app/theme.css`) dengan dukungan Light/Dark Mode penuh dan aturan `antislop` (During Mode):
  - Tabel Brand Profiles dengan kolom status Notifikasi Telegram (`Topic #42`, `Nonaktif`, `Perlu Bot Tenant`) dan tombol aksi `Telegram`
  - Modal **Notifikasi Telegram Per Brand**:
    - Panel **Bot Token & Chat ID Default Tenant** yang dapat diisi/diperbarui langsung dari dalam modal
    - Toggle **Aktifkan notifikasi untuk brand ini**, input **Topic / Thread ID (`message_thread_id`)**, input opsional **Override Chat ID**
    - Checklist 5 event utama (`production_and_schedule`, `production_failed`, `awaiting_approval`, `publish_succeeded`, `publish_failed`)
    - Pengaturan **Quiet Hours**, **Timezone**, checkbox **Tetap kirim alert error saat jam tenang**, serta pratinjau format pesan Telegram
    - Tombol **Simpan** dan **Kirim Tes ke Topic Brand** beserta state `normal`, `tenant_unconfigured`, `loading`, `empty`, dan `error`
- [x] Sajikan mockup via `http://127.0.0.1:4299/mockup_brand_telegram_notifications.html` dan tunggu persetujuan pengguna sebelum masuk ke Tahap 2

### Tahap 2: Migrasi Database & Provider Telegram
- [x] Tambahkan `migrateBrandTelegramNotifications()` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) untuk tabel `brand_notification_preferences` dan `studio_notification_outbox`
- [x] Perbarui [lib/notification-providers/telegram.js](file:///Users/sabeqmmursyid/_cfstudio/lib/notification-providers/telegram.js) agar mendukung parameter opsional `messageThreadId = null` dan `actionLabel = 'Buka CF Studio'`

### Tahap 3: Service Inti & Worker Outbox
- [x] Buat [lib/brand-notification-service.js](file:///Users/sabeqmmursyid/_cfstudio/lib/brand-notification-service.js) (CRUD preferensi brand + update opsional konfigurasi Telegram default tenant, `resolveBrandTelegramTarget`, `resolveBrandForContent`, `enqueueBrandNotification`, `maybeEmitReplizReadyDigest`, `maybeEmitPublishedDigest`, `enqueueBrandErrorNotification`)
- [x] Perbarui [lib/content-automation-notification-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/content-automation-notification-worker.js) untuk memproses `studio_notification_outbox` di dalam `runContentAutomationNotificationTick()` dengan `FOR UPDATE SKIP LOCKED`, quiet hours (menghormati `bypass_quiet_for_errors`), backoff, dan `dead_letter`

### Tahap 4: Hook Pipeline & Publishing
- [x] Perbarui [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js): hook `production_failed`, `production_and_schedule` (saat `auto_publish_enabled === false`), `publish_failed` saat dispatch error, dan `maybeEmitReplizReadyDigest` untuk jalur non-Repliz
- [x] Perbarui [lib/publishing-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/publishing-worker.js): hook `maybeEmitReplizReadyDigest` setelah delegasi/schedule Repliz, `maybeEmitPublishedDigest` setelah FB/FB Reel/IG/Repliz `published`/`draft_created`, dan `enqueueBrandErrorNotification` di semua jalur error final (`failed` / `needs_review`)
- [x] Perbarui [lib/content-automation-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/content-automation-worker.js): hook `awaiting_approval` per brand bila schedule Content Automations memiliki `brand_profile_id`

### Tahap 5: REST API, UI Brand Profiles & MCP Tools
- [x] Buat [app/api/v2/brand-profiles/[id]/notification-settings/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/brand-profiles/%5Bid%5D/notification-settings/route.js) (`GET` & `PUT`, termasuk dukungan update opsional bot token & chat ID default tenant)
- [x] Buat [app/api/v2/brand-profiles/[id]/notification-settings/test/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/brand-profiles/%5Bid%5D/notification-settings/test/route.js) (`POST` tes kirim ke Topic brand)
- [x] Perbarui [app/api/v2/brand-profiles/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/brand-profiles/route.js) & [app/settings/brand-profiles/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/brand-profiles/page.js) untuk menampilkan status notifikasi di daftar brand serta modal pengaturan Telegram Per Brand + konfigurasi Bot Tenant sesuai mockup yang disetujui
- [x] Tambahkan 3 MCP tools (`cf_get_brand_notification_settings`, `cf_update_brand_notification_settings`, `cf_test_brand_notification`) di [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) dan perbarui [apps/mcp/README.md](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/README.md) & [sot/menus/kartu/brand-profiles.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/brand-profiles.md)

### Tahap 6: Pengujian, Build Aman & Deploy Dev
- [x] Buat [tests/brand-telegram-notifications.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/brand-telegram-notifications.test.mjs) dan perbarui [tests/test-mcp-tools-parity.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/test-mcp-tools-parity.test.js)
- [x] Jalankan unit test (`PG_SEARCH_PATH=dev`), `npm run test:mcp`, dan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`
- [x] Commit & push branch `fitur/brand-telegram-notifications`, lalu deploy atomic ke **Dev (`5020`/`7020`)** dan serahkan daftar uji manual kepada pengguna

---

## Rincian Perubahan Kode (Before & After Code Snippets)

### 1. `lib/notification-providers/telegram.js`

**Code Sebelum (Current/Before):**
```js
export async function sendTelegramNotification({botToken,chatId,title,message,actionUrl,baseUrl}) {
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(String(botToken||''))) throw new TelegramProviderError('Format Telegram bot token tidak valid.',{status:400,permanent:true});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const url=`https://api.telegram.org/bot${botToken}/sendMessage`;
    const text=[`<b>${escapeHtml(title)}</b>`,escapeHtml(message),actionUrl?`<a href="${escapeHtml(new URL(actionUrl,baseUrl).toString())}">Buka MAKNA</a>`:''].filter(Boolean).join('\n\n');
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true}),signal:controller.signal});
```

**Code Sesudah (Proposed/After):**
```js
export async function sendTelegramNotification({botToken,chatId,messageThreadId=null,title,message,actionUrl,actionLabel='Buka MAKNA',baseUrl}) {
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(String(botToken||''))) throw new TelegramProviderError('Format Telegram bot token tidak valid.',{status:400,permanent:true});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const url=`https://api.telegram.org/bot${botToken}/sendMessage`;
    const text=[`<b>${escapeHtml(title)}</b>`,escapeHtml(message),actionUrl?`<a href="${escapeHtml(new URL(actionUrl,baseUrl).toString())}">${escapeHtml(actionLabel||'Buka CF Studio')}</a>`:''].filter(Boolean).join('\n\n');
    const parsedThreadId = Number(messageThreadId);
    const bodyPayload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(Number.isInteger(parsedThreadId) && parsedThreadId > 0 ? { message_thread_id: parsedThreadId } : {})
    };
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyPayload),signal:controller.signal});
```

---

### 2. `lib/db-pg.js`

**Code Sebelum (Current/Before):**
```js
    migrateContentAutomations();

    const migrateTenantControlPlane = async () => {
```

**Code Sesudah (Proposed/After):**
```js
    migrateContentAutomations();

    const migrateBrandTelegramNotifications = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_brand_telegram_notifications_v1'));`);
        await migrationClient.query(`
          CREATE TABLE IF NOT EXISTS brand_notification_preferences (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            brand_id TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            channel TEXT NOT NULL DEFAULT 'telegram',
            chat_id TEXT,
            message_thread_id INTEGER,
            events_json JSONB NOT NULL DEFAULT '["production_and_schedule","production_failed","awaiting_approval","publish_succeeded","publish_failed"]'::jsonb,
            quiet_start TEXT,
            quiet_end TEXT,
            bypass_quiet_for_errors BOOLEAN NOT NULL DEFAULT TRUE,
            timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            updated_by TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, brand_id, channel)
          );
          CREATE TABLE IF NOT EXISTS studio_notification_outbox (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            brand_id TEXT,
            source_module TEXT NOT NULL,
            entity_id TEXT,
            event_key TEXT NOT NULL,
            channel TEXT NOT NULL DEFAULT 'telegram',
            event_type TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            message_thread_id INTEGER,
            bot_token_ciphertext TEXT NOT NULL,
            payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            status TEXT NOT NULL DEFAULT 'queued',
            attempt_count INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_at TIMESTAMPTZ,
            locked_by TEXT,
            provider_message_id TEXT,
            last_error TEXT,
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, event_key, channel)
          );
          CREATE INDEX IF NOT EXISTS studio_notification_outbox_due_idx
            ON studio_notification_outbox(status, next_attempt_at)
            WHERE status IN ('queued', 'retry_wait');
        `);
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Brand Telegram Notifications:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_brand_telegram_notifications_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateBrandTelegramNotifications();

    const migrateTenantControlPlane = async () => {
```

---

### 3. `lib/content-automation-notification-worker.js`

**Code Sebelum (Current/Before):**
```js
import { claimNotification,deadLetterNotification,deferNotification,markNotificationSent,recoverStaleOutbox,rescheduleNotification } from './notification-outbox-repository.js';
import { sendTelegramNotification } from './notification-providers/telegram.js';

const state=globalThis.__contentAutomationNotificationWorker||{interval:null,running:false,lastTick:null,lastError:null,lastSentAt:null};globalThis.__contentAutomationNotificationWorker=state;
export async function runContentAutomationNotificationTick(){if(state.running)return;state.running=true;state.lastTick=new Date().toISOString();try{await recoverStaleOutbox();for(let i=0;i<10;i++){const item=await claimNotification(`${os.hostname()}:${process.pid}`);...}}catch(error){...}finally{state.running=false;}}
```

**Code Sesudah (Proposed/After):**
```js
import { claimNotification,deadLetterNotification,deferNotification,markNotificationSent,recoverStaleOutbox,rescheduleNotification } from './notification-outbox-repository.js';
import { processStudioNotificationOutboxTick } from './brand-notification-service.js';
import { sendTelegramNotification } from './notification-providers/telegram.js';

const state=globalThis.__contentAutomationNotificationWorker||{interval:null,running:false,lastTick:null,lastError:null,lastSentAt:null};globalThis.__contentAutomationNotificationWorker=state;
export async function runContentAutomationNotificationTick(){if(state.running)return;state.running=true;state.lastTick=new Date().toISOString();try{await recoverStaleOutbox();for(let i=0;i<10;i++){/* existing content_automation_notification_outbox loop */}await processStudioNotificationOutboxTick({ workerId: `${os.hostname()}:${process.pid}`, state });}catch(error){...}finally{state.running=false;}}
```

---

### 4. `lib/auto-pipeline-scheduler-runner.js`

**Code Sebelum (Current/Before):**
```js
        if (schedMode === 'specific_date' && row.auto_publish_enabled === false) {
          await pgQuery(
            "UPDATE auto_pipeline_schedules SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2",
            [effectiveTenantId, row.id]
          );
          console.log(`[Auto Pipeline Scheduler] 🏁 Specific-date schedule "${row.name}" (${row.id}) marked as completed.`);
        }
      });
    } catch (err) {
      console.error(`[Auto Pipeline Scheduler] ❌ [${i + 1}/${dueBatch.length}] Gagal mengeksekusi pipeline untuk "${row.name}":`, err.message);
      await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
        lastError: err.message
      });
...
          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastPublishAt: new Date(),
            lastError: null
          });
...
        } catch (pubErr) {
          console.error(`[Auto Pipeline Scheduler] ❌ Failed to dispatch Repliz publishing for ${cfItem.id}:`, pubErr.message);
          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastError: `Publishing error: ${pubErr.message}`
          });
        }
```

**Code Sesudah (Proposed/After):**
```js
        if (row.auto_publish_enabled === false) {
          await notifyAutoPipelineProductionReady(effectiveTenantId, row, resolvedResultId);
        }
        if (schedMode === 'specific_date' && row.auto_publish_enabled === false) {
          await pgQuery(
            "UPDATE auto_pipeline_schedules SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2",
            [effectiveTenantId, row.id]
          );
          console.log(`[Auto Pipeline Scheduler] 🏁 Specific-date schedule "${row.name}" (${row.id}) marked as completed.`);
        }
      });
    } catch (err) {
      console.error(`[Auto Pipeline Scheduler] ❌ [${i + 1}/${dueBatch.length}] Gagal mengeksekusi pipeline untuk "${row.name}":`, err.message);
      await notifyAutoPipelineProductionFailed(effectiveTenantId, row, err.message);
      await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
        lastError: err.message
      });
...
          const createdJobs = await schedulePublishingJobs({ ... });
          const hasReplizTarget = Array.isArray(createdJobs?.jobs)
            ? createdJobs.jobs.some(j => j.provider === 'repliz')
            : replizAccountIds.length > 0;
          if (!hasReplizTarget) {
            await maybeEmitReplizReadyDigest(effectiveTenantId, cfItem.id);
          }
          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastPublishAt: new Date(),
            lastError: null
          });
...
        } catch (pubErr) {
          console.error(`[Auto Pipeline Scheduler] ❌ Failed to dispatch Repliz publishing for ${cfItem.id}:`, pubErr.message);
          await notifyAutoPipelineDispatchFailed(effectiveTenantId, row, cfItem.id, pubErr.message);
          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastError: `Publishing error: ${pubErr.message}`
          });
        }
```

---

### 5. `lib/publishing-worker.js`

**Code Sebelum (Current/Before):**
```js
// processFacebookReelJob selesai -> syncContentFlowSummary(job, terminalStatus, details.permalink);
// processReplizJob scheduled -> recordReplizProviderState + log
// processReplizJob immediate -> syncContentFlowSummary(job, 'processing');
// processReplizJob published -> syncContentFlowSummary(job, 'published', permalink);
// Facebook/Instagram published -> syncContentFlowSummary(job, terminalStatus, permalink);
// Jalur final failed / needs_review -> markPublishingResult + syncContentFlowSummary
```

**Code Sesudah (Proposed/After):**
```js
// Setelah delegated_to_repliz & immediate schedule Repliz:
await maybeEmitReplizReadyDigest(job.tenant_id, job.content_id);

// Setelah published / draft_created (Facebook, Facebook Reel, Instagram, Repliz):
await maybeEmitPublishedDigest(job.tenant_id, job.content_id);

// Pada semua jalur terminal error (REPLIZ_CONFIG_ERROR, TOKEN_DECRYPT_FAILED, FB/IG terminal failed/needs_review, Repliz terminal failed/needs_review, ACCOUNT_DISCONNECTED):
await enqueueBrandErrorNotification(job, finalStatus, errorMessage);
```

---

### 6. `lib/content-automation-worker.js`

**Code Sebelum (Current/Before):**
```js
      if(status==='awaiting_approval') {
        await notify(run,'awaiting_approval',`${run.schedule_name} siap direview`,'Storyboard telah siap. Buka review dan setujui revision yang sesuai.',`/content-automations?run=${run.id}`);
      }
```

**Code Sesudah (Proposed/After):**
```js
      if(status==='awaiting_approval') {
        await notify(run,'awaiting_approval',`${run.schedule_name} siap direview`,'Storyboard telah siap. Buka review dan setujui revision yang sesuai.',`/content-automations?run=${run.id}`);
        await notifyBrandAwaitingApproval(run);
      }
```

---

### 7. `app/settings/brand-profiles/page.js` & API Routes Baru

**Code Sebelum (Current/Before):**
```jsx
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
...
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(p.id)}>✏️ Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>✕</button>
```

**Code Sesudah (Proposed/After):**
```jsx
                    <th>Notifikasi</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
...
                    <td>
                      <NotificationStatusBadge pref={p.telegram_notification} />
                    </td>
...
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => openTelegramModal(p)}>Telegram</button>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleEdit(p.id)}>Edit</button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Hapus</button>
{/* Plus modal BrandTelegramNotificationModal dengan panel Bot & Chat ID Tenant + Topic ID + 5 event checklist + Quiet Hours + Tes */}
```

---

### 8. `apps/mcp/tools.mjs`

**Code Sebelum (Current/Before):**
```js
  register(
    'cf_update_brand_profile',
    ...
  );
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_update_brand_profile',
    ...
  );

  register(
    'cf_get_brand_notification_settings',
    'Get Telegram topic notification settings for a brand profile and tenant bot status.',
    { brand_id: z.string().trim().min(1).max(128) },
    true,
    ({ brand_id }) => request(`/api/v2/brand-profiles/${encodeURIComponent(brand_id)}/notification-settings`)
  );

  register(
    'cf_update_brand_notification_settings',
    'Update Telegram topic notification settings for a brand profile.',
    {
      brand_id: z.string().trim().min(1).max(128),
      enabled: z.boolean().optional(),
      message_thread_id: z.number().int().positive().nullable().optional(),
      chat_id: z.string().trim().max(64).nullable().optional(),
      events: z.array(z.enum(['production_and_schedule', 'production_failed', 'awaiting_approval', 'publish_succeeded', 'publish_failed'])).min(1).optional(),
      quiet_start: z.string().nullable().optional(),
      quiet_end: z.string().nullable().optional(),
      bypass_quiet_for_errors: z.boolean().optional(),
      timezone: z.string().optional()
    },
    false,
    ({ brand_id, ...body }) => request(`/api/v2/brand-profiles/${encodeURIComponent(brand_id)}/notification-settings`, { method: 'PUT', body })
  );

  register(
    'cf_test_brand_notification',
    'Enqueue a test Telegram message to the configured Forum Topic of a brand profile.',
    { brand_id: z.string().trim().min(1).max(128) },
    false,
    ({ brand_id }) => request(`/api/v2/brand-profiles/${encodeURIComponent(brand_id)}/notification-settings/test`, { method: 'POST', body: {} })
  );
```
