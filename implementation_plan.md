# Rencana Implementasi: 4 Celah CF Studio untuk CF Autopipeline (CFA)

Berdasarkan dokumen serah terima [HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md](file:///Users/sabeqmmursyid/_cfstudio/HANDOFF_ANTIGRAVITY_4_CELAH_MCP_PUBLISH.md).

---

## Ringkasan Perubahan

| # | Celah | Solusi Teknis |
|---|---|---|
| 1 | **Judul per platform (`platform_titles`)** | Tambahkan `cleanTitle` & `normalizePlatformTitles` di `lib/publishing-contract.js`, terapkan pemilihan judul per platform di `lib/publishing-service.js`, dan perluas skema MCP `cf_create_publishing_job` & `cf_publish_storyboard` di `apps/mcp/tools.mjs`. |
| 2 | **Mode ringkas `cf_get_storyboard_status`** | Ubah `fetchPillarStoryboardSummary` di `apps/mcp/tools.mjs` agar default tanpa `items` mentah (`item_count`), sertakan `error_message` dan `generation_error` pada `stages`, tambahkan argumen `include_items`, dan sesuaikan pemanggil yang membutuhkan items. |
| 3 | **Filter pada daftar preset & VI** | Tambahkan parameter `brand`, `query`, dan `detail` (default `false` / ringkas) pada `cf_list_presets`, `makna_list_presets`, dan `cf_list_visual_identities` di `apps/mcp/tools.mjs`. |
| 4 | **Membatalkan Custom Storyboard (`cst_*`)** | Tambahkan status `'cancelled'` pada PATCH `/api/v2/pillar-campaigns/[id]`, hentikan proses di worker/scheduler sebelum tahap pemakaian kuota (Gemini, Start Frame, TTS, G-Labs, FFmpeg), dan daftarkan tool MCP baru `cf_cancel_storyboard`. |

---

## Execution Task List
- [x] Task 1: Implementasi Celah 1 (Judul per Platform `platform_titles`)
  - [x] 1.1 Update `lib/publishing-contract.js` (tambah `cleanTitle`, `normalizePlatformTitles`, validasi `platform_titles`)
  - [x] 1.2 Update `lib/publishing-service.js` (pilih `selectedTitle` berdasarkan target platform)
  - [x] 1.3 Update `apps/mcp/tools.mjs` (skema dan forwarding `platform_titles` di `cf_create_publishing_job` dan `cf_publish_storyboard`)
- [x] Task 2: Implementasi Celah 2 (Mode Ringkas & Error Reporting `cf_get_storyboard_status`)
  - [x] 2.1 Update `fetchPillarStoryboardSummary` dengan opsi `{ includeItems = false }`, `item_count`, dan error fields di `stages`
  - [x] 2.2 Update skema dan handler `cf_get_storyboard_status` dengan parameter `include_items`
  - [x] 2.3 Pastikan pemanggil lain yang butuh items (`cf_approve_job`) mengirim `{ includeItems: true }`
- [x] Task 3: Implementasi Celah 3 (Filter Brand/Query & Output Ringkas Preset & Visual Identity)
  - [x] 3.1 Update `cf_list_presets` dan `makna_list_presets` di `apps/mcp/tools.mjs`
  - [x] 3.2 Update `cf_list_visual_identities` di `apps/mcp/tools.mjs`
- [x] Task 4: Implementasi Celah 4 (Pembatalan Custom Storyboard `cst_*`)
  - [x] 4.1 Update PATCH di `app/api/v2/pillar-campaigns/[id]/route.js` untuk menerima `'cancelled'` dan membatalkan item / aset yang belum selesai
  - [x] 4.2 Tambahkan guard status (`paused` / `cancelled`) di `lib/scheduler-processors.js` (`processPillarGenerator`, `processPillarTts`, `processPillarGlabs`, `processPillarFfmpeg`)
  - [x] 4.3 Tambahkan guard status di `lib/start-frame-worker.js` sebelum submit provider task
  - [x] 4.4 Daftarkan tool MCP `cf_cancel_storyboard` di `apps/mcp/tools.mjs`
- [x] Task 5: Pengujian & Verifikasi Komprehensif
  - [x] 5.1 Buat unit test mandiri `tests/test-4-celah-mcp-publish.test.mjs` untuk menguji ke-4 celah
  - [x] 5.2 Jalankan unit test dan periksa kelulusan
  - [x] 5.3 Jalankan `npm run build` untuk memastikan tidak ada kesalahan kompilasi
- [x] Task 6: SOP Rilis & Auto Git Sync (Non-Interactive Release)
  - [x] 6.1 Jalankan `npm run release-non-interactive` dengan versi patch
  - [x] 6.2 Verifikasi commit, tag, changelog, dan push remote
- [x] Task 7: SOP Deployment Mac Mini Staging
  - [x] 7.1 Deploy ke staging dengan atomic deployment (`npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`)
  - [x] 7.2 Verifikasi kesehatan layanan staging (UI port 5010 & API port 7010)

---

## Detailed Before & After Code Snippets

### 1. `lib/publishing-contract.js`

#### Code Sebelum (Current/Before):
```js
    title: String(title || '').trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100),
    caption: String(caption || '').trim(),
    media_url: String(media_url || '').trim(),
    caption_facebook: input.caption_facebook ? String(input.caption_facebook).trim() : null,
    caption_bio: input.caption_bio ? String(input.caption_bio).trim() : null,
    platform_captions: (input.platform_captions && typeof input.platform_captions === 'object') ? input.platform_captions : null,
```

#### Code Sesudah (Proposed/After):
```js
function cleanTitle(t) {
  return String(t || '').trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100);
}

function normalizePlatformTitles(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [platform, value] of Object.entries(raw)) {
    const t = cleanTitle(value);
    if (t) out[String(platform).toLowerCase()] = t;
  }
  return Object.keys(out).length ? out : null;
}

...
    title: cleanTitle(title),
    caption: String(caption || '').trim(),
    media_url: String(media_url || '').trim(),
    caption_facebook: input.caption_facebook ? String(input.caption_facebook).trim() : null,
    caption_bio: input.caption_bio ? String(input.caption_bio).trim() : null,
    platform_captions: (input.platform_captions && typeof input.platform_captions === 'object') ? input.platform_captions : null,
    platform_titles: normalizePlatformTitles(input.platform_titles),
```

---

### 2. `lib/publishing-service.js`

#### Code Sebelum (Current/Before):
```js
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
```

#### Code Sesudah (Proposed/After):
```js
    const selectedTitle = validated.platform_titles?.[platform] || validated.title;

    return {
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      title: selectedTitle,
      caption: selectedCaption,
      mediaUrl: validated.media_url,
      scheduledAt: validated.schedules?.[accId] || validated.scheduled_at,
      approvalStatus: 'not_required',
      isAiGenerated: !!validated.is_ai_generated
    };
```

---

### 3. `apps/mcp/tools.mjs` (Celah 1, 2, 3, 4)

#### Code Sebelum (Current/Before) — `fetchPillarStoryboardSummary`:
```js
async function fetchPillarStoryboardSummary(request, campaignId) {
  const detail = await request(`/api/v2/pillar-campaigns/${encodeURIComponent(campaignId)}`);
  if (!detail || detail.success === false) return detail;
  const campaign = detail.campaign || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const primaryItem = items[0] || null;
  let contentFlowItem = null;
  if (primaryItem?.id) {
    const cfSearch = await request(`/api/content-flow?q=${encodeURIComponent(`opc_${primaryItem.id}`)}`);
    const rows = Array.isArray(cfSearch?.items) ? cfSearch.items : (Array.isArray(cfSearch?.data) ? cfSearch.data : []);
    contentFlowItem = rows.find(r => r.id === `opc_${primaryItem.id}` || String(r.source_item_id) === String(primaryItem.id)) || rows[0] || null;
  }
  return {
    success: true,
    campaign_id: campaign.id || campaignId,
    campaign_name: campaign.campaign_name,
    status: campaign.status,
    execution_mode: campaign.execution_mode,
    approval_mode: campaign.approval_mode,
    target_product_id: campaign.target_product_id || null,
    product_ref_image_path: campaign.product_ref_image_path || null,
    voice_provider: campaign.voice_provider,
    voice_persona: campaign.voice_persona,
    auto_sync_contentflow: Boolean(campaign.auto_sync_contentflow),
    item_id: primaryItem?.id || null,
    workflow_status: primaryItem?.workflow_status || null,
    review_state: primaryItem?.review_state || null,
    review_revision: primaryItem?.review_revision ?? null,
    stages: primaryItem ? {
      generation_status: primaryItem.generation_status,
      start_frame_status: primaryItem.start_frame_status,
      tts_status: primaryItem.tts_status,
      visual_status: primaryItem.visual_status,
      ffmpeg_status: primaryItem.ffmpeg_status,
      upload_status: primaryItem.upload_status
    } : null,
    output: primaryItem ? {
      ffmpeg_output_path: primaryItem.ffmpeg_output_path || null,
      drive_link: primaryItem.drive_link || null,
      nextcloud_url: primaryItem.nextcloud_url || null
    } : null,
    content_flow_item_id: contentFlowItem?.id || null,
    content_flow_video_id: contentFlowItem?.video_id || null,
    content_flow_url_asset: contentFlowItem?.url_asset || null,
    items,
    stats: detail.stats || null
  };
}
```

#### Code Sesudah (Proposed/After) — `fetchPillarStoryboardSummary`:
```js
async function fetchPillarStoryboardSummary(request, campaignId, { includeItems = false } = {}) {
  const detail = await request(`/api/v2/pillar-campaigns/${encodeURIComponent(campaignId)}`);
  if (!detail || detail.success === false) return detail;
  const campaign = detail.campaign || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const primaryItem = items[0] || null;
  let contentFlowItem = null;
  if (primaryItem?.id) {
    const cfSearch = await request(`/api/content-flow?q=${encodeURIComponent(`opc_${primaryItem.id}`)}`);
    const rows = Array.isArray(cfSearch?.items) ? cfSearch.items : (Array.isArray(cfSearch?.data) ? cfSearch.data : []);
    contentFlowItem = rows.find(r => r.id === `opc_${primaryItem.id}` || String(r.source_item_id) === String(primaryItem.id)) || rows[0] || null;
  }
  const errorMessage = primaryItem?.error_message || primaryItem?.review_reason || primaryItem?.contentflow_error || null;
  const generationError = primaryItem?.generation_error || (primaryItem?.generation_status === 'failed' ? (primaryItem?.review_reason || 'Generation failed') : null);

  return {
    success: true,
    campaign_id: campaign.id || campaignId,
    campaign_name: campaign.campaign_name,
    status: campaign.status,
    execution_mode: campaign.execution_mode,
    approval_mode: campaign.approval_mode,
    target_product_id: campaign.target_product_id || null,
    product_ref_image_path: campaign.product_ref_image_path || null,
    voice_provider: campaign.voice_provider,
    voice_persona: campaign.voice_persona,
    auto_sync_contentflow: Boolean(campaign.auto_sync_contentflow),
    item_id: primaryItem?.id || null,
    workflow_status: primaryItem?.workflow_status || null,
    review_state: primaryItem?.review_state || null,
    review_revision: primaryItem?.review_revision ?? null,
    stages: primaryItem ? {
      generation_status: primaryItem.generation_status,
      start_frame_status: primaryItem.start_frame_status,
      tts_status: primaryItem.tts_status,
      visual_status: primaryItem.visual_status,
      ffmpeg_status: primaryItem.ffmpeg_status,
      upload_status: primaryItem.upload_status,
      error_message: errorMessage,
      generation_error: generationError
    } : null,
    output: primaryItem ? {
      ffmpeg_output_path: primaryItem.ffmpeg_output_path || null,
      drive_link: primaryItem.drive_link || null,
      nextcloud_url: primaryItem.nextcloud_url || null
    } : null,
    content_flow_item_id: contentFlowItem?.id || null,
    content_flow_video_id: contentFlowItem?.video_id || null,
    content_flow_url_asset: contentFlowItem?.url_asset || null,
    ...(includeItems ? { items } : { item_count: items.length }),
    stats: detail.stats || null
  };
}
```

---

### 4. `app/api/v2/pillar-campaigns/[id]/route.js` (Celah 4)

#### Code Sebelum (Current/Before):
```js
    const updates = {};
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft'].includes(body.status)) {
      updates.status = body.status;
    }
```

#### Code Sesudah (Proposed/After):
```js
    const updates = {};
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft', 'cancelled'].includes(body.status)) {
      updates.status = body.status;
    }
    ...
    const campaign = await getPillarCampaign(id);
    await updatePillarCampaign(id, updates);

    if (updates.status === 'cancelled') {
      const db = getDb();
      await db.prepare(`
        UPDATE pillar_campaign_items
        SET workflow_status = 'cancelled'
        WHERE campaign_id = ? AND workflow_status NOT IN ('completed', 'failed')
      `).run(id);
      const { pgQuery } = await import('../../../../../lib/db-pg');
      await pgQuery(`
        UPDATE pillar_campaign_item_assets
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE campaign_id = $1 AND status IN ('queued', 'waiting_lane', 'retry_wait')
      `, [id]).catch(() => {});
    }
```
