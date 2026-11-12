'use client';

import {
  MAX_BRIDGE_SEGMENTS,
  resolveBridgePlan,
  describeBridgePlan
} from '@/lib/bridging/bridge-plan';

const ZONE_META = {
  pre: {
    label: 'Pre',
    title: 'Tanpa produk (Hook / Edukasi)',
    bg: 'var(--surface-subtle, var(--surface-interactive))',
    border: 'var(--border-subtle)',
    color: 'var(--text-muted)'
  },
  intro: {
    label: 'Intro',
    title: 'Produk tampil perdana',
    bg: 'var(--status-success-soft)',
    border: 'var(--status-success)',
    color: 'var(--status-success)'
  },
  gap: {
    label: 'Gap',
    title: 'Jeda bebas produk (Cerita lanjut)',
    bg: 'var(--status-warning-soft)',
    border: 'var(--status-warning)',
    color: 'var(--status-warning)'
  },
  recall: {
    label: 'Recall',
    title: 'Produk muncul kembali',
    bg: 'var(--status-info-soft)',
    border: 'var(--status-info)',
    color: 'var(--status-info)'
  },
  post: {
    label: 'Post',
    title: 'Penutup / Outro bebas produk',
    bg: 'var(--surface-interactive)',
    border: 'var(--border-strong)',
    color: 'var(--text-secondary)'
  }
};

function ensureSegmentsArray(segments, fallbackAtClip = 2, fallbackDurationClips = 1) {
  if (Array.isArray(segments) && segments.length > 0) {
    return segments.map((s, idx) => ({
      at_clip: Math.max(1, Number(s?.at_clip ?? s?.atClip ?? 2)),
      duration_clips: Math.max(0, Number(s?.duration_clips ?? s?.durationClips ?? 1)),
      role: idx === 0 ? 'intro' : (s?.role === 'intro' ? 'intro' : 'recall')
    }));
  }
  return [
    {
      at_clip: Math.max(1, Number(fallbackAtClip || 2)),
      duration_clips: Math.max(0, Number(fallbackDurationClips ?? 1)),
      role: 'intro'
    }
  ];
}

export default function BridgeSegmentsEditor({
  segments,
  onChange,
  targetClips = 7,
  fallbackAtClip = 2,
  fallbackDurationClips = 1,
  singleZoneOnly = false,
  disabled = false,
  maxSegments = MAX_BRIDGE_SEGMENTS
}) {
  const safeTargetClips = Math.max(1, Number(targetClips || 4));
  const currentSegments = ensureSegmentsArray(segments, fallbackAtClip, fallbackDurationClips);
  const visibleSegments = singleZoneOnly ? [currentSegments[0]] : currentSegments.slice(0, maxSegments);

  const plan = resolveBridgePlan({
    targetClips: safeTargetClips,
    isBridgingActive: true,
    segments: visibleSegments,
    singleZoneOnly
  });

  const emitChange = (nextList) => {
    if (disabled || typeof onChange !== 'function') return;
    const sanitized = nextList.slice(0, singleZoneOnly ? 1 : maxSegments).map((s, idx) => ({
      at_clip: Math.max(1, Number(s.at_clip || 1)),
      duration_clips: Math.max(0, Number(s.duration_clips ?? 1)),
      role: idx === 0 ? 'intro' : (s.role === 'intro' ? 'intro' : 'recall')
    }));
    onChange(sanitized);
  };

  const handleRowFieldChange = (index, field, value) => {
    const next = visibleSegments.map((seg, i) => {
      if (i !== index) return seg;
      if (field === 'at_clip') {
        return { ...seg, at_clip: Math.max(1, Math.min(safeTargetClips, Number(value) || 1)) };
      }
      if (field === 'duration_clips') {
        return { ...seg, duration_clips: Math.max(0, Number(value) || 0) };
      }
      if (field === 'role') {
        return { ...seg, role: i === 0 ? 'intro' : (value === 'intro' ? 'intro' : 'recall') };
      }
      return seg;
    });
    emitChange(next);
  };

  const handleAddSegment = () => {
    if (singleZoneOnly || visibleSegments.length >= maxSegments) return;
    const adjustedPrev = visibleSegments.map((seg, i) => {
      if (i === visibleSegments.length - 1 && Number(seg.duration_clips) === 0) {
        return { ...seg, duration_clips: 1 };
      }
      return seg;
    });
    const lastSeg = adjustedPrev[adjustedPrev.length - 1];
    const lastEnd = Number(lastSeg.at_clip) + Math.max(1, Number(lastSeg.duration_clips || 1)) - 1;
    const nextStart = Math.min(safeTargetClips, Math.max(1, lastEnd + 2));
    emitChange([
      ...adjustedPrev,
      { at_clip: nextStart, duration_clips: 1, role: 'recall' }
    ]);
  };

  const handleRemoveSegment = (index) => {
    if (visibleSegments.length <= 1) return;
    const next = visibleSegments.filter((_, i) => i !== index);
    if (next[0]) next[0] = { ...next[0], role: 'intro' };
    emitChange(next);
  };

  const applyQuickPreset = (presetSegments) => {
    emitChange(presetSegments);
  };

  const baseDurationOptions = [1, 2, 3, 4];
  const controlStyle = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--input-bg)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xs)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem'
  };

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Titik Kemunculan Produk (Multi-Segmen)
          </div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Atur hingga {singleZoneOnly ? 1 : maxSegments} segmen kemunculan produk dalam 1 video ({safeTargetClips} klip). Klip di luar segmen steril dari produk.
          </div>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'var(--status-info-soft)',
            color: 'var(--status-info)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          Aktif: {describeBridgePlan(plan)}
        </span>
      </div>

      {singleZoneOnly && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--status-info-soft)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--status-info)',
            fontSize: '0.75rem',
            lineHeight: 1.45
          }}
        >
          Mode <strong>Investigative Faceless</strong> memakai 1 zona konversi produk di akhir video (multi-segmen dinonaktifkan).
        </div>
      )}

      {!singleZoneOnly && !disabled && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '2px' }}>Pola Cepat:</span>
          <button
            type="button"
            onClick={() => applyQuickPreset([
              { at_clip: Math.min(safeTargetClips, Math.max(2, Math.floor(safeTargetClips / 2))), duration_clips: 1, role: 'intro' }
            ])}
            style={{
              padding: '4px 9px',
              fontSize: '0.72rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-interactive)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Single Mid
          </button>
          {safeTargetClips >= 5 && (
            <button
              type="button"
              onClick={() => applyQuickPreset([
                { at_clip: 2, duration_clips: 1, role: 'intro' },
                { at_clip: Math.max(4, safeTargetClips - 1), duration_clips: 1, role: 'recall' }
              ])}
              style={{
                padding: '4px 9px',
                fontSize: '0.72rem',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Intro + Recall (Klip 2 &amp; {Math.max(4, safeTargetClips - 1)})
            </button>
          )}
          {safeTargetClips >= 7 && (
            <button
              type="button"
              onClick={() => applyQuickPreset([
                { at_clip: 2, duration_clips: 1, role: 'intro' },
                { at_clip: Math.max(4, Math.ceil(safeTargetClips / 2)), duration_clips: 1, role: 'recall' },
                { at_clip: safeTargetClips - 1, duration_clips: 1, role: 'recall' }
              ])}
              style={{
                padding: '4px 9px',
                fontSize: '0.72rem',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              3 Titik
            </button>
          )}
          <button
            type="button"
            onClick={() => applyQuickPreset([
              { at_clip: Math.max(2, safeTargetClips - 1), duration_clips: 0, role: 'intro' }
            ])}
            style={{
              padding: '4px 9px',
              fontSize: '0.72rem',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-interactive)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Closing Sampai Akhir
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleSegments.map((seg, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === visibleSegments.length - 1;
          const durVal = Number(seg.duration_clips ?? 1);
          const customDurNeeded = durVal > 4;

          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(90px, 1fr) minmax(130px, 1.3fr) minmax(135px, 1.4fr) auto',
                gap: '8px',
                alignItems: 'end',
                padding: '10px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <span
                style={{
                  alignSelf: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: isFirst ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                  color: isFirst ? 'var(--status-success)' : 'var(--status-info)'
                }}
              >
                #{idx + 1}
              </span>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Klip ke-
                </label>
                <input
                  type="number"
                  min={1}
                  max={safeTargetClips}
                  disabled={disabled}
                  value={seg.at_clip}
                  onChange={(e) => handleRowFieldChange(idx, 'at_clip', e.target.value)}
                  style={controlStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Durasi (Klip)
                </label>
                <select
                  disabled={disabled}
                  value={durVal}
                  onChange={(e) => handleRowFieldChange(idx, 'duration_clips', e.target.value)}
                  style={controlStyle}
                >
                  {isLast && <option value={0}>0 (Sampai akhir)</option>}
                  {baseDurationOptions.map((d) => (
                    <option key={d} value={d}>{d} Klip</option>
                  ))}
                  {customDurNeeded && <option value={durVal}>{durVal} Klip</option>}
                  {!isLast && durVal === 0 && <option value={0}>0 (Tidak valid kecuali terakhir)</option>}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Peran Segmen
                </label>
                <select
                  disabled={disabled || isFirst}
                  value={isFirst ? 'intro' : (seg.role || 'recall')}
                  onChange={(e) => handleRowFieldChange(idx, 'role', e.target.value)}
                  style={controlStyle}
                >
                  <option value="intro">{isFirst ? 'Intro (Perdana)' : 'Intro Ulang'}</option>
                  {!isFirst && <option value="recall">Recall (Ingatkan Kembali)</option>}
                </select>
              </div>

              <div>
                {!isFirst && !disabled ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveSegment(idx)}
                    title="Hapus segmen"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--status-danger-soft)',
                      color: 'var(--status-danger)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hapus
                  </button>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 4px' }}>Wajib</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!singleZoneOnly && !disabled && visibleSegments.length < maxSegments && (
        <div>
          <button
            type="button"
            onClick={handleAddSegment}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-xs)',
              border: '1px dashed var(--border-strong)',
              background: 'var(--surface-interactive)',
              color: 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Tambah Segmen Produk ({visibleSegments.length}/{maxSegments})
          </button>
        </div>
      )}

      {/* Visual Clip Timeline */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Preview Timeline Zona Klip (1–{safeTargetClips})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Array.from({ length: safeTargetClips }, (_, i) => i + 1).map((clipNum) => {
            const z = plan.zoneOf(clipNum);
            const meta = ZONE_META[z] || ZONE_META.pre;
            return (
              <div
                key={clipNum}
                title={`Klip ${clipNum}: ${meta.title}`}
                style={{
                  minWidth: '52px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: meta.bg,
                  border: `1px solid ${meta.border}`,
                  color: meta.color,
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}
              >
                <div>K{clipNum}</div>
                <div style={{ fontSize: '0.64rem', fontWeight: 600, opacity: 0.92 }}>{meta.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {plan.errors.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--status-danger-soft)',
            border: '1px solid var(--status-danger)',
            color: 'var(--status-danger)',
            fontSize: '0.74rem'
          }}
        >
          {plan.errors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--status-warning-soft)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--status-warning)',
            fontSize: '0.73rem'
          }}
        >
          {plan.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

