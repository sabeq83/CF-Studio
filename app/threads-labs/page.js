'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { ThreadsAffiliateRadar } from '../affiliate-studio/components/ThreadsAffiliateRadar';

export default function ThreadsLabsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setAuthLoading(false));
  }, []);

  const isTenantLocked = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return false;
    return Array.isArray(currentUser.tenantDisabledMenus) && currentUser.tenantDisabledMenus.includes('threads_labs');
  }, [currentUser]);

  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content" style={{ padding: '24px 32px' }}>
        <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto' }}>
          {authLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memverifikasi otorisasi akses Threads Labs...
            </div>
          ) : isTenantLocked ? (
            <div style={{
              margin: '40px auto',
              maxWidth: 680,
              padding: '36px 32px',
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              textAlign: 'center',
              boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: 16 }}>🔒</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                Akses Modul Dibatasi
              </h2>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 24px auto' }}>
                Modul <strong>Threads Labs (Utas AI & Autopilot Publishing)</strong> saat ini dinonaktifkan untuk organisasi / tenant Anda oleh Superadmin. Silakan hubungi administrator Anda untuk mendapatkan akses aktivasi.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => router.push('/dashboard')}
                style={{
                  background: 'var(--action-primary)',
                  color: 'var(--on-action-primary)',
                  padding: '10px 24px',
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                Kembali ke Dashboard
              </button>
            </div>
          ) : (
            <Suspense fallback={<div style={{ padding: '30px', color: 'var(--text-muted)' }}>Memuat Threads Labs...</div>}>
              <ThreadsAffiliateRadar />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
