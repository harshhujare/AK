'use client';

import { useState, useCallback } from 'react';
import type { NoteWithSubject } from '@/hooks/useNotes';
import { useRouter } from 'next/navigation';
import type { User } from '@ajitsir/shared';
import PaywallBanner from '../payment/PaywallBanner';
import { canAccessNote } from '@/features/payment/utils/accessControl';
import useAuthStore from '@/lib/auth-store';
import apiClient from '@/lib/api-client';

// ─── Sub-component: Sign-in overlay ──────────────────────────────────────────

interface SignInOverlayProps {
  noteId: string;
}

/**
 * Rendered when `note.isPaid === true` and the user is not authenticated.
 * Redirects to /login with a callbackUrl back to the notes section.
 */
function SignInOverlay({ noteId }: SignInOverlayProps) {
  const router = useRouter();
  return (
    <div className="paywall-banner" role="region" aria-label="Sign in required">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="paywall-icon"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="paywall-text">Sign in to access this note</p>
      <button
        className="paywall-btn"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/login?callbackUrl=/#notes`);
        }}
        aria-label="Log in to access this premium note"
      >
        Log in
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface NoteCardProps {
  note: NoteWithSubject;
  user: User | null;
  onClick: (note: NoteWithSubject) => void;
}

/**
 * NoteCard
 *
 * Displays a single note with access gating based on the Phase 3 access matrix:
 *
 * | note.isPaid | user       | Behaviour                              |
 * |-------------|------------|----------------------------------------|
 * | false       | any        | Open viewer                            |
 * | true        | null       | SignInOverlay (→ /login)               |
 * | true        | SUPER_ADMIN / CONTENT_MANAGER | Open viewer         |
 * | true        | PAID (active) | Open viewer                         |
 * | true        | FREE / expired | PaywallBanner (→ /pricing)          |
 *
 * Access logic is delegated to `canAccessNote()` which is independently
 * unit-tested in `accessControl.test.ts`.
 */
export default function NoteCard({ note, user, onClick }: NoteCardProps) {
  const hasAccess = canAccessNote(user, note);
  const { accessToken } = useAuthStore();
  const [recheckState, setRecheckState] = useState<'idle' | 'checking' | 'denied'>('idle');

  const handleClick = useCallback(async () => {
    if (hasAccess) {
      onClick(note);
      return;
    }

    // Note is paid and local user says FREE — but this may be stale.
    // A real payment could have succeeded while the localStorage user was not
    // yet updated (e.g. refresh() failed or was slow after payment).
    // Fire a one-shot /me re-check so we don't lock the user out due to a
    // stale cache bug. Only show the paywall if the server also says FREE.
    if (note.isPaid && user && accessToken && recheckState === 'idle') {
      setRecheckState('checking');
      try {
        const { data } = await apiClient.get('/api/auth/me');
        const freshUser = data.data as User;
        // Update Zustand + localStorage with the latest plan data
        localStorage.setItem('user', JSON.stringify(freshUser));
        useAuthStore.setState({ user: freshUser });

        // Re-evaluate access with the fresh data from the server
        if (canAccessNote(freshUser, note)) {
          onClick(note);
          setRecheckState('idle');
          return;
        }
      } catch {
        // Network failure — fall through to show paywall normally
      }
      setRecheckState('denied');
    }
  }, [hasAccess, note, onClick, user, accessToken, recheckState]);

  // Determine which overlay to show for locked paid notes.
  // recheckState='checking' — /me is in-flight — show a spinner instead of paywall
  // recheckState='denied'   — server confirmed FREE/expired — show paywall
  // recheckState='idle'     — first click hasn't happened yet — show paywall (CSS only)
  const showPaywall = !hasAccess && recheckState !== 'checking';
  const lockOverlay = showPaywall
    ? !user
      ? <SignInOverlay noteId={note.id} />
      : <PaywallBanner />
    : recheckState === 'checking'
    ? (
        <div className="note-recheck-overlay" aria-label="Checking access…">
          <span className="note-recheck-spinner" />
        </div>
      )
    : null;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const thumbnailUrl = `${API_URL}/api/notes/${note.id}/thumbnail`;

  return (
    <div
      className={`note-card${showPaywall ? ' note-card--locked' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !showPaywall) {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${note.title}${note.isPaid ? ' — Premium' : ''}${showPaywall ? ' (locked)' : recheckState === 'checking' ? ' (checking access…)' : ''}`}
    >
      {/* ── Thumbnail + Access Overlay ─────────────────────────────── */}
      <div className="note-card-image-container">
        <img
          src={thumbnailUrl}
          alt={`Cover for ${note.title}`}
          className="note-thumbnail"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.classList.add('no-thumbnail');
          }}
        />
        {lockOverlay}
      </div>

      {/* ── Card Body ──────────────────────────────────────────────── */}
      <div className="note-card-inner">
        <div className="note-subject">
          <span className="subject-badge">{note.subject.name}</span>
          {note.isPaid && <span className="paid-badge">PREMIUM</span>}
        </div>

        <h3 className="note-title font-serif">{note.title}</h3>
        {note.description && <p className="note-desc">{note.description}</p>}

        <div className="note-footer">
          <span className="note-pages">{note.pageCount || '?'} pages</span>
          <span className="note-date">
            {new Date(note.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ── Styles ─────────────────────────────────────────────────── */}
      <style>{`
        .note-card {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 16px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s, border-color 0.2s;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .note-card:hover {
          transform: translateY(-2px);
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }
        /* Locked cards get a not-allowed cursor on the card itself,
           but the overlay buttons restore pointer via their own styles. */
        .note-card--locked {
          cursor: default;
        }
        .note-card--locked:hover {
          transform: none;
        }
        .note-card-image-container {
          width: 100%;
          height: 160px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          overflow: hidden;
          position: relative;
        }
        .note-card-image-container.no-thumbnail {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--skeleton-bg);
        }
        .note-card-image-container.no-thumbnail::after {
          content: '📄';
          font-size: 3rem;
          opacity: 0.2;
        }
        .note-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top;
        }
        .note-card-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1.5rem;
        }
        .note-subject {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .subject-badge {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          /* Prevent long subject names from overflowing the card */
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .paid-badge {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--accent-text);
          background: var(--accent-bg);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
        }
        .note-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }
        .note-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          flex-grow: 1;
          margin-bottom: 1.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .note-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        /* Recheck spinner — shown while /me is in-flight on first click */
        .note-recheck-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(2px);
        }
        .note-recheck-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Mobile overrides ──────────────────────────────────── */
        @media (max-width: 768px) {
          .note-card-image-container {
            height: 80px;
          }
          .note-card-inner {
            padding: 0.75rem;
          }
          .note-title {
            font-size: 1rem;
            margin-bottom: 0.35rem;
          }
          .note-desc {
            margin-bottom: 0.875rem;
            font-size: 0.8rem;
          }
          .note-card-image-container.no-thumbnail::after {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </div>
  );
}
