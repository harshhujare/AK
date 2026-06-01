'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, User, Mail, Trash2, Loader2, CheckCircle, RefreshCcw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import apiClient from '@/lib/api-client';
import useAuthStore from '@/lib/auth-store';
import StatusBadge from '@/components/help/StatusBadge';
import ReplyThread from '@/components/help/ReplyThread';

type TicketType = 'GENERAL' | 'BUG_REPORT' | 'PAYMENT_ISSUE' | 'CONTENT_QUERY';

const TYPE_LABELS: Record<TicketType, string> = {
  GENERAL: 'General Inquiry',
  BUG_REPORT: 'Bug Report',
  PAYMENT_ISSUE: 'Payment Issue',
  CONTENT_QUERY: 'Content Query',
};

export default function AdminTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    apiClient.get(`/api/support/${params.id}`)
      .then(res => setTicket(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      await apiClient.patch(`/api/support/${params.id}/status`, { status: newStatus });
      setTicket((prev: any) => ({ ...prev, status: newStatus }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this ticket? This cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/api/support/${params.id}`);
      router.push('/admin/support');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete ticket');
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 10 }}>
        {error || 'Ticket not found'}
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="atd-page">
      {/* Toolbar */}
      <div className="atd-toolbar">
        <Link href="/admin/support" className="atd-back">
          <ArrowLeft size={16} /> Back to Inbox
        </Link>

        <div className="atd-actions">
          {ticket.status !== 'RESOLVED' ? (
            <button onClick={() => handleStatusChange('RESOLVED')} disabled={statusLoading} className="atd-btn atd-btn--success">
              {statusLoading ? <Loader2 className="atd-btn-icon spinning" /> : <CheckCircle className="atd-btn-icon" />}
              Mark Resolved
            </button>
          ) : (
            <button onClick={() => handleStatusChange('OPEN')} disabled={statusLoading} className="atd-btn atd-btn--ghost">
              {statusLoading ? <Loader2 className="atd-btn-icon spinning" /> : <RefreshCcw className="atd-btn-icon" />}
              Reopen
            </button>
          )}

          {isSuperAdmin && (
            <button onClick={handleDelete} disabled={deleteLoading} className="atd-btn atd-btn--danger">
              {deleteLoading ? <Loader2 className="atd-btn-icon spinning" /> : <Trash2 className="atd-btn-icon" />}
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Ticket Card */}
      <div className="atd-card">
        <div className="atd-card-top">
          <div className="atd-meta">
            <StatusBadge status={ticket.status} />
            <span className="atd-type-tag">{TYPE_LABELS[ticket.type as TicketType]}</span>
            <span className="atd-id">#{ticket.id}</span>
          </div>
          <h1 className="atd-subject">{ticket.subject}</h1>

          <div className="atd-info-grid">
            <div className="atd-info-block">
              <span className="atd-info-label">User</span>
              <div className="atd-info-row"><User size={14} /><span className="atd-info-val">{ticket.user.name}</span></div>
              <div className="atd-info-row"><Mail size={14} /><span className="atd-info-val atd-info-val--muted">{ticket.user.email}</span></div>
            </div>

            <div className="atd-info-block">
              <span className="atd-info-label">Submitted</span>
              <div className="atd-info-row"><Clock size={14} /><span className="atd-info-val">{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span></div>
              {ticket.paymentId && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Payment ID: <code style={{ background: 'var(--bg-page)', padding: '0.1rem 0.3rem', borderRadius: 4, border: '1px solid var(--border)' }}>{ticket.paymentId}</code>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="atd-message-section">
          <div className="atd-section-label">Original Message</div>
          <p className="atd-message">{ticket.message}</p>
        </div>
      </div>

      {/* Thread */}
      <div className="atd-thread-section">
        <div className="atd-section-label">Conversation Thread</div>
        <ReplyThread
          ticketId={ticket.id}
          replies={ticket.replies}
          status={ticket.status}
          isAdmin={true}
        />
      </div>

      <style>{`
        .atd-page { display: flex; flex-direction: column; gap: 1.5rem; max-width: 860px; padding-bottom: 3rem; }

        .atd-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .atd-back {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.15s;
        }
        .atd-back:hover { color: var(--text-primary); }

        .atd-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

        .atd-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          border: none;
          transition: opacity 0.2s;
        }
        .atd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .atd-btn:hover:not(:disabled) { opacity: 0.82; }

        .atd-btn--success { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
        .atd-btn--ghost { background: var(--bg-surface-2); color: var(--text-primary); border: 1px solid var(--border); }
        .atd-btn--danger { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-border); }

        .atd-btn-icon { width: 15px; height: 15px; }
        .spinning { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .atd-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .atd-card-top { padding: 1.75rem; border-bottom: 1px solid var(--border); }

        .atd-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .atd-type-tag {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.2rem 0.6rem;
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
        }

        .atd-id {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
          margin-left: auto;
        }

        .atd-subject {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
          line-height: 1.3;
        }

        .atd-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 1rem 1.25rem;
        }

        @media (max-width: 600px) { .atd-info-grid { grid-template-columns: 1fr; } }

        .atd-info-block { display: flex; flex-direction: column; gap: 0.4rem; }

        .atd-info-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 0.2rem;
        }

        .atd-info-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .atd-info-val { color: var(--text-primary); font-weight: 500; }
        .atd-info-val--muted { color: var(--text-secondary); font-weight: 400; font-size: 0.85rem; }

        .atd-message-section { padding: 1.5rem 1.75rem; }

        .atd-section-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .atd-message {
          color: var(--text-primary);
          line-height: 1.75;
          white-space: pre-wrap;
          font-size: 0.95rem;
        }

        .atd-thread-section { display: flex; flex-direction: column; gap: 1rem; }
      `}</style>
    </div>
  );
}
