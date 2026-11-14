# Temuan: Content Planner Sudah Beragam, Tapi Hilang di Storyboard/Prompt

> Tanggal: 2026-11-14 · Status: CATATAN BRAINSTORMING (bukan rencana implementasi)
> Sumber: DB staging (read-only). Planner `pln_9af1d49b` (Nutrifarm Rosella, 8 baris), campaign `opc_261108_8618kc` (GarliBee, VI `vi_dapurbotani_apothecary_3d_female`, 6 item).

## 1. Planner-nya memang beragam
Contoh 6 baris di campaign `opc_261108_8618kc`:

| Item | CEP | Angle | Konteks dari planner |
|---|---|---|---|
| 2051 | Commitment | The Rebel Choice | Malam, sudut ruang keluarga, Bunda merenung |
| 2052 | Opportunistic | The Second Chance | Akhir pekan, merapikan dapur |
| 2053 | Problem-Solution | The Intellectual Flex | Istirahat siang di ruang makan, tubuh kurang bugar |
| 2054 | Routine | The Life Hack | Pagi di pantry bersama suami |
| 2055 | Emotional | The Minimalist | Malam di kamar tidur, memikirkan masa depan anak |
| 2056 | Aspirational | The Caregiver | Sore di teras, membayangkan hari tua aktif |

## 2. Tapi keenam video memakai urutan adegan yang hampir identik
| Klip | Isi (berulang di 6 video) |
|---|---|
| 1 | Bawang/toples di atas batu slate hitam (makro) |
| 2 | Cangkir teh herbal beruap |
| 3 | Simulasi 3D sel (amber) |
| 4 | Sudut meja kosong / lilin / tirai |
| 5 | Tangan lengan mocca membuka toples |
| 6 | Toples di atas slate + tetesan madu |

Latar di prompt gambar:
- Item 2053 dan 2055: ketiga klip **dipaksa** menjadi "Artisanal apothecary studio, rough black slate…". Padahal konteks planner-nya ruang makan siang dan kamar tidur malam.
- Item 2056 (teras sore): klip 1 menjadi "moody study, dark walnut".
- Klip 3 selalu "dark void + amber".

## 3. Lima penyebab (urut dampak)
1. **Template adegan tetap.** Struktur 6 klip (hero object → cangkir → 3D → still life → tangan buka toples → packshot) selalu sama. Konteks planner hanya mewarnai kata-kata, tidak mengubah alur.
2. **Latar brand mengalahkan latar planner.** Visual Identity mengunci set "apothecary slate" di semua klip.
3. **Tokoh dan situasinya dibuang.** Planner menulis "Bunda duduk merenung", "Bunda dan suami di pantry", tapi aturan faceless + "pure object" mengubah cerita *orang dalam situasi* menjadi *benda diam*. Akibatnya When/While/Feeling (W's Matrix) tidak terlihat. Di dokumen lama, situasi disampaikan lewat **tangan yang berakting + properti situasi** (struk panjang, jam dinding, piring kotor, laptop, sajadah, kunci mobil).
4. **Angle tidak diterjemahkan menjadi format visual.** Di dokumen lama, setiap angle punya format sendiri: *Math Whiz* = struk obat terbakar (ROI), *Scientific Proof* = uji lab, *Caregiver* = tangan muda vs tua, *Myth Buster*, *Horror Red Room*, *Expectation vs Reality*. Di CF Studio, angle hanya menjadi label/hook teks.
5. **Slot 3D di tengah video** selalu ada karena routing VI ("mechanism → 3D"), sehingga semua video punya "jeda 3D" yang sama.

## 4. Implikasi
Masalahnya bukan di planner, dan bukan hanya di kit metafor. Masalah utamanya ada di **jembatan planner → storyboard**: data yang beragam diperas menjadi satu template + satu set brand. Perbaikan F1/F2/F2.1 membantu sisi metafor, tapi baru menyentuh campaign mode metaforik. Campaign "Cinematic" biasa (seperti `opc_261108_8618kc`) tetap kena template yang sama.
