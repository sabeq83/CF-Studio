# Handoff Antigravity: 4 Celah CF Studio untuk CF Autopipeline (CFA)

> Tanggal: 15 Nov 2026 · Dicek terhadap `origin/main` @ `35b77cf` (rilis terakhir v2.48.22) · Status: **belum diperbaiki**
> Ditemukan oleh: Claude (review). Konteks: sistem jalur CFA (`USULAN_JALUR_FLEKSIBEL_CFA.md`).

| # | Celah | Prioritas | Alasan |
|---|---|---|---|
| 1 | Judul publish satu untuk semua akun | **Tinggi** | YouTube butuh judul high-CTR sendiri. Tanpa fitur ini CFA harus membuat jadwal terpisah per platform |
| 4 | Tidak ada cara membatalkan `cst_*` | **Tinggi** | Kiriman salah tidak bisa dihentikan lewat MCP/API, kuota G-Labs bisa terbuang |
| 2 | Status storyboard MCP terlalu besar | Sedang | 70–146 ribu karakter per panggilan, boros token Claude |
| 3 | Daftar preset & VI MCP terlalu besar | Sedang | 90–120 ribu karakter, tanpa filter brand |

Prosedur setelah selesai: rilis patch/minor sesuai SOP (`npm run release-non-interactive`), lalu deploy ke **staging** saja (atomic, full SHA). Jangan ke Production tanpa instruksi pengguna.

---

## 1. Judul per platform (`platform_titles`)

**Masalah:** `platform_captions` sudah ada, tapi judul selalu `validated.title` untuk semua akun.

### `lib/publishing-contract.js` (±baris 189–194)

**Code Sebelum (Current/Before):**
```js
    title: String(title || '').trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100),
    ...
    platform_captions: (input.platform_captions && typeof input.platform_captions === 'object') ? input.platform_captions : null,
```

**Code Sesudah (Proposed/After):**
```js
    title: cleanTitle(title),
    ...
    platform_captions: (input.platform_captions && typeof input.platform_captions === 'object') ? input.platform_captions : null,
    platform_titles: normalizePlatformTitles(input.platform_titles),
```
Dengan helper di file yang sama:
```js
function cleanTitle(t) {
  return String(t || '').trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100);
}

function normalizePlatformTitles(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [platform, value] of Object.entries(raw)) {
    const t = cleanTitle(value);
    if (t) out[String(platform).toLowerCase()] = t;
  }
  return Object.keys(out).length ? out : null;
}
```

### `lib/publishing-service.js` (±baris 36–56)

**Code Sebelum (Current/Before):**
```js
    return {
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      title: validated.title,
      caption: selectedCaption,
```

**Code Sesudah (Proposed/After):**
```js
    const selectedTitle = validated.platform_titles?.[platform] || validated.title;

    return {
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      title: selectedTitle,
      caption: selectedCaption,
```

### `apps/mcp/tools.mjs`
Tambahkan `platform_titles: z.record(z.string().max(100)).optional()` di skema `cf_create_publishing_job` (di sebelah `platform_captions`), lalu teruskan ke body request.

**Uji:** satu job ke akun YouTube + Facebook dengan `platform_titles: {"youtube": "Judul A"}` dan `title: "Judul B"`. Hasil: target YouTube berjudul A, Facebook berjudul B.

---

## 2. Mode ringkas `cf_get_storyboard_status`

**Masalah:** `fetchPillarStoryboardSummary` (`apps/mcp/tools.mjs` ±baris 150–197) sudah membuat ringkasan yang bagus, tapi **ikut mengembalikan `items` mentah**: semua prompt T2I/I2V, VO, dan path tiap klip. Itu yang membuat hasilnya 70–146 ribu karakter.

**Code Sebelum (Current/Before):**
```js
    content_flow_url_asset: contentFlowItem?.url_asset || null,
    items,
    stats: detail.stats || null
  };
}
```

**Code Sesudah (Proposed/After):**
```js
    content_flow_url_asset: contentFlowItem?.url_asset || null,
    ...(includeItems ? { items } : { item_count: items.length }),
    stats: detail.stats || null
  };
}
```
- Ubah signature menjadi `fetchPillarStoryboardSummary(request, campaignId, { includeItems = false } = {})`.
- Tambahkan argumen opsional `include_items: z.boolean().default(false)` di tool `cf_get_storyboard_status` (±baris 933).
- Tambahkan juga `error_message` / `generation_error` di `stages` bila ada. Saat ini kampanye `failed` tidak menyebut alasannya, sehingga diagnosis harus lewat log server (contoh: `cst_228a741fdcbe`).
- Periksa pemanggil lain (±baris 209 dan 476): bila mereka membutuhkan `items`, kirim `{ includeItems: true }`.

---

## 3. Filter pada daftar preset & VI

**Masalah:** `cf_list_presets` (±baris 422) tanpa argumen, dan `cf_list_visual_identities` (±baris 1404) hanya punya filter `status`. Hasilnya 90–120 ribu karakter.

**Code Sebelum (Current/Before):**
```js
  register('cf_list_presets', 'List available campaign production presets and video archetypes.', {}, true, () =>
    request('/api/operator/v1/presets')
  );
```

**Code Sesudah (Proposed/After):**
```js
  register(
    'cf_list_presets',
    'List campaign production presets. Use brand/query to filter; returns a compact list unless detail=true.',
    {
      brand: z.string().max(100).optional(),
      query: z.string().max(100).optional(),
      detail: z.boolean().default(false)
    },
    true,
    async ({ brand, query, detail }) => {
      const res = await request('/api/operator/v1/presets');
      let list = res.presets || res.data || [];
      const match = (p, s) => JSON.stringify([p.key, p.label, p.brand]).toLowerCase().includes(s.toLowerCase());
      if (brand) list = list.filter(p => match(p, brand));
      if (query) list = list.filter(p => match(p, query));
      if (!detail) list = list.map(p => ({ key: p.key, label: p.label, campaign_kinds: p.campaign_kinds }));
      return { success: true, count: list.length, presets: list };
    }
  );
```
Lakukan hal yang sama untuk `cf_list_visual_identities`: argumen `brand`, `query`, `detail` (default ringkas: `id`, `name`, `brand`, `status`). Sesuaikan nama field dengan bentuk respons asli. Untuk detail lengkap tetap ada `cf_get_preset_detail` dan `cf_get_visual_identity`.

---

## 4. Membatalkan Custom Storyboard (`cst_*`)

**Masalah:**
- `cf_cancel_pipeline_job` hanya membatalkan job yang masih **menunggu** di antrean FIFO (`cancelPipelineJob`). Custom Storyboard langsung masuk Pillar Generator, jadi tidak pernah ada di antrean itu.
- `PATCH /api/v2/pillar-campaigns/[id]` menerima `status: 'paused'`, tapi tidak ada worker yang memeriksa status itu, sehingga generator, start frame, TTS, G-Labs, dan FFmpeg tetap berjalan.

**Usulan:**
1. Tambahkan status `cancelled` di PATCH (`app/api/v2/pillar-campaigns/[id]/route.js` ±baris 87):

   **Code Sebelum (Current/Before):**
   ```js
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft'].includes(body.status)) {
   ```
   **Code Sesudah (Proposed/After):**
   ```js
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft', 'cancelled'].includes(body.status)) {
   ```
2. **Hormati status di worker.** Sebelum setiap tahap yang memakai kuota (Gemini prompt engineer, start frame, G-Labs/Veo, TTS), periksa status kampanye. Bila `paused` atau `cancelled`, jangan memulai tahap baru dan tandai item `cancelled`. Tugas G-Labs yang sudah berjalan boleh dibiarkan selesai, tapi tahap berikutnya tidak dijalankan.
3. Tool MCP baru:
   ```js
   register(
     'cf_cancel_storyboard',
     'Cancel (or pause) a custom storyboard / OPC campaign (cst_*). Stops further quota-consuming stages.',
     { campaign_id: z.string().trim().min(1).max(128), mode: z.enum(['cancel', 'pause']).default('cancel') },
     false,
     ({ campaign_id, mode }) => request(`/api/v2/pillar-campaigns/${encodeURIComponent(campaign_id)}`, {
       method: 'PATCH',
       body: { status: mode === 'pause' ? 'paused' : 'cancelled' }
     })
   );
   ```

**Uji:** kirim satu Custom Storyboard dengan `execution_mode: creative_review`, panggil `cf_cancel_storyboard`. Pastikan start frame dan G-Labs tidak berjalan dan status kampanye `cancelled`.

---

## Setelah selesai, beri tahu Claude untuk
- Celah 1: CFA Tahap 3 memakai `platform_titles` (satu jadwal untuk 4 platform), bukan jadwal YouTube terpisah.
- Celah 4: CFA menambahkan perintah batal darurat per item.
- Celah 2 & 3: tidak perlu perubahan di CFA, karena skrip sudah membaca API langsung. Manfaatnya terasa saat Claude bekerja lewat chat dan di skill `cfa-jalur` (Tahap 4).
