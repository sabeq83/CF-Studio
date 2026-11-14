# Implementation Plan — F1: Metaphor World Kit Library + Rotasi Anti-Repeat

> Status: **RENCANA — menunggu persetujuan. Belum ada kode yang diubah.**
> Induk: [USULAN_VISUAL_METAFORA_HERBAL.md](USULAN_VISUAL_METAFORA_HERBAL.md) (U1 + U2)
> Tanggal: 2026-11-14

## 1. Tujuan

1. Mengganti pemetaan statis **1 topik = 1 metafora** (`lib/health-metaphors.js`) dengan **library Metaphor World Kit**: banyak kit per topik, dengan setiap kit membawa dunia benda, latar, arc lighting, SFX, dan kalimat jembatan VO sendiri.
2. **Rotasi anti-repeat per brand**: video ke-N tidak memakai kit yang sama dengan 6 video terakhir brand tersebut.
3. **Backward-compatible**: bentuk `resolved_health_metaphor` tetap (`label`, `archetype_label`, `hook_metaphor`, `environment`), sehingga UI dan prompt lama tetap jalan. Field kit hanya ditambahkan.
4. Diaktifkan dengan **feature flag per tenant**. Default OFF.

### Di luar cakupan F1 (masuk F2/F3)
- Aturan "ZERO HANDS" dan "produk dilarang pre-bridge" **tidak diubah**. Karena itu, semua beat pre-bridge di kit F1 ditulis **object-only (self-operating physics)**. Varian dengan tangan disiapkan sebagai field `hand_variant`, tapi belum dipakai.
- Latar per brand (`allocator.js:209`) belum dilonggarkan. Kit F1 hanya mengisi latar di blok metaforik `prompts.js`, yang memang sudah memakai `metaDetail.environment`.
- Kit kustom per tenant (tabel kit + UI editor) dan AI builder kit (F5).
- Path selain Pillar/OPC (`re-campaigns`, `sheets`) tetap memakai fallback lama di `prompts.js:1867`.

---

## 2. Kondisi saat ini (alur data)

```
processPillarGenerator (lib/scheduler-processors.js:5116)
 └─ :5356  resolveHealthMetaphor(rowCandidate | campaignCandidate)   ← statis, keyword-match
       → tempCampaign.resolved_health_metaphor
 └─ buildOrganicPillarPrompt (lib/prompts.js)
       :1867 detectedMetaphorEarly = campaignData.resolved_health_metaphor || resolveHealthMetaphor(...)
       :2312 metaDetail.hook_metaphor → clip1ExecutionMandate, metaDetail.environment
       :2684 metaDetail → contoh t2i_prompts klip 1
 └─ :6035  parsed.resolved_health_metaphor → result_json
 └─ UI app/pillar-campaigns/[id]/page.js:2395  badge "🎭 Metafora Objek: {label} ({archetype_label})"
```

---

## 3. Desain

### 3.1 Skema Kit (`lib/metaphor-world-kits.js`)
```js
{
  key: 'grease_in_water',                 // unik, snake_case
  label: 'Minyak Bandel di Gelas Air',
  genre: 'kitchen_science_demo',          // asmr_cleaning | kitchen_science_demo | household_physics | pov_regret | tension_object
  topics: ['kolesterol', 'detox'],        // key HEALTH_METAPHOR_MAP + alias tambahan
  source: 'bundayes_grease_trap',         // jejak asal (dokumen) atau 'original'
  object_world: 'A clear drinking glass of water on a bright white ceramic home-kitchen table',
  environment: 'Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table',
  beats: {                                 // OBJECT-ONLY (kompatibel F1)
    problem:   'A thick stream of dark-yellow used frying oil pours into clear water, swirling but refusing to mix',
    threat:    'Extreme close-up of a stubborn greasy yellow layer floating heavily on the surface',
    struggle:  'The liquid is violently agitated by an unseen vortex; oil and water fight',
    failure:   'Motion stops; the oil instantly separates back to a messier top layer, water below turns cloudy',
    reaction:  'Fine bone-white herbal powder settles onto the oil; the layer breaks into heavy clumps that sink',
    result:    'Crystal-clear water with clumps resting at the bottom, light refracting beautifully'
  },
  hand_variant: { struggle: 'A modest long-sleeved hand stirs aggressively with a metal spoon' }, // dipakai mulai F2
  lighting_arc: { from: 'harsh high-contrast greasy light, darker background', to: 'high-key fresh morning light' },
  sfx_palette: ['thick liquid pour', 'low tense drone', 'liquid churn', 'soft sink plop', 'sparkle chime'],
  vo_bridge: 'Bayangkan minyak yang menolak larut ini seperti pola makan tinggi gorengan dan santan yang sulit kita imbangi.',
  compliance_note: 'Jangan klaim membakar/membuang lemak tubuh. Gunakan "membantu" / "pendamping pola makan".',
  thumbnail: { top: 'MINYAK BANDEL?', bottom: 'JERNIH LAGI' }
}
```
Fungsi helper `toLegacyMetaphorShape(kit)` mengembalikan:
```js
{ key, label, archetype: kit.genre, archetype_label: GENRE_LABEL[kit.genre],
  hook_metaphor: kit.beats.problem, environment: kit.environment,
  kit_key: kit.key, kit }   // field tambahan; konsumen lama mengabaikannya
```

### 3.2 Seed library awal (28 kit)

Diambil dari 28 dokumen Bundayes yang terbaca, ditambah 8 kit orisinal untuk topik yang belum tercakup. Seluruh beat ditulis ulang menjadi object-only.

| # | key | genre | topics | sumber |
|---|---|---|---|---|
| 1 | grease_in_water | kitchen_science_demo | kolesterol, detox | Grease Trap |
| 2 | oil_powder_emulsify | kitchen_science_demo | kolesterol, pencernaan | Emulsification Test |
| 3 | clogged_clear_tube | asmr_cleaning | pencernaan, detox | Clogged Tube |
| 4 | sink_drain_unclog | asmr_cleaning | pencernaan, detox | Drain Unclog |
| 5 | carpet_deep_clean | asmr_cleaning | kesehatan_kulit, detox | Carpet Clean |
| 6 | greasy_pan_scrub | asmr_cleaning | kolesterol | Deep Pan Scrub |
| 7 | greasy_tupperware | asmr_cleaning | kolesterol, pencernaan | Greasy Tupperware |
| 8 | soaked_sponge_squeeze | household_physics | detox, sirkulasi_darah | Sponge Squeeze |
| 9 | sponge_filter_barrier | kitchen_science_demo | gula_darah | Absorption Barrier |
| 10 | iron_filings_magnet | household_physics | detox | Magnetic Field |
| 11 | damp_match_ignition | household_physics | stamina | Energy Burn |
| 12 | apple_oxidation | kitchen_science_demo | anti_oksidan, kesehatan_kulit | Oxidation Test |
| 13 | heavy_suitcase_repack | tension_object | stamina | Heavy Suitcase |
| 14 | strained_jeans_button | tension_object | pencernaan | Turbo Jeans |
| 15 | oscilloscope_stress | tension_object | fungsi_otak, gula_darah | Cortisol Hack |
| 16 | dusty_mirror_wipe | asmr_cleaning | kesehatan_kulit | Dull Reflection |
| 17 | santan_food_coma | pov_regret | pencernaan, stamina | Santan Coma |
| 18 | midnight_martabak_box | pov_regret | gula_darah, pencernaan | Midnight Martabak |
| 19 | gorengan_oil_paper | pov_regret | kolesterol, kesehatan_kulit | Gorengan Trap |
| 20 | ayce_plate_tower | pov_regret | pencernaan | AYCE Aftermath |
| 21 | rusty_hinge_free | household_physics | persendian | orisinal |
| 22 | crusted_sugar_pot | asmr_cleaning | gula_darah | orisinal |
| 23 | kettle_limescale | asmr_cleaning | liver, detox | orisinal |
| 24 | foggy_window_clear | household_physics | asma, flu, alergi | orisinal |
| 25 | tangled_cables_untangle | tension_object | fungsi_otak, alzheimer | orisinal |
| 26 | clogged_showerhead | asmr_cleaning | sirkulasi_darah, kesehatan_jantung | orisinal |
| 27 | sizzling_pan_cooldown | household_physics | maag, anti_inflamasi | orisinal |
| 28 | cracked_soil_watering | household_physics | kesehatan_tulang, kesehatan_kulit | orisinal |

Catatan kepatuhan: `pencegahan_kanker` dan `kandungan_wanita` **sengaja tidak diberi kit** karena risiko klaimnya tinggi. Kedua topik tetap jatuh ke metafora lama (abstrak). Hasil cakupan: setiap topik utama herbal (kolesterol, pencernaan, gula_darah, detox, kulit) punya ≥4 kit.

### 3.3 Deteksi topik (multi-topic)
Tambahkan `detectHealthTopics(text) → string[]` di `lib/health-metaphors.js`. Fungsi ini memakai ulang aturan keyword dan alias yang sudah ada, tapi mengembalikan **semua** topik yang cocok. Ditambah alias baru: `lemak|gorengan|santan|langsing|diet → kolesterol`, `begah|sembelit|bab → pencernaan`, `kusam|jerawat → kesehatan_kulit`, `lesu|capek|lelah → stamina`, `stres|cortisol → fungsi_otak`. `resolveHealthMetaphor` **tidak diubah**.

### 3.4 Resolver rotasi (`lib/metaphor-kit-resolver.js`)
```
resolveMetaphorKit({ text, tenantId, brandProfileId, campaignId, itemId, explicitKitKey, window = 6 })
1. explicitKitKey (rowPayload.metaphor_kit_key) valid      → pakai, reason 'explicit'
2. usage existing untuk itemId (regenerate item yang sama)  → pakai kit yang sama, reason 'sticky'
3. topics = detectHealthTopics(text); candidates = kit dengan topics ∩ ≠ ∅
   candidates kosong                                        → return null (fallback ke resolveHealthMetaphor lama)
4. recent = kit_key dari N usage terakhir (tenant + brand), urut used_at DESC
5. pool = candidates \ recent; bila kosong → candidates diurutkan LRU (paling lama dipakai dulu)
6. pilih pool[stableHash(itemId) % pool.length]             → deterministik untuk retry
7. upsert usage (item_id unik), return { kit, reason, topics }
```
- Usage dicatat **saat resolve** (reservasi), bukan saat selesai. Ini mencegah dua item paralel dalam satu batch mengambil kit yang sama. Konsekuensinya, item yang gagal tetap "memakan" satu slot rotasi. Ini diterima.
- Bila DB error, resolver tetap memilih secara acak-deterministik **tanpa** rotasi dan memberi warning log. Generate tidak boleh gagal hanya karena tabel usage.

### 3.5 Tabel usage (migrasi baru di `lib/db-pg.js`)
```sql
CREATE TABLE IF NOT EXISTS metaphor_kit_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT,
  campaign_id TEXT,
  item_id TEXT NOT NULL UNIQUE,
  kit_key TEXT NOT NULL,
  topic_keys TEXT,
  reason TEXT,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mku_brand_recent ON metaphor_kit_usage (tenant_id, brand_profile_id, used_at DESC);
```
Sesuai SOP deployment, build memakai `DISABLE_AUTO_MIGRATIONS=true`, jadi migrasi ini juga perlu dijalankan sekali secara eksplisit per schema (`dev`, `staging`) lewat script `scripts/migrate-metaphor-kit-usage.mjs` (idempotent).

### 3.6 Feature flag
`getSetting('metaphor_kit_engine', false) === 'on'`. Parameter `allowDefaultFallback=false` **wajib dipakai** karena `getSetting` (`lib/db.js:610`) secara default fallback ke `default_tenant`. Tanpa itu, flag yang dinyalakan di staging default akan bocor ke tenant lain.

---

## 4. Perubahan per file (Before / After)

### 4.1 `lib/metaphor-world-kits.js` — **BARU**
Berisi `METAPHOR_WORLD_KITS` (28 kit), `GENRE_LABEL`, `getKit(key)`, `listKitsByTopics(topics)`, `toLegacyMetaphorShape(kit)`, dan `validateKit(kit)` (field wajib, beats lengkap, topics tidak kosong).

### 4.2 `lib/metaphor-kit-resolver.js` — **BARU**
Berisi `resolveMetaphorKit(...)` (3.4) dan `stableHash(str)`. Dependency akses DB di-inject (`{ getRecentKitKeys, getUsageForItem, upsertUsage }`) supaya bisa diuji tanpa Postgres.

### 4.3 `lib/metaphor-kit-usage-repository.js` — **BARU**
Berisi `getRecentKitKeys(tenantId, brandProfileId, limit)`, `getUsageForItem(itemId)`, dan `upsertUsage(row)` via `pgQuery`.

### 4.4 `lib/health-metaphors.js`
**Before** (akhir file, `:192`):
```js
export function resolveHealthMetaphor(topicText = '') { ... }
```
**After** (tambahan saja, fungsi lama tidak disentuh):
```js
export function resolveHealthMetaphor(topicText = '') { ... }   // tidak berubah

const EXTRA_TOPIC_ALIASES = [
  [/lemak|gorengan|santan|langsing|diet/, 'kolesterol'],
  [/begah|sembelit|\bbab\b/, 'pencernaan'],
  [/kusam|jerawat/, 'kesehatan_kulit'],
  [/lesu|capek|lelah/, 'stamina'],
  [/stres|stress|cortisol/, 'fungsi_otak'],
];

export function detectHealthTopics(topicText = '') {
  // memakai kunci HEALTH_METAPHOR_MAP + alias lama + EXTRA_TOPIC_ALIASES, kembalikan array unik
}
```

### 4.5 `lib/scheduler-processors.js` (`:5355–5378`)
**Before:**
```js
      // Resolve Health Metaphor jika kampanye menggunakan visual_style 'metaphoric_faceless' atau topik cocok (Row-First Priority)
      const { resolveHealthMetaphor } = await import('./health-metaphors.js');
      const rowCandidate = [ ...rowPayload fields... ].filter(Boolean).join(' ');
      let healthMeta = resolveHealthMetaphor(rowCandidate);
      if (!healthMeta) {
        const campaignCandidate = [ ...campaign fields... ].filter(Boolean).join(' ');
        healthMeta = resolveHealthMetaphor(campaignCandidate);
      }
      if (healthMeta) {
        tempCampaign.resolved_health_metaphor = healthMeta;
        rowPayload.resolved_health_metaphor = healthMeta;
      }
```
**After:**
```js
      const { resolveHealthMetaphor } = await import('./health-metaphors.js');
      const rowCandidate = [ ...tidak berubah... ].filter(Boolean).join(' ');
      const campaignCandidate = [ ...tidak berubah... ].filter(Boolean).join(' ');

      let healthMeta = null;
      if (getSetting('metaphor_kit_engine', false) === 'on') {
        try {
          const { resolveMetaphorKit } = await import('./metaphor-kit-resolver.js');
          const { toLegacyMetaphorShape } = await import('./metaphor-world-kits.js');
          const picked = await resolveMetaphorKit({
            text: `${rowCandidate} ${campaignCandidate}`,
            tenantId: campaign.tenant_id,
            brandProfileId: campaign.brand_profile_id || null,
            campaignId: campaign.id,
            itemId: item.id,
            explicitKitKey: rowPayload.metaphor_kit_key || null,
          });
          if (picked) {
            healthMeta = { ...toLegacyMetaphorShape(picked.kit), kit_reason: picked.reason, kit_topics: picked.topics };
            console.log(`[OPC MetaphorKit] item=${item.id} kit=${picked.kit.key} reason=${picked.reason}`);
          }
        } catch (err) {
          console.warn('[OPC MetaphorKit] fallback ke metafora statis:', err.message);
        }
      }
      if (!healthMeta) healthMeta = resolveHealthMetaphor(rowCandidate) || resolveHealthMetaphor(campaignCandidate);

      if (healthMeta) {
        tempCampaign.resolved_health_metaphor = healthMeta;
        rowPayload.resolved_health_metaphor = healthMeta;
      }
```
(`getSetting` sudah ada di import dinamis `./db.js` di bagian atas `processPillarGenerator` (`:5118`), jadi import tidak perlu diubah.)

Bagian `:6035` (menyimpan ke `result_json`) **tidak berubah**. Field kit ikut tersimpan otomatis.

### 4.6 `lib/prompts.js` — blok metaforik (`:2312–2358`)
**Before** (ringkas):
```js
  if (isMetaphoricFaceless) {
    const metaDetail = detectedMetaphor || { ...default abstrak... };
    ...
    const clip1ExecutionMandate = specificGuideline ? ... : `"""${metaDetail.hook_metaphor}"""`;
    vsoSection += `
...🚨 OBJECT-CENTRIC METAPHOR MANDATE ...
   - Klip 1 (Opening Hook Masalah): HANYA TERLIHAT BENDANYA SAJA ...
     ${clip1ExecutionMandate}
...`;
  }
```
**After** (tambahan blok kit; mandat lama tetap utuh):
```js
  if (isMetaphoricFaceless) {
    const metaDetail = detectedMetaphor || { ...tidak berubah... };
    const kit = metaDetail.kit || null;
    ...
    vsoSection += `...mandat lama tidak berubah...`;

    if (kit) {
      vsoSection += buildMetaphorWorldKitSection(kit, { targetClips, bridgeAtClip });
    }
  }
```
Fungsi baru `buildMetaphorWorldKitSection` (di `lib/metaphor-world-kits.js`) menghasilkan:
```
🌍 METAPHOR WORLD KIT: "<label>" (<genre>)
- Dunia benda (WAJIB konsisten di seluruh klip VIDEO INI): <object_world>
- Latar: <environment>
- Peta beat pre-bridging (object-only, fisika mandiri):
  * PROBLEM  → <beats.problem>
  * THREAT   → <beats.threat>
  * STRUGGLE → <beats.struggle>
  * FAILURE  → <beats.failure>
- Beat solusi (mulai Klip <bridgeAtClip>): REACTION → <beats.reaction>; RESULT → <beats.result>
- Arc lighting: <from> ➔ <to>
- Palet SFX: <sfx_palette>
- Jembatan VO (wajib 1 kalimat analogi, gaya bahasa boleh disesuaikan): "<vo_bridge>"
- Kepatuhan: <compliance_note>
```
Pemetaan 6 beat ke `targetClips` aktual dilakukan oleh `mapBeatsToClips(targetClips, bridgeAtClip)`. Beat pre-bridge dipadatkan atau direnggangkan sesuai jumlah klip sebelum bridge, dan tidak ada beat solusi sebelum bridge, supaya tetap patuh pada aturan "produk dilarang pre-bridge".

`:2684` (contoh `t2i_prompts` klip 1) memakai `metaDetail.hook_metaphor`. Karena shape legacy sudah mengisi field itu dengan `beats.problem`, **tidak perlu diubah**.

### 4.7 `app/pillar-campaigns/[id]/page.js` (`:2395–2420`) — opsional, perubahan kecil
**Before:**
```jsx
🎭 Metafora Objek: {meta.label} ({meta.archetype_label})
```
**After:**
```jsx
🎭 Metafora Objek: {meta.label} ({meta.archetype_label}){meta.kit_key ? ` · kit ${meta.kit_key}` : ''}{meta.kit_reason === 'explicit' ? ' · dipilih manual' : ''}
```
(Tidak ada warna baru. Tetap memakai token yang sudah ada. Karena perubahan UI hanya berupa teks, mockup HTML tidak diperlukan. Bila ingin tetap mengikuti SOP mockup, saya siapkan mockup di tahap terpisah.)

### 4.8 `lib/db-pg.js` + `scripts/migrate-metaphor-kit-usage.mjs`
Tambahkan migrasi `migrateMetaphorKitUsage` dengan pola advisory lock yang sama seperti `migrateVisualIdentityFoundation` (`:1952`), memakai lock key `makna_metaphor_kit_usage_v1`. Ditambah script mandiri untuk schema `dev`/`staging` karena auto-migration dimatikan saat build.

### 4.9 Tes — **BARU**
- `tests/metaphor-world-kits.test.js`: semua 28 kit lolos `validateKit`, key unik, setiap topik utama punya ≥4 kit, dan beat pre-bridge tidak mengandung kata `hand|finger|arm|bottle|capsule|product` (lint kepatuhan F1). Satu-satunya pengecualian adalah `beats.reaction`, yang memang terjadi di zona produk.
- `tests/metaphor-kit-resolver.test.js` (DB di-mock): explicit > sticky > rotasi; 7 resolve berturut-turut untuk brand yang sama dengan topik `kolesterol` tidak mengulang kit dalam window 6; brand berbeda tidak saling memengaruhi; retry item yang sama selalu mendapat kit yang sama; DB error → tetap mengembalikan kit; topik tanpa kit → `null`.
- `tests/health-metaphors-detect-topics.test.js`: alias baru + multi-topic. `resolveHealthMetaphor` lama tetap menghasilkan output yang sama (snapshot 22 topik).
- Regresi: `tests/garlibee-metaphor-visual-identities.test.js`, `tests/opc-planner-strategic-context.test.js` (memakai `resolved_health_metaphor`), `tests/test-visual-identity-allocator.mjs`.

---

## 5. Verifikasi
1. `node --test tests/metaphor-*.test.js tests/health-metaphors-detect-topics.test.js tests/garlibee-metaphor-visual-identities.test.js tests/opc-planner-strategic-context.test.js` → semua lulus.
2. `npm run build` lulus.
3. Staging (setelah persetujuan deploy): nyalakan flag **hanya** di tenant `default_tenant` (`metaphor_kit_engine=on`), lalu buat 1 OPC campaign DapurBotani dengan 7 baris topik kolesterol/pencernaan.
   - Cek `result_json.resolved_health_metaphor.kit_key`: 7 baris → ≥6 kit berbeda.
   - Cek isi `metaphor_kit_usage` di schema `staging`.
   - Generate ulang 1 item → kit tetap sama (sticky).
   - Contact sheet 3×3: bandingkan dengan 7 video lama DapurBotani.
4. Matikan flag → perilaku kembali 100% seperti lama (cek 1 item).

## 6. Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| Latar brand (`allocator.js:209`) masih mengunci *black slate* dan bertabrakan dengan latar kit | Di F1, hal ini hanya berlaku bila campaign memakai visual identity schema v2. Untuk uji F1, gunakan campaign `metaphoric_faceless` tanpa VI v2, atau terima benturan ini sampai F2. **Hasil F1 akan lebih terasa setelah F2.** |
| Kit object-only terasa kaku tanpa tangan | Disengaja untuk F1 (patuh aturan sekarang). Field `hand_variant` disiapkan untuk F2. |
| Flag bocor ke tenant lain | `getSetting(..., false)` + tes. |
| Klaim kesehatan berlebihan di VO | `compliance_note` + `vo_bridge` aman per kit. COMPLIANCE_GUIDE KB tetap aktif. |
| Migrasi tidak jalan karena `DISABLE_AUTO_MIGRATIONS` | Script migrasi eksplisit + fallback resolver tanpa rotasi bila tabel tidak ada. |

## 7. Keputusan yang dibutuhkan
> **2026-11-14:** F1 dirilis **bersama F2** dalam satu rilis. Urutan eksekusi gabungan ada di [execution_order_F1_F2.md](execution_order_F1_F2.md). Nomor baris `lib/prompts.js` di dokumen ini bergeser ±42 baris akibat v2.45.0 (`:2312` → `:2349`).

1. **Penyimpanan kit:** usulan saya F1 = file JS (`lib/metaphor-world-kits.js`, versioned di Git) dan tabel DB hanya untuk usage. Tabel kit per-tenant + UI menyusul di F5. Setuju?
2. **Window rotasi:** default 6 video per brand. Perlu angka lain?
3. **Perubahan teks badge UI (4.7):** ikut di F1 atau dilewati?
4. Setelah implementasi dan tes lulus, apakah saya boleh menjalankan **release + deploy ke staging** sesuai SOP, atau Anda yang menjalankannya?

---

## Execution Task List
- [x] T1. Tambah `detectHealthTopics` + alias baru di `lib/health-metaphors.js` + tes snapshot `resolveHealthMetaphor`
- [x] T2. Buat `lib/metaphor-world-kits.js` (skema, `validateKit`, `toLegacyMetaphorShape`, `buildMetaphorWorldKitSection`, `mapBeatsToClips`)
- [x] T3. Tulis 28 seed kit (20 dari Bundayes, 8 orisinal), object-only, dengan `vo_bridge` + `compliance_note`
- [x] T4. Tes `tests/metaphor-world-kits.test.js` (validasi, cakupan topik, lint kata terlarang pre-bridge)
- [x] T5. Buat `lib/metaphor-kit-usage-repository.js` + migrasi di `lib/db-pg.js` + `scripts/migrate-metaphor-kit-usage.mjs`
- [x] T6. Buat `lib/metaphor-kit-resolver.js` + `tests/metaphor-kit-resolver.test.js` (explicit/sticky/rotasi/LRU/DB error/isolasi brand)
- [x] T7. Integrasi di `lib/scheduler-processors.js:5355` di balik flag `metaphor_kit_engine` (tanpa fallback default_tenant)
- [x] T8. Integrasi `buildMetaphorWorldKitSection` di `lib/prompts.js:2312`
- [x] T9. (Opsional, sesuai keputusan 3) Teks badge kit di `app/pillar-campaigns/[id]/page.js:2395`
- [x] T10. Jalankan tes regresi + `npm run build`
- [ ] T11. (Atas persetujuan) Rilis + migrasi schema staging + deploy staging + nyalakan flag di `default_tenant`
- [ ] T12. Uji 7 baris DapurBotani di staging, contact sheet, laporan perbandingan
