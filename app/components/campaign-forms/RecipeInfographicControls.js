'use client';

import React from 'react';

const TEMPLATE_OPTIONS = [
  {
    id: 'step_grid_classic',
    code: 'T1',
    name: 'Classic Hero + Step Grid',
    badge: '5-7 Foto AI',
    desc: 'Hero besar + bahan samping + 4-6 kotak foto langkah bawah',
    wireframe: 'step_grid_classic'
  },
  {
    id: 'hero_right_editorial',
    code: 'T2',
    name: 'Editorial Bento Showcase',
    badge: '2 Foto AI',
    desc: 'Hero kanan jumbo + foto detail + kartu bahan kiri rapi',
    wireframe: 'hero_right_editorial'
  },
  {
    id: 'layered_band_cards',
    code: 'T3',
    name: 'Multi-Layer Component',
    badge: '2 Foto AI',
    desc: '3 pita komponen bahan sejajar + 2 foto hidangan kontras',
    wireframe: 'layered_band_cards'
  },
  {
    id: 'centerpiece_spotlight',
    code: 'T4',
    name: 'Centerpiece Spotlight',
    badge: '1 Foto AI',
    desc: 'Header tengah + foto fokus utama + 2 kolom bahan dan cara',
    wireframe: 'centerpiece_spotlight'
  },
  {
    id: 'magazine_vertical_split',
    code: 'T5',
    name: 'Magazine Vertical Split',
    badge: '4 Foto AI',
    desc: 'Sidebar bahan tinggi 45% + kolom editorial & 3 step kanan',
    wireframe: 'magazine_vertical_split'
  },
  {
    id: 'visual_ingredient_shelf',
    code: 'T6',
    name: 'Visual Pantry Shelf',
    badge: '7 Foto AI',
    desc: 'Rak kotak visual komponen + hingga 6 foto proses bertahap',
    wireframe: 'visual_ingredient_shelf'
  },
  {
    id: 'step_timeline_zigzag',
    code: 'T7',
    name: 'Vertical Timeline Steps',
    badge: '5 Foto AI',
    desc: 'Banner hero atas + alur timeline bernomor 4 foto proses',
    wireframe: 'step_timeline_zigzag'
  },
  {
    id: 'polaroid_scrapbook',
    code: 'T8',
    name: 'Polaroid Scrapbook',
    badge: '4 Foto AI',
    desc: 'Bingkai polaroid miring estetik + 3 foto step & catatan bahan',
    wireframe: 'polaroid_scrapbook'
  },
  {
    id: 'compact_2col_cheat_sheet',
    code: 'T9',
    name: '2-Column Cheat Sheet',
    badge: '1 Foto AI',
    desc: 'Header strip ringkas + tabel takaran & langkah padat',
    wireframe: 'compact_2col_cheat_sheet'
  }
];

const THEME_OPTIONS = [
  { id: 'warm_cream', name: 'Warm Kitchen', desc: 'Krem Hangat & Hijau' },
  { id: 'sage_kitchen', name: 'Sage Botanical', desc: 'Hijau Daun Segar' },
  { id: 'pastel_bakery', name: 'Pastel Bakery', desc: 'Merah Jambu Pastel' },
  { id: 'dark_bistro', name: 'Dark Bistro', desc: 'Gelap Premium Emas' }
];

const ASPECT_RATIO_OPTIONS = [
  { id: '3:4', label: '3:4 (1080x1440)', desc: 'Portrait IG / Pinterest' },
  { id: '4:5', label: '4:5 (1080x1350)', desc: 'Feed IG / FB Ideal' },
  { id: '1:1', label: '1:1 (1080x1080)', desc: 'Square Feed Universal' },
  { id: '9:16', label: '9:16 (1080x1920)', desc: 'Story / Reels / TikTok' }
];

function TemplateWireframe({ type, active }) {
  const accent = active ? 'var(--action-primary)' : 'var(--text-secondary)';
  const blockBg = active ? 'var(--status-info-soft)' : 'var(--surface-interactive)';
  const softLine = 'var(--border-strong)';

  const boxStyle = {
    width: '54px',
    height: '68px',
    borderRadius: '6px',
    border: `1px solid ${active ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
    background: 'var(--surface-raised)',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flexShrink: 0,
    boxSizing: 'border-box'
  };

  if (type === 'step_grid_classic') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ display: 'flex', gap: '3px', flex: '1.1' }}>
          <div style={{ flex: 1.2, borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
          <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', flex: '0.9' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ borderRadius: '2px', background: blockBg }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'hero_right_editorial') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ height: '12px', borderRadius: '3px', background: accent, opacity: 0.7 }} />
            <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          </div>
          <div style={{ flex: 1.2, borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
        </div>
        <div style={{ height: '14px', borderRadius: '3px', background: 'var(--surface-subtle)' }} />
      </div>
    );
  }

  if (type === 'layered_band_cards') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ height: '18px', borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', height: '16px' }}>
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        </div>
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)' }} />
          <div style={{ flex: 1, borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
        </div>
      </div>
    );
  }

  if (type === 'centerpiece_spotlight') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ height: '9px', borderRadius: '2px', background: accent, opacity: 0.7, marginInline: '6px' }} />
        <div style={{ height: '24px', borderRadius: '4px', background: blockBg, border: `1px solid ${accent}` }} />
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        </div>
      </div>
    );
  }

  if (type === 'magazine_vertical_split') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          <div style={{ flex: 0.85, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ flex: 1, borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
            <div style={{ flex: 0.8, borderRadius: '3px', background: blockBg }} />
            <div style={{ flex: 0.7, borderRadius: '3px', background: 'var(--surface-subtle)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'visual_ingredient_shelf') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ height: '18px', borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', height: '14px' }}>
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
          <div style={{ borderRadius: '2px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', flex: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderRadius: '2px', background: blockBg }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'step_timeline_zigzag') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ height: '17px', borderRadius: '3px', background: blockBg, border: `1px solid ${accent}` }} />
        <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
          <div style={{ flex: 0.85, borderRadius: '3px', background: 'var(--surface-subtle)' }} />
          <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '2px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: accent }} />
                <div style={{ flex: 1, height: '100%', borderRadius: '2px', background: blockBg }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'polaroid_scrapbook') {
    return (
      <div style={boxStyle} aria-hidden="true">
        <div style={{ display: 'flex', gap: '3px', height: '24px' }}>
          <div style={{ flex: 1, borderRadius: '3px', background: blockBg, border: `1px solid ${accent}`, transform: 'rotate(-2deg)' }} />
          <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', flex: 1, paddingTop: '2px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ borderRadius: '2px', background: blockBg, border: `1px solid ${softLine}` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={boxStyle} aria-hidden="true">
      <div style={{ display: 'flex', gap: '3px', height: '14px' }}>
        <div style={{ flex: 1.3, borderRadius: '2px', background: accent, opacity: 0.7 }} />
        <div style={{ flex: 0.7, borderRadius: '2px', background: blockBg, border: `1px solid ${accent}` }} />
      </div>
      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
        <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
        <div style={{ flex: 1, borderRadius: '3px', background: 'var(--surface-subtle)', border: `1px solid ${softLine}` }} />
      </div>
    </div>
  );
}

export default function RecipeInfographicControls({
  value = {},
  onChange,
  curatedRecipes = [],
  loadingRecipes = false,
  products = [],
  isScheduleMode = false,
  defaultBrandName = ''
}) {
  const {
    outputStyle = 'recipe_infographic',
    infographicTemplate = isScheduleMode ? 'auto_rotate' : 'step_grid_classic',
    infographicTheme = 'warm_cream',
    infographicAspectRatio = '3:4',
    recipeSource = 'ai_generated',
    curatedRecipeId = '',
    librarySelectionMode = 'sequential',
    productId = 'none',
    showBrandWatermark = true,
    brandWatermarkText = ''
  } = value;

  const update = (patch) => {
    if (typeof onChange === 'function') {
      onChange({ ...value, ...patch });
    }
  };

  const isInfographic = outputStyle === 'recipe_infographic';
  const isAutoRotate = infographicTemplate === 'auto_rotate';
  const effectiveBrand = brandWatermarkText || defaultBrandName || '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '14px',
      borderRadius: '12px',
      background: 'var(--surface-subtle)',
      border: '1px solid var(--border-subtle)'
    }}>
      {/* 1. Output Style Selector */}
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Gaya Output Gambar Resep
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
          {[
            {
              id: 'recipe_infographic',
              title: 'Poster Infografis Resep Lengkap',
              badge: 'Rekomendasi',
              desc: 'Poster siap simpan berisi judul, bahan, langkah masak, tips, dan watermark brand.'
            },
            {
              id: 'photo_grid',
              title: 'Kolase Grid Foto Polos (Lama)',
              badge: 'Klasik',
              desc: 'Susunan kolase foto makanan tanpa overlay teks resep di atas poster.'
            }
          ].map((opt) => {
            const active = outputStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ outputStyle: opt.id })}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: active ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--surface-raised)' : 'var(--surface)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{opt.title}</span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: active ? 'var(--action-primary)' : 'var(--surface-interactive)',
                    color: active ? 'var(--on-action-primary)' : 'var(--text-secondary)'
                  }}>
                    {opt.badge}
                  </span>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Asal Resep */}
      <div style={{
        paddingTop: '10px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Asal Konten Resep
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
          {[
            {
              id: 'ai_generated',
              title: 'AI Bikin Sendiri',
              desc: 'AI meracik resep autentik baru sesuai topik/kategori yang Anda tulis.'
            },
            {
              id: 'recipe_library',
              title: `Dari Recipe Library (${curatedRecipes.length} resep)`,
              desc: 'Gunakan data bahan, takaran, dan langkah teruji dari koleksi Recipe Library.'
            }
          ].map((opt) => {
            const active = recipeSource === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ recipeSource: opt.id })}
                style={{
                  textAlign: 'left',
                  padding: '9px 11px',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  border: active ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--surface-raised)' : 'var(--surface)'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{opt.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {recipeSource === 'recipe_library' && (
          <div style={{
            padding: '10px',
            borderRadius: '9px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {isScheduleMode ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Mode Pemilihan Resep per Eksekusi Jadwal
                </label>
                <select
                  value={librarySelectionMode}
                  onChange={(e) => update({ librarySelectionMode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '7px',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="sequential">Berurutan Otomatis (Prioritaskan Belum Dipakai)</option>
                  <option value="random">Acak dari Recipe Library (Prioritaskan Belum Dipakai)</option>
                  <option value="manual">Selalu Gunakan Resep Tertentu</option>
                </select>
              </div>
            ) : null}

            {(!isScheduleMode || librarySelectionMode === 'manual') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Pilih Resep dari Recipe Library {loadingRecipes ? '(Memuat...)' : ''}
                </label>
                <select
                  value={curatedRecipeId || ''}
                  onChange={(e) => update({ curatedRecipeId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '7px',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="">-- Pilih Resep Otomatis (Belum Dipakai) --</option>
                  {curatedRecipes.map((rec) => (
                    <option key={rec.id} value={String(rec.id)}>
                      {rec.title} [{rec.category || 'Resep'}]{rec.used_count > 0 ? ` (dipakai ${rec.used_count}x)` : ' (baru)'}
                    </option>
                  ))}
                </select>
                {curatedRecipes.length === 0 && !loadingRecipes && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--status-warning)', marginTop: '4px' }}>
                    Belum ada resep di Recipe Library untuk tenant aktif. Impor batch resep terlebih dahulu atau pilih mode AI Bikin Sendiri.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Opsi Visual & 9 Template Poster Infografis */}
      {isInfographic && (
        <div style={{
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Auto-Rotate Banner + Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Template Layout Poster Infografis (9 Variasi)
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                  Setiap template menyesuaikan kuota foto G-Labs secara otomatis agar hemat kuota atau tampil lengkap.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => update({ infographicTemplate: isAutoRotate ? 'step_grid_classic' : 'auto_rotate' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                border: isAutoRotate ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                background: isAutoRotate ? 'var(--status-info-soft)' : 'var(--surface)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Mode Auto-Rotasi 9 Template
                  </span>
                  <span style={{
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: isAutoRotate ? 'var(--action-primary)' : 'var(--surface-interactive)',
                    color: isAutoRotate ? 'var(--on-action-primary)' : 'var(--text-secondary)'
                  }}>
                    {isAutoRotate ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {isAutoRotate
                    ? 'Sistem memutar otomatis ke template berbeda di setiap post agar feed sosial media selalu variatif.'
                    : 'Aktifkan agar setiap posting/eksekusi memilih tata letak berbeda dari 9 template secara bergantian.'}
                </span>
              </div>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '5px 10px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                background: isAutoRotate ? 'var(--action-primary)' : 'var(--surface-interactive)',
                color: isAutoRotate ? 'var(--on-action-primary)' : 'var(--text-primary)'
              }}>
                {isAutoRotate ? 'Pilih Manual' : 'Aktifkan Auto-Rotasi'}
              </span>
            </button>
          </div>

          {/* 9 Template Wireframe Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '8px'
          }}>
            {TEMPLATE_OPTIONS.map((tpl) => {
              const active = infographicTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => update({ infographicTemplate: tpl.id })}
                  style={{
                    textAlign: 'left',
                    padding: '9px 10px',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: active ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'var(--surface-raised)' : 'var(--surface)',
                    opacity: isAutoRotate ? 0.78 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <TemplateWireframe type={tpl.wireframe} active={active} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tpl.code}. {tpl.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.69rem', color: 'var(--text-secondary)', lineHeight: 1.3, marginBottom: '4px' }}>
                      {tpl.desc}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: active ? 'var(--action-primary)' : 'var(--surface-interactive)',
                      color: active ? 'var(--on-action-primary)' : 'var(--text-secondary)'
                    }}>
                      {tpl.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            {/* Tema Warna */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Palet Warna Poster
              </label>
              <select
                value={infographicTheme}
                onChange={(e) => update({ infographicTheme: e.target.value })}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem'
                }}
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.desc})</option>
                ))}
              </select>
            </div>

            {/* Rasio Poster */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Rasio Dimensi Poster
              </label>
              <select
                value={infographicAspectRatio}
                onChange={(e) => update({ infographicAspectRatio: e.target.value })}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem'
                }}
              >
                {ASPECT_RATIO_OPTIONS.map((ar) => (
                  <option key={ar.id} value={ar.id}>{ar.label} - {ar.desc}</option>
                ))}
              </select>
            </div>

            {/* Sisipan Produk Opsional */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Sisipkan Produk dari Database (Opsional)
              </label>
              <select
                value={productId || 'none'}
                onChange={(e) => update({ productId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem'
                }}
              >
                <option value="none">Tanpa Produk (Murni Resep)</option>
                <option value="auto">Otomatis Cari Produk Relevan di Katalog</option>
                {products.map((p) => (
                  <option key={p.product_id || p.id} value={String(p.product_id || p.id)}>
                    {p.name || p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Watermark Nama Brand */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 11px',
            borderRadius: '9px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={showBrandWatermark !== false}
                onChange={(e) => update({ showBrandWatermark: e.target.checked })}
              />
              <span>Tampilkan Watermark Nama Brand di Pojok Poster</span>
            </label>
            {showBrandWatermark !== false && (
              <input
                type="text"
                placeholder={defaultBrandName ? `Default: ${defaultBrandName}` : 'Ketik nama brand / akun IG'}
                value={brandWatermarkText || ''}
                onChange={(e) => update({ brandWatermarkText: e.target.value })}
                style={{
                  flex: '1 1 200px',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.79rem'
                }}
              />
            )}
            {showBrandWatermark !== false && effectiveBrand && (
              <span style={{ fontSize: '0.71rem', color: 'var(--text-secondary)' }}>
                Preview badge: @{effectiveBrand.replace(/\s+/g, '')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
