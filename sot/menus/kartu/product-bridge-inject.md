# Kartu Menu: Product Bridging

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/product-bridge-inject` · Kelompok: WORKFLOW · Kunci izin menu: `product_bridging`

## Fungsi
Penyisip produk cerdas ke konten yang sudah ada. Mengambil naskah video atau artikel yang belum menyebut produk, lalu menyisipkan produk brand secara halus di titik yang paling natural — tanpa terasa seperti iklan kasar. Pola yang sama dengan Multiplier Labs tapi untuk konten yang bukan hasil deconstruct.

## Alur pakai
1. Masukkan naskah/konten sumber (upload atau tempel teks).
2. Pilih produk yang ingin disisipkan.
3. Tentukan di klip/paragraf ke berapa produk mulai disebut.
4. Jalankan; sistem menghasilkan versi naskah dengan sisipan produk.

## Terhubung dengan
- Butuh data dari: Product Database.
- Perintah MCP: tidak ada perintah MCP khusus Product Bridging.

## Lokasi (untuk agent)
- Halaman: `app/product-bridge-inject/page.js`, `app/product-bridge-inject/[id]/page.js`
- Tabel data: `bridge_injector_campaigns` (tenant-isolated)

## Aturan penting & jebakan
1. Sisipan produk harus natural — validasi editorial tetap dilakukan oleh AI sebelum output final.
2. Panduan penyisipan ada di `kb/MULTIPLIER_BRIDGING_GUIDE.md` — berlaku juga di sini.

## Belum ada / batasan
- Belum ada render video langsung dari hasil bridging; output berupa naskah yang bisa dibawa ke pipeline lain.

## Dokumen lengkap
`sot/menus/blueprint_product_bridging_injector.md`, `kb/MULTIPLIER_BRIDGING_GUIDE.md`
