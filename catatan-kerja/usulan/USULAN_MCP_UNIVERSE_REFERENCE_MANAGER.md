# Usulan Penyempurnaan MCP: Universe dan Referensi Karakter

Tanggal: 19 November 2026  
Status: usulan untuk review; belum diimplementasikan  
Kasus utama: Arka menggantikan Maya pada Ruang Akustik ID, tenant PT GIM Sosmed.

## 1. Hasil yang dituju

Agen dapat melalui MCP menemukan Universe, membuat atau memperbarui karakter, mengunggah gambar referensi, meninjau dan menyetujui versi aset, menghubungkan karakter ke Visual Identity (VI), lalu membuktikan bahwa pipeline mengambil gambar yang benar. Tidak diperlukan edit database langsung atau menyalin file manual ke release aplikasi.

Keberhasilan harus dibedakan menjadi tiga tingkat:

1. **Konfigurasi tersimpan:** deskripsi dan pakaian karakter tersimpan di VI.
2. **Referensi siap:** gambar approved, file valid, pemilik serta tenant sesuai, dan relasi VI–Universe–karakter benar.
3. **Referensi digunakan:** resolver produksi benar-benar memasukkan aset ke input gambar untuk klip terkait.

Tingkat kedua dan ketiga tidak menjamin wajah keluaran AI identik secara absolut. Jangan melaporkan Character Lock selesai hanya karena nama karakter tersimpan.

## 2. Kondisi yang ditemukan

Inspeksi kode lokal dilakukan pada branch `fitur/radar-produk`; temuan perlu dibandingkan dengan `main` terbaru ketika implementasi dimulai.

| Komponen | Kondisi saat diperiksa |
|---|---|
| MCP `apps/mcp/tools.mjs` | Tersedia pengelolaan VI; belum ada tool khusus Universe/reference assets dalam katalog MCP sesi ini. |
| API Universe | Sudah ada `/api/v2/universe-profiles`, `[id]`, subresource `characters`, `locations`, dan `episodes`. |
| API aset | Sudah ada `/api/v2/reference-assets`, `upload`, `generate`, `import-legacy`, `preflight`, serta aksi per ID untuk approve/reject/status. |
| Service/repository | `lib/reference-asset-service.js` dan `lib/reference-asset-repository.js` menyediakan siklus versi dan persetujuan. |
| Penyimpanan | `lib/reference-asset-storage.js`: PNG/JPEG/WebP, batas 10 MB, pemeriksaan magic bytes, SHA-256, path terkelola per tenant/pemilik/peran/versi. |
| Manifest | `lib/universe-manifests.js` memilih aset approved, mendukung identity dan character sheet, menyediakan refresh serta pemuatan async. |
| Resolver | `lib/cartoon-reference-resolver.js` mengumpulkan gambar karakter, produk, dan gaya untuk pipeline. |
| Preflight sekarang | `runReferenceAssetPreflight` terutama memeriksa kampanye Pillar dan referensi `visual_style` VI; belum merupakan pemeriksaan lengkap Character Lock sebelum kampanye dibuat. |

Catatan dokumentasi: kartu Universe sebelumnya menyatakan API terpisah tidak ditemukan dan refresh perlu restart PM2. Kode menunjukkan API dan fungsi refresh sudah tersedia; kartu diperbaiki bersama usulan ini. Namun tersedianya fungsi refresh belum membuktikan invalidasi seluruh proses UI/API selalu berjalan setelah setiap mutasi.

## 3. Batas lingkup

Prioritas pertama adalah karakter dan gambar referensi yang sudah dibuat/disetujui pengguna. Gunakan service yang ada, jangan membuat tabel atau sistem penyimpanan paralel.

Pembuatan gambar AI melalui MCP dapat menyusul. Menghubungkan VI tidak otomatis mengubah brand profile, jadwal, kampanye berjalan, atau mengarsipkan Maya. Migrasi pemakaian ke Arka merupakan aksi terpisah dengan daftar dampak yang bisa ditinjau.

Usulan ini tidak mengubah UI. Apabila implementasi kemudian membutuhkan UI baru, ikuti SOP mockup HTML sebelum mengubah React.

## 4. Tool MCP yang diusulkan

Nama dan parameter berikut merupakan kontrak usulan, bukan tool yang sudah tersedia. Semua mutasi memakai `expected_tenant_id`; server mencocokkannya dengan tenant efektif yang sudah diotorisasi. Parameter ini bukan cara untuk melewati hak akses.

| Tool | Input utama | Hasil/perilaku |
|---|---|---|
| `cf_list_universes` | `query?`, `limit?`, `cursor?` | Daftar ringkas, jumlah karakter, tenant efektif. |
| `cf_get_universe` | `universe_id` | Profil, karakter, lokasi, ringkasan referensi dan relasi VI. |
| `cf_create_universe` | `name`, `slug`, profil tervalidasi, `idempotency_key` | Membuat Universe; konflik slug tidak menimpa data. |
| `cf_update_universe` | `universe_id`, `patch`, `expected_revision` | Patch field yang diizinkan; perubahan slug harus memeriksa dependensi. |
| `cf_create_universe_character` | `universe_id`, `character_key`, `name`, `canonical_prompt`, `idempotency_key` | Membuat karakter dengan ID server; key unik dalam Universe. |
| `cf_update_universe_character` | `universe_id`, `character_id`, `patch`, `expected_revision` | Memperbarui penampilan/peran; menolak pemilik yang tidak cocok. |
| `cf_list_reference_assets` | `owner_type`, `owner_id`, `role?`, `status?`, pagination | Daftar versi, status dan preview; tanpa base64. |
| `cf_get_reference_asset` | `asset_id` | Metadata, checksum, dimensi, preview dan pemakaian. |
| `cf_upload_reference_asset` | pemilik, `universe_id?`, `role`, sumber gambar, `idempotency_key` | Menyimpan **draft**, mengembalikan ID, versi, checksum dan preview. |
| `cf_approve_reference_asset` | `asset_id`, `expected_sha256`, `expected_revision`, `notes?`, attestation bila relevan | Menyetujui tepat versi yang ditinjau; versi approved sebelumnya diarsipkan secara transaksional. |
| `cf_reject_reference_asset` | `asset_id`, `expected_revision`, `reason` | Menolak draft tanpa mengubah versi approved. |
| `cf_archive_reference_asset` | `asset_id`, `expected_revision`, `reason`, `dry_run?` | Menampilkan dampak; jangan meninggalkan VI wajib-lock tanpa referensi valid. |
| `cf_link_visual_identity_universe` | `visual_identity_id`, `universe_id`, `character_keys`, `expected_revision`, `dry_run?` | Validasi relasi, lalu patch hanya field subject terkait; kembalikan diff. |
| `cf_preflight_character_lock` | `visual_identity_id`, `mode: advisory|required`, konteks kampanye/klip opsional | Pemeriksaan read-only seluruh rantai; tersedia sebelum kampanye dibuat. |

Tahap berikutnya: pengelolaan lokasi, generate reference + status job, impor legacy, dan pemulihan versi. Restore harus memakai aksi eksplisit baru atau pembuatan versi draft baru dari aset lama; jangan mengirim aset archived ke approve yang saat ini hanya menerima draft.

## 5. Unggah gambar lintas komputer

File di komputer Codex tidak otomatis tersedia pada host MCP atau Mac Mini. Kontrak upload harus menjelaskan batas ini.

- MVP memakai `image_base64` + `filename`, tepat satu sumber, dikonversi adapter MCP menjadi multipart `file` ke endpoint upload yang ada. Batasi payload terenkode dan byte hasil decode sebelum pemrosesan; jangan mencatat payload dalam log atau respons.
- Untuk file mendekati batas transport MCP, sediakan upload session bertoken singkat yang terikat tenant/pemilik/role, kemudian finalize dengan checksum. Beri error jelas bila session transport belum didukung; jangan diam-diam memotong gambar.
- `file_path` hanya opsional untuk MCP lokal dengan akses filesystem yang jelas, root yang diizinkan, dan pemeriksaan symlink. Path lokal pengguna tidak boleh diteruskan ke MCP remote seolah-olah file tersedia di sana.
- URL import merupakan fitur lanjutan: batasi ukuran/waktu, cek redirect dan resolusi DNS, tolak target internal yang tidak diizinkan, jangan meneruskan token operator ke sumber gambar.
- Pertahankan batas format/ukuran storage yang ada, tambahkan batas dimensi/pixel untuk mencegah gambar terkompresi yang terlalu besar setelah decode.
- Simpan ke storage terkelola melalui service. `public/uploads` harus tetap terhubung ke shared storage atomic deployment, bukan file lepas di release yang akan diganti.

Preview memakai URL yang memang dapat diakses reviewer. Bila aset harus privat, gunakan URL bertanda tangan dengan masa berlaku; jangan menyatakan URL public sekarang sudah memiliki kontrol akses privat.

## 6. Integrasi backend dan keamanan relasi

1. Adapter `apps/mcp/tools.mjs` memanggil HTTP/service resmi. `operatorClient` sudah mendukung FormData, bearer token, idempotency header dan tenant override; verifikasi auth bridge untuk seluruh route baru dengan token operator, bukan hanya login browser.
2. Terapkan izin Universe/reference assets dan VI sesuai menu yang dioperasikan. Semua lookup owner, Universe, character, aset dan VI wajib memakai tenant efektif yang sama. Jangan percaya `tenant_id`, `id`, atau `universe_id` bebas dalam body.
3. Gunakan whitelist field untuk create/update. Beberapa route yang diperiksa membentuk object dengan spread body setelah ID server; audit dan cegah body menimpa identitas/pemilik yang sudah divalidasi.
4. Gunakan repository aset untuk versi/approval. Jangan sekadar mengisi `reference_image_path` karena itu melewati lifecycle dan bukti review.
5. Idempotency harus ditegakkan server dan discope tenant + operasi + hash payload. Header saja tidak membuktikan dukungan idempotency. Retry identik mengembalikan objek sama; key sama dengan payload berbeda menghasilkan conflict.
6. `expected_revision` dan checksum merupakan tambahan usulan: implementasikan optimistic concurrency dan locking transaksi agar dua approval paralel tidak menghasilkan dua versi approved untuk owner/role sama.
7. Setelah mutasi/approval/link, invalidasi cache dengan scope tenant dan Universe. Proses UI/API yang berbeda harus melihat versi baru; bila invalidasi belum selesai, respons tidak boleh menyatakan lock siap. Preflight harus membaca versi mutakhir.
8. Respons ringkas selalu menyertakan tenant efektif, ID objek, versi/revisi, hasil validasi dan warnings. Audit mencatat actor, aksi, timestamp serta before/after tanpa secret atau isi biner.

## 7. Preflight yang membuktikan Character Lock

Perluas service dengan kontrak baru, jangan menganggap preflight lama sudah memadai:

- VI tersedia dan `subject.kind` sesuai karakter stylized.
- `universe_profile_id`, slug, dan setiap `character_key` saling konsisten dalam tenant yang sama.
- Terdapat referensi identity approved untuk setiap karakter wajib; character sheet merupakan pendukung, bukan kelulusan otomatis untuk anchor wajah. Fallback legacy dilaporkan eksplisit.
- File dapat dibaca, MIME/dimensi benar, checksum cocok, dan dapat dikonsumsi worker/generator terkait.
- Resolver produksi mengembalikan ID/versi/checksum aset yang diharapkan; batas jumlah gambar provider tidak membuang anchor karakter.
- Tidak ada sisa referensi Maya dalam hasil resolver Arka.
- Mode `required` memblokir produksi ketika anchor hilang atau berbeda; tidak boleh diam-diam jatuh ke preset/default karakter lain.
- Simpan snapshot aset terpilih pada kampanye/klip sesuai lifecycle pipeline. Perubahan referensi berikutnya tidak boleh mengubah kampanye berjalan tanpa aksi rebind eksplisit.

Contoh respons usulan:

```json
{
  "success": true,
  "tenant_id": "tnt_pt-gim-sosmed_62d0d9",
  "status": "ready",
  "visual_identity_id": "vi_mwmsg3mr_c88f1ee6",
  "character_keys": ["arka_acoustic_consultant"],
  "resolved_assets": [{
    "asset_id": "REFERENCE_ASSET_ID",
    "role": "identity",
    "version": 1,
    "sha256": "CHECKSUM_FROM_SERVER"
  }],
  "missing": [],
  "warnings": [],
  "blocking": false
}
```

`success` berarti pemeriksaan berhasil dijalankan; kesiapan produksi ditentukan `status` dan `blocking`. Gunakan kode error stabil seperti `TENANT_MISMATCH`, `OWNER_NOT_FOUND`, `REVISION_CONFLICT`, `REFERENCE_NOT_APPROVED`, `REFERENCE_FILE_MISSING`, `CHECKSUM_MISMATCH`, `UPLOAD_TOO_LARGE`, dan `REFERENCE_NOT_RESOLVED`.

## 8. Alur penerimaan untuk Arka

Data diketahui dari sesi MCP sebelumnya:

- Tenant: `tnt_pt-gim-sosmed_62d0d9`.
- VI Arka: `vi_mwmsg3mr_c88f1ee6`.
- Universe Ruang Akustik yang dirujuk VI Maya: `ptgim_univ_ruang_akustik_tnt_pt_gim_sosmed_62d0d9`.
- Key karakter baru usulan: `arka_acoustic_consultant`.

Semua ID wajib dibaca ulang saat eksekusi; jangan menganggap state sesi lama masih mutakhir.

1. Pilih tenant dan ambil Universe Ruang Akustik serta VI Arka.
2. Buat karakter Arka dalam Universe tersebut: pria Indonesia 30–35 tahun, rambut hitam pendek, blazer navy polos, kaus abu terang, headphone charcoal, tanpa aksen cyan.
3. Siapkan **identity anchor bersih satu karakter**, wajah jelas dan pakaian sesuai mockup. Board presentasi multi-panel bertulisan bukan pilihan utama anchor karena bisa ikut membawa teks atau komposisi ganda. Hasil turunan baru harus ditinjau sebagai aset tersendiri.
4. Upload anchor sebagai `owner_type=character`, `role=identity`; character sheet bersih dapat diunggah sebagai referensi tambahan.
5. Tampilkan preview dan checksum. Persetujuan pengguna atas gambar tertentu dapat dipakai bila bytes/asetnya memang sama; jangan menganggap persetujuan mockup mencakup hasil regenerasi berbeda.
6. Approve aset yang ditinjau, jalankan dry-run link VI, lalu tautkan Arka. Maya tetap tersimpan dan tidak diubah.
7. Jalankan preflight required. Pastikan resolver memilih Arka tanpa anchor Maya.
8. Setelah otorisasi produksi uji/kuota, buat satu sampel untuk memastikan referensi masuk request generator; review visual oleh pengguna. Jangan menjadikan render berbayar efek samping upload/link.
9. Laporkan apakah selesai pada tingkat konfigurasi, referensi siap, atau sudah diuji produksi. Pengalihan jadwal/brand dilakukan sebagai pekerjaan terpisah.

## 9. Verifikasi dan kriteria selesai

- Tool terdaftar di discovery MCP, terdokumentasi dan lolos parity test.
- Token operator berizin dapat menjalankan alur; token tanpa izin ditolak.
- Tenant B tidak dapat membaca/mengubah aset tenant A, termasuk memakai owner ID atau slug sama dan state tenant paralel.
- Upload valid menghasilkan draft dan metadata benar; format palsu, file terlalu besar, path terlarang dan retry konflik ditolak dengan kode jelas.
- Approval paralel/retry tidak menggandakan versi aktif; versi lama tetap dapat diaudit.
- Link memverifikasi karakter anggota Universe, tidak mengganti field VI lain dan tidak mengganti jadwal.
- Preflight required gagal untuk file hilang, checksum berubah, draft, key salah, tenant salah dan resolver yang membuang anchor.
- Approval versi baru terlihat di proses/worker lain tanpa restart manual rutin; snapshot kampanye lama tetap stabil.
- Alur custom storyboard/CFA dan Editorial/Pillar diuji pada resolver yang benar. Klaim dukungan pipeline lain hanya setelah ada bukti pengujian.
- Atomic deploy/rollback mempertahankan akses aset shared. Rollback filesystem tidak dianggap rollback database.
- Kartu Universe, VI, README MCP dan runbook diperbarui sesuai kemampuan yang benar-benar dirilis.

## 10. Urutan implementasi yang disarankan

**Tahap A:** audit auth/tenant dan kontrak, discovery/read Universe, create/update karakter, list/get/upload reference.  
**Tahap B:** approval dengan concurrency/idempotency, link VI, invalidasi cache dan preflight lengkap. Tahap A+B adalah MVP untuk kasus Arka.  
**Tahap C:** location/style references, restore versi, import legacy dan generate/status opsional.

Mulai implementasi di branch fitur tersendiri dari `main` terbaru; jangan mencampur dengan `fitur/radar-produk`. Baca panduan Next.js lokal sebelum mengubah route. Dorong SHA terverifikasi ke Dev dan ikuti pintu persetujuan/uji Dev sebelum Staging. Target awal memakai schema yang ada; kebutuhan migrasi untuk revision/idempotency/constraint harus dinilai dan diberitahukan sebelum promosi Staging.

Dokumen ini adalah usulan desain, bukan `implementation_plan.md`. Rencana implementasi terpisah nantinya wajib menyertakan execution checklist dan potongan kode before/after sesuai SOP proyek.
