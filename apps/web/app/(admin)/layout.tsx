'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Megaphone, BookOpen, FileText, Users, LifeBuoy, HelpCircle, CreditCard } from 'lucide-react';
import useAuthStore from '@/lib/auth-store';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} />, exact: true, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { href: '/admin/support', label: 'Support Inbox', icon: <LifeBuoy size={18} />, exact: true, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER'] },
  { href: '/admin/support/faqs', label: 'Manage FAQs', icon: <HelpCircle size={18} />, exact: false, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER'] },
  { href: '/admin/announcements', label: 'Announcements', icon: <Megaphone size={18} />, exact: false, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { href: '/admin/subjects', label: 'Subjects', icon: <BookOpen size={18} />, exact: false, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { href: '/admin/notes', label: 'Notes', icon: <FileText size={18} />, exact: false, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { href: '/admin/payments', label: 'Payments', icon: <CreditCard size={18} />, exact: false, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] },
  { href: '/admin/users', label: 'Users', icon: <Users size={18} />, exact: false, roles: ['SUPER_ADMIN'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, initialize } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [initialize, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.replace('/login'); return; }
    
    const validRoles = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER'];
    if (!validRoles.includes(user.role)) {
      router.replace('/');
      return;
    }

    if (user.role === 'SUPPORT_MANAGER' && pathname === '/admin') {
      router.replace('/admin/support');
    }
  }, [user, isInitialized, router, pathname]);

  if (!isInitialized || !user) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  const validRoles = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER'];
  if (!validRoles.includes(user.role)) {
    return null;
  }

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-brand-dot" />
          <span className="font-serif admin-brand-text">Admin</span>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            if (!item.roles.includes(user.role)) return null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item ${isActive(item) ? 'admin-nav-item--active' : ''}`}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-back-link">← Back to site</Link>
          <div className="admin-user-chip">
            <span className="admin-user-role">
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'CONTENT_MANAGER' ? 'Content Manager' : 'Support Team'}
            </span>
            <span className="admin-user-name">{user.name}</span>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="admin-bottombar">
        {NAV_ITEMS.map((item) => {
          if (!item.roles.includes(user.role)) return null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-tab ${isActive(item) ? 'admin-tab--active' : ''}`}
            >
              <span className="admin-tab-icon">{item.icon}</span>
              <span className="admin-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="admin-content">
        {children}
      </main>

      <style>{`
        .admin-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-page);
        }
        .admin-spinner {
          width: 32px; height: 32px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg-page);
        }

        /* ── Sidebar ── */
        .admin-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: var(--bg-surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 50;
          padding: 1.5rem 0;
        }

        .admin-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 0.75rem;
        }

        .admin-brand-dot {
          width: 8px; height: 8px;
          background: var(--text-primary);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .admin-brand-text {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .admin-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 0.75rem;
        }

        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }

        .admin-nav-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .admin-nav-item--active {
          background: var(--bg-active);
          color: var(--text-primary);
        }

        .admin-nav-icon { font-size: 1rem; }

        .admin-sidebar-footer {
          padding: 1rem 1.25rem 0;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .admin-back-link {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.15s;
        }
        .admin-back-link:hover { color: var(--text-secondary); }

        .admin-user-chip {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
        }

        .admin-user-role {
          display: block;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 0.15rem;
        }

        .admin-user-name {
          display: block;
          font-size: 0.8rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Main ── */
        .admin-content {
          flex: 1;
          margin-left: 240px;
          padding: 2rem;
          min-height: 100vh;
        }

        /* ── Mobile bottom bar ── */
        .admin-bottombar {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 60px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
          z-index: 100;
          align-items: stretch;
          justify-content: space-around;
        }

        .admin-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          text-decoration: none;
          color: var(--text-muted);
          font-size: 0.6rem;
          transition: color 0.15s;
        }

        .admin-tab--active { color: var(--text-primary); }
        .admin-tab-icon { font-size: 1.1rem; }
        .admin-tab-label { font-size: 0.55rem; }

        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .admin-bottombar { display: flex; }
          .admin-content {
            margin-left: 0;
            padding: 1rem;
            padding-bottom: 76px;
          }
        }
      `}</style>
    </div>
  );
}
