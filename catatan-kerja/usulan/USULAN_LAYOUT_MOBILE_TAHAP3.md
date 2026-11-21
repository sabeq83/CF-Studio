# Usulan: Pemolesan Layout Mobile CF Studio — Tahap 3 (Finalisasi Seluruh Menu Tersisa)

Tanggal: 21 November 2026 · Penyusun: Antigravity  
Status: **Dikerjakan (Branch: `fitur/layout-mobile-tahap3`)**  
Acuan Skill: `antislop-layoutmobile` + `antislop` (Mode DURING)

---

## 1. Latar Belakang & Tujuan

Setelah **Tahap 1** (Fondasi Bersama: `MobileNav`, 3 breakpoint, token skala HP di `theme.css`, modal bottom sheet) dan **Tahap 2** (5 Halaman Utama: Dashboard, Auto Pipeline, ContentFlow Hub, Radar Produk, Database Produk) berhasil dirilis ke Staging (`v2.57.8`), **Tahap 3 merampungkan seluruh 16 menu kerja tersisa** di CF Studio sekaligus.

Tujuan utama:
1. Menghilangkan geser samping (*zero horizontal scroll leak*) pada seluruh halaman.
2. Target sentuh tombol dan kontrol formulir minimal 44×44px.
3. Seluruh drawer, filter popover, dan modal bertransformasi menjadi *bottom sheet* di layar HP ($\le 640\text{px}$).
4. Font form $\ge 16\text{px}$ untuk mencegah auto-zoom di iOS Safari.
5. Tampilan Desktop (>1024px) 100% utuh dan tidak terganggu.

---

## 2. Rincian 16 Menu Tersisa yang Dipoles

### 2.1 Grup PLANNING (Perencanaan & Aset)
1. **Content Planner (`/content-planner`)**:
   - Kalender & antrean posting: sel tanggal adaptif, tidak meluap horizontal di HP.
   - Tabel ide konten & draf dilengkapi pembungkus gulir sentuh mandiri (`.table-scroll-container`).
   - Modal "+ Content Plan" / Import OPC bertransformasi menjadi bottom sheet.
2. **Recipe Library (`/recipe-library`)**:
   - Kartu katalog resep 1 kolom fluid di HP dengan foto thumbnail 16:9 atau 1:1, badge kategori, dan tombol aksi resep $\ge 44\text{px}$.
3. **Deconstruct Lab (`/deconstruct`)**:
   - Form ekstraksi URL video viral, preview blueprint struktur 8 klip, dan drawer inspeksi hook.
4. **Preset Manager (`/settings/presets`)**:
   - Daftar kartu preset video 1 kolom di HP, modal buat/kloning preset menjadi bottom sheet penuh.
5. **Visual Identity (`/settings/visual-identities`)**:
   - Kartu profil VI, pratinjau warna/palette, dan form edit VI responsif.
6. **Universe Manager (`/settings/universes`)**:
   - Manajemen karakter Universe, galeri referensi aset, dan form upload aset referensi aman dari overflow.
7. **Brand Profile Manager (`/settings/brand-profiles`)**:
   - Daftar brand akun, selector tone-of-voice, dan form profil brand tersusun 1 kolom rapi.

### 2.2 Grup WORKFLOW (Produksi & Kampanye)
8. **Threads Labs (`/threads-labs`)**:
   - Baris tab akun Threads dengan chip geser horizontal.
   - Opportunity Feed disajikan sebagai kartu interaktif vertikal (post asli, draft balasan AI, tombol quick approve).
   - Drawer edit balasan menjadi bottom sheet dari bawah.
9. **RE Campaign (`/re-campaigns`) & Detail (`/re-campaigns/[id]`)**:
   - Daftar kampanye Reverse Engineering dengan pill status klip, stepper kampanye fluid, dan tombol setujui/eksekusi 44px.
10. **Pillar Campaign (`/pillar-campaigns`) & Detail (`/pillar-campaigns/[id]`)**:
    - Kartu kampanye OPC 8-klip, ringkasan angle, dan drawer approval storyboard responsif.
11. **Recipe Labs (`/recipe-labs`)**:
    - Form pembuatan resep FB + gambar komposit AI, kartu pratinjau poster resep fleksibel di layar sempit.
12. **Multiplier Labs (`/multiplier-lab`) & Detail (`/multiplier-lab/[id]`)**:
    - Selector video referensi pemenang dan grid kartu 10 variasi sudut (angle) tersusun 1 kolom di HP.
13. **Product Bridging (`/product-bridge-inject`)**:
    - Konfigurasi penyisipan klip produk ke dalam video storytelling, selektor segmen jembatan adaptif.

### 2.3 Grup TOOLS & PUBLISHING (Alat Bantu & Ekspor)
14. **Recipe Exporter (`/recipe-exporter`)**:
    - Pratinjau ekspor format resep, tombol download asset, dan panduan upload sosial media.
15. **Video Studio (`/video-studio`)**:
    - Editor finishing FFmpeg: video player vertikal 9:16 responsif, slider durasi sentuh mudah digeser, dan panel template subtitle.
16. **TTS Studio (`/tts-studio`)**:
    - Pemilih voice persona Minimax / ElevenLabs, audio waveform preview, dan textarea naskah yang nyaman diketik di HP.

### 2.4 Grup SYSTEM (Pengaturan & Manajemen)
17. **Settings (`/settings`)**:
    - Tab pengaturan sistem, switch toggle 44px, dan form konfigurasi API key / integrasi.
18. **User Management (`/settings/users`)**:
    - Tabel daftar user & role (admin/operator) dengan pembungkus gulir horizontal dan modal tambah user sebagai bottom sheet.
19. **Tenant Management (`/settings/tenants`)**:
    - Daftar organisasi tenant & alokasi resource dalam bentuk kartu ringkas di HP.

---

## 3. Strategi Implementasi: Pelindung Global Sistemik + Sentuhan JSX

Untuk merapikan 16 menu tersebut secara efisien tanpa mengubah ratusan ribu baris kode:
1. **Aturan CSS Sistemik di `app/globals.css`**:
   - Penambahan selector penangkap form grid multi-kolom di HP (`.settings-grid`, `.campaign-grid`, `.tools-container`, dll.).
   - Pelindung universal untuk seluruh `<select>`, `<input>`, dan `<textarea>` agar tidak pernah melebihi 100% lebar viewport.
   - Pelindung modal backdrop universal (`.modal-backdrop > div`, `.drawer-backdrop > div`) otomatis menjadi bottom sheet di $\le 640\text{px}$.
2. **Polesan Kelas Khusus di JSX Halaman Kunci**:
   - Memastikan container utama halaman menggunakan `.page-container` atau `.page-content-responsive`.
   - Menambahkan pembungkus `.table-scroll-container` pada tabel-tabel data admin.

---

## 4. Alur Kerja SOP
1. Mockup HTML Mandiri Tahap 3 (`public/mockup_layout_mobile_tahap3.html`) yang menyimulasikan 4 kelompok menu di atas.
2. Sinkronkan ke Staging (`http://100.95.245.55:5010/mockup_layout_mobile_tahap3.html`).
3. Minta persetujuan pengguna sebelum mengubah kode halaman.
4. Implementasi kode, kompilasi Next.js (`npm run build`), tes kluster.
5. Deploy ke Server Dev (`:5020`) untuk verifikasi.
