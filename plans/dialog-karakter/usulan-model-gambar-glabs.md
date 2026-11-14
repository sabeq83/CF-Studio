# Usulan: Model Gambar G-Labs untuk Karakter (Kawan Rumah)

> Tanggal: 2026-11-15 · Penulis: Claude (reviewer) · Eksekutor: Antigravity · Staging saja
> Sumber: dokumentasi G-Labs `WEBHOOK_INTEGRATION.en.md` + cek kode v2.48.12

## 1. Fakta
| Nama di aplikasi G-Labs | ID API (webhook) | Maks. gambar acuan |
|---|---|---|
| Nano Banana Pro | `nano_banana_pro` | 10 |
| Nano Banana 2.1 | `nano_banana_2` (dugaan, perlu dicek agent) | 10 |
| Nano Banana 2.1 Lite | `nano_banana_2_lite` (dugaan) | 10 |

- Dokumentasi webhook hanya mengenal 3 ID tersebut. Nama model yang tidak dikenal otomatis jatuh ke `nano_banana_2`.
- Dokumentasi **tidak** menjelaskan beda kualitas, kecepatan, atau biaya.
- Di kode:
  - gambar acuan karakter sudah memakai `nano_banana_pro`, dan otomatis turun ke `nano_banana_2` bila kuota Pro habis (`lib/reference-asset-service.js:108`, `lib/webhook-client.js:364`);
  - **gambar awal OPC dikunci ke `nano_banana_2`** (`lib/opc-start-frame-request.js:401`), begitu juga gambar acuan baju (`lib/scheduler-processors.js:6422`). Pengaturan tenant `webhook_image_model` tidak berpengaruh di jalur ini.
  - Laporan E.4 menyebut gambar acuan Part C juga `nano_banana_2`. Kemungkinan Pro terkena batas kuota lalu turun otomatis. Perlu dicek di log.

## 2. Rekomendasi
| Kebutuhan | Model | Alasan |
|---|---|---|
| Gambar acuan karakter (dibuat sekali) | **Pro** | Detail dan ketepatan desain paling tinggi. Jumlahnya sedikit, jadi kuota aman. |
| Gambar awal video **karakter / multi-karakter** | **Pro** | Paling patuh pada beberapa gambar acuan sekaligus. Penyimpangan di uji #2183 (Sapu bergagang cokelat, Si Wajan jadi wok, wajan kembar) terjadi saat memakai `nano_banana_2`. |
| Gambar awal biasa (produk, tangan, resep DapurBotani) | **2.1** (`nano_banana_2`) | Sudah terbukti cukup bagus dan lebih ringan. |
| Draf, uji coba, Threads/ilustrasi massal | **2.1 Lite** | Paling hemat. **Jangan** dipakai untuk karakter. |

## 3. Instruksi untuk Antigravity
1. **Cek nama ↔ ID.** Konfirmasi di G-Labs (tab Webhook) bahwa "Nano Banana 2.1" = `nano_banana_2` dan "2.1 Lite" = `nano_banana_2_lite`. Bila ID baru (misalnya `nano_banana_2_1`), laporkan dulu. Jangan menebak, karena ID yang salah diam-diam jatuh ke `nano_banana_2`.
2. **Jelaskan dari log:** kenapa gambar acuan Part C tercatat `nano_banana_2`? Apakah karena fallback kuota Pro?
3. **Model gambar awal bisa dipilih.** Ganti kunci `'nano_banana_2'` di `opc-start-frame-request.js:401` dengan aturan:
   - VI stylized 3D / multi-karakter → `nano_banana_pro`;
   - selain itu → `nano_banana_2` (perilaku sekarang).
   Fallback kuota Pro→2 tetap berlaku dan harus **dicatat di log per klip**. Fingerprint idempotensi harus memakai model yang benar-benar dipakai.
4. **Uji A/B di staging.** Buat ulang 5 gambar awal kampanye `opc_261115_0b9qkd` (#2183) dengan Pro: prompt dan acuan sama, tanpa render video.
   - Buat contact sheet berdampingan: `nano_banana_2` vs Pro.
   - Nilai per klip: Sapu bergagang hijau sage dan tidak terbalik; Si Wajan wajan datar bulat; tidak ada karakter kembar.
   - Catat waktu tunggu dan sisa kuota Pro.
5. Laporkan hasilnya. Pengguna yang memutuskan apakah Pro dijadikan bawaan untuk preset karakter.
