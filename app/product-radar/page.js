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
  extractDomainHint,
  scoreTierTone,
  formatSignedDelta
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
  const [sortBy, setSortBy] = useState('rank');
  const [showFormula, setShowFormula] = useState(false);
  const [expandedScoreIds, setExpandedScoreIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Detail Drawer, Single Confirmation, Bulk Selection & Toast
  const [activeCandidateId, setActiveCandidateId] = useState(null);
  const [confirmCandidate, setConfirmCandidate] = useState(null);
  const [promoting, setPromoting] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkLoadingPreview, setBulkLoadingPreview] = useState(false);
  const [bulkExecuting, setBulkExecuting] = useState(false);
  const [trackedQueueItems, setTrackedQueueItems] = useState([]);

  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return undefined;
    const t = setTimeout(() => setToastMsg(''), 4000);
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
      if (sortBy && sortBy !== 'rank') params.set('sort_by', sortBy);
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
  }, [batchId, category, trend, urlStatus, curationStatus, processStatus, sortBy, search, page, limit]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Poll status otomatis untuk kandidat yang masih queued/processing
  useEffect(() => {
    const pendingItems = items.filter(i => ['queued', 'processing'].includes(i.process_status));
    if (pendingItems.length === 0) return undefined;

    const timer = setInterval(async () => {
      try {
        const statusResponses = await Promise.all(
          pendingItems.slice(0, 5).map(async item => {
            const r = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(item.id)}/status`, { cache: 'no-store' });
            return r.ok ? r.json() : null;
          })
        );
        setTrackedQueueItems(prev => prev.map(q => {
          const updated = statusResponses.find(s => s?.candidate?.id === q.candidate_id);
          return updated ? { ...q, process_status: updated.candidate.process_status } : q;
        }));
        await fetchCandidates();
      } catch {}
    }, 6000);

    return () => clearInterval(timer);
  }, [items, fetchCandidates]);

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
    setSortBy('rank');
    setPage(1);
    if (batches[0]?.id) setBatchId(batches[0].id);
  };

  const toggleScoreBreakdown = (id) => {
    setExpandedScoreIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeIndex = items.findIndex(i => i.id === activeCandidateId);
  const navigateDrawer = (delta) => {
    if (activeIndex < 0) return;
    const target = items[activeIndex + delta];
    if (target) setActiveCandidateId(target.id);
  };

  const toggleSelectItem = (id, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const val = checked !== undefined ? checked : !next.has(id);
      if (val) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectPage = (checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      items.forEach(item => {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  };

  const selectReadyOnPage = () => {
    const readyItems = items.filter(i =>
      !i.cf_product_id &&
      !i.url_blocked &&
      !['queued', 'processing', 'in_catalog'].includes(i.process_status)
    );
    if (readyItems.length === 0) {
      showToast('Tidak ada kandidat siap URL yang belum diproses di halaman ini.');
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      readyItems.forEach(i => next.add(i.id));
      return next;
    });
    showToast(`${readyItems.length} kandidat siap URL ditambahkan ke pilihan.`);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleOpenBulkPreview = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (ids.length > 50) {
      showToast('Maksimal 50 kandidat per proses Bulk Approval.');
      return;
    }
    setBulkLoadingPreview(true);
    try {
      const res = await fetch('/api/v2/product-research/candidates/bulk-promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: ids, mode: 'preview' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyiapkan ringkasan Bulk Approval.');
      }
      setBulkPreview(data);
    } catch (err) {
      showToast(err.message);
    } finally {
      setBulkLoadingPreview(false);
    }
  };

  const handleExecuteBulk = async () => {
    if (!bulkPreview) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkExecuting(true);
    try {
      const res = await fetch('/api/v2/product-research/candidates/bulk-promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: ids, mode: 'execute' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menjalankan Bulk Approval.');
      }

      const queuedRows = (data.results || [])
        .filter(r => r.status === 'queued')
        .map(r => ({
          candidate_id: r.candidate_id,
          name: r.name,
          job_id: r.job_id,
          reserved_product_id: r.reserved_product_id,
          process_status: 'queued'
        }));

      if (queuedRows.length > 0) {
        setTrackedQueueItems(prev => {
          const existingIds = new Set(prev.map(x => x.candidate_id));
          return [...queuedRows.filter(x => !existingIds.has(x.candidate_id)), ...prev].slice(0, 20);
        });
      }

      const s = data.summary || {};
      showToast(
        `Bulk Approval selesai: ${s.queued || 0} masuk antrean (1-per-1), ${s.linked || 0} dihubungkan, ${s.skipped_blocked || 0} tertahan dilewati.`
      );
      setBulkPreview(null);
      setSelectedIds(new Set());
      await fetchCandidates();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBulkExecuting(false);
    }
  };

  const handleCheckStatus = async (candidateId) => {
    try {
      const res = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(candidateId)}/status`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memeriksa status.');
      }
      await fetchCandidates();
      showToast(`Status kandidat diperbarui: ${labelProcessStatus(data.candidate?.process_status)}.`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const executePromote = async () => {
    if (!confirmCandidate) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/v2/product-research/candidates/${encodeURIComponent(confirmCandidate.id)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mempromosikan kandidat.');
      }

      if (data.action === 'linked') {
        showToast(`Produk dihubungkan ke katalog (${data.cf_product_id}) tanpa menimpa data produk yang sudah ada.`);
      } else {
        showToast(`Dimasukkan ke antrean product_scraper (Job ${data.job_id} · ID cadangan ${data.reserved_product_id}).`);
      }

      const promotedId = confirmCandidate.id;
      setConfirmCandidate(null);
      await fetchCandidates();
      if (activeCandidateId === promotedId) {
        setActiveCandidateId(null);
        setTimeout(() => setActiveCandidateId(promotedId), 20);
      }
    } catch (err) {
      showToast(err.message);
      await fetchCandidates();
    } finally {
      setPromoting(false);
    }
  };

  const readyUrlCount = (summary.url_official || 0) + (summary.url_listing || 0) + (summary.url_user || 0);
  const allPageSelected = items.length > 0 && items.every(item => selectedIds.has(item.id));
  const activeProcessingCount = items.filter(i => i.process_status === 'processing').length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className={styles.container} style={{ paddingBottom: selectedIds.size > 0 ? '96px' : '32px' }}>
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
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowFormula(v => !v)}
              >
                {showFormula ? '📐 Tutup Rumus Skor' : '📐 Rumus Skor Peluang'}
              </button>
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

          {showFormula && (
            <section className={styles.alertBox} style={{ background: 'var(--status-info-soft)', borderColor: 'color-mix(in srgb, var(--status-info) 35%, transparent)' }} aria-label="Rumus Transparan Skor Peluang">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <strong>🎯 Rumus Transparan Skor Peluang (Total 100 Poin · v1):</strong>{' '}
                  <span className={styles.subNote}>Hanya membantu urutan kurasi — tidak pernah memicu promosi otomatis.</span>
                </div>
                <span className={`${styles.badge} ${styles.badgeInfo}`}>80–100 Prioritas Tinggi · 60–79 Potensial</span>
              </div>
              <div className={styles.formulaPopover}>
                <div className={styles.formulaCard}>
                  <strong>1. Penjualan/mg (30 pt)</strong>
                  <div className={styles.subNote}>≥1.000 (30), 500–999 (24), 200–499 (18), 50–199 (12), 1–49 (6)</div>
                </div>
                <div className={styles.formulaCard}>
                  <strong>2. Arah Tren (20 pt)</strong>
                  <div className={styles.subNote}>↑ Naik (20), → Stabil (12), ↓ Menurun (4)</div>
                </div>
                <div className={styles.formulaCard}>
                  <strong>3. Komisi/produk (20 pt)</strong>
                  <div className={styles.subNote}>≥Rp25rb (20), Rp15–24rb (16), Rp8–14rb (12), Rp3–7rb (8), &gt;0 (4)</div>
                </div>
                <div className={styles.formulaCard}>
                  <strong>4. Zona Harga (15 pt)</strong>
                  <div className={styles.subNote}>Rp35–250rb (15), Rp20–34rb / Rp250–500rb (11), tepi (7), &gt;1jt (4)</div>
                </div>
                <div className={styles.formulaCard}>
                  <strong>5. Kesiapan URL (15 pt)</strong>
                  <div className={styles.subNote}>Resmi (15), Kurator (14), Listing (12), Terdekat (4), Tidak ada (0)</div>
                </div>
              </div>
            </section>
          )}

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

          {/* Live Queue Monitor for Bulk Runs */}
          {trackedQueueItems.length > 0 && (
            <section className={styles.queueMonitor} aria-label="Pemantau Antrean Product Scraper">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.88rem' }}>⚙️ Antrean <span className={styles.mono}>product_scraper</span></strong>
                  <span className={`${styles.pill} ${styles.pillInfo}`}>
                    Batas aman: 1 job berjalan sekaligus (Aktif: {activeProcessingCount} / 1)
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSm}`}
                  onClick={() => setTrackedQueueItems([])}
                >
                  Sembunyikan
                </button>
              </div>
              <div className={styles.queueList}>
                {trackedQueueItems.map(q => (
                  <div key={q.candidate_id} className={styles.queueItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <strong>{q.name}</strong>
                      <span className={`${styles.badge} ${toneClass(processStatusTone(q.process_status))}`}>
                        {labelProcessStatus(q.process_status)}
                      </span>
                    </div>
                    <div className={`${styles.subNote} ${styles.mono}`}>
                      Job #{q.job_id} · {q.reserved_product_id}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

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

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="radarSortBy">Urutkan Kandidat</label>
                <select
                  id="radarSortBy"
                  className={styles.formControl}
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                >
                  <option value="rank">Ranking Riset Batch</option>
                  <option value="score_desc">Skor Peluang Tertinggi (Bantu Urutan)</option>
                  <option value="sold_delta_desc">Kenaikan Terjual Lintas Minggu (+)</option>
                </select>
              </div>
            </div>

            <div className={styles.filterFooter}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Menampilkan {items.length} dari {pagination.total} kandidat</span>
                <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={selectReadyOnPage}>
                  ✓ Pilih Siap URL di Halaman Ini
                </button>
                {selectedIds.size > 0 && (
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={clearSelection}>
                    ✕ Kosongkan Pilihan ({selectedIds.size})
                  </button>
                )}
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
                    <th style={{ width: '38px' }}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) => toggleSelectPage(e.target.checked)}
                        aria-label="Pilih semua kandidat di halaman ini"
                      />
                    </th>
                    <th style={{ width: '66px' }}>Foto</th>
                    <th style={{ minWidth: '220px' }}>Nama Produk</th>
                    <th>Kategori</th>
                    <th>Terjual &amp; Lintas Minggu</th>
                    <th>Tren</th>
                    <th>Komisi</th>
                    <th>Harga</th>
                    <th style={{ minWidth: '185px' }}>Skor Peluang</th>
                    <th>Kecocokan URL</th>
                    <th>Status Kurasi</th>
                    <th>Status Proses</th>
                    <th style={{ minWidth: '195px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Memuat daftar kandidat Radar Produk...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
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
                      const isPending = ['queued', 'processing'].includes(c.process_status);
                      const isChecked = selectedIds.has(c.id);
                      const sc = c.opportunity_score || null;
                      const isScoreExp = expandedScoreIds.has(c.id);
                      const wc = c.weekly_comparison || null;
                      const prevObs = wc?.previous || null;
                      const soldDeltaText = formatSignedDelta(wc?.deltas?.sold_delta);
                      const rankDelta = wc?.deltas?.rank_delta;

                      return (
                        <tr
                          key={c.id}
                          className={isChecked ? styles.selectedRow : undefined}
                          onClick={() => setActiveCandidateId(c.id)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => toggleSelectItem(c.id, e.target.checked)}
                              aria-label={`Pilih ${getDisplayName(c)}`}
                            />
                          </td>
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
                                {rankDelta != null && rankDelta !== 0 ? (
                                  <strong style={{ color: rankDelta > 0 ? 'var(--status-success)' : 'var(--status-warning)', marginLeft: '4px' }}>
                                    ({rankDelta > 0 ? `↑${rankDelta}` : `↓${Math.abs(rankDelta)}`})
                                  </strong>
                                ) : ''}
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
                            {prevObs && (
                              <div className={styles.subNote} style={{ marginTop: '3px' }}>
                                vs {prevObs.sold_per_week != null ? Number(prevObs.sold_per_week).toLocaleString('id-ID') : '—'} ({formatObservedDate(prevObs.observed_at || prevObs.external_batch_id)})
                                {soldDeltaText && (
                                  <strong style={{ color: wc.deltas.sold_delta >= 0 ? 'var(--status-success)' : 'var(--status-danger)', marginLeft: '4px' }}>
                                    {soldDeltaText}{wc.deltas.sold_pct != null ? ` (${wc.deltas.sold_pct >= 0 ? '+' : ''}${wc.deltas.sold_pct}%)` : ''}
                                  </strong>
                                )}
                              </div>
                            )}
                            {wc?.observations_count > 1 && (
                              <div style={{ marginTop: '3px' }}>
                                <span className={`${styles.badge} ${styles.badgeMuted}`}>
                                  {wc.observations_count}x teramati ({wc.match_method})
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${toneClass(trendTone(rd.trend))}`}>
                              {labelTrend(rd.trend)} {rd.trend_delta ? `(${rd.trend_delta})` : ''}
                            </span>
                          </td>
                          <td>
                            <div className={styles.numStrong}>
                              {rd.commission_pct != null
                                ? `${rd.commission_pct}%`
                                : (rd.commission_rp != null ? formatRp(rd.commission_rp) : '—')}
                            </div>
                            {rd.commission_pct != null && rd.commission_rp != null && (
                              <div className={styles.subNote}>±{formatRp(rd.commission_rp)}</div>
                            )}
                          </td>
                          <td className={styles.numStrong}>{formatRp(rd.price)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {sc ? (
                              <div className={styles.scoreCell}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span className={`${styles.badge} ${toneClass(scoreTierTone(sc.tier))}`}>
                                    {sc.total}/100 · {sc.tier_label}
                                  </span>
                                  <button
                                    type="button"
                                    className={`${styles.btn} ${styles.btnSm}`}
                                    onClick={() => toggleScoreBreakdown(c.id)}
                                  >
                                    {isScoreExp ? 'Tutup' : 'Rincian'}
                                  </button>
                                </div>
                                <div className={styles.miniBreakdown} title="Penjualan / Tren / Komisi / Harga / URL">
                                  {(sc.breakdown || []).map(b => (
                                    <div key={b.key} className={styles.miniSeg}>
                                      <span style={{ width: `${Math.round((b.score / b.max) * 100)}%` }} />
                                    </div>
                                  ))}
                                </div>
                                {isScoreExp && (
                                  <div className={styles.scoreDetailBox}>
                                    {(sc.breakdown || []).map(b => (
                                      <div key={b.key} className={styles.scoreDetailRow}>
                                        <span>{b.label}</span>
                                        <strong>{b.score}/{b.max}</strong>
                                      </div>
                                    ))}
                                    <div className={styles.subNote} style={{ marginTop: '3px' }}>
                                      Bantu urutan saja
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : '—'}
                          </td>
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
                              {c.process_status === 'needs_review' && c.cf_product_id ? (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnWarning}`}
                                  onClick={() => setActiveCandidateId(c.id)}
                                >
                                  🛠 Pulihkan Foto/Enrich
                                </button>
                              ) : c.cf_product_id ? (
                                <Link
                                  href={`/products?search=${encodeURIComponent(c.catalog_product?.product_name || getDisplayName(c))}`}
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnSuccess}`}
                                >
                                  ↗ Buka Produk
                                </Link>
                              ) : isPending ? (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnInfo}`}
                                  onClick={() => handleCheckStatus(c.id)}
                                >
                                  ⏳ {labelProcessStatus(c.process_status)} · Cek
                                </button>
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
                                  onClick={() => setConfirmCandidate(c)}
                                >
                                  🔗 Hubungkan
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                                  onClick={() => setConfirmCandidate(c)}
                                >
                                  {c.process_status === 'failed' ? '↻ Coba Lagi' : '+ Masukkan ke Database'}
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

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar} role="region" aria-label="Bilah Aksi Massal Radar Produk">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.9rem' }}>{selectedIds.size} kandidat dipilih</strong>
            <span className={styles.subNote}>(maks 50 per eksekusi · tertahan otomatis dilewati)</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={clearSelection}>
              Batal
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={bulkLoadingPreview}
              onClick={handleOpenBulkPreview}
            >
              {bulkLoadingPreview ? 'Memeriksa...' : `🔍 Tinjau & Ajukan Pilihan (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <CandidateDetailDrawer
        candidateId={activeCandidateId}
        onClose={() => setActiveCandidateId(null)}
        onNavigate={navigateDrawer}
        canPrev={activeIndex > 0}
        canNext={activeIndex >= 0 && activeIndex < items.length - 1}
        onUpdated={() => fetchCandidates()}
        onToast={showToast}
        onRequestPromote={(cand) => setConfirmCandidate(cand)}
      />

      {/* Dialog Konfirmasi Promosi Satuan */}
      {confirmCandidate && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Masukkan ke Database Produk"
          onClick={(e) => {
            if (e.target === e.currentTarget && !promoting) setConfirmCandidate(null);
          }}
        >
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  {confirmCandidate.duplicate_match
                    ? 'Hubungkan ke Produk Katalog'
                    : 'Masukkan ke Database Produk'}
                </h3>
                <div className={styles.subNote}>
                  Tinjau tujuan URL dan status duplikat sebelum menjalankan.
                </div>
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                disabled={promoting}
                onClick={() => setConfirmCandidate(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <strong>{getDisplayName(confirmCandidate)}</strong>
                <div className={`${styles.subNote} ${styles.mono}`} style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                  {confirmCandidate.effective_url}
                </div>
              </div>

              {confirmCandidate.duplicate_match ? (
                <div className={`${styles.alertBox} ${styles.alertInfo}`}>
                  <strong>🔗 Produk Sudah Ada di Katalog ({confirmCandidate.duplicate_match.cf_product_id}):</strong> &ldquo;{confirmCandidate.duplicate_match.product_name}&rdquo;.<br />
                  Kandidat ini akan <strong>dihubungkan</strong> tanpa menimpa deskripsi, foto studio, atau link afiliasi produk yang sudah ada.
                </div>
              ) : (
                <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
                  <strong>✅ Siap Masuk Antrean Scraper:</strong> Sistem mencadangkan ID produk unik agar klik ganda atau coba ulang tidak membuat produk ganda. Teks hasil scrape di katalog (Product Truth Inggris) tidak akan menimpa edit kurator Anda.
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btn}
                disabled={promoting}
                onClick={() => setConfirmCandidate(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={`${styles.btn} ${confirmCandidate.duplicate_match ? styles.btnInfo : styles.btnPrimary}`}
                disabled={promoting}
                onClick={executePromote}
              >
                {promoting
                  ? 'Memproses...'
                  : confirmCandidate.duplicate_match
                    ? '🔗 Konfirmasi & Hubungkan'
                    : '✓ Konfirmasi & Masukkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Bulk Approval */}
      {bulkPreview && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Ringkasan Bulk Approval Radar Produk"
          onClick={(e) => {
            if (e.target === e.currentTarget && !bulkExecuting) setBulkPreview(null);
          }}
        >
          <div className={`${styles.modalDialog} ${styles.modalDialogBulk}`}>
            <div className={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Ringkasan Bulk Approval ({bulkPreview.summary?.requested || 0} Kandidat)
                </h3>
                <div className={styles.subNote}>
                  Kandidat tertahan otomatis dilewati dan tidak ikut terkirim ke antrean scraper.
                </div>
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                disabled={bulkExecuting}
                onClick={() => setBulkPreview(null)}
              >
                ✕
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.modalBodyScroll}`}>
              <div className={styles.summaryBuckets}>
                <div className={styles.bucketCard}>
                  <div className={styles.bucketNum} style={{ color: 'var(--status-success)' }}>
                    {bulkPreview.summary?.valid_count || 0}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Valid · Scrape Baru</div>
                  <div className={styles.subNote}>Klaim atomik & antre 1-per-1</div>
                </div>
                <div className={styles.bucketCard}>
                  <div className={styles.bucketNum} style={{ color: 'var(--status-info)' }}>
                    {bulkPreview.summary?.duplicate_count || 0}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Duplikat · Hubungkan</div>
                  <div className={styles.subNote}>Tanpa menimpa produk lama</div>
                </div>
                <div className={styles.bucketCard}>
                  <div className={styles.bucketNum} style={{ color: 'var(--status-warning)' }}>
                    {bulkPreview.summary?.blocked_count || 0}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Tertahan · Dilewati</div>
                  <div className={styles.subNote}>Tidak ikut terkirim</div>
                </div>
              </div>

              {(bulkPreview.valid_items || []).length > 0 && (
                <div className={styles.bucketList}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--status-success)' }}>
                    ✅ Siap Masuk Antrean product_scraper (1 Job Berjalan Sekaligus)
                  </strong>
                  {bulkPreview.valid_items.map(v => (
                    <div key={v.id} className={styles.bucketRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{v.name}</strong>
                        <div className={`${styles.subNote} ${styles.mono}`} style={{ wordBreak: 'break-all' }}>
                          {v.effective_url}
                        </div>
                      </div>
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Valid</span>
                    </div>
                  ))}
                </div>
              )}

              {(bulkPreview.duplicate_items || []).length > 0 && (
                <div className={styles.bucketList}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--status-info)' }}>
                    🔗 Duplikat URL — Dihubungkan ke Produk Eksisting
                  </strong>
                  {bulkPreview.duplicate_items.map(d => (
                    <div key={d.id} className={styles.bucketRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{d.name}</strong>
                        <div className={styles.subNote}>
                          Cocok dengan <span className={styles.mono}>{d.duplicate_match?.cf_product_id}</span> ({d.duplicate_match?.product_name})
                        </div>
                      </div>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Hubungkan</span>
                    </div>
                  ))}
                </div>
              )}

              {(bulkPreview.blocked_items || []).length > 0 && (
                <div className={styles.bucketList}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--status-warning)' }}>
                    ⛔ Tertahan — Tidak Ikut Terkirim
                  </strong>
                  {bulkPreview.blocked_items.map(b => (
                    <div key={b.id} className={styles.bucketRow}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{b.name}</strong>
                        <div className={styles.subNote}>{b.reason}</div>
                      </div>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Dilewati</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`${styles.alertBox} ${styles.alertInfo}`}>
                Setiap kandidat memakai klaim atomik yang sama dengan promosi satuan dan mencadangkan <span className={styles.mono}>reserved_product_id</span>. Antrean <span className={styles.mono}>product_scraper</span> memproses maksimal <strong>{bulkPreview.queue_concurrency || 1} job sekaligus</strong> (antrean saat ini: {bulkPreview.queue_load?.running || 0} berjalan, {bulkPreview.queue_load?.pending || 0} menunggu).
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btn}
                disabled={bulkExecuting}
                onClick={() => setBulkPreview(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={bulkExecuting || ((bulkPreview.summary?.valid_count || 0) + (bulkPreview.summary?.duplicate_count || 0) === 0)}
                onClick={handleExecuteBulk}
              >
                {bulkExecuting
                  ? 'Memproses...'
                  : `✓ Jalankan (${bulkPreview.summary?.valid_count || 0} Scrape + ${bulkPreview.summary?.duplicate_count || 0} Hubungkan)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
