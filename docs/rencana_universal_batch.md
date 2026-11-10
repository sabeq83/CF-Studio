# Rencana Khusus: Universal Batch Scheduling untuk Semua Jenis Video

> **Status:** Disimpan untuk dieksekusi pada iterasi berikutnya (*Deferred Execution*).  
> **Target Subjek:** Standarisasi pembuatan multi-jadwal secara serentak (Batch) di seluruh 4 lini video MAKNA Flow.

---

## 📌 Ringkasan Konsep

Fitur ini menstandarkan antarmuka dan alur pembuatan jadwal massal (*Universal Batch Scheduling*) di seluruh jenis video otomatis MAKNA Flow, sehingga pengguna dapat mengisi puluhan topik konten sekaligus dan mendistribusikannya ke kalender penayangan hanya dalam 1 klik.

### 🎯 4 Lini Video yang Distandarkan:
1. **Brand Editorial (`editorial_campaign`)**: Sudah aktif pada `v2.40.11` (Multi-Keyword Opsi A & Multi-Pilar).
2. **Resep Kuliner (`recipe_campaign`)**: Menambahkan mode **Multi-Line Menu Resep** (1 baris = 1 menu masakan dengan deteksi kategori otomatis).
3. **Multiplier Video (`multiplier_campaign`)**: Menambahkan mode **Multi-Blueprint Checkbox** (memilih beberapa video viral acuan untuk dijadwalkan serentak).
4. **Produk Katalog (`product_campaign`)**: Menambahkan mode **Multi-Angle / Promo Context** untuk 1 produk unggulan yang sama.

---

## 📋 Execution Task List

- [x] **Task 1: State Management Frontend** — Tambahkan state `schedRecipeMode` ('umbrella' | 'menu_list'), `schedRecipeMenuList`, `selectedBlueprintIds` (array), dan `schedProductPromoMode` ('single' | 'multi_angle') pada `app/auto-pipeline/page.js`.
- [x] **Task 2: Frontend UI Resep Kuliner (Multi-Menu)** — Tambahkan Segmented Control `[ 🍲 Topik Payung (AI Acak) ]` vs `[ 📝 Multi-Line Menu Resep ]`, textarea daftar menu kuliner, dan badge counter di `app/auto-pipeline/page.js`.
- [x] **Task 3: Batch Handler Resep Kuliner** — Tambahkan logika batch mapping pada `handleSaveSchedule` untuk `recipe_campaign` mode `menu_list` dengan deteksi kategori otomatis (`detectCategoryFromTopic`) dan auto-stagger hari/tanggal.
- [x] **Task 4: Frontend UI Multiplier (Multi-Blueprint Checkbox)** — Ubah `<select>` dropdown blueprint menjadi antarmuka seleksi multi-checkbox/kartu dengan pencarian dan filter niche di `app/auto-pipeline/page.js`.
- [x] **Task 5: Batch Handler Multiplier** — Tambahkan logika batch mapping pada `handleSaveSchedule` untuk `multiplier_campaign` ketika `selectedBlueprintIds.length > 1`.
- [x] **Task 6: Frontend UI & Handler Produk Multi-Angle** — Tambahkan opsi textarea multi-angle konteks promosi untuk 1 produk pada `product_campaign`.
- [x] **Task 7: Verifikasi End-to-End** — Uji coba pembuatan batch jadwal untuk Resep Kuliner, Multiplier, dan Produk Katalog.
- [x] **Task 8: Rilis & Git Sync** — Jalankan `npm run release-non-interactive` dan deploy atomic ke Staging & Dev Mac Mini.

---

## 🔍 Before & After Code Snippets

### 1. `app/auto-pipeline/page.js` — Resep Kuliner UI Modal

#### Code Sebelum (Current/Before):
```jsx
// Baris 6280-6308
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tema / Arahan Topik Resep Harian</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI berkreasi variasi resep baru tiap hari</span>
                      </label>
                      <input
                        type="text"
                        value={schedTopic}
                        onChange={(e) => {
                          const newTopic = e.target.value;
                          setSchedTopic(newTopic);
                          if (!isSchedCategoryManual) {
                            setSchedCategory(detectCategoryFromTopic(newTopic));
                          }
                        }}
                        placeholder="Contoh: Air fryer crispy chicken tenders and snack finger foods"
                        required
                        style={{
                          height: '42px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.85rem',
                          fontSize: '0.88rem',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
```

#### Code Sesudah (Proposed/After) — Segmented Control & Multi-Line Menu:
```jsx
// Baris 6280+: Dukungan Dual Mode (Topik Payung vs Multi-Menu Resep)
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          Mode Perencanaan Resep:
                        </label>
                        <div style={{ display: 'flex', background: 'var(--surface)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => setSchedRecipeMode('umbrella')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedRecipeMode === 'umbrella' ? 'var(--status-info)' : 'transparent',
                              color: schedRecipeMode === 'umbrella' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                              transition: 'var(--transition)'
                            }}
                          >
                            🍲 Topik Payung (AI Acak)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedRecipeMode('menu_list')}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: 'none',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: schedRecipeMode === 'menu_list' ? 'var(--status-info)' : 'transparent',
                              color: schedRecipeMode === 'menu_list' ? 'var(--on-action-primary)' : 'var(--text-muted)',
                              transition: 'var(--transition)'
                            }}
                          >
                            📝 Multi-Menu Resep (1 Baris = 1 Jadwal)
                          </button>
                        </div>
                      </div>

                      {schedRecipeMode === 'umbrella' ? (
                        <input
                          type="text"
                          value={schedTopic}
                          onChange={(e) => {
                            const newTopic = e.target.value;
                            setSchedTopic(newTopic);
                            if (!isSchedCategoryManual) setSchedCategory(detectCategoryFromTopic(newTopic));
                          }}
                          placeholder="Contoh: Air fryer crispy chicken tenders and snack finger foods"
                          style={{
                            height: '42px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 0.85rem',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            outline: 'none'
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Masukkan daftar nama menu kuliner (1 baris = 1 jadwal mandiri):
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--status-info-soft)', color: 'var(--status-info)', padding: '0.15rem 0.55rem', borderRadius: 9999 }}>
                              {schedRecipeMenuList.split('\n').filter(k => k.trim()).length} Menu Resep
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            value={schedRecipeMenuList}
                            onChange={(e) => setSchedRecipeMenuList(e.target.value)}
                            placeholder={'Ayam Goreng Lengkuas Air Fryer Gurih Meresap\nTahu Bakso Kukus Rendah Kalori\nSup Jamur Enoki Pedas Segar Ala Resto\nBolu Pisang Kukus Lembut Tanpa Mixer'}
                            style={{
                              width: '100%',
                              background: 'var(--input-bg)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.65rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontFamily: 'var(--font-mono)',
                              outline: 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
```

---

### 2. `app/auto-pipeline/page.js` — Resep Kuliner Batch Handler `handleSaveSchedule`

#### Code Sebelum (Current/Before):
```javascript
// Baris 1482-1488 (Hanya single creation di blok else)
        } else {
          // Single Creation (1 Produk, 1 Pilar, atau Resep)
          let finalName = schedName.trim();
          let targetId = null;
          let targetTitle = null;
          let finalTopic = schedTopic;
          let finalCategory = schedCategory;
```

#### Code Sesudah (Proposed/After) — Batch Mapping Resep:
```javascript
// Baris 1447+: Batch Resep Kuliner Multi-Line Menu
        } else if (schedCampaignType === 'recipe_campaign' && schedRecipeMode === 'menu_list') {
          const menus = schedRecipeMenuList.split('\n').map(m => m.trim()).filter(Boolean);
          if (menus.length === 0) throw new Error('Masukkan minimal 1 baris menu resep.');

          const customNameBase = schedName.trim();
          const items = menus.map((menuTitle, idx) => {
            let itemDays = schedDays;
            if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const autoCat = detectCategoryFromTopic(menuTitle);
            const itemScheduleName = customNameBase
              ? `${customNameBase} - ${menuTitle}`
              : `Resep: ${menuTitle} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'recipe_campaign',
              target_item_id: null,
              target_item_title: menuTitle,
              topic: menuTitle,
              category: autoCat,
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: { generate_recipe: schedGenerateRecipe, post_link_affiliate: schedPostAffiliateLink }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch resep');
          showToast(`Berhasil membuat ${items.length} baris jadwal resep kuliner independen! 🍳`);
```

---

### 3. `app/auto-pipeline/page.js` — Multiplier Video UI Modal

#### Code Sebelum (Current/Before):
```jsx
// Baris 6476-6518
                      <select
                        value={schedBlueprintId}
                        onChange={(e) => setSchedBlueprintId(e.target.value)}
                        style={{
                          height: '40px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0 0.75rem',
                          fontSize: '0.84rem',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      >
                        <option value="">⚡ Autopilot: Blueprint Video Paling Viral (Rank #1 Hook)</option>
                        {blueprints.map(bp => (
                          <option key={bp.id} value={bp.id}>
                            {bp.core_problem || bp.source_url}
                          </option>
                        ))}
                      </select>
```

#### Code Sesudah (Proposed/After) — Multi-Select Blueprint Checkbox:
```jsx
// Baris 6476+: Multi-Select Blueprint Grid / Checkboxes
                      <div style={{
                        maxHeight: '220px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        background: 'var(--surface)'
                      }}>
                        {blueprints.map(bp => {
                          const isChecked = selectedBlueprintIds.includes(bp.id);
                          const title = bp.core_problem || bp.core_solution || bp.original_caption || bp.source_url;
                          return (
                            <div
                              key={bp.id}
                              onClick={() => toggleBlueprintSelection(bp.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.55rem 0.75rem',
                                borderRadius: 'var(--radius-xs)',
                                background: isChecked ? 'var(--surface-interactive)' : 'transparent',
                                border: isChecked ? '1px solid var(--action-primary)' : '1px solid transparent',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{bp.niche ? `[${bp.niche}] ` : ''}Hook Score: Rank #1</span>
                              </div>
                              <input type="checkbox" checked={isChecked} readOnly style={{ accentColor: 'var(--action-primary)' }} />
                            </div>
                          );
                        })}
                      </div>
```

---

### 4. `app/auto-pipeline/page.js` — Multiplier Batch Handler `handleSaveSchedule`

#### Code Sebelum (Current/Before):
```javascript
// Baris 1514-1521
          } else if (schedCampaignType === 'multiplier_campaign') {
            targetId = schedBlueprintId || (blueprints[0]?.id || null);
            const bpObj = blueprints.find(b => b.id === targetId);
            targetTitle = bpObj?.original_caption || bpObj?.source_url || 'Winning Blueprint';
            finalTopic = targetTitle;
            finalCategory = 'multiplier';
            if (!finalName) finalName = `${targetTitle} — ${schedGenTime} WIB`;
          }
```

#### Code Sesudah (Proposed/After) — Batch Mapping Multiplier:
```javascript
// Baris 1447+: Batch Multiplier Multi-Blueprint
        } else if (schedCampaignType === 'multiplier_campaign' && selectedBlueprintIds.length > 1) {
          const customNameBase = schedName.trim();
          const items = selectedBlueprintIds.map((bpId, idx) => {
            const bpObj = blueprints.find(b => b.id === bpId);
            const bpTitle = bpObj?.core_problem || bpObj?.original_caption || 'Winning Blueprint';
            let itemDays = schedDays;
            if (schedStaggerDays && schedDays.length > 0) {
              itemDays = [schedDays[idx % schedDays.length]];
            }
            const itemScheduleName = customNameBase
              ? `${customNameBase} - ${bpTitle}`
              : `Multiplier: ${bpTitle} — ${schedGenTime} WIB`;
            return {
              name: itemScheduleName,
              brand_id: schedBrandId,
              preset_key: schedPresetKey,
              pipeline_type: 'multiplier_campaign',
              target_item_id: bpId,
              target_item_title: bpTitle,
              topic: bpTitle,
              category: 'multiplier',
              recipe_count: 1,
              generation_time: schedGenTime,
              publish_time: schedPubTime,
              days_of_week: itemDays,
              repliz_account_ids: schedReplizAccountIds,
              auto_publish_enabled: schedAutoPublish,
              timezone: 'Asia/Jakarta',
              pipeline_config: { blueprint_id: bpId, execution_mode: 'full_autopilot', generate_recipe: schedGenerateRecipe }
            };
          });

          const res = await fetch('/api/v2/recipes/auto-pipeline-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Gagal membuat jadwal batch multiplier');
          showToast(`Berhasil membuat ${items.length} baris jadwal multiplier independen! 🔀`);
```
