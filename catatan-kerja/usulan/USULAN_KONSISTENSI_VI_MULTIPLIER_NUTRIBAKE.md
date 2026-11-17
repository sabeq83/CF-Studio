# Analisis dan usulan konsistensi VI Multiplier NutriBake

Tanggal: 17 November 2026. Tenant: `default_tenant`. Status: usulan, belum mengubah konfigurasi atau aplikasi.

## Kesimpulan

Blueprint dapat memengaruhi hasil melalui deskripsi storyboard sumber, tetapi bukti yang ditemukan lebih kuat menunjuk pada identitas tangan yang tidak ditentukan di VI, variasi konfigurasi historis, dan generasi klip independen melalui pure T2V. Belum ada pembuktian visual terhadap klip yang dikeluhkan; warna kulit gelap atau keriput yang dilaporkan pengguna belum dicocokkan dengan video tertentu.

## Audit tambahan: lima kampanye produk pada Staging aktif

Diperiksa langsung melalui SSH dan PostgreSQL schema staging, tenant default_tenant. Release aktif saat audit: `20261117T085627Z-b73ebd2750ea`. Pemeriksaan mencakup plan, result, snapshot VI, path start frame, QC tersimpan, 30 audit request T2I, dan kode release server. Tidak menonton ulang video atau menilai kulit tangan langsung dari gambar; hasil visual di bawah merupakan laporan QC tersimpan, bukan penilaian manual baru.

| Kampanye | Jalur | Wardrobe terpilih | Acuan wardrobe tersimpan | QC frame |
|---|---|---|---|---|
| cst_52297e6d793f — Roti selai kacang, sarapan lima menit | CFA, custom storyboard | Terracotta Clay Linen | wardrobe_ref_2215.jpg | 6/6 pass; wardrobe/lokasi konsisten |
| cst_f98999504f2e — Sarapan sehat tanpa masak pagi-pagi | CFA, custom storyboard | Deep Sage Linen | Tidak ada | 6/6 pass; wardrobe/lokasi konsisten |
| cst_469a240b634b — Dark chocolate hangat, manisnya kamu yang atur | CFA, custom storyboard | Terracotta Clay Linen | wardrobe_ref_2213.jpg | 5/6 pass; klip 2 berantakan, wardrobe/lokasi konsisten |
| opc_261115_0ifvbi — Rolled Oat Premium Sahabat | Autonomous Product Campaign | Deep Maroon Cotton | wardrobe_ref_2197.jpg | 6/6 pass individual, tetapi cross-clip mencatat marble di klip 4 dan 6 |
| opc_261115_h45uqd — Premix Cocoa Powder Premium | Autonomous Product Campaign | Deep Charcoal Linen | wardrobe_ref_2195.jpg | 6/6 pass; wardrobe/lokasi konsisten |

Tiga CFA dibuat 16 November 2026 WIB; dua Product Campaign dibuat 15 November 2026 WIB. Semua completed, hybrid_lock, enam start frame per kampanye, model video pada campaign omni_flash. Snapshot result kelimanya merujuk VI NutriBake versi 4; kolom versi pada campaign dapat bernilai 1, sehingga metadata versi perlu diselaraskan. Asal dua Product Campaign cocok dengan row content_kind/product_campaign dan penamaan ingest pada autonomous-engine.js:691; tidak ada baris auto_pipeline_jobs yang terhubung langsung saat audit, sehingga tidak dapat menentukan apakah dipicu tombol, MCP, atau jadwal tertentu.

### Mekanisme nyata yang menjelaskan stabilitas

1. **Scene Director dan variety yang dipersistenkan.** Result menyimpan resolved_scene_brief dan resolved_wardrobe_color. Warna boleh berbeda antar-video, tetapi satu pilihan dipakai seluruh klip video yang sama.
2. **Prompt final diolah kembali sebelum dikirim.** Kode server `opc-start-frame-request.js:120` mengganti blok Presence/Biometric Anchor dan Wardrobe berdasarkan variety/policy. Karena itu prompt T2I yang tersimpan di plan masih dapat menyebut oatmeal, sementara frame/QC menunjukkan terracotta atau sage. Membaca prompt plan saja belum menjelaskan request efektif.
3. **Referensi bersama berisi tangan + busana, bukan sekadar foto produk.** `buildWardrobeReferencePrompt` secara eksplisit meminta sepasang tangan perempuan Indonesia dan pakaian terpilih, tanpa produk. Scheduler membuat satu gambar per video; shared builder melampirkannya ke klip yang sesuai. Empat sampel mempunyai referensi ini. Audit request klip nonproduk 1–2 masing-masing mencatat reference_count=1 pada empat sampel tersebut; sampel tanpa referensi wardrobe mencatat 0. Audit count tidak menyimpan identitas seluruh context refs, tetapi selaras dengan path referensi dan kode builder.
4. **I2V mempertahankan start frame.** Setiap klip memiliki gambar awal; animasi tidak menentukan ulang seluruh penampilan dari teks kosong.
5. **Prioritas eksplisit antar-referensi.** Builder menambahkan aturan warna sleeve mengikuti wardrobe reference dan mengabaikan warna pakaian pada foto produk bila bertentangan.
6. **QC lintas-klip tersedia, tetapi report_only.** Ini observabilitas, bukan jaminan koreksi. Temuan marble di cross-clip meskipun pass_count=6 menunjukkan perlunya menyelaraskan verdict individual dan lintas-klip.

### Koreksi atas analisis awal

Stabilitas bukan hanya efek foto produk atau VI yang lebih rinci. Ada lapisan normalisasi prompt, pilihan wardrobe per-video, gambar tangan/busana bersama, dan start frame. Bahkan satu sampel tanpa gambar wardrobe tetap konsisten menurut QC; referensi bersama membantu tetapi tidak terbukti sebagai satu-satunya sebab. QC saat ini tidak membuktikan kesamaan usia atau tone kulit secara khusus. Mengganti seluruh jalur menjadi karakter/lengan modest hardcoded juga bukan kepatuhan VI penuh: VI NutriBake justru menyebut rolled sleeves/forearms_exposed, sementara variety terpilih meminta pergelangan tertutup.

### Usulan lintas jalur yang diperbarui

- Gunakan satu layanan bersama pembentukan identitas visual untuk CFA, Auto Pipeline, RE, dan Multiplier: snapshot VI → talent tetap → wardrobe variation yang diizinkan → prompt efektif → reference manifest → start frame → animasi → QC.
- Adopsi mekanisme normalisasi dan referensi bersama dari OPC, bukan menyalin seluruh policy modest, lengan tertutup, atau karakter default Indonesia ke semua VI. Semua sifat utama harus diturunkan dari VI; rotasi warna hanya dari palette yang diizinkan.
- Untuk Multiplier, pertahankan blueprint sebagai aksi/bahan/resep/pacing; hilangkan atribut talent, busana, dan set sumber yang bertentangan. Pakai builder bersama dengan adapter data Multiplier, bukan memaksakan skema tabel pillar.
- Jalur hybrid memakai satu gambar tangan+wardrobe per-video pada tiap klip bertangan. Jika ingin talent yang sama lintas-video meski warna pakaian berubah, tambahkan master reference talent per-brand lalu turunkan reference wardrobe per-video dari master tersebut; saat ini reference netral dibuat per-video, jadi belum menjadi lock talent lintas-kampanye.
- Pure T2V bisa menerima normalisasi prompt dan snapshot yang sama, tetapi tidak mendapat kekuatan acuan gambar melalui mekanisme ini. Tawarkan mode konsistensi tinggi hybrid untuk kampanye yang menuntut identitas stabil.
- Klip objek tanpa tangan, CGI biologis, dan karakter Universe tetap memakai policy yang sesuai; jangan menyuntikkan tangan atau pakaian secara universal.
- Simpan prompt efektif dan hash/metadata semua referensi, pisahkan dari draft Gemini, agar audit tidak salah membaca prompt lama. Satukan metadata versi VI campaign dan snapshot.
- Perluas QC dengan usia tampak, tone dalam kondisi cahaya sebanding, dan kontinuitas tangan; jadikan cross-clip outlier sebagai needs_review. Uji enforce bertahap dengan batas retry agar biaya terkendali.
- Uji dua blueprint Multiplier pada Dev melawan baseline; tinjau manual tangan, wardrobe, meja, resep, serta biaya/latensi. Belum ada perubahan konfigurasi, implementasi aplikasi, atau produksi baru dari audit ini.

## Bukti data aktif

- Identitas MCP awal berada pada tenant lain; pemeriksaan berikutnya dilakukan setelah beralih ke `default_tenant`.
- VI `vi_nutribake_modern_pastry`, versi 4, aktif; pembaruan terakhir 1 November 2026 UTC. Subject memakai `human`, `hands_only`, demografi `custom`.
- Deskripsi subject hanya mengatur tangan di luar fokus, bokeh, dan fokus pada makanan. Tidak menetapkan usia, jenis kelamin, warna kulit, atau ciri tangan. Guardrail identity_drift berupa larangan tekstual; bukan bukti adanya penguncian visual.
- Negative prompts berisi larangan wajah, busana syari, marble veining, slate hitam, botol herbal, dan permukaan berminyak; tidak menentukan karakteristik usia tangan.
- Preset `multiplier_nutribake` saat diperiksa menunjuk VI tersebut, tetapi mesin visual memakai `pure_t2v`, model `veo_31_lite`, 3 klip x 8 detik. Kolom legacy masih memuat syari_classic dan wardrobe sequential; jalur resolver yang berhasil seharusnya mendahulukan VI eksplisit.
- Dari 76 task NutriBake yang dikembalikan alat: 32 menyimpan ID VI NutriBake, 37 memakai `custom`, dan 7 tidak memiliki ID eksplisit. Angka ini mencakup task historis dan berbagai status, bukan persentase video yang gagal. ID yang tidak eksplisit tidak otomatis berarti VI tidak diterapkan karena worker dapat mencari melalui preset/brand.
- Task terbaru `mul_261117_tcnqtm`: prompt menyertakan oatmeal sleeves dan quartz sesuai VI, tetapi anchor subject tetap berupa kalimat abstrak tentang gerakan tangan/bokeh, tanpa usia atau warna kulit.
- Task `mul_261117_vc3tw3`: anchor sama; lokasi klip 1 menjadi “Warm Indonesian home kitchen counter” alih-alih lingkungan quartz lengkap. Ini bukti kelonggaran penerjemahan instruksi visual ke prompt.
- Task lama `mul_261108_s6so1p` memiliki prompt tangan Asia Tenggara terang, lengan panjang olive, dan meja marble. Prompt itu berbeda dari VI aktif saat ini; jangan membandingkan seluruh hasil historis seolah dibuat dari konfigurasi yang sama.
- Pada teks original_storyboard seluruh 76 task tersebut tidak ditemukan kata keriput/wrinkle/dark skin/black skin/kulit hitam. Ini tidak membuktikan video sumber tidak memiliki karakteristik tersebut, tetapi tidak mendukung dugaan penyalinan deskripsi itu secara eksplisit.

## Temuan kode lokal

- `lib/re-multiplier-worker.js:377`: original storyboard dimuat sebagai JSON. `:611` memasukkannya bersama VI ke generator prompt remake. Blueprint tetap dapat membawa deskripsi talent, meja, dan lighting yang bersaing dengan VI.
- `lib/prompts.js:4351`: storyboard sumber dikirim lengkap sebagai template; `:4034` dan `:4086` memasukkan negative VI ke instruksi generator. Instruksi ini belum sama dengan validasi wajib pada hasil prompt.
- `lib/visual-override-resolver.js:235`: custom_description dibungkus menjadi “forearms and hands of ...”. Karena isi NutriBake menjelaskan sinematografi, bukan orang, prompt aktual menjadi “hands of Minimalist out-of-focus hand movement ...”. Ini mengurangi kejelasan subjek.
- `lib/re-multiplier-worker.js:959`: jalur T2I yang diperiksa melampirkan foto produk pada klip bridge, tanpa acuan tangan bersama. `:1231` memilih start frame jika tersedia; bila tidak, memakai T2V. Pada pure T2V, teks sama tidak memberikan jangkar gambar talent antar-klip.
- Analisis kode berdasarkan checkout lokal, bukan verifikasi kesamaan SHA server aktif. Data konfigurasi dan task dibaca melalui MCP server.

## Usulan prioritas

1. **Perjelas subject VI terlebih dahulu.** Pisahkan deskripsi talent dari gaya kamera. Draf: “Same adult female baker aged 25–35 across all clips, light-to-medium warm beige skin tone, smooth natural skin with normal fine creases, slender fingers, short clean unpolished nails, no jewelry; hands and forearms only.” Ini pilihan casting untuk konsistensi brand, bukan penilaian warna kulit. Usia dan tone merupakan usulan untuk ditinjau pengguna. Pertahankan oatmeal rolled sleeves; jangan mencampurnya dengan aturan legacy lengan panjang hingga pergelangan.
2. **Pisahkan warisan blueprint dari identitas brand.** Blueprint hanya mewariskan bahan, urutan aksi, teknik resep, pacing, dan struktur hook. VI mendominasi talent, pakaian, meja, pencahayaan, dan kamera. Saring atribut visual sumber yang bertentangan sebelum generasi.
3. **Validasi setiap prompt sebelum dikirim ke renderer.** Pastikan anchor talent dan lingkungan wajib hadir konsisten pada semua klip yang menampilkan tangan. Tambahkan ulang blok VI secara deterministik; jangan hanya mengandalkan Gemini menyalin aturan. Jika VI gagal di-resolve, hentikan dengan pesan jelas, bukan melanjutkan fallback diam-diam.
4. **Simpan snapshot VI dan versi per task.** Catat ID, versi, resolved subject, environment, negative prompts, dan mode visual. Retry memakai snapshot yang sama; perubahan VI diterapkan melalui regenerate eksplisit agar dapat diaudit.
5. **Untuk konsistensi lebih kuat, uji hybrid dengan referensi visual tangan.** Buat satu referensi talent/meja yang disetujui, lampirkan pada start frame tiap klip, lalu I2V. Mengubah pure_t2v ke hybrid saja belum cukup jika tiap start frame tetap dibuat independen tanpa referensi bersama. Periksa dukungan model, latensi, dan biaya sebelum aktivasi.
6. **QA terarah.** Review frame untuk kesamaan talent, tone dalam pencahayaan netral, detail usia tangan, pakaian, meja, dan anatomi. Regenerate hanya klip yang menyimpang. Tidak perlu menambah call penulisan storyboard kedua.

## Pembuktian sebelum perubahan luas

- Pilih 2 video bermasalah dan 1 yang sesuai; cocokkan task, klip, prompt, versi VI, dan start frame untuk menentukan apakah drift sudah muncul pada gambar atau baru saat animasi.
- Bandingkan blueprint yang sama: konfigurasi sekarang, VI diperjelas, lalu hybrid dengan referensi bersama. Gunakan setidaknya dua percobaan per kondisi karena satu hasil tidak menunjukkan kestabilan.
- Kriteria: seluruh klip bertangan mengikuti talent dan wardrobe yang sama, lingkungan mengikuti VI, bahan serta aksi resep tetap sesuai blueprint. Catat hasil manual dan biaya aktual.
- Implementasi kode kelak dilakukan di branch terpisah dan diuji di Dev sesuai SOP; usulan ini tidak mengubah VI, task, atau mengonsumsi kuota generasi.
