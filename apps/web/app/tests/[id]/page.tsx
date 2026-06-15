'use client';
/**
 * /tests/[id] — Test Runner (Phase 5 polish)
 *
 * New in Phase 5:
 *  - Plan gate: FREE user + paid test → upgrade bottom sheet
 *  - Submit confirmation bottom sheet (mobile-safe, 70dvh)
 *  - opt-text line-height: 1.7 (Devanagari matra fix)
 *  - Desktop two-column layout: dot grid sidebar left, question right
 *  - Navbar hidden via body class during test (full-screen UI)
 */
import { useEffect, useCallback, useState } from 'react';
import { useParams, useRouter }             from 'next/navigation';
import Link                                 from 'next/link';
import { v4 as uuid }                       from 'uuid';

import { useTest }          from '@/features/tests/hooks/useTest';
import { useTestSession }   from '@/features/tests/store/test-session';
import { useOnlineStatus }  from '@/hooks/useOnlineStatus';
import {
  saveResult,
  queuePendingAttempt,
} from '@/features/tests/lib/test-results-db';
import { QuestionDotGrid }  from '@/features/tests/components/QuestionDotGrid';
import { CountdownTimer }   from '@/features/tests/components/CountdownTimer';
import apiClient            from '@/lib/api-client';
import useAuthStore         from '@/lib/auth-store';
import type { Question }    from '@ajitsir/shared';

export default function TestRunnerPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const testId   = params.id;
  const isOnline = useOnlineStatus();
  const { user } = useAuthStore();

  const { data: test, isLoading, isError } = useTest(testId);

  const {
    testId: sessionTestId,
    answers,
    currentQ,
    startedAt,
    isSubmitting,
    startSession,
    setAnswer,
    goToQuestion,
    markSubmitting,
    clearSession,
  } = useTestSession();

  // ── Hide Navbar during test (full-screen) ───────────────────────────────────
  useEffect(() => {
    document.body.classList.add('runner-active');
    return () => document.body.classList.remove('runner-active');
  }, []);

  // ── Start/resume session ────────────────────────────────────────────────────
  useEffect(() => {
    if (!test) return;
    if (sessionTestId !== test.id) {
      startSession(test.id);
    }
  }, [test, sessionTestId, startSession]);

  // ── Submit confirmation bottom sheet state ──────────────────────────────────
  const [showSubmitSheet, setShowSubmitSheet] = useState(false);

  const questions: Question[] = test?.questions ?? [];
  const q = questions[currentQ];
  const totalQ        = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered    = totalQ - answeredCount;
  const isLastQ       = currentQ === totalQ - 1;

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !test) return;
    setShowSubmitSheet(false);
    markSubmitting();

    const timeTaken = startedAt
      ? Math.floor((Date.now() - startedAt) / 1000)
      : null;

    if (!isOnline) {
      await queuePendingAttempt({
        id:       uuid(),
        testId:   test.id,
        answers,
        timeTaken,
        queuedAt: Date.now(),
      });
      clearSession();
      router.push(`/tests/${test.id}/result?queued=true`);
      return;
    }

    try {
      const { data } = await apiClient.post(`/api/tests/${test.id}/attempt`, {
        answers,
        timeTaken,
      });
      const result = data.data;
      await saveResult({
        id:        result.id,
        testId:    test.id,
        testTitle: test.title,
        subjectId: test.subjectId,
        result,
      });
      clearSession();
      router.push(`/tests/${test.id}/result?attemptId=${result.id}`);
    } catch {
      await queuePendingAttempt({
        id:       uuid(),
        testId:   test.id,
        answers,
        timeTaken,
        queuedAt: Date.now(),
      });
      clearSession();
      router.push(`/tests/${test.id}/result?queued=true`);
    }
  }, [isSubmitting, test, markSubmitting, startedAt, isOnline, answers, clearSession, router]);

  // ── Timer auto-submit (bypasses confirmation sheet) ─────────────────────────
  const handleTimerExpire = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) return <RunnerSkeleton />;

  // ── Plan gate ───────────────────────────────────────────────────────────────
  if (test && test.isPaid && user?.plan === 'FREE') {
    return (
      <div className="runner-gate">
        <div className="gate-icon">🔒</div>
        <h1 className="gate-title">Premium Test</h1>
        <p className="gate-sub">
          This test is available to Premium subscribers only.
          Upgrade your plan to access all {test._count?.questions ?? ''} questions.
        </p>
        <Link href="/plans" className="gate-upgrade-btn" id="runner-gate-upgrade-btn">
          Upgrade to Premium →
        </Link>
        <Link href="/tests" className="gate-back">← Back to Tests</Link>
        <style>{runnerStyles}</style>
      </div>
    );
  }

  if (isError || !test) {
    return (
      <div className="runner-error">
        <p>Failed to load test. Please check your connection.</p>
        <Link href="/tests" className="runner-error-back">← Back to Tests</Link>
        <style>{runnerStyles}</style>
      </div>
    );
  }
  if (!q) {
    return (
      <div className="runner-error">
        <p>This test has no questions yet.</p>
        <Link href="/tests" className="runner-error-back">← Back to Tests</Link>
        <style>{runnerStyles}</style>
      </div>
    );
  }

  const selectedOption = answers[q.id] ?? null;

  return (
    <div className="runner-wrap">
      {/* ── Fixed header ──────────────────────────────────────────────── */}
      <header className="runner-header">
        <button
          className="runner-back"
          onClick={() => router.push('/tests')}
          aria-label="Back to test lobby"
        >
          ←
        </button>
        <div className="runner-title-group">
          <p className="runner-test-title marathi-text">{test.title}</p>
          <p className="runner-subtitle">Question {currentQ + 1} of {totalQ}</p>
        </div>
        <CountdownTimer
          timeLimitSec={test.timeLimitSec ?? null}
          startedAt={startedAt}
          onExpire={handleTimerExpire}
        />
      </header>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="runner-progress">
        <div className="runner-progress-info">
          <span>{answeredCount} answered</span>
          <span>{unanswered} remaining</span>
        </div>
        <div className="runner-progress-track">
          <div
            className="runner-progress-fill"
            style={{ width: `${totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── Desktop: two-column body / Mobile: stacked ────────────────── */}
      <div className="runner-body">
        {/* Left: dot grid (desktop sidebar / mobile strip) */}
        <div className="runner-dot-panel">
          <QuestionDotGrid
            total={totalQ}
            currentIndex={currentQ}
            answers={answers}
            questionIds={questions.map((q) => q.id)}
            onDotClick={goToQuestion}
          />
        </div>

        {/* Right: question + options */}
        <div className="runner-content">
          <div className="q-card">
            <p className="q-num">QUESTION {currentQ + 1}</p>
            <p className="q-text marathi-text">{q.text}</p>

            <div className="q-options" role="radiogroup" aria-label="Answer options">
              {q.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <button
                    key={opt.id}
                    className={`q-opt ${isSelected ? 'q-opt--selected' : ''}`}
                    onClick={() => setAnswer(q.id, opt.id)}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${opt.id}: ${opt.text}`}
                  >
                    <span className={`opt-label ${isSelected ? 'opt-label--selected' : ''}`}>
                      {opt.id}
                    </span>
                    <span className="opt-text marathi-text">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom nav ────────────────────────────────────────────────── */}
      <nav className="runner-nav">
        <button
          className="btn-nav"
          onClick={() => goToQuestion(currentQ - 1)}
          disabled={currentQ === 0}
          aria-label="Previous question"
        >
          ← Prev
        </button>

        {isLastQ ? (
          <button
            className="btn-nav btn-submit"
            onClick={() => setShowSubmitSheet(true)}
            disabled={isSubmitting}
            id="runner-submit-btn"
            aria-label="Submit test"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Test'}
          </button>
        ) : (
          <button
            className="btn-nav btn-next"
            onClick={() => goToQuestion(currentQ + 1)}
            aria-label="Next question"
          >
            Next →
          </button>
        )}
      </nav>

      {/* ── Submit confirmation bottom sheet ──────────────────────────── */}
      {showSubmitSheet && (
        <>
          <div
            className="submit-overlay"
            onClick={() => setShowSubmitSheet(false)}
            aria-hidden="true"
          />
          <div
            className="submit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-sheet-title"
          >
            <div className="submit-sheet-handle" />
            <h2 className="submit-sheet-title" id="submit-sheet-title">Submit Test?</h2>

            <div className="submit-sheet-stats">
              <div className="ss-stat ss-stat--green">
                <span className="ss-val">{answeredCount}</span>
                <span className="ss-lab">Answered</span>
              </div>
              <div className="ss-stat ss-stat--muted">
                <span className="ss-val">{unanswered}</span>
                <span className="ss-lab">Unanswered</span>
              </div>
              <div className="ss-stat">
                <span className="ss-val">{totalQ}</span>
                <span className="ss-lab">Total</span>
              </div>
            </div>

            {unanswered > 0 && (
              <p className="submit-sheet-warn">
                ⚠️ {unanswered} question{unanswered > 1 ? 's' : ''} left unanswered. They will be counted as wrong.
              </p>
            )}

            <div className="submit-sheet-actions">
              <button
                className="ss-btn-cancel"
                onClick={() => setShowSubmitSheet(false)}
              >
                Continue Test
              </button>
              <button
                className="ss-btn-submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                id="submit-sheet-confirm-btn"
              >
                {isSubmitting ? 'Submitting…' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{runnerStyles}</style>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function RunnerSkeleton() {
  return (
    <div className="runner-wrap">
      <div className="runner-header">
        <div className="runner-skel runner-skel--back" />
        <div style={{ flex: 1 }}>
          <div className="runner-skel runner-skel--title" />
          <div className="runner-skel runner-skel--sub" />
        </div>
        <div className="runner-skel runner-skel--timer" />
      </div>
      <div className="runner-skel runner-skel--progress" style={{ margin: '12px 18px' }} />
      <div className="runner-body">
        <div className="runner-dot-panel">
          <div className="runner-skel runner-skel--grid" />
        </div>
        <div className="runner-content" style={{ padding: '18px' }}>
          <div className="runner-skel runner-skel--qtext" />
          {[1,2,3,4].map(i => <div key={i} className="runner-skel runner-skel--opt" />)}
        </div>
      </div>
      <style>{runnerStyles}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const runnerStyles = `
  /* Hide global navbar/bottomnav during test */
  body.runner-active nav.navbar { display: none !important; }
  body.runner-active .bottom-nav { display: none !important; }

  .runner-wrap {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg-page);
    overflow: hidden;
  }

  /* Header */
  .runner-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
  }
  .runner-back {
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary);
    line-height: 1;
    border: none;
    background: none;
    font-family: inherit;
    padding: 4px;
    flex-shrink: 0;
  }
  .runner-title-group { flex: 1; min-width: 0; }
  .runner-test-title {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }
  .runner-subtitle { font-size: 10px; color: var(--text-muted); margin-top: 1px; }

  /* Progress */
  .runner-progress {
    flex-shrink: 0;
    padding: 8px 14px 6px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
  }
  .runner-progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 5px;
  }
  .runner-progress-track { height: 3px; background: var(--bg-surface-2); border-radius: 99px; overflow: hidden; }
  .runner-progress-fill  { height: 100%; background: var(--text-primary); border-radius: 99px; transition: width 0.3s ease; }

  /* Body: stacked on mobile, side-by-side on desktop */
  .runner-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .runner-body { flex-direction: row; }
  }

  /* Dot panel */
  .runner-dot-panel {
    flex-shrink: 0;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
  }
  @media (min-width: 768px) {
    .runner-dot-panel {
      width: 200px;
      border-bottom: none;
      border-right: 1px solid var(--border);
      overflow-y: auto;
    }
  }
  @media (min-width: 1024px) {
    .runner-dot-panel { width: 240px; }
  }

  /* Override dot-grid inside the sidebar */
  @media (min-width: 768px) {
    .runner-dot-panel .qdot-grid {
      max-height: none;
      overflow-y: visible;
      grid-template-columns: repeat(5, 1fr);
      padding: 14px 12px;
    }
  }

  /* Question content */
  .runner-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 80px;
  }
  .q-card { padding: 16px 18px 12px; max-width: 680px; }
  .q-num {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  .q-text {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.7; /* CRITICAL: Devanagari matras need ≥1.6 */
    color: var(--text-primary);
    margin-bottom: 14px;
  }
  .q-options { display: flex; flex-direction: column; gap: 8px; }
  .q-opt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 52px;           /* full-height tap target per spec */
    padding: 12px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
    font-family: inherit;
    width: 100%;
    user-select: none;          /* prevent text selection on tap */
    -webkit-tap-highlight-color: transparent;
  }
  .q-opt:hover        { background: var(--bg-hover); }
  .q-opt:active       { background: var(--bg-active); transform: scale(0.99); }
  .q-opt--selected    { background: var(--bg-active); border-color: var(--border-strong); }
  .opt-label {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: all 0.12s;
    background: var(--bg-surface-2);
    margin-top: 2px;
  }
  .opt-label--selected { background: var(--accent-bg); color: var(--accent-text); border-color: var(--accent-bg); }
  .opt-text {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.7; /* Devanagari matra fix */
    flex: 1;
  }

  /* Bottom nav */
  .runner-nav {
    flex-shrink: 0;
    display: flex;
    gap: 8px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    z-index: 10;
  }
  .btn-nav {
    flex: 1;
    padding: 13px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.12s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn-nav:disabled { opacity: 0.35; cursor: default; }
  .btn-next   { background: var(--accent-bg); color: var(--accent-text); border-color: var(--accent-bg); }
  .btn-submit { background: #22c55e; color: #0a0a0a; border-color: #22c55e; font-weight: 700; }
  .btn-submit:disabled { opacity: 0.6; }

  /* Submit bottom sheet */
  .submit-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(3px);
    z-index: 40;
    animation: overlay-in 0.2s ease;
  }
  @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }

  .submit-sheet {
    position: fixed;
    inset: auto 0 0 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    border-radius: 20px 20px 0 0;
    max-height: 70dvh;
    overflow-y: auto;
    padding: 8px 18px 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    z-index: 50;
    animation: sheet-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .submit-sheet-handle {
    width: 36px;
    height: 4px;
    border-radius: 99px;
    background: var(--border-strong);
    margin: 4px auto 16px;
  }
  .submit-sheet-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 16px;
    text-align: center;
  }
  .submit-sheet-stats {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }
  .ss-stat {
    flex: 1;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .ss-stat--green { background: var(--success-bg); border-color: var(--success-border); }
  .ss-stat--green .ss-val { color: var(--success-text); }
  .ss-stat--muted .ss-val { color: var(--text-muted); }
  .ss-val { font-size: 22px; font-weight: 800; color: var(--text-primary); }
  .ss-lab { font-size: 10px; color: var(--text-muted); font-weight: 500; }

  .submit-sheet-warn {
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--warn-text);
    margin-bottom: 14px;
    line-height: 1.5;
  }
  .submit-sheet-actions { display: flex; gap: 8px; }
  .ss-btn-cancel {
    flex: 1;
    padding: 13px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .ss-btn-submit {
    flex: 1;
    padding: 13px;
    border-radius: 12px;
    border: none;
    background: #22c55e;
    color: #0a0a0a;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .ss-btn-submit:disabled { opacity: 0.6; cursor: default; }

  /* Plan gate */
  .runner-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: 32px 24px;
    gap: 12px;
    text-align: center;
    background: var(--bg-page);
  }
  .gate-icon  { font-size: 48px; margin-bottom: 8px; }
  .gate-title { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .gate-sub   { font-size: 13px; color: var(--text-secondary); max-width: 300px; line-height: 1.6; }
  .gate-upgrade-btn {
    padding: 13px 28px;
    background: var(--accent-bg);
    color: var(--accent-text);
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    margin-top: 8px;
    transition: opacity 0.15s;
  }
  .gate-upgrade-btn:hover { opacity: 0.88; }
  .gate-back {
    font-size: 12px;
    color: var(--text-muted);
    text-decoration: none;
    margin-top: 4px;
  }

  /* Error */
  .runner-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 12px;
    color: var(--text-secondary);
    font-size: 14px;
    padding: 24px;
    text-align: center;
  }
  .runner-error-back { color: var(--text-muted); font-size: 13px; text-decoration: underline; }

  /* Skeleton helpers */
  .runner-skel {
    background: var(--bg-surface-2);
    border-radius: 8px;
    animation: runner-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes runner-shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
  .runner-skel--back     { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; }
  .runner-skel--title    { width: 160px; height: 14px; margin-bottom: 6px; }
  .runner-skel--sub      { width: 80px;  height: 10px; }
  .runner-skel--timer    { width: 70px;  height: 30px; border-radius: 99px; flex-shrink: 0; }
  .runner-skel--progress { height: 32px; border-radius: 8px; }
  .runner-skel--grid     { height: 100px; border-radius: 12px; margin: 12px; }
  .runner-skel--qtext    { height: 72px; border-radius: 10px; margin-bottom: 14px; }
  .runner-skel--opt      { height: 52px; border-radius: 12px; margin-bottom: 8px; }
`;
