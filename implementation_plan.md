# Rencana Implementasi: Mode `shared_staggered` untuk Generasi Start Frame Berfoto Produk

**Branch:** `fitur/shared-staggered-start-frame`
**Basis Spesifikasi:** `/Users/sabeqmmursyid/cf-autopipeline/rencana-implementasi-shared-staggered-start-frame.md`

## Execution Task List

- [x] **Tahap 1 — Shared Settings Helper & Migrasi DB (`lib/product-ref-lane-settings.js`, `lib/db-pg.js`)**: Tambah helper validasi/normalisasi `webhook_product_ref_lane_mode` dan `webhook_product_ref_stagger_sec` serta tabel `glabs_image_lane_submit_gates`.
- [x] **Tahap 2 — Submit Stagger Gate & Webhook `skipDelay` (`lib/glabs-image-lane-service.js`, `lib/webhook-client.js`)**: Tambah `reserveGlabsSubmitSlot` dan `waitAndReserveGlabsSubmitSlot` berbasis `pg_advisory_xact_lock`, serta opsi `skipDelay` pada `generateImage`.
- [x] **Tahap 3 — Durable Start Frame Worker (`lib/start-frame-provider-adapter.js`, `lib/start-frame-worker.js`, `lib/pillar-start-frame-service.js`)**: Dukung mode `shared_staggered` pada adapter, penjadwalan `nextAllowedAt` + limit klaim 12 di worker, dan klaim sibling `provider_processing` paralel.
- [x] **Tahap 4 — OPC Autopilot & Multiplier Runners (`lib/scheduler-processors.js`, `lib/t2i-staggered-runner.js`, `lib/re-multiplier-worker.js`, `app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`)**: Tambah `executeStaggeredBatch` di OPC dan `runStaggeredT2iBatch` bersama di dua jalur Multiplier.
- [x] **Tahap 5 — Settings API & UI (`app/api/settings/route.js`, `app/settings/page.js`)**: Expose & validasi `webhook_product_ref_lane_mode` + `webhook_product_ref_stagger_sec`, serta tambah kontrol UI di kartu G-Labs Webhook Settings.
- [x] **Tahap 6 — Pengujian Otomatis & Build Lokal (`tests/glabs-image-lane-service.test.js`, `tests/start-frame-shared-staggered.test.js`)**: Tambah unit test, jalankan test dengan `PG_SEARCH_PATH=dev`, dan verifikasi `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`.
- [x] **Tahap 7 — Git Push & Deploy ke Server Dev**: Commit & push branch `fitur/shared-staggered-start-frame`, lalu deploy ke Mac Mini Dev via `npm run deploy:dev:atomic` dan verifikasi UI/API/PM2.

---

## Ringkasan Perubahan (Before & After)

### 1. `lib/db-pg.js`
**Code Sebelum (Current/Before):**
```sql
CREATE INDEX IF NOT EXISTS glabs_image_lane_active_idx ON glabs_image_lane_leases (lane_key, status, lease_expires_at);
CREATE INDEX IF NOT EXISTS glabs_image_lane_waiter_idx ON glabs_image_lane_leases (lane_key, status, requested_at);
```
**Code Sesudah (Proposed/After):**
```sql
CREATE INDEX IF NOT EXISTS glabs_image_lane_active_idx ON glabs_image_lane_leases (lane_key, status, lease_expires_at);
CREATE INDEX IF NOT EXISTS glabs_image_lane_waiter_idx ON glabs_image_lane_leases (lane_key, status, requested_at);

CREATE TABLE IF NOT EXISTS glabs_image_lane_submit_gates (
  lane_key TEXT PRIMARY KEY,
  last_submit_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `lib/glabs-image-lane-service.js`
**Code Sebelum (Current/Before):**
Hanya memiliki `requestImageLane`, `tryAcquireImageLane`, `withGlabsImageLane`, dll. tanpa submit stagger gate.

**Code Sesudah (Proposed/After):**
Menambahkan `reserveGlabsSubmitSlot(laneKey, staggerSeconds = 12)` dan `waitAndReserveGlabsSubmitSlot(laneKey, staggerSeconds = 12, { maxWaitMs = 180000 } = {})` dengan `pg_advisory_xact_lock(hashtext('submit:' || $1))`.

### 3. `lib/webhook-client.js`
**Code Sebelum (Current/Before):**
```js
export async function generateImage({ prompt, model, aspect_ratio, reference_images, expected_reference_sha256s, upscale, webhookOverride }) {
  await applyRandomDelay('image');
```
**Code Sesudah (Proposed/After):**
```js
export async function generateImage({ prompt, model, aspect_ratio, reference_images, expected_reference_sha256s, upscale, webhookOverride, skipDelay = false }) {
  if (!skipDelay) {
    await applyRandomDelay('image');
  }
```

### 4. `lib/start-frame-provider-adapter.js`, `lib/start-frame-worker.js`, `lib/pillar-start-frame-service.js`
**Code Sebelum (Current/Before):**
- `start-frame-provider-adapter.js`: `const laneMode = requiresExclusive ? 'exclusive' : 'shared';`
- `start-frame-worker.js`: `releaseAssetForLaneRetry(asset, leaseId, seconds = 2)` dan loop klaim `index < 6`.
- `pillar-start-frame-service.js`: `sibling.status IN ('processing', 'provider_processing')` untuk semua mode.

**Code Sesudah (Proposed/After):**
- `start-frame-provider-adapter.js`: Saat `requiresProductRef && productRefLaneMode === 'shared_staggered'`, memakai `laneMode = 'shared'`, memanggil `reserveGlabsSubmitSlot(laneKey, staggerSec)`, mengembalikan `waiting_lane` + `nextAllowedAt` jika cooldown belum lewat, dan memanggil `generateImage({ ...built.providerRequest, skipDelay: true })`.
- `start-frame-worker.js`: `releaseAssetForLaneRetry` memakai `COALESCE($2::timestamptz, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'))` dan batas klaim naik menjadi `12`.
- `pillar-start-frame-service.js`: Saat `allowStaggeredProductRef === true`, sibling blocking hanya memeriksa status `'processing'`, memprioritaskan `'provider_processing'` saat klaim.

### 5. `lib/scheduler-processors.js`, `lib/t2i-staggered-runner.js`, `lib/re-multiplier-worker.js`, `app/api/v2/multiplier/[id]/regenerate-start-frames/route.js`
**Code Sebelum (Current/Before):**
- `scheduler-processors.js`: `isolatedReferenceClips` selalu menjalankan `executeSingleClipIsolated` satu per satu.
- `re-multiplier-worker.js` & `regenerate-start-frames/route.js`: loop sekuensial `generateImage` -> poll -> download.

**Code Sesudah (Proposed/After):**
- `scheduler-processors.js`: Menambahkan `executeStaggeredBatch` untuk `isolatedReferenceClips` ketika `webhook_product_ref_lane_mode === 'shared_staggered'` dan `t2iPattern !== 'sequential'`.
- `lib/t2i-staggered-runner.js`: Helper bersama `runStaggeredT2iBatch` dipakai oleh kedua jalur Multiplier saat `webhook_t2i_pattern === 'threading'` dan `webhook_product_ref_lane_mode === 'shared_staggered'`.

### 6. `app/api/settings/route.js` & `app/settings/page.js`
**Code Sebelum (Current/Before):**
Hanya mengembalikan/menyimpan `webhook_t2i_pattern`.

**Code Sesudah (Proposed/After):**
Menambahkan `webhook_product_ref_lane_mode` (`'exclusive' | 'shared_staggered'`) dan `webhook_product_ref_stagger_sec` (`5..60`, default `12`) di `GET`/`POST` `/api/settings` serta form controls di kartu *G-Labs Webhook Settings*.
