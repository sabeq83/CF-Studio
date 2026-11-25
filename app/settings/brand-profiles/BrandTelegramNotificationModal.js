'use client';

import React, { useEffect, useState } from 'react';

const EVENT_OPTIONS = [
  {
    key: 'production_and_schedule',
    title: 'Produksi Selesai & Terjadwal ke Repliz (1 pesan gabungan)',
    desc: 'Menggabungkan status semua akun (FB, IG, TT, YT) dalam 1 pesan per video setelah masuk antrean Repliz.'
  },
  {
    key: 'production_failed',
    title: 'Gagal Produksi Video',
    desc: 'Peringatan langsung ketika Auto Pipeline gagal render atau kehabisan retry.'
  },
  {
    key: 'awaiting_approval',
    title: 'Menunggu Persetujuan (Semi-Autopilot)',
    desc: 'Pemberitahuan saat storyboard Content Automations siap direview sebelum produksi lanjut.'
  },
  {
    key: 'publish_succeeded',
    title: 'Konten Berhasil Tayang (H-0)',
    desc: 'Terkirim setelah semua platform target untuk video tersebut berstatus tayang beserta tautan postingan.'
  },
  {
    key: 'publish_failed',
    title: 'Gagal Jadwal Repliz atau Gagal Publish',
    desc: 'Peringatan langsung disertai rincian akun dan pesan error bila penjadwalan atau publish gagal.'
  }
];

const DEFAULT_EVENTS = EVENT_OPTIONS.map(item => item.key);

function PreviewMessage({ type, brandName, chatTarget, threadId }) {
  const topicText = threadId ? `Topic #${threadId}` : 'Pesan Umum Grup (tanpa Topic ID)';
  const displayBrand = brandName || 'Brand';

  let body = '';
  if (type === 'ready') {
    body = [
      `✅ [${displayBrand}] Video Siap & Terjadwal ke Repliz`,
      '• Konten: Multiplier Produk (Bahan 1) - Tepung Almond',
      '• Campaign: mul_261126_abc123',
      '• Tayang: Kamis, 26 Nov 2026 • 07:15 WIB',
      `• Channel: Facebook (${displayBrand} ID) ✅ | Instagram ✅`,
      '• Link Afiliasi: Aktif'
    ].join('\n');
  } else if (type === 'published') {
    body = [
      `🚀 [${displayBrand}] Konten Sudah Tayang`,
      '• Konten: Multiplier Produk (Alat 1) - Blender Portable',
      '• Jadwal Asli: 10:30 WIB',
      '• Facebook: Terbit (lihat postingan)',
      '• Instagram: Terbit (lihat postingan)'
    ].join('\n');
  } else {
    body = [
      `🚨 [${displayBrand}] Gagal Produksi Video`,
      '• Jadwal: Multiplier Produk - Teko Kaca Infuser (2026-11-26)',
      '• Error: G-Labs timeout setelah retry',
      '• Target Tayang: 2026-11-26 06:01 WIB'
    ].join('\n');
  }

  return (
    <div
      style={{
        background: 'var(--input-bg)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '13px 15px',
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-line',
        lineHeight: 1.55
      }}
    >
      <div style={{ fontSize: '0.74rem', fontWeight: 650, color: 'var(--status-info)', marginBottom: 6 }}>
        Tujuan: {chatTarget || 'Belum ada Chat ID'} | {topicText}
      </div>
      <div>{body}</div>
      <div style={{ marginTop: 6, color: 'var(--link)', fontWeight: 600 }}>Buka CF Studio</div>
    </div>
  );
}

export default function BrandTelegramNotificationModal({
  brand,
  openTenantEditorInitially = false,
  onClose,
  onSaved
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [tenantEditorOpen, setTenantEditorOpen] = useState(openTenantEditorInitially);
  const [showBotToken, setShowBotToken] = useState(false);
  const [tenantInfo, setTenantInfo] = useState({
    configured: false,
    has_bot_token: false,
    enabled: false,
    chat_id: '',
    chat_id_masked: ''
  });
  const [tenantForm, setTenantForm] = useState({
    bot_token: '',
    chat_id: '',
    enabled: true
  });

  const [brandForm, setBrandForm] = useState({
    enabled: false,
    message_thread_id: '',
    chat_id: '',
    events: DEFAULT_EVENTS,
    quiet_start: '',
    quiet_end: '',
    bypass_quiet_for_errors: true,
    timezone: 'Asia/Jakarta'
  });

  const [previewTab, setPreviewTab] = useState('ready');

  async function loadSettings() {
    if (!brand?.id) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/v2/brand-profiles/${encodeURIComponent(brand.id)}/notification-settings`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat pengaturan notifikasi brand.');
      }
      const s = data.settings || {};
      const tenantTg = s.tenant_telegram || {};
      setTenantInfo({
        configured: Boolean(tenantTg.configured),
        has_bot_token: Boolean(tenantTg.has_bot_token),
        enabled: Boolean(tenantTg.enabled),
        chat_id: tenantTg.chat_id || '',
        chat_id_masked: tenantTg.chat_id_masked || ''
      });
      setTenantForm({
        bot_token: '',
        chat_id: tenantTg.chat_id || '',
        enabled: Boolean(tenantTg.configured ? tenantTg.enabled : true)
      });
      setBrandForm({
        enabled: Boolean(s.enabled),
        message_thread_id: s.message_thread_id ? String(s.message_thread_id) : '',
        chat_id: s.chat_id || '',
        events: Array.isArray(s.events) && s.events.length > 0 ? s.events : DEFAULT_EVENTS,
        quiet_start: s.quiet_start || '',
        quiet_end: s.quiet_end || '',
        bypass_quiet_for_errors: s.bypass_quiet_for_errors !== false,
        timezone: s.timezone || 'Asia/Jakarta'
      });
      if (openTenantEditorInitially || !tenantTg.configured) {
        setTenantEditorOpen(true);
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, [brand?.id]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function toggleEvent(eventKey) {
    setBrandForm(prev => {
      const exists = prev.events.includes(eventKey);
      const next = exists ? prev.events.filter(item => item !== eventKey) : [...prev.events, eventKey];
      return { ...prev, events: next };
    });
  }

  function applySettingsResponse(s) {
    const tenantTg = s.tenant_telegram || {};
    setTenantInfo({
      configured: Boolean(tenantTg.configured),
      has_bot_token: Boolean(tenantTg.has_bot_token),
      enabled: Boolean(tenantTg.enabled),
      chat_id: tenantTg.chat_id || '',
      chat_id_masked: tenantTg.chat_id_masked || ''
    });
    setTenantForm(prev => ({
      ...prev,
      bot_token: '',
      chat_id: tenantTg.chat_id || '',
      enabled: Boolean(tenantTg.enabled)
    }));
  }

  function buildBrandPayload(includeTenant = false) {
    const payload = {
      enabled: brandForm.enabled,
      message_thread_id: brandForm.message_thread_id.trim() ? Number(brandForm.message_thread_id.trim()) : null,
      chat_id: brandForm.chat_id.trim() || null,
      events: brandForm.events,
      quiet_start: brandForm.quiet_start.trim() || null,
      quiet_end: brandForm.quiet_end.trim() || null,
      bypass_quiet_for_errors: brandForm.bypass_quiet_for_errors,
      timezone: brandForm.timezone
    };
    if (includeTenant) {
      payload.tenant_telegram = {
        chat_id: tenantForm.chat_id.trim(),
        enabled: tenantForm.enabled,
        ...(tenantForm.bot_token.trim() ? { bot_token: tenantForm.bot_token.trim() } : {})
      };
    }
    return payload;
  }

  async function handleSaveTenantOnly() {
    setFeedback(null);
    const chatVal = tenantForm.chat_id.trim();
    const tokenVal = tenantForm.bot_token.trim();
    if (!chatVal) {
      setFeedback({ type: 'error', text: 'Chat ID Grup Forum Default wajib diisi.' });
      return;
    }
    if (!tenantInfo.has_bot_token && !tokenVal) {
      setFeedback({ type: 'error', text: 'Bot Token Telegram Tenant wajib diisi untuk konfigurasi pertama kali.' });
      return;
    }

    setSavingTenant(true);
    try {
      const res = await fetch(`/api/v2/brand-profiles/${encodeURIComponent(brand.id)}/notification-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBrandPayload(true))
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan konfigurasi Bot Tenant.');
      }
      applySettingsResponse(data.settings);
      setTenantEditorOpen(false);
      setFeedback({ type: 'success', text: 'Bot Token dan Chat ID default tenant berhasil disimpan.' });
      if (onSaved) onSaved();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleSaveBrand() {
    setFeedback(null);
    if (brandForm.message_thread_id.trim()) {
      const parsed = Number(brandForm.message_thread_id.trim());
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setFeedback({ type: 'error', text: 'Topic / Thread ID harus berupa bilangan bulat positif.' });
        return;
      }
    }
    if (brandForm.events.length === 0) {
      setFeedback({ type: 'error', text: 'Pilih minimal satu event notifikasi.' });
      return;
    }

    const shouldIncludeTenant = Boolean(
      tenantForm.bot_token.trim()
      || (tenantForm.chat_id.trim() && tenantForm.chat_id.trim() !== tenantInfo.chat_id)
    );

    setSaving(true);
    try {
      const res = await fetch(`/api/v2/brand-profiles/${encodeURIComponent(brand.id)}/notification-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBrandPayload(shouldIncludeTenant))
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (!tenantInfo.configured && !shouldIncludeTenant) setTenantEditorOpen(true);
        throw new Error(data.error || 'Gagal menyimpan pengaturan notifikasi brand.');
      }
      applySettingsResponse(data.settings);
      setFeedback({ type: 'success', text: `Pengaturan Telegram untuk ${brand.brand_name} berhasil disimpan.` });
      if (onSaved) onSaved();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setFeedback(null);
    setTesting(true);
    try {
      const res = await fetch(`/api/v2/brand-profiles/${encodeURIComponent(brand.id)}/notification-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) setTenantEditorOpen(true);
        throw new Error(data.error || 'Gagal mengirim tes notifikasi.');
      }
      setFeedback({ type: 'success', text: data.message || 'Pesan tes masuk antrean outbox.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (!brand) return null;

  const effectiveChatPreview = brandForm.chat_id.trim() || tenantForm.chat_id.trim() || tenantInfo.chat_id;

  return (
    <div
      data-modal-overlay="true"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-telegram-modal-title"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          className="modal-header"
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div>
            <h2 id="brand-telegram-modal-title" style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Notifikasi Telegram: {brand.brand_name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Arahkan laporan produksi dan jadwal tayang brand ini ke Topic khusus di grup Forum Telegram tenant.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup dialog notifikasi Telegram"
            style={{ minWidth: 40, minHeight: 40 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Memuat pengaturan notifikasi Telegram...
            </div>
          ) : loadError ? (
            <div
              role="alert"
              style={{
                padding: 16,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div>{loadError}</div>
              <div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadSettings}>
                  Muat Ulang
                </button>
              </div>
            </div>
          ) : (
            <>
              {feedback && (
                <div
                  role="status"
                  style={{
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    background: feedback.type === 'error' ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
                    border: `1px solid ${feedback.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)'}`,
                    color: feedback.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)'
                  }}
                >
                  {feedback.text}
                </div>
              )}

              {/* Panel Bot & Grup Default Tenant */}
              <section
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Bot &amp; Grup Default Tenant
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {tenantInfo.configured
                        ? `Status: Bot tersimpan dan grup default terhubung (${tenantInfo.chat_id_masked}).`
                        : 'Status: Bot Token atau Chat ID default tenant belum diisi. Isi di bawah agar notifikasi brand bisa dikirim.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-expanded={tenantEditorOpen}
                    onClick={() => setTenantEditorOpen(v => !v)}
                  >
                    {tenantEditorOpen ? 'Tutup Editor Tenant' : 'Ubah Bot / Chat ID Tenant'}
                  </button>
                </div>

                {tenantEditorOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="tenant-bot-token-input">Bot Token Telegram Tenant</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            id="tenant-bot-token-input"
                            className="form-input"
                            type={showBotToken ? 'text' : 'password'}
                            autoComplete="off"
                            value={tenantForm.bot_token}
                            onChange={e => setTenantForm(prev => ({ ...prev, bot_token: e.target.value }))}
                            placeholder={tenantInfo.has_bot_token ? 'Token tersimpan (kosongkan jika tetap)' : '123456789:BOT_TOKEN_PLACEHOLDER'}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowBotToken(v => !v)}
                          >
                            {showBotToken ? 'Tutup' : 'Lihat'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Satu bot dipakai untuk seluruh brand di tenant ini.
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="tenant-chat-id-input">Chat ID Grup Forum Default</label>
                        <input
                          id="tenant-chat-id-input"
                          className="form-input"
                          type="text"
                          value={tenantForm.chat_id}
                          onChange={e => setTenantForm(prev => ({ ...prev, chat_id: e.target.value }))}
                          placeholder="-1001234567890"
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          ID grup Telegram (format -100...) yang mengaktifkan Topics.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <label htmlFor="tenant-notif-enabled" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <input
                          id="tenant-notif-enabled"
                          type="checkbox"
                          checked={tenantForm.enabled}
                          onChange={e => setTenantForm(prev => ({ ...prev, enabled: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: 'var(--action-primary)' }}
                        />
                        <span>Aktifkan pengiriman notifikasi level tenant</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={savingTenant}
                        onClick={handleSaveTenantOnly}
                      >
                        {savingTenant ? 'Menyimpan...' : 'Simpan Bot & Chat ID Tenant'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Pengaturan Topic & Event Brand */}
              <section
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pengaturan Topic &amp; Event Brand Ini
                </div>

                <label
                  htmlFor="brand-notif-enabled"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                      Aktifkan notifikasi untuk brand ini
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Kirim ringkasan produksi, jadwal Repliz, dan alert gagal ke Topic brand.
                    </div>
                  </div>
                  <input
                    id="brand-notif-enabled"
                    type="checkbox"
                    checked={brandForm.enabled}
                    onChange={e => setBrandForm(prev => ({ ...prev, enabled: e.target.checked }))}
                    style={{ width: 20, height: 20, accentColor: 'var(--action-primary)' }}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="brand-thread-id-input">Topic / Thread ID Telegram</label>
                    <input
                      id="brand-thread-id-input"
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      value={brandForm.message_thread_id}
                      onChange={e => setBrandForm(prev => ({ ...prev, message_thread_id: e.target.value }))}
                      placeholder="Contoh: 42"
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Salin link topik grup (t.me/c/123456789/<strong>42</strong>), lalu masukkan angka terakhirnya.
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="brand-chat-override-input">Override Chat ID (Opsional)</label>
                    <input
                      id="brand-chat-override-input"
                      className="form-input"
                      type="text"
                      value={brandForm.chat_id}
                      onChange={e => setBrandForm(prev => ({ ...prev, chat_id: e.target.value }))}
                      placeholder="Kosongkan untuk pakai grup tenant"
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Isi hanya jika brand ini dikirim ke grup Telegram terpisah.
                    </div>
                  </div>
                </div>

                <div>
                  <div className="form-label" style={{ marginBottom: 8 }}>Event Notifikasi yang Dikirim</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {EVENT_OPTIONS.map(ev => (
                      <label
                        key={ev.key}
                        htmlFor={`brand-ev-${ev.key}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <input
                          id={`brand-ev-${ev.key}`}
                          type="checkbox"
                          checked={brandForm.events.includes(ev.key)}
                          onChange={() => toggleEvent(ev.key)}
                          style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--action-primary)', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-primary)' }}>{ev.title}</div>
                          <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)' }}>{ev.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="brand-quiet-start">Jam Tenang Mulai</label>
                    <input
                      id="brand-quiet-start"
                      className="form-input"
                      type="text"
                      value={brandForm.quiet_start}
                      onChange={e => setBrandForm(prev => ({ ...prev, quiet_start: e.target.value }))}
                      placeholder="22:00"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="brand-quiet-end">Jam Tenang Selesai</label>
                    <input
                      id="brand-quiet-end"
                      className="form-input"
                      type="text"
                      value={brandForm.quiet_end}
                      onChange={e => setBrandForm(prev => ({ ...prev, quiet_end: e.target.value }))}
                      placeholder="05:00"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="brand-timezone-select">Zona Waktu Pesan</label>
                    <select
                      id="brand-timezone-select"
                      className="form-select"
                      value={brandForm.timezone}
                      onChange={e => setBrandForm(prev => ({ ...prev, timezone: e.target.value }))}
                    >
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                    </select>
                  </div>
                </div>

                <label htmlFor="brand-bypass-quiet" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    id="brand-bypass-quiet"
                    type="checkbox"
                    checked={brandForm.bypass_quiet_for_errors}
                    onChange={e => setBrandForm(prev => ({ ...prev, bypass_quiet_for_errors: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--action-primary)' }}
                  />
                  <span>Tetap kirim alert error (Gagal Produksi &amp; Gagal Publish) saat jam tenang</span>
                </label>
              </section>

              {/* Pratinjau Format Pesan */}
              <section
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Pratinjau Pesan Gabungan ke Topic
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { id: 'ready', label: 'Terjadwal Repliz' },
                      { id: 'published', label: 'Sudah Tayang' },
                      { id: 'failed', label: 'Alert Gagal' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setPreviewTab(tab.id)}
                        style={
                          previewTab === tab.id
                            ? {
                                background: 'var(--status-info-soft)',
                                borderColor: 'var(--status-info)',
                                color: 'var(--status-info)'
                              }
                            : undefined
                        }
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <PreviewMessage
                  type={previewTab}
                  brandName={brand.brand_name}
                  chatTarget={effectiveChatPreview}
                  threadId={brandForm.message_thread_id.trim()}
                />
              </section>
            </>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading || testing || saving}
              onClick={handleSendTest}
              style={{
                background: 'var(--status-info-soft)',
                borderColor: 'var(--status-info)',
                color: 'var(--status-info)'
              }}
            >
              {testing ? 'Mengirim Tes...' : 'Kirim Tes ke Topic Brand'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || saving}
              onClick={handleSaveBrand}
            >
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Brand'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
