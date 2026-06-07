'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { isAuthFailure } from './api-client';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes

            // Re-fetch when the user switches back to the tab.
            // This is the primary fix for the "blank page after 30 min" bug:
            // queries that failed during Render's cold-start are retried
            // automatically when the user returns to the tab (by which time
            // Render has woken up).
            refetchOnWindowFocus: true,

            // Exponential backoff: 1 s → 2 s → 4 s (3 retries, 4 total attempts).
            // Render free tier takes up to 15–30 s to wake; the old retry: 1
            // fired both attempts within seconds, gave up, and left empty state.
            // Now we wait long enough for Render to actually respond.
            retry: (failureCount, error) => {
              // Never retry real auth failures (401/403) — only server/network errors
              if (isAuthFailure(error)) return false;
              return failureCount < 3;
            },
            retryDelay: (attempt) =>
              Math.min(1000 * 2 ** attempt, 15000), // 1 s, 2 s, 4 s, capped at 15 s
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
