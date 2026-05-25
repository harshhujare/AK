'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

export default function NewAnnouncementPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'TEXT' as 'TEXT' | 'VIDEO',
    youtubeUrl: '',
    isActive: true,
    order: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiClient.post('/api/announcements', {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      youtubeUrl: form.type === 'VIDEO' ? form.youtubeUrl : undefined,
      isActive: form.isActive,
      order: form.order,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
      router.push('/admin/announcements');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create announcement');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (form.type === 'VIDEO' && !form.youtubeUrl.trim()) {
      setError('YouTube URL is required for Video type'); return;
    }
    mutation.mutate();
  };

  return (
    <div className="form-page">
      <header className="admin-page-header">
        <div>
          <Link href="/admin/announcements" className="back-link">← Back</Link>
          <h1 className="admin-page-title font-serif" style={{ marginTop: '0.5rem' }}>New Announcement</h1>
        </div>
      </header>

      <form className="admin-form" onSubmit={handleSubmit} id="new-announcement-form">
        {error && <div className="form-error" role="alert">{error}</div>}

        {/* Type selector */}
        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="type-selector">
            <button type="button"
              className={`type-btn ${form.type === 'TEXT' ? 'type-btn--active' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: 'TEXT' }))}>
              📝 Text Announcement
            </button>
            <button type="button"
              className={`type-btn ${form.type === 'VIDEO' ? 'type-btn--active' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: 'VIDEO' }))}>
              ▶ YouTube Video
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ann-title">Title *</label>
          <input
            id="ann-title" type="text" className="form-input"
            placeholder="Enter announcement title…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ann-desc">Description <span className="optional">(optional)</span></label>
          <textarea
            id="ann-desc" className="form-textarea" rows={3}
            placeholder="Short description shown on the card…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        {form.type === 'VIDEO' && (
          <div className="form-group">
            <label className="form-label" htmlFor="ann-yt">YouTube URL *</label>
            <input
              id="ann-yt" type="url" className="form-input"
              placeholder="https://youtube.com/watch?v=..."
              value={form.youtubeUrl}
              onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
            />
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="ann-order">Display Order</label>
            <input
              id="ann-order" type="number" className="form-input"
              min={0} value={form.order}
              onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
            />
            <p className="form-hint">Lower number = shown first.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <label className="toggle-label">
              <input type="checkbox" className="toggle-input"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
              <span className="toggle-text">{form.isActive ? 'Active (visible on homepage)' : 'Inactive (hidden)'}</span>
            </label>
          </div>
        </div>

        <div className="form-submit-row">
          <Link href="/admin/announcements" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Announcement'}
          </button>
        </div>
      </form>

      <style>{`
        .form-page { max-width: 640px; }
        .admin-page-header { margin-bottom: 2rem; }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: white; }

        .back-link { font-size: 0.8rem; color: rgba(255,255,255,0.4); text-decoration: none; }
        .back-link:hover { color: rgba(255,255,255,0.7); }

        .admin-form {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 2rem;
          display: flex; flex-direction: column; gap: 1.5rem;
        }

        .form-error {
          padding: 0.75rem 1rem; border-radius: 8px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5; font-size: 0.85rem;
        }

        .form-group { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .form-label { font-size: 0.8rem; font-weight: 500; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; }
        .optional { font-weight: 400; text-transform: none; color: rgba(255,255,255,0.3); }

        .form-input, .form-textarea {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 0.65rem 0.875rem;
          color: white; font-size: 0.9rem; font-family: inherit;
          transition: border-color 0.15s; outline: none;
        }
        .form-input::placeholder, .form-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .form-input:focus, .form-textarea:focus { border-color: rgba(255,255,255,0.3); }
        .form-textarea { resize: vertical; }
        .form-hint { font-size: 0.72rem; color: rgba(255,255,255,0.3); }

        .type-selector { display: flex; gap: 0.75rem; }
        .type-btn {
          flex: 1; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.5);
          font-size: 0.85rem; cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .type-btn--active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.25); color: white; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

        /* Toggle */
        .toggle-label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin-top: 0.25rem; }
        .toggle-input { display: none; }
        .toggle-track {
          width: 40px; height: 22px; border-radius: 11px;
          background: rgba(255,255,255,0.1); position: relative;
          transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-input:checked + .toggle-track { background: #22c55e; }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px; border-radius: 50%;
          background: white; transition: transform 0.2s;
        }
        .toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
        .toggle-text { font-size: 0.8rem; color: rgba(255,255,255,0.6); }

        .form-submit-row { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }

        .btn-primary {
          padding: 0.65rem 1.5rem; background: white; color: black;
          border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 500;
          cursor: pointer; transition: opacity 0.15s; text-decoration: none;
        }
        .btn-primary:hover, .btn-primary:disabled { opacity: 0.8; }

        .btn-secondary {
          padding: 0.65rem 1.25rem; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          font-size: 0.875rem; cursor: pointer; text-decoration: none; transition: background 0.15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.08); }

        @media (max-width: 640px) {
          .form-row { grid-template-columns: 1fr; }
          .type-selector { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
