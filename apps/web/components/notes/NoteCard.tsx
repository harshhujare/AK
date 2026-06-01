'use client';

import type { NoteWithSubject } from '@/hooks/useNotes';
import { useRouter } from 'next/navigation';
import type { User } from '@ajitsir/shared';
import PaywallBanner from '../payment/PaywallBanner';

interface NoteCardProps {
  note: NoteWithSubject;
  user: User | null;
  onClick: (note: NoteWithSubject) => void;
}

export default function NoteCard({ note, user, onClick }: NoteCardProps) {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const thumbnailUrl = `${API_URL}/api/notes/${note.id}/thumbnail`;

  const hasAccess = !note.isPaid || 
    (user && (user.role === 'SUPER_ADMIN' || user.role === 'CONTENT_MANAGER' || user.plan === 'PAID'));

  const handleClick = () => {
    if (hasAccess) {
      onClick(note);
    }
  };

  return (
    <div className={`note-card ${!hasAccess ? 'note-card--locked' : ''}`} onClick={handleClick} role="button" tabIndex={0}>
      <div className="note-card-image-container">
        <img 
          src={thumbnailUrl} 
          alt={`Cover for ${note.title}`}
          className="note-thumbnail"
          onError={(e) => {
            // Fallback if no thumbnail is available
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.classList.add('no-thumbnail');
          }}
        />
        
        {/* Access Overlays */}
        {!hasAccess && (
          !user ? (
            <div className="paywall-banner">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="paywall-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <p className="paywall-text">Sign in to access this note</p>
              <button 
                className="paywall-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/login?callbackUrl=/#notes`);
                }}
              >
                Log in
              </button>
            </div>
          ) : (
            <PaywallBanner />
          )
        )}
      </div>
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
              year: 'numeric'
            })}
          </span>
        </div>
      </div>

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
        /* Lock overlay styles (matching PaywallBanner) */
        .paywall-banner {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: white;
          padding: 1rem;
          text-align: center;
          z-index: 10;
        }
        .paywall-icon {
          color: var(--accent);
          opacity: 0.9;
        }
        .paywall-text {
          font-size: 0.85rem;
          font-weight: 500;
          line-height: 1.4;
        }
        .paywall-btn {
          background: var(--accent-bg);
          color: var(--accent-text);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
          margin-top: 0.5rem;
        }
        .paywall-btn:hover {
          opacity: 0.9;
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
      `}</style>
    </div>
  );
}
