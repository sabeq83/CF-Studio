# Laporan Eksekusi Staging: Mockup Dialog & Pemeran (`V-1`) + Audit Model Gambar G-Labs & Uji A/B `#2183`

**Tanggal:** 2026-11-15  
**Lingkungan:** Mac Mini Staging (`http://100.95.245.55:5010` / API `:7010`, DB schema `staging,public`)  
**Release Aktif Staging:** `v2.48.14` (`4571ab1c46ee863aad30ea64fe0300e7b3e54a82`, release ID `20261114T232903Z-4571ab1c46ee`)  
**Status Production:** Tidak disentuh / tidak ada deploy ke Production.

---

## Ringkasan Eksekutif

1. **Rencana 1 (`usulan-voice-persona-karakter-preset.md`) — Tahap V-1 Selesai:**
   - Mockup interaktif `public/mockup_dialog_karakter.html` telah dibuat, disinkronkan ke Staging, terverifikasi HTTP `200`, dan **ditahan sebelum V-2 s/d V-5** menunggu persetujuan Anda.
2. **Rencana 2 (`usulan-model-gambar-glabs.md`) — Seluruh Langkah 1–5 Selesai, dengan 2 Temuan Penting:**
   - **Temuan 1 (Audit Log Part C vs E.4):** Ke-12 gambar acuan Part C **tidak pernah fallback kuota** dan sebenarnya **berhasil dijalankan pada `nano_banana_pro`**. Pencatatan di akhir `stage-gambar-karakter-report.md` keliru menggabungkannya dengan Start Frame `#2183`.
   - **Temuan 2 (Akar Masalah `#2183` `r1`):** Ke-5 Start Frame `r1` kemarin terkirim ke G-Labs dengan **`reference_count: 0`** (tanpa gambar acuan v3 sama sekali) karena bug path POSIX pada `fileToBase64()` di `lib/cartoon-reference-resolver.js` (`path.isAbsolute('/uploads/...')` bernilai `true` sehingga tidak mencari di `<cwd>/public/uploads/...`).
   - Setelah bug `fileToBase64()` diperbaiki (`v2.48.14`), uji A/B adil dilakukan pada item `#2183` dengan **prompt & 4 acuan JPEG v3 identik** antara **`nano_banana_pro`** (`r2`, 5/5 selesai, 0 fallback kuota) vs **`nano_banana_2`** (`r3`, 4/5 selesai, Clip 5 gagal false-positive `403: PUBLIC_ERROR_USER_MINOR`). Hasil visual memperlihatkan kelebihan & kekurangan nyata pada **kedua** model (dirinci jujur di Bagian 5).

---

## 1. Status Tahap V-1 (`usulan-voice-persona-karakter-preset.md`)

- **File lokal:** `public/mockup_dialog_karakter.html`
- **Akses HTTP Staging:** `http://100.95.245.55:5010/mockup_dialog_karakter.html` (terverifikasi HTTP `200`)
- **Cakupan simulasi di mockup:**
  - Switch Light / Dark Mode berbasis semantic CSS tokens (`app/theme.css`, tanpa warna hardcoded ad-hoc pada komponen UI).
  - Tab **Preset Video**: switch **Dialog karakter** (menampilkan/menyembunyikan kotak **Pemeran & Suara** beserta keterangan ke **Audio Segment** lama), 4 kartu gaya bicara, pemilihan penyedia suara (`ElevenLabs`, `MiniMax`, `Gemini`) yang menjaga pasangan voice per penyedia, daftar pemeran Kawan Rumah (`si_wajan`, `sponge`, `sapu`), tombol **▶ Contoh** dengan penanda cache sementara, lipatan **Lanjutan**, muat dari Universe, salin preset lain, dan simulasi peringatan karakter belum terhubung (`kulkas`).
  - Tab **Identitas Visual**: tampilan daftar karakter terhubung beserta status acuan dan badge `Nano Banana Pro`.
- **Status kelanjutan:** Sesuai instruksi, implementasi kode React (`V-2` s/d `V-5`) **belum dikerjakan** sampai mockup ini disetujui.

---

## 2. Pengecekan Nama Tampilan ↔ ID Model G-Labs (Langkah 1)

- **Definisi di Codebase (`sot/global/WEBHOOK_INTEGRATION.en.md` & `lib/webhook-client.js`):**
  - Hanya 3 ID model gambar yang dikenal:
    1. `nano_banana_pro` → *Nano Banana Pro*
    2. `nano_banana_2` → *Nano Banana 2*
    3. `nano_banana_2_lite` → *Nano Banana 2 Lite*
  - Tidak ada ID `nano_banana_2_1`; ID di luar daftar otomatis jatuh ke `nano_banana_2`.
- **Probing Worker G-Labs Aktif (`http://100.64.70.61:8765`, `nuc-win01`):**
  - `/api/health`, `/api/tasks`, dan `/api/status/{id}` aktif merespons (`tasks_pending: 0`, `tasks_running: 0`, `uptime: 157826`).
  - `/api/models`, `/api/config`, dan `/api/version` mengembalikan `404`.
  - SSH ke host legacy `vibe-server` (`100.117.59.92:2222`) timeout dan agen tidak memiliki akses interaktif ke tampilan GUI desktop Windows tab Webhook. Karena itu, **teks label persis di UI Windows G-Labs (`"Nano Banana 2.1"` vs `"2.1 Lite"`) tidak dapat diverifikasi secara visual oleh agen**, namun API `nano_banana_pro` dan `nano_banana_2` terkonfirmasi aktif dan memproses job di `100.64.70.61:8765`.

---

## 3. Penjelasan Log: Part C `nano_banana_2` & Penyebab Konsistensi `#2183` `r1` (Langkah 2)

### A. Mengapa Part C tercatat `nano_banana_2` di Laporan Sebelumnya
- `lib/reference-asset-service.js` mengirim pembuatan asset acuan dengan `model: 'nano_banana_pro'`.
- Pemeriksaan log eksekusi (`transcript_full.jsonl` & `~/maknaflow-staging-atomic/shared/logs/staging-ui*.log` / `staging-api*.log`) menunjukkan **0** kejadian `[Webhook Client] Submission of nano_banana_pro failed` maupun `Retrying with fallback model nano_banana_2`.
- Ke-12 gambar acuan Part C (`ref_mwgijsy8_...` s/d `ref_mwginnm9_...`, task `8a97a38e` .. `f7debe4b`) selesai langsung di `provider_task_id` awalnya dengan **`nano_banana_pro`**.
- Kesimpulannya: **tidak terjadi fallback kuota pada Part C**; angka di bagian penutup `stage-gambar-karakter-report.md` salah menggabungkan 12 gambar Pro Part C ke baris `G-Labs (nano_banana_2)` bersama 5 Start Frame `#2183`.

### B. Akar Masalah Sebenarnya pada Baseline `#2183` `r1`
Pemeriksaan database Staging (`opc_start_frame_request_audits`) dan error log (`staging-ui.err.log` baris `4660–4674`, pukul `05:39:15–05:40:30 +07:00`) menemukan fakta bahwa **ke-5 klip `r1` dikirim tanpa satu pun gambar acuan karakter**:

```
[CharacterLock Warning] Reference image not found for character si_wajan at: /uploads/reference-assets/default_tenant/character/14bf5c57-8172-45d6-9612-dcc4817b3102/character_sheet/v3/aad470f88333eeca.jpg
```

Tabel `opc_start_frame_request_audits` untuk `r1`:

| Clip | Audit ID | Task ID | `requested_model` | `effective_model` | `reference_count` |
|---|---|---|---|---|---|
| 1 | `osfra_8ba6e96650304a178c75` | `fb3a5b8f` | `nano_banana_2` | `nano_banana_2` | **0** |
| 2 | `osfra_55b7898879a045ccb2a8` | `0c4342c1` | `nano_banana_2` | `nano_banana_2` | **0** |
| 3 | `osfra_24b852f75cff4b1aa1bb` | `61da52fe` | `nano_banana_2` | `nano_banana_2` | **0** |
| 4 | `osfra_d117faa3d3cc46e2b3ef` | `b9233274` | `nano_banana_2` | `nano_banana_2` | **0** |
| 5 | `osfra_10f5badefc264bdca1d1` | `8139af9b` | `nano_banana_2` | `nano_banana_2` | **0** |

**Penyebab teknis:** Di `lib/cartoon-reference-resolver.js`, fungsi `fileToBase64(filePath)` memeriksa `if (path.isAbsolute(filePath))` terlebih dahulu. Path publik web yang tersimpan di PostgreSQL dimulai dengan `/` (`/uploads/reference-assets/...`), yang memenuhi `path.isAbsolute() === true` di macOS/Linux. Akibatnya, kode hanya memeriksa `/uploads/...` di root OS (tidak pernah masuk ke cabang `else` yang memanggil `path.join(process.cwd(), 'public', ...)`), selalu mengembalikan `null`, dan membuat G-Labs merender `r1` murni dari teks tanpa acuan visual v3.

---

## 4. Implementasi Kode & Verifikasi (`v2.48.13` → `v2.48.14`) (Langkah 3)

Perubahan yang sudah dirilis ke `main` dan dideploy ke Staging (`v2.48.14`):

1. **Pemilihan Model Start Frame Dinamis (`lib/opc-start-frame-request.js`):**
   - `resolveOpcStartFrameModel` memilih `nano_banana_pro` bila campaign/VI berkarakter stylized 3D (`isStylized` / `isCartoonWorld`), multi-karakter (`voice_cast_json.characters >= 2` atau jumlah referensi karakter `>= 2`), atau memiliki `lineup_` reference; default campaign standar (faceless / DapurBotani) tetap `nano_banana_2`.
   - Mendukung `modelOverride` dan menyediakan `rebuildFingerprintForModel(actualModel)` agar `request_fingerprint` idempotensi selalu memakai model efektif aktual.
2. **Logging Fallback Per Klip & Audit Model Efektif (`lib/webhook-client.js`, `lib/opc-start-frame-audit.js`, `lib/start-frame-provider-adapter.js`, `lib/start-frame-worker.js`, `lib/scheduler-processors.js`):**
   - Melacak metadata fallback sinkron & asinkron per `taskId` (`taskFallbackInfoMap`, `getTaskModelInfo`), mencetak `[StartFrame Model] Clip <n> (item #<id>): ...` setiap klip, dan memperbarui `effective_model` + `request_fingerprint` di `opc_start_frame_request_audits` bila terjadi fallback kuota Pro → `nano_banana_2`.
3. **Perbaikan Resolver Gambar Acuan `fileToBase64()` (`lib/cartoon-reference-resolver.js`):**
   - Selalu mencoba fallback `<cwd>/public/<rel>` dan `<cwd>/<rel>` ketika path berawalan `/` bukan file OS absolut. Terverifikasi pada dry-run `#2183`: ke-5 klip naik dari `0` acuan menjadi **4 acuan JPEG** per klip:
     - `aad470f8...` (`461.869` bytes — Si Wajan v3)
     - `fc01be40...` (`490.662` bytes — Sponge v3)
     - `3beda6b3...` (`538.609` bytes — Sapu v3)
     - `09b876f8...` (`535.702` bytes — VI Lineup v3)
4. **Hasil Unit Test & Deploy Setelah Edit Terakhir:**
   - Unit test terarah (`node --test --test-force-exit` pada `tests/start-frame-model-selection.test.js`, `tests/stylized-3d-dialog-d0.test.js`, `tests/reference-asset-and-sidebar-d.test.js`, `tests/youtube-start-frame-model.test.js`, `tests/k7.1-fixes.test.js`, `tests/metaphor-policy-prompt.test.js`, `tests/opc-bridge-duration-zero.test.js`): **`33` test, `33` pass, `0` fail, `0` cancelled, `0` skipped**.
   - `node tests/test-cartoon-reference-url-resolver.mjs`: semua kasus lulus.
   - Staging `v2.48.14` aktif (`maknaflow-staging-ui`, `maknaflow-staging-api`, `maknaflow-staging-mcp` online; UI `/login` HTTP `200`, API `/health` HTTP `200`, `/mockup_dialog_karakter.html` HTTP `200`, `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`).

---

## 5. Uji A/B `#2183` (`opc_261115_0b9qkd`) Tanpa Render Video (Langkah 4)

Agar uji A/B tidak bias terhadap `r1` yang kemarin gagal melampirkan acuan karakter, pengujian dilakukan memakai **prompt `r1` yang persis sama + 4 acuan v3 yang sama (`reference_count: 4`)** pada Staging `v2.48.14`:
- **Batch `r2` (`origin: ab_test_pro_r2`):** `nano_banana_pro` (otomatis dari `resolveOpcStartFrameModel`).
- **Batch `r3` (`origin: ab_test_nb2_refs_r3`):** `nano_banana_2` (via `modelOverride: 'nano_banana_2'`).

File pembanding visual 3-kolom (`r1 2 tanpa ref` | `r3 2 + 4 ref` | `r2 Pro + 4 ref`):  
`file:///Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/ab_start_frame_2183_2_vs_pro.png`

### A. Ringkasan Eksekusi, Task ID, Audit, dan Waktu Tunggu

| Clip | `r2` (`nano_banana_pro` + 4 ref) | Waktu `r2` (Submit + Render = Total) | `r3` (`nano_banana_2` + 4 ref) | Waktu `r3` (Submit + Render = Total) |
|---|---|---|---|---|
| **1** | `27fc1ee0` (`completed`, 0 fallback) | `3.5s + 84.8s = 88.3s` | `f681cfde` (`completed`, 0 fallback) | `5.7s + 85.2s = 90.9s` |
| **2** | `f06bdc35` (`completed`, 0 fallback) | `13.7s + 81.3s = 95.0s` | `a43dff1b` (`completed`, 0 fallback) | `10.6s + 92.8s = 103.4s` |
| **3** | `7bac41fc` (`completed`, 0 fallback) | `12.4s + 84.6s = 97.0s` | `993e5425` (`completed`, 0 fallback) | `21.2s + 93.4s = 114.6s` |
| **4** | `10fd103f` (`completed`, 0 fallback) | `18.4s + 81.2s = 99.7s` | `c6a0c844` (`completed`, 0 fallback) | `10.4s + 80.8s = 91.2s` |
| **5** | `4b93031c` (`completed`, 0 fallback) | `15.4s + 84.9s = 100.4s` | `d34611fe` (`failed`: `403 PUBLIC_ERROR_USER_MINOR`) | `10.6s + 8.1s = 18.7s` |

- **Kuota Pro & Fallback:** Seluruh 5/5 klip `r2` memakai `requested_model = effective_model = nano_banana_pro` dengan **0 fallback kuota ke `nano_banana_2`**. (Endpoint `/api/health` G-Labs tidak menampilkan sisa angka kuota harian Pro.)
- **Status Keamanan DB `#2183`:** Campaign `opc_261115_0b9qkd` tetap `status='paused'`, `scheduler_pause_at='visuals'`; item `#2183` tetap `visual_status='pending'` dan `visual_tasks_json=null` (0 render Veo).

### B. Penilaian Visual Jujur per Klip (Menggunakan 3 Kriteria Review Anda + Konsistensi V3)

Kriteria acuan dari review `stage-gambar-karakter-report.md`:
1. **Sapu:** gagang berwarna **sage-green** (bukan cokelat seperti di `r1` Klip 1 & 4) dan **posisi tegak** (bukan terbalik seperti di `r1` Klip 5), tanpa anatomi rusak.
2. **Si Wajan:** teflon **bulat pipih hitam matte** + gagang terakota (bukan wok dalam seperti di `r1` Klip 4).
3. **Anti-duplikat:** tidak ada karakter kembar/tambahan berwajah (seperti wajan berwajah kedua di `r1` Klip 3).

| Klip | `r1`: `nano_banana_2` (0 ref — bug lama) | `r3`: `nano_banana_2` (+4 ref v3) | `r2`: `nano_banana_pro` (+4 ref v3) |
|---|---|---|---|
| **Clip 1** | ❌ Sapu gagang **cokelat** | ⚠️ **Cukup** — Wajan hitam pipih & Sponge tepat. Sapu bergagang sage-green, **tetapi batang gagangnya tampak membelah/menembus bagian tengah sapu** | ✅ **LULUS** — Ketiga karakter proporsional: Wajan hitam pipih gagang terakota, Sponge kuning/hijau, Sapu tegak gagang sage-green persis v3, 0 duplikat |
| **Clip 2** | ✅ Relatif baik | ✅ **LULUS** — Wajan hitam pipih di sink, Sponge kuning/hijau, Sapu tegak gagang sage-green + ijuk tali ganda sangat persis sheet v3, 0 duplikat | ❌ **GAGAL** — Wajan berubah jadi **panci berwarna tembaga/cokelat di atas nyala api kompor biru**, dan Sapu berubah menjadi **sapu tutup plastik abu dengan gagang kayu cokelat** |
| **Clip 3** | ❌ Ada wajan berwajah ekstra di belakang | ✅ **LULUS** — Sponge kuning/hijau, Sapu tegak gagang sage-green persis v3, hanya ada 1 Si Wajan di belakang (0 duplikat) | ⚠️ **PARTIAL** — Wajah Sponge & Sapu baik dan 0 duplikat, **namun batang gagang sage-green Sapu kembali menonjol keluar dari bagian bawah ijuk** |
| **Clip 4** | ❌ Si Wajan jadi **wok dalam**, Sapu gagang **cokelat** | ✅ **LULUS** — Si Wajan **bulat pipih** persis v3 (bukan wok), Sponge kuning/hijau tepat, Sapu bergagang **sage-green** tegak, 0 duplikat | ⚠️ **PARTIAL** — Si Wajan bulat pipih akurat (bukan wok) dan 0 duplikat, **namun warna Sponge terbalik** (wajah tampil di sisi scrub hijau sehingga hampir seluruh badan Sponge hijau) |
| **Clip 5** | ❌ Sapu **terbalik** (ijuk di atas, gagang di bawah) | ❌ **GAGAL (`403 PUBLIC_ERROR_USER_MINOR`)** — Diblokir filter safety G-Labs pada attempt 1 | ❌ **GAGAL** — Wajan & Sponge baik dan Sapu tegak bergagang sage-green, **tetapi Sapu mengalami halusinasi 3 wajah bertumpuk** (wajah kecil di ujung gagang, di cap hijau, dan di ijuk) |

---

## 6. Kesimpulan & Dua Keputusan yang Diperlukan (Langkah 5)

1. **Perbaikan terbesar datang dari bugfix `fileToBase64`**, yang membuat ke-4 gambar acuan v3 benar-benar terkirim (`reference_count: 4`). Saat menerima 4 acuan yang sama:
   - **`nano_banana_2` (+4 ref)** justru lebih setia menjaga bentuk & warna karakter v3 pada **Clip 2, 3, dan 4**, tetapi terganggu di **Clip 1** (gagang Sapu terbelah) dan terkena false-positive **403 `PUBLIC_ERROR_USER_MINOR`** di **Clip 5** pada attempt pertama.
   - **`nano_banana_pro` (+4 ref)** lolos semua **5/5 klip** tanpa 403 (`81.2s–84.9s`/klip) dan unggul di **Clip 1**, **namun masih mengalami drift serius di Clip 2, 3, 4, dan 5** (Wajan tembaga di atas api, gagang kayu cokelat, gagang menembus bawah ijuk, Sponge hijau terbalik, serta 3 wajah pada Sapu). Kemungkinan besar penyebabnya adalah pengiriman **character sheet multi-pose/multi-wajah** (`Si Wajan`, `Sponge`, `Sapu`, `VI Lineup` yang berisi banyak grid wajah) ke G-Labs sekaligus dalam satu call sehingga model meniru wajah ekstra atau sudut pandang acak dari lembar grid tersebut.

### Mohon Konfirmasi Anda:
1. **Mockup V-1** (`http://100.95.245.55:5010/mockup_dialog_karakter.html`): apakah desain & alur interaksinya sudah disetujui untuk lanjut ke implementasi kode **V-2 s/d V-5**?
2. **Kebijakan Model Default Start Frame Karakter (`usulan-model-gambar-glabs.md`):** melihat hasil A/B nyata di atas, apakah Anda ingin:
   - **(Opsi A)** Mempertahankan `nano_banana_pro` sebagai default Start Frame karakter sambil merapikan gambar acuan (misalnya 1 pose depan bersih alih-alih sheet multi-wajah untuk Start Frame), **atau**
   - **(Opsi B)** Mengembalikan default Start Frame ke `nano_banana_2` (karena bug `fileToBase64` sudah teratasi + `r3` Clips 2–4 jauh lebih patuh pada warna/bentuk, dengan mengandalkan retry worker untuk 403 sesekali) dan memfokuskan `nano_banana_pro` pada pembuatan Character Sheet + kasus tertentu via `modelOverride`?

