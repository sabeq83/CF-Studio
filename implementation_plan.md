# Implementation Plan: VI & Preset Shopee 2 Klip (Try-On & Unboxing, Produk Langsung di Klip 1, VO / Tanpa VO)

**Sumber Usulan:** [usulan-cf-studio-shopee-2klip-tryon-unboxing.md](file:///Users/sabeqmmursyid/cf-autopipeline/usulan-cf-studio-shopee-2klip-tryon-unboxing.md)  
**Target Branch Kerja:** `fitur/shopee-2klip-tryon-unboxing` (dibuat dari `main` `v2.60.0` saat eksekusi dimulai)  
**Catatan Prasyarat:** Fondasi mode Tanpa VO (`audio_engine_mode = 'no_vo'`, `compileVeoAmbientOnlyPrompt`, serta guard FFmpeg `isTtsOptionalMode` pada `lib/scheduler-processors.js:4214` & `8543`) sudah aktif dan dirilis pada `v2.60.0` — tidak perlu diimplementasikan ulang.  
**Catatan UI Mockup:** Perubahan UI hanya menambahkan 1 `<option value="Direct_Showcase">` di dropdown `Narrative Mode` pada 3 form yang sudah ada (`presets/page.js`, `MultiplierConfigurationForm.js`, `PillarConfigurationForm.js`), sedangkan VI & Preset baru otomatis tampil di daftar sistem yang ada. Mohon konfirmasi jika ingin langsung dikerjakan tanpa mockup HTML terpisah.

---

## Execution Task List

### Tahap 0 — Persiapan Branch
- [x] Buat dan checkout branch baru `fitur/shopee-2klip-tryon-unboxing` dari `main` terbaru (`v2.60.0`)

### Tahap 1 — Prompt Story Curve, Zoning & Guard `bridgeAtClip === 1` (`targetClips = 2`)
- [x] Perbarui `buildDynamicStoryCurveGuideline` di [lib/kb/dynamic-story-curve.js](file:///Users/sabeqmmursyid/_cfstudio/lib/kb/dynamic-story-curve.js) agar menerima `narrativeMode`, menambahkan cabang 2 klip `Direct_Showcase` (`clipsCount === 2 && (bridgeAtClip === 1 || narrativeMode === 'Direct_Showcase')`), dan menghapus `KLIP 2 SAMPAI 1` saat `clipsCount === 2`
- [x] Perhalus wording zona `intro` di [lib/bridging/bridge-prompt-zones.js](file:///Users/sabeqmmursyid/_cfstudio/lib/bridging/bridge-prompt-zones.js) saat `bridgeAtClip === 1` (tanpa menyebut "menjawab konteks klip sebelumnya")
- [x] Perbaiki guard `bridgeAtClip === 1`, rentang produk penuh (`productClips.length >= targetClips`), dan tambahkan mandat `Direct_Showcase` di [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildReverseEngineeringPrompt`, `buildReverseEngineeringBridgePrompt`, `buildPillarSharedPromptContext`, `buildOrganicPillarPrompt`, `buildMultiplierPhase2Prompt`)

### Tahap 2 — Visual Identity Schema v2, Metaphor Policy & Visual QC Klip 1 Produk
- [x] Tambahkan `shopee_unboxing_pov_hands` dan `shopee_tryon_faceless_fit` ke `SYSTEM_VISUAL_IDENTITIES` di [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js)
- [x] Pertahankan `metaphorEngine.hands_policy === 'modest_hands_active'` pada mode non-metaphor (`metaphor_engine.enabled = false`) saat subjek kompatibel tangan aktif di [lib/metaphor-policy.js](file:///Users/sabeqmmursyid/_cfstudio/lib/metaphor-policy.js)
- [x] Perbarui `deriveQcContext` dan label wardrobe di [lib/start-frame-visual-qc.js](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js) agar Klip 1 produk dengan `metaphor_engine.enabled === false` (`hands_only` / `crop_below_neck`) diperiksa sebagai `PRODUCT/HERO FRAME` bertangan POV/tubuh tanpa wajah (`expectsObjectOnly = false`) dan menghormati deskripsi wardrobe tetap VI (tidak jatuh ke `resolveVideoVariety`)

### Tahap 3 — Operator Preset 2 Klip & Opsi Dropdown `Direct_Showcase`
- [x] Tambahkan `shopee_2clip_showcase_vo` dan `shopee_2clip_showcase_no_vo` di [lib/operator-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js) (`campaign_kinds: ['multiplier_campaign', 'product_campaign']`)
- [x] Tambahkan opsi `<option value="Direct_Showcase">` di dropdown `Narrative Mode` pada [app/settings/presets/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js), [MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js), dan [PillarConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/PillarConfigurationForm.js)

### Tahap 4 — Unit Test, Build Lokal & Deploy Dev
- [x] Buat unit test [tests/shopee-2clip-showcase.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/shopee-2clip-showcase.test.mjs) (verifikasi bebas frasa pre-bridge saat `bridgeAtClip === 1`, bebas `KLIP 2 SAMPAI 1`, validasi Schema v2 kedua VI baru, QC verdict `hands_only` & `crop_below_neck`, dan hidrasi 2 preset Shopee)
- [x] Jalankan seluruh unit test (`PG_SEARCH_PATH=dev node --test ...`) dan build lokal (`DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`)
- [x] Push branch `fitur/shopee-2klip-tryon-unboxing` dan deploy atomic ke **Dev (`5020/7020`)** untuk uji render 1 video Unboxing (Tanpa VO) + 1 video Try-On (Dengan VO)

---

## Rincian Perubahan Kode (Code Sebelum & Sesudah)

### 1. [lib/kb/dynamic-story-curve.js](file:///Users/sabeqmmursyid/_cfstudio/lib/kb/dynamic-story-curve.js)

**Code Sebelum (Current/Before):**
```js
export function buildDynamicStoryCurveGuideline({
  campaignKind = 'brand_editorial', // 'brand_editorial' | 'product_campaign' | 'multiplier'
  targetClips = 4,
  bridgeAtClip = 2,
  bridgeDurationClips = 1,
  bridgePlan = null,
  language = 'id-ID',
  brandVoice = '',
  targetAudience = '',
  objective = ''
}) {
  ...
STRUKTUR KURVA CERITA PROPORSIONAL:
1. KLIP 1 (HOOK / OPENING - 3 Detik Pertama):
   - Wajib memikat perhatian instan penonton dan menghentikan scrolling.
   ${isEditorial 
     ? '- Gunakan hook emosional, pertanyaan menggelitik, atau sudut pandang kontraintuitif tanpa menyebut nama produk.' 
     : (isMultiplier
       ? '- Ambil hook viral / emosional kuat dari referensi asli untuk memikat audiens sebelum mengenalkan produk.'
       : '- Tampilkan visual masalah nyata, rasa frustrasi sehari-hari, atau situasi sebelum produk digunakan.')}

2. KLIP 2 SAMPAI ${clipsCount - 1} (PROGRESSION / INTI PESAN & SEAMLESS BRIDGING):
   - Total adegan di tengah: ${clipsCount - 2} klip. Eskalasi alur cerita secara bertahap dan mulus.
```

**Code Sesudah (Proposed/After):**
```js
export function buildDynamicStoryCurveGuideline({
  campaignKind = 'brand_editorial', // 'brand_editorial' | 'product_campaign' | 'multiplier'
  targetClips = 4,
  bridgeAtClip = 2,
  bridgeDurationClips = 1,
  bridgePlan = null,
  narrativeMode = 'Storytelling',
  language = 'id-ID',
  brandVoice = '',
  targetAudience = '',
  objective = ''
}) {
  const isDirectShowcase = !isEditorial && (
    narrativeMode === 'Direct_Showcase' ||
    (clipsCount <= 2 && Number(bridgeAtClip) <= 1)
  );
  // Jika clipsCount === 2 && isDirectShowcase:
  // Cetak STRUKTUR KURVA CERITA 2 KLIP (DIRECT SHOWCASE / SHOPEE):
  //   1. KLIP 1 (INSTANT PRODUCT REVEAL / UNBOXING / TRY-ON): produk langsung terlihat sejak detik ke-1
  //   2. KLIP 2 (PROOF, DETAIL & SOFT CTA): detail fisik/fit/fungsi + soft CTA
  // Jika clipsCount === 2 && !isDirectShowcase:
  //   Langsung 1. KLIP 1 (HOOK / OPENING) -> 2. KLIP 2 (BRIDGING & RESOLUTION / CTA), tanpa "KLIP 2 SAMPAI 1 (Total adegan di tengah: 0 klip)".
```

---

### 2. [lib/bridging/bridge-prompt-zones.js](file:///Users/sabeqmmursyid/_cfstudio/lib/bridging/bridge-prompt-zones.js)

**Code Sebelum (Current/Before):**
```js
export function buildBridgeZoningContract(plan, options = {}) {
  const {
    mode = 'multiplier', // 'multiplier' | 'pillar'
    productName = '',
    productUsp = '',
    promoStyle = 'Softselling',
    mandatoryOutroLine = ''
  } = options;
  ...
    return `🚨 PRODUCT BRIDGING & STRICT CLIP ZONING CONTRACT (TOTAL ${targetClipsCount} KLIP, BRIDGING MULAI KLIP #${bridgeAtClip}):
${bridgeAtClip > 1 ? `1. **ZONA PRE-BRIDGING (${preBridgeRange})**: ...` : ''}
${bridgeAtClip > 1 ? '2' : '1'}. **TITIK PIVOT BRIDGING (TEPAT DI KLIP #${bridgeAtClip})**: Di sinilah produk "${productName}" pertama kali diperkenalkan secara halus sebagai kunci/solusi alami yang menjawab konteks klip sebelumnya. Hubungkan USP produk ("${productUsp}") ke aksi visual adegan tanpa terdengar seperti iklan yang dipaksakan.
```
*(Serta baris 61 pada multi-segment: `sebagai jawaban alami atas konteks sebelumnya` untuk `z.start === 1`.)*

**Code Sesudah (Proposed/After):**
```js
    const introReasonText = bridgeAtClip === 1
      ? `Di sinilah produk "${productName}" langsung ditampilkan dan diperkenalkan sejak detik pertama (Direct Showcase / Unboxing / Try-On). Hubungkan USP produk ("${productUsp}") secara visual & natural.`
      : `Di sinilah produk "${productName}" pertama kali diperkenalkan secara halus sebagai kunci/solusi alami yang menjawab konteks klip sebelumnya. Hubungkan USP produk ("${productUsp}") ke aksi visual adegan tanpa terdengar seperti iklan yang dipaksakan.`;
```
*(Hal serupa pada baris 61: bila `z.start === 1`, pakai wording langsung tampil pada Klip 1 tanpa merujuk klip sebelumnya.)*

---

### 3. [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js)

**Code Sebelum (Current/Before):**
1. Caller `buildDynamicStoryCurveGuideline` (baris 1043, 2213, 4393) belum mengirim `narrativeMode`.
2. `buildReverseEngineeringPrompt` (baris 1291–1307) & `buildReverseEngineeringBridgePrompt` (baris 1600–1615) hanya memuat aturan `Storytelling`, `Problem-Solution`, `Educational`.
3. `buildReverseEngineeringBridgePrompt` (baris 1641–1713):
   - Mencetak `- PADA KLIP DI LUAR RENTANG TERSEBUT (Klip sebelum ke-${bridgeAtClip} atau sesudah ke-${productEndClip}): DILARANG KERAS...` bahkan ketika `bridgeAtClip === 1 && productEndClip >= targetClips`.
   - Mencetak `[ZONA 1: RETENSI VIRAL] (Klip 1 hingga Klip ${bridgeAtClip - 1})` tanpa cek `bridgeAtClip > 1` (menjadi `Klip 1 hingga Klip 0`).
4. `buildPillarSharedPromptContext`:
   - Baris 2455–2613: `const maxPreBridgeClip = Math.max(1, bridgeAtClip - 1);` mencetak blok `PADA KLIP 1 s/d 1 (PRE-BRIDGING)` dan `DILARANG MEMPERKENALKAN PRODUK SEBELUM KLIP 1!` ketika `bridgeAtClip === 1`.
   - Baris 3023–3035: mencetak `- PADA KLIP DI LUAR RENTANG TERSEBUT (Klip sebelum ke-1 atau sesudah ke-2)` dan `menghubungkan masalah di Klip 1 dengan penggunaan produk di Klip ke-1` meski semua klip adalah klip produk.
5. `buildOrganicPillarPrompt` (baris 3561–3579): tidak punya cabang `Direct_Showcase`, dan mencetak `Klip 2 s/d ${bridgeAtClip - 1}` saat `bridgeAtClip === 1`.
6. `buildMultiplierPhase2Prompt`:
   - Baris 4367–4377: meski semua klip masuk segmen produk (`bridgePlan.productClips.length >= targetClipsCount`), baris 4367 tetap mencetak `Untuk klip di luar rentang produk (Klip sebelum ke-1 atau sesudah ke-2):` lengkap dengan skema `Geometric Truth: strictly no product shown`.
   - Baris 4409: selalu mewajibkan `"Sebelum nama produk disebutkan di klip pivot..."` meski `bridgeAtClip === 1`.

**Code Sesudah (Proposed/After):**
```js
// 1. Teruskan `narrativeMode` pada seluruh pemanggilan `buildDynamicStoryCurveGuideline`.
// 2. Definisikan helper `buildDirectShowcaseNarrativeRule(targetClips)` dan `hasDirectShowcaseMode({ narrativeMode, bridgeAtClip, targetClips })`
//    yang aktif bila `narrativeMode === 'Direct_Showcase'` atau `(bridgeAtClip <= 1 && targetClips <= 2)`.
// 3. Di buildReverseEngineeringBridgePrompt (1641–1713):
const clampedProductEndClip = bridgeDurationClips > 0 ? Math.min(targetClips, bridgeAtClip + bridgeDurationClips - 1) : targetClips;
const hasPreBridgeZones = bridgeAtClip > 1;
const hasOutsideProductRange = bridgeAtClip > 1 || clampedProductEndClip < targetClips;
// Guard blok "PADA KLIP DI LUAR RENTANG TERSEBUT" dengan hasOutsideProductRange,
// dan bungkus "[ZONA 1: RETENSI VIRAL]" dengan `${hasPreBridgeZones ? ... : ''}`.

// 4. Di buildPillarSharedPromptContext (2455–2613 & 3023–3035):
const hasPreBridge = bridgeAtClip > 1;
const maxPreBridgeClip = hasPreBridge ? (bridgeAtClip - 1) : 0;
// Semua blok PRE-BRIDGING (2468, 2498–2517, 2555–2561, 2599–2605) hanya dicetak bila `hasPreBridge === true`.
// Di productInstruction (3023–3035), hanya cetak "PADA KLIP DI LUAR RENTANG TERSEBUT" bila `(bridgeAtClip > 1 || productEndClip < targetClips)`.

// 5. Di buildMultiplierPhase2Prompt (4360–4377 & 4405–4473):
const hasNonProductClips = isPureStorytelling || bridgePlan.productClips.length < targetClipsCount;
// Hanya render instruksi & skema T2I/I2V non-produk (baris 4367–4377) bila `hasNonProductClips === true`.
// Di sentenceIntegrityAndToneContract, sesuaikan poin #3 jika `bridgeAtClip === 1` / `Direct_Showcase` agar mendukung instant reveal di Klip 1.
```

---

### 4. [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js)

**Code Sebelum (Current/Before):**
```js
// SYSTEM_VISUAL_IDENTITIES berakhir di `home_living_product_still_life` (baris 1303).
```

**Code Sesudah (Proposed/After):**
```js
// Tambahkan 2 entry ke SYSTEM_VISUAL_IDENTITIES:
// 1. `shopee_unboxing_pov_hands` ("Shopee Unboxing — Hands-Only POV"):
//    - subject.kind: 'human', faceless_mode: 'hands_only', custom_description POV hands unboxing parcel
//    - visual_language.primary_style: 'commercial_product_cinematic', supporting_styles: ['cinematic_realistic']
//    - metaphor_engine: { enabled: false, mode: 'off', hands_policy: 'modest_hands_active', product_entry: 'inside_metaphor', lighting_arc: 'none', compact_prompts: true }
//    - wardrobe: mode 'fixed', sleeve_policy 'wrists_covered', clean neutral knit/cotton long-sleeve
//    - camera: framing 'forearms_and_hands', perspective 'first_person', lens_look 'natural_50mm', movement 'subtle_handheld'
//    - guardrails: face_visibility 'prohibited', reflection_face 'prohibited', unintended_people 'prohibited'
//
// 2. `shopee_tryon_faceless_fit` ("Shopee Try-On — Faceless Fit Check"):
//    - subject.kind: 'human', faceless_mode: 'crop_below_neck', custom_description chin/collarbone down mirror fit check
//    - visual_language.primary_style: 'cinematic_realistic', supporting_styles: ['commercial_product_cinematic']
//    - metaphor_engine: { enabled: false, mode: 'off', hands_policy: 'modest_hands_active', product_entry: 'inside_metaphor', lighting_arc: 'none', compact_prompts: true }
//    - wardrobe: mode 'fixed', sleeve_policy 'wrists_covered', minimalist neutral everyday outfit
//    - camera: framing 'crop_below_neck', perspective 'third_person', lens_look 'natural_50mm', movement 'slow_pan'
//    - guardrails: face_visibility 'prohibited', reflection_face 'prohibited', unintended_people 'prohibited'
```

---

### 5. [lib/metaphor-policy.js](file:///Users/sabeqmmursyid/_cfstudio/lib/metaphor-policy.js)

**Code Sebelum (Current/Before):**
```js
  if ((!isMetaphoricFaceless && !explicitHookOnly) || isInvestigativeFaceless || (sceneDirectorActive && rawEngineMode === 'off')) {
    reasons.push(isInvestigativeFaceless ? 'investigative_faceless_locked' : (sceneDirectorActive && rawEngineMode === 'off' ? 'metaphor_engine_mode_off' : 'not_metaphoric_faceless'));
    return {
      active: false,
      mode: 'off',
      environmentPolicy: structured.environment?.policy === 'planner_driven' ? 'planner_driven' : 'brand_locked',
      handsPolicy: isInvestigativeFaceless || !sceneDirectorActive ? 'zero_hands' : (metaphorEngine.hands_policy === 'modest_hands_active' ? 'modest_hands_active' : 'zero_hands'),
      ...
    };
  }
```

**Code Sesudah (Proposed/After):**
```js
  if ((!isMetaphoricFaceless && !explicitHookOnly) || isInvestigativeFaceless || (sceneDirectorActive && rawEngineMode === 'off')) {
    const canKeepModestHands = !isInvestigativeFaceless
      && metaphorEngine.hands_policy === 'modest_hands_active'
      && (!structured.subject || (
        (structured.subject.kind || 'human') === 'human'
        && HANDS_COMPATIBLE_FACELESS_MODES.has(structured.subject.faceless_mode || 'hands_only')
      ));
    reasons.push(isInvestigativeFaceless ? 'investigative_faceless_locked' : (sceneDirectorActive && rawEngineMode === 'off' ? 'metaphor_engine_mode_off' : 'not_metaphoric_faceless'));
    return {
      active: false,
      mode: 'off',
      environmentPolicy: structured.environment?.policy === 'planner_driven' ? 'planner_driven' : 'brand_locked',
      handsPolicy: canKeepModestHands ? 'modest_hands_active' : 'zero_hands',
      ...
    };
  }
```

---

### 6. [lib/start-frame-visual-qc.js](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js)

**Code Sebelum (Current/Before):**
```js
  const isEnvironmentOnly = isEnvironmentObjectOnlyVisualConfig({ campaign, row: item });
  const isMetaphoric = campaign?.visual_style === 'metaphoric_faceless' || Boolean(policy?.active);
  const metaphorMode = policy?.mode || (isMetaphoric ? 'full_metaphor' : 'off');
  const handsPolicy = isEnvironmentOnly
    ? 'zero_hands'
    : (policy?.handsPolicy || (environmentPolicy === 'planner_driven' ? 'modest_hands_active' : 'zero_hands'));
  const expectsObjectOnly = isEnvironmentOnly || ((isMetaphoric || metaphorMode === 'hook_only') && (cIdx === 1 || handsPolicy === 'zero_hands'));
  const savedWardrobe = parsedResult?.resolved_wardrobe_color || campaign?.resolved_wardrobe_color;
  const fallbackVariety = (item?.id || campaign?.id) ? resolveVideoVariety(item?.id || campaign?.id) : null;
  const expectedWardrobeLabel = (!isEnvironmentOnly && handsPolicy === 'modest_hands_active' && !expectsObjectOnly)
    ? (savedWardrobe?.label || fallbackVariety?.wardrobeColorLabel || '')
    : '';
```

**Code Sesudah (Proposed/After):**
```js
  const rawVisualOverrides = parseJson(campaign?.visual_overrides_json || item?.visual_overrides_json, {});
  const viStructured = rawVisualOverrides?.structured || rawVisualOverrides || {};
  const viFacelessMode = viStructured?.subject?.faceless_mode || campaign?.faceless_mode || '';
  const viMetaphorOffWithActiveHands = Boolean(
    !isEnvironmentOnly
    && viStructured?.metaphor_engine?.enabled === false
    && viStructured?.metaphor_engine?.hands_policy === 'modest_hands_active'
    && (viStructured?.subject?.kind || 'human') === 'human'
    && ['hands_only', 'first_person_pov', 'crop_below_neck'].includes(viFacelessMode || 'hands_only')
  );
  const isDirectProductClip1 = Boolean(req.required && bridgePlan.firstBridgeClip === 1 && viStructured?.metaphor_engine?.enabled === false);
  const handsPolicy = isEnvironmentOnly
    ? 'zero_hands'
    : (viMetaphorOffWithActiveHands ? 'modest_hands_active' : (policy?.handsPolicy || (environmentPolicy === 'planner_driven' ? 'modest_hands_active' : 'zero_hands')));
  const expectsObjectOnly = isEnvironmentOnly
    || (!isDirectProductClip1 && (isMetaphoric || metaphorMode === 'hook_only') && (cIdx === 1 || handsPolicy === 'zero_hands'));
  const hasPalette = Array.isArray(viStructured?.wardrobe?.palette) && viStructured.wardrobe.palette.length > 0;
  const fixedViWardrobeDesc = viStructured?.wardrobe?.mode === 'fixed' && !hasPalette
    ? (viStructured?.wardrobe?.custom_description || '')
    : '';
  const expectedWardrobeLabel = (!isEnvironmentOnly && handsPolicy === 'modest_hands_active' && !expectsObjectOnly)
    ? (savedWardrobe?.label || fixedViWardrobeDesc || fallbackVariety?.wardrobeColorLabel || '')
    : '';
```

---

### 7. [lib/operator-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js)

**Code Sebelum (Current/Before):**
```js
// PRESETS berakhir di `multiplier_home_living_no_vo_asmr` (baris 684).
```

**Code Sesudah (Proposed/After):**
```js
// Tambahkan 2 preset sistem pada PRESETS:
// 1. `shopee_2clip_showcase_vo` ("Shopee 2 Klip Direct Showcase (Dengan VO — Omni Flash)")
//    - campaign_kinds: ['multiplier_campaign', 'product_campaign']
//    - basic_strategy: narrative_mode 'Direct_Showcase', audio_engine_mode 'minimax_tts', mandatory_outro_line 'Cek keranjang sekarang ya!'
//    - visual_engine: { visual_style: 'UGC', visual_mode: 'hybrid_lock', video_model: 'omni_flash', clip_duration: 4, face_visibility: 'Faceless', target_clips_count: 2, words_per_clip: '8-12 kata', aspect_ratio: '9:16' }
//    - product_bridging: { is_bridging_active: true, bridging_mode: 'select_existing', bridge_at_clip: 1, bridge_duration_clips: 2, bridge_segments: [{ at_clip: 1, duration_clips: 2, role: 'intro' }] }
//    - visual_swap: visual_identity_preset_id 'shopee_unboxing_pov_hands'
//    - workflow: enable_tts true, audio_engine_mode 'minimax_tts', enable_motion_text true, ffmpeg_sync_option 'smart_sync'
//
// 2. `shopee_2clip_showcase_no_vo` ("Shopee 2 Klip Direct Showcase (Tanpa VO / ASMR — Omni Flash)")
//    - campaign_kinds: ['multiplier_campaign', 'product_campaign']
//    - basic_strategy: narrative_mode 'Direct_Showcase', audio_engine_mode 'no_vo', no_vo_audio_bed 'native_sfx_ambience', on_screen_text_mode 'short_caption_overlay', mandatory_outro_line ''
//    - visual_engine: sama, words_per_clip '0 kata'
//    - product_bridging: sama (at_clip: 1, duration_clips: 2)
//    - visual_swap: visual_identity_preset_id 'shopee_unboxing_pov_hands'
//    - workflow: enable_tts false, audio_engine_mode 'no_vo', no_vo_audio_bed 'native_sfx_ambience', on_screen_text_mode 'short_caption_overlay', ffmpeg_sync_option 'shortest'
```

---

### 8. Dropdown UI `Narrative Mode` ([app/settings/presets/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js), [MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js), [PillarConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/PillarConfigurationForm.js))

**Code Sebelum (Current/Before):**
```jsx
<option value="Storytelling">Storytelling</option>
<option value="Problem-Solution">Problem-Solution</option>
<option value="Educational">Educational</option>
```

**Code Sesudah (Proposed/After):**
```jsx
<option value="Storytelling">Storytelling</option>
<option value="Problem-Solution">Problem-Solution</option>
<option value="Educational">Educational</option>
<option value="Direct_Showcase">Direct Showcase (Produk Langsung Klip 1 / Shopee 2 Klip)</option>
```

---

### 9. [tests/shopee-2clip-showcase.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/shopee-2clip-showcase.test.mjs) (File Baru)
- Menguji `buildDynamicStoryCurveGuideline`, `buildBridgeZoningContract`, `buildOrganicPillarPrompt`, `buildReverseEngineeringBridgePrompt`, dan `buildMultiplierPhase2Prompt` dengan `targetClips = 2`, `bridge_at_clip = 1`, `bridge_duration_clips = 2`, `narrative_mode = 'Direct_Showcase'`: memastikan tidak ada frasa `KLIP 2 SAMPAI 1`, `Klip 1 hingga Klip 0`, `PADA KLIP 1 s/d 1 (PRE-BRIDGING)`, atau `strictly no product shown`.
- Menguji `getSystemVisualIdentity('shopee_unboxing_pov_hands')` dan `getSystemVisualIdentity('shopee_tryon_faceless_fit')` via `validateAndNormalizeVisualIdentity`.
- Menguji `deriveQcContext` + `evaluateQcChecklistVerdict` pada Klip 1 produk (`hands_only` & `crop_below_neck`) agar lulus tanpa false positive `pre_bridge_product` maupun `zero_hands`.
- Menguji `resolveOperatorPreset` untuk `shopee_2clip_showcase_vo` & `shopee_2clip_showcase_no_vo`.
