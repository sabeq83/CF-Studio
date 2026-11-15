'use client';

import { useMemo } from 'react';
import { pickAutoMatchedBrandProduct } from '@/lib/recipe-product-matcher-shared';

const MODES = [
  {
    id: 'auto',
    title: '✨ Auto Katalog',
    desc: 'Cocokkan otomatis produk aktif brand sesuai topik resep (bawaan saat bridging preset aktif).'
  },
  {
    id: 'manual',
    title: '🎯 Pilih Manual',
    desc: 'Kunci 1 produk spesifik dari katalog brand untuk tampil di slot klip bridging.'
  },
  {
    id: 'none',
    title: '🌿 Tanpa Produk',
    desc: 'Paksa resep organik murni (matikan bridging klip meski preset mengaktifkannya).'
  }
];

/**
 * Shared UI Control for recipe_campaign Product Bridging & Catalog Auto-Match.
 * Uses 100% semantic CSS design tokens from app/theme.css.
 */
export default function RecipeProductBridgingControl({
  presetConfig = null,
  brandId = null,
  topic = '',
  category = 'makanan_utama',
  isBatchMenuList = false,
  catalogProducts = [],
  productMode = 'auto',
  onProductModeChange,
  selectedProductId = '',
  onSelectProductId,
  searchQuery = '',
  onSearchQueryChange
}) {
  const pb = presetConfig?.product_bridging || {};
  const presetSegments = Array.isArray(pb.bridge_segments) && pb.bridge_segments.length > 0
    ? pb.bridge_segments
    : (pb.is_bridging_active ? [{ at_clip: Number(pb.bridge_at_clip || 4), duration_clips: Number(pb.bridge_duration_clips || 1), role: 'intro' }] : []);

  const brandPool = useMemo(() => {
    if (!brandId) return catalogProducts;
    const filtered = catalogProducts.filter(
      p => Array.isArray(p.brand_links) && p.brand_links.some(bl => bl.brand_profile_id === brandId && bl.is_active !== false)
    );
    return filtered.length > 0 ? filtered : catalogProducts;
  }, [catalogProducts, brandId]);

  const autoMatch = useMemo(
    () => pickAutoMatchedBrandProduct(brandPool, { brandId, topic, category }),
    [brandPool, brandId, topic, category]
  );

  const filteredManualProducts = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return brandPool.filter(p => !q || `${p.product_name || ''} ${p.category || ''}`.toLowerCase().includes(q));
  }, [brandPool, searchQuery]);

  const segSummary = presetSegments.length > 0
    ? presetSegments.map(s => `Klip ${s.at_clip}${s.role ? ` (${s.role})` : ''}`).join(', ')
    : 'Preset ini tidak menyalakan bridging otomatis';

  const isBridgingWillRun = productMode !== 'none' && (Boolean(pb.is_bridging_active) || productMode === 'manual');

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1.5px solid color-mix(in srgb, var(--action-primary) 45%, var(--border-subtle))',
      borderRadius: 'var(--radius-md)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>🛍️</span>
          <span>Integrasi Produk Katalog &amp; Bridging Resep</span>
        </div>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.2rem 0.6rem',
          borderRadius: 9999,
          background: isBridgingWillRun ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
          color: isBridgingWillRun ? 'var(--status-success)' : 'var(--status-warning)',
          border: `1px solid color-mix(in srgb, ${isBridgingWillRun ? 'var(--status-success)' : 'var(--status-warning)'} 35%, transparent)`
        }}>
          {isBridgingWillRun
            ? `Bridging Aktif: ${presetSegments.length > 0 ? presetSegments.map(s => `Klip ${s.at_clip}`).join(' & ') : 'Klip 4 & Klip 6'}`
            : (productMode === 'none' ? 'Bridging Dimatikan User' : 'Preset Tanpa Bridging')}
        </span>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.55rem 0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.45rem',
        fontSize: '0.76rem',
        color: 'var(--text-secondary)'
      }}>
        <span><strong>Slot Preset:</strong> {segSummary}</span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.15rem 0.5rem',
          borderRadius: 9999,
          background: 'var(--status-purple-soft)',
          color: 'var(--status-purple)'
        }}>
          {brandPool.length} Produk Katalog Tersedia
        </span>
      </div>

      {/* 3 Mode Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.55rem' }}>
        {MODES.map(mode => {
          const selected = productMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onProductModeChange(mode.id)}
              style={{
                background: selected ? 'color-mix(in srgb, var(--action-primary) 12%, var(--surface))' : 'var(--surface)',
                border: `1.5px solid ${selected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.68rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.28rem',
                textAlign: 'left',
                transition: 'var(--transition)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '0.79rem', fontWeight: 800, color: 'var(--text-primary)' }}>{mode.title}</span>
                <span style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: selected ? 'var(--action-primary)' : 'transparent',
                  border: `1px solid ${selected ? 'var(--action-primary)' : 'var(--border-strong)'}`,
                  color: selected ? 'var(--on-action-primary)' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 900
                }}>✓</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>{mode.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Mode Details */}
      {productMode === 'auto' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.68rem 0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-interactive)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {autoMatch.product?.photo_url ? (
              <img src={autoMatch.product.photo_url} alt={autoMatch.product.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '1.15rem' }}>✨</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {autoMatch.product
                  ? (isBatchMenuList ? `Auto per Baris Menu (Contoh: ${autoMatch.product.product_name})` : autoMatch.product.product_name)
                  : 'Menunggu produk aktif di katalog brand'}
              </span>
              {autoMatch.product && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.12rem 0.48rem',
                  borderRadius: 9999,
                  background: 'var(--status-success-soft)',
                  color: 'var(--status-success)'
                }}>
                  Skor Kecocokan: {autoMatch.score}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {autoMatch.product
                ? 'Backend otomatis mengunci foto referensi & ID produk relevan saat pipeline berjalan.'
                : 'Pastikan brand memiliki minimal 1 produk aktif di Brand Products agar bridging otomatis berjalan.'}
            </div>
          </div>
        </div>
      )}

      {productMode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Cari produk aktif katalog brand..."
            style={{
              width: '100%',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.52rem 0.78rem',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '0.5rem',
            maxHeight: '190px',
            overflowY: 'auto'
          }}>
            {filteredManualProducts.map(prod => {
              const isSelected = selectedProductId === prod.id;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => onSelectProductId(prod.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'color-mix(in srgb, var(--action-primary) 12%, var(--surface))' : 'var(--surface)',
                    border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--surface-interactive)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {prod.photo_url ? (
                      <img src={prod.photo_url} alt={prod.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>🛍️</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.product_name}
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.category || 'Katalog Brand'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {productMode === 'none' && (
        <div style={{
          background: 'var(--status-info-soft)',
          border: '1px solid color-mix(in srgb, var(--status-info) 35%, transparent)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.6rem 0.78rem',
          fontSize: '0.74rem',
          color: 'var(--text-primary)'
        }}>
          🌿 <strong>Mode Resep Organik Aktif:</strong> Pipeline mengirim <code>bridging_mode: "none"</code> sehingga seluruh klip berfokus pada bahan masakan umum tanpa foto referensi produk.
        </div>
      )}
    </div>
  );
}

