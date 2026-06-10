'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentStats {
  totalRevenueRupees: string;
  revenueThisMonthRupees: string;
  revenueLastMonthRupees: string;
  totalPaidUsers: number;
  totalPayments: number;
  successPayments: number;
  failedPayments: number;
  pendingPayments: number;
  successRate: string;
}

interface PlanConfig {
  id: string;
  planDuration: number;
  price: number;       // paise
  label: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface PaymentRow {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number; // paise
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  planDuration: number;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface PaymentsResponse {
  payments: PaymentRow[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMoney = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const fmtDate = (iso: string) => fmt.format(new Date(iso));

const STATUS_STYLE: Record<string, string> = {
  SUCCESS:  'status-badge status-badge--success',
  FAILED:   'status-badge status-badge--failed',
  PENDING:  'status-badge status-badge--pending',
  REFUNDED: 'status-badge status-badge--refunded',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: string }) {
  return (
    <div className="pay-stat-card">
      <p className="pay-stat-label">{label}</p>
      <p className="pay-stat-value font-serif">{value}</p>
      {sub  && <p className="pay-stat-sub">{sub}</p>}
      {trend && <p className="pay-stat-trend">{trend}</p>}
    </div>
  );
}

// ─── Plan Price Editor ────────────────────────────────────────────────────────

function PlanPriceEditor({ config }: { config: PlanConfig }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(String(config.price / 100)); // show in ₹
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (newPriceRupees: number) =>
      apiClient.patch(`/api/admin/plan-config/${config.planDuration}`, {
        price: Math.round(newPriceRupees * 100), // convert to paise
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plan-config'] });
      setEditing(false);
      setError('');
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error || 'Failed to update price');
    },
  });

  const handleSave = () => {
    const rupees = parseFloat(priceInput);
    if (isNaN(rupees) || rupees < 1) {
      setError('Enter a valid price (minimum ₹1)');
      return;
    }
    mutation.mutate(rupees);
  };

  return (
    <div className="plan-config-card">
      <div className="plan-config-header">
        <div>
          <h2 className="plan-config-title">{config.label} · {config.planDuration}-day</h2>
          <p className="plan-config-desc">{config.description || '—'}</p>
        </div>
        <span className={`config-status-badge ${config.isActive ? 'config-status-badge--active' : 'config-status-badge--inactive'}`}>
          {config.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="plan-config-price-row">
        {editing ? (
          <div className="price-edit-row">
            <span className="price-edit-prefix">₹</span>
            <input
              id="plan-price-input"
              type="number"
              min="1"
              step="1"
              className="price-edit-input"
              value={priceInput}
              onChange={e => { setPriceInput(e.target.value); setError(''); }}
              autoFocus
            />
            <button
              id="save-price-btn"
              className="price-edit-btn price-edit-btn--save"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              className="price-edit-btn price-edit-btn--cancel"
              onClick={() => { setEditing(false); setPriceInput(String(config.price / 100)); setError(''); }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="price-display-row">
            <span className="price-display-value font-serif">{fmtMoney(config.price)}</span>
            <button
              id="edit-price-btn"
              className="price-edit-btn price-edit-btn--save"
              onClick={() => setEditing(true)}
            >
              Edit Price
            </button>
          </div>
        )}
      </div>
      {error && <p className="price-error">{error}</p>}
      <p className="plan-config-updated">Last updated: {fmtDate(config.updatedAt)}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Simple debounce for search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  }, []);

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-payment-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PaymentStats }>('/api/admin/payments/stats');
      return data.data;
    },
    // Always re-fetch on mount — stats must reflect the latest DB state
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: configData } = useQuery({
    queryKey: ['admin-plan-config'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PlanConfig[] }>('/api/admin/plan-config');
      return data.data;
    },
  });

  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    isFetching: paymentsFetching,
    refetch: refetchPayments,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['admin-payments', page, statusFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(statusFilter && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await apiClient.get<{ data: PaymentsResponse }>(`/api/admin/payments?${params}`);
      return data.data;
    },
    placeholderData: (prev) => prev,
    // CRITICAL FIX: staleTime:0 means every mount/focus triggers a re-fetch.
    // Without this, the 10-minute global staleTime kept PENDING rows frozen
    // even after the backend had already written SUCCESS to the DB.
    staleTime: 0,
    // Auto-refresh every 30s so long-lived admin sessions stay current
    refetchInterval: 30_000,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const handleRefresh = useCallback(() => {
    refetchPayments();
    refetchStats();
  }, [refetchPayments, refetchStats]);

  const stats = statsData;
  const configs = configData ?? [];
  const payments = paymentsData;

  return (
    <div className="pay-page">
      {/* Page header */}
      <header className="admin-page-header">
        <h1 className="admin-page-title font-serif">Payments</h1>
        <p className="admin-page-desc">Revenue overview, plan pricing, and full transaction history.</p>
      </header>

      {/* ── Revenue Stats ── */}
      <section className="pay-stats-grid" aria-label="Revenue statistics">
        {statsLoading ? (
          [1,2,3,4].map(i => <div key={i} className="pay-stat-skeleton" />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Revenue"
              value={`₹${Number(stats.totalRevenueRupees).toLocaleString('en-IN')}`}
              sub={`${stats.successPayments} paid orders`}
            />
            <StatCard
              label="This Month"
              value={`₹${Number(stats.revenueThisMonthRupees).toLocaleString('en-IN')}`}
              trend={`Last month: ₹${Number(stats.revenueLastMonthRupees).toLocaleString('en-IN')}`}
            />
            <StatCard
              label="Paid Users"
              value={stats.totalPaidUsers.toLocaleString()}
              sub="Currently active plans"
            />
            <StatCard
              label="Success Rate"
              value={`${stats.successRate}%`}
              sub={`${stats.failedPayments} failed · ${stats.pendingPayments} pending`}
            />
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Failed to load revenue stats.</p>
        )}
      </section>

      {/* ── Plan Price Management ── */}
      {configs.length > 0 && (
        <section className="plan-config-section" aria-label="Plan configuration">
          <h2 className="section-heading">Plan Configuration</h2>
          <div className="plan-config-grid">
            {configs.map(c => <PlanPriceEditor key={c.id} config={c} />)}
          </div>
        </section>
      )}

      {/* ── Payment History ── */}
      <section className="pay-history-section" aria-label="Payment history">
        <div className="pay-history-header">
          <div className="pay-history-title-row">
            <h2 className="section-heading" style={{ margin: 0 }}>Transaction History</h2>
            {lastUpdated && (
              <span className="pay-last-updated">
                {paymentsFetching ? '🔄 Refreshing…' : `Updated at ${lastUpdated}`}
              </span>
            )}
          </div>
          <div className="pay-filters">
            <button
              id="refresh-payments-btn"
              className="pay-refresh-btn"
              onClick={handleRefresh}
              disabled={paymentsFetching}
              aria-label="Refresh payment data"
            >
              {paymentsFetching ? '…' : '↻'} Refresh
            </button>
            <input
              id="payment-search"
              type="search"
              placeholder="Search user, email, order ID…"
              className="pay-search-input"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            <select
              id="payment-status-filter"
              className="pay-status-filter"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="pay-table-wrap">
          <table className="pay-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Amount</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Order ID</th>
              </tr>
            </thead>
            <tbody>
              {paymentsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j}><div className="cell-skeleton" /></td>
                    ))}
                  </tr>
                ))
              ) : payments?.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pay-empty">No payments found.</td>
                </tr>
              ) : (
                payments?.payments.map(p => (
                  <tr key={p.id}>
                    <td className="pay-td-date">{fmtDate(p.createdAt)}</td>
                    <td className="pay-td-user">
                      <span className="pay-user-name">{p.user.name}</span>
                      <span className="pay-user-email">{p.user.email}</span>
                    </td>
                    <td className="pay-td-amount">{fmtMoney(p.amount)}</td>
                    <td className="pay-td-plan">{p.planDuration}d</td>
                    <td><span className={STATUS_STYLE[p.status]}>{p.status}</span></td>
                    <td className="pay-td-order">
                      <span title={p.razorpayOrderId}>{p.razorpayOrderId.slice(-10)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {payments && payments.totalPages > 1 && (
          <div className="pay-pagination">
            <button
              className="pay-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            <span className="pay-page-info">
              Page {payments.page} of {payments.totalPages}
              <span className="pay-page-total"> ({payments.total} total)</span>
            </span>
            <button
              className="pay-page-btn"
              disabled={page >= payments.totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        )}
      </section>

      <style>{`
        .pay-page { max-width: 1100px; }

        .admin-page-header { margin-bottom: 2rem; }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .admin-page-desc { color: var(--text-secondary); font-size: 0.9rem; }

        /* ── Stats ── */
        .pay-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .pay-stat-card {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.5rem 1.25rem;
        }
        .pay-stat-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }
        .pay-stat-value {
          font-size: 1.9rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 0.4rem;
        }
        .pay-stat-sub { font-size: 0.75rem; color: var(--text-secondary); }
        .pay-stat-trend { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem; }
        .pay-stat-skeleton {
          height: 100px;
          border-radius: 14px;
          background: var(--skeleton-bg);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── Plan Config ── */
        .plan-config-section { margin-bottom: 2.5rem; }
        .section-heading {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 1rem;
        }
        .plan-config-grid { display: flex; flex-direction: column; gap: 1rem; }
        .plan-config-card {
          background: var(--bg-surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 1.5rem;
        }
        .plan-config-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }
        .plan-config-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }
        .plan-config-desc { font-size: 0.8rem; color: var(--text-secondary); }
        .config-status-badge {
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
        .config-status-badge--active { background: #dcfce7; color: #166534; }
        .config-status-badge--inactive { background: var(--bg-surface); color: var(--text-muted); }

        .plan-config-price-row { margin-bottom: 0.75rem; }
        .price-display-row { display: flex; align-items: center; gap: 1rem; }
        .price-display-value { font-size: 2rem; font-weight: 700; color: var(--text-primary); }

        .price-edit-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .price-edit-prefix { font-size: 1.4rem; color: var(--text-primary); font-weight: 600; }
        .price-edit-input {
          font-size: 1.4rem;
          font-weight: 600;
          width: 120px;
          padding: 0.3rem 0.5rem;
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-primary);
          outline: none;
        }
        .price-edit-input:focus { border-color: var(--accent, #2563eb); }

        .price-edit-btn {
          padding: 0.45rem 0.9rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }
        .price-edit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .price-edit-btn--save { background: var(--accent-bg, #2563eb); color: var(--accent-text, #fff); }
        .price-edit-btn--save:hover:not(:disabled) { opacity: 0.85; }
        .price-edit-btn--cancel { background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-secondary); }
        .price-edit-btn--cancel:hover { background: var(--bg-hover); }

        .price-error { font-size: 0.8rem; color: var(--danger-text, #dc2626); margin-top: 0.4rem; }
        .plan-config-updated { font-size: 0.7rem; color: var(--text-muted); }

        /* ── History section ── */
        .pay-history-section { }
        .pay-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .pay-history-title-row {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .pay-last-updated {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .pay-refresh-btn {
          padding: 0.4rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.82rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .pay-refresh-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
        .pay-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pay-filters { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .pay-search-input {
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 0.85rem;
          width: 240px;
          outline: none;
        }
        .pay-search-input:focus { border-color: var(--border-strong); }
        .pay-status-filter {
          padding: 0.45rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }

        .pay-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 1rem;
        }
        .pay-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .pay-table thead {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
        }
        .pay-table th {
          padding: 0.75rem 1rem;
          text-align: left;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .pay-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .pay-table tr:last-child td { border-bottom: none; }
        .pay-table tr:hover td { background: var(--bg-hover); }
        .pay-table tbody tr { transition: background 0.1s; }

        .pay-td-date { color: var(--text-secondary); white-space: nowrap; font-size: 0.8rem; }
        .pay-td-user { display: flex; flex-direction: column; gap: 0.15rem; }
        .pay-user-name { font-weight: 500; color: var(--text-primary); }
        .pay-user-email { font-size: 0.75rem; color: var(--text-muted); }
        .pay-td-amount { font-weight: 600; color: var(--text-primary); white-space: nowrap; }
        .pay-td-plan { color: var(--text-secondary); font-size: 0.8rem; }
        .pay-td-order { font-family: monospace; font-size: 0.78rem; color: var(--text-muted); }

        .status-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .status-badge--success  { background: #dcfce7; color: #166534; }
        .status-badge--failed   { background: #fee2e2; color: #991b1b; }
        .status-badge--pending  { background: #fef9c3; color: #854d0e; }
        .status-badge--refunded { background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border); }

        .cell-skeleton {
          height: 16px;
          border-radius: 4px;
          background: var(--skeleton-bg);
          animation: pulse 1.5s ease-in-out infinite;
        }
        .pay-empty { text-align: center; color: var(--text-muted); padding: 2.5rem; }

        /* ── Pagination ── */
        .pay-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          padding-top: 0.5rem;
        }
        .pay-page-btn {
          padding: 0.4rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .pay-page-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
        .pay-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pay-page-info { font-size: 0.85rem; color: var(--text-secondary); }
        .pay-page-total { color: var(--text-muted); font-size: 0.78rem; }

        @media (max-width: 600px) {
          .pay-search-input { width: 100%; }
          .pay-history-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
