# Implementation Plan — Produksi Bertahap, Pemulihan Otomatis & Notifikasi URGENT (CFA + CF Studio)

Tanggal: 18 November 2026 · Status: **Bagian A terpasang di Mac Mini (18 Nov 2026 ±17.20) — menunggu malam pertama; Bagian B: kode selesai di `hotfix/start-frame-retry`, deploy Dev**
Dasar: [ANALISA_NUTRIBAKE_18NOV_TIDAK_TAYANG.md](catatan-kerja/usulan/ANALISA_NUTRIBAKE_18NOV_TIDAK_TAYANG.md) (revisi 4)

## Ringkasan

Video NutriBake 18 Nov (dan sebagian besar video 19 Nov) gagal karena 5–7 video dikirim CFA ke CF Studio pada detik yang sama. G-Labs menerima prompt T2I/I2V dari banyak video sekaligus, klip bridging tidak pernah mendapat jalur eksklusif, database saling mengunci, dan tidak ada yang mencoba ulang atau memberi tahu dengan jelas.

Rencana ini dikerjakan dalam dua bagian:

| Bagian | Lokasi | Isi | Cara rilis |
|---|---|---|---|
| **A. CFA** | Mac Mini `~/cf-autopipeline` (bukan repo git) | Lapis 1 produksi bertahap 10–15 menit, Lapis 2 pemulihan otomatis, Lapis 3 🚨 URGENT per video, tugas Cek Produksi per jam | cadangan folder `bin/` lalu edit langsung; diuji dengan `--dry-run` dan item uji |
| **B. CF Studio** | repo ini, branch `hotfix/start-frame-retry` | perbaikan akar masalah: hitungan percobaan, *lost update* gambar, regenerasi per klip, coba ulang klip kosong, watchdog pekerja | SOP Hotfix: verifikasi → merge `main` → `release-non-interactive --type patch` → deploy Staging atas persetujuan |

Bagian A tidak bergantung pada Bagian B dan bisa dipakai lebih dulu. Bagian B membuat Lapis 2 jarang terpakai dan menghemat kuota G-Labs.

## Keputusan Pengguna (sudah disepakati)

1. Jeda antar-video **10–15 menit**, dengan *jeda pintar*: video berikutnya dikirim setelah video sebelumnya selesai memakai G-Labs (T2I termasuk bridging, plus semua klip I2V).
2. Ada **pemulihan otomatis** saat gambar awal atau tahap lain gagal.
3. Bila pemulihan otomatis tetap gagal: **Telegram 🚨 URGENT, satu pesan per video**.
4. Ada jadwal **cek produksi per jam**, dipasang sendiri oleh pengguna lewat menu Scheduled di Claude Desktop Mac Mini. Agen tidak mengaktifkan jadwal.

## Fakta Teknis yang Mendasari

- Di dalam satu video, CF Studio sudah menjeda prompt T2I non-bridging dan prompt I2V 10–20 detik, serta mengirim T2I bridging lewat jalur eksklusif yang ditunggu sampai selesai. **Antar-video tidak ada pengatur.**
- Satu video memakai G-Labs ±10–14 menit bila berjalan sendirian (#2250: T2I 15:25–15:35, I2V terkirim 15:37, klip jadi 15:39).
- `cfa_produksi.py` mengirim semua kandidat dalam satu loop tanpa jeda (`maks_produksi_per_putaran: 8`).
- `cfa_publish.py` baru menyerah setelah `BATAS_JAM = 8` jam dan hanya mengirim satu ringkasan.
- **Bug CF Studio yang ditemukan saat analisa:**
  1. `attempt_count` aset gambar awal naik setiap kali diklaim, **termasuk saat hanya menunggu jalur**. Klip 3 #2261 tercatat 57 percobaan, sehingga satu deadlock langsung membuatnya `failed` permanen (batas 5).
  2. `activateCompletedStartFrame` membaca lalu menulis `t2i_images_json` lewat koneksi terpisah di luar transaksi. Dua klip yang selesai hampir bersamaan saling menimpa (*lost update*). Akibatnya gambar klip 6 #2245 tersimpan di disk dan di log, tetapi tercatat kosong.
  3. `queueSingleStartFrameRevision` (regenerasi per klip) membuat revisi baru tanpa membawa klip lain yang sudah jadi. Hitungan turun 5/6 → 1/6 (terbukti pada #2260).
  4. `regenerate-start-frames` dengan `carryForwardCompleted` tetap mengantrekan **semua** klip, karena semua klip dikirim sebagai target.
  5. Pra-render T2I OPC: klip yang gagal karena `LANE_WAIT_TIMEOUT` dibiarkan `null` tanpa diantrekan ulang.
  6. Pekerja gambar awal (`runStartFrameWorkerTick`) dan penjadwal (`runStep`) tidak punya batas waktu. Satu proses yang menggantung menghentikan seluruh antrean sampai restart (18 Nov 15:42–16:26). Pesan `[Campaign Scheduler] Already running.` adalah suara normal dari `startCampaignScheduler()` yang dipanggil berulang, **bukan** tanda macet.
  7. `Release called on client which has already been released` muncul tepat setelah deadlock, dan menjadi *uncaughtException*.

---

## Bagian A — CFA (Mac Mini)

### A0. Persiapan & Cadangan

- Cadangkan: `cp -R ~/cf-autopipeline/bin ~/cf-autopipeline/bin-cadangan-YYYYMMDD-sebelum-pemulih` (pola yang sama dengan `bin-cadangan-20261117-sebelum-notif-tayang`).
- Cadangkan `config.json` → `config.json.bak-YYYYMMDD-pemulih`.
- Setelah selesai, salin `bin/`, `tests/`, dan skill yang berubah ke salinan laptop `~/cf-autopipeline` (yang bertanda `LOKAL_BUKAN_UTAMA.txt`), supaya kedua salinan sama.

### A1. `config.json` — pengaturan baru

**Code Sebelum (Current/Before)**
```json
{
 "zona_waktu": "Asia/Jakarta",
 "maks_video_per_hari": 30,
 "maks_produksi_per_putaran": 8,
 "brands": { ... }
}
```

**Code Sesudah (Proposed/After)**
```json
{
 "zona_waktu": "Asia/Jakarta",
 "maks_video_per_hari": 30,
 "maks_produksi_per_putaran": 8,
 "produksi_bertahap": {
  "aktif": true,
  "jeda_min_menit": 10,
  "jeda_maks_menit": 15,
  "tunggu_glabs_selesai": true,
  "cek_jalur_lain": true,
  "jaga_maks_jam": 4
 },
 "pemulihan": {
  "aktif": true,
  "macet_gambar_awal_menit": 20,
  "macet_umum_menit": 90,
  "maks_langkah": 3,
  "kirim_ulang_min_jam_sebelum_tayang": 3,
  "detak_mesin_menit": 20
 },
 "notifikasi": {
  "urgent_per_video": true,
  "urgent_ingat_ulang_jam_sebelum_tayang": 2,
  "kabar_pulih": true
 },
 "brands": { ... }
}
```
Catatan: `notifikasi` mungkin sudah ada (dipakai `putaran_kosong`). Bila ada, kunci baru **ditambahkan**, bukan menimpa.

### A2. `bin/cfa_produksi.py` — pecah fungsi kirim, aktifkan mode bertahap

**Code Sebelum (Current/Before)**: loop kirim langsung semua kandidat
```python
    laporan, terkunci = [], {}
    for _, _, it, J in kandidat[:batas]:
        tenant = J["tenant"]
        label = f"{it['id']} [{J['jalur']}]"
        masalah = periksa(it, J)
        ...
        try:
            if tenant not in terkunci:
                terkunci[tenant] = API.kunci_tenant(tenant)
            res = API.call("POST", "/api/v2/recipes/autonomous-pipeline", tenant, body=payload, key=payload["idempotency_key"])
            ...
            it["status"] = "diproduksi"
            simpan(it)
            laporan.append(f"✅ {label}: terkirim ke CF Studio ({res['campaign_id']}, item {res.get('item_id')})")
        except API.ApiError as e:
            gagal(it, cfg, str(e))
            laporan.append(f"❌ {label}: gagal kirim — {e}")
```

**Code Sesudah (Proposed/After)**
```python
def kirim_satu(it, J, cfg, a, terkunci):
    """Validasi + kirim satu item ke CF Studio. Mengembalikan (ikon, baris_laporan).
    Isi = blok lama di dalam loop (periksa, cek foto produk, bangun_payload, POST, simpan status)."""
    ...
    return "✅", f"✅ {label}: terkirim ke CF Studio ({res['campaign_id']}, item {res.get('item_id')})"


def main():
    ...
    kandidat.sort(key=lambda x: (x[0], A.jam_tayang_item(cfg, x[2]), x[1]))   # tayang paling pagi dulu
    pb = cfg.get("produksi_bertahap") or {}
    bertahap = pb.get("aktif") and not a.id and not a.dry_run and not a.langsung
    if bertahap:
        antre = [it["id"] for _, _, it, _ in kandidat[:batas]]
        hasil = B.mulai_latar(antre, cfg)          # cfa_bertahap.py: tulis tmp/bertahap.json + spawn terlepas
        print(hasil)                               # "7 video diantrekan, dikirim bertahap 10–15 menit mulai 21.14"
        print(A.kirim_telegram(f"CFA · Produksi bertahap\n{hasil}"))
        return
    # mode lama (satu --id, --dry-run, atau --langsung): kirim berurutan tanpa jeda
    laporan, terkunci = [], {}
    for _, _, it, J in kandidat[:batas]:
        laporan.append(kirim_satu(it, J, cfg, a, terkunci)[1])
    ...
```
Tambahan argumen: `--langsung` (lewati mode bertahap, untuk keadaan darurat) dan `--bertahap` dengan `--dry-run` (cetak rencana jam kirim tanpa mengirim).

### A3. `bin/cfa_bertahap.py` (baru) — pengantar bertahap di latar belakang

**Code Sebelum (Current/Before)**: *(file belum ada)*

**Code Sesudah (Proposed/After)** (kerangka)
```python
#!/usr/bin/env python3
"""Pengantar bertahap CFA: kirim antrean produksi satu per satu dengan jeda pintar 10–15 menit,
lalu berjaga (pemulihan) sampai semua video malam itu selesai. Berjalan terlepas dari sesi Claude."""
import json, os, subprocess, sys, time
KUNCI = A.HOME / "tmp" / "bertahap.lock"        # satu pengantar saja
STATUS = A.HOME / "tmp" / "bertahap.json"       # antrean, waktu kirim, hasil -> dibaca cfa_pemulih & laporan

def mulai_latar(antre, cfg):
    if pengantar_hidup():                        # PID di KUNCI masih hidup -> gabungkan antrean, jangan spawn kedua
        return tambah_antrean(antre)
    simpan_status({"antre": antre, "mulai": now, "terkirim": []})
    subprocess.Popen([sys.executable, __file__, "--jalan"], start_new_session=True,
                     stdout=open(A.HOME / "log" / f"bertahap-{tgl}.log", "a"), stderr=subprocess.STDOUT)
    return f"{len(antre)} video diantrekan, dikirim bertahap {jmin}–{jmaks} menit mulai {jam}"

def siap_kirim_berikutnya(prev, cfg):
    """True bila >= jeda_min dan (video sebelumnya selesai pakai G-Labs ATAU >= jeda_maks)."""
    umur = menit_sejak(prev["dikirim_at"])
    if umur < jmin: return False
    if umur >= jmaks: return True
    item_cf = API.call("GET", f"/api/v2/pillar-campaigns/{prev['campaign_id']}", tenant)["items"][0]
    glabs_selesai = item_cf["start_frame_status"] in ("completed", "skipped") and item_cf["visual_status"] == "completed"
    return glabs_selesai and not jalur_lain_sibuk(cfg)   # cek_jalur_lain: video non-CFA yang sedang T2I/I2V

def jalan():
    tulis_pid(KUNCI)
    while ada_antrean():
        tunggu_sampai(siap_kirim_berikutnya)     # cek tiap 60 dtk
        ikon, baris = P.kirim_satu(...)          # pakai fungsi yang sama dengan cfa_produksi
        catat(baris)
    kirim_ringkasan_telegram()                   # "CFA · Produksi bertahap selesai: 7/7 terkirim (21.14–22.31)"
    jaga_sampai_selesai(maks_jam=cfg["produksi_bertahap"]["jaga_maks_jam"])  # panggil cfa_pemulih.periksa() tiap 10 menit
    hapus(KUNCI)
```
Hal yang wajib diuji: proses anak tetap hidup setelah sesi Claude terjadwal selesai (`start_new_session=True`). Bila ternyata ikut mati, alternatifnya `nohup … &` lewat `/bin/zsh -c`.

### A4. `bin/cfa_pemulih.py` (baru) — deteksi macet, detak mesin, tangga pemulihan

**Code Sebelum (Current/Before)**: *(file belum ada; deteksi hanya di `cfa_publish.py` dengan `BATAS_JAM = 8`)*

**Code Sesudah (Proposed/After)** (kerangka)
```python
"""Pemulih CFA: dipanggil oleh cfa_bertahap (tiap 10 menit), cfa_publish (06.00/12.00),
dan tugas terjadwal CFA · Cek Produksi (tiap jam). Diam bila sehat."""

def periksa(cfg, dry_run=False):
    items = [it for it in A.semua_item() if it["status"] == "diproduksi" and not it.get("uji")]
    if mesin_berhenti(items):                         # >= 2 video tanpa kemajuan & regenerasi queued > 20 mnt
        U.kirim_urgent_mesin(cfg)                     # 1 pesan "Mesin produksi CF Studio Staging berhenti — perlu restart"
        return                                        # jangan tumpuk perintah ulang
    for it in items:
        st = baca_status_cf(it)                       # start_frame_status, completed_count, tts/visual/ffmpeg, regenerate_*
        catat_kemajuan(it, st)                        # simpan jejak {waktu, completed_count, tahap} di it["pemulihan"]["jejak"]
        if sehat(it, st): continue
        langkah = len(it.get("pemulihan", {}).get("langkah", []))
        if langkah >= cfg["pemulihan"]["maks_langkah"] or waktu_tayang_kurang_3_jam(it):
            U.kirim_urgent_video(it, st, cfg)         # Lapis 3
            continue
        if not giliran_bebas(): continue              # hanya satu pemulihan aktif sekaligus
        jalankan_langkah(it, st, langkah + 1)

def jalankan_langkah(it, st, n):
    if st["tahap_gagal"] in ("tts", "visual", "ffmpeg"):
        API.call("POST", f"/api/v2/pillar-campaigns/items/{iid}/trigger", tenant, body={"step": map_step(...)})
    elif n in (1, 2):
        API.call("POST", f"/api/v2/pillar-campaigns/items/{iid}/regenerate-start-frames", tenant,
                 body={"only_missing": True})     # setelah B4 rilis; sebelum itu tanpa body (buat ulang semua)
    elif n == 3 and sisa_jam_tayang(it) >= cfg["pemulihan"]["kirim_ulang_min_jam_sebelum_tayang"]:
        subprocess.run([sys.executable, "cfa_produksi.py", "--id", it["id"], "--ulang", "--langsung"])
    catat_langkah(it, n)                          # it["pemulihan"]["langkah"].append({n, waktu, aksi})
```
Kriteria macet (dari `config.json`):
- gambar awal `partial`/`failed`, `completed_count` tidak naik ≥ 20 menit;
- `tts/visual/ffmpeg_status = failed`;
- tidak ada kemajuan apa pun ≥ 90 menit.

Bila pulih **setelah** jam tayang lewat, `cfa_publish` memakai slot kosong berikutnya (lihat A6).

### A5. `bin/antrean.py` — fungsi notifikasi URGENT & PULIH

**Code Sebelum (Current/Before)**: hanya `kirim_telegram(teks)` untuk pesan ringkasan.
```python
def kirim_telegram(teks):
    """Kirim notifikasi ke Telegram bila $CFA_HOME/.telegram.json ada. ..."""
    ...
    return hasil
```

**Code Sesudah (Proposed/After)**: tambahan, `kirim_telegram` tidak diubah.
```python
URGENT_STATE = HOME / "tmp" / "urgent_terkirim.json"   # {item_id: {"dikirim": iso, "ingat_ulang": bool}}

def kirim_urgent_video(it, st, cfg, J=None, langkah=None):
    """Satu pesan per video; tidak mengulang kecuali jam tayang <= 2 jam & belum diingatkan."""
    state = load_json(URGENT_STATE, {})
    s = state.get(it["id"])
    if s and (s.get("ingat_ulang") or sisa_jam(it) > cfg["notifikasi"]["urgent_ingat_ulang_jam_sebelum_tayang"]):
        return "urgent sudah terkirim (lewati)"
    teks = (f"🚨 URGENT · CFA · {nama_brand}\n"
            f"Video: {judul} (produk: {produk})\n"
            f"Jadwal tayang: {jam_tayang} (⏳ {sisa} lagi)\n"
            f"Masalah: {ringkas_masalah(st)}\n"
            f"Sudah dicoba otomatis:\n{daftar_langkah}\n"
            f"Yang perlu dilakukan: {saran}\n"
            f"[[▶️ Buka di CF Studio|{url_review}]]\nID: {it['id']}")
    hasil = kirim_telegram(teks)
    if hasil.startswith("telegram gagal"):
        write_daily_log(cfg, it["id"], "urgent", "URGENT-TIDAK-TERKIRIM: " + hasil)
    state[it["id"]] = {"dikirim": now(cfg).isoformat(), "ingat_ulang": bool(s)}
    save_json(URGENT_STATE, state)
    return hasil

def kirim_urgent_mesin(cfg): ...   # dedupe 2 jam, isi: "Mesin produksi CF Studio Staging berhenti — perlu restart"
def kirim_pulih(it, jam_jadwal, cfg): ...   # hanya bila item pernah di-URGENT-kan: "✅ PULIH · <judul> — dijadwalkan <jam>"
```

### A6. `bin/cfa_publish.py` — pakai pemulih, hapus batas 8 jam

**Code Sebelum (Current/Before)**
```python
BATAS_JAM = 8
...
            if "failed" in tahap.values():
                rusak = [k for k, v in tahap.items() if v == "failed"]
                if not a.dry_run:
                    ubah_status(it, cfg, "perlu_review", f"tahap gagal di CF Studio: {', '.join(rusak)}")
                laporan.append(f"❌ {P.label(it, b)}: tahap gagal di CF Studio ({', '.join(rusak)}) — perlu review")
                continue
            selesai = item_cf.get("ffmpeg_status") == "completed" and item_cf.get("ffmpeg_output_path")
            if not selesai:
                ...
                if umur > BATAS_JAM and not a.dry_run:
                    ubah_status(it, cfg, "perlu_review", f"belum selesai setelah {umur:.1f} jam ({', '.join(belum)})")
```

**Code Sesudah (Proposed/After)**
```python
import cfa_pemulih as R      # noqa: E402
...
    # 0) Pemulih berjalan lebih dulu (diam bila sehat), lalu publish membaca status terbaru.
    if not a.dry_run and not a.id:
        R.periksa(cfg)
    ...
            if "failed" in tahap.values() or not selesai:
                kondisi = R.status_item(it)            # "dipulihkan" | "menunggu" | "habis"
                if kondisi == "habis" and not a.dry_run:
                    ubah_status(it, cfg, "perlu_review", R.ringkas(it))   # URGENT sudah dikirim pemulih
                laporan.append(R.baris_laporan(it, b))  # "🔧 NutriBake oat: pulih otomatis langkah 1/3 berjalan"
                continue
            ...
            jadwal = jadwal_publish(it, b, cfg)
            if jadwal < A.now(cfg):                     # pulih setelah jam tayang lewat
                jadwal = slot_kosong_berikutnya(it, b, cfg)   # sebar: slot berikut hari ini; >20.00 -> besok 07.00
            if it.get("pemulihan"):
                A.kirim_pulih(it, jadwal, cfg)
```

### A7. Skill, jadwal, dokumen CFA

| File | Perubahan |
|---|---|
| `~/.claude/skills/cfa-produksi/SKILL.md` | laporan berubah menjadi "N video diantrekan bertahap…"; jangan menunggu pengantar selesai; `--langsung` hanya bila diminta |
| `~/.claude/skills/cfa-cek-produksi/SKILL.md` (baru) | satu perintah `python3 ~/cf-autopipeline/bin/cfa_pemulih.py`; laporkan apa adanya; model Haiku; tanpa Telegram bila sehat |
| `~/cf-autopipeline/JADWAL_CFA.md` | baris baru: "Setiap jam menit ke-30 (07.30–23.30, 01.30, 03.30) · CFA · Cek Produksi · `cfa-cek-produksi` · Haiku" + catatan bahwa pengguna memasangnya sendiri |
| `~/cf-autopipeline/KONTRAK.md` | dokumentasikan bagian `pemulihan` di item dan file `tmp/bertahap.json`, `tmp/urgent_terkirim.json` |
| Salinan laptop `~/.claude/skills/cfa-*` | samakan dengan Mac Mini |

**Isian tugas terjadwal untuk pengguna** (dipasang sendiri via menu Scheduled):
- Nama: `CFA · Cek Produksi` · ID: `cfa-cek-produksi`
- Jadwal: setiap jam menit ke-30, 07.30–23.30, ditambah 01.30 dan 03.30 (atau tiap 2 jam bila ingin hemat)
- Model: Haiku · Mode izin: Auto · Folder: `/Users/masbenu/cf-autopipeline`
- Perintah: "Jalankan skill cfa-cek-produksi sesuai SKILL.md-nya."

### A8. Pengujian CFA

- `tests/test_bertahap.py`: jeda pintar (min 10 / maks 15 / tunggu G-Labs selesai), kunci tunggal, urutan tayang paling pagi dulu, gabung antrean bila pengantar hidup.
- `tests/test_pemulih.py`: deteksi macet 20/90 menit, tangga 1→3, batas 3 jam sebelum tayang, mesin berhenti tidak menumpuk perintah, URGENT sekali per video + ingat ulang ≤ 2 jam, PULIH hanya setelah URGENT.
- `python3 -m unittest discover tests` (termasuk `test_cfa_gim.py` dan `test_item_uji.py` yang sudah ada).
- `cfa_produksi.py --dry-run --bertahap`: rencana jam kirim.
- Uji langsung: satu item uji (`uji: true`) dibuat macet. Pemulih menjalankan langkah berurutan, satu pesan URGENT terkirim ke Telegram.
- Malam pertama: pantau ringkasan. Jarak kirim harus 10–15 menit, dan log CF Studio harus bebas deadlock/timeout jalur.

---

## Bagian B — CF Studio (branch `hotfix/start-frame-retry`)

Mengikuti **SOP Alur 2 — Hotfix**: branch dari `main`, hanya perbaikan bug ini, verifikasi, merge `main`, `npm run release-non-interactive -- --type patch …`, deploy Staging **atas persetujuan pengguna**, lalu `git merge main` ke branch `fitur/*` yang aktif. Tidak ada perubahan struktur database (migrasi).

### B1. `lib/start-frame-worker.js` + `lib/pillar-start-frame-service.js` — menunggu jalur tidak dihitung sebagai percobaan

**Code Sebelum (Current/Before)**
```js
// lib/start-frame-worker.js
async function releaseAssetForLaneRetry(asset, leaseId, seconds = 2) {
  await pgQuery(
    `UPDATE pillar_campaign_item_assets
     SET status = 'waiting_lane',
         lane_lease_id = $1,
         ...
     WHERE id = $3`, [leaseId, seconds, asset.id]);
}

async function retryAsset(asset, error) {
  const terminal = Number(asset.attempt_count || 0) >= 5;
```

**Code Sesudah (Proposed/After)**
```js
async function releaseAssetForLaneRetry(asset, leaseId, seconds = 2) {
  await pgQuery(
    `UPDATE pillar_campaign_item_assets
     SET status = 'waiting_lane',
         attempt_count = GREATEST(attempt_count - 1, 0),   -- klaim untuk menunggu jalur bukan percobaan
         lane_lease_id = $1,
         ...
     WHERE id = $3`, [leaseId, seconds, asset.id]);
}

const TRANSIENT_CODES = new Set(['40P01', '40001', 'LANE_WAIT_TIMEOUT', 'ECONNRESET', 'ETIMEDOUT']);
async function retryAsset(asset, error) {
  const transient = TRANSIENT_CODES.has(error.code) || /deadlock|already been released/i.test(error.message || '');
  const terminal = Number(asset.attempt_count || 0) >= (transient ? 8 : 5);
```

### B2. `lib/pillar-start-frame-service.js` — `activateCompletedStartFrame` tanpa *lost update*

**Code Sebelum (Current/Before)**
```js
    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(targetItemId);
    ...
    if (Number(targetRevision) >= currentItemRevision) {
      const paths = parseJson(item.t2i_images_json, []);
      ...
      paths[Number(targetClipIndex) - 1] = localPath;

      await updatePillarCampaignItem(item.id, {          // koneksi lain, di luar transaksi
        t2i_images_json: JSON.stringify(paths),
        t2i_start_frame_path: localPath
      });
```

**Code Sesudah (Proposed/After)**
```js
    // Kunci baris item di transaksi yang sama (urutan kunci: aset -> item) agar dua klip
    // yang selesai bersamaan tidak saling menimpa t2i_images_json.
    const itemRes = await client.query(
      `SELECT id, start_frame_revision, t2i_images_json FROM pillar_campaign_items WHERE id = $1 FOR UPDATE`,
      [targetItemId]);
    const item = itemRes.rows[0];
    ...
    if (Number(targetRevision) >= currentItemRevision) {
      const paths = parseJson(item.t2i_images_json, []);
      ...
      paths[Number(targetClipIndex) - 1] = localPath;
      await client.query(
        `UPDATE pillar_campaign_items SET t2i_images_json = $1, t2i_start_frame_path = $2 WHERE id = $3`,
        [JSON.stringify(paths), localPath, targetItemId]);
```
Sebelum mengganti `updatePillarCampaignItem`: pastikan fungsi itu tidak punya efek samping lain (cache, `updated_at`, notifikasi) untuk dua kolom ini. Bila ada, tiru efek sampingnya setelah `COMMIT`.

### B3. `lib/pillar-start-frame-service.js` — regenerasi per klip membawa klip lain

**Code Sebelum (Current/Before)**
```js
  const targetRevision = Number(item.start_frame_revision || 0) + 1;
  ...
  await pgQuery(`INSERT INTO pillar_campaign_item_assets (... ) VALUES (..., 'queued', ...)`, [...]);

  const currentPaths = parseJson(item.t2i_images_json, []);
  ...
  currentPaths[clipIndexNum - 1] = null;
```

**Code Sesudah (Proposed/After)**
```js
  const targetRevision = Number(item.start_frame_revision || 0) + 1;
  await carryForwardCompletedAssets({ itemId: item.id, revision: targetRevision, excludeClips: [clipIndexNum] });
  ...
  await pgQuery(`INSERT INTO pillar_campaign_item_assets (... ) VALUES (..., 'queued', ...)`, [...]);
```
Dengan `carryForwardCompletedAssets` = SQL `INSERT … SELECT DISTINCT ON (clip_index) … status='completed' AND NOT (clip_index = ANY($excludeClips))`, dipindahkan dari `queueStartFrameRevision` menjadi fungsi bersama.

### B4. `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-start-frames/route.js` — opsi `only_missing`

**Code Sebelum (Current/Before)**
```js
export const POST = withTenantContext(async (_request, { params }) => {
  ...
    const plan = parseJson(item.new_video_plan_json).filter(clip => clip.clip_index && clip.t2i_prompt);
    ...
    const queued = await queueStartFrameRevision(itemId, clips, { expectedCount: ..., carryForwardCompleted: true });
```

**Code Sesudah (Proposed/After)**
```js
export const POST = withTenantContext(async (request, { params }) => {
  ...
    const body = await request.json().catch(() => ({}));
    const currentPaths = parseJson(item.t2i_images_json, []);
    let plan = parseJson(item.new_video_plan_json).filter(clip => clip.clip_index && clip.t2i_prompt);
    if (body.only_missing === true) {
      plan = plan.filter(clip => !currentPaths[Number(clip.clip_index) - 1]);
      if (!plan.length) return NextResponse.json({ success: true, message: 'Semua start frame sudah lengkap.', queued: 0 });
    }
    ...
    const queued = await queueStartFrameRevision(itemId, clips, { expectedCount: ..., carryForwardCompleted: true });
```
Perilaku tanpa `only_missing` (tombol di UI) **tidak berubah**.

### B5. `lib/scheduler-processors.js` — klip kosong setelah pra-render T2I diantrekan ulang

**Code Sebelum (Current/Before)**
```js
            for (const refClip of isolatedReferenceClips) {
              console.log(`[OPC Analyzer T2I] Executing reference-critical clip ${refClip.clipIndex} (${refClip.reason}) isolated...`);
              await executeSingleClipIsolated(refClip.clipIndex, refClip.promptText);
            }
          }
        }
      } catch (err) {
        console.error('[OPC Analyzer T2I] Error during pre-rendering T2I:', err);
```

**Code Sesudah (Proposed/After)**
```js
            for (const refClip of isolatedReferenceClips) {
              ...
              await executeSingleClipIsolated(refClip.clipIndex, refClip.promptText);
            }
            // Klip yang gagal (LANE_WAIT_TIMEOUT / deadlock) -> antrean durable, hanya klip kosong
            const missing = [];
            for (let c = 1; c <= targetClips; c++) if (!t2iImagePaths[c - 1]) missing.push(c);
            if (missing.length) {
              console.warn(`[OPC Analyzer T2I] ${missing.length} klip kosong (${missing.join(',')}) -> diantrekan ulang ke durable worker`);
              pendingDurableRetry = missing;     // dijalankan setelah checkpoint, lewat queueStartFrameRevision(..., carryForwardCompleted: true)
            }
          }
        }
      } catch (err) {
```
Titik pemanggilan persis (setelah `finalizeStartFrameCheckpoint` pada alur pra-render) ditentukan saat implementasi, dengan membaca alur di sekitar baris 6700–6900.

### B6. Watchdog pekerja & penjadwal — `lib/start-frame-worker.js`, `lib/campaign-scheduler.js`, `scheduler-control`

**Code Sebelum (Current/Before)**
```js
// lib/start-frame-worker.js
export async function runStartFrameWorkerTick() {
  if (state.running) return;
  state.running = true;
  ...
          await processAsset(asset);
```
```js
// lib/campaign-scheduler.js
async function runStep(itemId, name, processor, taskKey = itemId) {
  state.activeTasks.add(taskKey);
  ...
```

**Code Sesudah (Proposed/After)**
```js
const TICK_STUCK_MS = Number(process.env.START_FRAME_TICK_STUCK_MS || 10 * 60_000);
export async function runStartFrameWorkerTick() {
  if (state.running) {
    if (Date.now() - Date.parse(state.lastTick) > TICK_STUCK_MS) {
      structuredLog('error', 'start_frame_worker_stuck', { since: state.lastTick, asset_id: state.currentAssetId });
      state.running = false;                       // lepas kunci; aset yang menggantung dipulihkan recoverStaleStartFrameAssets
    } else return;
  }
  state.running = true;
  ...
          state.currentAssetId = asset.id;
          await withTimeout(processAsset(asset), 8 * 60_000, `processAsset ${asset.id}`);
          state.lastClaimAt = new Date().toISOString();
```
```js
async function runStep(itemId, name, processor, taskKey = itemId) {
  state.activeTasks.add(taskKey);
  state.lastStepStartedAt = new Date().toISOString();
  ...
  await withTimeout(processor(...), STEP_TIMEOUT_MS[name] || 20 * 60_000, `${name} #${itemId}`);
  state.lastStepFinishedAt = new Date().toISOString();
```
`getCampaignSchedulerRuntime()` ditambah `last_step_started_at`, `last_step_finished_at`, `start_frame_worker: { last_tick, last_claim_at, running }`. Ini dibaca CFA lewat `GET /api/v2/pillar-campaigns/scheduler-control` untuk **detak mesin** (A4).

### B7. Investigasi `Release called on client which has already been released`

- Telusuri semua `pool.connect()` + `client.release()` di jalur gambar awal (`pillar-start-frame-service.js`, `start-frame-worker.js`, threaded batch di `scheduler-processors.js`). Cari pola release ganda: di `catch` **dan** `finally`, atau di kode yang memanggil `pgQuery` dengan client yang sudah dilepas.
- Perbaiki dengan penjaga `let released = false` atau satu `finally` saja.
- Tambahkan `process.on('unhandledRejection'/'uncaughtException')` yang hanya mencatat, bila belum ada, supaya error ini tidak menghentikan pekerja.

### B8. Pengujian CF Studio

- Unit test (folder `tests/`):
  - `retryAsset`: kode transient tidak membuat `failed` pada percobaan ke-5;
  - `releaseAssetForLaneRetry` tidak menaikkan hitungan;
  - `queueSingleStartFrameRevision` membawa klip lain (5/6 tetap 5/6 lalu 6/6);
  - `only_missing` hanya mengantrekan klip kosong;
  - `activateCompletedStartFrame` paralel untuk 2 klip pada item yang sama: kedua path tercatat.
- `npm run build` dan test yang ada.
- Deploy ke **Dev** (`deploy:dev:atomic` SHA branch hotfix). Uji: kirim 3 video uji serentak lewat CFA `--langsung` untuk sengaja memicu tabrakan. Pastikan tidak ada klip `null` permanen, tidak ada `failed` karena deadlock, dan watchdog mencatat bila ada yang menggantung.
- Setelah lolos dan disetujui pengguna: merge `main`, rilis patch, perbarui kartu menu terkait (Auto Pipeline / OPC) bila ada, deploy Staging, lalu verifikasi wajib SOP deployment.

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Proses latar pengantar ikut mati saat sesi Claude selesai | uji `start_new_session`; cadangan `nohup`; jadwal Cek Produksi per jam sebagai jaring pengaman |
| Mac Mini restart di tengah malam | `tmp/bertahap.json` menyimpan antrean; Cek Produksi berikutnya melanjutkan pengiriman yang tertunda |
| Pemulih membuat tabrakan baru | hanya satu pemulihan aktif sekaligus, dan tidak mengirim saat jalur lain sibuk |
| Telegram ramai | diam bila sehat; URGENT sekali per video; PULIH hanya untuk video yang pernah URGENT |
| Kuota G-Labs terbuang oleh "buat ulang semua" | dipakai sementara; setelah B4 rilis, pemulih memakai `only_missing` |
| Perubahan B2 (transaksi) memengaruhi alur lain | unit test paralel + uji Dev minimal 1 hari sebelum Staging (atau sesuai izin pengguna, karena hotfix) |
| Staging adalah lingkungan konten aktif | CFA tidak pernah me-restart Staging otomatis; hanya URGENT "perlu restart" |

## Execution Task List

### Persiapan
- [x] Pengguna menyetujui rencana ini (18 Nov 2026, mulai Bagian A)
- [ ] Pindahkan usulan ke status "disetujui" dan catat di `catatan-kerja/_DAFTAR_ISI.md`

### Bagian A — CFA (Mac Mini)
- [x] A0 Cadangkan `bin/` dan `config.json` di Mac Mini (`bin-cadangan-20261118-1704-sebelum-pemulih`)
- [x] A1 Tambah `produksi_bertahap`, `pemulihan`, `notifikasi` di `config.json`
- [x] A5 Tambah `kirim_urgent_video`, `kirim_urgent_mesin`, `kirim_pulih` di `antrean.py` (Lapis 3 lebih dulu) (+ `cf_studio_ui_url`, `detak_mesin_menit`)
- [x] A2 Pecah `kirim_satu()` di `cfa_produksi.py`, tambah `--langsung` & `--dry-run --bertahap`
- [x] A3 Buat `cfa_bertahap.py` (jeda pintar 10–15 menit, kunci tunggal, proses terlepas, jaga 4 jam)
- [x] A4 Buat `cfa_pemulih.py` (deteksi macet, detak mesin, tangga 1→3, URGENT)
- [x] A6 Sambungkan pemulih ke `cfa_publish.py`, hapus `BATAS_JAM`, slot susulan + kabar PULIH — jadwal susulan memakai `jadwal_publish` yang sudah ada
- [x] A8 Tulis `test_bertahap.py` & `test_pemulih.py`, jalankan semua test CFA — digabung di `tests/test_pemulih.py` (16 tes); 26/26 tes lulus di Mac Mini
- [x] A8 Uji `--dry-run --bertahap` dan uji item macet sengaja (URGENT terkirim sekali) — dry-run data asli OK; satu contoh URGENT berlabel UJI terkirim ke Telegram; uji macet sungguhan menunggu kejadian nyata (tanpa memakai kuota G-Labs)
- [x] A8 Uji proses latar tetap hidup setelah sesi Claude selesai — proses `start_new_session` tetap hidup setelah sesi SSH ditutup; konfirmasi akhir di malam pertama
- [x] A7 Perbarui skill `cfa-produksi`, buat skill `cfa-cek-produksi`, perbarui `JADWAL_CFA.md` & `KONTRAK.md`
- [x] A7 Serahkan isian tugas "CFA · Cek Produksi" ke pengguna (pengguna memasang sendiri) — isian ada di `JADWAL_CFA.md`
- [x] A0 Samakan salinan laptop (`bin/`, `tests/`, skill)
- [ ] Malam pertama: pantau jarak kirim 10–15 menit & log bebas deadlock/timeout, laporkan ke pengguna

### Bagian B — CF Studio (hotfix)
- [x] `git checkout main && git pull && git checkout -b hotfix/start-frame-retry`
- [x] B1 Hitungan percobaan: jalur tunggu tidak dihitung, kode transient diberi batas lebih longgar — diperbaiki di klaim (`waiting_lane`/`provider_processing` = polling juga tidak dihitung)
- [x] B2 `activateCompletedStartFrame`: kunci & tulis `t2i_images_json` di transaksi yang sama — koreksi: kasus #2245 ternyata timeout, bukan lost update; perbaikan tetap dipasang untuk mencegah saling tunggu lintas koneksi
- [x] B3 `queueSingleStartFrameRevision` membawa klip yang sudah jadi (fungsi bersama `carryForwardCompletedAssets`)
- [x] B4 Opsi `only_missing` di `regenerate-start-frames`
- [x] B5 Klip kosong setelah pra-render T2I diantrekan ulang ke durable worker
- [x] B6 Watchdog pekerja gambar awal & `runStep` + field runtime baru di `scheduler-control` — tanpa melepas paksa langkah penjadwal (mencegah proses ganda); hanya peringatan + status
- [x] B7 Temukan & perbaiki sumber `Release called on client…` — sumber: `requestImageLane` (glabs-image-lane-service) melepas klien dua kali saat tryAcquire gagal
- [x] B8 Unit test + `npm run build` — 3 tes baru + 22 tes terkait lulus; build OK
- [x] Commit & push branch (`c338af5`), deploy ke Dev OK (release `20261118T104639Z-c338af5e17ee`, verifikasi SOP lolos) · [ ] uji 3 video serentak oleh pengguna
- [ ] Laporkan hasil uji Dev ke pengguna, tunggu persetujuan naik Staging
- [ ] Merge ke `main`, `release-non-interactive --type patch`, perbarui kartu menu terkait
- [ ] Deploy Staging (`deploy:staging` SHA rilis) + verifikasi wajib SOP deployment
- [ ] `git merge main` ke branch `fitur/*` yang aktif (bila ada)
- [ ] Ubah pemulih CFA agar memakai `only_missing: true` (setelah B4 di Staging)

### Penutup
- [ ] Arsipkan rencana ini ke `catatan-kerja/rencana/` dan perbarui `_DAFTAR_ISI.md`
