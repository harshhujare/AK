'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '@/lib/api-client';
import StatusBadge from '@/components/help/StatusBadge';
import ReplyThread from '@/components/help/ReplyThread';

type TicketType = 'GENERAL' | 'BUG_REPORT' | 'PAYMENT_ISSUE' | 'CONTENT_QUERY';

const TYPE_LABELS: Record<TicketType, string> = {
  GENERAL: 'General Inquiry',
  BUG_REPORT: 'Bug Report',
  PAYMENT_ISSUE: 'Payment Issue',
  CONTENT_QUERY: 'Content Query',
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    apiClient.get(`/api/support/mine/${params.id}`)
      .then(res => setTicket(res.data.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="ticket-detail-page">
        <div className="ticket-detail-spinner" />
        <style>{`.ticket-detail-page { min-height: 100vh; background: var(--bg-page); display: flex; align-items: center; justify-content: center; }
          .ticket-detail-spinner { width: 32px; height: 32px; border: 2px solid var(--border); border-top-color: var(--text-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-page" style={{ padding: '7rem 1.5rem', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 10, marginBottom: '1rem' }}>
          {error || 'Ticket not found'}
        </div>
        <button onClick={() => router.push('/help/tickets')} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back to Tickets
        </button>
        <style>{`.ticket-detail-page { min-height: 100vh; background: var(--bg-page); }`}</style>
      </div>
    );
  }

  return (
    <div className="ticket-detail-page">
      <Link href="/help/tickets" className="ticket-detail-back">
        <ArrowLeft size={16} /> Back to Tickets
      </Link>

      <div className="ticket-detail-meta">
        <StatusBadge status={ticket.status} />
        <span className="ticket-detail-type">{TYPE_LABELS[ticket.type as TicketType]}</span>
        <span className="ticket-detail-id">#{ticket.id.slice(-6)}</span>
      </div>

      <h1 className="ticket-detail-subject">{ticket.subject}</h1>

      <div className="ticket-detail-time">
        <Clock size={14} />
        <span>Submitted {formatDistanceToNow(new Date(ticket.createdAt))} ago</span>
      </div>

      <div className="ticket-detail-message">
        <p>{ticket.message}</p>
      </div>

      <div className="ticket-detail-thread-label">Conversation</div>

      <ReplyThread
        ticketId={ticket.id}
        replies={ticket.replies}
        status={ticket.status}
      />

      <style>{`
        .ticket-detail-page {
          min-height: 100vh;
          background: var(--bg-page);
          padding: 7rem 1.5rem 4rem;
          max-width: 760px;
          margin: 0 auto;
        }

        .ticket-detail-back {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-decoration: none;
          margin-bottom: 1.5rem;
          transition: color 0.15s;
        }
        .ticket-detail-back:hover { color: var(--text-primary); }

        .ticket-detail-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .ticket-detail-type {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.2rem 0.6rem;
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
        }

        .ticket-detail-id {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
          margin-left: auto;
        }

        .ticket-detail-subject {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }

        .ticket-detail-time {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .ticket-detail-message {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          color: var(--text-primary);
          line-height: 1.7;
          white-space: pre-wrap;
          margin-bottom: 2rem;
        }

        .ticket-detail-thread-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          margin-bottom: 1rem;
          padding-left: 0.25rem;
        }
      `}</style>
    </div>
  );
}
