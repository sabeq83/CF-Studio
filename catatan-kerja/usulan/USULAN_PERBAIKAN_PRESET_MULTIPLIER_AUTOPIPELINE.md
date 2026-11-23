# Analisa & Usulan Perbaikan: Preset Video Multiplier di Auto Pipeline Hanya Muncul "Multiplier Remix" & Opsi Campaign Multiplier Hilang di Preset Manager

Tanggal: 23 November 2026  
Menu terkait: **Auto Pipeline** (`/auto-pipeline`), **Preset Manager** (`/settings/presets`), **Multiplier Labs** (`/multiplier-lab`)

---

## 1. Ringkasan Masalah

Saat pengguna membuka menu **Auto Pipeline** (`/auto-pipeline`) dan memilih jenis campaign **Video Multiplier** (`multiplier_campaign`):
1. Dropdown **Preset Konfigurasi Video** hanya menampilkan 1 preset, yaitu **Multiplier Deconstruct Remix** (`multiplier_deconstruct_remix`).
2. Ketika pengguna meng-**clone** preset tersebut di **Preset Manager** (`/settings/presets`), pada bagian **Digunakan untuk Campaign** hanya tampil 3 pilihan checkbox (`Brand Editorial`, `Product Campaign`, `Recipe Campaign`) — tidak ada pilihan **Campaign Multiplier** (`multiplier_campaign`) maupun **Recipe Labs** (`recipe_labs`).

---

## 2. Akar Masalah di Codebase

### A. Mengapa di Auto Pipeline hanya muncul "Multiplier Deconstruct Remix"?
1. Pada `app/auto-pipeline/page.js` (baris `967` untuk Instant Pipeline dan baris `1335` untuk modal Schedule), frontend mengambil daftar preset terfilter per jenis pipeline melalui:
   `GET /api/v2/recipes/autonomous-pipeline?brand=...&pipeline_type=multiplier_campaign`
2. Endpoint `app/api/v2/recipes/autonomous-pipeline/route.js` (baris `73`) memanggil `listOperatorPresetsForCampaignKind('multiplier_campaign', brandIdentifier, tenantId)` di `lib/operator-presets.js` (baris `768–807`).
3. Fungsi tersebut menyaring preset berdasarkan `p.campaign_kinds.includes('multiplier_campaign')`:
   - Di daftar preset sistem bawaan (`PRESETS` di `lib/operator-presets.js` baris `80–569`), **hanya ada 1 preset** yang memiliki `campaign_kinds: ['multiplier_campaign']`, yaitu `multiplier_deconstruct_remix` (baris `342–345`).
   - Preset sistem lain hanya memiliki `['brand_editorial']`, `['product_campaign']`, `['recipe_campaign']`, `['recipe_labs']`, atau `['brand_editorial', 'product_campaign']`.
   - Jika ada preset kustom lama yang tidak punya `campaign_kinds` eksplisit dan kebetulan aktif `product_bridging.is_bridging_active === true`, fungsi `resolvePresetCampaignKinds()` (`lib/operator-presets.js` baris `598–604`) langsung mengklasifikasikannya sebagai `['product_campaign']` sebelum mengecek kata `multiplier` pada nama/key preset.

### B. Mengapa saat Clone / Edit di Preset Manager tidak ada pilihan Campaign Multiplier?
1. Di backend (`lib/operator-presets.js` baris `581`), sistem sebenarnya sudah mendukung **5 nilai `CAMPAIGN_KINDS`**:
   `['brand_editorial', 'product_campaign', 'recipe_campaign', 'multiplier_campaign', 'recipe_labs']`
2. Di halaman **Preset Manager** (`app/settings/presets/page.js`), tab filter (`TABS_CONFIG`, baris `323–330`), penghitung tab (`tabCounts`, baris `469–476`), dan badge kartu preset (baris `764`) juga sudah mendukung `multiplier_campaign` (`🔀 Multiplier Remix` / `🔀 Multiplier`) dan `recipe_labs` (`🧪 Recipe Labs`).
3. **Namun pada form edit/clone preset** (`app/settings/presets/page.js` baris `872`), daftar checkbox **"Digunakan untuk Campaign"** di-hardcode hanya 3 opsi:
   ```jsx
   [
     ['brand_editorial', 'Brand Editorial'],
     ['product_campaign', 'Product Campaign'],
     ['recipe_campaign', 'Recipe Campaign']
   ]
   ```
   Opsi `multiplier_campaign` dan `recipe_labs` tertinggal tidak dimasukkan ke UI form.
4. **Dampak saat Clone / Buat Preset:**
   - Saat meng-clone `multiplier_deconstruct_remix`, `mapPresetToForm()` (baris `121`) sebenarnya menyalin `campaign_kinds: ['multiplier_campaign']` ke state `form`, tetapi **tidak terlihat di checkbox**.
   - Pengguna tidak bisa melihat status centang `Campaign Multiplier`, tidak bisa menghapus/menambahnya secara sadar, tidak bisa membuat preset baru dari nol untuk `multiplier_campaign` (atau `recipe_labs`), dan tidak bisa mengizinkan preset `Product Campaign` / `Brand Editorial` yang sudah ada (mis. preset khusus brand seperti NutriBake / Dapur Botani) agar juga bisa dipakai di **Video Multiplier**.

### C. Temuan Tambahan Terkait
1. **Save as Preset di Multiplier Labs menyimpan `campaign_kinds` yang salah:**
   Di `app/components/campaign-forms/MultiplierConfigurationForm.js` (baris `288`), fitur *Save as Preset* dari form Multiplier Labs mengisi:
   `campaign_kinds: isBridgingActive ? ['product_campaign'] : ['brand_editorial']`
   sehingga preset yang dibuat langsung dari **Multiplier Labs** justru tidak bertipe `multiplier_campaign` dan tidak muncul saat memilih Video Multiplier di Auto Pipeline.
2. **Fallback default key saat `opList` kosong / modal schedule dibuka:**
   - Di `app/auto-pipeline/page.js` baris `974`, fallback `effectiveKey` tidak menangani `multiplier_campaign` secara eksplisit (jatuh ke `'recipe_campaign_default'`).
   - Di `openCreateScheduleModal` (`app/auto-pipeline/page.js` baris `1469–1473`), `initialType` diset `'multiplier_campaign'`, tetapi `schedPresetKey` diinisialisasi ke `selectedPresetKey || 'habitfolk_6clips_quick'` sebelum `fetchPresetsForModalBrand` selesai.

---

## 3. Usulan Perbaikan

### Paket 1 — Perbaikan Inti (Wajib, Risiko Rendah, Tanpa Migrasi DB)

1. **Lengkapi Checkbox "Digunakan untuk Campaign" di Preset Manager (`app/settings/presets/page.js`)**
   - Tambahkan opsi **`['multiplier_campaign', 'Multiplier Remix']`** (atau label **`Campaign Multiplier (Multiplier Remix)`**) dan **`['recipe_labs', 'Recipe Labs (Teks & Foto)']`** pada fieldset `Digunakan untuk Campaign` (baris `872`).
   - Dengan demikian, pengguna dapat:
     - Melihat & mengatur `multiplier_campaign` saat meng-clone `multiplier_deconstruct_remix` atau membuat preset baru.
     - Mengaktifkan multi-centang pada preset brand yang sudah ada (mis. mencentang `Product Campaign` **sekaligus** `Multiplier Remix`) agar preset brand tersebut langsung muncul di dropdown **Video Multiplier** pada Auto Pipeline.
   - Berikan catatan kecil di bawah checkbox bila `multiplier_campaign` dicentang (opsional), misalnya bahwa preset ini akan tersedia di menu **Auto Pipeline → Video Multiplier**.

2. **Perbaiki "Save as Preset" di `MultiplierConfigurationForm.js` (baris `288`)**
   - Saat menyimpan preset baru dari halaman **Multiplier Labs**, sertakan `'multiplier_campaign'` di `campaign_kinds`:
     `campaign_kinds: ['multiplier_campaign']` (atau `isBridgingActive ? ['multiplier_campaign', 'product_campaign'] : ['multiplier_campaign']`, sesuai kebutuhan apakah mau lintas-pakai atau khusus multiplier — disarankan minimal selalu menyertakan `'multiplier_campaign'`).

3. **Rapikan Fallback Preset Key untuk `multiplier_campaign` di `app/auto-pipeline/page.js`**
   - Baris `974`: tambahkan cabang eksplisit `instantCampaignType === 'multiplier_campaign' ? 'multiplier_deconstruct_remix'`.
   - Baris `1473`: inisialisasi awal `schedPresetKey` di `openCreateScheduleModal` (yang `initialType`-nya `'multiplier_campaign'`) ke `'multiplier_deconstruct_remix'` bila `selectedPresetKey` belum cocok atau tidak ada.

### Paket 2 — Peningkatan UX di Auto Pipeline (Opsional / Disarankan)

1. **Tampilkan Tautan Cepat & Konteks Filter Preset di Auto Pipeline**
   - Di bawah dropdown **Preset Konfigurasi Video** pada `app/auto-pipeline/page.js`, jika `instantCampaignType === 'multiplier_campaign'` dan `operatorPresets.length <= 1`, tampilkan petunjuk ringkas + tautan ke **Preset Manager** (`/settings/presets`):
     *"Hanya menampilkan preset dengan tag Campaign Multiplier. Clone atau centang 'Campaign Multiplier' di Preset Manager untuk menambah preset brand Anda."*
2. **Evaluasi Penambahan Preset Sistem Multiplier Tambahan (Opsional)**
   - Saat ini preset sistem hanya memiliki 1 contoh Multiplier (`multiplier_deconstruct_remix`: Faceless, `veo_31_lite`, 5 klip × 5 detik, `is_bridging_active: true`).
   - Jika sering dipakai tanpa produk (pure storytelling remix) atau format 4 klip × 8 detik, dapat dipertimbangkan menambah 1 preset sistem pendamping di `lib/operator-presets.js` (atau cukup gunakan fitur Clone di Preset Manager setelah Paket 1 beres).

---

## 4. Ringkasan File yang Perlu Diubah Saat Eksekusi

| File | Lokasi | Perubahan |
|---|---|---|
| `app/settings/presets/page.js` | Baris `872` | Tambahkan `multiplier_campaign` dan `recipe_labs` pada checkbox `Digunakan untuk Campaign` (+ opsional hint teks) |
| `app/components/campaign-forms/MultiplierConfigurationForm.js` | Baris `288` | Sertakan `'multiplier_campaign'` dalam `campaign_kinds` saat *Save as Preset* |
| `app/auto-pipeline/page.js` | Baris `974`, `1473`, area dropdown preset | Perbaiki fallback key untuk `multiplier_campaign` + tampilkan info singkat bila hanya ada preset default |
| `tests/operator-preset-roundtrip.test.js` | — | Tambah/pastikan test roundtrip untuk preset dengan `campaign_kinds: ['multiplier_campaign']` dan `['recipe_labs']` |

> **Catatan Deployment / SOP:**  
> - Sesuai **SOP Mockup HTML Sebelum Perbaikan UI**, perubahan tampilan checkbox di `app/settings/presets/page.js` dan petunjuk di `app/auto-pipeline/page.js` dapat disimulasikan dulu di mockup HTML Staging sebelum implementasi ke branch `fitur/*` dan uji di Dev (`5020`).
> - Tidak ada perubahan skema database (migrasi DB tidak diperlukan karena kolom/JSON `campaign_kinds` di backend sudah mendukung `multiplier_campaign` dan `recipe_labs`).
