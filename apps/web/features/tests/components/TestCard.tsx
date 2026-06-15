'use client';
import Link from 'next/link';
import type { Test } from '@ajitsir/shared';
import type { StoredResult } from '../lib/test-results-db';

interface TestCardProps {
  test: Test;
  /** Best result from IDB — shown as inline attempted band */
  bestResult?: StoredResult | null;
}

export function TestCard({ test, bestResult }: TestCardProps) {
  const questionCount = test._count?.questions ?? 0;
  const timeMins = test.timeLimitSec ? Math.round(test.timeLimitSec / 60) : null;
  const pct = bestResult
    ? Math.round((bestResult.result.score / bestResult.result.totalMarks) * 100)
    : null;

  return (
    <Link href={`/tests/${test.id}`} className="test-card" aria-label={test.title}>
      <div className="tc-top">
        <div className="tc-title marathi-text">{test.title}</div>
        <span className={`tc-badge ${test.isPaid ? 'tc-badge--paid' : 'tc-badge--free'}`}>
          {test.isPaid ? 'PREMIUM' : 'FREE'}
        </span>
      </div>

      <div className="tc-bottom">
        <div className="tc-stat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          {questionCount} Qs
        </div>
        {timeMins && (
          <div className="tc-stat tc-stat--border">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {timeMins} min
          </div>
        )}
      </div>

      {pct !== null && (
        <div className="tc-attempted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span className="tc-attempted-text">
            Best: {bestResult!.result.score}/{bestResult!.result.totalMarks} · {pct}%
          </span>
        </div>
      )}

      <style>{`
        .test-card {
          display: block;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s;
        }
        .test-card:hover { border-color: var(--border-strong); }
        .test-card:active { border-color: var(--border-strong); }
        .tc-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 14px 14px 10px;
          gap: 10px;
        }
        .tc-title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          flex: 1;
          color: var(--text-primary);
        }
        .tc-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tc-badge--free {
          background: var(--success-bg);
          color: var(--success-text);
          border: 1px solid var(--success-border);
        }
        .tc-badge--paid {
          background: var(--bg-surface-2);
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }
        .tc-bottom {
          display: flex;
          align-items: center;
          border-top: 1px solid var(--border);
        }
        .tc-stat {
          flex: 1;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .tc-stat--border { border-left: 1px solid var(--border); }
        .tc-attempted {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: var(--success-bg);
          border-top: 1px solid var(--success-border);
          color: var(--success-text);
        }
        .tc-attempted-text { font-size: 11px; font-weight: 500; }
      `}</style>
    </Link>
  );
}
