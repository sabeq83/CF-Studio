# Runbook: CF Studio MCP Server & Auto Pipeline Schedules

Panduan operasional, konfigurasi integrasi **Model Context Protocol (MCP)**, dan direktori jadwal autopipeline di lingkungan **CF Studio**.

---

## 1. Arsitektur & Konfigurasi MCP Server (`@cf-studio/mcp`)

CF Studio MCP Server bertindak sebagai jembatan *operator-grade* antara antarmuka AI Agent (Antigravity IDE, Claude Desktop, Cursor) dengan backend CF Studio (Next.js & PostgreSQL).

### Konfigurasi Global Antigravity IDE
File konfigurasi: `~/.gemini/config/mcp_config.json`
```json
{
  "mcpServers": {
    "cf-studio": {
      "command": "node",
      "args": [
        "/Users/sabeqmmursyid/_cfstudio/apps/mcp/server.mjs",
        "--stdio"
      ],
      "env": {
        "CF_STUDIO_API_URL": "http://100.95.245.55:5010",
        "CF_STUDIO_OPERATOR_API_TOKEN": "YOUR_OPERATOR_API_TOKEN_HERE"
      }
    }
  }
}
```

---

## 2. Katalog Tool MCP CF Studio (13 Tools Utama)

| Kategori | Tool Name | Deskripsi |
| :--- | :--- | :--- |
| **Discovery** | `cf_whoami` | Membaca identitas operator, tenant, dan izin cakupan scope |
| | `cf_list_presets` | Menampilkan seluruh preset produksi video dan konten yang tersedia |
| | `cf_search_catalog` | Mencari data brand, produk, dan preset yang kompatibel |
| **Monitoring** | `cf_get_job_status` | Memeriksa status, progress, dan hasil campaign job |
| **5 Engine Pipeline** | `cf_create_product_video` | Menjalankan pipeline video produk promosi (1-Click Product Campaign) |
| | `cf_create_editorial_video` | Menjalankan pipeline video editorial storytelling (Brand Editorial) |
| | `cf_create_recipe_video` | Menjalankan pipeline video resep kuliner (Recipe Campaign) |
| | `cf_create_multiplier_video` | Menjalankan pipeline video multiplier remix berbasis blueprint viral |
| | `cf_create_recipe_labs_post` | Menjalankan pipeline artikel resep & komposit grid foto HD |
| | `cf_run_auto_pipeline` | Master tool fleksibel untuk mengeksekusi tipe pipeline mana pun |
| **Manajemen Jadwal** | `cf_list_schedules` | Melihat daftar seluruh jadwal autopipeline (active, paused, all) |
| | `cf_create_schedule` | Mendaftarkan jadwal otomasi berkala baru ke sistem |
| | `cf_trigger_schedule_now` | Memulai eksekusi on-demand suatu jadwal tanpa menunggu cron |

---

## 3. SOP Menjalankan Jadwal Secara Manual (*Run-Now*)

Untuk memicu eksekusi suatu jadwal di luar jam otomatisnya:

### Cara A: Melalui Chat Antigravity IDE
Ketik langsung di chat:
> *"Tolong jalankan jadwal `apsched_1794193341432_cc28d6` sekarang."*  
Agent akan memanggil tool `cf_trigger_schedule_now`.

### Cara B: Melalui HTTP API / cURL
```bash
curl -X POST "http://100.95.245.55:5010/api/v2/recipes/auto-pipeline-schedules/<SCHEDULE_ID>/run-now" \
  -H "Authorization: Bearer YOUR_OPERATOR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Cara C: Melalui Dashboard Web
Buka `http://100.95.245.55:5010/auto-pipeline` -> Tab **Jadwal Autopipeline** -> Klik tombol **"Run Now" (🚀)**.

---

## 4. Direktori Jadwal Aktif Autopipeline (29 Jadwal)

### A. Nutribake — Multiplier Resep Pagi (7 Jadwal)
* **Preset**: `multiplier_nutribake` | **Jam Buat**: `01:35 WIB` | **Jam Publish**: `06:07 - 06:17 WIB`  
* **Target Channels**: FB, IG, TikTok, YouTube (*NutriBake ID*) | **Resep**: `generate_recipe: true`

| Hari | Schedule ID | Blueprint (FB Reel) & Topik | Jam Publish |
| :--- | :--- | :--- | :---: |
| Minggu | `apsched_1794192913635_9b9b3b` | `987152034166003` (Brownies sehat tanpa tepung terigu) | `06:07 WIB` |
| Senin | `apsched_1794192913819_247b12` | `1733934914449631` (Es krim alpukat creamy & sehat) | `06:13 WIB` |
| Selasa | `apsched_1794192913866_78b9d2` | `3908924336068637` (Camilan manis apel sehat / diet) | `06:09 WIB` |
| Rabu | `apsched_1794192913922_fe7b4e` | `997334649544212` (Es krim cokelat sehat tanpa gula) | `06:17 WIB` |
| Kamis | `apsched_1794192913957_b55e73` | `1333174722333206` (Dessert mewah cuma 2 bahan) | `06:11 WIB` |
| Jumat | `apsched_1794192914000_981806` | `861500313697033` (Kentang rebus dasar roti) | `06:08 WIB` |
| Sabtu | `apsched_1794192914046_a2ff6f` | `1280492217183419` (Sarapan praktis sehat kentang) | `06:15 WIB` |

### B. Nutribake — Multiplier Resep Sore (7 Jadwal)
* **Preset**: `multiplier_nutribake` | **Jam Buat**: `01:50 WIB` | **Jam Publish**: `16:07 - 16:27 WIB`  
* **Target Channels**: FB, IG, TikTok, YouTube (*NutriBake ID*) | **Resep**: `generate_recipe: true`

| Hari | Schedule ID | Blueprint (FB Reel) & Topik | Jam Publish |
| :--- | :--- | :--- | :---: |
| Minggu | `apsched_1794193341432_cc28d6` | `1937408360251752` (Campur pisang sehat) | `16:09 WIB` |
| Senin | `apsched_1794193341522_0eac8b` | `989610603882472` (Coklat sehat buatan rumah) | `16:22 WIB` |
| Selasa | `apsched_1794193341777_f8e0df` | `1692382788459325` (Tetesan coklat manis praktis) | `16:14 WIB` |
| Rabu | `apsched_1794193341810_c30e4f` | `1374828651233257` (Cokelat & pisang tanpa gula) | `16:27 WIB` |
| Kamis | `apsched_1794193341845_09468a` | `2154647808409805` (Manis sehat anti sembarangan) | `16:07 WIB` |
| Jumat | `apsched_1794193341889_af5790` | `2076058362982336` (Muffin pisang kematangan) | `16:18 WIB` |
| Sabtu | `apsched_1794193341924_f1a543` | `1986264885430060` (Sarapan sehat tanpa tepung) | `16:25 WIB` |

### C. Dapur Botani — Multiplier Resep Sore (7 Jadwal)
* **Preset**: `multiplier_dapurbotani` | **Jam Buat**: `01:20 WIB` | **Jam Publish**: `16:11 WIB`  
* **Target Channels**: FB, IG, TikTok, YouTube (*Dapur Botani*) | **Resep**: `generate_recipe: true`

| Hari | Schedule ID | Blueprint (FB Reel) | Jam Publish |
| :--- | :--- | :--- | :---: |
| Minggu | `apsched_1794191517416_68ed70` | `1541386104074200` | `16:11 WIB` |
| Senin | `apsched_1794191517464_de621d` | `1039801438590722` | `16:11 WIB` |
| Selasa | `apsched_1794191517471_f5ce22` | `1297048552417327` | `16:11 WIB` |
| Rabu | `apsched_1794191517491_b3b089` | `26908773132106731` | `16:11 WIB` |
| Kamis | `apsched_1794191517500_93fc1a` | `1547423430289812` | `16:11 WIB` |
| Jumat | `apsched_1794191517507_ccf6ed` | `1591409872512448` | `16:11 WIB` |
| Sabtu | `apsched_1794191517522_fd27de` | `1294672702780108` | `16:11 WIB` |

### D. Dapur Botani — Multiplier Reguler Pagi (7 Jadwal)
* **Preset**: `multiplier_dapurbotani` | **Jam Buat**: `01:00 WIB` | **Jam Publish**: `06:03 - 07:15 WIB`

| Hari | Schedule ID | Blueprint (FB Reel) | Jam Publish |
| :--- | :--- | :--- | :---: |
| Minggu | `apsched_1794136348076_4f4060` | `2378155285996433` | `06:13 WIB` |
| Senin | `apsched_1794179598197_537b9b` | `1026499959950494` | `07:15 WIB` |
| Selasa | `apsched_1794181512973_0e9f86` | `1496449911854398` | `06:11 WIB` |
| Rabu | `apsched_1794181565241_71f5d9` | `1348256653815595` | `06:12 WIB` |
| Kamis | `apsched_1794181614721_2ebd15` | `2042518859691905` | `06:13 WIB` |
| Jumat | `apsched_1794181657607_01c0d8` | `1722317439222166` | `06:03 WIB` |
| Sabtu | `apsched_1794181696017_edde8b` | `1366745295563316` | `06:06 WIB` |

### E. HabitFolk — Video Resep Harian (1 Jadwal)
* **Schedule ID**: `apsched_habitfolk_daily_morning`  
* **Preset**: `habitfolk_8clips_deep` | **Topik**: `air fryer chicken breast`  
* **Hari**: Setiap Hari (Senin – Minggu) | **Jam Buat**: `01:00 WIB` | **Jam Publish**: `05:11 WIB`  
* **Target Channels**: Facebook, YouTube (*HabitFolk*)
