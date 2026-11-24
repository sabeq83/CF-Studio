# Usulan Penamaan & Perbaikan 2 Visual Identity Baru (Home & Living) di Server Dev

**Tanggal:** 24 November 2026  
**Konteks:** 2 VI sistem baru di tab **System Presets** (`/settings/visual-identities` di server Dev `5020`) muncul tanpa judul/nama  
**Status:** Usulan Penamaan & Perbaikan (Menunggu Persetujuan)

---

## 1. Akar Masalah Mengapa 2 VI Muncul Tanpa Nama

Hasil pemeriksaan database `dev.visual_identity_presets` menunjukkan seluruh 13 VI tersimpan milik tenant sudah memiliki kolom `label`.  
Dua VI yang muncul **tanpa nama** adalah **2 preset sistem Home & Living baru** di [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js#L1137-L1296):

1. Key: `home_living_serene_interior`
2. Key: `home_living_product_still_life`

Penyebabnya:
- Seluruh preset sistem lama memakai properti **`label`** dan **`version: 1`** (dan di dalam `config` memakai **`label`**).
- Kedua preset Home & Living baru tertulis memakai properti **`name`** tanpa `label` dan tanpa `version`.
- Pada [lib/visual-identity-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-repository.js#L44-L72) (`listVisualIdentities` & `getVisualIdentity`), sistem hanya memetakan `label: p.label` dan `version: p.version` tanpa fallback ke `p.name`, sehingga UI (`/settings/visual-identities` & dropdown pemilihan VI) menerima `label: undefined` dan menampilkan kartu/opsi kosong tanpa nama.

---

## 2. Usulan Nama untuk 2 VI Sistem Baru

Konvensi penamaan System VI saat ini memakai pola singkat, mudah dibaca di dropdown kampanye, dan jelas peruntukannya (seperti *Muslimah Sage Kitchen*, *Syar'iy Classic — Atmospheric Serenity & Wholesome Home*, *Southeast Asian Male Casual*):

### VI #1 (`home_living_serene_interior`)
- **Karakteristik teknis:** `environment_object_only` (Zero-Human), `environment.policy = 'planner_driven'` (mengikuti alur ruangan cerita: kamar tidur, ruang tamu, vanity kamar mandi, ruang makan), `window_daylight`, kamera `interior_showcase` (`natural_35mm`, `slow_push_in`).
- **Usulan Nama (pilih salah satu, rekomendasi utama nomor 1):**
  1. **(Rekomendasi)** `Home & Living — Serene Interior (Zero-Human)`
  2. `Home Living: Ruang Tenang Tanpa Manusia`
  3. `Interior Rumah Tropis — Zero-Human`

### VI #2 (`home_living_product_still_life`)
- **Karakteristik teknis:** `environment_object_only` (Zero-Human), `environment.policy = 'brand_locked'` (meja batu travertine hangat & konsol walnut di depan dinding plester bertekstur), cahaya emas 3500K (`morning_golden`), kamera `product_still_life` (`macro_65mm`, `slow_orbital_glide`).
- **Usulan Nama (pilih salah satu, rekomendasi utama nomor 1):**
  1. **(Rekomendasi)** `Home & Living — Product Still Life (Zero-Human)`
  2. `Home Living: Meja Travertine & Still Life (Zero-Human)`
  3. `Meja Display Produk — Zero-Human Macro`

---

## 3. Rencana Perbaikan Teknis (Setelah Nama Disetujui)

1. Memperbarui kedua entri di [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js#L1137-L1296):
   - Menambahkan **`label`** (di root preset maupun di `config.label`) sesuai nama yang disetujui serta **`version: 1`**.
2. Menambahkan *defensive fallback* di [lib/visual-identity-system-presets.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-system-presets.js#L1299-L1304) dan [lib/visual-identity-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-repository.js#L44-L72):
   - `label: p.label || p.name || p.config?.label || p.config?.name || p.key`
   - `version: p.version || 1`
   agar kejadian preset sistem tanpa `label` tidak bisa terulang lagi.
3. Menambahkan asersi unit test di [tests/home-living-no-human-no-vo.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/home-living-no-human-no-vo.test.mjs) bahwa seluruh hasil `listSystemVisualIdentities()` wajib memiliki `label` non-kosong dan `version` valid.
4. Uji unit test (`PG_SEARCH_PATH=dev`), commit ke branch `fitur/home-living-no-human-no-vo`, dan deploy ke server **Dev (`5020/7020`)**.
