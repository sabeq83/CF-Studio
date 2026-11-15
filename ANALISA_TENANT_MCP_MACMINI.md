# Analisa: Preset "tidak ditemukan" saat CF Autopipeline dijalankan dari Mac Mini

> Tanggal: 15 Nov 2026 · Status: **analisa & usulan — belum ada kode yang diubah**
> Konteks: skill `cfa-penulis` dan `cfa-produksi` di Mac Mini gagal membaca/memakai preset `habitfolk_8clips_deep`, sedangkan dari MCP di laptop preset terbaca normal.

## 1. Ringkasan

**Bukan masalah IP dan bukan masalah cache.** Penyebabnya adalah **tenant**:

- Token MCP yang dipakai (operator credential **`opcred_antigravity_ide`**) di database staging terikat ke tenant **`tnt_pt-gim-sosmed_62d0d9`** (PT GIM Sosmed).
- Brand HabitFolk, preset `habitfolk_8clips_deep`, dan Visual Identity-nya ada di tenant **`default_tenant`**.
- MCP di laptop berhasil karena **sesi MCP-nya pernah dipindah ke `default_tenant`** lewat `cf_switch_tenant` (pengaturan ini hanya tersimpan di memori proses MCP itu). Sesi MCP baru — seperti yang dijalankan agent di Mac Mini — mulai dari tenant bawaan token, yaitu PT GIM.

Dugaan saya sebelumnya (cache memori di route preset) **keliru** dan saya tarik.

## 2. Bukti

| Uji | Hasil |
|---|---|
| `GET /api/operator/v1/whoami` dari Mac Mini (HTTP langsung, 3x) | `tenant_id: tnt_pt-gim-sosmed_62d0d9` |
| `GET /api/operator/v1/whoami` dari **laptop** (HTTP langsung, token sama) | `tenant_id: tnt_pt-gim-sosmed_62d0d9` |
| `cf_whoami` lewat **MCP laptop** (proses lama sejak 14 Nov) | `tenant_id: default_tenant`, `session_active_tenant: default_tenant` |
| `cf_get_preset_detail` lewat MCP laptop | berhasil |
| Preset lewat HTTP langsung (laptop & Mac Mini, curl/python/node) | 404 "Preset tidak ditemukan." |
| `cf_submit_custom_storyboard` dari Mac Mini | 400: preset tidak ditemukan **pada tenant `tnt_pt-gim-sosmed_62d0d9`** |
| Sidik (hash) token laptop vs Mac Mini | identik (`22165f26f9…`) |

Jadi perbedaannya bukan mesin/IP — laptop pun gagal bila memanggil langsung tanpa lewat sesi MCP lama.

## 3. Cara kerjanya di kode (hanya dibaca)

1. `lib/operator-auth.js:29-55` dan `lib/auth.js:237-268` — tenant diambil dari `operator_credentials.tenant_id` milik token. Bila token punya scope `tenant:superadmin`, header **`x-tenant-override`** bisa memindahkan tenant per request.
2. `apps/mcp/tools.mjs:340` — `let activeTenantOverride = null;` saat proses MCP mulai. Hanya `cf_switch_tenant` (`tools.mjs:401-416`) yang mengisinya, lalu semua request berikutnya di sesi itu mengirim `x-tenant-override` (`tools.mjs:296, 344`).
3. Tidak ada variabel lingkungan untuk tenant bawaan MCP. Setiap sesi MCP baru otomatis kembali ke tenant token (PT GIM).

Kesimpulan: siapa pun yang memakai token ini dari sesi MCP baru akan bekerja di **tenant PT GIM**, kecuali memanggil `cf_switch_tenant` lebih dulu.

## 4. Risiko yang perlu diketahui

- **Risiko salah tenant saat menulis data.** Agent di Mac Mini (atau sesi MCP baru mana pun, termasuk Claude Desktop/Antigravity yang baru dibuka) yang membuat kampanye, jadwal, atau publishing tanpa `cf_switch_tenant` akan menulis ke **tenant PT GIM**. Uji produksi salmon tadi gagal hanya karena presetnya tidak ada di PT GIM — kalau tidak memakai preset, kampanye bisa saja terbuat di tenant yang salah.
- **Akun Repliz HabitFolk** juga milik `default_tenant`; publish dari tenant PT GIM akan gagal atau salah akun.
- Tidak jelas sesi mana yang dulu memanggil `cf_switch_tenant('default_tenant')` di MCP laptop; begitu Claude Desktop di-restart, MCP laptop juga akan kembali ke PT GIM.

## 5. Usulan perbaikan

### Opsi A — Perbaikan di skill CFA (tanpa mengubah kode CF Studio) · **disarankan untuk sekarang**
- Tambah `"tenant": "default_tenant"` di `~/cf-autopipeline/config.json` (per brand atau global).
- Setiap skill yang memanggil CF Studio wajib, di awal putaran: `cf_switch_tenant(<tenant>)` → `cf_whoami` → pastikan `session_active_tenant` sama dengan config. Tidak sama → berhenti dan `log`, **jangan** membuat apa pun.
- Izinkan tool `mcp__cf-studio__cf_switch_tenant` di `.claude/settings.json` Mac Mini.
- Dampak: hanya file skill & config milik CFA. Bisa saya kerjakan begitu Anda setujui.

### Opsi B — Credential operator khusus per tenant (data, tanpa kode) · **disarankan permanen**
- Buat operator credential baru yang **terikat ke `default_tenant`** dengan scope minimal yang dibutuhkan CFA (`content:create, content:read, automation:read, automation:write`) — tanpa `tenant:superadmin`.
- Pakai credential itu khusus untuk Mac Mini/CFA. `opcred_antigravity_ide` tetap untuk Antigravity.
- Keuntungan: tidak bergantung pada `cf_switch_tenant`, dan agent CFA tidak punya hak superadmin lintas tenant (lebih aman).
- Perlu: dibuat lewat menu Settings CF Studio (jika ada) atau oleh Antigravity langsung di database staging. Token baru disimpan hanya di konfigurasi MCP Mac Mini.

### Opsi C — Tenant bawaan lewat env di MCP server (perubahan kode kecil, untuk Antigravity)
- Di `apps/mcp/tools.mjs:340`: inisialisasi `activeTenantOverride` dari env, mis. `process.env.CF_STUDIO_OPERATOR_TENANT_OVERRIDE || null`.
- Lalu MCP Mac Mini diberi env `CF_STUDIO_OPERATOR_TENANT_OVERRIDE=default_tenant`.
- Berguna untuk semua klien MCP, tapi Opsi B tetap lebih aman.

### Rekomendasi
1. **Sekarang:** Opsi A → produksi salmon bisa jalan hari ini.
2. **Minggu ini:** Opsi B (minta Antigravity membuat credential `default_tenant` khusus CFA), lalu Opsi A tetap dipertahankan sebagai pengaman ganda.
3. **Opsional:** Opsi C bila ada klien MCP lain yang sering lupa pindah tenant.

## 6. Perlu bantuan Antigravity?
- **Opsi A:** tidak perlu.
- **Opsi B:** ya, kecuali CF Studio sudah punya menu untuk membuat operator credential per tenant.
- **Opsi C:** ya (perubahan kode + rilis + deploy staging sesuai SOP).

## 7. Catatan: temuan CF Studio lain dari sesi uji ini
(daftar lengkap di `USULAN_AUTOPIPELINE_VERSI_CLAUDE.md` bagian 9)
1. Mode `direct_passthrough` mengabaikan `visual_prompt` bila `visual_action` diisi.
2. Tidak ada tool MCP untuk membatalkan custom storyboard (`cst_*`).
3. Output `cf_get_storyboard_status` terlalu besar (70–146 ribu karakter).
4. `sanitizeImagePrompt` menghapus seluruh sisa prompt setelah `--no` bila tidak ada `[`/`(` (`lib/webhook-client.js:251`).
5. **Baru:** operator credential `opcred_antigravity_ide` terikat ke tenant PT GIM, sementara banyak pekerjaan HabitFolk berjalan di `default_tenant` — pastikan memang disengaja.
