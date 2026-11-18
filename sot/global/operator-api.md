# MAKNA Operator API v1

Operator API menyediakan jalur headless untuk membuat Content Planner, mengubah hasilnya menjadi Organic Pillar Campaign (OPC), menjalankan pipeline produksi, memantau progres, dan menyetujui storyboard tanpa harus mengoperasikan halaman browser satu per satu.

## Scope v1

- Membuat planner `product_campaign` atau `brand_editorial`.
- Menjalankan AI Content Planner dan ingest hasil ke OPC.
- Menjalankan pipeline storyboard, TTS, visual, FFmpeg, dan sinkronisasi storage melalui scheduler yang sudah ada.
- Approval storyboard tanpa perubahan melalui API/CLI.
- Membaca output `video_final.mp4`, caption, dan URL Nextcloud dari status job.
- Social posting sengaja dinonaktifkan pada v1.
- Operator v2 mendukung research callback, status runs, exact revision approval untuk publishing, serta ingest kandidat Radar Produk (`product_research:ingest`).

## Konfigurasi

```dotenv
MAKNA_OPERATOR_API_TOKEN=<random-secret-minimum-32-bytes>
MAKNA_OPERATOR_TENANT_ID=default_tenant
MAKNA_OPERATOR_BASE_URL=http://127.0.0.1:5010
ENABLE_OPERATOR_WORKER=true
OPERATOR_WORKER_INTERVAL_MS=3000
OPERATOR_JOB_LOCK_TIMEOUT_MS=300000
```

Simpan token hanya di environment server/secret manager. Jangan commit token atau mencetaknya ke log. Pada pilot, batasi endpoint melalui Tailnet atau reverse proxy internal.

## Membuat job

```bash
npm run operator -- create \
  --file examples/nutribake-operator-request.json \
  --key nutribake-20260803-001 \
  --wait
```

API ekuivalen:

```http
POST /api/operator/v1/content-jobs
Authorization: Bearer <token>
Idempotency-Key: nutribake-20260803-001
Content-Type: application/json
```

Retry dengan key dan payload yang sama mengembalikan job lama. Key sama dengan payload berbeda menghasilkan HTTP 409.

## Memantau progres

```bash
npm run operator -- status opj_xxxxxxxxxxxxxxxx
npm run operator -- status opj_xxxxxxxxxxxxxxxx --watch
```

Status terminal: `completed`, `failed`, atau `awaiting_approval`. Mode watch berhenti ketika salah satu status tersebut tercapai.

## Approval storyboard

Setelah status `awaiting_approval`, setujui seluruh item yang siap:

```bash
npm run operator -- approve opj_xxxxxxxxxxxxxxxx --all
```

Atau item tertentu:

```bash
npm run operator -- approve opj_xxxxxxxxxxxxxxxx --items 101,102
```

Approval v1 memakai storyboard/VO/DNA yang telah dihasilkan tanpa perubahan. Gunakan UI OPC jika perlu mengedit detail sebelum approval.

## Recovery

- Job `planning` yang terkunci melewati timeout dikembalikan ke `queued`.
- `planner_id` dan `campaign_id` disimpan sebagai checkpoint.
- Campaign ID operator bersifat deterministik sehingga restart pada batas ingest tidak membuat campaign kedua.
- Seluruh perubahan status penting dicatat di `operator_job_events`.
- Gunakan Idempotency-Key yang sama saat client tidak menerima response akibat koneksi terputus.

## Error penting

| Code | Makna |
|---|---|
| `OPERATOR_UNAUTHORIZED` | Bearer token hilang atau salah. |
| `OPERATOR_AUTH_NOT_CONFIGURED` | Token belum dikonfigurasi pada server. |
| `OPERATOR_IDEMPOTENCY_KEY_REQUIRED` | Header idempotensi hilang/tidak valid. |
| `OPERATOR_IDEMPOTENCY_CONFLICT` | Key sudah dipakai dengan payload lain. |
| `OPERATOR_SOCIAL_POST_DISABLED` | Payload mencoba mengaktifkan social posting. |
| `OPERATOR_JOB_NOT_FOUND` | Job tidak ada pada tenant aktif. |
| `OPERATOR_NO_APPROVABLE_ITEMS` | Belum ada item `ready_for_review` yang cocok. |

## Rotasi token

1. Hentikan client automation sementara.
2. Ganti `MAKNA_OPERATOR_API_TOKEN` pada secret server dan client.
3. Restart service MAKNA.
4. Verifikasi request tanpa token ditolak dan request dengan token baru diterima.
5. Hapus token lama dari environment client.

---

## Operator API v2 — Ingest Radar Produk (`product_research:ingest`)

Endpoint: `POST /api/operator/v2/product-research/batches`

### Kredensial & Scope
- Menggunakan kredensial tabel `operator_credentials` (token hashed SHA-256) dengan scope **`product_research:ingest`**.
- Tenant ditentukan eksklusif dari kredensial operator tervalidasi (`identity.tenantId`); field `tenant_id` di dalam payload JSON selalu **diabaikan**.
- Token dengan scope `product_research:ingest` **tidak** berhak mempromosikan kandidat ke katalog `product_extractions` maupun membaca kandidat tenant lain. Promosi ke katalog dilakukan melalui sesi pengguna web dengan izin menu `product_research` (atau scope terpisah `product_research:promote` jika diaktifkan nanti).
- Ingest hanya menulis ke tabel riset (`product_research_batches`, `product_research_candidates`) serta folder foto riset (`public/uploads/product-research/<tenant>/<batch>/`), **tidak pernah menyentuh `product_extractions`**.

### Batas & Format Payload
- Mendukung `application/json` (foto via `thumb_base64` / `screenshot_base64`) dan `multipart/form-data` (field `payload` JSON + file `thumb_<external_candidate_id>` / `screenshot_<external_candidate_id>`).
- Maksimal **100 kandidat per batch**.
- Foto maksimal **5 MB** dengan format tervalidasi magic-bytes **JPG, PNG, atau WebP**.
- Sinkron ulang batch (`tenant_id + source + external_batch_id`) dan kandidat (`tenant_id + batch_id + external_candidate_id`) bersifat idempotent: memperbarui `research_data`, tanpa menimpa `curated_data`, `curation_status`, `process_status`, `cf_product_id`, ataupun URL pilihan kurator.
- Respons mengembalikan ringkasan `{ summary: { total, created, updated, skipped }, candidates: [...] }` per kandidat.
