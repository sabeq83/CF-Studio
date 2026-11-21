'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ContentFlowLogo from './ContentFlowLogo';
import ThemeToggle from './ThemeToggle';
import { menuKeyMap } from '../../lib/sidebar-nav';

export default function MobileNav({
  user,
  groupedSections = [],
  pathname,
  currentAccount = 'all',
  userBrandAccounts = [],
  handleLogout
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastActiveElementRef = useRef(null);

  // Accordion state di dalam drawer
  const [openSection, setOpenSection] = useState(null);

  // Auto-expand section aktif berdasarkan pathname
  useEffect(() => {
    if (!pathname) return;
    for (const sec of groupedSections) {
      if (sec.items.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))) {
        setOpenSection(sec.name);
        break;
      }
    }
  }, [pathname, groupedSections]);

  // Tutup drawer secara otomatis saat rute berpindah
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Kunci scroll halaman belakang dan atur fokus keyboard saat drawer terbuka
  useEffect(() => {
    if (isOpen) {
      lastActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      // Fokus ke tombol tutup
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
      if (lastActiveElementRef.current && typeof lastActiveElementRef.current.focus === 'function') {
        lastActiveElementRef.current.focus();
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleSection = (sectionName) => {
    setOpenSection(prev => (prev === sectionName ? null : sectionName));
  };

  // Cek hak akses untuk item bilah bawah
  const isMenuAllowed = (href) => {
    if (href === '/' || href === '/dashboard' || href === '/content-flow') return true;
    if (!user) return true;
    if (user.role === 'admin' || user.role === 'superadmin') return true;

    const requiredKey = menuKeyMap[href];
    if (!requiredKey) return true;

    return Array.isArray(user.menuPermissions) && user.menuPermissions.includes(requiredKey);
  };

  const showAutoPipeline = isMenuAllowed('/auto-pipeline');
  const showContentFlow = isMenuAllowed('/content-flow');

  return (
    <>
      {/* 1. BILAH ATAS (≤1024px) */}
      <header className="mobile-top-bar" aria-label="Bilah Navigasi Atas">
        <Link href="/dashboard" className="mobile-brand-link" aria-label="Beranda CF Studio">
          <ContentFlowLogo variant="horizontal" size="sm" showTagline={false} />
        </Link>

        <button
          ref={menuButtonRef}
          className="mobile-menu-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Buka Menu Navigasi"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation-drawer"
        >
          <span className="mobile-menu-icon" aria-hidden="true">☰</span>
          <span className="mobile-menu-label">Menu</span>
        </button>
      </header>

      {/* 2. BACKDROP & DRAWER PANEL (≤1024px) */}
      <div
        className={`mobile-nav-backdrop ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
      />

      <aside
        id="mobile-navigation-drawer"
        className={`mobile-nav-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Panel Menu Navigasi"
        aria-hidden={!isOpen}
      >
        {/* Header Drawer */}
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <ContentFlowLogo variant="horizontal" size="sm" showTagline={false} />
          </div>
          <button
            ref={closeButtonRef}
            className="mobile-drawer-close"
            onClick={() => setIsOpen(false)}
            aria-label="Tutup Menu Navigasi"
          >
            ✕
          </button>
        </div>

        {/* Informasi Akun / Brand Aktif */}
        {userBrandAccounts && userBrandAccounts.length > 0 && (
          <div className="mobile-drawer-context">
            <div className="mobile-drawer-context-label">Akun Brand Aktif:</div>
            <div className="mobile-drawer-brand-list">
              <Link
                href="/content-flow?account=all"
                className={`mobile-drawer-brand-chip ${currentAccount === 'all' ? 'active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                🌐 Semua Akun
              </Link>
              {userBrandAccounts.map((acc) => {
                const isActive = currentAccount.toLowerCase() === acc.toLowerCase();
                return (
                  <Link
                    key={acc}
                    href={`/content-flow?account=${encodeURIComponent(acc)}`}
                    className={`mobile-drawer-brand-chip ${isActive ? 'active' : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    🏷️ @{acc}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Daftar Navigasi Berkelompok */}
        <nav className="mobile-drawer-nav">
          {/* Dashboard Item Utama */}
          <Link
            href="/dashboard"
            className={`mobile-drawer-link ${pathname === '/dashboard' ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span className="mobile-drawer-icon">◈</span>
            <span className="mobile-drawer-text">Dashboard</span>
          </Link>

          {/* Section Accordions */}
          {groupedSections.map((sec) => {
            const isExpanded = openSection === sec.name;
            return (
              <div key={sec.name} className="mobile-drawer-section">
                <button
                  type="button"
                  className="mobile-drawer-section-trigger"
                  onClick={() => toggleSection(sec.name)}
                  aria-expanded={isExpanded}
                >
                  <span>{sec.name}</span>
                  <span className={`mobile-drawer-caret ${isExpanded ? 'open' : ''}`}>▾</span>
                </button>

                {isExpanded && (
                  <div className="mobile-drawer-section-items">
                    {sec.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`mobile-drawer-sublink ${isActive ? 'active' : ''}`}
                          onClick={() => setIsOpen(false)}
                        >
                          <span className="mobile-drawer-subicon">{item.icon || '•'}</span>
                          <span className="mobile-drawer-subtext">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer Drawer: Theme Toggle & Logout */}
        <div className="mobile-drawer-footer">
          <div className="mobile-drawer-theme-toggle">
            <ThemeToggle />
          </div>

          {user && (
            <div className="mobile-drawer-user-info">
              Masuk sebagai: <strong>{user.username}</strong> ({user.role})
            </div>
          )}

          <button
            type="button"
            className="mobile-drawer-logout-btn"
            onClick={() => {
              setIsOpen(false);
              handleLogout();
            }}
          >
            🚪 Keluar / Logout
          </button>
        </div>
      </aside>

      {/* 3. BILAH BAWAH (≤640px) */}
      <nav className="mobile-bottom-bar" aria-label="Bilah Navigasi Cepat Bawah">
        <Link
          href="/dashboard"
          className={`mobile-bottom-item ${pathname === '/dashboard' ? 'active' : ''}`}
        >
          <span className="mobile-bottom-icon">◈</span>
          <span className="mobile-bottom-label">Dashboard</span>
        </Link>

        {showAutoPipeline && (
          <Link
            href="/auto-pipeline"
            className={`mobile-bottom-item ${pathname?.startsWith('/auto-pipeline') ? 'active' : ''}`}
          >
            <span className="mobile-bottom-icon">⚡</span>
            <span className="mobile-bottom-label">Pipeline</span>
          </Link>
        )}

        {showContentFlow && (
          <Link
            href="/content-flow"
            className={`mobile-bottom-item ${pathname?.startsWith('/content-flow') ? 'active' : ''}`}
          >
            <span className="mobile-bottom-icon">📊</span>
            <span className="mobile-bottom-label">ContentFlow</span>
          </Link>
        )}

        <button
          type="button"
          className="mobile-bottom-item"
          onClick={() => setIsOpen(true)}
          aria-label="Buka Semua Menu"
        >
          <span className="mobile-bottom-icon">☰</span>
          <span className="mobile-bottom-label">Menu</span>
        </button>
      </nav>
    </>
  );
}
