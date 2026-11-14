'use client';

import { useEffect, useState, useCallback } from 'react';

const MODEL_OPTIONS = [
  { value: '', label: 'Otomatis (Bawaan Sistem — Paling Hemat)' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (Disarankan)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Lebih Berat)' }
];

const CARD_KEYS = {
  story: ['planner_scene_director', 'metaphor_kit_engine'],
  qc: ['start_frame_visual_qc', 'start_frame_visual_qc_batch', 'start_frame_visual_qc_model'],
  quota: ['gemini_quota_brake'],
  advanced: ['compact_prompts']
};

const SCOPE_LABELS = {
  all: 'semua pengaturan Fitur Eksperimen',
  story: 'kartu Cerita & Adegan',
  qc: 'kartu Pemeriksa Gambar Otomatis',
  quota: 'kartu Kuota Gemini',
  advanced: 'kartu Pengaturan Lanjutan'
};

const DEFAULT_META_ENTRY = { by: 'system-default', at: 'Default awal' };

function getChangedKeys(serverSettings, draftSettings) {
  if (!serverSettings || !draftSettings) return [];
  const keys = new Set([...Object.keys(serverSettings), ...Object.keys(draftSettings)]);
  const changed = [];
  for (const key of keys) {
    if ((draftSettings[key] ?? '') !== (serverSettings[key] ?? '')) {
      changed.push(key);
    }
  }
  return changed;
}

function getQuotaBarColor(pct) {
  if (pct >= 90) return 'var(--status-danger)';
  if (pct >= 65) return 'var(--status-warning)';
  return 'var(--status-success)';
}

function SegmentedButtons({ options, value, onChange, disabled }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '4px',
        borderRadius: '10px',
        background: 'var(--surface-interactive)',
        border: '1px solid var(--border-subtle)',
        opacity: disabled ? 0.6 : 1
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        let activeBg = 'var(--action-primary)';
        let activeColor = 'var(--on-action-primary)';
        if (active && opt.tone === 'warning') {
          activeBg = 'var(--status-warning)';
          activeColor = 'var(--surface)';
        } else if (active && opt.tone === 'danger') {
          activeBg = 'var(--status-danger)';
          activeColor = 'var(--on-action-primary)';
        } else if (active && opt.tone === 'success') {
          activeBg = 'var(--status-success)';
          activeColor = 'var(--on-action-primary)';
        }

        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: active ? 700 : 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: active ? activeBg : 'transparent',
              color: active ? activeColor : 'var(--text-secondary)',
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingRow({ title, badge, badgeTone = 'info', description, meta, children }) {
  const entry = meta || DEFAULT_META_ENTRY;
  const badgeStyles = {
    info: { bg: 'var(--status-info-soft)', color: 'var(--status-info)' },
    success: { bg: 'var(--status-success-soft)', color: 'var(--status-success)' },
    warning: { bg: 'var(--status-warning-soft)', color: 'var(--status-warning)' },
    danger: { bg: 'var(--status-danger-soft)', color: 'var(--status-danger)' }
  }[badgeTone] || { bg: 'var(--status-info-soft)', color: 'var(--status-info)' };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px 16px',
        borderRadius: '10px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px'
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </span>
            {badge && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: badgeStyles.bg,
                  color: badgeStyles.color
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>

        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
          {children}
        </div>
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Terakhir diubah: {entry.at || 'Default awal'} oleh <strong style={{ color: 'var(--text-secondary)' }}>{entry.by || 'system-default'}</strong>
      </div>
    </div>
  );
}

export default function ExperimentSettingsPanel({ onToast, onQuotaRefresh }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [payloadData, setPayloadData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const notify = useCallback((msg, type = 'success') => {
    if (typeof onToast === 'function') {
      onToast(msg, type);
    }
  }, [onToast]);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/experiments');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memuat pengaturan Fitur Eksperimen.');
      }
      setCanEdit(Boolean(json.can_edit));
      setPayloadData(json.data);
      setDraft({ ...(json.data?.settings || {}) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  function applyDraftChange(key, nextValue) {
    if (!canEdit || saving) return;

    if (key === 'start_frame_visual_qc' && nextValue === 'enforce' && draft?.start_frame_visual_qc !== 'enforce') {
      setConfirmModal({
        title: 'Aktifkan Blokir & Buat Ulang?',
        body: 'Jika gambar awal gagal lolos pemeriksaan, sistem akan menghentikan sementara dan menggambar ulang maksimal 1× per adegan. Ini dapat memperlambat produksi video dan memakai kuota Gemini tambahan.',
        confirmLabel: 'Ya, Aktifkan Blokir & Buat Ulang',
        tone: 'warning',
        onConfirm: () => {
          setDraft((prev) => ({ ...prev, start_frame_visual_qc: 'enforce' }));
          setConfirmModal(null);
        }
      });
      return;
    }

    if (key === 'gemini_quota_brake' && nextValue === 'off' && draft?.gemini_quota_brake !== 'off') {
      setConfirmModal({
        title: 'Matikan Rem Kuota Harian?',
        body: 'Mematikan Rem Kuota membuat proses video berjalan tanpa penahan harian. Saat antrean padat, jatah panggilan Gemini akun ini bisa cepat habis dalam waktu singkat. Lanjutkan?',
        confirmLabel: 'Ya, Matikan Rem Kuota',
        tone: 'danger',
        onConfirm: () => {
          setDraft((prev) => ({ ...prev, gemini_quota_brake: 'off' }));
          setConfirmModal(null);
        }
      });
      return;
    }

    setDraft((prev) => ({ ...prev, [key]: nextValue }));
  }

  async function saveChanges() {
    if (!canEdit || saving || !payloadData?.settings || !draft) return;
    const changedKeys = getChangedKeys(payloadData.settings, draft);
    if (changedKeys.length === 0) return;

    const updates = {};
    for (const k of changedKeys) {
      updates[k] = draft[k];
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan perubahan Fitur Eksperimen.');
      }
      setPayloadData(json.data);
      setDraft({ ...(json.data?.settings || {}) });
      if (typeof onQuotaRefresh === 'function') {
        onQuotaRefresh();
      }
      notify(json.message || 'Perubahan Fitur Eksperimen berhasil disimpan!', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function requestReset(scope) {
    if (!canEdit || saving) return;
    const targetText = SCOPE_LABELS[scope] || 'pengaturan ini';
    setConfirmModal({
      title: 'Kembalikan ke Default Aman?',
      body: `Apakah Anda yakin ingin mengembalikan ${targetText} pada akun ${payloadData?.tenant_name || payloadData?.tenant_id || 'ini'} ke nilai bawaan yang disarankan?`,
      confirmLabel: 'Ya, Kembalikan Default',
      tone: 'warning',
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
          const res = await fetch('/api/settings/experiments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reset_scope: scope })
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || 'Gagal mengembalikan default.');
          }
          setPayloadData(json.data);
          setDraft({ ...(json.data?.settings || {}) });
          if (typeof onQuotaRefresh === 'function') {
            onQuotaRefresh();
          }
          notify(json.message || 'Berhasil dikembalikan ke default aman.', 'success');
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  }

  function discardDraft() {
    if (!payloadData?.settings) return;
    setDraft({ ...payloadData.settings });
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '28px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          fontSize: '0.88rem'
        }}
      >
        Memuat pengaturan Fitur Eksperimen untuk akun ini...
      </div>
    );
  }

  if (error || !payloadData || !draft) {
    return (
      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: 'var(--status-danger-soft)',
          border: '1px solid var(--status-danger)',
          color: 'var(--status-danger)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Gagal memuat Fitur Eksperimen</div>
        <div style={{ fontSize: '0.82rem' }}>{error || 'Data tidak tersedia.'}</div>
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadExperiments}
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const changedKeys = getChangedKeys(payloadData.settings, draft);
  const dirtyCount = changedKeys.length;
  const meta = payloadData.meta || {};
  const quotaMeter = Array.isArray(payloadData.quota_meter) ? payloadData.quota_meter : [];
  const history = Array.isArray(payloadData.history) ? payloadData.history : [];
  const tenantLabel = payloadData.tenant_name || payloadData.tenant_id || 'Akun Aktif';
  const batchIsShadow = draft.start_frame_visual_qc_batch === 'shadow';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Banner Akun Aktif */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderLeft: '4px solid var(--action-primary)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px'
        }}
      >
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🧪 Fitur Eksperimen
            </h2>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'var(--status-info-soft)',
                color: 'var(--status-info)'
              }}
            >
              Akun aktif: {tenantLabel}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Pengaturan ini berlaku khusus untuk akun <strong style={{ color: 'var(--text-primary)' }}>{tenantLabel}</strong>. Perubahan hanya berlaku untuk video baru yang dibuat setelah disimpan — antrean yang sedang berjalan tidak terganggu.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canEdit || saving}
          onClick={() => requestReset('all')}
          style={{ whiteSpace: 'nowrap' }}
        >
          ↩️ Kembalikan Semua ke Default
        </button>
      </div>

      {/* Read-only notice for non-admin */}
      {!canEdit && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--status-info-soft)',
            border: '1px solid var(--status-info)',
            color: 'var(--status-info)',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          👀 Mode Lihat Saja — Anda tidak memiliki izin ubah. Hanya Admin atau Owner akun ini yang dapat mengubah dan menyimpan Fitur Eksperimen.
        </div>
      )}

      {/* Dirty / Unsaved Action Bar */}
      {dirtyCount > 0 && canEdit && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--status-warning-soft)',
            border: '1px solid var(--status-warning)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Ada <strong>{dirtyCount}</strong> perubahan belum disimpan untuk akun <strong>{tenantLabel}</strong>.
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={saving}
              onClick={discardDraft}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={saveChanges}
            >
              {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}

      {/* Kartu A — Cerita & Adegan */}
      <section
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🎬 A. Cerita & Adegan
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Mengatur cara AI merangkai urutan adegan, variasi kamera, dan lapisan visual.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit || saving}
            onClick={() => requestReset('story')}
            style={{ fontSize: '0.74rem' }}
          >
            Kembalikan default kartu
          </button>
        </div>

        <SettingRow
          title="Sutradara Adegan dari Planner"
          badge={draft.planner_scene_director === 'on' ? 'Aktif' : 'Disarankan: Mati'}
          badgeTone={draft.planner_scene_director === 'on' ? 'success' : 'info'}
          description="Kalau aktif: setiap video mengikuti urutan adegan dan jenis kamera dari perencana cerita sehingga adegan lebih variatif dari awal sampai akhir. Kalau dimatikan: memakai alur storyboard standar."
          meta={meta[CARD_KEYS.story[0]]}
        >
          <SegmentedButtons
            disabled={!canEdit || saving}
            value={draft.planner_scene_director}
            onChange={(val) => applyDraftChange(CARD_KEYS.story[0], val)}
            options={[
              { value: 'off', label: 'Mati' },
              { value: 'on', label: 'Nyala', tone: 'success' }
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Mesin Metafora"
          badge="Lanjutan"
          badgeTone="warning"
          description="Kalau aktif: menambahkan isyarat metafora visual (objek dan suasana simbolik) ke adegan utama agar visual terasa lebih berlapis dan emosional. Kalau dimatikan: memakai deskripsi adegan langsung."
          meta={meta[CARD_KEYS.story[1]]}
        >
          <SegmentedButtons
            disabled={!canEdit || saving}
            value={draft.metaphor_kit_engine}
            onChange={(val) => applyDraftChange(CARD_KEYS.story[1], val)}
            options={[
              { value: 'off', label: 'Mati' },
              { value: 'on', label: 'Nyala', tone: 'success' }
            ]}
          />
        </SettingRow>
      </section>

      {/* Kartu B — Pemeriksa Gambar Otomatis */}
      <section
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🖼️ B. Pemeriksa Gambar Otomatis
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Menjaga konsistensi frame awal sebelum video dirender, sekaligus mengatur efisiensi panggilan pemeriksaan.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit || saving}
            onClick={() => requestReset('qc')}
            style={{ fontSize: '0.74rem' }}
          >
            Kembalikan default kartu
          </button>
        </div>

        <SettingRow
          title="Mode Pemeriksa Gambar"
          badge={
            draft.start_frame_visual_qc === 'enforce'
              ? 'Blokir Aktif'
              : draft.start_frame_visual_qc === 'report_only'
                ? 'Disarankan: Lapor saja'
                : 'Mati'
          }
          badgeTone={
            draft.start_frame_visual_qc === 'enforce'
              ? 'warning'
              : draft.start_frame_visual_qc === 'report_only'
                ? 'info'
                : 'info'
          }
          description="Mati: tidak memeriksa frame awal. Lapor saja: mencatat temuan visual di log tanpa menghambat produksi. Blokir & buat ulang: jika gagal lolos, otomatis menggambar ulang maksimal 1× (sedikit lebih lambat & memakai kuota ekstra)."
          meta={meta[CARD_KEYS.qc[0]]}
        >
          <SegmentedButtons
            disabled={!canEdit || saving}
            value={draft.start_frame_visual_qc}
            onChange={(val) => applyDraftChange(CARD_KEYS.qc[0], val)}
            options={[
              { value: 'off', label: 'Mati' },
              { value: 'report_only', label: 'Lapor saja', tone: 'info' },
              { value: 'enforce', label: 'Blokir & buat ulang', tone: 'warning' }
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Periksa Sekaligus"
          badge={batchIsShadow ? '🟡 Uji Banding' : draft.start_frame_visual_qc_batch === 'on' ? 'Hemat Kuota' : 'Satu per satu'}
          badgeTone={batchIsShadow ? 'warning' : draft.start_frame_visual_qc_batch === 'on' ? 'success' : 'info'}
          description={
            batchIsShadow
              ? 'Saat ini sedang berada pada mode Uji Banding dari sistem. Pilih Nyala untuk memeriksa seluruh frame dalam 1 panggilan hemat kuota, atau Mati untuk memeriksa satu per satu.'
              : 'Kalau aktif: memeriksa seluruh frame video sekaligus dalam 1 panggilan sehingga jauh lebih hemat kuota Gemini. Kalau dimatikan: memeriksa tiap adegan satu per satu.'
          }
          meta={meta[CARD_KEYS.qc[1]]}
        >
          <SegmentedButtons
            disabled={!canEdit || saving}
            value={draft.start_frame_visual_qc_batch}
            onChange={(val) => applyDraftChange(CARD_KEYS.qc[1], val)}
            options={[
              { value: 'off', label: 'Mati' },
              { value: 'on', label: 'Nyala', tone: 'success' }
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Model Pemeriksa"
          badge="Otomatis / Pilihan"
          badgeTone="info"
          description="Menentukan model AI yang dipakai untuk menilai kualitas frame awal. Pilih Otomatis atau Gemini 3.1 Flash-Lite agar cepat dan paling hemat kuota."
          meta={meta[CARD_KEYS.qc[2]]}
        >
          <select
            className="form-input"
            disabled={!canEdit || saving}
            value={draft.start_frame_visual_qc_model || ''}
            onChange={(e) => applyDraftChange(CARD_KEYS.qc[2], e.target.value)}
            style={{
              minWidth: '250px',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: '8px',
              padding: '7px 10px',
              fontSize: '0.8rem'
            }}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value || 'auto'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </section>

      {/* Kartu C — Kuota Gemini */}
      <section
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚡ C. Kuota Gemini
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Pengaman batas panggilan harian dan pantauan pemakaian kuota API untuk akun ini.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit || saving}
            onClick={() => requestReset('quota')}
            style={{ fontSize: '0.74rem' }}
          >
            Kembalikan default kartu
          </button>
        </div>

        <SettingRow
          title="Rem Kuota Harian"
          badge={draft.gemini_quota_brake === 'on' ? 'Disarankan: Nyala' : '⚠️ Rem Dimatikan'}
          badgeTone={draft.gemini_quota_brake === 'on' ? 'success' : 'danger'}
          description="Menjaga agar antrean sibuk tidak langsung menghabiskan seluruh jatah harian API Gemini, serta mencegah percobaan ulang berlebihan."
          meta={meta[CARD_KEYS.quota[0]]}
        >
          <SegmentedButtons
            disabled={!canEdit || saving}
            value={draft.gemini_quota_brake}
            onChange={(val) => applyDraftChange(CARD_KEYS.quota[0], val)}
            options={[
              { value: 'on', label: 'Nyala (Aman)', tone: 'success' },
              { value: 'off', label: 'Mati', tone: 'danger' }
            ]}
          />
        </SettingRow>

        {/* Meteran Kuota Hari Ini */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Meteran Kuota Hari Ini
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Reset harian: {payloadData.quota_reset_wib || '15:00 WIB (PT)'}
            </span>
          </div>

          {quotaMeter.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Belum ada data kuota hari ini untuk akun ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {quotaMeter.map((item) => {
                const used = Number(item.used || 0);
                const limit = Number(item.limit || 0);
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                const barColor = getQuotaBarColor(pct);

                return (
                  <div key={`${item.label}-${item.model}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', gap: '8px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.label}{' '}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({item.model})</span>
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {limit > 0 ? `${used} / ${limit} panggilan` : `${used} panggilan`}
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        width: '100%',
                        borderRadius: '999px',
                        background: 'var(--surface-interactive)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: '999px',
                          background: barColor,
                          transition: 'width 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Kartu D — Lanjutan (Accordion collapsed by default) */}
      <section
        style={{
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden'
        }}
      >
        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          style={{
            width: '100%',
            padding: '16px 20px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div>
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              🔧 D. Lanjutan (Pengaturan Tambahan)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Opsi eksperimental tambahan untuk menghemat token instruksi AI.
            </div>
          </div>
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {advancedOpen ? '▼ Tutup' : '▶ Buka'}
          </span>
        </button>

        {advancedOpen && (
          <div style={{ padding: '0 20px 18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--status-warning-soft)',
                border: '1px solid var(--status-warning)',
                color: 'var(--status-warning)',
                fontSize: '0.78rem',
                fontWeight: 600
              }}
            >
              ⚠️ Perhatian: opsi di bagian ini mengubah tingkat detail instruksi yang dikirim ke AI. Uji terlebih dahulu di akun uji sebelum diaktifkan di akun produksi.
            </div>

            <SettingRow
              title="Prompt Ringkas"
              badge={draft.compact_prompts === 'on' ? 'Aktif' : 'Standar: Mati'}
              badgeTone={draft.compact_prompts === 'on' ? 'warning' : 'info'}
              description="Kalau aktif: menyingkat sebagian instruksi tambahan agar pemakaian token dan kuota sedikit lebih ringan. Kalau dimatikan: mengirim instruksi lengkap."
              meta={meta[CARD_KEYS.advanced[0]]}
            >
              <SegmentedButtons
                disabled={!canEdit || saving}
                value={draft.compact_prompts}
                onChange={(val) => applyDraftChange(CARD_KEYS.advanced[0], val)}
                options={[
                  { value: 'off', label: 'Mati' },
                  { value: 'on', label: 'Nyala', tone: 'warning' }
                ]}
              />
            </SettingRow>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!canEdit || saving}
                onClick={() => requestReset('advanced')}
                style={{ fontSize: '0.74rem' }}
              >
                Kembalikan default kartu
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Riwayat Perubahan Akun Ini */}
      <section
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            🕒 Riwayat Perubahan Akun Ini
          </h3>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {history.length} catatan terbaru
          </span>
        </div>

        {history.length === 0 ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--surface-raised)',
              color: 'var(--text-muted)',
              fontSize: '0.8rem'
            }}
          >
            Belum ada catatan perubahan Fitur Eksperimen di akun ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem'
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {item.text}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {item.time} • <strong style={{ color: 'var(--text-secondary)' }}>{item.user}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Save Strip for convenience */}
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
          {dirtyCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={discardDraft}
            >
              Batalkan Perubahan ({dirtyCount})
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || dirtyCount === 0}
            onClick={saveChanges}
          >
            {saving ? 'Menyimpan...' : dirtyCount > 0 ? `💾 Simpan Perubahan (${dirtyCount})` : '✅ Semua Tersimpan'}
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--overlay-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-modal)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {confirmModal.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
              {confirmModal.body}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmModal(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={confirmModal.onConfirm}
                style={{
                  background: confirmModal.tone === 'danger' ? 'var(--status-danger)' : 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  borderColor: confirmModal.tone === 'danger' ? 'var(--status-danger)' : 'var(--action-primary)'
                }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
