'use client';

import { Suspense } from 'react';
import Sidebar from '../components/Sidebar';
import { ThreadsAffiliateRadar } from '../affiliate-studio/components/ThreadsAffiliateRadar';

export default function ThreadsLabsPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content" style={{ padding: '24px 32px' }}>
        <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <Suspense fallback={<div style={{ padding: '30px', color: 'var(--text-muted)' }}>Memuat Threads Labs...</div>}>
            <ThreadsAffiliateRadar />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

