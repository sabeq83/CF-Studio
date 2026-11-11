import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const DoseCalendar = ({
  doseTitle = "1 Siung + 1 Sendok / Hari",
  doseDesc = "Praktis jadi bagian rutinitasmu"
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spoon card spring
  const spoonSpring = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.6, stiffness: 120 }
  });

  // Calendar card spring
  const calendarSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 13, mass: 0.7, stiffness: 110 }
  });

  const spoonScale = interpolate(spoonSpring, [0, 1], [0.85, 1]);
  const calendarScale = interpolate(calendarSpring, [0, 1], [0.85, 1]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '32px',
      width: '920px',
      margin: '0 auto',
      zIndex: 5
    }}>
      {/* Spoon & Dose Presentation Card */}
      <div style={{
        transform: `scale(${spoonScale})`,
        opacity: spoonSpring,
        width: '100%',
        backgroundColor: '#1E232A',
        border: '2px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '32px',
        padding: '36px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Spoon Icon Circle */}
        <div style={{
          width: '130px',
          height: '130px',
          borderRadius: '28px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#F59E0B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 0 1 5 5c0 2.5-2 4.5-4 5v8a1 1 0 0 1-2 0v-8c-2-.5-4-2.5-4-5a5 5 0 0 1 5-5z"/>
            <circle cx="12" cy="7" r="2" fill="#F59E0B" />
          </svg>
        </div>

        <div>
          <div style={{
            fontSize: '44px',
            fontWeight: 900,
            color: '#FFFFFF',
            marginBottom: '8px',
            lineHeight: 1.15
          }}>
            {doseTitle}
          </div>
          <div style={{
            fontSize: '26px',
            fontWeight: 600,
            color: '#FBBF24'
          }}>
            {doseDesc}
          </div>
        </div>
      </div>

      {/* Habit Streak Calendar */}
      <div style={{
        transform: `scale(${calendarScale})`,
        opacity: calendarSpring,
        width: '100%',
        backgroundColor: '#1A1E24',
        border: '2px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '32px',
        padding: '36px 40px',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#FFFFFF' }}>
            Rutinitas Harian
          </div>
          <div style={{
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            fontSize: '20px',
            fontWeight: 700,
            padding: '6px 18px',
            borderRadius: '12px'
          }}>
            7 Hari Berjalan
          </div>
        </div>

        {/* 7 Days Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '12px'
        }}>
          {DAYS.map((day, index) => {
            const checkDelay = 15 + index * 6;
            const checkFrame = Math.max(0, frame - checkDelay);
            const dayCheckSpring = spring({
              frame: checkFrame,
              fps,
              config: { damping: 10, mass: 0.4, stiffness: 180 }
            });
            const checkScale = interpolate(dayCheckSpring, [0, 1], [0, 1]);

            return (
              <div
                key={day}
                style={{
                  backgroundColor: '#242B35',
                  borderRadius: '20px',
                  padding: '16px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)' }}>
                  {day}
                </span>
                <div style={{
                  transform: `scale(${checkScale})`,
                  opacity: dayCheckSpring,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

