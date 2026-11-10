'use client';

import React, { useState, useMemo } from 'react';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function ScheduleCalendarView({
  schedules = [],
  allSchedulesCount = 0,
  onEditSchedule,
  onCreateSchedule,
  brands = [],
  replizAccounts = []
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthTitle = currentDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Generate calendar grid cells (Monday-first)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // In JS: 0 = Sunday, 1 = Monday, ... 6 = Saturday
    // Convert to Monday = 0, ..., Sunday = 6
    const startDayIndex = (firstDay.getDay() + 6) % 7;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const cells = [];

    // 1. Cells from previous month
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const pMonth = month === 0 ? 11 : month - 1;
      const pYear = month === 0 ? year - 1 : year;
      const dateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const dayOfWeek = new Date(pYear, pMonth, dNum).getDay();
      cells.push({
        dayNum: dNum,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek
      });
    }

    // 2. Cells for current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek
      });
    }

    // 3. Cells for next month (fill row until total is divisible by 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nMonth = month === 11 ? 0 : month + 1;
      const nYear = month === 11 ? year + 1 : year;
      const dateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(nYear, nMonth, d).getDay();
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek
      });
    }

    return cells;
  }, [year, month, todayStr]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map = {};

    schedules.forEach(sched => {
      const isSpecific = (sched.schedule_mode || 'recurring') === 'specific_date';

      if (isSpecific && sched.target_date) {
        const dStr = sched.target_date.slice(0, 10);
        if (!map[dStr]) map[dStr] = [];
        map[dStr].push(sched);
      } else if (!isSpecific) {
        // Recurring schedule: apply to all calendar cells matching dayOfWeek
        const activeDays = Array.isArray(sched.days) ? sched.days : [0, 1, 2, 3, 4, 5, 6];
        calendarDays.forEach(cell => {
          if (activeDays.includes(cell.dayOfWeek)) {
            if (!map[cell.dateStr]) map[cell.dateStr] = [];
            map[cell.dateStr].push(sched);
          }
        });
      }
    });

    // Sort each day's schedules chronologically by publish_time or generation_time
    Object.keys(map).forEach(dateKey => {
      map[dateKey].sort((a, b) => {
        const timeA = a.publish_time || a.generation_time || '00:00';
        const timeB = b.publish_time || b.generation_time || '00:00';
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [schedules, calendarDays]);

  // Slot styling helper using 100% semantic CSS tokens
  const getSlotStyle = (timeStr) => {
    const hour = parseInt((timeStr || '12:00').split(':')[0], 10);

    if (hour >= 6 && hour < 11) {
      return {
        label: 'Pagi',
        icon: '🌅',
        borderLeft: '3.5px solid var(--status-warning)',
        background: 'var(--status-warning-soft)',
        color: 'var(--status-warning)'
      };
    }
    if (hour >= 11 && hour < 15) {
      return {
        label: 'Siang',
        icon: '☀️',
        borderLeft: '3.5px solid var(--status-info)',
        background: 'var(--status-info-soft)',
        color: 'var(--status-info)'
      };
    }
    if (hour >= 15 && hour < 19) {
      return {
        label: 'Sore',
        icon: '🌆',
        borderLeft: '3.5px solid var(--action-primary)',
        background: 'var(--surface-interactive)',
        color: 'var(--action-primary)'
      };
    }
    return {
      label: 'Malam',
      icon: '🌙',
      borderLeft: '3.5px solid var(--text-muted)',
      background: 'var(--surface-subtle)',
      color: 'var(--text-secondary)'
    };
  };

  const getPlatformIcon = (platform) => {
    switch ((platform || '').toLowerCase()) {
      case 'youtube': return '▶️';
      case 'facebook': return '📘';
      case 'instagram': return '📸';
      case 'tiktok': return '🎵';
      default: return '📱';
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: 'var(--shadow-card)'
    }}>
      {/* Calendar Header Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            📅 {monthTitle}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ◀
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ▶
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              Hari Ini
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-warning)' }} />
            Pagi (06-11)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-info)' }} />
            Siang (11-15)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--action-primary)' }} />
            Sore (15-19)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--text-muted)' }} />
            Malam (19+)
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: 'var(--border-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}>
        {/* Day Name Headers */}
        {DAY_NAMES.map((name, idx) => (
          <div
            key={name}
            style={{
              background: 'var(--surface-raised)',
              padding: '0.65rem 0.5rem',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: idx >= 5 ? 'var(--status-warning)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            {name}
          </div>
        ))}

        {/* Calendar Cells */}
        {calendarDays.map(cell => {
          const daySchedules = schedulesByDate[cell.dateStr] || [];

          return (
            <div
              key={cell.dateStr}
              style={{
                background: cell.isToday ? 'var(--surface-raised)' : 'var(--surface)',
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                minHeight: '135px',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                position: 'relative',
                transition: 'background 0.15s ease'
              }}
            >
              {/* Cell Header: Day Number & Add Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.2rem'
              }}>
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: cell.isToday ? 800 : 700,
                  color: cell.isToday ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                  background: cell.isToday ? 'var(--action-primary)' : 'transparent',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cell.dayNum}
                </span>

                {cell.isCurrentMonth && (
                  <button
                    type="button"
                    onClick={() => onCreateSchedule(cell.dateStr)}
                    title={`+ Buat Jadwal pada ${cell.dateStr}`}
                    style={{
                      background: 'var(--surface-interactive)',
                      border: 'none',
                      color: 'var(--action-primary)',
                      borderRadius: 'var(--radius-sm)',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 800
                    }}
                  >
                    +
                  </button>
                )}
              </div>

              {/* Schedules in this cell */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                {daySchedules.map(sched => {
                  const slot = getSlotStyle(sched.publish_time || sched.generation_time);
                  const isPaused = sched.status === 'paused';
                  const isCompleted = sched.status === 'completed';

                  // Extract platform icons from repliz_accounts
                  const accounts = Array.isArray(sched.repliz_accounts) ? sched.repliz_accounts : [];
                  const platformList = [...new Set(accounts.map(a => a.platform || 'social'))];

                  const topicSnippet = sched.topic || sched.pipeline_name || sched.name || 'Jadwal Konten';

                  return (
                    <div
                      key={sched.id}
                      onClick={() => onEditSchedule(sched)}
                      title={`${sched.name || topicSnippet} (${sched.generation_time || '00:00'} -> ${sched.publish_time || '12:00'})`}
                      style={{
                        background: slot.background,
                        border: '1px solid var(--border-subtle)',
                        borderLeft: slot.borderLeft,
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.3rem 0.45rem',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.15rem',
                        opacity: isPaused ? 0.6 : 1,
                        transition: 'var(--transition)'
                      }}
                    >
                      {/* Time & Slot Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: slot.color
                      }}>
                        <span>
                          {slot.icon} {sched.publish_time || sched.generation_time || '12:00'}
                        </span>
                        {isPaused ? (
                          <span style={{ fontSize: '0.62rem', color: 'var(--status-warning)' }}>⏸️ PAUSED</span>
                        ) : isCompleted ? (
                          <span style={{ fontSize: '0.62rem', color: 'var(--status-info)' }}>✅ DONE</span>
                        ) : null}
                      </div>

                      {/* Topic / Keyword Snippet */}
                      <div style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2
                      }}>
                        {topicSnippet}
                      </div>

                      {/* Platforms Row */}
                      {platformList.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem' }}>
                          {platformList.slice(0, 4).map(p => (
                            <span key={p} title={p}>{getPlatformIcon(p)}</span>
                          ))}
                          {platformList.length > 4 && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                              +{platformList.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

