'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import apiClient from '@/lib/api-client';
import StatusBadge from '@/components/help/StatusBadge';

type TicketType = 'GENERAL' | 'BUG_REPORT' | 'PAYMENT_ISSUE' | 'CONTENT_QUERY';

const TYPE_LABELS: Record<TicketType, string> = {
  GENERAL: 'General',
  BUG_REPORT: 'Bug',
  PAYMENT_ISSUE: 'Payment',
  CONTENT_QUERY: 'Content',
};

export default function SupportInboxPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams();
      if (filterStatus !== 'All') query.append('status', filterStatus);
      if (filterType !== 'All') query.append('type', filterType);
      if (search) query.append('search', search);

      apiClient.get(`/api/support?${query.toString()}`)
        .then(res => setTickets(res.data.data))
        .catch(err => setError(err.response?.data?.error || 'Failed to load tickets'))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [filterStatus, filterType, search]);

  return (
    <div className="inbox-page">
      <div className="inbox-header">
        <div>
          <h1 className="inbox-title">Support Inbox</h1>
          <p className="inbox-subtitle">Manage user support tickets and inquiries.</p>
        </div>
      </div>

      {error && <div className="inbox-error">{error}</div>}

      {/* Filters */}
      <div className="inbox-filters">
        <div className="inbox-search-wrap">
          <Search className="inbox-search-icon" />
          <input
            type="text"
            placeholder="Search subject or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="inbox-search"
          />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="inbox-select">
          <option value="All">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="inbox-select">
          <option value="All">All Types</option>
          <option value="GENERAL">General</option>
          <option value="BUG_REPORT">Bug Report</option>
          <option value="PAYMENT_ISSUE">Payment</option>
          <option value="CONTENT_QUERY">Content</option>
        </select>
      </div>

      {/* Table */}
      <div className="inbox-table-wrap">
        <table className="inbox-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>User</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Replies</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="inbox-table-empty">
                  <Loader2 className="inbox-spinner" />
                  <span>Loading tickets...</span>
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="inbox-table-empty">No tickets found.</td>
              </tr>
            ) : (
              tickets.map(ticket => (
                <tr key={ticket.id} className="inbox-row">
                  <td>
                    <Link href={`/admin/support/${ticket.id}`} className="inbox-ticket-link">
                      <span className="inbox-ticket-subject">{ticket.subject}</span>
                      <span className="inbox-ticket-meta">
                        #{ticket.id.slice(-6)}
                        <span className="inbox-dot" />
                        {TYPE_LABELS[ticket.type as TicketType]}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="inbox-user-name">{ticket.user.name}</span>
                    <span className="inbox-user-email">{ticket.user.email}</span>
                  </td>
                  <td><StatusBadge status={ticket.status} /></td>
                  <td className="inbox-cell-muted">{formatDistanceToNow(new Date(ticket.updatedAt))} ago</td>
                  <td className="inbox-cell-muted">{ticket._count.replies}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .inbox-page { display: flex; flex-direction: column; gap: 1.5rem; }

        .inbox-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .inbox-subtitle { font-size: 0.875rem; color: var(--text-secondary); }

        .inbox-error {
          padding: 0.875rem 1rem;
          background: var(--danger-bg);
          color: var(--danger-text);
          border: 1px solid var(--danger-border);
          border-radius: 10px;
          font-size: 0.875rem;
        }

        .inbox-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .inbox-search-wrap {
          flex: 1;
          min-width: 200px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .inbox-search-icon {
          position: absolute;
          left: 0.75rem;
          width: 15px;
          height: 15px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .inbox-search {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.55rem 0.75rem 0.55rem 2.25rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .inbox-search:focus { border-color: var(--border-strong); }
        .inbox-search::placeholder { color: var(--text-placeholder); }

        .inbox-select {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
          appearance: none;
          padding-right: 2rem;
          cursor: pointer;
        }
        .inbox-select:focus { border-color: var(--border-strong); }

        .inbox-table-wrap {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          overflow-x: auto;
        }

        .inbox-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          white-space: nowrap;
        }

        .inbox-table thead {
          background: var(--bg-surface-2);
          border-bottom: 1px solid var(--border);
        }

        .inbox-table th {
          padding: 0.875rem 1.25rem;
          text-align: left;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .inbox-table td { padding: 1rem 1.25rem; vertical-align: top; }

        .inbox-row { border-top: 1px solid var(--border); transition: background 0.15s; }
        .inbox-row:hover { background: var(--bg-hover); }

        .inbox-table-empty {
          padding: 3rem !important;
          text-align: center;
          color: var(--text-muted);
          display: flex !important;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .inbox-spinner { width: 18px; height: 18px; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .inbox-ticket-link { text-decoration: none; display: block; }

        .inbox-ticket-subject {
          display: block;
          font-weight: 500;
          color: var(--text-primary);
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.15s;
          margin-bottom: 0.25rem;
        }
        .inbox-row:hover .inbox-ticket-subject { color: var(--accent-bg); }

        .inbox-ticket-meta {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .inbox-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-muted); }

        .inbox-user-name { display: block; font-weight: 500; color: var(--text-primary); }
        .inbox-user-email { display: block; font-size: 0.8rem; color: var(--text-muted); }

        .inbox-cell-muted { color: var(--text-secondary); font-size: 0.875rem; }
      `}</style>
    </div>
  );
}
