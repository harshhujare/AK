'use client';
/**
 * /admin/tests — Test list with inline publish/unpublish toggle
 *
 * Features:
 *  - Lists all tests (published + drafts, via ?published=false bypass)
 *  - Inline publish toggle via PATCH /api/tests/:id (single boolean field)
 *  - "New Test" → navigates to /admin/tests/new
 *  - Row click → navigates to /admin/tests/:id/questions (question editor)
 *  - Delete with confirmation
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import type { Test } from '@ajitsir/shared';

type SortField = 'createdAt' | 'title' | 'type';

export default function AdminTestsPage() {
  const router = useRouter();
  const [tests,   setTests]   = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null); // testId being toggled
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortBy,  setSortBy]  = useState<SortField>('createdAt');
  const [filterType, setFilterType] = useState<string>('ALL');

  // ── Fetch all tests (including drafts) ──────────────────────────────────────
  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/api/tests?published=false');
      setTests(data.data as Test[]);
    } catch {
      setError('Failed to load tests. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTests(); }, [loadTests]);

  // ── Publish toggle ──────────────────────────────────────────────────────────
  const handleTogglePublish = async (test: Test, e: React.MouseEvent) => {
    e.stopPropagation(); // don't navigate to editor
    if (toggling) return;
    setToggling(test.id);
    try {
      await apiClient.patch(`/api/tests/${test.id}`, { isPublished: !test.isPublished });
      setTests((prev) =>
        prev.map((t) => t.id === test.id ? { ...t, isPublished: !t.isPublished } : t)
      );
    } catch {
      alert('Failed to update publish status. Please try again.');
    } finally {
      setToggling(null);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (test: Test, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${test.title}"? This will also delete all student attempts.`)) return;
    setDeleting(test.id);
    try {
      await apiClient.delete(`/api/tests/${test.id}`);
      setTests((prev) => prev.filter((t) => t.id !== test.id));
    } catch {
      alert('Failed to delete test.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Filter + sort ───────────────────────────────────────────────────────────
  const visible = tests
    .filter((t) => filterType === 'ALL' || t.type === filterType)
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'type')  return a.type.localeCompare(b.type);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const counts = {
    total:     tests.length,
    published: tests.filter((t) => t.isPublished).length,
    drafts:    tests.filter((t) => !t.isPublished).length,
  };

  return (
    <div className="atl-wrap">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="atl-header">
        <div>
          <h1 className="atl-title">Mock Tests</h1>
          <p className="atl-sub">
            {counts.total} total · {counts.published} published · {counts.drafts} drafts
          </p>
        </div>
        <Link href="/admin/tests/new" className="atl-btn-new" id="admin-tests-new-btn">
          + New Test
        </Link>
      </div>

      {/* ── Filters + sort ──────────────────────────────────────────────── */}
      <div className="atl-toolbar">
        <div className="atl-type-filter">
          {['ALL', 'DAILY', 'PREDEFINED', 'SUBJECT'].map((t) => (
            <button
              key={t}
              className={`atl-type-btn ${filterType === t ? 'atl-type-btn--active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'ALL' ? 'All' : t === 'PREDEFINED' ? 'Scheduled' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <select
          className="atl-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          aria-label="Sort by"
        >
          <option value="createdAt">Newest first</option>
          <option value="title">Title A–Z</option>
          <option value="type">Type</option>
        </select>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="atl-error">
          {error}
          <button onClick={loadTests} className="atl-error-retry">Retry</button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="atl-table">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="atl-row atl-row--skel">
              <div className="atl-skel atl-skel--title" />
              <div className="atl-skel atl-skel--badge" />
              <div className="atl-skel atl-skel--badge" />
              <div className="atl-skel atl-skel--toggle" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="atl-empty">
          <p>No tests found. <Link href="/admin/tests/new" className="atl-empty-link">Create your first test →</Link></p>
        </div>
      ) : (
        <div className="atl-table">
          {/* Table header */}
          <div className="atl-row atl-row--head">
            <span className="atl-col-title">Title</span>
            <span className="atl-col-type">Type</span>
            <span className="atl-col-qs">Questions</span>
            <span className="atl-col-status">Status</span>
            <span className="atl-col-actions">Actions</span>
          </div>

          {visible.map((test) => {
            const qCount = test._count?.questions ?? 0;
            const isToggling = toggling === test.id;
            const isDeleting = deleting === test.id;

            return (
              <div
                key={test.id}
                className="atl-row atl-row--data"
                onClick={() => router.push(`/admin/tests/${test.id}/questions`)}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${test.title}`}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/admin/tests/${test.id}/questions`)}
              >
                <span className="atl-col-title">
                  <span className="atl-test-title marathi-text">{test.title}</span>
                  {test.description && (
                    <span className="atl-test-desc">{test.description}</span>
                  )}
                </span>

                <span className="atl-col-type">
                  <span className={`atl-type-chip atl-type-chip--${test.type.toLowerCase()}`}>
                    {test.type === 'PREDEFINED' ? 'Scheduled' : test.type === 'DAILY' ? 'Daily' : 'Subject'}
                  </span>
                </span>

                <span className="atl-col-qs">
                  <span className="atl-qs-count">{qCount}</span>
                  {test.isPaid && <span className="atl-paid-badge">PAID</span>}
                </span>

                <span className="atl-col-status" onClick={(e) => handleTogglePublish(test, e)}>
                  <button
                    className={`atl-toggle ${test.isPublished ? 'atl-toggle--on' : ''} ${isToggling ? 'atl-toggle--loading' : ''}`}
                    aria-label={test.isPublished ? 'Published — click to unpublish' : 'Draft — click to publish'}
                    disabled={isToggling}
                  >
                    <span className="atl-toggle-thumb" />
                  </button>
                  <span className="atl-toggle-label">
                    {isToggling ? '…' : test.isPublished ? 'Live' : 'Draft'}
                  </span>
                </span>

                <span className="atl-col-actions" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/admin/tests/${test.id}/questions`}
                    className="atl-action-btn"
                    title="Edit questions"
                  >
                    Edit
                  </Link>
                  <button
                    className="atl-action-btn atl-action-btn--danger"
                    onClick={(e) => handleDelete(test, e)}
                    disabled={isDeleting}
                    title="Delete test"
                  >
                    {isDeleting ? '…' : 'Delete'}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .atl-wrap { max-width: 1000px; }

  /* Header */
  .atl-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .atl-title { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .atl-sub   { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
  .atl-btn-new {
    padding: 9px 18px;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 700;
    border-radius: 10px;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 0.15s;
  }
  .atl-btn-new:hover { opacity: 0.88; }

  /* Toolbar */
  .atl-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .atl-type-filter { display: flex; gap: 4px; flex-wrap: wrap; }
  .atl-type-btn {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.12s;
  }
  .atl-type-btn--active {
    background: var(--bg-active);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
  .atl-sort-select {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }

  /* Table */
  .atl-table {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .atl-row {
    display: grid;
    grid-template-columns: 1fr 90px 80px 90px 120px;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
  }
  .atl-row:last-child { border-bottom: none; }
  .atl-row--head {
    background: var(--bg-surface-2);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .atl-row--data {
    cursor: pointer;
    transition: background 0.12s;
  }
  .atl-row--data:hover { background: var(--bg-hover); }

  /* Columns */
  .atl-test-title {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }
  .atl-test-desc {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
    margin-top: 2px;
  }
  .atl-type-chip {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 3px 7px;
    border-radius: 5px;
    border: 1px solid transparent;
  }
  .atl-type-chip--daily       { background: rgba(99,102,241,0.12); color: #a5b4fc; border-color: rgba(99,102,241,0.3); }
  .atl-type-chip--predefined  { background: var(--warn-bg);        color: var(--warn-text); border-color: var(--warn-border); }
  .atl-type-chip--subject     { background: var(--success-bg);     color: var(--success-text); border-color: var(--success-border); }

  .atl-qs-count { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
  .atl-paid-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--warn-bg);
    color: var(--warn-text);
    border: 1px solid var(--warn-border);
    margin-left: 6px;
  }

  /* Publish toggle */
  .atl-col-status { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .atl-toggle {
    width: 34px;
    height: 18px;
    border-radius: 99px;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    position: relative;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }
  .atl-toggle--on  { background: var(--success-text); border-color: var(--success-text); }
  .atl-toggle--loading { opacity: 0.5; }
  .atl-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .atl-toggle--on .atl-toggle-thumb { transform: translateX(16px); }
  .atl-toggle-label { font-size: 11px; color: var(--text-muted); }

  /* Action buttons */
  .atl-col-actions { display: flex; align-items: center; gap: 6px; }
  .atl-action-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .atl-action-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
  .atl-action-btn--danger { color: var(--danger-text); border-color: var(--danger-border); }
  .atl-action-btn--danger:hover { background: var(--danger-bg); }

  /* Error */
  .atl-error {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 10px;
    color: var(--danger-text);
    font-size: 13px;
    margin-bottom: 14px;
  }
  .atl-error-retry {
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid var(--danger-border);
    background: none;
    color: var(--danger-text);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  /* Empty */
  .atl-empty {
    padding: 48px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .atl-empty-link { color: var(--text-secondary); font-weight: 600; }

  /* Skeleton */
  .atl-row--skel { cursor: default; pointer-events: none; }
  .atl-skel {
    border-radius: 6px;
    background: var(--bg-surface-2);
    animation: atl-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes atl-shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
  .atl-skel--title  { height: 14px; width: 70%; }
  .atl-skel--badge  { height: 20px; width: 60px; border-radius: 5px; }
  .atl-skel--toggle { height: 18px; width: 34px; border-radius: 99px; }

  /* Mobile: stack columns */
  @media (max-width: 640px) {
    .atl-row { grid-template-columns: 1fr auto; }
    .atl-col-type, .atl-col-qs { display: none; }
  }
`;
