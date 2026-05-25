'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

interface Note {
  id: string;
  title: string;
  description: string | null;
  isPaid: boolean;
  pageCount: number | null;
  createdAt: string;
  subject: { id: string; name: string };
}

export default function NotesAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['admin-notes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Note[] }>('/api/notes');
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/notes/${id}`),
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['admin-notes'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to delete note'),
  });

  const filtered = notes?.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.subject.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-serif">Notes</h1>
          <p className="admin-page-desc">All uploaded PDFs in the library.</p>
        </div>
        <Link href="/admin/notes/upload" className="btn-primary" id="upload-note-btn">
          ⬆ Upload Note
        </Link>
      </header>

      <div className="search-bar">
        <input
          id="notes-search" type="search" className="search-input"
          placeholder="Search by title or subject…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="notes-skeleton">
          {[1,2,3,4].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {notes?.length === 0 ? (
            <>
              <p>No notes uploaded yet.</p>
              <Link href="/admin/notes/upload" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                Upload your first note
              </Link>
            </>
          ) : (
            <p>No notes match your search.</p>
          )}
        </div>
      ) : (
        <div className="notes-table-wrapper">
          <table className="notes-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Pages</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(note => (
                <tr key={note.id}>
                  <td>
                    <span className="note-title">{note.title}</span>
                    {note.description && <span className="note-desc-small">{note.description}</span>}
                  </td>
                  <td>
                    <span className="subject-chip">{note.subject.name}</span>
                  </td>
                  <td className="text-muted">{note.pageCount ?? '—'}</td>
                  <td>
                    <span className={`plan-badge ${note.isPaid ? 'plan-badge--paid' : 'plan-badge--free'}`}>
                      {note.isPaid ? 'Paid' : 'Free'}
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <button className="delete-btn" onClick={() => setDeletingId(note.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Note?</h3>
            <p className="modal-desc">The PDF file will also be permanently deleted from storage. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
              <button className="btn-danger"
                onClick={() => deleteMutation.mutate(deletingId!)}
                disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { max-width: 1000px; }
        .admin-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
        }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: white; margin-bottom: 0.25rem; }
        .admin-page-desc { color: rgba(255,255,255,0.45); font-size: 0.9rem; }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: white; color: black;
          border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500;
          cursor: pointer; transition: opacity 0.15s; text-decoration: none; white-space: nowrap;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary {
          padding: 0.6rem 1.25rem; background: rgba(255,255,255,0.06); color: white;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          font-size: 0.85rem; cursor: pointer;
        }
        .btn-danger {
          padding: 0.6rem 1.25rem; background: rgba(239,68,68,0.15); color: #fca5a5;
          border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
          font-size: 0.85rem; cursor: pointer;
        }

        .search-bar { margin-bottom: 1.25rem; }
        .search-input {
          width: 100%; max-width: 400px; padding: 0.6rem 0.875rem;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; color: white; font-size: 0.875rem; outline: none;
        }
        .search-input:focus { border-color: rgba(255,255,255,0.25); }
        .search-input::placeholder { color: rgba(255,255,255,0.2); }

        .notes-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
        .skeleton-row {
          height: 56px; border-radius: 8px;
          background: rgba(255,255,255,0.04); animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity: 0.5; } }

        .empty-state {
          padding: 4rem; text-align: center;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; color: rgba(255,255,255,0.4);
        }

        .notes-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07); }
        .notes-table { width: 100%; border-collapse: collapse; }
        .notes-table thead tr { border-bottom: 1px solid rgba(255,255,255,0.07); }
        .notes-table th {
          padding: 0.75rem 1rem; text-align: left;
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.35); white-space: nowrap;
          background: rgba(255,255,255,0.02);
        }
        .notes-table td {
          padding: 0.875rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04);
          vertical-align: middle;
        }
        .notes-table tbody tr:last-child td { border-bottom: none; }
        .notes-table tbody tr:hover td { background: rgba(255,255,255,0.02); }

        .note-title { display: block; font-size: 0.875rem; color: white; font-weight: 500; }
        .note-desc-small {
          display: block; font-size: 0.75rem; color: rgba(255,255,255,0.35);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;
        }
        .subject-chip {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); white-space: nowrap;
        }
        .plan-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
        }
        .plan-badge--free { background: rgba(34,197,94,0.1); color: #86efac; }
        .plan-badge--paid { background: rgba(234,179,8,0.1); color: #fef08a; }

        .text-muted { color: rgba(255,255,255,0.35); }
        .text-sm { font-size: 0.8rem; white-space: nowrap; }

        .delete-btn {
          padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.72rem;
          border: 1px solid rgba(239,68,68,0.2); background: rgba(239,68,68,0.07);
          color: rgba(248,113,113,0.7); cursor: pointer; transition: all 0.15s;
        }
        .delete-btn:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 2rem; max-width: 400px; width: 100%;
        }
        .modal-title { font-size: 1.1rem; font-weight: 600; color: white; margin-bottom: 0.5rem; }
        .modal-desc { color: rgba(255,255,255,0.5); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
      `}</style>
    </div>
  );
}
