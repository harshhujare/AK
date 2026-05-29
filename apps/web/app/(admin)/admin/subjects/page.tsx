'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface Subject {
  id: string;
  name: string;
  nameMarathi: string | null;
  order: number;
  createdAt: string;
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', nameMarathi: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editForm, setEditForm] = useState({ name: '', nameMarathi: '', order: 0 });
  const [editError, setEditError] = useState<string | null>(null);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/subjects');
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/api/subjects', {
      name: newSubject.name,
      nameMarathi: newSubject.nameMarathi || undefined,
      order: subjects ? subjects.length : 0, // auto-assign order
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setNewSubject({ name: '', nameMarathi: '' });
      setShowForm(false);
      setFormError(null);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to create subject'),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiClient.patch(`/api/subjects/${editingSubject!.id}`, {
      name: editForm.name,
      nameMarathi: editForm.nameMarathi || null,
      order: editForm.order,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setEditingSubject(null);
      setEditError(null);
    },
    onError: (err: any) => setEditError(err?.response?.data?.error || 'Failed to update subject'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/subjects/${id}`),
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Cannot delete — subject may have notes attached.'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newSubject.name.trim()) { setFormError('Name is required'); return; }
    createMutation.mutate();
  };

  const openEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setEditForm({ name: sub.name, nameMarathi: sub.nameMarathi ?? '', order: sub.order });
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editForm.name.trim()) { setEditError('Name is required'); return; }
    updateMutation.mutate();
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-serif">Subjects</h1>
          <p className="admin-page-desc">Manage subject categories for notes.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} id="add-subject-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          {showForm ? 'Cancel' : <><Plus size={16} /> Add Subject</>}
        </button>
      </header>

      {/* Inline add form */}
      {showForm && (
        <form className="inline-form" onSubmit={handleCreate}>
          {formError && <div className="form-error">{formError}</div>}
          <div className="form-help">
            Fill in the subject details below. The Marathi name is optional but recommended.
            New subjects appear at the end of the filter list.
          </div>
          <div className="inline-form-row">
            <div className="input-group">
              <label className="input-label" htmlFor="subject-name">English Name *</label>
              <input
                id="subject-name" type="text" className="form-input"
                placeholder="e.g. Child Development"
                value={newSubject.name}
                onChange={e => setNewSubject(s => ({ ...s, name: e.target.value }))}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="subject-name-mr">मराठी नाव (optional)</label>
              <input
                id="subject-name-mr" type="text" className="form-input"
                placeholder="उदा. बालविकास"
                value={newSubject.nameMarathi}
                onChange={e => setNewSubject(s => ({ ...s, nameMarathi: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary submit-btn" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add Subject'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="subject-list">
          {[1, 2, 3].map(i => <div key={i} className="subject-skeleton" />)}
        </div>
      ) : !subjects || subjects.length === 0 ? (
        <div className="empty-state">No subjects yet. Add one above.</div>
      ) : (
        <div className="subject-list">
          {subjects.map(sub => (
            <div key={sub.id} className="subject-row">
              <div className="subject-info">
                <span className="subject-order">#{sub.order}</span>
                <div>
                  <span className="subject-name">{sub.name}</span>
                  {sub.nameMarathi && <span className="subject-name-mr">{sub.nameMarathi}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="edit-btn" onClick={() => openEdit(sub)}>Edit</button>
                <button
                  className="delete-btn"
                  onClick={() => setDeletingId(sub.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingSubject && (
        <div className="modal-overlay" onClick={() => setEditingSubject(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit Subject</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {editError && <div className="form-error">{editError}</div>}

              <div className="form-group">
                <label className="input-label" htmlFor="edit-sub-name">English Name *</label>
                <input
                  id="edit-sub-name" type="text" className="form-input"
                  placeholder="e.g. Child Development"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="edit-sub-name-mr">मराठी नाव <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>(optional)</span></label>
                <input
                  id="edit-sub-name-mr" type="text" className="form-input"
                  placeholder="उदा. बालविकास"
                  value={editForm.nameMarathi}
                  onChange={e => setEditForm(f => ({ ...f, nameMarathi: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="edit-sub-order">Display Order</label>
                <input
                  id="edit-sub-order" type="number" className="form-input"
                  min={0} value={editForm.order}
                  onChange={e => setEditForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lower number = shown first.</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingSubject(null)}>Cancel</button>
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
            <h3 className="modal-title">Delete Subject?</h3>
            <p className="modal-desc">This will fail if any notes are attached to this subject. Remove those first.</p>
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
        .admin-page { max-width: 700px; }
        .admin-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
        }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .admin-page-desc { color: var(--text-secondary); font-size: 0.9rem; }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: var(--accent-bg); color: var(--accent-text);
          border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500;
          cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

        .btn-secondary {
          padding: 0.6rem 1.25rem; background: var(--bg-surface-2); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer;
        }
        .btn-danger {
          padding: 0.6rem 1.25rem; background: var(--danger-bg); color: var(--danger-text);
          border: 1px solid var(--danger-border); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer;
        }

        .inline-form {
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
        }
        .form-help {
          font-size: 0.78rem; color: var(--text-muted);
          margin-bottom: 1rem; line-height: 1.5;
        }
        .inline-form-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
        .input-group { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 150px; }
        .input-label { font-size: 0.72rem; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .submit-btn { align-self: flex-end; white-space: nowrap; flex-shrink: 0; }
        .form-error {
          padding: 0.6rem 0.875rem; border-radius: 8px; margin-bottom: 0.75rem;
          background: var(--danger-bg); border: 1px solid var(--danger-border);
          color: var(--danger-text); font-size: 0.8rem;
        }
        .form-input {
          flex: 1; min-width: 140px; background: var(--input-bg);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 0.6rem 0.875rem; color: var(--text-primary); font-size: 0.875rem; outline: none;
          font-family: inherit;
        }
        .form-input:focus { border-color: var(--border-strong); }
        .form-input::placeholder { color: var(--text-placeholder); }

        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }

        .subject-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .subject-skeleton {
          height: 60px; border-radius: 10px;
          background: var(--skeleton-bg); animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity: 0.5; } }

        .subject-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; padding: 0.875rem 1rem;
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 10px; transition: border-color 0.15s;
        }
        .subject-row:hover { border-color: var(--border-strong); }
        .subject-info { display: flex; align-items: center; gap: 0.75rem; }
        .subject-order { font-size: 0.75rem; color: var(--text-muted); width: 1.5rem; }
        .subject-name { font-size: 0.9rem; color: var(--text-primary); }
        .subject-name-mr { font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem; }

        .edit-btn {
          padding: 0.35rem 0.7rem; border-radius: 6px; font-size: 0.75rem;
          border: 1px solid var(--border); background: var(--bg-surface-2);
          color: var(--text-primary); cursor: pointer; transition: all 0.15s;
        }
        .edit-btn:hover { border-color: var(--border-strong); background: var(--bg-hover); }

        .delete-btn {
          padding: 0.35rem 0.7rem; border-radius: 6px; font-size: 0.75rem;
          border: 1px solid var(--danger-border); background: var(--danger-bg);
          color: var(--danger-text); cursor: pointer; transition: all 0.15s;
        }
        .delete-btn:hover { opacity: 0.8; }

        .empty-state {
          padding: 3rem; text-align: center;
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 14px; color: var(--text-muted);
        }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: var(--overlay-bg); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem; max-width: 440px; width: 100%;
        }
        .modal-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
      `}</style>
    </div>
  );
}
