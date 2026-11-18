'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import CandidateDetailDrawer from './CandidateDetailDrawer';
import styles from './product-radar.module.css';
import {
  formatRp,
  formatObservedDate,
  getDisplayName,
  getDisplayCategory,
  getDisplayBrand,
  labelTrend,
  trendTone,
  labelUrlStatus,
  urlStatusTone,
  labelCurationStatus,
  curationStatusTone,
  labelProcessStatus,
  processStatusTone,
  extractDomainHint
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

export default function ProductRadarPage() {
  const [batches, setBatches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [batchId, setBatchId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [trend, setTrend] = useState('all');
  const [urlStatus, setUrlStatus] = useState('all');
  const [curationStatus, setCurationStatus] = useState('all');
  const [processStatus, setProcessStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Detail Drawer & Toast
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return undefined;
    const t = setTimeout(() => setToastMsg(''), 3600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (batchId) params.set('batch_id', batchId);
      if (category !== 'all') params.set('category', category);
      if (trend !== 'all') params.set('trend', trend);
      if (urlStatus !== 'all') params.set('url_status', urlStatus);
      if (curationStatus !== 'all') params.set('curation_status', curationStatus);
      if (processStatus !== 'all') params.set('process_status', processStatus);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/v2/product-research/candidates?${params.toString()}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat Radar Produk.');
      }

      setBatches(data.batches || []);
      if (!batchId && data.active_batch_id) {
        setBatchId(data.active_batch_id);
      }
      setCategories(data.categories || []);
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit, total: 0, totalPages: 1 });
      setSummary(data.summary || {});
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [batchId, category, trend, urlStatus, curationStatus, processStatus, search, page, limit]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const activeBatchObj = batches.find(b => b.id === batchId) || batches[0] || null;
  const observationLabel = activeBatchObj
    ? `Angka dari screenshot per tanggal ${formatObservedDate(activeBatchObj.observed_at || activeBatchObj.synced_at)}, bukan data real-time`
    : 'Angka berasal dari tanggal screenshot riset TeleRadar, bukan data real-time';

  const resetFilters = () => {
    setSearch('');
    setCategory('all');
    setTrend('all');
    setUrlStatus('all');
    setCurationStatus('all');
    setProcessStatus('all');
    setPage(1);
    if (batches[0]?.id) setBatchId(batches[0].id);
  };

  const activeIndex = items.findIndex(i => i.id === activeCandidateId);
  const navigateDrawer = (delta) => {
    if (activeIndex < 0) return;
    const target = items[activeIndex + delta];
    if (target) setActiveCandidateId(target.id);
  };

  const handlePromotePlaceholder = (candidate) => {
    showToast(`Kandidat "${getDisplayName(candidate)}" siap dipromosikan (URL valid). Jalur antrean promosi diaktifkan pada Tahap 5.`);
  };

  const readyUrlCount = (summary.url_official || 0) + (summary.url_listing || 0) + (summary.url_user || 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className={styles.container}>
          {/* Page Header */}
          <section className={styles.pageHeader}>
            <div>
              <div className={styles.titleRow}>
                <h1 className={styles.pageTitle}>📡 Radar Produk</h1>
                <span className={`${styles.pill} ${styles.pillSuccess}`}>
                  Hasil TeleRadar → Kurasi CF Studio
                </span>
              </div>
              <p className={styles.pageSubtitle}>
                Temukan, kurasi, lalu masukkan produk pilihan ke katalog. Kandidat riset di sini belum masuk ke Product Database maupun pemilih kampanye.
              </p>
              <div className={styles.observationNotice}>
                <span>📸</span>
                <span>{observationLabel}</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Link href="/products" className={styles.btn}>
                📦 Buka Product Database
              </Link>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={fetchCandidates}
                disabled={loading}
              >
                {loading ? 'Memuat...' : '↻ Muat Ulang'}
              </button>
            </div>
          </section>

          {errorMsg && (
            <div className={`${styles.alertBox} ${styles.alertDanger}`}>
              <strong>Terjadi kendala:</strong> {errorMsg}
            </div>
          )}

          {/* KPI Summary Strip */}
          <section className={styles.kpiGrid} aria-label="Ringkasan Batch">
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Total Kandidat</div>
              <div className={styles.kpiValue}>{summary.total || 0}</div>
              <div className={styles.subNote}>
                {activeBatchObj ? `Batch ${activeBatchObj.external_batch_id}` : 'Belum ada batch'}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Sebaran Tren</div>
              <div className={styles.kpiValue}>{summary.trend_up || 0} Naik</div>
              <div className={styles.kpiBreakdown}>
                <button type="button" className={styles.chipFilter} onClick={() => { setTrend('up'); setPage(1); }}>
                  ↑ Naik ({summary.trend_up || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setTrend('stable'); setPage(1); }}>
                  → Stabil ({summary.trend_stable || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setTrend('down'); setPage(1); }}>
                  ↓ Menurun ({summary.trend_down || 0})
                </button>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Kecocokan URL</div>
              <div className={styles.kpiValue}>{readyUrlCount} Siap URL</div>
              <div className={styles.kpiBreakdown}>
                <button type="button" className={styles.chipFilter} onClick={() => { setUrlStatus('official'); setPage(1); }}>
                  Resmi ({summary.url_official || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setUrlStatus('listing'); setPage(1); }}>
                  Listing ({summary.url_listing || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setUrlStatus('nearest'); setPage(1); }}>
                  Terdekat ({summary.url_nearest || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setUrlStatus('not_found'); setPage(1); }}>
                  Tdk Ditemukan ({summary.url_not_found || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setUrlStatus('user'); setPage(1); }}>
                  Pengguna ({summary.url_user || 0})
                </button>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Status Masuk Katalog</div>
              <div className={styles.kpiValue}>{summary.process_in_catalog || 0} Masuk</div>
              <div className={styles.kpiBreakdown}>
                <button type="button" className={styles.chipFilter} onClick={() => { setProcessStatus('not_sent'); setPage(1); }}>
                  Belum ({summary.process_not_sent || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setProcessStatus('needs_review'); setPage(1); }}>
                  Review ({summary.process_needs_review || 0})
                </button>
                <button type="button" className={styles.chipFilter} onClick={() => { setProcessStatus('in_catalog'); setPage(1); }}>
                  Masuk ({summary.process_in_catalog || 0})
                </button>
              </div>
            </div>
          </section>

          {/* Filters */}
          <section className={styles.filterCard} aria-label="Filter Kandidat">
            <div className={styles.filterGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterSearch">Cari Produk / Brand</label>
                <input
                  id="radarFilterSearch"
                  className={styles.formControl}
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Nama produk, brand, atau catatan..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterBatch">Batch / Tanggal</label>
                <select
                  id="radarFilterBatch"
                  className={styles.formControl}
                  value={batchId || 'all'}
                  onChange={(e) => { setBatchId(e.target.value); setPage(1); }}
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.external_batch_id} ({b.candidate_count})
                    </option>
                  ))}
                  <option value="all">Semua Batch</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterCategory">Kategori</label>
                <select
                  id="radarFilterCategory"
                  className={styles.formControl}
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterTrend">Tren</label>
                <select
                  id="radarFilterTrend"
                  className={styles.formControl}
                  value={trend}
                  onChange={(e) => { setTrend(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Tren</option>
                  <option value="up">↑ Naik</option>
                  <option value="stable">→ Stabil</option>
                  <option value="down">↓ Menurun</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterUrlStatus">Status URL</label>
                <select
                  id="radarFilterUrlStatus"
                  className={styles.formControl}
                  value={urlStatus}
                  onChange={(e) => { setUrlStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Status URL</option>
                  <option value="official">Resmi</option>
                  <option value="listing">Listing</option>
                  <option value="nearest">Terdekat</option>
                  <option value="not_found">Tidak ditemukan</option>
                  <option value="user">Dari pengguna</option>
                  <option value="not_researched">Belum diriset</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterCuration">Status Kurasi</label>
                <select
                  id="radarFilterCuration"
                  className={styles.formControl}
                  value={curationStatus}
                  onChange={(e) => { setCurationStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Kurasi</option>
                  <option value="new">Baru</option>
                  <option value="needs_info">Perlu dilengkapi</option>
                  <option value="ready">Siap diajukan</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarFilterProcess">Status Katalog</label>
                <select
                  id="radarFilterProcess"
                  className={styles.formControl}
                  value={processStatus}
                  onChange={(e) => { setProcessStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Proses</option>
                  <option value="not_sent">Belum dikirim</option>
                  <option value="queued">Antre</option>
                  <option value="processing">Diproses</option>
                  <option value="in_catalog">Masuk katalog</option>
                  <option value="needs_review">Perlu review</option>
                  <option value="failed">Gagal</option>
                </select>
              </div>
            </div>

            <div className={styles.filterFooter}>
              <div>
                Menampilkan {items.length} dari {pagination.total} kandidat
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Per halaman:</span>
                  <select
                    className={styles.formControl}
                    style={{ width: 'auto', height: '30px', padding: '2px 8px' }}
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={resetFilters}>
                  Reset Filter
                </button>
              </div>
            </div>
          </section>

          {/* Table */}
          <section className={styles.tableCard} aria-label="Tabel Kandidat Radar Produk">
            <div className={styles.tableScroll}>
              <table className={styles.radarTable}>
                <thead>
                  <tr>
                    <th style={{ width: '66px' }}>Foto</th>
                    <th style={{ minWidth: '220px' }}>Nama Produk</th>
                    <th>Kategori</th>
                    <th>Terjual / mgg</th>
                    <th>Tren</th>
                    <th>Komisi</th>
                    <th>Harga</th>
                    <th>Kecocokan URL</th>
                    <th>Status Kurasi</th>
                    <th>Status Proses</th>
                    <th style={{ minWidth: '185px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Memuat daftar kandidat Radar Produk...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        {batches.length === 0
                          ? 'Belum ada batch riset dari TeleRadar untuk tenant ini. Batch yang dikirim lewat API ingest akan muncul di sini untuk dikurasi.'
                          : 'Tidak ada kandidat yang cocok dengan filter saat ini.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => {
                      const rd = c.research_data || {};
                      const domainHint = extractDomainHint(c.effective_url);
                      const imgUrl = c.thumb_api_url || c.screenshot_api_url;

                      return (
                        <tr key={c.id} onClick={() => setActiveCandidateId(c.id)}>
                          <td>
                            <div className={styles.thumbBox} title="Foto pengenal screenshot TeleRadar">
                              {imgUrl ? (
                                <img src={imgUrl} alt={getDisplayName(c)} className={styles.thumbImg} />
                              ) : (
                                <span>📦</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.prodName}>{getDisplayName(c)}</div>
                            <div className={styles.prodSub}>
                              <span>
                                {rd.rank ? `#${rd.rank}` : ''}
                                {getDisplayBrand(c) ? ` · ${getDisplayBrand(c)}` : ''}
                              </span>
                              {c.duplicate_match && !c.cf_product_id && (
                                <span className={`${styles.badge} ${styles.badgeInfo}`}>Duplikat URL</span>
                              )}
                              {c.revision > 1 && (
                                <span className={`${styles.badge} ${styles.badgeNeutral}`}>Diedit kurator</span>
                              )}
                            </div>
                          </td>
                          <td>{getDisplayCategory(c)}</td>
                          <td>
                            <div className={styles.numStrong}>
                              {rd.sold_per_week != null ? Number(rd.sold_per_week).toLocaleString('id-ID') : '—'}
                            </div>
                            <div className={styles.subNote}>
                              per {formatObservedDate(c.observed_at || c.external_batch_id)}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${toneClass(trendTone(rd.trend))}`}>
                              {labelTrend(rd.trend)} {rd.trend_delta ? `(${rd.trend_delta})` : ''}
                            </span>
                          </td>
                          <td>
                            <div className={styles.numStrong}>
                              {rd.commission_pct != null ? `${rd.commission_pct}%` : '—'}
                            </div>
                          </td>
                          <td className={styles.numStrong}>{formatRp(rd.price)}</td>
                          <td>
                            <span className={`${styles.badge} ${toneClass(urlStatusTone(c.url_status))}`}>
                              {labelUrlStatus(c.url_status)}
                            </span>
                            <div className={styles.subNote} style={{ marginTop: '3px' }}>{domainHint}</div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${toneClass(curationStatusTone(c.curation_status))}`}>
                              {labelCurationStatus(c.curation_status)}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${toneClass(processStatusTone(c.process_status))}`}>
                              {labelProcessStatus(c.process_status)}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className={styles.actionCell}>
                              {c.cf_product_id ? (
                                <Link
                                  href={`/products?search=${encodeURIComponent(c.catalog_product?.product_name || getDisplayName(c))}`}
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnSuccess}`}
                                >
                                  ↗ Buka Produk
                                </Link>
                              ) : c.url_blocked ? (
                                <>
                                  <div className={styles.actionRow}>
                                    <button
                                      type="button"
                                      className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                                      disabled
                                      title="Pilih listing yang tepat dulu (status Terdekat / Tidak ditemukan)"
                                    >
                                      Masukkan
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.btn} ${styles.btnSm} ${styles.btnWarning}`}
                                      onClick={() => setActiveCandidateId(c.id)}
                                    >
                                      Lengkapi URL
                                    </button>
                                  </div>
                                  <span className={styles.disabledHint}>
                                    {c.url_status === 'nearest'
                                      ? 'Terdekat: belum terbukti sama, pilih listing dulu'
                                      : 'URL belum tersedia'}
                                  </span>
                                </>
                              ) : c.duplicate_match ? (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnInfo}`}
                                  onClick={() => handlePromotePlaceholder(c)}
                                >
                                  🔗 Hubungkan
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                                  onClick={() => handlePromotePlaceholder(c)}
                                >
                                  + Masukkan ke Database
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.paginationBar}>
              <div>
                Halaman {pagination.page} dari {pagination.totalPages} (Total {pagination.total} kandidat)
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSm}`}
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSm}`}
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <CandidateDetailDrawer
        candidateId={activeCandidateId}
        onClose={() => setActiveCandidateId(null)}
        onNavigate={navigateDrawer}
        canPrev={activeIndex > 0}
        canNext={activeIndex >= 0 && activeIndex < items.length - 1}
        onUpdated={() => fetchCandidates()}
        onToast={showToast}
        onRequestPromotePlaceholder={handlePromotePlaceholder}
      />

      {toastMsg && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
