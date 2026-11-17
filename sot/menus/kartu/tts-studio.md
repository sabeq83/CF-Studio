# Kartu Menu: TTS Studio

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.5 (branch `fitur/hapus-instant-sheets`)
Alamat: `/tts-studio` · Kelompok: TOOLS · Kunci izin menu: `tts_studio`

## Fungsi
Studio pembuatan suara pengisi (voice-over) otomatis berbasis AI. Menghasilkan audio klip per adegan dari naskah teks bebas maupun draf kampanye menggunakan penyedia suara MiniMax AI atau Gemini TTS API, tersimpan persisten di database untuk dipakai video editor.

## Alur pakai
1. Pilih sumber teks: tulis manual (multi-adegan) atau impor dari kampanye.
2. Pilih penyedia AI dan persona suara (pria, wanita, karakter).
3. Atur dinamika audio (kecepatan, volume, pitch).
4. Klik buat suara; dengarkan pratinjau tiap klip dan unduh atau simpan batch.
5. Batch suara siap dipakai di Video Studio untuk perakitan video.

## Terhubung dengan
- Menyuplai audio ke: Video Studio (`/video-studio` via batch TTS).
- Menerima naskah dari: RE Campaign dan naskah manual (tab Instant Factory sudah dihapus).
- Perintah MCP: tidak ada perintah MCP khusus TTS Studio (digunakan internal oleh engine kampanye).

## Lokasi (untuk agent)
- Halaman: `app/tts-studio/page.js`, stylesheet `app/tts-studio/studio.css`
- Sanitasi teks: `lib/tts-text-sanitizer.js`
- Operasi DB: `lib/db.js` (`createTtsStudioBatch`, `createTtsStudioClip`, `getTtsStudioBatchWithClips`)
- Tabel data: `tts_studio_batches`, `tts_studio_clips`

## Aturan penting & jebakan
1. Dokumen `sot/menus/tts-studio.md` masih menyebut basis data **SQLite** — sudah dimigrasi ke PostgreSQL multi-tenant.
2. Setiap klip suara memiliki indeks adegan (`clip_index`) yang harus selaras dengan urutan klip video di Video Studio.
3. Kunci API MiniMax atau Gemini dibaca dari pengaturan tenant aktif.

## Belum ada / batasan
- Belum ada fitur perekaman suara manual langsung lewat mikrofon browser.

## Dokumen lengkap
`sot/menus/tts-studio.md` — ⚠️ sebagian usang (menyebut SQLite); gunakan untuk memahami konsep parameter audio dan struktur batch.
