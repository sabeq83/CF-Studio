# Instruksi Antigravity: USP yang sudah disetujui tidak diperkaya ulang

Tanggal: 27 November 2026

## 0. Tugas dan batas

Produk yang disetor dari CF Tools sudah membawa USP yang disetujui pengguna. CF Studio tidak boleh menimpanya lewat pengayaan otomatis.

Kerjakan berurutan: Tahap 0, 1, 2, 2B, lalu 3. Baca `AGENTS.md` repo ini dan ikuti SOP-nya.

**Minta persetujuan pengguna lebih dulu, satu per satu, untuk:** push ke remote, deploy Dev, deploy Staging, merge ke `main`, rilis, dan setiap penulisan data produk nyata. Commit lokal boleh tanpa bertanya. Production tidak disentuh.

**Larangan:**
- Jangan menampilkan, menyalin, atau meng-commit token dan kredensial.
- Jangan mengubah data produk langsung ke database.
- Jangan menyentuh branch `hotfix/campaign-wib-timezone` (commit `fd109de`, belum digabung).
- Jangan menjalankan `cf-data-produk gabung` pada batch `c1b54e55-4363-4a8b-9366-cca611e16cdc`; persetujuan manual di CSV-nya akan tertimpa.
- Jangan memperkaya ulang (`cf_enrich_product`, tombol Enrich) sembilan produk di bagian 7 sebelum terkunci.

## 1. Keadaan saat instruksi dibuat (periksa ulang sebelum mulai)

- Folder `~/_cfstudio` di branch `fitur/mcp-kaitkan-brand`, sama dengan `main` (`f105f6a`, v2.66.0).
- Belum di-commit: `apps/mcp/tools.mjs`, `apps/mcp/test/mcp.test.mjs`, `apps/mcp/README.md` (alat `cf_link_product_brand`, sudah dipakai untuk 9 produk), serta file instruksi ini dan `catatan-kerja/_DAFTAR_ISI.md`.
- Hasil tes: `apps/mcp` 19/19 lulus, `tests/test-mcp-tools-parity.test.js` 8/8 lulus.
- **Codex, Claude, dan Antigravity menjalankan MCP stdio langsung dari folder ini.** Folder utama harus tetap berada di branch yang memuat `cf_link_product_brand` dan, sesudah Tahap 1, `usp_approved`. Perubahan MCP berlaku setelah klien dibuka ulang.

## 2. Penyebab

`isUspManualLocked` (`lib/product-bulk-worker.js` sekitar baris 204) mengunci USP bila `raw_response.usp_source = 'manual'`, produk hasil kurasi Radar, atau `is_url = 0`. Produk CF Tools punya URL Shopee (`is_url = 1`) dan `raw_response = 'Manual entry'`, sehingga pengayaan menimpa USP. Pada batch `c1b54e55`, USP P02–P09 tertimpa (sudah dipulihkan 27 November 2026). Pengayaan juga mengganti kategori: CSV berisi "Peralatan Dapur", sebagian besar produk kini berkategori lain.

Pengayaan tetap harus berjalan untuk `product_truth`, `geometric_truth`, dan prompt foto. Yang dilindungi hanya USP (dan kategori yang sudah terisi, Tahap 3).

## 3. Tahap 0: persiapan

1. Pastikan keadaan di bagian 1 masih benar. Bila berbeda, laporkan dan berhenti.
2. Jalankan `npm run test:mcp` dan `PG_SEARCH_PATH=dev node --test tests/test-mcp-tools-parity.test.js`.
3. Commit lokal perubahan alat brand di `fitur/mcp-kaitkan-brand`. Commit dokumen terpisah.
4. `git checkout -b fitur/kunci-usp-disetujui` **dari `fitur/mcp-kaitkan-brand`**. Ini menyimpang dari aturan "dari main" dengan sengaja: folder yang sama harus memuat kedua alat MCP. Sebutkan penyimpangan ini di laporan.

## 4. Tahap 1: parameter `usp_approved` pada `cf_add_product`

`POST /api/v2/products` sudah menerima `body.raw_response`, dan `createProduct` menyimpannya. Server tidak perlu diubah.

`apps/mcp/tools.mjs` (`cf_add_product`, sekitar baris 1613). Sebelum:

```js
      bypass_radar_check: z.boolean().optional()
    },
    false,
    async ({ photo_base64, photo_filename, photo_url, photo_file_path, bypass_radar_check, ...args }) => {
      try {
        // ...
        return request('/api/v2/products', {
          timeoutMs: 120000,
          body: {
            ...args,
```

Sesudah:

```js
      bypass_radar_check: z.boolean().optional(),
      usp_approved: z.boolean().optional()
    },
    false,
    async ({ photo_base64, photo_filename, photo_url, photo_file_path, bypass_radar_check, usp_approved, ...args }) => {
      try {
        if (usp_approved && !args.unique_selling_point?.trim()) {
          return { success: false, error_code: 'USP_REQUIRED', error: 'usp_approved membutuhkan unique_selling_point.' };
        }
        // ...
        return request('/api/v2/products', {
          timeoutMs: 120000,
          body: {
            ...args,
            ...(usp_approved ? { raw_response: JSON.stringify({ source: 'manual', usp_source: 'manual' }) } : {}),
```

Tambahkan keterangan parameter pada deskripsi alat dan `apps/mcp/README.md`.

Tes wajib (`apps/mcp/test/mcp.test.mjs`):
- dengan `usp_approved`: `body.raw_response` berupa JSON dengan `usp_source: 'manual'` (syarat `isUspManualLocked`), dan `usp_approved` tidak ikut terkirim;
- tanpa parameter: tidak ada `raw_response`;
- `usp_approved` tanpa USP: `USP_REQUIRED` dan tidak ada permintaan tulis.

Setelah `npm run test:mcp` dan tes paritas lulus, buat commit lokal di `fitur/kunci-usp-disetujui`.

## 5. Tahap 2: skill Codex (di luar repo)

Folder skill tidak memakai git. **Cadangkan dulu** `~/.codex/skills/cf-setor-produk` dan `cf-manajer`.

### 5a. `cf-setor-produk/scripts/setor.py`

Pada penyusunan argumen `cf_add_product` (sekitar baris 121), sebelum:

```python
            add['auto_enrich_clean_photo'] = False  # CF Studio tidak membuat foto bersih sendiri
```

Sesudah:

```python
            add['auto_enrich_clean_photo'] = False  # CF Studio tidak membuat foto bersih sendiri
            add['usp_approved'] = True  # produk-siap-cf hanya berisi teks yang sudah disetujui
```

Pada `catat`: tambahkan opsi `--usp-cocok`. Tolak `--status berhasil` tanpa opsi itu bila `status_setor` baris tersebut sebelumnya bukan `berhasil` atau `duplikat`. Langkah `perbarui_link` pada produk lama tidak boleh ikut terblokir.

### 5b. `cf-setor-produk/SKILL.md`

- Sebelum menambah produk, pastikan skema `cf_add_product` memuat `usp_approved`. Bila tidak ada, berhenti dan minta Codex dibuka ulang.
- Sesudah menambah, `cf_get_product_detail` harus menunjukkan `usp_source` = `manual` pada `raw_response` dan USP sama dengan CSV.
- Produk pertama tiap batch: tunggu `enrichment_status` = `completed` (cek berkala, maksimal sekitar 3 menit), lalu bandingkan USP lagi. Bila belum selesai, berhenti dan laporkan. Bila USP berubah: pulihkan dengan `cf_update_product`, hentikan batch, laporkan bahwa kunci tidak bekerja di server.
- Hapus instruksi lama yang menganggap penimpaan USP sebagai hal biasa, dan sesuaikan contoh perintah `catat`.

### 5c. Manajer dan paket

- `cf-manajer/references/aturan.md`, tahap `setor`: aturan verifikasi yang sama.
- Perbarui `~/Documents/Shopee Aff/CF Tools/README.md` dan `PETUNJUK.md`, lalu jalankan `python3 perbarui-paket.py` di folder itu. Pastikan zip tidak memuat file token.

### 5d. Uji

Salin satu folder batch dari `~/Downloads/CF Product Research/` ke folder sementara; jangan menulis ke folder asli. Buktikan: rencana produk baru memuat `usp_approved: true`; `catat` berhasil tanpa `--usp-cocok` ditolak untuk produk baru; `perbarui_link` dan `kaitkan_brand` tetap jalan; `manajer.py status` tidak berputar di tahap yang sama.

Uji satu produk nyata dilakukan pengguna lewat Codex. Siapkan kalimat perintahnya di laporan.

## 5B. Tahap 2B: naikkan alat MCP ke `main`

Tujuannya agar `cf_link_product_brand` dan `usp_approved` tidak hanya ada di satu MacBook.

**Syarat mulai:** Tahap 1 dan 2 selesai, dan pengguna menyatakan uji satu produk nyata berhasil (USP tetap sama sesudah pengayaan selesai, link terkait ke brand).

Setiap langkah yang mengubah remote atau server memerlukan persetujuan pengguna.

1. Pastikan `fitur/kunci-usp-disetujui` memuat commit alat brand (Tahap 0) dan commit `usp_approved` (Tahap 1), dan tidak ada perubahan yang belum di-commit.
2. `git fetch origin`. Bila `origin/main` sudah maju, `git merge origin/main` ke branch ini.
3. Verifikasi:

   ```bash
   npm run test:mcp
   ```

   ```bash
   PG_SEARCH_PATH=dev node --test tests/test-mcp-tools-parity.test.js
   ```

   ```bash
   DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build
   ```

4. Push branch: `git push -u origin fitur/kunci-usp-disetujui`. `fitur/mcp-kaitkan-brand` tidak perlu di-push terpisah karena commit-nya sudah termasuk.
5. Deploy ke Dev: `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`.
6. Uji di Dev (`http://100.95.245.55:5020`): jalankan MCP stdio dengan `CF_STUDIO_OPERATOR_BASE_URL` mengarah ke Dev dan token Dev yang disiapkan pengguna. Jangan menyimpan token itu di repo atau menampilkannya, dan jangan mengubah konfigurasi MCP yang dipakai sehari-hari. Tambah satu produk uji dengan `usp_approved`, tunggu pengayaan selesai, bandingkan USP, lalu kaitkan ke brand. Catat ID produk uji; menghapusnya perlu persetujuan.
7. Pintu naik (SOP Alur 1): pengguna menyatakan lolos di Dev, dan branch sudah berjalan di Dev minimal 1 hari atau pengguna mengizinkan lebih cepat.
8. Sebelum merge, periksa bahwa release yang sedang berjalan di Staging tidak memuat commit yang belum ada di `main`. Bila ada, berhenti dan laporkan.
9. `git checkout main && git pull`, lalu `git merge --no-ff fitur/kunci-usp-disetujui`.
10. Perbarui `sot/menus/kartu/products.md`, lalu rilis dari `main` dengan `npm run release-non-interactive -- --type minor --title "..." --points "..."`. Skrip ini melakukan commit, tag, dan push sendiri.
11. Deploy Staging memakai SHA rilis: `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`, lalu verifikasi sesuai SOP deployment.
12. Periksa apakah MCP jarak jauh (port 7030) sudah memuat kedua alat. Bila prosesnya tidak ikut diperbarui oleh deploy, laporkan cara menjalankannya dan minta persetujuan sebelum mengubahnya.
13. Biarkan folder utama di `main`. Hapus branch fitur yang sudah digabung (lokal dan remote) setelah disetujui.

## 6. Tahap 3: server (kunci edit manual, produk lama, dan kategori)

Ini perbaikan perilaku yang sedang berjalan di Staging, jadi ikuti Alur Hotfix. Kerjakan sesudah Tahap 2B, sehingga `main` sudah memuat kedua alat MCP. Bila Tahap 2B belum selesai, tanyakan pengguna sebelum melanjutkan. **Pakai worktree** agar folder utama tidak berpindah branch:

```bash
git -C ~/_cfstudio worktree add ~/_cfstudio-usp -b hotfix/usp-manual-lock main
```

Pasang dependensi di worktree itu. Tidak ada perubahan UI, jadi tidak perlu mockup.

### 6a. `app/api/v2/products/[id]/route.js`

`PUT` punya **dua jalur**, keduanya hanya menandai perubahan kemasan sebagai manual:

1. multipart (edit lewat UI), sekitar baris 158, variabel `filteredUpdate`;
2. JSON (termasuk `cf_update_product`), sekitar baris 231, variabel `updateData`.

Pada jalur multipart, perubahan nama, deskripsi, atau `regenerate` memicu pengayaan ulang, sehingga USP yang baru diedit bisa langsung tertimpa.

Contoh jalur JSON. Sebelum:

```js
    const manualRawJson = markManualPackagingSourceIfChanged(existing, updateData);
    if (manualRawJson) {
      updateData.raw_response = manualRawJson;
    }
```

Sesudah:

```js
    const manualRawJson = markManualPackagingSourceIfChanged(existing, updateData);
    if (manualRawJson) {
      updateData.raw_response = manualRawJson;
    }
    if (isUspEdited(existing, updateData) || body.usp_approved === true) {
      updateData.raw_response = markManualUspSource(updateData.raw_response ?? existing?.raw_response);
    }
```

Ketentuan:
- `markManualUspSource` menambahkan `usp_source: 'manual'` tanpa membuang penanda lain (mis. `packaging_source`), dan aman bila `raw_response` bukan JSON.
- `isUspEdited` benar hanya bila isi USP berubah. Bandingkan nilai yang sudah dinormalkan (daftar JSON dan teks berbaris bisa berisi sama). Menyimpan produk tanpa mengubah USP tidak boleh menguncinya.
- Terapkan di kedua jalur. `usp_approved` hanya perlu di jalur JSON dan tidak masuk daftar kolom.

### 6b. `lib/product-bulk-worker.js`

Tambahkan `category` pada query `claimPendingEnrichmentProducts` dan destrukturisasi di `enrichProduct`. Sebelum (sekitar baris 351):

```js
      item.category || null,
```

Sesudah:

```js
      hasManualUsp && category ? null : (item.category || null),
```

### 6c. Tes

Tambahkan tes untuk: kedua jalur PUT, USP tidak berubah tidak mengunci, `usp_approved`, penanda lain dipertahankan, dan kategori dipertahankan saat terkunci. Jalankan juga:

```bash
PG_SEARCH_PATH=dev node --test tests/product-research/promotion-and-scrape-contract.test.js tests/product-enrich-vision.test.js tests/product-enrichment-retryable.test.js
```

```bash
DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build
```

### 6d. Naik ke server

Sesuai SOP dan **dengan persetujuan di tiap langkah**: push, deploy Dev, uji di Dev (tambah produk terkunci dan edit USP, lalu perkaya ulang; USP harus tetap), merge ke `main`, rilis patch beserta pembaruan `sot/menus/kartu/products.md`, deploy Staging, bawa `main` ke branch fitur aktif, hapus worktree.

## 7. Sesudah Staging: kunci produk lama (perlu persetujuan)

Tenant `tnt_sy-dodot_4ba27b`. Sebelum mengunci, bandingkan USP tersimpan dengan `produk-siap-cf.csv` batch `c1b54e55`. Lalu `cf_update_product` dengan `updates: {"usp_approved": true}` dan periksa `raw_response`.

| ID | product_id |
|---|---|
| P01 | `pe_1795763980779_8322` |
| P02 | `pe_1795768201100_11` |
| P03 | `pe_1795768239033_5204` |
| P04 | `pe_1795768296010_8481` |
| P05 | `pe_1795768337959_2371` |
| P06 | `pe_1795768395500_6050` |
| P07 | `pe_1795768433885_5199` |
| P08 | `pe_1795768488944_3792` |
| P09 | `pe_1795768526299_6131` |

Satu produk uji di tenant `tnt_pt-gim-sosmed_62d0d9` (`pe_1795740007497_3946`) juga belum terkunci; tanyakan apakah ikut dikunci. Kategori lama jangan diubah tanpa diminta. Kembalikan tenant aktif sesudahnya.

## 8. Daftar tugas

- [x] Tahap 0: periksa keadaan, tes awal, commit alat brand, buat branch
- [x] Tahap 1: `usp_approved`, README, tes
- [x] Tahap 2: skill, manajer, uji salinan batch, petunjuk dan zip
- [ ] Uji satu produk nyata oleh pengguna lewat Codex
- [x] Tahap 2B: push, Dev, merge ke `main`, rilis, Staging, periksa MCP jarak jauh (naik ke Staging v2.67.0; uji Dev dilewati atas perintah pengguna)
- [x] Tahap 3: worktree hotfix, kode, tes, build
- [ ] Dev, merge, rilis, Staging (persetujuan tiap langkah)
- [ ] Kunci sembilan produk lama

Centang di file ini sambil berjalan. Jangan menimpa `implementation_plan.md` milik pekerjaan lain.

## 9. Laporan akhir

Sebutkan: branch dan SHA tiap commit, file yang diubah (termasuk di luar repo), keluaran tes dan build apa adanya, hal yang belum diuji, penyimpangan dari instruksi beserta alasannya, dan persetujuan yang masih ditunggu.
