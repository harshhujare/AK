'use client';
/**
 * /admin/tests/[id]/questions — Two-panel Question Editor
 *
 * Layout:
 *  - Desktop (≥1024px): LEFT panel (test info + question list) | RIGHT panel (question form)
 *  - Tablet (768–1023px): same, but left panel narrows to 280px
 *  - Mobile (<768px): stacked — question list on top, form below, hidden until "Add/Edit" tapped
 *
 * Data:
 *  - Test metadata:    GET /api/tests/:id/questions (admin — includes correctOption)
 *  - Add question:     POST /api/tests/:id/questions
 *  - Edit question:    PUT  /api/tests/:testId/questions/:qId
 *  - Delete question:  DELETE /api/tests/:testId/questions/:qId
 *  - Publish toggle:   PATCH /api/tests/:id { isPublished: bool }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams }    from 'next/navigation';
import Link             from 'next/link';
import apiClient        from '@/lib/api-client';
import type { Test }    from '@ajitsir/shared';

// ── Local types (admin includes correctOption + explanation) ──────────────────

interface AdminQuestion {
  id:            string;
  testId:        string;
  text:          string;
  options:       { id: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation:   string | null;
  order:         number;
}

type OptionId = 'A' | 'B' | 'C' | 'D';

// ── Empty form factory ────────────────────────────────────────────────────────

function emptyForm() {
  return {
    text:          '',
    optA:          '',
    optB:          '',
    optC:          '',
    optD:          '',
    correctOption: 'A' as OptionId,
    explanation:   '',
    order:         0,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QuestionEditorPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [test,       setTest]       = useState<Test | null>(null);
  const [questions,  setQuestions]  = useState<AdminQuestion[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Which question is being edited (null = new question form)
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form,       setForm]       = useState(emptyForm());
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [toggling,   setToggling]   = useState(false);

  // Mobile: show form panel
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // ── Load test + questions ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [testRes, qRes] = await Promise.all([
        apiClient.get(`/api/tests/${testId}`),
        apiClient.get(`/api/tests/${testId}/questions`),
      ]);
      setTest(testRes.data.data as Test);
      const qs = (qRes.data.data as AdminQuestion[])
        .sort((a, b) => a.order - b.order);
      setQuestions(qs);
      // Pre-fill order for new question
      setForm((f) => ({ ...f, order: qs.length }));
    } catch {
      setError('Failed to load test data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  // ── Open edit form for a question ─────────────────────────────────────────
  const startEdit = (q: AdminQuestion) => {
    setEditingId(q.id);
    setForm({
      text:          q.text,
      optA:          q.options.find((o) => o.id === 'A')?.text ?? '',
      optB:          q.options.find((o) => o.id === 'B')?.text ?? '',
      optC:          q.options.find((o) => o.id === 'C')?.text ?? '',
      optD:          q.options.find((o) => o.id === 'D')?.text ?? '',
      correctOption: q.correctOption,
      explanation:   q.explanation ?? '',
      order:         q.order,
    });
    setFormError(null);
    setMobileFormOpen(true);
    // Scroll form into view on mobile
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const startNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), order: questions.length });
    setFormError(null);
    setMobileFormOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // ── Save (add or edit) ────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.text.trim())  { setFormError('Question text is required.'); return; }
    if (!form.optA.trim() || !form.optB.trim() || !form.optC.trim() || !form.optD.trim()) {
      setFormError('All four options (A, B, C, D) are required.'); return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      text:          form.text.trim(),
      options: [
        { id: 'A', text: form.optA.trim() },
        { id: 'B', text: form.optB.trim() },
        { id: 'C', text: form.optC.trim() },
        { id: 'D', text: form.optD.trim() },
      ],
      correctOption: form.correctOption,
      explanation:   form.explanation.trim() || undefined,
      order:         form.order,
    };

    try {
      if (editingId) {
        // Edit existing
        const { data } = await apiClient.put(
          `/api/tests/${testId}/questions/${editingId}`, payload
        );
        setQuestions((prev) =>
          prev.map((q) => q.id === editingId ? data.data : q)
            .sort((a, b) => a.order - b.order)
        );
        setEditingId(null);
      } else {
        // Add new
        const { data } = await apiClient.post(`/api/tests/${testId}/questions`, payload);
        setQuestions((prev) => [...prev, data.data].sort((a, b) => a.order - b.order));
        setForm({ ...emptyForm(), order: questions.length + 1 });
      }
      setMobileFormOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (q: AdminQuestion) => {
    if (!confirm(`Delete question ${q.order + 1}? This cannot be undone.`)) return;
    setDeleting(q.id);
    try {
      await apiClient.delete(`/api/tests/${testId}/questions/${q.id}`);
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
      if (editingId === q.id) { setEditingId(null); setForm(emptyForm()); }
    } catch {
      alert('Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Publish toggle ────────────────────────────────────────────────────────
  const handleTogglePublish = async () => {
    if (!test || toggling) return;
    setToggling(true);
    try {
      await apiClient.patch(`/api/tests/${testId}`, { isPublished: !test.isPublished });
      setTest((t) => t ? { ...t, isPublished: !t.isPublished } : t);
    } catch {
      alert('Failed to update publish status.');
    } finally {
      setToggling(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <EditorSkeleton />;
  if (error)   return (
    <div className="qe-error">
      <p>{error}</p>
      <button onClick={load} className="qe-retry">Retry</button>
    </div>
  );

  const isPublished = test?.isPublished ?? false;

  return (
    <div className="qe-shell">
      {/* ── Left panel — test info + question list ──────────────────── */}
      <aside className="qe-left">
        <div className="qe-left-header">
          <Link href="/admin/tests" className="qe-back">← Tests</Link>
          <div className="qe-test-meta">
            <p className="qe-test-title marathi-text">{test?.title}</p>
            <div className="qe-test-badges">
              <span className="qe-badge">{questions.length} Qs</span>
              {test?.timeLimitSec && (
                <span className="qe-badge">{Math.round(test.timeLimitSec / 60)} min</span>
              )}
              <span className={`qe-publish-chip ${isPublished ? 'qe-publish-chip--live' : ''}`}>
                {isPublished ? '🟢 Live' : '⚪ Draft'}
              </span>
            </div>
          </div>

          <div className="qe-left-actions">
            <button
              className={`qe-toggle-publish ${isPublished ? 'qe-toggle-publish--live' : ''}`}
              onClick={handleTogglePublish}
              disabled={toggling}
              id="qe-publish-btn"
            >
              {toggling ? '…' : isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button className="qe-btn-add-mobile" onClick={startNew}>
              + Add Question
            </button>
          </div>
        </div>

        {/* Question list */}
        <div className="qe-qlist">
          {questions.length === 0 ? (
            <div className="qe-qlist-empty">
              <p>No questions yet.</p>
              <button onClick={startNew} className="qe-qlist-empty-btn">Add First Question</button>
            </div>
          ) : (
            questions.map((q, i) => (
              <div
                key={q.id}
                className={`qe-qrow ${editingId === q.id ? 'qe-qrow--active' : ''}`}
                onClick={() => startEdit(q)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && startEdit(q)}
              >
                <span className="qe-qrow-num">{i + 1}</span>
                <span className="qe-qrow-text marathi-text">{q.text}</span>
                <span className={`qe-correct-dot qe-correct-dot--${q.correctOption.toLowerCase()}`}>
                  {q.correctOption}
                </span>
                <button
                  className="qe-del-btn"
                  onClick={(e) => { e.stopPropagation(); handleDelete(q); }}
                  disabled={deleting === q.id}
                  aria-label={`Delete question ${i + 1}`}
                >
                  {deleting === q.id ? '…' : '×'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add question button (desktop only) */}
        <button className="qe-btn-add" onClick={startNew} id="qe-add-q-btn">
          + Add Question
        </button>
      </aside>

      {/* ── Right panel — question form ─────────────────────────────── */}
      <div className={`qe-right ${mobileFormOpen ? 'qe-right--open' : ''}`} ref={formRef}>
        <div className="qe-form-header">
          <h2 className="qe-form-title">
            {editingId ? `Edit Question ${(questions.findIndex(q => q.id === editingId) + 1)}` : 'New Question'}
          </h2>
          <button
            className="qe-form-close"
            onClick={() => setMobileFormOpen(false)}
            aria-label="Close form"
          >×</button>
        </div>

        <form onSubmit={handleSave} className="qe-form" noValidate>
          {formError && <div className="qe-form-error">{formError}</div>}

          {/* Question text */}
          <div className="qe-ff">
            <label className="qe-ff-label" htmlFor="q-text">Question *</label>
            <textarea
              id="q-text"
              className="qe-ff-input qe-ff-textarea marathi-text"
              rows={3}
              placeholder="प्रश्न येथे लिहा…"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              maxLength={2000}
              required
            />
          </div>

          {/* Options */}
          <div className="qe-options-grid">
            {(['A', 'B', 'C', 'D'] as OptionId[]).map((id) => {
              const fieldKey = `opt${id}` as 'optA' | 'optB' | 'optC' | 'optD';
              const isCorrect = form.correctOption === id;
              return (
                <div
                  key={id}
                  className={`qe-opt-row ${isCorrect ? 'qe-opt-row--correct' : ''}`}
                >
                  <button
                    type="button"
                    className={`qe-opt-label ${isCorrect ? 'qe-opt-label--correct' : ''}`}
                    onClick={() => setForm({ ...form, correctOption: id })}
                    title={`Mark ${id} as correct`}
                    aria-pressed={isCorrect}
                  >
                    {id}
                  </button>
                  <input
                    id={`q-opt-${id}`}
                    className="qe-ff-input qe-opt-input marathi-text"
                    type="text"
                    placeholder={`Option ${id}…`}
                    value={form[fieldKey]}
                    onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
                    maxLength={500}
                    required
                  />
                </div>
              );
            })}
          </div>
          <p className="qe-opt-hint">Click an option letter to mark it as the correct answer.</p>

          {/* Explanation */}
          <div className="qe-ff">
            <label className="qe-ff-label" htmlFor="q-explanation">
              Explanation <span className="qe-optional">(shown after student submits)</span>
            </label>
            <textarea
              id="q-explanation"
              className="qe-ff-input qe-ff-textarea marathi-text"
              rows={2}
              placeholder="Optional explanation in Marathi or English…"
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              maxLength={2000}
            />
          </div>

          {/* Order */}
          <div className="qe-ff">
            <label className="qe-ff-label" htmlFor="q-order">Order (0-based position)</label>
            <input
              id="q-order"
              className="qe-ff-input"
              type="number"
              min={0}
              value={form.order}
              onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          {/* Form actions */}
          <div className="qe-form-actions">
            {editingId && (
              <button
                type="button"
                className="qe-form-cancel"
                onClick={() => { setEditingId(null); setForm({ ...emptyForm(), order: questions.length }); setMobileFormOpen(false); }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="qe-form-submit"
              id="qe-save-q-btn"
              disabled={saving}
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Add Question'}
            </button>
          </div>
        </form>
      </div>

      <style>{styles}</style>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function EditorSkeleton() {
  return (
    <div className="qe-shell">
      <aside className="qe-left">
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 48, borderRadius: 10, background: 'var(--bg-surface-2)', animation: 'qe-shimmer 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      </aside>
      <div className="qe-right qe-right--open">
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: i === 1 ? 80 : 44, borderRadius: 10, background: 'var(--bg-surface-2)', animation: 'qe-shimmer 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes qe-shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  /* Two-panel shell */
  .qe-shell {
    display: flex;
    gap: 0;
    min-height: calc(100vh - 4rem);
    /* Bleed to full width inside admin-content */
    margin: -2rem;
  }

  /* ── Left panel ── */
  .qe-left {
    width: 320px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    position: sticky;
    top: 0;
    max-height: 100vh;
  }

  .qe-left-header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .qe-back {
    font-size: 11px;
    color: var(--text-muted);
    text-decoration: none;
  }
  .qe-back:hover { color: var(--text-secondary); }

  .qe-test-meta { display: flex; flex-direction: column; gap: 6px; }
  .qe-test-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
  }
  .qe-test-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .qe-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    background: var(--bg-surface-2);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .qe-publish-chip {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 5px;
    background: var(--bg-surface-2);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .qe-publish-chip--live {
    background: var(--success-bg);
    color: var(--success-text);
    border-color: var(--success-border);
  }

  .qe-left-actions { display: flex; gap: 6px; }
  .qe-toggle-publish {
    flex: 1;
    padding: 7px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .qe-toggle-publish--live {
    background: var(--success-bg);
    border-color: var(--success-border);
    color: var(--success-text);
  }

  /* Question list */
  .qe-qlist { flex: 1; overflow-y: auto; padding: 8px; }
  .qe-qlist-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }
  .qe-qlist-empty-btn {
    padding: 7px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .qe-qrow {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.12s;
    border: 1px solid transparent;
    margin-bottom: 3px;
  }
  .qe-qrow:hover       { background: var(--bg-hover); }
  .qe-qrow--active     { background: var(--bg-active); border-color: var(--border-strong); }
  .qe-qrow-num {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .qe-qrow-text {
    flex: 1;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .qe-correct-dot {
    font-size: 9px;
    font-weight: 800;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--success-bg);
    color: var(--success-text);
    border: 1px solid var(--success-border);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .qe-del-btn {
    font-size: 14px;
    line-height: 1;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.12s;
    padding: 0;
    margin-top: 1px;
    font-family: inherit;
  }
  .qe-del-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

  .qe-btn-add {
    margin: 8px;
    padding: 10px;
    border-radius: 10px;
    border: 1px dashed var(--border);
    background: none;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .qe-btn-add:hover { border-color: var(--border-strong); color: var(--text-secondary); }

  /* Mobile "add" button inside header — only visible on mobile */
  .qe-btn-add-mobile { display: none; }

  /* ── Right panel ── */
  .qe-right {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-page);
    min-width: 0;
  }

  .qe-form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-page);
    z-index: 5;
  }
  .qe-form-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .qe-form-close {
    font-size: 18px;
    line-height: 1;
    color: var(--text-muted);
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px;
    display: none; /* shown only on mobile */
    font-family: inherit;
  }

  .qe-form { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

  /* Form fields */
  .qe-ff { display: flex; flex-direction: column; gap: 5px; }
  .qe-ff-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .qe-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--text-muted); }
  .qe-ff-input {
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }
  .qe-ff-input:focus { border-color: var(--border-strong); }
  .qe-ff-input::placeholder { color: var(--text-placeholder, var(--text-muted)); }
  .qe-ff-textarea { resize: vertical; min-height: 64px; }

  /* Options grid */
  .qe-options-grid { display: flex; flex-direction: column; gap: 6px; }
  .qe-opt-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid transparent;
    transition: border-color 0.15s;
  }
  .qe-opt-row--correct { border-color: var(--success-border); background: var(--success-bg); }
  .qe-opt-label {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
    font-family: inherit;
  }
  .qe-opt-label--correct {
    background: var(--success-text);
    color: #0a0a0a;
    border-color: var(--success-text);
  }
  .qe-opt-input { flex: 1; }
  .qe-opt-hint { font-size: 10px; color: var(--text-muted); margin-top: -6px; }

  /* Form error */
  .qe-form-error {
    padding: 9px 12px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 9px;
    color: var(--danger-text);
    font-size: 12px;
  }

  /* Form actions */
  .qe-form-actions { display: flex; gap: 8px; padding-top: 4px; padding-bottom: 20px; }
  .qe-form-cancel {
    padding: 10px 18px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .qe-form-submit {
    flex: 1;
    padding: 10px 18px;
    border-radius: 9px;
    border: none;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .qe-form-submit:disabled { opacity: 0.6; cursor: default; }

  /* Error page */
  .qe-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px;
    color: var(--text-secondary);
    font-size: 14px;
  }
  .qe-retry {
    padding: 8px 20px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }

  /* ── Tablet ── */
  @media (max-width: 1023px) {
    .qe-left { width: 260px; }
  }

  /* ── Mobile (stacked) ── */
  @media (max-width: 767px) {
    .qe-shell { flex-direction: column; margin: -1rem; }
    .qe-left {
      width: 100%;
      position: static;
      max-height: none;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .qe-btn-add { display: none; }
    .qe-btn-add-mobile {
      display: block;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-active);
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .qe-right {
      display: none; /* hidden on mobile until mobileFormOpen */
    }
    .qe-right--open {
      display: block;
    }
    .qe-form-close { display: flex; }
  }
`;
