import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const FermentationDial = ({
  productName = "GarliBee",
  tagline = "Bawang Lanang + Madu Mentah",
  fermentationText = "Fermentasi Alami Min. 3 Bulan"
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const jarSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 100 }
  });

  // Dial progress animation
  const dialProgress = interpolate(frame, [15, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  const jarScale = interpolate(jarSpring, [0, 1], [0.85, 1]);
  const circumference = 2 * Math.PI * 180;
  const strokeDashoffset = circumference * (1 - dialProgress);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      position: 'relative'
    }}>
      {/* Radial Timeline Circle */}
      <div style={{
        position: 'relative',
        width: '440px',
        height: '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '40px'
      }}>
        {/* Background glow circle */}
        <div style={{
          position: 'absolute',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          filter: 'blur(30px)'
        }} />

        <svg width="440" height="440" viewBox="0 0 440 440" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          {/* Base track */}
          <circle
            cx="220"
            cy="220"
            r="180"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="14"
          />
          {/* Animated golden progress stroke */}
          <circle
            cx="220"
            cy="220"
            r="180"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Visual Mock / Jar Illustration */}
        <div style={{
          transform: `scale(${jarScale})`,
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          backgroundColor: '#1E232A',
          border: '3px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          zIndex: 2
        }}>
          {/* Jar Icon / Bottle SVG */}
          <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
            <rect x="5" y="6" width="14" height="15" rx="3" />
            <path d="M9 2h6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M5 11h14" />
            <circle cx="12" cy="15" r="2" fill="#F59E0B" />
          </svg>
          <div style={{ fontSize: '32px', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.5px' }}>
            {productName}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#F59E0B' }}>
            Raw Fermented
          </div>
        </div>
      </div>

      {/* Ingredient Tag & Fermentation Pill */}
      <div style={{
        backgroundColor: '#1E232A',
        border: '2px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '24px',
        padding: '24px 36px',
        textAlign: 'center',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
        maxWidth: '840px'
      }}>
        <div style={{
          fontSize: '44px',
          fontWeight: 800,
          color: '#FFFFFF',
          marginBottom: '10px'
        }}>
          {tagline}
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#FBBF24',
          fontSize: '28px',
          fontWeight: 700,
          padding: '8px 24px',
          borderRadius: '16px'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {fermentationText}
        </div>
      </div>
    </div>
  );
};

