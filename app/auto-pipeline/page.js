'use client';

import Sidebar from '../components/Sidebar';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AutoPipelinePage() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [operatorPresets, setOperatorPresets] = useState([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [activePresetConfig, setActivePresetConfig] = useState(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetHint, setPresetHint] = useState('');
  const [topic, setTopic] = useState('air fryer chicken thighs');
  const [category, setCategory] = useState('makanan_utama');
  const [isCategoryManuallySelected, setIsCategoryManuallySelected] = useState(false);
  const [recipeCount, setRecipeCount] = useState(1);
  const [executionMode, setExecutionMode] = useState('full_autopilot');

  // Computed preset parameters for Inspector Card
  const targetClipsCount = Number(
    activePresetConfig?.visual_engine?.target_clips_count ||
    activePresetConfig?.target_clips_count ||
    6
  );
  const clipDuration = Number(
    activePresetConfig?.visual_engine?.clip_duration ||
    activePresetConfig?.clip_duration ||
    4
  );
  const rawVideoModel = activePresetConfig?.visual_engine?.video_model || activePresetConfig?.video_model || 'omni_flash';
  const videoModelName = rawVideoModel === 'veo_31_lite' ? 'Google Veo (8s)' : 'Veo Omni Flash (4s)';
  const rawVoicePersona = activePresetConfig?.basic_strategy?.voice_persona || activePresetConfig?.voice_persona || 'English_causual_narrator_vv1';
  const voicePersonaName = rawVoicePersona.replace(/_/g, ' ');
  const targetLanguage = activePresetConfig?.basic_strategy?.target_language || activePresetConfig?.target_language || 'en-US';

  const wf = activePresetConfig?.workflow || {};
  const isMotionTextOn = wf.enable_motion_text !== undefined ? Boolean(wf.enable_motion_text) : (activePresetConfig?.enable_motion_text !== undefined ? Boolean(activePresetConfig.enable_motion_text) : true);
  const motionStyleKey = wf.motion_text_style || activePresetConfig?.motion_text_style || 'floating_white_yellow';
  const motionStyleDesc = !isMotionTextOn
    ? 'Nonaktif'
    : (motionStyleKey === 'floating_white_yellow'
        ? 'Floating Putih ➔ Kuning'
        : (motionStyleKey === 'minimal_white' ? 'Minimal Putih' : 'CapCut Style'));

  const transitionKey = wf.video_transition || activePresetConfig?.video_transition || 'fade';
  const transitionDur = wf.transition_duration !== undefined ? Number(wf.transition_duration) : (activePresetConfig?.transition_duration !== undefined ? Number(activePresetConfig.transition_duration) : 0.5);
  const transitionDesc = `${String(transitionKey).toUpperCase()} (${transitionDur}s)`;

  function getStoryArcSteps(count, dur) {
    if (count <= 4) {
      return [
        { seq: 1, title: 'Hook & Visual Action', dur },
        { seq: 2, title: 'Bahan & Marinasi', dur },
        { seq: 3, title: 'Proses Memasak', dur },
        { seq: 4, title: 'Plating & CTA Outro', dur }
      ];
    }
    if (count <= 6) {
      return [
        { seq: 1, title: 'Hook Pembuka', dur },
        { seq: 2, title: 'Persiapan Bahan', dur },
        { seq: 3, title: 'Proses Memasak', dur },
        { seq: 4, title: 'Sizzle & Tekstur', dur },
        { seq: 5, title: 'Plating Sempurna', dur },
        { seq: 6, title: 'Hasil & Outro Bio', dur }
      ];
    }
    return [
      { seq: 1, title: 'Hook Sensori', dur },
      { seq: 2, title: 'Step 1 Bahan', dur },
      { seq: 3, title: 'Step 2 Campur', dur },
      { seq: 4, title: 'Step 3 Masak', dur },
      { seq: 5, title: 'Step 4 Tekstur', dur },
      { seq: 6, title: 'Step 5 Finishing', dur },
      { seq: 7, title: 'Step 6 Plating', dur },
      { seq: 8, title: 'Outro App Link', dur }
    ];
  }

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
        if (data.success) {
          const opList = data.operator_presets || [];
          setOperatorPresets(opList);

          const defaultKey = opList[0]?.key || 'recipe_campaign_default';
          setSelectedPresetKey(defaultKey);

          const initialConfig = opList[0]?.config || opList[0] || data.default_preset || null;
          setActivePresetConfig(initialConfig);

          if (Array.isArray(data.presets)) {
            setPresets(data.presets);
            const defaultVi = initialConfig?.visual_swap?.visual_identity_preset_id ||
              data.default_preset?.visual_identity_preset_id ||
              data.presets[0]?.id ||
              '';
            setSelectedPresetId(defaultVi);
          }

          const currentBrandObj = brands.find(b => b.id === selectedBrandId);
          setPresetHint(`Terfilter khusus brand ${currentBrandObj?.brand_name || selectedBrandId}`);
        }
      } catch (e) {
        console.warn('[AutoPipeline] Error fetching presets:', e);
      }
    }
    fetchPresets();
  }, [selectedBrandId, brands]);

  function handlePresetKeyChange(newKey) {
    setSelectedPresetKey(newKey);
    const found = operatorPresets.find(p => p.key === newKey);
    if (found) {
      const cfg = found.config || found;
      setActivePresetConfig(cfg);
      if (cfg.visual_swap?.visual_identity_preset_id) {
        setSelectedPresetId(cfg.visual_swap.visual_identity_preset_id);
      }
    }
  }

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

  // 4. Trigger 1-Click Pipeline (Clean, Zero Override Manual)
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
          preset_key: selectedPresetKey,
          topic: topic.trim(),
          category: category || 'makanan_utama',
          recipe_count: Number(recipeCount || 1),
          execution_mode: executionMode,
          visual_identity_preset_id: selectedPresetId || activePresetConfig?.visual_swap?.visual_identity_preset_id || null,
          auto_sync_contentflow: 1
        })
      });

      const data = await res.json();

      if (data.success) {
        setActiveCampaignId(data.campaign_id);
        setPollingActive(true);
        fetchFactualStatus(data.campaign_id);
        showToast(`Kampanye ${data.campaign_id} (${targetClipsCount} Klip) berhasil diluncurkan! Melacak progres produksi faktual... 🚀`);
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

          {/* BARIS 1: Form Konfigurasi 1-Klik (Clean UI & Terintegrasi Preset Manager) */}
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
            {/* Section Header with Preset Manager Direct Link */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '1.12rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🚀</span>
                  <span>Luncurkan Auto Pipeline Resep</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Pilih brand & preset konfigurasi resep, tentukan topik, lalu jalankan produksi otomatis dalam 1 klik.
                </div>
              </div>

              <Link
                href="/settings/presets"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--action-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'var(--transition)'
                }}
              >
                <span>🎛️</span>
                <span>Kelola di Preset Manager</span>
              </Link>
            </div>

            <form onSubmit={handleLaunchPipeline} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '1rem'
              }}>
                {/* 1. Brand Profile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <span>1. Brand Profile</span>
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

                {/* 2. Preset Konfigurasi Resep (Preset Manager) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>2. Preset Konfigurasi Resep</span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--status-success)',
                      background: 'var(--status-success-soft)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-xs)'
                    }}>
                      Preset Manager
                    </span>
                  </label>
                  <select
                    value={selectedPresetKey}
                    onChange={(e) => handlePresetKeyChange(e.target.value)}
                    style={{
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--action-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 0.85rem',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    {operatorPresets.map(op => (
                      <option key={op.key} value={op.key}>
                        {op.label || op.key}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Target Video Resep */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}>
                    3. Target Video Resep
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
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 4. Mode Eksekusi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}>
                    4. Mode Eksekusi
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
                      outline: 'none'
                    }}
                  >
                    <option value="full_autopilot">Full Autopilot (Auto-Approve & Langsung Jadi Video)</option>
                    <option value="manual_review">Manual Review (Jeda di Storyboard Approval)</option>
                  </select>
                </div>
              </div>

              {/* READ-ONLY PRESET INSPECTOR CARD */}
              <div style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rincian Bawaan Preset Terpilih:
                      <span style={{ color: 'var(--action-primary)', marginLeft: '0.35rem' }}>
                        {activePresetConfig?.label || selectedPresetKey || 'Default Template'}
                      </span>
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'var(--status-info-soft)',
                    color: 'var(--status-info)',
                    border: '1px solid var(--status-info)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 9999
                  }}>
                    🔒 Dikunci & Dikelola oleh Preset Manager
                  </span>
                </div>

                {/* 4 Specs Badges */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '0.75rem'
                }}>
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Format Klip & Durasi
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🎬 {targetClipsCount} Klip × {clipDuration} detik (~{targetClipsCount * clipDuration}s)
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Model AI & Voice-Over
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🤖 {videoModelName} • {voicePersonaName} ({targetLanguage})
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Finishing Subtitel
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🟡 {motionStyleDesc}
                    </span>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Finishing Transisi FFmpeg
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ✂️ {transitionDesc}
                    </span>
                  </div>
                </div>

                {/* Mini Story Arc Timeline Preview */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                    ALUR BABAK STORY ARC OTOMATIS:
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {getStoryArcSteps(targetClipsCount, clipDuration).map((step) => (
                      <div
                        key={step.seq}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '0.35rem 0.6rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.72rem'
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--action-primary)' }}>{step.seq}.</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{step.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>({step.dur}s)</span>
                      </div>
                    ))}
                  </div>
                </div>
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

              {/* Submit Button */}
              <div style={{ paddingTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isLaunching}
                  style={{
                    background: isLaunching ? 'var(--surface-interactive)' : 'var(--action-primary)',
                    color: isLaunching ? 'var(--text-muted)' : 'var(--on-action-primary)',
                    border: 'none',
                    padding: '0.9rem 1.85rem',
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
                  <span>{isLaunching ? '⏳ Memproses Auto Pipeline...' : `🚀 Luncurkan Auto Pipeline (${targetClipsCount} Klip Video)`}</span>
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

