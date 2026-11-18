# Usulan Radar Produk — hasil TeleRadar masuk ke CF Studio untuk dikurasi

Tanggal: 19 November 2026
Status: analisis dan usulan; belum implementasi, migrasi, atau perubahan layanan.

## Rekomendasi

Buat menu **Radar Produk** di kelompok PLANNING, berdekatan dengan Product Database. Subjudul: **Temukan, kurasi, lalu masukkan produk pilihan ke katalog.**

Hasil riset otomatis masuk ke tabel riset tersendiri. Produk baru masuk `product_extractions` setelah pengguna menekan **Masukkan ke Database Produk**. Kandidat riset tidak tersedia di pemilih produk kampanye atau Auto Pipeline.

Alternatif nama: **Product Radar** (selaras dengan menu berbahasa Inggris), **Discovery Lab** (lebih luas tetapi kurang langsung), **Inbox Produk** (jelas tetapi kurang mencerminkan analisis tren). Pilihan utama: Radar Produk.

## Temuan dari Mac Mini

Inspeksi read-only pada 19 November 2026:

- Folder `~/riset-produk` berisi data dan aset; kode operasional berada di `~/.claude/skills/teleradar/scripts/`.
- `teleradar_lib.py:17` mendefinisikan kolom riset: identitas, kategori, rank, penjualan, tren, komisi, harga, URL, deskripsi, USP, persetujuan, status CF dan ID produk.
- `sheet_sync.py:55` menarik edit pengguna dan persetujuan dari Sheet. `cmd_push` pada baris 206 menarik edit lebih dahulu, lalu menulis ulang tab mingguan.
- `teleradar_bot.py:194` menangani `/kirim` dengan mencentang Sheet; `/url` memperbaiki URL di Sheet. Bot tidak menjalankan riset/scraper sendiri.
- `nextcloud_foto.py` mengunggah thumbnail ke Nextcloud lewat WebDAV. `buat_excel.py` membuat Excel; `riset_tg.py` menangani Telegram.
- Dokumen operasional `~/.claude/skills/teleradar/SKILL.md` menetapkan Google Sheets sebagai sumber utama setelah riset. Fase B memakai MCP scraper CF Studio setelah persetujuan, mengecek hasil, lalu memperbarui deskripsi/USP.
- Jadi output saat ini lebih tepat disebut **Google Sheets + Excel Telegram + foto Nextcloud**, bukan sekadar unggahan hasil ke Google Drive.
- Foto potongan screenshot adalah foto pengenal beresolusi rendah. Foto katalog seharusnya tetap berasal dari listing dan proses foto CF Studio.

Snapshot lokal `~/riset-produk/2026-11-17/data.json`: **45 kandidat**, terdiri atas 6 Naik, 28 Stabil, 11 Menurun. Status URL: 22 Resmi, 6 Listing, 14 Terdekat, 2 Tidak ditemukan, 1 Dari pengguna. Ada 3 disetujui dan 3 memiliki `cf_product_id`; satu status siap, dua perlu review foto. Ini snapshot file lokal, bukan pembacaan langsung Sheet atau verifikasi ulang seluruh produk di database.

Kontrak scraper juga diperiksa pada Staging aktif, SHA `bec6b731f77904ed8397273a7e3a046e9bcb886b`: endpoint mengembalikan `job_ids` dan dapat mencadangkan `product_id`. **ID dari respons awal bukan bukti pekerjaan selesai.**

## Alur yang diusulkan

1. Screenshot masuk melalui Telegram seperti sekarang.
2. TeleRadar membaca dan meriset produk; menyimpan JSON lokal untuk pemulihan.
3. Adapter baru mengirim batch, kandidat, dan foto pengenal ke API Radar Produk CF Studio.
4. Pengguna membuka Radar Produk, membandingkan kandidat, memperbaiki URL/deskripsi/USP, dan memilih produk.
5. Tombol **Masukkan ke Database Produk** memvalidasi URL dan kecocokan produk, memeriksa duplikat, lalu memasukkan pekerjaan ke antrean scraper yang ada.
6. Radar menampilkan progres dan hasil. Produk yang sudah ada cukup ditautkan setelah kecocokannya dipastikan; produk baru menampilkan tombol **Buka di Database Produk**.
7. Foto atau enrichment yang gagal punya status dan aksi pemulihan; kegagalan tidak membuat produk baru lagi saat dicoba ulang.

Simpan riwayat kandidat setelah masuk katalog agar sumber riset tetap bisa ditelusuri. Aksi arsip kandidat tidak menghapus produk katalog.

## Konsep antarmuka

Halaman utama memakai tabel untuk membandingkan banyak kandidat, dengan foto kecil. Filter: batch/tanggal, kategori, tren, rekomendasi, status URL, status kurasi, dan status masuk katalog.

Kolom inti: foto, nama, kategori, terjual/minggu, tren, komisi, harga, kecocokan URL, status, aksi. Cantumkan tanggal pengamatan; angka penjualan/komisi berasal dari screenshot, bukan data pasar real-time.

Klik baris membuka panel detail berisi screenshot sumber, thumbnail, catatan tren, listing tujuan, deskripsi/USP hasil riset, edit pengguna, serta riwayat proses. Bedakan **produk sumber screenshot** dengan **listing tujuan**: label Terdekat berarti belum terbukti produk yang sama.

Aksi: **Masukkan ke Database Produk**, **Lengkapi URL**, **Hubungkan Produk yang Sudah Ada**, **Arsipkan**, dan setelah berhasil **Buka Produk**. Batch action dapat disediakan untuk pilihan yang lolos validasi; tampilkan ringkasan jumlah valid, duplikat, dan yang tertahan sebelum eksekusi.

Status kurasi: Baru / Perlu dilengkapi / Siap diajukan / Diarsipkan. Status proses terpisah: Belum dikirim / Antre / Diproses / Masuk katalog / Perlu review / Gagal. Status pekerjaan dan kesiapan foto/enrichment tidak disatukan menjadi satu teks bebas.

Ini konsep untuk dibahas. Mockup HTML interaktif wajib dibuat dan disediakan lewat Staging untuk review sebelum menulis React/Next.js, sesuai SOP proyek. Mockup memakai token semantik mandiri dan mendukung light/dark.

## Desain penyimpanan dan API

Usulan tabel baru, terisolasi per tenant:

| Tabel | Isi |
|---|---|
| `product_research_batches` | Sumber TeleRadar, ID batch stabil, tanggal pengamatan, waktu sinkron, metadata |
| `product_research_candidates` | ID kandidat stabil, data riset asli, hasil kurasi, lokasi aset, status, revisi, relasi produk katalog |
| `product_research_imports` | Riwayat tindakan, pengguna yang menyetujui, ID pekerjaan scraper, hasil/error, waktu proses |

API usulan: ingest batch melalui `/api/operator/v2/product-research/batches`; listing/detail/edit melalui `/api/v2/product-research/...`; aksi promosi kandidat melalui `.../[id]/promote`. Nama masih rancangan, belum endpoint tersedia.

- Gunakan autentikasi operator dan tenant context CF Studio. Tenant berasal dari kredensial/identitas yang tervalidasi, bukan dipercaya dari payload.
- Scope ingest riset dipisahkan dari izin memasukkan produk katalog. Izin menu usulan: `product_research`.
- Kunci unik ingest: tenant + sumber + ID batch + ID kandidat. Nomor urut saja tidak cukup; tanggal saja juga tidak cukup bila satu hari ada beberapa batch. Untuk migrasi, tanggal dan nomor lama bisa menjadi external key yang dipertahankan.
- Pengiriman ulang harus idempotent; simpan perubahan riset tanpa menimpa edit kurator atau mereset status promosi.
- Klaim pekerjaan promosi secara atomik, lalu enqueue dengan idempotency key. Simpan relasi kandidat–job–produk dan rekonsiliasi kegagalan di antara penyimpanan dan enqueue.
- Cocokkan duplikat memakai identitas listing/URL ternormalisasi dalam tenant. Nama mirip hanya saran untuk diperiksa, bukan bukti produk sama. Data riset minggu berbeda tetap disimpan sebagai pengamatan berbeda.
- Foto riset disalin ke shared storage khusus riset, tidak bergantung pada path lokal Mac Mini atau tautan Nextcloud di browser. Validasi tipe/ukuran dan otorisasi akses aset; jangan memakai thumbnail sebagai foto studio.
- Pertahankan hasil riset asli dan hasil edit secara terpisah. Simpan sumber dan waktu observasi. Jangan otomatis mengubah angka tren menjadi fakta permanen produk.

## Memakai kembali kemampuan CF Studio

Kartu `sot/menus/kartu/products.md` dan kode lokal `lib/product-repository.js`, `lib/product-catalog-service.js`, `app/api/v2/products/scrape/route.js`, serta `lib/operator-auth.js` menjadi referensi integrasi. Branch lokal saat inspeksi: `fitur/enrich-vision-kemasan`; detail final wajib dicocokkan dengan main terbaru saat implementasi.

Gunakan kembali layanan antrean scraper, validasi katalog, foto, dan enrichment. Jangan menggunakan `cf_add_product` atau importer ZIP untuk ingest riset: jalur itu menulis langsung ke katalog. Tambahkan adapter/API riset tersendiri.

Saat promosi, URL berstatus Terdekat/Tidak ditemukan/Tidak diriset tertahan sampai pengguna memilih listing yang benar. Validasi sintaks URL saja tidak membuktikan halaman hidup atau produknya cocok. URL dari pengguna tetap harus diperiksa. Jika produk sudah ada, tautkan tanpa otomatis menimpa deskripsi, foto, atau afiliasi.

Untuk produk baru, gunakan hasil scrape sebagai bahan dasar dan tampilkan perbedaan dengan teks kurasi; jangan menimpa teks yang telah disetujui dengan enrichment berikutnya. Terapkan aturan bahasa Product/Geometric Truth yang berlaku di katalog.

## Peralihan dari Sheets

Rekomendasi akhir: **CF Studio menjadi sumber utama kurasi dan persetujuan; JSON lokal sebagai buffer pengiriman; Sheets/Excel menjadi ekspor opsional.**

Peralihan harus menyertakan bot dan instruksi TeleRadar, bukan hanya menambah pengiriman JSON:

1. Impor batch lama setelah menarik edit Sheet terakhir; pertahankan ID produk yang sudah tercatat dan verifikasi kepemilikannya dalam tenant. Jangan memicu promosi hanya karena mengimpor persetujuan lama.
2. Verifikasi jumlah, foto, URL, edit, dan status. Pada uji Dev, ID produk Staging diperlakukan sebagai referensi historis sampai cocok dengan lingkungan Dev; jangan mengakses Staging dari uji Dev.
3. Tetapkan waktu perpindahan: hentikan sumber persetujuan lama untuk batch yang telah dipindahkan. Jangan menjalankan dua konsumen promosi bersamaan.
4. Arahkan `/top`, `/produk`, `/status`, dan `/url` bot ke API CF Studio. Untuk tahap pertama, `/kirim` dapat membalas tautan review kandidat; jika approval lewat bot tetap dibutuhkan, wajib memakai layanan promosi yang sama dan otorisasi pengguna/batch yang jelas.
5. Ubah instruksi Fase A agar ingest ke Radar; Fase B lama berhenti memanggil scraper langsung untuk batch yang dikelola Radar. Google Sheets tidak lagi menarik balik edit setelah perpindahan.

Jika CF Studio sementara tidak tersedia, riset tetap tersimpan lokal dengan status belum tersinkron dan dikirim ulang kemudian. Gagal sinkron tidak boleh membatalkan persetujuan atau membuat duplikat.

## Cakupan awal dan verifikasi

Tahap awal: ingest idempotent, migrasi satu batch, tabel + panel review, edit URL/deskripsi/USP, promosi satuan, pelacakan job, penanganan duplikat dan arsip. Bulk approval, perbandingan tren lintas minggu, skor peluang, dan perintah bot lengkap dapat menyusul.

Skenario verifikasi utama: ingest 45 kandidat tidak menambah katalog; sinkron ulang tidak menggandakan data atau menghapus edit; kandidat tanpa listing benar tertahan; klik ganda/retry hanya membuat satu pekerjaan; tenant lain tidak bisa membaca/promosi; kegagalan foto tetap dapat dipulihkan; kandidat yang sudah punya produk tidak di-scrape ulang; migrasi tidak menjalankan persetujuan historis.

Pengembangan dilakukan di branch fitur baru dari main terbaru, lalu Dev. Karena perlu tabel baru, migrasi harus dijelaskan sebelum naik Staging. Naik Staging mengikuti persetujuan lolos uji Dev dan masa uji minimal satu hari atau pengecualian eksplisit. Tidak ada deployment yang dilakukan pada tahap usulan ini.

Menu Radar Produk belum ada kartunya; buat kartu baru dan perbarui peta menu saat fitur dirilis.
