'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AutoPipelineQueueDrawer({ isOpen, onClose, queueSummary, onQueueUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(queueSummary || { queued: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);

  const fetchQueueData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/recipes/autonomous-pipeline/queue');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
        setSummary(data.summary || { queued: 0, processing: 0, completed: 0, failed: 0 });
        if (onQueueUpdated) onQueueUpdated(data.summary);
      }
    } catch (err) {
      console.warn('Gagal memuat data antrean:', err.message);
    } finally {
      setLoading(false);
    }
  }, [onQueueUpdated]);

  useEffect(() => {
    if (isOpen) {
      fetchQueueData();
      const interval = setInterval(fetchQueueData, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchQueueData]);

  const handleCancelJob = async (jobId) => {
    try {
      setCancelingId(jobId);
      const res = await fetch('/api/v2/recipes/autonomous-pipeline/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', job_id: jobId })
      });
      const data = await res.json();
      if (data.success) {
        fetchQueueData();
      } else {
        alert(data.error || 'Gagal membatalkan job.');
      }
    } catch (err) {
      alert('Error saat membatalkan job: ' + err.message);
    } finally {
      setCancelingId(null);
    }
  };

  if (!isOpen) return null;

  const processingJobs = jobs.filter(j => j.status === 'processing');
  const queuedJobs = jobs.filter(j => j.status === 'queued');
  const historyJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-backdrop)',
          zIndex: 998,
          backdropFilter: 'blur(2px)',
          transition: 'var(--transition)'
        }}
      />

      {/* Slide-over Drawer */}
      <aside style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: 520,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border-subtle)',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-modal)',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.15rem' }}>⚡</span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Antrean Produksi Pipeline (FIFO)
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--status-info-soft)',
              color: 'var(--status-info)',
              border: '1px solid var(--status-info)'
            }}>
              {summary.queued + summary.processing} Aktif
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={fetchQueueData} 
              disabled={loading}
              title="Refresh Antrean"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.35rem 0.6rem',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {loading ? '...' : '🔄'}
            </button>
            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-xs)'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary Mini Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-raised)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>DIPROSES</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--action-primary)' }}>{summary.processing}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>MENUNGGU</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-warning)' }}>{summary.queued}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>SELESAI</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-success)' }}>{summary.completed}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>GAGAL</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-danger)' }}>{summary.failed}</div>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Section: Sedang Diproses */}
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Sedang Berjalan (Processing)</span>
              <span style={{ color: 'var(--action-primary)' }}>{processingJobs.length} Task</span>
            </div>

            {processingJobs.length === 0 ? (
              <div style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}>
                Tidak ada pipeline yang sedang aktif berjalan.
              </div>
            ) : (
              processingJobs.map((job, idx) => (
                <div key={job.id} style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--action-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow: '0 0 0 1px var(--action-primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--action-primary)',
                      color: 'var(--on-action-primary)'
                    }}>
                      RUNNING #{idx + 1}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Mulai: {job.started_at ? new Date(job.started_at).toLocaleTimeString('id-ID') : '-'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {job.job_payload?.schedule_name || job.pipeline_type}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span style={{
                      width: 12,
                      height: 12,
                      border: '2px solid var(--border-subtle)',
                      borderTopColor: 'var(--action-primary)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block'
                    }}></span>
                    <span>Memproses Storyboard & Konten AI...</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section: Menunggu Giliran */}
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Menunggu Giliran (FIFO Queue)</span>
              <span style={{ color: 'var(--status-warning)' }}>{queuedJobs.length} Task</span>
            </div>

            {queuedJobs.length === 0 ? (
              <div style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}>
                Antrean kosong. Jadwal berikutnya akan masuk otomatis saat jatuh tempo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {queuedJobs.map((job, idx) => (
                  <div key={job.id} style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.45rem',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--status-warning-soft)',
                        color: 'var(--status-warning)',
                        border: '1px solid var(--status-warning)'
                      }}>
                        Antrean #{idx + 1}
                      </span>
                      <button 
                        onClick={() => handleCancelJob(job.id)}
                        disabled={cancelingId === job.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-danger)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        {cancelingId === job.id ? 'Membatalkan...' : 'Batal'}
                      </button>
                    </div>
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {job.job_payload?.schedule_name || job.pipeline_type}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Tipe: {job.pipeline_type} • Diantrekan: {new Date(job.queued_at).toLocaleTimeString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Riwayat Selesai */}
          {historyJobs.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: '0.6rem'
              }}>
                Riwayat Selesai Hari Ini
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {historyJobs.slice(0, 5).map(job => (
                  <div key={job.id} style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: 0.85
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {job.job_payload?.schedule_name || job.pipeline_type}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {job.status === 'completed' && job.campaign_id ? `Campaign: ${job.campaign_id}` : (job.error_message || job.status)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-xs)',
                      background: job.status === 'completed' ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
                      color: job.status === 'completed' ? 'var(--status-success)' : 'var(--status-danger)'
                    }}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </aside>
    </>
  );
}

