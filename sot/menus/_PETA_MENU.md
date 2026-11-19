# Peta Menu CF Studio

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.51.0
Sumber daftar menu: `lib/sidebar-nav.js`

**Cara pakai (untuk agent):** cari menu yang dibahas di tabel, buka kartunya saja. Dokumen lengkap hanya dibuka jika kartu tidak cukup.

## PLANNING — menyiapkan bahan

| Menu | Alamat | Fungsi singkat | Kartu | Dokumen lengkap |
|---|---|---|---|---|
| Content Planner | `/content-planner` | Menyusun baris rencana konten strategis berbasis decision tree | ✅ [kartu](kartu/content-planner.md) | `content-planner.md` |
| Radar Produk | `/product-radar` | Kurasi kandidat riset TeleRadar sebelum masuk ke katalog produk | ✅ [kartu](kartu/product-radar.md) | [usulan](../../catatan-kerja/usulan/USULAN_RADAR_PRODUK_TELERADAR_CFSTUDIO.md) |
| Product Database | `/products` | Katalog DNA produk, ekstraksi AI, cropping, dan foto studio | ✅ [kartu](kartu/products.md) | `products.md` |
| Recipe Library | `/recipe-library` | Perpustakaan resep terkurasi untuk video resep dan artikel | ✅ [kartu](kartu/recipe-library.md) | `recipe-labs.md` |
| Deconstruct Lab | `/deconstruct` | Membedah video viral kompetitor menjadi blueprint terstruktur | ✅ [kartu](kartu/deconstruct.md) | `deconstruct.md` |
| Preset Manager | `/settings/presets` | Preset strategi produksi (klip, durasi, narasi, platform) | ✅ [kartu](kartu/presets.md) | — |
| Visual Identity | `/settings/visual-identities` | Karakter visual konsisten (lighting, subjek, suasana brand) | ✅ [kartu](kartu/visual-identities.md) | `visual-identity-studio.md` |
| Universe Manager | `/settings/universes` | Semesta fiksi/semi-fiksi konten berseri (karakter & lokasi tetap) | ✅ [kartu](kartu/universes.md) | `universe-manager.md` |
| Brand Profile Manager | `/settings/brand-profiles` | Profil identitas brand: suara, target audiens, dan finishing video | ✅ [kartu](kartu/brand-profiles.md) | `brand-profiles.md` |

## WORKFLOW — membuat konten

| Menu | Alamat | Fungsi singkat | Kartu | Dokumen lengkap |
|---|---|---|---|---|
| Auto Pipeline | `/auto-pipeline` | Produksi video otomatis sekali klik atau terjadwal | ✅ [kartu](kartu/auto-pipeline.md) | `docs/cf-studio-mcp-autopipeline-runbook.md` |
| Threads Labs | `/threads-labs` | Radar peluang percakapan, balasan organik, dan seri utas | ✅ [kartu](kartu/threads-labs.md) | — |
| RE Campaign | `/re-campaigns` | Kampanye video produk dari reverse engineering blueprint | ✅ [kartu](kartu/re-campaigns.md) | `re-campaigns.md` |
| Pillar Campaign | `/pillar-campaigns` | Kampanye video strategis berbasis pilar konten edukatif/nilai | ✅ [kartu](kartu/pillar-campaigns.md) | `pillar-campaigns.md`, `STRATEGIC_PILLAR_CAMPAIGN.md` |
| Recipe Labs | `/recipe-labs` | Artikel resep terformat + generator foto grid media sosial | ✅ [kartu](kartu/recipe-labs.md) | `recipe-labs.md` |
| Multiplier Labs | `/multiplier-lab` | Satu blueprint viral → banyak video dengan sudut pandang berbeda | ✅ [kartu](kartu/multiplier-lab.md) | `multiplier-lab.md` |
| Product Bridging | `/product-bridge-inject` | Menyisipkan produk ke naskah/konten secara halus dan natural | ✅ [kartu](kartu/product-bridge-inject.md) | `blueprint_product_bridging_injector.md` |

## PUBLISHING — menayangkan

| Menu | Alamat | Fungsi singkat | Kartu | Dokumen lengkap |
|---|---|---|---|---|
| ContentFlow Hub | `/content-flow` | Staging konten jadi, slot kalender tayang, dan sinkronisasi status | ✅ [kartu](kartu/content-flow.md) | `contentflow-studio.md` |
| Recipe Exporter | `/recipe-exporter` | Pengemasan dan ekspor resep (aset gambar, teks, video) ke cloud | ✅ [kartu](kartu/recipe-exporter.md) | `recipe-labs.md` |

## TOOLS — alat bantu

| Menu | Alamat | Fungsi singkat | Kartu | Dokumen lengkap |
|---|---|---|---|---|
| Video Studio | `/video-studio` | Editor mandiri perakit video, audio upload/TTS, dan 8 template finishing | ✅ [kartu](kartu/video-studio.md) | `video-studio.md` |
| TTS Studio | `/tts-studio` | Pembuatan suara voice-over AI per adegan tersimpan persisten di DB | ✅ [kartu](kartu/tts-studio.md) | `tts-studio.md` |

## SYSTEM

| Menu | Alamat | Fungsi singkat | Kartu | Dokumen lengkap |
|---|---|---|---|---|
| Dashboard | `/dashboard` | Ringkasan aktivitas dan status operasional sistem | ✅ [kartu](kartu/dashboard.md) | — |
| Settings | `/settings` | Pengaturan sistem, kunci layanan AI, Google Drive, dan webhook | ✅ [kartu](kartu/settings.md) | — |
| User Management | `/settings/users` | Pengelolaan hak akses menu dan alokasi brand pengguna (admin) | ✅ [kartu](kartu/users-tenants.md) | — |
| Tenant Management | `/settings/tenants` | Pengelolaan organisasi mandiri dan isolasi modul (superadmin) | ✅ [kartu](kartu/users-tenants.md) | — |

## Catatan

- Folder `app/` juga berisi halaman yang tidak muncul di sidebar (mis. `youtube-studio`, `affiliate-studio`, `reports`, `system-health`). Dokumennya ada di folder ini, tetapi belum masuk peta.
- Dokumen lama fitur yang sudah dihapus (`instant-factory.md`, `sheets-autopilot.md`) diarsipkan di `sot/menus/arsip/`.
- Dokumen rencana pengerjaan YouTube Studio dan Affiliate Studio tersimpan di subfolder `sot/menus/rencana/`.
