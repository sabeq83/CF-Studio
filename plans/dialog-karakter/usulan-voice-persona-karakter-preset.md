# Usulan: Suara per Karakter di Preset (MiniMax + ElevenLabs) — Kawan Rumah

> Tanggal: 2026-11-15 · Penulis: Claude (reviewer) · Eksekutor: Antigravity
> Melengkapi `antigravity-instructions-dialog-D.md` Bagian 5 (pemeran + suara disimpan di Preset).
> Lingkup: **Staging saja.** Wajib mockup HTML dulu (SOP), lalu tunggu persetujuan pengguna.

---

## 0. Hasil cek kode (v2.48.12)

| Hal | Kondisi sekarang |
|---|---|
| Preset menyimpan pemeran | **Mesin sudah siap:** `basic_strategy.voice_cast_json` dari preset diwariskan ke kampanye (`lib/operator-presets.js:25-27`). **UI belum ada**, jadi pemeran hanya bisa diisi lewat MCP/kampanye. |
| ElevenLabs untuk narator tunggal | Sudah ada di preset: pilihan provider, 14 suara Indonesia (`ELEVENLABS_ID_VOICES` di `lib/voice-constants.js`), model, Custom Voice ID, stability, similarity. |
| **ElevenLabs untuk dialog** | **Belum didukung.** Di jalur dialog (`lib/scheduler-processors.js` ±7491 Pillar, ±2668 RE), suara per karakter hanya dibaca dari `minimax_voice_id` atau `gemini_voice_id`. Bila provider ElevenLabs, semua segmen dialog dikirim ke **Gemini TTS**, dengan ID suara ElevenLabs atau cadangan Gemini. Akibatnya suara ElevenLabs **tidak pernah dipakai** dan bisa gagal. |

---

## 1. Usulan suara ElevenLabs untuk Kawan Rumah

Semua dipilih dari 14 suara Indonesia yang **sudah terdaftar** di aplikasi, jadi tidak perlu tambah akun atau suara baru.
Prinsip: ketiga suara harus **mudah dibedakan telinga** (beda warna suara/gender), karena tidak ada gerak bibir.

| Karakter | Watak | Usulan utama | Alternatif | Alasan |
|---|---|---|---|---|
| **Si Wajan** | Tokoh utama, suka curhat, lucu | **Dakocan** — laki-laki, ekspresif, ceria, gaya TikTok (`plgKUYgnlZ1DCNh54DwJ`) | Pratama (energik) | Paling hidup dan "kartun". Cocok untuk tokoh yang mengeluh dengan lucu. |
| **Sponge** | Teman yang menenangkan | **Citra** — perempuan, lembut, ramah, gaya resep dapur (`RbNgJzKAV7jpYJNtCBpj`) | Naya (lembut, empatik) | Satu-satunya suara perempuan di trio, jadi langsung kontras. Nuansanya pas dengan dapur. |
| **Sapu** | Ceplas-ceplos, jahil | **Zan** — laki-laki, santai, **serak natural** (`zmqLb9Ysr8fUvDD7hXK8`) | Dila (perempuan, presenter energik) | Suara serak cocok dengan sapu ijuk yang "kasar". Beda jelas dengan Dakocan yang cerah. |

Pengaturan ElevenLabs yang disarankan untuk karakter kartun:
- Model **Multilingual v2**.
- **Stability ±0.35–0.45**: lebih ekspresif dan naik-turun. Narator berita biasanya 0.5 ke atas.
- **Similarity ±0.75** (bawaan).
- Bila ingin suara yang benar-benar "kartun", buat suara khusus di ElevenLabs (Voice Design), lalu tempel ID-nya di kolom **ID suara khusus** per karakter (Bagian 2).

**Catatan:** saya belum bisa mendengar suara-suara ini. Pilihan final ditentukan setelah pengguna mendengar sampel (tombol ▶ di UI, Bagian 2).

Untuk pembanding, suara MiniMax yang sekarang terpakai di uji #2183 (sudah ada sampelnya di laporan):
- Si Wajan: `energetic_streamer`;
- Sponge: `intellectual_commentator`;
- Sapu: `crisp_reporter`.

---

## 2. Usulan UI di halaman Preset

Letak: di dalam kotak **🔊 TTS Audio Engine Settings** yang sudah ada, di bawah pilihan "Voice Persona" narator. Kotak baru hanya muncul bila **Dialog karakter = Nyala** (saklar dari Bagian 5 instruksi dialog D).

```
┌─ 🎭 Pemeran & Suara ──────────────────────────────────────────────────┐
│ Mesin suara mengikuti "TTS Provider" di atas: ElevenLabs               │
│ [⬇ Ambil dari Universe: Kawan Rumah]  [⧉ Salin dari preset lain ▾]    │
│                                                                        │
│  Karakter      Watak singkat            Suara                  Contoh  │
│  ─────────────────────────────────────────────────────────────────────│
│  Si Wajan      Curhat, lucu            [Dakocan – ekspresif ▾]   ▶    │
│  Sponge        Menenangkan             [Citra – lembut ▾]        ▶    │
│  Sapu          Ceplas-ceplos, jahil    [Zan – serak natural ▾]   ▶    │
│                                                                        │
│  ▸ Lanjutan (per karakter): ID suara khusus · Stability · Suara        │
│    cadangan Gemini · Suara MiniMax (bila provider diganti)             │
│                                                                        │
│  [+ Tambah pemeran]                                                    │
│  ⚠ "sapu" belum punya gambar acuan di Universe   (bila ada selisih)   │
└────────────────────────────────────────────────────────────────────────┘
```

Aturan tampilan:
1. **Satu baris per karakter.** Kolom suara menampilkan daftar sesuai provider yang dipilih (MiniMax / ElevenLabs / Gemini).
   - Bila provider diganti, pilihan suara tiap provider **tetap tersimpan**, tidak terhapus. Jadi pengguna bisa bolak-balik MiniMax ↔ ElevenLabs untuk membandingkan.
2. **▶ Contoh:** memutar kalimat pendek, misalnya "Halo, aku Si Wajan!", dengan suara itu. Pakai ulang jalur uji yang sudah ada (`app/api/settings/test-elevenlabs`, dan setara untuk MiniMax). Hasil disimpan sementara, jadi tidak membuat kuota terbuang saat diputar ulang.
3. **Ambil dari Universe:** bila VI preset terhubung ke Universe, nama dan `id` karakter diisi otomatis (`si_wajan`, `sponge`, `sapu`). Pengguna tinggal memilih suara.
   - `id` tidak bisa diketik bebas, untuk mencegah salah ketik yang membuat suara tidak cocok dengan gambar.
4. **Salin dari preset lain:** menyalin seluruh daftar pemeran, misalnya dari preset promo ke preset edukasi Kawan Rumah, supaya suara Si Wajan selalu sama.
5. **Peringatan:**
   - dialog Nyala tetapi pemeran kosong;
   - karakter di preset tanpa gambar di Universe/VI (atau sebaliknya);
   - dua karakter memakai suara yang sama.
6. Bahasa sederhana. Hanya semantic CSS token (`var(--surface-raised)`, `var(--border-subtle)`, `var(--status-warning)` …).

---

## 3. Format data yang disimpan (`basic_strategy.voice_cast_json`)

Tambahkan field ElevenLabs. Field lama tetap ada agar kompatibel:

```json
{"characters":[
  {"id":"si_wajan","name":"Si Wajan","persona":"Curhat, lucu",
   "minimax_voice_id":"Indonesian_energetic_streamer_vv2",
   "elevenlabs_voice_id":"plgKUYgnlZ1DCNh54DwJ","elevenlabs_stability":0.4,
   "gemini_voice_id":"Puck"},
  {"id":"sponge","name":"Sponge","persona":"Menenangkan",
   "minimax_voice_id":"Indonesian_intellectual_commentator_vv2",
   "elevenlabs_voice_id":"RbNgJzKAV7jpYJNtCBpj","elevenlabs_stability":0.45,
   "gemini_voice_id":"Callirrhoe"},
  {"id":"sapu","name":"Sapu","persona":"Ceplas-ceplos, jahil",
   "minimax_voice_id":"Indonesian_crisp_reporter_vv2",
   "elevenlabs_voice_id":"zmqLb9Ysr8fUvDD7hXK8","elevenlabs_stability":0.35,
   "gemini_voice_id":"Aoede"}
]}
```

---

## 4. Instruksi untuk Antigravity

### V-1. Mockup dulu (SOP)
- Buat `public/mockup_dialog_karakter.html` (gabungkan dengan mockup Bagian 5 instruksi dialog D bila belum dibuat): saklar dialog, kotak Pemeran & Suara seperti Bagian 2, contoh isi Kawan Rumah.
- Mockup harus self-contained dengan token terang/gelap. Sinkronkan ke staging (`http://100.95.245.55:5010/mockup_dialog_karakter.html`).
- **Berhenti dan tunggu persetujuan pengguna.**

### V-2. Dukungan ElevenLabs di dialog (mesin), di jalur Pillar dan RE
- Di loop segmen dialog: bila `provider === 'elevenlabs'`, pakai `charEntry.elevenlabs_voice_id` (fallback ke `persona` narator) dan panggil `generateElevenLabsVOWithTimestamps`, dengan stability per karakter bila ada.
- Bila ElevenLabs gagal, cadangannya MiniMax (`minimax_voice_id`), lalu Gemini, sama seperti pola MiniMax→Gemini sekarang. Catat di log suara apa yang akhirnya dipakai.
- Pastikan subtitle per kata tetap sinkron setelah segmen digabung: gabungkan timestamp segmen dengan offset durasi.
- `registerJitVoiceCast`: bila provider ElevenLabs, isi `elevenlabs_voice_id` secara bergilir dari `ELEVENLABS_ID_VOICES`, bukan hanya MiniMax/Gemini.
- Validator preset/kampanye harus menerima field baru dan tidak membuangnya.

### V-3. UI Preset (setelah mockup disetujui)
Bangun kotak Pemeran & Suara sesuai Bagian 2 di `app/settings/presets/page.js`, termasuk ▶ contoh, ambil dari Universe, salin dari preset lain, dan peringatan.

### V-4. Isi preset Kawan Rumah
Isi `kawan_rumah_3d_dialog` dengan 3 pemeran di Bagian 3. Provider tetap **MiniMax**, kecuali pengguna memilih ElevenLabs setelah mendengar sampel.

### V-5. Tes
Unit test:
- dialog + ElevenLabs → tiap segmen memakai `elevenlabs_voice_id` karakternya;
- fallback berjalan;
- preset tanpa pemeran → perilaku lama;
- DapurBotani narator tunggal → tidak berubah.

Uji staging:
- TTS saja (tanpa video) untuk 1 kampanye Kawan Rumah dengan ElevenLabs;
- kirim sampel 3–5 detik per karakter, bandingkan MiniMax vs ElevenLabs;
- laporkan jumlah karakter teks ElevenLabs yang terpakai (kuota).

Lalu rilis patch dan deploy **staging saja**.
