# Rencana Implementasi: Halaman Recipe Library (Pustaka Resep Kuliner) di CF Studio

> [!NOTE]
> Rencana implementasi ini bertujuan untuk menghadirkan antarmuka pengguna resmi (**Recipe Library**) di aplikasi web CF Studio. Halaman ini menghubungkan repositori database `curated_recipes` dan batch importer engine yang telah selesai di backend, memungkinkan pengguna menavigasi menu `🍲 Recipe Library` di Sidebar, mencari dan memfilter resep terkurasi, melihat detail bahan yang 100% terkunci (*strict guardrail*), mengimpor hingga 50 URL secara sekuensial dengan jeda acak 10–20 detik anti-bot, serta meluncurkan produksi video memasak langsung ke Auto Pipeline.

---

## Ringkasan Arsitektur & Antarmuka

1. **Navigasi Sidebar (`app/components/Sidebar.js`)**:
   - Menambahkan menu **`🍲 Recipe Library`** di kategori `PLANNING` bersebelahan dengan *Product Database*.
   - Memetakan rute `/recipe-library` ke peta otorisasi menu.

2. **Halaman Pustaka Resep (`app/recipe-library/page.js`)**:
   - **Header & Ringkasan Metrik**: Menampilkan total resep, jumlah resep ter-polish, persentase bahan terkunci 100%, dan status siap video.
   - **Filter & Search Bar**: Live search real-time (nama masakan/bahan), filter kategori (*Makanan Utama, Dessert, Tradisional*), filter status polish (*Polished vs Raw*), dan filter domain sumber (*Cookpad, Masak Apa Hari Ini, dll.*).
   - **Tabel Pustaka Resep**: Menampilkan daftar resep terkurasi dari endpoint `GET /api/v2/recipes/curated/import-batch` dengan tautan sumber asli, badge keaslian bahan, porsi, waktu masak, dan tombol aksi (*Detail*, *Buat Video*, *Hapus*).
   - **Modal Impor Batch (Hingga 50 URL)**: Dialog interaktif untuk memasukkan hingga 50 URL resep, memilih preset gaya visual dan jeda acak 10-20 detik anti-bot, dengan progress bar real-time dan log terminal status.
   - **Modal Detail Resep**: Menampilkan daftar bahan mentah yang 100% terkunci tanpa polesan AI, langkah instruksi sensori hasil polesan, dan prompt foto 5-layer optical stack.

3. **Kepatuhan Token Desain Semantik (Universal Theme)**:
   - 100% menggunakan token CSS dari `app/theme.css` (`var(--canvas)`, `var(--surface)`, `var(--text-primary)`, `var(--action-primary)`, dll.).
   - Tanpa hardcoded color (`#hex` atau `rgb()`).
   - Adaptif sempurna untuk Dark Mode dan Light Mode.

---

## Execution Task List
- [x] **Task 1: Perbarui Navigasi Sidebar `app/components/Sidebar.js`** untuk mendaftarkan menu `🍲 Recipe Library` di bawah kategori `PLANNING`.
- [x] **Task 2: Buat Halaman Client Component `app/recipe-library/page.js`** dengan antarmuka tabel, metrik, modal detail, dan modal impor batch 50 URL.
- [x] **Task 3: Hubungkan Aksi "Buat Video" ke Auto Pipeline (`/auto-pipeline?pipeline_type=recipe_campaign`)**.
- [x] **Task 4: Pengujian & Verifikasi Build Next.js (`npm run build`)**.
- [x] **Task 5: Rilis Non-Interaktif & Atomic Deployment ke Staging Mac Mini**.

---

## Before & After Code Snippets

### 1. `app/components/Sidebar.js`

#### Code Sebelum (Current/Before):
```javascript
const menuKeyMap = {
  '/auto-pipeline': 'pillar_campaign',
  '/youtube-studio': 'youtube_studio',
  '/affiliate-studio': 'affiliate_studio',
  '/contentflow-studio': 'content_flow',
  '/content-flow': 'content_flow',
  '/instant-factory': 'instant_campaign',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  '/content-automations': 'content_automations',
  '/products': 'product_database',
  '/deconstruct': 'deconstruct_lab',
  // ...
};

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  // ...
];
```

#### Code Sesudah (Proposed/After):
```javascript
const menuKeyMap = {
  '/auto-pipeline': 'pillar_campaign',
  '/youtube-studio': 'youtube_studio',
  '/affiliate-studio': 'affiliate_studio',
  '/contentflow-studio': 'content_flow',
  '/content-flow': 'content_flow',
  '/instant-factory': 'instant_campaign',
  '/re-campaigns': 're_campaign',
  '/pillar-campaigns': 'pillar_campaign',
  '/content-planner': 'content_planner',
  '/content-automations': 'content_automations',
  '/products': 'product_database',
  '/recipe-library': 'product_database',
  '/deconstruct': 'deconstruct_lab',
  // ...
};

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◈' },

  { section: 'PLANNING' },
  { label: 'Content Planner', href: '/content-planner', icon: '🗓️' },
  { label: 'Product Database', href: '/products', icon: '📦' },
  { label: 'Recipe Library', href: '/recipe-library', icon: '🍲' },
  { label: 'Deconstruct Lab', href: '/deconstruct', icon: '🔬' },
  { label: 'Preset Manager', href: '/settings/presets', icon: '🎛️' },
  // ...
];
```

---

### 2. `app/recipe-library/page.js` (File Baru)

#### Code Sesudah (Proposed/After):
```javascript
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';

export default function RecipeLibraryPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [polishFilter, setPolishFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Batch Importer State
  const [importUrls, setImportUrls] = useState('');
  const [stylePreset, setStylePreset] = useState('Food Porn');
  const [delayMode, setDelayMode] = useState('random-10-20');
  const [isImporting, setIsImporting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [importLogs, setImportLogs] = useState([]);

  // Fetch data
  const loadRecipes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/recipes/curated/import-batch?limit=100');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRecipes(json.data);
      }
    } catch (err) {
      console.error('Gagal memuat resep:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // Filter logic
  const filteredRecipes = recipes.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.original_title?.toLowerCase().includes(q) ||
      r.polished_title?.toLowerCase().includes(q) ||
      (Array.isArray(r.ingredients_raw) && r.ingredients_raw.some(i => String(i).toLowerCase().includes(q)));
    const matchCategory = !categoryFilter || r.category === categoryFilter;
    const matchPolish = !polishFilter || r.polish_status === polishFilter;
    const matchDomain = !domainFilter || r.source_domain === domainFilter;
    return matchSearch && matchCategory && matchPolish && matchDomain;
  });

  // Metrik
  const totalCount = recipes.length;
  const polishedCount = recipes.filter(r => r.polish_status === 'polished').length;
  const frozenCount = recipes.filter(r => Array.isArray(r.ingredients_raw) && r.ingredients_raw.length > 0).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--canvas)', color: 'var(--text-primary)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto', minWidth: 0 }}>
        {/* Topbar, Metrics, Filters, Table, Modal Import & Detail */}
      </main>
    </div>
  );
}
```

---

## Verifikasi dan Pengujian
1. **Verifikasi Tampilan UI**: Halaman memuat resep dari database `curated_recipes` secara dinamis.
2. **Pengujian Filter**: Pencarian real-time dan dropdown kategori/polish berfungsi mulus.
3. **Pengujian Modal Impor**: Menjalankan batch import hingga 50 URL ke API `/api/v2/recipes/curated/import-batch` dengan jeda acak 10-20 detik dan pembaruan tabel otomatis saat selesai.
4. **Pengujian Responsif & Tema**: Menggunakan 100% token semantik dari `app/theme.css` untuk Dark & Light mode.
5. **Next.js Production Build**: `npm run build` sukses tanpa error.
6. **Rilis & Deployment**: Menjalankan rilis non-interaktif dan atomic deployment ke Mac Mini Staging.
