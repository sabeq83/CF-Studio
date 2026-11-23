# Implementation Plan: Alat MCP `cf_start_deconstruct`

Referensi: `/Users/sabeqmmursyid/cf-autopipeline/rencana-mcp-start-deconstruct/proposal.md` dan `ANTIGRAVITY_INSTRUCTIONS.md`.
Branch target: `fitur/mcp-start-deconstruct` (dibuat dari `main`).

## Execution Task List

- [x] 1. Tambahkan registrasi alat `cf_start_deconstruct` di `apps/mcp/tools.mjs` tepat setelah `cf_get_deconstruct_status`
- [x] 2. Perbarui katalog alat di `apps/mcp/README.md` (61 -> 62 Tools + entri di Pillar 4 dengan peringatan kuota Gemini)
- [x] 3. Tambahkan assertion `cf_start_deconstruct` di `apps/mcp/test/mcp.test.mjs`
- [x] 4. Tambahkan 10 kasus uji paritas `cf_start_deconstruct` di `tests/test-mcp-tools-parity.test.js`
- [x] 5. Jalankan `npm test --prefix apps/mcp` dan `node --test tests/test-mcp-tools-parity.test.js`
- [x] 6. Commit dan push branch `fitur/mcp-start-deconstruct` (tanpa `npm run release`)
- [x] 7. Deploy atomic branch ke server Dev (`5020/7020`)
- [x] 8. Verifikasi nyata melalui `npm run mcp:stdio` ke API Dev + cek versi `yt-dlp` di Mac Mini

---

## Rencana Perubahan Kode (Sebelum & Sesudah)

### 1. `apps/mcp/tools.mjs`

**Code Sebelum (Current/Before):**
```js
  register(
    'cf_get_deconstruct_status',
    'Check processing progress and extracted assets of a viral deconstruction batch.',
    {
      batch_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ batch_id }) => request(`/api/v2/deconstruct/${encodeURIComponent(batch_id)}`)
  );

  register(
    'cf_list_multiplier_tasks',
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_get_deconstruct_status',
    'Check processing progress and extracted assets of a viral deconstruction batch.',
    {
      batch_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ batch_id }) => request(`/api/v2/deconstruct/${encodeURIComponent(batch_id)}`)
  );

  register(
    'cf_start_deconstruct',
    'Start AI deconstruction (download, Gemini video analysis, blueprint extraction) for videos already registered with cf_ingest_viral_video (status "saved" or "failed"). Uses Gemini quota. Max 50 assets per call; already-processed or in-progress assets are skipped. Returns batch_id; track it with cf_get_deconstruct_status.',
    {
      asset_ids: z.array(z.string().trim().min(1).max(128)).min(1).max(50)
    },
    false,
    async ({ asset_ids }) => {
      const ids = [...new Set(asset_ids)];
      const eligible = [];
      const skipped = [];
      const notFound = [];

      for (const id of ids) {
        const res = await request(`/api/v2/deconstruct/assets/${encodeURIComponent(id)}`);
        if (res?.success === false) {
          if (res.status === 404) {
            notFound.push(id);
            continue;
          }
          return res;
        }
        const status = res?.asset?.status || 'unknown';
        if (status === 'saved' || status === 'failed') eligible.push(id);
        else skipped.push({ id, status });
      }

      const warnings = [];
      const scheduler = await request('/api/v2/deconstruct/scheduler-control');
      if (scheduler?.success !== false && scheduler?.isSchedulerActive === false) {
        warnings.push('Deconstruct scheduler is inactive; queued assets will not be processed until it is re-enabled.');
      }

      if (eligible.length === 0) {
        return {
          success: true,
          batch_id: null,
          enqueued_count: 0,
          enqueued_ids: [],
          skipped,
          not_found: notFound,
          warnings,
          message: 'No asset has status "saved" or "failed"; nothing was queued.'
        };
      }

      const started = await request('/api/v2/deconstruct/process', { body: { asset_ids: eligible } });
      if (started?.success === false) return started;

      return {
        success: true,
        batch_id: started.batch_id,
        enqueued_count: eligible.length,
        enqueued_ids: eligible,
        skipped,
        not_found: notFound,
        warnings,
        next_step: 'Track progress with cf_get_deconstruct_status using batch_id.'
      };
    }
  );

  register(
    'cf_list_multiplier_tasks',
```

### 2. `apps/mcp/README.md`

**Code Sebelum (Current/Before):**
```markdown
## 3. Registered Tools Catalog (61 Tools across 7 Studio Pillars)
...
### G. Pillar 4: Viral Research & Multiplier Lab (Deconstruction Engine)
- `cf_ingest_viral_video`: Ingest viral video URL into Deconstruct Lab for AI pattern extraction.
- `cf_list_deconstructed_assets`: Search finished deconstructed viral video blueprints.
```

**Code Sesudah (Proposed/After):**
```markdown
## 3. Registered Tools Catalog (62 Tools across 7 Studio Pillars)
...
### G. Pillar 4: Viral Research & Multiplier Lab (Deconstruction Engine)
- `cf_ingest_viral_video`: Ingest viral video URL into Deconstruct Lab for AI pattern extraction.
- `cf_start_deconstruct`: Start AI deconstruction (download, Gemini analysis, blueprint extraction) for ingested assets with status `saved` or `failed` (max 50 per call; uses Gemini quota — avoid mass runs).
- `cf_list_deconstructed_assets`: Search finished deconstructed viral video blueprints.
```

### 3. `apps/mcp/test/mcp.test.mjs`

**Code Sebelum (Current/Before):**
```js
  // Pilar 4: Viral Deconstruction
  assert.ok(toolNames.has('cf_ingest_viral_video'));
  assert.ok(toolNames.has('cf_list_deconstructed_assets'));
  assert.ok(toolNames.has('cf_search_blueprints'));
  assert.ok(toolNames.has('cf_get_deconstructed_blueprint'));
```

**Code Sesudah (Proposed/After):**
```js
  // Pilar 4: Viral Deconstruction
  assert.ok(toolNames.has('cf_ingest_viral_video'));
  assert.ok(toolNames.has('cf_start_deconstruct'));
  assert.ok(toolNames.has('cf_list_deconstructed_assets'));
  assert.ok(toolNames.has('cf_search_blueprints'));
  assert.ok(toolNames.has('cf_get_deconstructed_blueprint'));
```

### 4. `tests/test-mcp-tools-parity.test.js`

**Code Sebelum (Current/Before):**
```js
    const batchCall = calls[1];
    assert.equal(batchCall.opts.body.pipeline_type, 'custom_storyboard');
    assert.equal(batchCall.opts.body.preset_key, 'nutribake_kampanye_produk_02');
    assert.equal(batchCall.opts.body.brand_id, 'brd_1');
    assert.equal(batchCall.opts.body.items.length, 1);
  } finally {
    await close();
  }
});
```

**Code Sesudah (Proposed/After):**
Menambahkan suite uji `7. cf_start_deconstruct ...` (10 kasus uji sesuai `proposal.md` bagian 4) di akhir file `tests/test-mcp-tools-parity.test.js` memakai `setupTestMcpClient(handler)`.
