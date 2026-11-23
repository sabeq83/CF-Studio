# Implementation Plan: Opsi Campaign Multiplier & Recipe Labs di Preset Manager, Auto Pipeline, dan Multiplier Labs

**Branch**: `fitur/preset-multiplier-options`  
**Dasar Usulan**: [USULAN_PERBAIKAN_PRESET_MULTIPLIER_AUTOPIPELINE.md](catatan-kerja/usulan/USULAN_PERBAIKAN_PRESET_MULTIPLIER_AUTOPIPELINE.md)  
**Mockup Disetujui**: [mockup_preset_multiplier_autopipeline.html](public/mockup_preset_multiplier_autopipeline.html)

---

## Execution Task List

- [x] Buat branch `fitur/preset-multiplier-options` dari `main` terbaru
- [x] Susun `implementation_plan.md` dengan `Code Sebelum` & `Code Sesudah`
- [x] Lengkapi opsi `multiplier_campaign` dan `recipe_labs` di fieldset `Digunakan untuk Campaign` pada `app/settings/presets/page.js`
- [x] Perbaiki `campaign_kinds` pada *Save as Preset* di `app/components/campaign-forms/MultiplierConfigurationForm.js`
- [x] Perbaiki fallback preset key `multiplier_campaign` dan tambahkan petunjuk cepat ke Preset Manager di `app/auto-pipeline/page.js`
- [x] Tambahkan unit test kompatibilitas `multiplier_campaign` dan `recipe_labs` di `tests/operator-preset-roundtrip.test.js`
- [x] Perbarui kartu menu `sot/menus/kartu/presets.md` dan `sot/menus/kartu/auto-pipeline.md`
- [x] Jalankan unit test & build verifikasi lokal (`npm run build` / `node --test`)
- [x] Commit & push branch `fitur/preset-multiplier-options`, lalu deploy ke Dev (`http://100.95.245.55:5020`)

---

## Perubahan Kode (Before & After)

### 1. `app/settings/presets/page.js`

**Code Sebelum (Current/Before):**
```jsx
              <fieldset style={{marginTop:16,border:'1px solid var(--border-color)',borderRadius:8,padding:12}}><legend>Digunakan untuk Campaign</legend><div style={{display:'flex',gap:18,flexWrap:'wrap'}}>{[['brand_editorial','Brand Editorial'],['product_campaign','Product Campaign'],['recipe_campaign','Recipe Campaign']].map(([kind,label])=><label key={kind} style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={form.campaign_kinds.includes(kind)} onChange={event=>setForm({...form,campaign_kinds:event.target.checked?[...new Set([...form.campaign_kinds,kind])]:form.campaign_kinds.filter(value=>value!==kind)})}/>{label}</label>)}</div>{form.campaign_kinds.length===0&&<small style={{color:'var(--status-danger)'}}>Pilih minimal satu jenis campaign.</small>}</fieldset>
```

**Code Sesudah (Proposed/After):**
```jsx
              <fieldset style={{ marginTop: 16, border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                <legend>Digunakan untuk Campaign</legend>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {[
                    ['brand_editorial', 'Brand Editorial'],
                    ['product_campaign', 'Product Campaign'],
                    ['recipe_campaign', 'Recipe Campaign'],
                    ['multiplier_campaign', 'Campaign Multiplier (Multiplier Remix)'],
                    ['recipe_labs', 'Recipe Labs (Teks & Foto)']
                  ].map(([kind, label]) => (
                    <label key={kind} style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.campaign_kinds.includes(kind)}
                        onChange={event =>
                          setForm({
                            ...form,
                            campaign_kinds: event.target.checked
                              ? [...new Set([...form.campaign_kinds, kind])]
                              : form.campaign_kinds.filter(value => value !== kind)
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {form.campaign_kinds.includes('multiplier_campaign') && (
                  <small style={{ display: 'block', marginTop: 8, color: 'var(--text-muted)' }}>
                    Preset ini akan tampil di Auto Pipeline saat memilih tipe kampanye Video Multiplier.
                  </small>
                )}
                {form.campaign_kinds.length === 0 && (
                  <small style={{ display: 'block', marginTop: 6, color: 'var(--status-danger)' }}>
                    Pilih minimal satu jenis campaign.
                  </small>
                )}
              </fieldset>
```

---

### 2. `app/components/campaign-forms/MultiplierConfigurationForm.js`

**Code Sebelum (Current/Before):**
```js
    const presetConfig = {
      schema_version: '2',
      label: newPresetLabel.trim(),
      campaign_kinds: isBridgingActive ? ['product_campaign'] : ['brand_editorial'],
```

**Code Sesudah (Proposed/After):**
```js
    const presetConfig = {
      schema_version: '2',
      label: newPresetLabel.trim(),
      campaign_kinds: isBridgingActive ? ['multiplier_campaign', 'product_campaign'] : ['multiplier_campaign'],
```

---

### 3. `app/auto-pipeline/page.js`

**Code Sebelum (Current/Before) — Fallback key & openCreateScheduleModal:**
```js
          let effectiveKey = opList[0]?.key || (instantCampaignType === 'product_campaign' ? 'product_campaign' : (instantCampaignType === 'editorial_campaign' ? 'brand_editorial_campaign' : 'recipe_campaign_default'));
```
```js
    setSchedPresetKey(selectedPresetKey || 'habitfolk_6clips_quick');
```

**Code Sesudah (Proposed/After):**
```js
          const fallbackKeyByType = {
            product_campaign: 'product_campaign',
            editorial_campaign: 'brand_editorial_campaign',
            multiplier_campaign: 'multiplier_deconstruct_remix',
            recipe_labs: 'recipe_labs_editorial_food',
            recipe_campaign: 'recipe_campaign'
          };
          let effectiveKey = opList[0]?.key || fallbackKeyByType[instantCampaignType] || 'recipe_campaign';
```
```js
    setSchedPresetKey(
      instantCampaignType === 'multiplier_campaign' && selectedPresetKey
        ? selectedPresetKey
        : 'multiplier_deconstruct_remix'
    );
```

**Code Sebelum (Current/Before) — Dropdown Preset Video:**
```jsx
                    })()}
                  </select>
                </div>
```

**Code Sesudah (Proposed/After):**
```jsx
                    })()}
                  </select>
                  {instantCampaignType === 'multiplier_campaign' && operatorPresets.length <= 1 && (
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Menampilkan preset bertag Campaign Multiplier. Untuk menambah preset brand Anda, clone atau centang &quot;Campaign Multiplier&quot; di{' '}
                      <Link href="/settings/presets" style={{ color: 'var(--link)', fontWeight: 600 }}>
                        Preset Manager
                      </Link>.
                    </div>
                  )}
                </div>
```

---

### 4. `tests/operator-preset-roundtrip.test.js`

**Code Sebelum (Current/Before):**
```js
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'brand_editorial'), true);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'product_campaign'), false);
});
```

**Code Sesudah (Proposed/After):**
```js
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'brand_editorial'), true);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'product_campaign'), false);
  assert.equal(isOperatorPresetCompatible('multiplier_deconstruct_remix', 'multiplier_campaign'), true);
  assert.equal(isOperatorPresetCompatible('recipe_labs_editorial_food', 'recipe_labs'), true);
});
```
Plus tambahan test multi-tenant custom preset dengan `campaign_kinds: ['multiplier_campaign', 'product_campaign']` untuk memastikan `listOperatorPresetsForCampaignKind('multiplier_campaign', ...)` meloloskan preset clone/custom yang mencentang `multiplier_campaign`.
