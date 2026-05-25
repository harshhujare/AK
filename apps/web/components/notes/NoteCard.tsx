'use client';

import type { NoteWithSubject } from '@/hooks/useNotes';
import { useRouter } from 'next/navigation';

interface NoteCardProps {
  note: NoteWithSubject;
  isAuthenticated: boolean;
  onClick: (note: NoteWithSubject) => void;
}

export default function NoteCard({ note, isAuthenticated, onClick }: NoteCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/#notes`);
      return;
    }
    onClick(note);
  };

  return (
    <div className="note-card" onClick={handleClick} role="button" tabIndex={0}>
      <div className="note-card-inner">
        <div className="note-subject">
          <span className="subject-badge">{note.subject.name}</span>
          {!isAuthenticated && (
            <span className="lock-icon" title="Login required" aria-label="Login required">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
          )}
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
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 1.5rem;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s, border-color 0.2s;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .note-card:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
        }
        .note-card-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
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
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
        }
        .lock-icon {
          color: rgba(255,255,255,0.3);
        }
        .note-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: white;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }
        .note-desc {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.5);
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
          border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
}
