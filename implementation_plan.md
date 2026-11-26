# Implementation Plan: Perbaikan Zona Waktu GMT ke GMT+7 (WIB) pada Halaman Pembuatan Kampanye

**Sumber Analisa:** [ANALISA_WAKTU_GMT_KAMPANYE_PILLAR_MULTIPLIER.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/ANALISA_WAKTU_GMT_KAMPANYE_PILLAR_MULTIPLIER.md)  
**Target Branch Kerja:** `hotfix/campaign-wib-timezone` (dibuat dari `main` terbaru sesuai SOP Alur 2 — Hotfix)  
**Cakupan:** Lapisan parser PostgreSQL (`lib/db-pg.js`), helper bersama (`lib/date-format.js`), serta UI **Pillar Campaign**, **Multiplier Campaign**, **RE Campaign**, **Recipe Labs**, dan **Auto Pipeline**.  
**Lingkungan Uji Target:** Unit test lokal (`PG_SEARCH_PATH=dev`), `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, uji di **Dev (`5020`/`7020`)** / **Staging (`5010`/`7010`)** atas persetujuan pengguna.

> [!NOTE]
> **Tanpa Migrasi Database & Tanpa Perubahan Layout UI:** Perbaikan akar masalah memakai **Opsi 1A** (override parser OID `1114` `TIMESTAMP WITHOUT TIME ZONE` di `lib/db-pg.js` agar string dari PostgreSQL `Etc/UTC` tidak salah di-parse sebagai waktu lokal Mac Mini `WIB`), ditambah helper `formatWibDateTime` / `formatWibShortDateTime` / `formatWibTime` (`timeZone: 'Asia/Jakarta'`) pada slot teks waktu yang sudah ada di UI. Tidak ada perubahan skema PostgreSQL maupun tata letak/komponen antarmuka.

---

## Execution Task List

### Tahap 0: Persiapan Branch
- [x] Pastikan berada di `main` terbaru (`git checkout main && git pull`) lalu buat branch hotfix baru `hotfix/campaign-wib-timezone`

### Tahap 1: Helper Bersama & Perbaikan Parser PostgreSQL OID 1114
- [x] Buat modul pure JS [lib/date-format.js](file:///Users/sabeqmmursyid/_cfstudio/lib/date-format.js) berisi `parseUtcDate()`, `formatWibDateTime()`, `formatWibTime()`, dan `formatWibShortDateTime()` (aman dipakai di server maupun komponen `'use client'`)
- [x] Daftarkan `types.setTypeParser(1114, (val) => parseUtcDate(val))` di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) agar seluruh kolom `TIMESTAMP WITHOUT TIME ZONE` dari PostgreSQL (`Etc/UTC`) terbaca sebagai epoch UTC yang benar, bukan mundur 7 jam

### Tahap 2: Pembaruan Formatter UI — Pillar Campaign & Multiplier Campaign
- [x] Perbarui tampilan `created_at` dan `last_tick_at` pada [app/pillar-campaigns/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js) agar memakai `formatWibDateTime` dan `formatWibTime`
- [x] Perbarui tampilan `campaign.created_at` dan `item.created_at` pada [app/pillar-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js) agar memakai `formatWibDateTime`
- [x] Perbarui tampilan `c.created_at` pada [app/components/campaign-forms/MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js) dan `firstTask.created_at` pada [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/[id]/page.js) agar memakai `formatWibDateTime`

### Tahap 3: Pembaruan Formatter UI — RE Campaign, Recipe Labs, & Auto Pipeline
- [x] Perbarui tampilan `c.created_at` pada [app/components/campaign-forms/ReCampaignConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/ReCampaignConfigurationForm.js) dan `campaign.created_at` pada [app/re-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/re-campaigns/[id]/page.js) agar memakai `formatWibDateTime`
- [x] Perbarui tampilan `c.created_at` pada [app/components/campaign-forms/RecipeLabsConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/RecipeLabsConfigurationForm.js) agar memakai `formatWibDateTime`
- [x] Perbarui tampilan `camp.created_at` pada [app/auto-pipeline/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/auto-pipeline/page.js) agar memakai `formatWibShortDateTime`

### Tahap 4: Pengujian, Verifikasi Build, & Deploy
- [x] Tambahkan unit test [tests/date-format-wib.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/date-format-wib.test.js) untuk memverifikasi parsing OID `1114` (`'2026-11-26 10:16:49.616942'` → `'2026-11-26T10:16:49.616Z'`) dan output `Asia/Jakarta` (`17.16.49 WIB`), termasuk simulasi `TZ=Asia/Jakarta`
- [x] Jalankan unit test (`PG_SEARCH_PATH=dev TZ=Asia/Jakarta node --test tests/date-format-wib.test.js`) dan build lokal (`DISABLE_AUTO_MIGRATIONS=true DISABLE_STARTUP_DB_CACHES=true ENABLE_BACKGROUND_SERVICES=false PG_SEARCH_PATH=dev npm run build`)
- [x] Uji di **Dev (`5020`)** / rilis & deploy ke **Staging (`5010`)** sesuai persetujuan pengguna, lalu verifikasi jam pembuatan kampanye terbaru tampil sesuai WIB (GMT+7)

---

## Rincian Perubahan Kode (Before & After Code Snippets)

### 1. File Baru: `lib/date-format.js`

**Code Sesudah (Proposed/After):**
```js
const BARE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
export const JAKARTA_TIMEZONE = 'Asia/Jakarta';

/**
 * Mengubah string/Date timestamp menjadi objek Date UTC yang akurat.
 * String timestamp tanpa offset zona waktu (mis. PostgreSQL TIMESTAMP WITHOUT TIME ZONE)
 * ditafsirkan sebagai UTC agar tidak tergeser oleh zona waktu lokal server/browser.
 */
export function parseUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = BARE_DATETIME_RE.test(raw)
    ? new Date(`${raw.replace(' ', 'T')}Z`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWibDateTime(value, options = {}) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    ...options
  })} WIB`;
}

export function formatWibTime(value, options = {}) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleTimeString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    ...options
  })} WIB`;
}

export function formatWibShortDateTime(value) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleDateString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })} WIB`;
}
```

### 2. `lib/db-pg.js`

**Code Sebelum (Current/Before):**
```js
import pkg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { assertSafeTestDbEnv } from './db-env-validator.js';
const { Pool, types } = pkg;

// Parse tipe PostgreSQL DATE (OID: 1082) sebagai raw string 'YYYY-MM-DD'
// Mencegah pergeseran hari akibat konversi UTC vs Local Timezone
types.setTypeParser(1082, (val) => val);
```

**Code Sesudah (Proposed/After):**
```js
import pkg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { assertSafeTestDbEnv } from './db-env-validator.js';
import { parseUtcDate } from './date-format.js';
const { Pool, types } = pkg;

// Parse tipe PostgreSQL DATE (OID: 1082) sebagai raw string 'YYYY-MM-DD'
// Mencegah pergeseran hari akibat konversi UTC vs Local Timezone
types.setTypeParser(1082, (val) => val);

// Parse PostgreSQL TIMESTAMP WITHOUT TIME ZONE (OID: 1114) sebagai UTC
// karena server PostgreSQL menyimpan CURRENT_TIMESTAMP dalam Etc/UTC
types.setTypeParser(1114, (val) => parseUtcDate(val));
```

### 3. `app/pillar-campaigns/page.js`

**Code Sebelum (Current/Before) — Baris 2420 & 2582:**
```jsx
Mengontrol antrean video OPC otomatis. {schedulerDetail ? `Node: ${schedulerDetail.node_role} · Worker: ${schedulerDetail.worker_enabled ? 'siap' : 'mati'} · Tick: ${schedulerDetail.last_tick_at ? new Date(schedulerDetail.last_tick_at).toLocaleTimeString('id-ID') : 'belum ada'}` : ''}
```
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {new Date(c.created_at).toLocaleString('id-ID')}
</div>
```

**Code Sesudah (Proposed/After):**
```jsx
Mengontrol antrean video OPC otomatis. {schedulerDetail ? `Node: ${schedulerDetail.node_role} · Worker: ${schedulerDetail.worker_enabled ? 'siap' : 'mati'} · Tick: ${schedulerDetail.last_tick_at ? formatWibTime(schedulerDetail.last_tick_at) : 'belum ada'}` : ''}
```
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {formatWibDateTime(c.created_at)}
</div>
```

### 4. `app/pillar-campaigns/[id]/page.js`

**Code Sebelum (Current/Before) — Baris 3766 & 4260:**
```jsx
<span>📅 Dibuat: <strong>{new Date(campaign.created_at).toLocaleString('id-ID')}</strong></span>
```
```jsx
<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
  (ID: #{item.id}) | Dibuat: {new Date(item.created_at).toLocaleString('id-ID')}
</span>
```

**Code Sesudah (Proposed/After):**
```jsx
<span>📅 Dibuat: <strong>{formatWibDateTime(campaign.created_at)}</strong></span>
```
```jsx
<span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
  (ID: #{item.id}) | Dibuat: {formatWibDateTime(item.created_at)}
</span>
```

### 5. `app/components/campaign-forms/MultiplierConfigurationForm.js`

**Code Sebelum (Current/Before) — Baris 3212:**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {new Date(c.created_at).toLocaleString('id-ID')}
</div>
```

**Code Sesudah (Proposed/After):**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {formatWibDateTime(c.created_at)}
</div>
```

### 6. `app/multiplier-lab/[id]/page.js`

**Code Sebelum (Current/Before) — Baris 793:**
```jsx
<span>📅 Dibuat: <strong>{firstTask?.created_at ? new Date(firstTask.created_at).toLocaleString('id-ID') : '-'}</strong></span>
```

**Code Sesudah (Proposed/After):**
```jsx
<span>📅 Dibuat: <strong>{firstTask?.created_at ? formatWibDateTime(firstTask.created_at) : '-'}</strong></span>
```

### 7. `app/components/campaign-forms/ReCampaignConfigurationForm.js`

**Code Sebelum (Current/Before) — Baris 2378:**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {new Date(c.created_at).toLocaleString('id-ID')}
</div>
```

**Code Sesudah (Proposed/After):**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
  {formatWibDateTime(c.created_at)}
</div>
```

### 8. `app/re-campaigns/[id]/page.js`

**Code Sebelum (Current/Before) — Baris 4527:**
```jsx
<span>📅 Dibuat: <strong>{new Date(campaign.created_at).toLocaleString('id-ID')}</strong></span>
```

**Code Sesudah (Proposed/After):**
```jsx
<span>📅 Dibuat: <strong>{formatWibDateTime(campaign.created_at)}</strong></span>
```

### 9. `app/components/campaign-forms/RecipeLabsConfigurationForm.js`

**Code Sebelum (Current/Before) — Baris 2612:**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('id-ID')}</div>
```

**Code Sesudah (Proposed/After):**
```jsx
<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatWibDateTime(c.created_at)}</div>
```

### 10. `app/auto-pipeline/page.js`

**Code Sebelum (Current/Before) — Baris 6335:**
```jsx
{camp.created_at ? ` • ${new Date(camp.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
```

**Code Sesudah (Proposed/After):**
```jsx
{camp.created_at ? ` • ${formatWibShortDateTime(camp.created_at)}` : ''}
```
