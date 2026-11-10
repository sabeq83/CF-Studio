'use client';

import React, { useState, useEffect } from 'react';

/**
 * ThreadsSeriesForm
 * Formulir konfigurasi interaktif untuk Mesin Utas Berseri (Threads Series / Kultwit 3–5 Part)
 * 100% Semantic CSS Tokens, adaptif Light & Dark Mode.
 */
export default function ThreadsSeriesForm({
  objective,
  setObjective,
  personalProductName,
  setPersonalProductName,
  personalProductCta,
  setPersonalProductCta,
  affiliateProductTitle,
  setAffiliateProductTitle,
  affiliateProductLink,
  setAffiliateProductLink,
  pureOrganicTopic,
  setPureOrganicTopic,
  visualMode,
  setVisualMode,
  selectedAccountId,
  setSelectedAccountId,
  replizAccounts = [],
  onSyncAccounts = null,
  isSyncingAccounts = false,
  recentPosts = []
}) {
  const [selectedPostPreview, setSelectedPostPreview] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Filter akun ber-platform Threads
  const threadsAccounts = replizAccounts.filter(
    acc => String(acc.platform || '').toLowerCase() === 'threads'
  );

  useEffect(() => {
    if (!selectedAccountId && threadsAccounts.length > 0) {
      setSelectedAccountId(threadsAccounts[0].id || threadsAccounts[0].account_id);
    }
  }, [threadsAccounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    if (recentPosts.length > 0 && !selectedPostPreview) {
      setSelectedPostPreview(recentPosts[0]);
    }
  }, [recentPosts, selectedPostPreview]);

  const copyToClipboard = (text, index) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1.5px solid var(--status-info)',
      borderRadius: 'var(--radius-md)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.15rem'
    }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🧵</span>
          <span>Mesin Utas Berseri (Threads Series Autopilot)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '0.25rem 0.65rem',
            borderRadius: '9999px',
            background: 'var(--status-info-soft)',
            color: 'var(--status-info)',
            border: '1px solid var(--status-info)'
          }}>
            ⚡ Single-Pass 1-Call Gemini
          </span>
          {onSyncAccounts && (
            <button
              type="button"
              onClick={onSyncAccounts}
              disabled={isSyncingAccounts}
              style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: isSyncingAccounts ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>{isSyncingAccounts ? '⏳' : '🔄'}</span>
              <span>{isSyncingAccounts ? 'Menyinkronkan...' : 'Sinkron Akun Threads'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Baris Akun Threads */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Target Akun Threads:
          </label>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {threadsAccounts.length} akun Threads terhubung
          </span>
        </div>
        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            height: '40px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 0.85rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        >
          {threadsAccounts.length === 0 ? (
            <option value="">(Belum ada akun Threads terhubung — simpan sebagai draft)</option>
          ) : (
            threadsAccounts.map(acc => (
              <option key={acc.id || acc.account_id} value={acc.id || acc.account_id}>
                @{acc.username || acc.name || acc.id} ({acc.name || 'Akun Threads'})
              </option>
            ))
          )}
        </select>
      </div>

      {/* STEP 1: PILIHAN FORMAT TUJUAN POSTINGAN (3 Cards) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          1. Pilih Tujuan Postingan Utas:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[
            {
              key: 'personal_product',
              icon: '🏢',
              title: 'Produk Pribadi / Bisnis',
              desc: 'Kost, jasa, properti, atau brand sendiri. Soft selling + CTA direct DM/WhatsApp.',
              badge: 'Bisnis Sendiri'
            },
            {
              key: 'affiliate_shopee',
              icon: '🛒',
              title: 'Affiliate Shopee',
              desc: 'Tension masalah sehari-hari ➔ solusi produk rekomendasi + link affiliate di reply.',
              badge: 'Komisi Shopee'
            },
            {
              key: 'pure_organic',
              icon: '📖',
              title: 'Cerita Murni / Edukasi',
              desc: 'Edukasi, tips produktivitas, atau kultwit viral murni tanpa jualan.',
              badge: 'Dwell Time & Viral'
            }
          ].map(opt => {
            const isSelected = objective === opt.key;
            return (
              <div
                key={opt.key}
                onClick={() => setObjective(opt.key)}
                style={{
                  background: isSelected ? 'var(--surface-interactive)' : 'var(--surface)',
                  border: `1.5px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  transition: 'var(--transition)',
                  boxShadow: isSelected ? '0 0 0 1px var(--action-primary)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{opt.icon}</span>
                    <strong style={{ fontSize: '0.86rem', color: isSelected ? 'var(--action-primary)' : 'var(--text-primary)' }}>
                      {opt.title}
                    </strong>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: isSelected ? 'var(--action-primary)' : 'var(--surface-raised)',
                    color: isSelected ? 'var(--on-action-primary)' : 'var(--text-muted)'
                  }}>
                    {opt.badge}
                  </span>
                </div>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                  {opt.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 2: INPUT DINAMIS SESUAI TUJUAN */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        {objective === 'personal_product' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Nama Produk / Jasa Pribadi:
              </label>
              <input
                type="text"
                value={personalProductName}
                onChange={(e) => setPersonalProductName(e.target.value)}
                placeholder="Contoh: Kamar Deluxe Paviliun Sasya House..."
                style={{
                  height: '38px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Instruksi Call-To-Action (CTA Part 5):
              </label>
              <input
                type="text"
                value={personalProductCta}
                onChange={(e) => setPersonalProductCta(e.target.value)}
                placeholder="Contoh: DM @sasyahouse sekarang untuk info ketersediaan kamar & promo survei!"
                style={{
                  height: '38px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </>
        )}

        {objective === 'affiliate_shopee' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Judul Produk Rekomendasi (Shopee):
              </label>
              <input
                type="text"
                value={affiliateProductTitle}
                onChange={(e) => setAffiliateProductTitle(e.target.value)}
                placeholder="Contoh: Kasur Busa Orthopedic Anti Sakit Punggung..."
                style={{
                  height: '38px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Tautan Affiliate Shopee (Disertakan di Part 5):
              </label>
              <input
                type="text"
                value={affiliateProductLink}
                onChange={(e) => setAffiliateProductLink(e.target.value)}
                placeholder="Contoh: https://shope.ee/..."
                style={{
                  height: '38px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </>
        )}

        {objective === 'pure_organic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Topik Cerita Murni / Insight / Edukasi:
            </label>
            <input
              type="text"
              value={pureOrganicTopic}
              onChange={(e) => setPureOrganicTopic(e.target.value)}
              placeholder="Contoh: 5 Kebiasaan malam hari yang bikin kualitas tidur naik drastis..."
              style={{
                height: '38px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* STEP 3: SUMBER VISUAL MEDIA (HANYA 2 OPSI: G-LABS & TEXT-ONLY) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          2. Sumber Visual Media (Foto):
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div
            onClick={() => setVisualMode('glabs')}
            style={{
              background: visualMode === 'glabs' ? 'var(--surface-interactive)' : 'var(--surface)',
              border: `1.5px solid ${visualMode === 'glabs' ? 'var(--status-info)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              transition: 'var(--transition)'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🎨</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.86rem', color: visualMode === 'glabs' ? 'var(--status-info)' : 'var(--text-primary)' }}>
                G-Labs AI Image (Node 2)
              </strong>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Prompt T2I otomatis dari Gemini ➔ difusi fotorealistik di G-Labs
              </span>
            </div>
          </div>

          <div
            onClick={() => setVisualMode('none')}
            style={{
              background: visualMode === 'none' ? 'var(--surface-interactive)' : 'var(--surface)',
              border: `1.5px solid ${visualMode === 'none' ? 'var(--status-warning)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              transition: 'var(--transition)'
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🚫</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.86rem', color: visualMode === 'none' ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                Tanpa Foto (Text-Only)
              </strong>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Utas teks murni cepat (&lt; 3 detik) tanpa beban komputasi gambar
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PREVIEW HASIL GENERASI TERBARU (JIKA ADA RIWAYAT UTAS) */}
      {recentPosts.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              🧵 Riwayat Utas Berseri Terakhir ({recentPosts.length} Terdata):
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Klik untuk melihat detail per-babak
            </span>
          </div>

          {/* Selector Utas */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
            {recentPosts.slice(0, 5).map((p) => {
              const isSelected = selectedPostPreview?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPostPreview(p)}
                  style={{
                    background: isSelected ? 'var(--surface-interactive)' : 'var(--surface-raised)',
                    border: `1px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                    color: isSelected ? 'var(--action-primary)' : 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.theme ? (p.theme.slice(0, 24) + '...') : 'Utas Berseri'} · {p.visual_mode === 'glabs' ? '🎨' : '📝'}
                </button>
              );
            })}
          </div>

          {/* Detail Preview Utas Aktif */}
          {selectedPostPreview && (
            <div style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  {selectedPostPreview.theme || 'Utas Berseri 5-Part'}
                </strong>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  background: selectedPostPreview.status === 'scheduled' ? 'var(--status-success-soft)' : 'var(--status-info-soft)',
                  color: selectedPostPreview.status === 'scheduled' ? 'var(--status-success)' : 'var(--status-info)'
                }}>
                  {selectedPostPreview.status.toUpperCase()}
                </span>
              </div>

              {/* Rangkaian 5 Part */}
              {[
                { part: 1, role: 'Hook', text: selectedPostPreview.part_1_text },
                { part: 2, role: 'Problem', text: selectedPostPreview.part_2_text },
                { part: 3, role: 'Solution', text: selectedPostPreview.part_3_text },
                { part: 4, role: 'Proof', text: selectedPostPreview.part_4_text },
                { part: 5, role: 'CTA', text: selectedPostPreview.part_5_text }
              ].map((item) => (
                <div
                  key={item.part}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.55rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--action-primary)' }}>
                      Part {item.part} · {item.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.text, item.part)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedIndex === item.part ? 'var(--status-success)' : 'var(--text-muted)',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedIndex === item.part ? '✅ Disalin' : '📋 Salin'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
                    {item.text || '(Belum ada teks)'}
                  </p>
                </div>
              ))}

              {/* Foto Visual jika ada */}
              {selectedPostPreview.media_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
                  <img
                    src={selectedPostPreview.media_url}
                    alt="Visual Preview"
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Foto G-Labs AI
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Tercantum di Part 1 / Utas Utama
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
