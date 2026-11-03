# Strategi ContentFlow untuk planner

## CEP dan W’s

Alur ON: Pillar → CEP → W’s → Context → VFO → Angle → Narrative → Hook → Visual Action.
Alur OFF langsung dimulai dari CEP, tanpa pertimbangan atau kuota pilar tersembunyi.

| Label CEP (persis untuk JSON) | Pemicu ide |
|---|---|
| Problem-Solution Based | Masalah konkret dan tindakan yang relevan |
| Routine Based | Aktivitas berulang yang sudah menjadi kebiasaan |
| Emotional Based | Emosi sebagai pemicu keputusan |
| Aspirational Based | Keadaan/identitas yang ingin dicapai |
| Commitment Based | Upaya berulang yang memerlukan komitmen |
| Opportunistic Based | Pemicu eksternal tak terencana; jangan mengarang promo |

Pilih setidaknya dua dimensi W’s: `When`, `Where`, `With/For Whom`, `How Feeling`, `While`, `With What`, `Why`. Konteks harus benar-benar menyatakan situasinya, bukan mengulang label (misal When+While: sebelum berangkat kerja sambil menyiapkan bekal). W’s/CEP dapat digunakan ulang; konteks, angle, pembukaan hook dan visual perlu bervariasi.

## VFO dan kompatibilitas angle

Label VFO disederhanakan untuk kontrak mandiri: Concrete, Instinctive, Uncharted, Aspirational.

| VFO | Nilai yang diperlihatkan | Angle yang didukung |
|---|---|---|
| Concrete | Fungsi, tindakan, bukti yang dapat diamati | The Life Hack; The Scientific Proof; The Math Whiz; The Stress Test; The Problem You Didn't Know |
| Instinctive | Indra, tekstur, pengalaman emosional | The Guilty Pleasure; The Pure Relief; The Sensory ASMR; The Safe Haven |
| Uncharted | Penjelasan, asal-usul, sudut pandang baru | The Origin Story; The Scientific Proof; The Intellectual Flex |
| Aspirational | Identitas, cita-cita, kepedulian, rasa memiliki | The Second Chance; The Status Signal; The Artist; The Belonging; The Caregiver |

Ini subset terkurasi decision tree, bukan seluruh Infinite Angle Matrix. Jika brief membutuhkan angle lain, jelaskan batas paket dan usulkan angle dalam daftar; jangan mengubah kontrak diam-diam. Scientific Proof membutuhkan sumber yang mendukung klaim; Math Whiz membutuhkan angka dari brief/sumber atau perhitungan transparan. Hindari klaim medis, jaminan hasil dan testimoni rekaan.

Pilih CEP yang sesuai situasi, VFO yang benar-benar didukung produk/topik, lalu angle yang sesuai keduanya. Distribusi bukan izin memaksakan klaim: untuk Concrete tanpa data numerik gunakan demonstrasi tindakan; untuk Uncharted gunakan penjelasan yang sudah diketahui, bukan penemuan fiktif. Jika kuota/brief mustahil dipenuhi dengan jujur, laporkan kendala sebelum menghasilkan klaim.

## Kreatif dan pemeriksaan

Skeleton memuat strategi; generasi kreatif hanya menambahkan hook dan visual. Hook menyampaikan inti konteks/angle dengan bahasa audiens. Visual menyebut aksi dan gerak kamera yang bisa dilakukan. Produk hanya muncul jika diberikan eksplisit, dengan peran alami. Brand editorial tanpa produk memvisualkan aktivitas/topik dan CTA engagement.

Narrative mode mengikuti tujuan: awareness dapat memakai pembukaan kuat, cerita emosional memakai perubahan keadaan, faceless dapat memakai objek/tangan. Metafora harus jelas sebagai ilustrasi, bukan bukti ilmiah. Gaya visual boleh dipilih pengguna, tidak wajib Cinematic.

Review variasi: situasi, objek, lokasi, sudut pandang, jenis aksi dan pembukaan kalimat. Jangan sekadar mengganti sinonim. Gunakan history yang tersedia; tanpa history jangan menjanjikan keunikan sepanjang riwayat brand. Pengukuran similarity numerik tidak tersedia dalam helper ini.

## Provenance dan adaptasi

Disarikan 3 November 2026 dari MAKNA Flow commit `0fd0b9268aff2d64f43c5875175398f6848a533c`: `kb/STRATEGIC_FRAMEWORKS_v47.9.md` (header internal v47.9.6), `kb/STRATEGIC_DECISION_TREE.md`, `lib/kb-loader.js`, `lib/content-planner-engine.js`, `lib/content-planner-contract.js`. Ada perubahan lokal yang belum di-commit pada contract/engine saat inspeksi; dukungan OFF skill didefinisikan eksplisit dan tidak bergantung pada perubahan itu.

Adaptasi disengaja: tidak mewajibkan trend research untuk brief evergreen; tidak membawa aturan lama 48 ide atau seluruh publishing layer; memakai enum VFO ringkas; editorial OFF 1–30; tidak memanggil Gemini. Prinsip strategi tetap diambil dari sumber, sedangkan format JSON dan helper adalah kontrak skill mandiri.
