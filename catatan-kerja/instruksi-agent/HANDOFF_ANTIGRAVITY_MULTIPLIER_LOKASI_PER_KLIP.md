# Handoff Antigravity: Multiplier Selalu di "Meja Kayu", Lokasi per Klip Tidak Jalan

> Tanggal: 16 Nov 2026 · Dicek terhadap `origin/main` @ `ba13004` (v2.48.23) · Prioritas: **sedang–tinggi** (Multiplier = mesin follower utama DapurBotani & NutriBake) · Status: **belum diperbaiki**
> Ditemukan oleh: Claude (review + uji nyata di staging)

## Tujuan pengguna
Video Multiplier (reverse-engineering video viral) tidak monoton: lokasi **mengikuti babak cerita** per klip.
- **Klip 1 (hook/masalah):** tempat masalah terjadi, mis. meja kantor, ruang makan setelah makan besar, kamar malam.
- **Klip tengah (meracik):** zona dapur.
- **Klip terakhir (hasil):** tempat menikmati, mis. meja kantor, samping tempat tidur, teras.

## Bukti uji
- **Preset uji:** `multiplier_dapurbotani_v3`, salinan `multiplier_dapurbotani` dengan:
  - VI `dapurbotani_identity_v3` (`environment.policy = planner_driven`);
  - `visual_style = Cinematic`;
  - `ai_directive` berisi aturan lokasi per klip.
- **Video uji:** 4 video, semuanya selesai tanpa error.
  - Putaran 1: `mul_261116_xv5nih`, `mul_261116_ymwr5b`.
  - Putaran 2 (aturan per klip yang tegas): `mul_261116_jdpnjx`, `mul_261116_7ei9mn`.
  - Hook putaran 2 menyebut tempat dengan jelas, mis. *"jam 2 siang di kantor, perut bunyi aneh…"*.
- **Hasil:** di ketiga klip setiap video, `t2i_i2v_prompts_json` berisi teks yang **identik**:
  ```
  (Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing),
  (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, ...),
  (Location: Fallback only: warm natural wooden home tabletop when planner specifies no room)
  ```
  Semua klip jatuh ke meja kayu dengan makro tabletop, termasuk hook "kantor".

## Penyebab (3 titik di `lib/prompts.js` → `buildMultiplierPhase2Prompt`, ±baris 3929)

### A. Lokasi dikunci satu teks untuk semua klip (±baris 3974)
`targetEnvInstruction` diambil dari `vso.environment_prompt`. Untuk VI `planner_driven`, nilainya adalah teks cadangan VI (`custom_description` = *"Fallback only: … when planner specifies no room"*, lihat `lib/visual-override-resolver.js` ±baris 302). Multiplier **tidak punya Scene Brief / planner**, sehingga teks "cadangan" itu dikunci verbatim ke `(Location: …)` di setiap klip.

**Code Sebelum (Current/Before):**
```js
  const targetEnvInstruction = (vso?.environmentPrompt || vso?.environment_prompt || vso?.resolved?.environment_prompt)
    ? (vso.environmentPrompt || vso.environment_prompt || vso.resolved.environment_prompt)
    : '[Location/Setting]';
```

**Code Sesudah (Proposed/After):**
```js
  const envPolicy = vso?.structured?.environment?.policy;
  const vsoEnvText = vso?.environmentPrompt || vso?.environment_prompt || vso?.resolved?.environment_prompt || '';
  const fallbackLoc = vso?.structured?.environment?.fallback_location || '';
  // planner_driven: Multiplier tidak punya Scene Brief, jadi model memilih lokasi per klip sesuai babak cerita.
  const targetEnvInstruction = envPolicy === 'planner_driven'
    ? `[Per-clip location chosen from this scene's story beat: hook/problem clip = the place where the problem happens (named or implied in the hook line); preparation clips = home kitchen zone; final result clip = where the result is enjoyed. Never prepare food outdoors. Use "${fallbackLoc}" only if the beat implies no place.]`
    : (vsoEnvText || '[Location/Setting]');
```
Tambahkan juga field `"location_en"` per adegan di skema `remake_storyboard` yang diminta dari Gemini, lalu wajibkan `(Location: …)` di t2i/t2v klip itu memakai `location_en` adegan yang sama. Dengan begitu lokasi tercatat dan bisa diaudit.

### B. Sudut kamera default selalu makro kuliner (±baris 4107)
**Code Sebelum (Current/Before):**
```js
  const targetOpticsInstruction = (vso?.opticsPrompt || vso?.optics_prompt || vso?.resolved?.optics_prompt)
    ? (vso.opticsPrompt || vso.optics_prompt || vso.resolved.optics_prompt)
    : '(Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing), (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field)';
```

**Code Sesudah (Proposed/After):**
```js
  const cam = vso?.structured?.camera || {};
  const opticsFromVI = cam.lens_look
    ? `(Angle: ${cam.framing === 'hands_closeup' ? 'eye-level close-up on hands and the action, room context visible behind' : 'eye-level medium shot showing the room context'}), (Lens: ${cam.lens_look.replace(/_/g, ' ')}, ${cam.depth_of_field || 'medium'} depth of field)`
    : null;
  const targetOpticsInstruction = (vso?.opticsPrompt || vso?.optics_prompt || vso?.resolved?.optics_prompt)
    || (envPolicy === 'planner_driven' ? opticsFromVI : null)
    || '(Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing), (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field)';
```
Makro tabletop tetap dipakai untuk VI kuliner lama, tapi tidak memaksa VI yang lokasinya bebas.

### C. `ai_directive` dilarang memengaruhi prompt visual (±baris 3962)
**Code Sebelum (Current/Before):**
```js
  const directiveBlock = aiDirective ? `## AI DIRECTIVE / INTERNAL GUARDRAIL\n${aiDirective}\nCRITICAL: Directive ini hanya instruksi kontrol internal. DILARANG mengutip, menyalin, memparafrasekan, atau membacakannya di voiceover, CTA, caption, storyboard, dan prompt visual.\n\n` : '';
```

**Code Sesudah (Proposed/After):**
```js
  const directiveBlock = aiDirective ? `## AI DIRECTIVE / INTERNAL GUARDRAIL\n${aiDirective}\nCRITICAL: Directive ini instruksi kontrol internal. DILARANG mengutip atau membacakannya di voiceover, CTA, dan caption. Namun aturan visual di dalamnya (lokasi, sudut kamera, larangan visual) WAJIB DITERAPKAN pada storyboard dan prompt visual.\n\n` : '';
```

## Temuan tambahan: merek menyelinap saat bridging mati
Di `mul_261116_7ei9mn` (Multiplier tanpa produk, `bridging_mode: none`), adegan klip 2 menyebut **"toples Nutrifarm Kayu Manis Bubuk"**. Usulan:
- Bila `isPureStorytelling` / bridging mati, tambahkan larangan tegas: *"Do not name or show any brand, product name, or packaging label in storyboard or prompts; use generic unbranded jars/containers."*
- Periksa juga apakah nama merek bocor dari `asset_caption` atau `original_storyboard` video viral sumber.

## Uji yang diharapkan setelah perbaikan
1. Jalankan ulang blueprint `f4f92995-17a9-42f8-b6c5-5c78f7070303` dengan preset `multiplier_dapurbotani_v3`.
   - Klip 1 harus berlokasi **kantor**, klip 2 **dapur**, klip 3 **kantor atau tempat santai**. Lihat `(Location: …)` per klip di `t2i_i2v_prompts_json`.
2. Ulangi untuk blueprint `b94ac22f-5280-40b2-8fa8-0e7ded47ae06`.
3. Regresi: Multiplier dengan VI kuliner lama (`vi_habitfolk_macro_craft` / `brand_locked`) tetap memakai makro tabletop dan lokasi VI seperti sebelumnya.
4. Tidak ada nama merek di prompt saat bridging mati.

## Prosedur
Rilis patch sesuai SOP (`npm run release-non-interactive`), lalu deploy ke **staging** saja (atomic, full SHA). Jangan ke Production tanpa instruksi pengguna. Setelah itu kabari Claude untuk uji ulang dan, bila hasilnya bagus, mengalihkan 14 jadwal Multiplier DapurBotani ke preset v3.
