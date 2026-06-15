'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useEffect, useRef } from 'react';
import { isAuthFailure } from './api-client';
import { registerRQCacheCleaner } from './auth-store';

// ─── TTLs per data type ───────────────────────────────────────────────────────
const TTL = {
  subjects:      7 * 24 * 60 * 60 * 1000, // 7 days
  notes:              60 * 60 * 1000,      // 1 hour
  announcements:      30 * 60 * 1000,      // 30 min
  faqs:          7 * 24 * 60 * 60 * 1000, // 7 days
  // 'tests' lobby list: short TTL because Ajit Sir can publish a new DAILY
  // test any time during the day. Single-test queries ('test') are excluded
  // from persistence entirely (see dehydrate guard below).
  tests:              5 * 60 * 1000,       // 5 min
} as const;

// Only these public, non-sensitive query keys are persisted to localStorage.
// 'test' (single test with questions) is intentionally excluded — the payload
// is ~15 KB and must always be fresh (question text may change).
// Auth state, payment data, and admin queries are never persisted.
const PERSISTED_KEYS = new Set<string>(['subjects', 'notes', 'announcements', 'faqs', 'tests']);

function getQueryTTL(queryKey: readonly unknown[]): number {
  const key = queryKey[0] as string;
  return (TTL as Record<string, number>)[key] ?? TTL.notes;
}

// ─── Module-level singletons ──────────────────────────────────────────────────
// CRITICAL: Both the QueryClient and the persister MUST be stable references.
// Creating them inside the component body would cause PersistQueryClientProvider
// to detect a "changed persister" on every render and re-initialize, discarding
// the hydrated localStorage data on every render cycle.

let _queryClient: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Data is considered fresh for 10 minutes — no background re-fetch within this window.
          staleTime: 10 * 60 * 1000,

          // Keep unused data in memory for 30 minutes.
          gcTime: 30 * 60 * 1000,

          // DISABLED — was triggering API calls every tab switch.
          refetchOnWindowFocus: false,

          // Re-fetch stale queries when the user comes back online.
          refetchOnReconnect: 'always',

          // Exponential backoff — never retry real auth errors (401/403).
          retry: (failureCount, error) => {
            if (isAuthFailure(error)) return false;
            return failureCount < 3;
          },
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
        },
      },
    });
  }
  return _queryClient;
}

// Persister singleton — created once, reused across all renders.
// Guards typeof window for SSR safety (even in 'use client' files, module
// evaluation can run during SSR before the browser environment is available).
let _persister: ReturnType<typeof createSyncStoragePersister> | null = null;

function getPersister() {
  if (!_persister && typeof window !== 'undefined') {
    _persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: 'rq-cache',
      // Write to localStorage at most every 1s to avoid thrashing on rapid updates
      throttleTime: 1000,
    });
  }
  return _persister;
}

// ─── Provider component ───────────────────────────────────────────────────────

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const persister = getPersister();

  // Register RQ cache cleaner with auth-store (Fix 5).
  // Lets logout() wipe the in-memory + persisted cache without a circular import.
  const registered = useRef(false);
  useEffect(() => {
    if (!registered.current) {
      registerRQCacheCleaner(() => {
        queryClient.clear();
        // Also wipe localStorage key in case the persister's auto-sync is delayed
        try { localStorage.removeItem('rq-cache'); } catch { /* ignore */ }
      });
      registered.current = true;
    }
  }, [queryClient]);

  // SSR fallback — no localStorage available during server render
  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  // PersistQueryClientProvider already wraps QueryClientProvider internally.
  // Do NOT add a nested <QueryClientProvider> — that creates a second context
  // layer that children read from, bypassing the persistence hydration.
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Maximum age of the entire persisted cache blob (7 days).
        maxAge: 7 * 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // Fix 6: Whitelist — only persist public, non-sensitive queries.
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0] as string;

            // 'test' = single test with all questions (~15 KB).
            // Must NOT be persisted: too large for localStorage on low-end Android,
            // and must always be fresh (answers must not come from stale cache).
            if (key === 'test') return false;

            if (!PERSISTED_KEYS.has(key)) return false;

            // Don't persist queries that have no data yet (dataUpdatedAt = 0)
            const updatedAt = query.state.dataUpdatedAt;
            if (!updatedAt) return false;

            // Respect per-query TTL — don't persist stale entries
            const ttl = getQueryTTL(query.queryKey);
            return Date.now() - updatedAt < ttl;
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
