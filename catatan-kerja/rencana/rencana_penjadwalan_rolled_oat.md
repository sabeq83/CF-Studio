# Rencana Penjadwalan Auto Pipeline — NutriBake (Rolled Oat Premium Sahabat)

**Status**: ✅ **SUKSES DIEKSEKUSI (7 Jadwal Aktif di DB)**  
**Tanggal Eksekusi**: 2026-11-15 (16:53 WIB)  
**Periode Jadwal**: 16 November 2026 – 22 November 2026 (7 Hari)

---

## 1. Parameter Produksi & Publishing (Terverifikasi di `default_tenant`)

| Parameter | Nilai / ID Sistem Terverifikasi | Keterangan |
| :--- | :--- | :--- |
| **Tenant** | `default_tenant` | Multi-tenant scope default |
| **Brand** | `nutribake` (`940e766b-76d0-49b7-b6d5-01dfb0041d40`) | Profil Brand NutriBake |
| **Jenis Pipeline** | `product_campaign` | Video Promosi Produk |
| **Produk Target** | `Rolled Oat Premium Sahabat` (`pe_jit_1781329942894_306`) | Foto produk bersih & USP terverifikasi di DB |
| **Link Shopee Affiliate** | `https://s.shopee.co.id/9AM72T1vJz` | `post_link_affiliate: true`, `is_affiliate_enabled: true` |
| **Preset Video** | `nutribake_video_produk_reveal2kali` | Reveal 2x (6 klip @ 4s, bridging segmen klip 4 & 6) |
| **Visual Identity (VI)** | `vi_nutribake_modern_pastry` | *Nutribake — Clean Modern Kitchen & Sensory Baking* |
| **Finishing Template** | `none` | Tanpa template finishing tambahan |
| **Mode Penjadwalan** | `specific_date` (`timezone: Asia/Jakarta`) | Tanggal spesifik per hari |
| **Jam Pembuatan (`generation_time`)** | `01:15` WIB | Jeda 15 menit setelah Cocoa (01:00) & sebelum Multiplier (01:35) |
| **Rentang Jam Publish (`publish_time`)** | `13:07` – `13:17` WIB | Jam istirahat siang (acak optimal engagement) |
| **Eksekusi & Auto-Publish** | `execution_mode: full_autopilot`, `auto_publish_enabled: true` | Full autopilot langsung publish setelah render |
| **Akun Tujuan (4 Akun Repliz)** | • Facebook: `acc_repliz_facebook_1787150716403_901b0a`<br>• Instagram: `acc_repliz_instagram_1787150716356_3747ac`<br>• TikTok: `acc_repliz_tiktok_1787150716416_062e13`<br>• YouTube: `acc_repliz_youtube_1792054767499_746489` | 4 Platform resmi NutriBake ID |

---

## 2. Rincian 7 Jadwal Harian (16–22 November 2026) — Terverifikasi Aktif

| # | Schedule ID | Tanggal (`target_date`) | Hari | Category Entry Point (CEP) | Jam Generate | Jam Publish | Status |
| :-: | :--- | :--- | :--- | :--- | :-: | :-: | :-: |
| 1 | `apsched_1794736402498_7b88b8` | `2026-11-16` | Senin | **Problem-Solution Based** | `01:15` WIB | `13:11` WIB | 🟢 Aktif |
| 2 | `apsched_1794736402512_028ff6` | `2026-11-17` | Selasa | **Routine Based** | `01:15` WIB | `13:08` WIB | 🟢 Aktif |
| 3 | `apsched_1794736402527_3681dd` | `2026-11-18` | Rabu | **Emotional Based** | `01:15` WIB | `13:15` WIB | 🟢 Aktif |
| 4 | `apsched_1794736402544_596045` | `2026-11-19` | Kamis | **Problem-Solution Based** | `01:15` WIB | `13:07` WIB | 🟢 Aktif |
| 5 | `apsched_1794736402555_2ce931` | `2026-11-20` | Jumat | **Aspirational Based** | `01:15` WIB | `13:16` WIB | 🟢 Aktif |
| 6 | `apsched_1794736402565_90c514` | `2026-11-21` | Sabtu | **Commitment Based** | `01:15` WIB | `13:12` WIB | 🟢 Aktif |
| 7 | `apsched_1794736402584_2a8b00` | `2026-11-22` | Minggu | **Opportunistic Based** | `01:15` WIB | `13:09` WIB | 🟢 Aktif |

---

## 3. Pengecekan Bebas Bentrokan Waktu Server

1. **Jadwal Generasi (01:15 WIB)**:
   - `01:00 WIB`: NutriBake Cocoa Powder (7 jadwal 16-22 Nov) & Dapur Botani
   - `01:15 WIB`: **NutriBake Rolled Oat (Slot Baru — BEBAS BENTROKAN)** ✅
   - `01:35 WIB`: NutriBake Multiplier Resep Pagi
   - Server memiliki jeda waktu 15 menit yang cukup untuk menyelesaikan antrean pembuatan naskah & start frame tanpa saling menumpuk.
2. **Jadwal Publishing (13:07 – 13:17 WIB)**:
   - `06:07 - 06:17 WIB`: Multiplier Pagi
   - `10:07 - 10:17 WIB`: NutriBake Cocoa Powder
   - `13:07 - 13:17 WIB`: **NutriBake Rolled Oat (Slot Baru Siang — BEBAS BENTROKAN)** ✅
   - `16:07 - 16:27 WIB`: Multiplier Sore
   - Waktu publikasi siang sangat ideal untuk menjangkau audiens saat jam istirahat makan siang kantor.

---

## 4. Konfigurasi Teknis Payload Eksekusi

Setiap jadwal akan dikirimkan dengan struktur lengkap:
* `selected_cep`: Sesuai baris CEP masing-masing hari.
* `topic`: Nilai CEP terkait.
* `promotion_context`: Nilai CEP terkait.
* `pipeline_config.selected_cep`: Tersemat untuk scheduler runner.
* `pipeline_config.overrides`: Mengunci `visual_identity_preset_id`, `finishing_template: none`, dan parameter Shopee affiliate ON.

