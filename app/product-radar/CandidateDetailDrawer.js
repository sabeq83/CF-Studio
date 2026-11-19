'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './product-radar.module.css';
import {
  formatRp,
  formatObservedDate,
  formatDateTimeId,
  getDisplayName,
  getDisplayCategory,
  getDisplayBrand,
  labelTrend,
  labelUrlStatus,
  urlStatusTone,
  labelCurationStatus,
  curationStatusTone,
  labelProcessStatus,
  processStatusTone
} from './radar-labels';

function toneClass(tone) {
  const map = {
    success: styles.badgeSuccess,
    info: styles.badgeInfo,
    warning: styles.badgeWarning,
    danger: styles.badgeDanger,
    neutral: styles.badgeNeutral,
    muted: styles.badgeMuted
  };
  return map[tone] || styles.badgeMuted;
}

export default function CandidateDetailDrawer({
  candidateId,
  onClose,
  onNavigate,
  canPrev,
  canNext,
  onUpdated,
  onToast,
  onRequestPromote
}) {
  const [candidate, setCandidate] = useState(null);
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [targetUrl, setTargetUrl] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editUsp, setEditUsp] = useState('');
  const [editCurationStatus, setEditCurationStatus] = useState('new');

  const syncFormFromCandidate = useCallback((c) => {
    setCandidate(c);
    setTargetUrl(c.curated_data?.target_url || '');
    setEditName(c.curated_data?.name || c.research_data?.name || '');
    setEditDesc(c.curated_data?.description || c.research_data?.description || '');
    setEditUsp(c.curated_data?.usp || c.research_data?.usp || '');
    setEditCurationStatus(c.curation_status || 'new');
  }, []);

  const loadDetail = useCallback(async (id, { reconcileStatus = false } = {}) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const url = reconcileStatus
        ? `/api/v2/product-research/candidates/${encodeURIComponent(id)}/status`
        : `/api/v2/product-research/candidates/${encodeURIComponent(id)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat detail kandidat.');
      }
      syncFormFromCandidate(data.candidate);
      if (data.recovery) {
        setRecoveryInfo(data.recovery);
      } else {
        setRecoveryInfo(null);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [syncFormFromCandidate]);

  useEffect(() => {
    if (candidateId) {
      loadDetail(candidateId, { reconcileStatus: true });
    }
  }, [candidateId, loadDetail]);

  const handleSaveUrl = async () => {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      onToast?.('Masukkan URL listing e-commerce terlebih dahulu.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(candidate.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: trimmed,
          url_status: 'user',
          curation_status: candidate.curation_status === 'needs_info' ? 'ready' : candidate.curation_status,
          expected_revision: candidate.revision
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          setErrorMsg(data.error || 'Data telah diubah oleh kurator lain. Muat ulang detail.');
          return;
        }
        throw new Error(data.error || 'Gagal menyimpan URL listing.');
      }
      syncFormFromCandidate(data.candidate);
      onUpdated?.(data.candidate);
      onToast?.('URL listing diverifikasi & disimpan.');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCurator = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(candidate.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curated_data: {
            name: editName.trim(),
            description: editDesc.trim(),
            usp: editUsp.trim()
          },
          curation_status: editCurationStatus,
          expected_revision: candidate.revision
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          setErrorMsg(data.error || 'Data telah diubah oleh kurator lain. Muat ulang detail.');
          return;
        }
        throw new Error(data.error || 'Gagal menyimpan edit kurator.');
      }
      syncFormFromCandidate(data.candidate);
      onUpdated?.(data.candidate);
      onToast?.(`Edit kurator disimpan (Rev #${data.candidate.revision}).`);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!candidate) return;
    const willArchive = candidate.curation_status !== 'archived';
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(candidate.id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: willArchive })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memperbarui status arsip.');
      }
      syncFormFromCandidate(data.candidate);
      onUpdated?.(data.candidate);
      onToast?.(willArchive
        ? 'Kandidat diarsipkan. Produk katalog tidak dihapus.'
        : 'Kandidat dikeluarkan dari arsip.');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleProductRecovery = async (mode) => {
    const productId = candidate?.cf_product_id;
    if (!productId) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const endpoint = mode === 'photo'
        ? '/api/v2/products/regenerate-photos'
        : '/api/v2/products/re-enrich';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [productId] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengantrekan pemulihan produk.');
      }
      onToast?.(
        mode === 'photo'
          ? `Pemulihan foto studio diantrekan untuk produk ${productId} (tanpa scrape ulang).`
          : `Enrich AI diantrekan ulang untuk produk ${productId} (tanpa scrape ulang).`
      );
      await loadDetail(candidate.id, { reconcileStatus: true });
      onUpdated?.();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!candidateId) return null;

  const observedText = candidate?.observed_at
    ? formatObservedDate(candidate.observed_at)
    : (candidate?.external_batch_id || 'tanggal batch');

  const rd = candidate?.research_data || {};
  const previewImgUrl = candidate?.screenshot_api_url || candidate?.thumb_api_url || null;
  const isQueuedOrProcessing = ['queued', 'processing'].includes(candidate?.process_status);
  const needsRecovery = candidate?.process_status === 'needs_review' || recoveryInfo?.needed;

  return (
    <div
      className={styles.drawerBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Detail Kandidat Radar Produk"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={styles.drawerPanel}>
        <div className={styles.drawerHeader}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {loading ? 'Memuat detail...' : getDisplayName(candidate)}
              </h2>
              {candidate && (
                <>
                  <span className={`${styles.pill} ${styles.pillInfo}`}>
                    Batch {candidate.external_batch_id}
                  </span>
                  <span className={`${styles.pill} ${styles.pillWarning}`}>
                    Angka dari screenshot per {observedText}, bukan data real-time
                  </span>
                </>
              )}
            </div>
            {candidate && (
              <div className={styles.subNote} style={{ marginTop: '4px' }}>
                {rd.rank ? `Rank #${rd.rank} · ` : ''}
                {getDisplayBrand(candidate) ? `${getDisplayBrand(candidate)} · ` : ''}
                {getDisplayCategory(candidate)} · Revisi #{candidate.revision}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              disabled={!canPrev}
              onClick={() => onNavigate?.(-1)}
            >
              ↑ Prev
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              disabled={!canNext}
              onClick={() => onNavigate?.(1)}
            >
              ↓ Next
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              onClick={onClose}
            >
              ✕ Tutup
            </button>
          </div>
        </div>

        <div className={styles.drawerBody}>
          {errorMsg && (
            <div className={`${styles.alertBox} ${styles.alertDanger}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span>{errorMsg}</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={() => loadDetail(candidateId, { reconcileStatus: true })}
              >
                ↻ Muat Ulang
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat data kandidat...
            </div>
          ) : candidate ? (
            <>
              {/* 1. Screenshot Sumber vs Listing Tujuan */}
              <section className={styles.sectionBox}>
                <div className={styles.sectionTitle}>
                  <span>1. Screenshot Sumber vs Listing Tujuan</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`${styles.badge} ${toneClass(urlStatusTone(candidate.url_status))}`}>
                      {labelUrlStatus(candidate.url_status)}
                    </span>
                    <span className={`${styles.badge} ${toneClass(processStatusTone(candidate.process_status))}`}>
                      {labelProcessStatus(candidate.process_status)}
                    </span>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSm}`}
                      onClick={() => loadDetail(candidate.id, { reconcileStatus: true })}
                      title="Periksa status terbaru antrean scraper dan katalog"
                    >
                      ↻ Cek Status
                    </button>
                  </div>
                </div>

                {candidate.url_blocked && (
                  <div className={`${styles.alertBox} ${candidate.url_status === 'not_found' ? styles.alertDanger : styles.alertWarning}`}>
                    {candidate.url_status === 'nearest' ? (
                      <>
                        <strong>⚠️ Kecocokan Terdekat (Belum Terbukti Produk Sama):</strong> URL ini baru hasil pencarian produk mirip. Tombol <strong>Masukkan ke Database Produk</strong> dinonaktifkan sampai Anda memverifikasi atau memilih URL listing yang tepat.
                      </>
                    ) : (
                      <>
                        <strong>⛔ URL Belum Lengkap:</strong> Tempel URL listing Shopee/Tokopedia yang valid lalu klik Simpan & Verifikasi sebelum mempromosikan kandidat ini.
                      </>
                    )}
                  </div>
                )}

                {candidate.duplicate_match && !candidate.cf_product_id && (
                  <div className={`${styles.alertBox} ${styles.alertInfo}`}>
                    <strong>🔗 URL Sudah Ada di Katalog ({candidate.duplicate_match.cf_product_id}):</strong> &ldquo;{candidate.duplicate_match.product_name}&rdquo;. Menekan <strong>Hubungkan Produk</strong> akan menautkan riwayat riset tanpa menimpa deskripsi, foto, atau link afiliasi produk.
                  </div>
                )}

                {needsRecovery && candidate.cf_product_id && (
                  <div className={`${styles.alertBox} ${styles.alertWarning}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <strong>🛠 Perlu Review Pemulihan ({candidate.cf_product_id}):</strong> Produk sudah masuk ke Database Produk, namun tahap foto studio atau AI enrichment belum selesai. Gunakan aksi pemulihan produk (tanpa scrape ulang):
                      {recoveryInfo?.enrichment_error && (
                        <div className={styles.subNote} style={{ marginTop: '4px' }}>
                          Enrichment error: {recoveryInfo.enrichment_error}
                        </div>
                      )}
                      {recoveryInfo?.studio_polish_error && (
                        <div className={styles.subNote} style={{ marginTop: '2px' }}>
                          Studio polish error: {recoveryInfo.studio_polish_error}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnWarning}`}
                        disabled={saving}
                        onClick={() => handleProductRecovery('photo')}
                      >
                        🖼 Ulangi Foto Studio (Produk)
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnInfo}`}
                        disabled={saving}
                        onClick={() => handleProductRecovery('enrich')}
                      >
                        ✨ Jalankan Enrich AI (Produk)
                      </button>
                      <Link
                        href={`/products?search=${encodeURIComponent(candidate.catalog_product?.product_name || getDisplayName(candidate))}`}
                        className={`${styles.btn} ${styles.btnSm}`}
                      >
                        🔍 Buka Jendela Banding di Produk
                      </Link>
                    </div>
                  </div>
                )}

                <div className={styles.twoCol}>
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <span>📸 Sumber Screenshot ({candidate.batch_source})</span>
                      <span className={styles.subNote}>{observedText}</span>
                    </div>
                    <div className={styles.screenshotPreview}>
                      <div className={styles.screenshotThumbLg}>
                        {previewImgUrl ? (
                          <img
                            src={previewImgUrl}
                            alt={rd.name || 'Foto pengenal riset'}
                            className={styles.thumbImg}
                          />
                        ) : (
                          <span>📷 Tanpa Foto</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <strong>{rd.name || candidate.external_candidate_id}</strong>
                        <span>
                          Terjual/mgg: <strong>{rd.sold_per_week != null ? Number(rd.sold_per_week).toLocaleString('id-ID') : '—'}</strong> ({labelTrend(rd.trend)} {rd.trend_delta || ''})
                        </span>
                        <span>
                          Harga: <strong>{formatRp(rd.price)}</strong> · Komisi:{' '}
                          <strong>
                            {rd.commission_pct != null
                              ? `${rd.commission_pct}%${rd.commission_rp != null ? ` (±${formatRp(rd.commission_rp)})` : ''}`
                              : formatRp(rd.commission_rp)}
                          </strong>
                        </span>
                        <span className={styles.subNote}>
                          Foto pengenal dari riset — tidak disalin ke kolom foto katalog.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <span>🔗 Listing Tujuan (E-Commerce)</span>
                      <span className={styles.subNote}>Wajib terverifikasi</span>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="radarTargetUrlInput">
                        URL Listing Pilihan Kurator
                      </label>
                      <input
                        id="radarTargetUrlInput"
                        className={`${styles.formControl} ${styles.mono}`}
                        type="url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://shopee.co.id/... atau https://www.tokopedia.com/..."
                      />
                    </div>
                    {candidate.source_url && (
                      <div className={styles.subNote} style={{ wordBreak: 'break-all' }}>
                        URL dari riset:{' '}
                        <a href={candidate.source_url} target="_blank" rel="noreferrer">
                          {candidate.source_url}
                        </a>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                        disabled={saving}
                        onClick={handleSaveUrl}
                      >
                        ✓ Simpan & Tandai Terverifikasi
                      </button>
                      {candidate.source_url && !targetUrl.trim() && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm}`}
                          disabled={saving}
                          onClick={() => setTargetUrl(candidate.source_url)}
                        >
                          Salin URL Riset ke Input
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {candidate.catalog_product && (
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <span>📦 Perbandingan Katalog Aktif ({candidate.catalog_product.id})</span>
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Product & Geometric Truth (EN)</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>Nama di Katalog:</strong> {candidate.catalog_product.product_name}</div>
                      {candidate.catalog_product.product_truth && (
                        <div><strong>Product Truth:</strong> {candidate.catalog_product.product_truth}</div>
                      )}
                      {candidate.catalog_product.geometric_truth && (
                        <div><strong>Geometric Truth:</strong> {candidate.catalog_product.geometric_truth}</div>
                      )}
                      <div className={styles.subNote}>
                        Photo: {candidate.catalog_product.photo_status || '—'} · Enrich: {candidate.catalog_product.enrichment_status || '—'} · Teks hasil scrape di katalog tidak menimpa edit kurator Anda.
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* 2. Riset Asli vs Edit Kurator */}
              <section className={styles.sectionBox}>
                <div className={styles.sectionTitle}>
                  <span>2. Riset Asli vs Edit Kurator</span>
                  <span className={`${styles.badge} ${toneClass(curationStatusTone(candidate.curation_status))}`}>
                    {labelCurationStatus(candidate.curation_status)}
                  </span>
                </div>
                <div className={styles.twoCol}>
                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <span>🤖 Hasil Riset Asli (Read-Only)</span>
                      <span className={styles.subNote}>Aman saat sinkron ulang</span>
                    </div>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Nama:</strong> {rd.name || '—'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {rd.description || 'Tidak ada deskripsi riset.'}
                    </div>
                    <pre className={styles.preBox}>
                      {rd.usp || 'Belum ada catatan USP dari riset.'}
                    </pre>
                    {rd.trend_note && (
                      <div className={styles.subNote}>
                        <strong>Catatan Tren:</strong> {rd.trend_note}
                      </div>
                    )}
                  </div>

                  <div className={styles.subCard}>
                    <div className={styles.subCardTitle}>
                      <span>✍️ Edit Kurator</span>
                      <span className={styles.subNote}>Rev #{candidate.revision}</span>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="radarEditName">Nama Kurasi</label>
                      <input
                        id="radarEditName"
                        className={styles.formControl}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="radarEditDesc">Deskripsi Kurasi</label>
                      <textarea
                        id="radarEditDesc"
                        className={styles.formTextarea}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="radarEditUsp">USP Kurasi</label>
                      <textarea
                        id="radarEditUsp"
                        className={styles.formTextarea}
                        value={editUsp}
                        onChange={(e) => setEditUsp(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
                      <div className={styles.fieldGroup} style={{ flex: 1, minWidth: '140px' }}>
                        <label className={styles.fieldLabel} htmlFor="radarEditCurationStatus">Status Kurasi</label>
                        <select
                          id="radarEditCurationStatus"
                          className={styles.formControl}
                          value={editCurationStatus}
                          onChange={(e) => setEditCurationStatus(e.target.value)}
                        >
                          <option value="new">Baru</option>
                          <option value="needs_info">Perlu dilengkapi</option>
                          <option value="ready">Siap diajukan</option>
                          <option value="archived">Diarsipkan</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                        disabled={saving}
                        onClick={handleSaveCurator}
                      >
                        💾 Simpan Edit Kurator
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Riwayat Proses */}
              <section className={styles.sectionBox}>
                <div className={styles.sectionTitle}>
                  <span>3. Riwayat Proses</span>
                  <span className={styles.subNote}>Jejak tindakan kandidat</span>
                </div>
                <div className={styles.historyList}>
                  <div className={styles.historyItem}>
                    <span className={styles.historyTime}>{formatDateTimeId(candidate.synced_at || candidate.created_at)}</span>
                    <span>Disinkronkan dari {candidate.batch_source} (batch {candidate.external_batch_id})</span>
                  </div>
                  {(candidate.imports || []).map((imp) => (
                    <div key={imp.id} className={styles.historyItem}>
                      <span className={styles.historyTime}>{formatDateTimeId(imp.created_at)}</span>
                      <span>
                        Aksi <strong>{imp.action}</strong> · status <strong>{imp.status}</strong>
                        {imp.requested_by ? ` oleh ${imp.requested_by}` : ''}
                        {imp.reserved_product_id ? ` (ID: ${imp.reserved_product_id})` : ''}
                        {imp.job_id ? ` (Job: ${imp.job_id})` : ''}
                        {imp.error ? ` — ${imp.error}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        {candidate && (
          <div className={styles.drawerFooter}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                disabled={saving}
                onClick={handleToggleArchive}
              >
                🗄 {candidate.curation_status === 'archived' ? 'Keluarkan dari Arsip' : 'Arsipkan Kandidat'}
              </button>
              <span className={styles.subNote}>Arsip tidak menghapus produk katalog.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {candidate.cf_product_id ? (
                <Link
                  href={`/products?search=${encodeURIComponent(candidate.catalog_product?.product_name || getDisplayName(candidate))}`}
                  className={`${styles.btn} ${styles.btnSuccess}`}
                >
                  ↗ Buka di Database Produk
                </Link>
              ) : isQueuedOrProcessing ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnInfo}`}
                  onClick={() => loadDetail(candidate.id, { reconcileStatus: true })}
                >
                  ⏳ {labelProcessStatus(candidate.process_status)} · Cek Status
                </button>
              ) : candidate.duplicate_match ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnInfo}`}
                  disabled={candidate.url_blocked || saving}
                  onClick={() => onRequestPromote?.(candidate)}
                >
                  🔗 Hubungkan Produk yang Sudah Ada
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={candidate.url_blocked || saving}
                  title={candidate.url_blocked
                    ? 'Pilih & verifikasi URL listing terlebih dahulu'
                    : 'Masukkan kandidat ini ke Database Produk'}
                  onClick={() => onRequestPromote?.(candidate)}
                >
                  {candidate.process_status === 'failed'
                    ? '↻ Coba Lagi Masukkan ke Database'
                    : '+ Masukkan ke Database Produk'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
