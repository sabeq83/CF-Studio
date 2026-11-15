---
title: PROMPT_SYSTEM_INVENTORY
subject: kb/PROMPT_SYSTEM_v47.9.md (139,894 chars, 2,379 lines) — full read 15 Nov 2026, code version b67beec
purpose: show where every rule goes in the lite modules, or why it is dropped
status: DRAFT USULAN
---

# Inventaris Prompt System v47.9

## A. Ringkasan
- Isi: aturan bernomor Mandate 1–90 (+12.1), template JSON (II.A–II.F), template teks (IV–VI), kamus visual (IX, 9.1–9.17), kamus audio (X), format viral (XI), tabletop (12.0), grip (13.0), voice matrix (XII), scene construction (XIII).
- Mandate yang dirujuk kode: **11 nomor dari KB** (29, 33, 49, 50, 67, 71, 74, 79, 81, 86, 88, 90) — sebagian besar hanya sebagai label di template yang teksnya sudah ditulis di kode. Mandate 92–97 **tidak ada di KB**, ditulis langsung di `lib/prompts.js`.
- Kode secara eksplisit **membatalkan** Mandate 74 & 79 (`lib/prompts.js` ±909, ±1307: "OVERRIDE MANDATE 74 & MANDATE 79").
- Jalur produksi utama (storyboard product_campaign / brand_editorial / custom_storyboard dari planner) **sudah berjalan tanpa** file ini.

Siapa yang masih memuat Prompt System penuh:
| Proses | Lokasi |
|---|---|
| Planner Call 2 + regenerate | `lib/kb-loader.js` `getCreativeGeneratorKB` |
| Pillar campaign lama (tanpa jenis) | `lib/prompts.js` `buildPillarSharedPromptContext` (cabang else) |
| RE campaign / Deconstruct | `buildReverseEngineeringPrompt` (dipanggil dari scheduler & 5 route `app/api/reverse/*`, `app/api/automation/*`) |
| Bridge Inject | `buildReverseEngineeringBridgePrompt` |
| Production (lama) | `buildProductionPrompt` ← `processProduction` |
| Pipeline v54 (lama) | `buildPromptAgentPrompt` ← `app/api/pipeline-v54` |
| Cache master Gemini | `lib/kb-stitcher.js` |
| Instant Factory, Sheets Autopilot | akan dihapus (P5) |

## B. Konflik yang ditemukan
| Aturan | Masalah |
|---|---|
| **Mandate 2** "No abstract/surreal metaphors" | Bertentangan langsung dengan gaya Metafora, dan ikut terkirim ke planner tahap 2. Salah satu penyebab hook metafora gagal. |
| Mandate 47 / Block 1 "no cartoon, 3d render" | Bertentangan dengan dunia kartun/3D (cartoon universe, Stylized 3D). |
| Block 2 "human fingers, hands" sebagai negative | Bertentangan dengan mode "modest hands" di `lib/metaphor-policy.js`. |
| Mandate 34 "1 pembicara per klip" | Bertentangan dengan Mandate 94 (dialog multi-karakter) di kode. |
| Mandate 67 "chin-down" | Kode memakai "siku ke bawah" (`getConceptInstruction`). Kode yang berlaku. |
| Mandate 71 batas kata 18–27 | Kode memakai preset `words_per_clip`. |
| Mandate 49 contoh | Slang hard-sell ("Cek Keranjang Kuning sebelum kehabisan") — tidak cocok untuk soft-sell/kesehatan. |
| Mandate 84 CTA "Hard Sell", Mandate 66 "paranoia" | Tidak cocok dengan brand voice soft-sell & zero testimony. |
| Mandate 74/79 | Dibatalkan kode. |
| Mandate 28 "5-Layer Stack" | Kode memakai format LAYER 0–3 yang berbeda (Section IV/V). |
| Voice matrix XII | Duplikat REALIST Section IX. |

## C. Pemetaan per aturan
Status: **CORE** = VIDEO_PROMPT_CORE_LITE · **VOICE** = VOICE_AUDIO_LITE · **META** = METAPHOR_PHYSICS_LIBRARY_LITE · **GLOS** = MANDATE_GLOSSARY_LITE · **STYLE** = sudah ada di VISUAL_STYLE_GUIDE_LITE · **CODE** = sudah diatur kode · **DROP** = dibuang

| Mandate / Bagian | Isi singkat | Status | Alasan |
|---|---|---|---|
| 1 | File ini adalah master | DROP | meta |
| 2 | Tanpa metafora | DROP (diganti CORE §1.4) | konflik gaya Metafora |
| 3 | Dual continuity | CORE §5 | |
| 4 | Final pixel | CORE §1 | |
| 5, 9, 10, 12 | Bahasa & dialek audio | VOICE §1 | |
| 6, 24 | Konsistensi gaya | CORE §1 | duplikat |
| 7 | Image blending (Stage 14.5) | DROP | alur kerja tidak ada di aplikasi; start frame dibuat kode |
| 8, 60 | Urutan T2I → I2V | CORE §4 | |
| 11 | Prefix aspect ratio | CORE §2, GLOS | |
| B (voice matching) | Suara sesuai visual | VOICE §1 | |
| 12.1 | Integritas JSON | CORE §10 (1 baris) | diganti responseSchema / json repair |
| 13 | UGC lip sync default | VOICE §1 | |
| 14, 26 | Voice descriptor | VOICE §1 | duplikat |
| 15, 47 | Tanpa VFX / anti-animasi | CORE §1, §8 | hanya untuk gaya realis |
| 16 | Negative text/subtitles | CORE §8 | |
| 17, 42, 50, 81, 88 | Kebenaran visual produk | CORE §6, GLOS | |
| 18 | Fluid syntax | CORE §4 | |
| 19 | Reverse angle asset | DROP | `reverse_angle` tidak ada di kode |
| 20 | Mood equation (teori) | DROP | tercakup STYLE (light & mood) |
| 21, 49, 69 | Micro-pacing | CORE §3, GLOS | |
| 22, 29 | Definisi & kunci karakter | CORE §5, GLOS | |
| 23, 39 | Audio inline | CORE §2 (Layer 3) | |
| 25 | Jangan minum saat bicara | CORE §8, VOICE §1 | |
| 27 | Analisa video/gambar upload | DROP dari core → catatan modul Deconstruct (P7) | khusus deconstruct |
| 28 | 5-Layer stack | DROP (diganti CORE §2) | format kode berbeda |
| 30 | Material physics | CORE §1.2 | |
| 31 | Atmosfer volumetrik | STYLE | |
| 32, 36 | Dialog + body language | VOICE §2 | |
| 33 | Scene lock | CORE §5, GLOS | |
| 34, 35 | 1 pembicara per klip | VOICE §2 (dengan pengecualian M94) | konflik kode |
| 37 | Format viral (selfie, interview) | DROP | jarang dipakai; STYLE punya UGC |
| 38 | Pattern interrupt klip 1 | CORE §5 | |
| 40, 45 | Global voice signature | VOICE §1 | duplikat |
| 41, 48, 73 | Tanpa manusia di klip objek/produk | CORE §7, GLOS | |
| 43 | Anatomi tangan | CORE §4 | |
| 44 | Transition lock | CORE §5, GLOS | |
| 46 | Safe dynamics | CORE §4 | |
| 51 | Modesty | CORE §7, GLOS | |
| 52, 54, 63, 68, 82 | Grid/triptych/3x3 | DROP | grid start frame tidak dipakai kode |
| 53 | Raw texture UGC | STYLE (blok UGC) | |
| 55 + Phase A–C | Auto-director kamera | STYLE (camera & light list) | duplikat VISUAL_STYLE XIV |
| 56, 57, 58, 59 | Variabel batch, seed, shared visuals | DROP | fitur mass-production tidak ada |
| 61 | Spoken word, bukan nyanyian | VOICE §1 | |
| 62, 75 | I2V hanya gerak | CORE §4 | |
| 64 | Skala relatif produk | CORE §6 | |
| 65, 76, 78 | Foley, ducking, safe start | VOICE §6 | |
| 66 | Method acting | VOICE §4 (dilunakkan) | buang "paranoia" |
| 67 | Faceless framing | CORE §7, GLOS | kode yang berlaku |
| 70 | Nano Banana Pro | DROP | prompt start frame dibuat `lib/opc-start-frame-request.js` |
| 71 | Kecepatan & batas kata TTS | VOICE §5, GLOS | kode `words_per_clip` berlaku |
| 72 | Strategi adegan | META §4 | |
| 74 | JSON audio penuh | GLOS (legacy, dibatalkan) | |
| 77 | Keyframe protocol JSON | DROP | field template JSON lama |
| 79, III.B | Negative block panjang | CORE §8 (versi pendek), GLOS | dibatalkan kode |
| 80, III.A | Entropy A+B+C | META §3 | |
| 83, 86 (kamera) | Kunci kamera | STYLE (Camera Logic Gate), GLOS | duplikat |
| 84 | Energy arc | VOICE §4 (dilunakkan) | |
| 85, 89 | Decoding kode bracket | CORE §10 (1 baris) | tidak perlu jika KB ditulis tanpa kode |
| 86 (voice) | Router persona suara | VOICE §3, GLOS | |
| 87 | State of matter | META §5, CORE §6, GLOS | |
| 90 | Atomic output | GLOS (legacy) | hanya pipeline v54 |
| II.A–II.F | Template JSON T2V/I2V/T2I/thumbnail/blender/grid | DROP | kode memakai format & skema output sendiri; JSON template hanya tersisa di `buildVisualAgentPrompt`/`buildPromptAgentPrompt` (pipeline v54 lama) |
| IV, V | Template teks T2V/I2V (LAYER 0–3) | CORE §2 | inilah format yang dipakai kode |
| VI.B.3–5 | T2I start frame, thumbnail, storyboard strip | DROP | dibuat kode / fitur grid tidak dipakai |
| VII | Parameter motion/polish | DROP | |
| VIII | Final pixel (ulang) | CORE §1 | duplikat |
| 9.1–9.8, 9.10–9.15, 9.17 | Kamus shot, kamera, lensa, artefak, tekstur | DROP → STYLE (daftar ringkas sudah ada) | kamus besar tidak dibutuhkan model modern |
| 9.9 | Micro-kinetics tangan | CORE §4 | |
| 9.16 | 30 transisi sinematik | CORE §5 (2 contoh) | |
| X | Tekstur vokal, ambience, 30 musik | VOICE §6 (ringkas) | |
| XI | Format viral | DROP | |
| 12.0 | 30 money shot produk | CORE §9 (7 contoh) | |
| 13.0 | 30 rig kamera | DROP | |
| XII, XII.B | Voice matrix + emosi/tone | VOICE §3–4 | duplikat REALIST IX |
| XIII | Scene construction A–D | META §4 (A & C); B & D DROP | B/D untuk karakter manusia, jarang dipakai |

## D. Hasil ukuran
| Modul | Perkiraan |
|---|---|
| VIDEO_PROMPT_CORE_LITE | ±7 KB |
| VOICE_AUDIO_LITE | ±5 KB |
| METAPHOR_PHYSICS_LIBRARY_LITE | ±4 KB |
| MANDATE_GLOSSARY_LITE | ±3 KB |
| **Total** (tidak pernah dimuat sekaligus) | **±19 KB** vs 140 KB |

Contoh pemuatan per proses (usulan):
| Proses | Modul |
|---|---|
| Planner tahap 2 | PLANNER_CREATIVE (dari REALIST/VISUAL_STYLE lite) + METAPHOR lib bila Metafora. **Tanpa** VIDEO_PROMPT_CORE. |
| Storyboard OPC (micro-KB) | tetap seperti sekarang + GLOSSARY (karena template menyebut nomor mandate) |
| RE campaign / Deconstruct / Bridge | VIDEO_PROMPT_CORE + VOICE + GLOSSARY (+ METAPHOR bila gaya Metafora) |
| Multiplier | VOICE (persona router) |
| Pipeline v54 / Production lama | VIDEO_PROMPT_CORE + VOICE + GLOSSARY, atau pensiunkan jalurnya bila tidak dipakai |
| Cache master Gemini | ganti isi dengan modul inti (CORE + VOICE + GLOSSARY + COMPLIANCE ringkas), bukan 12 KB penuh |

## E. Catatan untuk eksekutor
- Uji perbandingan lama vs baru per jalur di staging sebelum mengganti (RE campaign dan Bridge paling sensitif karena format prompt videonya dipakai langsung ke G-Labs).
- `kb/OBJECT_METAPHOR_STORYTELLING_KB.md` saat ini spesifik Garlibee (allicin, bawang tunggal, studio apoteker). Perlu dibuat generik bila dipakai brand lain.
- `MAKNA_Config_v54.9` (dimuat beberapa builder lama) tidak ada di folder `kb/`; kemungkinan dari DB. Perlu dicek terpisah.
