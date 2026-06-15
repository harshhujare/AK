'use client';
/**
 * useTest.ts — React Query hook for a single test with all its questions.
 *
 * KEY ARCHITECTURE DECISION: This query is intentionally NOT persisted to
 * localStorage (query-provider.tsx dehydrate guard: if (key === 'test') return false).
 *
 * Reasons:
 *  1. A full test with 30 questions can be ~15 KB — too large for the
 *     RQ persister's localStorage blob, especially on ₹8,000 Android devices.
 *  2. correctOption is stripped server-side, so caching is safe — but the
 *     question text and order can change before publish, so we want fresh data.
 *  3. The runner already uses IDB (test-results-db) for offline resilience.
 *
 * The query key 'test' (singular) is distinct from 'tests' (lobby list) so
 * the dehydrate guard works with a simple string comparison.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { TestWithQuestions } from '@ajitsir/shared';

async function fetchTest(id: string): Promise<TestWithQuestions> {
  const { data } = await apiClient.get(`/api/tests/${id}`);
  return data.data as TestWithQuestions;
}

export function useTest(id: string | null) {
  return useQuery({
    queryKey: ['test', id],
    queryFn:  () => fetchTest(id!),
    enabled:  !!id,
    staleTime: 10 * 60 * 1000, // 10 min — questions don't change once published
    // gcTime uses the default 30 min — keeps questions in memory during a test session
    // even if the user briefly backgrounds the app.
  });
}
