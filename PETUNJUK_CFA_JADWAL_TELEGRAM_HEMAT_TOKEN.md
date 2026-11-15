# Petunjuk CF Autopipeline: Jadwal per Brand, Notifikasi Telegram, dan Hemat Token

> Tanggal: 15 Nov 2026 · Berlaku untuk skill `cfa-riset`, `cfa-penulis`, `cfa-produksi`, `cfa-publish` di Mac Mini (`masbenu@100.95.245.55`, folder `~/cf-autopipeline`).
> Semua fitur di bawah sudah dipasang dan diuji di Mac Mini dalam mode uji (dry-run): tidak ada video yang dikirim dan kuota G-Labs tidak terpakai.

---

## 1. Jadwal: sistem jalur (berlaku sejak 15 Nov 2026)

**Sekarang cukup satu tugas per tahap untuk semua brand.** Setiap tugas menyapu semua jalur aktif di `~/cf-autopipeline/jalur/`.

| Nama tugas | Jam | Perintah | Model |
|---|---|---|---|
| CFA · Riset | 05:00 | `Jalankan skill cfa-riset.` | Sonnet |
| CFA · Naskah | 05:30 | `Jalankan skill cfa-penulis.` | Opus |
| CFA · Produksi | 06:00 | `Jalankan skill cfa-produksi.` | Haiku |
| CFA · Publish | 09:00 & 13:00 | `Jalankan skill cfa-publish.` | Haiku |

Jalur aktif saat ini:
- `nutribake-produk-cocoa`: video produk Premix Cocoa harian, sudut diet, ke YT/FB/IG/TikTok, draft 18:00.
- `habitfolk-resep`: resep air fryer harian, ke FB/YT, draft 18:00.

Satu jalur saja tetap bisa: `Jalankan skill cfa-riset untuk jalur nutribake-produk-cocoa saja.` Tugas per brand yang sudah dibuat (mis. "Nutribake - Riset" dengan "untuk brand nutribake saja") tetap berfungsi.

Ringkasan dan pengecekan jalur dari Terminal Mac Mini:
```bash
python3 ~/cf-autopipeline/bin/antrean.py jalur
python3 ~/cf-autopipeline/bin/antrean.py cek-jalur
```

### Cara lama: per brand

Buat satu tugas terjadwal per brand di Claude Desktop, dan sebutkan nama brand di perintahnya.

| Nama tugas | Jam | Perintah |
|---|---|---|
| HabitFolk · Riset | 05:00 | `Jalankan skill cfa-riset untuk brand habitfolk saja.` |
| Dapur Botani · Riset | 05:10 | `Jalankan skill cfa-riset untuk brand dapurbotani saja.` |

- Keempat skill dan helper antrean mendukung `--brand`, jadi hanya item brand itu yang diproses.
- Jadwal tiap brand bisa berbeda, dan satu brand bisa dijeda tanpa mengganggu brand lain.
- **Brand baru** perlu dimasukkan dulu ke `config.json`: preset, Visual Identity, tenant, dan akun Repliz. Saat ini baru HabitFolk yang terisi.
- **Kata kunci** disimpan per brand di `~/cf-autopipeline/kata_kunci/<brand>.txt` (contoh: `habitfolk.txt`), satu kata kunci per baris. Baris yang diawali `#` diabaikan, dan kata kunci ganda otomatis dilewati. Buka file dengan TextEdit, tambahkan baris, lalu simpan. Riset akan memberi peringatan lewat Telegram kalau kata kunci segar tinggal 3 atau kurang.

Skrip produksi dan publish juga bisa dijalankan langsung dari Terminal Mac Mini:
```bash
python3 ~/cf-autopipeline/bin/cfa_produksi.py --brand habitfolk --dry-run
```
Hapus `--dry-run` untuk benar-benar mengirim (memakai kuota G-Labs).

---

## 2. Notifikasi Telegram

Setiap agent mengirim ringkasan di akhir putaran, contohnya:
- ✅ `CFA · Produksi: … terkirim ke CF Studio (cst_…)`
- ⚠️ `… perlu review — alasan …`
- ❌ `… gagal — alasan …`

Selama bot belum diatur, notifikasi dilewati tanpa error.

**Langkah pemasangan:**
1. Di Telegram, buka **@BotFather**, kirim `/newbot`, ikuti petunjuknya, lalu salin **token** yang diberikan.
2. Kirim **satu pesan apa saja** ke bot baru Anda. Langkah ini diperlukan supaya alamat chat Anda bisa dikenali.
3. Di Mac Mini, buka Terminal dan jalankan skrip di bawah, lalu tempel tokennya. Token tidak tampil di layar, dan skrip langsung mengirim pesan uji ke Telegram Anda:
   ```bash
   ~/cf-autopipeline/bin/simpan-telegram.sh
   ```
   Token disimpan di `~/cf-autopipeline/.telegram.json` dan hanya bisa dibaca akun Mac Mini Anda.

---

## 3. Apakah Claude Desktop lebih boros token dibanding Claude Code?

**Pada dasarnya tidak.** Tab Code di Claude Desktop menjalankan mesin Claude Code yang sama, dengan kuota langganan yang sama. Biayanya ditentukan oleh isi pekerjaan, bukan aplikasinya.

Yang bisa membuat lebih boros:
- **Connector dan plugin yang aktif**, misalnya Google Drive, Slack, atau Canva. Setiap connector menambah daftar alat yang dibaca Claude di setiap putaran.
- **Pilihan model.** Opus jauh lebih mahal daripada Sonnet atau Haiku.

---

## 4. Cara hemat token

| Cara | Status |
|---|---|
| **Produksi dan publish dikerjakan skrip, bukan AI.** Skill cukup menjalankan satu perintah lalu melapor. Isi pekerjaannya tetap sama: kunci tenant, cek preset dan prompt, QA mekanis, sinkron ContentFlow, jadwal Repliz, update antrean, dan notifikasi. | ✅ Sudah dipasang. Satu putaran publish selesai dalam ±8 detik. |
| **Model sesuai tugas:** Riset = Sonnet, Naskah = Opus (atau Sonnet), Produksi dan Publish = Haiku. | ✅ Pilih saat membuat tugas terjadwal |
| **Riset dibatasi** maksimal 2 pencarian web per kata kunci. | ✅ Sudah dipasang |
| **Matikan connector dan plugin** Claude Desktop yang tidak dipakai di Mac Mini. | Dilakukan di aplikasi |
| **Cek publish cukup 2x sehari**, misalnya 09:00 dan 13:00. | Atur di tugas terjadwal |
| **Mode ringkas untuk laporan status storyboard CF Studio.** Laporannya saat ini 70–146 ribu karakter. | Usulan untuk Antigravity |

Hasilnya, AI hanya bekerja penuh di **riset** dan **naskah**. Tahap lain hampir tidak memakai token.

---

## 5. Usulan isi tugas terjadwal di Claude Desktop (Mac Mini)

Folder kerja untuk semua tugas: **`~/cf-autopipeline`**

| Tugas | Jam (WIB) | Perintah | Model | Kuota G-Labs |
|---|---|---|---|---|
| HabitFolk · Riset | 05:00 | `Jalankan skill cfa-riset untuk brand habitfolk saja.` | Sonnet | Tidak |
| HabitFolk · Naskah | 05:30 | `Jalankan skill cfa-penulis untuk brand habitfolk saja.` | Opus | Tidak |
| HabitFolk · Produksi | 06:00 | `Jalankan skill cfa-produksi untuk brand habitfolk saja.` | Haiku | **Ya** |
| HabitFolk · Publish | 09:00 & 13:00 | `Jalankan skill cfa-publish untuk brand habitfolk saja.` | Haiku | Tidak |

Saran: aktifkan **Riset + Naskah** dulu. Setelah naskahnya bagus selama 2–3 hari, baru tambahkan Produksi dan Publish.

---

## 6. Pengaman yang tetap berlaku

- `publish.mode` di `config.json` = **`draft`**, jadi video masuk Repliz sebagai draft. Ubah ke `live` kalau sudah yakin.
- Batasnya **3 video per hari** dan **2 kiriman produksi per putaran**.
- Kata kunci yang sudah dipakai tidak diulang selama **30 hari**.
- **Tenant dikunci** ke `default_tenant` di setiap putaran. Kalau tenant tidak cocok, agent berhenti dan tidak membuat apa pun (lihat `ANALISA_TENANT_MCP_MACMINI.md`).
- Prompt gambar ditolak kalau memuat `--no` atau `--ar`, karena pembersih prompt CF Studio bisa menghapusnya total.

---

## 7. Perintah berguna (Terminal Mac Mini)

```bash
python3 ~/cf-autopipeline/bin/antrean.py summary
python3 ~/cf-autopipeline/bin/antrean.py list --brand habitfolk
python3 ~/cf-autopipeline/bin/antrean.py show <id-item>
```

## 8. Dokumen terkait
- `USULAN_AUTOPIPELINE_VERSI_CLAUDE.md`: desain awal dan revisi versi tanpa API
- `USULAN_JADWAL_CLAUDE_DESKTOP_MACMINI.md`: pemasangan Claude Desktop dan Screen Sharing
- `ANALISA_TENANT_MCP_MACMINI.md`: penyebab preset "tidak ditemukan" dan pengunci tenant
- `~/cf-autopipeline/README.md` dan `KONTRAK.md` (di Mac Mini): aturan kerja agent
