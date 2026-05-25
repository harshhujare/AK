'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

interface Stats {
  totalUsers: number;
  totalNotes: number;
  activeAnnouncements: number;
  todayViews: number;
  revenueInRupees: string;
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value font-serif">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: '/admin/notes/upload', label: 'Upload Note', icon: '⬆', desc: 'Add a new PDF to the library' },
  { href: '/admin/announcements/new', label: 'Add Announcement', icon: '📢', desc: 'Post a new announcement or video' },
  { href: '/admin/subjects', label: 'Manage Subjects', icon: '📚', desc: 'Add or edit subject categories' },
];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Stats }>('/api/admin/stats');
      return data.data;
    },
    refetchInterval: 30_000, // refresh every 30s
  });

  return (
    <div className="dashboard">
      <header className="admin-page-header">
        <h1 className="admin-page-title font-serif">Dashboard</h1>
        <p className="admin-page-desc">Platform overview and quick actions.</p>
      </header>

      {/* Stats Grid */}
      <section className="stats-grid" aria-label="Platform statistics">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="stat-skeleton" />)
        ) : stats ? (
          <>
            <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} icon="👥" />
            <StatCard label="Total Notes" value={stats.totalNotes} icon="📄" />
            <StatCard label="Active Announcements" value={stats.activeAnnouncements} icon="📢" />
            <StatCard label="Note Views Today" value={stats.todayViews} icon="👁" />
          </>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Failed to load stats.</p>
        )}
      </section>

      {/* Quick Actions */}
      <section className="quick-actions-section">
        <h2 className="section-heading">Quick Actions</h2>
        <div className="quick-actions-grid">
          {QUICK_ACTIONS.map(action => (
            <Link key={action.href} href={action.href} className="quick-action-card">
              <span className="quick-action-icon">{action.icon}</span>
              <div>
                <div className="quick-action-label">{action.label}</div>
                <div className="quick-action-desc">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style>{`
        .dashboard { max-width: 1000px; }

        .admin-page-header { margin-bottom: 2rem; }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: white; margin-bottom: 0.25rem; }
        .admin-page-desc { color: rgba(255,255,255,0.45); font-size: 0.9rem; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }

        .stat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1.5rem;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .stat-icon { font-size: 1.5rem; }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: white;
          line-height: 1;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-sub { font-size: 0.75rem; color: rgba(255,255,255,0.3); margin-top: 0.25rem; }

        .stat-skeleton {
          height: 90px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .section-heading {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.35);
          margin-bottom: 1rem;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.75rem;
        }

        .quick-action-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }

        .quick-action-card:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.12);
        }

        .quick-action-icon { font-size: 1.5rem; flex-shrink: 0; }
        .quick-action-label { font-size: 0.9rem; font-weight: 500; color: white; margin-bottom: 0.2rem; }
        .quick-action-desc { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
      `}</style>
    </div>
  );
}
