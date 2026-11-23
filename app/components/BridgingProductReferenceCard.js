'use client';

import Link from 'next/link';
import { resolveCampaignProductPhotoMeta } from '@/lib/product-photo-policy';
import { resolvePhotoStatusBadge } from '@/lib/product-card-photo-view';

function formatBridgeClipsSummary(bridgeSegments) {
  if (!Array.isArray(bridgeSegments) || bridgeSegments.length === 0) return null;
  const clipNums = bridgeSegments
    .map(s => Number(s?.at_clip))
    .filter(n => Number.isFinite(n) && n > 0);
  if (clipNums.length === 0) return null;
  return clipNums.length === 1
    ? `Klip ${clipNums[0]}`
    : `Klip ${clipNums.slice(0, -1).join(', ')} & ${clipNums[clipNums.length - 1]}`;
}

export default function BridgingProductReferenceCard({
  product,
  fallbackPath = null,
  bridgeSegments = null,
  isBridgingActive = true,
  compact = false,
  note = null
}) {
  if (!product && !fallbackPath) return null;
  if (!isBridgingActive) return null;

  const { path: refPath, sourceLabel } = resolveCampaignProductPhotoMeta(
    product,
    fallbackPath ? [fallbackPath] : []
  );
  const statusMeta = resolvePhotoStatusBadge(product?.photo_status);
  const isApproved = product?.photo_status === 'approved';
  const isNeedsReview = product?.photo_status === 'needs_review';
  const clipsLabel = formatBridgeClipsSummary(bridgeSegments);
  const productName = product?.product_name || 'Produk Target';
  const productsHref = product?.product_name
    ? `/products?search=${encodeURIComponent(product.product_name)}`
    : '/products';

  const statusToneStyle = isApproved
    ? { background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)' }
    : isNeedsReview
      ? { background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)' }
      : statusMeta?.tone === 'danger'
        ? { background: 'var(--status-danger-soft)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)' }
        : { background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info)' };

  const thumbSize = compact ? '52px' : '64px';

  return (
    <div style={{
      display: 'flex',
      gap: compact ? '0.65rem' : '0.85rem',
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: compact ? '0.6rem 0.75rem' : '0.75rem 0.9rem'
    }}>
      <div style={{
        width: thumbSize,
        height: thumbSize,
        borderRadius: 'var(--radius-sm)',
        border: '1.5px solid var(--action-primary)',
        background: 'var(--surface)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {refPath ? (
          <img
            src={refPath}
            alt={productName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
            Tanpa Foto
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.32rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: compact ? '0.76rem' : '0.8rem', color: 'var(--text-primary)' }}>
            Foto Referensi yang Diteruskan ke Klip Bridging{clipsLabel ? ` (${clipsLabel})` : ''}:
          </strong>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 8px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            fontWeight: 700,
            background: 'var(--status-info-soft)',
            color: 'var(--status-info)',
            border: '1px solid var(--status-info)'
          }}>
            {sourceLabel}
          </span>
          {statusMeta && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
              ...statusToneStyle
            }}>
              {isApproved ? '✓ ' : isNeedsReview ? '⚠ ' : ''}{statusMeta.label}
              {isNeedsReview ? ' (needs_review)' : ''}
            </span>
          )}
        </div>

        <div style={{ fontSize: compact ? '0.71rem' : '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {!refPath
            ? 'Peringatan: Belum ada file foto referensi untuk produk ini. Generator bridging akan memblokir T2I hingga foto tersedia di Product Database.'
            : isApproved
              ? 'Identitas visual kemasan produk terkunci ke foto terlampir ([HIGHEST PRIORITY PRODUCT IDENTITY LOCK]).'
              : isNeedsReview
                ? 'Foto produk ini belum disetujui di Product Database. Periksa kecocokan kemasan di menu Products sebelum produksi massal.'
                : 'Foto aktif produk akan diteruskan sebagai subject reference dengan Identity Lock pada klip bridging.'}
          {note ? ` ${note}` : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Produk: <strong style={{ color: 'var(--text-primary)' }}>{productName}</strong>
          </span>
          <Link
            href={productsHref}
            target="_blank"
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--action-primary)',
              textDecoration: 'underline'
            }}
          >
            Tinjau / Ganti Foto di Product Database ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
