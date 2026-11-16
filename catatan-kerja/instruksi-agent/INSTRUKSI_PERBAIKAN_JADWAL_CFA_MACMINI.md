# Instruksi untuk Agent Claude di Mac Mini: Perbaiki Jadwal CF Autopipeline

> Dibuat 16 Nov 2026. Baca seluruh file ini dulu, lalu kerjakan langkah 1–5 berurutan.
> Laporkan ke pengguna dalam bahasa Indonesia yang sederhana. Pengguna adalah marketer, bukan programmer.

## Latar belakang (singkat)

- CF Autopipeline (CFA) ada di **`/Users/masbenu/cf-autopipeline`**. Skill-nya ada di **`~/.claude/skills/`**: `cfa-riset`, `cfa-penulis`, `cfa-produksi`, `cfa-publish`, `cfa-jalur`, `cfa-token`, `cfa-laporan-riset`. Aturan kerja ada di `KONTRAK.md` dan `README.md`.
- Tugas terjadwal sebelumnya dibuat di **Cowork / sandbox VM** Claude Desktop. Di sana skill tidak terbaca, MCP `cf-studio` tidak ada, dan internet dibatasi (Telegram gagal `URLError`). CF Studio di `127.0.0.1:5010` juga tidak bisa dijangkau dari VM. Akibatnya riset Senin 16 Nov hanya mengerjakan 4 item.
- Jadwal launchd lama **sudah dinonaktifkan** (file di `~/cf-autopipeline/launchd-nonaktif/`). **Jangan dipasang ulang.**
- Tujuan: semua tugas terjadwal CFA berjalan sebagai **sesi Claude Code lokal di Mac Mini** (tab Code, lingkungan Local), lewat alat `scheduled-tasks`.

## Langkah 1 — Pastikan sesi ini benar-benar lokal

Jalankan:
```bash
pwd
ls ~/.claude/skills
python3 /Users/masbenu/cf-autopipeline/bin/antrean.py summary
python3 /Users/masbenu/cf-autopipeline/bin/antrean.py notify --pesan "🔧 Tes Telegram dari agent Mac Mini"
```
Lalu panggil tool MCP `cf_whoami`.

**Lolos bila:**
- folder skill memuat ketujuh `cfa-*`;
- `summary` mencetak JSON;
- notify mencetak `telegram terkirim`;
- `cf_whoami` menjawab (tenant apa pun).

**Bila salah satu gagal**, misalnya skill tidak ada, `URLError`, "workspace downloading", atau MCP tidak tersedia: **berhenti**. Beri tahu pengguna bahwa sesi ini berjalan di sandbox/VM/cloud, lalu minta pengguna membuka sesi baru di **tab Code** dengan lingkungan **Local** dan folder `/Users/masbenu/cf-autopipeline`. Jangan lanjut ke langkah berikutnya.

## Langkah 2 — Selesaikan riset mingguan minggu ini

Hari ini Senin 16 Nov. Riset tadi hanya mengerjakan 4 item NutriBake tanggal 17 Nov, dan `plan-minggu` belum dijalankan.

1. Jalankan skill **`cfa-riset`**. Kalau skill tidak muncul, baca `~/.claude/skills/cfa-riset/SKILL.md` lalu ikuti langkahnya persis.
2. Perhatikan:
   - Langkah 1 skill menjalankan **`plan-today` dan `plan-minggu`**. Hari ini Senin, jadi `plan-minggu` membuat item HabitFolk 17–23 Nov dan NutriBake 23 Nov. Kalau perintah menolak dengan alasan "bukan hari riset", jalankan `python3 bin/antrean.py plan-minggu --paksa`.
   - **Riset SEMUA item berstatus `dijadwalkan`**, termasuk NutriBake 18–22 Nov. **Tidak ada aturan "hanya sampai H-1" untuk riset.** Batas H-1 hanya berlaku untuk naskah dan produksi.
   - Maksimal 2 pencarian web per topik. Jangan mengarang fakta.
3. Di akhir, skill membuat laporan: `python3 bin/cfa_laporan_riset.py --telegram`.
4. Cek: `python3 bin/antrean.py list --status dijadwalkan` seharusnya kosong, atau tersisa sangat sedikit dengan alasan yang dicatat.

## Langkah 3 — Buat tugas terjadwal lokal

Pakai tool **`create_scheduled_task`** (dari `scheduled-tasks`). Semua jam memakai **waktu lokal Mac Mini (WIB)**. Pakai prompt di bawah apa adanya: setiap putaran mulai dari nol, jadi prompt harus lengkap.

| taskId | title | cronExpression | Skill |
|---|---|---|---|
| `cfa-riset` | CFA · Riset (Senin + Selasa cadangan) | `0 5 * * 1,2` | cfa-riset |
| `cfa-penulis` | CFA · Naskah | `0 20 * * *` | cfa-penulis |
| `cfa-produksi` | CFA · Produksi | `0 21 * * *` | cfa-produksi |
| `cfa-publish-pagi` | CFA · Publish pagi | `0 6 * * *` | cfa-publish |
| `cfa-publish-siang` | CFA · Publish siang | `0 12 * * *` | cfa-publish |
| `cfa-token` | CFA · Laporan token | `0 22 * * *` | cfa-token |

**Template prompt** (ganti `<SKILL>` sesuai tabel; untuk `cfa-token` tambahkan kalimat "Buat laporan harian dan kirim ke Telegram."):
```
Kamu berjalan di Mac Mini (sesi Claude Code lokal), folder kerja /Users/masbenu/cf-autopipeline.
Jalankan skill <SKILL> sesuai SKILL.md-nya. Bila skill tidak muncul di daftar skill, baca file
/Users/masbenu/.claude/skills/<SKILL>/SKILL.md dan ikuti langkahnya persis. Jangan membuat aturan
sendiri di luar SKILL.md dan /Users/masbenu/cf-autopipeline/KONTRAK.md. Simpan file sementara di
/Users/masbenu/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia dan kirim
notifikasi Telegram sesuai SKILL.md.
```

Catatan:
- `description` setiap tugas cukup satu baris, misalnya "CFA: riset topik mingguan semua jalur".
- **Model:** alat ini tidak bisa memilih model. Setelah tugas dibuat, minta pengguna mengatur model di UI tugas: Riset = Sonnet, Naskah = Opus (atau Sonnet), Produksi, Publish, dan Token = Haiku.
- Kalau `taskId` sudah dipakai, pakai ID yang disarankan alat.

## Langkah 4 — Verifikasi

1. Panggil `list_scheduled_tasks`. Keenam tugas harus ada, aktif, dan punya `nextRunAt` yang benar.
2. Panggil `run_scheduled_task` untuk **`cfa-publish-siang`** (aman: hanya menjadwalkan video yang sudah jadi). Tunggu selesai, lalu cek `list_task_runs`.
3. Pastikan putaran itu tercatat lokal:
   ```bash
   python3 /Users/masbenu/cf-autopipeline/bin/cfa_token.py rincian
   ```
   Harus muncul baris "Publish". Kalau tidak muncul, tugas tidak berjalan lokal. Laporkan ke pengguna.

## Langkah 5 — Minta pengguna membersihkan tugas lama

Agent ini **tidak bisa melihat** tugas yang dibuat di Cowork/sandbox. Minta pengguna:
- membuka daftar tugas terjadwal Cowork di Claude Desktop, lalu **menghapus atau menonaktifkan** semua tugas CFA lama (mis. "CFA · Riset", "Nutribake - Riset");
- **tidak membuat tugas CFA di Cowork lagi**. Semua tugas CFA cukup di tab Code (lokal).

## Larangan
- Jangan mengubah kode di `bin/`, file `jalur/`, `config.json`, atau codebase CF Studio.
- Jangan memasang ulang launchd. Jangan deploy apa pun ke CF Studio.
- Jangan mengubah mode publish (`draft`/`live`) jalur mana pun.
- Jangan menampilkan isi `.telegram.json`, `.oauth_token`, atau token MCP.

## Laporan akhir ke pengguna
Ringkas dalam 6–10 baris:
1. hasil cek lingkungan;
2. jumlah topik yang diriset per brand, dan apakah masih ada sisa;
3. daftar 6 tugas terjadwal dengan jamnya;
4. hasil uji `cfa-publish-siang`;
5. pengingat: atur model per tugas dan hapus tugas Cowork lama.
