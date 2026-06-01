'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '@/lib/auth-store';
import apiClient from '@/lib/api-client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'SUPPORT_MANAGER' | 'CONTENT_MANAGER' | 'SUPER_ADMIN';
  plan: 'FREE' | 'PAID';
  planExpiresAt: string | null;
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  SUPPORT_MANAGER: 'Support Mgr',
  CONTENT_MANAGER: 'Content Mgr',
  SUPER_ADMIN: 'Super Admin',
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._searchTimeout);
    (window as any)._searchTimeout = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const { data } = await apiClient.get<{ data: UsersResponse }>(`/api/admin/users?${params}`);
      return data.data;
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiClient.patch(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      setChangingRoleId(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to update role'),
  });

  const handleRoleConfirm = () => {
    if (!changingRoleId || !selectedRole) return;
    roleMutation.mutate({ id: changingRoleId, role: selectedRole });
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-serif">Users</h1>
          <p className="admin-page-desc">Manage registered students and team members.</p>
        </div>
        {data && (
          <span className="total-badge">{data.total.toLocaleString()} users</span>
        )}
      </header>

      <div className="search-bar">
        <input
          id="users-search" type="search" className="search-input"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="skeleton-list">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-row" />)}
        </div>
      ) : !data || data.users.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <>
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Joined</th>
                  {currentUser?.role === 'SUPER_ADMIN' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id} className={u.id === currentUser?.userId ? 'row-self' : ''}>
                    <td>
                      <div className="user-name-cell">
                        <span className="user-avatar">{u.name.charAt(0).toUpperCase()}</span>
                        <span className="user-name">{u.name}</span>
                        {u.id === currentUser?.userId && <span className="you-tag">You</span>}
                      </div>
                    </td>
                    <td className="text-muted text-sm">{u.email}</td>
                    <td>
                      <span className={`role-badge role-badge--${u.role.toLowerCase()}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`plan-badge plan-badge--${u.plan.toLowerCase()}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="text-muted text-sm">
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    {currentUser?.role === 'SUPER_ADMIN' && (
                      <td>
                        {u.id !== currentUser?.userId ? (
                          <button
                            className="change-role-btn"
                            onClick={() => { setChangingRoleId(u.id); setSelectedRole(u.role); }}
                          >
                            Change Role
                          </button>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="page-info">Page {data.page} of {data.totalPages}</span>
              <button className="page-btn" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Role change modal */}
      {changingRoleId && (
        <div className="modal-overlay" onClick={() => setChangingRoleId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Change User Role</h3>
            <p className="modal-desc">Select the new role for this user.</p>
            <div className="role-options">
              {(['STUDENT', 'SUPPORT_MANAGER', 'CONTENT_MANAGER', 'SUPER_ADMIN'] as const).map(role => (
                <label key={role} className={`role-option ${selectedRole === role ? 'role-option--selected' : ''}`}>
                  <input type="radio" name="role" value={role}
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                  />
                  <span className="role-option-label">{ROLE_LABELS[role]}</span>
                  <span className="role-option-desc">
                    {role === 'STUDENT' ? 'Can only view notes' :
                     role === 'SUPPORT_MANAGER' ? 'Can manage support tickets and FAQs' :
                     role === 'CONTENT_MANAGER' ? 'Can upload notes and manage announcements' :
                     'Full access to everything'}
                  </span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setChangingRoleId(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleRoleConfirm} disabled={roleMutation.isPending}>
                {roleMutation.isPending ? 'Saving…' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page { max-width: 1000px; }
        .admin-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
        }
        .admin-page-title { font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
        .admin-page-desc { color: var(--text-secondary); font-size: 0.9rem; }

        .total-badge {
          padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.75rem;
          background: var(--bg-surface-2); color: var(--text-secondary);
        }

        .search-bar { margin-bottom: 1.25rem; }
        .search-input {
          width: 100%; max-width: 400px; padding: 0.6rem 0.875rem;
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); font-size: 0.875rem; outline: none;
        }
        .search-input:focus { border-color: var(--border-strong); }
        .search-input::placeholder { color: var(--text-placeholder); }

        .skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .skeleton-row {
          height: 56px; border-radius: 8px; background: var(--skeleton-bg);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity: 0.5; } }

        .empty-state {
          padding: 4rem; text-align: center;
          background: var(--bg-surface-2); border: 1px solid var(--border);
          border-radius: 14px; color: var(--text-secondary);
        }

        .users-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem; }
        .users-table { width: 100%; border-collapse: collapse; }
        .users-table thead tr { border-bottom: 1px solid var(--border); }
        .users-table th {
          padding: 0.75rem 1rem; text-align: left;
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-muted); background: var(--bg-surface-2);
        }
        .users-table td {
          padding: 0.875rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle;
        }
        .users-table tbody tr:last-child td { border-bottom: none; }
        .users-table tbody tr:hover td { background: var(--bg-hover); }
        .row-self td { background: var(--bg-active); }

        .user-name-cell { display: flex; align-items: center; gap: 0.65rem; }
        .user-avatar {
          width: 28px; height: 28px; border-radius: 50%; background: var(--bg-surface-2);
          display: flex; align-items: center; justify-content: center; border: 1px solid var(--border);
          font-size: 0.75rem; font-weight: 700; color: var(--text-primary); flex-shrink: 0;
        }
        .user-name { font-size: 0.875rem; color: var(--text-primary); }
        .you-tag {
          font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 4px;
          background: var(--info-bg); color: var(--info-text);
        }

        .role-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; white-space: nowrap;
        }
        .role-badge--student { background: var(--bg-surface-2); color: var(--text-secondary); }
        .role-badge--support_manager { background: rgba(59,130,246,0.1); color: #1d4ed8; border: 1px solid rgba(59,130,246,0.2); }
        [data-theme="dark"] .role-badge--support_manager { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .role-badge--content_manager { background: var(--info-bg); color: var(--info-text); border: 1px solid var(--border-strong); }
        .role-badge--super_admin { background: var(--accent-bg); color: var(--accent-text); border: 1px solid var(--border-strong); }

        .plan-badge {
          font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px;
        }
        .plan-badge--free { background: var(--bg-surface-2); color: var(--text-secondary); }
        .plan-badge--paid { background: var(--success-bg); color: var(--success-text); }

        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 0.8rem; }

        .change-role-btn {
          padding: 0.3rem 0.65rem; border-radius: 6px; font-size: 0.72rem;
          border: 1px solid var(--border); background: var(--bg-surface-2);
          color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
        }
        .change-role-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .pagination {
          display: flex; align-items: center; gap: 1rem; justify-content: center;
          padding-top: 0.5rem;
        }
        .page-btn {
          padding: 0.45rem 1rem; background: var(--bg-surface-2);
          border: 1px solid var(--border); border-radius: 8px;
          color: var(--text-primary); font-size: 0.8rem; cursor: pointer; transition: background 0.15s;
        }
        .page-btn:hover:not(:disabled) { background: var(--bg-hover); }
        .page-btn:disabled { opacity: 0.4; cursor: default; }
        .page-info { font-size: 0.8rem; color: var(--text-muted); }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000; background: var(--overlay-bg);
          backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem;
        }
        .modal {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem; max-width: 400px; width: 100%;
        }
        .modal-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
        .modal-desc { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.25rem; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }

        .role-options { display: flex; flex-direction: column; gap: 0.5rem; }
        .role-option {
          display: flex; flex-direction: column; gap: 0.15rem;
          padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border);
          cursor: pointer; transition: border-color 0.15s;
        }
        .role-option input { display: none; }
        .role-option--selected { border-color: var(--border-strong); background: var(--bg-active); }
        .role-option-label { font-size: 0.875rem; color: var(--text-primary); font-weight: 500; }
        .role-option-desc { font-size: 0.75rem; color: var(--text-muted); }

        .btn-primary {
          padding: 0.6rem 1.25rem; background: var(--accent-bg); color: var(--accent-text); border: none; border-radius: 8px;
          font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-secondary {
          padding: 0.6rem 1.25rem; background: var(--bg-surface-2); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px;
          font-size: 0.875rem; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
