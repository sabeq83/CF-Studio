import React from 'react';
import { Sequence, Audio } from 'remotion';
import { KineticHeadline } from '../components/KineticHeadline';
import { HabitGrid } from '../components/HabitGrid';
import { FermentationDial } from '../components/FermentationDial';
import { DoseCalendar } from '../components/DoseCalendar';
import { CtaBanner } from '../components/CtaBanner';

export const GarliBeeExplainer = ({
  audioUrl = null,
  themeColor = "#F59E0B",
  hookTitle = "Makan enak?",
  hookHighlight = "Boleh banget.",
  hookSubtitle = "Makan enak itu hak semua orang.",
  brandName = "GarliBee",
  packSize = "Kemasan 300 Gram",
  ctaText = "Cek Keranjang Kuning",
  disclaimer = "Pangan olahan, bukan obat."
}) => {
  return (
    <div style={{
      width: '1080px',
      height: '1920px',
      backgroundColor: '#0F1216',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '800px',
        borderRadius: '50%',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-150px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '800px',
        borderRadius: '50%',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        filter: 'blur(120px)',
        pointerEvents: 'none'
      }} />

      {/* Optional Voiceover Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Top Brand Watermark Header */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '0',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '10px 24px',
          borderRadius: '30px',
          backdropFilter: 'blur(10px)'
        }}>
          <span style={{ fontSize: '22px', fontWeight: 900, color: '#F59E0B' }}>●</span>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '1px' }}>
            {brandName.toUpperCase()}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)' }}>
            | Health Explainer
          </span>
        </div>
      </div>

      {/* SCENE 1: Hook (0-4s / Frames 0 - 120) */}
      <Sequence from={0} durationInFrames={120}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Food Graphic Card */}
          <div style={{
            width: '860px',
            backgroundColor: '#1E232A',
            border: '2px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '40px',
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '72px' }}>🍢</span>
              <span style={{ fontSize: '72px' }}>🍲</span>
              <span style={{ fontSize: '72px' }}>🍗</span>
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              Sate • Gulai • Gorengan Favorit
            </div>
          </div>

          <KineticHeadline
            title={hookTitle}
            highlight={hookHighlight}
            subtitle={hookSubtitle}
            themeColor={themeColor}
          />
        </div>
      </Sequence>

      {/* SCENE 2: Rutinitas Seimbang (4-11s / Frames 120 - 330) */}
      <Sequence from={120} durationInFrames={210}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '54px',
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: '40px',
            lineHeight: 1.2
          }}>
            Kuncinya: Seimbangkan dengan<br />
            <span style={{ color: '#10B981' }}>Kebiasaan Harian Baik</span>
          </div>

          <HabitGrid />
        </div>
      </Sequence>

      {/* SCENE 3: GarliBee Fermentasi 3 Bulan (11-19s / Frames 330 - 570) */}
      <Sequence from={330} durationInFrames={240}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '50px',
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: '36px'
          }}>
            Salah Satunya dengan <span style={{ color: '#F59E0B' }}>GarliBee</span>
          </div>

          <FermentationDial
            productName={brandName}
            tagline="Bawang Lanang + Madu Mentah"
            fermentationText="Fermentasi Alami Min. 3 Bulan"
          />
        </div>
      </Sequence>

      {/* SCENE 4: Dosis 1 Siung + 1 Sendok / Hari (19-26s / Frames 570 - 780) */}
      <Sequence from={570} durationInFrames={210}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '52px',
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: '40px'
          }}>
            Cara Konsumsi Harian
          </div>

          <DoseCalendar
            doseTitle="1 Siung + 1 Sendok / Hari"
            doseDesc="Cukup satu siung, satu sendok setiap hari."
          />
        </div>
      </Sequence>

      {/* SCENE 5: Outro & CTA (26-30s / Frames 780 - 900) */}
      <Sequence from={780} durationInFrames={120}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CtaBanner
            brandName={brandName}
            packSize={packSize}
            ctaText={ctaText}
            disclaimer={disclaimer}
          />
        </div>
      </Sequence>
    </div>
  );
};

