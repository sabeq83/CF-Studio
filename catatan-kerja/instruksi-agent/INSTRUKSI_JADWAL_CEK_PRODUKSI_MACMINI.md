# Instruksi untuk Agent Claude di Mac Mini — Pasang Jadwal "CFA · Cek Produksi" + Pindah Laporan Token

Cara pakai: buka Claude Desktop di Mac Mini (tab Code, folder `/Users/masbenu/cf-autopipeline`), lalu salin-tempel **seluruh blok di bawah** ke chat.

---

```text
Tolong pasang jadwal CF Autopipeline berikut di Mac Mini ini. Pengguna sudah menyetujui.
Pakai fitur Scheduled tasks Claude Desktop (tool scheduled-tasks), BUKAN launchd/crontab sistem.

1) BUAT tugas terjadwal baru:
   - ID / nama file   : cfa-cek-produksi
   - Judul            : CFA · Cek Produksi
   - Folder kerja     : /Users/masbenu/cf-autopipeline
   - Model            : Haiku
   - Mode izin        : Auto (sama seperti tugas cfa-publish-pagi)
   - Jadwal           : SETIAP JAM pada menit ke-05 (cron: 5 * * * *).
                        Bila tool hanya menerima pilihan Hourly/Daily, pilih HOURLY.
                        Menit ke-05 dipilih supaya tidak bertabrakan dengan tugas lain di menit 00;
                        putaran 04.05 yang mengirim "🌅 Ringkasan Malam".
   - Isi perintah (prompt tugas), salin persis:
     Kamu berjalan di Mac Mini (sesi Claude Code lokal), folder kerja /Users/masbenu/cf-autopipeline.
     Jalankan skill cfa-cek-produksi sesuai SKILL.md-nya. Bila skill tidak muncul di daftar skill, baca file
     /Users/masbenu/.claude/skills/cfa-cek-produksi/SKILL.md dan ikuti langkahnya persis. Jangan membuat aturan
     sendiri di luar SKILL.md dan /Users/masbenu/cf-autopipeline/KONTRAK.md. Simpan file sementara di
     /Users/masbenu/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia.
     JANGAN mengirim notifikasi Telegram tambahan; skrip sudah mengatur sendiri (diam bila sehat,
     jam tenang 22.00–04.00).

2) UBAH jam tugas yang sudah ada "CFA · Laporan token" (ID cfa-token):
   - dari setiap hari 22.00 menjadi setiap hari 21.30 (cron: 30 21 * * *). Isi perintahnya jangan diubah.

3) Jangan mengubah tugas lain (cfa-riset, cfa-penulis, cfa-produksi, cfa-publish-pagi, cfa-publish-siang).

4) Setelah selesai:
   - tampilkan daftar semua tugas terjadwal beserta jam berikutnya;
   - jalankan SEKALI tugas cfa-cek-produksi sekarang ("Run now") sebagai uji, lalu laporkan hasilnya;
   - perbarui tabel di /Users/masbenu/cf-autopipeline/JADWAL_CFA.md: baris "CFA · Cek Produksi" menjadi
     "Tiap jam menit ke-05 · Setiap hari · Haiku · aktif", dan baris "CFA · Laporan token" menjadi 21.30.

Bila salah satu langkah tidak bisa dilakukan oleh tool, berhenti dan jelaskan apa yang harus saya klik
sendiri di menu Scheduled.
```

---

## Catatan untuk pengguna
- **Tiap jam, termasuk malam, itu aman.** Skrip Cek Produksi diam bila semua normal, dan pada jam tenang (22.00–04.00) tidak mengirim pesan apa pun. Putaran malam hanya memulihkan video yang macet. Putaran pertama setelah 04.00 (04.05) mengirim Ringkasan Malam.
- **Biaya token kecil**: tiap putaran hanya menjalankan satu skrip dengan Haiku. Angka nyatanya terlihat di laporan `cfa-token` setelah beberapa hari. Bila terasa boros, jadwal bisa diganti ke tiap 2 jam (`5 */2 * * *`, dengan 04.05 tetap kena).
- Bila agent hanya bisa membuat jadwal **Hourly** tanpa memilih menit, tidak apa-apa: ringkasan malam terkirim di putaran pertama setelah 04.00.
