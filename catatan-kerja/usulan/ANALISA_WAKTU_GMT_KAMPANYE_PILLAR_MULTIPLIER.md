# Analisa & Usulan Perbaikan: Waktu Pembuatan Kampanye Tampil GMT (Mundur 7 Jam dari GMT+7 / WIB)

**Tanggal**: 26 November 2026  
**Status**: Analisa & Usulan (Menunggu Keputusan Pengguna)  
**Cakupan Awal**: Pillar Campaign (`/pillar-campaigns`) & Multiplier Campaign (`/multiplier-lab`), serta berdampak ke halaman kampanye lain dengan pola kolom DB yang sama.

---

## 1. Ringkasan Temuan (Akar Masalah Terbukti di DB & Kode)

Waktu pembuatan kampanye tampil sebagai **angka jam GMT (mundur 7 jam dari WIB)** bukan karena bug di UI browser saja, melainkan **pergeseran ganda (*double-shift* -7 jam lalu +7 jam)** antara **PostgreSQL**, **driver `node-postgres` (`pg`)**, dan **browser**.

### Bukti Nyata dari Database `staging` & Server Mac Mini
Pemeriksaan langsung pada `100.78.186.123` (schema `staging`) dan `100.95.245.55` (Mac Mini) pada **26 November 2026 pukul 17:20 WIB (`10:20 UTC`)**:

1. **Zona waktu PostgreSQL (`SHOW TIMEZONE`)**: `Etc/UTC`.
2. **Zona waktu OS Node.js di Mac Mini**: `WIB +0700` (`Asia/Jakarta`).
3. **Tipe kolom `created_at` di tabel kampanye**:
   - `pillar_campaigns.created_at` → **`timestamp without time zone`** (`DEFAULT CURRENT_TIMESTAMP`)
   - `pillar_campaign_items.created_at` → **`timestamp without time zone`** (`DEFAULT CURRENT_TIMESTAMP`)
   - `re_multiplier_tasks.created_at` → **`timestamp without time zone`** (`DEFAULT CURRENT_TIMESTAMP`)
   - *(Hal yang sama juga ditemukan di `re_campaigns`, `recipe_campaigns`, `strategic_campaigns`, `bridge_injector_campaigns`, dan `content_flow_items`.)*
4. **Nilai mentah di PostgreSQL vs hasil parsing Node.js (`pg`)**:
   - Contoh Pillar Campaign (`cst_82513f20b4da`, dibuat pukul `17:11:34 WIB`):
     - Nilai mentah tersimpan di PostgreSQL (`created_at::text`): **`2026-11-26 10:11:34.34671`** (angka jam **UTC**, tanpa offset zona).
     - Hasil yang dikembalikan `pgQuery` / API ke browser: **`"2026-11-26T03:11:34.346Z"`** (**berkurang 7 jam!**).
   - Contoh Multiplier Campaign (`mul_261126_cku1mc`, dibuat pukul `17:16:49 WIB`):
     - Nilai mentah tersimpan di PostgreSQL (`created_at::text`): **`2026-11-26 10:16:49.616942`** (angka jam **UTC**, tanpa offset zona).
     - Hasil yang dikembalikan `pgQuery` / API ke browser: **`"2026-11-26T03:16:49.616Z"`** (**berkurang 7 jam!**).

### Mengapa Pergeseran Terjadi? (Alur Lengkap)
1. Saat baris baru dibuat, `DEFAULT CURRENT_TIMESTAMP` di PostgreSQL (`Etc/UTC`) menyimpan waktu UTC murni tanpa penanda zona, misalnya **`10:16:49`**.
2. Di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L8), hanya OID `1082` (`DATE`) yang di-override parser-nya (`types.setTypeParser(1082, ...)`). **OID `1114` (`TIMESTAMP` / `timestamp without time zone`) dibiarkan memakai parser bawaan `pg`.**
3. Parser bawaan `pg` memanggil `new Date("2026-11-26 10:16:49.616942")` **tanpa akhiran `Z`** di dalam Node.js pada Mac Mini (yang zona waktunya **`WIB +0700`**).
4. JavaScript di Node.js salah menafsirkan `"10:16:49"` sebagai **10:16:49 WIB**, lalu saat serialisasi JSON mengubahnya ke UTC dengan **mengurangi 7 jam**: **`2026-11-26T03:16:49.616Z`**.
5. Di browser pengguna (yang juga di WIB / GMT+7), `new Date("2026-11-26T03:16:49.616Z").toLocaleString('id-ID')` **menambahkan kembali 7 jam**: `03:16:49 + 7 jam = 10:16:49`.
6. **Hasil di layar pengguna**: tampil **`10:16:49`** (angka jam GMT), padahal seharusnya **`17:16:49`** (WIB / GMT+7).

> [!NOTE]
> Tabel yang memakai **`timestamp with time zone` (`TIMESTAMPTZ`, OID `1184`)** seperti `re_deconstruct_batches`, `re_deconstructed_assets`, dan `auto_pipeline_schedules` **tidak mengalami bug ini**, karena PostgreSQL mengembalikan offset eksplisit `+00` sehingga `node-postgres` mem-parse-nya benar sebagai `10:16:49Z` → tampil `17:16:49` di browser.

---

## 2. Titik Tampilan UI yang Terdampak

### A. Pillar Campaign (`/pillar-campaigns`)
1. Daftar kampanye di [app/pillar-campaigns/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js#L2582):
   `new Date(c.created_at).toLocaleString('id-ID')`
2. Header detail kampanye di [app/pillar-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js#L3766):
   `new Date(campaign.created_at).toLocaleString('id-ID')`
3. Daftar item/baris di [app/pillar-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js#L4260):
   `new Date(item.created_at).toLocaleString('id-ID')`
4. *(Catatan minor)*: `toLocaleString('id-ID')` di atas juga belum menyertakan `{ timeZone: 'Asia/Jakarta' }` secara eksplisit.

### B. Multiplier Campaign (`/multiplier-lab`)
1. Daftar riwayat kampanye di [app/components/campaign-forms/MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js#L3212):
   `new Date(c.created_at).toLocaleString('id-ID')`
2. Header detail kampanye di [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/[id]/page.js#L793):
   `new Date(firstTask.created_at).toLocaleString('id-ID')`

### C. Kampanye Lain yang Memiliki Pola Persis Sama (Untuk Konsistensi)
- RE Campaign: `app/components/campaign-forms/ReCampaignConfigurationForm.js` (#L2378), `app/re-campaigns/[id]/page.js` (#L4527) (`re_campaigns.created_at` juga `timestamp without time zone`).
- Recipe Labs: `app/components/campaign-forms/RecipeLabsConfigurationForm.js` (#L2612) (`recipe_campaigns.created_at` juga `timestamp without time zone`).
- Auto Pipeline: `app/auto-pipeline/page.js` (#L6335) (menampilkan `created_at` gabungan dari kampanye-kampanye di atas).

---

## 3. Usulan Perbaikan

Perbaikan terdiri dari **2 lapisan**: (1) Lapisan Data/PostgreSQL agar API mengirim timestamp UTC yang benar, dan (2) Lapisan Formatter UI agar selalu tampil konsisten sebagai **GMT+7 / WIB**.

### Lapisan 1 — Memperbaiki Sumber Timestamp (`TIMESTAMP WITHOUT TIME ZONE`)

Terdapat **2 opsi teknis** di lapisan data (pilih salah satu):

#### Opsi 1A (Direkomendasikan sebagai perbaikan cepat & minim risiko): Override Parser OID `1114` di `lib/db-pg.js`
- Di [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js), tambahkan parser eksplisit untuk PostgreSQL OID `1114` (`TIMESTAMP WITHOUT TIME ZONE`) agar memperlakukan nilai string dari PG (`Etc/UTC`) sebagai UTC (`Z`), bukan waktu lokal OS Mac Mini:
  ```js
  // Parse PostgreSQL TIMESTAMP WITHOUT TIME ZONE (OID: 1114) sebagai UTC
  // karena PostgreSQL server berjalan pada TimeZone = 'Etc/UTC'
  types.setTypeParser(1114, (val) => {
    if (!val) return null;
    const normalized = String(val).trim().replace(' ', 'T');
    if (/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(normalized)) {
      return new Date(normalized);
    }
    return new Date(`${normalized}Z`);
  });
  ```
- **Kelebihan**:
  - Tidak memerlukan migrasi DDL `ALTER TABLE` pada ratusan kolom (nol risiko *table lock* dan rollback tetap bersih).
  - Mengembalikan objek `Date` yang tipenya identik dengan perilaku `pg`, tetapi kini membawa epoch UTC yang benar (`2026-11-26T10:16:49.616Z` → di browser WIB tampil `17:16:49`).
  - Sekaligus memperbaiki Pillar Campaign, Multiplier Campaign, RE Campaign, Recipe Labs, dan seluruh menu lain yang membaca kolom `TIMESTAMP`.
- **Hal yang wajib diaudit sebelum diterapkan**:
  - Pastikan tidak ada query/kolom `TIMESTAMP WITHOUT TIME ZONE` di aplikasi yang sengaja diisi jam lokal WIB tanpa offset (misal `scheduler_jobs.run_at` atau `content_flow_items.production_date`), sehingga tidak terjadi pergeseran ke arah sebaliknya pada fitur terjadwal lain.

#### Opsi 1B (Jangka panjang / per tabel): Migrasi Kolom ke `TIMESTAMPTZ`
- Mengubah tipe kolom `created_at` (dan `updated_at` jika ada) pada tabel target (`pillar_campaigns`, `pillar_campaign_items`, `re_multiplier_tasks`, dst.) menjadi `TIMESTAMPTZ`:
  ```sql
  ALTER TABLE pillar_campaigns
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  ```
- **Kelebihan**: Skema PostgreSQL menjadi standar `TIMESTAMPTZ` seperti `re_deconstruct_batches` dan `auto_pipeline_schedules`; aman di SQL client mana pun tanpa bergantung parser Node.js.
- **Kekurangan**: Membutuhkan migrasi DDL database (`staging`, `dev`, dan `public`) dan sesuai SOP, rollback kode tidak mengembalikan tipe kolom database.

### Lapisan 2 — Penyeragaman Formatter Waktu WIB (`Asia/Jakarta`) di UI

Buat helper format waktu bersama, misalnya `lib/date-format.js`:
```js
export function formatWibDateTime(value, options = {}) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options
  })} WIB`;
}
```
- **Target penerapan Tahap 1** (sesuai permintaan):
  1. **Pillar Campaign**: [app/pillar-campaigns/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js) & [app/pillar-campaigns/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/[id]/page.js).
  2. **Multiplier Campaign**: [app/components/campaign-forms/MultiplierConfigurationForm.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/MultiplierConfigurationForm.js) & [app/multiplier-lab/[id]/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/[id]/page.js).
- **Target penerapan Tahap 2 (opsional lanjutan)**:
  - RE Campaign, Recipe Labs, dan Auto Pipeline.

---

## 4. Poin Keputusan Sebelum Implementasi

1. **Pilihan perbaikan di lapisan data**: Pilih **Opsi 1A** (`setTypeParser(1114)` di `lib/db-pg.js` + audit kolom jadwal `TIMESTAMP` tanpa migrasi DB) atau **Opsi 1B** (migrasi kolom `TIMESTAMPTZ` pada tabel Pillar & Multiplier)?
2. **Cakupan UI awal**: Cukup **Pillar Campaign + Multiplier Campaign** terlebih dahulu, atau sekalian seragamkan ke **RE Campaign, Recipe Labs, & Auto Pipeline** dalam satu branch perbaikan?
