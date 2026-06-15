'use client';
/**
 * test-session.ts
 *
 * Lean Zustand store for an active test session.
 *
 * Design decisions:
 *  - Only the resume-critical fields are persisted to localStorage via the
 *    `partialize` option. The full TestWithQuestions payload (~15 KB) is
 *    deliberately excluded — it is loaded from the React Query in-memory cache
 *    (already fetched before the runner mounts) and re-fetched if needed.
 *    This reduces localStorage writes from ~15 KB on every answer tap to ~1 KB.
 *
 *  - `markSubmitting()` sets `isSubmitting = true` BEFORE the POST request.
 *    This prevents a second submit if the user taps the button twice or if the
 *    UPI background-poll and the normal handler race each other.
 *    `isSubmitting` is intentionally NOT persisted — if the app crashes mid-POST
 *    we want the user to be able to retry, not be permanently blocked.
 *
 *  - `clearSession()` is called after a successful (or definitively failed)
 *    submit, and also on logout. It resets all fields including `isSubmitting`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Persisted shape (written to localStorage key 'test-session') ─────────────
interface PersistedSession {
  testId:    string | null; // ID of the test currently in progress
  answers:   Record<string, string>; // { questionId: 'A'|'B'|'C'|'D' }
  startedAt: number | null;          // Date.now() when the session began
  currentQ:  number;                 // 0-based question index the user was on
}

// ─── Full store shape (persisted + transient) ─────────────────────────────────
interface TestSessionState extends PersistedSession {
  // Transient — never persisted
  isSubmitting: boolean;

  // Actions
  startSession:   (testId: string) => void;
  setAnswer:      (questionId: string, option: string) => void;
  goToQuestion:   (index: number) => void;
  /**
   * Must be called BEFORE the submit POST request fires.
   * Blocks double-submit from rapid taps or concurrent poll+handler calls.
   */
  markSubmitting: () => void;
  /**
   * Resets all session state. Call after:
   *  - Successful server-side score (navigate to result page)
   *  - Unrecoverable submit error
   *  - Logout
   */
  clearSession:   () => void;
}

const EMPTY_PERSISTED: PersistedSession = {
  testId:    null,
  answers:   {},
  startedAt: null,
  currentQ:  0,
};

export const useTestSession = create<TestSessionState>()(
  persist(
    (set) => ({
      ...EMPTY_PERSISTED,
      isSubmitting: false,

      startSession: (testId) =>
        set({ testId, answers: {}, startedAt: Date.now(), currentQ: 0, isSubmitting: false }),

      setAnswer: (questionId, option) =>
        set((s) => ({ answers: { ...s.answers, [questionId]: option } })),

      goToQuestion: (index) => set({ currentQ: index }),

      markSubmitting: () => set({ isSubmitting: true }),

      clearSession: () => set({ ...EMPTY_PERSISTED, isSubmitting: false }),
    }),
    {
      name: 'test-session',
      // Only persist the fields required for session resume.
      // Actions and isSubmitting are excluded — they are re-created each mount.
      partialize: (s): PersistedSession => ({
        testId:    s.testId,
        answers:   s.answers,
        startedAt: s.startedAt,
        currentQ:  s.currentQ,
      }),
    }
  )
);
