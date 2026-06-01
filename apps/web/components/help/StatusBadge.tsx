type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <>
      <span className={`status-badge status-badge--${status.toLowerCase().replace('_', '-')}`}>
        {status === 'OPEN' ? 'Open' : status === 'IN_PROGRESS' ? 'In Progress' : 'Resolved'}
      </span>

      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.65rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .status-badge--open {
          background: rgba(234,179,8,0.12);
          color: #b45309;
        }
        [data-theme="dark"] .status-badge--open {
          background: rgba(234,179,8,0.18);
          color: #fbbf24;
        }
        .status-badge--in-progress {
          background: rgba(59,130,246,0.12);
          color: #1d4ed8;
        }
        [data-theme="dark"] .status-badge--in-progress {
          background: rgba(59,130,246,0.2);
          color: #60a5fa;
        }
        .status-badge--resolved {
          background: rgba(34,197,94,0.12);
          color: #15803d;
        }
        [data-theme="dark"] .status-badge--resolved {
          background: rgba(34,197,94,0.15);
          color: #4ade80;
        }
      `}</style>
    </>
  );
}
