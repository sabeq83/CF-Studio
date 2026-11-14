# Usulan: Panel "🧪 Fitur Eksperimen" di Settings

> Tanggal: 2026-11-14 · Status: USULAN UI (belum ada perubahan kode)
> Tujuan: pengguna (marketer) bisa menyalakan, mematikan, dan membatalkan sendiri fitur-fitur baru per akun (tenant), tanpa agent dan tanpa menyentuh database.
> Sesuai SOP: **buat mockup HTML dulu** (`public/mockup_fitur_eksperimen.html`), sinkronkan ke staging (`http://100.95.245.55:5010/mockup_fitur_eksperimen.html`), tunggu review pengguna, baru tulis kode React.

## 1. Masalah sekarang
| Saklar | Ada di Settings? |
|---|---|
| `start_frame_visual_qc_batch`, `start_frame_visual_qc_model`, `gemini_quota_brake` | ✅ Ada (tab Engine & AI Services, setelah K7) |
| `planner_scene_director` | ❌ Hanya lewat database |
| `metaphor_kit_engine` | ❌ Hanya lewat database |
| `start_frame_visual_qc` (off / report_only / enforce) | ❌ Hanya lewat database |
| `compact_prompts` | ❌ Hanya lewat database (temuan F2.1: tidak bermanfaat) |

Saklar tersebar dan sebagian tak terlihat, sehingga pengguna tidak tahu fitur apa yang sedang aktif di akunnya.

## 2. Letak & bentuk
- Tab baru di Settings: **"🧪 Fitur Eksperimen"**, di samping "🤖 Engine & AI Services".
- Bagian atas: **banner akun aktif**, misalnya "Pengaturan ini hanya berlaku untuk akun: **Default Tenant**. Akun lain tidak berubah."
- Saklar dikelompokkan menjadi kartu. Setiap kartu berisi:
  1. nama fitur dalam bahasa sederhana;
  2. 1–2 kalimat "apa yang berubah di video";
  3. pilihan saklar;
  4. label status (🟢 Aktif / ⚪ Mati / 🟡 Uji);
  5. teks kecil: kapan terakhir diubah dan oleh siapa.

### Kartu yang diusulkan
**A. Cerita & Adegan**
| Fitur | Pilihan | Penjelasan untuk pengguna |
|---|---|---|
| Sutradara Adegan dari Planner (`planner_scene_director`) | Mati / Nyala | "Lokasi, waktu, dan situasi video mengikuti Content Planner (ruang makan siang, kamar malam, dll.), bukan satu set studio yang sama." |
| Mesin Metafora (`metaphor_kit_engine`) | Mati / Nyala | "Video memakai perumpamaan visual (mis. wastafel kotor → bersih) agar pesan kesehatan lebih mudah ditangkap." |

**B. Pemeriksa Gambar Otomatis**
| Fitur | Pilihan | Penjelasan |
|---|---|---|
| Mode pemeriksa (`start_frame_visual_qc`) | Mati / Lapor saja / Blokir & buat ulang | "Lapor saja: gambar bermasalah hanya ditandai. Blokir: gambar bermasalah dibuat ulang otomatis (maks 2×), sehingga sedikit lebih lama dan memakai kuota." |
| Periksa sekaligus (`start_frame_visual_qc_batch`) | Mati / Nyala | "6 gambar diperiksa dalam 1 panggilan. Hemat kuota Gemini sekitar 5 panggilan per video." |
| Model pemeriksa (`start_frame_visual_qc_model`) | Dropdown model | "Pakai model ringan terpisah agar tidak menghabiskan jatah penulis storyboard." |

**C. Kuota Gemini**
- Rem kuota (`gemini_quota_brake`): Mati / Nyala. Penjelasan: "Antrean ditahan saat sisa kuota harian < 15%, lalu lanjut otomatis setelah reset pukul ±14.00/15.00 WIB."
- **Meteran kuota hari ini** (hanya tampilan): bar per model, misalnya "Storyboard: 42 / 340 · Pemeriksa gambar: 12 / 340". Angka diambil dari `api_key_usages` per model.

**D. Lanjutan (tersembunyi, bisa dibuka)**
- `compact_prompts`: tampilkan dalam keadaan **Mati** dengan catatan "Tidak disarankan — uji F2.1 tidak menunjukkan manfaat". Atau sembunyikan sama sekali.

> **Keputusan pengguna 2026-11-14:** nama teknis (mis. `planner_scene_director`) **tidak ditampilkan** di bawah judul saklar, dan "Sumber: api_key_usages" dihapus dari meteran. UI hanya memakai nama dan penjelasan bahasa sederhana. Mockup sudah disesuaikan reviewer (`.code-key { display: none }`). Versi React harus mengikuti keputusan ini.

## 3. Pengaman
1. **Konfirmasi** sebelum menyalakan "Blokir & buat ulang" dan sebelum mematikan rem kuota. Tampilkan dampaknya (waktu/kuota).
2. **Tombol "Kembalikan ke default"** per kartu dan untuk semua kartu (semua eksperimen mati, pemeriksa = lapor saja, rem = nyala).
3. Perubahan **hanya berlaku untuk video baru** yang mulai diproses setelah disimpan. Tulis ini di panel.
4. **Riwayat perubahan:** catat siapa mengubah apa dan kapan (bila belum ada tabel log setting, cukup simpan `updated_by` + `updated_at` per key).
5. Hanya role **admin/owner tenant** yang bisa mengubah; role lain hanya melihat.
6. Saklar yang sama **dihapus dari tab Engine & AI Services** (dipindah, bukan diduplikasi), atau di sana diberi tautan "Atur di Fitur Eksperimen".

## 4. Teknis singkat (untuk agent)
- Semua key disimpan di `tenant_settings` tenant aktif (bukan global). Pastikan `app/api/settings/route.js` menerima key yang belum ada (`planner_scene_director`, `metaphor_kit_engine`, `start_frame_visual_qc`) dengan validasi nilai yang diizinkan (whitelist).
- Pembacaan setting di scheduler tetap memakai nilai default yang sama bila key kosong (perilaku tidak berubah untuk tenant yang belum pernah menyimpan).
- UI wajib memakai semantic CSS token dari `app/theme.css` (light & dark mode). Dilarang menulis warna hardcoded.
- Tes: simpan → baca ulang per tenant; tenant lain tidak berubah; nilai di luar whitelist ditolak; "Kembalikan ke default" bekerja.

## 5. Urutan kerja untuk Antigravity
1. Buat `public/mockup_fitur_eksperimen.html` (mandiri, token warna sendiri, light/dark), sinkronkan ke staging, lalu kirim tautannya ke pengguna. **Berhenti, tunggu review.**
2. Setelah disetujui: implementasi React + API + tes. Berhenti sebelum rilis, lalu lapor dengan bahasa sederhana.
3. Dikerjakan **setelah** K7 dirilis ke staging, agar tidak bertabrakan dengan perubahan `app/settings/page.js` dari K7.
