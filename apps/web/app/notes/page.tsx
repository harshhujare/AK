'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import useAuthStore from '@/lib/auth-store';
import { useInfiniteNotes, type NoteWithSubject } from '@/hooks/useNotes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import SubjectFilter from '@/components/notes/SubjectFilter';
import NoteCard from '@/components/notes/NoteCard';
import dynamic from 'next/dynamic';

const SecureViewer = dynamic(() => import('@/features/notes/viewer/SecureViewer'), {
  ssr: false,
});

type SortKey = 'newest' | 'pages' | 'free';

function applySort(notes: NoteWithSubject[], sort: SortKey): NoteWithSubject[] {
  const copy = [...notes];
  if (sort === 'newest') {
    return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (sort === 'pages') {
    return copy.sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
  }
  if (sort === 'free') {
    return copy.filter((n) => !n.isPaid);
  }
  return copy;
}

export default function NotesPage() {
  const { user } = useAuthStore();
  const isOnline = useOnlineStatus();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteNotes(selectedSubject, 20, '');
  // ↑ search is handled client-side over loaded pages; passing '' avoids
  //   resetting the infinite query on every keystroke.

  // Flatten all loaded pages into one array
  const allNotes = useMemo(
    () => data?.pages.flatMap((p) => p.notes) ?? [],
    [data],
  );

  // Client-side search + sort
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q ? allNotes.filter((n) => n.title.toLowerCase().includes(q)) : allNotes;
    return applySort(matched, sort);
  }, [allNotes, search, sort]);

  const freeNotes = filteredNotes.filter((n) => !n.isPaid);
  const premiumNotes = filteredNotes.filter((n) => n.isPaid);

  // IntersectionObserver sentinel — triggers the next page load automatically
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSubjectSelect = (subjectId: string | null) => {
    setSelectedSubject(subjectId);
  };

  // SVG icon helper used by sort pills and track headers
  const icons = {
    clock: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    pages: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    free: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    star: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  };

  const SORT_OPTIONS: { key: SortKey; icon: React.ReactNode; label: string }[] = [
    { key: 'newest', icon: icons.clock, label: 'Newest' },
    { key: 'pages',  icon: icons.pages, label: 'Most Pages' },
    { key: 'free',   icon: icons.free,  label: 'Free Only' },
  ];

  const renderSkeletons = () => (
    <>
      {/* Desktop grid skeletons */}
      <div className="notes-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="note-skeleton" />
        ))}
      </div>
      {/* Mobile track skeletons */}
      <div className="notes-track-section mobile-only">
        <div className="notes-track-label skeleton-label" />
        <div className="notes-track">
          {[1, 2, 3].map((i) => <div key={i} className="note-skeleton note-skeleton--track" />)}
        </div>
      </div>
    </>
  );

  const renderTrack = (notes: NoteWithSubject[], label: string, icon: React.ReactNode) => {
    if (notes.length === 0) return null;
    return (
      <section className="notes-track-section" aria-label={label}>
        <div className="notes-track-header">
          <span className="notes-track-icon">{icon}</span>
          <h2 className="notes-track-label">{label}</h2>
          <span className="notes-track-count">{notes.length}</span>
        </div>
        <div className="notes-track" role="list">
          {notes.map((note) => (
            <div key={note.id} className="notes-track-card" role="listitem">
              <NoteCard note={note} user={user} onClick={setViewingNote} />
            </div>
          ))}
        </div>
      </section>
    );
  };

  const isEmpty = !isLoading && filteredNotes.length === 0;

  return (
    <div className="notes-page">
      {/* Offline banner */}
      {!isOnline && (
        <div className="notes-offline-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          Offline mode — showing cached notes. Notes you've opened before are still available.
        </div>
      )}

      <div className="notes-page-container">
        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="notes-search-wrapper">
          <svg className="notes-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="notes-search"
            type="search"
            className="notes-search-input"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search notes by title"
          />
          {search && (
            <button className="notes-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        {/* ── Subject filter ───────────────────────────────────────── */}
        <SubjectFilter selectedSubject={selectedSubject} onSelect={handleSubjectSelect} />

        {/* ── Sort pills ───────────────────────────────────────────── */}
        <div className="sort-pills" role="group" aria-label="Sort notes">
          {SORT_OPTIONS.map(({ key, icon, label }) => (
            <button
              key={key}
              id={`sort-${key}`}
              className={`sort-pill${sort === key ? ' active' : ''}`}
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {isLoading ? (
          renderSkeletons()
        ) : isEmpty ? (
          <div className="notes-empty">
            {!isOnline ? (
              <>
                <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📶</p>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No cached notes</p>
                <p>Visit this page while online to make notes available offline.</p>
              </>
            ) : search ? (
              <>
                <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</p>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No results for "{search}"</p>
                <p>Try a different keyword or clear the search.</p>
              </>
            ) : (
              <p>No notes found for this subject.</p>
            )}
          </div>
        ) : (
          <>
            {/* ── Desktop: grid layout (hidden on mobile) ── */}
            <div className="notes-grid desktop-only">
              {filteredNotes.map((note) => (
                <NoteCard key={note.id} note={note} user={user} onClick={setViewingNote} />
              ))}
            </div>

            {/* ── Mobile: horizontal swipe tracks ── */}
            <div className="mobile-only">
              {renderTrack(freeNotes, 'Free Notes', icons.free)}
              {renderTrack(premiumNotes, 'Premium Notes', icons.star)}
              {freeNotes.length === 0 && premiumNotes.length === 0 && (
                <div className="notes-empty">
                  <p>No notes match your filter.</p>
                </div>
              )}
            </div>

            {/* ── Infinite scroll sentinel + load more button ── */}
            <div ref={sentinelRef} className="load-more-sentinel" aria-hidden="true" />
            {hasNextPage && (
              <div className="load-more-wrapper">
                <button
                  className="load-more-btn"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-label="Load more notes"
                >
                  {isFetchingNextPage ? (
                    <span className="load-more-spinner" />
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {viewingNote && (
        <SecureViewer note={viewingNote} onClose={() => setViewingNote(null)} />
      )}

      <style>{`
        /* ── Page shell ──────────────────────────────────────────── */
        .notes-page {
          min-height: 100vh;
          background: var(--bg-surface);
          padding-bottom: 4rem;
        }
        .notes-page-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }

        /* ── Offline banner ──────────────────────────────────────── */
        .notes-offline-banner {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          max-width: 1200px;
          margin: 1rem auto 0;
          padding: 0.6rem 1.5rem;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* ── Search bar ──────────────────────────────────────────── */
        .notes-search-wrapper {
          position: relative;
          margin-bottom: 1.25rem;
        }
        .notes-search-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .notes-search-input {
          width: 100%;
          padding: 0.65rem 2.75rem 0.65rem 2.5rem;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg-surface-2);
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .notes-search-input::placeholder { color: var(--text-muted); }
        .notes-search-input:focus {
          outline: none;
          border-color: var(--accent-bg);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        /* hide browser's default clear button */
        .notes-search-input::-webkit-search-cancel-button { display: none; }
        .notes-search-clear {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0.25rem;
          line-height: 1;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .notes-search-clear:hover { color: var(--text-primary); }

        /* ── Sort pills ──────────────────────────────────────────── */
        .sort-pills {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .sort-pills::-webkit-scrollbar { display: none; }
        .sort-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 1rem;
          border-radius: 9999px;
          border: 1px solid var(--border);
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .sort-pill:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .sort-pill.active {
          background: var(--accent-bg);
          color: var(--accent-text);
          border-color: var(--accent-bg);
        }

        /* ── Desktop grid ────────────────────────────────────────── */
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 0.5rem;
        }

        /* ── Skeleton ────────────────────────────────────────────── */
        .note-skeleton {
          height: 220px;
          background: var(--skeleton-bg);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .note-skeleton--track {
          flex: 0 0 45vw;
          max-width: 200px;
          height: 180px;
        }
        .skeleton-label {
          width: 120px;
          height: 20px;
          background: var(--skeleton-bg);
          border-radius: 8px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ── Mobile horizontal tracks ────────────────────────────── */
        .notes-track-section {
          margin-bottom: 2rem;
        }
        .notes-track-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .notes-track-icon {
          font-size: 1rem;
        }
        .notes-track-label {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.02em;
          margin: 0;
        }
        .notes-track-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 9999px;
          padding: 0.1rem 0.45rem;
          margin-left: auto;
        }
        .notes-track {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          gap: 0.875rem;
          padding-bottom: 0.75rem;
          /* allow peek of next card */
          padding-right: 1.5rem;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .notes-track::-webkit-scrollbar { display: none; }
        .notes-track-card {
          flex: 0 0 45vw;
          max-width: 220px;
          min-width: 160px;
          scroll-snap-align: start;
        }

        /* ── Empty state ─────────────────────────────────────────── */
        .notes-empty {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--bg-surface-2);
          border-radius: 16px;
          color: var(--text-secondary);
          margin-top: 1.5rem;
        }

        /* ── Load more ───────────────────────────────────────────── */
        .load-more-sentinel { height: 1px; }
        .load-more-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
        }
        .load-more-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.6rem 2rem;
          border: 1px solid var(--border);
          border-radius: 9999px;
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          font-size: 0.875rem;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          min-width: 120px;
        }
        .load-more-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .load-more-btn:disabled { opacity: 0.5; cursor: default; }
        .load-more-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Responsive visibility ───────────────────────────────── */
        .desktop-only { display: grid; }
        .mobile-only  { display: none; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-only  { display: block; }
          .notes-page-container { padding: 1.25rem 1rem; }
          .notes-page-header { padding: 1.5rem 1rem 1.25rem; }
        }
      `}</style>
    </div>
  );
}
