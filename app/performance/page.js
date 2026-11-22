'use client';

import Sidebar from '../components/Sidebar';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';

export default function PerformanceAnalyticsPage() {
  const [period, setPeriod] = useState('7d');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [accountsData, setAccountsData] = useState(null);
  const [postsData, setPostsData] = useState([]);
  const [healthData, setHealthData] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({ period });
      if (selectedPlatform !== 'all') qParams.set('platform', selectedPlatform);
      if (selectedBrand !== 'all') qParams.set('brandId', selectedBrand);

      const [accRes, postRes, healthRes] = await Promise.all([
        fetch(`/api/v2/analytics/accounts?${qParams.toString()}`).then(r => r.json()),
        fetch(`/api/v2/analytics/posts?tag=latest&limit=100${selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : ''}`).then(r => r.json()),
        fetch('/api/v2/analytics/health').then(r => r.json())
      ]);

      if (accRes.success) setAccountsData(accRes.data);
      if (postRes.success) setPostsData(postRes.data?.posts || []);
      if (healthRes.success) setHealthData(healthRes.data);
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
      showToast('Gagal memuat data analitik: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [period, selectedBrand, selectedPlatform]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleCollectNow = async () => {
    setCollecting(true);
    try {
      const res = await fetch('/api/v2/analytics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Pengumpulan metrik berhasil dijalankan.');
        await loadAnalytics();
      } else {
        showToast('Error: ' + (json.error || 'Gagal mengambil metrik'));
      }
    } catch (err) {
      showToast('Gagal memicu pengumpulan data: ' + err.message);
    } finally {
      setCollecting(false);
    }
  };

  // Filter video postingan di sisi klien berdasarkan jenis konten
  const filteredPosts = useMemo(() => {
    return postsData.filter(post => {
      if (selectedBrand !== 'all' && post.brandId !== selectedBrand) return false;
      if (selectedPlatform !== 'all' && post.platform !== selectedPlatform) return false;

      if (selectedType !== 'all') {
        const titleLower = (post.title || '').toLowerCase();
        if (selectedType === 'multiplier' && !titleLower.includes('multiplier')) return false;
        if (selectedType === 'resep' && !titleLower.includes('resep') && !titleLower.includes('jus') && !titleLower.includes('masak')) return false;
        if (selectedType === 'produk' && !titleLower.includes('produk') && !titleLower.includes('affiliate')) return false;
        if (selectedType === 'editorial' && !titleLower.includes('editorial')) return false;
      }
      return true;
    });
  }, [postsData, selectedBrand, selectedPlatform, selectedType]);

  const summary = accountsData?.summary || {
    views: 0, reach: 0, engagement: 0, netFollows: 0,
    viewsGrowth: 0, reachGrowth: 0, engagementGrowth: 0, netFollowsGrowth: 0
  };

  return (
    <div className="layout-with-sidebar">
      <Sidebar />

      <main className="main-content page-content-responsive" style={{
        background: 'var(--canvas)',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        padding: '28px 36px'
      }}>
        <div style={{ maxWidth: '1360px', margin: '0 auto' }}>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{
              position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
              padding: '12px 20px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-raised)', color: 'var(--text-primary)',
              border: '1px solid var(--status-success)', boxShadow: 'var(--shadow-modal)',
              display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 500
            }}>
              <span>✅</span>
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Header Bar */}
          <header style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid var(--border-subtle)',
            flexWrap: 'wrap', gap: '16px'
          }}>
            <div>
              <h1 style={{
                fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <span>📊</span> Analitik Performa Konten
                <span style={{
                  fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                  background: 'var(--status-info-soft)', color: 'var(--status-info)'
                }}>
                  Gelombang 1
                </span>
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Pelaporan metrik lintas platform: Facebook via App Meta, Instagram, TikTok, YouTube &amp; Threads via Repliz API
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={handleCollectNow}
                disabled={collecting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '9px 16px', borderRadius: 'var(--radius-sm)',
                  fontSize: '13px', fontWeight: 600, cursor: collecting ? 'not-allowed' : 'pointer',
                  background: 'var(--action-primary)', color: 'var(--on-action-primary)',
                  border: 'none', transition: 'var(--transition)'
                }}
              >
                <span>{collecting ? '⏳ Mengambil...' : '⚡ Ambil Data Sekarang'}</span>
              </button>
            </div>
          </header>

          {/* Filter Bar */}
          <section style={{
            background: 'var(--surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px',
            display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Rentang Pekan
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                  background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                  fontSize: '13px', outline: 'none'
                }}
              >
                <option value="7d">7 Hari Terakhir</option>
                <option value="14d">14 Hari Terakhir</option>
                <option value="30d">30 Hari Terakhir</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Filter Brand
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                style={{
                  background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                  fontSize: '13px', outline: 'none'
                }}
              >
                <option value="all">Semua Brand</option>
                <option value="dapurbotani">Dapur Botani</option>
                <option value="nutribake">NutriBake ID</option>
                <option value="habitfolk">HabitFolk</option>
                <option value="siasatsehat">Siasat Sehat</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Jenis Video
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                  fontSize: '13px', outline: 'none'
                }}
              >
                <option value="all">Semua Jenis</option>
                <option value="multiplier">Multiplier</option>
                <option value="resep">Resep Organik</option>
                <option value="produk">Produk Afiliasi</option>
                <option value="editorial">Editorial</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Platform
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                style={{
                  background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                  fontSize: '13px', outline: 'none'
                }}
              >
                <option value="all">Semua Platform</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="threads">Threads</option>
              </select>
            </div>
          </section>

          {/* Kotak Edukatif: Facebook Tanpa App Meta */}
          {healthData && healthData.accounts?.unknown > 0 && (
            <div style={{
              background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning)',
              borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px',
              display: 'flex', gap: '16px', alignItems: 'flex-start'
            }}>
              <div style={{ fontSize: '22px', lineHeight: 1 }}>⚠️</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-warning)', marginBottom: '4px' }}>
                  Halaman Facebook Belum Terhubung ke App Meta
                </h4>
                <p>
                  Terdapat {healthData.accounts?.unknown} halaman yang belum ditautkan dengan Page Access Token App Meta.
                  Metrik video Reels dan jangkauan organik Facebook membutuhkan izin langsung Graph API v25.0.
                  Status saat ini adalah <em>Belum Ditautkan</em> (bukan angka 0 palsu).
                </p>
                <div style={{ marginTop: '6px' }}>
                  <Link href="/settings" style={{ color: 'var(--link)', fontWeight: 600, textDecoration: 'underline' }}>
                    Buka Settings → Meta Publishing Accounts untuk menghubungkan halaman
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Executive Summary Cards */}
          <section style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px', marginBottom: '24px'
          }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Total Tayangan (Views)
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {Number(summary.views || 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: summary.viewsGrowth >= 0 ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: 600 }}>
                  {summary.viewsGrowth >= 0 ? `↑ +${summary.viewsGrowth}%` : `↓ ${summary.viewsGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs periode sebelumnya</span>
              </div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Total Jangkauan (Reach)
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {Number(summary.reach || 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: summary.reachGrowth >= 0 ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: 600 }}>
                  {summary.reachGrowth >= 0 ? `↑ +${summary.reachGrowth}%` : `↓ ${summary.reachGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>vs periode sebelumnya</span>
              </div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Total Interaksi
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {Number(summary.engagement || 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: summary.engagementGrowth >= 0 ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: 600 }}>
                  {summary.engagementGrowth >= 0 ? `↑ +${summary.engagementGrowth}%` : `↓ ${summary.engagementGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>reaksi, komen, share, simpan</span>
              </div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Pengikut Baru Bersih
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {Number(summary.netFollows || 0) >= 0 ? `+${Number(summary.netFollows || 0).toLocaleString('id-ID')}` : Number(summary.netFollows || 0).toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: summary.netFollowsGrowth >= 0 ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: 600 }}>
                  {summary.netFollowsGrowth >= 0 ? `↑ +${summary.netFollowsGrowth}%` : `↓ ${summary.netFollowsGrowth}%`}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>pertumbuhan net</span>
              </div>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                Video Teranalisis
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {filteredPosts.length} Video
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Snapshot performa tersimpan
              </div>
            </div>
          </section>

          {/* Breakdown Per Brand */}
          {accountsData?.accounts && accountsData.accounts.length > 0 && (
            <section style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏢 Performa Akun &amp; Brand
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {accountsData.accounts.map(acc => (
                  <div key={acc.id} style={{
                    background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', padding: '16px 18px', boxShadow: 'var(--shadow-card)'
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{acc.displayName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {acc.platform} &bull; {acc.brandName}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                        background: acc.provider === 'meta' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                        color: acc.provider === 'meta' ? '#3b82f6' : '#f472b6', fontWeight: 600
                      }}>
                        {acc.provider === 'meta' ? 'Meta App' : 'Repliz'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>
                      <span>Tayangan:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {Number(acc.metrics?.views || 0).toLocaleString('id-ID')}
                        <span style={{ fontSize: '11px', marginLeft: '6px', color: acc.growth?.viewsPct >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                          ({acc.growth?.viewsPct >= 0 ? '+' : ''}{acc.growth?.viewsPct}%)
                        </span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>
                      <span>Jangkauan:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {Number(acc.metrics?.reach || 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>
                      <span>Interaksi:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {Number(acc.metrics?.engagement || 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', color: 'var(--text-secondary)' }}>
                      <span>Followers Total:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {acc.followersTotal != null ? Number(acc.followersTotal).toLocaleString('id-ID') : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tabel Performa Video */}
          <section style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                🎬 Peringkat Video &amp; Skor Keterlibatan
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {filteredPosts.length} video ditampilkan
              </span>
            </div>

            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Video &amp; Konten</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Brand &amp; Akun</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Waktu Publikasi</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Jangkauan / Views</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Durasi Tonton</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Interaksi</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Skor</th>
                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {loading ? 'Memuat data performa video...' : 'Belum ada data snapshot video yang cocok dengan filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPosts.map(post => {
                      const isImmature = post.ageHours != null && post.ageHours < 72;
                      const isWin = post.engagementScore >= 1000;
                      const isWeak = post.engagementScore < 100 && post.ageHours >= 72;

                      return (
                        <tr key={post.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle', maxWidth: '340px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <div style={{
                                width: '42px', height: '42px', borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface-interactive)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
                              }}>
                                🎬
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{
                                  fontWeight: 600, color: 'var(--text-primary)',
                                  textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                }} title={post.title}>
                                  {post.title}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  {post.permalink && (
                                    <a href={post.permalink} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--link)', textDecoration: 'underline' }}>
                                      Buka Postingan ↗
                                    </a>
                                  )}
                                  <span style={{
                                    fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                                    background: 'var(--surface-interactive)', color: 'var(--text-muted)'
                                  }}>
                                    Tag: {post.snapshotTag}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{post.accountDisplayName}</div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                                background: post.source === 'meta_api' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                                color: post.source === 'meta_api' ? '#3b82f6' : '#f472b6', fontWeight: 600
                              }}>
                                {post.source === 'meta_api' ? 'Meta Graph' : 'Repliz API'}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                {post.platform}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div>{post.postCreatedAt ? new Date(post.postCreatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {post.ageHours != null ? `${Math.round(post.ageHours)} jam lalu` : '-'}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {post.views != null ? `${Number(post.views).toLocaleString('id-ID')} views` : '-'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {post.reach != null ? `${Number(post.reach).toLocaleString('id-ID')} reach` : '-'}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div>{post.avgWatchSec != null ? `${post.avgWatchSec.toFixed(1)} dtk` : '-'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {post.totalWatchSec != null ? `Total: ${Math.round(post.totalWatchSec / 60)} mnt` : '-'}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div>❤️ {post.likes != null ? Number(post.likes).toLocaleString('id-ID') : 0} &bull; 💬 {post.comments != null ? Number(post.comments).toLocaleString('id-ID') : 0}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ↗ {post.shares != null ? Number(post.shares).toLocaleString('id-ID') : 0} share &bull; 🔖 {post.saves != null ? Number(post.saves).toLocaleString('id-ID') : 0} simpan
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                              {post.engagementScore.toLocaleString('id-ID')}
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            {isImmature ? (
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                                background: 'var(--status-warning-soft)', color: 'var(--status-warning)'
                              }}>
                                ⏳ Belum Matang
                              </span>
                            ) : isWin ? (
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                                background: 'var(--status-success-soft)', color: 'var(--status-success)'
                              }}>
                                🏆 Menang
                              </span>
                            ) : isWeak ? (
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                                background: 'var(--status-danger-soft)', color: 'var(--status-danger)'
                              }}>
                                Lemah
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                                background: 'var(--surface-interactive)', color: 'var(--text-secondary)'
                              }}>
                                Standar
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Status Akun & Sumber Data */}
          {healthData?.accounts?.list && (
            <section style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                🔗 Status Akun Publishing &amp; Sumber Metrik
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {healthData.accounts.list.map(acc => {
                  const isMeta = acc.provider === 'meta';
                  const isAvailable = acc.insightsStatus === 'available' || acc.insightsStatus === 'ok';

                  return (
                    <div key={acc.id} style={{
                      background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)', padding: '14px 18px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{acc.displayName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Platform: <span style={{ textTransform: 'capitalize' }}>{acc.platform}</span> &bull; Provider: {isMeta ? 'Meta Graph API v25.0' : 'Repliz API Gold'}
                        </div>
                      </div>
                      <div>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                          background: isAvailable
                            ? 'var(--status-success-soft)'
                            : (acc.insightsStatus === 'unavailable' ? 'var(--status-warning-soft)' : 'var(--surface-interactive)'),
                          color: isAvailable
                            ? 'var(--status-success)'
                            : (acc.insightsStatus === 'unavailable' ? 'var(--status-warning)' : 'var(--text-muted)')
                        }}>
                          {isAvailable ? '✓ Insights Aktif' : (acc.insightsStatus === 'unavailable' ? '⚠️ Perlu Ditautkan' : acc.insightsStatus)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
