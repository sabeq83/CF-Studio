# Analisa & Usulan Perbaikan: Ketidaksesuaian Preset Bridging pada Kampanye `opc_261115_w7tsy0`

**Tanggal:** 15 November 2026  
**Objek Investigasi:** Kampanye `opc_261115_w7tsy0` (Staging `maknaflow_db`)  
**Preset Terkait:** `nutribake_video_produk_reveal2` vs `nutribake_video_produk_reveal2kali`  

---

## 1. Ringkasan Eksekutif

Kampanye **`opc_261115_w7tsy0`** ternyata **bukan gagal mematuhi preset**, melainkan **benar-benar dipicu menggunakan preset `nutribake_video_produk_reveal2`** (*"Nutribake Video Produk – Reveal Klip 2"*), yang memang mengatur `bridge_at_clip: 2, bridge_duration_clips: 1`. Preset yang diharapkan pengguna — **`nutribake_video_produk_reveal2kali`** (*"Nutribake Video Produk – Reveal 2x"*, dengan `bridge_segments: [4, 6]`) — tidak pernah masuk sebagai `operator_preset_key` pada request maupun baris `content_planners` kampanye tersebut.

Meskipun mesin eksekusi (`ingestPlannerToPillarCampaign`, `buildOrganicPillarPrompt`, `pillar_campaign_items`, dan `opc_start_frame_request_audits`) bekerja sesuai konfigurasi preset yang diterimanya, investigasi kode menunjukkan **5 celah desain pada UI & backend** yang membuat pengguna sangat mudah salah memilih preset, tidak menyadari posisi bridging sebelum meluncurkan kampanye, dan kesulitan melacak preset yang benar-benar terpakai sesudahnya.

---

## 2. Bukti Fakta dari Server & Database Staging

### 2.1 Log Server Staging (`staging-ui.out.log`)
Pada `2026-11-15 13:47:08 +07:00`, pipeline dipicu dengan parameter preset `nutribake_video_produk_reveal2`:

```text
2026-11-15 13:47:08 +07:00: [Autonomous Product Pipeline] 🛍️ Generating pipeline for "Premix Cocoa Powder Premium" (Brand: nutribake, Preset: nutribake_video_produk_reveal2, VI: vi_nutribake_modern_pastry, Lang: id-ID, HookMode: problem_first, CEP: auto, Context: coklat diet)...
```

### 2.2 Database `staging.content_planners` (`pln_321b8779`)
- `id`: `pln_321b8779`
- `planner_focus`: `product_campaign`
- `promotion_context`: `coklat diet`
- `metadata_json.operator_preset_key`: **`"nutribake_video_produk_reveal2"`**
- `staging.auto_pipeline_jobs`: Tidak ada job terjadwal untuk `opc_261115_w7tsy0`, yang menandakan kampanye dijalankan secara langsung melalui `POST /api/v2/recipes/autonomous-pipeline` (bukan cron schedule).

### 2.3 Database `staging.pillar_campaigns` & `staging.pillar_campaign_items`
- `id`: `opc_261115_w7tsy0` (`source_planner_id = 'pln_321b8779'`)
- `is_bridging_active`: `1`, `target_clips_count`: `6`
- `bridge_at_clip`: `2`, `bridge_duration_clips`: `1`
- `bridge_segments`: `[{"at_clip":2,"duration_clips":1,"role":"intro"}]`
- `staging.pillar_campaign_items` (`id = 2194`) & `staging.opc_start_frame_request_audits`: **Hanya Klip 2** yang memiliki `product_visible: true`, `requires_product_reference: true`, `requirement_reason: "bridge_range"`, dan referensi `Product Reference File` di `t2i_prompt`. Klip 1, 3, 4, 5, dan 6 semuanya `product_visible: false`.

### 2.4 Daftar Preset NutriBake di `staging.tenant_settings` (`default_tenant` / `operator_presets_json`)
Terdapat dua preset berjenis `product_campaign` dengan nama dan key yang sangat mirip dan bersebelahan di daftar dropdown:

| Key Preset | Label UI | Revision | `campaign_kinds` | Konfigurasi Bridging |
| :--- | :--- | :---: | :--- | :--- |
| `nutribake_video_produk_reveal2` | `Nutribake Video Produk – Reveal Klip 2` | 1 | `["product_campaign"]` | `bridge_at_clip: 2, duration: 1` |
| `nutribake_video_produk_reveal2kali` | `Nutribake Video Produk – Reveal 2x` | 2 | `["product_campaign"]` | `bridge_segments: [{at_clip: 4, duration: 1, role: "intro"}, {at_clip: 6, duration: 1, role: "recall"}]` |
| `nutribake_resep_produk_reveal2` | `Nutribake Resep Produk – Reveal Klip 2` | 1 | `["product_campaign", "recipe_campaign"]` | `bridge_segments: [{at_clip: 4, duration: 1, role: "intro"}, {at_clip: 6, duration: 1, role: "recall"}]` *(label menyebut Klip 2, namun isi segmennya 4 & 6)* |

---

## 3. Akar Masalah Teknis (Root Causes)

1. **Dropdown Preset di Auto Pipeline Tidak Menampilkan Detail Bridging & Pengelompokan Brand**
   - File: `app/auto-pipeline/page.js` (sekitar baris 3000–3021)
   - `<select>` **3. Preset Video** pada tab 1-Klik Instan hanya merender `{op.label || op.key}` tanpa `<optgroup>` per brand (berbeda dari modal schedule di baris 6517–6538) dan tanpa keterangan klip bridging. Karena `Nutribake Video Produk – Reveal 2x` dan `Nutribake Video Produk – Reveal Klip 2` berada bersebelahan di urutan #5 dan #6, opsi sangat rentan tertukar.

2. **Inspector Card Tidak Menampilkan Info Bridging & Mini Story Arc Hardcode Klip 3**
   - File: `app/auto-pipeline/page.js` (baris 470–513 dan 3054–3283)
   - Panel **Rincian Bawaan Preset Terpilih** menampilkan 6 kartu (Format Klip, Model AI & VO, Subtitel, Transisi FFmpeg, Visual Identity, Mode Visual), tetapi **tidak memiliki kartu/badge Product Bridging**.
   - Fungsi `generateAdaptiveStoryArc` pada `product_campaign` 6 klip **selalu meng-hardcode langkah ke-3 sebagai `🛍️ PIVOT PRODUK`** tanpa membaca `activePresetConfig?.product_bridging` (`bridge_at_clip`, `bridge_duration_clips`, `bridge_segments`). Akibatnya, saat preset `Reveal Klip 2` terpilih, UI tidak memperingatkan bahwa bridging aktif di klip 2.

3. **Filter Preset Mencampur Preset Lintas `campaign_kinds` & Auto-Reset Pilihan**
   - File: `lib/operator-presets.js` (`listOperatorPresetsForCampaignKind`, baris 765–800) & `app/auto-pipeline/page.js` (baris 928–962)
   - Blok `allPresets.filter(p => matchesBrand(p, brandIdentifier))` (baris 774–781) memasukkan semua preset milik brand ke hasil akhir **tanpa memeriksa kecocokan `campaign_kinds`**. Akibatnya, saat pengguna membuka `Product Video` untuk NutriBake, urutan #0 (default) adalah `multiplier_nutribake` (yang bertipe `brand_editorial` dengan `is_bridging_active: false`), dan preset `recipe_campaign` seperti `nutribake_resep_produk_reveal2` ikut tercampur.
   - `useEffect` di `app/auto-pipeline/page.js` baris 928–962 selalu mereset `selectedPresetKey` ke `opList[0]?.key` setiap kali `selectedBrandId`, `instantCampaignType`, atau `brands` diperbarui, alih-alih mempertahankan pilihan preset jika masih tersedia di `opList`.

4. **Tidak Ada Audit Trail `operator_preset_key` di `pillar_campaigns` & Daftar Riwayat**
   - Tabel `pillar_campaigns` belum menyimpan kolom `operator_preset_key`, dan endpoint `GET /api/v2/recipes/autonomous-pipeline/batches` (`app/api/v2/recipes/autonomous-pipeline/batches/route.js`) tidak mengembalikan nama/key preset maupun ringkasan `bridge_segments` pada daftar riwayat kampanye. Operator tidak bisa melihat di UI preset mana yang sebenarnya tereksekusi pada `opc_261115_w7tsy0`.

5. **Potensi Cache Memori Preset Tidak Selalu Segar**
   - File: `lib/operator-presets.js` (`getOperatorPresetConfigAsync`, baris 659–676) & `app/api/v2/recipes/autonomous-pipeline/route.js` (baris 30–38)
   - `getOperatorPresetConfigAsync` mengembalikan cache memori `CUSTOM_PRESET_CACHE` secara langsung jika key sudah pernah dimuat tanpa membandingkan dengan `tenant_settings` terbaru di PostgreSQL; dan endpoint `GET /api/v2/recipes/autonomous-pipeline` membaca `getSetting('operator_presets_json', false)` dari cache memori terlebih dahulu. *(Untuk kasus `opc_261115_w7tsy0` hal ini bukan penyebab utama karena request memang datang sebagai `nutribake_video_produk_reveal2`, namun tetap perlu diperbaiki agar edit preset di Settings selalu sinkron di semua route/worker).*

---

## 4. Usulan Perbaikan Konkret

### Perbaikan A — Kejelasan UI & Pencegahan Salah Pilih di Auto Pipeline (`app/auto-pipeline/page.js`)
1. **Perjelas Label Dropdown Preset & Tambahkan Pengelompokan Brand (`<optgroup>`)**
   - Kelompokkan preset pada dropdown 1-Klik Instan menjadi `⭐ Preset Khusus <Brand>` dan `Preset Umum & Alternatif`.
   - Format label opsi agar mencantumkan ringkasan bridging secara eksplisit:
     - Contoh jika `is_bridging_active`: `[Bridge: Klip 4, 6]` atau `[Bridge: Klip 2]`
     - Contoh jika nonaktif: `[Non-Bridging]`
     - Contoh hasil di dropdown:  
       - `Nutribake Video Produk – Reveal 2x [Bridge: Klip 4, 6]`  
       - `Nutribake Video Produk – Reveal Klip 2 [Bridge: Klip 2]`
2. **Tambahkan Kartu Info `Product Bridging` di Inspector Card**
   - Tambahkan spec badge di grid `Rincian Bawaan Preset Terpilih` yang menampilkan status bridging (`Aktif • Klip 4 & Klip 6` / `Aktif • Klip 2` / `Nonaktif (Tanpa Produk)`) lengkap dengan `preset_key`-nya.
3. **Sinkronkan `Mini Story Arc Timeline Preview` dengan Konfigurasi Preset**
   - Ubah `generateAdaptiveStoryArc` agar membaca `presetConfig?.product_bridging` (`is_bridging_active`, `bridge_segments`, `bridge_at_clip`, `bridge_duration_clips`).
   - Tandai klip sesuai segmen bridging aktual dari preset (`🛍️ INTRO PRODUK` pada klip `intro`, `🔁 RECALL PRODUK` pada klip `recall`, atau `🚫 Non-Produk` untuk klip lainnya) sehingga pratinjau alur di layar 100% mencerminkan preset terpilih.
4. **Pertahankan `selectedPresetKey` Saat Masih Valid**
   - Pada `fetchPresets()`, hanya fallback ke `opList.find(p => p.is_brand_match)?.key || opList[0]?.key` jika `selectedPresetKey` kosong atau tidak ada di `opList` terbaru.

### Perbaikan B — Ketatkan Filter `listOperatorPresetsForCampaignKind` (`lib/operator-presets.js`)
- Pastikan preset yang diambil melalui `matchesBrand(p, brandIdentifier)` **tetap harus kompatibel dengan `normalizedKind`** (`kinds.includes(normalizedKind)`), sehingga preset `brand_editorial` (seperti `multiplier_nutribake`) tidak muncul atau menjadi pilihan default saat pengguna memilih tipe `product_campaign`.

### Perbaikan C — Audit Trail Preset di Kampanye & Riwayat Batches
1. Tambahkan kolom `operator_preset_key TEXT` pada `pillar_campaigns` (atau join `content_planners.metadata_json->>'operator_preset_key'` pada query API detail & batches) serta isi otomatis saat `ingestPlannerToPillarCampaign` berjalan.
2. Tampilkan informasi `Preset: <label> (<key>)` dan `Bridge: Klip ...` pada kartu/detail kampanye di `/auto-pipeline` (Recent Batches) dan `/pillar-campaigns`, sehingga setiap hasil render bisa langsung diaudit ke preset asalnya.

### Perbaikan D — Segarkan Cache Preset Sebelum Eksekusi Pipeline
- Di `POST /api/v2/recipes/autonomous-pipeline` dan `executeAutonomousProductPipeline` (`lib/autonomous-engine.js`), lakukan refresh `operator_presets_json` langsung dari `tenant_settings` di PostgreSQL sebelum `getOperatorPresetConfigAsync` / `resolveOperatorPreset` dijalankan agar perubahan preset (seperti kenaikan `revision` atau perubahan `bridge_segments`) selalu aktif seketika.

### Perbaikan E — Perapihan Data Preset NutriBake di Staging (Rekomendasi Operasional)
- Periksa kembali preset `nutribake_resep_produk_reveal2` yang berlabel *"Nutribake Resep Produk – Reveal Klip 2"* padahal `bridge_segments`-nya `[4, 6]`, agar disesuaikan labelnya (mis. *Reveal 2x (Klip 4 & 6)*).
- Jika `nutribake_video_produk_reveal2` (Reveal Klip 2) sudah tidak dipakai untuk kampanye affiliate NutriBake, pertimbangkan untuk menonaktifkan/menghapusnya agar tidak membingungkan operator di dropdown.

---

## 5. Rencana Tindak Lanjut (Menunggu Persetujuan)

1. Jika usulan disetujui, tahap pertama sesuai SOP adalah membuat **mockup HTML interaktif (`public/mockup_autopipeline_preset_bridging.html`)** di Staging (port `5010`) untuk memverifikasi tampilan dropdown preset, badge bridging, dan Story Arc Preview dinamis.
2. Setelah mockup disetujui, menyusun `implementation_plan.md` beserta *before/after snippets*, menerapkan perubahan kode backend & UI, menjalankan verifikasi unit test + pengecekan Staging, lalu merilis versi baru via SOP `release-non-interactive` dan deployment atomic Staging.

