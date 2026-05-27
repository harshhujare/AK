'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  type: 'IMAGE' | 'VIDEO';
  youtubeUrl: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Announcement[] }>('/api/announcements/all');
      return data.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/announcements/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-announcements'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/announcements/${id}`),
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-serif">Announcements</h1>
          <p className="admin-page-desc">Manage homepage slider content — text announcements and YouTube videos.</p>
        </div>
        <Link href="/admin/announcements/new" className="btn-primary" id="new-announcement-btn">
          + New Announcement
        </Link>
      </header>

      {isLoading ? (
        <div className="table-skeleton">
          {[1, 2, 3].map(i => <div key={i} className="row-skeleton" />)}
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="empty-state">
          <p>No announcements yet.</p>
          <Link href="/admin/announcements/new" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Create your first announcement
          </Link>
        </div>
      ) : (
        <div className="ann-list">
          {announcements.map(ann => (
            <div key={ann.id} className={`ann-row ${!ann.isActive ? 'ann-row--inactive' : ''}`}>
              <div className="ann-info">
                <div className="ann-row-top">
                  <span className={`type-badge ${ann.type === 'VIDEO' ? 'type-badge--video' : ''}`}>
                    {ann.type === 'VIDEO' ? '▶ Video' : '🖼️ Image'}
                  </span>
                  <span className={`status-dot ${ann.isActive ? 'status-dot--active' : ''}`} />
                  <span className="ann-order">Order: {ann.order}</span>
                </div>
                <h3 className="ann-title">{ann.title}</h3>
                {ann.description && <p className="ann-desc">{ann.description}</p>}
                {ann.youtubeUrl && (
                  <p className="ann-url">
                    <a href={ann.youtubeUrl} target="_blank" rel="noopener noreferrer">{ann.youtubeUrl}</a>
                  </p>
                )}
              </div>

              <div className="ann-actions">
                <button
                  className={`toggle-btn ${ann.isActive ? 'toggle-btn--active' : ''}`}
                  onClick={() => toggleMutation.mutate({ id: ann.id, isActive: !ann.isActive })}
                  disabled={toggleMutation.isPending}
                  title={ann.isActive ? 'Deactivate' : 'Activate'}
                >
                  {ann.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setDeletingId(ann.id)}
                  title="Delete announcement"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Delete Announcement?</h3>
            <p className="modal-desc">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                className="btn-danger"
                onClick={() => deleteMutation.mutate(deletingId!)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { max-width: 900px; }
        .admin-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;
        }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .admin-page-desc { color: var(--text-secondary); font-size: 0.9rem; }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: var(--accent-bg); color: var(--accent-text);
          border: none; border-radius: 8px; font-size: 0.85rem;
          font-weight: 500; cursor: pointer; text-decoration: none;
          white-space: nowrap; transition: opacity 0.15s; display: inline-block;
        }
        .btn-primary:hover { opacity: 0.9; }

        .btn-secondary {
          padding: 0.6rem 1.25rem; background: var(--bg-surface-2); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background 0.15s;
        }
        .btn-secondary:hover { background: var(--bg-hover); }

        .btn-danger {
          padding: 0.6rem 1.25rem; background: var(--danger-bg); color: var(--danger-text);
          border: 1px solid var(--danger-border); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer;
        }
        .btn-danger:hover { opacity: 0.8; }

        .table-skeleton, .row-skeleton {
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .row-skeleton {
          height: 80px; border-radius: 12px;
          background: var(--skeleton-bg);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .empty-state {
          text-align: center; padding: 4rem;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 16px; color: var(--text-muted);
        }

        .ann-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .ann-row {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 1.25rem;
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 1rem;
          transition: border-color 0.15s;
        }
        .ann-row:hover { border-color: var(--border-strong); }
        .ann-row--inactive { opacity: 0.5; }

        .ann-info { flex: 1; }
        .ann-row-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }

        .type-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
          background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border);
        }
        .type-badge--video { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-border); }

        .status-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--text-placeholder);
        }
        .status-dot--active { background: var(--success-text); }

        .ann-order { font-size: 0.7rem; color: var(--text-muted); }
        .ann-title { font-size: 0.95rem; font-weight: 500; color: var(--text-primary); margin-bottom: 0.25rem; }
        .ann-desc { font-size: 0.8rem; color: var(--text-secondary); }
        .ann-url a { font-size: 0.75rem; color: var(--info-text); text-decoration: none; }
        .ann-url a:hover { opacity: 0.8; }

        .ann-actions { display: flex; gap: 0.5rem; flex-shrink: 0; flex-wrap: wrap; }

        .toggle-btn {
          padding: 0.4rem 0.75rem; border-radius: 6px;
          font-size: 0.75rem; font-weight: 500; cursor: pointer;
          border: 1px solid var(--border);
          background: var(--bg-surface-2); color: var(--text-secondary);
          transition: all 0.15s;
        }
        .toggle-btn--active {
          background: var(--success-bg); color: var(--success-text);
          border-color: var(--success-border);
        }
        .toggle-btn:hover { opacity: 0.8; }

        .delete-btn {
          padding: 0.4rem 0.75rem; border-radius: 6px;
          font-size: 0.75rem; font-weight: 500; cursor: pointer;
          border: 1px solid var(--danger-border);
          background: var(--danger-bg); color: var(--danger-text);
          transition: all 0.15s;
        }
        .delete-btn:hover { opacity: 0.8; }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: var(--overlay-bg); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem; max-width: 400px; width: 100%;
        }
        .modal-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
      `}</style>
    </div>
  );
}
