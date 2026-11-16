# Usulan & Analisa: Ekstraksi Resep Lengkap pada Caption Video Multiplier dengan Kontrol ON/OFF (`resep-multiplier`)

Dokumen ini mendokumentasikan analisis komprehensif, spesifikasi naskah, alur data end-to-end, dan usulan arsitektur untuk melengkapi video Multiplier dengan **resep lengkap pada caption** (seperti pada pembuatan manual) yang dilengkapi **kontrol toggle switch ON/OFF** di seluruh titik masuk (*entry points*).

---

## 1. Ringkasan Eksekutif

| Aspek | Kondisi Saat Ini (Current State) | Usulan Target (Future State) |
| :--- | :--- | :--- |
| **Kontrol di Pembuatan Manual** | Sudah ada toggle switch `🍳 Ekstraksi Resep / Racikan` di `MultiplierConfigurationForm.js`. | Dipertahankan dan diselaraskan format naskahnya. |
| **Kontrol di 1-Klik Auto Pipeline** | **Belum ada toggle**. Parameter `generate_recipe` tidak dikirim (default `0`). | Ditambahkan toggle switch ON/OFF di boks konfigurasi Multiplier Tab 1. |
| **Kontrol di Modal Skedul Rutin** | **Belum ada toggle**. Skedul berkala Multiplier berjalan tanpa resep. | Ditambahkan toggle switch ON/OFF di form modal jadwal untuk `multiplier_campaign`. |
| **Kontrol di Modal Ingest Planner** | **Belum ada toggle** resep di `PillarConfigurationForm.js`. | Ditambahkan toggle switch ON/OFF saat ingest baris planner ke pipeline produksi. |
| **Autonomous Engine Backend** | `executeAutonomousMultiplierPipeline` belum menangkap `generate_recipe`. | Menangkap `generate_recipe` dan menyimpannya ke `re_multiplier_tasks` & `bridging_config_json`. |
| **Harmonisasi Caption AI** | Caption FB berfokus pada link Shopee, resep berpotensi terpotong jika tidak ditegaskan di prompt. | Prompt Gemini AI menjamin: **Resep Lengkap (Bahan, Takaran, Langkah, Tips) hadir utuh**, diikuti CTA Shopee FB / Link di Bio. |

---

## 2. Analisa Masalah & Kondisi Lapangan (Root Cause)

### A. Mengapa `mul_261108_s6so1p` Tidak Menghasilkan Resep di Caption?
1. Pada database PostgreSQL, record `mul_261108_s6so1p` memiliki nilai:
   ```json
   { "generate_recipe": 0, "bridging_config_json": { "generate_recipe": false } }
   ```
2. Task ini di-*generate* melalui alur otomatis/1-klik di mana UI `app/auto-pipeline/page.js` dan endpoint `app/api/v2/recipes/autonomous-pipeline/route.js` tidak menyertakan parameter `generate_recipe`.
3. Akibatnya, `lib/re-multiplier-worker.js` membaca `task.generate_recipe = 0` sehingga `isRecipeActive` di `lib/prompts.js` bernilai `false`, dan instruksi resep `getRecipeMandateSection` tidak diinjeksikan ke prompt Gemini AI.

---

## 3. Spesifikasi Naskah & Harmonisasi Format Caption

Caption yang bernilai retensi tinggi bagi audiens kuliner/kesehatan harus memisahkan secara estetik antara **edukasi resep** dan **rekomendasi produk**.

### A. Format Saat Kontrol Resep AKTIF (`generate_recipe: ON`)
```text
[🔥 HOOK & NARRATIVE OPENING]
Jam 4 sore emang paling rawan lapar mata di kantor. Daripada jajan sembarangan 
yang bikin lemas, yuk bikin camilan sehat tanpa terigu ini! Cuma 3 bahan utama, 
rasanya tetap legit dan pastinya ramah energi sore kamu. Simpan resepnya sekarang! ✨

🥣 BAHAN-BAHAN & TAKARAN:
- 2 buah pisang matang (lumatkan)
- 1 butir telur ayam
- 2 sdm cokelat bubuk murni (tanpa gula)
- Topping: Granola Timur Tengah / dark chocolate chunks secukupnya

👨‍🍳 LANGKAH PEMBUATAN:
1. Lumatkan pisang di dalam mangkuk sampai lembut merata.
2. Masukkan telur dan cokelat bubuk, aduk cepat hingga teksturnya kental dan creamy.
3. Tuang adonan ke wadah tahan panas, lalu beri taburan Granola Timur Tengah di atasnya.
4. Panggang di oven / air fryer pada suhu 160°C selama 12-15 menit hingga matang legit.

💡 TIPS & KHASIAT SEHAT:
Bebas gluten/terigu, kaya serat alami, menjaga energi tetap stabil tanpa lonjakan gula darah mendadak!

🛒 REKOMENDASI BAHAN/PRODUK RESMI:
(Khusus Facebook - Tautan Shopee Aktif):
Beli Granola Timur Tengah asli di Shopee resmi kami di sini:
https://s.shopee.co.id/3B6ZjV2A4J

(Khusus Non-FB / Instagram / TikTok / Shorts):
Bahan & produk rekomendasi (Granola Timur Tengah) yang mimin pakai bisa kamu cek di Link di Bio ya! ✨

#Shorts #CamilanSehat #ResepTanpaTerigu #BrowniesSehat #TipsKesehatan
```

### B. Format Saat Kontrol Resep NONAKTIF (`generate_recipe: OFF`)
Caption lebih ringkas, berfokus pada cerita, tips cepat, dan CTA:
```text
Jam 4 sore emang paling rawan lapar mata di kantor. Daripada jajan sembarangan 
yang bikin lemas, yuk bikin camilan sehat tanpa terigu ini! Cuma pakai pisang, 
telur, dan cokelat bubuk, rasanya tetap legit dan ramah energi. Simpan tipsnya! ✨

🛒 Rekomendasi Bahan/Produk Resmi:
Beli Granola Timur Tengah asli di Shopee resmi kami di sini:
https://s.shopee.co.id/3B6ZjV2A4J

#Shorts #CamilanSehat #ResepTanpaTerigu #BrowniesSehat #TipsKesehatan
```

---

## 4. Usulan Arsitektur & Perubahan Sistem

```
[ User Toggle: 🍳 Ekstraksi Resep Lengkap ]
   ├── Tab 1: 1-Klik Multiplier (instantGenerateRecipe: true/false)
   ├── Tab 2: Modal Skedul Autopipeline (schedGenerateRecipe: true/false)
   └── Modal Ingest Content Planner (ingestGenerateRecipe: true/false)
                         │
                         ▼
[ API: POST /api/v2/recipes/autonomous-pipeline ]
   └── Capture body.generate_recipe -> overrides.generate_recipe
                         │
                         ▼
[ Engine: lib/autonomous-engine.js (executeAutonomousMultiplierPipeline) ]
   ├── Simpan generate_recipe: 1 / 0 ke tabel re_multiplier_tasks
   └── Simpan bridgingConfig.generate_recipe: true / false
                         │
                         ▼
[ Worker: lib/re-multiplier-worker.js ]
   ├── bridging.generate_recipe = task.generate_recipe === 1
   └── Oper ke buildMultiplierPhase2Prompt
                         │
                         ▼
[ Prompt Gemini AI: lib/prompts.js ]
   ├── isRecipeActive: true -> Injeksi getRecipeMandateSection(true, 'id-ID')
   └── Output JSON: caption_facebook & caption_bio memuat (Resep Lengkap + Shopee/Bio CTA)
```

### Detail Modifikasi File:

1. **`app/auto-pipeline/page.js`**:
   - Tambahkan state `instantGenerateRecipe` (default `true` untuk brand kuliner/herbal).
   - Tambahkan UI switch toggle di boks Multiplier:
     ```jsx
     <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', ... }}>
       <input
         type="checkbox"
         id="instantRecipeCheck"
         checked={instantGenerateRecipe}
         onChange={e => setInstantGenerateRecipe(e.target.checked)}
       />
       <label htmlFor="instantRecipeCheck">
         🍳 Hasilkan Resep / Racikan Lengkap di Caption (Bahan, Takaran, & Langkah)
       </label>
     </div>
     ```
   - Tambahkan state `schedGenerateRecipe` pada form modal skedul rutin.
   - Kirim `generate_recipe: instantGenerateRecipe` saat tombol luncurkan ditekan.

2. **`app/api/v2/recipes/autonomous-pipeline/route.js`**:
   - Tangkap `body.generate_recipe` dan oper ke `executeAutonomousMultiplierPipeline({ overrides: { generate_recipe: ... } })`.

3. **`lib/autonomous-engine.js`**:
   - Pada `executeAutonomousMultiplierPipeline`, tentukan:
     ```javascript
     const effectiveGenerateRecipe = overrides.generate_recipe !== undefined
       ? (overrides.generate_recipe ? 1 : 0)
       : (presetConfig?.basic_strategy?.generate_recipe ? 1 : 0);
     ```
   - Masukkan `generate_recipe: effectiveGenerateRecipe` ke `createMultiplierTask` dan `bridgingConfig`.

4. **`lib/auto-pipeline-scheduler-runner.js`**:
   - Saat mengeksekusi `multiplier_campaign`, ambil `generate_recipe` dari `cfg.generate_recipe` dan teruskan ke overrides.

5. **`lib/prompts.js`**:
   - Perbarui petunjuk output JSON pada `buildMultiplierPhase2Prompt`:
     ```javascript
     caption_facebook: isRecipeActive 
       ? "Naskah caption lengkap memuat seluruh teks resep (Bahan, Takaran, Langkah 1-N, Tips) dan diakhiri CTA Shopee: '🛒 Rekomendasi Bahan/Produk Resmi:\nBeli bahan/produk asli di Shopee resmi kami di sini:\n{{AFFILIATE_LINK}}'"
       : "Teks caption khusus Facebook dengan CTA Shopee {{AFFILIATE_LINK}}"
     ```

6. **`app/components/campaign-forms/PillarConfigurationForm.js` (Modal Ingest Planner)**:
   - Tambahkan toggle `generate_recipe` di bawah toggle affiliate agar seragam.

---

## 5. Rencana SOP Mockup HTML & Validasi Pengguna

Sesuai dengan SOP MAKNA Flow:
1. **Mockup Interaktif**: Sebelum koding, buat file `public/mockup_auto_pipeline_recipe_toggle.html`.
2. **Uji Langsung**: Pengguna dapat mengklik toggle ON/OFF untuk melihat perubahan tampilan form dan simulasi output caption yang dihasilkan secara *real-time*.
3. **Auto-Heal Contoh**: Menjalankan perbaikan pada `mul_261108_s6so1p` untuk menunjukkan perbandingan nyata di UI.
