# Usulan: Menyusun Jadwal CF Autopipeline Sendiri lewat Claude Desktop di Mac Mini

> Tanggal: 15 Nov 2026 · Status: **usulan** — belum ada yang dipasang. Jadwal launchd yang sudah dibuat **tidak diaktifkan** (sesuai permintaan).

## 1. Jawaban singkat

**Bisa.** Pasang **Claude Desktop** di Mac Mini, lalu atur jadwal lewat menu **Scheduled tasks** (tugas terjadwal) di aplikasi — pilih jam, hari, dan tulis perintah singkat seperti "Jalankan skill cfa-riset". Tidak perlu chat, tidak perlu terminal. Mac Mini dibuka dari laptop lewat **Screen Sharing** (berbagi layar macOS) melalui Tailscale.

Kenapa cocok:
- Mac Mini **selalu menyala** → tugas terjadwal di aplikasi desktop (yang butuh komputer menyala & aplikasi terbuka) berjalan andal.
- **Login langganan lewat aplikasi** (klik login biasa) → tidak perlu urusan token `setup-token` lagi.
- Skill `cfa-*`, folder antrean, dan MCP CF Studio **sudah terpasang** di Mac Mini — tinggal dipakai.

## 2. Gambaran pemakaian sehari-hari

```
Laptop  ──(Screen Sharing via Tailscale)──►  Mac Mini: Claude Desktop
                                               └─ Scheduled tasks
                                                   ├─ 05:00  Riset kata kunci      → skill cfa-riset
                                                   ├─ 05:30  Tulis naskah          → skill cfa-penulis
                                                   ├─ 06:00  Kirim produksi        → skill cfa-produksi
                                                   └─ 09:00, 12:00, 15:00  Cek & jadwal publish → cfa-publish
```

Yang bisa Anda lakukan sendiri lewat aplikasi:
- **Ubah jam / hari / jeda** setiap agent, **jeda (pause)** atau **hapus** jadwal.
- **Jalankan sekarang** satu agent (mis. uji riset hari ini).
- **Melihat riwayat setiap putaran** — laporan berbahasa Indonesia dari agent tampil sebagai sesi di aplikasi.

Yang tetap diatur di file `~/cf-autopipeline/config.json` (bisa dibuka dengan TextEdit di Mac Mini): brand, kata kunci, jam publish Repliz, mode draft/live, batas video per hari. (Lihat langkah opsional di bagian 6 bila ingin ini juga tanpa file.)

## 3. Daftar tugas terjadwal yang diusulkan

Semua tugas memakai **folder kerja `~/cf-autopipeline`** (supaya izin alat di `.claude/settings.json` berlaku).

| Nama tugas | Jadwal | Perintah (tempel apa adanya) | Model |
|---|---|---|---|
| CFA 1 · Riset | Setiap hari 05:00 | `Jalankan skill cfa-riset. Simpan file sementara di ~/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia.` | Sonnet |
| CFA 2 · Naskah | Setiap hari 05:30 | `Jalankan skill cfa-penulis. Simpan file sementara di ~/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia.` | Opus |
| CFA 3 · Produksi | Setiap hari 06:00 | `Jalankan skill cfa-produksi. Simpan file sementara di ~/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia.` | Sonnet |
| CFA 4 · Publish | Setiap hari 09:00, 12:00, 15:00 | `Jalankan skill cfa-publish. Simpan file sementara di ~/cf-autopipeline/tmp/. Akhiri dengan laporan singkat berbahasa Indonesia.` | Sonnet |

Catatan:
- Urutan aman walau satu tahap telat: setiap agent hanya mengambil item dengan status yang tepat.
- Mau mulai pelan? Aktifkan hanya **CFA 1 + CFA 2** dulu (tidak memakai kuota G-Labs), periksa naskahnya beberapa hari, baru aktifkan CFA 3 & 4.

## 4. Langkah pemasangan

**Bagian yang harus Anda lakukan (butuh layar/akun Anda):**
1. **Aktifkan Screen Sharing di Mac Mini** (Pengaturan Sistem → Umum → Berbagi → Berbagi Layar). Lalu dari laptop buka Finder → Go → Connect to Server → `vnc://100.95.245.55`.
2. **Unduh & pasang Claude Desktop** dari situs resmi Claude di Mac Mini, lalu **login** dengan akun langganan yang sama.
3. Di pengaturan aplikasi: aktifkan **buka saat login** dan opsi **cegah komputer tidur** (keep awake) bila tersedia. Pastikan pengaturan Energi Mac Mini juga tidak menidurkan komputer.
4. Buka tab **Code**, pilih folder **`~/cf-autopipeline`**, setujui "trust this folder" bila ditanya.

**Bagian yang bisa saya bantu setelah aplikasi terpasang:**
5. Memastikan aplikasi membaca skill `cfa-*` dan MCP `cf-studio` (sudah terdaftar di level pengguna Mac Mini) — cukup dengan satu uji "jalankan cfa-riset sekarang" dari aplikasi.
6. Membuatkan keempat tugas terjadwal (atau memandu Anda membuatnya sendiri) dengan perintah di tabel atas.
7. Merapikan sisa pemasangan lama: file jadwal launchd (`~/Library/LaunchAgents/com.cfautopipeline.*.plist`, belum aktif) dihapus atau disimpan sebagai cadangan; token `~/cf-autopipeline/.oauth_token` dihapus bila tidak dipakai lagi.

## 5. Risiko & hal yang perlu diuji

| Hal | Penjelasan | Cara mengatasi |
|---|---|---|
| Izin alat saat berjalan sendiri | Tugas terjadwal berjalan tanpa Anda; kalau ada alat yang minta izin, putaran bisa macet | Izin sudah disiapkan di `~/cf-autopipeline/.claude/settings.json`; diuji di langkah 5 |
| Aplikasi tertutup / Mac tidur / update macOS | Tugas tidak jalan | Buka saat login + cegah tidur; cek riwayat tugas setiap pagi |
| Kuota langganan | Dipakai bersama pemakaian Claude Anda sehari-hari | Pantau minggu pertama; mulai 1 video/hari |
| Tenant CF Studio | Token MCP terikat ke tenant PT GIM | Skill sudah mengunci tenant `default_tenant` tiap putaran (lihat `ANALISA_TENANT_MCP_MACMINI.md`) |
| Dua cara jadwal sekaligus | launchd + Claude Desktop bisa jalan dobel | Pilih satu: Claude Desktop. launchd tetap tidak diaktifkan |

## 6. Langkah lanjutan (opsional)

- **Halaman kontrol sederhana**: halaman web kecil di Mac Mini untuk mengubah kata kunci, jam publish, dan draft/live tanpa membuka `config.json`, sekaligus melihat antrean hari ini (status tiap item). Bisa dibuat belakangan bila mengedit file terasa merepotkan.
- **Integrasi ke CF Studio**: menu "Claude Autopipeline" di CF Studio (butuh Antigravity) — paling rapi untuk jangka panjang, tapi paling banyak kerja.

## 7. Rekomendasi
1. Pasang Claude Desktop di Mac Mini + Screen Sharing (langkah 1–4).
2. Saya bantu uji dan buatkan tugas **CFA 1 + CFA 2** dulu; setelah 2–3 hari naskah konsisten bagus, tambah **CFA 3 + CFA 4**.
3. Cara launchd + token tidak dipakai (dibiarkan nonaktif sebagai cadangan).
