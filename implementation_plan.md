# Rencana Implementasi: Ekspansi CF Studio MCP Server (7 Pilar Studio Otomatis)

> [!NOTE]
> Rencana implementasi ini dirancang untuk menyempurnakan dan memperluas arsitektur MCP Server CF Studio (`apps/mcp/`) dari mode *Execution-Only* menjadi *Full-Lifecycle Autonomous Creative Director & Studio Operator* yang dapat mengelola produk, visual identity, strategi preset, riset dekonstruksi, review kreatif, penerbitan media sosial, serta observabilitas sistem secara interaktif melalui chat.

---

## Ringkasan Eksekutif & Ruang Lingkup

Saat ini MCP Server CF Studio memiliki 19 tools (termasuk alias legacy) yang berfokus pada eksekusi Auto Pipeline dan penjadwalan. Untuk memberikan kendali end-to-end melalui chat, kita mengintegrasikan 7 pilar studio ke dalam protokol MCP:

1. **Pilar 1: Database Produk & Knowledge Catalog (Data Engine)**
   - `cf_add_product`: Pendaftaran produk baru manual / spesifikasi.
   - `cf_enrich_product`: Memicu ekstraksi AI untuk USP, pain points, product truth, clean photo prompt.
   - `cf_get_product_detail`: Membaca spesifikasi detail produk dan status fotonya.
   - `cf_update_product`: Memperbarui data produk dan link affiliate.
   - `cf_scrape_product_url`: Mengambil data dan foto produk dari URL marketplace.
2. **Pilar 2: Creative & Visual Identity Studio (Visual DNA Engine)**
   - `cf_generate_visual_identity`: Membuat rancangan visual identity otomatis via AI dari natural language brief.
   - `cf_create_visual_identity`: Menyimpan visual identity terstruktur ke database tenant.
   - `cf_list_visual_identities`: Melihat katalog visual identity aktif (sistem & custom).
   - `cf_get_visual_identity`: Menginspeksi detail rules visual (faceless mode, demographic, lighting, textures).
   - `cf_update_visual_identity`: Menyesuaikan visual identity yang ada.
3. **Pilar 3: Production Presets & Campaign Archetypes (Strategy Engine)**
   - `cf_get_preset_detail`: Membaca detail konfigurasi preset (VO, tempo, clips, visual engine).
   - `cf_create_preset`: Membuat preset baru untuk tenant.
   - `cf_clone_preset`: Meng-clone preset sistem untuk dimodifikasi khusus.
   - `cf_update_preset`: Mengedit preset kustom tenant.
4. **Pilar 4: Viral Research & Multiplier Lab (Deconstruction Engine)**
   - `cf_ingest_viral_video`: Memasukkan URL video viral ke queue Deconstruct Lab.
   - `cf_list_deconstructed_assets`: Mencari blueprint video viral yang telah dibedah.
   - `cf_get_deconstructed_blueprint`: Membaca hook, problem-solution arc, dan storyboard video viral.
5. **Pilar 5: Creative Review & Human-in-the-Loop Co-Pilot**
   - `cf_get_job_review`: Membaca artefak naskah dan storyboard campaign yang pending review.
   - `cf_approve_job`: Menyetujui naskah/storyboard untuk melanjutkan render video.
6. **Pilar 6: Omnichannel Social Publishing**
   - `cf_list_publishing_accounts`: Menampilkan akun media sosial terhubung (Facebook, Instagram, YouTube, Repliz).
   - `cf_create_publishing_job`: Menjadwalkan atau memublikasikan video/post ke akun media sosial.
   - `cf_list_publishing_jobs`: Memantau status postingan media sosial.
7. **Pilar 7: Studio Observability & Cluster Health**
   - `cf_get_cluster_health`: Memeriksa kesehatan 3-node cluster (Mac Mini, Windows Worker 8765, PostgreSQL).
   - `cf_get_studio_stats`: Membaca statistik performa studio dan stok video selesai.

---

## Execution Task List
- [x] **Task 1: Perluas `operatorClient` pada `apps/mcp/tools.mjs`** untuk mendukung metode HTTP `PUT`, `DELETE`, dan respons berformat Markdown / Text.
- [x] **Task 2: Tambahkan Endpoint `GET /api/v2/operator-presets/[key]`** pada backend agar konfigurasi detail suatu preset dapat dibaca langsung oleh MCP tool.
- [x] **Task 3: Daftarkan Tools Pilar 1 (Product & Catalog) pada `apps/mcp/tools.mjs`** (`cf_add_product`, `cf_enrich_product`, `cf_get_product_detail`, `cf_update_product`, `cf_scrape_product_url`).
- [x] **Task 4: Daftarkan Tools Pilar 2 (Visual Identity Studio) pada `apps/mcp/tools.mjs`** (`cf_generate_visual_identity`, `cf_create_visual_identity`, `cf_list_visual_identities`, `cf_get_visual_identity`, `cf_update_visual_identity`).
- [x] **Task 5: Daftarkan Tools Pilar 3 (Production Presets) pada `apps/mcp/tools.mjs`** (`cf_get_preset_detail`, `cf_create_preset`, `cf_clone_preset`, `cf_update_preset`).
- [x] **Task 6: Daftarkan Tools Pilar 4 & 5 (Viral Deconstruct & Creative Review) pada `apps/mcp/tools.mjs`** (`cf_ingest_viral_video`, `cf_list_deconstructed_assets`, `cf_get_deconstructed_blueprint`, `cf_get_job_review`, `cf_approve_job`).
- [x] **Task 7: Daftarkan Tools Pilar 6 & 7 (Publishing & Observability) pada `apps/mcp/tools.mjs`** (`cf_list_publishing_accounts`, `cf_create_publishing_job`, `cf_list_publishing_jobs`, `cf_get_cluster_health`, `cf_get_studio_stats`).
- [x] **Task 8: Perbarui Unit Test Suite `apps/mcp/test/mcp.test.mjs`** untuk memverifikasi pendaftaran seluruh tool baru, validasi input Zod, dan routing endpoint.
- [x] **Task 9: Perbarui Dokumentasi `apps/mcp/README.md` & `instructions.md`** agar selaras dengan kemampuan MCP 7 pilar terbaru.
- [x] **Task 10: Jalankan Verifikasi Uji Otomatis (`npm run test:mcp`), Build Check, dan SOP Rilis Non-Interaktif**.

---

## Before & After Code Snippets

### 1. `apps/mcp/tools.mjs` — Dukungan HTTP Method & Parsing Response pada `operatorClient`

#### Code Sebelum (Current/Before):
```javascript
export function operatorClient({ baseUrl, token, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid Operator base URL');
  }
  if (base.protocol !== 'https:' && !isLocalOrPrivateHost(base.hostname)) {
    throw new Error('Remote Operator API requires HTTPS');
  }
  if (!token) throw new Error('CF_STUDIO_OPERATOR_API_TOKEN is required');
  return async (path, { body, key } = {}) => {
    try {
      const response = await fetchImpl(new URL(path, base), {
        method: body ? 'POST' : 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        return { success: false, status: response.status, error: 'Operator request rejected; check permissions, input, or job ID.' };
      }
      return await response.json();
    } catch {
      return { success: false, error: 'Operator API unavailable. For creation, retry with the SAME idempotency_key and identical brief.' };
    }
  };
}
```

#### Code Sesudah (Proposed/After):
```javascript
export function operatorClient({ baseUrl, token, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid Operator base URL');
  }
  if (base.protocol !== 'https:' && !isLocalOrPrivateHost(base.hostname)) {
    throw new Error('Remote Operator API requires HTTPS');
  }
  if (!token) throw new Error('CF_STUDIO_OPERATOR_API_TOKEN is required');
  return async (path, { body, key, method } = {}) => {
    try {
      const httpMethod = method || (body ? 'POST' : 'GET');
      const response = await fetchImpl(new URL(path, base), {
        method: httpMethod,
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        return { success: false, status: response.status, error: 'Operator request rejected; check permissions, input, or job ID.' };
      }
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
        const text = await response.text();
        return { success: true, markdown: text };
      }
      return await response.json();
    } catch {
      return { success: false, error: 'Operator API unavailable. For creation, retry with the SAME idempotency_key and identical brief.' };
    }
  };
}
```

---

### 2. `app/api/v2/operator-presets/[key]/route.js` — Penambahan Handler `GET` Preset Detail

#### Code Sebelum (Current/Before):
```javascript
export const dynamic = 'force-dynamic';

function requireAdmin(user) {
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    const e = new Error('Hanya Admin tenant yang dapat mengelola preset.');
    e.status = 403;
    throw e;
  }
  return user;
}

export const PUT = withTenantContext(async (request, { params }, user) => {
```

#### Code Sesudah (Proposed/After):
```javascript
export const dynamic = 'force-dynamic';

function requireAdmin(user) {
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    const e = new Error('Hanya Admin tenant yang dapat mengelola preset.');
    e.status = 403;
    throw e;
  }
  return user;
}

export const GET = withTenantContext(async (_request, { params }, user) => {
  const tenantPresets = getSetting('operator_presets_json', false) || '{}';
  hydrateOperatorPresetCache(user.tenantId, tenantPresets);
  const { key } = await params;
  const all = listOperatorPresets(user.tenantId);
  const preset = all[key];
  if (!preset) {
    return NextResponse.json({ success: false, error: 'Preset tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, key, preset });
});

export const PUT = withTenantContext(async (request, { params }, user) => {
```

---

### 3. `apps/mcp/tools.mjs` — Registrasi Tools Baru (Contoh Pilar 1, 2, 3)

#### Code Sebelum (Current/Before):
```javascript
  // 4. Schedule Management Tools
  register(
    'cf_list_schedules',
    'List recurring Auto Pipeline schedules in the tenant with their status and execution metrics.',
    ...
  );

  return server;
}
```

#### Code Sesudah (Proposed/After):
```javascript
  // 4. Schedule Management Tools
  register(
    'cf_list_schedules',
    ...
  );

  // 5. Product Database Tools (Pilar 1)
  register('cf_add_product', 'Register a new product in the tenant catalog.', {
    product_name: z.string().trim().min(1).max(300),
    product_description: z.string().max(12000).optional(),
    category: z.string().max(100).optional(),
    unique_selling_point: z.string().max(2000).optional(),
    tags: z.string().max(500).optional(),
    affiliate_link: z.string().max(1000).optional(),
    source_url: z.string().max(1000).optional(),
    packaging_type: z.string().max(100).optional()
  }, false, args => request('/api/v2/products', { body: args }));

  register('cf_enrich_product', 'Trigger AI enrichment for product USP, truths, and clean photo prompt.', {
    product_id: z.string().min(1).max(128)
  }, false, ({ product_id }) => request('/api/v2/products/re-enrich', { body: { ids: [product_id] } }));

  register('cf_get_product_detail', 'Retrieve full product details and extraction metadata.', {
    product_id: z.string().min(1).max(128)
  }, true, ({ product_id }) => request(`/api/v2/products/${encodeURIComponent(product_id)}`));

  register('cf_update_product', 'Update existing product information in the catalog.', {
    product_id: z.string().min(1).max(128),
    updates: z.record(z.any())
  }, false, ({ product_id, updates }) => request(`/api/v2/products/${encodeURIComponent(product_id)}`, { method: 'PUT', body: updates }));

  register('cf_scrape_product_url', 'Scrape product specs and images from an e-commerce URL.', {
    url: z.string().url(),
    category: z.string().max(100).optional(),
    tags: z.string().max(500).optional()
  }, false, ({ url, ...args }) => request('/api/v2/products/scrape', { body: { urls: url, ...args } }));

  // 6. Visual Identity Tools (Pilar 2)
  register('cf_generate_visual_identity', 'Generate an AI Visual Identity draft from a creative brief.', {
    seed: z.string().trim().min(1).max(1000),
    demographic_key: z.string().max(100).optional(),
    setting: z.string().max(300).optional(),
    mood: z.string().max(300).optional(),
    visual_style: z.string().max(100).optional(),
    color_palette: z.string().max(300).optional()
  }, false, args => request('/api/v2/visual-identities/ai/generate', { body: args }));

  register('cf_create_visual_identity', 'Register a structured Visual Identity preset.', {
    label: z.string().trim().min(1).max(200),
    preset_key: z.string().max(100).optional(),
    description: z.string().max(1000).optional(),
    config: z.record(z.any())
  }, false, args => request('/api/v2/visual-identities', { body: args }));

  register('cf_list_visual_identities', 'List available active Visual Identity presets.', {
    status: z.enum(['active', 'all', 'archived']).default('active')
  }, true, args => request(`/api/v2/visual-identities?${new URLSearchParams(args)}`));

  register('cf_get_visual_identity', 'Get detailed configuration of a Visual Identity preset.', {
    id_or_key: z.string().min(1).max(128)
  }, true, ({ id_or_key }) => request(`/api/v2/visual-identities/${encodeURIComponent(id_or_key)}`));

  register('cf_update_visual_identity', 'Update an existing custom Visual Identity preset.', {
    id: z.string().min(1).max(128),
    label: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    config: z.record(z.any())
  }, false, ({ id, ...args }) => request(`/api/v2/visual-identities/${encodeURIComponent(id)}`, { method: 'PUT', body: args }));

  // 7. Production Presets (Pilar 3)
  register('cf_get_preset_detail', 'Get full strategy configuration of an operator preset.', {
    preset_key: z.string().min(1).max(128)
  }, true, ({ preset_key }) => request(`/api/v2/operator-presets/${encodeURIComponent(preset_key)}`));

  register('cf_create_preset', 'Create a new custom operator preset.', {
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
    label: z.string().trim().min(1).max(200),
    config: z.record(z.any())
  }, false, args => request('/api/v2/operator-presets', { body: args }));

  register('cf_clone_preset', 'Clone an existing preset with strategic modifications.', {
    source_key: z.string().min(1).max(128),
    new_key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
    new_label: z.string().trim().min(1).max(200),
    overrides: z.record(z.any()).optional()
  }, false, async ({ source_key, new_key, new_label, overrides = {} }) => {
    const existing = await request(`/api/v2/operator-presets/${encodeURIComponent(source_key)}`);
    if (!existing || !existing.success) return { success: false, error: 'Source preset not found' };
    const mergedConfig = { ...existing.preset, ...overrides, label: new_label };
    return request('/api/v2/operator-presets', { body: { key: new_key, label: new_label, config: mergedConfig } });
  });

  register('cf_update_preset', 'Update an existing custom operator preset.', {
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
    label: z.string().max(200).optional(),
    config: z.record(z.any())
  }, false, ({ key, ...args }) => request(`/api/v2/operator-presets/${encodeURIComponent(key)}`, { method: 'PUT', body: args }));

  // 8. Viral Deconstruction & Review (Pilar 4 & 5)
  register('cf_ingest_viral_video', 'Ingest viral video URL for AI deconstruction.', {
    url: z.string().url(),
    niche: z.string().max(100).optional(),
    page_source: z.string().max(100).optional()
  }, false, ({ url, ...args }) => request('/api/v2/deconstruct', { body: { urls: url, ...args } }));

  register('cf_list_deconstructed_assets', 'Search deconstructed viral video blueprints.', {
    q: z.string().max(200).optional(),
    niche: z.string().max(100).optional(),
    limit: z.number().int().min(1).max(50).default(20)
  }, true, args => request(`/api/v2/deconstruct?assets=true&${new URLSearchParams(Object.entries(args).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`));

  register('cf_get_deconstructed_blueprint', 'Get detailed viral pattern breakdown and storyboard.', {
    asset_id: z.string().min(1).max(128)
  }, true, ({ asset_id }) => request(`/api/v2/deconstruct/assets/${encodeURIComponent(asset_id)}`));

  register('cf_get_job_review', 'Get human-in-the-loop review artifact for a pending job.', {
    job_id: z.string().min(1).max(128)
  }, true, ({ job_id }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/review`));

  register('cf_approve_job', 'Approve pending campaign review to proceed to production rendering.', {
    job_id: z.string().min(1).max(128),
    review_revision: z.number().int().min(1),
    review_sha256: z.string().optional()
  }, false, ({ job_id, ...body }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/approve`, { body }));

  // 9. Publishing & Observability (Pilar 6 & 7)
  register('cf_list_publishing_accounts', 'List connected social media publishing accounts.', {
    provider: z.enum(['meta', 'repliz', 'all']).default('all')
  }, true, args => request(`/api/v2/publishing/accounts?${new URLSearchParams(args)}`));

  register('cf_create_publishing_job', 'Schedule or publish completed content to a social account.', {
    account_id: z.string().min(1).max(128),
    campaign_item_id: z.string().min(1).max(128),
    platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube']),
    scheduled_time: z.string().optional(),
    caption: z.string().max(5000).optional()
  }, false, args => request('/api/v2/publishing/jobs', { body: args }));

  register('cf_list_publishing_jobs', 'Monitor social media publishing job statuses.', {
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
    platform: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20)
  }, true, args => request(`/api/v2/publishing/jobs?${new URLSearchParams(Object.entries(args).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`));

  register('cf_get_cluster_health', 'Check real-time health of the 3-node cluster and services.', {}, true, () => request('/api/v2/system-health'));

  register('cf_get_studio_stats', 'Get overview metrics on content production and stock availability.', {}, true, () => request('/api/v2/dashboard/stats'));

  return server;
}
```

---

## SOP Verifikasi & Rilis Non-Interaktif

1. **Uji Otomatis Unit Test MCP**:
   - Jalankan `npm run test:mcp` untuk memverifikasi ke-40 tools terdaftar dengan benar, validasi argumen Zod, dan routing path ke API backend.
2. **Uji Build Lokal**:
   - Pastikan build Next.js lokal bersih tanpa syntax error: `npm run build`.
3. **Eksekusi Rilis Otomatis**:
   - Jalankan rilis non-interaktif sesuai SOP:
     ```bash
     npm run release-non-interactive -- --type minor --title "Ekspansi 7 Pilar CF Studio MCP Server" --points "Penambahan MCP Product Database|Penambahan MCP Visual Identity Studio|Penambahan MCP Strategy Presets|Penambahan MCP Viral Deconstruction & Review|Penambahan MCP Publishing & Observability"
     ```
