'use client';
/**
 * /tests/[id] — Test Runner
 *
 * Architecture:
 *  - Questions loaded via useTest() (React Query, NOT persisted to localStorage)
 *  - Session state (answers, currentQ, startedAt) from useTestSession() (Zustand + localStorage)
 *  - On submit: POST /api/tests/:id/attempt → save to IDB → navigate to result
 *  - On offline: queue to IDB pending-attempts, show success screen (will sync on reconnect)
 *  - Double-submit guard: markSubmitting() called BEFORE the POST
 *  - Timer auto-submits when secsLeft reaches 0
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

  // ── Start/resume session ────────────────────────────────────────────────────
  useEffect(() => {
    if (!test) return;
    // Resume if same test, start fresh otherwise
    if (sessionTestId !== test.id) {
      startSession(test.id);
    }
  }, [test, sessionTestId, startSession]);

  const questions: Question[] = test?.questions ?? [];
  const q = questions[currentQ];
  const totalQ  = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLastQ = currentQ === totalQ - 1;

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !test) return;
    markSubmitting();

    const timeTaken = startedAt
      ? Math.floor((Date.now() - startedAt) / 1000)
      : null;

    if (!isOnline) {
      // Queue for later flush when connectivity returns
      await queuePendingAttempt({
        id:        uuid(),
        testId:    test.id,
        answers,
        timeTaken,
        queuedAt:  Date.now(),
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

      // Save to IDB for instant result page load and offline access
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
      // Network error after optimistic online check — queue
      await queuePendingAttempt({
        id:        uuid(),
        testId:    test.id,
        answers,
        timeTaken,
        queuedAt:  Date.now(),
      });
      clearSession();
      router.push(`/tests/${test.id}/result?queued=true`);
    }
  }, [isSubmitting, test, markSubmitting, startedAt, isOnline, answers, clearSession, router]);

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) return <RunnerSkeleton />;
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
          onExpire={handleSubmit}
        />
      </header>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="runner-progress">
        <div className="runner-progress-info">
          <span>{answeredCount} answered</span>
          <span>{totalQ - answeredCount} remaining</span>
        </div>
        <div className="runner-progress-track">
          <div
            className="runner-progress-fill"
            style={{ width: `${totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── Question dot grid ─────────────────────────────────────────── */}
      <QuestionDotGrid
        total={totalQ}
        currentIndex={currentQ}
        answers={answers}
        questionIds={questions.map((q) => q.id)}
        onDotClick={goToQuestion}
      />

      {/* ── Scrollable question area ───────────────────────────────────── */}
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
            onClick={handleSubmit}
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
      <div className="runner-skel runner-skel--grid" style={{ margin: '0 12px 12px' }} />
      <div style={{ padding: '18px' }}>
        <div className="runner-skel runner-skel--qtext" />
        {[1,2,3,4].map(i => <div key={i} className="runner-skel runner-skel--opt" />)}
      </div>
      <style>{runnerStyles}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const runnerStyles = `
  .runner-wrap {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-page);
    max-width: 720px;
    margin: 0 auto;
  }

  /* Header */
  .runner-header {
    position: sticky;
    top: 64px; /* below Navbar */
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
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
    padding: 10px 16px 8px;
    background: var(--bg-surface);
  }
  .runner-progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .runner-progress-track {
    height: 3px;
    background: var(--bg-surface-2);
    border-radius: 99px;
    overflow: hidden;
  }
  .runner-progress-fill {
    height: 100%;
    background: var(--text-primary);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  /* Question area */
  .runner-content { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .q-card { padding: 18px 18px 12px; }
  .q-num {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .q-text {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.6;
    color: var(--text-primary);
    margin-bottom: 16px;
  }
  .q-options { display: flex; flex-direction: column; gap: 8px; }
  .q-opt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    font-family: inherit;
    width: 100%;
  }
  .q-opt:hover       { background: var(--bg-hover); }
  .q-opt:active      { background: var(--bg-active); }
  .q-opt--selected   { background: var(--bg-active); border-color: var(--border-strong); }
  .opt-label {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: all 0.15s;
    background: var(--bg-surface-2);
  }
  .opt-label--selected {
    background: var(--accent-bg);
    color: var(--accent-text);
    border-color: var(--accent-bg);
  }
  .opt-text { font-size: 13px; color: var(--text-primary); line-height: 1.5; flex: 1; padding-top: 1px; }

  /* Bottom nav */
  .runner-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    gap: 8px;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(12px);
    z-index: 10;
    max-width: 720px;
    margin: 0 auto;
  }
  .btn-nav {
    flex: 1;
    padding: 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn-nav:disabled { opacity: 0.35; cursor: default; }
  .btn-next   { background: var(--accent-bg); color: var(--accent-text); border-color: var(--accent-bg); }
  .btn-submit { background: var(--success-text); color: #0a0a0a; border-color: var(--success-text); }
  .btn-submit:disabled { opacity: 0.6; }

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
  .runner-skel--back   { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; }
  .runner-skel--title  { width: 160px; height: 14px; margin-bottom: 6px; }
  .runner-skel--sub    { width: 80px;  height: 10px; }
  .runner-skel--timer  { width: 70px;  height: 30px; border-radius: 99px; flex-shrink: 0; }
  .runner-skel--progress { height: 32px; border-radius: 8px; }
  .runner-skel--grid   { height: 100px; border-radius: 12px; }
  .runner-skel--qtext  { height: 72px; border-radius: 10px; margin-bottom: 14px; }
  .runner-skel--opt    { height: 46px; border-radius: 12px; margin-bottom: 8px; }
`;
