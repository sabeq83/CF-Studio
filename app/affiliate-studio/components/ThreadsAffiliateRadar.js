'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export function ThreadsAffiliateRadar({ brandId, brandName }) {
  // State data utama
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [testingSchedule, setTestingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);

  const [opportunities, setOpportunities] = useState([]);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'ready' | 'posted'

  // State Jadwal Otomatis (Hari & Jam)
  const [schedule, setSchedule] = useState({
    is_active: true,
    schedule_mode: 'specific', // 'specific' | 'interval'
    active_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    specific_hours: ['08:00', '12:30', '17:00', '20:30'],
    interval_hours: 3,
    range_start: '07:00',
    range_end: '22:00',
    next_run_at: null
  });
  const [newHourInput, setNewHourInput] = useState('19:00');

  // Modal Edit Teks
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [editTextValue, setEditTextValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Status balasan yang sedang diproses
  const [replyingMap, setReplyingMap] = useState({});

  // Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  }, []);

  // Fetch semua data awal
  const loadRadarData = useCallback(async () => {
    setLoading(true);
    try {
      const [kwRes, schedRes, oppRes] = await Promise.all([
        fetch('/api/v2/threads-radar/keywords').then(r => r.json()),
        fetch('/api/v2/threads-radar/schedule').then(r => r.json()),
        fetch('/api/v2/threads-radar/opportunities').then(r => r.json())
      ]);

      if (kwRes.success) setKeywords(kwRes.data || []);
      if (schedRes.success && schedRes.data) {
        setSchedule(prev => ({
          ...prev,
          ...schedRes.data,
          active_days: schedRes.data.active_days || prev.active_days,
          specific_hours: schedRes.data.specific_hours || prev.specific_hours
        }));
      }
      if (oppRes.success) setOpportunities(oppRes.data || []);
    } catch (err) {
      showToast(`Gagal memuat data radar: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRadarData();
  }, [loadRadarData]);

  // Tambah Kata Kunci
  const handleAddKeyword = async (e) => {
    e?.preventDefault();
    const val = newKeyword.trim();
    if (!val) return;

    setAddingKeyword(true);
    try {
      const res = await fetch('/api/v2/threads-radar/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: val, category: 'shopee_affiliate' })
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal menambah kata kunci');

      setKeywords(prev => [res.data, ...prev]);
      setNewKeyword('');
      showToast(`✓ Kata kunci "${val}" berhasil ditambahkan`);
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setAddingKeyword(false);
    }
  };

  // Hapus Kata Kunci
  const handleDeleteKeyword = async (id, word) => {
    try {
      const res = await fetch(`/api/v2/threads-radar/keywords?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal menghapus');
      setKeywords(prev => prev.filter(k => k.id !== id));
      showToast(`Kata kunci "${word}" dihapus`);
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    }
  };

  // Trigger Scan Manual
  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/v2/threads-radar/scan', { method: 'POST' }).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Gagal memindai');

      showToast(`✓ ${res.message || 'Pemindaian selesai'}`);
      // Refresh peluang
      const oppRes = await fetch('/api/v2/threads-radar/opportunities').then(r => r.json());
      if (oppRes.success) setOpportunities(oppRes.data || []);
    } catch (err) {
      showToast(`Gagal scan: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  };

  // Simpan Jadwal
  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/v2/threads-radar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal menyimpan jadwal');

      setSchedule(prev => ({ ...prev, ...res.data }));
      showToast('✓ Konfigurasi Penjadwalan Radar Berhasil Disimpan!');
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Uji Eksekusi Jadwal
  const handleTestScheduleNow = async () => {
    setTestingSchedule(true);
    try {
      const res = await fetch('/api/v2/threads-radar/scan', { method: 'POST' }).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Gagal uji jadwal');

      showToast(`✓ Uji Eksekusi Sukses: ${res.data?.postsFound || 0} postingan baru terdeteksi`);
      const oppRes = await fetch('/api/v2/threads-radar/opportunities').then(r => r.json());
      if (oppRes.success) setOpportunities(oppRes.data || []);
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setTestingSchedule(false);
    }
  };

  // Preset Hari
  const setDayPreset = (preset) => {
    if (preset === 'all') {
      setSchedule(prev => ({
        ...prev,
        active_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
      }));
    } else if (preset === 'workdays') {
      setSchedule(prev => ({
        ...prev,
        active_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']
      }));
    } else if (preset === 'weekends') {
      setSchedule(prev => ({
        ...prev,
        active_days: ['Sabtu', 'Minggu']
      }));
    }
  };

  // Toggle Hari Kustom
  const toggleDay = (dayName) => {
    setSchedule(prev => {
      const current = prev.active_days || [];
      const updated = current.includes(dayName)
        ? current.filter(d => d !== dayName)
        : [...current, dayName];
      return { ...prev, active_days: updated };
    });
  };

  // Tambah Jam Slot
  const handleAddHourSlot = () => {
    if (!newHourInput) return;
    const cleanHour = newHourInput.trim();
    if (schedule.specific_hours.includes(cleanHour)) {
      showToast(`⚠️ Jam ${cleanHour} sudah ada di daftar`);
      return;
    }
    const updated = [...schedule.specific_hours, cleanHour].sort();
    setSchedule(prev => ({ ...prev, specific_hours: updated }));
    showToast(`✓ Jam scan ditambahkan: ${cleanHour} WIB`);
  };

  // Hapus Jam Slot
  const handleRemoveHourSlot = (hour) => {
    setSchedule(prev => ({
      ...prev,
      specific_hours: prev.specific_hours.filter(h => h !== hour)
    }));
  };

  // Approve & Reply
  const handleApproveReply = async (draftId) => {
    setReplyingMap(prev => ({ ...prev, [draftId]: 'sending' }));
    try {
      const res = await fetch(`/api/v2/threads-radar/reply/${draftId}`, {
        method: 'POST'
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal mengirim balasan');

      setReplyingMap(prev => ({ ...prev, [draftId]: 'sent' }));
      showToast('✓ Balasan berhasil dikirim & live di Threads!');

      // Update state opportunity
      setOpportunities(prev => prev.map(item => {
        if (item.draft_id === draftId) {
          return { ...item, draft_status: 'posted' };
        }
        return item;
      }));
    } catch (err) {
      setReplyingMap(prev => ({ ...prev, [draftId]: 'failed' }));
      showToast(`Gagal: ${err.message}`, 'error');
    }
  };

  // Skip Opportunity
  const handleSkipOpportunity = async (draftId) => {
    try {
      const res = await fetch(`/api/v2/threads-radar/reply/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' })
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal melewati peluang');

      setOpportunities(prev => prev.filter(item => item.draft_id !== draftId));
      showToast('Peluang dilewati');
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    }
  };

  // Buka Modal Edit
  const handleOpenEdit = (item) => {
    setEditingDraft(item);
    setEditTextValue(item.reply_text || '');
    setEditModalOpen(true);
  };

  // Simpan Edit Teks
  const handleSaveEdit = async () => {
    if (!editingDraft) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v2/threads-radar/reply/${editingDraft.draft_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: editTextValue })
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error || 'Gagal menyimpan perubahan');

      setOpportunities(prev => prev.map(item => {
        if (item.draft_id === editingDraft.draft_id) {
          return { ...item, reply_text: editTextValue };
        }
        return item;
      }));

      setEditModalOpen(false);
      showToast('✓ Teks balasan berhasil diperbarui');
    } catch (err) {
      showToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter Peluang
  const filteredOpportunities = useMemo(() => {
    if (filterTab === 'ready') {
      return opportunities.filter(o => o.draft_status === 'draft' || o.draft_status === 'pending_review');
    }
    if (filterTab === 'posted') {
      return opportunities.filter(o => o.draft_status === 'posted');
    }
    return opportunities;
  }, [opportunities, filterTab]);

  // Rangkuman Hari
  const daySummaryText = useMemo(() => {
    const days = schedule.active_days || [];
    if (days.length === 7) return '✓ Berjalan setiap hari: Senin s/d Minggu (7 hari aktif)';
    if (days.length === 5 && !days.includes('Sabtu') && !days.includes('Minggu')) {
      return '✓ Berjalan pada hari kerja: Senin s/d Jumat (5 hari aktif)';
    }
    if (days.length === 2 && days.includes('Sabtu') && days.includes('Minggu')) {
      return '✓ Berjalan pada akhir pekan: Sabtu & Minggu (2 hari aktif)';
    }
    if (days.length === 0) return '⚠️ Tidak ada hari yang dipilih! Silakan aktifkan minimal 1 hari.';
    return `✓ Berjalan pada: ${days.join(', ')} (${days.length} hari aktif)`;
  }, [schedule.active_days]);

  // Metrik Cards
  const readyCount = useMemo(() => {
    return opportunities.filter(o => o.draft_status === 'draft' || o.draft_status === 'pending_review').length;
  }, [opportunities]);

  const postedCount = useMemo(() => {
    return opportunities.filter(o => o.draft_status === 'posted').length;
  }, [opportunities]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header Bar */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0,0,0,0.15))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-sm, 12px)',
            background: 'var(--surface-interactive)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            🧵
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Threads Labs
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs, 6px)',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: 'var(--status-success-soft)',
                color: 'var(--status-success)'
              }}>
                ● Repliz API Live
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Laboratorium Social Selling & Autonomous Reply Engine via Repliz API untuk rekomendasi produk Shopee.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={scanning}
            style={{
              backgroundColor: 'var(--action-primary)',
              color: 'var(--on-action-primary)',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 'var(--radius-sm, 8px)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: scanning ? 0.7 : 1,
              transition: 'var(--transition)'
            }}
          >
            <span>{scanning ? '⏳' : '🔍'}</span>
            <span>{scanning ? 'Memindai Threads via Repliz...' : 'Scan Threads Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Peluang Terpantau
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {opportunities.length}
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--status-info-soft)', color: 'var(--status-info)', fontWeight: 600 }}>
              +{opportunities.length} Total
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Dari {keywords.filter(k => k.is_active).length} kata kunci pemantau aktif
          </span>
        </div>

        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Draf Jawaban Siap Review
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {readyCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Tercocokkan produk Shopee oleh Gemini AI
          </span>
        </div>

        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Balasan Terkirim
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {postedCount}
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--status-success-soft)', color: 'var(--status-success)', fontWeight: 600 }}>
              ✓ 100% Live
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Via akun @kost_sasyahouse (Repliz)
          </span>
        </div>

        <div style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Jadwal Radar Otomatis
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {schedule.specific_hours.length}x / Hari
            <span style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: schedule.is_active ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
              color: schedule.is_active ? 'var(--status-success)' : 'var(--status-warning)',
              fontWeight: 600
            }}>
              {schedule.is_active ? '● Aktif' : '○ Nonaktif'}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {schedule.is_active ? 'Jadwal scan otomatis terhubung' : 'Mode manual diaktifkan'}
          </span>
        </div>
      </div>

      {/* Keyword Radar Card */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md, 12px)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            📡 Radar Kata Kunci yang Dipantau:
          </strong>
        </div>

        {/* Chips Kata Kunci */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {keywords.map(kw => (
            <div
              key={kw.id}
              style={{
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{kw.keyword}</span>
              <span
                onClick={() => handleDeleteKeyword(kw.id, kw.keyword)}
                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'bold' }}
                title="Hapus kata kunci"
              >
                ×
              </span>
            </div>
          ))}
          {keywords.length === 0 && !loading && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Belum ada kata kunci pemantau. Tambahkan kata kunci di bawah.
            </span>
          )}
        </div>

        {/* Form Tambah Kata Kunci */}
        <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Tambah kata kunci baru (contoh: wajan anti lengket, mic wireless, botol minum)..."
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm, 8px)',
              fontSize: '0.85rem',
              outline: 'none',
              flex: 1,
              minWidth: '240px'
            }}
          />
          <button
            type="submit"
            disabled={addingKeyword}
            style={{
              backgroundColor: 'var(--surface-interactive)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm, 8px)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: addingKeyword ? 'not-allowed' : 'pointer'
            }}
          >
            {addingKeyword ? 'Menambahkan...' : '+ Tambah Kata Kunci'}
          </button>
        </form>
      </div>

      {/* Scheduler Card (Hari & Jam) */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md, 12px)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0,0,0,0.15))'
      }}>
        {/* Scheduler Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm, 8px)',
              backgroundColor: 'var(--surface-interactive)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>
              ⏰
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Penjadwalan Pencarian Otomatis (Threads Labs Cron)
                </strong>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: schedule.is_active ? 'var(--status-success-soft)' : 'var(--status-warning-soft)',
                  color: schedule.is_active ? 'var(--status-success)' : 'var(--status-warning)'
                }}>
                  {schedule.is_active ? '● Aktif' : '○ Nonaktif'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Agen 1 (Radar) akan otomatis memindai Threads menggunakan API Repliz sesuai hari dan jam yang ditentukan.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={schedule.is_active}
                onChange={(e) => setSchedule(prev => ({ ...prev, is_active: e.target.checked }))}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: schedule.is_active ? 'var(--action-primary)' : 'var(--surface-interactive)',
                border: '1px solid var(--border-strong)',
                borderRadius: '24px',
                transition: 'var(--transition)'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '16px',
                  width: '16px',
                  left: '3px',
                  bottom: '3px',
                  backgroundColor: schedule.is_active ? 'var(--on-action-primary)' : 'var(--text-primary)',
                  borderRadius: '50%',
                  transform: schedule.is_active ? 'translateX(20px)' : 'none',
                  transition: 'var(--transition)'
                }} />
              </span>
            </label>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {schedule.is_active ? 'Jadwal Aktif' : 'Jadwal Nonaktif'}
            </span>
          </div>
        </div>

        {/* Scheduler Body */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '18px',
          opacity: schedule.is_active ? 1 : 0.45,
          pointerEvents: schedule.is_active ? 'auto' : 'none',
          transition: 'var(--transition)'
        }}>
          {/* Section 1: Pilihan Hari */}
          <div style={{
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm, 8px)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <span>📅</span> 1. Pilih Hari Pemindaian
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDayPreset('all')}
                  style={{
                    backgroundColor: schedule.active_days.length === 7 ? 'var(--surface-interactive)' : 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-xs, 6px)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Semua Hari
                </button>
                <button
                  type="button"
                  onClick={() => setDayPreset('workdays')}
                  style={{
                    backgroundColor: schedule.active_days.length === 5 && !schedule.active_days.includes('Sabtu') ? 'var(--surface-interactive)' : 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-xs, 6px)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hari Kerja
                </button>
                <button
                  type="button"
                  onClick={() => setDayPreset('weekends')}
                  style={{
                    backgroundColor: schedule.active_days.length === 2 && schedule.active_days.includes('Sabtu') ? 'var(--surface-interactive)' : 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-xs, 6px)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Akhir Pekan
                </button>
              </div>
            </div>

            {/* Day Selector Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((d, idx) => {
                const shortLabel = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][idx];
                const isActive = schedule.active_days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    style={{
                      flex: 1,
                      minWidth: '40px',
                      padding: '8px 0',
                      textAlign: 'center',
                      backgroundColor: isActive ? 'var(--action-primary)' : 'var(--surface)',
                      color: isActive ? 'var(--on-action-primary)' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--action-primary)' : 'var(--border-subtle)',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--status-success)', fontWeight: 500 }}>
              {daySummaryText}
            </div>
          </div>

          {/* Section 2: Pilihan Jam */}
          <div style={{
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm, 8px)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <span>⏰</span> 2. Pilih Jam Pemindaian
              </span>
              <div style={{ display: 'inline-flex', backgroundColor: 'var(--surface)', padding: '2px', borderRadius: 'var(--radius-xs, 6px)', border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setSchedule(prev => ({ ...prev, schedule_mode: 'specific' }))}
                  style={{
                    backgroundColor: schedule.schedule_mode === 'specific' ? 'var(--surface-interactive)' : 'transparent',
                    border: 'none',
                    color: schedule.schedule_mode === 'specific' ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-xs, 6px)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Jam Spesifik
                </button>
                <button
                  type="button"
                  onClick={() => setSchedule(prev => ({ ...prev, schedule_mode: 'interval' }))}
                  style={{
                    backgroundColor: schedule.schedule_mode === 'interval' ? 'var(--surface-interactive)' : 'transparent',
                    border: 'none',
                    color: schedule.schedule_mode === 'interval' ? 'var(--text-primary)' : 'var(--text-muted)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-xs, 6px)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Interval Jam
                </button>
              </div>
            </div>

            {/* Mode A: Jam Spesifik */}
            {schedule.schedule_mode === 'specific' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {schedule.specific_hours.map(hour => (
                    <div
                      key={hour}
                      style={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border-subtle)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-xs, 6px)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{hour} WIB</span>
                      <span
                        onClick={() => handleRemoveHourSlot(hour)}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="time"
                    value={newHourInput}
                    onChange={(e) => setNewHourInput(e.target.value)}
                    style={{
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddHourSlot}
                    style={{
                      backgroundColor: 'var(--surface-interactive)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + Tambah Jam Scan
                  </button>
                </div>
              </div>
            )}

            {/* Mode B: Interval Jam */}
            {schedule.schedule_mode === 'interval' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Frekuensi:</span>
                  <select
                    value={schedule.interval_hours}
                    onChange={(e) => setSchedule(prev => ({ ...prev, interval_hours: parseInt(e.target.value, 10) }))}
                    style={{
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  >
                    <option value={2}>Setiap 2 Jam Sekali</option>
                    <option value={3}>Setiap 3 Jam Sekali</option>
                    <option value={4}>Setiap 4 Jam Sekali</option>
                    <option value={6}>Setiap 6 Jam Sekali</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rentang jam aktif:</span>
                  <input
                    type="time"
                    value={schedule.range_start}
                    onChange={(e) => setSchedule(prev => ({ ...prev, range_start: e.target.value }))}
                    style={{
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.8rem'
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>s/d</span>
                  <input
                    type="time"
                    value={schedule.range_end}
                    onChange={(e) => setSchedule(prev => ({ ...prev, range_end: e.target.value }))}
                    style={{
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-xs, 6px)',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Banner */}
        <div style={{
          backgroundColor: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm, 8px)',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>⏳</span>
              <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                {schedule.next_run_at
                  ? `Jadwal Berikutnya: ${new Date(schedule.next_run_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                  : 'Jadwal Berikutnya: Siap berjalan sesuai slot aktif'}
              </strong>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              🛡️ <strong>Safety Shield:</strong> Jitter delay acak ±5 menit aktif untuk mencegah pola bot terjadwal pada Repliz API.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleTestScheduleNow}
              disabled={testingSchedule}
              style={{
                backgroundColor: 'var(--surface-interactive)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: testingSchedule ? 'not-allowed' : 'pointer'
              }}
            >
              <span>⚡</span> {testingSchedule ? 'Mengeksekusi...' : 'Uji Eksekusi Jadwal'}
            </button>
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              style={{
                backgroundColor: 'var(--action-primary)',
                color: 'var(--on-action-primary)',
                border: 'none',
                padding: '7px 16px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: savingSchedule ? 'not-allowed' : 'pointer'
              }}
            >
              <span>💾</span> {savingSchedule ? 'Menyimpan...' : 'Simpan Konfigurasi Jadwal'}
            </button>
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 16px)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0,0,0,0.15))'
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--surface-raised)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Daftar Peluang Relevan (Semi-Autopilot)
            </strong>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: filterTab === 'all' ? 'var(--surface-interactive)' : 'transparent',
                  color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Semua ({opportunities.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('ready')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: filterTab === 'ready' ? 'var(--surface-interactive)' : 'transparent',
                  color: filterTab === 'ready' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Siap Review ({readyCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('posted')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: filterTab === 'posted' ? 'var(--surface-interactive)' : 'transparent',
                  color: filterTab === 'posted' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Terkirim ({postedCount})
              </button>
            </div>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Akun Aktif: <strong>@kost_sasyahouse</strong> (Repliz Connected)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: '32%' }}>Postingan Threads (Target)</th>
                <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: '25%' }}>Solusi Produk Shopee</th>
                <th style={{ padding: '12px 18px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: '33%' }}>Draf Balasan AI (Agen 2)</th>
                <th style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: '10%' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.map(item => {
                const isReplying = replyingMap[item.draft_id] === 'sending';
                const isPosted = item.draft_status === 'posted' || replyingMap[item.draft_id] === 'sent';

                return (
                  <tr key={item.draft_id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: isPosted ? 0.75 : 1 }}>
                    {/* Postingan Threads */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-interactive)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            👤
                          </div>
                          <div>
                            <a
                              href={item.post_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--action-primary)', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                            >
                              @{item.author_username || 'user'}
                            </a>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Kata Kunci: "{item.keyword_tag || 'radar'}"
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45, backgroundColor: 'var(--surface-subtle)', padding: '10px', borderRadius: 'var(--radius-xs, 6px)', border: '1px solid var(--border-subtle)' }}>
                          "{item.post_content}"
                        </div>
                      </div>
                    </td>

                    {/* Produk Shopee */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {item.product_image_url && (
                          <img
                            src={item.product_image_url}
                            alt={item.product_name || 'Produk'}
                            style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-xs, 6px)', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                            {item.product_name || 'Produk Shopee'}
                          </span>
                          <span style={{ color: 'var(--action-primary)', fontWeight: 700, fontSize: '0.8rem' }}>
                            {item.product_price ? `Rp ${Number(item.product_price).toLocaleString('id-ID')}` : 'Rp -'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Draf Balasan AI */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{
                          alignSelf: 'flex-start',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs, 6px)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: item.reply_strategy === 'direct_link' ? 'var(--status-info-soft)' : 'var(--surface-interactive)',
                          color: item.reply_strategy === 'direct_link' ? 'var(--status-info)' : 'var(--text-secondary)'
                        }}>
                          {item.reply_strategy === 'direct_link' ? '🔗 Strategi: Direct Link' : '💬 Strategi: Soft Recommendation'}
                        </span>
                        <div style={{
                          backgroundColor: 'var(--surface-raised)',
                          padding: '12px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.82rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.45
                        }}>
                          {item.reply_text}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--status-success)', fontWeight: 600 }}>
                          ✓ Skor AI: {item.ai_confidence_score || 85}% Relevan
                        </div>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td style={{ padding: '16px 18px', verticalAlign: 'top', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isPosted ? (
                          <span style={{
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-xs, 6px)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: 'var(--status-success-soft)',
                            color: 'var(--status-success)'
                          }}>
                            ✓ Terkirim ke Threads!
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveReply(item.draft_id)}
                              disabled={isReplying}
                              style={{
                                backgroundColor: 'var(--action-primary)',
                                color: 'var(--on-action-primary)',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-xs, 6px)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: isReplying ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>{isReplying ? '⏳' : '✓'}</span>
                              <span>{isReplying ? 'Mengirim...' : 'Setujui & Balas'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              style={{
                                backgroundColor: 'var(--surface-interactive)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-subtle)',
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-xs, 6px)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Edit Teks
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSkipOpportunity(item.draft_id)}
                              style={{
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                border: 'none',
                                padding: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              Lewati
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOpportunities.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Tidak ada peluang pada filter ini. Klik <strong>Scan Threads Sekarang</strong> untuk memindai netizen Threads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Draf */}
      {editModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--overlay-backdrop, rgba(2, 6, 14, 0.76))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg, 16px)',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-modal)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              ✏️ Sesuaikan Naskah Balasan AI
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Edit teks balasan agar tetap terdengar santai, ramah, dan natural sebelum diunggah ke Threads.
            </p>
            <textarea
              rows={5}
              value={editTextValue}
              onChange={(e) => setEditTextValue(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
                padding: '12px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              📷 Foto Produk Terlampir: <strong>Otomatis diunggah via Repliz API</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                style={{
                  backgroundColor: 'var(--surface-interactive)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: savingEdit ? 'not-allowed' : 'pointer'
                }}
              >
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Popup */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid',
        borderColor: toast.type === 'error' ? 'var(--status-danger)' : 'var(--status-success)',
        color: 'var(--text-primary)',
        padding: '12px 20px',
        borderRadius: 'var(--radius-sm, 8px)',
        boxShadow: 'var(--shadow-modal)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.85rem',
        fontWeight: 600,
        zIndex: 1000,
        transform: toast.show ? 'translateY(0)' : 'translateY(100px)',
        opacity: toast.show ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: toast.show ? 'auto' : 'none'
      }}>
        <span>{toast.type === 'error' ? '❌' : '✓'}</span>
        <span>{toast.message}</span>
      </div>

    </div>
  );
}
