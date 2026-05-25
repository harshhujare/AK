'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

interface Announcement {
  id: string;
  title: string;
  description: string | null;
  type: 'TEXT' | 'VIDEO';
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
                    {ann.type === 'VIDEO' ? '▶ Video' : '📝 Text'}
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
        .admin-page-title { font-size: 2rem; font-weight: 700; color: white; margin-bottom: 0.25rem; }
        .admin-page-desc { color: rgba(255,255,255,0.45); font-size: 0.9rem; }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: white; color: black;
          border: none; border-radius: 8px; font-size: 0.85rem;
          font-weight: 500; cursor: pointer; text-decoration: none;
          white-space: nowrap; transition: opacity 0.15s; display: inline-block;
        }
        .btn-primary:hover { opacity: 0.9; }

        .btn-secondary {
          padding: 0.6rem 1.25rem; background: rgba(255,255,255,0.06); color: white;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background 0.15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.09); }

        .btn-danger {
          padding: 0.6rem 1.25rem; background: rgba(239,68,68,0.15); color: #fca5a5;
          border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
          font-size: 0.85rem; font-weight: 500; cursor: pointer;
        }
        .btn-danger:hover { background: rgba(239,68,68,0.25); }

        .table-skeleton, .row-skeleton {
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .row-skeleton {
          height: 80px; border-radius: 12px;
          background: rgba(255,255,255,0.04);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .empty-state {
          text-align: center; padding: 4rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; color: rgba(255,255,255,0.4);
        }

        .ann-list { display: flex; flex-direction: column; gap: 0.75rem; }

        .ann-row {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 1.25rem;
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 1rem;
          transition: border-color 0.15s;
        }
        .ann-row:hover { border-color: rgba(255,255,255,0.12); }
        .ann-row--inactive { opacity: 0.5; }

        .ann-info { flex: 1; }
        .ann-row-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }

        .type-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6);
        }
        .type-badge--video { background: rgba(239,68,68,0.15); color: #fca5a5; }

        .status-dot {
          width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15);
        }
        .status-dot--active { background: #22c55e; }

        .ann-order { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
        .ann-title { font-size: 0.95rem; font-weight: 500; color: white; margin-bottom: 0.25rem; }
        .ann-desc { font-size: 0.8rem; color: rgba(255,255,255,0.45); }
        .ann-url a { font-size: 0.75rem; color: rgba(100,149,237,0.8); text-decoration: none; }
        .ann-url a:hover { color: cornflowerblue; }

        .ann-actions { display: flex; gap: 0.5rem; flex-shrink: 0; flex-wrap: wrap; }

        .toggle-btn {
          padding: 0.4rem 0.75rem; border-radius: 6px;
          font-size: 0.75rem; font-weight: 500; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
          transition: all 0.15s;
        }
        .toggle-btn--active {
          background: rgba(34,197,94,0.1); color: #86efac;
          border-color: rgba(34,197,94,0.3);
        }
        .toggle-btn:hover { opacity: 0.8; }

        .delete-btn {
          padding: 0.4rem 0.75rem; border-radius: 6px;
          font-size: 0.75rem; font-weight: 500; cursor: pointer;
          border: 1px solid rgba(239,68,68,0.2);
          background: rgba(239,68,68,0.07); color: rgba(248,113,113,0.7);
          transition: all 0.15s;
        }
        .delete-btn:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 1rem;
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
