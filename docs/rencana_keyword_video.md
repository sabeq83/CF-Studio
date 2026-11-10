# Rencana Implementasi: Keyword-Based Video pada Brand Editorial (Opsi A — Batch Multi-Jadwal)

## 📌 Ringkasan Fitur
Fitur ini memungkinkan pengguna membuat video editorial berbasis **kata kunci target / search intent audiens** dengan menonaktifkan pilar brand bawaan (**Pilar OFF**). Fitur ini disematkan langsung pada modal **1-Klik Video (Instant Launch)** dan **Auto Pipeline Scheduler (Opsi A: Batch Multi-Jadwal)**.

Berdasarkan tinjauan arsitektur, rencana ini menyelaraskan 3 penyesuaian teknis penting:
1. **100% Kepatuhan Semantic CSS Tokens**: Mengganti semua styling statis menjadi token resmi `app/theme.css` (`var(--on-action-primary)`, `var(--status-info)`, `var(--surface-interactive)`, dll.) agar adaptif sempurna di Light & Dark Mode.
2. **Penyelarasan Single-Pass Architecture**: Menyuntikkan arahan *Search Intent* kata kunci langsung ke dalam prompt 1-Pass AI sehingga 10 parameter Video DNA, Storyboard 8 adegan, dan naskah Voice-Over berakar kuat pada kata kunci tanpa mengandalkan Call 2 terpisah yang sudah deprecated.
3. **Standarisasi Payload Batch Schedule (Opsi A)**: Memetakan setiap baris kata kunci menjadi 1 record jadwal mandiri di database (`pipeline_config_json.use_brand_pillars = false`) dengan dukungan auto-stagger hari penayangan.

---

## 🏗️ Arsitektur & Alur Data

```mermaid
flowchart TD
    subgraph UI ["Frontend (app/auto-pipeline/page.js)"]
        UI_Instant["Modal 1-Klik Video\n[🏛️ Pakai Pilar] vs [🎯 Berbasis Keyword (Pilar OFF)]"]
        UI_Sched["Modal Skeduler Batch (Opsi A)\nMulti-Line Keywords Textarea + Auto-Stagger Days"]
    end

    subgraph API ["API Layer"]
        API_Pipe["POST /api/v2/recipes/autonomous-pipeline\n{ use_brand_pillars: false, keyword: str }"]
        API_Sched["POST /api/v2/recipes/auto-pipeline-schedules\n{ items: [ { keyword, use_brand_pillars: false }, ... ] }"]
    end

    subgraph Engine ["Execution & Engine (Single-Pass 1-Call)"]
        Auto_Runner["auto-pipeline-scheduler-runner.js\nMembaca cfg.use_brand_pillars & keyword"]
        Auto_Engine["autonomous-engine.js\nexecuteAutonomousEditorialPipeline"]
        Planner_Engine["content-planner-engine.js\nSingle-Pass Generator: Search Intent, Storyline & Hook 8-11 Kata"]
    end

    UI_Instant --> API_Pipe
    UI_Sched --> API_Sched
    API_Pipe --> Auto_Engine
    API_Sched --> Auto_Runner
    Auto_Runner --> Auto_Engine
    Auto_Engine --> Planner_Engine
```

---

## 📋 Execution Task List

- [x] **Task 1: Content Planner Engine Prompt & Logic** — Update `lib/content-planner-engine.js` agar tidak memaksakan warisan pilar brand jika `use_brand_pillars: false` pada `brand_editorial` serta menginjeksi direktif *Search Intent* (masalah audiens, mitos/fakta, solusi edukatif) pada prompt AI generator.
- [x] **Task 2: Autonomous Engine Pipeline Parameter Binding** — Update `lib/autonomous-engine.js` (`executeAutonomousEditorialPipeline`) untuk menerima parameter `keyword` & `useBrandPillars`, menamai draf secara dinamis (`[Keyword Editorial]`), dan meneruskannya ke global settings.
- [x] **Task 3: Autonomous Pipeline Route Parameter Binding** — Update `app/api/v2/recipes/autonomous-pipeline/route.js` untuk membaca `use_brand_pillars` dan `keyword` dari request body serta memvalidasi fallback topic.
- [x] **Task 4: Scheduler Runner Keyword Support** — Update `lib/auto-pipeline-scheduler-runner.js` agar membaca `use_brand_pillars` dan `keyword` dari `pipeline_config_json` pada saat jadwal dieksekusi.
- [x] **Task 5: Frontend UI (Instant Launch Modal 1-Klik)** — Update `app/auto-pipeline/page.js` untuk menambahkan Segmented Control `[ 🏛️ Pakai Pilar Brand ]` vs `[ 🎯 Berbasis Keyword (Pilar OFF) ]`, input keyword, banner indikator Pilar OFF, dan arahan Single-Pass AI dengan 100% semantic CSS tokens.
- [x] **Task 6: Frontend UI (Batch Scheduler Modal Opsi A)** — Update `app/auto-pipeline/page.js` untuk menambahkan mode Multi-Keyword textarea, checkbox auto-stagger distribution, counter badge jumlah keyword, dan konstruksi payload batch `items` ke API.
- [x] **Task 7: Verifikasi End-to-End & Uji Coba** — Uji eksekusi 1-klik keyword editorial dan pembuatan batch jadwal keyword pada environment dev/staging.
- [ ] **Task 8: Rilis & Git Sync** — Jalankan `npm run release-non-interactive` dan deploy atomic ke Staging & Dev sesuai SOP.

---

## 🔍 Before & After Code Snippets

### 1. `lib/content-planner-engine.js`

#### Code Sebelum (Current/Before) — Logic `shouldInheritBrandPillars`:
```javascript
// Baris 273-274
  const normalizedUseBrandPillars = use_brand_pillars !== false && use_brand_pillars !== 'false' && use_brand_pillars !== 0 && use_brand_pillars !== '0';
  const shouldInheritBrandPillars = focus === 'brand_editorial' || normalizedUseBrandPillars;
```

#### Code Sesudah (Proposed/After) — Logic `shouldInheritBrandPillars`:
```javascript
// Baris 273-274: Jangan paksa inherit pilar brand jika use_brand_pillars diset false eksplisit
  const normalizedUseBrandPillars = use_brand_pillars !== false && use_brand_pillars !== 'false' && use_brand_pillars !== 0 && use_brand_pillars !== '0';
  const shouldInheritBrandPillars = normalizedUseBrandPillars;
```

---

#### Code Sebelum (Current/Before) — Strategic Skeleton Prompt:
```javascript
// Baris 676-688
INSTRUKSI KHUSUS:
${focus === 'brand_editorial' ? `- MODE: BRAND EDITORIAL (BUKAN KAMPANYE PRODUK)
- Brand/Akun: ${activeBrandName}
- Konteks Brand: ${activeBrandContext}
- Tujuan Konten: ${activeContentGoal || 'Membangun authority dan engagement akun'}
- Pilar Wajib: ${pillars.join(', ')}
- Jumlah Pilar: ${pillars.length}
- Ide per Pilar: ${rowsPerPillar}
- Total Baris: ${count}
- Setiap pilar WAJIB muncul tepat ${rowsPerPillar} kali.
- DILARANG menambah, menghapus, mengganti nama, atau mengubah distribusi pilar dari Strategic Skeleton.
- DILARANG mengarang, menyimpulkan, atau memaksakan produk tertentu.
- Product reference harus null kecuali produk diberikan eksplisit.
- Fokus pada masalah, kebiasaan, sistem, bahan, teknik, dan lifestyle audiens.` : ...
```

#### Code Sesudah (Proposed/After) — Strategic Skeleton Prompt:
```javascript
// Baris 676-688: Search Intent & Storyline Injection saat pilar brand OFF
INSTRUKSI KHUSUS:
${focus === 'brand_editorial' ? `- MODE: BRAND EDITORIAL (BUKAN KAMPANYE PRODUK)
- Brand/Akun: ${activeBrandName}
- Konteks Brand: ${activeBrandContext}
- Tujuan Konten: ${activeContentGoal || 'Membangun authority dan engagement akun'}
${!normalizedUseBrandPillars ? `
🚨 PILAR MODE: KEYWORD / SEARCH INTENT DRIVEN (PILAR BRAND DINONAKTIFKAN / OFF)
- Pengguna memilih NON-AKTIFKAN pilar brand editorial dan memberikan kata kunci target: "${pillars.join(', ')}".
- Nilai field "pillar" pada output WAJIB menggunakan kata kunci target tersebut.
- AI WAJIB membedah search intent dari kata kunci tersebut (masalah umum pencarian audiens, mitos, miskonsepsi, trik praktis, atau solusi edukatif).
- Bangun storyline dan situasi kontekstual yang berakar pada kata kunci tersebut, dengan tetap mempertahankan tone of voice dan identitas brand.` : `
- Pilar Wajib: ${pillars.join(', ')}
- Jumlah Pilar: ${pillars.length}
- Ide per Pilar: ${rowsPerPillar}
- Total Baris: ${count}
- Setiap pilar WAJIB muncul tepat ${rowsPerPillar} kali.
- DILARANG menambah, menghapus, mengganti nama, atau mengubah distribusi pilar dari Strategic Skeleton.`}
- DILARANG mengarang, menyimpulkan, atau memaksakan produk tertentu.
- Product reference harus null kecuali produk diberikan eksplisit.
- Fokus pada masalah, kebiasaan, sistem, bahan, teknik, dan lifestyle audiens.` : ...
```

---

#### Code Sebelum (Current/Before) — Creative Prompt:
```javascript
// Baris 793-797
${focus === 'brand_editorial' ? `INFORMASI BRAND EDITORIAL:
- Akun: ${activeBrandName}
- Konteks & Filosofi Alur Berpikir: ${activeBrandContext}
- Tujuan Konten & Misi Literasi: ${activeContentGoal || 'Authority dan engagement'}
- Jangan mengarang produk atau membuat CTA pembelian.` : ...
```

#### Code Sesudah (Proposed/After) — Creative Prompt:
```javascript
// Baris 793-797
${focus === 'brand_editorial' ? `INFORMASI BRAND EDITORIAL:
- Akun: ${activeBrandName}
- Konteks & Filosofi Alur Berpikir: ${activeBrandContext}
- Tujuan Konten & Misi Literasi: ${activeContentGoal || 'Authority dan engagement'}
${!normalizedUseBrandPillars ? `- Topik Utama / Keyword Search Intent: "${pillars.join(', ')}" (Pilar brand OFF). Hook dan narasi wajib mengupas langsung masalah pencarian terkait topik/keyword ini secara lugas.` : ''}
- Jangan mengarang produk atau membuat CTA pembelian.` : ...
```

---

### 2. `lib/autonomous-engine.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 608-623 & 676-690
export async function executeAutonomousEditorialPipeline({
  brandId,
  pillarTitle,
  presetKey = 'brand_editorial_campaign',
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  overrides = {}
}) {
  return tenantContext.run(tenantId || 'default_tenant', async () => {
  const db = getDb();
  const brand = brandId ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
  ).get(brandId, brandId, tenantId) : null;
  const brandName = brand?.brand_name || 'Brand';
  const effectivePillar = pillarTitle || 'Eat Better, Not Perfect';
  ...
  // 1. Create Draft Content Planner (Focus: brand_editorial)
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - Editorial: ${effectivePillar}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    tenant_id: tenantId,
    planner_focus: 'brand_editorial',
    pillars: [effectivePillar],
    use_brand_pillars: true,
    target_language: effectiveTargetLanguage,
    target_audience: effectiveTargetAudience,
    brand_context: brand?.editorial_brand_context || '',
    content_goal: effectiveContentGoal,
    planner_count: 1
  });
```

#### Code Sesudah (Proposed/After):
```javascript
// Baris 608+: Dukungan keyword, dynamic naming, and useBrandPillars binding
export async function executeAutonomousEditorialPipeline({
  brandId,
  pillarTitle,
  keyword = null,
  useBrandPillars = true,
  presetKey = 'brand_editorial_campaign',
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  overrides = {}
}) {
  return tenantContext.run(tenantId || 'default_tenant', async () => {
  const db = getDb();
  const brand = brandId ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
  ).get(brandId, brandId, tenantId) : null;
  const brandName = brand?.brand_name || 'Brand';

  const effectiveUseBrandPillars = overrides?.use_brand_pillars !== undefined 
    ? Boolean(overrides.use_brand_pillars)
    : (useBrandPillars !== false && !keyword && !overrides?.keyword);
  const effectiveKeyword = keyword || overrides?.keyword || (!effectiveUseBrandPillars ? pillarTitle : null);
  const effectivePillar = !effectiveUseBrandPillars && effectiveKeyword
    ? effectiveKeyword
    : (pillarTitle || 'Eat Better, Not Perfect');
  ...
  // 1. Create Draft Content Planner (Focus: brand_editorial)
  const plannerDraft = await createDraftContentPlanner({
    title: !effectiveUseBrandPillars
      ? `${brandName} - Keyword Editorial: ${effectivePillar}`
      : `${brandName} - Editorial: ${effectivePillar}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    tenant_id: tenantId,
    planner_focus: 'brand_editorial',
    pillars: [effectivePillar],
    use_brand_pillars: effectiveUseBrandPillars,
    target_language: effectiveTargetLanguage,
    target_audience: effectiveTargetAudience,
    brand_context: brand?.editorial_brand_context || '',
    content_goal: effectiveContentGoal,
    planner_count: 1
  });
```

---

### 3. `app/api/v2/recipes/autonomous-pipeline/route.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 179-191
    } else if (pipelineType === 'editorial_campaign') {
      result = await executeAutonomousEditorialPipeline({
        brandId: body.brand_id || body.brandId,
        pillarTitle: body.content_pillar || body.pillar_title || body.topic,
        presetKey: body.preset_key || body.presetKey || 'brand_editorial_campaign',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          ...affiliateOverride,
          ...(body.overrides || {})
        }
      });
```

#### Code Sesudah (Proposed/After):
```javascript
// Baris 179-191: Membaca flag use_brand_pillars dan keyword
    } else if (pipelineType === 'editorial_campaign') {
      const isKeywordMode = body.use_brand_pillars === false || Boolean(body.keyword);
      result = await executeAutonomousEditorialPipeline({
        brandId: body.brand_id || body.brandId,
        pillarTitle: body.content_pillar || body.pillar_title || body.topic,
        keyword: body.keyword || (isKeywordMode ? (body.content_pillar || body.pillar_title || body.topic) : null),
        useBrandPillars: body.use_brand_pillars !== undefined ? Boolean(body.use_brand_pillars) : !isKeywordMode,
        presetKey: body.preset_key || body.presetKey || 'brand_editorial_campaign',
        executionMode: body.execution_mode || body.executionMode || 'full_autopilot',
        tenantId,
        overrides: {
          visual_identity_preset_id: body.visual_identity_preset_id || null,
          use_brand_pillars: body.use_brand_pillars !== undefined ? Boolean(body.use_brand_pillars) : !isKeywordMode,
          keyword: body.keyword || (isKeywordMode ? (body.content_pillar || body.pillar_title || body.topic) : null),
          ...affiliateOverride,
          ...(body.overrides || {})
        }
      });
```

---

### 4. `lib/auto-pipeline-scheduler-runner.js`

#### Code Sebelum (Current/Before):
```javascript
// Baris 112-119
  if (pType === 'editorial_campaign') {
    return await executeAutonomousEditorialPipeline({
      brandId: schedule.brand_id,
      pillarTitle: schedule.target_item_title || schedule.topic,
      presetKey: schedule.preset_key || 'brand_editorial_campaign',
      tenantId
    });
  }
```

#### Code Sesudah (Proposed/After):
```javascript
// Baris 112-119: Meneruskan pipeline_config keyword & use_brand_pillars
  if (pType === 'editorial_campaign') {
    const cfg = pipelineConfig || {};
    const isKeyword = cfg.use_brand_pillars === false || Boolean(cfg.keyword);
    return await executeAutonomousEditorialPipeline({
      brandId: schedule.brand_id,
      pillarTitle: schedule.target_item_title || schedule.topic,
      keyword: cfg.keyword || (isKeyword ? (schedule.target_item_title || schedule.topic) : null),
      useBrandPillars: cfg.use_brand_pillars !== false,
      presetKey: schedule.preset_key || 'brand_editorial_campaign',
      tenantId,
      overrides: {
        ...(cfg || {})
      }
    });
  }
```

---

### 5. `app/auto-pipeline/page.js` — Modal 1-Klik Video (Instant Launch)

#### Code Sebelum (Current/Before):
```jsx
// Baris 2712-2730
              {/* 3B: VIDEO EDITORIAL (Pilar Brand Selector) */}
              {instantCampaignType === 'editorial_campaign' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--status-info)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>📖</span>
                      <span>Pilih Pilar Konten Brand:</span>
                    </div>
```

#### Code Sesudah (Proposed/After) — 100% Semantic CSS Tokens:
```jsx
              {/* 3B: VIDEO EDITORIAL (Segmented Control: Pilar vs Keyword) */}
              {instantCampaignType === 'editorial_campaign' && (
                <div style={{
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>📖</span>
                      <span>Konfigurasi Topik Editorial:</span>
                    </div>
                    
                    {/* Segmented Control - 100% Semantic Tokens */}
                    <div style={{ display: 'flex', background: 'var(--surface)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setInstantEditorialMode('pillar')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: instantEditorialMode === 'pillar' ? 'var(--status-info)' : 'transparent',
                          color: instantEditorialMode === 'pillar' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                          transition: 'var(--transition)'
                        }}
                      >
                        🏛️ Pakai Pilar Brand
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstantEditorialMode('keyword')}
                        style={{
                          padding: '0.35rem 0.75rem',
                          border: 'none',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: instantEditorialMode === 'keyword' ? 'var(--status-info)' : 'transparent',
                          color: instantEditorialMode === 'keyword' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                          transition: 'var(--transition)'
                        }}
                      >
                        🎯 Berbasis Keyword (Pilar OFF)
                      </button>
                    </div>
                  </div>

                  {instantEditorialMode === 'pillar' ? (
                    <>
                      {/* Search box & Scrollable Pillars List */}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Masukkan kata kunci atau topik pencarian audiens (Pilar brand dinonaktifkan):
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--status-warning-soft)', color: 'var(--status-warning)', padding: '0.15rem 0.5rem', borderRadius: 9999 }}>
                          Pilar Brand: OFF ⚠️
                        </span>
                      </div>
                      <input
                        type="text"
                        value={instantEditorialKeyword}
                        onChange={(e) => setInstantEditorialKeyword(e.target.value)}
                        placeholder="Contoh: peredam suara studio podcast murah, cara hilangkan dengung kamar"
                        style={{
                          width: '100%',
                          height: '38px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 10px',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          outline: 'none'
                        }}
                      />
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'var(--surface-interactive)', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                        🤖 <strong>Arahan Single-Pass Gemini Engine:</strong> AI akan membedah search intent dari keyword ini menjadi narasi storytelling tension berdurasi 30-45 detik dengan formula Hook 8-11 kata tanpa terikat pilar bawaan brand.
                      </div>
                    </div>
                  )}
```

---

### 6. `app/auto-pipeline/page.js` — Modal Skeduler Batch Opsi A

#### Code Sebelum (Current/Before):
```jsx
// Baris 5882-5895
                {/* 3B. EDITORIAL: Multi-Select Pilar Konten Brand */}
                {schedCampaignType === 'editorial_campaign' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>📖</span>
                        <span>Pilih Pilar Konten Brand:</span>
                      </div>
```

#### Code Sesudah (Proposed/After) — 100% Semantic Tokens & Batch Textarea:
```jsx
                {/* 3B. EDITORIAL: Segmented Control & Multi-Keyword Textarea */}
                {schedCampaignType === 'editorial_campaign' && (
                  <div style={{
                    background: 'var(--surface-raised)',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>📅</span>
                        <span>Mode Sumber Topik Penjadwalan:</span>
                      </div>
                      <div style={{ display: 'flex', background: 'var(--surface)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => setSchedEditorialMode('pillar')}
                          style={{
                            padding: '0.35rem 0.75rem',
                            border: 'none',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: schedEditorialMode === 'pillar' ? 'var(--status-info)' : 'transparent',
                            color: schedEditorialMode === 'pillar' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                            transition: 'var(--transition)'
                          }}
                        >
                          🏛️ Multi-Pilar Brand
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchedEditorialMode('keyword')}
                          style={{
                            padding: '0.35rem 0.75rem',
                            border: 'none',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: schedEditorialMode === 'keyword' ? 'var(--status-info)' : 'transparent',
                            color: schedEditorialMode === 'keyword' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                            transition: 'var(--transition)'
                          }}
                        >
                          🎯 Multi-Keyword (Pilar OFF)
                        </button>
                      </div>
                    </div>

                    {schedEditorialMode === 'pillar' ? (
                      <>
                        {/* Existing Multi-Pillar Selector */}
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            Daftar Kata Kunci (1 baris = 1 jadwal mandiri):
                          </label>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, background: 'var(--status-info-soft)', color: 'var(--status-info)', padding: '0.15rem 0.55rem', borderRadius: 9999 }}>
                            {schedEditorialKeywordsText.split('\n').filter(k => k.trim()).length} Kata Kunci
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={schedEditorialKeywordsText}
                          onChange={(e) => setSchedEditorialKeywordsText(e.target.value)}
                          placeholder={'peredam suara studio podcast murah\ncara hilangkan dengung kamar tidur\nperbedaan rockwool vs glasswool untuk studio'}
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.65rem',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono)',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="chkSchedStagger"
                            checked={schedStaggerDays}
                            onChange={(e) => setSchedStaggerDays(e.target.checked)}
                            style={{ accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                          />
                          <label htmlFor="chkSchedStagger" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            <strong>Distribusi Hari Otomatis:</strong> Sebarkan setiap kata kunci ke hari yang berurutan (Senin, Selasa, Rabu, dst).
                          </label>
                        </div>
                      </div>
                    )}
```

---

## 🎯 Skenario Verifikasi
1. **Verifikasi 1-Klik Video Editorial Berbasis Keyword**:
   Buka modal 1-Klik Video pada UI, pilih tab *🎯 Berbasis Keyword (Pilar OFF)*, masukkan keyword seperti *"cara hilangkan dengung kamar"*, klik *Jalankan*, dan pastikan naskah VO, 10 DNA parameter, dan visual clip fokus pada topik keyword tanpa pilar brand.
2. **Verifikasi Batch Skeduler Opsi A**:
   Buka modal Skeduler, pilih tab *🎯 Multi-Keyword (Pilar OFF)*, masukkan 3 baris keyword, aktifkan *Distribusi Hari Otomatis*, lalu simpan. Periksa tabel jadwal untuk memastikan 3 jadwal independen terbentuk dengan hari yang terdistribusi rapi.
3. **Verifikasi Eksekusi Runner**:
   Jalankan pemicu manual jadwal keyword melalui UI / API dan pastikan kampanye dieksekusi dengan konfigurasi `{ use_brand_pillars: false, keyword }`.
4. **Rilis & Deployment**:
   Jalankan `npm run release-non-interactive` dan deploy atomic ke lingkungan Dev & Staging sesuai SOP.
