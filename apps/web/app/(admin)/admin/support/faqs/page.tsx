'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Check, X } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  isActive: boolean;
  order: number;
}

export default function ManageFAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formData, setFormData] = useState({
    category: '',
    question: '',
    answer: '',
    isActive: true,
    order: 0,
  });

  const fetchFaqs = () => {
    setLoading(true);
    apiClient.get('/api/faqs/all')
      .then(res => setFaqs(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load FAQs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFaqs(); }, []);

  const openModal = (faq?: FAQ) => {
    if (faq) {
      setEditingId(faq.id);
      setFormData({ category: faq.category, question: faq.question, answer: faq.answer, isActive: faq.isActive, order: faq.order });
    } else {
      setEditingId(null);
      setFormData({ category: '', question: '', answer: '', isActive: true, order: faqs.length });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      if (editingId) {
        await apiClient.patch(`/api/faqs/${editingId}`, formData);
      } else {
        await apiClient.post('/api/faqs', formData);
      }
      fetchFaqs();
      closeModal();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save FAQ');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return;
    try {
      await apiClient.delete(`/api/faqs/${id}`);
      setFaqs(faqs.filter(f => f.id !== id));
    } catch { alert('Failed to delete FAQ'); }
  };

  const toggleActive = async (faq: FAQ) => {
    try {
      const newStatus = !faq.isActive;
      await apiClient.patch(`/api/faqs/${faq.id}`, { isActive: newStatus });
      setFaqs(faqs.map(f => f.id === faq.id ? { ...f, isActive: newStatus } : f));
    } catch { alert('Failed to update status'); }
  };

  return (
    <div className="faqs-page">
      <div className="faqs-header">
        <div>
          <h1 className="faqs-title">Manage FAQs</h1>
          <p className="faqs-subtitle">Create and edit Frequently Asked Questions.</p>
        </div>
        <button onClick={() => openModal()} className="faqs-add-btn">
          <Plus size={16} /> Add FAQ
        </button>
      </div>

      {error && <div className="faqs-error">{error}</div>}

      <div className="faqs-table-wrap">
        <table className="faqs-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Question</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="faqs-table-empty"><Loader2 className="faqs-spinner" />Loading FAQs...</td></tr>
            ) : faqs.length === 0 ? (
              <tr><td colSpan={4} className="faqs-table-empty">No FAQs yet. Click "Add FAQ" to create one.</td></tr>
            ) : (
              faqs.map(faq => (
                <tr key={faq.id} className="faqs-row">
                  <td><span className="faqs-cat-tag">{faq.category}</span></td>
                  <td>
                    <span className="faqs-question">{faq.question}</span>
                    <span className="faqs-answer-preview">{faq.answer}</span>
                  </td>
                  <td>
                    <button onClick={() => toggleActive(faq)} className={`faqs-status-btn ${faq.isActive ? 'faqs-status-btn--active' : 'faqs-status-btn--hidden'}`}>
                      {faq.isActive ? <><Check size={13} /> Active</> : <><X size={13} /> Hidden</>}
                    </button>
                  </td>
                  <td>
                    <div className="faqs-row-actions">
                      <button onClick={() => openModal(faq)} className="faqs-action-btn faqs-action-btn--edit" title="Edit"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(faq.id)} className="faqs-action-btn faqs-action-btn--delete" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="faqs-modal-overlay" onClick={closeModal}>
          <div className="faqs-modal" onClick={e => e.stopPropagation()}>
            <h2 className="faqs-modal-title">{editingId ? 'Edit FAQ' : 'Create FAQ'}</h2>

            <form onSubmit={handleSubmit} className="faqs-form">
              <div className="faqs-field">
                <label className="faqs-label">Category</label>
                <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g. Payments, General" className="faqs-input" required />
              </div>

              <div className="faqs-field">
                <label className="faqs-label">Question</label>
                <input type="text" value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })}
                  className="faqs-input" required />
              </div>

              <div className="faqs-field">
                <label className="faqs-label">Answer</label>
                <textarea value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })}
                  rows={4} className="faqs-textarea" required />
              </div>

              <div className="faqs-checkbox-row">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                <label htmlFor="isActive" className="faqs-checkbox-label">Visible to users (Active)</label>
              </div>

              <div className="faqs-modal-footer">
                <button type="button" onClick={closeModal} className="faqs-modal-cancel">Cancel</button>
                <button type="submit" disabled={submitLoading} className="faqs-modal-submit">
                  {submitLoading && <Loader2 className="faqs-spinner" />}
                  {editingId ? 'Save Changes' : 'Create FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .faqs-page { display: flex; flex-direction: column; gap: 1.5rem; }

        .faqs-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }

        .faqs-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .faqs-subtitle { font-size: 0.875rem; color: var(--text-secondary); }

        .faqs-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1.25rem;
          background: var(--accent-bg);
          color: var(--accent-text);
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .faqs-add-btn:hover { opacity: 0.88; }

        .faqs-error {
          padding: 0.875rem 1rem;
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 10px;
          font-size: 0.875rem;
        }

        .faqs-table-wrap {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          overflow-x: auto;
        }

        .faqs-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }

        .faqs-table thead {
          background: var(--bg-surface-2);
          border-bottom: 1px solid var(--border);
        }

        .faqs-table th {
          padding: 0.875rem 1.25rem;
          text-align: left;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .faqs-table td { padding: 1rem 1.25rem; vertical-align: top; }

        .faqs-row { border-top: 1px solid var(--border); transition: background 0.15s; }
        .faqs-row:hover { background: var(--bg-hover); }

        .faqs-table-empty {
          padding: 3rem !important;
          text-align: center;
          color: var(--text-muted);
          display: flex !important;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .faqs-spinner { width: 16px; height: 16px; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .faqs-cat-tag {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-primary);
          font-weight: 500;
          white-space: nowrap;
        }

        .faqs-question { display: block; font-weight: 500; color: var(--text-primary); margin-bottom: 0.3rem; }
        .faqs-answer-preview {
          display: block;
          font-size: 0.8rem;
          color: var(--text-muted);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .faqs-status-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.65rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s;
        }
        .faqs-status-btn:hover { opacity: 0.8; }
        .faqs-status-btn--active { background: rgba(34,197,94,0.12); color: #15803d; }
        [data-theme="dark"] .faqs-status-btn--active { background: rgba(34,197,94,0.18); color: #4ade80; }
        .faqs-status-btn--hidden { background: rgba(120,120,120,0.1); color: var(--text-secondary); }

        .faqs-row-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.4rem; }

        .faqs-action-btn {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          border: none; border-radius: 6px;
          cursor: pointer; transition: background 0.15s, color 0.15s;
          color: var(--text-secondary);
          background: none;
        }
        .faqs-action-btn--edit:hover { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .faqs-action-btn--delete:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

        /* Modal */
        .faqs-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
        }

        .faqs-modal {
          width: 100%; max-width: 540px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 2rem;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }

        .faqs-modal-title { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1.5rem; }

        .faqs-form { display: flex; flex-direction: column; gap: 1rem; }

        .faqs-field { display: flex; flex-direction: column; gap: 0.35rem; }

        .faqs-label { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }

        .faqs-input,
        .faqs-textarea {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.7rem 0.875rem;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .faqs-input:focus, .faqs-textarea:focus { border-color: var(--border-strong); }
        .faqs-textarea { resize: none; }

        .faqs-checkbox-row { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.25rem; }
        .faqs-checkbox-label { font-size: 0.875rem; color: var(--text-primary); cursor: pointer; }

        .faqs-modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.75rem;
          padding-top: 1.25rem;
          margin-top: 0.5rem;
          border-top: 1px solid var(--border);
        }

        .faqs-modal-cancel {
          background: none; border: none;
          font-size: 0.875rem; color: var(--text-secondary);
          cursor: pointer; font-family: inherit;
          transition: color 0.15s; padding: 0.5rem;
        }
        .faqs-modal-cancel:hover { color: var(--text-primary); }

        .faqs-modal-submit {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.6rem 1.5rem;
          background: var(--accent-bg); color: var(--accent-text);
          border: none; border-radius: 8px;
          font-size: 0.875rem; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: opacity 0.2s;
        }
        .faqs-modal-submit:hover:not(:disabled) { opacity: 0.88; }
        .faqs-modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
