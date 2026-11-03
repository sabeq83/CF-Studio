# Demonstrasi CF Content Planner

Contoh fiktif untuk review manual. Tidak memakai API, database, atau history brand. Struktur ketiga contoh lulus helper; kualitas kreatif ditinjau langsung. Tidak ada pemeriksaan tren atau riset klaim eksternal.

## Brand Editorial tanpa pilar

Pemanggilan: `Gunakan $cf-content-planner untuk membuat 6 ide Instagram Dapur Praktis tanpa pilar konten.`

| CEP | VFO | Hook | Visual Action |
|---|---|---|---|
| Emotional Based | Instinctive | Pagi terasa lebih tenang saat alat bekal sudah menunggu. | Top view tangan menyisihkan wadah dan alat di satu baki; cut ke baki yang diambil keesokan pagi. |
| Aspirational Based | Uncharted | Ingin dapur tertata? Mulai dari fungsi alat, bukan ukurannya. | Top view laci; tangan mengelompokkan alat sesuai fungsi menakar, mengaduk dan menjepit, lalu memberi label sederhana. |
| Commitment Based | Aspirational | Rapikan dapur untuk versi dirimu yang suka membawa bekal. | Kamera mengikuti pekerja menaruh wadah bersih di rak mudah dijangkau, lalu mengambilnya saat bersiap besok. |
| Opportunistic Based | Concrete | Lauk makan malam masih ada? Pisahkan jatah bekal sebelum meja dibereskan. | Overhead dua tangan bergantian menyisihkan lauk ke dua wadah, menutupnya, lalu memberi tanda pemilik. |
| Problem-Solution Based | Instinctive | Dari bunyi geser ke gerakan stabil: coba alas kain lembap. | Close-up kain bersih dilembapkan dan diratakan di bawah papan; tangan menekan papan sebelum mulai mengiris. |
| Routine Based | Uncharted | Kenapa alat ini selalu jauh saat paling dibutuhkan? | POV tangan menjangkau alat di tiga tempat; overlay menandai frekuensi pemakaian, lalu alat harian diletakkan dekat meja kerja. |

Kolom Pilar dihilangkan; JSON memakai pillar=null. CTA: save. Riwayat tidak tersedia, sehingga pengecekan hanya dalam batch.

## Product Campaign dengan pilar

Pemanggilan: `Gunakan $cf-content-planner untuk 6 ide TikTok Kotak Bekal Duo, dengan pilar Persiapan bekal dan Penataan meja.`

| Pilar | VFO | Hook |
|---|---|---|
| Penataan meja | Instinctive | Dengar bunyi kecil rutinitas bekal: isi dua ruang, lalu tutup. |
| Persiapan bekal | Uncharted | Ada dua menu dari makan malam? Sekat ini membantu menatanya terpisah. |
| Penataan meja | Aspirational | Bekal sering batal karena bingung menata? Mulai lagi dengan dua ruang sederhana. |
| Persiapan bekal | Concrete | Sebelum menutup bekal, lihat apakah dua kompartemennya sudah terpakai. |
| Penataan meja | Instinctive | Saat ingin menikmati bekal pilihan sendiri, mulai dari menatanya pelan-pelan. |
| Persiapan bekal | Uncharted | Ingin bekal tampak tertata? Pahami dulu fungsi dua ruangnya. |

Produk contoh hanya diketahui memiliki dua kompartemen. Tidak ditambahkan klaim antibocor, aman microwave, atau ketahanan suhu.

## Recipe Campaign organic

Pemanggilan: `Gunakan $cf-content-planner untuk 3 ide minuman organic Instagram tanpa produk bermerek.`

| Resep | Hook | Estimasi persiapan + masak |
|---|---|---|
| Air jeruk nipis dingin | Jeruk nipis dan air: racikan sederhana untuk sore ini. | 2 + 0 menit |
| Susu kayu manis hangat | Aroma kayu manis dari cangkir hangat buatan sendiri. | 2 + 5 menit |
| Teh jahe sederhana | Dua iris jahe untuk menemani teh soremu. | 2 + 5 menit |

Bahan, takaran, langkah dan tips ada dalam JSON. Durasi/porsi adalah estimasi dan resep belum diuji di dapur. Produk dan primary_product_id=null; featured_products=[].

## Review dan batas

- Struktur: jumlah, distribusi, field terkunci, produk dan duplikat exact lulus untuk ketiga mode.
- Regenerasi hook pertama editorial diuji tanpa perubahan pada row/field lain.
- Review makna: visual berupa tindakan yang dapat dilakukan; contoh tidak mengklaim manfaat kesehatan, popularitas tren atau testimoni.
- Penilaian kesesuaian angle dan variasi adalah review kreatif, bukan skor semantic similarity terukur.
- File *-skeleton.json menjadi acuan untuk validasi ulang final; JSON ini bukan payload impor aplikasi.
