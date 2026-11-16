# Implementation Plan: Finishing "Satu Fokus", Skin General & Babak Natural

Tanggal: 16 Nov 2026 · Versi rencana: 1 · Eksekutor: Antigravity · Reviewer: Claude + pengguna
Dasar: [USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md](USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md)
Instruksi agent: [antigravity_finishing_satu_fokus_instructions.md](antigravity_finishing_satu_fokus_instructions.md)

> **GERBANG WAJIB:** Fase 1 (mockup HTML) dikerjakan dan direview pengguna dulu. **Fase 2 dst. tidak boleh dimulai** sebelum pengguna menyatakan mockup disetujui di chat.

---

## 1. Tujuan

| No | Masalah | Target |
|---|---|---|
| G1 | Template terikat brand (nama brand di aturan saran, warna tertanam) | Template = tata letak, **skin** = gaya. Brand pilih skin di profil. Tidak ada nama brand di registry |
| G2 | Font bahan terlalu besar & berat | Satu skala ukuran untuk semua template, chip bahan huruf biasa, lebih kecil & tipis |
| G3 | Teks menumpuk (sampai 6 blok sekaligus, daftar bahan ±78% durasi) | Aturan **Satu Fokus**: maks 1 kartu info + subtitle. Bahan bergiliran ≤ 4 dtk, maks 3 chip |
| G4 | Babak `problem_solution` kaku: pill "1 MASALAH", "2 PENYEBAB", "3 SOLUSI", "4 HASIL" + bar progres, dan fallback asal membagi babak per urutan klip | Babak tampil sebagai **kalimat pembuka natural** ("Masalahnya…", "Ternyata penyebabnya…", "Solusinya…", "Hasilnya…") + potongan frasa dari VO. Hanya muncul saat babak berganti |

## 2. Di luar cakupan

- Tidak mengubah engine storyboard, VO, atau G-Labs.
- Tidak mengubah template selain 8 yang ada (tidak menambah tata letak baru).
- Tidak deploy ke Production.

---

## 3. Spesifikasi desain

### 3.1 Zona layar & aturan giliran (Satu Fokus)

| Zona | Tinggi layar | Isi |
|---|---|---|
| Atas | 12–40% | **Satu** kartu info: bahan / langkah / produk / babak / tip / timing badge / callout |
| Tengah | 40–60% | Hook atau punch |
| Bawah | 64–76% | Subtitle |
| Kanan 15% | – | Kosong (tombol platform), sudah berlaku |

| Aturan | Isi |
|---|---|
| R1 | Maks **2 blok teks** aktif: 1 (Atas **atau** Tengah) + subtitle. Watermark kecil tidak dihitung |
| R2 | Prioritas: Hook > Punch > End card > Produk > Save/CTA > Babak > Langkah/Tip > Bahan > Callout |
| R3 | Hook/punch aktif: kartu Zona Atas disembunyikan, subtitle mode hybrid |
| R4 | Tiap kartu tampil min **1,2 dtk**, jeda antar kartu Zona Atas **0,25 dtk** |
| R5 | Kartu maks **3,5 dtk**, kecuali label langkah yang mengikuti klip |
| R6 | Saat kartu Zona Atas aktif, subtitle maks **1 baris / 4 kata** |

### 3.2 Daftar bahan bergiliran

- Fase bahan: mulai setelah hook, **maks 4 dtk** (bukan sampai klip penutup).
- Jendela bergulir **3 chip**: chip ke-4 masuk, chip ke-1 keluar (geser naik + fade 0,2 dtk).
- Judul kartu "Bahan" + hitungan kecil "3/7", huruf biasa.
- Label maks **16 karakter** + takaran opsional, tampil lebih kecil: `Tepung terigu · 200 g`.
- Sisa bahan: tidak ada chip "+N". Cukup save prompt "Bahan lengkap di caption" di akhir.
- Langkah mulai **setelah** fase bahan selesai.

### 3.3 Skala huruf (token, cqw)

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--fx-size-display` | 12.5 (min 9) | hook baris 2, punch |
| `--fx-size-display-sm` | 8 | hook baris 1 |
| `--fx-size-sub` | 6.2 (skin stroke) / 5.6 (skin bersih) | subtitle |
| `--fx-size-label` | 2.4, huruf renggang, tebal 700 | judul kartu, label babak, "Langkah 2/5" |
| `--fx-size-body` | 2.7, tebal 600 | isi kartu, chip |
| `--fx-size-meta` | 2.1 | takaran, disclaimer, keterangan |

### 3.4 Skin

Token visual (semua template wajib memakai ini, tidak boleh hex langsung):

```
--fx-accent, --fx-accent-ink,
--fx-card, --fx-card-ink, --fx-card-muted,
--fx-chip, --fx-chip-ink,
--fx-stroke, --fx-shadow,
--fx-font-display, --fx-font-body, --fx-font-ui,
--fx-radius, --fx-text-case (upper|none), --fx-stroke-width (0 untuk skin bersih)
--fx-phase-problem, --fx-phase-cause, --fx-phase-solution, --fx-phase-result
```

Enam skin: `pop_kuning` (= tampilan sekarang, default), `bersih_putih`, `hangat_earthy`, `gelap_tegas`, `pastel_lembut`, `editorial_serif`. Font tambahan untuk serif dan skin bersih harus berlisensi bebas (mis. Google Fonts: Playfair Display, DM Sans) dan dibundel ke folder font yang sudah dipakai `fontBaseUrl`.

### 3.5 Babak natural untuk `problem_solution`

**Sebelum:** pill berwarna dengan nomor bulat + kata kapital `MASALAH` / `PENYEBAB` / `SOLUSI` / `HASIL` + bar progres 4 segmen, tampil di **setiap klip**. Kalau AI tidak mengirim babak, sistem membagi otomatis per urutan klip (klip 1 = MASALAH, tengah = PENYEBAB, dst.) meskipun VO-nya tidak cocok.

**Sesudah:**

```
┌──────────────────────────────────┐
│ Masalahnya…                      │  ← pembuka (label, kecil, warna fase)
│ Suara jalanan tembus ke kamar    │  ← frasa dari VO (body, maks 28 huruf)
└──────────────────────────────────┘
```

- Pembuka diambil dari daftar variasi, dirotasi per video (berdasar hash id video agar konsisten saat render ulang):

| Fase | Variasi Indonesia | Variasi Inggris |
|---|---|---|
| problem | "Masalahnya…", "Yang sering terjadi…", "Pernah ngalamin ini?" | "The problem…", "Sound familiar?" |
| cause | "Ternyata penyebabnya…", "Kenapa bisa begitu?", "Akar masalahnya…" | "Here's why…", "The real cause…" |
| solution | "Solusinya…", "Caranya…", "Coba ini…" | "The fix…", "Try this…" |
| result | "Hasilnya…", "Setelah itu…", "Bedanya terasa…" | "The result…", "After that…" |

- Baris kedua (`line`) **wajib dari kata-kata VO** klip tersebut (divalidasi seperti callout). Kalau kosong/tidak lolos, tampil pembuka saja.
- Kartu hanya muncul **di klip pertama tiap fase**, selama 2,0–2,8 dtk, lalu hilang. Klip berikutnya dalam fase yang sama tidak menampilkan kartu.
- Nomor bulat dan bar progres 4 segmen **dihapus**. Pengganti opsional: titik kecil 4 buah di bawah kartu (bisa dimatikan per skin).
- Huruf biasa (sentence case), bukan kapital, kecuali skin `pop_kuning` yang boleh kapital untuk baris pembuka saja.
- **Fallback tanpa data babak:** jangan bagi per urutan klip. Tampilkan hanya fase `problem` di klip pertama setelah hook, dan fase `solution` di klip yang VO-nya menyebut nama produk/material dari data produk. Selain itu tidak ada kartu babak.
- Brand jasa/B2B tetap cocok. Konten herbal tetap melewati cek klaim (`isHerbalMedicalClaimPhrase`) untuk `line`.

---

## 4. Perubahan per file (Code Sebelum → Code Sesudah)

> Potongan "Sesudah" adalah arah implementasi, bukan kode final. Nama fungsi boleh disesuaikan asal perilakunya sama.

### 4.1 `lib/finishing-template-registry.js`: buang nama brand

**Code Sebelum (Current/Before)**, baris 84–88, 107–111, 131–135, 156–160:
```js
suggestFor: [
  { patterns: [/tips_listicle|listicle|daftar\s+tips|\d+\s+(?:kunci|tips|cara|kebiasaan)|sasyahouse/i] }
],
// ...
  { patterns: [/ramuan_ritual|ramuan|seduhan|siasat\s+sehat|nutriblend|dapur\s+botani.*herbal/i] }
// ...
  { patterns: [/problem[_\s-]*solution|ruang\s+akustik|peredam\s+suara|masalah.*solusi/i] }
// ...
  { patterns: [/angka[_\s-]*banding|solusi\s*thermal|insulasi|perbandingan|banding/i] }
```

**Code Sesudah (Proposed/After):**
```js
suggestFor: [
  { patterns: [/tips_listicle|listicle|daftar\s+tips|\d+\s+(?:kunci|tips|cara|kebiasaan)/i] }
],
// ...
  { patterns: [/ramuan_ritual|ramuan|seduhan|wedang|jamu|infused\s+water/i] }
// ...
  { patterns: [/problem[_\s-]*solution|masalah.*solusi|peredam|kebocoran|solusi\s+untuk/i] }
// ...
  { patterns: [/angka[_\s-]*banding|perbandingan|banding|vs\.?\s|harga\s+per/i] }
```
Ditambah: label `problem_solution` diganti menjadi `'Problem Solution — Alur Masalah → Solusi (kalimat natural)'`. Brand yang butuh template tetap memakai default `finishing_template` di brand profile (4.10).

### 4.2 `lib/finishing-skin-registry.js` (file baru, pure JS)

**Code Sebelum:** tidak ada. Warna tertanam di tiap HTML, contoh `recipe-pop.html` baris 8–15:
```css
:root {
  --accent: #ffcc3d;
  --accent-soft: #e2b857;
  --active-word: #fff066;
  --f-punch: "Anton", Impact, sans-serif;
  --f-sub: "Montserrat", "Arial Black", sans-serif;
  --f-ui: "Inter", system-ui, sans-serif;
}
```

**Code Sesudah:**
```js
export const FINISHING_SKIN_REGISTRY = [
  {
    id: 'pop_kuning', label: 'Pop Kuning (default)',
    tokens: {
      '--fx-accent': '#ffcc3d', '--fx-accent-ink': '#111111',
      '--fx-card': 'rgba(20,12,8,0.78)', '--fx-card-ink': '#ffffff', '--fx-card-muted': 'rgba(255,255,255,0.72)',
      '--fx-chip': '#fff8ee', '--fx-chip-ink': '#2a1a10',
      '--fx-stroke': '#000000', '--fx-stroke-width': '0.5cqw', '--fx-text-case': 'uppercase',
      '--fx-radius': '99cqw',
      '--fx-font-display': '"Anton", Impact, sans-serif',
      '--fx-font-body': '"Montserrat", "Arial Black", sans-serif',
      '--fx-font-ui': '"Inter", system-ui, sans-serif',
      '--fx-phase-problem': '#e5484d', '--fx-phase-cause': '#f2850d',
      '--fx-phase-solution': '#1f9d55', '--fx-phase-result': '#2f7fe0'
    },
    fonts: ['Anton-Regular', 'Montserrat-ExtraBold', 'Montserrat-Black', 'Inter-Bold']
  },
  { id: 'bersih_putih', /* kartu putih 94%, teks #111, stroke 0, text-case none, font DM Sans */ },
  { id: 'hangat_earthy', /* krem, terakota, zaitun */ },
  { id: 'gelap_tegas', /* kartu rgba gelap, aksen neon */ },
  { id: 'pastel_lembut', /* pastel, radius lembut */ },
  { id: 'editorial_serif', /* display Playfair Display, stroke 0 */ }
];
export function resolveFinishingSkin(id) { /* fallback 'pop_kuning' */ }
```
Catatan: hex **hanya** boleh di file registry ini. Template HTML hanya memakai `var(--fx-*)`.

### 4.3 Semua `templates/finishing/*.html`: pakai token & terima skin

**Code Sebelum** (`recipe-pop.html` baris 402–408):
```js
if (cfg.accentColor) {
  document.documentElement.style.setProperty('--accent', cfg.accentColor);
  document.documentElement.style.setProperty('--accent-soft', cfg.accentColor);
}
```

**Code Sesudah:**
```js
const skinTokens = (T.skin && T.skin.tokens) || {};
for (const [k, v] of Object.entries(skinTokens)) {
  document.documentElement.style.setProperty(k, v);
}
if (cfg.accentColor) {
  document.documentElement.style.setProperty('--fx-accent', cfg.accentColor);
}
```
dan setiap warna/font di CSS diganti token, contoh `.ing .it { background: var(--fx-chip); color: var(--fx-chip-ink); font-family: var(--fx-font-body); font-size: var(--fx-size-body); font-weight: 600; text-transform: none; }`.

### 4.4 `lib/finishing-data-extractor.js`: fase bahan ≤ 4 dtk, jendela 3 chip

**Code Sebelum** (baris 184–207):
```js
const clipCount = clipOffsets.length || 1;
const closingClipStart = clipCount >= 2 ? Number(clipOffsets[clipCount - 1]?.start || dur * 0.78) : dur * 0.78;
const ingUntil = Number(Math.max(1.5, closingClipStart - 0.12).toFixed(3));

const visibleIngCount = Math.min(4, parsed.ingredients.length);
// ...
const label = truncateWordBoundary(raw, 22);
```

**Code Sesudah:**
```js
const ING_PHASE_MAX = 4.0;          // detik
const ING_WINDOW = 3;               // chip tampil bersamaan
const ingStart = Math.max(hookDuration + 0.1, firstIngredientWordTime ?? hookDuration + 0.1);
const ingUntil = Number(Math.min(ingStart + ING_PHASE_MAX, closingClipStart - 0.12).toFixed(3));

const selectedIngredients = parsed.ingredients.slice(0, 6);   // maks 6 chip bergiliran dalam 4 dtk
// tiap item: { name: truncateWordBoundary(nama, 16), qty: takaran || '', s, e }
// e = waktu chip ke (i + ING_WINDOW) masuk, atau ingUntil
return { ingredients: { s: ingStart, until: ingUntil, window: ING_WINDOW, items, totalCount }, steps };
```
Langkah: `s` langkah pertama = `max(clipStart, ingUntil + 0.25)`.

### 4.5 `lib/finishing-layer-scheduler.js` (file baru): pengatur giliran

**Code Sebelum:** tidak ada. Tiap template menyembunyikan lapisan sendiri, contoh `recipe-pop.html` baris 530, 567, 576, 586:
```js
const showIng  = Boolean(ingItems.length > 0 && !showHook && time >= ingItems[0].s && time < Number(ing.until || 0));
const showStep = Boolean(activeStep && !activePunch && !showHook);
const showProd = Boolean(pr && pr.name && !activePunch && !showHook && time >= pr.s && time < pr.e);
const showSave = Boolean(sv && sv.titleText && !activePunch && time >= sv.s && time < sv.e);
```

**Code Sesudah:**
```js
// Dipanggil oleh finishing-preview-builder.js dan finishing-overlay-renderer.js sebelum timeline dikirim ke template
export const LAYER_PRIORITY = ['hook', 'punch', 'endCard', 'product', 'save', 'cta', 'chapter', 'step', 'tip', 'timing', 'ingredients', 'callout'];
export const ZONE_OF = { hook: 'mid', punch: 'mid', endCard: 'full', product: 'top', save: 'top', cta: 'top',
  chapter: 'top', step: 'top', tip: 'top', timing: 'top', ingredients: 'top', callout: 'top' };

export function scheduleOverlayLayers(timeline, { minDwell = 1.2, gap = 0.25, maxCard = 3.5 } = {}) {
  // 1. kumpulkan semua kandidat {layer, s, e, ref}
  // 2. urutkan prioritas; potong/geser yang bertabrakan di zona sama, dan zona top vs mid (R1)
  // 3. buang kandidat < minDwell setelah dipotong, terapkan gap & maxCard (kecuali step)
  // 4. tulis timeline.slots = [{ layer, s, e, ref }] + timeline.subtitleCompact = [{ s, e }] (R6)
  return timeline;
}
```
Template cukup:
```js
const slot = (layer) => (T.slots || []).find((x) => x.layer === layer && time >= x.s && time < x.e);
const showIng = Boolean(slot('ingredients'));
const showStep = Boolean(slot('step'));
```
Bila `T.slots` tidak ada (timeline lama), template memakai logika lama (kompatibel).

### 4.6 `templates/finishing/shared-layers.js`: skala huruf & subtitle ringkas

**Code Sebelum** (baris 205–214):
```css
.sub.s-yellow {
  font-family: var(--f-sub);
  font-weight: 900;
  font-size: var(--sub-size, 7.6cqw);
  text-transform: uppercase;
  -webkit-text-stroke: 0.75cqw #000000;
```

**Code Sesudah:**
```css
:root {
  --fx-size-display: 12.5cqw; --fx-size-display-sm: 8cqw; --fx-size-sub: 6.2cqw;
  --fx-size-label: 2.4cqw; --fx-size-body: 2.7cqw; --fx-size-meta: 2.1cqw;
}
.sub.s-yellow {
  font-family: var(--fx-font-body);
  font-weight: 900;
  font-size: var(--sub-size, var(--fx-size-sub));
  text-transform: var(--fx-text-case, uppercase);
  -webkit-text-stroke: var(--fx-stroke-width, 0.6cqw) var(--fx-stroke, #000);
```
`renderSubtitle` menerima `opts.compact` (dari `timeline.subtitleCompact`) → potong chunk ke maks 4 kata, 1 baris.

### 4.7 `lib/finishing-plan-validator.js`: babak natural

**Code Sebelum** (baris 370–375, 417–431):
```js
export const CHAPTER_PHASE_META = {
  problem: { n: 1, phaseKey: 'problem', color: '#e5484d', id: 'MASALAH', en: 'PROBLEM' },
  cause: { n: 2, phaseKey: 'cause', color: '#f2850d', id: 'PENYEBAB', en: 'CAUSE' },
  solution: { n: 3, phaseKey: 'solution', color: '#1f9d55', id: 'SOLUSI', en: 'SOLUTION' },
  result: { n: 4, phaseKey: 'result', color: '#2f7fe0', id: 'HASIL', en: 'RESULT' }
};
// ...
const label = isEn ? phaseMeta.en : phaseMeta.id;
valid.push({ clipIndex, n: phaseMeta.n, phaseKey: phaseMeta.phaseKey, label, color: phaseMeta.color });
```

**Code Sesudah:**
```js
export const CHAPTER_PHASE_META = {
  problem:  { n: 1, phaseKey: 'problem',  colorToken: '--fx-phase-problem',
              id: ['Masalahnya…', 'Yang sering terjadi…', 'Pernah ngalamin ini?'],
              en: ['The problem…', 'Sound familiar?'] },
  cause:    { n: 2, phaseKey: 'cause',    colorToken: '--fx-phase-cause',
              id: ['Ternyata penyebabnya…', 'Kenapa bisa begitu?', 'Akar masalahnya…'],
              en: ["Here's why…", 'The real cause…'] },
  solution: { n: 3, phaseKey: 'solution', colorToken: '--fx-phase-solution',
              id: ['Solusinya…', 'Caranya…', 'Coba ini…'],
              en: ['The fix…', 'Try this…'] },
  result:   { n: 4, phaseKey: 'result',   colorToken: '--fx-phase-result',
              id: ['Hasilnya…', 'Setelah itu…', 'Bedanya terasa…'],
              en: ['The result…', 'After that…'] }
};
export function pickPhaseLead(phaseMeta, { isEn, seed }) { /* pilih variasi stabil berdasar hash seed */ }

// di validateChapters:
const lead = entry.lead && isAllowedLead(entry.lead, phaseMeta, isEn) ? entry.lead : pickPhaseLead(phaseMeta, { isEn, seed });
const line = validateGroundedLine(entry.line, clipTokenLists[clipIndex], { maxChars: 28 }); // '' bila tidak lolos
// cek klaim herbal untuk `line`
valid.push({ clipIndex, n: phaseMeta.n, phaseKey: phaseMeta.phaseKey, lead, line, colorToken: phaseMeta.colorToken });
// sesudah loop: simpan hanya klip PERTAMA tiap phaseKey (kartu tidak diulang dalam fase yang sama)
```

**Prompt skema (baris 75–76) Sebelum:**
```js
`${indent}  "chapters": [`,
`${indent}    { "clip_index": 0, "phase": "MASALAH | PENYEBAB | SOLUSI | HASIL" }`,
```
**Sesudah:**
```js
`${indent}  "chapters": [`,
`${indent}    { "clip_index": 0, "phase": "problem | cause | solution | result", "line": "inti klip dengan kata-kata persis dari VO, maks 28 huruf, huruf biasa" }`,
`${indent}  ],  // isi HANYA klip tempat fase berganti, bukan setiap klip`,
```
`normalizeChapterPhase` tetap menerima `MASALAH/PENYEBAB/...` agar plan lama tetap valid.

### 4.8 `lib/finishing-overlay-renderer.js`: fallback babak tidak asal bagi

**Code Sebelum** (baris 273–295): bila `planCheck.chapters` kosong, setiap klip diberi fase berdasar urutan (`seq[Math.min(3, ci)]`, klip tengah semua `cause`).

**Code Sesudah:**
```js
if (rawChaps.length === 0 && totalClipCount > 0) {
  const firstBodyClip = 0;                                              // kartu klip 0 mulai setelah hook (lihat hitungan s di bawah)
  rawChaps.push(makeChapter('problem', firstBodyClip));                 // hanya pembuka, tanpa line
  const solIdx = findClipMentioning(cleanVoiceoverClips, productTerms); // nama produk/material dari data produk
  if (solIdx > firstBodyClip) rawChaps.push(makeChapter('solution', solIdx));
}
// durasi kartu: s = clipStart + 0.08 (atau setelah hook), e = min(s + 2.8, clipEnd - 0.05), min 2.0
```
Output tiap chapter: `{ clipIndex, phaseKey, lead, line, colorToken, s, e }` lalu masuk `scheduleOverlayLayers`.

### 4.9 `templates/finishing/problem-solution.html`: kartu babak baru

**Code Sebelum** (baris 226–232 & 408–424):
```html
<div class="x-chapter" id="oChapter" hidden>
  <b id="oChapNum">1</b>
  <span id="oChapLabel"></span>
</div>
<div class="x-chapter-track" id="oChapTrack" hidden>
  <span></span><span></span><span></span><span></span>
</div>
```
```js
oChapter.style.setProperty('--c', activeChap.color || '#e5484d');
oChapNum.textContent = String(activeChap.n || 1);
oChapLabel.textContent = activeChap.label;
// bar progres 4 segmen
```

**Code Sesudah:**
```html
<div class="x-phase" id="oPhase" hidden>
  <span class="lead" id="oPhaseLead"></span>
  <span class="line" id="oPhaseLine" hidden></span>
  <i class="dots" id="oPhaseDots" hidden><b></b><b></b><b></b><b></b></i>
</div>
```
```css
.x-phase { position:absolute; left:4.5cqw; top:13cqh; max-width:62cqw;
  background: var(--fx-card); color: var(--fx-card-ink);
  border-left: 1cqw solid var(--phase-c); border-radius: 1.6cqw; padding: 1.4cqw 2.6cqw; }
.x-phase .lead { display:block; font: 700 var(--fx-size-label)/1.2 var(--fx-font-ui); color: var(--phase-c); letter-spacing: .02em; }
.x-phase .line { display:block; margin-top:.6cqw; font: 600 var(--fx-size-body)/1.25 var(--fx-font-body); }
```
```js
const s = slot('chapter');
if (s) {
  const ch = s.ref;
  oPhase.style.setProperty('--phase-c', `var(${ch.colorToken})`);
  oPhaseLead.textContent = ch.lead;
  oPhaseLine.textContent = ch.line || '';
  oPhaseLine.hidden = !ch.line;
}
```

### 4.10 Brand profile / VI, API, UI, MCP

**Code Sebelum:** brand profile tidak punya pilihan gaya finishing. Override hanya per campaign (`finishing_template`, `caption_mode`, `loudness_target`).

**Code Sesudah:**
- Kolom baru (migrasi idempoten, schema dev/staging/public, `DISABLE_AUTO_MIGRATIONS` dihormati): `brand_profiles.finishing_skin TEXT NULL`, `brand_profiles.default_finishing_template TEXT NULL`.
- Override per campaign: `finishing_skin` ikut di `parseFinishingOverrideFields` (validasi ke `FINISHING_SKIN_IDS`).
- Urutan resolusi skin: campaign → brand profile → `pop_kuning`.
- UI: dropdown "Gaya Finishing" + pratinjau kecil di halaman Brand Profile dan panel override finishing. Wajib semantic token sesuai SOP UI.
- MCP: `cf_update_brand_profile` & `cf_get_brand_profile` mendukung `finishing_skin`, `default_finishing_template`.

### 4.11 `lib/finishing-plan-validator.js`: cek kepadatan teks

**Code Sebelum:** tidak ada.

**Code Sesudah:**
```js
export function auditTextDensity(timeline, { step = 0.1 } = {}) {
  // sampel tiap 0.1 dtk: hitung slot aktif (tanpa watermark) + subtitle
  // return { ok, maxBlocks, hotspots: [{ t, layers }], shortCards: [...], ingredientsTooLong: bool }
}
```
Hasil ditampilkan di review job: "Kepadatan teks: OK" atau "3 titik padat: 6,2 dtk; 8,0 dtk; 11,4 dtk".

---

## 5. Pengujian

| Uji | Cara | Lulus bila |
|---|---|---|
| Unit penjadwal | `tests/finishing-layer-scheduler.test.mjs`: kasus resep 6 bahan + produk + save, problem_solution 5 klip, tips 6 tip | Tidak ada waktu dengan > 2 blok; kartu ≥ 1,2 dtk |
| Unit babak | Plan baru (`phase`+`line`), plan lama (`MASALAH`), tanpa plan, `line` tidak ada di VO, klaim herbal di `line` | Plan lama tetap jalan; `line` palsu dibuang; fallback hanya problem + solution |
| Unit skin | Resolusi campaign → brand → default, id tidak valid | Default `pop_kuning` |
| Statik | `grep -E "#[0-9a-fA-F]{3,6}" templates/finishing/*.html` | Kosong |
| Statik | `grep -iE "sasyahouse|siasat|nutriblend|dapur\s*botani|ruang\s*akustik|solusi\s*thermal" lib/finishing-template-registry.js` | Kosong |
| Render | Render ulang 1 video resep, 1 ramuan, 1 problem_solution dengan `pop_kuning`, `bersih_putih`, `hangat_earthy`. Potong frame per 0,5 dtk | Pengguna review manual, `auditTextDensity.ok = true` |
| Regresi | Job lama tanpa skin & tanpa `slots` | Tampilan identik dengan sebelum |

---

## Execution Task List

### Fase 0: Bukti awal
- [x] Ambil 1 video Completed `recipe_pop`, 1 `ramuan_ritual`, 1 `problem_solution` terbaru (Nextcloud ContentFlow)
- [x] Potong frame tiap 0,5 dtk, tandai frame dengan ≥ 3 blok teks, simpan ke `scratch/finishing_satu_fokus_before/`
- [x] Catat timeline JSON ketiga video sebagai data mockup

### Fase 1: Mockup HTML (GERBANG REVIEW)
- [x] Buat `public/mockup_finishing_satu_fokus.html` (spesifikasi di file instruksi)
- [x] Commit + push, deploy Staging atomic dengan full SHA, cek HTTP 200 `http://100.95.245.55:5010/mockup_finishing_satu_fokus.html`
- [x] Kirim link ke pengguna, **STOP**, tunggu persetujuan
- [x] Terapkan revisi mockup dari pengguna (bila ada) sampai disetujui (disetujui langsung tanpa revisi)

### Fase 2: Skin & token
- [x] Buat `lib/finishing-skin-registry.js` (6 skin, `pop_kuning` = tampilan sekarang)
- [x] Bundel font tambahan ke folder font `fontBaseUrl`
- [x] Ganti warna/font tertanam di 8 template dengan `var(--fx-*)`
- [x] Kirim `timeline.skin` dari preview-builder & overlay-renderer

### Fase 3: Skala huruf
- [x] Tambah token ukuran di `shared-layers.js`
- [x] Terapkan ke 8 template (chip bahan huruf biasa, tebal 600)

### Fase 4: Penjadwal lapisan & bahan bergiliran
- [x] Buat `lib/finishing-layer-scheduler.js` + unit test
- [x] Ubah `extractRecipeOverlayData` (fase ≤ 4 dtk, jendela 3 chip, label 16 + takaran)
- [x] Panggil penjadwal di `finishing-preview-builder.js` & `finishing-overlay-renderer.js`
- [x] Template membaca `T.slots` (fallback logika lama bila tidak ada)
- [x] Subtitle ringkas saat kartu Zona Atas aktif

### Fase 5: Babak natural problem_solution
- [x] Ubah `CHAPTER_PHASE_META`, `validateChapters` (lead + line ber-VO, satu kartu per fase)
- [x] Ubah skema prompt `chapters`
- [x] Ubah fallback di `finishing-overlay-renderer.js` & data contoh di `finishing-preview-builder.js`
- [x] Ganti pill + bar progres di `problem-solution.html` dengan kartu `.x-phase`
- [x] Unit test babak (plan baru, plan lama, tanpa plan, line palsu, klaim)

### Fase 6: Lepas dari brand
- [x] Bersihkan nama brand di `finishing-template-registry.js`
- [x] Migrasi kolom `finishing_skin`, `default_finishing_template`
- [x] API + UI Brand Profile & panel override (semantic token)
- [x] MCP `cf_update_brand_profile` / `cf_get_brand_profile`

### Fase 7: Validator kepadatan
- [x] `auditTextDensity` + tampil di halaman review job

### Fase 8: Uji, rilis, deploy Staging
- [x] Jalankan semua unit test + cek statik
- [x] Render ulang 3 video Fase 0 × 3 skin, simpan frame sesudah ke `scratch/finishing_satu_fokus_after/`
- [x] `npm run release-non-interactive -- --type minor --title "Finishing Satu Fokus, Skin General & Babak Natural" --points "..."`
- [x] Deploy Staging atomic + verifikasi wajib (current, manifest, HTTP 200, PM2, pm_cwd, PG_SEARCH_PATH, PGPOOL_MAX)
- [x] Laporkan link Staging & perbandingan frame sebelum/sesudah ke pengguna
