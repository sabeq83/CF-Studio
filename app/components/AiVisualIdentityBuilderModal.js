'use client';

import { useState, useEffect, useRef } from 'react';

const TRENDING_PRESETS = [
  {
    id: 'stickman',
    icon: '🎨',
    name: 'Stickman Doodles',
    tag: 'Explainer',
    prompt: 'Saya ingin visual identity gaya kartun stickman doodle minimalis yang ekspresif untuk edukasi bisnis, warna hitam putih dengan aksen kuning stabilo, karakter stickman dengan ekspresi wajah garis simpel memegang tablet atau laptop, latar belakang clean studio.'
  },
  {
    id: 'paper_cutout',
    icon: '📦',
    name: 'Paper Cutout Craft',
    tag: 'Tactile',
    prompt: 'Saya ingin gaya visual paper cutout layer bertumpuk nuansa kopi dan kuliner artisanal, tekstur kertas coklat craft dan off-white, pencahayaan lembut.'
  },
  {
    id: 'clay_3d',
    icon: '🧸',
    name: '3D Clay Mascot',
    tag: 'Stop-Motion',
    prompt: 'Saya ingin karakter maskot 3D claymation lucu seperti kucing barista dengan celemek barista, pencahayaan softbox studio, warna pastel lembut.'
  },
  {
    id: 'nordic_kitchen',
    icon: '☕',
    name: 'Nordic Kitchen Studio',
    tag: 'Clean Living',
    prompt: 'Saya ingin visual identity dapur modern Nordic minimalis, meja kayu oak dan marmer putih, pencahayaan alami jendela pagi, sangat estetik.'
  },
  {
    id: 'dark_moody',
    icon: '🎬',
    name: 'Dark Chiaroscuro',
    tag: 'Smoke & Meat',
    prompt: 'Saya ingin visual identity dark moody chiaroscuro dengan asap dramatis dan latar batu hitam slate untuk daging steak premium.'
  },
  {
    id: 'technical_blueprint',
    icon: '💻',
    name: 'Technical Blueprint',
    tag: 'Dev & Data',
    prompt: 'Saya ingin gaya visual blueprint teknis arsitektur berwarna biru navy dengan garis skematik putih dan cyan, monospaced font, untuk konten analisis AI dan fintech.'
  },
  {
    id: 'lofi_flash',
    icon: '📸',
    name: 'Lo-Fi 35mm Flash',
    tag: 'Candid UGC',
    prompt: 'Saya ingin gaya foto candid kamera analog 35mm dengan direct flash malam hari dan film grain tebal untuk street food viral dan review jujur.'
  },
  {
    id: 'isometric_diorama',
    icon: '📐',
    name: 'Isometric 3D World',
    tag: 'Miniature',
    prompt: 'Saya ingin gaya miniatur isometrik 3D diorama pulau mengambang dengan perkebunan kopi dan kota mini, pencahayaan tilt-shift lembut.'
  },
  {
    id: 'pop_risograph',
    icon: '🖨️',
    name: 'Pop Risograph',
    tag: 'Retro Halftone',
    prompt: 'Saya ingin gaya sablon cetak risograph retro dengan titik halftone vintage dan warna neon kontras tinggi seperti pink dan biru teal.'
  },
  {
    id: 'luminous_glass',
    icon: '💎',
    name: 'Luminous Glass',
    tag: 'Trend 2027',
    prompt: 'Saya ingin visual identity futuristik tren 2027 dengan material frosted glass tembus pandang, refraksi prisma pelangi, pendaran luminous cyan cair.'
  },
  {
    id: 'sumi_e_ink',
    icon: '🪵',
    name: 'Sumi-e Asian Ink',
    tag: 'Zen Tea',
    prompt: 'Saya ingin gaya lukisan kuas kaligrafi Sumi-e oriental tradisional dengan tinta hitam dinamis di atas kertas beras washi dan aksen stempel merah cinnabar.'
  },
  {
    id: 'vintage_scrapbook',
    icon: '📰',
    name: 'Vintage Scrapbook',
    tag: 'Investigation',
    prompt: 'Saya ingin gaya visual scrapbook koran investigasi retro tahun 70-an dengan sobekan kertas arsip, selotip transparan, dan lingkaran spidol merah.'
  }
];

export default function AiVisualIdentityBuilderModal({ onClose, onContinueEditing }) {
  const [userPrompt, setUserPrompt] = useState(TRENDING_PRESETS[0].prompt);
  const [activeChip, setActiveChip] = useState('stickman');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisStage, setSynthesisStage] = useState('');
  const [error, setError] = useState(null);

  // Proposal state
  const [proposal, setProposal] = useState(null);
  const [t2iPrompt, setT2iPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');

  // 🚀 Opsi A: 1-Kolom Vertikal State Control
  const [isComposeMode, setIsComposeMode] = useState(true);
  const [autoPreview, setAutoPreview] = useState(true);
  const modalBodyRef = useRef(null);

  // G-Labs Live Test Render state
  const [isRenderingGlabs, setIsRenderingGlabs] = useState(false);
  const [renderStage, setRenderStage] = useState('');
  const [renderedImageUrl, setRenderedImageUrl] = useState(null);
  const [renderError, setRenderError] = useState(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Inject CSS keyframes for pulseGlow and spin
  useEffect(() => {
    const styleId = 'ai-vi-builder-keyframes';
    if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const showToast = (title, desc) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSelectChip = (preset) => {
    setActiveChip(preset.id);
    setUserPrompt(preset.prompt);
  };

  // 1. AI Synthesis (Call Gemini 1-Pass)
  const handleSynthesize = async () => {
    const promptClean = userPrompt.trim();
    if (!promptClean) {
      setError('Silakan ketikkan konsep visual atau pilih salah satu ide tren di atas.');
      return;
    }

    setError(null);
    setIsSynthesizing(true);
    setSynthesisStage('🧠 Menganalisis ide konsep dan tone estetika...');

    try {
      setTimeout(() => {
        setSynthesisStage('📐 Memetakan ke Schema v2 Visual Identity (Faceless Invariant & Palet)...');
      }, 1000);

      setTimeout(() => {
        setSynthesisStage('✨ Merakit Production T2I Prompt untuk G-Labs...');
      }, 2200);

      const res = await fetch('/api/v2/visual-identities/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptClean })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menghasilkan usulan Visual Identity.');
      }

      setProposal(json.data);
      const generatedPrompt = json.data.t2i_prompt || '';
      setT2iPrompt(generatedPrompt);
      setRenderedImageUrl(null);
      setRenderError(null);

      // 🚀 KEY UX FIX: Collapse composer into compact bar
      setIsComposeMode(false);
      setTimeout(() => {
        modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);

      // 🚀 Auto-preview trigger if enabled
      if (autoPreview && generatedPrompt) {
        setTimeout(() => {
          handleRenderGlabs(generatedPrompt);
        }, 300);
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memanggil AI.');
    } finally {
      setIsSynthesizing(false);
      setSynthesisStage('');
    }
  };

  // 2. G-Labs Live Preview Generation
  const handleRenderGlabs = async (overridePrompt = null) => {
    const promptToUse = (typeof overridePrompt === 'string' ? overridePrompt : t2iPrompt)?.trim();
    if (!promptToUse) {
      setRenderError('Prompt T2I tidak boleh kosong.');
      return;
    }

    setRenderError(null);
    setIsRenderingGlabs(true);
    setRenderStage('Mengirim task ke Worker G-Labs Node 2...');

    try {
      setTimeout(() => {
        setRenderStage('Worker Node 2 GPU Rendering AI Image (Veo/Imagen)...');
      }, 3000);

      const res = await fetch('/api/v2/visual-identities/ai/test-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          aspect_ratio: aspectRatio
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Generasi gambar G-Labs gagal.');
      }

      setRenderedImageUrl(json.image_url);
      showToast('Render Berhasil! 🎨', 'Visual nyata berhasil dibuat oleh G-Labs Node 2.');
    } catch (err) {
      setRenderError(err.message || 'Gagal merender gambar di G-Labs.');
    } finally {
      setIsRenderingGlabs(false);
      setRenderStage('');
    }
  };

  // 3. Direct Save to Database
  const handleSaveDirect = async () => {
    if (!proposal) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/v2/visual-identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: proposal.label,
          description: proposal.description,
          preset_key: proposal.suggested_preset_key,
          config: proposal.config
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan preset.');
      }

      showToast('Preset Berhasil Disimpan! 🎉', `Visual Identity "${proposal.label}" siap digunakan di seluruh pipeline.`);
      setTimeout(() => {
        onClose();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1200);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan preset ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Continue in Standard Form
  const handleOpenStandardForm = () => {
    if (!proposal) return;
    if (onContinueEditing) {
      onContinueEditing(proposal.config, proposal.label, proposal.description);
    }
  };

  const handleCopyPrompt = () => {
    if (!t2iPrompt) return;
    navigator.clipboard.writeText(t2iPrompt);
    showToast('Prompt Disalin! 📋', 'Production prompt siap digunakan di tools eksternal.');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg, 16px)',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-raised)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'var(--status-info-soft)',
                border: '1px solid var(--status-info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: 'var(--status-info)'
              }}
            >
              ✨
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                AI Visual Identity Studio Builder
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                1-Prompt Magic & Live Review via G-Labs (Node 2)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '22px',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm, 6px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Tutup Modal"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div
          ref={modalBodyRef}
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                borderRadius: 'var(--radius-sm, 8px)',
                color: 'var(--status-danger)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* STAGE 2: Compact Concept Bar (shown when proposal exists and composer is collapsed) */}
          {!isComposeMode && proposal && (
            <div
              style={{
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm, 8px)',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                <span>💡</span>
                <span>
                  Konsep Aktif:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {userPrompt.slice(0, 65)}
                    {userPrompt.length > 65 ? '...' : ''}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeMode(true)}
                style={{
                  backgroundColor: 'var(--surface-interactive)',
                  color: 'var(--action-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition)'
                }}
              >
                <span>✏️</span> Ubah Konsep Ide
              </button>
            </div>
          )}

          {/* STAGE 1: Full Composer Card (Drafting Mode) */}
          {isComposeMode && (
            <div
              style={{
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-card)',
                transition: 'var(--transition)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💬</span> Konsep Ide Visual Anda
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Ketik bebas konsep visual, subjek, mood, dan palet warna
                </span>
              </div>

              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Contoh: Saya ingin visual identity gaya stickman minimalis untuk edukasi bisnis, warna hitam putih dengan aksen kuning stabilo..."
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  padding: '10px 14px',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  lineHeight: 1.5,
                  outline: 'none'
                }}
              />

              {/* Inspiration Chips: 12 Trends 2026-2027 */}
              <div
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>🔥</span> 12 Pilihan Ide Visual Cepat (Tren 2026-2027) :
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--status-warning-soft)',
                      color: 'var(--status-warning)'
                    }}
                  >
                    Tactile & Anti-AI Trends
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                    gap: '6px'
                  }}
                >
                  {TRENDING_PRESETS.map((p) => {
                    const isActive = activeChip === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectChip(p)}
                        style={{
                          backgroundColor: isActive ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                          border: `1px solid ${isActive ? 'var(--status-info)' : 'var(--border-subtle)'}`,
                          color: isActive ? 'var(--status-info)' : 'var(--text-secondary)',
                          fontSize: '11px',
                          fontWeight: isActive ? 600 : 500,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm, 6px)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          transition: 'var(--transition)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          <span>{p.icon}</span>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{p.name}</span>
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: 'var(--radius-xs, 4px)',
                            backgroundColor: isActive ? 'var(--status-info)' : 'var(--surface)',
                            color: isActive ? 'var(--on-action-primary)' : 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          {p.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoPreview}
                    onChange={(e) => setAutoPreview(e.target.checked)}
                    style={{ accentColor: 'var(--action-primary)' }}
                  />
                  <span>⚡ Langsung render preview visual (G-Labs Node 2) setelah usulan dibuat</span>
                </label>
                <button
                  type="button"
                  onClick={handleSynthesize}
                  disabled={isSynthesizing}
                  style={{
                    background: 'linear-gradient(135deg, var(--action-primary), var(--status-info))',
                    color: 'var(--on-action-primary)',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSynthesizing ? 'not-allowed' : 'pointer',
                    opacity: isSynthesizing ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(45, 212, 191, 0.4)',
                    transition: 'var(--transition)'
                  }}
                >
                  <span>{isSynthesizing ? '⏳' : '✨'}</span>
                  <span>{isSynthesizing ? 'AI sedang merakit usulan...' : 'Generate Usulan Visual Identity (1-Click AI)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Synthesis Progress State */}
          {isSynthesizing && (
            <div
              style={{
                backgroundColor: 'var(--surface-interactive)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div
                style={{
                  height: '6px',
                  backgroundColor: 'var(--input-bg)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--action-primary), var(--status-info))',
                    width: '85%',
                    animation: 'pulse 1.5s infinite'
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {synthesisStage || 'Sedang memproses...'}
              </div>
            </div>
          )}

          {/* ==================================================================
               OPSI A: 1-KOLOM VERTIKAL DENGAN HERO PREVIEW DI ATAS
               ================================================================== */}
          {proposal && (
            <div
              style={{
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md, 12px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* 1. Header Usulan */}
              <div
                style={{
                  backgroundColor: 'var(--surface-interactive)',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div>
                  <div
                    style={{
                      backgroundColor: 'var(--status-success-soft)',
                      color: 'var(--status-success)',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '3px'
                    }}
                  >
                    <span>✨</span> Usulan Siap Direview
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {proposal.label}
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    preset_key: {proposal.suggested_preset_key}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  Schema v2 Compliant • Faceless Invariant Enforced
                </span>
              </div>

              {/* 2. 🌟 HERO SECTION: CONTROL BAR & KANVAS PREVIEW LANGSUNG DI ATAS (Y ~110px) 🌟 */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: 'var(--surface)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    backgroundColor: 'var(--surface-interactive)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    padding: '8px 12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Rasio:</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {['9:16', '1:1', '16:9'].map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          style={{
                            backgroundColor: aspectRatio === ratio ? 'var(--action-primary)' : 'var(--input-bg)',
                            color: aspectRatio === ratio ? 'var(--on-action-primary)' : 'var(--text-secondary)',
                            border: `1px solid ${aspectRatio === ratio ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-xs, 4px)',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 🌟 TOMBOL GENERATE BERPENDAR MENYALA 🌟 */}
                  <button
                    type="button"
                    onClick={() => handleRenderGlabs()}
                    disabled={isRenderingGlabs}
                    style={{
                      background: 'linear-gradient(135deg, var(--status-success), var(--action-primary))',
                      color: 'var(--on-action-primary)',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: isRenderingGlabs ? 'not-allowed' : 'pointer',
                      opacity: isRenderingGlabs ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(74, 222, 128, 0.45)',
                      animation: isRenderingGlabs ? 'none' : 'pulseGlow 2.5s infinite',
                      transition: 'var(--transition)'
                    }}
                  >
                    <span>{isRenderingGlabs ? '⏳' : '🎨'}</span>
                    <span>{isRenderingGlabs ? 'Rendering di G-Labs...' : 'Generate Visual Preview (G-Labs)'}</span>
                  </button>
                </div>

                {renderError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--status-danger-soft)',
                      border: '1px solid var(--status-danger)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      color: 'var(--status-danger)',
                      fontSize: '12px'
                    }}
                  >
                    ⚠️ {renderError}
                  </div>
                )}

                {/* Preview Viewport Canvas */}
                <div
                  style={{
                    border: renderedImageUrl ? '1px solid var(--border-subtle)' : '2px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-md, 12px)',
                    backgroundColor: renderedImageUrl ? 'var(--canvas)' : 'var(--input-bg)',
                    minHeight: '290px',
                    maxHeight: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: renderedImageUrl ? '12px' : '20px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isRenderingGlabs ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          border: '3.5px solid var(--surface-interactive)',
                          borderTopColor: 'var(--action-primary)',
                          borderRadius: '50%',
                          animation: 'spin 0.9s linear infinite'
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {renderStage || 'Memproses generasi visual...'}
                        </div>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--status-info)', marginTop: '3px' }}>
                          Target: Node 2 Worker (Port 8765)
                        </div>
                      </div>
                    </div>
                  ) : renderedImageUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                      <div
                        style={{
                          maxWidth: aspectRatio === '9:16' ? '260px' : aspectRatio === '1:1' ? '310px' : '360px',
                          width: '100%',
                          borderRadius: 'var(--radius-sm, 8px)',
                          overflow: 'hidden',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--surface)',
                          transition: 'max-width 0.25s ease'
                        }}
                      >
                        <img
                          src={renderedImageUrl}
                          alt="G-Labs Preview Render"
                          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '260px', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '500px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
                          onClick={() => handleRenderGlabs()}
                          style={{
                            backgroundColor: 'var(--surface-interactive)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '5px 12px',
                            borderRadius: 'var(--radius-sm, 6px)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>🔄</span> Render Variasi Lain
                        </button>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                          Status: Render Sukses via G-Labs
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center', maxWidth: '440px' }}>
                      <span style={{ fontSize: '32px', opacity: 0.8 }}>🖼️</span>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Review Visual Belum Dibuat
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                        Tekan tombol <strong>"Generate Visual Preview (G-Labs)"</strong> di atas untuk merender visual nyata dari prompt ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRenderGlabs()}
                        style={{
                          marginTop: '6px',
                          backgroundColor: 'var(--surface-interactive)',
                          border: '1px solid var(--action-primary)',
                          color: 'var(--action-primary)',
                          padding: '7px 16px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'var(--transition)'
                        }}
                      >
                        <span>🎨</span> Klik untuk Generate Preview Visual
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. SPESIFIKASI & PROMPT T2I DI BAWAH KANVAS PREVIEW */}
              <div
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* 4 Atribut Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '8px'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                      Visual Mode
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proposal.config?.visual_language?.primary_style || 'Standard'}
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                      Subject System
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proposal.config?.subject?.kind} ({proposal.config?.subject?.faceless_mode})
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                      Environment
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proposal.config?.environment?.preset_key || 'Custom Setting'}
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                      Lighting & Cam
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proposal.config?.lighting?.preset_key} • {proposal.config?.camera?.framing}
                    </span>
                  </div>
                </div>

                {/* Production T2I Prompt Box */}
                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📝</span> Production T2I Prompt
                      <span
                        style={{
                          backgroundColor: 'var(--status-info-soft)',
                          color: 'var(--status-info)',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs, 4px)'
                        }}
                      >
                        G-Labs Ready
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      style={{
                        backgroundColor: 'var(--surface-interactive)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs, 4px)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>📋</span> Salin
                    </button>
                  </div>

                  <textarea
                    value={t2iPrompt}
                    onChange={(e) => setT2iPrompt(e.target.value)}
                    rows={2}
                    title="Prompt ini dapat Anda edit secara langsung sebelum melakukan render di G-Labs"
                    style={{
                      width: '100%',
                      height: '70px',
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs, 4px)',
                      padding: '8px 10px',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '11.5px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      resize: 'vertical',
                      outline: 'none'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    <span>💡 Tip: Anda dapat mengedit teks prompt di atas secara bebas.</span>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--status-success)', fontWeight: 600 }}>
                      Face Invariant: Enforced
                    </span>
                  </div>
                </div>

                {/* Rationale Box */}
                {proposal.creative_rationale && (
                  <div
                    style={{
                      backgroundColor: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm, 8px)',
                      padding: '10px 14px'
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                      💡 Alasan Desain Estetika (Rationale):
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px', lineHeight: 1.5 }}>
                      "{proposal.creative_rationale}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-raised)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => {
                setProposal(null);
                setT2iPrompt('');
                setRenderedImageUrl(null);
                setRenderError(null);
                setIsComposeMode(true);
              }}
              style={{
                backgroundColor: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)'
              }}
            >
              <span>🔄</span> Buat Usulan Baru
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleOpenStandardForm}
              disabled={!proposal}
              style={{
                backgroundColor: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: proposal ? 'pointer' : 'not-allowed',
                opacity: proposal ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)'
              }}
            >
              <span>✏️</span> Kustomisasi Lanjut di Form
            </button>

            <button
              type="button"
              onClick={handleSaveDirect}
              disabled={!proposal || isSaving}
              style={{
                backgroundColor: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 700,
                padding: '7px 18px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: proposal && !isSaving ? 'pointer' : 'not-allowed',
                opacity: proposal && !isSaving ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 4px 12px rgba(45, 212, 191, 0.3)',
                transition: 'var(--transition)'
              }}
            >
              <span>💾</span>
              <span>{isSaving ? 'Menyimpan...' : 'Simpan sebagai Visual Identity'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-modal)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md, 12px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.25s ease'
          }}
        >
          <span style={{ fontSize: '20px' }}>✅</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {toastMessage.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {toastMessage.desc}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
