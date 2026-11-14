# Implementation Plan — F2: Latar Ikut Metafora, Tangan Syar'i Aktif, Produk di Dalam Metafora, Konflik 3D

> Status: **RENCANA — menunggu persetujuan. Belum ada kode yang diubah.**
> Induk: [USULAN_VISUAL_METAFORA_HERBAL.md](USULAN_VISUAL_METAFORA_HERBAL.md) (U3 + U6). Bergantung pada [F1](implementation_plan_F1.md) untuk sumber latar (kit).
> Tanggal: 2026-11-14
> Catatan: nomor baris mengacu ke `main` @ `5b42ad7` (v2.45.0). Rilis v2.45.0 menggeser baris `lib/prompts.js` ±42 baris dibanding saat F1 ditulis. Referensi baris di F1 (`prompts.js:2312`) sekarang berada di `:2349`, dan akan disesuaikan saat eksekusi.

## 1. Tujuan

F1 memberi **variasi dunia metafora**. F2 membuka **cara dunia itu ditampilkan**, yang selama ini dikunci oleh empat aturan:

| # | Aturan saat ini | Akibat | Perubahan F2 |
|---|---|---|---|
| A | Latar dikunci per brand (`allocator.js:209`, `prompts.js:2342`) | Semua video DapurBotani berlatar *black slate* | `environment_policy: metaphor_driven`: latar ikut kit, konsisten **per video** |
| B | Pre-bridge **ZERO HANDS** (5 lokasi) | Aksi kaku, tanpa efek ASMR | `hands_policy: modest_hands_active`: tangan syar'i (wrists covered) boleh berakting |
| C | Klip produk pindah ke set studio brand + lighting brand menimpa semua klip | Metafora dan produk jadi dua cerita terpisah; arc kotor → bersih hilang | `product_entry: inside_metaphor` + `lighting_arc`: produk masuk ke dunia metafora yang sama, lighting mengikuti arc kit |
| D | VI DapurBotani me-routing `mechanism → 3d_bio_cellular` (dan auto-inject di `allocator.js:103-108`), sementara mode metaforik melarang 3D | Perintah bertentangan → hasil generik | Saat mode metaforik aktif, route 3D di-remap ke style non-3D |

### Prinsip
- **Default = perilaku lama.** Semua switch bernilai lama kecuali diaktifkan eksplisit di Visual Identity. Tidak ada brand lain yang berubah.
- **Produk tetap DILARANG pre-bridge.** F2 tidak mengubah bridge plan, start-frame requirement, atau gateway sanitizer produk. Yang berubah hanya *di mana dan bagaimana* produk tampil pada klip produk.
- **Satu sumber kebenaran.** Policy di-resolve **sekali** di `processPillarGenerator`, disimpan di `tempCampaign.resolved_metaphor_policy`, lalu dibaca oleh prompt builder, sanitizer, dan start-frame.

### Di luar cakupan F2
- Path Reverse Engineering (`prompts.js:1164`, `:1423`) dan Multiplier: tidak disentuh.
- Genre pool & beat grammar penuh (F3), identity herbal baru (F4).
- Mode investigatif faceless: aturan zero-hands-nya **tetap**.

---

## 2. Desain

### 2.1 Field baru di Visual Identity (`lib/visual-identity-contract.js`)
Menambahkan tiga field (subset U4; field lainnya menyusul di F3):
```js
environment: { ..., policy: 'brand_locked' }          // 'brand_locked' (default) | 'metaphor_driven'
metaphor_engine: {
  enabled, pattern,                                   // lama
  hands_policy: 'zero_hands',                         // 'zero_hands' (default) | 'modest_hands_active'
  product_entry: 'after_bridge',                      // 'after_bridge' (default) | 'inside_metaphor'
  lighting_arc: 'none'                                // 'none' (default) | 'kit'
}
```
Validasi:
- `hands_policy = modest_hands_active` **wajib** `wardrobe.sleeve_policy = 'wrists_covered'`. Bila tidak, dikoreksi menjadi `wrists_covered` dan dicatat di compliance report.
- `subject.kind` harus `human` dengan faceless mode `hands_only | first_person_pov | crop_below_neck`. Selain itu, `hands_policy` dipaksa kembali ke `zero_hands`.

### 2.2 Resolver policy (`lib/metaphor-policy.js` — BARU)
```js
resolveMetaphorPolicy({ viConfig, isMetaphoricFaceless, isInvestigativeFaceless, kit }) → {
  active: boolean,               // true hanya bila isMetaphoricFaceless && !isInvestigativeFaceless
  environmentPolicy,             // 'metaphor_driven' hanya bila VI meminta DAN kit ada; selain itu 'brand_locked'
  handsPolicy,                   // 'modest_hands_active' | 'zero_hands'
  productEntry,                  // 'inside_metaphor' hanya bila kit ada; selain itu 'after_bridge'
  lightingArc,                   // { from, to } dari kit bila VI 'kit' DAN kit ada; selain itu null
  sceneEnvironment,              // kit.environment | null
  objectWorld,                   // kit.object_world | null
  handVariant,                   // kit.hand_variant | null
  reasons: []                    // jejak keputusan untuk log & UI
}
```
Turunan fail-safe: tanpa kit (F1 off atau topik tidak cocok), `metaphor_driven`, `inside_metaphor`, dan `kit` lighting jatuh kembali ke perilaku lama. Hanya `hands_policy` yang tetap berlaku tanpa kit.

### 2.3 Perilaku per zona klip saat semua switch aktif

| Zona | Latar | Tangan | Produk | Lighting |
|---|---|---|---|---|
| Pre-bridge (Klip 1) | `kit.environment` | Boleh, tapi **disarankan** Klip 1 tetap object-only sebagai hook | Dilarang (tidak berubah) | `lighting_arc.from` |
| Pre-bridge (Klip 2…bridge-1) | `kit.environment` | Tangan syar'i aktif (`hand_variant` dari kit) | Dilarang | `lighting_arc.from` |
| Klip produk / bridge | **Tetap di `kit.environment`** (bukan studio brand) | Tangan syar'i | Produk sebagai agen: isi kapsul/cairan masuk ke benda metafora (`beats.reaction`) | transisi `from` → `to` |
| Gap/Post tanpa produk | `kit.environment` | Tangan syar'i | Dilarang (tidak berubah) | `lighting_arc.to` |
| Klip terakhir (Hero/CTA) | `kit.environment` versi bersih (`beats.result`) | Tangan mengambil produk | Botol utuh + Product Truth Lock | `lighting_arc.to` |

---

## 3. Perubahan per file (Before / After)

### 3.1 `lib/visual-identity-contract.js` (`:171` + blok `environment` `:228`)
**Before:**
```js
function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: typeof inputMetaphor?.enabled === 'boolean' ? inputMetaphor.enabled : true,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action')
  };
}
...
    environment: {
      preset_key: 'nordic_kitchen',
      ...
      background_density: 'balanced',
      ...(input.environment || {})
    },
```
**After:**
```js
export const ENVIRONMENT_POLICIES = ['brand_locked', 'metaphor_driven'];
export const HANDS_POLICIES = ['zero_hands', 'modest_hands_active'];
export const PRODUCT_ENTRIES = ['after_bridge', 'inside_metaphor'];
export const LIGHTING_ARCS = ['none', 'kit'];
const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);

function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: typeof inputMetaphor?.enabled === 'boolean' ? inputMetaphor.enabled : true,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action'),
    hands_policy: pick(inputMetaphor?.hands_policy, HANDS_POLICIES, 'zero_hands'),
    product_entry: pick(inputMetaphor?.product_entry, PRODUCT_ENTRIES, 'after_bridge'),
    lighting_arc: pick(inputMetaphor?.lighting_arc, LIGHTING_ARCS, 'none')
  };
}
...
    environment: {
      preset_key: 'nordic_kitchen',
      ...
      background_density: 'balanced',
      ...(input.environment || {}),
      policy: pick(input.environment?.policy, ENVIRONMENT_POLICIES, 'brand_locked')
    },
```
Ditambah koreksi `sleeve_policy` dan `subject.kind` (2.1) di akhir `validateAndNormalizeVisualIdentity`, serta entri baru di `buildVisualIdentityComplianceReport` (`lib/visual-identity-ai-contract.js`).

### 3.2 `lib/metaphor-policy.js` — **BARU**
Berisi `resolveMetaphorPolicy` (2.2) dan helper teks yang dipakai ulang:
- `presenceTruthTuple(policy, zone)`: pada mode lama mengembalikan string `ABSOLUTELY ZERO HANDS…` yang **persis sama** dengan sekarang (agar snapshot lama tetap lulus). Pada mode aktif mengembalikan `(Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms)`.
- `environmentTuple(policy, fallback)` dan `lightingTupleForClip(policy, clipIndex, bridgePlan)`.

### 3.3 `lib/scheduler-processors.js` — resolve policy (setelah blok metafora F1, `:5385–5408`)
> **Verifikasi A1:** Di `processPillarGenerator`, snapshot VI yang ter-resolve disimpan di variabel lokal `visualOverrides` (`lib/scheduler-processors.js:5184–5237`), bukan `tempCampaign.visual_identity_snapshot`. Maka `viConfig` dibaca dari `visualOverrides?.structured || visualOverrides || null`. Baris simpan ke `parsed` saat ini berada di `:6212–6215`.

**Before:** (tidak ada)
**After:**
```js
      const { resolveMetaphorPolicy } = await import('./metaphor-policy.js');
      tempCampaign.resolved_metaphor_policy = resolveMetaphorPolicy({
        viConfig: visualOverrides?.structured || visualOverrides || null,
        isMetaphoricFaceless: (tempCampaign.visual_style || rowPayload.visual_style) === 'metaphoric_faceless' || Boolean(healthMeta),
        isInvestigativeFaceless: (tempCampaign.visual_style || rowPayload.visual_style) === 'investigative_faceless',
        kit: healthMeta?.kit || null
      });
```

Simpan juga ke hasil (`:6212–6215` sekarang):
**Before:**
```js
    if (tempCampaign.resolved_health_metaphor) {
      parsed.resolved_health_metaphor = tempCampaign.resolved_health_metaphor;
    }
```
**After:**
```js
    if (tempCampaign.resolved_health_metaphor) {
      parsed.resolved_health_metaphor = tempCampaign.resolved_health_metaphor;
    }
    if (tempCampaign.resolved_metaphor_policy?.active) {
      parsed.resolved_metaphor_policy = tempCampaign.resolved_metaphor_policy;
    }
```

### 3.4 `lib/scheduler-processors.js` — `applyPromptReplacements` (`:158–175`)
**Before:**
```js
    if (isPreBridgeClip && isMetaphoricFaceless) {
      s = s.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=...)/gi, `(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)`);
      s = s.replace(/\(Wardrobe:\s*.*?\)(?=...)/gi, ``);
      s = s.replace(/\(Product (?:Truth|Reference File):\s*.*?\)(?=...)/gi, `(Geometric Truth: strictly no product shown, ...)`);
    } else if (!isMascotUniverse) {
      ...
      s = s.replace(/\(Lighting:\s*.*?\)(?=...)/gi, `(Lighting: ${targetLighting})`);
```
**After:**
```js
    const policy = campaign?.resolved_metaphor_policy || null;
    const handsActive = policy?.active && policy.handsPolicy === 'modest_hands_active';
    const isClip1 = Number(clipIndex) === 1;
    if (isPreBridgeClip && isMetaphoricFaceless) {
      if (handsActive && !isClip1) {
        s = s.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=...)/gi, presenceTruthTuple(policy, 'pre'));
        // Wardrobe DIPERTAHANKAN agar lengan tertutup konsisten
        s = s.replace(/\(Wardrobe:\s*.*?\)(?=...)/gi, `(Wardrobe: ${targetWardrobe})`);
      } else {
        // perilaku lama (termasuk Klip 1 yang tetap object-only sesuai Keputusan #4), string identik
        s = s.replace(/.../gi, `(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)`);
        s = s.replace(/\(Wardrobe:\s*.*?\)(?=...)/gi, ``);
      }
      s = s.replace(/\(Product (?:Truth|Reference File):.../gi, `(Geometric Truth: strictly no product shown, ...)`);   // tidak berubah
      const preArcLighting = lightingTupleForClip(policy, clipIndex, replBridgePlan);
      if (preArcLighting) {
        s = s.replace(/\(Lighting:\s*.*?\)(?=...)/gi, `(Lighting: ${preArcLighting})`);
      }
    } else if (!isMascotUniverse) {
      ...
      const arcLighting = lightingTupleForClip(policy, clipIndex, replBridgePlan);
      s = s.replace(/\(Lighting:\s*.*?\)(?=...)/gi, `(Lighting: ${arcLighting || targetLighting})`);
```
Pre-bridge juga mendapat lighting `arc.from` bila `lightingArc` aktif.

### 3.5 `lib/opc-start-frame-request.js` (`:125–129`)
> **Verifikasi A1:** Hanya `phase_1_initial` (`lib/scheduler-processors.js:6003`) yang mengirim `campaign: tempCampaign`. Pemanggil lain (`production_recovery` `:7291`, `pipeline_preflight` `lib/campaign-scheduler.js:705`, `bulk_regen_preflight` `regenerate-start-frames/route.js:34`, `manual_regen` `regenerate-t2i/route.js:136`, dan `start-frame-provider-adapter.js:25`) mengirim `campaign` & `item` dari DB di mana `item.result_json` memuat `resolved_metaphor_policy`. Oleh karena itu, policy dibaca dari `campaign?.resolved_metaphor_policy || row?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null`. Dan sesuai Keputusan #4 (Klip 1 tetap object-only), cabang `handsActive` hanya berlaku untuk `Number(clipIndex) >= 2`.

**Before:**
```js
    const isMetaphoricFaceless = campaign?.visual_style === 'metaphoric_faceless' || row?.visual_style === 'metaphoric_faceless';
    if (isMetaphoricFaceless) {
      sanitizedPrompt = sanitizedPrompt.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)`);
      sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, ``);
    }
```
**After:**
```js
    const isMetaphoricFaceless = ...;   // tidak berubah
    const parsedResult = parse(item?.result_json);
    const policy = campaign?.resolved_metaphor_policy || row?.resolved_metaphor_policy || parsedResult?.resolved_metaphor_policy || null;
    const isClip1 = Number(clipIndex) === 1;
    if (isMetaphoricFaceless) {
      if (policy?.active && policy.handsPolicy === 'modest_hands_active' && !isClip1) {
        sanitizedPrompt = sanitizedPrompt.replace(/\((?:Biometric Anchor|Anchor|Subject):.../gi, presenceTruthTuple(policy, 'pre'));
      } else {
        /* dua replace lama, identik */
      }
    }
```
Penggantian `jar|bottle → 'glass conduit'` di gateway pre-bridge **tidak diubah**.

### 3.6 `lib/prompts.js` — tuple notice metaforik (`:2163–2182`)
**Before:**
```js
    const tupleMetaphorNotice = isMetaphoricFaceless ? `
🚨 KHUSUS KLIP 1 s/d ${maxPreBridgeClip} (METAFORA OBJEK PRE-BRIDGING — 100% PURE ISOLATED OBJECT ONLY):
- DILARANG KERAS menuliskan "(Biometric Anchor: ...)" atau "(Wardrobe: ...)" pada Klip 1 s/d ${maxPreBridgeClip}!
- DILARANG KERAS menampilkan tangan, lengan, jari, ...
...
  1. (Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, ...)
  ...
  5. (Environment: [Latar ruangan nyata ... sesuai W'S Matrix ...])
  6. (Lighting: dramatic chiaroscuro with warm golden rim light or soft natural ambient)
🚨 KHUSUS KLIP PRODUK (...):
```
**After:**
```js
    const metaPolicy = campaignData.resolved_metaphor_policy || null;
    const tupleMetaphorNotice = isMetaphoricFaceless
      ? (metaPolicy?.active && (metaPolicy.handsPolicy === 'modest_hands_active' || metaPolicy.environmentPolicy === 'metaphor_driven')
          ? buildMetaphorWorldTupleNotice({ policy: metaPolicy, maxPreBridgeClip, bridgeAtClip, targetClips,
              targetAnchorText, targetWardrobeText, opcRefFilenameTag, pillarRangeLabel, hasMultiSegmentPillarBridge })
          : `...teks lama identik...`)
      : '';
```
`buildMetaphorWorldTupleNotice` (di `lib/metaphor-policy.js`) menghasilkan:
```
🚨 KHUSUS KLIP 1 s/d N (METAFORA DUNIA BENDA — "<objectWorld>"):
- Klip 1: object-only hook (disarankan tanpa tangan) …
- Klip 2 s/d N: tangan syar'i (lengan menutup pergelangan) BOLEH berakting: <handVariant.struggle | aksi sesuai beat>
- DILARANG produk/botol/kemasan/merek pada Klip 1 s/d N   (tidak berubah)
- Susunan tuple:
  1. (Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms)
  2. (Object Truth & Context: …)
  3. (Geometric Truth: strictly no product shown …)
  4. (Physical Kinetics: …)
  5. (Environment: <sceneEnvironment>) — WAJIB SAMA di seluruh klip video ini
  6. (Lighting: <arc.from>)
🚨 KHUSUS KLIP PRODUK:
- TETAP di dunia benda yang sama (<sceneEnvironment>) — DILARANG pindah ke studio/latar brand
- Produk tampil sebagai agen perubahan di dalam metafora: <kit.beats.reaction>
- Klip terakhir: benda dalam kondisi bersih (<kit.beats.result>) + botol utuh (Product Truth Lock) diambil tangan
- (Lighting: transisi <arc.from> ➔ <arc.to>)
```

**After (`lib/prompts.js:2205–2227` — Tuple Expansion Mandate & `:2725–2751` — `dynamicPromptFields`):**
> **Verifikasi A1:** Di `lib/prompts.js:2205–2227` terdapat blok ekspansi tuple kedua untuk `isMetaphoricFaceless` yang juga meng-hardcode `ABSOLUTELY ZERO HANDS` dan `meja kerja`, serta di `:2725–2751` terdapat contoh JSON `t2i_prompts` untuk `isMetaphoricFaceless`. Saat `metaPolicy?.active`, kedua bagian ini didelegasikan ke helper di `lib/metaphor-policy.js` agar tidak kontradiktif (Klip 1 tetap object-only, Klip 2+ tangan syar'i aktif, produk di `sceneEnvironment`, lighting arc mengikuti kit). Saat `metaPolicy` nonaktif, output tetap identik byte-per-byte.

### 3.7 `lib/prompts.js` — OBJECT-CENTRIC METAPHOR MANDATE (`:2349–2395`)
**Before:** judul `(100% PURE OBJECT PRE-BRIDGING — ZERO HANDS / ...)` dan poin 1 *"DILARANG KERAS memunculkan TANGAN, LENGAN, JARI…"*.
**After:** judul dan poin 1 diambil dari `metaphorMandateHeader(policy)`:
- mode lama → teks lama identik;
- mode aktif → judul `(METAPHOR WORLD — TANGAN SYAR'I AKTIF / PRODUK DI DALAM METAFORA)`, poin 1 hanya melarang wajah, kulit lengan terbuka, dan produk pre-bridge.

Poin *"Interaksi Tangan POV (HANYA Klip Solusi…)"* diganti dengan versi yang mengikuti policy. Blok kit dari F1 (`buildMetaphorWorldKitSection`) tetap ditambahkan setelahnya.

### 3.8 `lib/visual-identity-allocator.js` — latar & konflik 3D (`:93–110`, `:205–209`)
**Before (signature + auto-inject 3D):**
```js
export function buildVisualIdentityPromptSection(snapshot, totalClips = 6) {
  ...
  if (has3dClues && (!modeRouting.mechanism || modeRouting.mechanism === 'symbolic_surrealism')) {
    modeRouting.mechanism = '3d_bio_cellular';
  }
```
**After:**
```js
export function buildVisualIdentityPromptSection(snapshot, totalClips = 6, { metaphorPolicy = null } = {}) {
  ...
  const metaphoricActive = Boolean(metaphorPolicy?.active);
  if (!metaphoricActive && has3dClues && (!modeRouting.mechanism || modeRouting.mechanism === 'symbolic_surrealism')) {
    modeRouting.mechanism = '3d_bio_cellular';
  }
  if (metaphoricActive) {
    for (const fn of Object.keys(modeRouting)) {
      if (modeRouting[fn] === '3d_bio_cellular') {
        modeRouting[fn] = supportingStyles.includes('symbolic_surrealism') ? 'symbolic_surrealism' : primaryStyle;
      }
    }
  }
```
**Before (`:209`):**
```js
- DILARANG KERAS menyimpang dari latar setting visual identity di atas (misal jika visual identity menetapkan corkboard/pinboard matrix, ...).
```
**After:**
```js
${metaphorPolicy?.environmentPolicy === 'metaphor_driven'
  ? `- LATAR MENGIKUTI METAPHOR WORLD: "${metaphorPolicy.sceneEnvironment}". Konsisten di seluruh klip VIDEO INI. Latar brand di atas HANYA referensi palet warna/material, BUKAN lokasi wajib.`
  : `- DILARANG KERAS menyimpang dari latar setting visual identity di atas (...).`}
```
Baris `Latar Setting Utama`, `Palet Material Wajib`, dan `Properti Kunci` di atasnya juga ikut menyesuaikan: pada mode `metaphor_driven`, `Properti Kunci` brand (amber dropper, granite mortar) **tidak** dipaksakan.

Pemanggil di `lib/prompts.js:2156`:
**Before:** `vsoSection = buildVisualIdentityPromptSection(vsoData, targetClips);`
**After:** `vsoSection = buildVisualIdentityPromptSection(vsoData, targetClips, { metaphorPolicy: campaignData.resolved_metaphor_policy || null });`

### 3.9 `lib/prompts.js:2342` (cabang VSO legacy non-VI v2)
**Before:** `7. KONSISTENSI LATAR/LOKASI WAJIB: ... seluruh klip ...`
**After:** bila `environmentPolicy === 'metaphor_driven'`, teksnya menjadi *"7. KONSISTENSI LATAR PER VIDEO: seluruh klip berada di dunia metafora `<sceneEnvironment>` …"*. Selain itu, teks lama tetap identik.

### 3.10 UI (opsional, sesuai keputusan 4)
`app/pillar-campaigns/[id]/page.js:2395`: badge kecil tambahan `🙌 tangan aktif · 🌍 latar metafora · 💡 arc`, diambil dari `resolved_metaphor_policy`. Karena hanya berupa teks dan token yang sudah ada, mockup tidak wajib. Bila ingin tetap mengikuti SOP, mockup dibuat di T10.

### 3.11 Tes
- **BARU** `tests/metaphor-policy.test.js`: matriks keputusan (tanpa kit → fail-safe; investigatif → nonaktif; subject non-hands → paksa `zero_hands`; sleeve dikoreksi).
- **BARU** `tests/metaphor-policy-prompt.test.js`:
  - mode aktif → tuple notice memuat `Modest female hands`, `<sceneEnvironment>`, dan **tidak** memuat `ABSOLUTELY ZERO HANDS` pada metaforik. Larangan produk pre-bridge tetap ada.
  - allocator tidak mengandung `3d_bio_cellular` saat metaforik aktif, dan tidak memuat "DILARANG KERAS menyimpang dari latar" saat `metaphor_driven`.
  - lighting per klip: pre = `from`, produk = transisi, terakhir = `to`.
- **Regresi (harus lulus tanpa diubah):** `tests/apply-replacements-clip-index.test.js`, `tests/dynamic-bridge-isolation.test.js` + snapshot `tests/fixtures/bridge-prompt-stage1.snapshot.json`, `tests/test-visual-identity-allocator.mjs`, `tests/garlibee-metaphor-visual-identities.test.js`, `tests/multiplier-dual-realm-visual-identity.test.js`, `tests/opc-planner-strategic-context.test.js`. Snapshot yang tidak berubah adalah bukti bahwa default sama dengan perilaku lama.

---

## 4. Verifikasi
1. Tes baru + regresi lulus, `npm run build` lulus.
2. Diff snapshot prompt (flag off vs on) untuk 1 baris DapurBotani: lampirkan sebagai `plans/visual-metaphor-world/f2-prompt-diff.md`.
3. Staging (atas persetujuan): duplikat VI `dapurbotani_apothecary_3d_female` → `dapurbotani_metaphor_world_test` dengan `environment.policy=metaphor_driven`, `hands_policy=modest_hands_active`, `product_entry=inside_metaphor`, `lighting_arc=kit`. **VI asli tidak diubah.**
   - 1 campaign OPC, 6–7 baris, flag F1 on.
   - Periksa: latar berbeda per video, tangan berlengan tertutup di klip 2+, tidak ada botol pre-bridge, klip produk tetap di dunia metafora, tidak ada 3D CGI.
   - Contact sheet 3×3 dibandingkan dengan batch lama.
4. Kembalikan VI test ke `archived` bila hasilnya tidak dipakai.

## 5. Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| Tangan memunculkan lengan telanjang atau wajah | Presence tuple eksplisit + Wardrobe dipertahankan + negative "bare arms, face" di start-frame. Klip 1 tetap disarankan object-only |
| Model menaruh botol di pre-bridge karena mode "produk di dalam metafora" | Larangan pre-bridge dan gateway sanitizer **tidak diubah**. Produk hanya diizinkan mulai bridge |
| Product truth rusak di dunia metafora (botol morphing di karpet/air) | Klip produk memakai Product Truth Lock lama + negative anti-morph (pola dokumen Bundayes: "static tripod to minimize morphing") |
| Snapshot lama berubah tanpa sengaja | Helper mengembalikan string lama secara identik, dan snapshot regresi menjadi gate |
| `tempCampaign` tidak sampai ke start-frame request | T1 memverifikasi alur. Bila perlu, tambahkan parameter eksplisit |
| Hasil latar tetap mirip bila F1 off | `metaphor_driven` sengaja fail-safe ke `brand_locked` tanpa kit, sehingga **F2 latar baru terasa bersama F1** |

## 6. Keputusan yang dibutuhkan
1. **Klip 1**: tetap object-only walau tangan aktif (usulan saya, karena hook paling kuat sebagai benda murni), atau tangan boleh sejak klip 1?
2. ~~**Urutan rilis**~~ → **DIPUTUSKAN 2026-11-14: (b) gabungan F1+F2 dalam satu rilis.** Lihat [execution_order_F1_F2.md](execution_order_F1_F2.md).
3. **Konfigurasi switch**: hanya lewat field VI (usulan), atau juga perlu override per campaign?
4. Badge UI (3.10): ikut atau dilewati?

---

## Execution Task List
- [x] T1. Verifikasi alur data: nama field snapshot VI di `tempCampaign`, dan apakah `campaign` di `opc-start-frame-request.js` = `tempCampaign`
- [x] T2. Tambah field `environment.policy` + `metaphor_engine.{hands_policy, product_entry, lighting_arc}` + koreksi sleeve/subject di `lib/visual-identity-contract.js` & compliance report
- [x] T3. Buat `lib/metaphor-policy.js` (`resolveMetaphorPolicy`, `presenceTruthTuple`, `environmentTuple`, `lightingTupleForClip`, `buildMetaphorWorldTupleNotice`, `metaphorMandateHeader`) + `tests/metaphor-policy.test.js`
- [x] T4. Resolve & simpan policy di `processPillarGenerator` (`scheduler-processors.js` setelah blok metafora + `:6035`)
- [x] T5. Sanitizer `applyPromptReplacements` (`:158–175`): cabang tangan aktif + lighting arc
- [x] T6. Sanitizer start-frame `opc-start-frame-request.js:125–129`
- [x] T7. `prompts.js`: tuple notice (`:2163`), mandate (`:2349`), cabang legacy (`:2342`), pemanggil allocator (`:2156`)
- [x] T8. `visual-identity-allocator.js`: parameter `metaphorPolicy`, remap 3D, teks latar `metaphor_driven`
- [x] T9. `tests/metaphor-policy-prompt.test.js` + seluruh regresi & snapshot + `npm run build`
- [x] T10. (Opsional) Badge UI policy di `app/pillar-campaigns/[id]/page.js`
- [x] T11. Buat `f2-prompt-diff.md` (flag off vs on)
- [ ] T12. (Atas persetujuan) Rilis + deploy staging + VI test `dapurbotani_metaphor_world_test`
- [ ] T13. Uji batch 6–7 baris di staging, contact sheet, laporan perbandingan
