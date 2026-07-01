'use client';

import { useState } from 'react';
import useAuthStore from '@/lib/auth-store';
import { useNotes, type NoteWithSubject } from '@/hooks/useNotes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import SubjectFilter from '@/components/notes/SubjectFilter';
import NoteCard from '@/components/notes/NoteCard';
import dynamic from 'next/dynamic';

const SecureViewer = dynamic(() => import('@/features/notes/viewer/SecureViewer'), {
  ssr: false,
});

export default function NotesPage() {
  const { user } = useAuthStore();
  const isOnline = useOnlineStatus();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data: notesResponse, isLoading } = useNotes(selectedSubject, page, 40);
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

  const handleSubjectSelect = (subjectId: string | null) => {
    setSelectedSubject(subjectId);
    setPage(1);
  };

  // Split notes into free and premium for the mobile two-section layout
  const freeNotes = notesResponse?.notes.filter((n) => !n.isPaid) ?? [];
  const premiumNotes = notesResponse?.notes.filter((n) => n.isPaid) ?? [];

  return (
    <div className="notes-page">
      vbv

      {/* Offline banner */}
      {!isOnline && (
        <div className="notes-offline-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          Offline — showing cached notes only.
        </div>
      )}

      {/* ── Subject filter (shared between desktop + mobile) */}
      <div className="notes-filter-wrap">
        <SubjectFilter selectedSubject={selectedSubject} onSelect={handleSubjectSelect} />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MOBILE LAYOUT: Two horizontal scroll sections (Free + Premium)
          Hidden on desktop via CSS (display: none at min-width: 769px)
          ──────────────────────────────────────────────────────────────────── */}

      {/* ── Mobile: Free Notes row */}
      <div className="notes-mobile-section">
        <div className="notes-section-header">
          <span className="notes-section-title">Free Notes</span>
          <span className="notes-section-count">{isLoading ? '…' : freeNotes.length}</span>
        </div>
        {isLoading ? (
          <div className="notes-hscroll">
            {[1, 2, 3].map((i) => <div key={i} className="note-hcard-skeleton" />)}
          </div>
        ) : freeNotes.length > 0 ? (
          <div className="notes-hscroll">
            {freeNotes.map((note) => (
              <div key={note.id} className="note-hcard-wrap">
                <NoteCard note={note} user={user} onClick={setViewingNote} />
              </div>
            ))}
          </div>
        ) : (
          <p className="notes-section-empty">
            No free notes{selectedSubject ? ' for this subject' : ''}.
          </p>
        )}
      </div>

      {/* ── Mobile: Premium Notes row */}
      <div className="notes-mobile-section notes-mobile-section--premium">
        <div className="notes-section-header">
          <span className="notes-section-title">
            Premium Notes
            <span className="notes-premium-badge">PREMIUM</span>
          </span>
          <span className="notes-section-count">{isLoading ? '…' : premiumNotes.length}</span>
        </div>
        {isLoading ? (
          <div className="notes-hscroll">
            {[1, 2, 3].map((i) => <div key={i} className="note-hcard-skeleton" />)}
          </div>
        ) : premiumNotes.length > 0 ? (
          <div className="notes-hscroll">
            {premiumNotes.map((note) => (
              <div key={note.id} className="note-hcard-wrap">
                <NoteCard note={note} user={user} onClick={setViewingNote} />
              </div>
            ))}
          </div>
        ) : (
          <p className="notes-section-empty">
            No premium notes{selectedSubject ? ' for this subject' : ''}.
          </p>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          DESKTOP LAYOUT: Unified grid (hidden on mobile via CSS)
          ──────────────────────────────────────────────────────────────────── */}
      <div className="notes-page-container notes-desktop-grid">
        {isLoading ? (
          <div className="notes-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="note-skeleton" />
            ))}
          </div>
        ) : notesResponse && notesResponse.notes.length > 0 ? (
          <>
            <div className="notes-grid">
              {notesResponse.notes.map((note) => (
                <NoteCard key={note.id} note={note} user={user} onClick={setViewingNote} />
              ))}
            </div>

            {notesResponse.totalPages > 1 && (
              <div className="notes-pagination">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {notesResponse.totalPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={page >= notesResponse.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="notes-empty">
            {!isOnline ? (
              <>
                <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📶</p>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No cached notes</p>
                <p>Visit this page while online to make notes available offline.</p>
              </>
            ) : (
              <p>No notes found for this subject.</p>
            )}
          </div>
        )}
      </div>

      {viewingNote && (
        <SecureViewer note={viewingNote} onClose={() => setViewingNote(null)} />
      )}

      <style>{`
        /* ── Page shell */
        .notes-page {
          min-height: 100vh;
          background: var(--bg-page);
          padding-bottom: 5rem; /* bottom-nav clearance */
        }
        .notes-page-header {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          padding: 2rem 1.25rem 1.5rem;
        }
        .notes-page-title {
          font-size: clamp(1.6rem, 4vw, 2.5rem);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.3rem;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
        }
        .notes-page-desc {
          font-size: 0.9rem;
          color: var(--text-secondary);
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Filter strip */
        .notes-filter-wrap {
          padding: 0.75rem 1.25rem 0;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Offline banner */
        .notes-offline-banner {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          max-width: 1200px;
          margin: 0.75rem auto 0;
          padding: 0.6rem 1.25rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* ── MOBILE TWO-SECTION LAYOUT ─────────────────────────────────────── */
        .notes-mobile-section {
          padding: 1.25rem 0 0.75rem;
          border-bottom: 1px solid var(--border);
        }
        .notes-mobile-section--premium {
          background: var(--bg-surface);
        }
        .notes-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.25rem 0.75rem;
        }
        .notes-section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .notes-premium-badge {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 0.2rem 0.45rem;
          background: var(--accent-bg);
          color: var(--accent-text);
          border-radius: 4px;
        }
        .notes-section-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Horizontal scroll row */
        .notes-hscroll {
          display: flex;
          flex-direction: row;
          gap: 0.65rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 0.25rem 1.25rem 1rem;
          scrollbar-width: none;
        }
        .notes-hscroll::-webkit-scrollbar { display: none; }

        /* Each card in the horizontal row — compact width */
        .note-hcard-wrap {
          flex: 0 0 150px;
          min-width: 0;
          scroll-snap-align: start;
        }

        /* Override NoteCard internals to compact size within the scroll row */
        .note-hcard-wrap .note-card-image-container {
          display: none; /* hide thumbnail — too large for compact strip */
        }
        .note-hcard-wrap .note-card-inner {
          padding: 0.85rem 0.9rem;
        }
        .note-hcard-wrap .note-subject {
          margin-bottom: 0.5rem;
          flex-wrap: nowrap;
          gap: 0.3rem;
        }
        /* Truncate long subject badge text (e.g. "HAND WRITTEN NOTES") */
        .note-hcard-wrap .subject-badge {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 80px;
          display: block;
        }
        /* Keep paid badge on one line */
        .note-hcard-wrap .paid-badge {
          white-space: nowrap;
          flex-shrink: 0;
        }
        .note-hcard-wrap .note-title {
          font-size: 0.82rem;
          font-weight: 600;
          line-height: 1.35;
          margin-bottom: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .note-hcard-wrap .note-desc {
          display: none; /* description hidden in compact view */
        }
        .note-hcard-wrap .note-footer {
          padding-top: 0.6rem;
          margin-top: auto;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.2rem;
        }
        .note-hcard-wrap .note-pages,
        .note-hcard-wrap .note-date {
          font-size: 0.65rem;
        }

        /* Skeleton for compact horizontal cards */
        .note-hcard-skeleton {
          flex: 0 0 150px;
          height: 140px;
          background: var(--skeleton-bg);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
          scroll-snap-align: start;
        }

        .notes-section-empty {
          padding: 0.5rem 1.25rem 1rem;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        /* ── DESKTOP GRID (hidden on mobile) ───────────────────────────────── */
        .notes-desktop-grid { display: none; }

        /* ── Shared grid styles */
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }
        .note-skeleton {
          height: 260px;
          background: var(--skeleton-bg);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .notes-empty {
          text-align: center;
          padding: 4rem 1.5rem;
          background: var(--bg-surface-2);
          border-radius: 16px;
          color: var(--text-secondary);
          margin-top: 1.5rem;
        }
        .notes-pagination {
          display: flex;
          gap: 1rem;
          justify-content: center;
          align-items: center;
          margin-top: 2.5rem;
        }
        .pagination-info {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .btn-secondary {
          padding: 0.5rem 1.25rem;
          border: 1px solid var(--border);
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          font-family: inherit;
        }
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .btn-secondary:disabled {
          opacity: 0.4;
          cursor: default;
        }

        /* ── DESKTOP: switch to unified grid ───────────────────────────────── */
        @media (min-width: 769px) {
          .notes-mobile-section { display: none; }
          .notes-desktop-grid   { display: block; }
          .notes-filter-wrap    { padding-top: 1.5rem; }
          .notes-page-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1.5rem 2rem;
          }
        }

        /* Filter spacing on mobile */
        @media (max-width: 768px) {
          .notes-filter-wrap { padding-bottom: 0.25rem; }
        }
      `}</style>
    </div>
  );
}
