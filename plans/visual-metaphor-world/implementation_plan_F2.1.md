# Implementation Plan F2.1: Prompt Hygiene, Positive Framing, Hero Finale, Lighting Contrast & Start-Frame Visual QC

**Source Specification**: [`plans/visual-metaphor-world/antigravity-instructions-F2.1-fix-and-antihallucination.md`](file:///Users/sabeqmmursyid/_cfstudio/plans/visual-metaphor-world/antigravity-instructions-F2.1-fix-and-antihallucination.md)  
**Staging Reference Batch**: Campaign `opc_261114_g0zltt` (7 DapurBotani videos, 42 clips, VI `vi_dapurbotani_metaphor_world_test`, Product `pe_1793545394035_6698` Garlibee Madu Bawang Lanang).

---

## 1. Hasil Investigasi Sebelum Koding

### A. Provider Negative-Prompt Capability Map (`lib/webhook-client.js`)
| Pipeline Stage | Function & Provider Model | Endpoint | Payload Fields Sent | Negative Prompt Support |
|---|---|---|---|---|
| **T2I Start Frame** | `generateImage()` (`nano_banana_2`, `nano_banana_pro`, `nano_banana_2_lite`) | `POST /api/image/generate` | `prompt`, `model`, `aspect_ratio`, `reference_images`, `upscale` | **TIDAK ADA.** `sanitizeImagePrompt()` justru menghapus `NEGATIVE PROMPT:` & `--no ...`, dan `generateImage` tidak mengirim `negative_prompt`. |
| **I2V Video** | `generateVideo()` (`veo_31_lite`, G-Labs Veo) | `POST /api/video/generate` | `prompt`, `model`, `aspect_ratio`, `mode`, `video_length`, `duration`, `resolution`, `reference_images` | **TIDAK ADA.** Tidak ada field `negative_prompt` yang diteruskan ke worker/provider. |

**Bug Tambahan Ditemukan (`lib/webhook-client.js:250`)**:  
`sanitizeImagePrompt()` menjalankan `cleaned.replace(/,?\s*strictly\s+no\s+[^,)]+/gi, '')`. Karena regex berhenti pada koma, kalimat `(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)` terpotong menjadi `(Geometric Truth, jar, or packaging)` — menyisakan kata positif **`jar, or packaging`** tepat di tengah prompt pre-bridge ke NanoBanana!

**Kesimpulan**: Seluruh aturan objek-saja, tangan sopan, dan permukaan bersih **wajib** memakai **positive framing** di dalam `prompt` & `i2v_prompts` (tanpa menyebut `no bottle`, `no jar`, `ZERO HANDS`, `no bare arms`, `no face`).

### B. Akar Masalah B3 — Mengapa Klip 1 Punya Tangan di 6/7 Video Staging (`2126–2129, 2131–2132`)
- Di `lib/opc-start-frame-request.js:147–153`, untuk item di mana prompt Klip 1 dari Gemini tidak diawali `[CAMERA FRAMING:`, guard faceless lama menyisipkan:
  `[CAMERA FRAMING: Strict neck-down POV close-up cropped below chest, hands only, head and face 100% out of frame]`
- Pada saat yang sama line 135 menghapus `(Wardrobe: ...)`. Akibatnya model T2I melihat `"hands only"` tanpa instruksi lengan baju panjang → memunculkan tangan/lengan terbuka di Klip 1! Hanya `#2130` yang aman karena Gemini kebetulan menulis `[CAMERA FRAMING: ... head and face 100% out of frame]` tanpa `"hands only"`.

### C. Akar Masalah C3 — Mengapa Klip 4–6 Drift ke Rajang Herbal & Klip 6 Kehilangan Produk (`#2131`)
1. **Bug Hero Finale (`opc-start-frame-contract.js:19` & `scheduler-processors.js:158, 184–186`)**: Dengan `bridge_at_clip = 3` dan `bridge_duration_clips = 1`, `bridgePlan.isProductClip(6)` bernilai `false` (`zone === 'post'`). `applyPromptReplacements()` memperlakukan Klip 6 sebagai `isNonProductGapOrPost`, lalu menimpa `(Product Truth: ...)` dan `(Product Reference File: ...)` dengan larangan produk, dan `opc-start-frame-request.js` gagal melampirkan `garlibee_clean_official.jpg`.
2. **Bias Kuliner VI + Brand Context (`lib/prompts.js:2107, 2135`)**: `vi_dapurbotani_metaphor_world_test` mewarisi `subject.custom_description` (`"...hands actively manipulating botanicals on the tabletop"`) ke `targetAnchorText`, plus instruksi brand herbal/kuliner dan kurangnya lock kontinuitas pasca-bridge pada `buildMetaphorWorldKitSection`, membuat Klip 4–6 membelok menjadi adegan memotong/menumbuk rimpang & bawang.

### D. Akar Masalah P4 & E1 (Product Form + Lighting Dilution)
- **P4 (`Garlibee Madu Bawang Lanang`)**: `product_extractions` Staging menyimpan `packaging_type: "Jar Kaca (Squircle Glass Jar)"` dan `product_truth` berupa madu gelap keemasan + bawang tunggal lanang terfermentasi (`cara_pakai: null`), namun `lib/metaphor-world-kits.js` menyebut hardcode `"herbal powder"` / `"botanical powder"` / `"herbal oil"` pada beberapa kit.
- **E1 (Lighting Dilution)**: Meskipun `lightingTupleForClip` menyentuh prompt, `lib/visual-identity-allocator.js:231` tetap menuliskan `- Pencahayaan (Light) : ... (3500K)...` yang hangat dan merata, ditambah beberapa `lighting_arc.from` kit yang terlalu lembut/hangat (`oil_powder_emulsify`, `santan_food_coma`, `carpet_deep_clean`).

---

## 2. Daftar Modifikasi & Potongan Kode (Sebelum & Sesudah)

> Semua perbaikan prompt A–F hanya aktif jika Metaphor Policy memiliki override aktif (`policy?.active && hasAnyMetaphorPolicyOverride(policy)`). Flag-off, default VI (`zero_hands` / `after_bridge` / `brand_locked`), `investigative_faceless`, serta snapshot lama tetap **100% identik byte-per-byte**.

### File 1: `lib/visual-identity-contract.js` & `lib/metaphor-policy.js`
Menambah opsi opsional `compact_prompts` (default `false`), deterministik rotasi per-video `resolveVideoVariety(seedKey)` (6 warna lengan modest + 4 sudut kamera), helper positive framing (`clip1ObjectOnlyPresenceTuple`, `modestHandsPresenceTuple`, `cleanUnbrandedSceneTuple`, `metaphorContinuityDirective`), serta menjaga fungsi default tetap identik saat override tidak aktif.

- **Code Sebelum (`lib/visual-identity-contract.js:177–185`)**:
```js
function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: typeof inputMetaphor?.enabled === 'boolean' ? inputMetaphor.enabled : true,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action'),
    hands_policy: pickEnum(inputMetaphor?.hands_policy, HANDS_POLICIES, 'zero_hands'),
    product_entry: pickEnum(inputMetaphor?.product_entry, PRODUCT_ENTRIES, 'after_bridge'),
    lighting_arc: pickEnum(inputMetaphor?.lighting_arc, LIGHTING_ARCS, 'none')
  };
}
```
- **Code Sesudah (`lib/visual-identity-contract.js`)**:
```js
function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: typeof inputMetaphor?.enabled === 'boolean' ? inputMetaphor.enabled : true,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action'),
    hands_policy: pickEnum(inputMetaphor?.hands_policy, HANDS_POLICIES, 'zero_hands'),
    product_entry: pickEnum(inputMetaphor?.product_entry, PRODUCT_ENTRIES, 'after_bridge'),
    lighting_arc: pickEnum(inputMetaphor?.lighting_arc, LIGHTING_ARCS, 'none'),
    compact_prompts: Boolean(inputMetaphor?.compact_prompts)
  };
}
```

- **Code Sebelum (`lib/metaphor-policy.js` — `presenceTruthTuple` & header)**:
```js
export function presenceTruthTuple(policy, clipRole = 'pre', { hasOverride = hasAnyMetaphorPolicyOverride(policy) } = {}) {
  if (!hasOverride) return LEGACY_PRESENCE_TRUTH_TUPLE;
  if (clipRole === 'clip1' || clipRole === 'hook' || !policy?.active || policy.handsPolicy !== 'modest_hands_active') {
    return LEGACY_PRESENCE_TRUTH_TUPLE;
  }
  return MODEST_HANDS_PRESENCE_TRUTH_TUPLE;
}
```
- **Code Sesudah (`lib/metaphor-policy.js`)**:
```js
// Menambahkan resolveVideoVariety(seedKey), positive framing helpers untuk policy aktif,
// serta mempertahankan LEGACY_PRESENCE_TRUTH_TUPLE persis sama ketika hasOverride === false.
export function presenceTruthTuple(policy, clipRole = 'pre', { hasOverride = hasAnyMetaphorPolicyOverride(policy), variety = null } = {}) {
  if (!hasOverride) return LEGACY_PRESENCE_TRUTH_TUPLE;
  if (clipRole === 'clip1' || clipRole === 'hook') {
    return clip1ObjectOnlyPresenceTuple(policy);
  }
  if (!policy?.active || policy.handsPolicy !== 'modest_hands_active') {
    return LEGACY_PRESENCE_TRUTH_TUPLE;
  }
  return modestHandsPresenceTuple(policy, variety);
}
```

### File 2: `lib/metaphor-world-kits.js`
Menambah `resolveProductForm(product)` (`honey_garlic`, `powder`, `capsule`, `liquid`, `oil`, `default`), mengganti hardcode `"herbal powder"`/`"herbal oil"`/`"herbal extract"` di 28 kit dengan `{product_substance}`, memperkuat kontras `lighting_arc.from` vs `to` + detail problem (`oil_powder_emulsify`, `santan_food_coma`, `carpet_deep_clean`), serta memetakan Clips 4–5 result continuity vs Clip terakhir hero reveal di `buildMetaphorWorldKitSection`.

- **Code Sebelum (`lib/metaphor-world-kits.js`, contoh `oil_powder_emulsify` & `buildMetaphorWorldKitSection`)**:
```js
  reaction: 'a delicate sprinkle of golden herbal powder contacts the grease droplet...',
  // ...
  buildMetaphorWorldKitSection(kit, { targetClips = 6, bridgeAtClip = 3 } = {})
```
- **Code Sesudah (`lib/metaphor-world-kits.js`)**:
```js
  reaction: 'actively spooning or drizzling {product_substance} directly onto the orange grease droplet...',
  // resolveProductForm(product) mengubah {product_substance} sesuai bentuk produk nyata
  // (mis. GarliBee => "viscous dark amber herbal honey with fermented single-clove solo garlic"),
  // buildMetaphorWorldKitSection(kit, { targetClips, bridgeAtClip, product, policy, variety })
  // memisahkan beat 'reaction' (Bridge), 'result' (Post-Bridge Klip 4..N-1 tanpa masak), dan 'hero' (Klip terakhir + produk).
```

### File 3: `lib/visual-identity-allocator.js` & `lib/prompts.js`
- `visual-identity-allocator.js`: saat `metaphorPolicy?.lightingArc` aktif, ganti blok `- Pencahayaan (Light)` statis `3500K` dengan `lighting_arc.from` → `lighting_arc.to` agar tidak mendilusi kontras kotor→bersih.
- `prompts.js`: saat `hasAnyMetaphorPolicyOverride(metaphorPolicy)` aktif, cegah `viSubject.custom_description` kuliner (`"manipulating botanicals"`) masuk ke `targetAnchorText`; tambahkan `METAPHOR WORLD CONTINUITY OVERRIDE` pada brand context jika `kit.genre !== 'recipe'`; injeksikan `resolveVideoVariety`, `resolveProductForm(productData)`, positive framing rules (`max 1 main action + <=3 key objects`, tanpa negasi & tanpa tangan orang kedua), serta mode opsional `compact_prompts` (500–800 karakter).

- **Code Sebelum (`lib/visual-identity-allocator.js:231`)**:
```js
    `- Pencahayaan (Light) : ${lightingPrompt} — ...`,
```
- **Code Sesudah (`lib/visual-identity-allocator.js`)**:
```js
    ...(metaphorPolicy?.lightingArc
      ? [`- Pencahayaan (Light Arc) : PRE-BRIDGE = ${metaphorPolicy.lightingArc.from} → BRIDGE/POST-BRIDGE = ${metaphorPolicy.lightingArc.to} (ABAIKAN pencahayaan hangat 3500K baseline agar kontras kotor vs bersih tajam).`]
      : [`- Pencahayaan (Light) : ${lightingPrompt} — ...`]),
```

### File 4: `lib/opc-start-frame-contract.js`, `lib/opc-start-frame-request.js`, `lib/scheduler-processors.js` (`applyPromptReplacements` & `phase_1_initial`), `lib/webhook-client.js`
- `opc-start-frame-contract.js`: saat `policy?.active && policy.productEntry === 'inside_metaphor'`, klip terakhir (`clipIndex === totalClips` dengan `productData`) wajib mengembalikan `{ required: true, zone: 'hero_finale', reason: 'metaphor_hero_finale' }`.
- `opc-start-frame-request.js`:
  - Perbaikan B3: jika `isMetaphoricFaceless && isClip1`, **jangan pernah** menyisipkan `[CAMERA FRAMING: ... hands only ...]`; gunakan framing still-life objek murni (`[CAMERA FRAMING: Unattended macro close-up focusing solely on physical objects, nobody in scene, empty tabletop]`).
  - Saat `hasAnyMetaphorPolicyOverride(policy)`: gunakan positive framing di Klip 1 (`clip1ObjectOnlyPresenceTuple`), positive clean surface di pre-bridge (`cleanUnbrandedSceneTuple`), dan wardrobe warna konsisten di Klip 2+.
- `scheduler-processors.js`: perbarui `applyPromptReplacements` untuk positive framing saat override aktif, mempertahankan `(Product Truth: ...)` di klip terakhir Hero Finale, dan di `phase_1_initial` perlakukan klip terakhir Hero Finale sebagai klip reference-critical terisolasi agar gambar referensi produk ikut terkirim.
- `webhook-client.js:250`: perbaiki regex `sanitizeImagePrompt` agar frasa `strictly no ...)` terhapus utuh hingga tanda kurung tutup, tidak menyisakan fragmen `, jar, or packaging)`.

### File 5 (Baru): `lib/start-frame-visual-qc.js` + Integrasi di `lib/start-frame-worker.js`, `lib/scheduler-processors.js`, `lib/pillar-start-frame-service.js`, `lib/campaign-scheduler.js`, `app/pillar-campaigns/[id]/page.js`
- `lib/start-frame-visual-qc.js`:
  - Membaca setting per-tenant `getSetting('start_frame_visual_qc', false)` (`'off' | 'report_only' | 'enforce'`, default `'off'`).
  - Memanggil `generateWithImage` (Gemini Vision + key pool + structured JSON schema) mengecek: `hand_count`, `awkward_anatomy`, `visible_face`, `exposed_forearm`, `pre_bridge_product`, `foreign_objects`, `weird_text_watermark`, `metaphor_alignment_score` (`0..1`).
  - Mekanisme auto-retry maksimal 2x saat `enforce`, atau tandai `start_frame_status = 'needs_review'` & `review_state = 'needs_review'` bila tetap gagal sehingga `pillar_glabs` terblokir.
  - Menyimpan telemetri (`calls`, `retries`, `passed`, `failed`, per-clip findings) di `item.result_json.start_frame_qc`.
- `app/pillar-campaigns/[id]/page.js`:
  - Menampilkan badge status QC (`Needs Review`, `QC Pass`, `QC Retry`) dan alasan kegagalan per klip memakai **100% semantic CSS tokens** (`var(--status-danger-soft)`, `var(--status-warning-soft)`, `var(--status-success-soft)`, `var(--text-primary)`, `var(--border-subtle)`).

---

## 3. Verifikasi & Kriteria Selesai (Sebelum Tahap H)
- Test baru untuk Part A–G (`tests/metaphor-f21-anti-hallucination.test.js`, `tests/start-frame-visual-qc.test.js`), seluruh 28 kit dengan ≥3 variasi `product_form` tanpa sisa `{product_substance}`.
- Semua 21+ test F1+F2 dan regression suite inti lulus tanpa memodifikasi snapshot lama + `npm run build` lulus.
- Diff prompt sebelum vs sesudah di `plans/visual-metaphor-world/f2.1-prompt-diff.md`.
- Laporan ringkas non-teknis + estimasi biaya Gemini Vision QC per video (STOP sebelum release/deploy Staging hingga diizinkan user).

---

## Execution Task List
- [x] **T1**: Implementasi `resolveProductForm`, placeholder `{product_substance}` di 28 kit, penguatan `lighting_arc` & detail `beats.problem`/`result`/`hero` di `lib/metaphor-world-kits.js`.
- [x] **T2**: Tambah `compact_prompts` di `lib/visual-identity-contract.js` serta positive framing helpers & `resolveVideoVariety` di `lib/metaphor-policy.js` (flag-off identik byte-per-byte).
- [x] **T3**: Update `lib/visual-identity-allocator.js` & `lib/prompts.js` (blokir bias kuliner & lighting 3500K saat Metaphor Policy aktif, dukung `compact_prompts`, injeksi `product_form` & `variety`).
- [x] **T4**: Fix Hero Finale di `lib/opc-start-frame-contract.js`, positive framing & fix B3 Clip 1 di `lib/opc-start-frame-request.js`, update `applyPromptReplacements` & `phase_1_initial` di `lib/scheduler-processors.js`, dan fix regex `sanitizeImagePrompt` di `lib/webhook-client.js`.
- [x] **T5**: Buat `lib/start-frame-visual-qc.js` (Gemini Vision checklist + setting per-tenant `start_frame_visual_qc` + telemetry + correction hints).
- [x] **T6**: Integrasikan Visual QC gate + auto-regen max 2x + block G-Labs pada `needs_review` ke `lib/start-frame-worker.js`, `lib/scheduler-processors.js`, `lib/pillar-start-frame-service.js`, dan badge UI di `app/pillar-campaigns/[id]/page.js` memakai semantic tokens.
- [x] **T7**: Tambah unit/integration tests A–G, jalankan seluruh test & `npm run build`, buat `plans/visual-metaphor-world/f2.1-prompt-diff.md`, dan update checkbox plan.
