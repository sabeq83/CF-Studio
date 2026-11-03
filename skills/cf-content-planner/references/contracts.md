# Kontrak CF Content Planner

## Input brief

Objek JSON; unknown keys dipertahankan sebagai konteks, tetapi bukan otorisasi tindakan eksternal. Jangan masukkan secret.

| Field | Tipe dan aturan |
|---|---|
| planner_focus | `product_campaign`, `brand_editorial`, `recipe_campaign`; wajib eksplisit di JSON |
| platform | string tidak kosong, wajib; minta jika belum diketahui |
| language | `id-ID` (default) atau `en-US` |
| planner_count | integer JSON, bukan string/boolean/pecahan; aturan di bawah |
| use_content_pillars | boolean; default berdasarkan ada/tidaknya pilar, recipe selalu false |
| pillars | array string unik tidak kosong; default []; saat OFF dinormalisasi menjadi [] |
| selected_ceps | array enum CEP unik; default seluruh enam CEP; pilihan kosong/invalid ditolak |
| account_name | string; wajib pada editorial |
| brand_context | string; wajib pada editorial |
| content_goal, target_audience, objective, brand_voice, visual_style | string opsional; gunakan jika disediakan |
| product_name, product_description | string wajib pada produk; opsional berpasangan pada editorial |
| product_usp, prohibited_claims | USP string dan daftar string klaim terlarang, jika tersedia |
| recipe_category, products, strategy_mode | lihat recipe.md |
| history_count | integer >=0, default 0; offset distribusi dari jumlah history yang diketahui, bukan angka karangan |

Default count: produk 12; editorial ON dua ide per pilar (jika >30 minta jumlah valid), editorial OFF 12; resep 3. Produk menerima 6/12/18/24/30. Editorial ON menerima kelipatan jumlah pilar sampai 30; OFF menerima integer 1–30. Resep 1–30. ON memerlukan pilar; OFF mengabaikan pilar bahkan jika daftar lama masih dikirim. Resep menolak ON agar tidak memberi kesan pilar memengaruhi mode tersebut.

Pilar opsional pada editorial adalah perluasan skill dibanding kontrak aplikasi yang diperiksa. Fitur CEP-as-Pillar/selected CEP ditemukan dalam perubahan lokal aplikasi; skill memodelkan OFF secara eksplisit dengan null, bukan bergantung pada status deploy fitur aplikasi.

## Distribusi dan skeleton

`distribute` menghasilkan `{brief, distribution, assumptions}`. Rotasi deterministik memakai SHA-256 nama akun/produk dan `history_count`. Kuota setiap dimensi berbeda maksimal satu, dengan sisa diberikan mengikuti urutan rotasi. Identik brief dan offset menghasilkan distribusi identik. Algoritme mandiri ini mempertahankan prinsip pemerataan; bukan jaminan parity seed JavaScript aplikasi.

Untuk produk/editorial, distribution row berisi `sequence` (1..N), `pillar` (string jika ON, null jika OFF), `category_cep`, `vfo`, dan `product_reference` (nama produk eksplisit atau null). CEP/VFO memakai label persis strategy.md. Pilihan subset CEP tetap memakai batas count Product Campaign. Resep memakai distribution row khusus recipe.md.

Skeleton envelope:

```json
{
  "brief": {
    "planner_focus": "brand_editorial",
    "platform": "instagram",
    "language": "id-ID",
    "account_name": "Dapur Contoh",
    "brand_context": "Edukasi dapur rumahan praktis",
    "use_content_pillars": false,
    "pillars": [],
    "planner_count": 10
  },
  "distribution": [],
  "rows": [],
  "assumptions": [],
  "history": [],
  "evidence": []
}
```

Isi `brief` dan `distribution` dari helper (contoh di atas belum berisi default lengkap). Array rows harus tepat N; tiap row memuat semua field distribution dan field skeleton berikut:

- `ws_matrix`: array minimal dua dimensi enum: When, Where, With/For Whom, How Feeling, While, With What, Why; unik.
- `context`, `strategic_angle`, `narrative_mode`, `content_subject`: string tidak kosong. Angle kompatibel VFO menurut strategy.md.
- `product`: sama persis dengan product_reference; null jika tidak ada produk eksplisit.
- `commercial_intent`: `no_sell`, `soft_sell`, `hard_sell`. Tanpa produk wajib no_sell.
- `cta_type`: `save`, `share`, `follow`, `comment`, `try`, `learn_more`, `buy`, `visit_product`, `none`. Tanpa produk hanya save/share/follow/comment/try/none; no_sell tidak memakai buy/visit_product.

Final menambahkan `hook` dan `visual_action` (string tidak kosong), tidak mengganti satu pun field skeleton. Narrative mode boleh deskriptif sesuai brief; jangan menganggapnya enum aplikasi.

`assumptions`: array string, termasuk default kreatif, batas history dan normalisasi. `history`: array row sebelumnya; hanya field yang tersedia (hook/context/visual_action/title) diperlukan. `evidence`: array `{id, source_url, claim}` dengan id unik, URL http/https dan claim tidak kosong; tautkan dari row lewat `evidence_ids` opsional (array id terdaftar). Evidence URL tidak berarti isinya sudah terverifikasi; Codex harus membaca sumber ketika memverifikasi klaim. Evidence dan history yang dipakai skeleton tidak boleh diganti diam-diam pada final.

## Validasi dan hasil

CLI mengembalikan JSON `{status, issues, scope}` dan exit code 0 jika struktur lulus, 1 untuk pelanggaran, 2 untuk file/JSON/argumen tidak valid. Issues memiliki `path` dan `message`. CLI tidak menimpa input. Gunakan `--out` pada distribute untuk file hasil; validate selalu ke stdout.

`--locked` wajib: distribution.json pada tahap skeleton, skeleton.json pada final. Helper menghitung ulang distribusi dari brief untuk mendeteksi alokasi palsu, dan membandingkan semua field skeleton pada final. `--previous`, `--target-sequence`, `--target-field` dipakai bersama untuk regenerasi satu field; hanya hook/visual_action didukung helper. Skeleton awal harus pernah lulus validasi sebelum dikunci.

Duplikat exact (case/whitespace/punctuation dinormalisasi) hook/context/visual_action/title ditolak dalam batch dan terhadap history. Kuota berimbang tidak membuktikan keragaman makna. Jangan menghilangkan history untuk melewatkan deteksi.

Output pengguna berupa tabel (Pilar jika ON, CEP, W’s, Konteks, VFO, Angle, Hook, Visual Action, Produk/CTA sesuai kebutuhan) dan JSON bila diminta. Regenerasi menggunakan sequence stabil. Jangan menulis status semantik pass sebelum meninjaunya; hasil akhir yang belum memenuhi persyaratan diberi needs_review dalam laporan ke pengguna.
