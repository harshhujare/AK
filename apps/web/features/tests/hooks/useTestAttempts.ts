'use client';
/**
 * useTestAttempts.ts — Cursor-paginated attempt history for the result page.
 *
 * This is a simple first-page query (no infinite scroll needed for Phase 3).
 * The result page uses IDB (getResultsByTest) as primary source.
 * This hook is the API fallback when IDB is empty (new device, cleared storage).
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { TestAttempt } from '@ajitsir/shared';

interface AttemptPage {
  data: (TestAttempt & { test: { id: string; title: string; subjectId: string } })[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function fetchMyAttempts(): Promise<AttemptPage> {
  // Fetches the 20 most recent attempts (no cursor on first load)
  const params = new URLSearchParams({ limit: '20' });
  const { data } = await apiClient.get(`/api/tests/attempts/me?${params}`);
  return data as AttemptPage;
}

/** Returns the student's own attempt history (most recent 20). */
export function useMyAttempts() {
  return useQuery({
    queryKey: ['test-attempts', 'me'],
    queryFn:  fetchMyAttempts,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/** Fetches a single attempt by its ID directly from the server (result fallback). */
export function useAttemptResult(testId: string | null, attemptId: string | null) {
  return useQuery({
    queryKey: ['test-attempt', testId, attemptId],
    queryFn:  async () => {
      const { data } = await apiClient.get(`/api/tests/${testId}/attempt/${attemptId}`);
      return data.data;
    },
    enabled:   !!(testId && attemptId),
    staleTime: Infinity, // attempt results don't change — cache forever
    retry:     1,
  });
}
