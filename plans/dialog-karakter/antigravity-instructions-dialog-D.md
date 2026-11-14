# Instruksi Antigravity — Dialog Karakter (Cara D: TTS Multi-Suara)

> Tanggal: 2026-11-14 · Penulis: Claude (reviewer) · Eksekutor: Antigravity
> Dasar: `/Users/sabeqmmursyid/Documents/Shopee Aff/usulan_dialog_karakter_C_D.md` (ditulis @ v2.48.1) + cek ulang reviewer di kode **v2.48.3** (438d1d7).
> Tujuan pengguna: karakter di video CF Studio bisa **berbicara/berdialog** (akun Kawan Rumah, Diary Babu Kucing, Skin World), bukan hanya narator.
> Lingkup: **Staging saja.** Jangan deploy ke production.
> Cara C (suara native Veo) **tidak** dikerjakan di instruksi ini. Hanya catatan di Bagian 6.

---

## 0. Koreksi & tambahan reviewer atas usulan

| # | Poin | Status di v2.48.3 |
|---|---|---|
| R-1 | **C-3 (mode `native_veo` melewati gerbang klaim)** | **Sebagian tertutup oleh K7.1-C.** Gerbang `rewriteViolatingVoSentences` kini jalan di tahap storyboard OPC/Pillar (`scheduler-processors.js` ±6060–6130), **sebelum** TTS dilewati. Belum dicek: engine lain (RE/Strategic/Recipe/Multiplier) dalam mode native. |
| R-2 | **Baru — teks dialog lolos dari penulis ulang** | `rewriteViolatingVoSentences` (`lib/tiktok-compliance-service.js` ±820–840) hanya membaca dan memperbaiki `narration`. Jalur TTS dialog membaca `voice_segments[].text`. Akibatnya kalimat klaim yang sudah "diperbaiki" di narasi **tetap diucapkan karakter**. **Wajib diperbaiki (D-0a).** |
| R-3 | **Baru — skincare tidak diperiksa** | `findVoClaimViolations` hanya aktif bila `resolveIsHerbalOrHealthTarget` = true. Klaim skincare/kosmetik (menghilangkan jerawat, memutihkan, menyembuhkan eksim, dst.) belum punya daftar. **Wajib sebelum Skin World (D-0b).** |
| R-4 | **Baru — wujud karakter harus konsisten** | Suara terkunci tetapi wujud maskot berubah tiap klip = penonton tidak merasa itu karakter yang sama. Perlu referensi gambar karakter per akun (D-7). |
| R-5 | Jalur TTS dialog hanya aktif bila `voice_segments.length > 1` | Klip dengan 1 giliran (monolog Oyen) jatuh ke TTS tunggal yang membaca `narration` berlabel `"[OYEN]: …"`. Ini memperkuat urgensi D-5. |

---

## 1. Urutan kerja
1. **D-0a + D-0b** (pengaman klaim): wajib sebelum uji apa pun pada produk kesehatan/skincare.
2. **Uji D-0 Kawan Rumah** (fitur yang sudah ada). **Berhenti dan lapor** agar pengguna menilai apakah dialog enak ditonton, sebelum lanjut ke perbaikan besar.
3. Setelah pengguna setuju: D-1 → D-2 → D-3 → D-5 → D-4/D-6 → D-8 → D-7 → tes D-9.
4. Uji D-1 (Oyen + Dropy), lalu lapor.
5. Panel: tambahkan saklar dialog ke **🧪 Fitur Eksperimen** (Bagian 5).

---

## 2. Pengaman klaim (wajib dulu)

### D-0a — Penulis ulang ikut memperbaiki teks dialog
- `rewriteViolatingVoSentences` memeriksa **narasi dan setiap `voice_segments[].text`**.
- Bila satu segmen ditulis ulang, `narration` gabungan dibangun ulang dari segmen (sumber kebenaran = segmen), dan sebaliknya. Keduanya tidak boleh berbeda isi.
- Gerbang pre-TTS (`scheduler-processors.js` ±7285–7310) juga memeriksa gabungan teks segmen, bukan hanya `narration`.
- Pemeriksaan memakai **teks tanpa label** `[X]:` (lihat D-5).
- **Tes:** klip dengan segmen `"Jantungmu jadi kuat"` → setelah rewrite, segmen dan narasi bebas klaim. Bila tetap melanggar → `paused_compliance`.

### D-0b — Daftar klaim skincare/kosmetik
- Tambah pendeteksi target skincare, misalnya `resolveIsSkincareTarget`, dari kategori produk, brand, dan pillar (kata kunci: skincare, serum, toner, sunscreen, jerawat, kulit, wajah, kosmetik).
- Tambah daftar klaim terlarang skincare (gaya BPOM kosmetik), termasuk akhiran `-mu/-nya/-ku`:
  - menghilangkan/menyembuhkan jerawat, eksim, flek, bekas luka;
  - memutihkan permanen;
  - kata medis: obat, terapi, dermatitis, infeksi, antibiotik;
  - menumbuhkan kolagen, menghilangkan kerutan permanen, hasil instan dalam X hari.
- Kalimat **aman** tetap lolos: "membantu kulit tampak lebih cerah", "melembapkan", "bantu merawat", "kulit terasa lebih halus".
- Pakai mekanisme yang sama: rewrite 1× → blokir bila gagal.
- **Tes positif dan negatif** untuk kedua daftar.

### R-1 — Cek engine lain
Laporkan engine mana saja yang bisa memakai `audio_engine_mode = native_veo`, dan apakah semuanya melewati gerbang klaim. Cukup dilaporkan, jangan diubah dulu.

---

## 3. Uji D-0 — Kawan Rumah (tanpa perubahan fitur dialog)
- **Tenant/akun:** Kawan Rumah di staging. Bila belum ada brand/VI, buat seminimal mungkin dan catat di laporan.
- **Pengaturan:**
  - preset engagement;
  - `enable_audio_segment = 1`;
  - `clip_duration = 8`;
  - 4–6 klip;
  - TTS Minimax.
- **`voice_cast_json` campaign** (lewat API): `si_wajan` (utama), `sapu`, `kulkas`, `sponge`.
  - Pilih `minimax_voice_id` yang berbeda jelas: watak, usia, dan gender sesuai karakter.
  - Kirim **sampel suara 3–5 detik per karakter** ke pengguna di laporan agar pengguna ikut memilih.
- **Pipeline penuh** (TTS, G-Labs, FFmpeg). Social post **mati**.
- 2–3 item.
- **Cek dan laporkan:**
  1. Dialog bergantian dengan benar?
  2. Suara tiap karakter sama di semua klip?
  3. Ada label `[X]:` yang terucap?
  4. Ada giliran bicara yang terpotong atau menempel?
  5. Gerak mulut/gestur mengganggu?
  6. Wujud karakter (wajan, sapu, dll.) konsisten antarklip?
  7. Jumlah panggilan Gemini per video.
- **Berhenti, kirim tautan video + ringkasan bahasa sederhana. Tunggu penilaian pengguna.**

---

## 4. Perbaikan D (setelah pengguna setuju hasil D-0)

| # | Yang dikerjakan | Detail |
|---|---|---|
| **D-1** | Gaya dialog fleksibel | Tambah `dialogue_style`: `character_monolog` · `duet` · `ensemble` · `hybrid`. Aturan "tepat 2 karakter, monolog dilarang" (prompts.js ±1049/1064/1384/2187/2202) **hanya** untuk `duet`/`ensemble`. `voice_segments` boleh 1–3 giliran. `hybrid` = mayoritas monolog karakter utama dengan maks 1–2 klip berisi balasan. |
| **D-2** | Saklar terpisah | Flag baru `dialogue_mode` (off/on) per campaign/preset. `enable_audio_segment` lama tetap berfungsi seperti sekarang (kompatibilitas). Dialog tidak harus mematikan batch TTS Gemini bila provider Minimax. |
| **D-3** | Daftar pemeran tetap | `voice_cast_json` bisa disimpan di **preset** dan/atau **VI**. Campaign mewarisi bila kosong. AI hanya boleh memakai `character_id` dari cast. Validasi seperti `validateAllowedSpeakers` (YouTube Studio); karakter karangan ditolak/diganti. Varian OTONOM (AI mengarang 3–4 karakter) tidak dipakai bila cast ada. Pemilihan suara bergiliran (`minimax-tts.js` ±395) hanya fallback terakhir. |
| **D-5** | Label tidak terucap | Hapus `[X]:` sebelum TTS tunggal, audit VO, regex klaim, dan motion text. Subtitle boleh menampilkan nama/warna pembicara (opsional, default mati). Monolog 1 giliran tetap memakai suara karakter dari cast, **bukan** suara narator default. |
| **D-4** | Waktu bicara cukup | Mode dialog: default klip 8 detik. Batas kata dihitung per giliran (≈ 2,3 kata/detik, Indonesia). Validasi: segmen terlalu panjang → dipendekkan saat storyboard. |
| **D-6** | Jeda antargiliran | Sisipkan hening 150–250 ms saat `concat` segmen. |
| **D-8** | Tanpa lip-sync palsu | Hapus `LIP SYNC: ON` (prompts.js ±2160) untuk jalur TTS. Pakai tata bahasa YouTube Studio Stage D: pembicara = gestur/gerak halus, pendengar = reaksi, sudut OTS/reaction shot. Objek tanpa mulut (sapu, kulkas) boleh "bergoyang/bergetar" saat bicara. |
| **D-7** | Wujud karakter konsisten | Simpan **gambar referensi per karakter** di VI (mis. `character_refs: [{id, image_path, visual_desc}]`). Kirim sebagai referensi saat start frame klip yang menampilkan karakter itu (mirip W-REF K7). Batch QC menambah cek `character_consistent_all_clips`. |
| **D-9** | Tes jalur Scene Director | Tes: `planner_scene_director = on` + `dialogue_mode = on` → `voice_segments` tetap terbentuk dan lolos D-0a. |

**Tes unit minimal:**
- `character_monolog` → 1 giliran per klip dan tidak ditolak.
- `duet` → 2 giliran.
- Karakter di luar cast → ditolak.
- Label tidak muncul di input TTS.
- Jeda tersisip.
- D-0a dan D-0b positif/negatif.
- Regresi `enable_audio_segment` lama.

---

## 5. Panel Fitur Eksperimen
Tambahkan kartu **"E. Dialog Karakter"** di tab 🧪 Fitur Eksperimen, mengikuti aturan panel yang sudah disetujui (bahasa sederhana, tanpa nama teknis, semantic CSS token):

| Fitur | Pilihan | Penjelasan untuk pengguna |
|---|---|---|
| Dialog karakter | Mati / Nyala | "Karakter di video berbicara dengan suara masing-masing, bukan narator." |
| Gaya bicara | Bicara sendiri / Berdua / Ramai-ramai / Campuran | "Bicara sendiri cocok untuk diary; Ramai-ramai untuk barang-barang yang saling curhat." |
| Daftar pemeran | Tautan ke VI/preset | "Atur nama karakter dan suaranya di Identitas Visual." |

Mockup HTML dulu (SOP), sinkronkan ke staging, lalu tunggu persetujuan.

---

## 6. Cara C (catatan saja, belum dikerjakan)
Dikerjakan nanti setelah D berjalan, dengan syarat:
- C-1: prompt suara per pembicara, memakai ulang `compileNativeSceneAudioPrompt`;
- R-1: semua engine native lolos gerbang klaim;
- smoke test C-4: G-Labs `omni_flash`/`veo_31_lite` benar-benar menghasilkan ucapan bahasa Indonesia;
- C-2: suara konsisten ≥ 5/6 klip.

---

## 7. Kriteria lolos (Uji D-1: Oyen `hybrid`, Dropy `hybrid`, Kawan Rumah `ensemble`, 3 item per akun)
| Kriteria | Target |
|---|---|
| Karakter sesuai cast, tanpa karakter karangan | 100% segmen |
| Suara tiap karakter sama di semua klip | 100% |
| Label `[X]:` terucap | 0 kasus |
| Ucapan terpotong | ≤ 5% giliran |
| Oyen/Dropy tidak dipaksa berdialog tiap klip | 100% item |
| Naskah dan teks dialog lolos klaim (herbal + skincare) | 100% |
| Wujud karakter konsisten antarklip | ≥ 5/6 klip per video |
| Panggilan Gemini per video | Dilaporkan (target ≈ 2–3) |

## 8. Laporan & rilis
- Tes unit + `DISABLE_AUTO_MIGRATIONS=true npm run build` harus lulus.
- Rilis patch/minor via `npm run release-non-interactive`. Deploy **staging saja**, dengan SHA lengkap.
- Laporan:
  - Uji D-0: `plans/dialog-karakter/stage-d0-kawan-rumah-report.md`;
  - Uji D-1: `plans/dialog-karakter/stage-d1-report.md`;
  - masing-masing dengan tautan video, sampel suara per karakter, contact sheet, contoh dialog, hitungan panggilan Gemini, dan ringkasan bahasa sederhana.
- Kembalikan flag staging ke kondisi semula setelah uji.
