'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';

export default function Navbar() {
  const { user, logout, initialize, isInitialized } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) initialize();
  }, [initialize, isInitialized]);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
            <span className="navbar-logo-text font-serif">AjitSir Academy</span>
          </Link>

          {/* Desktop nav links */}
          <div className="navbar-links" role="list">
            <Link href="/#notes" className="navbar-link" role="listitem">Notes</Link>
            <Link href="/#about" className="navbar-link" role="listitem">About</Link>
          </div>

          {/* Desktop auth actions */}
          <div className="navbar-auth">
            {user ? (
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
                    {(user.role === 'SUPER_ADMIN' || user.role === 'CONTENT_MANAGER') && (
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

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-button"
            className="navbar-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className={`hamburger-bar ${menuOpen ? 'bar-top--open' : ''}`} />
            <span className={`hamburger-bar ${menuOpen ? 'bar-mid--open' : ''}`} />
            <span className={`hamburger-bar ${menuOpen ? 'bar-bot--open' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile slide-in menu */}
      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)} />
          <div className="mobile-menu-panel">
            <div className="mobile-menu-brand">
              <span className="navbar-logo-dot" aria-hidden="true" />
              <span className="font-serif" style={{ color: 'white', fontSize: '1rem' }}>AjitSir Academy</span>
            </div>

            <nav className="mobile-menu-links">
              <Link href="/#notes" className="mobile-menu-link">Notes</Link>
              <Link href="/#about" className="mobile-menu-link">About</Link>
            </nav>

            <div className="mobile-menu-footer">
              {user ? (
                <>
                  <div className="mobile-menu-user">
                    <span className="navbar-avatar navbar-avatar--lg">{getInitials(user.name)}</span>
                    <div>
                      <p style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{user.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{user.email}</p>
                    </div>
                  </div>
                  {(user.role === 'SUPER_ADMIN' || user.role === 'CONTENT_MANAGER') && (
                    <Link href="/admin" className="mobile-menu-action-btn">Admin Panel</Link>
                  )}
                  <button id="mobile-logout-button" className="mobile-menu-action-btn mobile-menu-action-btn--danger"
                    onClick={handleLogout}>
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/login" className="mobile-menu-login-btn" id="mobile-login-button">
                  Sign in with Google
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
          background: rgba(10,10,10,0.9);
          backdrop-filter: blur(12px);
          border-bottom-color: rgba(255,255,255,0.08);
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
          background: white;
          border-radius: 50%;
          display: block;
          flex-shrink: 0;
        }

        .navbar-logo-text {
          font-size: 1rem;
          font-weight: 500;
          color: white;
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
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }

        .navbar-link:hover {
          color: white;
          background: rgba(255,255,255,0.06);
        }

        .navbar-auth {
          flex-shrink: 0;
        }

        .navbar-login-btn {
          padding: 0.4rem 1rem;
          font-size: 0.85rem;
          color: white;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .navbar-login-btn:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.35);
        }

        .navbar-user {
          position: relative;
        }

        .navbar-avatar-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 0.35rem 0.75rem 0.35rem 0.4rem;
          cursor: pointer;
          color: rgba(255,255,255,0.8);
          font-size: 0.85rem;
          transition: background 0.15s;
        }

        .navbar-avatar-btn:hover {
          background: rgba(255,255,255,0.06);
        }

        .navbar-avatar {
          width: 28px;
          height: 28px;
          background: white;
          color: #0a0a0a;
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
        }

        .navbar-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 0.5rem;
          min-width: 200px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
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
          color: white;
          font-weight: 500;
          margin-bottom: 0.2rem;
        }

        .navbar-dropdown-email {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
        }

        .navbar-dropdown-divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 0.5rem 0;
        }

        .navbar-dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          border: none;
          background: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }

        .navbar-dropdown-item:hover {
          background: rgba(255,255,255,0.06);
          color: white;
        }

        .navbar-dropdown-item--danger {
          color: rgba(248, 113, 113, 0.8);
        }

        .navbar-dropdown-item--danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
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
          background: white;
          transition: transform 0.25s, opacity 0.25s;
          transform-origin: center;
        }

        .bar-top--open { transform: translateY(6.5px) rotate(45deg); }
        .bar-mid--open { opacity: 0; }
        .bar-bot--open { transform: translateY(-6.5px) rotate(-45deg); }

        @media (max-width: 768px) {
          .navbar-links,
          .navbar-auth {
            display: none;
          }
          .navbar-hamburger {
            display: flex;
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
          background: #111111;
          border-left: 1px solid rgba(255,255,255,0.08);
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
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          border-radius: 10px;
          transition: background 0.1s, color 0.1s;
        }

        .mobile-menu-link:hover {
          background: rgba(255,255,255,0.06);
          color: white;
        }

        .mobile-menu-footer {
          border-top: 1px solid rgba(255,255,255,0.08);
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
          background: white;
          color: #0a0a0a;
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
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          background: none;
          cursor: pointer;
          text-align: center;
          transition: background 0.1s, color 0.1s;
        }

        .mobile-menu-action-btn:hover {
          background: rgba(255,255,255,0.06);
          color: white;
        }

        .mobile-menu-action-btn--danger {
          color: rgba(248, 113, 113, 0.8);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .mobile-menu-action-btn--danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
        }
      `}</style>
    </>
  );
}
