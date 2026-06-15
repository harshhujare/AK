'use client';
/**
 * /admin/tests/new — Create new test (metadata only)
 *
 * Creates the test shell via POST /api/tests (no questions yet).
 * On success → redirect to /admin/tests/:id/questions to add questions.
 *
 * Questions are managed in the two-panel editor (separate route) to keep this
 * form fast and avoid a complex nested UX on mobile.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import type { Subject } from '@ajitsir/shared';

type TestType = 'DAILY' | 'PREDEFINED' | 'SUBJECT';

export default function NewTestPage() {
  const router = useRouter();

  const [subjects,   setSubjects]   = useState<Subject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [subjectId,    setSubjectId]    = useState('');
  const [type,         setType]         = useState<TestType>('SUBJECT');
  const [isPaid,       setIsPaid]       = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState<string>('30'); // minutes, empty = untimed
  const [scheduledAt,  setScheduledAt]  = useState('');
  const [expiresAt,    setExpiresAt]    = useState('');

  // ── Load subjects ────────────────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get('/api/subjects').then(({ data }) => {
      setSubjects(data.data as Subject[]);
      if (data.data.length > 0) setSubjectId(data.data[0].id);
    }).catch(() => setError('Could not load subjects.'));
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!subjectId)    { setError('Subject is required.'); return; }
    setError(null);
    setSubmitting(true);

    const timeLimitSec = timeLimitMin.trim()
      ? parseInt(timeLimitMin, 10) * 60
      : undefined;

    try {
      const { data } = await apiClient.post('/api/tests', {
        title:        title.trim(),
        description:  description.trim() || undefined,
        subjectId,
        type,
        isPaid,
        timeLimitSec,
        scheduledAt:  scheduledAt || undefined,
        expiresAt:    expiresAt   || undefined,
        isPublished:  false, // always start as draft
      });
      // Redirect to question editor immediately
      router.push(`/admin/tests/${data.data.id}/questions`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to create test. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="ntf-wrap">
      <div className="ntf-header">
        <Link href="/admin/tests" className="ntf-back">← Back to Tests</Link>
        <h1 className="ntf-title">New Test</h1>
        <p className="ntf-sub">Set the test metadata. You'll add questions on the next screen.</p>
      </div>

      <form onSubmit={handleSubmit} className="ntf-form" noValidate>
        {error && <div className="ntf-error">{error}</div>}

        {/* Title */}
        <div className="ntf-field">
          <label className="ntf-label" htmlFor="test-title">Title *</label>
          <input
            id="test-title"
            className="ntf-input marathi-text"
            type="text"
            placeholder="e.g. बालमानसशास्त्र Daily Practice Test"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div className="ntf-field">
          <label className="ntf-label" htmlFor="test-desc">Description</label>
          <textarea
            id="test-desc"
            className="ntf-input ntf-textarea marathi-text"
            placeholder="Optional — shown on the test card"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
          />
        </div>

        {/* Subject */}
        <div className="ntf-field">
          <label className="ntf-label" htmlFor="test-subject">Subject *</label>
          <select
            id="test-subject"
            className="ntf-input ntf-select"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
          >
            {subjects.length === 0 && <option value="">Loading subjects…</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Type row */}
        <div className="ntf-field">
          <label className="ntf-label">Test Type *</label>
          <div className="ntf-type-row">
            {(['DAILY', 'PREDEFINED', 'SUBJECT'] as TestType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`ntf-type-btn ${type === t ? 'ntf-type-btn--active' : ''}`}
                onClick={() => setType(t)}
              >
                {t === 'DAILY' ? '📅 Daily' : t === 'PREDEFINED' ? '🗓 Scheduled' : '📚 Subject'}
              </button>
            ))}
          </div>
          <p className="ntf-hint">
            {type === 'DAILY'      ? 'One test per day — set Scheduled Date below.' :
             type === 'PREDEFINED' ? 'Fixed date window — set start and expiry below.' :
             'Always available — filtered by subject in the lobby.'}
          </p>
        </div>

        {/* Time limit */}
        <div className="ntf-row-2">
          <div className="ntf-field">
            <label className="ntf-label" htmlFor="test-time">Time Limit (minutes)</label>
            <input
              id="test-time"
              className="ntf-input"
              type="number"
              min="5"
              max="180"
              step="5"
              placeholder="Leave blank = untimed"
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(e.target.value)}
            />
          </div>

          {/* Paid toggle */}
          <div className="ntf-field">
            <label className="ntf-label">Access</label>
            <div className="ntf-toggle-row">
              <button
                type="button"
                className={`ntf-access-btn ${!isPaid ? 'ntf-access-btn--active' : ''}`}
                onClick={() => setIsPaid(false)}
              >
                ⭐ Free
              </button>
              <button
                type="button"
                className={`ntf-access-btn ${isPaid ? 'ntf-access-btn--active-paid' : ''}`}
                onClick={() => setIsPaid(true)}
              >
                🔒 Premium
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled dates (only for DAILY / PREDEFINED) */}
        {(type === 'DAILY' || type === 'PREDEFINED') && (
          <div className="ntf-row-2">
            <div className="ntf-field">
              <label className="ntf-label" htmlFor="test-sched">
                {type === 'DAILY' ? 'Test Date *' : 'Start Date/Time *'}
              </label>
              <input
                id="test-sched"
                className="ntf-input"
                type={type === 'DAILY' ? 'date' : 'datetime-local'}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            {type === 'PREDEFINED' && (
              <div className="ntf-field">
                <label className="ntf-label" htmlFor="test-expires">End Date/Time</label>
                <input
                  id="test-expires"
                  className="ntf-input"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="ntf-actions">
          <Link href="/admin/tests" className="ntf-cancel">Cancel</Link>
          <button
            type="submit"
            id="admin-create-test-btn"
            className="ntf-submit"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create & Add Questions →'}
          </button>
        </div>
      </form>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .ntf-wrap { max-width: 600px; }

  .ntf-header { margin-bottom: 24px; }
  .ntf-back {
    font-size: 12px;
    color: var(--text-muted);
    text-decoration: none;
    display: inline-block;
    margin-bottom: 8px;
    transition: color 0.15s;
  }
  .ntf-back:hover { color: var(--text-secondary); }
  .ntf-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .ntf-sub   { font-size: 12px; color: var(--text-muted); }

  .ntf-form { display: flex; flex-direction: column; gap: 16px; }
  .ntf-field { display: flex; flex-direction: column; gap: 5px; }
  .ntf-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .ntf-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
  }
  .ntf-input {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }
  .ntf-input:focus { border-color: var(--border-strong); }
  .ntf-input::placeholder { color: var(--text-placeholder); }
  .ntf-textarea { resize: vertical; min-height: 60px; }
  .ntf-select { appearance: none; cursor: pointer; }

  .ntf-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .ntf-row-2 { grid-template-columns: 1fr; } }

  /* Type buttons */
  .ntf-type-row { display: flex; gap: 6px; }
  .ntf-type-btn {
    flex: 1;
    padding: 8px 4px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    text-align: center;
  }
  .ntf-type-btn--active {
    background: var(--bg-active);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  /* Access toggle */
  .ntf-toggle-row { display: flex; gap: 6px; }
  .ntf-access-btn {
    flex: 1;
    padding: 8px 4px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .ntf-access-btn--active      { background: var(--success-bg); border-color: var(--success-border); color: var(--success-text); }
  .ntf-access-btn--active-paid { background: var(--warn-bg);    border-color: var(--warn-border);    color: var(--warn-text);    }

  /* Error */
  .ntf-error {
    padding: 10px 14px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 9px;
    color: var(--danger-text);
    font-size: 12px;
  }

  /* Actions */
  .ntf-actions { display: flex; gap: 10px; padding-top: 4px; }
  .ntf-cancel {
    flex: 0;
    padding: 11px 20px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    display: flex;
    align-items: center;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .ntf-submit {
    flex: 1;
    padding: 11px 20px;
    border-radius: 10px;
    border: none;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .ntf-submit:disabled { opacity: 0.6; cursor: default; }
`;
