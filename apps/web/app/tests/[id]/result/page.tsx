'use client';
/**
 * /tests/[id]/result — Result Page
 *
 * Data loading strategy (IDB-first, server fallback):
 *  1. If ?queued=true: show offline queued screen (no score yet)
 *  2. If ?attemptId=xxx: read from IDB (instant, offline-capable)
 *     → If IDB miss (new device): fetch from server GET /:id/attempt/:attemptId
 *  3. Percentile: GET /api/tests/:id/percentile (shown only when ≥10 attempts)
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { ScoreRing, gradeInfo } from '@/features/tests/components/ScoreRing';
import { BreakdownItem }        from '@/features/tests/components/BreakdownItem';
import { getResultsByTest }     from '@/features/tests/lib/test-results-db';
import { useAttemptResult }     from '@/features/tests/hooks/useTestAttempts';
import apiClient                from '@/lib/api-client';
import type { AttemptResult, AttemptBreakdownItem } from '@ajitsir/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(secs: number | null): string {
  if (secs === null) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const params       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const testId    = params.id;
  const attemptId = searchParams.get('attemptId');
  const isQueued  = searchParams.get('queued') === 'true';
  const isError   = searchParams.get('error') === 'submit_failed';

  // ── Submit error screen (API returned 4xx/5xx while device was online) ───────
  if (isError) {
    return (
      <div className="result-page">
        <div className="result-queued">
          <div className="queued-icon">⚠️</div>
          <h1 className="queued-title">Submission Failed</h1>
          <p className="queued-sub">
            Your answers could not be submitted. This may be because the test has
            ended or your subscription has expired. Please go back and try again.
          </p>
          <Link href="/tests" className="btn-result-home">Back to Tests</Link>
        </div>
        <style>{resultStyles}</style>
      </div>
    );
  }

  // ─── Queued offline screen ────────────────────────────────────────────────

  if (isQueued) {
    return (
      <div className="result-page">
        <div className="result-queued">
          <div className="queued-icon">📡</div>
          <h1 className="queued-title">Test Submitted Offline</h1>
          <p className="queued-sub">
            Your answers are saved on this device. They will be automatically
            submitted when your internet connection is restored.
          </p>
          <Link href="/tests" className="btn-result-home">Back to Tests</Link>
        </div>
        <style>{resultStyles}</style>
      </div>
    );
  }

  const [result,    setResult]    = useState<AttemptResult | null>(null);
  const [breakdown, setBreakdown] = useState<AttemptBreakdownItem[] | null>(null);
  const [loadingIDB, setLoadingIDB] = useState(!isQueued);

  // Server fallback (React Query — only fires if IDB miss)
  const [needsServerFallback, setNeedsServerFallback] = useState(false);
  const serverResult = useAttemptResult(
    needsServerFallback ? testId : null,
    needsServerFallback ? attemptId : null,
  );

  // ── Percentile ──────────────────────────────────────────────────────────────
  const [percentile, setPercentile] = useState<number | null>(null);

  useEffect(() => {
    if (!attemptId || isQueued) return;

    // 1. Try IDB first
    getResultsByTest(testId).then((stored) => {
      const match = stored.find((s) => s.id === attemptId);
      if (match) {
        setResult(match.result);
        setBreakdown(match.result.breakdown ?? null);
        setLoadingIDB(false);
      } else {
        // 2. IDB miss — trigger server fallback
        setLoadingIDB(false);
        setNeedsServerFallback(true);
      }
    }).catch(() => {
      setLoadingIDB(false);
      setNeedsServerFallback(true);
    });
  }, [testId, attemptId, isQueued]);

  // ── Hydrate from server fallback ────────────────────────────────────────────
  useEffect(() => {
    if (serverResult.data && !result) {
      setResult(serverResult.data);
      setBreakdown(serverResult.data.breakdown ?? null);
    }
  }, [serverResult.data, result]);

  // ── Fetch percentile ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;
    apiClient.get(`/api/tests/${testId}/percentile`)
      .then(({ data }) => {
        if (data.data?.percentile !== null) setPercentile(data.data.percentile);
      })
      .catch(() => { /* percentile is supplementary — ignore failures */ });
  }, [result, testId]);


  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loadingIDB || (needsServerFallback && serverResult.isLoading)) {
    return <ResultSkeleton />;
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (!result) {
    return (
      <div className="result-page">
        <div className="result-queued">
          <div className="queued-icon">⚠️</div>
          <h1 className="queued-title">Result not found</h1>
          <p className="queued-sub">We couldn't load this result. It may have been cleared from this device.</p>
          <Link href="/tests" className="btn-result-home">Back to Tests</Link>
        </div>
        <style>{resultStyles}</style>
      </div>
    );
  }

  const pct   = Math.round((result.score / result.totalMarks) * 100);
  const grade = gradeInfo(pct);
  const wrong   = (result.totalMarks - result.score) - (breakdown?.filter(b => !b.selected).length ?? 0);
  const skipped = breakdown?.filter(b => !b.selected).length ?? 0;

  return (
    <div className="result-page">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="result-hero">
        <ScoreRing score={result.score} totalMarks={result.totalMarks} size={110} />
        <div className="result-hero-text">
          <h1 className="result-grade">{grade.label} {grade.emoji}</h1>
          {percentile !== null && (
            <p className="result-percentile">Better than {percentile}% of students</p>
          )}
        </div>
      </div>

      {/* ── Stat grid ─────────────────────────────────────────────────── */}
      <div className="result-stats">
        <div className="rs-card">
          <div className="rs-val rs-val--green">{result.score}</div>
          <div className="rs-label">Correct</div>
        </div>
        <div className="rs-card">
          <div className="rs-val rs-val--red">{wrong}</div>
          <div className="rs-label">Wrong</div>
        </div>
        <div className="rs-card">
          <div className="rs-val rs-val--muted">{skipped}</div>
          <div className="rs-label">Skipped</div>
        </div>
        <div className="rs-card">
          <div className="rs-val rs-val--blue">{formatTime(result.timeTaken ?? null)}</div>
          <div className="rs-label">Time Taken</div>
        </div>
      </div>

      {/* ── Answer breakdown ──────────────────────────────────────────── */}
      {breakdown && breakdown.length > 0 && (
        <section className="result-breakdown">
          <h2 className="breakdown-header">Answer Breakdown</h2>
          <div className="breakdown-list">
            {breakdown.map((item, i) => (
              <BreakdownItem key={item.questionId} item={item} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="result-actions">
        <Link href={`/tests/${testId}`} className="btn-retake">Retake Test</Link>
        <Link href="/tests"             className="btn-result-home">Back to Tests</Link>
      </div>

      <style>{resultStyles}</style>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="result-page">
      <div className="result-hero">
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'var(--bg-surface-2)', animation: 'result-shimmer 1.4s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 20, width: 140, background: 'var(--bg-surface-2)', borderRadius: 8, marginBottom: 8, animation: 'result-shimmer 1.4s ease-in-out infinite' }} />
          <div style={{ height: 14, width: 180, background: 'var(--bg-surface-2)', borderRadius: 8, animation: 'result-shimmer 1.4s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{resultStyles}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const resultStyles = `
  .result-page {
    min-height: 100vh;
    background: var(--bg-page);
    padding-bottom: 40px;
    max-width: 680px;
    margin: 0 auto;
  }

  /* Hero */
  .result-hero {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 28px 18px 20px;
    background: linear-gradient(180deg, var(--success-bg) 0%, transparent 100%);
    border-bottom: 1px solid var(--border);
  }
  .result-hero-text { flex: 1; min-width: 0; }
  .result-grade { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .result-percentile { font-size: 12px; color: var(--text-muted); }

  /* Stats */
  .result-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 16px 18px;
  }
  .rs-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px;
  }
  .rs-val {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 3px;
  }
  .rs-val--green  { color: var(--success-text); }
  .rs-val--red    { color: var(--danger-text);  }
  .rs-val--muted  { color: var(--text-muted);   }
  .rs-val--blue   { color: #93c5fd;             }
  .rs-label { font-size: 11px; color: var(--text-muted); font-weight: 500; }

  /* Breakdown */
  .result-breakdown { padding: 0 18px; }
  .breakdown-header {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    padding: 4px 0 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
  }
  .breakdown-list { padding: 0; }

  /* Actions */
  .result-actions {
    display: flex;
    gap: 8px;
    padding: 20px 18px;
  }
  .btn-retake, .btn-result-home {
    flex: 1;
    padding: 13px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
  }
  .btn-retake {
    border: 1px solid var(--border);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
  }
  .btn-result-home {
    border: none;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-weight: 700;
  }
  .btn-retake:active, .btn-result-home:active { opacity: 0.8; }

  /* Queued offline */
  .result-queued {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 32px 24px;
    gap: 12px;
    text-align: center;
  }
  .queued-icon  { font-size: 48px; margin-bottom: 8px; }
  .queued-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .queued-sub   { font-size: 13px; color: var(--text-secondary); max-width: 300px; line-height: 1.6; }

  @keyframes result-shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

  /* Wider on tablet+ */
  @media (min-width: 768px) {
    .result-hero    { padding: 36px 24px 24px; }
    .result-stats   { padding: 20px 24px; gap: 12px; }
    .result-breakdown, .result-actions { padding-left: 24px; padding-right: 24px; }
  }
`;
