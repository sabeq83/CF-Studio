'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './aff.module.css';

function CopyIcon({ copied }) {
  if (copied) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ImageFallbackIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function writeClipboardWithFallback(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackExecCopy(text));
  }
  return Promise.resolve(fallbackExecCopy(text));
}

function fallbackExecCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

export default function PublicAffiliateCatalogClient() {
  const [theme, setTheme] = useState('dark');
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedItemId, setCopiedItemId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [brokenImages, setBrokenImages] = useState({});
  const [modalItem, setModalItem] = useState(null);

  const searchInputRef = useRef(null);
  const modalCloseRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const copyTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  const fetchCatalog = useCallback(async (brandParam) => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const url = brandParam
        ? `/api/public/affiliate-catalog?brand=${encodeURIComponent(brandParam)}`
        : '/api/public/affiliate-catalog';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error || 'Gagal memuat katalog produk.');
      }

      const payload = json.data || {};
      setBrands(Array.isArray(payload.brands) ? payload.brands : []);
      setSelectedBrandId(payload.selected_brand_id || 'all');
      setTotalCount(Number(payload.total_count) || 0);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setBrokenImages({});
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err?.message || 'Koneksi ke server katalog sedang terganggu.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialBrand = params.get('brand') || '';
    fetchCatalog(initialBrand);
  }, [fetchCatalog]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!modalItem) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    if (modalCloseRef.current) {
      modalCloseRef.current.focus();
    }
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalItem]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (_) {}
    setTheme(next);
  };

  const handleBrandChange = (e) => {
    const nextBrand = e.target.value;
    setSelectedBrandId(nextBrand);
    try {
      const nextUrl = new URL(window.location.href);
      if (nextBrand) {
        nextUrl.searchParams.set('brand', nextBrand);
      } else {
        nextUrl.searchParams.delete('brand');
      }
      window.history.replaceState(null, '', nextUrl.toString());
    } catch (_) {}
    fetchCatalog(nextBrand);
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(item.product_name || '').toLowerCase().includes(q));
  }, [items, searchQuery]);

  const activeBrandLabel = useMemo(() => {
    if (selectedBrandId === 'all') return 'Semua Brand';
    const found = brands.find((b) => b.id === selectedBrandId);
    return found ? found.brand_name : 'Memuat...';
  }, [brands, selectedBrandId]);

  const handleCopyLink = async (item) => {
    if (!item?.affiliate_link) return;
    await writeClipboardWithFallback(item.affiliate_link);
    setCopiedItemId(item.id);
    setToastMessage(`Link Aff "${item.product_name}" (${item.brand_name}) tersalin`);

    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    copyTimerRef.current = setTimeout(() => {
      setCopiedItemId(null);
    }, 2000);

    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2400);
  };

  const markImageBroken = (itemId) => {
    setBrokenImages((prev) => (prev[itemId] ? prev : { ...prev, [itemId]: true }));
  };

  const openModal = (item, triggerEl) => {
    lastTriggerRef.current = triggerEl;
    setModalItem(item);
  };

  const closeModal = () => {
    setModalItem(null);
    if (lastTriggerRef.current && typeof lastTriggerRef.current.focus === 'function') {
      lastTriggerRef.current.focus();
    }
    lastTriggerRef.current = null;
  };

  const resultLabel = useMemo(() => {
    if (status === 'loading') return 'Memuat...';
    if (status === 'error') return 'Gagal memuat';
    return `${filteredItems.length} produk`;
  }, [status, filteredItems.length]);

  const firstPopulatedBrand = useMemo(() => {
    return brands.find((b) => b.product_count > 0) || brands[0] || null;
  }, [brands]);

  return (
    <div className={styles.pageShell}>
      <header className={styles.catalogHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headerTop}>
            <div className={styles.titleGroup}>
              <h1 className={styles.pageTitle}>Katalog Link Aff</h1>
              <span className={styles.resultCount}>{resultLabel}</span>
            </div>

            <button
              type="button"
              className={styles.themeBtn}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
              <span>{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
            </button>
          </div>

          <div className={styles.controlsStack}>
            <div className={styles.brandSelectBox}>
              <label htmlFor="brandSelect" className={styles.brandSelectLabel}>
                Filter Brand Profile
              </label>
              <div className={styles.brandSelectWrap}>
                <select
                  id="brandSelect"
                  className={styles.brandSelect}
                  value={selectedBrandId}
                  onChange={handleBrandChange}
                  disabled={status === 'loading' && brands.length === 0}
                >
                  {brands.length === 0 ? (
                    <option value="">Memuat brand...</option>
                  ) : (
                    <>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.brand_name} ({brand.product_count})
                        </option>
                      ))}
                      <option value="all">Semua Brand ({totalCount})</option>
                    </>
                  )}
                </select>
                <svg className={styles.brandSelectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            <div className={styles.searchBox}>
              <label htmlFor="searchInput" className={styles.srOnly}>
                Cari nama produk
              </label>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                id="searchInput"
                className={styles.searchInput}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk..."
                autoComplete="off"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => {
                    setSearchQuery('');
                    if (searchInputRef.current) searchInputRef.current.focus();
                  }}
                  aria-label="Hapus kata kunci pencarian"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className={styles.catalogMain}>
        <div className={styles.activeBrandBanner}>
          <div className={styles.activeBrandMeta}>
            Brand aktif: <strong>{activeBrandLabel}</strong>
          </div>
        </div>

        <div aria-live="polite">
          {status === 'loading' ? (
            <>
              <p className={styles.srOnly}>Sedang memuat katalog produk affiliate.</p>
              <div className={styles.productGrid} aria-busy="true">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className={styles.skeletonCard}>
                    <div className={styles.skeletonRow}>
                      <div className={`${styles.skeletonBox} ${styles.skeletonThumb}`} />
                      <div className={styles.skeletonLines}>
                        <div className={`${styles.skeletonBox} ${styles.skeletonLineLg}`} />
                        <div className={`${styles.skeletonBox} ${styles.skeletonLineSm}`} />
                      </div>
                    </div>
                    <div className={`${styles.skeletonBox} ${styles.skeletonBtn}`} />
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {status === 'error' ? (
            <div className={styles.statePanel}>
              <h2 className={styles.stateTitle}>Gagal memuat katalog produk</h2>
              <p className={styles.stateDesc}>{errorMessage}</p>
              <button
                type="button"
                className={styles.stateActionBtn}
                onClick={() => fetchCatalog(selectedBrandId)}
              >
                Coba Lagi
              </button>
            </div>
          ) : null}

          {status === 'ready' && filteredItems.length === 0 ? (
            <div className={styles.statePanel}>
              <h2 className={styles.stateTitle}>
                {searchQuery.trim() ? 'Produk tidak ditemukan' : 'Belum ada produk di brand ini'}
              </h2>
              <p className={styles.stateDesc}>
                {searchQuery.trim()
                  ? `Tidak ada produk yang cocok dengan kata kunci "${searchQuery.trim()}" pada brand yang dipilih.`
                  : 'Produk pada Brand Profile ini belum memiliki link affiliate aktif di Product Database.'}
              </p>
              {searchQuery.trim() ? (
                <button
                  type="button"
                  className={styles.stateActionBtn}
                  onClick={() => setSearchQuery('')}
                >
                  Hapus Pencarian
                </button>
              ) : firstPopulatedBrand && firstPopulatedBrand.id !== selectedBrandId ? (
                <button
                  type="button"
                  className={styles.stateActionBtn}
                  onClick={() => {
                    setSelectedBrandId(firstPopulatedBrand.id);
                    fetchCatalog(firstPopulatedBrand.id);
                  }}
                >
                  Lihat {firstPopulatedBrand.brand_name}
                </button>
              ) : null}
            </div>
          ) : null}

          {status === 'ready' && filteredItems.length > 0 ? (
            <div className={styles.productGrid}>
              {filteredItems.map((item) => {
                const isCopied = copiedItemId === item.id;
                const hasImage = Boolean(item.thumbnail_url) && !brokenImages[item.id];
                return (
                  <article key={item.id} className={styles.productCard}>
                    <div className={styles.cardTop}>
                      <button
                        type="button"
                        className={styles.thumbTrigger}
                        onClick={(e) => openModal(item, e.currentTarget)}
                        aria-label={`Perbesar foto ${item.product_name}`}
                      >
                        {hasImage ? (
                          <img
                            className={styles.thumbImg}
                            src={item.thumbnail_url}
                            alt={`Foto produk ${item.product_name}`}
                            width={56}
                            height={56}
                            loading="lazy"
                            onLoad={(e) => {
                              if (e.currentTarget.naturalWidth <= 1 && e.currentTarget.naturalHeight <= 1) {
                                markImageBroken(item.id);
                              }
                            }}
                            onError={() => markImageBroken(item.id)}
                          />
                        ) : (
                          <span className={styles.thumbPlaceholder} aria-hidden="true">
                            <ImageFallbackIcon size={24} />
                          </span>
                        )}
                      </button>

                      <div className={styles.cardInfo}>
                        <h2 className={styles.productName}>{item.product_name}</h2>
                        <span className={styles.brandBadge}>{item.brand_name}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`${styles.copyAffBtn} ${isCopied ? styles.copyAffBtnCopied : ''}`}
                      onClick={() => handleCopyLink(item)}
                    >
                      <CopyIcon copied={isCopied} />
                      <span>{isCopied ? 'Link Aff Tersalin' : 'Salin Link Aff'}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </main>

      <footer className={styles.catalogFooter}>
        <span>CF Studio: Katalog Link Affiliate Publik</span>
        <span>1 kartu = 1 brand aktif</span>
      </footer>

      {modalItem ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalProductTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={styles.modalDialog}>
            <div className={styles.modalHead}>
              <div>
                <h2 id="modalProductTitle" className={styles.modalTitle}>
                  {modalItem.product_name}
                </h2>
                <div className={styles.modalBadgeWrap}>
                  <span className={styles.brandBadge}>{modalItem.brand_name}</span>
                </div>
              </div>
              <button
                ref={modalCloseRef}
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeModal}
                aria-label="Tutup pratinjau foto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.modalImageFrame}>
              {modalItem.thumbnail_url && !brokenImages[modalItem.id] ? (
                <img
                  className={styles.modalImg}
                  src={modalItem.thumbnail_url}
                  alt={`Pratinjau foto ${modalItem.product_name}`}
                  width={220}
                  height={220}
                  onLoad={(e) => {
                    if (e.currentTarget.naturalWidth <= 1 && e.currentTarget.naturalHeight <= 1) {
                      markImageBroken(modalItem.id);
                    }
                  }}
                  onError={() => markImageBroken(modalItem.id)}
                />
              ) : (
                <span className={styles.thumbPlaceholder} style={{ width: 120, height: 120 }}>
                  <ImageFallbackIcon size={44} />
                </span>
              )}
            </div>

            <button
              type="button"
              className={`${styles.copyAffBtn} ${copiedItemId === modalItem.id ? styles.copyAffBtnCopied : ''}`}
              onClick={() => handleCopyLink(modalItem)}
            >
              <CopyIcon copied={copiedItemId === modalItem.id} />
              <span>{copiedItemId === modalItem.id ? 'Link Aff Tersalin' : 'Salin Link Aff'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={styles.toastBanner} role="status" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ color: 'var(--status-success)', flexShrink: 0 }}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
