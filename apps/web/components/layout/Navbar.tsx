'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';
import { useTheme } from '@/lib/theme';

export default function Navbar() {
  const { user, logout, isInitialized } = useAuthStore();
  const { theme, toggle } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();



   // Scroll detection for backdrop
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    router.push('/');
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="navbar-inner">
          {/* Logo */}
          <Link href="/" className="navbar-logo" aria-label="AjitSir Academy Home">
          <span className="navbar-logo-dot" aria-hidden="true" />
          <span className="navbar-logo-text font-serif">AjitSir.in</span>
          </Link> 

          {/* Desktop nav links */}
          <div className="navbar-links" role="list">
            <Link href="/pricing" className="navbar-link" role="listitem" style={{ color: 'var(--accent)', fontWeight: 600 }}>Pricing</Link>
            <Link href="/tests"   className={`navbar-link ${pathname.startsWith('/tests') ? 'navbar-link--active' : ''}`} role="listitem">Mock Tests</Link>
            <Link href="/#notes"  className="navbar-link" role="listitem">Notes</Link>
            <Link href="/#about"  className="navbar-link" role="listitem">About</Link>
            <Link href="/help"    className="navbar-link" role="listitem">Help</Link>
          </div>

          {/* Desktop auth actions */}
          <div className="navbar-auth">
            {/* Theme toggle */}
            <button
              id="theme-toggle-btn"
              className="theme-toggle-btn"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                // Sun icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                // Moon icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {!isInitialized ? (
              <div className="navbar-auth-skeleton" aria-hidden="true">
                <div className="skeleton-avatar" />
                <div className="skeleton-text" />
              </div>
            ) : user ? (
              <div className="navbar-user" ref={dropdownRef}>
                <button
                  id="user-menu-button"
                  className="navbar-avatar-btn"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  aria-label={`User menu for ${user.name}`}
                >
                  <span className="navbar-avatar">{getInitials(user.name)}</span>
                  <span className="navbar-username">{user.name.split(' ')[0]}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                    style={{ transform: dropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="navbar-dropdown" role="menu" aria-labelledby="user-menu-button">
                    <div className="navbar-dropdown-info">
                      <p className="navbar-dropdown-name">{user.name}</p>
                      <p className="navbar-dropdown-email">{user.email}</p>
                    </div>
                    <div className="navbar-dropdown-divider" />
                    {(user.role === 'SUPER_ADMIN' || user.role === 'CONTENT_MANAGER' || user.role === 'SUPPORT_MANAGER') && (
                      <Link href="/admin" className="navbar-dropdown-item" role="menuitem"
                        onClick={() => setDropdownOpen(false)}>
                        Admin Panel
                      </Link>
                    )}
                    <button
                      id="logout-button"
                      className="navbar-dropdown-item navbar-dropdown-item--danger"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="navbar-login-btn" id="nav-login-button">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav is handled by BottomNav component in layout.tsx */}
      <style>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          transition: background 0.3s, border-color 0.3s;
          border-bottom: 1px solid transparent;
        }

        .navbar--scrolled {
          background: var(--navbar-scrolled-bg);
          backdrop-filter: blur(12px);
          border-bottom-color: var(--border);
        }

        .navbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          flex-shrink: 0;
        }

        .navbar-logo-dot {
          width: 8px;
          height: 8px;
          background: var(--text-primary);
          border-radius: 50%;
          display: block;
          flex-shrink: 0;
        }

        .navbar-logo-text {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .navbar-links {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex: 1;
        }

        .navbar-link {
          padding: 0.4rem 0.75rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }

        .navbar-link:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .navbar-link--active {
          color: var(--text-primary);
          background: var(--bg-active);
        }

        .navbar-auth {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .navbar-login-btn {
          padding: 0.4rem 1rem;
          font-size: 0.85rem;
          color: var(--text-primary);
          text-decoration: none;
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .navbar-login-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }

        /* Theme toggle button */
        .theme-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .theme-toggle-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }

        .navbar-user {
          position: relative;
        }

        .navbar-avatar-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.35rem 0.75rem 0.35rem 0.4rem;
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 0.85rem;
          transition: background 0.15s;
        }

        .navbar-avatar-btn:hover {
          background: var(--bg-hover);
        }

        .navbar-avatar {
          width: 28px;
          height: 28px;
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        .navbar-avatar--lg {
          width: 40px;
          height: 40px;
          font-size: 0.85rem;
        }

        .navbar-username {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
        }

        .navbar-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.5rem;
          min-width: 200px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          animation: dropdown-in 0.15s ease;
        }

        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .navbar-dropdown-info {
          padding: 0.5rem 0.75rem;
        }

        .navbar-dropdown-name {
          font-size: 0.85rem;
          color: var(--text-primary);
          font-weight: 500;
          margin-bottom: 0.2rem;
        }

        .navbar-dropdown-email {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .navbar-dropdown-divider {
          height: 1px;
          background: var(--border);
          margin: 0.5rem 0;
        }

        .navbar-dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-decoration: none;
          border: none;
          background: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }

        .navbar-dropdown-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .navbar-dropdown-item--danger {
          color: var(--danger-text);
        }

        .navbar-dropdown-item--danger:hover {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        /* Hamburger */
        .navbar-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          margin-left: auto;
        }

        .hamburger-bar {
          display: block;
          width: 22px;
          height: 1.5px;
          background: var(--text-primary);
          transition: transform 0.25s, opacity 0.25s;
          transform-origin: center;
        }

        .bar-top--open { transform: translateY(6.5px) rotate(45deg); }
        .bar-mid--open { opacity: 0; }
        .bar-bot--open { transform: translateY(-6.5px) rotate(-45deg); }

        @media (max-width: 768px) {
          .navbar-links {
            display: none;
          }
          .navbar-user,
          .navbar-login-btn {
            display: none;
          }
          .navbar-auth {
            margin-left: auto;
          }
          /* Hide theme toggle on mobile — it's in the Account page instead */
          .theme-toggle-btn {
            display: none;
          }
        }

        /* Mobile menu */
        .mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 200;
        }

        .mobile-menu-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
        }

        .mobile-menu-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(320px, 85vw);
          background: var(--bg-surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          animation: slide-in 0.25s ease;
        }

        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .mobile-menu-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 2.5rem;
          padding-top: 0.5rem;
        }

        .mobile-menu-links {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .mobile-menu-link {
          padding: 0.75rem 0.75rem;
          font-size: 1rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: 10px;
          transition: background 0.1s, color 0.1s;
        }

        .mobile-menu-link:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .mobile-menu-footer {
          border-top: 1px solid var(--border);
          padding-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-menu-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
        }

        .mobile-menu-login-btn {
          display: block;
          padding: 0.75rem 1rem;
          background: var(--accent-bg);
          color: var(--accent-text);
          text-decoration: none;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          text-align: center;
          transition: opacity 0.15s;
        }

        .mobile-menu-login-btn:hover {
          opacity: 0.9;
        }

        .mobile-menu-action-btn {
          display: block;
          width: 100%;
          padding: 0.65rem 0.75rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          text-decoration: none;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: none;
          cursor: pointer;
          text-align: center;
          transition: background 0.1s, color 0.1s;
        }

        .mobile-menu-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .mobile-menu-action-btn--danger {
          color: var(--danger-text);
          border-color: var(--danger-border);
        }

        .mobile-menu-action-btn--danger:hover {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        /* Skeletons */
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }

        .navbar-auth-skeleton {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.75rem 0.35rem 0.4rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          animation: pulse 1.5s infinite ease-in-out;
        }

        .skeleton-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--border-strong);
        }

        .skeleton-text {
          width: 60px;
          height: 14px;
          border-radius: 4px;
          background: var(--border-strong);
        }
      `}</style>
    </>
  );
}
