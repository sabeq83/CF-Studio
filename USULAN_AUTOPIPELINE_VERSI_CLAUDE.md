# Usulan: Auto Pipeline + Scheduler Versi Claude (6 Agent)

> Status: **analisa kelayakan** (belum ada perubahan kode). Tanggal: 15 Nov 2026.

## 1. Kesimpulan singkat

**Bisa dibuat.** Tapi kuncinya: jangan semua langkah dikerjakan "agent AI". Pola yang paling hemat dan stabil:

> **Claude yang berpikir & menulis, program biasa yang menunggu & mengirim.**

- Agent 1 (riset), Agent 2 (storyboard/naskah), dan bagian *menulis prompt* di Agent 3 → **cocok sekali untuk Claude**.
- Mengirim ke G-Labs lalu menunggu gambar/video jadi, TTS, render, dan jadwal Repliz → **sudah ada mesinnya di CF Studio**. Cukup dipakai ulang sebagai "alat" yang dipanggil, bukan dikerjakan ulang oleh AI. Kalau AI disuruh menunggu video 5–10 menit sambil mengecek terus, biayanya membengkak tanpa hasil tambahan.
- Agent 6 (orkestrator) sebaiknya **program pengatur alur biasa** (seperti scheduler sekarang), dan Claude hanya dipanggil untuk keputusan yang butuh penilaian (mis. cek kualitas, memilih ulang kalau gagal).

## 2. Cara kerja CF Studio sekarang (yang akan ditiru)

| Tahap | Di CF Studio sekarang | File utama |
|---|---|---|
| Jadwal | Tabel `auto_pipeline_schedules` dicek tiap "tick"; jadwal aktif yang jatuh tempo dimasukkan antrean | `lib/auto-pipeline-scheduler-runner.js` (`tickAutoPipelineScheduler`) |
| Riset + ide + storyboard | Gemini **1x panggilan** (Single-Pass) menghasilkan hook, storyboard, VO, Video DNA, caption | `lib/content-planner-engine.js` (`executeContentPlanner`), `lib/autonomous-engine.js` (`executeAutonomousEditorialPipeline` untuk mode kata kunci) |
| Auto-approve | Mode full autopilot menyetujui item otomatis | `autonomous-engine.js` → `approvePillarCampaignItemUnchanged` |
| Produksi | Antrean bertahap: Generator → TTS → G-Labs (start frame T2I → video I2V) → FFmpeg/finishing → Social poster | `lib/scheduler-processors.js` (`processPillarGenerator`, `processPillarTts`, `processPillarGlabs`, `processPillarFfmpeg`) |
| G-Labs | Kirim tugas lalu cek status berkala | `lib/webhook-client.js` (`generateImage`, `generateVideo`, `getTaskStatus`) |
| Publish | Video berstatus *Completed* → dijadwalkan ke Repliz pada jam publish | `runDueAutoPipelinePublishingDispatch` + `lib/publishing-service.js` |

Catatan: riset di CF Studio sekarang sebagian besar "menumpang" di panggilan Gemini yang sama (ada jalur riset Hermes, tapi opsional). Di versi Claude, riset jadi tahap tersendiri yang benar-benar mencari di web — ini peningkatan nyata.

## 3. Pemetaan 6 agent ke versi Claude

| Agent | Tugas | Dikerjakan oleh | Model saran | Catatan |
|---|---|---|---|---|
| **1. Riset** | Riset kata kunci, simpan hasil | Claude + pencarian web bawaan | Sonnet 5.5 | Simpan ke tabel baru `keyword_research` (kata kunci, tren, sudut pandang, sumber, tanggal) supaya tidak riset ulang topik yang sama |
| **2. Penulis** | Hook, storyboard, VO, aksi visual, caption | Claude | Opus 5.5 | Tetap **1 kali panggilan** seperti aturan Single-Pass. Output dipaksa ke format JSON tetap (structured output) supaya tahap berikutnya tidak rusak |
| **3a. Prompt** | Menyusun prompt T2I & I2V | Claude | Sonnet 5.5 | Bisa digabung ke Agent 2 kalau mau lebih hemat |
| **3b. Produksi aset** | Kirim T2I → tunggu start frame → kirim I2V → kirim VO ke TTS | **Program** (pakai ulang `webhook-client.js`, TTS yang ada) | – | Tidak perlu AI. Bagian menunggu jangan pakai AI |
| **4. Render** | Gabung klip, audio, teks Remotion, finishing | **Program** (pakai ulang FFmpeg/finishing/Remotion yang ada) | – | Opsional: Claude melihat 3–4 cuplikan gambar hasil akhir untuk cek kualitas (QA) sebelum publish |
| **5. Publisher** | Jadwal ke Repliz | **Program** (pakai ulang `schedulePublishingJobs`) | – | Claude boleh dipakai untuk merapikan caption per platform |
| **6. Orkestrator** | Mengatur urutan, ulang kalau gagal, lapor | **Program** (state machine) + Claude untuk keputusan | Haiku/Sonnet 5.5 | Contoh keputusan: "start frame gagal 2x → tulis ulang prompt", "skor QA rendah → ulang klip 3" |

## 4. Di mana sistem ini dijalankan

Ada batasan penting: **G-Labs, database, dan server ada di jaringan pribadi (Tailscale, alamat 100.x)**. Layanan Claude yang berjalan di cloud Anthropic tidak bisa menjangkau alamat itu secara langsung.

| Pilihan | Cocok? | Alasan |
|---|---|---|
| **A. Claude API dipanggil dari server Mac Mini (Node.js, sama seperti Gemini sekarang)** | ✅ **Disarankan** | Paling sederhana. Pakai SDK resmi `@anthropic-ai/sdk`. Semua alat (G-Labs, TTS, FFmpeg, Repliz, database) sudah bisa dijangkau dari situ. Jadwal pakai scheduler yang sudah ada |
| B. Claude Agent SDK di Mac Mini | ⚠️ Bisa | Lebih "pintar" (bisa baca file, jalankan perintah), tapi lebih berat dan lebih sulit dikontrol untuk pipeline harian yang urutannya sudah pasti |
| C. Managed Agents (cloud Anthropic, ada fitur jadwal bawaan) | ⚠️ Nanti | Jadwal & multi-agent sudah disediakan, tapi tetap butuh "jembatan" ke G-Labs/DB di jaringan pribadi. Cocok kalau kelak server dibuka aman ke internet |
| D. Tugas terjadwal Claude Code / Cowork + MCP `cf-studio` | 🧪 Untuk uji coba cepat | MCP `cf-studio` sudah punya `cf_create_schedule`, `cf_run_auto_pipeline`, dll. Tapi ini hanya menyuruh pipeline Gemini yang lama, dan butuh laptop menyala |

## 5. Gambaran alur harian (versi A)

```
[Jadwal 06:00]  Orkestrator (program) ambil jadwal aktif
   │
   ├─ Agent 1 Claude: riset kata kunci (web search) ──► simpan keyword_research
   ├─ Agent 2 Claude: 1 panggilan → JSON {hook, storyboard[], vo, aksi_visual, caption, hashtag}
   ├─ Agent 3a Claude: prompt T2I + I2V per klip (JSON)
   │
   ├─ Program: kirim T2I ke G-Labs → tunggu start frame
   │           kirim start frame + I2V → tunggu video     (paralel: VO → TTS)
   ├─ Program: render/finishing/Remotion → MP4 final
   ├─ (Opsional) Claude QA: lihat cuplikan + naskah → lulus / ulang klip tertentu
   └─ Program: jadwalkan ke Repliz di jam publish
```

Setiap tahap menyimpan status di database (seperti `auto_pipeline_queue` sekarang), jadi kalau satu tahap gagal, cukup tahap itu yang diulang — bukan dari awal.

## 6. Perkiraan biaya Claude per video (kasar)

Harga per 1 juta token: Opus 5.5 $4 masuk / $20 keluar; Sonnet 5.5 $2 / $10; Haiku 5.5 $0,10 / $0,50. Pencarian web dikenai biaya per pencarian (sekitar $10 per 1.000 — cek halaman harga resmi).

| Tahap | Perkiraan |
|---|---|
| Riset (Sonnet + ±5 pencarian) | ± $0,10–0,15 |
| Storyboard 1-pass (Opus) | ± $0,20–0,30 |
| Prompt T2I/I2V (Sonnet) | ± $0,05–0,10 |
| QA + orkestrator | ± $0,05 |
| **Total** | **± $0,40–0,60 per video** (± Rp7–10 ribu) |

3 video/hari ≈ $1,2–1,8/hari. Biaya G-Labs, TTS, dan server tetap sama seperti sekarang. Bisa ditekan lagi dengan *prompt caching* (instruksi gaya/brand yang sama disimpan, jauh lebih murah saat dipakai ulang).

## 7. Risiko & hal yang perlu diputuskan

1. **Kualitas vs Gemini sekarang** — perlu uji banding 5–10 topik yang sama sebelum mengganti.
2. **Aturan konten (kesehatan, klaim produk)** — aturan kepatuhan yang sudah ada (KB, compliance) harus ikut dimasukkan ke instruksi Agent 2.
3. **Jangan pakai AI untuk menunggu** — semua proses tunggu G-Labs/render tetap di program biasa.
4. **Kunci API Claude** — disimpan di `tenant_settings`/`.env` server, tidak boleh masuk Git (sesuai SOP keamanan).
5. **Ganti total atau berdampingan?** Saran: buat sebagai **jenis pipeline baru** (`pipeline_type = 'claude_keyword'`) di scheduler yang sama, jadi pipeline Gemini lama tetap jalan.

## 8. Tahapan pengerjaan yang disarankan

1. **Uji kertas (1–2 hari):** jalankan Agent 1–3a saja secara manual untuk 5 kata kunci, bandingkan hasil naskah & prompt dengan versi Gemini.
2. **MVP:** tambah `pipeline_type = 'claude_keyword'` → Claude menghasilkan storyboard + prompt → diteruskan ke antrean produksi yang **sudah ada** (TTS, G-Labs, FFmpeg, Repliz).
3. **Tambah tabel riset kata kunci** + penghindar topik berulang.
4. **Tambah QA Claude** sebelum publish + logika "ulang otomatis".
5. Setelah stabil, baru pertimbangkan Managed Agents (cloud) bila ingin lepas dari server sendiri.
