# Implementation Plan: Planner -> Scene Director Architecture & VI Identity Cards (K1–K6)

Referensi Spesifikasi:
- [`plans/planner-scene-director/RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md)
- [`plans/planner-scene-director/VI_SEBAGAI_IDENTITAS_BRAND.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/VI_SEBAGAI_IDENTITAS_BRAND.md)
- [`plans/visual-metaphor-world/TEMUAN_PLANNER_VS_STORYBOARD.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/visual-metaphor-world/TEMUAN_PLANNER_VS_STORYBOARD.md)

Status Keputusan K6 dari Pengguna:
- Talent & aturan lengan/kulit memakai keputusan final §4:
  - `DapurBotani` (`dapurbotani_identity_v3`): tangan wanita Muslimah Indonesia dengan lengan panjang gamis/linen longgar hingga pergelangan tangan (`wrists_covered`).
  - `SiasatSehat` (`siasatsehat_identity_v3`): tangan pria Indonesia dewasa (`southeast_asian_male`), boleh memperlihatkan lengan bawah atau lengan digulung rapi hingga siku (`forearms_exposed`).
  - `NutriBlend` (`nutriblend_identity_v3`): tangan wanita muda Indonesia dengan lengan panjang sporty jersey/kemeja menutup pergelangan (`wrists_covered`).
- Palet warna pakaian, karakter cahaya, finishing, 1–2 aksesori tanda tangan, batas gaya 3D, dan fallback lokasi menggunakan draf §4 pada preset baru terpisah tanpa mengubah preset VI lama.

Batas Keselamatan:
- Seluruh perubahan perilaku prompt, alokasi beat, katalog bebas lokasi, dan diversity guard berada di belakang tenant feature flag `planner_scene_director` (`getSetting('planner_scene_director', false)` = `'on'`).
- Saat flag `off` (default), output prompt, allocator, dan katalog identik byte-per-byte dengan baseline `v2.46.4`.
- Scope khusus Pillar / OPC (`product_campaign` & `brand_editorial`); Strategic Campaign, Reverse Engineering, dan Multiplier tidak diubah.
- Tetap 1-call architecture (0 panggilan LLM tambahan).
- Berhenti sebelum git release & deploy staging sampai seluruh tes lokal & `npm run build` lulus.

---

## Execution Task List

- [x] **Task 1 (K6 Schema & Presets)**: Perluas [`lib/visual-identity-contract.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-contract.js) dengan dukungan backwards-compatible untuk Brand Identity Card (`schema_mode`, `environment.policy: 'planner_driven'`, `wardrobe.palette`, `style_limits`, `signature_accents`, `lighting.character`), lalu daftarkan 3 preset baru (`dapurbotani_identity_v3`, `siasatsehat_identity_v3`, `nutriblend_identity_v3`) di [`lib/visual-identity-system-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js) serta helper rotasi palet brand di [`lib/metaphor-policy.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/metaphor-policy.js).
- [x] **Task 2 (K3 30 Angle Visual Formats)**: Buat [`lib/angle-visual-formats.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/angle-visual-formats.js) memetakan seluruh 30 Strategic Angles dari [`kb/STRATEGIC_FRAMEWORKS_v47.9.md`](file:///Users/sabeqmmursyid/_cfstudio/kb/STRATEGIC_FRAMEWORKS_v47.9.md) ke beat visual khas, `allows3D`, `preferredModes`, dan `resolveAngleBeatsForClips(angleName, totalClips)` untuk durasi N-klip (4/6/8+).
- [x] **Task 3 (K1 Scene Brief Extractor)**: Buat [`lib/scene-brief.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-brief.js) untuk mengekstrak `location`, `time_of_day`, `lighting_mood`, `situational_props`, `feeling`, `protagonist`, `angle_format_key`, dan `source_trace` secara deterministik (ID/EN) dari baris planner dengan fallback lokasi dari VI Brand Card.
- [x] **Task 4 (K2 & K4 Catalog Strip-Location + Angle-Based Allocator)**: Tambahkan dukungan `stripLocation` pada [`lib/visual-language-catalog.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-language-catalog.js) dan implementasikan `allocateClipsByAngleBeats` serta mode `"BRAND LOOK"` di [`lib/visual-identity-allocator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-allocator.js) (maks 1 klip `3d_bio_cellular` hanya pada angle edukasi/mekanisme, memutus kebocoran `has3dClues` saat mode Scene Director aktif).
- [x] **Task 5 (K2 & K4 Prompt Hierarchy Refactor)**: Perbarui [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) di belakang flag `planner_scene_director`: injeksikan blok `🎬 SCENE DIRECTOR (WAJIB PER KLIP)` DI ATAS `vsoSection`, matikan `has3dSimulation` & `visual_signature` leak saat Scene Director aktif, integrasikan Metaphor World + Scene Director saat keduanya aktif, dan ganti `[MANDATE 33 - Verbatim Scene Lock]` di `dynamicPromptFields`.
- [x] **Task 6 (K5 Diversity Guard Telemetry & UI Badge)**: Buat [`lib/scene-diversity-guard.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-diversity-guard.js), integrasikan penyimpanan `resolved_scene_brief` & `diversity_guard` (`report_only`) di [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), serta tampilkan ringkasan status Diversity Guard (menggunakan semantic CSS tokens dari `app/theme.css`) di [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js).
- [x] **Task 7 (Tests, Diff & Build Verification)**: Buat suite unit test di `tests/scene-director-*.test.js`, buat [`plans/planner-scene-director/prompt-diff.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/prompt-diff.md) untuk item `2053` dan `2055` (`opc_261108_8618kc`), jalankan seluruh test suite terkait + `npm run build`, dan pastikan semua checkbox di atas tercentang `[x]`.

---

## Detail Perubahan Kode (Before & After)

### 1. [`lib/visual-identity-contract.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-contract.js) (K6 Contract Extensions)

**Code Sebelum (Current/Before):**
```js
export const ENVIRONMENT_POLICIES = ['brand_locked', 'metaphor_driven'];
```
dan di dalam `validateAndNormalizeVisualIdentity`:
```js
  const result = {
    schema_version: VISUAL_IDENTITY_SCHEMA_VERSION,
    label: input.label || 'Untitled Visual Identity',
    description: input.description || '',
    subject: {
      ...
    },
    visual_language: vl,
    mode_routing: routing,
    rendering,
    composition,
    metaphor_engine: metaphor,
    wardrobe: {
      mode: 'fixed',
      preset_key: 'sage_muted',
      custom_description: '',
      primary_color: '',
      secondary_color: '',
      material: '',
      sleeve_policy: 'wrists_covered',
      accessories: [],
      ...(input.wardrobe || {})
    },
    environment: {
      preset_key: 'nordic_kitchen',
      custom_description: '',
      material_palette: [],
      props: [],
      background_density: 'balanced',
      ...(input.environment || {}),
      policy: pickEnum(input.environment?.policy, ENVIRONMENT_POLICIES, 'brand_locked')
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: '',
      color_temperature: 'warm_neutral',
      contrast: 'soft',
      ...(input.lighting || {})
    },
```

**Code Sesudah (Proposed/After):**
```js
export const ENVIRONMENT_POLICIES = ['brand_locked', 'metaphor_driven', 'planner_driven'];
export const SCHEMA_MODES = ['legacy', 'identity_card'];
```
dan menormalisasi field opsional Brand Identity Card secara backwards-compatible di `validateAndNormalizeVisualIdentity`:
```js
  const styleLimitsInput = input.style_limits || {};
  const result = {
    schema_version: VISUAL_IDENTITY_SCHEMA_VERSION,
    schema_mode: pickEnum(input.schema_mode, SCHEMA_MODES, input.environment?.policy === 'planner_driven' ? 'identity_card' : 'legacy'),
    label: input.label || 'Untitled Visual Identity',
    description: input.description || '',
    ...
    wardrobe: {
      mode: 'fixed',
      preset_key: 'sage_muted',
      custom_description: '',
      primary_color: '',
      secondary_color: '',
      material: '',
      sleeve_policy: 'wrists_covered',
      accessories: [],
      palette: Array.isArray(input.wardrobe?.palette) ? input.wardrobe.palette.filter(Boolean) : [],
      ...(input.wardrobe || {}),
      palette: Array.isArray(input.wardrobe?.palette) ? input.wardrobe.palette.filter(Boolean) : []
    },
    environment: {
      preset_key: 'nordic_kitchen',
      custom_description: '',
      material_palette: [],
      props: [],
      background_density: 'balanced',
      fallback_location: input.environment?.fallback_location || '',
      ...(input.environment || {}),
      policy: pickEnum(input.environment?.policy, ENVIRONMENT_POLICIES, 'brand_locked')
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: '',
      color_temperature: 'warm_neutral',
      contrast: 'soft',
      character: input.lighting?.character || '',
      ...(input.lighting || {})
    },
    style_limits: {
      max_3d_clips: Number.isFinite(Number(styleLimitsInput.max_3d_clips)) ? Math.max(0, Number(styleLimitsInput.max_3d_clips)) : 1,
      allow_3d_only_angles: Array.isArray(styleLimitsInput.allow_3d_only_angles) ? styleLimitsInput.allow_3d_only_angles : ['scientific_proof', 'intellectual_flex', 'problem_you_didnt_know', 'one_feature_obsession'],
      allow_cartoon: styleLimitsInput.allow_cartoon === true
    },
    signature_accents: Array.isArray(input.signature_accents) ? input.signature_accents.filter(Boolean).slice(0, 3) : [],
```

---

### 2. [`lib/visual-identity-system-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js) (K6 New Brand Identity Cards)

**Code Sebelum (Current/Before):**
Preset existing berakhir pada `'luxury_rheology_metaphor'` (tidak ada preset existing yang diubah).

**Code Sesudah (Proposed/After):**
Menambahkan 3 preset baru di `SYSTEM_VISUAL_IDENTITIES` setelah `'luxury_rheology_metaphor'`:
- `dapurbotani_identity_v3` (`schema_mode: 'identity_card'`, `environment.policy: 'planner_driven'`, palet sage/mocca/ivory/olive/dusty terracotta, Muslimah `wrists_covered`, cahaya hangat difus tanpa jam, finishing natural film grain soft matte, signature talenan kayu jati kecil + sendok kayu/mangkuk keramik krem, 3D maks 1 klip edukasi, fallback meja dapur kayu hangat / apotek botani)
- `siasatsehat_identity_v3` (`schema_mode: 'identity_card'`, `environment.policy: 'planner_driven'`, palet navy/charcoal/slate/olive, `southeast_asian_male`, `forearms_exposed` boleh gulung hingga siku, cahaya crisp neutral modern, signature jam tangan mekanik silver/slate + kaca borosilikat polos/notebook, 3D maks 1 klip mekanisme ilmiah, fallback meja kerja minimalis abu-charcoal)
- `nutriblend_identity_v3` (`schema_mode: 'identity_card'`, `environment.policy: 'planner_driven'`, palet pastel mint/coral lembut/putih gading/terracotta muda, wanita Indonesia sporty lengan panjang jersey/kemeja `wrists_covered`, cahaya bright airy crisp, signature gelas kaca tinggi/shaker minimalis + pita/aksesoris hijau muda halus, 3D maks 1 klip, fallback counter dapur terang & bersih)

---

### 3. [`lib/metaphor-policy.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/metaphor-policy.js) (Brand Wardrobe Palette Resolver)

**Code Sebelum (Current/Before):**
```js
export function resolveVideoVariety(seedKey = '') {
  ...
  const wardrobeChoice = MODEST_WARDROBE_ROTATION[positive % MODEST_WARDROBE_ROTATION.length];
```

**Code Sesudah (Proposed/After):**
Menambah parameter opsional `paletteEntries = null` & `sleevePolicy = 'wrists_covered'` agar rotasi warna per item ID dapat memakai palet warna kartu identitas brand (jika preset menyediakan `wardrobe.palette`) tanpa merusak pemanggil lama tanpa argumen kedua:
```js
export function resolveVideoVariety(seedKey = '', options = {}) {
  ...
  const pool = Array.isArray(options?.paletteEntries) && options.paletteEntries.length > 0
    ? options.paletteEntries
    : MODEST_WARDROBE_ROTATION;
  const wardrobeChoice = pool[positive % pool.length];
  ...
}
```

---

### 4. File Baru [`lib/angle-visual-formats.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/angle-visual-formats.js) (K3 — 30 Strategic Angles)

**Code Sebelum (Current/Before):**
Belum ada. Sebelumnya alokasi klip memakai proporsi generik 6-beat tetap di `lib/visual-identity-allocator.js`.

**Code Sesudah (Proposed/After):**
Modul murni memuat:
- `ANGLE_VISUAL_FORMATS` untuk seluruh **30 Strategic Angles** dari `kb/STRATEGIC_FRAMEWORKS_v47.9.md`:
  - Set A (Ego): `The Secret Club`, `The Status Signal`, `The Rebel Choice`, `The Intellectual Flex`, `The Taste Maker`, `The Minimalist`, `The Caregiver`, `The Alpha`, `The Artist`, `The Heritage`
  - Set B (Brain): `The Life Hack`, `The Math Whiz`, `The Scientific Proof`, `The Stress Test`, `The Comparison (David vs Goliath)`, `The One-Feature Obsession`, `The Origin Story`, `The Blind Test`, `The Problem You Didn't Know`, `The Bundle Logic`
  - Set C (Gut): `The Revenge`, `The Pure Relief`, `The Safe Haven`, `The Guilty Pleasure`, `The Fear of Missing Out (FOMO)`, `The Magic Moment`, `The Second Chance`, `The Belonging`, `The Sensory ASMR`, `The Absurdity`
- Masing-masing mendefinisikan `key`, `label`, `set`, `allows3D` (`true` hanya pada `The Scientific Proof`, `The Intellectual Flex`, `The Problem You Didn't Know`, `The One-Feature Obsession`), `beats` (6–7 beat spesifik), `visualIntentPerBeat`, `preferredModes`, dan `signatureVisualCues`.
- Helper `resolveAngleFormat(angleName)` (toleran ejaan/tanda baca/case) dan `resolveAngleBeatsForClips(angleName, totalClips, { bridgeAtClip, max3dClips })`.

---

### 5. File Baru [`lib/scene-brief.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-brief.js) (K1 — Deterministic Scene Brief Extractor)

**Code Sebelum (Current/Before):**
Belum ada. Lokasi, waktu, suasana, dan perasaan hanya ditempel sebagai teks mentah `context` dan `ws_matrix` di bagian bawah prompt.

**Code Sesudah (Proposed/After):**
Fungsi murni `buildSceneBrief(rowPayload, campaignData, { brandProfile, vsoData } = {})` (0 panggilan LLM) menghasilkan:
- `location` (diektraksi dengan prioritas `ws_matrix Where -> visual_action_guideline -> context -> VI fallback_location / environment`), mendukung kosakata ID & EN (`ruang makan`, `kamar tidur`, `ruang keluarga`, `dapur`, `pantry`, `kantor`, `kantin`, `teras`, `meja kerja`, `pabrik`, `kamar mandi`, `vanity table`, dll).
- `time_of_day` (`pagi`, `siang`, `sore`, `malam`, `akhir pekan`, dst dari `ws_matrix When -> context -> visual_action_guideline`, default `null` tanpa mengarang pagi).
- `lighting_mood` (mapping deterministik waktu & mood ke deskripsi cahaya Bahasa Inggris seperti `soft midday indoor natural daylight` / `warm evening bedside lamp light` / `crisp bright morning daylight`).
- `situational_props` (daftar properti konkret sesuai situasi + `visual_action_guideline`, mis. piring & cangkir makan siang untuk ruang makan, bingkai foto keluarga & lampu tidur untuk kamar tidur malam, tanpa memaksakan batu slate / lab jika tidak cocok).
- `feeling` (emosi inti dari `ws_matrix How Feeling -> context`).
- `protagonist` (`Bunda`, `suami`, `anak`, `manajer fasilitas`, `pekerja`, `audiens`, dll dari `context` / `ws_matrix` / `vsoData` subject).
- `angle_format_key` + `angle_format` dari K3.
- `source_trace` (melacak asal field agar bisa diaudit dan diuji).

---

### 6. [`lib/visual-language-catalog.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-language-catalog.js) (K2 — Location-Free Style Lookup)

**Code Sebelum (Current/Before):**
```js
export function getVisualStyleDefinition(key = DEFAULT_VISUAL_STYLE) {
  if (!key) {
    return VISUAL_LANGUAGE_CATALOG[DEFAULT_VISUAL_STYLE];
  }
  const definition = VISUAL_LANGUAGE_CATALOG[key];
  ...
  return definition;
}
```

**Code Sesudah (Proposed/After):**
Menambahkan helper non-destruktif `getVisualStyleForSceneDirector(key, { stripLocation = false } = {})` yang bila `stripLocation: true`, membersihkan frasa lokasi bawaan (seperti `"Artisanal kitchen"`, `"natural soft kitchen daylight"`, `"artisanal cookware"`, `"workspace"`, `"tabletop"`) dan menggantinya dengan karakter medium/kamera murni sehingga kata lokasi planner tidak ditimpa kata `kitchen`/`workspace`. Entry `VISUAL_LANGUAGE_CATALOG` tidak diubah agar mode flag OFF tetap identik byte-per-byte.

---

### 7. [`lib/visual-identity-allocator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-allocator.js) (K2 & K4 — Dynamic Beat Allocator & Brand Look Section)

**Code Sebelum (Current/Before):**
```js
export function buildVisualIdentityPromptSection(snapshot, totalClips = 6, { metaphorPolicy = null } = {}) {
  ...
  const modeRouting = { ...(structured.mode_routing || {}) };
  const has3dClues = /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ)/i.test(label) || ...
  if (!metaphoricActive && has3dClues && (!modeRouting.mechanism || modeRouting.mechanism === 'symbolic_surrealism')) {
    modeRouting.mechanism = '3d_bio_cellular';
  }
  const allocations = allocateClipsToNarrativeModes(totalClips, modeRouting);
  ...
  const envMandateSection = isMetaphorDrivenEnv ? ... : `🏡 ENVIRONMENT & SETTING MANDATE ... DILARANG KERAS menyimpang dari latar setting visual identity di atas ...`;
```

**Code Sesudah (Proposed/After):**
Menambahkan opsi `{ metaphorPolicy = null, sceneDirector = null, angleFormat = null, sceneBrief = null }` pada `buildVisualIdentityPromptSection`:
- Jika `sceneDirector` aktif (`planner_scene_director === 'on'` atau `structured.schema_mode === 'identity_card'`):
  - Memanggil `allocateClipsByAngleBeats({ totalClips, angleFormat, primaryStyle, supportingStyles, disabledStyles, styleLimits, has3dClues: false })` — `has3dClues` tidak lagi menyuntik `3d_bio_cellular` secara paksa; `3d_bio_cellular` dibatasi maks `styleLimits.max_3d_clips` (default 1, default 0 pada `bridge_or_mechanism` jika `!angleFormat.allows3D` dan `!styleLimits.allow_3d_only_angles` match).
  - Mengubah header menjadi `BRAND LOOK & VISUAL IDENTITY (HOW IT LOOKS — TUNDUK PADA SCENE DIRECTOR)`.
  - Mengubah `ENVIRONMENT & SETTING` menjadi `"FALLBACK LOKASI SAJA (hanya jika Scene Director belum menyebut lokasi — saat Scene Brief menyebut lokasi, WAJIB ikuti lokasi Scene Director)"` dan menghapus `"DILARANG KERAS menyimpang..."` serta daftar `Properti Kunci` wajib.
  - Menampilkan aturan karakter/tangan, wardrobe/palet brand, pencahayaan netral waktu, finishing, dan `signature_accents` opsional (maks 1–2 aksesori kecil).
- Saat opsi `sceneDirector` tidak aktif, output tetap 100% sama persis dengan kode sebelumnya.

---

### 8. [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (K2 & K4 — Hierarchy Refactor behind `planner_scene_director` Flag)

**Code Sebelum (Current/Before):**
```js
  const visualSignatureText = vsoData?.visualSignature || brandProfile?.visual_signature || vsoData?.visual_signature || '';
  const structuredVI = vsoData?.structured || null;
  const has3dSimulation = !isMetaphoricFaceless && !isInvestigativeFaceless && Boolean(
    /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ|tissue|synapse|receptor)/i.test(visualSignatureText) ||
    /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ|tissue|synapse|receptor)/i.test(structuredVI?.style?.custom_description || '') ||
    /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ|tissue|synapse|receptor)/i.test(vsoData?.description || '') ||
    (structuredVI?.mode_routing?.mechanism && (structuredVI.mode_routing.mechanism === '3d_bio_cellular' || /3d/i.test(structuredVI.mode_routing.mechanism))) ||
    (Array.isArray(structuredVI?.rendering?.textures) && structuredVI.rendering.textures.some(t => /3d_cellular|cellular/i.test(t)))
  );
```
dan pada `buildOrganicPillarPrompt`:
```js
${vsoSection}
${cartoonStoryDirective}
${productInstruction}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}
${visualModeInstructions}

${strategicPlanningSection}${voContractSection}
```
dan pada `dynamicPromptFields` (non-metaphor, schema v2, lines 2869–2938):
- Contoh klip menulis `(Environment: artisanal studio workspace)`, `(Visual Mode: culinary_cinematic)`, serta klip 3 `3d_bio_cellular` hardcoded bila `has3dSimulation === true`, dan `[MANDATE 33 - Verbatim Scene Lock]` di branch non-hybrid.

**Code Sesudah (Proposed/After):**
- Memeriksa `const isSceneDirectorActive = !isCartoonUniverse && !isInvestigativeFaceless && (campaignData.planner_scene_director === 'on' || (campaignData.planner_scene_director !== 'off' && (getSetting('planner_scene_director', false) === 'on' || structuredVI?.schema_mode === 'identity_card' || vsoData?.schema_mode === 'identity_card')));`
  - Catatan keamanan flag: hanya `getSetting('planner_scene_director', false) === 'on'` atau explicit override `campaignData.planner_scene_director === 'on'` (atau identity_card preset eksplisit v3 yang memang dibuat untuk Scene Director) yang mengaktifkan fitur. Untuk seluruh VI lama saat flag `off`, `isSceneDirectorActive === false` 100%.
- Ketika `isSceneDirectorActive` aktif:
  - Hitung `sceneBrief = buildSceneBrief(rowPayloadDataEarly, campaignData, { brandProfile, vsoData })` dan `anglePlan = resolveAngleBeatsForClips(sceneBrief.angle_format_key || rowStrategicAngle, targetClips, { bridgeAtClip, styleLimits: structuredVI?.style_limits })`.
  - Matikan leak `has3dSimulation` dari teks `visual_signature` & deskripsi VI (`has3dSimulation` mengikuti `anglePlan.hasAny3d` dan `visual_signature` tidak disuntikkan ke contoh 3D/dapur).
  - Susun `sceneDirectorSection` (`🎬 SCENE DIRECTOR (WAJIB PER KLIP — MENENTUKAN WHAT, WHERE, WHEN, WHO)`) yang merinci:
    - Lokasi adegan wajib (`sceneBrief.location`), Waktu & Cahaya (`sceneBrief.time_of_day`, `sceneBrief.lighting_mood`), Situasi & Emosi (`sceneBrief.feeling`), Aktor Tangan POV (`sceneBrief.protagonist` sesuai guardrail tangan & wardrobe VI), Properti Situasional (`sceneBrief.situational_props`).
    - Rencana Beat per Klip dari `anglePlan` (hook -> situasi -> bukti/eksplorasi -> bridge -> payoff/CTA) beserta penegasan `tangan aktif berinteraksi pada situasi nyata` (bukan sekadar objek diam bila tidak dalam mode pre-bridge object-only) dan integrasi Metaphor World bila `hasPolicyOverride` juga aktif (K4).
  - Injeksi `${sceneDirectorSection}` **SEBELUM** `${vsoSection}` pada `buildOrganicPillarPrompt`.
  - Ubah contoh `dynamicPromptFields` agar memakai `sceneBrief.location` & `sceneBrief.lighting_mood` (tanpa menulis `artisanal studio workspace` atau memaksa klip 3 ke `3d_bio_cellular` bila angle bukan edukasi 3D, serta mengganti `[MANDATE 33 - Verbatim Scene Lock]` dengan `[Scene Brief Location Lock]`).

---

### 9. File Baru [`lib/scene-diversity-guard.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-diversity-guard.js) + [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) + [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js) (K5 Diversity Guard)

**Code Sebelum (Current/Before):**
- Di `lib/scheduler-processors.js:6422-6432`:
```js
    if (visualOverrides) parsed.resolved_visual_overrides = visualOverrides;
    if (tempCampaign.resolved_health_metaphor) {
      parsed.resolved_health_metaphor = tempCampaign.resolved_health_metaphor;
    }
    if (tempCampaign.resolved_metaphor_policy?.active) {
      parsed.resolved_metaphor_policy = tempCampaign.resolved_metaphor_policy;
    }
    if (tempCampaign.resolved_wardrobe_color) {
      parsed.resolved_wardrobe_color = tempCampaign.resolved_wardrobe_color;
    }
```
- Di `app/pillar-campaigns/[id]/page.js:1226-1234`: hanya menampilkan `parsed.analysis_summary` tanpa status Scene Brief atau Diversity Guard.

**Code Sesudah (Proposed/After):**
- [`lib/scene-diversity-guard.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scene-diversity-guard.js): fungsi murni `buildVideoVisualFingerprint(parsed, sceneBrief, rowPayload)` dan `analyzeCampaignDiversity(siblingItems, { thresholdSameBeat = 3, maxDominantLocationRatio = 0.7 } = {})` yang mendeteksi:
  - Pengulangan urutan beat + angle yang identik (`>= 3` video dalam campaign)
  - Lokasi yang sama mendominasi `> 70%` video
  - Mengembalikan `{ mode: 'report_only', warnings: [...], stats: { total_checked, dominant_location, dominant_location_ratio, repeated_sequences } }` tanpa memblokir generasi (non-blocking, 0 extra LLM calls).
- [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js): bila flag `planner_scene_director === 'on'`, resolver menghitung & menyimpan `parsed.resolved_scene_brief` dan `parsed.diversity_guard` (`report_only` membandingkan sibling items campaign yang sudah punya `result_json`).
- [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js): menampilkan ringkasan ringkas Scene Brief & badge `Diversity Guard` memakai 100% semantic CSS tokens (`var(--surface-interactive)`, `var(--border-color)`, `var(--status-warning)`, `var(--status-info)`, `var(--text-primary)`, `var(--text-muted)`).

---

## Verifikasi Lokal & Artefak Uji
- Unit tests baru:
  - `tests/scene-brief.test.js`: 15+ baris planner nyata (termasuk `2051..2056` dari `opc_261108_8618kc`, `2123`, `2124`, `2141`, `2142`, dan variasi bahasa ID/EN).
  - `tests/angle-visual-formats.test.js`: validasi seluruh 30 Strategic Angles terdaftar lengkap, memetakan beat berbeda, dan aturan 3D max 1 klip hanya pada angle edukasi/mekanisme.
  - `tests/scene-director-prompt.test.js`: memastikan saat flag `off` prompt identik byte-per-byte; saat flag `on`, `SCENE DIRECTOR` muncul di atas `BRAND LOOK`, tidak ada `"DILARANG KERAS menyimpang"`, lokasi `2053` = ruang makan siang & `2055` = kamar tidur malam, `0` klip 3D di angle emosional (`The Minimalist`, `The Caregiver`, `The Rebel Choice`), `<= 1` klip 3D di `The Intellectual Flex` / `The Scientific Proof`, serta kompatibilitas preset K6 + rotasi warna wardrobe.
  - `tests/scene-diversity-guard.test.js`: batch seragam memicu warning (`>=3` sama atau `>70%` lokasi sama) sementara batch bervariasi lolos bersih.
- Seluruh unit test F1, F2, F2.1, F2.2, QC, compliance + AST UI `no-undef` check + `npm run build` dijalankan & dipastikan lulus 100%.
- Artefak perbandingan prompt: [`plans/planner-scene-director/prompt-diff.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/planner-scene-director/prompt-diff.md).

---

## K7: Polish Scene Director sebelum Produksi (`K7.1` – `K7.12`)

> **Urutan Prioritas Eksekusi:** `K7.11` ➔ `K7.10` + `K7.12` ➔ `K7.9` ➔ `K7.1` s/d `K7.8` ➔ Verifikasi Tes Lokal & Build.
> **Boundary Flag:** Seluruh perilaku khusus Scene Director tetap ter-gating di belakang `planner_scene_director = 'on'` (default `'off'`). `start_frame_visual_qc_batch` default `'off'`.

### Execution Task List (K7)

- [x] **K7.11 — Fix VO Audit Postgres `bigint` & DB Whitelist** (`lib/scheduler-processors.js`, `lib/db.js`, `app/pillar-campaigns/[id]/page.js`)
- [x] **K7.10 — Quota & Pool Management: Per-(key, model) Usage, Count Every HTTP Attempt, Dedicated QC Model, 15% Quota Brake & Settings UI** (`lib/db.js`, `lib/db-pg.js`, `lib/gemini.js`, `lib/scheduler-processors.js`, `app/api/settings/route.js`, `app/api/keys/route.js`, `app/settings/page.js`, `app/pillar-campaigns/[id]/page.js`)
- [x] **K7.12 — Observability: Structured `[GEMINI_CALL]` Log & Complete `recordAiTokenUsage` Coverage** (`lib/gemini.js`, `lib/tiktok-compliance-service.js`, `lib/gemini-tts-batch.js`, `lib/gemini-8s-tts.js`, `lib/start-frame-visual-qc.js`)
- [x] **K7.9 — Visual QC Batch + Consistency Check + Retry Compare-to-Passing + Shadow Diff (`start_frame_visual_qc_batch`)** (`lib/start-frame-visual-qc.js`, `lib/scheduler-processors.js`, `app/pillar-campaigns/[id]/page.js`)
- [x] **K7.1 — Action-Verb Enforcement & Passive-Pose Limit (`max 1`, never clip 1/2/last)** (`lib/angle-visual-formats.js`, `lib/prompts.js`, `lib/scene-diversity-guard.js`)
- [x] **K7.2 — Metaphor Engine `mode = 'hook_only'` for Scene Director** (`lib/visual-identity-contract.js`, `lib/visual-identity-system-presets.js`, `lib/metaphor-policy.js`, `lib/visual-identity-allocator.js`, `lib/prompts.js`, `lib/scheduler-processors.js`)
- [x] **K7.3 — Wardrobe Color-Locking + 1 Neutral "Hands + Garment" `wardrobe_reference_image` per Video** (`lib/visual-identity-system-presets.js`, `lib/metaphor-policy.js`, `lib/scheduler-processors.js`, `lib/opc-start-frame-request.js`)
- [x] **K7.4 — Chest-Down Below-Shoulders Framing + Clean `3d_bio_cellular` (No Clothed Torso / HUD Text)** (`lib/prompts.js`, `lib/opc-start-frame-request.js`, `lib/visual-identity-allocator.js`)
- [x] **K7.5 — Tight Night Lighting Lock (Dark Windows/Curtains + Warm Practical Lamp) & `time_of_day_mismatch` Check** (`lib/scene-brief.js`, `lib/prompts.js`, `lib/start-frame-visual-qc.js`)
- [x] **K7.6 — Ban Jars/Glass Bottles in Pre-Bridge Kitchen/Pantry/Dining Backgrounds** (`lib/scene-brief.js`, `lib/prompts.js`, `lib/opc-start-frame-request.js`)
- [x] **K7.7 — Planner-Driven Start Frame QC Rubric (`environment_policy === 'planner_driven'`)** (`lib/start-frame-visual-qc.js`)
- [x] **K7.8 — Strip `[CAMERA FRAMING: …]` & Internal Injection Tags from Storyboard UI Descriptions** (`lib/scheduler-processors.js`, `app/pillar-campaigns/[id]/page.js`)
- [x] **K7-Verify — Run Full K7 + Existing Unit Tests & `npm run build` (Stop Before Release/Deploy)**

---

### K7 Before & After Snippets per Area

#### A. K7.11 — VO Audit Bug & Whitelist
**Code Sebelum (`lib/scheduler-processors.js:5972-6006`, `lib/db.js:2499-2512`, `app/pillar-campaigns/[id]/page.js:2279`):**
```js
// lib/scheduler-processors.js
if (campaign.enable_vo_audit === 1) {
  ...
  updatePillarCampaignItem(item.id, {
    compliance_status: ..., compliance_score: ..., compliance_log_json: ...,
    original_voiceover_json: JSON.stringify(parsed.voiceover), // after mutating parsed.voiceover!
  });
}
// lib/db.js -> allowed[] omits compliance_status, compliance_score, compliance_log_json, rewritten_voiceover_json, original_voiceover_json, active_vo_version
// app/pillar-campaigns/[id]/page.js
{campaign.enable_vo_audit === 1 && item.compliance_status && (
```
**Code Sesudah:**
```js
const isCampaignFlagEnabled = (v) => v === true || Number(v) === 1;
if (isCampaignFlagEnabled(campaign.enable_vo_audit)) {
  const preAuditVoiceover = JSON.parse(JSON.stringify(parsed.voiceover || []));
  ...
  await updatePillarCampaignItem(item.id, { ...complianceFields, original_voiceover_json: JSON.stringify(preAuditVoiceover) });
}
// lib/db.js: add all 6 compliance/vo columns to allowed[]
// app/pillar-campaigns/[id]/page.js: {isFlagOn(campaign.enable_vo_audit) && item.compliance_status && ( ...
```

#### B. K7.10 & K7.12 — Per-Model Quota Pool, Full HTTP Counting, 15% Brake & `[GEMINI_CALL]` Telemetry
**Code Sebelum (`lib/db.js:21,906-1027`, `lib/gemini.js:548-649,1036-1063`):**
- `api_key_usages` ber-key `(date, key_id)` tanpa membedakan model.
- `executeWithKeyPool` hanya memanggil `incrementKeyUsage` saat sukses; attempt gagal `503`/`404`/`429` sebelum rotasi tidak tercatat.
- `generateWithImage`, `callGeminiJson` (Compliance), dan `callGeminiTtsApi` / TTS batch tidak mencetak log `[GEMINI_CALL]` seragam maupun mencatat `recordAiTokenUsage`.
**Code Sesudah:**
- `lib/db-pg.js` + `lib/db.js`: tambah kolom `model_name TEXT NOT NULL DEFAULT 'gemini-3.6-flash'` + unique index `(date, key_id, model_name)` di `api_key_usages`, plus `getAvailableApiKey({ cost, excludedIds, modelName })`, `incrementKeyUsage(keyId, cost, modelName)`, dan `getPoolQuotaStatus({ modelName, thresholdRatio: 0.15 })`.
- `lib/gemini.js`: tambah helper trace & `recordGeminiHttpAttempt(...)` yang memanggil `incrementKeyUsage` pada setiap request HTTP nyata (sukses/gagal/rotasi), log `[GEMINI_CALL] module=... model=... key_id=... attempt=... http_status=... tokens=...ms=...`, serta melengkapi `recordAiTokenUsage` pada Vision QC, Compliance, dan TTS.
- `lib/scheduler-processors.js`: rem kuota 15% (`getPoolQuotaStatus`) menahan pickup item Pending Free Pool secara bersih (`Ditahan: kuota Gemini harian <15%`) tanpa menaikkan `retry_count`.
- `app/api/settings/route.js` + `app/api/keys/route.js` + `app/settings/page.js`: tambah `start_frame_visual_qc_model` (default mengikuti cascade / model QC terpisah) dan ringkasan kuota per model di Pool Manager.

#### C. K7.9 — Start Frame Visual QC Batch + Consistency + Shadow Mode
**Code Sebelum (`lib/start-frame-visual-qc.js`, `lib/scheduler-processors.js:6399-6466`):**
- `evaluateAndRecordStartFrameQc` hanya menginspeksi 1 gambar per panggilan Gemini Vision (`6 klip = 6+ vision calls`).
**Code Sesudah:**
- Tambah `START_FRAME_QC_BATCH_SETTING_KEY = 'start_frame_visual_qc_batch'` (`'off'` default) dan `evaluateBatchStartFramesQc(...)` (`1` call multi-image untuk seluruh klip + cek konsistensi warna baju & lokasi antar-klip).
- Saat `retry` klip gagal, kirim `clipGagal` + `1 clipLulus` untuk verifikasi konsistensi; fallback ke per-clip jika batch gagal parsing/timeout; dukung fungsi pembanding `compareBatchVsPerClipQc` untuk uji staging shadow mode.

#### D. K7.1 – K7.8 — Prompt, Wardrobe, Framing, Night, Kitchen Jars, QC Rubric & UI Metadata
**Code Sebelum (`lib/prompts.js`, `lib/opc-start-frame-request.js`, `lib/scene-brief.js`, `lib/start-frame-visual-qc.js`, `lib/scheduler-processors.js`):**
- K7.1: Silent kinetics memberi contoh `"tangan diam di samping objek"`.
- K7.2: `metaphor_engine` preset tidak punya mode `'hook_only'`.
- K7.3: Wardrobe hanya berupa teks prompt tanpa 1 reference image kain+tangan latar netral.
- K7.4: Framing kadang masih menampilkan bahu/dada atas (`cropped tightly below the chest`) dan klip 3D kadang memunculkan torso berpakaian / label HUD teks.
- K7.5: Adegan malam tidak mengunci tirai gelap/jendela buram malam + lampu hangat.
- K7.6: Dapur/pantry pre-bridge bebas menampilkan toples bumbu/botol berlabel.
- K7.7: Rubric QC selalu memakai lensa Metaphor World / Studio Void meski `environment.policy === 'planner_driven'`.
- K7.8: Tag `[CAMERA FRAMING: …]` bisa ikut tersimpan dan tampil di UI `storyboard[*].visual_description`.
**Code Sesudah:**
- Perbarui 8 modul terkait sesuai spesifikasi K7.1–K7.8 (ter-gating aman pada flag/policy) serta fungsi `stripInternalVisualPromptTags()` pada `scheduler-processors.js` dan defensif di `app/pillar-campaigns/[id]/page.js`.
