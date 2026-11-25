'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/app/components/Sidebar';

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso) {
  if (!iso) return 'Belum pernah';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function effectiveStatus(cred) {
  if (cred.status === 'revoked') return 'revoked';
  if (cred.expires_at && new Date(cred.expires_at) < new Date()) return 'expired';
  return 'active';
}

export default function McpAccessManagementPage() {
  const [credentials, setCredentials] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [presets, setPresets] = useState([]);
  const [availableScopes, setAvailableScopes] = useState([]);
  const [sampleTools, setSampleTools] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState({ message: '', isSuccess: false });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState({
    name: '',
    tenant_id: 'default_tenant',
    allowed_tenant_ids: [],
    scopes: ['content:read', 'content:create', 'automation:read'],
    limitTools: false,
    allowed_tools: [],
    expires_at: '',
    status: 'active',
    notes: ''
  });

  const [configModal, setConfigModal] = useState({ open: false, cred: null, plainToken: null });
  const [configClientMode, setConfigClientMode] = useState('http');
  const [configHostUrl, setConfigHostUrl] = useState('http://100.95.245.55:7030/mcp');

  const [confirmModal, setConfirmModal] = useState({ open: false, mode: null, cred: null, busy: false });

  const tenantMap = useMemo(() => {
    const m = new Map();
    for (const t of tenants) m.set(t.id, t);
    return m;
  }, [tenants]);

  const tenantLabel = id => tenantMap.get(id)?.name || id;

  const remoteHosts = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mcp.cfstudio.local';
    const httpsMcp = origin.startsWith('https://') ? `${origin}/mcp` : 'https://mcp.domain-anda.com/mcp';
    return [
      { value: 'http://100.95.245.55:7030/mcp', label: 'Tailscale: http://100.95.245.55:7030/mcp' },
      { value: httpsMcp, label: `Domain HTTPS: ${httpsMcp}` }
    ];
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/v2/operator-credentials', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Gagal memuat data kredensial (HTTP ${res.status}).`);
      }
      setCredentials(data.credentials || []);
      setTenants(data.tenants || []);
      setPresets(data.presets || []);
      setAvailableScopes(data.available_scopes || []);
      setSampleTools(data.sample_tools || []);
    } catch (err) {
      setLoadError(err.message || 'Gagal memuat daftar kredensial operator.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        setFormOpen(false);
        setConfigModal({ open: false, cred: null, plainToken: null });
        setConfirmModal({ open: false, mode: null, cred: null, busy: false });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const stats = useMemo(() => {
    const total = credentials.length;
    const active = credentials.filter(c => effectiveStatus(c) === 'active').length;
    return { total, active, inactive: total - active };
  }, [credentials]);

  const filteredCredentials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return credentials.filter(cred => {
      const eff = effectiveStatus(cred);
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (!q) return true;
      const tenantText = [cred.tenant_id, ...(cred.allowed_tenant_ids || [])]
        .map(id => `${id} ${tenantLabel(id)} ${tenantMap.get(id)?.slug || ''}`)
        .join(' ');
      const haystack = `${cred.id} ${cred.name} ${cred.notes || ''} ${tenantText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [credentials, searchQuery, statusFilter, tenantMap]);

  function detectPresetLabel(scopes) {
    if (scopes.includes('tenant:superadmin') || scopes.includes('system:admin')) return 'Master Superadmin';
    const sorted = [...scopes].sort().join(',');
    const match = presets.find(p => [...p.scopes].sort().join(',') === sorted);
    return match ? match.label : `Custom (${scopes.length} scope)`;
  }

  function openCreateModal() {
    const defaultTnt = tenants[0]?.id || 'default_tenant';
    const defaultPreset = presets.find(p => p.id === 'content_operator') || presets[0];
    setEditingCred(null);
    setFormError('');
    setFormState({
      name: '',
      tenant_id: defaultTnt,
      allowed_tenant_ids: [],
      scopes: defaultPreset ? [...defaultPreset.scopes] : ['content:read', 'content:create', 'automation:read'],
      limitTools: false,
      allowed_tools: [],
      expires_at: '',
      status: 'active',
      notes: ''
    });
    setFormOpen(true);
  }

  function openEditModal(cred) {
    setEditingCred(cred);
    setFormError('');
    setFormState({
      name: cred.name,
      tenant_id: cred.tenant_id,
      allowed_tenant_ids: Array.isArray(cred.allowed_tenant_ids) ? cred.allowed_tenant_ids : [],
      scopes: Array.isArray(cred.scopes) ? cred.scopes : [],
      limitTools: Array.isArray(cred.allowed_tools),
      allowed_tools: Array.isArray(cred.allowed_tools) ? cred.allowed_tools : [],
      expires_at: toLocalDatetimeInput(cred.expires_at),
      status: cred.status,
      notes: cred.notes || ''
    });
    setFormOpen(true);
  }

  function applyPreset(preset) {
    setFormState(prev => ({
      ...prev,
      scopes: [...preset.scopes]
    }));
  }

  function toggleArrayField(field, value) {
    setFormState(prev => {
      const current = prev[field] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const cleanName = formState.name.trim();
    if (!cleanName) {
      setFormError('Nama PC atau operator wajib diisi.');
      return;
    }
    if (!formState.scopes || formState.scopes.length === 0) {
      setFormError('Pilih minimal satu scope hak akses.');
      return;
    }

    setSaving(true);
    setFormError('');
    const isMaster = formState.scopes.includes('tenant:superadmin');
    const payload = {
      name: cleanName,
      tenant_id: formState.tenant_id,
      allowed_tenant_ids: isMaster ? [] : formState.allowed_tenant_ids.filter(id => id !== formState.tenant_id),
      scopes: formState.scopes,
      allowed_tools: formState.limitTools ? formState.allowed_tools : null,
      expires_at: formState.expires_at ? new Date(formState.expires_at).toISOString() : null,
      status: formState.status,
      notes: formState.notes.trim()
    };

    try {
      const url = editingCred
        ? `/api/v2/operator-credentials/${encodeURIComponent(editingCred.id)}`
        : '/api/v2/operator-credentials';
      const res = await fetch(url, {
        method: editingCred ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan kredensial operator.');
      }
      setFormOpen(false);
      await loadData();
      if (editingCred) {
        setFeedback({
          message: `Perubahan akses "${cleanName}" disimpan dan langsung aktif di request berikutnya.`,
          isSuccess: true
        });
      } else {
        setConfigModal({ open: true, cred: data.credential, plainToken: data.token });
        setFeedback({
          message: `Kredensial "${cleanName}" berhasil dibuat.`,
          isSuccess: true
        });
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(cred) {
    const nextStatus = cred.status === 'active' ? 'revoked' : 'active';
    try {
      const res = await fetch(`/api/v2/operator-credentials/${encodeURIComponent(cred.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengubah status.');
      await loadData();
      setFeedback({
        message: nextStatus === 'revoked'
          ? `Akses "${cred.name}" dicabut. Request berikutnya dari PC tersebut langsung ditolak 401.`
          : `Akses "${cred.name}" diaktifkan kembali.`,
        isSuccess: nextStatus === 'active'
      });
    } catch (err) {
      setFeedback({ message: err.message, isSuccess: false });
    }
  }

  async function handleConfirmAccept() {
    const { mode, cred } = confirmModal;
    if (!cred) return;
    setConfirmModal(prev => ({ ...prev, busy: true }));
    try {
      if (mode === 'rotate') {
        const res = await fetch(`/api/v2/operator-credentials/${encodeURIComponent(cred.id)}/rotate`, {
          method: 'POST'
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memutar token.');
        setConfirmModal({ open: false, mode: null, cred: null, busy: false });
        await loadData();
        setConfigModal({ open: true, cred: data.credential, plainToken: data.token });
        setFeedback({
          message: `Token baru untuk "${cred.name}" berhasil dibuat. Token lama sudah hangus.`,
          isSuccess: true
        });
      } else if (mode === 'delete') {
        const res = await fetch(`/api/v2/operator-credentials/${encodeURIComponent(cred.id)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menghapus kredensial.');
        setConfirmModal({ open: false, mode: null, cred: null, busy: false });
        await loadData();
        setFeedback({ message: `Kredensial "${cred.name}" telah dihapus permanen.`, isSuccess: false });
      }
    } catch (err) {
      setConfirmModal({ open: false, mode: null, cred: null, busy: false });
      setFeedback({ message: err.message, isSuccess: false });
    }
  }

  const mcpConfigJsonText = useMemo(() => {
    const tokenPlaceholder = configModal.plainToken || 'cfop_SAMPLE_TOKEN_PLACEHOLDER_GANTI_DENGAN_TOKEN_ANDA';
    if (configClientMode === 'http') {
      return JSON.stringify({
        mcpServers: {
          'cf-studio': {
            url: configHostUrl,
            headers: {
              Authorization: `Bearer ${tokenPlaceholder}`
            }
          }
        }
      }, null, 2);
    }
    const baseApiUrl = configHostUrl.replace(/\/mcp$/, '').replace(':7030', ':5010');
    return JSON.stringify({
      mcpServers: {
        'cf-studio': {
          command: 'npx',
          args: ['-y', '@cf-studio/mcp', '--stdio'],
          env: {
            CF_STUDIO_OPERATOR_BASE_URL: baseApiUrl,
            CF_STUDIO_OPERATOR_API_TOKEN: tokenPlaceholder
          }
        }
      }
    }, null, 2);
  }, [configClientMode, configHostUrl, configModal.plainToken]);

  function copyToClipboard(text, message) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setFeedback({ message, isSuccess: true });
  }

  const isFormMaster = formState.scopes.includes('tenant:superadmin');

  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content page-content-responsive">
        <style jsx>{`
          .mcp-shell {
            max-width: 1220px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .mcp-header {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            background: var(--surface);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            padding: 22px 24px;
            box-shadow: var(--shadow-card);
          }
          .mcp-header h1 {
            margin: 0;
            font-size: clamp(1.3rem, 2.5vw, 1.7rem);
            color: var(--text-primary);
          }
          .mcp-header p {
            margin: 6px 0 0;
            color: var(--text-secondary);
            font-size: 0.92rem;
            max-width: 70ch;
          }
          .mcp-overview {
            display: grid;
            grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
            gap: 16px;
          }
          .mcp-endpoint-box {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: var(--input-bg);
            border: 1px solid var(--border-strong);
            border-radius: var(--radius-sm);
            padding: 10px 12px;
          }
          .mcp-code-inline {
            font-family: var(--font-mono);
            font-size: 0.84rem;
            color: var(--text-primary);
            word-break: break-all;
          }
          .mcp-counts {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-top: 8px;
          }
          .mcp-count-cell {
            background: var(--surface-raised);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            padding: 12px;
          }
          .mcp-filter-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
            margin-bottom: 16px;
          }
          .mcp-table-wrap {
            width: 100%;
            overflow-x: auto;
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
          }
          .mcp-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 780px;
          }
          .mcp-table thead {
            background: var(--surface-raised);
          }
          .mcp-table th {
            text-align: left;
            padding: 12px 14px;
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-subtle);
          }
          .mcp-table td {
            padding: 14px;
            vertical-align: top;
            border-bottom: 1px solid var(--border-subtle);
            font-size: 0.86rem;
          }
          .mcp-table tbody tr:last-child td {
            border-bottom: none;
          }
          .mcp-mobile-cards {
            display: none;
            flex-direction: column;
            gap: 12px;
          }
          .mcp-mobile-card {
            background: var(--surface-raised);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .mcp-badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .mcp-badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 9px;
            border-radius: var(--radius-xs);
            font-size: 0.76rem;
            font-weight: 600;
            border: 1px solid transparent;
          }
          .mcp-checkbox-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 8px;
          }
          .mcp-check-card {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 12px;
            background: var(--surface-raised);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
            font-size: 0.84rem;
            cursor: pointer;
          }
          .mcp-form-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
          @media (max-width: 860px) {
            .mcp-overview {
              grid-template-columns: 1fr;
            }
            .mcp-table-wrap {
              display: none;
            }
            .mcp-mobile-cards {
              display: flex;
            }
          }
          @media (max-width: 640px) {
            .mcp-form-grid-2 {
              grid-template-columns: 1fr;
            }
            .mcp-counts {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <div className="mcp-shell">
          {feedback.message && (
            <div
              role="status"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${feedback.isSuccess ? 'var(--status-success)' : 'var(--status-info)'}`,
                background: feedback.isSuccess ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                color: feedback.isSuccess ? 'var(--status-success)' : 'var(--status-info)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              <span>{feedback.message}</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: 36, padding: '4px 12px', cursor: 'pointer' }}
                onClick={() => setFeedback({ message: '', isSuccess: false })}
              >
                Tutup
              </button>
            </div>
          )}

          <header className="mcp-header">
            <div>
              <h1>Akses MCP &amp; Operator Multi-PC</h1>
              <p>
                Kelola token per PC atau per operator dengan batas tenant yang dapat diubah kapan saja tanpa mengedit konfigurasi di PC klien. Khusus Superadmin.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 44, cursor: 'pointer' }}
              onClick={openCreateModal}
            >
              + Buat Kredensial PC Baru
            </button>
          </header>

          <section className="mcp-overview" aria-label="Informasi endpoint Remote MCP dan ringkasan kredensial">
            <div className="card">
              <h2 style={{ margin: '0 0 6px', fontSize: '1rem' }}>Endpoint Remote MCP (Streamable HTTP)</h2>
              <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                PC klien cukup menempel konfigurasi JSON dengan header Authorization Bearer. Mode remote otomatis memblokir pembacaan file_path lokal server.
              </p>
              <div className="mcp-endpoint-box">
                <code className="mcp-code-inline">{remoteHosts[0].value}</code>
                <button
                  type="button"
                  className="btn"
                  style={{
                    minHeight: 38,
                    padding: '6px 12px',
                    background: 'var(--status-info-soft)',
                    borderColor: 'var(--status-info)',
                    color: 'var(--status-info)',
                    cursor: 'pointer'
                  }}
                  onClick={() => copyToClipboard(remoteHosts[0].value, `URL endpoint MCP disalin: ${remoteHosts[0].value}`)}
                >
                  Salin URL MCP
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Perubahan allowlist tenant, scope, dan revoke langsung berlaku pada request berikutnya.
              </div>
            </div>

            <div className="card">
              <h2 style={{ margin: '0 0 6px', fontSize: '1rem' }}>Ringkasan Kredensial</h2>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total token operator yang terdaftar di cluster.
              </p>
              <div className="mcp-counts">
                <div className="mcp-count-cell">
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{stats.total}</div>
                </div>
                <div className="mcp-count-cell">
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aktif</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>{stats.active}</div>
                </div>
                <div className="mcp-count-cell">
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Nonaktif</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{stats.inactive}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-label="Daftar kredensial operator">
            <div className="mcp-filter-bar">
              <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="mcp-search-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Cari PC, Operator, atau Tenant
                </label>
                <input
                  id="mcp-search-input"
                  type="search"
                  className="form-input"
                  style={{ minHeight: 44 }}
                  placeholder="Ketik nama PC, ID kredensial, atau slug tenant..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ minWidth: 190, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="mcp-status-filter" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Filter Status
                </label>
                <select
                  id="mcp-status-filter"
                  className="form-select"
                  style={{ minHeight: 44 }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="revoked">Dicabut (Revoked)</option>
                  <option value="expired">Kedaluwarsa</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div
                role="status"
                style={{
                  padding: '32px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-strong)',
                  background: 'var(--surface-raised)',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ margin: '0 0 8px' }}>Memuat daftar kredensial operator...</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Mengambil daftar tenant allowlist dan hak akses dari database PostgreSQL.
                </p>
              </div>
            ) : loadError ? (
              <div
                role="alert"
                style={{
                  padding: '32px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--status-danger)',
                  background: 'var(--status-danger-soft)',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ margin: '0 0 8px', color: 'var(--status-danger)' }}>Gagal memuat kredensial operator</h3>
                <p style={{ margin: '0 auto 16px', maxWidth: '54ch', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  {loadError}
                </p>
                <button type="button" className="btn btn-primary" style={{ minHeight: 44, cursor: 'pointer' }} onClick={loadData}>
                  Coba Muat Ulang
                </button>
              </div>
            ) : credentials.length === 0 ? (
              <div
                style={{
                  padding: '32px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-strong)',
                  background: 'var(--surface-raised)',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ margin: '0 0 8px' }}>Belum ada kredensial MCP operator terdaftar</h3>
                <p style={{ margin: '0 auto 16px', maxWidth: '54ch', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Buat token per PC untuk membagikan akses CF Studio MCP ke tim dengan batas tenant dan scope terkontrol.
                </p>
                <button type="button" className="btn btn-primary" style={{ minHeight: 44, cursor: 'pointer' }} onClick={openCreateModal}>
                  + Buat Kredensial PC Pertama
                </button>
              </div>
            ) : filteredCredentials.length === 0 ? (
              <div
                style={{
                  padding: '32px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-strong)',
                  background: 'var(--surface-raised)',
                  textAlign: 'center'
                }}
              >
                <h3 style={{ margin: '0 0 8px' }}>Tidak ada kredensial yang cocok dengan filter</h3>
                <p style={{ margin: '0 auto 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Ubah kata kunci pencarian atau setel ulang filter status ke Semua Status.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                >
                  Setel Ulang Filter
                </button>
              </div>
            ) : (
              <>
                <div className="mcp-table-wrap">
                  <table className="mcp-table">
                    <thead>
                      <tr>
                        <th>PC / Operator</th>
                        <th>Tenant Diizinkan</th>
                        <th>Profil &amp; Scope</th>
                        <th>Status</th>
                        <th>Terakhir Dipakai</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCredentials.map(cred => {
                        const eff = effectiveStatus(cred);
                        const isMaster = cred.is_master || cred.scopes.includes('tenant:superadmin');
                        const statusStyle = eff === 'active'
                          ? { bg: 'var(--status-success-soft)', bd: 'var(--status-success)', fg: 'var(--status-success)', text: 'Aktif' }
                          : eff === 'expired'
                            ? { bg: 'var(--status-warning-soft)', bd: 'var(--status-warning)', fg: 'var(--status-warning)', text: 'Kedaluwarsa' }
                            : { bg: 'var(--status-danger-soft)', bd: 'var(--status-danger)', fg: 'var(--status-danger)', text: 'Dicabut' };

                        return (
                          <tr key={cred.id}>
                            <td>
                              <strong style={{ display: 'block' }}>{cred.name}</strong>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {cred.id}
                              </span>
                              {cred.notes && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{cred.notes}</div>
                              )}
                            </td>
                            <td>
                              <div className="mcp-badge-row">
                                {isMaster ? (
                                  <span
                                    className="mcp-badge"
                                    style={{ background: 'var(--status-neutral-soft)', borderColor: 'var(--status-neutral)', color: 'var(--status-neutral)' }}
                                  >
                                    Semua Tenant (Master)
                                  </span>
                                ) : (
                                  <>
                                    <span
                                      className="mcp-badge"
                                      style={{ background: 'var(--status-info-soft)', borderColor: 'var(--status-info)', color: 'var(--status-info)' }}
                                    >
                                      Default: {tenantLabel(cred.tenant_id)}
                                    </span>
                                    {(cred.allowed_tenant_ids || []).filter(id => id !== cred.tenant_id).map(id => (
                                      <span
                                        key={id}
                                        className="mcp-badge"
                                        style={{ background: 'var(--surface-interactive)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
                                      >
                                        + {tenantLabel(id)}
                                      </span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <strong>{detectPresetLabel(cred.scopes)}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                {cred.scopes.join(', ')}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                {Array.isArray(cred.allowed_tools)
                                  ? `Batas tool: ${cred.allowed_tools.length} tool`
                                  : 'Tool: semua tool sesuai scope'}
                              </div>
                            </td>
                            <td>
                              <span
                                className="mcp-badge"
                                style={{ background: statusStyle.bg, borderColor: statusStyle.bd, color: statusStyle.fg }}
                              >
                                {statusStyle.text}
                              </span>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                {cred.expires_at ? `Berlaku s.d. ${formatDateTime(cred.expires_at)}` : 'Tanpa kedaluwarsa'}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {formatDateTime(cred.last_used_at)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ minHeight: 38, padding: '6px 10px', fontSize: '0.78rem', background: 'var(--status-info-soft)', borderColor: 'var(--status-info)', color: 'var(--status-info)', cursor: 'pointer' }}
                                  onClick={() => openEditModal(cred)}
                                >
                                  Edit Akses
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ minHeight: 38, padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}
                                  onClick={() => setConfigModal({ open: true, cred, plainToken: null })}
                                >
                                  Salin Config
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ minHeight: 38, padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}
                                  onClick={() => setConfirmModal({ open: true, mode: 'rotate', cred, busy: false })}
                                >
                                  Putar Token
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{
                                    minHeight: 38,
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    background: cred.status === 'active' ? 'var(--status-warning-soft)' : 'var(--status-success-soft)',
                                    borderColor: cred.status === 'active' ? 'var(--status-warning)' : 'var(--status-success)',
                                    color: cred.status === 'active' ? 'var(--status-warning)' : 'var(--status-success)'
                                  }}
                                  onClick={() => handleToggleStatus(cred)}
                                >
                                  {cred.status === 'active' ? 'Revoke' : 'Aktifkan'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ minHeight: 38, padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}
                                  onClick={() => setConfirmModal({ open: true, mode: 'delete', cred, busy: false })}
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mcp-mobile-cards">
                  {filteredCredentials.map(cred => {
                    const eff = effectiveStatus(cred);
                    const isMaster = cred.is_master || cred.scopes.includes('tenant:superadmin');
                    const statusStyle = eff === 'active'
                      ? { bg: 'var(--status-success-soft)', bd: 'var(--status-success)', fg: 'var(--status-success)', text: 'Aktif' }
                      : eff === 'expired'
                        ? { bg: 'var(--status-warning-soft)', bd: 'var(--status-warning)', fg: 'var(--status-warning)', text: 'Kedaluwarsa' }
                        : { bg: 'var(--status-danger-soft)', bd: 'var(--status-danger)', fg: 'var(--status-danger)', text: 'Dicabut' };

                    return (
                      <article key={cred.id} className="mcp-mobile-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <strong style={{ display: 'block' }}>{cred.name}</strong>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {cred.id}
                            </span>
                          </div>
                          <span className="mcp-badge" style={{ background: statusStyle.bg, borderColor: statusStyle.bd, color: statusStyle.fg }}>
                            {statusStyle.text}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong>Tenant:</strong>
                          <div className="mcp-badge-row" style={{ marginTop: 4 }}>
                            {isMaster ? (
                              <span className="mcp-badge" style={{ background: 'var(--status-neutral-soft)', borderColor: 'var(--status-neutral)', color: 'var(--status-neutral)' }}>
                                Semua Tenant (Master)
                              </span>
                            ) : (
                              <>
                                <span className="mcp-badge" style={{ background: 'var(--status-info-soft)', borderColor: 'var(--status-info)', color: 'var(--status-info)' }}>
                                  Default: {tenantLabel(cred.tenant_id)}
                                </span>
                                {(cred.allowed_tenant_ids || []).filter(id => id !== cred.tenant_id).map(id => (
                                  <span key={id} className="mcp-badge" style={{ background: 'var(--surface-interactive)', borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}>
                                    + {tenantLabel(id)}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong>Privilege:</strong> {detectPresetLabel(cred.scopes)} ({cred.scopes.join(', ')})
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Terakhir dipakai: {formatDateTime(cred.last_used_at)}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => openEditModal(cred)}>
                            Edit Akses
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setConfigModal({ open: true, cred, plainToken: null })}>
                            Salin Config
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setConfirmModal({ open: true, mode: 'rotate', cred, busy: false })}>
                            Putar Token
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => handleToggleStatus(cred)}>
                            {cred.status === 'active' ? 'Revoke' : 'Aktifkan'}
                          </button>
                          <button type="button" className="btn btn-danger" style={{ minHeight: 40, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setConfirmModal({ open: true, mode: 'delete', cred, busy: false })}>
                            Hapus
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        {/* Modal Tambah / Edit Kredensial */}
        {formOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cred-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-backdrop)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 1000
            }}
            onClick={e => { if (e.target === e.currentTarget) setFormOpen(false); }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 740,
                maxHeight: '92dvh',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-modal)'
              }}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 id="cred-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  {editingCred ? `Edit Akses: ${editingCred.name}` : 'Buat Kredensial PC Baru'}
                </h2>
                <button type="button" className="btn btn-secondary" style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }} aria-label="Tutup modal" onClick={() => setFormOpen(false)}>
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <form id="mcp-cred-form" onSubmit={handleFormSubmit} style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {formError && (
                  <div role="alert" style={{ color: 'var(--status-danger)', fontWeight: 600, fontSize: '0.86rem' }}>
                    {formError}
                  </div>
                )}

                <div className="mcp-form-grid-2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cred-name-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Nama PC / Operator
                    </label>
                    <input
                      id="cred-name-input"
                      type="text"
                      className="form-input"
                      style={{ minHeight: 44 }}
                      placeholder="Mis. PC Editor Tim Konten B"
                      value={formState.name}
                      onChange={e => setFormState(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cred-default-tenant" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Default Tenant
                    </label>
                    <select
                      id="cred-default-tenant"
                      className="form-select"
                      style={{ minHeight: 44 }}
                      value={formState.tenant_id}
                      onChange={e => setFormState(prev => ({ ...prev, tenant_id: e.target.value }))}
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mcp-form-grid-2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cred-expires-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Masa Berlaku (Opsional)
                    </label>
                    <input
                      id="cred-expires-input"
                      type="datetime-local"
                      className="form-input"
                      style={{ minHeight: 44 }}
                      value={formState.expires_at}
                      onChange={e => setFormState(prev => ({ ...prev, expires_at: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cred-status-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Status Kredensial
                    </label>
                    <select
                      id="cred-status-select"
                      className="form-select"
                      style={{ minHeight: 44 }}
                      value={formState.status}
                      onChange={e => setFormState(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="active">Aktif</option>
                      <option value="revoked">Dicabut (Revoked)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Profil Privilege Cepat (Preset Scope)
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {presets.map(preset => {
                      const selected = [...preset.scopes].sort().join(',') === [...formState.scopes].sort().join(',');
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className="btn"
                          title={preset.description}
                          style={{
                            minHeight: 40,
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            background: selected ? 'var(--status-info-soft)' : 'var(--surface-raised)',
                            borderColor: selected ? 'var(--status-info)' : 'var(--border-strong)',
                            color: selected ? 'var(--status-info)' : 'var(--text-primary)'
                          }}
                          onClick={() => applyPreset(preset)}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Tenant Tambahan yang Diizinkan (Allowlist)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: 36, padding: '4px 10px', fontSize: '0.76rem', cursor: 'pointer' }}
                        disabled={isFormMaster}
                        onClick={() => setFormState(prev => ({ ...prev, allowed_tenant_ids: tenants.map(t => t.id) }))}
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: 36, padding: '4px 10px', fontSize: '0.76rem', cursor: 'pointer' }}
                        disabled={isFormMaster}
                        onClick={() => setFormState(prev => ({ ...prev, allowed_tenant_ids: [] }))}
                      >
                        Hanya Default
                      </button>
                    </div>
                  </div>
                  {isFormMaster && (
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Mode Master Superadmin aktif: kredensial otomatis memiliki akses ke seluruh tenant aktif.
                    </p>
                  )}
                  <div className="mcp-checkbox-grid">
                    {tenants.map(t => {
                      const checked = formState.allowed_tenant_ids.includes(t.id) || formState.tenant_id === t.id;
                      return (
                        <label key={t.id} htmlFor={`tnt_${t.id}`} className="mcp-check-card">
                          <input
                            id={`tnt_${t.id}`}
                            type="checkbox"
                            disabled={isFormMaster || formState.tenant_id === t.id}
                            checked={checked}
                            onChange={() => toggleArrayField('allowed_tenant_ids', t.id)}
                            style={{ width: 18, height: 18, marginTop: 2 }}
                          />
                          <span>
                            <strong>{t.name}</strong>
                            <br />
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t.slug}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Scope Hak Akses
                  </span>
                  <div className="mcp-checkbox-grid">
                    {availableScopes.map(scope => (
                      <label key={scope} htmlFor={`scp_${scope}`} className="mcp-check-card">
                        <input
                          id={`scp_${scope}`}
                          type="checkbox"
                          checked={formState.scopes.includes(scope)}
                          onChange={() => toggleArrayField('scopes', scope)}
                          style={{ width: 18, height: 18, marginTop: 2 }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Pembatasan Tool MCP (Opsional)
                    </span>
                    <label htmlFor="limit-tools-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input
                        id="limit-tools-toggle"
                        type="checkbox"
                        checked={formState.limitTools}
                        onChange={e => setFormState(prev => ({ ...prev, limitTools: e.target.checked }))}
                      />
                      Batasi ke daftar tool tertentu
                    </label>
                  </div>
                  {formState.limitTools && (
                    <div className="mcp-checkbox-grid">
                      {sampleTools.map(tool => (
                        <label key={tool} htmlFor={`tool_${tool}`} className="mcp-check-card">
                          <input
                            id={`tool_${tool}`}
                            type="checkbox"
                            checked={formState.allowed_tools.includes(tool)}
                            onChange={() => toggleArrayField('allowed_tools', tool)}
                            style={{ width: 18, height: 18, marginTop: 2 }}
                          />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>{tool}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="cred-notes-input" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Catatan Internal (Opsional)
                  </label>
                  <textarea
                    id="cred-notes-input"
                    className="form-textarea"
                    rows={2}
                    placeholder="Contoh: Laptop editor untuk produksi konten harian NutriBake & DapurBotani."
                    value={formState.notes}
                    onChange={e => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </form>

              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => setFormOpen(false)}>
                  Batal
                </button>
                <button type="submit" form="mcp-cred-form" disabled={saving} className="btn btn-primary" style={{ minHeight: 44, cursor: 'pointer' }}>
                  {saving ? 'Menyimpan...' : (editingCred ? 'Simpan Perubahan Real-Time' : 'Buat Token & Simpan')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Token Sekali Tampil & Config MCP */}
        {configModal.open && configModal.cred && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-backdrop)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 1000
            }}
            onClick={e => { if (e.target === e.currentTarget) setConfigModal({ open: false, cred: null, plainToken: null }); }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 720,
                maxHeight: '92dvh',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-modal)'
              }}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 id="config-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  Konfigurasi MCP: {configModal.cred.name}
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }}
                  aria-label="Tutup modal konfigurasi"
                  onClick={() => setConfigModal({ open: false, cred: null, plainToken: null })}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {configModal.plainToken && (
                  <div>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--status-warning)',
                        background: 'var(--status-warning-soft)',
                        color: 'var(--status-warning)',
                        fontSize: '0.84rem',
                        fontWeight: 600
                      }}
                    >
                      Token baru ini hanya ditampilkan 1 kali. Salin sekarang sebelum menutup jendela ini; server hanya menyimpan hash SHA-256.
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Token Operator (Sekali Tampil)
                      </span>
                      <div className="mcp-endpoint-box">
                        <code className="mcp-code-inline">{configModal.plainToken}</code>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }}
                          onClick={() => copyToClipboard(configModal.plainToken, 'Token operator disalin ke clipboard.')}
                        >
                          Salin Token
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mcp-form-grid-2">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cfg-mode-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Mode Koneksi Klien
                    </label>
                    <select
                      id="cfg-mode-select"
                      className="form-select"
                      style={{ minHeight: 44 }}
                      value={configClientMode}
                      onChange={e => setConfigClientMode(e.target.value)}
                    >
                      <option value="http">Remote Streamable HTTP (Direkomendasikan)</option>
                      <option value="stdio">Alternatif CLI (stdio)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label htmlFor="cfg-host-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Alamat Server MCP
                    </label>
                    <select
                      id="cfg-host-select"
                      className="form-select"
                      style={{ minHeight: 44 }}
                      value={configHostUrl}
                      onChange={e => setConfigHostUrl(e.target.value)}
                    >
                      {remoteHosts.map(h => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Snippet JSON Siap Tempel (Antigravity / Cursor / Claude Desktop)
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      padding: 14,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 280,
                      overflowY: 'auto'
                    }}
                  >
                    {mcpConfigJsonText}
                  </pre>
                </div>
              </div>

              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={() => copyToClipboard(mcpConfigJsonText, 'Snippet JSON MCP berhasil disalin ke clipboard.')}
                >
                  Salin JSON Config
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={() => setConfigModal({ open: false, cred: null, plainToken: null })}
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Rotate / Delete */}
        {confirmModal.open && confirmModal.cred && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--overlay-backdrop)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 1000
            }}
            onClick={e => { if (e.target === e.currentTarget && !confirmModal.busy) setConfirmModal({ open: false, mode: null, cred: null, busy: false }); }}
          >
            <div className="card" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h2 id="confirm-modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                  {confirmModal.mode === 'rotate' ? 'Putar Token Operator' : 'Hapus Kredensial Permanen'}
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={confirmModal.busy}
                  style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }}
                  aria-label="Tutup modal konfirmasi"
                  onClick={() => setConfirmModal({ open: false, mode: null, cred: null, busy: false })}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <div style={{ padding: '20px 22px' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {confirmModal.mode === 'rotate'
                    ? `Token lama milik "${confirmModal.cred.name}" akan langsung hangus begitu token baru dibuat. PC klien perlu memperbarui header Authorization.`
                    : `Hapus permanen "${confirmModal.cred.name}" (${confirmModal.cred.id})? Riwayat audit tetap tersimpan, namun token tidak dapat dipulihkan.`}
                </p>
              </div>
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={confirmModal.busy}
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={() => setConfirmModal({ open: false, mode: null, cred: null, busy: false })}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={confirmModal.mode === 'rotate' ? 'btn btn-primary' : 'btn btn-danger'}
                  disabled={confirmModal.busy}
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={handleConfirmAccept}
                >
                  {confirmModal.busy ? 'Memproses...' : (confirmModal.mode === 'rotate' ? 'Putar Token Sekarang' : 'Hapus Permanen')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
