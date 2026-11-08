'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ProductDatabaseModal from './ProductDatabaseModal';

export default function ProductDatabasePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrapingCount, setScrapingCount] = useState(0);
  const [viewTabs, setViewTabs] = useState({}); // productId -> 'raw' | 'cleaned'
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingProductId, setUploadingProductId] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [affiliateStatus, setAffiliateStatus] = useState('all'); // 'all' | 'multi_brand' | 'with_link' | 'without_link'
  const [selectedBrandId, setSelectedBrandId] = useState('all');
  const [affiliateCounts, setAffiliateCounts] = useState({ total: 0, multi_brand: 0, with_link: 0, without_link: 0 });
  const [brandProfilesList, setBrandProfilesList] = useState([]);

  // Modals visibility
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showScraperModal, setShowScraperModal] = useState(false);

  // Editing state
  const [editingProduct, setEditingProduct] = useState(null);
  const [inlineAffiliateLinks, setInlineAffiliateLinks] = useState({});
  const [savingAffiliateId, setSavingAffiliateId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [regeneratingPhotoId, setRegeneratingPhotoId] = useState(null);

  // Scraper fields
  const [scraperUrls, setScraperUrls] = useState('');
  const [scraperCategory, setScraperCategory] = useState('');
  const [scraperTags, setScraperTags] = useState('');
  const [isSubmittingScraper, setIsSubmittingScraper] = useState(false);
  const [repairMode, setRepairMode] = useState(true);

  // Import/Export portability states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [regeneratingTruths, setRegeneratingTruths] = useState(false);
  const [regeneratingPhotos, setRegeneratingPhotos] = useState(false);

  // CSV Import and Logging states (v10.14.0)
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportFile, setCsvImportFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [showLogConsole, setShowLogConsole] = useState(false);
  const [systemLogs, setSystemLogs] = useState('Belum ada log log aktivitas.');

  const [toast, setToast] = useState(null);

  // CSV scraper states & Sheets export states
  const [scraperInputType, setScraperInputType] = useState('urls'); // 'urls' or 'csv'
  const [scraperCsvFile, setScraperCsvFile] = useState(null);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [exportedSheetUrl, setExportedSheetUrl] = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Fetch products and active queue status
  async function fetchProducts(overrideAffiliateStatus = null, overrideBrandId = null) {
    try {
      const effStatus = overrideAffiliateStatus !== null ? overrideAffiliateStatus : affiliateStatus;
      const effBrand = overrideBrandId !== null ? overrideBrandId : selectedBrandId;
      const res = await fetch(`/api/v2/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(selectedCategory)}&affiliate_status=${encodeURIComponent(effStatus)}&brand_id=${encodeURIComponent(effBrand)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        setScrapingCount(data.scraping_count || 0);
        if (data.counts) {
          setAffiliateCounts(data.counts);
        }

        // Populate inline affiliate links map
        const linksMap = {};
        (data.data || []).forEach(p => {
          linksMap[p.id] = p.affiliate_link || '';
        });
        setInlineAffiliateLinks(linksMap);
      }
    } catch (e) {
      console.error('Fetch products error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, affiliateStatus, selectedBrandId]);

  useEffect(() => {
    // Fetch brand profiles for dropdown
    fetch('/api/v2/brand-profiles')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setBrandProfilesList(d.data);
        }
      })
      .catch(e => console.warn('Fetch brands error:', e));
  }, []);

  // Quick brand link handlers for card
  async function handleQuickDeleteBrandLink(productId, brandProfileId, brandName) {
    if (!confirm(`Hapus link affiliate untuk brand ${brandName || 'ini'}?`)) return;
    try {
      const res = await fetch(`/api/v2/products/${productId}/brands?brandProfileId=${encodeURIComponent(brandProfileId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑 Link brand ${brandName || ''} berhasil dihapus.`);
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal menghapus link', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Gagal menghapus link', 'error');
    }
  }

  function handleCopyText(text, label = 'Tautan') {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`📋 ${label} berhasil disalin!`);
  }


  // Run search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchProducts();
    }
  };

  const hasBulkQueueActive = products.some(p =>
    (p.enrichment_status && ['pending', 'processing'].includes(p.enrichment_status)) ||
    (p.photo_status && ['pending', 'processing'].includes(p.photo_status))
  );

  // Poll for updates if scraper queue or bulk queue is active
  useEffect(() => {
    let timer;
    if (scrapingCount > 0 || hasBulkQueueActive) {
      timer = setInterval(() => {
        fetchProducts();
      }, 4000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [scrapingCount, hasBulkQueueActive]);

  // Poll logs for product bulk worker
  useEffect(() => {
    let logTimer;
    async function fetchLogs() {
      try {
        const res = await fetch('/api/system-logs?type=product_bulk');
        const text = await res.text();
        setSystemLogs(text);
      } catch (err) {
        console.error('Failed to fetch system logs:', err);
      }
    }

    if (showLogConsole || hasBulkQueueActive) {
      fetchLogs();
      logTimer = setInterval(fetchLogs, 3000);
    }

    return () => {
      if (logTimer) clearInterval(logTimer);
    };
  }, [showLogConsole, hasBulkQueueActive]);

  // Extract unique categories for filter dropdown
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));


  // Quick save for affiliate link inline
  async function handleQuickSaveAffiliate(productId) {
    const affiliateLink = inlineAffiliateLinks[productId] || '';
    setSavingAffiliateId(productId);
    try {
      const res = await fetch(`/api/v2/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliate_link: affiliateLink.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Link afiliasi disimpan!');
        // Refresh local cache data
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, affiliate_link: affiliateLink } : p));
      } else {
        showToast(data.error || 'Gagal menyimpan', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAffiliateId(null);
    }
  }

  // Copy affiliate link
  function handleCopyLink(productId) {
    const link = inlineAffiliateLinks[productId] || '';
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(productId);
    showToast('📋 Link disalin ke clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Set selected photo type as active
  async function handleSetActivePhoto(productId, tabType) {
    const colName = tabType === 'raw' ? 'raw_photo_url' : 'clean_photo_url';
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let relativePath = '';
    const rawUrl = tabType === 'raw'
      ? product.raw_photo_url
      : (product.clean_photo_url || product.cleaned_photo_url);

    if (rawUrl && rawUrl.includes('path=')) {
      const match = rawUrl.match(/path=([^&]+)/);
      if (match) {
        relativePath = decodeURIComponent(match[1]);
      }
    } else {
      relativePath = rawUrl;
    }

    try {
      const res = await fetch(`/api/v2/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_photo: colName,
          photo_url: relativePath
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Foto ${tabType === 'raw' ? 'Raw' : 'Clean'} aktif digunakan!`);
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengubah foto aktif', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Upload and replace photo
  async function handleUploadPhoto(productId, tabType, file) {
    setUploadingProductId(productId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productId', productId);
    // Normalkan 'cleaned' ke 'clean' agar selaras dengan spesifikasi API
    formData.append('type', tabType === 'cleaned' ? 'clean' : tabType);

    try {
      const res = await fetch('/api/v2/products/image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Foto ${tabType === 'raw' ? 'Raw' : 'Clean'} berhasil diunggah!`);
        // Force the UI view tab to switch to the newly uploaded image tab
        setViewTabs(prev => ({ ...prev, [productId]: tabType }));
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingProductId(null);
    }
  }


  // Parse CSV client-side
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return { error: 'File CSV kosong atau tidak memiliki baris data.' };

    // Detect delimiter: check if semicolon occurs more than comma in the header row
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const parseCSVLine = (line, delim = ',') => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(val => val.replace(/^"|"$/g, '').trim());
    };

    const headers = parseCSVLine(headerLine, delimiter);
    const affiliateIdx = headers.findIndex(h => {
      const norm = h.toLowerCase();
      return norm.includes('affiliate') || norm.includes('afiliasi') || norm.includes('partner');
    });

    const productIdx = headers.findIndex((h, idx) => {
      if (idx === affiliateIdx) return false; // Prevent choosing the affiliate column as product url
      const norm = h.toLowerCase();
      return norm.includes('product') || norm.includes('produk') || norm === 'url' || norm.includes('link') || norm.includes('url');
    });

    if (productIdx === -1 || affiliateIdx === -1 || productIdx === affiliateIdx) {
      return { error: 'Gagal mendeteksi kolom. Pastikan file CSV Anda memiliki kolom "URL Product" dan "URL Affiliates".' };
    }

    const dataRows = lines.slice(1);
    if (dataRows.length > 50) {
      return { error: `Maksimal data yang diperbolehkan adalah 50 baris. File Anda berisi ${dataRows.length} baris.` };
    }

    const records = [];
    for (const rowLine of dataRows) {
      const cols = parseCSVLine(rowLine, delimiter);
      const urlProduct = cols[productIdx] ? cols[productIdx].trim() : '';
      const urlAffiliate = cols[affiliateIdx] ? cols[affiliateIdx].trim() : '';
      if (urlProduct && (urlProduct.startsWith('http://') || urlProduct.startsWith('https://'))) {
        records.push({ url: urlProduct, affiliate_link: urlAffiliate });
      }
    }

    if (records.length === 0) {
      return { error: 'Tidak ada URL produk valid yang ditemukan di file CSV.' };
    }

    return { records };
  }

  // Submit batch scraping URLs or CSV file
  async function handleSubmitScraper(e) {
    e.preventDefault();

    let payload = {
      category: scraperCategory.trim() || null,
      tags: scraperTags.trim() || null,
      repair_mode: repairMode
    };

    if (scraperInputType === 'csv') {
      if (!scraperCsvFile) {
        showToast('Pilih file CSV terlebih dahulu!', 'error');
        return;
      }
      setIsSubmittingScraper(true);
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(scraperCsvFile);
        });

        const parsed = parseCSV(text);
        if (parsed.error) {
          showToast(parsed.error, 'error');
          setIsSubmittingScraper(false);
          return;
        }

        payload.csv_data = parsed.records;
      } catch (err) {
        showToast(`Gagal membaca file: ${err.message}`, 'error');
        setIsSubmittingScraper(false);
        return;
      }
    } else {
      if (!scraperUrls.trim()) {
        showToast('Masukkan setidaknya satu URL!', 'error');
        return;
      }
      payload.urls = scraperUrls;
    }

    setIsSubmittingScraper(true);
    try {
      const res = await fetch('/api/v2/products/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || '🚀 Scraper diantrekan!');
        setScraperUrls('');
        setScraperCsvFile(null);
        setScraperCategory('');
        setScraperTags('');
        setShowScraperModal(false);
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal memproses scraper', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingScraper(false);
    }
  }

  // Export to Google Sheets
  async function handleExportSheets() {
    setExportingSheets(true);
    setExportedSheetUrl('');
    try {
      const res = await fetch('/api/v2/products/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds.length > 0 ? selectedIds : null })
      });
      const data = await res.json();
      if (data.success) {
        setExportedSheetUrl(data.spreadsheetUrl);
        showToast('✅ Berhasil mengekspor produk ke Google Sheets!');
      } else {
        showToast(data.error || 'Gagal mengekspor produk', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExportingSheets(false);
    }
  }

  const [reEnrichingId, setReEnrichingId] = useState(null);

  // Trigger AI enrichment asinkron per-produk
  async function handleReEnrichProduct(productId) {
    setReEnrichingId(productId);
    try {
      const res = await fetch('/api/v2/products/re-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [productId] })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list
      } else {
        showToast(data.error || 'Gagal mengantrekan re-enrichment', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setReEnrichingId(null);
    }
  }

  // Trigger AI enrichment asinkron massal (bulk)
  async function handleBulkReEnrich() {
    if (selectedIds.length === 0) return;
    setRegeneratingTruths(true);
    try {
      const res = await fetch('/api/v2/products/re-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list
        setSelectedIds([]);
      } else {
        showToast(data.error || 'Gagal memproses re-enrichment massal', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingTruths(false);
    }
  }

  // Regenerate clean studio photos and prompts in a batch
  async function handleBulkRegeneratePhotos() {
    if (selectedIds.length === 0) return;
    setRegeneratingPhotos(true);
    try {
      const res = await fetch('/api/v2/products/regenerate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list
        setSelectedIds([]);
      } else {
        showToast(data.error || 'Gagal men-generate ulang foto & prompt', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingPhotos(false);
    }
  }

  // Fungsi untuk trigger generasi foto clean per-produk
  async function handleRegeneratePhoto(productId) {
    setRegeneratingPhotoId(productId);
    try {
      const res = await fetch('/api/v2/products/regenerate-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [productId] })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
        fetchProducts(); // Refresh list agar UI terupdate dan memulai polling status
      } else {
        showToast(data.error || 'Gagal memulai render foto clean', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegeneratingPhotoId(null);
    }
  }

  // Submit product database ZIP import
  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('products_file', importFile);

      const res = await fetch('/api/v2/products/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal mengimpor produk');

      showToast(data.message || '✅ Produk berhasil diimpor!');
      setShowImportModal(false);
      setImportFile(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  // Submit product CSV import
  async function handleCsvImportSubmit(e) {
    e.preventDefault();
    if (!csvImportFile) return;
    setCsvImporting(true);

    const formData = new FormData();
    formData.append('file', csvImportFile);

    try {
      const res = await fetch('/api/v2/products/import-csv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        setShowCsvImportModal(false);
        setCsvImportFile(null);
        setShowLogConsole(true); // Auto-open console log to show progress
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal mengimpor CSV raw', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCsvImporting(false);
    }
  }

  // Edit action
  function handleEditProduct(product) {
    setEditingProduct(product);
    setShowAddEditModal(true);
  }

  // Delete action
  async function handleDeleteProduct(productId) {
    if (!confirm('Hapus produk ini secara permanen dari database?')) return;
    try {
      const res = await fetch(`/api/v2/products/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑 Produk dihapus!');
        setSelectedIds(prev => prev.filter(id => id !== productId));
        fetchProducts();
      } else {
        showToast(data.error || 'Gagal menghapus produk', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <h1 className="page-title">📦 Product Database</h1>
            <p className="page-subtitle" style={{ marginBottom: '16px' }}>Manage single source of truth for products.</p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{
                  background: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid rgba(14, 165, 233, 0.4)',
                  color: 'var(--link)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)'
                }}
                onClick={() => setShowCsvImportModal(true)}
              >
                📥 Import CSV Raw
              </button>

              <button
                className="btn"
                style={{
                  background: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid rgba(14, 165, 233, 0.4)',
                  color: 'var(--link)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setShowImportModal(true)}
              >
                📥 Import ZIP
              </button>

              <a
                href={selectedIds.length > 0 ? `/api/v2/products/export?ids=${selectedIds.join(',')}` : `/api/v2/products/export`}
                className="btn"
                style={{
                  background: selectedIds.length > 0 ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.3) 0%, rgba(2, 132, 199, 0.4) 100%)' : 'rgba(14, 165, 233, 0.1)',
                  border: selectedIds.length > 0 ? '1px solid var(--status-info)' : '1px solid rgba(14, 165, 233, 0.3)',
                  color: selectedIds.length > 0 ? 'var(--link)' : '#7dd3fc',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                📤 Export ZIP {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </a>

              <button
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, var(--status-success) 0%, var(--status-success) 100%)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => { setEditingProduct(null); setShowAddEditModal(true); }}
              >
                ➕ Add Product
              </button>

              <button
                className="btn"
                disabled
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid #334155',
                  color: 'var(--text-muted)',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                🔒 Batch Scraper (Locked)
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`} style={{ zIndex: 1010 }}>
              {toast.msg}
            </div>
          )}

          {/* Background Scraping Status banner */}
          {scrapingCount > 0 && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, var(--status-neutral-soft), rgba(0, 184, 148, 0.15))',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'pulse 2s infinite ease-in-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--accent-light)' }}></div>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Scraper aktif di latar belakang: <strong style={{ color: 'var(--accent-light)' }}>{scrapingCount} tugas</strong> sedang dianalisis...
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Halaman akan ter-refresh otomatis.
              </div>
            </div>
          )}

          {/* Export Sheets Loading Banner */}
          {exportingSheets && (
            <div className="card" style={{
              background: 'var(--surface-interactive)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--success)' }}></div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Sedang mengekspor produk ke Google Sheets... Sistem sedang mengunggah gambar produk ke Google Drive dan membuat Spreadsheet. Mohon tunggu beberapa saat.
              </div>
            </div>
          )}

          {/* Export Sheets Success Banner */}
          {exportedSheetUrl && (
            <div className="card" style={{
              background: 'rgba(0, 184, 148, 0.15)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                🟢 Ekspor Google Sheets selesai! Klik tautan berikut untuk membuka: {' '}
                <a href={exportedSheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--success-light)', textDecoration: 'underline', fontWeight: 700, marginLeft: '5px' }}>
                  Buka Google Sheets Export
                </a>
              </div>
              <button className="btn btn-sm" onClick={() => setExportedSheetUrl('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          )}

          {/* System Poller Log Console (v10.14.0) */}
          <div className="card" style={{ marginBottom: '24px', padding: '14px 18px', background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
            <div
              onClick={() => setShowLogConsole(!showLogConsole)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <span>🖥️ System Poller Log Console (Product Bulk Worker)</span>
                {hasBulkQueueActive && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', background: 'rgba(0, 184, 148, 0.2)',
                    color: 'var(--success-light)', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex',
                    alignItems: 'center', gap: '4px', animation: 'pulse 1.5s infinite ease-in-out'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                    Active Processing
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showLogConsole ? '▲ Sembunyikan' : '▼ Tampilkan'}
              </span>
            </div>

            {showLogConsole && (
              <div style={{ marginTop: '14px' }}>
                <pre style={{
                  padding: '12px 16px', background: '#121214', color: '#a2a2ad',
                  borderRadius: 'var(--radius-xs)', fontSize: '0.75rem', maxHeight: '240px',
                  overflowY: 'auto', border: '1px solid var(--border)', fontFamily: 'monospace',
                  lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
                  {systemLogs || 'Belum ada log aktivitas.'}
                </pre>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  Auto-sync log aktif setiap 3 detik.
                </div>
              </div>
            )}
          </div>

          {/* Quick Status Filter Pills (Sesuai Mockup) */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <div
              onClick={() => setAffiliateStatus('all')}
              style={{
                background: affiliateStatus === 'all' ? 'var(--surface-raised)' : 'var(--surface)',
                border: `1px solid ${affiliateStatus === 'all' ? 'var(--action-primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span>Semua Produk</span>
              <span style={{
                background: 'var(--surface-interactive)',
                color: 'var(--text-primary)',
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {affiliateCounts.total || products.length}
              </span>
            </div>

            <div
              onClick={() => setAffiliateStatus('multi_brand')}
              style={{
                background: affiliateStatus === 'multi_brand' ? 'var(--surface-raised)' : 'var(--surface)',
                border: `1px solid ${affiliateStatus === 'multi_brand' ? 'var(--status-purple)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span>🛍️ Multi-Brand (≥2 Link)</span>
              <span style={{
                background: 'var(--status-purple-soft)',
                color: 'var(--status-purple)',
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {affiliateCounts.multi_brand || 0}
              </span>
            </div>

            <div
              onClick={() => setAffiliateStatus('with_link')}
              style={{
                background: affiliateStatus === 'with_link' ? 'var(--surface-raised)' : 'var(--surface)',
                border: `1px solid ${affiliateStatus === 'with_link' ? 'var(--status-success)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span>🔗 Produk Afiliasi (Ada Link)</span>
              <span style={{
                background: 'var(--status-success-soft)',
                color: 'var(--status-success)',
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {affiliateCounts.with_link || 0}
              </span>
            </div>

            <div
              onClick={() => setAffiliateStatus('without_link')}
              style={{
                background: affiliateStatus === 'without_link' ? 'var(--surface-raised)' : 'var(--surface)',
                border: `1px solid ${affiliateStatus === 'without_link' ? 'var(--status-warning)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              <span>⚠️ Belum Ada Link (Non-Afiliasi)</span>
              <span style={{
                background: 'var(--status-warning-soft)',
                color: 'var(--status-warning)',
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {affiliateCounts.without_link || 0}
              </span>
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px', position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔎 Cari nama produk, USP, atau tags..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              {/* Brand Profile Dropdown Filter */}
              <div style={{ width: '190px' }}>
                <select
                  className="form-select"
                  value={selectedBrandId}
                  onChange={e => setSelectedBrandId(e.target.value)}
                  style={{ margin: 0, height: '40px' }}
                >
                  <option value="all">Semua Brand Target</option>
                  {brandProfilesList.map(b => (
                    <option key={b.id} value={b.id}>
                      🏷️ {b.brand_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Affiliate Status Dropdown Filter */}
              <div style={{ width: '210px' }}>
                <select
                  className="form-select"
                  value={affiliateStatus}
                  onChange={e => setAffiliateStatus(e.target.value)}
                  style={{ margin: 0, height: '40px' }}
                >
                  <option value="all">Status: Semua Produk</option>
                  <option value="multi_brand">🛍️ Multi-Brand (≥2 Link)</option>
                  <option value="with_link">🔗 Ada Link (Minimal 1)</option>
                  <option value="without_link">⚠️ Belum Ada Link (Non-Afiliasi)</option>
                </select>
              </div>

              {/* Category Dropdown */}
              <div style={{ width: '170px' }}>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ margin: 0, height: '40px' }}
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button className="btn btn-secondary" onClick={() => fetchProducts()} style={{ height: '40px' }}>
                Search
              </button>
              {(search || selectedCategory || affiliateStatus !== 'all' || selectedBrandId !== 'all') && (
                <button
                  className="btn"
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', height: '40px', cursor: 'pointer' }}
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('');
                    setAffiliateStatus('all');
                    setSelectedBrandId('all');
                    fetchProducts('all', 'all');
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Grid View */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
              <span style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Memuat data produk...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>📦</div>
              <h3>Belum ada produk di database</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
                Tambahkan produk baru secara manual atau jalankan batch scraper dengan menempelkan link produk marketplace Shopee atau Tokopedia.
              </p>
            </div>
          ) : (
            <div>
              {/* Selection / Action Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 16px',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedIds.length === products.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(products.map(p => p.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: 'var(--accent)'
                      }}
                    />
                    Pilih Semua ({products.length} produk)
                  </label>
                  {selectedIds.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => setSelectedIds([])}
                      style={{
                        fontSize: '0.72rem',
                        padding: '4px 10px',
                        background: 'var(--surface-interactive)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      Batal Pilihan
                    </button>
                  )}
                </div>
                {selectedIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: '0.82rem' }}>
                      🔔 {selectedIds.length} produk terpilih untuk diekspor
                    </div>
                    <button
                      type="button"
                      onClick={handleBulkReEnrich}
                      disabled={regeneratingTruths}
                      style={{
                        background: 'var(--btn-bulk-enrich-bg)',
                        border: 'none',
                        color: 'var(--btn-bulk-enrich-text)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(9, 132, 227, 0.4)'
                      }}
                    >
                      {regeneratingTruths ? (
                        <>
                          <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: 'var(--text-primary)' }} />
                          Enriching...
                        </>
                      ) : (
                        <>🧠 Re-Enrich AI</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkRegeneratePhotos}
                      disabled={regeneratingPhotos}
                      style={{
                        background: 'var(--btn-bulk-photo-bg)',
                        border: 'none',
                        color: 'var(--btn-bulk-photo-text)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(255, 127, 80, 0.4)'
                      }}
                    >
                      {regeneratingPhotos ? (
                        <>
                          <div className="spinner" style={{ width: '12px', height: '12px', borderTopColor: 'var(--text-primary)' }} />
                          Rendering...
                        </>
                      ) : (
                        <>📷 RE-Generate Photos</>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '18px'
              }}>
                {products.map(p => {
                  // Parse tags
                  const tagsList = p.tags
                    ? p.tags.split(',').map(t => t.trim()).filter(Boolean)
                    : [];

                  // Resolve active photo URL
                  const activeTab = viewTabs[p.id] || (p.active_photo === 'raw_photo_url' ? 'raw' : 'cleaned');
                  const displayPhotoUrl = activeTab === 'raw'
                    ? p.raw_photo_url
                    : (p.cleaned_photo_url || p.clean_photo_url);

                  const brandLinks = Array.isArray(p.brand_links) ? p.brand_links : [];
                  const brandLinksCount = brandLinks.length;

                  return (
                    <div
                      key={p.id}
                      className="card product-card-simple"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: 'var(--shadow-card)',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {/* Top Row: Horizontal Split (Thumbnail 80x80 on Left, Identity Info on Right) */}
                      <div style={{
                        display: 'flex',
                        gap: '14px',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}>
                        {/* Thumbnail Container with Checkbox & Status */}
                        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                          {/* Selection Checkbox */}
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            zIndex: 5,
                            background: 'rgba(0, 0, 0, 0.55)',
                            borderRadius: '4px',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(4px)',
                            border: selectedIds.includes(p.id) ? '1px solid var(--action-primary)' : '1px solid rgba(255,255,255,0.2)'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(prev => [...prev, p.id]);
                                } else {
                                  setSelectedIds(prev => prev.filter(id => id !== p.id));
                                }
                              }}
                              style={{
                                width: '12px',
                                height: '12px',
                                cursor: 'pointer',
                                margin: 0,
                                accentColor: 'var(--action-primary)'
                              }}
                            />
                          </div>

                          {/* Thumbnail image or placeholder */}
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--surface-raised)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid var(--border-subtle)',
                              cursor: displayPhotoUrl ? 'zoom-in' : 'pointer'
                            }}
                            onClick={() => {
                              if (displayPhotoUrl) setZoomedImage(displayPhotoUrl);
                              else handleEditProduct(p);
                            }}
                          >
                            {displayPhotoUrl ? (
                              <img
                                src={displayPhotoUrl}
                                alt={p.product_name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '28px' }}>📦</span>
                            )}
                          </div>
                        </div>

                        {/* Header Info (Title, Category, Status Badge) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            {/* Dynamic Status Badge */}
                            {brandLinksCount >= 2 ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--status-purple-soft)',
                                color: 'var(--status-purple)',
                                whiteSpace: 'nowrap'
                              }}>
                                🛍️ Multi-Brand ({brandLinksCount} Link)
                              </span>
                            ) : brandLinksCount === 1 ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--status-success-soft)',
                                color: 'var(--status-success)',
                                whiteSpace: 'nowrap'
                              }}>
                                🔗 1 Brand Terhubung
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--status-warning-soft)',
                                color: 'var(--status-warning)',
                                border: '1px dashed var(--status-warning)',
                                whiteSpace: 'nowrap'
                              }}>
                                📦 Murni Non-Afiliasi
                              </span>
                            )}

                            {p.category && (
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                background: 'var(--surface-raised)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                                whiteSpace: 'nowrap'
                              }}>
                                {p.category}
                              </span>
                            )}
                          </div>

                          {/* Product Title */}
                          <h4
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              margin: '2px 0 0',
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                            title={p.product_name}
                          >
                            {p.product_name}
                          </h4>

                          {/* Tags or Short USP snippet */}
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px'
                          }}>
                            {tagsList.length > 0 ? tagsList.map(t => `#${t}`).join(' ') : (p.unique_selling_point ? `USP: ${p.unique_selling_point.slice(0, 45)}...` : 'Belum ada tags')}
                          </div>
                        </div>
                      </div>

                      {/* Middle Section: Multi-Brand Affiliate Links */}
                      <div style={{
                        padding: '10px 14px',
                        background: 'var(--surface-raised)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>Tautan Afiliasi Sesuai Brand:</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
                            {brandLinksCount} Link Aktif
                          </span>
                        </div>

                        {brandLinksCount === 0 ? (
                          <div style={{
                            fontSize: '11.5px',
                            color: 'var(--status-warning)',
                            fontStyle: 'italic',
                            padding: '3px 0'
                          }}>
                            ⚠️ Belum ada link affiliate di brand manapun (Non-Afiliasi).
                          </div>
                        ) : (
                          brandLinks.map(b => (
                            <div
                              key={b.brand_product_id || b.brand_profile_id || b.affiliate_link}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                fontSize: '11.5px',
                                background: 'var(--input-bg)',
                                padding: '5px 8px',
                                borderRadius: 'var(--radius-xs)',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <span style={{
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {b.brand_name || 'Brand'}:
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  color: 'var(--status-info)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textAlign: 'right'
                                }}
                                title={b.affiliate_link}
                              >
                                {b.affiliate_link ? b.affiliate_link.replace(/^https?:\/\//, '') : '-'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(b.affiliate_link, `Link ${b.brand_name}`);
                                }}
                                title="Salin Link"
                                style={{
                                  background: 'var(--surface-raised)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '4px',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  padding: '2px 6px',
                                  fontSize: '10.5px'
                                }}
                              >
                                📋
                              </button>
                              {b.brand_profile_id !== 'global' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickDeleteBrandLink(p.id, b.brand_profile_id, b.brand_name);
                                  }}
                                  title="Hapus Link Brand Ini"
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--status-danger-soft)',
                                    borderRadius: '4px',
                                    color: 'var(--status-danger)',
                                    cursor: 'pointer',
                                    padding: '2px 5px',
                                    fontSize: '10px'
                                  }}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Footer Section: Compact ID & Actions */}
                      <div style={{
                        padding: '8px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--surface)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            ID: {p.id.slice(0, 8)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(p.id, 'ID Produk');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: '10px',
                              padding: 0
                            }}
                            title="Salin ID Lengkap"
                          >
                            📋
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditProduct(p)}
                            style={{
                              height: '28px',
                              fontSize: '11.5px',
                              padding: '0 10px',
                              background: 'var(--surface-raised)',
                              borderColor: 'var(--border-subtle)',
                              color: 'var(--text-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ⚙️ Kelola Link & Detail
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleDeleteProduct(p.id)}
                            style={{
                              height: '28px',
                              fontSize: '11.5px',
                              padding: '0 8px',
                              background: 'transparent',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--status-danger)'
                            }}
                            title="Hapus Produk"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* MODAL 1: BATCH SCRAPER */}
      {showScraperModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'var(--overlay-backdrop)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowScraperModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}><span style={{ color: 'var(--accent-light)' }}>⚡</span> Batch Product Scraper</h3>
              <button onClick={() => setShowScraperModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitScraper}>
              {/* Selector Tipe Input */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="scraperInputType"
                    value="urls"
                    checked={scraperInputType === 'urls'}
                    onChange={() => setScraperInputType('urls')}
                  />
                  Tulis URL Manual
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="scraperInputType"
                    value="csv"
                    checked={scraperInputType === 'csv'}
                    onChange={() => setScraperInputType('csv')}
                  />
                  Unggah File CSV
                </label>
              </div>

              {scraperInputType === 'csv' ? (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Unggah Berkas CSV (Maks 50 baris data) *</label>
                  <input
                    type="file"
                    accept=".csv"
                    className="form-input"
                    onChange={e => setScraperCsvFile(e.target.files[0])}
                    required
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
                    Pastikan berkas CSV memiliki kolom bertajuk <strong>URL Product</strong> dan <strong>URL Affiliates</strong>.
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Daftar URL Produk (Maks 50 URL, Satu per Baris) *</label>
                  <textarea
                    className="form-textarea"
                    value={scraperUrls}
                    onChange={e => setScraperUrls(e.target.value)}
                    placeholder="Tempel link Shopee atau Tokopedia di sini...&#10;https://shopee.co.id/product-url-1&#10;https://tokopedia.com/product-url-2"
                    style={{ minHeight: '140px', fontSize: '0.82rem', fontFamily: 'monospace' }}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Kategori (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scraperCategory}
                    onChange={e => setScraperCategory(e.target.value)}
                    placeholder="Contoh: Skincare"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tags (Opsional, pisah koma)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scraperTags}
                    onChange={e => setScraperTags(e.target.value)}
                    placeholder="Contoh: glowing, serum, lokal"
                  />
                </div>
              </div>

              {/* Repair Mode Checkbox Toggle */}
              <div style={{
                background: 'var(--surface-interactive)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px'
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={repairMode}
                    onChange={(e) => setRepairMode(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: '600' }}>Perbaiki & Lengkapi Data Produk yang Sudah Ada</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Jika diaktifkan, URL produk yang sudah ada di database namun kekurangan aset visual (raw/clean/studio) atau USP/Kemasan akan di-scrape ulang/dilengkapi secara otomatis.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowScraperModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingScraper}>
                  {isSubmittingScraper ? '⏳ Mengantrekan...' : '🚀 Scrape Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT FULL PRODUCT (SHARED 3-TAB SEMANTIC COMPONENT) */}
      {showAddEditModal && (
        <ProductDatabaseModal
          isOpen={showAddEditModal}
          productId={editingProduct?.id || null}
          product={editingProduct}
          onClose={() => {
            setShowAddEditModal(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            fetchProducts();
          }}
        />
      )}

      {/* MODAL 3: IMPORT PRODUCTS ZIP */}
      {showImportModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'var(--overlay-backdrop)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowImportModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '480px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📥 Import Product Database</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.4 }}>
              Unggah berkas ZIP hasil ekspor untuk memindahkan daftar produk beserta gambar fisiknya. Produk yang tautan aslinya sudah ada di database ini akan secara otomatis dilewati untuk mencegah duplikasi.
            </p>

            <form onSubmit={handleImportSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Berkas ZIP Produk *</label>
                <input
                  type="file"
                  accept=".zip"
                  className="form-input"
                  onChange={e => setImportFile(e.target.files[0])}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  {importing ? '⏳ Mengimpor...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: IMPORT PRODUCTS CSV (v10.14.0) */}
      {showCsvImportModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'var(--overlay-backdrop)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }} onClick={() => setShowCsvImportModal(false)}>
          <div className="card" style={{
            width: '90%', maxWidth: '500px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>📥 Import Raw CSV / Excel</h3>
              <button onClick={() => setShowCsvImportModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.4 }}>
              Unggah berkas CSV atau Excel mentah. Kolom yang wajib diisi adalah <b>Nama Produk Raw</b>. Kolom opsional: <b>Deskripsi Produk Raw</b>, <b>Link Produk</b>, dan <b>URL Foto Produk Raw</b>.
            </p>

            <div style={{ padding: '8px 12px', background: 'var(--surface-interactive)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '20px', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              💡 <b>Tips Kolom CSV/Excel:</b>
              <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0' }}>
                <li><b>Nama Produk Raw</b> (nama_produk, product_name)</li>
                <li><b>Deskripsi Produk Raw</b> (deskripsi, description)</li>
                <li><b>Link Produk</b> (link_produk, source_url)</li>
                <li><b>URL Foto Produk Raw</b> (photo_url, image_url)</li>
              </ul>
            </div>

            <form onSubmit={handleCsvImportSubmit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Berkas CSV/Excel (.csv, .xlsx) *</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="form-input"
                  onChange={e => setCsvImportFile(e.target.files[0])}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCsvImportModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={csvImporting}>
                  {csvImporting ? '⏳ Mengimpor...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IMAGE ZOOM PREVIEW */}
      {zoomedImage && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'var(--overlay-backdrop)', zIndex: 1050,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }} onClick={() => setZoomedImage(null)}>
          <div style={{
            position: 'relative',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setZoomedImage(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                background: 'var(--accent)',
                border: 'none',
                color: 'var(--text-primary)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px var(--overlay-subtle)',
                zIndex: 10
              }}
            >
              ✕
            </button>
            <div style={{
              width: '600px',
              height: '600px',
              maxWidth: '90vw',
              maxHeight: '90vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--overlay-subtle)'
            }}>
              <img
                src={zoomedImage}
                alt="Product Preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pratinjau Foto Produk (600x600 px)
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles for Product Database */}
      <style jsx global>{`
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px var(--overlay-subtle);
          border-color: var(--status-neutral-soft) !important;
        }
        .thumbnail-container:hover .zoom-overlay {
          opacity: 1 !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
