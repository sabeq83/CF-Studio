# Analisa & Usulan Perbaikan: VO Klip 6 Kosong & Tetap Error MiniMax `empty field (code: 2013)` Setelah Disimpan (`mul_261123_qrz4yq`)

Tanggal: 23 November 2026  
Kasus: Kampanye Multiplier `mul_261123_qrz4yq` di server Staging (`schema: staging`, tabel `re_multiplier_tasks`)  
Error: `MiniMax API error: invalid params, empty field (code: 2013)` pada adegan 6 dari 6

---

## 1. Hasil Investigasi Data `mul_261123_qrz4yq` di Staging DB

Hasil pembacaan langsung tabel `staging.re_multiplier_tasks` untuk `id = 'mul_261123_qrz4yq'` menunjukkan fakta berikut:

1. **Di kolom `original_voiceover` dan `tiktok_safe_voiceover`:**
   - Adegan 1–5 menggunakan key `"narration_transcript"`.
   - Khusus **adegan 6** (`scene: 6`), Gemini AI menghasilkan JSON dengan key typo **`"narrating_transcript"`** (bukan `"narration_transcript"`):
     ```json
     {
       "scene": 6,
       "location_en": "Cozy home kitchen tabletop during afternoon hours",
       "visual_description": "...",
       "narrating_transcript": "Yuk cobain bikin camilan sehat ini sekarang juga dan nikmati enaknya cokelat murni."
     }
     ```
2. **Di kolom `remake_storyboard_json`:**
   - Setelah Anda mengisi VO klip 6 di UI dan menekan Simpan, teks baru Anda **sebenarnya sudah masuk ke database** pada key `"narration"`:
     ```json
     {
       "scene": 6,
       "narrating_transcript": "Yuk cobain bikin camilan sehat ini sekarang juga dan nikmati enaknya cokelat murni.",
       "narration": "Buruan dicoba, produk ori ada di keranjang ya!"
     }
     ```
   - Namun key `"narration_transcript"` tetap **tidak ada** pada item adegan 6.

---

## 2. Dua Akar Masalah di Codebase

### A. Kenapa VO Klip 6 Awalnya Tampil Kosong di UI & Gagal di Worker?
1. **Gemini sesekali menghasilkan variasi/typo key (`narrating_transcript`):**
   - `sanitizeVoiceoverItems()` (`lib/tts-text-sanitizer.js`) dan `remaking` handler (`lib/re-multiplier-worker.js` baris `630`) belum menormalisasi key alias/typo AI (seperti `narrating_transcript`, `voice_over`, `voiceover`, `narration`, `narration_text`, `script`) menjadi key kanonik `narration_transcript` + `narration`.
2. **UI & Worker tidak mengenali `narrating_transcript`:**
   - `app/multiplier-lab/[id]/page.js` baris `290` hanya membaca `scene.narration_transcript || scene.voiceover || scene.narration || ''`, sehingga VO adegan 6 tampak kosong di editor.
   - `handleAudioGeneration` di `lib/re-multiplier-worker.js` baris `1107` hanya membaca `storyboard[c].narration_transcript || storyboard[c].voiceover || ''`, sehingga mengirim string kosong `""` ke MiniMax TTS dan gagal dengan `code: 2013`.

### B. Kenapa Setelah Diisi & Disimpan di UI Tetap Error `empty field (code: 2013)`?
Ada **ketidakcocokan nama field antara UI/API Simpan vs Worker TTS**:
1. **UI Editor (`app/multiplier-lab/[id]/page.js` baris `1697`):**
   Saat pengguna mengetik di kotak VO, state yang diubah **hanya** `updated[cidx].narration = e.target.value` (tidak memperbarui `narration_transcript` maupun `voiceover`).
2. **API Simpan (`app/api/v2/multiplier/[id]/update-creative/route.js` baris `57`):**
   `POST /api/v2/multiplier/[id]/update-creative` langsung menyimpan array `storyboard` dari UI ke `remake_storyboard_json` tanpa menyinkronkan `narration` ke `narration_transcript` (dan tanpa memvalidasi bila ada klip yang VO-nya kosong saat TTS aktif).
3. **Worker TTS (`lib/re-multiplier-worker.js` baris `1107`):**
   Saat tombol Retry TTS dijalankan, `handleAudioGeneration` membaca:
   ```js
   const rawText = storyboard[c].narration_transcript || storyboard[c].voiceover || '';
   ```
   **Key `.narration` (hasil editan user) sama sekali tidak dibaca!** Akibatnya nilai `rawText` tetap `''`, sehingga MiniMax kembali mengembalikan `invalid params, empty field (code: 2013)`.
4. **Titik lain di `lib/re-multiplier-worker.js` yang juga tidak membaca `.narration` / `.voice_over`:**
   - Baris `1063`: pre-TTS herbal/medical claim filter (`c.narration_transcript || c.voiceover || c.voice_over || ''` — tidak cek `c.narration`).
   - Baris `1290`: Native Veo prompt (`storyboard[c - 1]?.narration_transcript || storyboard[c - 1]?.voiceover || ''` — tidak cek `.narration`).
   - Baris `1631`: Export Markdown (`scene.narration_transcript || scene.voiceover || ''` — tidak cek `.narration`).

---

## 3. Usulan Perbaikan

### Paket 1 — Perbaikan Menyeluruh di Codebase (Hotfix)

1. **Buat Helper Tunggal Ekstraksi & Normalisasi VO Adegan (mis. di `lib/tts-text-sanitizer.js`)**
   - `extractSceneVoText(scene)`: membaca secara berurutan `narration`, `narration_transcript`, `narrating_transcript`, `voiceover`, `voice_over`, `narration_text`, `vo_text`, `script` (yang tidak kosong setelah `.trim()`).
     - Catatan urutan: untuk `update-creative` / hasil edit user, `narration` diutamakan atau disinkronkan saat save agar editan UI selalu menang atas nilai AI lama.
   - `normalizeStoryboardVoFields(storyboard)`: menormalisasi setiap item storyboard agar selalu memiliki `narration_transcript` dan `narration` yang terisi sinkron, serta membersihkan key typo seperti `narrating_transcript`.

2. **Normalisasi Saat Parsing Output Gemini (`lib/re-multiplier-worker.js` baris `630`)**
   - Jalankan normalisasi VO pada `parsed.storyboard` tepat sebelum audit TikTok / penyimpanan ke `remake_storyboard_json`, `original_voiceover`, dan `tiktok_safe_voiceover`.
   - Jika masih ada adegan yang benar-benar kosong VO-nya padahal TTS aktif, tandai status `waiting_approval` dengan pesan jelas (alih-alih lolos ke antrean TTS dan gagal di MiniMax).

3. **Sinkronisasi Field Saat Simpan di UI & API (`app/multiplier-lab/[id]/page.js` & `app/api/v2/multiplier/[id]/update-creative/route.js`)**
   - Di UI (`page.js` baris `290` & `1697`): baca melalui helper alias (termasuk `narrating_transcript` untuk data lama), dan saat textarea diubah, perbarui `narration` sekaligus `narration_transcript` (serta `voiceover` jika ada).
   - Di `update-creative/route.js`: sebelum menyimpan `remake_storyboard_json`, sinkronkan `narration` ↔ `narration_transcript` pada setiap item storyboard (memprioritaskan nilai `narration` terbaru dari UI bila berbeda).

4. **Gunakan Helper VO Konsisten di Seluruh Worker (`lib/re-multiplier-worker.js`)**
   - Ganti pembacaan VO di:
     - Baris `1063` (pre-TTS claim check)
     - Baris `1107` (`handleAudioGeneration` TTS)
     - Baris `1290` (Native Veo prompt)
     - Baris `1631` (Export Markdown)
   - Tambahan guard di `handleAudioGeneration` sebelum memanggil `generateMinimaxVO`: jika `text.trim() === ''`, lempar error lokal yang informatif (*"Naskah voiceover adegan ke-N kosong. Silakan isi VO pada adegan tersebut lalu simpan dan retry TTS."*) tanpa membuang call ke API MiniMax.

5. **Unit Test Regresi**
   - Tambah test di `tests/` untuk memastikan:
     - Typo key `narrating_transcript` dari Gemini otomatis ternormalisasi ke `narration_transcript` & `narration`.
     - Payload editan UI yang hanya mengubah `scene.narration` terbaca oleh TTS worker & tersinkron oleh `update-creative`.

### Paket 2 — Pemulihan Cepat Data `mul_261123_qrz4yq` di Staging (Opsional, Atas Persetujuan)
- Karena editan Anda (`"Buruan dicoba, produk ori ada di keranjang ya!"`) sudah tersimpan di `remake_storyboard_json` scene 6 pada key `"narration"`, kampanye `mul_261123_qrz4yq` bisa langsung dipulihkan dengan menyalin nilai `narration` scene 6 ke `narration_transcript` di DB Staging lalu mengulang stage `tts` (`POST /api/v2/multiplier/mul_261123_qrz4yq/retry` dengan `stage: 'tts'`).
