'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { GarliBeeExplainer } from '../../remotion/templates/GarliBeeExplainer';

export default function RemotionPreviewPlayer({
  inputProps = {},
  durationInFrames = 900,
  fps = 30,
  width = 1080,
  height = 1920,
  autoPlay = false,
  loop = true
}) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '380px',
      margin: '0 auto',
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.5))',
      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
      backgroundColor: '#0F1216'
    }}>
      <Player
        component={GarliBeeExplainer}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        style={{
          width: '100%',
          aspectRatio: '9/16'
        }}
        controls
        autoPlay={autoPlay}
        loop={loop}
      />
    </div>
  );
}

