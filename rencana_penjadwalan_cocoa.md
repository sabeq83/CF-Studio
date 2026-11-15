# Rencana Penjadwalan Auto Pipeline — NutriBake (Premix Cocoa Powder Premium)

**Status**: ✅ **SUKSES DIEKSEKUSI (7 Jadwal Aktif di DB)**  
**Tanggal Eksekusi**: 2026-11-15 (15:20 WIB)  
**Periode Jadwal**: 16 November 2026 – 22 November 2026 (7 Hari)

---

## 1. Parameter Produksi & Publishing (Terverifikasi di `default_tenant`)

| Parameter | Nilai / ID Terverifikasi |
| :--- | :--- |
| **Tenant** | `default_tenant` |
| **Brand** | `nutribake` (`940e766b-76d0-49b7-b6d5-01dfb0041d40`) |
| **Jenis Pipeline** | `product_campaign` (`Product Video`) |
| **Produk** | `Premix Cocoa Powder Premium` (`pe_1786588017962_4710`) |
| **Preset Produksi** | `nutribake_video_produk_reveal2kali` (*Nutribake Video Produk – Reveal 2x*: 6 klip @ 4 detik, bridging 2 segmen di klip 4 `intro` & klip 6 `recall`) |
| **Visual Identity** | `vi_nutribake_modern_pastry` (*Nutribake — Clean Modern Kitchen & Sensory Baking*) |
| **Finishing Template** | `none` |
| **Mode Jadwal** | `specific_date` (`timezone`: `Asia/Jakarta`) |
| **Jam Pembuatan (`generation_time`)** | `01:00` WIB |
| **Rentang Jam Publish (`publish_time`)** | Acak antara `10:07` – `10:17` WIB |
| **Eksekusi & Auto-Publish** | `execution_mode`: `full_autopilot`, `auto_publish_enabled`: `true` |
| **Rekomendasi Link Shopee Affiliate** | **ON** (`post_link_affiliate: true`, `is_affiliate_enabled: true`) |
| **Akun Tujuan (4 Akun Repliz NutriBake ID)** | • Facebook: `acc_repliz_facebook_1787150716403_901b0a`<br>• Instagram: `acc_repliz_instagram_1787150716356_3747ac`<br>• TikTok: `acc_repliz_tiktok_1787150716416_062e13`<br>• YouTube: `acc_repliz_youtube_1792054767499_746489` |

---

## 2. Rincian 7 Jadwal Harian (16–22 November 2026) — Terverifikasi Aktif

| # | Schedule ID | Tanggal (`target_date`) | Hari | Topik / Arahan AI | Generate | Publish | Status |
| :-: | :--- | :--- | :--- | :--- | :-: | :-: | :-: |
| 1 | `apsched_1794730857980_6712e3` | `2026-11-16` | Senin | `cokelat tanpa gula` | `01:00` | `10:11` | 🟢 Aktif |
| 2 | `apsched_1794730857987_80a374` | `2026-11-17` | Selasa | `coklat keto` | `01:00` | `10:08` | 🟢 Aktif |
| 3 | `apsched_1794730857993_cb58e0` | `2026-11-18` | Rabu | `diet keto` | `01:00` | `10:15` | 🟢 Aktif |
| 4 | `apsched_1794730857998_ca8b10` | `2026-11-19` | Kamis | `menu defisit kalori` | `01:00` | `10:07` | 🟢 Aktif |
| 5 | `apsched_1794730858002_220d1e` | `2026-11-20` | Jumat | `minuman rendah kalori` | `01:00` | `10:17` | 🟢 Aktif |
| 6 | `apsched_1794730858007_772a74` | `2026-11-21` | Sabtu | `coklat sugar free` | `01:00` | `10:12` | 🟢 Aktif |
| 7 | `apsched_1794730858012_433f50` | `2026-11-22` | Minggu | `cemilan diet` | `01:00` | `10:09` | 🟢 Aktif |

---

## 3. Catatan Teknis & Pengecekan Bentrokan

1. **Bebas Bentrokan Jadwal**:
   - Jadwal eksisting `nutribake` (`Multiplier (Resep)` dan `Multiplier (Resep Sore)`) berjalan pada jam generate `01:35` dan `01:50` dengan jam publish pagi `06:07–06:17` dan sore `16:07–16:27`.
   - Tidak ada jadwal `specific_date` lain pada rentang `2026-11-16` s.d. `2026-11-22`.
2. **Struktur Payload `product_campaign`**:
   - Pada [lib/auto-pipeline-scheduler-runner.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js#L102-L116), `executeAutonomousPipelineForSchedule()` membaca `promotionContext` dari `pipeline_config.promotion_context` (atau `schedule.topic`) dan meneruskan `pipeline_config.overrides` ke `executeAutonomousProductPipeline()`.
   - Saat eksekusi via `cf_create_schedule`, field `visual_identity_preset_id`, `finishing_template`, dan `post_link_affiliate` / `is_affiliate_enabled` disematkan di `pipeline_config` sekaligus di `pipeline_config.overrides` agar konsisten antara UI dan worker runner.
3. **Akun Tujuan**:
   - Ke-4 ID akun di atas menggunakan provider `repliz` sesuai pola 14 jadwal Auto Pipeline `nutribake` lainnya.

---

## 4. Template Payload Eksekusi (`cf_create_schedule`)

```json
{
  "items": [
    {
      "pipeline_type": "product_campaign",
      "schedule_mode": "specific_date",
      "target_date": "2026-11-16",
      "timezone": "Asia/Jakarta",
      "generation_time": "01:00",
      "publish_time": "10:11",
      "name": "Product Video - Nutribake - cokelat tanpa gula",
      "brand_id": "940e766b-76d0-49b7-b6d5-01dfb0041d40",
      "product_id": "pe_1786588017962_4710",
      "target_item_id": "pe_1786588017962_4710",
      "target_item_title": "Premix Cocoa Powder Premium",
      "preset_key": "nutribake_video_produk_reveal2kali",
      "visual_identity_preset_id": "vi_nutribake_modern_pastry",
      "topic": "cokelat tanpa gula",
      "promotion_context": "cokelat tanpa gula",
      "post_link_affiliate": true,
      "execution_mode": "full_autopilot",
      "auto_publish_enabled": true,
      "repliz_account_ids": [
        "acc_repliz_facebook_1787150716403_901b0a",
        "acc_repliz_instagram_1787150716356_3747ac",
        "acc_repliz_tiktok_1787150716416_062e13",
        "acc_repliz_youtube_1792054767499_746489"
      ],
      "pipeline_config": {
        "product_id": "pe_1786588017962_4710",
        "promotion_context": "cokelat tanpa gula",
        "visual_identity_preset_id": "vi_nutribake_modern_pastry",
        "finishing_template": "none",
        "execution_mode": "full_autopilot",
        "post_link_affiliate": true,
        "overrides": {
          "visual_identity_preset_id": "vi_nutribake_modern_pastry",
          "finishing_template": "none",
          "post_link_affiliate": true,
          "is_affiliate_enabled": true
        }
      }
    }
  ]
}
```
*(Diulang untuk tanggal `2026-11-17` s.d. `2026-11-22` sesuai tabel pada Bagian 2).*

