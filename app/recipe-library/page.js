'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';

export default function RecipeLibraryPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [polishFilter, setPolishFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Batch Importer State
  const [importUrls, setImportUrls] = useState(
    'https://cookpad.com/id/resep/17492811-ayam-woku-belanga-khas-manado\n' +
    'https://www.masakapahariini.com/resep/tumis-buncis-daging-cincang-gurih\n' +
    'https://cookpad.com/id/resep/16829104-mousse-cokelat-alpukat-sehat-diet'
  );
  const [stylePreset, setStylePreset] = useState('Food Porn');
  const [delayMode, setDelayMode] = useState('random-10-20');
  const [isImporting, setIsImporting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [importLogs, setImportLogs] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Load recipes from API
  const loadRecipes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/recipes/curated/import-batch?limit=100');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRecipes(json.data);
      }
    } catch (err) {
      console.error('Gagal memuat resep:', err);
      showToast('Gagal memuat data resep dari server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter recipes
  const filteredRecipes = recipes.filter(r => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (r.original_title && r.original_title.toLowerCase().includes(q)) ||
      (r.polished_title && r.polished_title.toLowerCase().includes(q)) ||
      (r.source_domain && r.source_domain.toLowerCase().includes(q)) ||
      (Array.isArray(r.ingredients_raw) && r.ingredients_raw.some(i => String(i).toLowerCase().includes(q)));

    const matchCategory = !categoryFilter || r.category === categoryFilter;
    const matchPolish = !polishFilter || r.polish_status === polishFilter;
    const matchDomain = !domainFilter || r.source_domain === domainFilter;

    return matchSearch && matchCategory && matchPolish && matchDomain;
  });

  // Unique domains for filter dropdown
  const uniqueDomains = Array.from(new Set(recipes.map(r => r.source_domain).filter(Boolean)));

  // Metrics
  const totalCount = recipes.length;
  const polishedCount = recipes.filter(r => r.polish_status === 'polished').length;
  const frozenCount = recipes.filter(r => Array.isArray(r.ingredients_raw) && r.ingredients_raw.length > 0).length;

  // Run Batch Import
  const handleStartBatchImport = async () => {
    const lines = importUrls.split('\n').map(u => u.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Silakan masukkan minimal 1 URL resep.');
      return;
    }
    if (lines.length > 50) {
      alert('Maksimal URL yang dapat diproses adalah 50 baris.');
      return;
    }

    setIsImporting(true);
    setImportLogs([]);
    setProgressPct(5);
    setProgressText(`Menyiapkan pemrosesan sekuensial ${lines.length} URL resep...`);

    const addLog = (msg, type = 'info') => {
      setImportLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: msg, type }]);
    };

    addLog(`Memulai batch impor ${lines.length} URL dengan jeda acak anti-bot...`, 'info');

    try {
      const minDelay = delayMode === 'demo-fast' ? 1500 : 10000;
      const maxDelay = delayMode === 'demo-fast' ? 2500 : 20000;

      const res = await fetch('/api/v2/recipes/curated/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: lines,
          auto_polish: true,
          style_preset: stylePreset,
          min_delay_ms: minDelay,
          max_delay_ms: maxDelay
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses batch.');
      }

      setProgressPct(100);
      setProgressText(`Selesai! ${data.data?.success_count || 0} berhasil diimpor.`);
      addLog(`🎉 ${data.message || 'Batch selesai diproses!'}`, 'success');

      showToast(`Sukses mengimpor ${data.data?.success_count || 0} resep baru!`, 'success');
      await loadRecipes();

      setTimeout(() => {
        setIsImporting(false);
        setShowImportModal(false);
      }, 1500);

    } catch (err) {
      console.error('Batch error:', err);
      addLog(`❌ Error: ${err.message}`, 'error');
      setProgressText(`Terjadi kendala: ${err.message}`);
      setIsImporting(false);
    }
  };

  // Launch Video Generation via Auto Pipeline (Task 3 integration)
  const handleLaunchVideo = (recipe) => {
    const topic = recipe.polished_title || recipe.original_title;
    const category = recipe.category || 'makanan_utama';
    router.push(`/auto-pipeline?pipeline_type=recipe_campaign&topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`);
  };

  // Export Library JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `curated_recipes_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Pustaka resep berhasil diekspor ke file JSON.', 'success');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--canvas)', color: 'var(--text-primary)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto', minWidth: 0 }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toastMessage.type === 'error' ? 'var(--status-danger)' : 'var(--action-primary)',
            color: toastMessage.type === 'error' ? 'var(--text-primary)' : 'var(--on-action-primary)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-modal)',
            fontWeight: 600,
            fontSize: '13px'
          }}>
            {toastMessage.text}
          </div>
        )}

        {/* Topbar Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🍲</span> Pustaka Resep Kuliner (Recipe Library)
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
              Pustaka resep otoritatif terkurasi dengan perlindungan takaran asli 100% & AI Magic Polish untuk produksi video reels kuliner.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleExportJson}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <span>📥</span> Ekspor JSON
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span>⚡</span> Impor Batch Resep (Maks 50 URL)
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>TOTAL RESEP TERKURASI</span>
              <span>📚</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Tersimpan di database</div>
          </div>

          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>AI MAGIC POLISHED</span>
              <span>✨</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--status-success)' }}>{polishedCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Title, intro & langkah ter-polish</div>
          </div>

          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>BAHAN 100% TERKUNCI</span>
              <span>🔒</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--status-info)' }}>{frozenCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Zero halusinasi takaran bahan</div>
          </div>

          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>SIAP PRODUKSI VIDEO</span>
              <span>🎬</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Prompt visual 5-layer siap pakai</div>
          </div>
        </div>

        {/* Filter & Search Card */}
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama resep, bahan baku, atau sumber..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 14px 9px 36px',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '9px 12px',
              fontSize: '13px'
            }}
          >
            <option value="">Semua Kategori</option>
            <option value="makanan_utama">Makanan Utama</option>
            <option value="masakan">Masakan Tradisional</option>
            <option value="dessert">Dessert & Kue</option>
            <option value="minuman">Minuman</option>
          </select>

          <select
            value={polishFilter}
            onChange={(e) => setPolishFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '9px 12px',
              fontSize: '13px'
            }}
          >
            <option value="">Semua Status Polish</option>
            <option value="polished">✓ AI Polished</option>
            <option value="unpolished">Data Mentah</option>
          </select>

          {uniqueDomains.length > 0 && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '9px 12px',
                fontSize: '13px'
              }}
            >
              <option value="">Semua Portal Web</option>
              {uniqueDomains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          <button
            onClick={loadRecipes}
            style={{
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 14px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
            title="Refresh Data"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Recipes Table Card */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat pustaka resep kuliner...
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍲</div>
              <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Belum ada resep yang terkurasi</strong>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 16px 0' }}>
                Gunakan tombol di atas untuk mengimpor hingga 50 URL resep dari portal kuliner seperti Cookpad atau Masak Apa Hari Ini.
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ⚡ Impor Batch Resep Sekarang
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Resep & Sumber Asli</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Judul Ter-Polish (AI)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Bahan Baku (100% Asli)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Waktu & Porsi</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Kategori</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((r, idx) => {
                  const ingredients = Array.isArray(r.ingredients_raw) ? r.ingredients_raw : [];
                  const isPolished = r.polish_status === 'polished';

                  return (
                    <tr key={r.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{r.original_title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{r.source_domain || 'web'}</span>
                          {r.source_url && (
                            <>
                              • <a href={r.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--link)', textDecoration: 'none' }}>Lihat Sumber ↗</a>
                            </>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '320px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: isPolished ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                          color: isPolished ? 'var(--status-success)' : 'var(--status-warning)'
                        }}>
                          {isPolished ? '✓ AI Polished' : 'Data Mentah'}
                        </span>
                        <div style={{ fontWeight: 600, color: 'var(--action-primary)', marginTop: '4px', lineHeight: 1.4 }}>
                          {r.polished_title || r.original_title}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--status-info-soft)',
                          color: 'var(--status-info)',
                          border: '1px solid var(--status-info)'
                        }}>
                          🔒 {ingredients.length} Bahan Terkunci
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '240px' }}>
                          {ingredients.slice(0, 2).join(', ')}
                          {ingredients.length > 2 && '...'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          ⏱ {r.cook_time || r.total_time || '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          🍽 {r.servings || '-'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '11px',
                          backgroundColor: 'var(--surface-interactive)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {r.category || 'makanan_utama'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedRecipe(r)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--surface-raised)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            👁 Detail
                          </button>

                          <button
                            onClick={() => handleLaunchVideo(r)}
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--action-primary)',
                              color: 'var(--on-action-primary)',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            🎬 Buat Video
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* MODAL IMPOR BATCH RESEP */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--overlay-backdrop)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-modal)',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '26px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                ⚡ Impor Batch Resep Otoritatif (Hingga 50 URL)
              </h2>
              <button
                onClick={() => !isImporting && setShowImportModal(false)}
                disabled={isImporting}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{
              backgroundColor: 'var(--status-info-soft)',
              border: '1px solid var(--status-info)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              marginBottom: '18px',
              fontSize: '13px',
              display: 'flex',
              gap: '10px',
              color: 'var(--text-primary)'
            }}>
              <span style={{ fontSize: '18px' }}>🔒</span>
              <div>
                <strong>Strict Guardrail Otoritatif Aktif:</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Bahan resep (<em>ingredients</em>) beserta takaran gram/sendok/siung <strong>DIKUNCI 100% ASLI & TIDAK BOLEH DIPOLES</strong>. AI hanya memoles Judul, Intro, dan Langkah Masak sensori untuk video.
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Masukkan daftar URL resep (satu baris per URL, maks 50):
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {importUrls.split('\n').filter(Boolean).length} URL terdeteksi
                </span>
              </div>
              <textarea
                value={importUrls}
                onChange={(e) => setImportUrls(e.target.value)}
                disabled={isImporting}
                style={{
                  width: '100%',
                  minHeight: '110px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: 1.5
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Gaya Foto (AI Prompt):
                </label>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                >
                  <option value="Food Porn">Food Porn (Mengkilap & Sizzling)</option>
                  <option value="Modern Fine Dining">Modern Fine Dining (Minimalis)</option>
                  <option value="Rustic Comfort Food">Rustic Comfort Food (Hangat)</option>
                  <option value="Top-Down Flatlay">Top-Down Flatlay (Editorial)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Jeda Antar URL (Anti-Bot):
                </label>
                <select
                  value={delayMode}
                  onChange={(e) => setDelayMode(e.target.value)}
                  disabled={isImporting}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                >
                  <option value="random-10-20">Acak 10 - 20 Detik (Rekomendasi Human Behavior)</option>
                  <option value="demo-fast">Simulasi Kilat Demo (1.5 - 2.5 Detik)</option>
                </select>
              </div>
            </div>

            {/* Progress Bar & Logging Terminal */}
            {isImporting && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{progressText}</span>
                  <span style={{ color: 'var(--action-primary)' }}>{progressPct}%</span>
                </div>
                <div style={{ backgroundColor: 'var(--surface-raised)', borderRadius: 'var(--radius-xs)', height: '8px', overflow: 'hidden', margin: '10px 0 8px 0' }}>
                  <div style={{ backgroundColor: 'var(--action-primary)', height: '100%', width: `${progressPct}%`, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{
                  backgroundColor: 'var(--canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}>
                  {importLogs.map((l, i) => (
                    <div key={i} style={{
                      color: l.type === 'success' ? 'var(--status-success)' : l.type === 'error' ? 'var(--status-danger)' : 'var(--text-secondary)',
                      marginBottom: '3px'
                    }}>
                      [{l.time}] {l.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
              >
                Batal
              </button>

              <button
                onClick={handleStartBatchImport}
                disabled={isImporting}
                style={{
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  opacity: isImporting ? 0.7 : 1
                }}
              >
                {isImporting ? 'Memproses Batch...' : '⚡ Mulai Impor Sekuensial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL RESEP */}
      {selectedRecipe && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--overlay-backdrop)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-modal)',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '26px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'var(--status-success-soft)',
                  color: 'var(--status-success)',
                  marginBottom: '6px'
                }}>
                  ✓ Pustaka Resep Otoritatif
                </span>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--action-primary)' }}>
                  {selectedRecipe.polished_title || selectedRecipe.original_title}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Judul Asli: <em>{selectedRecipe.original_title}</em> • Sumber: {selectedRecipe.source_domain || 'web'}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Intro / Summary */}
            {selectedRecipe.polished_summary && (
              <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--action-primary)', paddingLeft: '12px' }}>
                "{selectedRecipe.polished_summary}"
              </div>
            )}

            {/* Strict Guardrail Ingredients */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'var(--status-info-soft)',
                color: 'var(--status-info)',
                border: '1px solid var(--status-info)',
                marginBottom: '8px'
              }}>
                🔒 BAHAN ASLI 100% TERKUNCI (FROZEN - TANPA POLESAN AI)
              </div>
              <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px', marginTop: '6px' }}>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {Array.isArray(selectedRecipe.ingredients_raw) && selectedRecipe.ingredients_raw.length > 0 ? (
                    selectedRecipe.ingredients_raw.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))
                  ) : (
                    <li>(Daftar bahan terlampir pada tautan sumber asli)</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Instructions */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'var(--status-success-soft)',
                color: 'var(--status-success)',
                marginBottom: '8px'
              }}>
                ✨ LANGKAH MEMASAK TER-POLISH (AI SENSORY)
              </div>
              <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px', marginTop: '6px' }}>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {Array.isArray(selectedRecipe.polished_instructions) && selectedRecipe.polished_instructions.length > 0 ? (
                    selectedRecipe.polished_instructions.map((step, i) => (
                      <li key={i} style={{ marginBottom: '6px' }}>{step}</li>
                    ))
                  ) : Array.isArray(selectedRecipe.original_instructions) && selectedRecipe.original_instructions.length > 0 ? (
                    selectedRecipe.original_instructions.map((step, i) => (
                      <li key={i} style={{ marginBottom: '6px' }}>{step}</li>
                    ))
                  ) : (
                    <li>(Langkah memasak belum terstruktur)</li>
                  )}
                </ol>
              </div>
            </div>

            {/* Photo Prompt */}
            {Array.isArray(selectedRecipe.ai_photo_prompts) && selectedRecipe.ai_photo_prompts.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  📸 5-Layer Optical Stack AI Photo Prompt (Midjourney/FLUX):
                </label>
                <div style={{
                  backgroundColor: 'var(--canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}>
                  {selectedRecipe.ai_photo_prompts[0]}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedRecipe(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Tutup
              </button>

              <button
                onClick={() => {
                  handleLaunchVideo(selectedRecipe);
                  setSelectedRecipe(null);
                }}
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🎬 Buat Video dari Resep Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

