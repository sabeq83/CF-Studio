# Analisa & Usulan Perbaikan: Penampakan Wajah pada Kampanye Multiplier Faceless (`mul_261125_78w443` / `syd_admin`)

**Tanggal:** 25 November 2026  
**Basis Pemeriksaan:** Database PostgreSQL `staging` (`re_multiplier_tasks`, `visual_identity_presets`), log Staging, serta audit kode [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [lib/visual-override-resolver.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-override-resolver.js), [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js), [lib/webhook-client.js](file:///Users/sabeqmmursyid/_cfstudio/lib/webhook-client.js), dan [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js).

---

## 1. Jawaban Singkat

**Ya, salah satu pemicu utamanya berasal dari konfigurasi `camera` pada VI (`vi_mwvkcoc3_24215939`) yang diterjemahkan keliru oleh `opticsFromVI` di `buildMultiplierPhase2Prompt`, diperparah oleh terhapusnya klausa negasi anti-wajah oleh `sanitizeImagePrompt` sebelum dikirim ke G-Labs.**

Pada `mul_261125_78w443`:
- Penguncian warna baju (`Warm Sand Beige` di semua klip 2–6) dan audio+motion text (`ffmpeg_muxing`) **sudah berhasil**.
- Namun di seluruh klip live-action (`scene` 2, 3, 4, 5, 6), baris paling awal `[LAYER 1: OPTICS]` pada `t2i_prompt` tertulis:  
  `(Angle: eye-level medium shot showing the room context), (Lens: natural 50mm, shallow depth of field)`

---

## 2. 4 Akar Masalah di Data & Kode

1. **`camera` di VI `vi_mwvkcoc3_24215939` + bug `opticsFromVI` ([lib/prompts.js:4357-4363](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L4357-L4363)):**
   - VI `vi_mwvkcoc3_24215939` disetel `camera.framing = "forearms_and_hands"`, `camera.perspective = "third_person"`, dan `environment.policy = "planner_driven"`.
   - `buildMultiplierPhase2Prompt` hanya memeriksa `cam.framing === 'hands_closeup'`. Semua nilai `framing` lain — termasuk `"forearms_and_hands"` — jatuh ke cabang `: 'eye-level medium shot showing the room context'`.
   - **`eye-level medium shot`** adalah bidikan setinggi mata manusia dengan komposisi medium (pinggang ke atas) demi menampakkan latar ruangan. Digabung dengan `third_person` dan aksi seperti Klip 6 (`"Male hand lifting tea glass in a cheerful toast next to Nutrifarm jar"`), T2I (`nano_banana_pro`) dan Veo I2V memunculkan kepala dan wajah pria tersebut.

2. **`sanitizeImagePrompt` ([lib/webhook-client.js:248-274](file:///Users/sabeqmmursyid/_cfstudio/lib/webhook-client.js#L248-L274)) menghapus klausa negasi & sebagian kalimat `strictly`:**
   - `--no ...`, `NEGATIVE PROMPT:`, dan `omitting the face, head, neck, chest, and shoulders` seluruhnya dihapus sebelum prompt dikirim ke G-Labs.
   - Regex `/,?\s*strictly\s+\w+\s+\w+/gi` (baris 269) juga memotong kata pengunci dari `(Anchor: ...)`: `"strictly on male"`, `"strictly on young"`, dan `"Strictly male hands"`.
   - Akibatnya, `(Angle: eye-level medium shot showing the room context)` mendominasi prompt yang diterima G-Labs tanpa crop-lock positif yang kuat.

3. **Prompt I2V/T2I belum menyertakan positive framing lock yang kebal sanitizer:**
   - Berbeda dari `appendUnbrandedPrepTag` (`lib/bridging/non-bridging-prompt-sanitizer.js`), [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js) dan `handleVisualGeneration` ([lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)) belum menyuntikkan positive crop lock (mis. `chest-down close-up composition cropped below collarbones ...`) maupun menetralkan kata pemicu wajah seperti `in a cheerful toast`.

4. **Multiplier belum terhubung ke Visual QC `visible_face` (`lib/start-frame-visual-qc.js`):**
   - Tenant `tnt_sy-dodot_4ba27b` belum menyalakan `start_frame_visual_qc`, dan `handleT2iGeneration` Multiplier belum memiliki gate QC wajah.

---

## 3. Ringkasan Usulan Perbaikan

1. **Perbaiki mapping `opticsFromVI` & aturan faceless di [lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js):**
   - Petakan `forearms_and_hands`, `crop_below_neck`, `perspective: 'first_person'`, serta semua mode faceless (`face_visibility !== 'allowed'`) ke sudut **angled-down chest-down tabletop close-up / first-person POV** (tidak pernah `eye-level medium shot`!), dengan tetap menjaga kontrak `hands_closeup` yang diuji oleh `tests/multiplier-location-per-clip.test.js`.
   - Tambahkan larangan aksi pemicu wajah (`cheerful toast`, `raising glass to face/camera`) pada `vsoSection` mode faceless.
2. **Suntikkan Positive Framing Lock (kebal `sanitizeImagePrompt` & `sanitizeI2vPrompt`) di [lib/multiplier-start-frame-request.js](file:///Users/sabeqmmursyid/_cfstudio/lib/multiplier-start-frame-request.js) & [lib/re-multiplier-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js):**
   - Ganti `eye-level medium shot ...` dan `in a cheerful toast` di level final request T2I & I2V, serta tambahkan positive framing lock tanpa kata `strictly`/`no`/`omitting`.
3. **Selaraskan `camera.perspective` pada VI `vi_mwvkcoc3_24215939`:**
   - Ubah `camera.perspective` dari `"third_person"` menjadi **`"first_person"`** agar selaras dengan `subject.faceless_mode: "hands_only"` dan `subject.custom_description` (*POV close-up framing*).
