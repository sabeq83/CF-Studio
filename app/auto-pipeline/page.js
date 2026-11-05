'use client';

import Sidebar from '../components/Sidebar';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AutoPipelinePage() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetHint, setPresetHint] = useState('');
  const [topic, setTopic] = useState('air fryer chicken thighs');
  const [recipeCount, setRecipeCount] = useState(7);
  const [executionMode, setExecutionMode] = useState('full_autopilot');

  const [isLaunching, setIsLaunching] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // 1. Fetch Brand Profiles on mount
  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/v2/brand-profiles');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBrands(data.data);
          // Cari habitfolk atau pilih brand pertama
          const defaultBrand = data.data.find(b => b.brand_name.toLowerCase().includes('habit')) || data.data[0];
          setSelectedBrandId(defaultBrand.id);
        } else {
          // Fallback static brands jika DB offline
          const fallbackBrands = [
            { id: 'habitfolk', brand_name: 'HabitFolk' },
            { id: 'dapurbotani', brand_name: 'Dapur Botani' },
            { id: 'nutribake', brand_name: 'NutriBake' }
          ];
          setBrands(fallbackBrands);
          setSelectedBrandId('habitfolk');
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching brands:', e);
      }
    }
    fetchBrands();
    fetchRecentCampaigns();
  }, []);

  // 2. Fetch Presets dynamically when selected brand changes
  useEffect(() => {
    if (!selectedBrandId) return;
    async function fetchPresets() {
      try {
        const res = await fetch(`/api/v2/recipes/autonomous-pipeline?brand=${encodeURIComponent(selectedBrandId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.presets)) {
          setPresets(data.presets);
          const defaultVi = data.default_preset?.visual_identity_preset_id || data.presets[0]?.id || '';
          setSelectedPresetId(defaultVi);

          const currentBrandObj = brands.find(b => b.id === selectedBrandId);
          setPresetHint(`Terfilter khusus brand ${currentBrandObj?.brand_name || selectedBrandId}`);
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching presets:', e);
      }
    }
    fetchPresets();
  }, [selectedBrandId, brands]);

  // 3. Fetch Recent OPC Campaigns
  async function fetchRecentCampaigns() {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/v2/pillar-campaigns');
      const data = await res.json();
      const list = data.campaigns || data.data || [];
      // Filter recipe campaigns atau kampanye dengan prefix opc_
      const recipeOnly = list.filter(c =>
        c.content_pillar === 'Recipe Campaign' ||
        (c.id && c.id.startsWith('opc_')) ||
        (c.campaign_name && c.campaign_name.includes('Recipe'))
      );
      setRecentCampaigns(recipeOnly.slice(0, 10));
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching campaigns:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  // 4. Trigger 1-Click Pipeline
  async function handleLaunchPipeline(e) {
    e.preventDefault();
    if (!topic || !topic.trim()) {
      showToast('Topik resep wajib diisi.', 'error');
      return;
    }

    setIsLaunching(true);
    setActiveStep(1);

    // Step animation interval untuk memberi feedback visual
    let stepCount = 1;
    const animInterval = setInterval(() => {
      stepCount++;
      if (stepCount <= 4) {
        setActiveStep(stepCount);
      }
    }, 700);

    try {
      const res = await fetch('/api/v2/recipes/autonomous-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          topic: topic.trim(),
          recipe_count: Number(recipeCount || 7),
          execution_mode: executionMode,
          visual_identity_preset_id: selectedPresetId,
          auto_sync_contentflow: 1
        })
      });

      clearInterval(animInterval);
      const data = await res.json();

      if (data.success) {
        setActiveStep(6);
        showToast(`Kampanye ${data.campaign_id} berhasil diluncurkan! Auto-approval aktif dan otomatis sinkron ke ContentFlow Hub 🚀`);
        fetchRecentCampaigns();
      } else {
        setActiveStep(0);
        showToast('Gagal meluncurkan pipeline: ' + (data.error || 'Terjadi kesalahan sistem'), 'error');
      }
    } catch (err) {
      clearInterval(animInterval);
      setActiveStep(0);
      showToast('Error request: ' + err.message, 'error');
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar />

      <main className="main-content" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {/* Top Header */}
        <header style={{
          height: 60,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>MAKNA Flow</span>
            <span>/</span>
            <span>Workflow</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>⚡ Auto Pipeline</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--status-success-soft)',
              color: 'var(--status-success)',
              border: '1px solid var(--status-success)'
            }}>
              ● Production Cluster Online
            </span>
          </div>
        </header>

        {/* Content Container (Single-Column) */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>

          {/* Toast Notification */}
          {toast && (
            <div style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: toast.type === 'error' ? 'var(--status-danger-soft)' : 'var(--status-success-soft)',
              color: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
              border: `1px solid ${toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)'}`,
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
              <span>{toast.msg}</span>
            </div>
          )}

          {/* Hero Banner */}
          <section style={{
            background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-raised) 100%)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem 2rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>⚡ Auto Pipeline</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                (1-Click Planner-to-Video Engine)
              </span>
            </h1>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '750px', lineHeight: 1.5 }}>
              Otomatisasi end-to-end produksi konten resep: dari ideasi Gemini AI, auto-hydration profil brand & preset visual dinamis, pembuatan kampanye OPC 8-klip, hingga video final di Nextcloud dan otomatis terdaftar di <strong>ContentFlow Hub</strong> dalam 1 kali klik.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Single-Pass 1-Call AI
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Google Veo Omni Flash (8 Klip @ 4s)
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--border-subtle)', background: 'var(--surface-interactive)', color: 'var(--text-secondary)' }}>
                Minimax Expressive TTS
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999, border: '1px solid var(--status-success)', background: 'var(--status-success-soft)', color: 'var(--status-success)' }}>
                ✓ Auto-Sync ContentFlow Hub
              </span>
            </div>
          </section>

          {/* BARIS 1: Form Konfigurasi 1-Klik */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚙️</span>
              <span>Konfigurasi Auto Pipeline</span>
            </div>

            <form onSubmit={handleLaunchPipeline} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1.25rem'
              }}>
                {/* 1. Brand Profile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Brand Profile</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Persona & Bahasa</span>
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.brand_name} {b.account_handle ? `(@${b.account_handle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Visual Identity Preset Dropdown (Dinamis Berbasis Brand) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Visual Identity Preset</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{presetHint || 'Dinamis per brand'}</span>
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.preset_key || p.id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Target Jumlah Resep */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Target Video Resep</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rekomendasi: 7 video</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={recipeCount}
                    onChange={(e) => setRecipeCount(e.target.value)}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 4. Mode Eksekusi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mode Eksekusi</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Storyboard Approval</span>
                  </label>
                  <select
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value)}
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    <option value="full_autopilot">Full Autopilot (Auto-Approve & Langsung Produksi Video)</option>
                    <option value="manual_review">Manual Review (Jeda di Storyboard Approval)</option>
                  </select>
                </div>

                {/* 5. Topik Resep (Full Width) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Topik / Arahan Resep AI</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ide olahan makanan/minuman yang akan digenerate</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: air fryer salmon bites, garlic parmesan wings, keto smoothie"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                  {/* Quick Topic Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Saran Cepat:</span>
                    {[
                      'air fryer salmon bites',
                      'crispy parmesan zucchini fries',
                      'garlic butter chicken bites',
                      'smoothie alpukat keto'
                    ].map(pill => (
                      <button
                        type="button"
                        key={pill}
                        onClick={() => setTopic(pill)}
                        style={{
                          fontSize: '0.74rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: 9999,
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--link)',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isLaunching}
                  style={{
                    background: isLaunching ? 'var(--surface-interactive)' : 'var(--action-primary)',
                    color: isLaunching ? 'var(--text-muted)' : 'var(--on-action-primary)',
                    border: 'none',
                    padding: '0.85rem 1.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: isLaunching ? 'not-allowed' : 'pointer',
                    boxShadow: isLaunching ? 'none' : '0 4px 14px rgba(45, 212, 191, 0.28)',
                    transition: 'var(--transition)'
                  }}
                >
                  <span>{isLaunching ? '⏳ Memproses Auto Pipeline...' : '⚡ Luncurkan Auto Pipeline (1-Klik)'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* BARIS 2: Live Execution Visualizer */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📡</span>
              <span>Live Execution Visualizer (Alur Otomatis)</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem'
            }}>
              {[
                { step: 1, title: 'Draft Planner', desc: 'Pembuatan container batch' },
                { step: 2, title: 'Gemini 1-Pass', desc: 'Generate ide & naskah resep' },
                { step: 3, title: 'Preset Hydration', desc: 'Injeksi VI preset & persona' },
                { step: 4, title: 'OPC Ingestion', desc: 'Struktur 8 klip @ 4s Omni' },
                { step: 5, title: 'Auto-Approval', desc: 'Persetujuan storyboard otomatis' },
                { step: 6, title: 'Video, Cloud & Hub', desc: 'Nextcloud Upload & Sync Hub' }
              ].map(s => {
                const isPassed = activeStep > s.step;
                const isCurrent = activeStep === s.step;
                return (
                  <div
                    key={s.step}
                    style={{
                      background: isCurrent ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                      border: `1px solid ${isPassed ? 'var(--status-success)' : (isCurrent ? 'var(--action-primary)' : 'var(--border-subtle)')}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 0.8rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'var(--transition)',
                      boxShadow: isCurrent ? '0 0 16px rgba(45, 212, 191, 0.15)' : 'none'
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isPassed ? 'var(--status-success)' : (isCurrent ? 'var(--action-primary)' : 'var(--surface-interactive)'),
                      color: (isPassed || isCurrent) ? '#042f2e' : 'var(--text-muted)',
                      border: `1px solid ${isPassed ? 'var(--status-success)' : (isCurrent ? 'var(--action-primary)' : 'var(--border-strong)')}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.74rem',
                      fontWeight: 700
                    }}>
                      {isPassed ? '✓' : s.step}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {s.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* BARIS 3: Riwayat Batch Kampanye Auto Pipeline */}
          <section style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span>
                <span>Riwayat Batch Kampanye Auto Pipeline</span>
              </div>
              <button
                type="button"
                onClick={fetchRecentCampaigns}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Campaign ID</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Brand & Judul Batch</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>VI Preset Terpilih</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Format Klip</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Status Produksi</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>Aksi & Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCampaigns ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Memuat riwayat batch kampanye...
                      </td>
                    </tr>
                  ) : recentCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Belum ada kampanye batch resep. Masukkan topik di atas dan luncurkan sekarang!
                      </td>
                    </tr>
                  ) : (
                    recentCampaigns.map(camp => (
                      <tr key={camp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{camp.id}</strong>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600 }}>{camp.campaign_name || camp.name || 'Recipe Batch'}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {camp.brand_name || camp.account_name || 'Brand Profile'} • {camp.total_items || 0} Video Items
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {camp.visual_identity_preset_id || 'vi_habitfolk_macro_craft'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem' }}>
                          {camp.target_clips_count || 8} Klip @ {camp.clip_duration || 4}s ({camp.video_model || 'omni_flash'})
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-xs)',
                            background: camp.status === 'completed' ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                            color: camp.status === 'completed' ? 'var(--status-success)' : 'var(--status-warning)',
                            border: `1px solid ${camp.status === 'completed' ? 'var(--status-success)' : 'var(--status-warning)'}`
                          }}>
                            ● {camp.status === 'completed' ? 'Selesai & Nextcloud Ready' : (camp.status || 'running')}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <Link
                              href={`/pillar-campaigns`}
                              style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                            >
                              Detail OPC ↗
                            </Link>
                            <Link
                              href={`/content-flow`}
                              style={{ color: 'var(--status-success)', textDecoration: 'none', fontWeight: 600, fontSize: '0.76rem' }}
                            >
                              📊 ContentFlow Hub ↗
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

