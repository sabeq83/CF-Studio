# Kartu Menu: Preset Manager

Terakhir dicek: 24 November 2026 · Versi aplikasi: v2.61.0
Alamat: `/settings/presets` · Kelompok: PLANNING · Kunci izin menu: `operator_presets`

## Fungsi
Perpustakaan preset strategi produksi yang bisa dipilih saat menjalankan kampanye. Preset menyimpan konfigurasi default: jumlah klip, durasi per klip, gaya narasi, kapasitas batch, platform target, serta daftar `campaign_kinds` (`brand_editorial`, `product_campaign`, `recipe_campaign`, `multiplier_campaign`, `recipe_labs`). Memilih preset yang tepat menentukan gaya dan ritme video yang dihasilkan.

## Alur pakai
1. Buat atau edit preset; isi parameter jumlah klip, durasi, narasi, platform.
2. Simpan; preset langsung tersedia di dropdown saat membuat kampanye baru.
3. Kloning preset yang sudah ada untuk variasi cepat.

## Terhubung dengan
- Dipakai oleh: Auto Pipeline, RE Campaign, Pillar Campaign, Multiplier Labs, Video Studio.
- Perintah MCP: `cf_list_presets`, `cf_get_preset_detail`, `cf_create_preset`, `cf_clone_preset`, `cf_update_preset`.

## Lokasi (untuk agent)
- Halaman: `app/settings/presets/page.js`
- API: tidak ditemukan folder API terpisah — preset diakses via MCP atau inline.
- Tabel data: `operator_presets_json` (key-value JSON di `tenant_settings`)

## Aturan penting & jebakan
1. Kunci izin sama dengan Visual Identity (`operator_presets`) — keduanya di-gate bersama.
2. Preset tidak memuat data brand; brand dipilih terpisah saat membuat kampanye.
3. Menghapus preset yang sedang dipakai jadwal aktif tidak memblokir jadwal (jadwal menyimpan konfigurasi sendiri).
4. Form edit/clone menyediakan seluruh 5 opsi `Digunakan untuk Campaign` (`brand_editorial`, `product_campaign`, `recipe_campaign`, `multiplier_campaign`, `recipe_labs`) dan mendukung multi-centang agar satu preset bisa dipakai di lebih dari satu jenis pipeline.
5. `lib/operator-presets.js` mendukung konfigurasi audio `audio_engine_mode`, `no_vo_audio_bed`, dan `on_screen_text_mode` sehingga mode Tanpa VO (`no_vo`) dapat disimpan di preset.
6. Tersedia 2 preset sistem Shopee 2 Klip (`shopee_2clip_showcase_vo` & `shopee_2clip_showcase_no_vo`, model `omni_flash`, `2 × 4 dtk`, `bridge_at_clip: 1`, `bridge_duration_clips: 2`, `narrative_mode: 'Direct_Showcase'`), serta opsi dropdown `Direct_Showcase` pada form editor Preset Manager.

## Belum ada / batasan
- Belum ada versioning preset; perubahan preset langsung overwrite.

## Dokumen lengkap
Tidak ada dokumen terpisah. Gunakan `cf_get_preset_detail` untuk melihat struktur preset aktif.
