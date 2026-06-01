import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

type TicketType = 'GENERAL' | 'BUG_REPORT' | 'PAYMENT_ISSUE' | 'CONTENT_QUERY';
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

const TYPE_LABELS: Record<TicketType, string> = {
  GENERAL: 'General',
  BUG_REPORT: 'Bug Report',
  PAYMENT_ISSUE: 'Payment',
  CONTENT_QUERY: 'Content',
};

interface TicketCardProps {
  ticket: {
    id: string;
    type: TicketType;
    status: TicketStatus;
    subject: string;
    createdAt: string;
    updatedAt: string;
    _count?: { replies: number };
  };
}

export default function TicketCard({ ticket }: TicketCardProps) {
  return (
    <>
      <Link href={`/help/tickets/${ticket.id}`} className="ticket-card">
        <div className="ticket-card-left">
          <div className="ticket-card-meta">
            <StatusBadge status={ticket.status} />
            <span className="ticket-type-tag">{TYPE_LABELS[ticket.type]}</span>
            <span className="ticket-id">#{ticket.id.slice(-6)}</span>
          </div>
          <p className="ticket-subject">{ticket.subject}</p>
        </div>

        <div className="ticket-card-right">
          <div className="ticket-card-stat">
            <Clock className="ticket-stat-icon" />
            <span>{formatDistanceToNow(new Date(ticket.updatedAt))} ago</span>
          </div>
          {ticket._count !== undefined && (
            <div className="ticket-card-stat">
              <MessageSquare className="ticket-stat-icon" />
              <span>{ticket._count.replies} {ticket._count.replies === 1 ? 'reply' : 'replies'}</span>
            </div>
          )}
        </div>
      </Link>

      <style>{`
        .ticket-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          padding: 1.25rem;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          text-decoration: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .ticket-card:hover {
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }

        .ticket-card-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }

        .ticket-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }

        .ticket-type-tag {
          font-size: 0.72rem;
          font-weight: 500;
          padding: 0.2rem 0.5rem;
          background: var(--bg-hover);
          color: var(--text-secondary);
          border-radius: 6px;
          border: 1px solid var(--border);
        }

        .ticket-id {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .ticket-subject {
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
        }
        .ticket-card:hover .ticket-subject { color: var(--accent-bg); }

        .ticket-card-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.35rem;
          flex-shrink: 0;
        }

        .ticket-card-stat {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .ticket-stat-icon { width: 14px; height: 14px; color: var(--text-muted); }

        @media (max-width: 600px) {
          .ticket-card { flex-direction: column; }
          .ticket-card-right { flex-direction: row; align-items: center; gap: 1rem; }
        }
      `}</style>
    </>
  );
}
