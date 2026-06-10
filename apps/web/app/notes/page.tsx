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
  const { data: notesResponse, isLoading } = useNotes(selectedSubject, page, 20);
  const [viewingNote, setViewingNote] = useState<NoteWithSubject | null>(null);

  const handleSubjectSelect = (subjectId: string | null) => {
    setSelectedSubject(subjectId);
    setPage(1);
  };

  return (
    <div className="notes-page">
      <div className="notes-page-header">
        <h1 className="notes-page-title font-serif">Study Notes</h1>
        <p className="notes-page-desc">Chapter-wise handwritten PDFs curated by Ajit Sir.</p>
      </div>

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
        <SubjectFilter selectedSubject={selectedSubject} onSelect={handleSubjectSelect} />

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
        .notes-page {
          min-height: 100vh;
          background: var(--bg-surface);
          padding-bottom: 4rem;
        }
        .notes-page-header {
          background: var(--bg-page);
          border-bottom: 1px solid var(--border);
          padding: 2.5rem 1.5rem 2rem;
        }
        .notes-page-title {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.4rem;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
        }
        .notes-page-desc {
          font-size: 1rem;
          color: var(--text-secondary);
          max-width: 1200px;
          margin: 0 auto;
        }
        .notes-page-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }
        .note-skeleton {
          height: 180px;
          background: var(--skeleton-bg);
          border-radius: 16px;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .notes-empty {
          text-align: center;
          padding: 4rem;
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
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
      `}</style>
    </div>
  );
}
