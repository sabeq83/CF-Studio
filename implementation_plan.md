# Implementation Plan: Analitik Performa Konten via Repliz & Meta Graph API (Gelombang 1)

**Branch**: `fitur/analitik-performa`  
**Penyusun**: Antigravity  
**Dasar Rencana**: [analitik_mingguan_implementation_plan.md](catatan-kerja/rencana/analitik_mingguan_implementation_plan.md) (v2.1 + Pembaruan 22 Nov 2026 Bagian 3B)  
**Instruksi**: [antigravity_analitik_mingguan_instructions.md](catatan-kerja/instruksi-agent/antigravity_analitik_mingguan_instructions.md)  
**Target Rilis**: Gelombang 1 (Facebook Dapur Botani & NutriBake ID via App Meta; Instagram, TikTok, YouTube, Threads via Repliz API)

---

## 1. Ringkasan & Ruang Lingkup

Mengimplementasikan sistem pengumpulan dan pelaporan analitik performa konten harian multi-platform untuk CF Studio:
1. **Facebook**: Diambil langsung via **App Meta (Graph API v25.0)** untuk akun yang terhubung (Dapur Botani & NutriBake ID). Mengambil metrik halaman harian (7 hari), metrik postingan, dan metrik penayangan Reels/video (views, reach, clicks, reactions, durasi tonton).
2. **Instagram, TikTok, YouTube, Threads**: Diambil via **Repliz API (Paket Gold)** yang telah terbukti menghasilkan data metrik riil lengkap (views, reach, likes, comments, shares, saves, retention, average watch time, dan skip rate).
3. **Database & Normalisasi**:
   - Tabel `account_metric_daily` (ringkasan 28-30 hari per akun, metrik harian dinormalisasi).
   - Tabel `post_metric_snapshots` (snapshot `h24`, `h72`, `d7`, dan `latest` per postingan).
   - Aturan "nol mencurigakan" (K3): jika postingan > 24 jam bernilai 0 di semua metrik utama pada Repliz, simpan `NULL` dengan `insight_available = false`.
   - Normalisasi durasi tonton seragam ke satuan detik (K8).
4. **Pengambil Harian**: `lib/metrics-collector.js` dijadwalkan di `lib/campaign-scheduler.js` (default jam 03.00 WIB, status default MATI / `analytics_collector_active = false` sampai diaktifkan pengguna).
5. **API & MCP**: Endpoint `/api/v2/analytics/*` dan tool MCP (`cf_get_account_metrics`, `cf_get_post_metrics`, `cf_collect_metrics_now`).
6. **Mockup UI & Halaman Performa**: Mockup mandiri di `public/mockup_analitik_performa.html` (diuji di Dev Port 5020) sebelum implementasi React UI.

---

## 2. Execution Task List

### Fase 0: Uji Baca API (SELESAI)
- [x] Task 0.1: Uji Facebook 2 halaman via Meta & Repliz (`catatan-kerja/laporan/LAPORAN_UJI_INSIGHT_FACEBOOK_2_HALAMAN.md`)
- [x] Task 0.2: Uji Instagram 2 akun via Meta & Repliz (`catatan-kerja/laporan/LAPORAN_UJI_INSIGHT_INSTAGRAM.md`)
- [x] Task 0.3: Uji ringan TikTok, YouTube, Threads via Repliz (`catatan-kerja/laporan/LAPORAN_UJI_INSIGHT_TIKTOK_YOUTUBE_THREADS.md`)
- [x] Task 0.4: Buat branch git `fitur/analitik-performa` dari `main`

### Fase 1: Fondasi Data & Normalizer
- [x] Task 1.1: Tambah fungsi pembacaan statistik di `lib/repliz-client.js` (`getReplizAccountStatistic`, `listReplizContent`, `getReplizContentStatistic`)
- [x] Task 1.2: Buat modul `lib/meta-insights-client.js` untuk penarikan analitik Facebook Graph API
- [x] Task 1.3: Buat modul `lib/repliz-metrics-normalizer.js` (normalisasi lintas platform, durasi tonton ke detik, penanganan nol mencurigakan K3)
- [x] Task 1.4: Tulis dan verifikasi unit test komprehensif di `tests/metrics-normalizer.test.js`
- [x] Task 1.5: Tambah migrasi database idempoten di `lib/db-pg.js` (`account_metric_daily`, `post_metric_snapshots`, kolom `publishing_accounts.insights_*`)
- [x] Task 1.6: Daftarkan tabel baru ke `isolatedTables` di `lib/db.js`

### Fase 2: Pengambil Harian (Unified Collector)
- [x] Task 2.1: Buat modul pengambil harian `lib/metrics-collector.js` (gabungan Meta & Repliz, rate limit safe, interval 300ms, max 400 calls, tenant isolation)
- [x] Task 2.2: Daftarkan blok runner scheduler di `lib/campaign-scheduler.js` (default saklar MATI)
- [x] Task 2.3: Buat endpoint manual trigger `POST /api/v2/analytics/collect` (mendukung `dryRun: true` dan filter accountId)
- [ ] Task 2.4: Verifikasi di server Dev (`npm run deploy:dev:atomic`): jalankan 2x dan verifikasi idempoten (tanpa duplikasi baris)

### Fase 3: API & MCP Analitik
- [x] Task 3.1: Buat endpoint `GET /api/v2/analytics/accounts` (ringkasan periode dan pembanding)
- [x] Task 3.2: Buat endpoint `GET /api/v2/analytics/posts` (daftar performa postingan + skor keterlibatan)
- [x] Task 3.3: Buat endpoint `GET /api/v2/analytics/health` (status koneksi dan daftar akun belum terhubung)
- [x] Task 3.4: Daftarkan tool MCP di server MCP CF Studio (`cf_get_account_metrics`, `cf_get_post_metrics`, `cf_collect_metrics_now`)

### Fase 4: Pengujian di Lingkungan Dev
- [ ] Task 4.1: Deploy branch `fitur/analitik-performa` ke server Dev (Port 5020)
- [ ] Task 4.2: Jalankan unit test dan uji integrasi API di Dev

### Fase 5: UI & Mockup HTML (Gerbang Review)
- [x] Task 5.1: Buat file mockup mandiri `public/mockup_analitik_performa.html` (CSS tokens inline, dark/light mode, data netral)
- [ ] Task 5.2: Deploy mockup ke server Dev (`http://100.95.245.55:5020/mockup_analitik_performa.html`)
- [ ] Task 5.3: **STOP & REVIEW**: Laporkan link mockup ke pengguna dan tunggu persetujuan sebelum implementasi React UI
- [ ] Task 5.4: Implementasi halaman antarmuka Performa di aplikasi web menggunakan 100% semantic CSS tokens

### Fase 6: CFA Scripts (Dikerjakan Claude di ~/cf-autopipeline)
- [ ] Task 6.1: Dikoordinasikan dengan Claude setelah API Fase 3 siap

### Fase 7: Rilis & Deployment Staging
- [ ] Task 7.1: Verifikasi akhir seluruh unit test dan pemeriksaan bebas secret
- [ ] Task 7.2: Minta konfirmasi pengguna untuk migrasi database
- [ ] Task 7.3: Merge branch `fitur/analitik-performa` ke `main` (--no-ff)
- [ ] Task 7.4: Jalankan `npm run release-non-interactive` dari `main`
- [ ] Task 7.5: Deploy rilis `main` ke Staging atomic dan lakukan verifikasi kesehatan server

---

## 3. Code Sebelum & Code Sesudah (Snippets)

### 3.1 File: `lib/repliz-client.js`

#### Code Sebelum (Current/Before):
```javascript
export async function retryReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'PUT', `/public/schedule/${scheduleId}/retry`);
}

export async function deleteReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'DELETE', `/public/schedule/${scheduleId}`);
}
```

#### Code Sesudah (Proposed/After):
```javascript
export async function retryReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'PUT', `/public/schedule/${scheduleId}/retry`);
}

export async function deleteReplizSchedule(credentials, scheduleId) {
  return await callRepliz(credentials, 'DELETE', `/public/schedule/${scheduleId}`);
}

export async function getReplizAccountStatistic(credentials, accountId) {
  const result = await callRepliz(credentials, 'GET', `/public/account/${encodeURIComponent(accountId)}/statistic`);
  return result?.data || result;
}

export async function listReplizContent(credentials, accountId, { nextToken = '', limit = 50 } = {}) {
  const qs = new URLSearchParams({ accountId: String(accountId), limit: String(limit) });
  if (nextToken) qs.set('nextToken', nextToken);
  const result = await callRepliz(credentials, 'GET', `/public/content?${qs.toString()}`);
  const docs = Array.isArray(result?.data) ? result.data : (Array.isArray(result?.docs) ? result.docs : (Array.isArray(result) ? result : []));
  return {
    docs,
    nextToken: result?.nextToken || result?.nexToken || ''
  };
}

export async function getReplizContentStatistic(credentials, accountId, contentId) {
  const qs = new URLSearchParams({ accountId: String(accountId) });
  const result = await callRepliz(credentials, 'GET', `/public/content/${encodeURIComponent(contentId)}/statistic?${qs.toString()}`);
  return result?.data || result;
}
```

---

### 3.2 File: `lib/repliz-metrics-normalizer.js` (File Baru)

#### Code Sebelum (Current/Before):
*(File belum ada)*

#### Code Sesudah (Proposed/After):
```javascript
/**
 * Modul Normalisasi Metrik Performa Lintas Platform (Repliz & Meta)
 */

export function normalizeContentStatistic(platform, raw = {}, { ageHours = null, source = 'repliz' } = {}) {
  const p = String(platform || '').toLowerCase();
  const ins = raw?.insight || null;

  // Aturan K3: Nol mencurigakan untuk Repliz jika postingan > 24 jam dan semua metrik 0
  if (source === 'repliz' && ageHours !== null && ageHours >= 24) {
    const isSuspiciousZero = (
      (raw?.views === 0 || raw?.views === undefined) &&
      (raw?.reach === 0 || raw?.reach === undefined) &&
      (raw?.like === 0 || raw?.like === undefined) &&
      (raw?.comment === 0 || raw?.comment === undefined) &&
      (raw?.share === 0 || raw?.share === undefined) &&
      (!ins || (ins.views === 0 && ins.reach === 0 && ins.clicks === 0))
    );
    if (isSuspiciousZero) {
      return {
        views: null, reach: null, clicks: null, reactions: null,
        likes: null, comments: null, shares: null, saves: null,
        avg_watch_sec: null, total_watch_sec: null, full_watch_rate: null, skip_rate: null,
        insight_available: false, is_suspicious_zero: true
      };
    }
  }

  switch (p) {
    case 'facebook': {
      if (source === 'meta_api') {
        return {
          views: raw?.post_media_view ?? null,
          reach: raw?.post_total_media_view_unique ?? null,
          clicks: raw?.post_clicks ?? null,
          reactions: raw?.reactionsCount ?? null,
          likes: raw?.likesCount ?? raw?.reactionsCount ?? null,
          comments: raw?.commentsCount ?? null,
          shares: raw?.sharesCount ?? null,
          saves: null,
          avg_watch_sec: raw?.post_video_avg_time_watched != null ? raw.post_video_avg_time_watched / 1000 : null,
          total_watch_sec: raw?.post_video_view_time != null ? raw.post_video_view_time / 1000 : null,
          full_watch_rate: null,
          skip_rate: null,
          insight_available: Boolean(raw?.post_media_view !== undefined || raw?.reactionsCount !== undefined)
        };
      }
      return {
        views: ins?.views ?? raw?.views ?? null,
        reach: ins?.reach ?? raw?.reach ?? null,
        clicks: ins?.clicks ?? null,
        reactions: ins?.reaction ?? raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.comment ?? null,
        shares: raw?.share ?? null,
        saves: null,
        avg_watch_sec: null, total_watch_sec: null, full_watch_rate: null, skip_rate: null,
        insight_available: Boolean(ins)
      };
    }

    case 'instagram': {
      return {
        views: raw?.views ?? null,
        reach: raw?.reach ?? null,
        clicks: null,
        reactions: raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.comment ?? null,
        shares: raw?.share ?? null,
        saves: raw?.saved ?? null,
        avg_watch_sec: raw?.averageWatchTime ?? null,
        total_watch_sec: raw?.watchTime ?? null,
        full_watch_rate: null,
        skip_rate: raw?.skipRate ?? null,
        insight_available: Boolean(raw?.views !== undefined || raw?.reach !== undefined)
      };
    }

    case 'tiktok': {
      return {
        views: raw?.views ?? null,
        reach: raw?.reach ?? null,
        clicks: raw?.websiteClicks ?? null,
        reactions: raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.comment ?? null,
        shares: raw?.share ?? null,
        saves: raw?.favourite ?? null,
        avg_watch_sec: raw?.averageWatched ?? null,
        total_watch_sec: raw?.watched ?? null,
        full_watch_rate: raw?.fullWatchedRate ?? null,
        skip_rate: null,
        insight_available: Boolean(raw?.views !== undefined)
      };
    }

    case 'youtube': {
      return {
        views: raw?.views ?? null,
        reach: null,
        clicks: null,
        reactions: raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.comment ?? null,
        shares: ins?.shares ?? null,
        saves: null,
        avg_watch_sec: ins?.averageViewDuration ?? null,
        total_watch_sec: ins?.estimatedMinutesWatched != null ? ins.estimatedMinutesWatched * 60 : null,
        full_watch_rate: ins?.averageViewPercentage != null ? ins.averageViewPercentage / 100 : null,
        skip_rate: null,
        insight_available: Boolean(raw?.views !== undefined)
      };
    }

    case 'threads': {
      return {
        views: raw?.views ?? null,
        reach: null,
        clicks: null,
        reactions: raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.replies ?? null,
        shares: (raw?.repost || 0) + (raw?.share || 0) || null,
        saves: null,
        avg_watch_sec: null, total_watch_sec: null, full_watch_rate: null, skip_rate: null,
        insight_available: Boolean(raw?.views !== undefined)
      };
    }

    default:
      return {
        views: raw?.views ?? null, reach: raw?.reach ?? null, clicks: null,
        reactions: raw?.like ?? null, likes: raw?.like ?? null, comments: raw?.comment ?? null,
        shares: raw?.share ?? null, saves: null, avg_watch_sec: null, total_watch_sec: null,
        full_watch_rate: null, skip_rate: null, insight_available: false
      };
  }
}
```

---

### 3.3 File: `lib/meta-insights-client.js` (File Baru)

#### Code Sebelum (Current/Before):
*(File belum ada)*

#### Code Sesudah (Proposed/After):
```javascript
/**
 * Meta Graph API Insights Client
 * Read-only, zero credential leakage.
 */

import { getGraphBaseUrl } from './meta-publisher.js';

export async function getMetaTokenInfo(token) {
  const url = `${getGraphBaseUrl()}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const json = await res.json();
  return json?.data || null;
}

export async function getFacebookPageDailyInsights(pageId, pageToken, sinceSec, untilSec) {
  const metrics = ['page_media_view', 'page_views_total', 'page_post_engagements', 'page_follows', 'page_daily_follows_unique'];
  const qs = new URLSearchParams({
    metric: metrics.join(','),
    period: 'day',
    since: String(sinceSec),
    until: String(untilSec),
    access_token: pageToken
  });
  const res = await fetch(`${getGraphBaseUrl()}/${pageId}/insights?${qs.toString()}`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  return json?.data || [];
}

export async function getFacebookPostInsights(postId, pageToken) {
  const fields = 'id,created_time,permalink_url,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)';
  const postRes = await fetch(`${getGraphBaseUrl()}/${postId}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`, { signal: AbortSignal.timeout(10000) });
  const postData = await postRes.json();
  if (postData.error) return { error: postData.error };

  const metrics = 'post_media_view,post_total_media_view_unique,post_clicks';
  const insRes = await fetch(`${getGraphBaseUrl()}/${postId}/insights?metric=${metrics}&access_token=${encodeURIComponent(pageToken)}`, { signal: AbortSignal.timeout(10000) });
  const insData = await insRes.json();

  let videoInsights = null;
  const reelMatch = postData.permalink_url?.match(/\/reel\/(\d+)/);
  const videoId = reelMatch ? reelMatch[1] : null;
  if (videoId) {
    const vRes = await fetch(`${getGraphBaseUrl()}/${videoId}/video_insights?metric=blue_reels_play_count,post_video_avg_time_watched,post_video_view_time&access_token=${encodeURIComponent(pageToken)}`, { signal: AbortSignal.timeout(10000) });
    const vJson = await vRes.json();
    videoInsights = vJson?.data || null;
  }

  return { postData, insData: insData?.data || [], videoInsights };
}
```

---

### 3.4 File: `lib/db-pg.js`

#### Code Sebelum (Current/Before):
```javascript
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS external_schedule_id TEXT;
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS title_snapshot TEXT;

          -- Drop old platform check constraints dynamically
```

#### Code Sesudah (Proposed/After):
```javascript
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS external_schedule_id TEXT;
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS title_snapshot TEXT;

          -- Analitik Performa Konten (Gelombang 1)
          CREATE TABLE IF NOT EXISTS account_metric_daily (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            publishing_account_id TEXT NOT NULL REFERENCES publishing_accounts(id) ON DELETE CASCADE,
            provider_account_id TEXT,
            platform TEXT NOT NULL,
            metric_date DATE NOT NULL,
            source TEXT NOT NULL DEFAULT 'repliz',
            views BIGINT,
            reach BIGINT,
            engagement BIGINT,
            video_views BIGINT,
            profile_views BIGINT,
            new_follows BIGINT,
            unfollows BIGINT,
            followers_total BIGINT,
            raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, publishing_account_id, metric_date)
          );

          CREATE TABLE IF NOT EXISTS post_metric_snapshots (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            publishing_job_id TEXT REFERENCES publishing_jobs(id) ON DELETE SET NULL,
            publishing_account_id TEXT NOT NULL REFERENCES publishing_accounts(id) ON DELETE CASCADE,
            platform TEXT NOT NULL,
            external_post_id TEXT NOT NULL,
            permalink TEXT,
            post_created_at TIMESTAMPTZ,
            snapshot_tag TEXT NOT NULL CHECK (snapshot_tag IN ('h24', 'h72', 'd7', 'latest')),
            source TEXT NOT NULL DEFAULT 'repliz',
            age_hours NUMERIC,
            views BIGINT,
            reach BIGINT,
            clicks BIGINT,
            reactions BIGINT,
            likes BIGINT,
            comments BIGINT,
            shares BIGINT,
            saves BIGINT,
            avg_watch_sec NUMERIC,
            total_watch_sec NUMERIC,
            view_pct NUMERIC,
            full_watch_rate NUMERIC,
            skip_rate NUMERIC,
            insight_available BOOLEAN NOT NULL DEFAULT TRUE,
            raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, publishing_account_id, external_post_id, snapshot_tag)
          );

          ALTER TABLE publishing_accounts
            ADD COLUMN IF NOT EXISTS insights_status TEXT NOT NULL DEFAULT 'unknown',
            ADD COLUMN IF NOT EXISTS insights_checked_at TIMESTAMPTZ;

          CREATE INDEX IF NOT EXISTS post_metric_job_idx ON post_metric_snapshots (tenant_id, publishing_job_id);
          CREATE INDEX IF NOT EXISTS post_metric_acct_idx ON post_metric_snapshots (tenant_id, publishing_account_id, post_created_at DESC);
          CREATE INDEX IF NOT EXISTS acct_metric_date_idx ON account_metric_daily (tenant_id, metric_date DESC);
```

---

### 3.5 File: `lib/db.js`

#### Code Sebelum (Current/Before):
```javascript
  const isolatedTables = [
    'users',
    'brand_profiles',
    'gemini_api_keys',
    'content_planners',
    'strategic_campaigns',
```

#### Code Sesudah (Proposed/After):
```javascript
  const isolatedTables = [
    'users',
    'brand_profiles',
    'gemini_api_keys',
    'content_planners',
    'strategic_campaigns',
    'account_metric_daily',
    'post_metric_snapshots',
```
