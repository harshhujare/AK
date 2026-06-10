'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuthStore from '@/lib/auth-store';
import { useTheme } from '@/lib/theme';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_MANAGER']);

export default function AccountPage() {
  const { user, isInitialized, logout } = useAuthStore();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isInitialized && !user) {
      router.replace('/login?callbackUrl=/account');
    }
  }, [isInitialized, user, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  // Plan status helpers
  const planExpiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isPaid = user?.plan === 'PAID';
  const isExpired = planExpiresAt ? planExpiresAt < new Date() : false;
  const isActivePaid = isPaid && !isExpired;

  const isAdmin = user ? ADMIN_ROLES.has(user.role) : false;

  if (!isInitialized || !user) {
    return (
      <div className="account-page">
        <div className="account-skeleton-header">
          <div className="skeleton-avatar-xl" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="skeleton-line" style={{ width: 140 }} />
            <div className="skeleton-line" style={{ width: 200, height: 12 }} />
          </div>
        </div>
        <style>{skeletonStyles}</style>
      </div>
    );
  }

  return (
    <div className="account-page">

      {/* ── User card ───────────────────────────────────────────────────── */}
      <div className="account-user-card">
        <span className="account-avatar">{getInitials(user.name)}</span>
        <div className="account-user-info">
          <p className="account-user-name">{user.name}</p>
          <p className="account-user-email">{user.email}</p>
          <span className={`account-plan-badge ${isActivePaid ? 'badge--premium' : 'badge--free'}`}>
            {isActivePaid ? '⭐ Premium' : '◯ Free'}
          </span>
        </div>
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="account-section">

        <Link href="/plans" className="account-item">
          <span className="account-item-icon">⭐</span>
          <span className="account-item-label">
            {isActivePaid ? 'My Plan' : 'Upgrade to Premium'}
          </span>
          {!isActivePaid && <span className="account-item-cta">Get access →</span>}
          {isActivePaid && !isExpired && planExpiresAt && (
            <span className="account-item-meta">
              {Math.max(0, Math.ceil((planExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d left
            </span>
          )}
          <span className="account-item-chevron">›</span>
        </Link>

        <Link href="/help" className="account-item">
          <span className="account-item-icon">❓</span>
          <span className="account-item-label">Help Center</span>
          <span className="account-item-chevron">›</span>
        </Link>

        {/* Theme toggle */}
        <button className="account-item account-item--btn" onClick={toggle} aria-label="Toggle theme">
          <span className="account-item-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="account-item-label">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
          <span className="theme-toggle-pill">
            <span className={`theme-toggle-thumb ${theme === 'dark' ? 'theme-toggle-thumb--right' : ''}`} />
          </span>
        </button>
      </div>

      {/* ── Admin link ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="account-section">
          <Link href="/admin" className="account-item account-item--admin">
            <span className="account-item-icon">🔧</span>
            <span className="account-item-label">Admin Panel</span>
            <span className="account-item-chevron">›</span>
          </Link>
        </div>
      )}

      {/* ── Sign out ────────────────────────────────────────────────────── */}
      <div className="account-section">
        <button
          id="account-logout-btn"
          className="account-signout-btn"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>

      <style>{pageStyles}</style>
      <style>{skeletonStyles}</style>
    </div>
  );
}

const pageStyles = `
  .account-page {
    min-height: 100vh;
    background: var(--bg-surface);
    padding: 1.5rem 1rem 6rem;
    max-width: 560px;
    margin: 0 auto;
  }

  /* User card */
  .account-user-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .account-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-bg);
    color: var(--accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .account-user-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .account-user-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .account-user-email {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .account-plan-badge {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    align-self: flex-start;
  }
  .badge--premium {
    background: #fef3c7;
    color: #92400e;
  }
  .badge--free {
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  /* Sections */
  .account-section {
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  /* Items */
  .account-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
    color: var(--text-primary);
    text-decoration: none;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
    background: none;
    width: 100%;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .account-item:last-child { border-bottom: none; }
  .account-item:hover { background: var(--bg-hover); }
  .account-item--btn { border: none; }
  .account-item--admin .account-item-label { color: var(--accent); }

  .account-item-icon { font-size: 1.1rem; flex-shrink: 0; width: 24px; text-align: center; }
  .account-item-label { flex: 1; font-weight: 500; }
  .account-item-meta { font-size: 0.75rem; color: var(--text-muted); }
  .account-item-cta { font-size: 0.75rem; color: var(--accent); font-weight: 600; }
  .account-item-chevron { color: var(--text-muted); font-size: 1.1rem; line-height: 1; }

  /* Theme pill toggle */
  .theme-toggle-pill {
    width: 36px;
    height: 20px;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .theme-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .theme-toggle-thumb--right { transform: translateX(16px); }

  /* Sign out */
  .account-signout-btn {
    width: 100%;
    padding: 1rem 1.25rem;
    background: none;
    border: none;
    color: #ef4444;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
    border-radius: 18px;
  }
  .account-signout-btn:hover { background: #fef2f2; }
`;

const skeletonStyles = `
  .account-skeleton-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 18px;
    margin-bottom: 1.5rem;
    animation: acct-pulse 1.5s infinite ease-in-out;
  }
  .skeleton-avatar-xl {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--border-strong);
    flex-shrink: 0;
  }
  .skeleton-line {
    height: 16px;
    background: var(--border-strong);
    border-radius: 6px;
  }
  @keyframes acct-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
