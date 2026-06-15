'use client';
/**
 * /tests — Test Lobby
 *
 * Three tabs: Daily / Scheduled / By Subject
 * - Daily tab: hero card for today's DAILY test + subject test list
 * - Scheduled tab: upcoming PREDEFINED tests
 * - By Subject tab: subject chips filter + all SUBJECT tests
 *
 * IDB integration: TestCard shows inline attempted band from test-results-db.
 * Streak chip reads from useStreak() (IDB + sessionStorage cache).
 */
import { useState, useEffect } from 'react';
import { useTests }      from '@/features/tests/hooks/useTests';
import { useStreak }     from '@/hooks/useStreak';
import { TestCard }      from '@/features/tests/components/TestCard';
import { DailyHeroCard } from '@/features/tests/components/DailyHeroCard';
import { getResultsByTest } from '@/features/tests/lib/test-results-db';
import type { StoredResult } from '@/features/tests/lib/test-results-db';
import type { Test } from '@ajitsir/shared';

type Tab = 'daily' | 'scheduled' | 'subject';

const TODAY = new Date().toISOString().slice(0, 10);

export default function TestLobbyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const streak = useStreak();

  // ── React Query fetches per tab ─────────────────────────────────────────────
  const { data: dailyTests,     isLoading: dailyLoading }     = useTests({ type: 'DAILY',      date: TODAY });
  const { data: scheduledTests, isLoading: scheduledLoading } = useTests({ type: 'PREDEFINED' });
  const { data: subjectTests,   isLoading: subjectLoading }   = useTests({ type: 'SUBJECT' });

  const todayTest = dailyTests?.[0] ?? null;

  // ── IDB: load best result per test (for attempted bands) ───────────────────
  const [bestResults, setBestResults] = useState<Record<string, StoredResult | null>>({});

  useEffect(() => {
    const allTests: Test[] = [
      ...(dailyTests   ?? []),
      ...(scheduledTests ?? []),
      ...(subjectTests  ?? []),
    ];
    if (!allTests.length) return;

    Promise.all(
      allTests.map(async (t) => {
        const results = await getResultsByTest(t.id);
        // Best = highest score
        const best = results.sort((a, b) => b.result.score - a.result.score)[0] ?? null;
        return [t.id, best] as [string, StoredResult | null];
      })
    ).then((entries) => setBestResults(Object.fromEntries(entries)));
  }, [dailyTests, scheduledTests, subjectTests]);

  return (
    <main className="lobby-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="lobby-header">
        <div>
          <h1 className="lobby-title">Mock Tests</h1>
          <p className="lobby-sub">Maharashtra TET Preparation</p>
        </div>
        {streak > 0 && (
          <div className="streak-chip" title={`${streak}-day streak!`}>
            🔥 <span>{streak}</span>
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="lobby-tabs" role="tablist" aria-label="Test categories">
        {(['daily', 'scheduled', 'subject'] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            className={`lobby-tab ${activeTab === tab ? 'lobby-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'daily' ? 'Daily' : tab === 'scheduled' ? 'Scheduled' : 'By Subject'}
          </button>
        ))}
      </div>

      {/* ── Daily tab ───────────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <section id="panel-daily" role="tabpanel" aria-labelledby="tab-daily" className="lobby-panel">
          <div className="lobby-section-pad">
            <DailyHeroCard
              test={todayTest}
              isLoading={dailyLoading}
              bestScore={
                todayTest && bestResults[todayTest.id]
                  ? { score: bestResults[todayTest.id]!.result.score, totalMarks: bestResults[todayTest.id]!.result.totalMarks }
                  : null
              }
            />
          </div>

          {/* Subject tests below the daily hero */}
          <div className="lobby-section-row">
            <span className="lobby-section-title">Subject Tests</span>
          </div>
          <TestList tests={subjectTests} loading={subjectLoading} bestResults={bestResults} />
        </section>
      )}

      {/* ── Scheduled tab ───────────────────────────────────────────────── */}
      {activeTab === 'scheduled' && (
        <section id="panel-scheduled" role="tabpanel" aria-labelledby="tab-scheduled" className="lobby-panel">
          <TestList tests={scheduledTests} loading={scheduledLoading} bestResults={bestResults} emptyMsg="No upcoming scheduled tests." />
        </section>
      )}

      {/* ── By Subject tab ──────────────────────────────────────────────── */}
      {activeTab === 'subject' && (
        <section id="panel-subject" role="tabpanel" aria-labelledby="tab-subject" className="lobby-panel">
          <TestList tests={subjectTests} loading={subjectLoading} bestResults={bestResults} emptyMsg="No subject tests published yet." />
        </section>
      )}

      <style>{lobbyStyles}</style>
    </main>
  );
}

// ── Internal list component ──────────────────────────────────────────────────

function TestList({
  tests,
  loading,
  bestResults,
  emptyMsg = 'No tests available.',
}: {
  tests: Test[] | undefined;
  loading: boolean;
  bestResults: Record<string, StoredResult | null>;
  emptyMsg?: string;
}) {
  if (loading) {
    return (
      <div className="test-list">
        {[1, 2, 3].map((i) => <div key={i} className="test-card-skeleton" />)}
      </div>
    );
  }
  if (!tests?.length) {
    return <p className="lobby-empty">{emptyMsg}</p>;
  }
  return (
    <div className="test-list">
      {tests.map((t) => (
        <TestCard key={t.id} test={t} bestResult={bestResults[t.id] ?? null} />
      ))}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const lobbyStyles = `
  .lobby-page {
    min-height: 100vh;
    background: var(--bg-page);
    padding-bottom: 80px; /* bottom nav clearance */
    max-width: 680px;
    margin: 0 auto;
  }

  /* Header */
  .lobby-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 18px 12px;
  }
  .lobby-title {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }
  .lobby-sub {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .streak-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
    color: var(--warn-text);
    font-size: 12px;
    font-weight: 700;
    padding: 5px 11px;
    border-radius: 99px;
    white-space: nowrap;
  }

  /* Tabs */
  .lobby-tabs {
    display: flex;
    padding: 0 18px;
    gap: 4px;
    margin-bottom: 4px;
  }
  .lobby-tab {
    flex: 1;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-align: center;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
  }
  .lobby-tab--active {
    background: var(--bg-surface-2);
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  /* Panel padding */
  .lobby-panel { padding: 0; }
  .lobby-section-pad { padding: 8px 18px; }

  /* Section row */
  .lobby-section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px 8px;
  }
  .lobby-section-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }

  /* Test list */
  .test-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 18px 10px;
  }

  /* Skeleton card */
  .test-card-skeleton {
    height: 88px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    animation: card-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes card-shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }

  /* Empty */
  .lobby-empty {
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    padding: 40px 18px;
  }

  /* Desktop: wider panel */
  @media (min-width: 768px) {
    .lobby-header { padding: 28px 24px 16px; }
    .lobby-tabs   { padding: 0 24px; }
    .lobby-section-pad { padding: 8px 24px; }
    .lobby-section-row { padding: 12px 24px 8px; }
    .test-list         { padding: 0 24px 10px; }
  }
`;
