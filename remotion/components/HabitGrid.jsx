import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const HABITS = [
  {
    id: 'walk',
    label: 'Jalan Pagi',
    desc: '30 menit aktif',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    iconSvg: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 4v6m0 0l3 5m-3-5l-4 3-2-2m6 10l-2-6-3-2"/>
        <circle cx="14" cy="4" r="2"/>
      </svg>
    )
  },
  {
    id: 'water',
    label: 'Air Putih',
    desc: '2 liter terhidrasi',
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
    iconSvg: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
      </svg>
    )
  },
  {
    id: 'veggies',
    label: 'Makan Sayur',
    desc: 'Serat & nutrisi',
    color: '#84CC16',
    bgColor: 'rgba(132, 204, 22, 0.15)',
    iconSvg: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 22s4-10 10-10 10 10 10 10H2z"/>
        <path d="M12 12V2"/>
      </svg>
    )
  },
  {
    id: 'sleep',
    label: 'Tidur Cukup',
    desc: '7-8 jam lelap',
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    iconSvg: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    )
  }
];

export const HabitGrid = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '28px',
      width: '920px',
      margin: '0 auto',
      zIndex: 5
    }}>
      {HABITS.map((habit, index) => {
        const delay = index * 14;
        const localFrame = Math.max(0, frame - delay);

        const cardSpring = spring({
          frame: localFrame,
          fps,
          config: { damping: 13, mass: 0.6, stiffness: 120 }
        });

        const checkDelay = delay + 10;
        const checkLocal = Math.max(0, frame - checkDelay);
        const checkSpring = spring({
          frame: checkLocal,
          fps,
          config: { damping: 10, mass: 0.4, stiffness: 160 }
        });

        const cardScale = interpolate(cardSpring, [0, 1], [0.8, 1]);
        const checkScale = interpolate(checkSpring, [0, 1], [0, 1]);

        return (
          <div
            key={habit.id}
            style={{
              transform: `scale(${cardScale})`,
              opacity: cardSpring,
              backgroundColor: '#1E232A',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '32px',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Centang Badge */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                transform: `scale(${checkScale})`,
                opacity: checkSpring,
                backgroundColor: habit.color,
                color: '#FFFFFF',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 16px ${habit.color}66`
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            {/* Icon Bulat */}
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '30px',
                backgroundColor: habit.bgColor,
                color: habit.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}
            >
              {habit.iconSvg}
            </div>

            <div style={{
              fontSize: '40px',
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: '8px'
            }}>
              {habit.label}
            </div>

            <div style={{
              fontSize: '24px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              {habit.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
};

