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
            // Data is considered fresh for 10 minutes — no background re-fetch within this window.
            // Previously 5 minutes, which combined with refetchOnWindowFocus caused re-fetches
            // every time the user switched back to the tab.
            staleTime: 10 * 60 * 1000,

            // Keep unused data in memory for 30 minutes (was the 5 min default).
            // Prevents cache eviction while user is navigating between pages.
            gcTime: 30 * 60 * 1000,

            // DISABLED — was triggering an API call every single time the user
            // switched back to this tab from any other app. Data fresh 30s ago
            // does not need re-validation just because focus changed.
            // Note: `refetchOnReconnect: 'always'` below handles coming back online.
            refetchOnWindowFocus: false,

            // Re-fetch stale queries when the user comes back online (e.g. reconnects Wi-Fi).
            refetchOnReconnect: 'always',

            // Exponential backoff for transient failures (cold-start wakeup on Render free tier).
            // 1 s → 2 s → 4 s — never retry real auth errors (401/403).
            retry: (failureCount, error) => {
              if (isAuthFailure(error)) return false;
              return failureCount < 3;
            },
            retryDelay: (attempt) =>
              Math.min(1000 * 2 ** attempt, 15000),
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
