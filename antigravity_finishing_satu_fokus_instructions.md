# Instruksi Antigravity: Finishing "Satu Fokus", Skin General & Babak Natural

Tanggal: 16 Nov 2026 · Dari: Claude (reviewer/planner) · Untuk: Antigravity (eksekutor)

Rencana lengkap, spesifikasi, dan potongan kode sebelum/sesudah ada di
**[finishing_satu_fokus_implementation_plan.md](finishing_satu_fokus_implementation_plan.md)**. Baca seluruhnya sebelum mulai.
Latar belakang audit: [USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md](USULAN_AUDIT_TEMPLATE_FINISHING_GENERAL.md).

---

## ⛔ Aturan utama: mockup dulu, lalu berhenti

1. Tugas pertama Anda **hanya Fase 0 dan Fase 1** (bukti awal + mockup HTML).
2. Setelah link mockup Staging bisa dibuka (HTTP 200), **kirim link ke pengguna dan BERHENTI**.
3. **Dilarang** mengubah file di `lib/`, `app/`, `templates/finishing/`, database, atau MCP sebelum pengguna menulis di chat bahwa mockup **disetujui**.
4. Revisi mockup diulang di file yang sama sampai disetujui.
5. Setiap tahap selesai, ubah `- [ ]` menjadi `- [x]` di bagian **Execution Task List** pada file rencana.

---

## Fase 0: Bukti awal (tanpa mengubah kode)

- Ambil video Completed terbaru untuk template `recipe_pop`, `ramuan_ritual`, dan `problem_solution`.
- Potong frame setiap 0,5 dtk (ffmpeg), simpan di `scratch/finishing_satu_fokus_before/<template>/`.
- Tandai frame yang memuat ≥ 3 blok teks (bahan, langkah, produk, save, subtitle, dll.). Tulis daftar detiknya di `scratch/finishing_satu_fokus_before/CATATAN.md`.
- Ambil timeline JSON ketiga video (yang dikirim ke `loadTimeline`) agar mockup memakai data nyata, bukan karangan.

## Fase 1: Mockup `public/mockup_finishing_satu_fokus.html`

### Syarat teknis
- **Standalone & self-contained:** semua CSS/JS inline, token desain sendiri di `:root`, tidak bergantung pada `app/theme.css`. Tetap rapi bila dibuka lokal.
- Halaman pembungkus (panel kontrol) memakai token semantik bergaya `--surface`, `--text-primary`, dll. yang didefinisikan di file itu sendiri. Dukung light & dark (`prefers-color-scheme` + tombol ganti).
- Overlay video memakai token `--fx-*` sesuai bagian 3.4 rencana. **Tidak ada hex langsung di CSS overlay.** Hex hanya boleh di objek JS definisi skin.
- Latar video: gambar diam/gradien placeholder per adegan (dapur, kamar, gudang). Jangan memakai foto produk asli atau logo brand nyata.
- Tidak ada API key atau kredensial apa pun di file.
- Font: Google Fonts boleh dimuat lewat `<link>` di mockup.

### Isi mockup

**A. Panel kontrol**
- Pilih template: `recipe_pop`, `ramuan_ritual`, `problem_solution`.
- Pilih skin: 6 skin (bagian 3.4 rencana).
- Tombol **Sebelum / Sesudah**. "Sebelum" meniru perilaku sekarang (bahan menumpuk sampai klip penutup, pill "1 MASALAH" + bar progres, subtitle 7,6cqw kapital). "Sesudah" memakai aturan Satu Fokus.
- Slider waktu + tombol Play/Pause (0–25 dtk).
- Bahasa: Indonesia / Inggris.
- **Penghitung "Blok teks aktif: N"**: berubah merah bila N > 2.
- Toggle tampilkan garis zona (Atas 12–40%, Tengah 40–60%, Bawah 64–76%, kanan 15%).

**B. Layar 9:16** (360×640 px di layar, skala cqw sama dengan render 720×1280).

**C. Skenario `recipe_pop`** (pakai timeline Fase 0 bila ada, kalau tidak pakai contoh ini):
- Hook 0–1,75 dtk.
- 6 bahan: tampil bergiliran 3 chip, fase bahan maks 4 dtk, format `Tepung terigu · 200 g`.
- 5 langkah mulai setelah fase bahan.
- 1 punch, kartu produk 1×, save prompt dan CTA di akhir.
- Subtitle berganti ke mode ringkas (maks 4 kata) saat kartu Zona Atas tampil.

**D. Skenario `problem_solution`** (5 klip):
- Kartu babak baru: baris pembuka natural + baris frasa dari VO. Contoh:
  - Klip 1: **"Masalahnya…"** / "Suara jalanan tembus ke kamar"
  - Klip 2: **"Ternyata penyebabnya…"** / "Celah jendela tanpa peredam"
  - Klip 3: tidak ada kartu (masih fase penyebab)
  - Klip 4: **"Solusinya…"** / "Pasang panel rockwool slab"
  - Klip 5: **"Hasilnya…"** / "Kamar jauh lebih tenang"
- Kartu hanya di klip pertama tiap fase, 2,0–2,8 dtk, lalu hilang.
- Tanpa nomor bulat dan tanpa bar progres 4 segmen. Opsi titik kecil 4 buah (bisa dimatikan).
- Tombol **"Acak variasi pembuka"** untuk menunjukkan rotasi ("Masalahnya…" / "Yang sering terjadi…" / "Pernah ngalamin ini?", dst.) sesuai tabel di bagian 3.5 rencana.
- Tombol **"Mode tanpa data babak"**: hanya kartu "Masalahnya…" di klip 1 dan "Solusinya…" di klip yang menyebut nama material, sesuai fallback baru.
- Callout material tetap ada tapi ikut aturan giliran (tidak bersamaan dengan kartu babak).

**E. Skenario `ramuan_ritual`**: bahan bergiliran + 1 timing badge + disclaimer, tanpa tumpuk.

**F. Bagian bawah halaman**: tabel ringkas aturan R1–R6 dan skala huruf (bagian 3.1 & 3.3 rencana) agar pengguna bisa mencocokkan.

### Sinkron ke Staging (wajib, sesuai SOP)
- Next.js hanya menyajikan file `public/` yang ada saat build. Karena itu **jangan** hanya `scp` ke folder aktif.
- Commit file mockup (`docs:`/`chore:` mockup), push ke `main`, lalu deploy Staging atomic:
  `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`
- Jangan polling SSH berulang. Tunggu di sesi deploy yang sama (interval 60–120 dtk).
- Verifikasi HTTP 200: `http://100.95.245.55:5010/mockup_finishing_satu_fokus.html`.
- Kirim link ke pengguna beserta 3–4 kalimat cara mencoba. **Lalu berhenti.**

---

## Fase 2–8 (hanya setelah mockup disetujui)

Kerjakan berurutan sesuai **Execution Task List** di file rencana. Ringkasnya:

| Fase | Inti | File utama |
|---|---|---|
| 2 | Skin registry + token di 8 template | `lib/finishing-skin-registry.js` (baru), `templates/finishing/*.html` |
| 3 | Skala huruf token | `templates/finishing/shared-layers.js` |
| 4 | Penjadwal lapisan + bahan bergiliran | `lib/finishing-layer-scheduler.js` (baru), `lib/finishing-data-extractor.js`, `lib/finishing-preview-builder.js`, `lib/finishing-overlay-renderer.js` |
| 5 | Babak natural | `lib/finishing-plan-validator.js`, `lib/finishing-overlay-renderer.js`, `lib/finishing-preview-builder.js`, `templates/finishing/problem-solution.html` |
| 6 | Lepas dari brand + pilihan skin di brand profile | `lib/finishing-template-registry.js`, migrasi `brand_profiles`, API & UI brand profile, MCP |
| 7 | Cek kepadatan teks | `lib/finishing-plan-validator.js`, halaman review job |
| 8 | Uji, rilis, deploy Staging | tests, `npm run release-non-interactive`, deploy atomic |

### Aturan pengerjaan
- **Kompatibel ke belakang:** timeline tanpa `slots`/`skin` dan plan lama berlabel `MASALAH/PENYEBAB/SOLUSI/HASIL` harus tetap ter-render seperti sebelumnya.
- Kerjakan template satu per satu: `recipe_pop` → `ramuan_ritual` → `problem_solution` → sisanya. Jalankan test setiap selesai satu.
- **Grounding VO:** `line` babak dan label callout wajib dari kata-kata VO klip. Tidak lolos berarti dikosongkan, jangan dikarang.
- **Kepatuhan klaim:** `line` untuk template strict/herbal tetap melewati `isHerbalMedicalClaimPhrase`.
- **Migrasi DB** idempoten, untuk schema `dev`, `staging`, `public`. Jalankan hanya sesuai SOP (build memakai `DISABLE_AUTO_MIGRATIONS=true`).
- **UI web app** (dropdown skin, hasil cek kepadatan) wajib 100% semantic token dari `app/theme.css`, adaptif light/dark.
- **Tidak ada secret** di kode, test, maupun mockup.
- **Dilarang deploy Production.** Hanya Staging (dan Dev bila perlu), atomic dengan full SHA.

### Kriteria selesai (cek sebelum lapor)
- [ ] `grep -E "#[0-9a-fA-F]{3,6}" templates/finishing/*.html` kosong.
- [ ] Tidak ada nama brand di `lib/finishing-template-registry.js`.
- [ ] `auditTextDensity` OK di 3 video uji × 3 skin: tidak ada frame dengan > 2 blok teks (di luar watermark).
- [ ] Daftar bahan ≤ 4 dtk, ≤ 3 chip sekaligus.
- [ ] `problem_solution` menampilkan kartu "Masalahnya… / Solusinya…" dengan frasa dari VO, satu kartu per fase, tanpa nomor & bar progres.
- [ ] Job lama tanpa skin terlihat sama dengan sebelumnya.
- [ ] Frame sebelum/sesudah tersimpan di `scratch/finishing_satu_fokus_before|after/` dan dilaporkan ke pengguna bersama link Staging.

### Format laporan ke pengguna
Bahasa sederhana, tanpa istilah teknis berlebihan: apa yang berubah, link untuk dicoba, apa yang belum, dan apa yang perlu diputuskan pengguna.
