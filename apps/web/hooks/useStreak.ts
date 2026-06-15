'use client';
/**
 * useStreak.ts
 *
 * Computes the student's consecutive-day test-taking streak from IDB.
 *
 * Design:
 *  - Source of truth: IDB `results` store (from test-results-db.ts).
 *  - Cache: sessionStorage key 'streak-cache' — computed once per tab open,
 *    re-read instantly on the next render within the same session.
 *  - A streak day counts if ANY test result was saved on that calendar day
 *    (local time). The streak breaks on the first day gap.
 *  - Returns 0 until the IDB read completes (no loading spinner needed —
 *    streak badge is supplementary info, not gating content).
 */
import { useState, useEffect } from 'react';
import { getAllResults } from '@/features/tests/lib/test-results-db';

const SESSION_KEY = 'streak-cache';

/**
 * Given a list of result timestamps, returns the current streak length.
 * A streak is a contiguous run of calendar days (local time) ending today
 * or yesterday (to handle students who practise late at night).
 */
function computeStreak(results: { savedAt: number }[]): number {
  if (!results.length) return 0;

  // Collect unique calendar days (YYYY-MM-DD local time), sorted newest-first
  const days = [
    ...new Set(
      results.map((r) => {
        const d = new Date(r.savedAt);
        // Use local date so 11 PM submissions count as "today" for the student
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    ),
  ].sort().reverse();

  let streak = 0;
  const expected = new Date();
  // Normalise to start of today (local midnight)
  expected.setHours(0, 0, 0, 0);

  for (const day of days) {
    const dayDate = new Date(day);
    dayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expected.getTime() - dayDate.getTime()) / 86_400_000);

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      expected.setDate(expected.getDate() - 1); // move window back one day
    } else {
      break; // gap found — streak ends
    }
  }

  return streak;
}

/**
 * Returns the student's current consecutive-day streak.
 * Reads from sessionStorage cache first (instant), then hydrates from IDB.
 */
export function useStreak(): number {
  const [streak, setStreak] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const cached = sessionStorage.getItem(SESSION_KEY);
    return cached !== null ? Number(cached) : 0;
  });

  useEffect(() => {
    getAllResults()
      .then((results) => {
        const s = computeStreak(results);
        setStreak(s);
        // Cache for the rest of this tab's lifetime
        sessionStorage.setItem(SESSION_KEY, String(s));
      })
      .catch(() => {
        // IDB read failed (private browsing, quota, etc.) — keep default 0
      });
  }, []); // once per tab open — same lifecycle as the sessionStorage cache

  return streak;
}
