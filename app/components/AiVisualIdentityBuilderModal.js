'use client';

import { useState } from 'react';

const TRENDING_PRESETS = [
  {
    id: 'stickman',
    icon: '🎨',
    name: 'Stickman Doodles',
    tag: 'Explainer',
    prompt: 'Saya ingin visual identity gaya stickman minimalis untuk edukasi bisnis, warna hitam putih dengan aksen kuning stabilo, karakter faceless memegang tablet atau laptop, latar belakang clean studio.'
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

  // G-Labs Live Test Render state
  const [isRenderingGlabs, setIsRenderingGlabs] = useState(false);
  const [renderStage, setRenderStage] = useState('');
  const [renderedImageUrl, setRenderedImageUrl] = useState(null);
  const [renderError, setRenderError] = useState(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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
      setT2iPrompt(json.data.t2i_prompt || '');
      setRenderedImageUrl(null);
      setRenderError(null);
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memanggil AI.');
    } finally {
      setIsSynthesizing(false);
      setSynthesisStage('');
    }
  };

  // 2. G-Labs Live Preview Generation
  const handleRenderGlabs = async () => {
    if (!t2iPrompt || !t2iPrompt.trim()) {
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
          prompt: t2iPrompt.trim(),
          aspect_ratio: aspectRatio
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Generasi gambar G-Labs gagal.');
      }

      setRenderedImageUrl(json.image_url);
      showToast('Render Berhasil!', 'Visual nyata berhasil dibuat oleh G-Labs Node 2.');
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
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg, 16px)',
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-raised)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2))',
                border: '1px solid rgba(14, 165, 233, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}
            >
              ✨
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                AI Visual Identity Studio Builder
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Ketik konsep visual santai atau pilih 12 ide tren 2026-2027. AI merakit konfigurasi lengkap dan prompt T2I untuk live review G-Labs.
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
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '22px'
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

          {/* Part 1: Magic Input Composer */}
          <div
            style={{
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: 'var(--shadow-card)'
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
                padding: '12px 14px',
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
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
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
                  <span>🔥</span> 12 Pilihan Ide Visual Cepat (Tren 2026 & Proyeksi 2027):
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--status-warning-soft)',
                    color: 'var(--status-warning)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  Tactile & Anti-AI Trends
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '8px'
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
                        fontSize: '12px',
                        fontWeight: isActive ? 600 : 500,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm, 6px)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                💡 Klik ide di atas atau ketik bebas konsep visual Anda sendiri.
              </span>
              <button
                type="button"
                onClick={handleSynthesize}
                disabled={isSynthesizing}
                style={{
                  background: 'linear-gradient(135deg, var(--action-primary), #6366f1)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSynthesizing ? 'not-allowed' : 'pointer',
                  opacity: isSynthesizing ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
                }}
              >
                <span>{isSynthesizing ? '⏳' : '✨'}</span>
                <span>{isSynthesizing ? 'AI sedang merakit usulan...' : 'Buat Usulan Visual Identity (1-Click AI)'}</span>
              </button>
            </div>
          </div>

          {/* AI Synthesis Progress State */}
          {isSynthesizing && (
            <div
              style={{
                backgroundColor: 'var(--surface-interactive)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
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
                    background: 'linear-gradient(90deg, var(--action-primary), #818cf8)',
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

          {/* Part 2: Interactive Proposal Card */}
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
              {/* Proposal Header */}
              <div
                style={{
                  backgroundColor: 'var(--surface-interactive)',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div>
                  <div
                    style={{
                      backgroundColor: 'var(--status-success-soft)',
                      color: 'var(--status-success)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginBottom: '4px'
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

              {/* Rationale */}
              {proposal.creative_rationale && (
                <div
                  style={{
                    padding: '14px 20px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-subtle)',
                    lineHeight: 1.6
                  }}
                >
                  "{proposal.creative_rationale}"
                </div>
              )}

              {/* Attributes Strip */}
              <div
                style={{
                  padding: '14px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Visual Mode
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {proposal.config?.visual_language?.primary_style || 'Standard'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Subject System
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {proposal.config?.subject?.kind} ({proposal.config?.subject?.faceless_mode})
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Environment
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {proposal.config?.environment?.preset_key || 'Custom Setting'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Lighting & Cam
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {proposal.config?.lighting?.preset_key} • {proposal.config?.camera?.framing}
                  </span>
                </div>
              </div>

              {/* T2I Prompt Box */}
              <div
                style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📝</span> Production T2I Prompt (English for G-Labs / Veo / Imagen)
                    <span
                      style={{
                        backgroundColor: 'var(--status-info-soft)',
                        color: 'var(--status-info)',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
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
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-xs, 4px)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📋</span> Salin Prompt
                  </button>
                </div>

                <textarea
                  value={t2iPrompt}
                  onChange={(e) => setT2iPrompt(e.target.value)}
                  rows={3}
                  title="Prompt ini dapat Anda edit secara langsung sebelum melakukan render di G-Labs"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '10px 12px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    💡 Tip: Anda dapat mengedit teks prompt di atas secara bebas sebelum menekan tombol render G-Labs.
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--status-success)' }}>
                    Face Invariant: Enforced
                  </span>
                </div>
              </div>

              {/* G-Labs Review Section */}
              <div
                style={{
                  padding: '20px',
                  backgroundColor: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    backgroundColor: 'var(--surface-interactive)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    padding: '10px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Aspek Rasio:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
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
                            cursor: 'pointer'
                          }}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRenderGlabs}
                    disabled={isRenderingGlabs}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isRenderingGlabs ? 'not-allowed' : 'pointer',
                      opacity: isRenderingGlabs ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <span>🎨</span>
                    <span>{isRenderingGlabs ? 'Rendering di G-Labs...' : 'Generate Visual Preview (G-Labs Node 2)'}</span>
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
                    minHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: renderedImageUrl ? '16px' : '24px',
                    position: 'relative'
                  }}
                >
                  {isRenderingGlabs ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          border: '4px solid var(--surface-interactive)',
                          borderTopColor: 'var(--action-primary)',
                          borderRadius: '50%',
                          animation: 'spin 0.9s linear infinite'
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {renderStage || 'Memproses generasi visual...'}
                        </div>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--status-info)', marginTop: '4px' }}>
                          Target: Node 2 Worker (Port 8765)
                        </div>
                      </div>
                    </div>
                  ) : renderedImageUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                      <div
                        style={{
                          maxWidth: aspectRatio === '9:16' ? '300px' : aspectRatio === '1:1' ? '380px' : '480px',
                          width: '100%',
                          borderRadius: 'var(--radius-sm, 8px)',
                          overflow: 'hidden',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: '#000000'
                        }}
                      >
                        <img
                          src={renderedImageUrl}
                          alt="G-Labs Preview Render"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={handleRenderGlabs}
                          style={{
                            backgroundColor: 'var(--surface-interactive)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm, 6px)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>🔄</span> Render Variasi Lain
                        </button>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                          G-Labs Live Render OK
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center', maxWidth: '420px' }}>
                      <span style={{ fontSize: '36px', opacity: 0.7 }}>🖼️</span>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Review Visual Belum Dibuat
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                        Klik tombol <strong>"Generate Visual Preview (G-Labs Node 2)"</strong> di atas untuk merender visual nyata dari prompt ini sebelum menyimpannya.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-raised)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => {
                setProposal(null);
                setT2iPrompt('');
                setRenderedImageUrl(null);
              }}
              style={{
                backgroundColor: 'var(--surface-interactive)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: 'pointer'
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
                fontSize: '13px',
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: proposal ? 'pointer' : 'not-allowed',
                opacity: proposal ? 1 : 0.5
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
                fontSize: '13px',
                fontWeight: 700,
                padding: '9px 20px',
                borderRadius: 'var(--radius-sm, 8px)',
                cursor: proposal && !isSaving ? 'pointer' : 'not-allowed',
                opacity: proposal && !isSaving ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
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
            bottom: '28px',
            right: '28px',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-modal)',
            padding: '14px 20px',
            borderRadius: 'var(--radius-md, 12px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
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
