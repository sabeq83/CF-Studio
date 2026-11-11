import React from 'react';
import { Composition } from 'remotion';
import { GarliBeeExplainer } from './templates/GarliBeeExplainer';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="GarliBeeExplainer"
        component={GarliBeeExplainer}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioUrl: null,
          themeColor: "#F59E0B",
          hookTitle: "Makan enak?",
          hookHighlight: "Boleh banget.",
          hookSubtitle: "Makan enak itu hak semua orang.",
          brandName: "GarliBee",
          packSize: "Kemasan 300 Gram",
          ctaText: "Cek Keranjang Kuning",
          disclaimer: "Pangan olahan, bukan obat."
        }}
      />
    </>
  );
};

