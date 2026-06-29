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

  // Import modal
  const [importOpen,    setImportOpen]    = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<{ count: number } | null>(null);

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

  // ── Bulk import ───────────────────────────────────────────────────────────
  const handleImport = useCallback(async (questions: unknown[]) => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await apiClient.post(`/api/tests/${testId}/questions/bulk`, { questions });
      setImportResult({ count: data.data.count });
      // Refresh question list
      const qRes = await apiClient.get(`/api/tests/${testId}/questions`);
      const qs = (qRes.data.data as AdminQuestion[]).sort((a, b) => a.order - b.order);
      setQuestions(qs);
      setForm((f) => ({ ...f, order: qs.length }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      throw new Error(msg ?? 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }, [testId]);

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
              + Add
            </button>
            <button className="qe-btn-import-mobile" onClick={() => { setImportOpen(true); setImportResult(null); }}>
              ⬆ JSON
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

        {/* Add question + Import buttons (desktop only) */}
        <div className="qe-bottom-btns">
          <button className="qe-btn-add" onClick={startNew} id="qe-add-q-btn">
            + Add Question
          </button>
          <button
            className="qe-btn-import"
            onClick={() => { setImportOpen(true); setImportResult(null); }}
            id="qe-import-btn"
          >
            ⬆ Import JSON
          </button>
        </div>
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

      {/* ── Import modal ─────────────────────────────────────────── */}
      {importOpen && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setImportOpen(false)}
          importing={importing}
          lastResult={importResult}
        />
      )}
    </div>
  );
}

// ── Import Modal ─────────────────────────────────────────────────────────────

interface ParsedQuestion {
  raw:           unknown;
  text?:         string;
  correctOption?: string;
  errors:        string[];
}

function validateQuestion(raw: unknown, index: number): ParsedQuestion {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { raw, errors: [`Question #${index + 1} is not a valid object`] };
  }

  const q = raw as Record<string, unknown>;

  // text
  if (typeof q.text !== 'string' || q.text.trim().length < 5) {
    errors.push('text must be a string with ≥ 5 characters');
  }

  // options
  if (!Array.isArray(q.options)) {
    errors.push('options must be an array');
  } else if (q.options.length !== 4) {
    errors.push(`options must have exactly 4 items (found ${q.options.length})`);
  } else {
    const ids = (q.options as Record<string, unknown>[]).map((o) => o.id);
    if (!['A','B','C','D'].every((x) => ids.includes(x))) {
      errors.push('options must have id A, B, C, and D');
    }
    (q.options as Record<string, unknown>[]).forEach((o, i) => {
      if (typeof o.text !== 'string' || !(o.text as string).trim()) {
        errors.push(`option ${i + 1} text is empty`);
      }
    });
  }

  // correctOption
  if (!['A','B','C','D'].includes(q.correctOption as string)) {
    errors.push('correctOption must be A, B, C, or D');
  }

  // explanation (optional)
  if (q.explanation !== undefined && typeof q.explanation !== 'string') {
    errors.push('explanation must be a string if provided');
  }
  if (typeof q.explanation === 'string' && q.explanation.length > 2000) {
    errors.push('explanation must be ≤ 2000 characters');
  }

  return {
    raw,
    text:          typeof q.text === 'string' ? q.text : undefined,
    correctOption: typeof q.correctOption === 'string' ? q.correctOption : undefined,
    errors,
  };
}

interface ImportModalProps {
  onImport:    (questions: unknown[]) => Promise<void>;
  onClose:     () => void;
  importing:   boolean;
  lastResult:  { count: number } | null;
}

function ImportModal({ onImport, onClose, importing, lastResult }: ImportModalProps) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]  = useState(false);
  const [parseErr, setParseErr]  = useState<string | null>(null);
  const [rows,     setRows]      = useState<ParsedQuestion[] | null>(null);
  const [apiErr,   setApiErr]    = useState<string | null>(null);

  const errorCount = rows ? rows.filter((r) => r.errors.length > 0).length : 0;
  const allValid   = rows !== null && rows.length > 0 && errorCount === 0;

  // ── Parse file ─────────────────────────────────────────────────────────────
  const parseFile = (file: File) => {
    setParseErr(null);
    setRows(null);
    setApiErr(null);

    if (!file.name.endsWith('.json')) {
      setParseErr('Only .json files are accepted.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);

        // Layer 2 — shape checks
        if (!Array.isArray(parsed)) {
          setParseErr('File must be a JSON array [ … ] at the top level.');
          return;
        }
        if (parsed.length === 0) {
          setParseErr('The array is empty — there are no questions to import.');
          return;
        }
        if (parsed.length > 200) {
          setParseErr(`Too many questions: ${parsed.length} found. Maximum is 200 per import.`);
          return;
        }

        // Layer 3 — per-question validation
        setRows(parsed.map((item, i) => validateQuestion(item, i)));
      } catch {
        // Layer 1 — invalid JSON syntax
        setParseErr('Could not parse this file. Make sure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImportClick = async () => {
    if (!rows || !allValid) return;
    setApiErr(null);
    try {
      await onImport(rows.map((r) => r.raw));
    } catch (err: unknown) {
      setApiErr((err as Error).message);
    }
  };

  return (
    <div className="im-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="im-panel">
        {/* Header */}
        <div className="im-header">
          <h2 className="im-title">⬆ Import Questions from JSON</h2>
          <button className="im-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Success banner */}
        {lastResult && (
          <div className="im-banner im-banner--ok">
            ✅ {lastResult.count} question{lastResult.count !== 1 ? 's' : ''} imported successfully!
            <button className="im-banner-close" onClick={onClose}>Done</button>
          </div>
        )}

        {/* Drop zone */}
        {!lastResult && (
          <>
            <div
              className={`im-drop ${dragging ? 'im-drop--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            >
              <span className="im-drop-icon">📂</span>
              <span className="im-drop-label">Drop your <code>.json</code> file here, or click to browse</span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>

            {/* Layer 1 & 2 error banner */}
            {parseErr && (
              <div className="im-banner im-banner--err">
                ❌ {parseErr}
              </div>
            )}

            {/* Layer 4 API error banner */}
            {apiErr && (
              <div className="im-banner im-banner--err">
                ❌ {apiErr}
              </div>
            )}

            {/* Layer 3 — preview table */}
            {rows && rows.length > 0 && (
              <>
                {errorCount > 0 && (
                  <div className="im-banner im-banner--warn">
                    ⚠️ {errorCount} question{errorCount !== 1 ? 's have' : ' has'} errors.
                    Fix the file and re-upload.
                  </div>
                )}

                <div className="im-table-wrap">
                  <table className="im-table">
                    <thead>
                      <tr>
                        <th className="im-th im-th--num">#</th>
                        <th className="im-th">Question</th>
                        <th className="im-th im-th--opt">Correct</th>
                        <th className="im-th">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={row.errors.length > 0 ? 'im-tr--err' : 'im-tr--ok'}>
                          <td className="im-td im-td--num">{i + 1}</td>
                          <td className="im-td im-td--text marathi-text">
                            {row.text
                              ? row.text.length > 80 ? row.text.slice(0, 80) + '…' : row.text
                              : <span className="im-missing">—</span>}
                          </td>
                          <td className="im-td im-td--opt">
                            {row.correctOption
                              ? <span className="im-correct-chip">{row.correctOption}</span>
                              : <span className="im-missing">—</span>}
                          </td>
                          <td className="im-td im-td--issues">
                            {row.errors.length === 0 ? (
                              <span className="im-ok">✅</span>
                            ) : (
                              <ul className="im-err-list">
                                {row.errors.map((e, ei) => (
                                  <li key={ei} className="im-err-item">❌ {e}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="im-footer">
                  <button
                    className="im-btn-import"
                    onClick={handleImportClick}
                    disabled={!allValid || importing}
                    id="im-confirm-btn"
                  >
                    {importing
                      ? 'Importing…'
                      : allValid
                        ? `Import ${rows.length} Question${rows.length !== 1 ? 's' : ''}`
                        : `Fix ${errorCount} Error${errorCount !== 1 ? 's' : ''} First`}
                  </button>
                  <button className="im-btn-cancel" onClick={onClose}>Cancel</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
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
    .qe-bottom-btns { display: none; }
    .qe-btn-add-mobile, .qe-btn-import-mobile {
      display: block;
      padding: 7px 10px;
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

  /* ── Desktop bottom buttons ── */
  .qe-bottom-btns {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    flex-shrink: 0;
  }
  .qe-btn-import {
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
    text-align: center;
  }
  .qe-btn-import:hover { border-color: var(--accent-bg); color: var(--accent-text); }

  /* Mobile import button (hidden on desktop) */
  .qe-btn-import-mobile { display: none; }

  /* ─── Import Modal ────────────────────────────────────────────────────── */
  .im-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
  }
  .im-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  }
  .im-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .im-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .im-close {
    font-size: 20px;
    line-height: 1;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
    transition: color 0.15s;
  }
  .im-close:hover { color: var(--text-primary); }

  /* Drop zone */
  .im-drop {
    margin: 16px 20px 0;
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .im-drop:hover, .im-drop--over {
    border-color: var(--accent-bg);
    background: color-mix(in srgb, var(--accent-bg) 6%, transparent);
  }
  .im-drop-icon  { font-size: 28px; }
  .im-drop-label { font-size: 12px; color: var(--text-secondary); text-align: center; }
  .im-drop-label code { font-size: 11px; background: var(--bg-surface-2); padding: 1px 5px; border-radius: 4px; }

  /* Banners */
  .im-banner {
    margin: 10px 20px 0;
    padding: 9px 14px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .im-banner--ok   { background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success-text); }
  .im-banner--err  { background: var(--danger-bg);  border: 1px solid var(--danger-border);  color: var(--danger-text);  }
  .im-banner--warn { background: var(--warn-bg);    border: 1px solid var(--warn-border);    color: var(--warn-text);    }
  .im-banner-close {
    margin-left: auto;
    padding: 5px 12px;
    border-radius: 7px;
    border: 1px solid var(--success-border);
    background: var(--success-text);
    color: #0a0a0a;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }

  /* Preview table */
  .im-table-wrap {
    flex: 1;
    overflow-y: auto;
    margin: 10px 20px 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    min-height: 0;
  }
  .im-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .im-th {
    padding: 8px 10px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--bg-surface-2);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
  }
  .im-th--num { width: 36px; }
  .im-th--opt { width: 60px; }
  .im-td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    color: var(--text-secondary);
  }
  .im-td--num  { color: var(--text-muted); font-size: 11px; font-weight: 600; text-align: center; }
  .im-td--text { max-width: 240px; line-height: 1.4; }
  .im-td--opt  { text-align: center; }
  .im-td--issues { min-width: 180px; }
  .im-tr--ok  td { background: transparent; }
  .im-tr--err td { background: color-mix(in srgb, var(--danger-bg) 40%, transparent); }
  .im-missing  { color: var(--text-muted); font-style: italic; }
  .im-ok       { color: var(--success-text); font-size: 13px; }
  .im-correct-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px; height: 22px;
    border-radius: 5px;
    background: var(--success-bg);
    color: var(--success-text);
    border: 1px solid var(--success-border);
    font-size: 10px;
    font-weight: 800;
  }
  .im-err-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .im-err-item { font-size: 11px; color: var(--danger-text); }

  /* Footer */
  .im-footer {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .im-btn-import {
    flex: 1;
    padding: 11px;
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
  .im-btn-import:disabled { opacity: 0.5; cursor: not-allowed; }
  .im-btn-cancel {
    padding: 11px 20px;
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
`;
