'use client';
import Link from 'next/link';
import type { Test } from '@ajitsir/shared';

interface DailyHeroCardProps {
  test: Test | null | undefined;
  /** Pass the student's best score if already attempted today */
  bestScore?: { score: number; totalMarks: number } | null;
  isLoading?: boolean;
}

/** Today's date in YYYY-MM-DD local time — used for the hero badge label */
function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' }).toUpperCase();
}

export function DailyHeroCard({ test, bestScore, isLoading }: DailyHeroCardProps) {
  if (isLoading) {
    return (
      <div className="daily-hero daily-hero--loading">
        <div className="hero-skeleton hero-skeleton--badge" />
        <div className="hero-skeleton hero-skeleton--title" />
        <div className="hero-skeleton hero-skeleton--meta" />
        <div className="hero-skeleton hero-skeleton--btn" />
        <style>{heroStyles}</style>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="daily-hero daily-hero--empty">
        <div className="hero-empty-icon">📋</div>
        <p className="hero-empty-title">No test today</p>
        <p className="hero-empty-sub">Check back tomorrow or browse Subject Tests below.</p>
        <style>{heroStyles}</style>
      </div>
    );
  }

  const qCount      = test._count?.questions ?? 0;
  const timeMins    = test.timeLimitSec ? Math.round(test.timeLimitSec / 60) : null;
  const isAttempted = bestScore != null;
  const pct         = isAttempted
    ? Math.round((bestScore!.score / bestScore!.totalMarks) * 100)
    : null;

  return (
    <div className="daily-hero">
      {/* Radial glow overlay */}
      <div className="daily-hero__glow" aria-hidden="true" />

      <div className="daily-badge">
        <span className="daily-dot" />
        TODAY · {todayLabel()}
      </div>

      <h2 className="daily-title marathi-text">{test.title}</h2>

      <div className="daily-meta">
        {qCount > 0 && (
          <span className="daily-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            {qCount} Questions
          </span>
        )}
        {timeMins && (
          <span className="daily-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {timeMins} Min
          </span>
        )}
        <span className="daily-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          {test.isPaid ? 'Premium' : 'Free'}
        </span>
      </div>

      {isAttempted ? (
        <div className="attempted-band">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Completed · Score: {bestScore!.score}/{bestScore!.totalMarks} ({pct}%)</span>
          <Link href={`/tests/${test.id}`} className="retake-link">Retake →</Link>
        </div>
      ) : (
        <Link href={`/tests/${test.id}`} className="btn-start" id="daily-test-start-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Start Today&apos;s Test
        </Link>
      )}

      <style>{heroStyles}</style>
    </div>
  );
}

const heroStyles = `
  .daily-hero {
    margin: 10px 0;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 20px;
    position: relative;
    overflow: hidden;
    color: #ffffff;
  }
  .daily-hero__glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at top right, rgba(99,102,241,0.3) 0%, transparent 60%);
    pointer-events: none;
  }
  .daily-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(99,102,241,0.25);
    border: 1px solid rgba(99,102,241,0.4);
    color: #a5b4fc;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 3px 10px;
    border-radius: 99px;
    margin-bottom: 12px;
  }
  .daily-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a5b4fc;
    animation: hero-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes hero-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  .daily-title {
    position: relative;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
    line-height: 1.3;
    color: #ffffff;
  }
  .daily-meta {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .daily-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(255,255,255,0.55);
  }
  .btn-start {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 13px;
    background: #ffffff;
    color: #0a0a0a;
    font-size: 13px;
    font-weight: 700;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s;
    font-family: inherit;
  }
  .btn-start:active { opacity: 0.85; }
  .attempted-band {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(34,197,94,0.15);
    border: 1px solid rgba(34,197,94,0.3);
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 12px;
    color: #86efac;
    font-weight: 500;
  }
  .retake-link {
    margin-left: auto;
    color: #a5b4fc;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  /* Loading skeleton */
  .daily-hero--loading { background: var(--bg-surface-2); border-color: var(--border); min-height: 170px; }
  .hero-skeleton {
    background: rgba(255,255,255,0.08);
    border-radius: 8px;
    margin-bottom: 12px;
    animation: hero-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes hero-shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
  .hero-skeleton--badge  { width: 140px; height: 22px; border-radius: 99px; }
  .hero-skeleton--title  { width: 85%; height: 44px; }
  .hero-skeleton--meta   { width: 55%; height: 16px; }
  .hero-skeleton--btn    { height: 42px; border-radius: 12px; }

  /* Empty state */
  .daily-hero--empty {
    text-align: center;
    background: var(--bg-surface);
    border-color: var(--border);
    min-height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .hero-empty-icon { font-size: 28px; margin-bottom: 4px; }
  .hero-empty-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  .hero-empty-sub { font-size: 12px; color: var(--text-muted); max-width: 240px; }
`;
