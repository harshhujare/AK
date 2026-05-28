'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

interface Subject { id: string; name: string; }
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
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', subjectId: '', isPaid: false });
  const [editError, setEditError] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['admin-notes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Note[] }>('/api/notes');
      return data.data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/subjects');
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

  const updateMutation = useMutation({
    mutationFn: () => apiClient.patch(`/api/notes/${editingNote!.id}`, {
      title: editForm.title,
      description: editForm.description || null,
      subjectId: editForm.subjectId,
      isPaid: editForm.isPaid,
    }),
    onSuccess: () => {
      setEditingNote(null);
      setEditError(null);
      qc.invalidateQueries({ queryKey: ['admin-notes'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err: any) => setEditError(err?.response?.data?.error || 'Failed to update note'),
  });

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setEditForm({
      title: note.title,
      description: note.description ?? '',
      subjectId: note.subject.id,
      isPaid: note.isPaid,
    });
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editForm.title.trim()) { setEditError('Title is required'); return; }
    if (!editForm.subjectId) { setEditError('Subject is required'); return; }
    updateMutation.mutate();
  };

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
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="edit-btn" onClick={() => openEdit(note)}>Edit</button>
                      <button className="delete-btn" onClick={() => setDeletingId(note.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editingNote && (
        <div className="modal-overlay" onClick={() => setEditingNote(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit Note</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {editError && <div className="form-error">{editError}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="edit-note-title">Title *</label>
                <input
                  id="edit-note-title" type="text" className="form-input"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-note-desc">Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  id="edit-note-desc" className="form-input" rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-note-subject">Subject *</label>
                <select
                  id="edit-note-subject" className="form-input"
                  value={editForm.subjectId}
                  onChange={e => setEditForm(f => ({ ...f, subjectId: e.target.value }))}
                  required
                >
                  <option value="">Select subject…</option>
                  {subjects?.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Access</label>
                <label className="toggle-label">
                  <input type="checkbox" className="toggle-input"
                    checked={editForm.isPaid}
                    onChange={e => setEditForm(f => ({ ...f, isPaid: e.target.checked }))}
                  />
                  <span className="toggle-track"><span className="toggle-thumb" /></span>
                  <span className="toggle-text">{editForm.isPaid ? 'Paid only' : 'Free for all logged-in users'}</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingNote(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
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
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .admin-page-desc { color: var(--text-secondary); font-size: 0.9rem; }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: var(--accent-bg); color: var(--accent-text);
          border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500;
          cursor: pointer; transition: opacity 0.15s; text-decoration: none; white-space: nowrap;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-secondary {
          padding: 0.6rem 1.25rem; background: var(--bg-surface-2); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.85rem; cursor: pointer;
        }
        .btn-danger {
          padding: 0.6rem 1.25rem; background: var(--danger-bg); color: var(--danger-text);
          border: 1px solid var(--danger-border); border-radius: 8px;
          font-size: 0.85rem; cursor: pointer;
        }

        .search-bar { margin-bottom: 1.25rem; }
        .search-input {
          width: 100%; max-width: 400px; padding: 0.6rem 0.875rem;
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); font-size: 0.875rem; outline: none;
        }
        .search-input:focus { border-color: var(--border-strong); }
        .search-input::placeholder { color: var(--text-placeholder); }

        .notes-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
        .skeleton-row {
          height: 56px; border-radius: 8px;
          background: var(--skeleton-bg); animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity: 0.5; } }

        .empty-state {
          padding: 4rem; text-align: center;
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 14px; color: var(--text-secondary);
        }

        .notes-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
        .notes-table { width: 100%; border-collapse: collapse; }
        .notes-table thead tr { border-bottom: 1px solid var(--border); }
        .notes-table th {
          padding: 0.75rem 1rem; text-align: left;
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-muted); white-space: nowrap;
          background: var(--bg-surface-2);
        }
        .notes-table td {
          padding: 0.875rem 1rem; border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .notes-table tbody tr:last-child td { border-bottom: none; }
        .notes-table tbody tr:hover td { background: var(--bg-hover); }

        .note-title { display: block; font-size: 0.875rem; color: var(--text-primary); font-weight: 500; }
        .note-desc-small {
          display: block; font-size: 0.75rem; color: var(--text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;
        }
        .subject-chip {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
          background: var(--bg-surface-2); color: var(--text-secondary); white-space: nowrap;
        }
        .plan-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
        }
        .plan-badge--free { background: var(--success-bg); color: var(--success-text); }
        .plan-badge--paid { background: var(--info-bg); color: var(--info-text); }

        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 0.8rem; white-space: nowrap; }

        .edit-btn {
          padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.72rem;
          border: 1px solid var(--border); background: var(--bg-surface-2);
          color: var(--text-primary); cursor: pointer; transition: all 0.15s;
        }
        .edit-btn:hover { border-color: var(--border-strong); background: var(--bg-hover); }

        .delete-btn {
          padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.72rem;
          border: 1px solid var(--danger-border); background: var(--danger-bg);
          color: var(--danger-text); cursor: pointer; transition: all 0.15s;
        }
        .delete-btn:hover { opacity: 0.8; }

        .form-error {
          padding: 0.6rem 0.875rem; border-radius: 8px;
          background: var(--danger-bg); border: 1px solid var(--danger-border);
          color: var(--danger-text); font-size: 0.82rem;
        }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label { font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .form-input {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 8px; padding: 0.6rem 0.875rem;
          color: var(--text-primary); font-size: 0.875rem; font-family: inherit; outline: none;
          transition: border-color 0.15s; resize: vertical;
        }
        .form-input:focus { border-color: var(--border-strong); }
        .form-input::placeholder { color: var(--text-placeholder); }

        .toggle-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin-top: 0.25rem; }
        .toggle-input { display: none; }
        .toggle-track {
          width: 40px; height: 22px; border-radius: 11px;
          background: var(--border); position: relative; transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-input:checked + .toggle-track { background: var(--success-bg); }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
          border-radius: 50%; background: var(--success-text); transition: transform 0.2s;
        }
        .toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
        .toggle-text { font-size: 0.8rem; color: var(--text-secondary); }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000; background: var(--overlay-bg);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem; max-width: 480px; width: 100%;
        }
        .modal-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}
