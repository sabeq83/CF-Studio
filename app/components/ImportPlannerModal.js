'use client';

import React, { useState, useEffect } from 'react';

export default function ImportPlannerModal({
  isOpen,
  onClose,
  initialPlannerId,
  onSuccess
}) {
  const [planners, setPlanners] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedPlannerId, setSelectedPlannerId] = useState('');
  const [selectedPlanner, setSelectedPlanner] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);
  const [campaignName, setCampaignName] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search & Filter States
  const [searchPlannerQuery, setSearchPlannerQuery] = useState('');
  const [plannerStatusFilter, setPlannerStatusFilter] = useState('all'); // 'all' | 'ready' | 'consumed'
  const [isPlannerPickerOpen, setIsPlannerPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadInitialData();
  }, [isOpen, initialPlannerId]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [plannersRes, presetsRes] = await Promise.all([
        fetch('/api/content-planner?is_archived=false').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/v2/operator-presets').then(r => r.json()).catch(() => ({ success: false }))
      ]);

      const availablePlanners = plannersRes?.success ? (plannersRes.planners || []) : [];
      const availablePresets = presetsRes?.success ? (presetsRes.presets || []) : [];
      setPlanners(availablePlanners);
      setPresets(availablePresets);

      const targetPlannerId = initialPlannerId || (availablePlanners[0]?.id || '');
      if (targetPlannerId) {
        setSelectedPlannerId(targetPlannerId);
        await loadPlannerDetail(targetPlannerId, availablePresets);
      }
    } catch (err) {
      console.error('[ImportPlannerModal] Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlannerDetail(plannerId, presetList = presets) {
    if (!plannerId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/content-planner/${plannerId}`).then(r => r.json()).catch(() => ({ success: false }));
      if (res?.success && res.planner) {
        const p = res.planner;
        setSelectedPlanner(p);
        const rows = p.rows || [];
        setSelectedRowIds(rows.map(r => r.id));

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const acc = p.account_name || 'Umum';
        setCampaignName(`[ OPC ${dateStr} ] - ${acc} - ${p.title || p.product_name || 'Campaign'}`);

        // Auto-select recommended preset based on brand or first available
        if (presetList && presetList.length > 0) {
          const matched = presetList.find(pr => {
            const accLow = (p.account_name || '').toLowerCase();
            const brandLow = (p.brand_name || '').toLowerCase();
            const keyLow = (pr.key || '').toLowerCase();
            const labelLow = (pr.label || '').toLowerCase();
            return (accLow && (keyLow.includes(accLow) || labelLow.includes(accLow))) ||
                   (brandLow && (keyLow.includes(brandLow) || labelLow.includes(brandLow)));
          }) || presetList[0];

          setSelectedPresetKey(matched.key);
          setSelectedPreset(matched);
        }
      }
    } catch (e) {
      console.error('[ImportPlannerModal] Error loading planner detail:', e);
    } finally {
      setLoading(false);
    }
  }

  function handlePlannerChange(newPlannerId) {
    setSelectedPlannerId(newPlannerId);
    loadPlannerDetail(newPlannerId, presets);
  }

  function handlePresetChange(presetKey) {
    setSelectedPresetKey(presetKey);
    const found = presets.find(p => p.key === presetKey);
    setSelectedPreset(found || null);
  }

  function toggleRowSelection(rowId) {
    setSelectedRowIds(prev =>
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
    );
  }

  function toggleAllRows() {
    if (!selectedPlanner?.rows) return;
    const allIds = selectedPlanner.rows.map(r => r.id);
    if (selectedRowIds.length === allIds.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(allIds);
    }
  }

  async function handleSubmit(targetStatus) {
    if (!selectedPlannerId) {
      alert('Pilih Content Planner terlebih dahulu.');
      return;
    }
    if (selectedRowIds.length === 0) {
      alert('Pilih minimal satu baris ide/resep konten yang ingin di-ingest.');
      return;
    }
    if (!campaignName.trim()) {
      alert('Nama Kampanye OPC wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const pConfig = selectedPreset?.config || {};
      const payload = {
        planner_id: selectedPlannerId,
        selected_row_ids: selectedRowIds,
        campaign_name: campaignName.trim(),
        global_settings: {
          operator_preset_key: selectedPresetKey,
          status: targetStatus,
          account_name: selectedPlanner?.account_name || null,
          brand_profile_id: selectedPlanner?.brand_id || null,
          target_product_id: selectedPlanner?.product_id || null,
          // Unpack 100% of the preset's config directly
          ...(pConfig.basic_strategy || {}),
          ...(pConfig.visual_engine || {}),
          ...(pConfig.product_bridging || {}),
          ...(pConfig.workflow || {}),
          visual_identity_preset_id: pConfig.visual_identity_preset_id || pConfig.visual_swap?.visual_identity_preset_id || null,
          visual_overrides_json: pConfig.visual_swap?.visual_overrides_json ? JSON.stringify(pConfig.visual_swap.visual_overrides_json) : null
        }
      };

      const res = await fetch('/api/v2/pillar-campaigns/ingest-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal melakukan ingest ke OPC');
      }

      if (onSuccess) onSuccess({ ...data, status: targetStatus });
      onClose();
    } catch (err) {
      alert('Error Ingest: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const totalRows = selectedPlanner?.rows?.length || 0;
  const isAllSelected = selectedRowIds.length === totalRows && totalRows > 0;
  const pConfig = selectedPreset?.config || {};

  const filteredPlanners = planners.filter(p => {
    if (plannerStatusFilter === 'ready' && p.is_consumed) return false;
    if (plannerStatusFilter === 'consumed' && !p.is_consumed) return false;
    if (searchPlannerQuery.trim()) {
      const q = searchPlannerQuery.toLowerCase();
      const title = (p.title || p.product_name || '').toLowerCase();
      const brand = (p.account_name || p.brand_profile_name || '').toLowerCase();
      const focus = (p.planner_focus || '').toLowerCase();
      return title.includes(q) || brand.includes(q) || focus.includes(q);
    }
    return true;
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)',
      backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg, 16px)', width: '100%', maxWidth: '700px',
        boxShadow: 'var(--shadow-modal)', overflow: 'hidden', display: 'flex',
        flexDirection: 'column', maxHeight: '92vh'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px', background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border-subtle)', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 750, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🌱</span> Ingest Planner ke OPC Studio
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Pilih Planner dan baris konten, seluruh pengaturan teknis otomatis diambil dari Operator Preset.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* 1. Sumber Planner & Checklist */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>1. Pilih Sumber Content Planner *</span>
              <span style={{ color: 'var(--action-primary)', fontSize: '0.74rem' }}>🔍 Search & Badges Aktif</span>
            </label>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 8px)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              
              {/* Active Planner Summary Card */}
              <div
                onClick={() => setIsPlannerPickerOpen(prev => !prev)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid ' + (isPlannerPickerOpen ? 'var(--action-primary)' : 'var(--border-strong)'),
                  borderRadius: 'var(--radius-sm, 8px)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, paddingRight: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                      {selectedPlanner ? (selectedPlanner.title || selectedPlanner.product_name) : 'Pilih Content Planner'}
                    </span>
                    {selectedPlanner && (
                      selectedPlanner.is_consumed ? (
                        <span style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)', padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>
                          ✓ Sudah Terpakai{selectedPlanner.consumed_owner_id ? ` (${selectedPlanner.consumed_owner_id})` : ''}
                        </span>
                      ) : (
                        <span style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)', padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>
                          ● Belum Dipakai (Ready)
                        </span>
                      )
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Brand: {selectedPlanner?.account_name || selectedPlanner?.brand_profile_name || 'Umum'} • {totalRows} Baris Konten
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'var(--surface-interactive)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isPlannerPickerOpen ? 'Tutup ▲' : 'Ganti Planner ▼'}
                </button>
              </div>

              {/* Collapsible Search & Filter Drawer */}
              {isPlannerPickerOpen && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm, 8px)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={searchPlannerQuery}
                      onChange={e => setSearchPlannerQuery(e.target.value)}
                      placeholder="🔍 Ketik judul planner, brand, atau topik..."
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '8px 30px 8px 12px', borderRadius: 6, fontSize: '0.84rem', outline: 'none' }}
                    />
                    {searchPlannerQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchPlannerQuery('')}
                        style={{ position: 'absolute', right: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter Chips */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
                    {[
                      { key: 'all', label: `Semua (${planners.length})` },
                      { key: 'ready', label: `● Belum Dipakai (${planners.filter(p => !p.is_consumed).length})` },
                      { key: 'consumed', label: `✓ Sudah Terpakai (${planners.filter(p => p.is_consumed).length})` }
                    ].map(f => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setPlannerStatusFilter(f.key)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: plannerStatusFilter === f.key ? 700 : 500,
                          cursor: 'pointer',
                          border: '1px solid ' + (plannerStatusFilter === f.key ? 'var(--action-primary)' : 'var(--border-subtle)'),
                          background: plannerStatusFilter === f.key ? 'var(--action-primary)' : 'var(--surface-raised)',
                          color: plannerStatusFilter === f.key ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Scrollable Planner List */}
                  <div style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredPlanners.length === 0 ? (
                      <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Tidak ada planner yang sesuai dengan kriteria pencarian.
                      </div>
                    ) : (
                      filteredPlanners.map(p => {
                        const isSelected = p.id === selectedPlannerId;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              handlePlannerChange(p.id);
                              setIsPlannerPickerOpen(false);
                            }}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 6,
                              background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                              border: '1px solid ' + (isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'),
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'all 0.1s ease'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.title || p.product_name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Brand: {p.account_name || p.brand_profile_name || 'Umum'} • {p.row_count || 0} Baris Tersedia
                              </div>
                            </div>
                            <div>
                              {p.is_consumed ? (
                                <span style={{ background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  ✓ Sudah Terpakai
                                </span>
                              ) : (
                                <span style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)', padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  ● Belum Dipakai
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Rows Count & Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: 'var(--status-success-soft)', color: 'var(--status-success)', border: '1px solid var(--status-success)', padding: '3px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700 }}>
                    {selectedRowIds.length} dari {totalRows} Baris Terpilih
                  </span>
                  {selectedPlanner?.account_name && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Brand: {selectedPlanner.account_name}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={toggleAllRows} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                    {isAllSelected ? 'Batal Semua' : 'Pilih Semua'}
                  </button>
                  <button type="button" onClick={() => setIsChecklistOpen(v => !v)} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>
                    {isChecklistOpen ? '▲ Sembunyikan' : '▼ Lihat Baris'}
                  </button>
                </div>
              </div>

              {/* Checklist Container */}
              {isChecklistOpen && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 8px)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {loading ? (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Memuat baris planner...</div>
                  ) : (selectedPlanner?.rows || []).map((r, idx) => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--surface-raised)', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.includes(r.id)}
                        onChange={() => toggleRowSelection(r.id)}
                        style={{ accentColor: 'var(--action-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>#{idx + 1}</span>
                      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{r.title || r.hook || 'Untitled Idea'}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Nama Kampanye OPC */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              2. Nama Kampanye OPC *
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 'var(--radius-sm, 8px)', fontSize: '0.88rem', outline: 'none' }}
              placeholder="Contoh: [ OPC 20261112 ] - Cerita Dokter - Batch 1"
            />
          </div>

          {/* 3. Pilihan Operator Preset */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>3. Pilih Operator Preset Produksi *</span>
              <a href="/settings/presets" target="_blank" rel="noreferrer" style={{ color: 'var(--action-primary)', fontSize: '0.74rem', textDecoration: 'none' }}>⚙️ Kelola Preset</a>
            </label>
            <select
              value={selectedPresetKey}
              onChange={e => handlePresetChange(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 'var(--radius-sm, 8px)', fontSize: '0.88rem', outline: 'none' }}
            >
              {presets.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label} {p.is_system ? '(System)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Live Preset Snapshot Card */}
          <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md, 12px)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--action-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚡</span> Live Preset Snapshot (100% Config Inherited)
              </span>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'var(--surface-interactive)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {selectedPresetKey || 'custom'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>Visual Identity</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--action-primary)' }}>
                  {pConfig.visual_identity_preset_id || pConfig.visual_swap?.visual_identity_preset_id || 'Syari Classic / Default'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>Video Engine & Format</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pConfig.visual_engine?.video_model === 'omni_flash' ? 'Veo Omni Flash (4s)' : 'Veo 3.1 Lite (8s)'} • {pConfig.visual_engine?.aspect_ratio || '9:16'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>Voice Persona (TTS)</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pConfig.basic_strategy?.voice_provider || 'minimax'} ({pConfig.basic_strategy?.voice_persona || 'casual_reporter'})
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>Product Bridging</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pConfig.product_bridging?.is_bridging_active ? `Aktif di Klip ${pConfig.product_bridging.bridge_at_clip || 3}` : 'Nonaktif'}
                </span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>Automated Workflow Pipeline</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  ✓ Auto-Generate TTS • ✓ G-Labs GPU Start Frame • ✓ FFmpeg Video Stitch
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px', background: 'var(--surface-raised)',
          borderTop: '1px solid var(--border-subtle)', display: 'flex',
          justifyContent: 'flex-end', alignItems: 'center', gap: 12
        }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '9px 18px', borderRadius: 'var(--radius-sm, 8px)', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}>
            Batal
          </button>
          <button type="button" onClick={() => handleSubmit('draft')} disabled={submitting} style={{ background: 'var(--surface-interactive)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '9px 18px', borderRadius: 'var(--radius-sm, 8px)', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}>
            {submitting ? 'Menyimpan...' : 'Simpan Draf'}
          </button>
          <button type="button" onClick={() => handleSubmit('running')} disabled={submitting} style={{ background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 'none', padding: '9px 20px', borderRadius: 'var(--radius-sm, 8px)', fontSize: '0.86rem', fontWeight: 750, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚀</span> {submitting ? 'Memproses...' : 'Mulai Produksi OPC Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
