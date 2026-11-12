# Revisi 1 kalimat

User merevisi dengan kalimat pendek: "logonya lebih besar", "adegan 3 kelamaan", "suaranya kurang
semangat", "gayanya ganti jadi 3D". Cara menanganinya:

## Urutan setiap revisi

1. `mf.py cadangan <proyek> "<kalimat revisi user>"` — **selalu**, sebelum mengubah apa pun.
2. Terjemahkan kalimat user jadi perubahan konkret: adegan mana, benda apa, angka berapa. Kalau
   ambigu, pilih tafsiran paling masuk akal dan sebutkan ("aku besarkan logo di adegan 1 dan
   penutup, sekitar 30%").
3. Ubah **hanya yang diminta**. Suara, waktu, dan adegan lain tidak disentuh kecuali diminta.
4. `mf.py potret <proyek> --t <detik yang berubah>` → baca → perbaiki bila perlu.
5. Laporkan 1–2 kalimat + path lembar. Tanya apakah sudah pas.

"Balikin yang tadi" / "yang sebelumnya lebih bagus" → `mf.py pulihkan <proyek>` (versi sebelum
revisi terakhir) atau `mf.py riwayat` lalu `pulihkan <nomor>`.

## Jenis revisi yang sering muncul

| User bilang | Lakukan |
|---|---|
| "kurang sinematik / kurang wah" | tambah gerak kamera, cahaya terarah + bayangan, kabut/partikel, lapisan depan; bukan menambah teks |
| "masih polos / kurang detail" | putaran "detail lagi" (daftar khusus ada di resep gayanya): tekstur bahan, baut/sambungan/jahitan, variasi warna, bayangan kontak, benda kecil di sekitar. Detail harus **cukup besar** untuk terlihat di HP (≥20 px di layar) dan ada di bagian yang masih terlihat di akhir adegan. Partikel putih kecil di langit biru terbaca sebagai salju — beri warna/bentuk lain |
| "teks kurang gede / kurang nendang" | besarkan 25–40% (judul/hook dulu), tebalkan (900), beri kontur/bayangan tebal, hentakan per kata (skala 1,15→1 + kamera sentak kecil), kata kunci di blok warna aksen; cek ulang zona aman & sisi label |
| "terlalu ramai" | kurangi teks dulu, lalu partikel; beri rentang tenang; besarkan subjek |
| "objeknya terpotong / kekecilan" (9:16) | atur ulang komposisi tegak: kamera lebih jauh atau sudut lebih rendah, subjek mengisi 50–70% tinggi |
| "adegan N kelamaan / kecepetan" | ubah durasi adegan itu saja; bila ada VO, geser jeda (`at`), bukan memotong suara |
| "ganti teks/judul/warna" | ganti di adegan terkait; warna → perbarui `gaya.md` juga supaya konsisten |
| "tambah caption/subtitle" | `SCENE.sub` + `kata.js` (lihat `suara-elevenlabs.md` §6) |
| "ganti suara / suaranya kurang semangat" | generate ulang dengan suara/tag nada baru (sebut kredit dulu) → ukur durasi baru → geser `at` dan waktu adegan → `mf.py kata` ulang |
| "ganti gaya jadi X" | gambar dan gaya berubah, suara & waktu tetap: ganti `gaya.md`, bangun ulang visual di waktu yang sama (0 kredit suara) |
| "pakai warna brand-ku" | ambil hex dari logo/situs user; ganti utama & aksen, pertahankan kontras |
| "jadikan 9:16 / 16:9" | buat folder proyek baru (salin), ubah `<!--@RASIO-->`, **tata ulang** komposisi tiap adegan; jangan sekadar memotong |
| "tambah efek suara" | satu bunyi di momen yang disebut, di jeda VO |
| "jadikan seri" | salin `gaya.md`, pembuka, penutup, posisi subtitle, suara ke proyek baru; ganti isi saja |

## Prinsip

- Revisi visual tidak boleh memakan kredit suara.
- Revisi besar (ganti gaya, ganti rasio) → tunjukkan gambar uji adegan 1 dulu sebelum mengerjakan
  semua adegan.
- Kalau revisi user bertentangan dengan aturan keterbacaan (teks terlalu kecil, di luar zona aman),
  kerjakan sedekat mungkin lalu sebutkan satu kalimat alasannya.
