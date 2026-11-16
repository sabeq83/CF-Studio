'use client';

export default function CampaignSourceBanner({
  sourceData,
  conflict,
  conflictMessage,
  loading,
  onUseAsIs,
  onEditManual,
  onRefresh,
  isManualEditing
}) {
  if (loading) {
    return (
      <div style={{
        background: 'var(--surface-interactive)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <span>⏳</span>
        <span>Mendeteksi metadata & finishing plan dari campaign asal...</span>
      </div>
    );
  }

  if (conflict) {
    return (
      <div style={{
        background: 'var(--status-warning-soft)',
        border: '1px solid var(--status-warning)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        marginBottom: '16px',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--status-warning)' }}>Konflik Campaign Terdeteksi</strong>
        </div>
        <p style={{ fontSize: '0.82rem', margin: '0 0 10px 0', color: 'var(--text-secondary)' }}>
          {conflictMessage || 'Klip video berasal dari beberapa campaign yang berbeda. Pilih klip dari satu campaign atau susun finishing plan baru secara mandiri.'}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔄 Cek Ulang
        </button>
      </div>
    );
  }

  if (!sourceData) {
    return null;
  }

  const { campaignName, finishingTemplate, skin, brand, ttsBatchId, planValid, planWarnings } = sourceData;

  return (
    <div style={{
      background: 'var(--status-info-soft)',
      border: '1px solid var(--status-info)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1rem' }}>🎯</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Plan Campaign Ditemukan: {campaignName || 'Campaign Asal'}
            </strong>
            <span style={{
              background: 'var(--status-success-soft)',
              color: 'var(--status-success)',
              border: '1px solid var(--status-success)',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              Siap Render
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)'
          }}>
            <span style={{ background: 'var(--surface-raised)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              Template: <strong style={{ color: 'var(--text-primary)' }}>{finishingTemplate || 'none'}</strong>
            </span>
            <span style={{ background: 'var(--surface-raised)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              Skin: <strong style={{ color: 'var(--text-primary)' }}>{skin || 'pop_kuning'}</strong>
            </span>
            {brand?.name && (
              <span style={{ background: 'var(--surface-raised)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                Brand: <strong style={{ color: 'var(--text-primary)' }}>{brand.name}</strong>
              </span>
            )}
            {ttsBatchId && (
              <span style={{ background: 'var(--surface-raised)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                TTS: <strong style={{ color: 'var(--text-primary)' }}>{ttsBatchId}</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={onUseAsIs}
            style={{
              background: !isManualEditing ? 'var(--action-primary)' : 'var(--surface-raised)',
              color: !isManualEditing ? 'var(--on-action-primary)' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✓ Pakai Apa Adanya
          </button>
          <button
            type="button"
            onClick={onEditManual}
            style={{
              background: isManualEditing ? 'var(--action-primary)' : 'var(--surface-raised)',
              color: isManualEditing ? 'var(--on-action-primary)' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✏️ {isManualEditing ? 'Tutup Editor' : 'Edit Manual'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            title="Deteksi ulang dari campaign"
            style={{
              background: 'var(--surface-interactive)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {planWarnings && planWarnings.length > 0 && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          background: 'var(--status-warning-soft)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--status-warning)'
        }}>
          <strong>Catatan Plan:</strong> {planWarnings.join(', ')}
        </div>
      )}
    </div>
  );
}
