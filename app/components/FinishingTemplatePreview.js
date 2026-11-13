'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getFinishingTemplateMeta } from '@/lib/finishing-template-registry';
import {
  PREVIEW_DURATION_SEC,
  PREVIEW_TIMELINE_MARKERS,
  buildPreviewTimeline
} from '@/lib/finishing-preview-builder';

const BASE_W = 720;
const BASE_H = 1280;
const SCALE = 0.35; // 252px x 448px responsive phone stage

export default function FinishingTemplatePreview({
  finishingTemplate = 'none',
  captionMode = 'hybrid',
  loudnessTarget = -14,
  targetLanguage = 'id-ID',
  brandName = '',
  brandTagline = '',
  accentColor = '',
  hookTitle = '',
  productName = '',
  productSpec = '',
  motionStyle = 'floating_white_yellow',
  motionPosition = 'bottom'
}) {
  const iframeRef = useRef(null);
  const rafRef = useRef(null);
  const lastFrameTsRef = useRef(0);

  const [previewLang, setPreviewLang] = useState(targetLanguage || 'id-ID');
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.6);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (targetLanguage) {
      setPreviewLang(targetLanguage);
    }
  }, [targetLanguage]);

  const meta = useMemo(
    () => getFinishingTemplateMeta(finishingTemplate || 'none'),
    [finishingTemplate]
  );

  const timeline = useMemo(
    () =>
      buildPreviewTimeline({
        templateId: meta.id,
        captionMode,
        loudnessTarget,
        targetLanguage: previewLang,
        brandName,
        brandTagline,
        accentColor,
        hookTitle,
        productName,
        productSpec,
        motionStyle,
        motionPosition
      }),
    [
      meta.id,
      captionMode,
      loudnessTarget,
      previewLang,
      brandName,
      brandTagline,
      accentColor,
      hookTitle,
      productName,
      productSpec,
      motionStyle,
      motionPosition
    ]
  );

  useEffect(() => {
    setIframeLoaded(false);
  }, [meta.file]);

  // Sync timeline whenever iframe loads or timeline config changes
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!iframeLoaded || !win) return;
    try {
      if (typeof win.loadTimeline === 'function') {
        win.loadTimeline(timeline);
      }
      if (typeof win.renderAt === 'function') {
        win.renderAt(currentTime);
      }
    } catch (err) {
      console.warn('[FinishingTemplatePreview] Failed syncing iframe timeline:', err?.message || err);
    }
  }, [iframeLoaded, timeline]);

  // Scrub / animate currentTime smoothly without reloading timeline
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!iframeLoaded || !win || typeof win.renderAt !== 'function') return;
    try {
      win.renderAt(currentTime);
    } catch (_err) {
      // Ignore transient frame errors during template reload
    }
  }, [currentTime, iframeLoaded]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameTsRef.current = 0;
      return;
    }
    const tick = (ts) => {
      if (!lastFrameTsRef.current) lastFrameTsRef.current = ts;
      const dt = (ts - lastFrameTsRef.current) / 1000;
      lastFrameTsRef.current = ts;
      setCurrentTime((prev) => {
        const next = prev + dt;
        return next >= PREVIEW_DURATION_SEC ? 0 : Number(next.toFixed(2));
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const activeLayers = Object.entries(meta.layers || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  return (
    <div
      style={{
        marginTop: '14px',
        padding: '14px',
        borderRadius: '10px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gridTemplateColumns: 'minmax(252px, 260px) minmax(0, 1fr)',
        gap: '16px',
        alignItems: 'start'
      }}
    >
      {/* Left: 9:16 Isolated Iframe Viewport */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: `${Math.round(BASE_W * SCALE)}px`,
            height: `${Math.round(BASE_H * SCALE)}px`,
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid var(--border-strong)',
            background:
              'radial-gradient(circle at 28% 24%, color-mix(in srgb, var(--action-primary) 22%, var(--canvas)), transparent 60%), linear-gradient(160deg, var(--surface) 0%, var(--canvas) 100%)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <iframe
            key={meta.file}
            ref={iframeRef}
            title={`Live Finishing Preview — ${meta.id}`}
            src={`/api/v2/finishing/templates/${encodeURIComponent(meta.file)}`}
            onLoad={() => setIframeLoaded(true)}
            style={{
              width: `${BASE_W}px`,
              height: `${BASE_H}px`,
              border: 0,
              background: 'transparent',
              transform: `scale(${SCALE})`,
              transformOrigin: 'top left',
              display: 'block',
              pointerEvents: 'none'
            }}
          />

          {showSafeZone && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '11%',
                  borderBottom: '1px dashed var(--status-info)',
                  background: 'var(--status-info-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                TOP SAFE ZONE
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '12%',
                  right: 0,
                  width: '15%',
                  bottom: '18%',
                  borderLeft: '1px dashed var(--status-danger)',
                  background: 'var(--status-danger-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  writingMode: 'vertical-rl',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--status-danger)'
                }}
              >
                RIGHT RAIL (86%+)
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '18%',
                  borderTop: '1px dashed var(--status-warning)',
                  background: 'var(--status-warning-soft)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '6px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--status-warning)'
                }}
              >
                BOTTOM CAPTION / UI
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Scrubber, Markers, Metadata & Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              👁️ Live Template Preview — <code>{meta.id}</code>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {meta.description}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreviewLang((l) => (l.startsWith('en') ? 'id-ID' : 'en-US'))}
              style={{ fontSize: '0.74rem', padding: '5px 10px' }}
            >
              🌐 {previewLang.startsWith('en') ? 'en-US' : 'id-ID'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowSafeZone((v) => !v)}
              style={{ fontSize: '0.74rem', padding: '5px 10px' }}
            >
              📐 Safe-Zone: {showSafeZone ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Play/Pause & Time Scrubber */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsPlaying((p) => !p)}
              style={{ fontSize: '0.76rem', padding: '5px 12px', minWidth: '78px' }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <input
              type="range"
              min={0}
              max={PREVIEW_DURATION_SEC}
              step={0.05}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(Number(e.target.value));
              }}
              aria-label="Timeline Preview Scrubber"
              style={{ flex: 1, accentColor: 'var(--action-primary)' }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                minWidth: '72px',
                textAlign: 'right'
              }}
            >
              {currentTime.toFixed(2)}s / {PREVIEW_DURATION_SEC}s
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PREVIEW_TIMELINE_MARKERS.map((mk) => {
              const isNear = Math.abs(currentTime - mk.t) < 0.7;
              return (
                <button
                  key={mk.id}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(mk.t);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: isNear ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
                    background: isNear ? 'var(--status-success-soft)' : 'var(--surface-interactive)',
                    color: isNear ? 'var(--action-primary)' : 'var(--text-secondary)'
                  }}
                >
                  {mk.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Metadata Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '8px',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>HTML File</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{meta.file}</div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Active Layers</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeLayers.length > 0 ? activeLayers.join(', ') : 'legacy ffmpeg ass'}
            </div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Audio &amp; Caption</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {captionMode} • {loudnessTarget} LUFS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
