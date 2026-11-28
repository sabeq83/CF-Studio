'use client';

import { useMemo, useState } from 'react';

const TEMPLATE_OPTIONS = [
  { id: 'infographic_step_grid', title: 'Step-Photo Grid', desc: 'Hero + Bahan + 4-6 Foto Step' },
  { id: 'infographic_text_steps', title: 'Text Steps', desc: 'Hero + Bahan/Layer + 4 Langkah' },
  { id: 'infographic_visual_ingredients', title: 'Visual Bahan', desc: 'Kartu Bahan + Step Grid' }
];

const THEME_OPTIONS = [
  { id: 'warm_cream', label: 'Krem Hangat', swatch: 'var(--status-warning-soft)' },
  { id: 'fresh_pandan', label: 'Pandan Segar', swatch: 'var(--status-success-soft)' },
  { id: 'bakery_choco', label: 'Cokelat Bakery', swatch: 'var(--surface-interactive)' },
  { id: 'pastel_playful', label: 'Pastel Ceria', swatch: 'var(--status-rose-soft)' }
];

export default function RecipeInfographicControls({
  value = {},
  onChange,
  curatedRecipes = [],
  loadingRecipes = false,
  products = [],
  isScheduleMode = false,
  defaultBrandName = ''
}) {
  const [recipeSearch, setRecipeSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const {
    outputStyle = 'recipe_infographic',
    infographicTemplate = 'infographic_step_grid',
    infographicTheme = 'warm_cream',
    recipeSource = 'ai_generated',
    curatedRecipeId = '',
    librarySelectionMode = 'manual',
    showBrandWatermark = true,
    brandWatermarkText = '',
    productId = ''
  } = value;

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    return (curatedRecipes || []).filter(r => {
      if (!q) return true;
      const title = (r.polished_title || r.original_title || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      return title.includes(q) || cat.includes(q);
    });
  }, [curatedRecipes, recipeSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (products || []).filter(p => {
      if (!q) return true;
      return (p.product_name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    }).slice(0, 60);
  }, [products, productSearch]);

  const patch = (next) => {
    if (typeof onChange === 'function') onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Format Output Visual */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Format Output Visual
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {[
            { id: 'recipe_infographic', title: 'Poster Infografis Resep', sub: 'Hybrid: Foto AI bersih + HTML-to-Image (0% typo)' },
            { id: 'photo_grid', title: 'Grid Kolase Foto (Lama)', sub: '3 sampai 6 foto polos tanpa teks di kanvas Sharp' }
          ].map(opt => {
            const active = outputStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ outputStyle: opt.id })}
                style={{
                  textAlign: 'left',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: active ? '1.5px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{opt.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{opt.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pilihan Sumber Resep */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem'
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Asal Resep (Recipe Library atau AI Bikin Sendiri)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {[
            { id: 'ai_generated', title: 'AI Bikin Sendiri', sub: 'Gemini buat resep lengkap sesuai topik & kategori' },
            { id: 'recipe_library', title: 'Ambil dari Recipe Library', sub: 'Gunakan resep terkurasi (takaran asli dikunci)' }
          ].map(opt => {
            const active = recipeSource === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ recipeSource: opt.id })}
                style={{
                  textAlign: 'left',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: active ? '1.5px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{opt.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{opt.sub}</div>
              </button>
            );
          })}
        </div>

        {recipeSource === 'recipe_library' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.25rem' }}>
            {isScheduleMode && (
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Mode Pemilihan di Jadwal
                </label>
                <select
                  value={librarySelectionMode}
                  onChange={(e) => patch({ librarySelectionMode: e.target.value })}
                  style={{
                    width: '100%',
                    height: '38px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem'
                  }}
                >
                  <option value="auto_library_rotation">Auto-Rotasi dari Recipe Library (Anti-Ulang)</option>
                  <option value="manual">Pilih 1 Resep Spesifik</option>
                </select>
              </div>
            )}

            {(!isScheduleMode || librarySelectionMode === 'manual') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <input
                  type="search"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="Cari judul atau kategori di Recipe Library..."
                  style={{
                    height: '36px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem'
                  }}
                />
                <select
                  value={curatedRecipeId}
                  onChange={(e) => patch({ curatedRecipeId: e.target.value })}
                  style={{
                    height: '38px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem'
                  }}
                >
                  <option value="">
                    {loadingRecipes ? 'Memuat daftar Recipe Library...' : `-- Pilih Resep (${filteredRecipes.length} tersedia) --`}
                  </option>
                  {filteredRecipes.map(r => (
                    <option key={r.id} value={r.id}>
                      {(r.polished_title || r.original_title)} ({r.category || 'umum'} · dipakai {r.used_in_campaign_count || 0}x)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{
              padding: '0.45rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--status-success-soft)',
              color: 'var(--status-success)',
              fontSize: '0.73rem',
              fontWeight: 600
            }}>
              Takaran bahan dan urutan langkah dari Recipe Library dipertahankan persis tanpa diubah AI.
            </div>
          </div>
        )}
      </div>

      {/* Pengaturan Layout & Tema Poster Infografis */}
      {outputStyle === 'recipe_infographic' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Template &amp; Tema Warna Poster Infografis
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.45rem' }}>
            {TEMPLATE_OPTIONS.map(tpl => {
              const active = infographicTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => patch({ infographicTemplate: tpl.id })}
                  style={{
                    textAlign: 'left',
                    padding: '0.55rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: active ? '1.5px solid var(--status-rose)' : '1px solid var(--border-subtle)',
                    background: active ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{tpl.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{tpl.desc}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem' }}>
            {THEME_OPTIONS.map(th => {
              const active = infographicTheme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => patch({ infographicTheme: th.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: active ? '1.5px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                    color: 'var(--text-primary)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: th.swatch, border: '1px solid var(--border-strong)', flexShrink: 0 }} />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Nama Brand Watermark & Produk Opsional */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Tampilkan Nama Brand di Pojok Poster Infografis
          </span>
          <input
            type="checkbox"
            checked={showBrandWatermark}
            onChange={(e) => patch({ showBrandWatermark: e.target.checked })}
            style={{ width: '18px', height: '18px', accentColor: 'var(--action-primary)', cursor: 'pointer' }}
          />
        </label>

        {showBrandWatermark && (
          <input
            type="text"
            value={brandWatermarkText}
            onChange={(e) => patch({ brandWatermarkText: e.target.value })}
            placeholder={defaultBrandName ? `Kosongkan untuk pakai otomatis: ${defaultBrandName}` : 'Contoh: @NutriBake.id atau Dapur Botani'}
            style={{
              height: '36px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 0.75rem',
              color: 'var(--text-primary)',
              fontSize: '0.82rem'
            }}
          />
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Sisipkan Produk dari Product Database (Opsional)
          </label>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Filter produk katalog..."
              style={{
                flex: '1 1 160px',
                height: '36px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 0.75rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem'
              }}
            />
            <select
              value={productId}
              onChange={(e) => patch({ productId: e.target.value })}
              style={{
                flex: '2 1 220px',
                height: '36px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 0.75rem',
                color: 'var(--text-primary)',
                fontSize: '0.8rem'
              }}
            >
              <option value="">Tanpa Produk (Konten Resep Organik Murni)</option>
              <option value="auto">Auto-Pilih Produk Paling Cocok di Brand Ini</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.product_name} {p.category ? `(${p.category})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
