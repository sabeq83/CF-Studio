# INSTRUKSI ANTIGRAVITY — Lengkapi Kartu Menu & Rapikan Folder Proyek

Tanggal: 17 November 2026 · Basis: v2.50.0 (commit `550cc67`)
Penyusun: Claude (reviewer/planner) · Pelaksana: Antigravity
Latar belakang: [USULAN_SOP_KARTU_KONTEKS_MENU.md](USULAN_SOP_KARTU_KONTEKS_MENU.md)

## Ringkasan tugas

Dua pekerjaan, **dua commit terpisah**, satu rilis patch di akhir. **Tidak ada perubahan perilaku aplikasi dan tidak perlu deploy.**

| Bagian | Isi | Risiko |
|---|---|---|
| A | Tulis 19 kartu menu yang belum ada + rapikan `sot/menus/` | Rendah (hanya dokumentasi) |
| B | Pindahkan file lepas di folder utama ke dalam folder | Sedang (ada file yang dirujuk kode) |

Sebelum mulai, susun `implementation_plan.md` sesuai SOP di AGENTS.md (wajib ada `## Execution Task List`; untuk Bagian B, bagian "sebelum/sesudah" cukup berupa tabel jalur lama → jalur baru).

## Yang sudah ada (jangan dibuat ulang)

- `sot/menus/_PETA_MENU.md` — peta 22 menu.
- `sot/menus/kartu/video-studio.md`, `auto-pipeline.md`, `multiplier-lab.md` — **pakai sebagai contoh gaya dan kedalaman**.
- AGENTS.md sudah memuat "SOP Konteks Menu (Hemat Token)".
- Semua file di atas **belum di-commit**. Ikutkan di commit Bagian A.

---

# BAGIAN A — Lengkapi kartu menu

## A1. Kartu yang harus ditulis (19)

Nama file = bagian akhir alamat menu. Simpan di `sot/menus/kartu/`.

| Kelompok | Menu → nama file |
|---|---|
| — | Dashboard → `dashboard.md` |
| PLANNING | Content Planner → `content-planner.md` · Product Database → `products.md` · Recipe Library → `recipe-library.md` · Deconstruct Lab → `deconstruct.md` · Preset Manager → `presets.md` · Visual Identity → `visual-identities.md` · Universe Manager → `universes.md` · Brand Profile Manager → `brand-profiles.md` |
| WORKFLOW | Threads Labs → `threads-labs.md` · RE Campaign → `re-campaigns.md` · Pillar Campaign → `pillar-campaigns.md` · Recipe Labs → `recipe-labs.md` · Product Bridging → `product-bridge-inject.md` |
| PUBLISHING | ContentFlow Hub → `content-flow.md` · Recipe Exporter → `recipe-exporter.md` |
| TOOLS | TTS Studio → `tts-studio.md` |
| SYSTEM | Settings → `settings.md` · User & Tenant Management → `users-tenants.md` (satu kartu untuk dua menu) |

Sumber daftar menu: `lib/sidebar-nav.js`.

## A2. Aturan menulis kartu

1. **Maksimal 60 baris per kartu.** Kalau lebih, pangkas — detail tempatnya di dokumen lengkap.
2. **Ikuti susunan judul bagian pada 3 kartu contoh**, urutannya sama: Fungsi → Alur pakai → Terhubung dengan → Lokasi (untuk agent) → Aturan penting & jebakan → Belum ada / batasan → Dokumen lengkap. Baris kedua kartu: tanggal cek + versi aplikasi. Baris ketiga: alamat, kelompok, kunci izin menu.
3. **Bagian "Fungsi" dan "Alur pakai" memakai bahasa pemasar**, tanpa istilah teknis. Bagian "Lokasi" boleh teknis.
4. **Setiap fakta harus dicek ke kode, bukan disalin dari dokumen lama.** Beberapa dokumen di `sot/menus/` sudah usang (contoh: `multiplier-lab.md` masih menyebut SQLite dan alamat lama). Jika dokumen lama usang, tulis peringatannya di bagian "Dokumen lengkap".
5. Bagian "Lokasi" wajib memuat: file halaman, folder API, file logika inti di `lib/`, dan nama tabel utama. File di atas ± 1.500 baris diberi catatan "jangan dibaca utuh, cari dengan kata kunci".
6. Bagian "Terhubung dengan" wajib menyebut perintah MCP terkait (lihat `apps/mcp`) atau menulis "tidak ada".
7. Bagian "Aturan penting & jebakan" maksimal 5 butir, hanya hal yang benar-benar sering menjebak (nilai bawaan yang mengejutkan, nama yang menyesatkan, urutan wajib, hal yang mengunci tombol).
8. **Dilarang memuat kredensial, kunci API, kata sandi, atau contoh berformat secret** (SOP Zero Secret Exposure).
9. Jangan menulis hal yang tidak bisa diverifikasi. Lebih baik bagian itu pendek.

## A3. Perbarui Peta Menu

Di `sot/menus/_PETA_MENU.md`:
- Ganti semua "belum" dengan tautan kartu.
- Koreksi kolom "Fungsi singkat" agar cocok dengan kartu (saat ini 19 baris masih ringkasan yang belum dicek ke kode).
- Pastikan dokumen lengkap untuk ContentFlow Hub benar (`contentflow-studio.md` mungkin milik halaman `/contentflow-studio`, bukan `/content-flow`).
- Hapus kalimat peringatan "belum dicek ke kode" di bagian atas setelah semua terisi.

## A4. Rapikan `sot/menus/`

- Buat `sot/menus/rencana/` dan pindahkan (dengan `git mv`) semua file `youtube-studio-*-implementation-plan.md`, `youtube-studio-channel-character-voice-registry-ai-agent-instructions.md`, `youtube-studio-multi-speaker-narrative-blueprint.md`, `youtube-studio-roadmap.md`, `youtube-studio-mvp.md`, dan `affiliate-studio-roadmap.md`.
- Sebelum memindahkan, cari rujukan ke nama file itu di seluruh proyek (kecuali `node_modules`, `.git`, `.next`) dan perbarui jalurnya.
- Dokumen menu lama lainnya **tetap di tempat**, tidak dihapus dan tidak ditulis ulang.

## A5. Selesai jika

- [ ] 22 menu di Peta Menu semuanya punya tautan kartu yang bisa dibuka.
- [ ] Tidak ada kartu lebih dari 60 baris (`wc -l sot/menus/kartu/*.md`).
- [ ] Setiap jalur file yang disebut di kartu benar-benar ada (cek dengan skrip kecil atau `ls`).
- [ ] Tidak ada secret (`grep -rnE "AIza|password|maknagridpass" sot/menus/kartu` kosong).

Commit A: `docs(menus): lengkapi kartu konteks 22 menu dan peta menu`

---

# BAGIAN B — Rapikan folder utama

Folder utama saat ini berisi ± 70 file `.md` lepas, 18 skrip `scratch-*`, 3 mockup, dan 5 file keluaran `.txt`.

## B1. Aturan keselamatan (wajib)

1. **Pakai `git mv`** untuk file yang terlacak git, agar riwayatnya tidak hilang. **Tidak ada file yang dihapus.**
2. **Sebelum memindahkan satu file, cari dulu apakah namanya dirujuk** di `package.json`, `scripts/`, `lib/`, `app/`, `tests/`, `ecosystem*`, `skills/`, `docs/`, `plans/`, `sot/`. Jika dirujuk oleh kode yang berjalan → jangan dipindah, catat di laporan. Jika dirujuk oleh dokumen → pindahkan dan perbarui tautannya.
3. **Jangan mengubah `.gitignore`.** Catatan: `AGENTS.md` sengaja tidak dilacak git (baris 85) karena memuat kredensial — biarkan begitu. Folder `scratch/` juga diabaikan git — jangan dipakai sebagai tujuan pindah.
4. Setelah selesai jalankan `npm run build` (dengan `DISABLE_AUTO_MIGRATIONS=true`) dan rangkaian tes yang biasa dipakai sebelum rilis; hasilnya harus sama dengan sebelum perapian.

## B2. File yang TIDAK BOLEH dipindah

| File | Alasan |
|---|---|
| `README.md`, `CLAUDE.md`, `AGENTS.md` | Dibaca otomatis oleh agent/alat |
| `implementation_plan.md` | Rencana aktif; SOP AGENTS.md merujuk nama ini |
| `package.json`, `package-lock.json`, `next.config.mjs`, `jsconfig.json`, `middleware.js`, `instrumentation.js` | Konfigurasi aplikasi |
| `ecosystem.config.js`, `ecosystem.macmini.config.cjs`, `ecosystem.macmini-prod.config.cjs`, `ecosystem.staging.config.cjs` | Dirujuk skrip deploy dan tes |
| `db.sqlite` | Dirujuk `scripts/local-staging/setup.js` |
| Semua folder yang sudah ada (`app`, `apps`, `lib`, `kb`, `docs`, `plans`, `sot`, `skills`, `scripts`, `tests`, `public`, `templates`, `remotion`, `plugins`, `foods_n_drink`, `uji-kertas-claude`, `operator-reviews`, `brain`, `data`, `scratch`) | Di luar cakupan tugas ini |

## B3. Susunan tujuan

Satu folder baru `catatan-kerja/` di folder utama, berisi:

| Tujuan | File yang masuk |
|---|---|
| `catatan-kerja/usulan/` | `USULAN_*.md`, `ANALISA_*.md`, `audit_produk_db_usulan.md` |
| `catatan-kerja/instruksi-agent/` | `antigravity_*.md`, `HANDOFF_*.md`, `INSTRUKSI_*.md`, `PETUNJUK_*.md`, `instruksi_kartun.md`, `kartun_tahap1.md` |
| `catatan-kerja/rencana/` | `*_implementation_plan.md`, `implementation_plan_video_studio_finishing.md`, `scraper_foto_produk_revisi_01_plan.md`, `rencana_penjadwalan_*.md` — **kecuali** `implementation_plan.md` |
| `catatan-kerja/laporan/` | `LAPORAN_*.md`, `maknagrid_published_facebook_videos.md` |
| `catatan-kerja/konten/` | `naskah.md`, `resep-multiplier.md` |
| `catatan-kerja/arsip-keluaran/` | `diff.txt`, `diff_wsl.txt`, `diff_wsl_utf8.txt`, `inspect_output.txt`, `prompt_output.txt` |
| `docs/mockups/` | `mockup_caption_styles.html`, `mockup_finishing_preview.html`, `mockup_finishing_templates_v3.html` |
| `scripts/arsip-scratch/` | semua `scratch-*.mjs`, `check-tables.js`, `check_errors.js`, `check_errors.sh`, `inspect_scheduler_config.mjs` |

Catatan khusus:
- `naskah.md`: kata "naskah.md" muncul di `lib/drive-sync-helper.js` dan `lib/scheduler-processors.js`, tetapi itu nama file keluaran, bukan file di folder utama. **Pastikan dulu**; jika ternyata file ini dibaca kode, jangan dipindah.
- `mockup_finishing_templates_v3.html` disebut di komentar `lib/word-alignment-engine.js` baris ± 148. Perbarui jalur di komentar itu.
- Skrip `scratch-*` memakai jalur impor relatif dari folder utama, sehingga **tidak akan jalan dari lokasi baru**. Itu diterima (statusnya arsip). Tulis hal ini di `scripts/arsip-scratch/README.md`; jangan memperbaiki impor satu per satu.
- File instruksi ini dan `USULAN_SOP_KARTU_KONTEKS_MENU.md` ikut dipindah. `USULAN_SUMBER_VIDEO_VIDEO_STUDIO.md` (belum dilacak git) juga ikut dipindah ke `usulan/`.
- File lain di folder utama yang tidak tercantum di tabel: **jangan ditebak**, biarkan dan daftar di laporan.

## B4. Daftar isi

Buat `catatan-kerja/_DAFTAR_ISI.md`: satu tabel per subfolder berisi nama file dan satu kalimat isinya (ambil dari judul/paragraf pertama file; jangan membaca seluruh isi).

## B5. Aturan agar tetap rapi

Tambahkan bagian baru di akhir `AGENTS.md` (file lokal, tidak ikut commit):

```markdown
# SOP Lokasi File Dokumen Kerja

Dilarang membuat file dokumen lepas di folder utama proyek. Gunakan:
- Usulan & analisa → `catatan-kerja/usulan/`
- Instruksi/handoff untuk agent → `catatan-kerja/instruksi-agent/`
- Rencana pengerjaan yang sudah selesai → `catatan-kerja/rencana/` (rencana aktif tetap `implementation_plan.md` di folder utama)
- Laporan → `catatan-kerja/laporan/`
- Skrip coba-coba sekali pakai → `scripts/arsip-scratch/` atau folder `scratch/` (tidak dilacak git)
- Mockup HTML → `public/mockup_*.html` (yang perlu diakses via staging) atau `docs/mockups/`
Setiap file baru di `catatan-kerja/` wajib ditambahkan ke `catatan-kerja/_DAFTAR_ISI.md`.
```

## B6. Selesai jika

- [ ] Folder utama hanya berisi folder + file pada tabel B2 (plus file yang sengaja dibiarkan dan dilaporkan).
- [ ] `git status` menunjukkan pemindahan sebagai *renamed*, bukan hapus + tambah.
- [ ] Pencarian nama file lama di seluruh proyek tidak menemukan tautan putus.
- [ ] `npm run build` berhasil; hasil tes tidak berubah dari sebelum perapian.
- [ ] `catatan-kerja/_DAFTAR_ISI.md` ada dan lengkap.

Commit B: `chore(repo): rapikan dokumen kerja dan skrip scratch ke dalam folder`

---

# RILIS

Setelah dua commit di atas, jalankan SOP rilis (patch):

```bash
npm run release-non-interactive -- --type patch --title "Kartu Konteks Menu & Perapian Folder" --points "Kartu konteks ringkas untuk 22 menu + peta menu|Dokumen kerja dan skrip scratch dipindah ke folder terstruktur|Tanpa perubahan perilaku aplikasi"
```

**Tidak perlu deploy** ke Dev, Staging, maupun Production: tidak ada perubahan kode yang berjalan.

# LAPORAN AKHIR (untuk ditinjau Claude)

Tulis `catatan-kerja/laporan/LAPORAN_KARTU_MENU_DAN_PERAPIAN_FOLDER.md` berisi:
1. Daftar 19 kartu + jumlah baris masing-masing.
2. Dokumen lama di `sot/menus/` yang ditemukan usang, dan bagian mana.
3. Tabel jalur lama → jalur baru untuk semua file yang dipindah.
4. File yang sengaja tidak dipindah beserta alasannya.
5. Tautan/rujukan yang diperbarui.
6. Hasil `npm run build` dan tes (sebelum vs sesudah).
7. Nomor versi rilis dan SHA commit.
