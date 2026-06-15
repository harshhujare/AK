'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useAuthStore from '@/lib/auth-store';

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
    isActive: (pathname: string) => pathname === '/',
  },
  {
    label: 'Notes',
    href: '/notes',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
    isActive: (pathname: string) => pathname.startsWith('/notes'),
  },
  {
    label: 'Tests',
    href: '/tests',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
    isActive: (pathname: string) => pathname.startsWith('/tests'),
  },
  {
    label: 'Account',
    href: '/account',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    isActive: (pathname: string) =>
      pathname.startsWith('/account')
      || pathname.startsWith('/login')
      || pathname.startsWith('/plans')
      || pathname.startsWith('/pricing'),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Hide on admin pages — admins use the full desktop layout
  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      <nav className="bottom-nav" role="navigation" aria-label="Bottom navigation">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          // For Account tab: show user initials if logged in
          const isAccount = item.label === 'Account';
          const initials = user
            ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
            : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${active ? 'bottom-nav-item--active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bottom-nav-icon">
                {isAccount && initials ? (
                  <span className={`bottom-nav-avatar ${active ? 'bottom-nav-avatar--active' : ''}`}>
                    {initials}
                  </span>
                ) : (
                  item.icon(active)
                )}
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            background: var(--navbar-scrolled-bg, rgba(255,255,255,0.92));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-top: 1px solid var(--border);
            z-index: 100;
            /* iPhone safe area */
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          .bottom-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 0.5rem 0.25rem;
            text-decoration: none;
            color: var(--text-muted);
            transition: color 0.18s ease;
            position: relative;
          }

          .bottom-nav-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 20%;
            right: 20%;
            height: 2px;
            background: var(--accent, #2563eb);
            border-radius: 0 0 4px 4px;
            opacity: 0;
            transform: scaleX(0);
            transition: opacity 0.18s, transform 0.18s ease;
          }

          .bottom-nav-item--active {
            color: var(--accent, #2563eb);
          }

          .bottom-nav-item--active::before {
            opacity: 1;
            transform: scaleX(1);
          }

          .bottom-nav-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
          }

          .bottom-nav-label {
            font-size: 0.65rem;
            font-weight: 500;
            line-height: 1;
            letter-spacing: 0.01em;
          }

          .bottom-nav-item--active .bottom-nav-label {
            font-weight: 700;
          }

          /* Avatar for logged-in Account tab */
          .bottom-nav-avatar {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: var(--border-strong);
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.55rem;
            font-weight: 700;
            border: 1.5px solid var(--border);
          }
          .bottom-nav-avatar--active {
            background: var(--accent-bg);
            color: var(--accent-text);
            border-color: var(--accent-bg);
          }
        }
      `}</style>
    </>
  );
}
