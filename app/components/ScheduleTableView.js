'use client';

import React from 'react';

export default function ScheduleTableView({
  schedules = [],
  runningScheduleIds = {},
  onEditSchedule,
  onRunNow,
  onTogglePause,
  onArchiveSchedule,
  onDeleteSchedule,
  getCampaignTypeBadge,
  formatDaysOfWeek
}) {
  const getSlotBorderLeft = (timeStr) => {
    const hour = parseInt((timeStr || '12:00').split(':')[0], 10);
    if (hour >= 6 && hour < 11) return '3px solid var(--status-warning)';
    if (hour >= 11 && hour < 15) return '3px solid var(--status-info)';
    if (hour >= 15 && hour < 19) return '3px solid var(--action-primary)';
    return '3px solid var(--text-muted)';
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
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)'
    }}>
      <div style={{
        padding: '0.65rem 1.25rem',
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <div>
          Menampilkan <strong>{schedules.length} Jadwal</strong> &bull; Klik pada baris untuk mengedit jadwal
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.82rem',
          whiteSpace: 'nowrap'
        }}>
          <thead>
            <tr>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '145px' }}>
                WAKTU (BUAT ➔ PUBLISH)
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '130px' }}>
                TANGGAL / RUTIN
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' }}>
                KEYWORD / TOPIK KONTEN
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '180px' }}>
                BRAND &amp; TIPE
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '120px' }}>
                REPLIZ
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '95px' }}>
                STATUS
              </th>
              <th style={{ background: 'var(--surface-raised)', padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', width: '135px', textAlign: 'right', paddingRight: '1.25rem' }}>
                AKSI
              </th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(sched => {
              const isSchedRunning = Boolean(sched.is_running || runningScheduleIds[sched.id]);
              const campBadge = getCampaignTypeBadge ? getCampaignTypeBadge(sched.pipeline_type) : { icon: '📖', label: 'Editorial' };
              const isSpecific = (sched.schedule_mode || 'recurring') === 'specific_date';
              const accounts = Array.isArray(sched.repliz_accounts) ? sched.repliz_accounts : [];
              const uniquePlatforms = [...new Set(accounts.map(a => a.platform || 'social'))];

              return (
                <tr
                  key={sched.id}
                  onClick={() => onEditSchedule(sched)}
                  style={{
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    height: '48px'
                  }}
                >
                  {/* Col 1: Time Flow */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: getSlotBorderLeft(sched.publish_time || sched.generation_time),
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      <span style={{ color: 'var(--status-info)' }}>{sched.generation_time || '00:00'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>➔</span>
                      <span style={{ color: 'var(--status-success)' }}>{sched.publish_time || '12:00'}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>WIB</span>
                    </span>
                  </td>

                  {/* Col 2: Date / Frequency */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    {isSpecific ? (
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.18rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--status-warning-soft)',
                        color: 'var(--status-warning)'
                      }}>
                        <span>📅</span> {sched.target_date || '-'}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.18rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--surface-interactive)',
                        color: 'var(--text-secondary)'
                      }}>
                        <span>🔄</span> {formatDaysOfWeek ? formatDaysOfWeek(sched.days_of_week || sched.days) : 'Rutin'}
                      </span>
                    )}
                  </td>

                  {/* Col 3: Topic / Keyword */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <div
                      style={{
                        maxWidth: '320px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem'
                      }}
                      title={sched.target_item_title || sched.topic || sched.name}
                    >
                      {sched.target_item_title || sched.topic || sched.name}
                    </div>
                  </td>

                  {/* Col 4: Brand & Type */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.18rem 0.5rem',
                      borderRadius: 9999,
                      background: 'var(--surface-interactive)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      maxWidth: '170px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <span>{campBadge.icon}</span>
                      <span>{sched.brand_name || sched.brand_id}</span>
                    </span>
                  </td>

                  {/* Col 5: Repliz */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {uniquePlatforms.map(p => (
                        <span key={p} style={{
                          width: 22,
                          height: 22,
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border-subtle)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem'
                        }} title={p}>
                          {getPlatformIcon(p)}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Col 6: Status */}
                  <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.18rem 0.55rem',
                      borderRadius: 9999,
                      background: sched.status === 'active' ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                      color: sched.status === 'active' ? 'var(--status-success)' : 'var(--status-warning)',
                      border: `1px solid ${sched.status === 'active' ? 'var(--status-success)' : 'var(--status-warning)'}`
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: sched.status === 'active' ? 'var(--status-success)' : 'var(--status-warning)',
                        boxShadow: sched.status === 'active' ? '0 0 5px var(--status-success)' : 'none'
                      }} />
                      <span>{sched.status === 'active' ? 'Aktif' : sched.status === 'paused' ? 'Dijeda' : sched.status}</span>
                    </span>
                  </td>

                  {/* Col 7: Actions */}
                  <td
                    style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle', textAlign: 'right', paddingRight: '1.25rem' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={isSchedRunning}
                        onClick={() => onRunNow(sched)}
                        title="⚡ Run Now (Tes Eksekusi)"
                        style={{
                          background: isSchedRunning ? 'var(--status-info-soft)' : 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          color: isSchedRunning ? 'var(--status-info)' : 'var(--action-primary)',
                          borderRadius: 'var(--radius-xs)',
                          width: 28,
                          height: 28,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isSchedRunning ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        ⚡
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSchedule(sched)}
                        title="✏️ Edit Jadwal"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          borderRadius: 'var(--radius-xs)',
                          width: 28,
                          height: 28,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        ✏️
                      </button>
                      {sched.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => onTogglePause(sched)}
                          title={sched.status === 'active' ? '⏸️ Jeda Jadwal' : '▶️ Lanjutkan Jadwal'}
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            borderRadius: 'var(--radius-xs)',
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          {sched.status === 'active' ? '⏸️' : '▶️'}
                        </button>
                      )}
                      {sched.status !== 'archived' ? (
                        <button
                          type="button"
                          onClick={() => onArchiveSchedule(sched)}
                          title="📦 Arsipkan"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            borderRadius: 'var(--radius-xs)',
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          📦
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDeleteSchedule(sched)}
                          title="🗑️ Hapus Permanen"
                          style={{
                            background: 'var(--status-danger-soft)',
                            border: '1px solid var(--status-danger)',
                            color: 'var(--status-danger)',
                            borderRadius: 'var(--radius-xs)',
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

