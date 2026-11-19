# Implementation Plan — Tahap 7.2 & 7.3 Radar Produk (Tren Lintas Minggu & Skor Peluang)

- **Branch Kerja**: `fitur/radar-trends-and-score` (stacked dari `fitur/radar-bulk-approval`)
- **Lingkup**:
  1. **Tahap 7.2 — Perbandingan Tren Lintas Minggu**: Mencocokkan kandidat antarbatch via `normalized_url` (untuk URL terverifikasi `official`/`listing`/`user`) dan `cf_product_id`; menyimpan setiap minggu sebagai pengamatan terpisah tanpa menimpa batch lain; menampilkan tanggal pengamatan di setiap angka + delta antar-minggu + **Saran Nama Mirip** (hanya saran, tidak digabung otomatis).
  2. **Tahap 7.3 — Skor Peluang**: Menghitung skor transparan (`0–100`) dari 5 komponen (**Penjualan/minggu maks 30**, **Arah Tren maks 20**, **Komisi maks 20**, **Zona Harga maks 15**, **Kecocokan URL maks 15**), menampilkan rincian lengkap (bukan angka saja), dan mendukung pengurutan. **Hanya alat bantu urutan, tidak pernah memicu promosi otomatis.**
- **Tahap Selanjutnya (Terpisah setelah lolos uji Dev)**:
  - `7.4` Perintah Bot Telegram (`/top`, `/produk`, `/status`, `/url`, `/kirim`) di Mac Mini (butuh persetujuan ubah kode bot eksternal).
  - `7.5` Cutover & Penghentian Google Sheets Fase B (butuh jadwal cutover & tarik edit terakhir bersama pengguna).
  - `7.6` Peninjauan `cf_add_product` & Penambahan MCP Radar (`product_research`).

---

## Execution Task List

### Langkah 1 — Mockup HTML Interaktif (Pintu Review UI 🛑)
- [x] Buat branch `fitur/radar-trends-and-score` di atas `fitur/radar-bulk-approval`
- [x] Buat `public/mockup_radar_trends_score.html` mandiri (hanya memakai semantic CSS tokens dari `app/theme.css`, toggle Light/Dark) yang menyimulasikan:
  - Kontrol pengurutan (**Ranking Riset**, **Skor Peluang Tertinggi**, **Kenaikan Terjual Lintas Minggu**) + banner/pill penjelas bahwa skor **hanya alat bantu urutan, bukan promosi otomatis**
  - Kolom tabel **Terjual & Tren Lintas Minggu** dengan tanggal pengamatan di setiap angka (mis. `820/mg · 17 Nov` vs `540/mg · 10 Nov` -> `+280 (+52%)`) dan peringkat (`#1 ↑2`)
  - Kolom **Skor Peluang** (`86/100 · Prioritas Tinggi`) dengan tombol klik/hover rincian 5 komponen transparan (`Penjualan 24/30`, `Tren 20/20`, `Komisi 16/20`, `Harga 15/15`, `URL 15/15`)
  - Panel Detail (*Drawer*) berisi **Riwayat Lintas Minggu (Timeline Pengamatan Terpisah)** per tanggal batch + kotak terpisah **Saran Nama Mirip (lintas batch, tidak digabung otomatis)** + rincian **Skor Peluang**
- [x] Sinkronkan mockup ke Staging Mac Mini (`~/maknaflow-staging-atomic/current/public/mockup_radar_trends_score.html`) & laporkan tautan/preview untuk review UI
- [x] **🛑 Berhenti:** Tunggu persetujuan pengguna atas mockup sebelum mengubah kode backend & React

### Langkah 2 — Backend Skor Peluang & Pencocokan Lintas Minggu
- [x] Buat helper murni `lib/product-research-opportunity-score.js` berisi `SCORE_FORMULA_VERSION`, `OPPORTUNITY_WEIGHTS`, dan `computeOpportunityScore(candidate)` beserta rincian 5 komponen & keterangannya
- [x] Tambahkan fungsi di `lib/product-research-repository.js`:
  - `getCrossBatchHistoryMapForCandidates(candidates)` untuk membaca pengamatan lintas batch terisolasi `tenant_id` (pencocokan eksak via `cf_product_id` atau `normalized_url` terverifikasi `url_status IN ('official', 'listing', 'user')`), menghitung `previous` & `deltas` (`sold_delta`, `sold_pct`, `rank_delta`, `commission_delta`, `price_delta`), dan mengumpulkan `observations` terpisah per tanggal batch
  - `findSimilarNameCandidatesAcrossBatches(candidate)` untuk menyarankan kemiripan nama dari batch lain sebagai **saran terpisah** (tanpa auto-merge)
  - Dukungan `sortBy` (`rank` | `score_desc` | `sold_delta_desc`) pada `listResearchCandidates`
- [x] Perbarui `app/api/v2/product-research/candidates/route.js`, `app/api/v2/product-research/candidates/[id]/route.js`, dan `lib/product-research-promotion-service.js` (`getResearchCandidatePromotionStatus`) untuk menyertakan `opportunity_score`, `weekly_comparison`, dan `weekly_history`
- [x] Tambahkan unit & integration test di `tests/product-research/trends-and-score.test.js` (isolasi tenant, pencocokan eksak URL terverifikasi / `cf_product_id`, nama mirip hanya saran, `nearest` tidak dicocokkan otomatis, pengamatan minggu terpisah tidak ditimpa, rumus & rincian skor peluang, sorting `score_desc` & `sold_delta_desc`, tidak ada auto-promote)

### Langkah 3 — UI Radar Produk, Kartu Menu & Deploy Dev (Pintu Berhenti 🛑)
- [x] Perbarui `app/product-radar/radar-labels.js`, `app/product-radar/page.js`, `app/product-radar/CandidateDetailDrawer.js`, dan `app/product-radar/product-radar.module.css` memakai semantic CSS tokens saja
- [x] Perbarui `sot/menus/kartu/product-radar.md` untuk mendokumentasikan rumus transparan **Skor Peluang (100 poin)**, aturan **Perbandingan Lintas Minggu**, dan batasannya
- [x] Jalankan seluruh test suite (`tests/product-research/*.test.js`), `node --check`, commit & push `fitur/radar-trends-and-score`, deploy atomic ke **Dev**, dan verifikasi kesehatan Dev
- [ ] **🛑 Berhenti:** Laporkan hasil di Dev + daftar cek ke pengguna sebelum lanjut ke Tahap 7.4/7.5/7.6

---

## Rancangan Perubahan Kode (Before & After)

### 1. Baru — `lib/product-research-opportunity-score.js`
**Code Sebelum (Current/Before):**
*(Belum ada; skor peluang sebelumnya belum dihitung.)*

**Code Sesudah (Proposed/After):**
```js
export const OPPORTUNITY_SCORE_RULES = {
  version: 'v1',
  maxTotal: 100,
  disclaimer: 'Skor hanya alat bantu urutan kurasi dan tidak pernah memicu promosi otomatis.',
  components: [
    { key: 'sold', label: 'Penjualan/minggu', max: 30 },
    { key: 'trend', label: 'Arah tren', max: 20 },
    { key: 'commission', label: 'Komisi/produk', max: 20 },
    { key: 'price', label: 'Zona harga', max: 15 },
    { key: 'url_match', label: 'Kesiapan URL', max: 15 }
  ]
};

export function computeOpportunityScore(candidate) {
  const rd = candidate?.research_data || {};
  const cd = candidate?.curated_data || {};
  // Hitung 5 komponen deterministik berdasarkan observed_at batch terkait + kembalikan breakdown lengkap
  ...
}
```

### 2. Modifikasi — `app/api/v2/product-research/candidates/route.js`
**Code Sebelum (Current/Before):**
```js
function enrichCandidateRow(item, duplicateMap, catalogMap) {
  ...
  return {
    ...item,
    effective_url: effectiveUrl,
    effective_normalized_url: effectiveNormalizedUrl,
    url_blocked: isCandidateUrlBlocked(item),
    duplicate_match: duplicateMatch,
    catalog_product: catalogProduct,
    thumb_api_url: item.thumb_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=thumb` : null,
    screenshot_api_url: item.screenshot_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=screenshot` : null
  };
}
```

**Code Sesudah (Proposed/After):**
```js
function enrichCandidateRow(item, duplicateMap, catalogMap, comparisonMap) {
  ...
  return {
    ...item,
    effective_url: effectiveUrl,
    effective_normalized_url: effectiveNormalizedUrl,
    url_blocked: isCandidateUrlBlocked(item),
    duplicate_match: duplicateMatch,
    catalog_product: catalogProduct,
    opportunity_score: item.opportunity_score || computeOpportunityScore(item),
    weekly_comparison: comparisonMap?.get(item.id) || item.weekly_comparison || null,
    thumb_api_url: item.thumb_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=thumb` : null,
    screenshot_api_url: item.screenshot_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=screenshot` : null
  };
}
```

### 3. Modifikasi — `app/api/v2/product-research/candidates/[id]/route.js` & `lib/product-research-promotion-service.js`
**Code Sebelum (Current/Before):**
```js
  return {
    ...candidate,
    effective_url: effectiveUrl,
    url_blocked: isCandidateUrlBlocked(candidate),
    ...
  };
```

**Code Sesudah (Proposed/After):**
```js
  const [weeklyHistory, dupMap, catMap] = await Promise.all([
    getCandidateWeeklyHistory(candidate),
    ...
  ]);
  return {
    ...candidate,
    effective_url: effectiveUrl,
    url_blocked: isCandidateUrlBlocked(candidate),
    opportunity_score: computeOpportunityScore(candidate),
    weekly_history: weeklyHistory,
    ...
  };
```

### 4. Modifikasi — `app/product-radar/page.js`, `CandidateDetailDrawer.js`, `radar-labels.js`, `product-radar.module.css`
**Code Sebelum (Current/Before):**
- Kontrol filter hanya menyediakan batch, kategori, tren, status URL, status kurasi, dan status katalog.
- Kolom tabel menampilkan terjual + catatan tren satu minggu saja; belum ada pembanding minggu lalu, delta, skor peluang + rincian 5 komponen, dan riwayat pengamatan terpisah di Drawer.

**Code Sesudah (Proposed/After):**
- Dropdown urutan (`Ranking Riset`, `Skor Peluang Tertinggi`, `Kenaikan Terjual Lintas Minggu`) dan catatan bantu (`Skor hanya bantuan urutan, bukan promosi otomatis`).
- Sel **Terjual & Tren Lintas Minggu** menampilkan angka dengan tanggal pengamatan masing-masing + delta terhadap pengamatan sebelumnya.
- Sel **Skor Peluang** menampilkan badge total skor + tombol rincian 5 komponen (Penjualan, Tren, Komisi, Harga, URL).
- `CandidateDetailDrawer.js` menampilkan panel **Riwayat Lintas Minggu (Pengamatan Terpisah)**, bagian terpisah **Saran Nama Mirip (Lintas Batch)**, dan rincian lengkap **Skor Peluang**.

---

## Tahap 7.4 (sisi bot Mac Mini) & 7.5 — RENCANA, MENUNGGU PERSETUJUAN 🛑

Sisi repo sudah selesai & ter-deploy di Dev (API operator `read/curate/promote/mcp_promote`, tabel `product_research_telegram_identities`, tool MCP, guard `cf_add_product`). Yang tersisa menyentuh sistem hidup di Mac Mini dan Google Sheets, sehingga **tidak dijalankan sebelum disetujui**.

### A. Ubah kode bot (`~/.claude/skills/teleradar/scripts/teleradar_bot.py`, luar repo)
- Backup dulu ke `backup-<tanggal>-bot-radar/` (pola yang sama dengan backup 19 Nov).
- `/top /naik /stabil /turun /cari /produk /status` → baca `GET /api/operator/v2/product-research/*` (token `product_research:read`), fallback ke `data.json` bila API gagal.
- `/url <no> <link>` → `POST .../candidates/<no>/url` (token `curate`) bersama `telegram_user_id` pengirim.
- `/kirim 1,6` → `POST .../promote` `mode=preview` lalu `execute` (token `promote`) bersama `telegram_user_id`; balasan bot memakai ringkasan Valid/Duplikat/Tertahan.
- Token terpisah per scope disimpan di `.radar_env` (mode 600), tidak pernah ditulis ke repo/log.
- Daftarkan ID Telegram yang boleh `/kirim` lewat `scripts/radar-telegram-identity.mjs`.
- Lingkungan awal: **Dev (5020/7020)** dulu; Staging hanya setelah fitur lolos uji Dev & disetujui.

### B. Cutover Google Sheets (7.5)
1. Tetapkan jendela waktu bersama pengguna (tidak ada batch/edit Sheet berjalan).
2. `sheet_sync.py pull` **terakhir kali** → impor edit Sheet (URL/persetujuan) ke Radar sebagai URL kurator; persetujuan lama TIDAK memicu promosi.
3. Alihkan `/kirim` ke Radar (langkah A), lalu matikan `sheet_sync.py pull` dan Fase B lama (tidak boleh ada 2 konsumen promosi).
4. Sheet/Excel tetap ada sebagai ekspor satu arah opsional (`push`).
5. Rollback: kembalikan backup bot + aktifkan lagi Fase B (Radar tetap aman karena promosi idempotent).

### Checklist
- [x] 7.4 repo: API operator + identitas Telegram + test (Dev)
- [x] 7.6 repo: tool MCP Radar + guard `cf_add_product` + test
- [x] 7.4 Mac Mini: ubah kode bot (terhubung ke Dev 5020; identitas Telegram `1773294885` aktif; backup di `backup-20261119-bot-radar/`)
- [ ] 7.5: cutover Google Sheets (**menunggu konfirmasi setelah penjelasan**)
