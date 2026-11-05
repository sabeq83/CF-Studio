# Implementation Plan — Dedicated "Auto Pipeline" Menu with ContentFlow Hub Sync

Dokumen ini merinci rencana implementasi penambahan menu navigasi mandiri **"⚡ Auto Pipeline"** yang ditempatkan tepat di atas **YouTube Studio** pada seksi **WORKFLOW**, serta integrasi otomatisasi sinkronisasi ganda: **Upload Nextcloud** dan **Sync ke ContentFlow Hub** (`content_flow_items`).

---

## 1. Arsitektur Solusi & Komponen

```
[ Navigasi Sidebar (Paling Atas di WORKFLOW) ]
                       │
                       ▼ (/auto-pipeline)
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Halaman Auto Pipeline (app/auto-pipeline/page.js)                        │
│                                                                              │
│  [Baris 1: Konfigurasi 1-Klik]                                               │
│   • Brand Profile ➔ Dynamic VI Preset Dropdown (terfilter otomatis)          │
│   • Topik Resep + Quick Topic Pills + Target Jumlah Resep                    │
│   • Mode Eksekusi: Full Autopilot (Auto-Approval ON)                         │
│                                                                              │
│  [Baris 2: Live Execution Visualizer]                                        │
│   1. Planner Draft ➔ 2. Gemini 1-Pass ➔ 3. VI Preset Hydration               │
│   ➔ 4. Ingest 8-Klip @ 4s ➔ 5. Auto-Approve ➔ 6. Video, Nextcloud & Hub     │
│                                                                              │
│  [Baris 3: Tabel Riwayat Batch Kampanye]                                     │
│   Daftar kampanye resep, status klip video, link OPC, & link ContentFlow Hub │
└──────────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼ (Scheduler Execution)
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Dual-Publishing Sync Engine                                               │
│  1. Video Muxing (FFmpeg 8 klip @ 4s Omni Flash + Minimax Audio)            │
│  2. Nextcloud Storage Upload (Folder Final: MAKNA_Production_Final)          │
│  3. ContentFlow Hub Ingest (Auto-Sync to content_flow_items & ContentFlow App)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Poin Utama Sesuai Arahan Pengguna

1. **Posisi Menu di Sidebar**:
   - Diletakkan di urutan paling atas pada seksi **`WORKFLOW`**, tepat di atas **`▶️ YouTube Studio`**.
   - Ikon: `⚡`, Label: `Auto Pipeline`, Rute: `/auto-pipeline`.
2. **Sinkronisasi Otomatis Ganda (Nextcloud + ContentFlow Hub)**:
   - Selain upload otomatis ke penyimpanan Nextcloud, setiap item kampanye yang dihasilkan oleh Auto Pipeline secara otomatis disinkronisasikan ke **ContentFlow Hub** (`auto_sync_contentflow = 1`).
   - Begitu video selesai di-render, scheduler otomatis memanggil `syncApprovedOpcItemToContentFlow` sehingga video langsung terdaftar dan muncul di antarmuka **ContentFlow Hub** (`/content-flow`).

---

## 3. Before & After Code Snippets

### File 1: `app/components/Sidebar.js`
Menambahkan menu `Auto Pipeline` pada posisi teratas seksi `WORKFLOW` dan menambahkan permission mapping di `PATH_TO_FEATURE_MAP`.

#### Code Sebelum (Current/Before):
```javascript
const PATH_TO_FEATURE_MAP = {
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  // ...
};

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  { label: 'Visual Identity', href: '/settings/visual-identities', icon: '🎨' },
  { label: 'Brand Profile Manager', href: '/settings/brand-profiles', icon: '🧬' },
  { label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },

  { section: 'WORKFLOW' },
  { label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
  { label: 'Affiliate Studio', href: '/affiliate-studio', icon: '◆' },
  { label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
  { label: 'Pillar Campaign', href: '/pillar-campaigns', icon: '🌱' },
  { label: 'Sheets Autopilot', href: '/sheets-autopilot', icon: '🤖' },
  { label: 'Recipe Labs', href: '/recipe-labs', icon: '🍳' },
```

#### Code Sesudah (Proposed/After):
```javascript
const PATH_TO_FEATURE_MAP = {
  '/auto-pipeline': 'pillar_campaign',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  // ...
};

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  { label: 'Visual Identity', href: '/settings/visual-identities', icon: '🎨' },
  { label: 'Brand Profile Manager', href: '/settings/brand-profiles', icon: '🧬' },
  { label: 'Universe Manager', href: '/settings/universes', icon: '🏰' },

  { section: 'WORKFLOW' },
  { label: 'Auto Pipeline', href: '/auto-pipeline', icon: '⚡' },
  { label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' },
  { label: 'Affiliate Studio', href: '/affiliate-studio', icon: '◆' },
  { label: 'RE Campaign', href: '/re-campaigns', icon: '🎬' },
  { label: 'Pillar Campaign', href: '/pillar-campaigns', icon: '🌱' },
  { label: 'Sheets Autopilot', href: '/sheets-autopilot', icon: '🤖' },
  { label: 'Recipe Labs', href: '/recipe-labs', icon: '🍳' },
```

---

### File 2: `lib/recipe-campaign-ingest.js`
Menetapkan default `auto_sync_contentflow = 1` agar seluruh kampanye resep otomatis sinkron ke ContentFlow Hub.

#### Code Sebelum (Current/Before):
```javascript
    const campaignData = {
      id: campaignId,
      name,
      campaign_name: name,
      // ...
      approval_mode: isAutopilot ? 'none' : (globalSettings.approval_mode || 'creative'),
      auto_sync_contentflow: globalSettings.auto_sync_contentflow !== undefined ? (globalSettings.auto_sync_contentflow ? 1 : 0) : 0,
      content_world: 'real_world',
```

#### Code Sesudah (Proposed/After):
```javascript
    const campaignData = {
      id: campaignId,
      name,
      campaign_name: name,
      // ...
      approval_mode: isAutopilot ? 'none' : (globalSettings.approval_mode || 'creative'),
      auto_sync_contentflow: globalSettings.auto_sync_contentflow !== undefined ? (globalSettings.auto_sync_contentflow ? 1 : 0) : 1,
      content_world: 'real_world',
```

---

### File 3: `lib/autonomous-recipe-engine.js`
Mengaktifkan `auto_sync_contentflow: 1` pada payload global settings dan menjamin field `approved_revision` terisi saat auto-approval agar lolos validasi ContentFlow Sync.

#### Code Sebelum (Current/Before):
```javascript
  // 4. Ingest to Pillar Campaign
  const globalSettings = {
    ...preset,
    ai_directive: topic,
    mandatory_outro_line: outroLine,
    execution_mode: executionMode,
    ...overrides
  };

  // 5. Auto-Approval Sepakat untuk Mode Full Autopilot
  if (executionMode === 'full_autopilot') {
    const items = await db.prepare(
      'SELECT id, workflow_status, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ?'
    ).all(campaignId);

    for (const item of (items || [])) {
      try {
        if (item.new_video_plan_json && item.new_video_plan_json !== '[]') {
          await approvePillarCampaignItemUnchanged(item.id);
        } else {
          await db.prepare(`
            UPDATE pillar_campaign_items 
            SET workflow_status = 'production_processing',
                review_state = 'approved',
                review_reason = 'auto_approved_autopilot',
                review_state_updated_at = ?
            WHERE id = ?
          `).run(new Date().toISOString(), item.id);
        }
      } catch (approveErr) {
        console.warn(`[Autonomous Recipe Pipeline] Auto-approve warning for item ${item.id}:`, approveErr.message);
      }
    }
  }
```

#### Code Sesudah (Proposed/After):
```javascript
  // 4. Ingest to Pillar Campaign
  const globalSettings = {
    ...preset,
    ai_directive: topic,
    mandatory_outro_line: outroLine,
    execution_mode: executionMode,
    auto_sync_contentflow: 1, // Otomatis sync ke ContentFlow Hub
    ...overrides
  };

  // 5. Auto-Approval Sepakat untuk Mode Full Autopilot
  if (executionMode === 'full_autopilot') {
    const items = await db.prepare(
      'SELECT id, workflow_status, new_video_plan_json, review_revision FROM pillar_campaign_items WHERE campaign_id = ?'
    ).all(campaignId);

    for (const item of (items || [])) {
      try {
        if (item.new_video_plan_json && item.new_video_plan_json !== '[]') {
          await approvePillarCampaignItemUnchanged(item.id);
        } else {
          await db.prepare(`
            UPDATE pillar_campaign_items 
            SET workflow_status = 'production_processing',
                review_state = 'approved',
                review_reason = 'auto_approved_autopilot',
                approved_revision = COALESCE(review_revision, 1),
                review_state_updated_at = ?
            WHERE id = ?
          `).run(new Date().toISOString(), item.id);
        }
      } catch (approveErr) {
        console.warn(`[Autonomous Recipe Pipeline] Auto-approve warning for item ${item.id}:`, approveErr.message);
      }
    }
  }
```

---

### File 4: `app/auto-pipeline/page.js` (FILE BARU)
Halaman React interaktif client component yang mengimplementasikan Single-Column Dark Theme Layout:
- Terintegrasi dengan `Sidebar` dan Header layout standar.
- Form konfigurasi (Brand Profile, Dynamic VI Preset Dropdown, Topik Resep + Quick Topic Pills, Target Video, Mode Autopilot).
- Live execution visualizer (Tracker 6-tahap saat proses berjalan).
- Tabel riwayat batch kampanye auto-pipeline yang memuat status klip, link OPC, dan link ContentFlow Hub.
- 100% menggunakan CSS Semantic Tokens (`var(--surface)`, `var(--canvas)`, dll.).

---

## 4. Execution Task List

Berikut adalah tahapan pengerjaan kronologis yang akan di-update secara real-time (`- [ ]` ➔ `- [x]`):

- [x] **Task 1: Update `app/components/Sidebar.js`**
  - Menambahkan menu `Auto Pipeline` tepat di atas `YouTube Studio` pada seksi `WORKFLOW`.
  - Mendaftarkan permission mapping `/auto-pipeline` di `PATH_TO_FEATURE_MAP`.
- [x] **Task 2: Update `lib/recipe-campaign-ingest.js` & `lib/autonomous-recipe-engine.js`**
  - Mengaktifkan default `auto_sync_contentflow: 1`.
  - Menjamin pengisian `approved_revision = COALESCE(review_revision, 1)` pada auto-approval agar lolos validasi sinkronisasi ContentFlow Hub.
- [x] **Task 3: Buat Halaman React Komprehensif `app/auto-pipeline/page.js`**
  - Mengimplementasikan antarmuka single-column sesuai mockup interaktif.
  - Menghubungkan dropdown preset dinamis ke API `GET /api/v2/recipes/autonomous-pipeline?brand={brandId}`.
  - Menghubungkan tombol eksekusi ke API `POST /api/v2/recipes/autonomous-pipeline`.
  - Menampilkan riwayat batch kampanye dengan status Nextcloud dan ContentFlow Hub.
- [x] **Task 4: Tulis & Jalankan Unit Test `tests/test-auto-pipeline-menu-contentflow.test.js`**
  - Menguji urutan menu navigasi di `Sidebar.js`.
  - Menguji aktivasi `auto_sync_contentflow = 1` pada ingestion kampanye.
  - Memastikan seluruh assertion lulus 100%.
- [x] **Task 5: SOP Rilis & Git Sync**
  - Menjalankan `npm run release-non-interactive` untuk update versi dan push remote repository.
- [x] **Task 6: Deploy ke Server Dev**
  - Menjalankan atomic deployment ke Mac Mini Dev dan memverifikasi HTTP 200 halaman `/auto-pipeline`.

---

## 5. Verifikasi & Safety Guardrails

1. **Zero Secret Exposure**: Tidak ada API key, secret, atau token eksternal yang di-hardcode.
2. **Universal Theme**: 100% menggunakan Semantic CSS Design Tokens dari `theme.css`.
3. **Database Integrity**: Memanfaatkan kolom `auto_sync_contentflow` yang sudah ada pada skema database tanpa breaking change.
