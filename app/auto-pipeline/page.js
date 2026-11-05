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
  const [category, setCategory] = useState('makanan_utama');
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(false);
  const [recipeCount, setRecipeCount] = useState(1);
  const [executionMode, setExecutionMode] = useState('full_autopilot');
  const [enableMotionText, setEnableMotionText] = useState(true);
  const [motionTextStyle, setMotionTextStyle] = useState('floating_white_yellow');
  const [motionTextPosition, setMotionTextPosition] = useState('bottom');
  const [videoTransition, setVideoTransition] = useState('fade');
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [demoWordIndex, setDemoWordIndex] = useState(0);

  // Demo loop untuk simulasi preview animasi motion text kata per kata
  useEffect(() => {
    const t = setInterval(() => {
      setDemoWordIndex(prev => (prev + 1) % 5);
    }, 600);
    return () => clearInterval(t);
  }, []);

  // Smart Auto-Detection dari kata kunci topik
  function detectCategoryFromTopic(text) {
    if (!text || !text.trim()) return 'makanan_utama';
    const t = text.toLowerCase();

    // 1. Minuman (Beverages)
    const beverageKeywords = [
      'kopi', 'coffee', 'latte', 'cappuccino', 'tea', 'teh', 'matcha',
      'smoothie', 'juice', 'jus', 'boba', 'drink', 'mojito', 'mocktail',
      'shake', 'milkshake', 'espresso', 'brew', 'soda', 'cocktail', 'infusion'
    ];
    if (beverageKeywords.some(k => t.includes(k))) return 'minuman';

    // 2. Dessert / Baking
    const dessertKeywords = [
      'cake', 'kue', 'cookie', 'cookies', 'baking', 'brownie', 'pancake',
      'waffle', 'donut', 'donat', 'muffin', 'pudding', 'puding', 'pie',
      'pastry', 'croissant', 'tart', 'cheesecake', 'cupcake', 'ice cream',
      'es krim', 'dessert', 'bolu', 'churro', 'lava cake'
    ];
    if (dessertKeywords.some(k => t.includes(k))) return 'dessert';

    // 3. Camilan / Side Dish
    const snackKeywords = [
      'fries', 'kentang goreng', 'chips', 'snack', 'camilan', 'nugget',
      'finger food', 'popcorn', 'bites', 'zucchini fries', 'dimsum',
      'siomay', 'risol', 'spring roll', 'lumpia', 'tahu crispy', 'tempe mendoan',
      'wings', 'onion rings', 'edamame', 'crispy'
    ];
    if (snackKeywords.some(k => t.includes(k))) return 'camilan';

    // 4. Makanan Utama (Main Course) & Default
    return 'makanan_utama';
  }

  function handleTopicChange(newTopic) {
    setTopic(newTopic);
    if (!isCategoryManuallySelected) {
      setCategory(detectCategoryFromTopic(newTopic));
    }
  }

  function handleCategorySelect(catKey) {
    setCategory(catKey);
    setIsCategoryManuallySelected(true);
  }

  function resetCategoryToAuto() {
    setIsCategoryManuallySelected(false);
    setCategory(detectCategoryFromTopic(topic));
  }

  const [isLaunching, setIsLaunching] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [toast, setToast] = useState(null);

  // Factual Visualizer State
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [activeCampaignData, setActiveCampaignData] = useState(null);
  const [pipelineStages, setPipelineStages] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // Factual Pipeline Status Poller
  async function fetchFactualStatus(targetCampaignId) {
    try {
      const url = targetCampaignId
        ? `/api/v2/recipes/autonomous-pipeline/status?campaign_id=${encodeURIComponent(targetCampaignId)}`
        : '/api/v2/recipes/autonomous-pipeline/status';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.stages) {
        setPipelineStages(data.stages);
        setTelemetry(data.telemetry);
        setActiveCampaignData(data.campaign);
        if (data.campaign?.id) setActiveCampaignId(data.campaign.id);
        return data.is_completed;
      }
    } catch (e) {
      console.warn('[AutoPipeline] Error fetching factual status:', e);
    }
    return false;
  }

  // Polling loop
  useEffect(() => {
    fetchFactualStatus();
  }, []);

  useEffect(() => {
    let timer = null;
    if (activeCampaignId && pollingActive) {
      timer = setInterval(async () => {
        const isCompleted = await fetchFactualStatus(activeCampaignId);
        if (isCompleted) {
          setPollingActive(false);
          fetchRecentCampaigns();
          showToast('Produksi resep selesai! Video final siap di Nextcloud dan ContentFlow Hub 🚀');
        }
      }, 2500);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [activeCampaignId, pollingActive]);

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

    try {
      const res = await fetch('/api/v2/recipes/autonomous-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          topic: topic.trim(),
          category: category || 'makanan_utama',
          recipe_count: Number(recipeCount || 7),
          execution_mode: executionMode,
          visual_identity_preset_id: selectedPresetId,
          enable_motion_text: enableMotionText,
          motion_text_style: enableMotionText ? motionTextStyle : null,
          motion_text_position: enableMotionText ? motionTextPosition : null,
          video_transition: videoTransition || 'fade',
          transition_duration: Number(transitionDuration || 0.5),
          auto_sync_contentflow: 1
        })
      });

      const data = await res.json();

      if (data.success) {
        setActiveCampaignId(data.campaign_id);
        setPollingActive(true);
        fetchFactualStatus(data.campaign_id);
        showToast(`Kampanye ${data.campaign_id} berhasil diluncurkan! Melacak progres produksi faktual... 🚀`);
        fetchRecentCampaigns();
      } else {
        showToast('Gagal meluncurkan pipeline: ' + (data.error || 'Terjadi kesalahan sistem'), 'error');
      }
    } catch (err) {
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    height: '22px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    Brand Profile
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center'
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    height: '22px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    Visual Identity Preset
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center'
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    height: '22px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    Target Video Resep
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={recipeCount}
                    onChange={(e) => setRecipeCount(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  />
                </div>

                {/* 4. Mode Eksekusi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    height: '22px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    Mode Eksekusi
                  </label>
                  <select
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <option value="full_autopilot">Full Autopilot (Auto-Approve & Langsung Produksi Video)</option>
                    <option value="manual_review">Manual Review (Jeda di Storyboard Approval)</option>
                  </select>
                </div>

                {/* 5. Kategori Resep Kuliner (Usulan 1 - Category Selector UI) */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <span>🍽️</span>
                      <span>Kategori Resep Kuliner</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        (Menentukan jenis olahan & instruksi AI)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.65rem',
                        borderRadius: 9999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: isCategoryManuallySelected ? 'var(--status-warning-soft)' : 'var(--status-info-soft)',
                        color: isCategoryManuallySelected ? 'var(--status-warning)' : 'var(--status-info)',
                        border: `1px solid ${isCategoryManuallySelected ? 'var(--status-warning)' : 'var(--status-info)'}`
                      }}>
                        <span>{isCategoryManuallySelected ? '✏️ Pilihan Manual' : '✨ Auto-Terdeteksi dari Topik'}</span>
                      </span>

                      {isCategoryManuallySelected && (
                        <button
                          type="button"
                          onClick={resetCategoryToAuto}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--link)',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0
                          }}
                        >
                          Reset ke Otomatis
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem'
                  }}>
                    {[
                      {
                        key: 'makanan_utama',
                        icon: '🍗',
                        name: 'Makanan Utama',
                        desc: 'Main course, ayam, daging, ikan, pasta, rice bowl'
                      },
                      {
                        key: 'camilan',
                        icon: '🍟',
                        name: 'Camilan / Side Dish',
                        desc: 'Snacks, fries, finger food, crispy bites, gorengan'
                      },
                      {
                        key: 'dessert',
                        icon: '🍰',
                        name: 'Baking / Dessert',
                        desc: 'Cake, cookies, pastry, waffle, puding, sweets'
                      },
                      {
                        key: 'minuman',
                        icon: '🥤',
                        name: 'Minuman',
                        desc: 'Coffee, latte, matcha, smoothie, tea, mocktail'
                      }
                    ].map(cat => {
                      const isSelected = category === cat.key;
                      return (
                        <button
                          type="button"
                          key={cat.key}
                          onClick={() => handleCategorySelect(cat.key)}
                          style={{
                            background: isSelected ? 'var(--surface-interactive)' : 'var(--input-bg)',
                            border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '0.9rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isSelected ? '0 0 0 1px var(--action-primary), 0 4px 14px rgba(45, 212, 191, 0.16)' : 'none',
                            transition: 'var(--transition)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{cat.icon}</span>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: isSelected ? 'var(--action-primary)' : 'var(--border-subtle)',
                              color: isSelected ? 'var(--on-action-primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 900
                            }}>
                              ✓
                            </div>
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                            {cat.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            {cat.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Topik Resep (Full Width) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Topik / Arahan Resep AI</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ide olahan makanan/minuman yang akan digenerate</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => handleTopicChange(e.target.value)}
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
                        onClick={() => handleTopicChange(pill)}
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

                {/* 7. Finishing Video & Pascaproduksi FFmpeg (Motion Text + Transisi Antar Klip) */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'var(--surface-raised)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  transition: 'var(--transition)'
                }}>
                  {/* Master Section Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.35rem' }}>🎬</span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          Finishing Video & Pascaproduksi FFmpeg
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: 'var(--status-success-soft)',
                            color: 'var(--status-success)',
                            border: '1px solid var(--status-success)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 9999
                          }}>
                            ⚡ 0 Biaya AI Credit
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Atur gaya teks dinamis dan efek transisi antar sambungan klip video secara otomatis.
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>⚙️</span>
                      <span>Diterapkan saat proses rendering stitching MP4</span>
                    </div>
                  </div>

                  {/* 2-Column Responsive Finishing Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'stretch'
                  }}>

                    {/* KOLOM KIRI: Motion Text & Subtitel Video */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      {/* Sub-header Kolom Kiri */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        paddingBottom: '0.65rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>✨</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            1. Subtitel / Motion Text
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 9999,
                            background: enableMotionText ? 'var(--status-success-soft)' : 'var(--surface-interactive)',
                            color: enableMotionText ? 'var(--status-success)' : 'var(--text-muted)',
                            border: `1px solid ${enableMotionText ? 'var(--status-success)' : 'var(--border-strong)'}`
                          }}>
                            {enableMotionText ? '🟢 ON' : '⚪ OFF'}
                          </span>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => setEnableMotionText(!enableMotionText)}
                            style={{
                              width: '42px',
                              height: '22px',
                              borderRadius: '9999px',
                              background: enableMotionText ? 'var(--action-primary)' : 'var(--border-strong)',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: enableMotionText ? 'flex-end' : 'flex-start',
                              transition: 'var(--transition)'
                            }}
                          >
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: enableMotionText ? 'var(--on-action-primary)' : 'var(--text-primary)',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              transition: 'var(--transition)'
                            }} />
                          </button>
                        </div>
                      </div>

                      {enableMotionText ? (
                        <>
                          {/* Pilihan 3 Template */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              PILIH TEMPLATE STYLE:
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              {[
                                {
                                  key: 'floating_white_yellow',
                                  name: '🟡 Floating Putih ➔ Kuning',
                                  badge: 'TikTok / Reels',
                                  badgeBg: 'var(--status-warning-soft)',
                                  badgeColor: 'var(--status-warning)',
                                  desc: 'Kata muncul bertahap, kata aktif menyala kuning terang.'
                                },
                                {
                                  key: 'floating_black_on_white',
                                  name: '🔲 Floating Hitam BG Putih',
                                  badge: 'CapCut Pill',
                                  badgeBg: 'var(--status-info-soft)',
                                  badgeColor: 'var(--status-info)',
                                  desc: 'Teks hitam di atas kapsul pill putih bersih yang melompat ritmis.'
                                },
                                {
                                  key: 'minimal_white',
                                  name: '◻️ Minimalist Clean Card',
                                  badge: 'Super Slim',
                                  badgeBg: 'var(--status-neutral-soft)',
                                  badgeColor: 'var(--status-neutral)',
                                  desc: 'Kartu putih ramping auto-fit (~80px), murni teks naskah.'
                                }
                              ].map(styleItem => {
                                const isSelected = motionTextStyle === styleItem.key;
                                return (
                                  <button
                                    type="button"
                                    key={styleItem.key}
                                    onClick={() => setMotionTextStyle(styleItem.key)}
                                    style={{
                                      background: isSelected ? 'var(--surface-interactive)' : 'var(--input-bg)',
                                      border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                      borderRadius: 'var(--radius-xs)',
                                      padding: '0.65rem 0.8rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.2rem',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      boxShadow: isSelected ? '0 0 0 1px var(--action-primary), 0 2px 8px rgba(45, 212, 191, 0.16)' : 'none',
                                      transition: 'var(--transition)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {styleItem.name}
                                      </span>
                                      <span style={{
                                        fontSize: '0.64rem',
                                        fontWeight: 700,
                                        padding: '0.12rem 0.4rem',
                                        borderRadius: 'var(--radius-xs)',
                                        background: styleItem.badgeBg,
                                        color: styleItem.badgeColor
                                      }}>
                                        {styleItem.badge}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3, margin: 0 }}>
                                      {styleItem.desc}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Posisi Subtitel */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                POSISI DI LAYAR:
                              </label>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {[
                                  { key: 'bottom', label: 'Bawah' },
                                  { key: 'center', label: 'Tengah' },
                                  { key: 'top', label: 'Atas' }
                                ].map(p => (
                                  <button
                                    type="button"
                                    key={p.key}
                                    onClick={() => setMotionTextPosition(p.key)}
                                    style={{
                                      background: motionTextPosition === p.key ? 'var(--surface-interactive)' : 'var(--input-bg)',
                                      border: `1px solid ${motionTextPosition === p.key ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                      color: motionTextPosition === p.key ? 'var(--action-primary)' : 'var(--text-secondary)',
                                      padding: '0.3rem 0.65rem',
                                      borderRadius: 'var(--radius-xs)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'var(--transition)'
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Mini Live Animation Box (Teks Simulasi) */}
                          <div style={{
                            background: 'var(--surface-interactive)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0.65rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span>📺</span> SIMULASI KATA:
                              </span>
                              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--action-primary)' }}>
                                600ms per word
                              </span>
                            </div>

                            <div style={{
                              background: '#0a0a0c',
                              borderRadius: 'var(--radius-xs)',
                              padding: '0.75rem 0.5rem',
                              minHeight: '64px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: motionTextPosition === 'top' ? 'flex-start' : motionTextPosition === 'center' ? 'center' : 'flex-end',
                              alignItems: 'center',
                              overflow: 'hidden'
                            }}>
                              {motionTextStyle === 'floating_white_yellow' && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.35rem',
                                  justifyContent: 'center',
                                  alignItems: 'center'
                                }}>
                                  {['MASUKKAN', 'AYAM', 'KE', 'DALAM', 'AIRFRYER'].map((w, idx) => {
                                    const isCurrent = idx === demoWordIndex;
                                    const isFuture = idx > demoWordIndex;
                                    if (isFuture) return null;
                                    return (
                                      <span
                                        key={w}
                                        style={{
                                          fontSize: '0.8rem',
                                          fontWeight: 900,
                                          fontFamily: 'Impact, Arial Black, sans-serif',
                                          letterSpacing: '1px',
                                          color: isCurrent ? '#facc15' : '#ffffff',
                                          textShadow: '0 0 3px #000, 0 0 6px #000',
                                          transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                                          transition: 'all 0.15s ease-out',
                                          display: 'inline-block'
                                        }}
                                      >
                                        {w}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {motionTextStyle === 'floating_black_on_white' && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '0.3rem',
                                  justifyContent: 'center',
                                  alignItems: 'center'
                                }}>
                                  {['Masukkan', 'Ayam', 'Ke', 'Dalam', 'Airfryer'].map((w, idx) => {
                                    const isCurrent = idx === demoWordIndex;
                                    return (
                                      <span
                                        key={w}
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 800,
                                          fontFamily: 'system-ui, -apple-system, sans-serif',
                                          padding: '0.15rem 0.45rem',
                                          borderRadius: '4px',
                                          background: isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
                                          color: isCurrent ? '#000000' : '#e2e8f0',
                                          transform: isCurrent ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
                                          boxShadow: isCurrent ? '0 2px 6px rgba(0,0,0,0.4)' : 'none',
                                          transition: 'all 0.15s ease-out',
                                          display: 'inline-block'
                                        }}
                                      >
                                        {w}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {motionTextStyle === 'minimal_white' && (
                                <div style={{
                                  background: 'rgba(255, 255, 255, 0.95)',
                                  color: '#0f172a',
                                  padding: '0.45rem 0.85rem',
                                  borderRadius: '6px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                  textAlign: 'center',
                                  maxWidth: '92%'
                                }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                                    Crispy outside, tender inside!
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Notice jika OFF */
                        <div style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            <span>🚫</span>
                            <span>Clean Video Aktif (Tanpa Subtitel Grafis FFmpeg)</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35, margin: 0 }}>
                            Video final MP4 akan diekspor bersih tanpa overlay teks grafis. Narasi audio Minimax dan BGM tetap aktif. Subtitle native dapat ditambahkan di Instagram/TikTok.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* KOLOM KANAN: Transisi Antar Klip Video (XFade) */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      {/* Sub-header Kolom Kanan */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        paddingBottom: '0.65rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>✂️</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            2. Efek Transisi Video (XFade)
                          </span>
                        </div>

                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 9999,
                          background: 'var(--surface-interactive)',
                          color: 'var(--action-primary)',
                          border: '1px solid var(--action-primary)'
                        }}>
                          Aktif: {videoTransition} ({transitionDuration}s)
                        </span>
                      </div>

                      {/* 7 Transition Selector Cards Grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          PILIH EFEK PERGANTIAN ADEGAN:
                        </label>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '0.5rem'
                        }}>
                          {[
                            { key: 'fade', name: 'Fade', icon: '🌊', desc: 'Smooth Dissolve', badge: 'Default' },
                            { key: 'fadewhite', name: 'FadeWhite', icon: '⚡', desc: 'White Flash energik', badge: 'Flash' },
                            { key: 'fadeblack', name: 'FadeBlack', icon: '🌑', desc: 'Fade gelap sinematik', badge: 'Cinema' },
                            { key: 'slideleft', name: 'SlideLeft', icon: '👈', desc: 'Geser alur resep', badge: 'Dynamic' },
                            { key: 'zoomin', name: 'ZoomIn', icon: '🔍', desc: 'Dorongan kamera', badge: 'Action' },
                            { key: 'circleopen', name: 'CircleOpen', icon: '⭕', desc: 'Lingkaran iris retro', badge: 'Retro' },
                            { key: 'cut', name: 'Cut', icon: '✂️', desc: 'Hard Cut langsung', badge: 'Direct' }
                          ].map(t => {
                            const isSelected = videoTransition === t.key;
                            return (
                              <button
                                type="button"
                                key={t.key}
                                onClick={() => setVideoTransition(t.key)}
                                style={{
                                  background: isSelected ? 'var(--surface-interactive)' : 'var(--input-bg)',
                                  border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                  borderRadius: 'var(--radius-xs)',
                                  padding: '0.65rem 0.7rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.25rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxShadow: isSelected ? '0 0 0 1px var(--action-primary), 0 2px 8px rgba(45, 212, 191, 0.16)' : 'none',
                                  transition: 'var(--transition)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <span>{t.icon}</span>
                                    <span>{t.name}</span>
                                  </span>
                                  <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: 'var(--radius-xs)',
                                    background: isSelected ? 'var(--action-primary)' : 'var(--surface-raised)',
                                    color: isSelected ? 'var(--on-action-primary)' : 'var(--text-muted)'
                                  }}>
                                    {t.badge}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.25, margin: 0 }}>
                                  {t.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Transition Duration Selector Pills */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '0.65rem'
                      }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          ⏱️ DURASI TRANSISI:
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {[
                            { value: 0.3, label: '0.3s (Cepat)' },
                            { value: 0.5, label: '0.5s (Standar)' },
                            { value: 0.8, label: '0.8s (Halus)' }
                          ].map(d => {
                            const isSelected = transitionDuration === d.value;
                            return (
                              <button
                                type="button"
                                key={d.value}
                                onClick={() => setTransitionDuration(d.value)}
                                style={{
                                  background: isSelected ? 'var(--action-primary)' : 'var(--input-bg)',
                                  border: `1px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                                  color: isSelected ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: 9999,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'var(--transition)'
                                }}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanatory Note (No video preview box as requested) */}
                      <div style={{
                        background: 'var(--surface-interactive)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '0.65rem 0.75rem',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.45rem'
                      }}>
                        <span>💡</span>
                        <span>
                          Transisi antar klip diproses otomatis oleh FFmpeg XFade hardware-accelerated tanpa biaya kredit AI. Efek transisi halus menghubungkan klip resep secara mulus dengan durasi <strong>{transitionDuration} detik</strong>.
                        </span>
                      </div>
                    </div>

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

          {/* BARIS 2: 7-Stage Factual Live Execution Visualizer */}
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📡</span>
                  <span>Live Execution Visualizer (Alur Faktual)</span>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 9999,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: pollingActive ? 'var(--status-success-soft)' : 'var(--surface-interactive)',
                  color: pollingActive ? 'var(--status-success)' : 'var(--text-muted)',
                  border: `1px solid ${pollingActive ? 'var(--status-success)' : 'var(--border-subtle)'}`
                }}>
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: pollingActive ? 'var(--status-success)' : 'var(--text-muted)'
                  }} />
                  <span>{pollingActive ? 'Faktual Polling Aktif (2.5s)' : 'Status Real-Time Ready'}</span>
                </div>
              </div>

              {activeCampaignData && (
                <div style={{
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.75rem',
                  color: 'var(--link)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kampanye Terpantau:</span>
                  <strong>{activeCampaignData.id}</strong>
                  {activeCampaignData.topic && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      ({activeCampaignData.topic})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 7-Stage Dynamic Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.65rem'
            }}>
              {[
                {
                  key: 's1',
                  step: 1,
                  defaultTitle: 'Planner Creation',
                  defaultDesc: 'Container & brand kategori',
                  data: pipelineStages?.s1
                },
                {
                  key: 's2',
                  step: 2,
                  defaultTitle: 'Storyboard Creation',
                  defaultDesc: 'Gemini AI 1-Pass & 8 adegan',
                  data: pipelineStages?.s2
                },
                {
                  key: 's3',
                  step: 3,
                  defaultTitle: 'Start Frame Generation',
                  defaultDesc: 'Gambar acuan continuity',
                  data: pipelineStages?.s3
                },
                {
                  key: 's4',
                  step: 4,
                  defaultTitle: 'TTS Generation',
                  defaultDesc: 'Minimax expressive audio',
                  data: pipelineStages?.s4
                },
                {
                  key: 's5',
                  step: 5,
                  defaultTitle: 'Video Generation',
                  defaultDesc: 'Google Veo Omni Flash @ 4s',
                  data: pipelineStages?.s5
                },
                {
                  key: 's6',
                  step: 6,
                  defaultTitle: 'FFmpeg Processing',
                  defaultDesc: 'Muxing 8 klip + VO + BGM',
                  data: pipelineStages?.s6
                },
                {
                  key: 's7',
                  step: 7,
                  defaultTitle: 'Cloud & Sync',
                  defaultDesc: 'Nextcloud & Hub ContentFlow',
                  data: pipelineStages?.s7
                }
              ].map(st => {
                const stageData = st.data || { status: 'idle', badge: 'Menunggu' };
                const isCompleted = stageData.status === 'completed';
                const isProcessing = stageData.status === 'processing';
                const isFailed = stageData.status === 'failed';

                let borderColor = 'var(--border-subtle)';
                let bgColor = 'var(--surface-raised)';
                let numBg = 'var(--surface-interactive)';
                let numColor = 'var(--text-muted)';
                let badgeBg = 'var(--surface-interactive)';
                let badgeColor = 'var(--text-disabled)';
                let badgeBorder = 'var(--border-subtle)';

                if (isCompleted) {
                  borderColor = 'var(--status-success)';
                  numBg = 'var(--status-success)';
                  numColor = 'var(--on-action-primary)';
                  badgeBg = 'var(--status-success-soft)';
                  badgeColor = 'var(--status-success)';
                  badgeBorder = 'var(--status-success)';
                } else if (isProcessing) {
                  borderColor = 'var(--action-primary)';
                  bgColor = 'var(--surface-interactive)';
                  numBg = 'var(--action-primary)';
                  numColor = 'var(--on-action-primary)';
                  badgeBg = 'var(--surface-raised)';
                  badgeColor = 'var(--action-primary)';
                  badgeBorder = 'var(--action-primary)';
                } else if (isFailed) {
                  borderColor = 'var(--status-danger)';
                  bgColor = 'var(--status-danger-soft)';
                  numBg = 'var(--status-danger)';
                  numColor = 'var(--canvas)';
                  badgeBg = 'var(--status-danger-soft)';
                  badgeColor = 'var(--status-danger)';
                  badgeBorder = 'var(--status-danger)';
                }

                return (
                  <div
                    key={st.key}
                    style={{
                      background: bgColor,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 0.65rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '0.5rem',
                      position: 'relative',
                      minHeight: 140,
                      justifyContent: 'flex-start',
                      boxShadow: isProcessing ? '0 0 18px rgba(45, 212, 191, 0.16)' : 'none',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: numBg,
                      color: numColor,
                      border: `1px solid ${borderColor}`
                    }}>
                      {isCompleted ? '✓' : (isProcessing ? '⚡' : (isFailed ? '✕' : st.step))}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                      {stageData.title || st.defaultTitle}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {stageData.desc || st.defaultDesc}
                    </div>
                    <div style={{
                      marginTop: 'auto',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 9999,
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeBorder}`,
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {stageData.badge || 'Menunggu'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Telemetry Console Bar */}
            <div style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {telemetry?.timestamp ? `[${telemetry.timestamp}]` : '[Live]'}
                </span>
                <span>📡 Status Faktual Scheduler:</span>
                <span style={{ color: 'var(--action-primary)', fontWeight: 600 }}>
                  {telemetry?.message || 'Memantau scheduler background cluster...'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                Interval: <strong>2.5s</strong>
              </div>
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
                    recentCampaigns.map(camp => {
                      const isInspected = camp.id === activeCampaignId;
                      return (
                        <tr
                          key={camp.id}
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            setPollingActive(camp.status !== 'completed');
                            fetchFactualStatus(camp.id);
                          }}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            background: isInspected ? 'var(--surface-interactive)' : 'transparent',
                            borderLeft: isInspected ? '3px solid var(--action-primary)' : '3px solid transparent',
                            transition: 'var(--transition)'
                          }}
                        >
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: isInspected ? 'var(--action-primary)' : 'inherit' }}>
                              {camp.id}
                            </strong>
                            {isInspected && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--action-primary)', fontWeight: 700, marginTop: '0.2rem' }}>
                                👁️ Terpilih di Visualizer
                              </div>
                            )}
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
                    );
                  })
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

