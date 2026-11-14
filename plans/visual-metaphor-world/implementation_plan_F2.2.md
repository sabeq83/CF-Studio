# Implementation Plan F2.2 — Hotfix Visual Metaphor World & Campaign Detail UI

**Base Release:** `v2.46.1` (`7cb97ffc8ed2c93e954c1a63bbb358eb3fd38b22`)  
**Sumber Instruksi:** [antigravity-instructions-F2.2-hotfix.md](file:///Users/sabeqmmursyid/_cfstudio/plans/visual-metaphor-world/antigravity-instructions-F2.2-hotfix.md)  
**Aturan Eksekusi Khusus:**
1. **H1 (`parsedResult` crash fix)** dikerjakan, diuji, dirilis sebagai **patch `v2.46.2`**, dan **dideploy ke Staging** terlebih dahulu setelah tes & build lulus.
2. **H2–H6** dikerjakan secara lokal + seluruh tes & build lulus, kemudian **BERHENTI sebelum rilis / push / deploy Staging** untuk laporan ke pengguna dalam bahasa sederhana. Tidak menyentuh Production.

---

## Execution Task List

- [x] **T1 (H1):** Perbaiki variabel `parsedResult` yang tidak terdeklarasi di `app/pillar-campaigns/[id]/page.js`, tambahkan tes AST/no-undef anti-crash, dan verifikasi `npm run build`.
- [ ] **T2 (H1 Release & Deploy Staging):** Rilis patch `v2.46.2`, deploy atomic ke Staging Mac Mini, dan verifikasi halaman detail `opc_261114_f21b7`, `opc_261114_g0zltt`, dan `opc_261108_8618kc` tanpa `ReferenceError`.
- [ ] **T3 (H2):** Perbarui rubrik `lib/start-frame-visual-qc.js` untuk Clip 3 & Clip 6 (`expectsProduct = true`) agar tidak false positive `pre_bridge_product` / `foreign_objects` saat menampilkan produk dan bahan alami (madu, bawang) maupun hasil bersih (`beats.result`), plus unit test Clip 1/2 vs Clip 3/6.
- [ ] **T4 (H3):** Perketat framing `eye_level_side` & `three_quarter_front` pada `METAPHOR_CAMERA_ANGLES` (`lib/metaphor-policy.js`) agar *chest-down* dengan fokus di tangan dan batas atas bingkai di bawah bahu (tanpa mengubah overhead/macro), plus unit test.
- [ ] **T5 (H4):** Tegaskan `"solid plain <color>, no pattern, no print"` pada `MODEST_WARDROBE_ROTATION` (`lib/metaphor-policy.js`), pastikan `lib/opc-start-frame-request.js` menyuntikkan `(Wardrobe: ...)` pada seluruh Clip 2+ meski prompt T2I awal tidak memilikinya, simpan `resolved_wardrobe_color` di `result_json` (`lib/scheduler-processors.js`), dan tambahkan pengecekan `wardrobe_color_match` ke `lib/start-frame-visual-qc.js`, plus unit test.
- [ ] **T6 (H5):** Perbaiki loop retry tak terbatas `#2140` (`Batch TTS Studio 'null'`) di `lib/scheduler-processors.js` & `lib/campaign-scheduler.js` serta visibilitas error di UI (`app/pillar-campaigns/[id]/page.js`), plus dokumentasikan temuan akar pemicu `#2136` G-Labs `PUBLIC_ERROR_USER_MINOR` & filter `"lemak"` pre-TTS untuk review pengguna.
- [ ] **T7 (H6 & Verifikasi Akhir Lokal):** Catat status `compact_prompts` tetap `false` (off) sesuai data A/B Stage H, jalankan seluruh suite tes F1+F2+F2.1+F2.2 & `npm run build`, perbarui seluruh checkbox, lalu berhenti sebelum rilis/deploy H2–H6.

---

## Ringkasan Perubahan Kode (Sebelum & Sesudah)

### 1. H1 — `app/pillar-campaigns/[id]/page.js` (Fix Crash `parsedResult is not defined`)

**Code Sebelum (Current/Before):**
```jsx
        {activeTab === 'storyboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>📖 Storyboard & Rencana Visual Baru</h4>
              {(() => {
                let parsedRes = {};
                try { parsedRes = JSON.parse(item.result_json || '{}'); } catch {}
                ...
              })()}
            </div>
            {/* Di baris 2513-2552, parsedResult direferensikan langsung tanpa deklarasi */}
            {(item.start_frame_status === 'needs_review' || parsedResult?.start_frame_qc) && (
              ...
              {parsedResult?.start_frame_qc && ( ... )}
            )}
            ...
            const clipQc = parsedResult?.start_frame_qc?.clips?.[String(clipNum)] || null;
```

**Code Sesudah (Proposed/After):**
```jsx
        {activeTab === 'storyboard' && (() => {
          let parsedResult = {};
          try {
            parsedResult = typeof item?.result_json === 'string'
              ? JSON.parse(item.result_json || '{}')
              : (item?.result_json || {});
          } catch (_) {
            parsedResult = {};
          }
          const parsedRes = parsedResult;
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            ...
```
Ditambah tes statis AST (`tests/pillar-campaign-detail-no-undef.test.js`) memakai `esbuild` + `acorn` untuk memastikan tidak ada identifier tak terdeklarasi (`ReferenceError` risk) di `app/pillar-campaigns/[id]/page.js`.

---

### 2. H2 — `lib/start-frame-visual-qc.js` (Rubrik Clip 3 & Clip 6 `expectsProduct = true`)

**Code Sebelum (Current/Before):**
```js
  const productRule = isPreBridge && !expectsProduct
    ? 'PRE-BRIDGE FRAME: Commercial bottles, labelled jars, caps, boxes, or skincare/supplement packaging MUST NOT appear (flag pre_bridge_product=true if seen).'
    : (expectsProduct
        ? 'PRODUCT/HERO FRAME: Commercial product packaging/jar is expected and allowed; still flag weird garbled watermarks or gibberish overlaid UI text.'
        : 'CLEAN CONTINUITY FRAME: Check whether unrequested commercial jars/bottles or unrelated kitchen herb chopping appear unexpectedly.');
  const driftRule = isRecipeGenre
    ? 'Flag foreign_objects=true only for surreal or completely corrupted unrelated props.'
    : `Expected Metaphor World: "${objectWorld || 'Focused everyday metaphor demonstration'}". Flag foreign_objects=true if the scene drifts off into unrelated culinary herb chopping, raw spices/ginger piles, or random objects not belonging to the metaphor world.`;
```

**Code Sesudah (Proposed/After):**
```js
  const expectedStateText = expectsProduct
    ? (cleanResultWorld || objectWorld || 'Clean metaphor result paired with featured product')
    : (objectWorld || 'Focused everyday metaphor demonstration');
  const productRule = isPreBridge && !expectsProduct
    ? 'PRE-BRIDGE FRAME: Commercial bottles, labelled jars, caps, boxes, or skincare/supplement packaging MUST NOT appear (flag pre_bridge_product=true if seen).'
    : (expectsProduct
        ? 'PRODUCT/HERO FRAME (expects_product=true): Featured product jar/bottle AND natural ingredients that belong to the product (such as honey or solo garlic for herbal honey blends) are EXPECTED and VALID. ALWAYS set pre_bridge_product=false and DO NOT flag authentic product/product-ingredients as foreign_objects. Still flag garbled gibberish overlaid UI text or surreal artifacts.'
        : 'CLEAN CONTINUITY FRAME: Check whether unrequested commercial jars/bottles or unrelated kitchen herb chopping appear unexpectedly.');
  const driftRule = isRecipeGenre
    ? 'Flag foreign_objects=true only for surreal or completely corrupted unrelated props.'
    : (expectsProduct
        ? `Expected Hero/Bridge State: "${expectedStateText}" alongside the featured product & its core natural ingredients. Do NOT compare against pre-bridge dirty props. Flag foreign_objects=true only if unrelated random objects or chaotic culinary chopping appear.`
        : `Expected Metaphor World: "${expectedStateText}". Flag foreign_objects=true if the scene drifts off into unrelated culinary herb chopping, raw spices/ginger piles, or random objects not belonging to the metaphor world.`);
```
Dan pada `evaluateQcChecklistVerdict`, saat `context?.expectsProduct === true`, `pre_bridge_product` tidak pernah dianggap sebagai failure (`effectivePreBridgeProduct = Boolean(!context?.expectsProduct && checklist?.pre_bridge_product)`).

---

### 3. H3 — `lib/metaphor-policy.js` (Chest-Down Framing pada `eye_level_side` & `three_quarter_front`)

**Code Sebelum (Current/Before):**
```js
  {
    key: 'eye_level_side',
    label: 'Eye-Level Side Profile (0 deg)',
    prompt: 'eye-level 0-degree side cross-section profile macro shot',
    negativeCue: 'overhead top-down aerial angle, looking straight down from ceiling'
  },
  ...
  {
    key: 'three_quarter_front',
    label: 'Tabletop Three-Quarter Front (45 deg)',
    prompt: '45-degree clean tabletop three-quarter front medium close-up',
    negativeCue: '90-degree flat-lay directly overhead'
  }
```

**Code Sesudah (Proposed/After):**
```js
  {
    key: 'eye_level_side',
    label: 'Tabletop Side Profile Chest-Down (0 deg)',
    prompt: '0-degree tabletop side cross-section medium close-up framed strictly chest-down focused on hands and tabletop objects with upper frame edge cut below the shoulders, neck and head out of frame',
    negativeCue: 'overhead top-down aerial angle, face, head, neck, full shoulders, upper-body portrait'
  },
  ...
  {
    key: 'three_quarter_front',
    label: 'Tabletop Three-Quarter Front Chest-Down (45 deg)',
    prompt: '45-degree clean tabletop three-quarter front medium close-up framed strictly chest-down centered on foreground hands and tabletop props with upper frame edge below shoulders, no head or face in frame',
    negativeCue: '90-degree flat-lay directly overhead, face, head, chin, neck, upper-body portrait'
  }
```

---

### 4. H4 — `lib/metaphor-policy.js`, `lib/opc-start-frame-request.js`, `lib/scheduler-processors.js`, `lib/start-frame-visual-qc.js` (Wardrobe Solid Plain + `resolved_wardrobe_color` + QC Color Match)

**Code Sebelum (Current/Before):**
```js
// lib/metaphor-policy.js
{ key: 'sage', label: 'Sage Green Linen', description: 'loose muted sage green opaque linen long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists' }

// lib/opc-start-frame-request.js
if (/\(Wardrobe:[^)]*\)/i.test(sanitizedPrompt)) {
  sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:[^)]*\)/i, `(Wardrobe: ${variety.wardrobeDesc})`);
}

// lib/start-frame-visual-qc.js
// Belum memeriksa kecocokan warna lengan/baju dengan resolved_wardrobe_color
```

**Code Sesudah (Proposed/After):**
```js
// lib/metaphor-policy.js
{
  key: 'sage',
  label: 'Sage Green Linen',
  description: 'solid plain muted sage green opaque linen long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
}

// lib/opc-start-frame-request.js (jamin suntikan di Clip 2+ meski prompt T2I awal tanpa tag Wardrobe)
if (/\(Wardrobe:[^)]*\)/i.test(sanitizedPrompt)) {
  sanitizedPrompt = sanitizedPrompt.replace(/\(Wardrobe:[^)]*\)/i, `(Wardrobe: ${variety.wardrobeDesc})`);
} else {
  sanitizedPrompt = `${sanitizedPrompt} (Wardrobe: ${variety.wardrobeDesc})`;
}

// lib/scheduler-processors.js (simpan resolved_wardrobe_color ke result_json saat generasi)
resultObj.resolved_wardrobe_color = {
  key: resolvedPolicy.variety.wardrobeColorKey,
  label: resolvedPolicy.variety.wardrobeColorLabel,
  description: resolvedPolicy.variety.wardrobeDesc
};

// lib/start-frame-visual-qc.js (tambahkan wardrobe_color_match saat modest_hands_active & !expectsObjectOnly)
```

---

### 5. H5 — `lib/scheduler-processors.js`, `lib/campaign-scheduler.js`, `app/pillar-campaigns/[id]/page.js` (Perbaikan Loop `#2140` & Error Visibility)

**Code Sebelum (Current/Before):**
```js
// lib/scheduler-processors.js:7906
if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
  // jika tts_batch_id null atau 'null', pre-flight dilewati lalu ffmpeg_node_submit gagal dengan "Batch TTS Studio 'null' tidak ditemukan"
}

// lib/campaign-scheduler.js:747 & 834
(currentItem.tts_status === 'completed' || currentItem.tts_status === 'skipped') &&
...
// Auto-retry saat ffmpeg_status === 'failed' hanya mengecek visualIncomplete dan terus mengulang pillar_ffmpeg tanpa mengecek missing tts_batch_id
```

**Code Sesudah (Proposed/After):**
```js
// lib/scheduler-processors.js
const rawBatchId = String(item.tts_batch_id || '').trim();
const hasMissingTtsBatch = !rawBatchId || rawBatchId === 'null' || rawBatchId === 'undefined';
if (hasMissingTtsBatch && item.tts_status !== 'skipped') {
  throw new Error('Audio TTS belum terhubung (tts_batch_id kosong/null). Silakan jalankan atau regenerate Audio TTS sebelum Render FFmpeg.');
}

// lib/campaign-scheduler.js
// 1. Jangan jalankan pillar_ffmpeg bila tts_status === 'completed' namun tts_batch_id kosong/null.
// 2. Saat auto-retry mendeteksi ffmpeg gagal karena tts_batch_id kosong dan retryCount < maxRetries,
//    reset ke tahap TTS (tts_status = 'pending', tts_batch_id = null, ffmpeg_status = 'pending') bukan mengulang FFmpeg dalam loop.
// 3. Jika retry mencapai batas (>= 3), hentikan bersih sebagai failed dengan error reason yang terbaca di UI.
```

---

### 6. H6 — `compact_prompts` Default Off

Menetapkan `compact_prompts` tetap default `false` (`off`) sesuai temuan Stage H (`1,243` vs `1,255` karakter rata-rata karena ~750–900 char fixed wrapper), tanpa pengembangan lanjutan pada hotfix F2.2.

