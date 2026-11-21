'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, Suspense, useMemo } from 'react';
import ThemeToggle from './ThemeToggle';
import ContentFlowLogo from './ContentFlowLogo';
import MobileNav from './MobileNav';
import { menuKeyMap, navItems, PLANNING_SECTION_HREFS } from '../../lib/sidebar-nav';

function getSectionForPath(pathname, sections) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') return null;
  for (const sec of sections) {
    if (sec.items.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))) {
      return sec.name;
    }
  }
  return null;
}

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAccount = searchParams ? (searchParams.get('account') || 'all') : 'all';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(err => console.error('[Sidebar Auth Check Failed]', err))
      .finally(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  const isMenuAllowed = (item) => {
    if (item.href === '/' || item.href === '/dashboard' || item.href === '/content-flow') return true;
    if (!user) return true;
    if (item.superadminOnly) return user.role === 'superadmin';
    if (user.role === 'admin') return true;
    if (user.role === 'superadmin') return false;
    if (item.adminOnly) return false;

    const requiredKey = menuKeyMap[item.href];
    if (!requiredKey) return true;

    return Array.isArray(user.menuPermissions) && user.menuPermissions.includes(requiredKey);
  };

  const checkIsTenantDisabled = (item) => {
    const menuKey = menuKeyMap[item.href];
    return user?.role !== 'superadmin' && menuKey && Array.isArray(user?.tenantDisabledMenus) && user.tenantDisabledMenus.includes(menuKey);
  };

  // Group items by section
  const groupedSections = useMemo(() => {
    const sections = [];
    let currentSec = null;

    for (const item of navItems) {
      if (item.href === '/dashboard') continue;
      if (item.section) {
        if (currentSec && currentSec.items.length > 0) {
          sections.push(currentSec);
        }
        currentSec = { name: item.section, items: [] };
      } else if (currentSec) {
        if (isMenuAllowed(item)) {
          currentSec.items.push(item);
        }
      }
    }
    if (currentSec && currentSec.items.length > 0) {
      sections.push(currentSec);
    }
    return sections;
  }, [user]);

  // Exclusive Accordion state: only 1 section open at any given time
  const [openSection, setOpenSection] = useState(() => {
    return getSectionForPath(pathname, [
      { name: 'PLANNING', items: navItems.filter(i => i.href && PLANNING_SECTION_HREFS.includes(i.href)) },
      { name: 'WORKFLOW', items: navItems.filter(i => i.href && ['/auto-pipeline', '/threads-labs', '/re-campaigns', '/pillar-campaigns', '/recipe-labs', '/multiplier-lab', '/product-bridge-inject'].includes(i.href)) },
      { name: 'PUBLISHING', items: navItems.filter(i => i.href && ['/content-flow', '/recipe-exporter'].includes(i.href)) },
      { name: 'TOOLS', items: navItems.filter(i => i.href && ['/video-studio', '/tts-studio'].includes(i.href)) },
      { name: 'SYSTEM', items: navItems.filter(i => i.href && ['/settings', '/settings/users', '/settings/tenants'].includes(i.href)) },
    ]) || 'WORKFLOW';
  });

  // Auto-expand section containing active pathname when route changes
  useEffect(() => {
    const activeSec = getSectionForPath(pathname, groupedSections);
    if (activeSec) {
      setOpenSection(activeSec);
    }
  }, [pathname, groupedSections]);

  const toggleSection = (sectionName) => {
    setOpenSection(prev => prev === sectionName ? null : sectionName);
  };

  const enabledMenusEnv = process.env.NEXT_PUBLIC_ENABLED_MENUS;
  const enabledMenusSet = enabledMenusEnv ? new Set(enabledMenusEnv.split(',')) : null;

  const userBrandAccounts = (user && Array.isArray(user.assignedBrandNames))
    ? user.assignedBrandNames
    : [];

  return (
    <>
      <aside className="sidebar">
      <div className="sidebar-brand" style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
          <ContentFlowLogo variant="horizontal" size="sm" showTagline={true} />
        </Link>
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            color: 'var(--action-primary)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            padding: '1px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            🔒 Internal Enterprise
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            v2.0 Staging
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Top-level Item: Dashboard */}
        <Link
          href="/dashboard"
          className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span className="nav-icon">◈</span>
          Dashboard
        </Link>

        {/* Collapsible Sections (Exclusive Single-Open Accordion) */}
        {groupedSections.map((sec) => {
          const isOpen = openSection === sec.name;

          return (
            <div key={sec.name} style={{ flexShrink: 0 }}>
              {/* Section Header Accordion Trigger */}
              <div
                className="sidebar-section-header"
                onClick={() => toggleSection(sec.name)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
              >
                <div className="sidebar-section-title">
                  <span>{sec.name}</span>
                </div>
                <div className="sidebar-section-right">
                  <span className="sidebar-section-count">{sec.items.length}</span>
                  <span className={`sidebar-section-chevron ${isOpen ? '' : 'collapsed'}`}>▼</span>
                </div>
              </div>

              {/* Collapsible Section Group */}
              <div className={`sidebar-section-group ${isOpen ? '' : 'collapsed'}`}>
                {sec.items.map((item) => {
                  const menuKey = menuKeyMap[item.href];
                  const isTenantDisabled = checkIsTenantDisabled(item);
                  const isMenuEnabled = (!enabledMenusSet || enabledMenusSet.has(item.href)) && !isTenantDisabled;

                  if (!isMenuEnabled) {
                    return (
                      <div
                        key={item.href}
                        className="nav-link disabled"
                        onClick={() => alert(`Modul "${item.label}" dinonaktifkan oleh Superadmin untuk organisasi/tenant Anda.`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          opacity: 0.4,
                          cursor: 'not-allowed',
                          userSelect: 'none',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          marginBottom: '2px'
                        }}
                        title="Modul ini dinonaktifkan oleh Superadmin"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="nav-icon">{item.icon}</span>
                          <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: '12px' }}>🔒</span>
                      </div>
                    );
                  }

                  const isActive = pathname === item.href;
                  const isContentFlow = item.href === '/content-flow';

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="nav-icon">{item.icon}</span>
                          {item.label}
                        </div>
                        {isContentFlow && (
                          <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
                        )}
                      </Link>

                      {/* Sub-menu Brand Accounts for ContentFlow Hub */}
                      {isContentFlow && (pathname.startsWith('/content-flow')) && (
                        <div style={{
                          paddingLeft: '28px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          marginTop: '4px',
                          marginBottom: '8px'
                        }}>
                          <Link
                            href="/content-flow?account=all"
                            className={`sidebar-brand-subtab ${currentAccount === 'all' ? 'sidebar-brand-subtab-active' : ''}`}
                            style={{
                              fontSize: '11px',
                              fontWeight: currentAccount === 'all' ? 700 : 500,
                              padding: '5px 10px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span>🌐</span> Semua Akun
                          </Link>
                          {userBrandAccounts.map(acc => {
                            const isSubActive = currentAccount.toLowerCase() === acc.toLowerCase();
                            return (
                              <Link
                                key={acc}
                                href={`/content-flow?account=${encodeURIComponent(acc)}`}
                                className={`sidebar-brand-subtab ${isSubActive ? 'sidebar-brand-subtab-active' : ''}`}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: isSubActive ? 700 : 500,
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <span>🏷️</span> @{acc}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div style={{ marginBottom: '12px' }}>
          <ThemeToggle />
        </div>
        {user ? (
          <>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Logged in as: <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong> ({user.role})
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--status-danger-soft)',
                background: 'var(--status-danger-soft)',
                color: 'var(--status-danger)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              🚪 Logout
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid var(--status-danger-soft)',
              background: 'var(--status-danger-soft)',
              color: 'var(--status-danger)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            🚪 Logout / Login
          </button>
        )}
      </div>
    </aside>

    <MobileNav
      user={user}
      groupedSections={groupedSections}
      pathname={pathname}
      currentAccount={currentAccount}
      userBrandAccounts={userBrandAccounts}
      handleLogout={handleLogout}
    />
  </>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="sidebar"><div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading...</div></aside>}>
      <SidebarContent />
    </Suspense>
  );
}
