# Hasil Uji Prompt VO Baru (A/B)

Tanggal: 14 Nov 2026 · Lokasi: server staging (rilis v2.44.22), key pool dan model CF Studio sendiri · Kode aplikasi **tidak diubah**, DB hanya dibaca.

## Cara uji

- 6 kasus nyata: 4 kampanye pilar (Ruang Akustik keyword, Solusi Thermal keyword harga, Garlibee produk, Sasyahouse 8 klip) dan 2 multiplier (Siasat Sehat masker, Dapur Botani rempah).
- **Lama** = `buildOrganicPillarPrompt` / `buildMultiplierPhase2Prompt` apa adanya, dengan data kampanye asli dari DB.
- **Baru** = prompt lama + tambalan dari `newprompts.mjs`:
  - **pilar:** 1 panggilan "planner isi" (takeaways + jawaban keyword), lalu Kontrak Isi VO disisipkan dan mandat "Padahal/Nah/Hasilnya" dibuang;
  - **multiplier:** Kontrak Resep Sumber dan larangan klaim di VO.
- Dua putaran: v1, lalu v2 setelah perbaikan kelemahan v1.
- File: `harness.mjs`, `newprompts.mjs`, `score.py`, `results_r1.json`, `results_v2.json`.

## Skor (putaran v2 untuk pilar, v1 untuk multiplier)

"Berpegangan" artinya klip isi memuat angka/takaran/durasi, titik, urutan, atau kriteria.

| Kasus | Versi | Klip isi berpegangan | Kata samar tanpa pegangan | Kata transisi formula | Klaim | Bahan sumber |
|---|---|---|---|---|---|---|
| Ruang Akustik (keyword) | produksi | 0/2 | 2 | 3 | – | |
| | lama | 0/2 | 5 | 3 | – | |
| | **baru** | **2/2** | **0** | **0** | – | |
| Solusi Thermal (harga/roll) | produksi | 1/2 | 1 | 2 | – | |
| | lama | 1/2 | 0 | 2 | – | |
| | **baru** | **2/2** | **0** | **0** | – | |
| Garlibee (produk) | produksi | 0/4 | 4 | 3 | jantung | |
| | lama | 0/4 | 0 | 1 | jantung | |
| | **baru** | **3/4** | 2 | **0** | jantung* | |
| Sasyahouse (8 klip) | produksi | 1/6 | 2 | 0 | – | |
| | lama | 0/6 | 2 | 3 | – | |
| | **baru** | **3/6** | 1 | **0** | – | |
| Siasat multiplier (masker) | produksi | 0/1 | 2 | 0 | – | 2/3 |
| | lama | 0/1 | 1 | 0 | – | 3/3 |
| | **baru** | **1/1** | **0** | 0 | – | **3/3** |
| Botani multiplier (rempah) | produksi | 1/1 | 1 | 0 | **lemak** | 2/5 |
| | lama | 0/1 | 0 | 0 | **metabolisme** | 3/5 |
| | **baru** | 1/1 | **0** | 0 | **–** | **5/5** |

\* Kata "jantung" berasal dari **hook yang dikunci planner** ("Menjaga kesehatan jantung keluarga…"), bukan dari isi baru. Lihat temuan 3.

## Contoh berdampingan

**Solusi Thermal — "harga bubble foil per roll"**
- Lama: "Bingung harga…? Ada rahasia yang tak terduga! / Padahal, variasi harga… menyimpan perbedaan spesifikasi… / Mulai dari ketebalan… menentukan seberapa efektif… / Memahami kualitas… anggaran jauh lebih efisien, komen di bawah ya!"
- **Baru:** "…Harga bubble foil bervariasi karena ketebalan aluminium dan jenis lapisan. Pilih yang minimal dua sisi aluminium dan bahan murni, bukan daur ulang. / Untuk efisiensi biaya, hitung total luas permukaan bangunan. Ukur panjang, lebar atap, lalu tambahkan sepuluh persen untuk area sambungan. / …"

**Ruang Akustik — "cara agar suara tidak keluar kamar"**
- Lama: "…Masalahnya, busa biasa saja tidak cukup… / Kombinasi Rockwool Slab dan panel kayu akustik efektif menyerap gema… / Hasilnya, kamar jadi tenang dan nyaman…"
- **Baru:** "…/ Periksa seluruh keliling kusen pintu kamar untuk mendeteksi adanya celah udara terbuka. / Pasang penutup celah atau seal karet tambahan pada sisi bawah daun pintu. / Tutup celah udara di pintu dan jendela agar kamar lebih tenang, komen di bawah ya!"

**Dapur Botani multiplier — rempah pagi**
- Produksi: "…Ambil satu sendok biji adas, biji kapulaga, dan biji jintan. Seduh dengan air hangat setiap pagi. / Nikmati selagi hangat untuk **bakar lemak perut** secara alami…"
- **Baru:** "…Ganti kopi pagi kamu pakai biji adas, biji karam, dan biji jintan. / Ambil segelas air, **rendam semalaman** ya. Keesokan harinya rebus racikan rempah ini hingga **menyusut setengah** bagian airnya. / Saring dan minum saat perut kosong pagi hari…"

**Siasat Sehat multiplier — masker**
- Produksi: "Campurkan **bahan pilihan** dengan madu murni serta minyak zaitun berkualitas tinggi…"
- **Baru:** "…Campurkan satu sendok pati jagung. / Tambahkan satu sendok madu murni serta satu sendok teh minyak zaitun. Aduk perlahan sampai lembut…"

## Temuan dari uji

1. **Arah usulan terbukti.** Di 6 dari 6 kasus, versi baru lebih konkret, kata transisi formula turun menjadi 0, dan multiplier tidak lagi memuat klaim medis serta menyebut semua bahan dan durasi sumber.
2. **Tanpa validator, pegangan bisa hilang.** Di v1 Thermal, "tambah 5–10%" diringkas menjadi "hitung secara akurat". Di v2 Akustik, fakta "celah selebar kartu nama" tidak dibacakan. Aturan prompt saja tidak cukup; validator U9 + 1× regenerate tetap wajib.
3. **Hook dari planner bisa membawa klaim.** Hook Garlibee "Menjaga kesehatan jantung keluarga…" dikunci planner dan wajib dibaca persis. Filter klaim harus juga dijalankan di planner (Call 2 Creative), bukan hanya di VO.
4. **Fakta produksi bisa salah dibaca jadi instruksi.** "Fermentasi minimal 3 bulan" sempat menjadi "pastikan fermentasi sudah 3 bulan sebelum dikonsumsi". Di v2 aturan "point = tindakan penonton" mengurangi masalah ini, tetapi belum hilang. Data produk perlu field terpisah: `cara_pakai` (instruksi) dan `fakta_produksi` (informasi).
5. **Format panjang (8 klip) kehabisan isi.** Sasyahouse v2: 3 klip pertama konkret, sisanya kembali ke kalimat umum. Ada dua pilihan: format tips memakai 4–5 klip, atau planner menghasilkan `clip_plan` per klip (poin → contoh → cara cek) agar setiap klip punya tugas.
6. **Angka kosmetik.** v1 Sasyahouse mengarang "radius seratus meter" dan "tiga puluh menit evaluasi". Aturan "angka kosmetik dilarang" di v2 berhasil menghapusnya.
7. **Batas kata bisa terlampaui** (Thermal v2: 22 kata/klip, batas 19). Validator perlu mengecek ini sebelum TTS.
8. **Temuan sampingan, model tidak konsisten.** Matriks di kode menetapkan `gemini-3.6-flash` untuk pilar, tetapi:
   - panggilan untuk tenant `default_tenant` (Garlibee, Sasyahouse) berjalan di `gemini-3.5-flash-lite`;
   - panggilan PT GIM berpindah-pindah ke `gemini-2.5-flash`;
   - ada beberapa 503 "High Demand".

   Kemungkinan penyebabnya pengaturan `gemini_model_primary` per tenant atau waterfall fallback. Model lite menghasilkan naskah paling generik. Pengaturan model per tenant di Settings perlu dicek.

## Rekomendasi setelah uji

- Lanjutkan U1–U4 dan U6, dengan tambahan:
  - **(a)** validator + regenerate terarah sebagai bagian wajib, bukan opsional;
  - **(b)** filter klaim di hook planner;
  - **(c)** `clip_plan` atau batas klip untuk format tips;
  - **(d)** field produk `cara_pakai` / `fakta_produksi`.
- Cek pengaturan model Gemini per tenant sebelum menilai kualitas naskah.
- Prompt baru (v2) siap dijadikan acuan implementasi: `newprompts.mjs`.
