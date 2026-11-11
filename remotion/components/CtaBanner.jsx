import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const CtaBanner = ({
  brandName = "GarliBee",
  packSize = "Kemasan 300 Gram",
  ctaText = "Cek Keranjang Kuning",
  disclaimer = "Pangan olahan, bukan obat."
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.7, stiffness: 120 }
  });

  // Pulse oscillation for TikTok CTA button
  const pulse = Math.sin((frame / fps) * Math.PI * 2) * 0.05 + 1;

  const cardScale = interpolate(entrance, [0, 1], [0.85, 1]);

  return (
    <div style={{
      transform: `scale(${cardScale})`,
      opacity: entrance,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '920px',
      margin: '0 auto',
      textAlign: 'center',
      zIndex: 10
    }}>
      {/* Product Hero Badge */}
      <div style={{
        width: '320px',
        height: '320px',
        borderRadius: '40px',
        backgroundColor: '#1E232A',
        border: '3px solid #F59E0B',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 25px 60px rgba(245, 158, 11, 0.25)',
        marginBottom: '40px'
      }}>
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
          <rect x="5" y="6" width="14" height="15" rx="3" />
          <path d="M9 2h6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <circle cx="12" cy="14" r="3" fill="#F59E0B" />
        </svg>
        <div style={{ fontSize: '42px', fontWeight: 900, color: '#FFFFFF' }}>
          {brandName}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#FBBF24', marginTop: '4px' }}>
          {packSize}
        </div>
      </div>

      <div style={{
        fontSize: '48px',
        fontWeight: 800,
        color: '#FFFFFF',
        marginBottom: '32px',
        lineHeight: 1.2
      }}>
        Teman Rutinitas Sehatmu
      </div>

      {/* Pulsing CTA Button */}
      <div style={{
        transform: `scale(${pulse})`,
        backgroundColor: '#F59E0B',
        color: '#1E1B18',
        fontSize: '40px',
        fontWeight: 900,
        padding: '24px 60px',
        borderRadius: '30px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 16px 40px rgba(245, 158, 11, 0.5)',
        marginBottom: '40px',
        cursor: 'pointer'
      }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        {ctaText}
      </div>

      {/* Mandatory Disclaimer */}
      <div style={{
        fontSize: '22px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: '0.5px'
      }}>
        * {disclaimer}
      </div>
    </div>
  );
};

