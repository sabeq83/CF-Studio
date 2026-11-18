# Usulan: Jam Tenang Telegram CFA (22.00–04.00 WIB) + Ringkasan Pagi

Tanggal: 18 November 2026 · Status: **diterapkan di Mac Mini 18 Nov 2026 ±17.40** (pilihan default: mesin ikut ditunda, token pindah ke 21.30 oleh pengguna). Sisa: pengguna menambah jam 04.00 ke tugas Cek Produksi & memindah Laporan token ke 21.30
Terkait: [ANALISA_NUTRIBAKE_18NOV_TIDAK_TAYANG.md](ANALISA_NUTRIBAKE_18NOV_TIDAK_TAYANG.md) (Lapis 3 notifikasi URGENT), `implementation_plan.md` Bagian A

---

## 1. Masalah

Jam tidur pengguna **22.00–04.00 WIB**. Sejak 18 Nov, produksi berjalan bertahap mulai 21.00 dan baru selesai sekitar 23.00–00.30, sementara pemulih berjaga sampai dini hari. Artinya, sebagian besar kejadian produksi justru terjadi saat pengguna tidur.

Pesan yang bisa masuk pada jam tidur saat ini:

| Jam | Pesan | Sumber |
|---|---|---|
| ±22.00 | Laporan token harian | tugas `cfa-token` 22.00 |
| ±23.00–00.30 | "Produksi bertahap selesai kirim" | `cfa_bertahap.py` |
| kapan saja | 🚨 URGENT per video | `cfa_pemulih.py` |
| kapan saja | 🚨 Mesin produksi CF Studio berhenti | `cfa_pemulih.py` |
| kapan saja | ✅ PULIH | `cfa_publish.py` |
| ±01.30 / 03.30 | laporan Cek Produksi (bila ada masalah) | tugas Cek Produksi |

Akibatnya pesan bertumpuk saat bangun. Ada juga pesan yang **sudah basi**: URGENT pukul 23.40 untuk video yang ternyata pulih sendiri pukul 01.30 tetap terbaca seolah masih bermasalah. Pesan penting tenggelam di antara pesan biasa.

Pada jam tidur, pengguna tidak bisa bertindak. Jadi mengirim pesan saat itu tidak menambah manfaat; yang penting adalah **kabar yang tepat saat bangun**.

---

## 2. Usulan Inti

```
22.00 ─────────── JAM TENANG ─────────── 04.00
  │  pesan TIDAK dikirim, disimpan di "kotak tunda"   │
  │  pemulihan otomatis TETAP berjalan (diam)          │
  └────────────────────────────────────────────────────┘
                                                      ▼
                                   04.00 dicek ulang → dikirim rapi:
                                   (1) 🌅 Ringkasan Malam   — 1 pesan
                                   (2) 🚨 URGENT per video  — hanya yang MASIH bermasalah
```

### 2.1 Selama jam tenang (22.00–04.00)
- **Tidak ada pesan Telegram yang dikirim.** Semua pesan CFA masuk ke "kotak tunda" (file `tmp/telegram_tunda.json` di Mac Mini).
- **Pemulihan otomatis tetap berjalan seperti biasa.** Video macet tetap dicoba ulang (buat ulang gambar, ulangi tahap, kirim ulang naskah). Yang ditunda hanya pesannya, bukan pekerjaannya.
- Penanda anti-spam tetap bekerja: URGENT untuk video yang sama tidak masuk kotak tunda dua kali.

### 2.2 Pukul 04.00: dicek ulang dulu, baru dikirim
Sebelum mengirim, CFA **memeriksa ulang kondisi terkini** setiap video di kotak tunda:
- video yang semalam URGENT tetapi **sudah pulih** → tidak dikirim sebagai URGENT, cukup masuk daftar "✅ pulih semalam" di ringkasan;
- video yang **masih bermasalah** → dikirim sebagai 🚨 URGENT terpisah, dengan sisa waktu tayang terkini;
- pesan info biasa (produksi selesai, laporan token) → digabung ke ringkasan.

### 2.3 Bentuk pesan pukul 04.00

**Pesan 1, selalu ada (bila ada isi): 🌅 Ringkasan Malam**
```
🌅 CFA · Ringkasan Malam (22.00–04.00)

🚨 Masih perlu tindakan: 2 video (rincian di pesan berikut)
✅ Pulih otomatis semalam: 3 video
   • NutriBake · Sarapan diet (pulih 01.40, langkah 1)
   • Solusi Thermal · Atap baja ringan (pulih 02.15, langkah 2)
   • Ruang Akustik · Partisi kedap suara (pulih 23.55, langkah 1)
📦 Produksi malam: 13/13 video terkirim (21.00–23.20), 11 video sudah jadi
🪙 Token kemarin: 412 rb token (±Rp …) — rincian: jalankan cfa-token
⏳ Belum jadi tapi masih berjalan normal: 0
```

**Pesan 2 dst.: 🚨 URGENT per video**, hanya untuk video yang masih bermasalah setelah dicek ulang, satu pesan per video, dengan format yang sama seperti sekarang ditambah keterangan "terjadi sejak 23.40".
- Bila ada **lebih dari 5** video bermasalah, digabung menjadi **satu** pesan URGENT berisi daftar. Pesan sebanyak itu biasanya pertanda masalah besar (mis. mesin CF Studio berhenti), bukan masalah per video.
- 🚨 **Mesin CF Studio berhenti** tetap dikirim sebagai pesan sendiri **paling atas**, karena memengaruhi semua video.

Hasilnya, dalam kondisi normal pengguna bangun dengan **1 pesan**, dan saat ada masalah dengan **1 + jumlah video bermasalah** pesan. Semuanya masih berlaku saat dibaca.

### 2.4 Siapa yang mengirim pukul 04.00?
Saat ini tidak ada tugas CFA yang berjalan pukul 04.00. Usulan:
1. **Tugas "CFA · Cek Produksi" ditambah satu jam: 04.00.** Putaran inilah yang mengosongkan kotak tunda dan mengirim ringkasan. Putaran 01.30 dan 03.30 tetap ada, berjalan diam, dan berfungsi sebagai pemulihan.
2. **Cadangan otomatis**: pesan apa pun yang dikirim CFA di luar jam tenang (mis. publish 06.00) akan mengosongkan kotak tunda lebih dulu. Bila Mac Mini mati atau aplikasi Claude tertutup pukul 04.00, ringkasan tetap terkirim pada putaran berikutnya.

### 2.5 Jadwal yang disesuaikan (diubah pengguna lewat menu Scheduled)

| Tugas | Sekarang | Usulan | Alasan |
|---|---|---|---|
| CFA · Laporan token | 22.00 | **21.30** (atau digabung ke ringkasan pagi) | 22.00 tepat di awal jam tidur |
| CFA · Cek Produksi | 07.30–23.30, 01.30, 03.30 | 07.30–21.30, 23.30, 01.30, 03.30, **04.00** | 04.00 mengirim ringkasan pagi |
| CFA · Produksi | 21.00 | tetap | pesan "📦 diantrekan" masih masuk sebelum 22.00 |

---

## 3. Pengaturan (bisa diubah tanpa ubah kode)

```json
"notifikasi": {
  "jam_tenang": {
    "aktif": true,
    "mulai": "22:00",
    "selesai": "04:00",
    "ringkasan_pagi": true,
    "maks_urgent_terpisah": 5,
    "tetap_kirim": []
  }
}
```
- `tetap_kirim`: daftar jenis pesan yang **tetap** dikirim walau jam tenang, mis. `["mesin"]` bila suatu saat ingin dibangunkan saat mesin berhenti. Default kosong: tidak ada yang membangunkan.
- Jam tenang dibaca dalam WIB (`zona_waktu` config).

---

## 4. Dampak & Risiko

| Hal | Dampak | Mitigasi |
|---|---|---|
| Masalah yang **butuh** manusia malam itu (mis. mesin berhenti pukul 23.00) baru diketahui 04.00 | video tayang pagi (05.30–08.00) bisa terlambat | sisa waktu 04.00 → 05.30 masih cukup untuk restart + regenerasi (±15–20 menit per video); bila ingin dibangunkan untuk kasus mesin, isi `tetap_kirim: ["mesin"]` |
| Ringkasan 04.00 tidak terkirim (Mac Mini mati) | tidak ada kabar pagi | cadangan: publish 06.00 mengosongkan kotak tunda |
| URGENT "pengingat ≤ 2 jam sebelum tayang" jatuh di jam tenang | pengingat ditunda ke 04.00 | dihitung ulang saat 04.00 dengan sisa waktu terkini |
| Pesan siang hari | tidak berubah | — |

---

## 5. Rencana Pengerjaan (CFA, Mac Mini; tidak menyentuh CF Studio)

| Langkah | File | Isi |
|---|---|---|
| 1 | `config.json` | tambah `notifikasi.jam_tenang` |
| 2 | `bin/antrean.py` | `kirim_telegram(teks, jenis, item_id)`: bila jam tenang & jenis tidak dikecualikan → simpan ke `tmp/telegram_tunda.json`; fungsi baru `kirim_tertunda(cfg)` menyusun ringkasan + URGENT yang masih berlaku; `kirim_urgent_video/mesin/pulih` memberi `jenis` |
| 3 | `bin/cfa_pemulih.py` | putaran pertama ≥ 04.00 memanggil `kirim_tertunda()` setelah memeriksa ulang status semua video |
| 4 | `bin/cfa_bertahap.py`, `bin/cfa_token.py`, `bin/cfa_publish.py` | beri `jenis` pada pesan (info/ringkasan) agar ikut aturan jam tenang |
| 5 | `tests/test_jam_tenang.py` | uji: pesan 23.00 ditunda; 04.00 terkirim 1 ringkasan; URGENT yang sudah pulih tidak dikirim; >5 URGENT digabung; mesin di `tetap_kirim` tetap terkirim |
| 6 | `KONTRAK.md`, `JADWAL_CFA.md` | dokumentasi + isian jadwal Cek Produksi 04.00 |

Perkiraan: ±½ hari, dengan cadangan `bin/` seperti sebelumnya. Uji pertama: satu malam penuh, lalu pengguna menilai isi Ringkasan Malam.

## 6. Yang Perlu Diputuskan Pengguna
1. Setuju jam tenang **22.00–04.00** dengan ringkasan pukul **04.00**?
2. Saat **mesin CF Studio berhenti** di malam hari: tetap ditunda sampai 04.00 (usulan), atau boleh membangunkan?
3. Laporan token: pindah ke **21.30**, atau cukup digabung ke Ringkasan Malam?
