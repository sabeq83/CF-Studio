'use client';

export default function AudioModePicker({
  audioSourceType,
  audioMode,
  onChangeAudioMode,
  videoClipCount = 0,
  audioFileCount = 0
}) {
  if (audioSourceType === 'tts_studio') {
    return (
      <div style={{
        background: 'var(--surface-interactive)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-info)', textTransform: 'uppercase' }}>
              Mode Audio Terpilih
            </span>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
              🎙️ TTS Studio Batch (Sinkronisasi Otomatis per Klip)
            </h4>
          </div>
          <span style={{
            background: 'var(--status-info-soft)',
            color: 'var(--status-info)',
            padding: '2px 8px',
            borderRadius: '99px',
            fontSize: '0.72rem',
            fontWeight: 700
          }}>
            Batch Mux
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
          Tiap klip video disinkronkan presisi dengan baris audio TTS dan teks voiceover bawaan dari batch.
        </p>
      </div>
    );
  }

  const isCountMismatch = audioMode === 'per_clip' && videoClipCount > 0 && audioFileCount > 0 && audioFileCount !== videoClipCount;

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      marginBottom: '16px'
    }}>
      <label style={{
        fontSize: '0.8rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        display: 'block',
        marginBottom: '10px'
      }}>
        Mode Penyelarasan Audio Upload
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Mode A: Single */}
        <div
          onClick={() => onChangeAudioMode('single')}
          style={{
            background: audioMode === 'single' ? 'var(--surface-interactive)' : 'var(--surface)',
            border: audioMode === 'single' ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Mode A: Single Audio
            </strong>
            {audioMode === 'single' && <span style={{ color: 'var(--action-primary)', fontWeight: 800 }}>✓</span>}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
            1 berkas audio panjang untuk semua {videoClipCount || 'N'} klip video (video digabung terlebih dahulu).
          </p>
        </div>

        {/* Mode B: Per-Clip */}
        <div
          onClick={() => onChangeAudioMode('per_clip')}
          style={{
            background: audioMode === 'per_clip' ? 'var(--surface-interactive)' : 'var(--surface)',
            border: audioMode === 'per_clip' ? '2px solid var(--action-primary)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Mode B: Per-Clip Audio
            </strong>
            {audioMode === 'per_clip' && <span style={{ color: 'var(--action-primary)', fontWeight: 800 }}>✓</span>}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
            1 audio untuk tiap 1 klip video. Jumlah file audio harus sama persis ({videoClipCount || 'N'} file).
          </p>
        </div>
      </div>

      {isCountMismatch && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          background: 'var(--status-danger-soft)',
          border: '1px solid var(--status-danger)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--status-danger)'
        }}>
          ⚠️ <strong>Jumlah Tidak Cocok:</strong> Anda memilih {videoClipCount} klip video, tetapi mengunggah {audioFileCount} file audio. Dalam mode per-clip, jumlahnya harus sama.
        </div>
      )}
    </div>
  );
}
