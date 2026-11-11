import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const KineticHeadline = ({
  title = "Makan enak?",
  highlight = "Boleh banget.",
  subtitle = "Makan enak itu hak semua orang.",
  startFrame = 0,
  themeColor = "#F59E0B"
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - startFrame);

  const titleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 }
  });

  const highlightSpring = spring({
    frame: Math.max(0, localFrame - 8),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 140 }
  });

  const subtitleSpring = spring({
    frame: Math.max(0, localFrame - 16),
    fps,
    config: { damping: 15, mass: 0.7 }
  });

  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1]);
  const highlightScale = interpolate(highlightSpring, [0, 1], [0.7, 1]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '20px 40px',
      zIndex: 10
    }}>
      <div style={{
        transform: `scale(${titleScale})`,
        opacity: titleSpring,
        fontSize: '76px',
        fontWeight: 900,
        color: '#FFFFFF',
        textShadow: '0 8px 24px rgba(0,0,0,0.5)',
        letterSpacing: '-1.5px',
        lineHeight: 1.1,
        marginBottom: '16px'
      }}>
        {title}
      </div>

      <div style={{
        transform: `scale(${highlightScale})`,
        opacity: highlightSpring,
        backgroundColor: themeColor,
        color: '#1E1B18',
        fontSize: '84px',
        fontWeight: 900,
        padding: '10px 36px',
        borderRadius: '24px',
        boxShadow: '0 12px 32px rgba(245, 158, 11, 0.4)',
        letterSpacing: '-1px',
        lineHeight: 1.1,
        marginBottom: '24px'
      }}>
        {highlight}
      </div>

      {subtitle && (
        <div style={{
          opacity: subtitleOpacity,
          fontSize: '36px',
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '850px',
          lineHeight: 1.4,
          textShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

