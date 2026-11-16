'use client';

import { useState } from 'react';
import { FINISHING_SKIN_REGISTRY } from '@/lib/finishing-skin-registry';

export default function FinishingPlanEditor({
  templateId,
  plan,
  onChangePlan,
  validation,
  captionMode = 'full',
  onChangeCaptionMode,
  skin = 'pop_kuning',
  onChangeSkin,
  brandName = '',
  onChangeBrandName
}) {
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'json'
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  if (templateId === 'none') {
    return (
      <div style={{
        padding: '16px',
        background: 'var(--surface-interactive)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        ℹ️ Template <strong>Tanpa Finishing</strong> tidak membutuhkan finishing plan. Muxing akan diproses secara standar menggunakan FFmpeg.
      </div>
    );
  }

  const currentPlan = plan || { hook: '', punches: [] };

  const handleUpdateField = (field, value) => {
    const updated = { ...currentPlan, [field]: value };
    onChangePlan(updated);
  };

  const handleSwitchToJson = () => {
    setJsonText(JSON.stringify(currentPlan, null, 2));
    setJsonError('');
    setEditorMode('json');
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onChangePlan(parsed);
      setJsonError('');
      setEditorMode('visual');
    } catch (err) {
      setJsonError('Format JSON tidak valid: ' + err.message);
    }
  };

  const { planValid = true, planErrors = [], planWarnings = [] } = validation || {};

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Pengaturan & Plan Template: {templateId}
          </h4>

          {planValid ? (
            <span style={{
              background: 'var(--status-success-soft)',
              color: 'var(--status-success)',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              ✓ Valid
            </span>
          ) : (
            <span style={{
              background: 'var(--status-danger-soft)',
              color: 'var(--status-danger)',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              ⚠️ Perlu Perbaikan
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: editorMode === 'visual' ? 'var(--action-primary)' : 'var(--surface-interactive)',
              color: editorMode === 'visual' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}
          >
            Form Visual
          </button>
          <button
            type="button"
            onClick={handleSwitchToJson}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: editorMode === 'json' ? 'var(--action-primary)' : 'var(--surface-interactive)',
              color: editorMode === 'json' ? 'var(--on-action-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}
          >
            JSON Raw
          </button>
        </div>
      </div>

      {/* Warnings & Errors */}
      {planErrors.length > 0 && (
        <div style={{
          background: 'var(--status-danger-soft)',
          border: '1px solid var(--status-danger)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '0.75rem',
          color: 'var(--status-danger)'
        }}>
          <strong>Harap Perbaiki:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {planErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {planWarnings.length > 0 && (
        <div style={{
          background: 'var(--status-warning-soft)',
          border: '1px solid var(--status-warning)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
          marginBottom: '12px',
          fontSize: '0.75rem',
          color: 'var(--status-warning)'
        }}>
          <strong>Peringatan Validator:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {planWarnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Editor Content */}
      {editorMode === 'json' ? (
        <div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px',
              resize: 'vertical'
            }}
          />
          {jsonError && (
            <div style={{ color: 'var(--status-danger)', fontSize: '0.74rem', marginTop: '4px' }}>
              {jsonError}
            </div>
          )}
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleApplyJson}
              style={{
                background: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Simpan & Terapkan JSON
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('visual')}
              style={{
                background: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Baris 1: Hook Title */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Hook Title (Overlay Pembuka) <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={currentPlan.hook || ''}
              onChange={(e) => handleUpdateField('hook', e.target.value)}
              placeholder="Contoh: Sarapan Sehat Tanpa Dimasak"
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '0.82rem'
              }}
            />
          </div>

          {/* Baris 2: Skin, Caption Mode, Brand Name */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Finishing Skin
              </label>
              <select
                value={skin}
                onChange={(e) => onChangeSkin && onChangeSkin(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.8rem'
                }}
              >
                {FINISHING_SKIN_REGISTRY.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Mode Caption Subtitle
              </label>
              <select
                value={captionMode}
                onChange={(e) => onChangeCaptionMode && onChangeCaptionMode(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.8rem'
                }}
              >
                <option value="full">Full (Semua Kata Bicara)</option>
                <option value="hybrid">Hybrid (Kata Kunci Penting)</option>
                <option value="none">None (Tanpa Subtitle)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Nama Brand
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => onChangeBrandName && onChangeBrandName(e.target.value)}
                placeholder="Contoh: Oat Sahabat"
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          </div>

          {/* Baris 3: Template-specific fields */}
          {templateId === 'recipe_pop' && (
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Chips Bahan Resep (Pisahkan koma)
              </label>
              <input
                type="text"
                value={Array.isArray(currentPlan.chips) ? currentPlan.chips.join(', ') : (currentPlan.chips || '')}
                onChange={(e) => {
                  const items = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  handleUpdateField('chips', items);
                }}
                placeholder="Rolled Oat, Susu Segar, Buah Segar"
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          )}

          {templateId === 'tips_listicle' && (
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Daftar Tips (Judul Tip, pisahkan koma)
              </label>
              <input
                type="text"
                value={Array.isArray(currentPlan.tips) ? currentPlan.tips.map(t => typeof t === 'string' ? t : t.title).join(', ') : ''}
                onChange={(e) => {
                  const items = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  handleUpdateField('tips', items.map((title, idx) => ({ number: idx + 1, title, clip_index: idx })));
                }}
                placeholder="Pilih Oat Utuh, Rendam Semalaman, Tambah Topping"
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          )}

          {/* Baris 4: Punches / Kata Kunci Highlight */}
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Punches / Kata Penegas Highlight (Pisahkan koma)
            </label>
            <input
              type="text"
              value={Array.isArray(currentPlan.punches) ? currentPlan.punches.join(', ') : (currentPlan.punches || '')}
              onChange={(e) => {
                const items = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                handleUpdateField('punches', items);
              }}
              placeholder="sarapan sehat, tanpa repot, praktis pagi hari"
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
