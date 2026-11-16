# Implementation Plan: Analitik Performa Konten via Repliz (Paket Gold)

Tanggal: 16 Nov 2026 · Versi rencana: 1 · Eksekutor web app: Antigravity · Eksekutor skrip & skill CFA: Claude · Reviewer: Claude + pengguna
Dasar: [USULAN_ANALITIK_MINGGUAN_CFA.md](USULAN_ANALITIK_MINGGUAN_CFA.md) (v2.1)
Instruksi agent: [antigravity_analitik_mingguan_instructions.md](antigravity_analitik_mingguan_instructions.md)
Referensi API: `https://api.repliz.com/public-json` (OpenAPI 3.0)

> **GERBANG:**
> 1. **Fase 0 (uji baca API)** wajib dilaporkan dulu. Bila `insight` Facebook kosong atau ID posting tidak cocok, berhenti dan laporkan.
> 2. **Fase 5 (halaman Performa di web app)** wajib mockup HTML dulu dan menunggu persetujuan pengguna.

---

## 1. Tujuan

| No | Target |
|---|---|
| A1 | Web app menyimpan statistik harian **per akun** dan statistik **per posting** (umur 24 jam, 72 jam, 7 hari) dari Repliz untuk semua tenant |
| A2 | Data posting tersambung ke konten CF Studio (brand, jenis video, preset, template finishing, produk, jam tayang) |
| A3 | Tool MCP + API ringkasan agar skrip CFA dan skill Claude bisa membaca data tanpa menyentuh kunci Repliz |
| A4 | Akun yang perlu **reconnect** (insight Facebook kosong) terdeteksi dan terlihat di halaman Publishing |
| A5 | Laporan mingguan + rencana pekan depan dihasilkan skill `cfa-analitik` setiap Senin |

## 2. Di luar cakupan

- Tidak mengubah alur publish/jadwal yang sudah ada.
- Tidak memakai endpoint riset TikTok/Threads Repliz (bisa usulan terpisah).
- Tidak deploy ke Production.

---

## 3. Fakta API Repliz yang dipakai

| Endpoint | Paket | Catatan |
|---|---|---|
| `GET /public/account/{accountId}/statistic` | Standard+ | Facebook: `followersCount`, `fanCount`, `summary` 28 hari (`views, reach, engagement, profileViews, newFollows, unfollows, videoViews`), `metrics` harian. `summary` null & `metrics` kosong bila Page belum memberi `read_insights` (Page terhubung sebelum 13 Nov 2026 wajib reconnect sekali). YouTube: cache 6 jam |
| `GET /public/content?accountId=&nextToken=` | Gold+ | Daftar posting (`id`, `title`, `description`, `type`, `url`, `createdAt`). Paging via `nextToken` (kosong = habis). Catatan: contoh respons menulis `nexToken`, jadi baca keduanya |
| `GET /public/content/{contentId}/statistic?accountId=` | Gold+ | Facebook: `like, comment, share, insight{views, reach, clicks, reaction, reactions{}}`, `insight` null bila tanpa izin. YouTube: `views, like, comment, insight{estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, subscribersLost, shares, metrics[], trafficSources[]}`. TikTok: `views, reach, like, comment, share, favourite, averageWatched, fullWatchedRate, retention[], websiteClicks…`. IG Reels: `views, reach, saved, averageWatchTime, skipRate…`. 404 `statistic not found` mungkin terjadi |
| Autentikasi | – | Basic Auth `accessKey:secretKey` (sudah dipakai `callRepliz`) |

Dokumentasi tidak menyebut batas pemakaian. Tetap hemat: jeda ±300 ms antar panggilan, maksimal 400 panggilan statistik per jalan, dan backoff saat 429/5xx.

---

## 4. Desain data

### 4.1 Tabel `account_metric_daily`

| Kolom | Tipe | Isi |
|---|---|---|
| `id` | TEXT PK | `${tenant_id}:${publishing_account_id}:${metric_date}` |
| `tenant_id` | TEXT NOT NULL | |
| `publishing_account_id` | TEXT NOT NULL | FK `publishing_accounts.id` |
| `provider_account_id` | TEXT | `_id` akun Repliz |
| `platform` | TEXT | facebook/instagram/youtube/tiktok/threads/linkedin |
| `metric_date` | DATE | |
| `views`, `reach`, `engagement`, `video_views`, `profile_views`, `new_follows`, `unfollows` | BIGINT NULL | dari `metrics` harian (nama kolom dinormalisasi) |
| `followers_total` | BIGINT NULL | snapshot saat ambil |
| `raw_json` | JSONB | angka harian asli dari Repliz |
| `captured_at` | TIMESTAMPTZ | |

UNIQUE `(tenant_id, publishing_account_id, metric_date)`; upsert agar angka hari yang sama diperbarui (Meta merevisi angka beberapa hari).

### 4.2 Tabel `post_metric_snapshots`

| Kolom | Tipe | Isi |
|---|---|---|
| `id` | TEXT PK | |
| `tenant_id` | TEXT NOT NULL | |
| `publishing_job_id` | TEXT NULL | NULL untuk posting di luar CF Studio |
| `publishing_account_id` | TEXT NOT NULL | |
| `platform` | TEXT | |
| `external_post_id` | TEXT NOT NULL | = `contentId` Repliz |
| `permalink`, `post_created_at` | TEXT, TIMESTAMPTZ | |
| `snapshot_tag` | TEXT | `h24` / `h72` / `d7` / `latest` |
| `age_hours` | NUMERIC | umur posting saat diambil |
| `views`, `reach`, `clicks`, `reactions`, `likes`, `comments`, `shares`, `saves` | BIGINT NULL | |
| `avg_watch_sec`, `view_pct`, `full_watch_rate`, `skip_rate` | NUMERIC NULL | |
| `insight_available` | BOOLEAN | false bila `insight` Facebook null |
| `raw_json` | JSONB | respons asli (tanpa kredensial) |
| `captured_at` | TIMESTAMPTZ | |

UNIQUE `(tenant_id, publishing_account_id, external_post_id, snapshot_tag)`.

### 4.3 Kolom tambahan `publishing_accounts`

`insights_status TEXT NULL` (`ok` / `needs_reconnect` / `unknown`), `insights_checked_at TIMESTAMPTZ NULL`.

### 4.4 View/kueri gabungan `v_post_performance`

`post_metric_snapshots` (tag `h72`, fallback `latest`) JOIN `publishing_jobs` (via `publishing_job_id`) JOIN content-flow item (`content_id` = `opc_*`/`mul_*`) → brand, `campaign_kind`/jenis video, `preset_key`, `finishing_template`, judul/hook, produk, `scheduled_at` (jam & hari tayang). Kolom yang tidak tersedia dibiarkan NULL, jangan ditebak.

---

## 5. Perubahan per file (Code Sebelum → Code Sesudah)

> Potongan "Sesudah" adalah arah implementasi. Nama boleh disesuaikan asal perilakunya sama.

### 5.1 `lib/repliz-client.js`: fungsi statistik

**Code Sebelum (Current/Before)**, baris 118–147: hanya akun & jadwal.
```js
export async function listReplizAccounts(credentials) { ... '/public/account?page=1&limit=100' ... }
export async function getReplizAccount(credentials, accountId) { ... }
export async function createReplizSchedule(credentials, payload) { ... }
export async function getReplizSchedule(credentials, scheduleId) { ... }
export async function retryReplizSchedule(credentials, scheduleId) { ... }
export async function deleteReplizSchedule(credentials, scheduleId) { ... }
```

**Code Sesudah (Proposed/After):**
```js
export async function getReplizAccountStatistic(credentials, accountId) {
  const r = await callRepliz(credentials, 'GET', `/public/account/${encodeURIComponent(accountId)}/statistic`);
  return r?.data || r;
}

export async function listReplizContent(credentials, accountId, { nextToken = '' } = {}) {
  const qs = new URLSearchParams({ accountId });
  if (nextToken) qs.set('nextToken', nextToken);
  const r = await callRepliz(credentials, 'GET', `/public/content?${qs}`);
  return { docs: Array.isArray(r?.docs) ? r.docs : [], nextToken: r?.nextToken || r?.nexToken || '' };
}

export async function getReplizContentStatistic(credentials, accountId, contentId) {
  const qs = new URLSearchParams({ accountId });
  const r = await callRepliz(credentials, 'GET', `/public/content/${encodeURIComponent(contentId)}/statistic?${qs}`);
  return r?.data || r;
}
```

### 5.2 `lib/repliz-metrics-normalizer.js` (file baru, pure JS, mudah dites)

**Code Sebelum:** tidak ada.

**Code Sesudah:**
```js
export function normalizeContentStatistic(platform, raw = {}) {
  const ins = raw.insight || null;
  switch (platform) {
    case 'facebook': return {
      views: ins?.views ?? null, reach: ins?.reach ?? null, clicks: ins?.clicks ?? null,
      reactions: ins?.reaction ?? raw.like ?? null, likes: raw.like ?? null,
      comments: raw.comment ?? null, shares: raw.share ?? null, saves: null,
      insight_available: Boolean(ins)
    };
    case 'youtube': return {
      views: raw.views ?? null, likes: raw.like ?? null, comments: raw.comment ?? null,
      shares: ins?.shares ?? null, avg_watch_sec: ins?.averageViewDuration ?? null,
      view_pct: ins?.averageViewPercentage ?? null, insight_available: Boolean(ins)
    };
    case 'tiktok': return {
      views: raw.views ?? null, reach: raw.reach ?? null, likes: raw.like ?? null,
      comments: raw.comment ?? null, shares: raw.share ?? null, saves: raw.favourite ?? null,
      clicks: raw.websiteClicks ?? null, avg_watch_sec: raw.averageWatched ?? null,
      full_watch_rate: raw.fullWatchedRate ?? null, insight_available: true
    };
    case 'instagram': return { /* views, reach, like, comment, share, saved, averageWatchTime, skipRate */ };
    case 'threads': return { /* views, like, replies→comments, repost+share→shares */ };
    default: return { insight_available: false };
  }
}
export function normalizeAccountDaily(platform, raw = {}) { /* metrics[] → [{ metric_date, views, reach, ... }] */ }
export function detectInsightsStatus(platform, accountStat) {
  if (platform !== 'facebook') return 'ok';
  return accountStat?.summary ? 'ok' : 'needs_reconnect';
}
```

### 5.3 `lib/db-pg.js`: migrasi

**Code Sebelum** (baris 1643–1680): `publishing_jobs` sudah punya `external_post_id`, `external_permalink`, `published_at`. Tidak ada tabel metrik.

**Code Sesudah:** blok migrasi idempoten baru (pola `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` yang sudah dipakai), untuk tabel 4.1, 4.2, kolom 4.3, plus indeks:
```sql
CREATE INDEX IF NOT EXISTS post_metric_job_idx  ON post_metric_snapshots (tenant_id, publishing_job_id);
CREATE INDEX IF NOT EXISTS post_metric_acct_idx ON post_metric_snapshots (tenant_id, publishing_account_id, post_created_at DESC);
CREATE INDEX IF NOT EXISTS acct_metric_date_idx ON account_metric_daily (tenant_id, metric_date DESC);
```
Tabel baru wajib masuk daftar tabel terisolasi tenant (`isolatedTables` di `lib/db.js`) bila diakses lewat layer kompatibilitas.

### 5.4 `lib/repliz-metrics-collector.js` (file baru): pengambil harian

**Code Sebelum:** tidak ada. Pola scheduler ada di `lib/campaign-scheduler.js` (interval 15 dtk, `tenantContext.run`, saklar `getSetting('..._scheduler_active')`).

**Code Sesudah:**
```js
export async function collectReplizMetrics({ tenantId, now = new Date(), dryRun = false } = {}) {
  const creds = await getReplizCredentials(tenantId);          // pakai kunci tenant itu sendiri
  const accounts = await listActiveReplizPublishingAccounts(tenantId);
  for (const acc of accounts) {
    // 1) statistik akun → account_metric_daily (upsert 28 hari) + insights_status
    // 2) posting CF Studio: publishing_jobs status 'published', external_post_id NOT NULL,
    //    published_at antara now-8 hari dan now-20 jam → tentukan tag yang jatuh tempo:
    //      h24: umur 20–36 jam, h72: 66–90 jam, d7: 160–200 jam (ambil sekali per tag), selalu update 'latest'
    // 3) (opsional, setting analytics_include_external_posts) listReplizContent 1–2 halaman → posting non-CF Studio
    //    disimpan dengan publishing_job_id NULL
  }
  return { tenantId, accounts: n, accountRows, postSnapshots, needsReconnect: [...], errors: [...] };
}
```
- Dipanggil dari scheduler satu kali per hari per tenant (default 03.00 WIB, setting `analytics_collector_hour`), dengan saklar `analytics_collector_active` (default `false` sampai pengguna menyalakan).
- Kunci catatan "sudah jalan hari ini" disimpan agar tidak dobel saat restart.
- Error per akun tidak menghentikan akun lain. Pesan error melewati `redactCredentials`.

### 5.5 `lib/campaign-scheduler.js`: daftarkan pengambil

**Code Sebelum** (sekitar baris 245–260):
```js
await tenantContext.run('__none__', async () => {
  // --- DECONSTRUCT LAB QUEUE RUNNER ---
  const deconstructActive = await getSetting('deconstruct_scheduler_active') !== 'false';
  if (deconstructActive) { ... }
```

**Code Sesudah** (ditambahkan sebagai blok terpisah, tidak mengubah blok lain):
```js
  // --- REPLIZ ANALYTICS COLLECTOR (harian) ---
  const analyticsActive = await getSetting('analytics_collector_active') === 'true';
  if (analyticsActive && isCollectorDue(new Date(), await getSetting('analytics_collector_hour') || '3')) {
    const { collectReplizMetrics } = await import('./repliz-metrics-collector.js');
    for (const tenantId of await listTenantsWithReplizAccounts()) {
      await tenantContext.run(tenantId, () => collectReplizMetrics({ tenantId }));
    }
  }
```

### 5.6 API baru

**Code Sebelum:** tidak ada endpoint analitik performa (hanya `app/api/v2/analytics/vo-quality`).

**Code Sesudah:**
| Endpoint | Fungsi |
|---|---|
| `GET /api/v2/analytics/accounts?from=&to=&brand=` | Ringkasan per akun/brand per rentang tanggal + pembanding periode sebelumnya |
| `GET /api/v2/analytics/posts?from=&to=&brand=&kind=` | Baris `v_post_performance` + skor (5.8) |
| `POST /api/v2/analytics/collect` | Jalankan pengambil manual untuk tenant aktif (`{ dryRun, accountId? }`), untuk uji & tombol "Ambil sekarang" |
| `GET /api/v2/analytics/health` | Daftar akun `needs_reconnect`, waktu ambil terakhir, error terakhir |

Semua endpoint tenant-scoped seperti API v2 lain.

### 5.7 MCP CF Studio

**Code Sebelum:** tidak ada tool performa.

**Code Sesudah:** `cf_get_account_metrics`, `cf_get_post_metrics` (memanggil API 5.6), dan `cf_collect_metrics_now`. Deskripsi tool menyebut: angka bisa null, jangan ditebak.

### 5.8 Skor (dihitung di API, bukan di DB)

| Platform | `engagement_score` | `click_rate` |
|---|---|---|
| facebook | `(reactions + 2·comments + 3·shares) / reach` | `clicks / reach` |
| youtube | `view_pct/100 · 0.5 + (likes + 2·comments + 3·shares)/views · 0.5` | – |
| tiktok, instagram | `(likes + 2·comments + 3·shares + 3·saves) / views` (+ `full_watch_rate` atau `1 − skip_rate/100` dilaporkan terpisah) | `clicks / views` bila ada |

Pembagi 0 atau null → skor null. Label `menang`/`lemah` dihitung di skrip CFA (persentil dalam brand × jenis, min 5 video).

### 5.9 Penanda reconnect di UI Publishing

**Code Sebelum:** halaman akun Publishing menampilkan status koneksi dari `recordPublishingAccountHealth`.

**Code Sesudah:** badge kecil **"Insight off, perlu reconnect di Repliz"** bila `insights_status = 'needs_reconnect'`, dengan teks bantuan singkat. Semantic token sesuai SOP. Perubahan kecil ini cukup ditunjukkan di mockup Fase 5 bersama halaman Performa.

### 5.10 CFA (dikerjakan Claude, di luar codebase web app)

- `~/cf-autopipeline/bin/cfa_api.py`: helper `metrik_akun()`, `metrik_posting()`.
- `~/cf-autopipeline/bin/cfa_analitik.py`: tarik pekan lalu (Senin–Minggu WIB), gabung dengan item CFA (jalur, jenis, topik, sudut, hook, produk), hitung persentil & pola, tulis `analitik/minggu-YYYY-WW.json` + HTML laporan.
- Skill `~/.claude/skills/cfa-analitik/SKILL.md`: baca JSON, tulis temuan + rencana 70/20/10, simpan draft lewat `antrean.py rencana-minggu`.
- `antrean.py`: perintah `rencana-minggu <file>` (simpan draft, tidak menjalankan).

---

## 6. Pengujian

| Uji | Lulus bila |
|---|---|
| Unit `repliz-metrics-normalizer` dengan contoh respons dari dokumentasi (facebook dengan/ tanpa insight, youtube, tiktok, instagram reels, threads) | Kolom terisi benar, `insight_available` benar, tidak ada NaN |
| Unit penentuan tag snapshot (umur 19, 24, 70, 100, 170, 210 jam) | Tag tepat, tidak dobel |
| Integrasi `POST /api/v2/analytics/collect {dryRun:true}` di Dev | Mengembalikan jumlah akun & posting tanpa menulis DB |
| Integrasi tulis di Dev (schema `dev`) untuk 1 tenant | Baris masuk, upsert tidak dobel saat dijalankan 2×, posting cocok dengan `publishing_jobs` |
| Akun Facebook belum reconnect | `insights_status = needs_reconnect`, angka like/comment/share tetap tersimpan |
| Statik | Tidak ada kunci/secret di kode, test, log. `grep -rn "repliz_secret" app lib tests` hanya pada pembacaan setting |

---

## Execution Task List

### Fase 0: Uji baca API (wajib lapor)
- [ ] Skrip `scripts/test-repliz-analytics-readonly.mjs` (kunci dari `tenant_settings`/env, tidak dicetak)
- [ ] Panggil statistik akun untuk 1 halaman Facebook per tenant aktif, catat apakah `summary` terisi
- [ ] Ambil 3 `publishing_jobs` published terbaru, panggil statistik posting dengan `external_post_id`, catat apakah cocok (bukan 404) dan apakah `insight` terisi
- [ ] Panggil `GET /public/content` 1 halaman, bandingkan format `id` dengan `external_post_id`
- [ ] Lapor ke pengguna: daftar halaman yang **perlu reconnect**, kecocokan ID, contoh angka. **Berhenti bila ID tidak cocok**

### Fase 1: Fondasi data
- [ ] Fungsi baru di `lib/repliz-client.js`
- [ ] `lib/repliz-metrics-normalizer.js` + unit test
- [ ] Migrasi tabel `account_metric_daily`, `post_metric_snapshots`, kolom `publishing_accounts.insights_*`
- [ ] Daftarkan tabel baru di isolasi tenant

### Fase 2: Pengambil harian
- [ ] `lib/repliz-metrics-collector.js` (akun + posting CF Studio + opsional posting luar)
- [ ] Blok scheduler harian dengan saklar `analytics_collector_active` (default off) & jam `analytics_collector_hour`
- [ ] `POST /api/v2/analytics/collect` (dryRun & tulis)
- [ ] Uji di Dev: jalankan 2×, cek tidak dobel

### Fase 3: API & MCP baca
- [ ] `GET /api/v2/analytics/accounts`, `/posts`, `/health` + skor 5.8
- [ ] View/kueri `v_post_performance`
- [ ] Tool MCP `cf_get_account_metrics`, `cf_get_post_metrics`, `cf_collect_metrics_now`

### Fase 4: Isi data awal
- [ ] Di Staging: jalankan collect manual sekali untuk semua tenant (statistik akun 28 hari + posting 8 hari terakhir)
- [ ] Laporkan jumlah baris & akun `needs_reconnect` ke pengguna

### Fase 5: UI (GERBANG MOCKUP)
- [ ] `public/mockup_analitik_performa.html`: halaman Performa (ringkasan per brand, tabel video + skor, filter pekan/brand/jenis) + badge reconnect di Publishing
- [ ] Deploy Staging, kirim link, **STOP**, tunggu persetujuan
- [ ] Implementasi halaman sesuai mockup yang disetujui (semantic token, light/dark)

### Fase 6: CFA (Claude)
- [ ] Helper `cfa_api.py`, skrip `cfa_analitik.py` + HTML laporan
- [ ] Skill `cfa-analitik` + `antrean.py rencana-minggu`
- [ ] Uji kering dengan data Staging pekan 46

### Fase 7: Rilis
- [ ] Semua unit test lulus
- [ ] `npm run release-non-interactive -- --type minor --title "Analitik Performa Repliz" --points "..."`
- [ ] Deploy Staging atomic + verifikasi wajib (current, manifest, HTTP 200, PM2, pm_cwd, PG_SEARCH_PATH, PGPOOL_MAX)
- [ ] Pengguna menyalakan `analytics_collector_active` di Staging setelah review
