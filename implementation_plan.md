# Implementation Plan: Pemisahan Jadwal Produksi dan Publishing pada Auto Pipeline

**Sumber Usulan:** [usulan-cf-studio-pisah-jadwal-produksi-publish.md](file:///Users/sabeqmmursyid/cf-autopipeline/usulan-cf-studio-pisah-jadwal-produksi-publish.md)  
**Target Branch Kerja:** `fitur/pisah-jadwal-produksi-publish` (dibuat dari `main` saat eksekusi dimulai)  
**Catatan Arsitektur & Keamanan:**
- 100% backward-compatible untuk jadwal lama (`publish_date = NULL`, `publish_day_offset = 0`).
- Perubahan DB hanya berupa penambahan kolom baru nullable/ber-default (`publish_date`, `publish_day_offset`, `last_run_target_date`) secara idempoten (`ADD COLUMN IF NOT EXISTS`).
- Perubahan UI wajib didahului pembuatan dan review mockup HTML standalone di `public/mockup_auto_pipeline_split_schedule.html` menggunakan 100% semantic CSS tokens (Light/Dark Mode) sesuai SOP Mockup HTML & Semantic CSS Tokens.

---

## Execution Task List

### Tahap 0 — Persiapan Branch
- [x] Buat dan checkout branch baru `fitur/pisah-jadwal-produksi-publish` dari `main` terbaru (`git checkout main && git pull && git checkout -b fitur/pisah-jadwal-produksi-publish`)

### Tahap 1 — Pembuatan Mockup HTML & Review Pengguna (Wajib Sebelum Edit Backend & UI Utama)
- [x] Buat mockup interaktif standalone [public/mockup_auto_pipeline_split_schedule.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_auto_pipeline_split_schedule.html) dengan 100% semantic CSS tokens (Light/Dark Mode) untuk simulasi form `specific_date` (Produksi vs Publish + tombol `+1 Hari`), form `recurring` (dropdown `Hari Tayang` H+0/H+1/H+2), validasi live, tabel jadwal, dan tampilan kalender
- [x] Sajikan melalui server mockup lokal (`npm run mockup:serve` → `http://127.0.0.1:4199/mockup_auto_pipeline_split_schedule.html`) dan tunggu review serta persetujuan pengguna sebelum mulai mengedit kode backend maupun React/Next.js

### Tahap 2 — Skema Database & Repository (`lib/db-pg.js`, `lib/auto-pipeline-schedules-repository.js`)
- [x] Tambahkan kolom `publish_date`, `publish_day_offset`, `last_run_target_date`, dan index `auto_pipeline_schedules_publish_date_idx` pada tabel `auto_pipeline_schedules` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js)
- [x] Tambahkan helper `normalizeDateStr` dan `validateAndNormalizeScheduleTiming` (`ScheduleValidationError` status 400) di [lib/auto-pipeline-schedules-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-schedules-repository.js)
- [x] Perbarui `listAutoPipelineSchedules` (filter `publishDate`), `createAutoPipelineSchedule` (alias `generation_date`, `publish_date`, `publish_day_offset`), `updateAutoPipelineSchedule` (update parsial), `updateScheduleExecutionStatus` (`lastRunTargetDate`), dan `normalizeScheduleRow` (`generation_date`, `publish_date`, `publish_day_offset`, `last_run_target_date`) di [lib/auto-pipeline-schedules-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-schedules-repository.js)

### Tahap 3 — Scheduler Runner & Timezone Dinamis (`lib/auto-pipeline-scheduler-runner.js`)
- [x] Tambahkan helper `addDaysToDateStr` dan `zonedDateTimeToUtcIso`, serta perbaiki `getNowInTimezone` dan `computeTargetPublishIso` (hilangkan hardcoded `+07:00`, dukung object params maupun fallback 3 argumen posisional) di [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js)
- [x] Tambahkan `resolveSchedulePublishIso(row)` dan simpan `lastRunTargetDate: dateStr` saat `runDueAutoPipelineGenerations` maupun `runScheduleImmediately` memulai eksekusi (termasuk meneruskan `targetPublishIso` ke `threads_series`)
- [x] Perbarui `runDueAutoPipelinePublishingDispatch` untuk menggunakan `resolveSchedulePublishIso(row)` (prioritas: `publish_date` -> `generationDate + publish_day_offset` -> `today + publish_day_offset`, dengan `specific_date` mempertahankan `target_date` saat dipicu manual `run-now` pada H-1)

### Tahap 4 — API Routes & Validasi HTTP 400 (`app/api/v2/recipes/auto-pipeline-schedules/`)
- [x] Perbarui `GET` (filter query `publish_date`) dan `POST` (single + batch `items` dengan pra-validasi seluruh item sebelum insert + dukung `generation_date`, `publish_date`, `publish_day_offset` dan kembalikan HTTP 400 untuk `ScheduleValidationError`) di [route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/auto-pipeline-schedules/route.js)
- [x] Perbarui `PUT` (kembalikan HTTP 400 untuk `ScheduleValidationError` dan HTTP 404 jika schedule tidak ditemukan) di [[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/auto-pipeline-schedules/%5Bid%5D/route.js)

### Tahap 5 — MCP Server Tools (`apps/mcp/tools.mjs`)
- [x] Perbarui `scheduleExtendedFields`, `buildScheduleItemPayload`, `buildScheduleBatchItems`, `cf_list_schedules`, `cf_create_schedule`, dan `cf_update_schedule` di [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) agar mendukung `generation_date`, `publish_date`, dan `publish_day_offset` (termasuk filter `publish_date` di `cf_list_schedules`)

### Tahap 6 — Implementasi UI React/Next.js (`app/auto-pipeline/page.js`, `ScheduleTableView.js`, `ScheduleCalendarView.js`)
- [x] Tambahkan state `schedPublishDate` dan `schedPublishDayOffset`, sinkronisasi di `openCreateScheduleModal`/`openEditScheduleModal`, serta helper `addDaysIso` di [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js)
- [x] Perbarui UI modal Step 4 & Step 6 di [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js) (2 blok Produksi vs Publish pada `specific_date` + preset `+1 Hari (H+1)`, dropdown `Hari Tayang` H+0/H+1/H+2 pada `recurring`, serta pratinjau batch)
- [x] Perbarui seluruh payload submit (`PUT` edit, 5 cabang batch `items` termasuk stagger `publish_date`, dan `POST` single) di [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js)
- [x] Perbarui tampilan badge tanggal/waktu produksi vs tayang di [ScheduleTableView.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/ScheduleTableView.js) dan [ScheduleCalendarView.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/ScheduleCalendarView.js)

### Tahap 7 — Unit Test, Verifikasi Lokal & Deploy Dev
- [x] Buat test suite [tests/test-auto-pipeline-split-schedule.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/test-auto-pipeline-split-schedule.test.js) untuk 7 skenario penerimaan + timezone non-WIB + validasi HTTP 400 + batch `items` + `run-now` H-1
- [x] Tambahkan test assertion parameter baru (`generation_date`, `publish_date`, `publish_day_offset`) di [apps/mcp/test/mcp.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/test/mcp.test.mjs)
- [x] Perbarui [sot/menus/kartu/auto-pipeline.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/auto-pipeline.md) dan [apps/mcp/README.md](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/README.md)
- [x] Jalankan seluruh test lokal (`PG_SEARCH_PATH=dev`), `npm run test:mcp`, dan build lokal aman (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`)
- [x] Commit & push ke branch `fitur/pisah-jadwal-produksi-publish`, lalu deploy ke **Dev** (`npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`) untuk uji pengguna di `http://100.95.245.55:5020`

---

## Detail Perubahan Kode (Before & After)

### 1. [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js)

**Code Sebelum (Current/Before):**
```sql
            status TEXT NOT NULL DEFAULT 'active',
            schedule_mode TEXT NOT NULL DEFAULT 'recurring',
            target_date DATE,
            last_run_at TIMESTAMP WITH TIME ZONE,
            last_campaign_id TEXT,
            last_publish_at TIMESTAMP WITH TIME ZONE,
            last_error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS pipeline_type TEXT NOT NULL DEFAULT 'recipe_campaign';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_item_id TEXT;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_item_title TEXT;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS pipeline_config_json JSONB NOT NULL DEFAULT '{}';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'recurring';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_date DATE;
```

**Code Sesudah (Proposed/After):**
```sql
            status TEXT NOT NULL DEFAULT 'active',
            schedule_mode TEXT NOT NULL DEFAULT 'recurring',
            target_date DATE,
            publish_date DATE,
            publish_day_offset INTEGER NOT NULL DEFAULT 0,
            last_run_target_date DATE,
            last_run_at TIMESTAMP WITH TIME ZONE,
            last_campaign_id TEXT,
            last_publish_at TIMESTAMP WITH TIME ZONE,
            last_error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS pipeline_type TEXT NOT NULL DEFAULT 'recipe_campaign';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_item_id TEXT;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_item_title TEXT;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS pipeline_config_json JSONB NOT NULL DEFAULT '{}';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'recurring';
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS target_date DATE;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS publish_date DATE;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS publish_day_offset INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE auto_pipeline_schedules ADD COLUMN IF NOT EXISTS last_run_target_date DATE;

          CREATE INDEX IF NOT EXISTS auto_pipeline_schedules_publish_date_idx
            ON auto_pipeline_schedules(tenant_id, publish_date);
```

---

### 2. [lib/auto-pipeline-schedules-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-schedules-repository.js)

**Code Sebelum (Current/Before):**
```js
export async function listAutoPipelineSchedules(tenantId = 'default_tenant', options = {}) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    options = tenantId;
    tenantId = options.tenantId || 'default_tenant';
  }
  const { status, brandId, pipelineType, scheduleMode, targetDate } = options;
  ...
  if (targetDate) {
    conditions.push(`s.target_date = $${paramIdx++}`);
    params.push(targetDate);
  }
```

**Code Sesudah (Proposed/After):**
```js
export class ScheduleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScheduleValidationError';
    this.statusCode = 400;
  }
}

export function normalizeDateStr(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function validateAndNormalizeScheduleTiming(input = {}, existing = null) {
  const hasTimingChange = !existing || [
    'schedule_mode', 'target_date', 'generation_date', 'publish_date',
    'publish_day_offset', 'generation_time', 'publish_time', 'auto_publish_enabled'
  ].some(k => input[k] !== undefined);

  const scheduleMode = input.schedule_mode !== undefined
    ? input.schedule_mode
    : (existing?.schedule_mode || 'recurring');

  const rawTargetDate = input.target_date !== undefined
    ? input.target_date
    : (input.generation_date !== undefined ? input.generation_date : (existing?.target_date ?? null));
  const rawPublishDate = input.publish_date !== undefined
    ? input.publish_date
    : (existing?.publish_date ?? null);

  if (rawTargetDate !== null && rawTargetDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(rawTargetDate).slice(0, 10))) {
    throw new ScheduleValidationError('Format target_date / generation_date harus YYYY-MM-DD.');
  }
  if (rawPublishDate !== null && rawPublishDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(rawPublishDate).slice(0, 10))) {
    throw new ScheduleValidationError('Format publish_date harus YYYY-MM-DD.');
  }

  const targetDate = rawTargetDate ? String(rawTargetDate).slice(0, 10) : null;
  const publishDate = rawPublishDate ? String(rawPublishDate).slice(0, 10) : null;

  const rawOffset = input.publish_day_offset !== undefined
    ? input.publish_day_offset
    : (existing?.publish_day_offset ?? 0);
  const publishDayOffset = Number(rawOffset);
  if (!Number.isInteger(publishDayOffset) || publishDayOffset < 0 || publishDayOffset > 14) {
    throw new ScheduleValidationError('publish_day_offset harus berupa bilangan bulat antara 0 sampai 14.');
  }

  const generationTime = input.generation_time !== undefined
    ? input.generation_time
    : (existing?.generation_time || '05:00');
  const publishTime = input.publish_time !== undefined
    ? input.publish_time
    : (existing?.publish_time || '09:00');
  const autoPublishEnabled = input.auto_publish_enabled !== undefined
    ? Boolean(input.auto_publish_enabled)
    : (existing ? existing.auto_publish_enabled !== false : true);

  if (!/^\d{2}:\d{2}$/.test(generationTime)) {
    throw new ScheduleValidationError('Format generation_time harus HH:mm.');
  }
  if (!/^\d{2}:\d{2}$/.test(publishTime)) {
    throw new ScheduleValidationError('Format publish_time harus HH:mm.');
  }

  if (hasTimingChange && autoPublishEnabled) {
    if (scheduleMode === 'specific_date') {
      if (targetDate && publishDate) {
        if (publishDate < targetDate) {
          throw new ScheduleValidationError('Tanggal publish (publish_date) tidak boleh lebih awal dari tanggal produksi (target_date).');
        }
        if (publishDate === targetDate && publishTime <= generationTime) {
          throw new ScheduleValidationError('Pada tanggal yang sama, jam publish harus lebih lambat dari jam produksi, atau majukan publish_date ke hari berikutnya.');
        }
      } else if (publishDayOffset === 0 && publishTime <= generationTime) {
        throw new ScheduleValidationError('Jam publish harus lebih lambat dari jam produksi untuk tayang di hari yang sama, atau set publish_date / publish_day_offset >= 1.');
      }
    } else if (publishDayOffset === 0 && publishTime <= generationTime) {
      throw new ScheduleValidationError('Gunakan `publish_day_offset: 1` jika jam tayang berada di hari berikutnya.');
    }
  }

  return {
    scheduleMode,
    targetDate,
    publishDate,
    publishDayOffset,
    generationTime,
    publishTime,
    autoPublishEnabled
  };
}

export async function listAutoPipelineSchedules(tenantId = 'default_tenant', options = {}) {
  if (typeof tenantId === 'object' && tenantId !== null) {
    options = tenantId;
    tenantId = options.tenantId || 'default_tenant';
  }
  const { status, brandId, pipelineType, scheduleMode, targetDate, publishDate } = options;
  ...
  if (targetDate) {
    conditions.push(`s.target_date = $${paramIdx++}`);
    params.push(targetDate);
  }

  if (publishDate) {
    conditions.push(`(
      s.publish_date = $${paramIdx}
      OR (
        s.publish_date IS NULL
        AND s.schedule_mode = 'specific_date'
        AND s.target_date IS NOT NULL
        AND (s.target_date + (COALESCE(s.publish_day_offset, 0) * INTERVAL '1 day'))::date = $${paramIdx}::date
      )
    )`);
    params.push(publishDate);
    paramIdx++;
  }
```

**Code Sebelum (`createAutoPipelineSchedule`, `updateAutoPipelineSchedule`, `updateScheduleExecutionStatus`, `normalizeScheduleRow`):**
```js
  const generationTime = data.generation_time || '05:00';
  const publishTime = data.publish_time || '09:00';
  ...
  const scheduleMode = data.schedule_mode || 'recurring';
  const targetDate = data.target_date || null;

  const sql = `
    INSERT INTO auto_pipeline_schedules (
      id, tenant_id, pipeline_type, name, brand_id, preset_key,
      target_item_id, target_item_title, topic_strategy, topic,
      category, recipe_count, generation_time, publish_time, days_of_week_json,
      timezone, repliz_account_ids_json, pipeline_config_json, auto_publish_enabled, status,
      schedule_mode, target_date,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;
```

**Code Sesudah:**
```js
  const timing = validateAndNormalizeScheduleTiming(data, null);
  const generationTime = timing.generationTime;
  const publishTime = timing.publishTime;
  ...
  const autoPublishEnabled = timing.autoPublishEnabled;
  const status = data.status || 'active';
  const scheduleMode = timing.scheduleMode;
  const targetDate = timing.targetDate;
  const publishDate = timing.publishDate;
  const publishDayOffset = timing.publishDayOffset;

  const sql = `
    INSERT INTO auto_pipeline_schedules (
      id, tenant_id, pipeline_type, name, brand_id, preset_key,
      target_item_id, target_item_title, topic_strategy, topic,
      category, recipe_count, generation_time, publish_time, days_of_week_json,
      timezone, repliz_account_ids_json, pipeline_config_json, auto_publish_enabled, status,
      schedule_mode, target_date, publish_date, publish_day_offset,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20,
      $21, $22, $23, $24,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;
```
*(Demikian pula pada `updateAutoPipelineSchedule`: memanggil `validateAndNormalizeScheduleTiming(data, existing)`, mengupdate kolom `publish_date = $23, publish_day_offset = $24`; pada `updateScheduleExecutionStatus`: menambahkan parameter opsional `lastRunTargetDate` yang menulis `last_run_target_date`; serta pada `normalizeScheduleRow`: mengembalikan `target_date: targetDateNormalized`, `generation_date: targetDateNormalized`, `publish_date: publishDateNormalized`, `publish_day_offset: Number(row.publish_day_offset || 0)`, `last_run_target_date: lastRunTargetDateNormalized`.)*

---

### 3. [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js)

**Code Sebelum (Current/Before):**
```js
function getNowInTimezone(timeZone = 'Asia/Jakarta') {
  ...
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  // Hitung day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dt = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const dayOfWeek = dt.getDay();

  return { dateStr, timeStr, dayOfWeek, fullDate: now };
}

export function computeTargetPublishIso(publishTimeStr = '09:00', timeZone = 'Asia/Jakarta', targetDateStr = null) {
  const now = new Date();
  const [targetH, targetM] = publishTimeStr.split(':').map(Number);

  let dateBase = targetDateStr;
  if (!dateBase) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    });
    dateBase = formatter.format(now); // YYYY-MM-DD
  }

  // Format ISO local string
  const hPad = String(targetH).padStart(2, '0');
  const mPad = String(targetM).padStart(2, '0');
  const targetDateLocal = new Date(`${dateBase}T${hPad}:${mPad}:00+07:00`);

  // Jika waktu target hari ini sudah terlewat lebih dari 15 menit yang lalu, jadwalkan 15 menit dari sekarang
  if (targetDateLocal.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  }

  return targetDateLocal.toISOString();
}
```

**Code Sesudah (Proposed/After):**
```js
export function addDaysToDateStr(dateStr, offsetDays = 0) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).slice(0, 10))) return null;
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(offsetDays || 0)));
  return dt.toISOString().slice(0, 10);
}

function getTimezonePartsMap(dateObj, timeZone = 'Asia/Jakarta') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  if (map.hour === '24') map.hour = '00';
  return map;
}

export function zonedDateTimeToUtcDate(dateStr, timeStr = '09:00', timeZone = 'Asia/Jakarta') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const desiredUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  let guessMs = desiredUtcMs;
  for (let i = 0; i < 2; i++) {
    const p = getTimezonePartsMap(new Date(guessMs), timeZone);
    const renderedUtcMs = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second || 0)
    );
    const diff = desiredUtcMs - renderedUtcMs;
    if (diff === 0) break;
    guessMs += diff;
  }
  return new Date(guessMs);
}

function getNowInTimezone(timeZone = 'Asia/Jakarta') {
  const now = new Date();
  const map = getTimezonePartsMap(now, timeZone);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dateStr, timeStr, dayOfWeek, fullDate: now };
}

export function computeTargetPublishIso(arg1 = {}, legacyTimeZone = 'Asia/Jakarta', legacyTargetDateStr = null) {
  const opts = (typeof arg1 === 'object' && arg1 !== null)
    ? arg1
    : {
        publishTimeStr: arg1 || '09:00',
        timeZone: legacyTimeZone || 'Asia/Jakarta',
        publishDateStr: legacyTargetDateStr || null,
        generationDateStr: null,
        publishDayOffset: 0
      };

  const publishTimeStr = opts.publishTimeStr || '09:00';
  const timeZone = opts.timeZone || 'Asia/Jakarta';
  const publishDateStr = opts.publishDateStr ? String(opts.publishDateStr).slice(0, 10) : null;
  const generationDateStr = opts.generationDateStr ? String(opts.generationDateStr).slice(0, 10) : null;
  const publishDayOffset = Number(opts.publishDayOffset || 0);
  const now = opts.now instanceof Date ? opts.now : new Date();

  let dateBase = publishDateStr;
  if (!dateBase && generationDateStr) {
    dateBase = addDaysToDateStr(generationDateStr, publishDayOffset);
  }
  if (!dateBase) {
    const { dateStr: todayInTz } = getNowInTimezone(timeZone);
    dateBase = addDaysToDateStr(todayInTz, publishDayOffset);
  }

  const targetDateLocal = zonedDateTimeToUtcDate(dateBase, publishTimeStr, timeZone);
  if (targetDateLocal.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  }
  return targetDateLocal.toISOString();
}

export function resolveSchedulePublishIso(row = {}) {
  const publishDateStr = row.publish_date ? String(row.publish_date).slice(0, 10) : null;
  const schedMode = row.schedule_mode || 'recurring';
  const targetDateStr = row.target_date ? String(row.target_date).slice(0, 10) : null;
  const lastRunTargetDateStr = row.last_run_target_date ? String(row.last_run_target_date).slice(0, 10) : null;
  const generationDateStr = schedMode === 'specific_date'
    ? (targetDateStr || lastRunTargetDateStr)
    : (lastRunTargetDateStr || targetDateStr);
  const publishDayOffset = Number(row.publish_day_offset || 0);

  return computeTargetPublishIso({
    publishTimeStr: row.publish_time || '09:00',
    timeZone: row.timezone || 'Asia/Jakarta',
    publishDateStr,
    generationDateStr,
    publishDayOffset
  });
}
```

**Code Sebelum (pencatatan `last_run_at`, `threads_series`, dan dispatch publish di `lib/auto-pipeline-scheduler-runner.js`):**
```js
// Baris 251 (threads_series):
      targetPublishIso: schedule.target_publish_iso || null

// Baris 390 (runDueAutoPipelineGenerations):
        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastRunAt: new Date()
        });

// Baris 576-577 (runDueAutoPipelinePublishingDispatch):
      const targetDateStr = row.target_date ? String(row.target_date).slice(0, 10) : null;
      const scheduledAtIso = computeTargetPublishIso(row.publish_time || '09:00', row.timezone || 'Asia/Jakarta', targetDateStr);

// Baris 681 (runScheduleImmediately):
  await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
    lastRunAt: new Date(),
    lastError: null
  });
```

**Code Sesudah (Proposed/After):**
```js
// Baris 251 (threads_series):
      targetPublishIso: schedule.target_publish_iso || resolveSchedulePublishIso(schedule)

// Baris 390 (runDueAutoPipelineGenerations, dengan dateStr dari dueBatch item):
        row.last_run_target_date = runDateStr;
        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastRunAt: new Date(),
          lastRunTargetDate: runDateStr
        });

// Baris 576-577 (runDueAutoPipelinePublishingDispatch):
      const scheduledAtIso = resolveSchedulePublishIso(row);

// Baris 681 (runScheduleImmediately):
  const { dateStr: runDateStr } = getNowInTimezone(schedule.timezone || 'Asia/Jakarta');
  schedule.last_run_target_date = runDateStr;
  await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
    lastRunAt: new Date(),
    lastRunTargetDate: runDateStr,
    lastError: null
  });
```

---

### 4. [app/api/v2/recipes/auto-pipeline-schedules/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/auto-pipeline-schedules/route.js) & [[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/recipes/auto-pipeline-schedules/%5Bid%5D/route.js)

**Code Sebelum (`route.js`):**
```js
    const scheduleMode = searchParams.get('schedule_mode') || 'all';
    const targetDate = searchParams.get('target_date');
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    const schedules = await listAutoPipelineSchedules(tenantId, { status, brandId, pipelineType, scheduleMode, targetDate });
...
    // Batch items:
          schedule_mode: item.schedule_mode || 'recurring',
          target_date: item.target_date || null
        };
        const s = await createAutoPipelineSchedule(tenantId, payload);
...
    // Single create:
      schedule_mode: body.schedule_mode || 'recurring',
      target_date: body.target_date || null
    };
    const newSchedule = await createAutoPipelineSchedule(tenantId, payload);
```

**Code Sesudah (`route.js`):**
```js
import {
  listAutoPipelineSchedules,
  createAutoPipelineSchedule,
  validateAndNormalizeScheduleTiming
} from '@/lib/auto-pipeline-schedules-repository';
...
    const scheduleMode = searchParams.get('schedule_mode') || 'all';
    const targetDate = searchParams.get('target_date');
    const publishDate = searchParams.get('publish_date');
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    const schedules = await listAutoPipelineSchedules(tenantId, {
      status, brandId, pipelineType, scheduleMode, targetDate, publishDate
    });
...
    // Batch items: pra-validasi seluruh item sebelum menulis ke DB
    if (Array.isArray(body.items) && body.items.length > 0) {
      const payloads = [];
      for (const item of body.items) {
        if (!item.brand_id && !item.brandId) continue;
        const resolvedTargetDate = item.target_date !== undefined ? item.target_date : (item.generation_date ?? null);
        const payload = {
          ...existingItemFields,
          schedule_mode: item.schedule_mode || (resolvedTargetDate || item.publish_date ? 'specific_date' : 'recurring'),
          target_date: resolvedTargetDate,
          publish_date: item.publish_date || null,
          publish_day_offset: item.publish_day_offset !== undefined ? Number(item.publish_day_offset) : 0
        };
        validateAndNormalizeScheduleTiming(payload, null);
        payloads.push(payload);
      }
      const created = [];
      for (const payload of payloads) {
        created.push(await createAutoPipelineSchedule(tenantId, payload));
      }
      return NextResponse.json({ ... }, { status: 201 });
    }
...
    // Single create:
      const resolvedTargetDate = body.target_date !== undefined ? body.target_date : (body.generation_date ?? null);
      const payload = {
        ...existingSingleFields,
        schedule_mode: body.schedule_mode || (resolvedTargetDate || body.publish_date ? 'specific_date' : 'recurring'),
        target_date: resolvedTargetDate,
        publish_date: body.publish_date || null,
        publish_day_offset: body.publish_day_offset !== undefined ? Number(body.publish_day_offset) : 0
      };
...
  } catch (error) {
    if (error?.statusCode === 400 || error?.name === 'ScheduleValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('[API Auto-Pipeline-Schedules POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
```

**Code Sebelum (`[id]/route.js`):**
```js
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id PUT Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
```

**Code Sesudah (`[id]/route.js`):**
```js
  } catch (error) {
    if (error?.statusCode === 400 || error?.name === 'ScheduleValidationError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (/not found/i.test(error?.message || '')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error('[API Auto-Pipeline-Schedules/:id PUT Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
```

---

### 5. [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs)

**Code Sebelum (Current/Before):**
```js
    schedule_mode: z.enum(['recurring', 'specific_date']).optional(),
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
...
  register(
    'cf_list_schedules',
    'List recurring or specific-date Auto Pipeline schedules in the tenant with their status, target date, and execution metrics.',
    {
      status: z.enum(['active', 'paused', 'all']).default('all'),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'threads_series', 'recipe_labs', 'all'])
        .default('all'),
      brand_id: z.string().max(100).optional(),
      schedule_mode: z.enum(['recurring', 'specific_date', 'all']).default('all'),
      target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional()
    },
```
*(serta pada `buildScheduleItemPayload` baris 222-274 dan `buildScheduleBatchItems` baris 277-318 hanya meneruskan `schedule_mode` dan `target_date`)*

**Code Sesudah (Proposed/After):**
```js
    schedule_mode: z.enum(['recurring', 'specific_date']).optional(),
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
    generation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
    publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
    publish_day_offset: z.number().int().min(0).max(14).optional(),
...
  register(
    'cf_list_schedules',
    'List recurring or specific-date Auto Pipeline schedules in the tenant with their status, generation/target date, publish date, publish_day_offset, and execution metrics.',
    {
      status: z.enum(['active', 'paused', 'all']).default('all'),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'threads_series', 'recipe_labs', 'all'])
        .default('all'),
      brand_id: z.string().max(100).optional(),
      schedule_mode: z.enum(['recurring', 'specific_date', 'all']).default('all'),
      target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
      publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional()
    },
```
*(Pada `buildScheduleItemPayload`: ekstrak `generation_date`, `publish_date`, `publish_day_offset`; `resolvedTargetDate = target_date !== undefined ? target_date : generation_date`; `resolvedMode = schedule_mode || ((resolvedTargetDate || publish_date) ? 'specific_date' : (isUpdate ? undefined : 'recurring'))`; teruskan `target_date`, `publish_date`, `publish_day_offset`. Pada `buildScheduleBatchItems`: ikut wariskan `generation_date`, `publish_date`, `publish_day_offset` dari `args` ke setiap item.)*

---

### 6. Mockup HTML & Antarmuka UI

#### 6A. [public/mockup_auto_pipeline_split_schedule.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_auto_pipeline_split_schedule.html) (File Baru — Tahap 1 sebelum edit backend & UI utama)
- Standalone HTML interaktif dengan 100% semantic CSS tokens (`--surface`, `--surface-raised`, `--surface-interactive`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--action-primary`, `--status-info`, `--status-success`, `--status-warning`, `--status-danger`) + switcher Light/Dark Mode.
- Mensimulasikan form `specific_date` (Blok Produksi vs Blok Publish + tombol cepat `Sama dengan Produksi` & `+1 Hari (H+1)`), form `recurring` (dropdown `Hari Tayang`: `Hari yang sama (H+0)`, `Besok / H+1`, `Lusa / H+2`), validasi live tanggal/jam, tabel jadwal, dan kartu kalender.

#### 6B. [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js)

**Code Sebelum (Current/Before):**
```jsx
  const [schedMode, setSchedMode] = useState('recurring'); // 'recurring' | 'specific_date'
  const [schedTargetDate, setSchedTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
```

**Code Sesudah (Proposed/After):**
```jsx
  const [schedMode, setSchedMode] = useState('recurring'); // 'recurring' | 'specific_date'
  const [schedTargetDate, setSchedTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [schedPublishDate, setSchedPublishDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [schedPublishDayOffset, setSchedPublishDayOffset] = useState(0);
```
*(Seluruh payload submit di `handleSaveSchedule` menyertakan `publish_date: schedMode === 'specific_date' ? itemPublishDate : null` dan `publish_day_offset: schedMode === 'recurring' ? Number(schedPublishDayOffset || 0) : 0`. Saat `schedStaggerCalendar` aktif pada batch `specific_date`, `itemPublishDate` ikut digeser `+ idx` hari dari `schedPublishDate` agar jarak H-1 -> H-0 tetap terjaga di seluruh baris batch. UI Modal Step 4/6 memisahkan blok **Jadwal Produksi** & **Jadwal Publish** untuk `specific_date` (dengan tombol `+1 Hari (H+1)`), dan menampilkan dropdown **Hari Tayang** (`H+0`, `H+1`, `H+2`) di samping `publish_time` pada mode `recurring`.)*

#### 6C. [app/components/ScheduleTableView.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/ScheduleTableView.js) & [app/components/ScheduleCalendarView.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/ScheduleCalendarView.js)

**Code Sebelum (`ScheduleTableView.js`):**
```jsx
                    {isSpecific ? (
                      <span style={{ ... }}>
                        <span>📅</span> {sched.target_date || '-'}
                      </span>
                    ) : (
                      <span style={{ ... }}>
                        <span>🔄</span> {formatDaysOfWeek ? formatDaysOfWeek(sched.days_of_week || sched.days) : 'Rutin'}
                      </span>
                    )}
```

**Code Sesudah (`ScheduleTableView.js`):**
```jsx
                    {isSpecific ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ ... }}>
                          <span>📅</span> {formatShortDateId(sched.target_date)} {sched.generation_time || '05:00'}
                        </span>
                        {sched.publish_date && sched.publish_date !== sched.target_date && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-success)' }}>
                            ➔ Tayang: {formatShortDateId(sched.publish_date)} {sched.publish_time || '09:00'}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ ... }}>
                          <span>🔄</span> {formatDaysOfWeek ? formatDaysOfWeek(sched.days_of_week || sched.days) : 'Rutin'}
                        </span>
                        {Number(sched.publish_day_offset || 0) > 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-success)' }}>
                            Tayang: H+{Number(sched.publish_day_offset)} {sched.publish_time || '09:00'}
                          </span>
                        )}
                      </div>
                    )}
```
*(Di `ScheduleCalendarView.js`, tooltip dan label slot item diperbarui agar menampilkan informasi tanggal/offset tayang bila `publish_date !== target_date` atau `publish_day_offset > 0`.)*

---

### 7. [tests/test-auto-pipeline-split-schedule.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/test-auto-pipeline-split-schedule.test.js) (File Baru) & [apps/mcp/test/mcp.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/test/mcp.test.mjs)
- Unit & integration tests yang memverifikasi seluruh 7 skenario kriteria penerimaan:
  1. Backward compatibility `specific_date` lama (`publish_date: null`, `publish_day_offset: 0`)
  2. `specific_date` produksi H-1 (`target_date: 2026-11-25`, `15:00`), publish H-0 (`publish_date: 2026-11-26`, `07:15`)
  3. `recurring` lintas hari (`publish_day_offset = 1`, `gen: 20:00`, `pub: 06:15`)
  4. Render melewati tengah malam (`last_run_target_date = Senin`, selesai Selasa `00:15` -> publish tetap Selasa `06:15`)
  5. Validasi tanggal terbalik & jam lintas hari tanpa offset (menolak dengan `ScheduleValidationError` / HTTP 400)
  6. `resolveSchedulePublishIso` untuk trigger manual `run-now` pada H-1 tetap menghormati `publish_date`
  7. Batch creation via MCP `cf_create_schedule` dengan `generation_date`, `publish_date`, `publish_day_offset`, dan filter `publish_date` pada `cf_list_schedules`
  8. Akurasi konversi timezone non-WIB (`Asia/Makassar`, `Asia/Jayapura`, `UTC`).
