'use client';
/**
 * useTests.ts — React Query hook for the test lobby list.
 *
 * Persisted to localStorage via query-provider (key='tests', TTL=5 min).
 * This makes the lobby load instantly offline from the last fetch.
 *
 * Filters are passed as query params to GET /api/tests:
 *   type=DAILY|PREDEFINED|SUBJECT
 *   subjectId=<cuid>
 *   date=YYYY-MM-DD  (for DAILY type — returns test for that day)
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Test } from '@ajitsir/shared';

export interface TestFilters {
  type?: 'DAILY' | 'PREDEFINED' | 'SUBJECT';
  subjectId?: string;
  date?: string; // YYYY-MM-DD
}

async function fetchTests(filters: TestFilters): Promise<Test[]> {
  const params = new URLSearchParams();
  if (filters.type)      params.set('type',      filters.type);
  if (filters.subjectId) params.set('subjectId', filters.subjectId);
  if (filters.date)      params.set('date',       filters.date);

  const { data } = await apiClient.get(`/api/tests?${params.toString()}`);
  return data.data as Test[];
}

export function useTests(filters: TestFilters = {}) {
  return useQuery({
    // Include filters in the key so each unique filter set has its own cache entry
    queryKey: ['tests', filters.type ?? 'all', filters.subjectId ?? '', filters.date ?? ''],
    queryFn:  () => fetchTests(filters),
    staleTime: 5 * 60 * 1000, // 5 min — lobby list rarely changes mid-session
  });
}
