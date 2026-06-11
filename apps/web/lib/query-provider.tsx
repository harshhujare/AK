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
} as const;

// Only these public, non-sensitive query keys are persisted to localStorage.
// Auth state, payment data, admin queries, and streaming data are never persisted.
const PERSISTED_KEYS = new Set<string>(['subjects', 'notes', 'announcements', 'faqs']);

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
    // ── Bug 5 fix: wrap setItem in a try/catch for QuotaExceededError ──────
    // On low-end Android (some WebViews cap localStorage at ~5 MB per origin),
    // a large dehydrated cache blob silently breaks all persistence with an
    // uncaught QuotaExceededError. Wrapping setItem means a full cache still
    // works in-memory; only disk persistence is lost gracefully instead of
    // crashing the persister's write loop.
    const safeStorage: Storage = {
      ...window.localStorage,
      setItem: (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (err) {
          // QuotaExceededError — log once and continue without persisting.
          // The in-memory React Query cache is unaffected.
          console.warn('[RQ Persister] localStorage quota exceeded — cache not persisted:', err);
        }
      },
    };
    _persister = createSyncStoragePersister({
      storage: safeStorage,
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
            if (!PERSISTED_KEYS.has(key)) return false;

            // Don't persist queries that have no data yet (dataUpdatedAt = 0)
            const updatedAt = query.state.dataUpdatedAt;
            if (!updatedAt) return false;

            // Respect per-query TTL — don't persist stale entries
            const ttl = getQueryTTL(query.queryKey);
            if (Date.now() - updatedAt >= ttl) return false;

            // ── Bug 5 fix: cap notes cache to page 1 only ────────────────────
            // Notes entries include pagination metadata + per-page note payloads.
            // If a user browses multiple pages, the blob grows large and can hit
            // the ~5 MB localStorage limit on low-end Android WebViews.
            // Only persisting page 1 ensures the most useful data (first page)
            // is available on hard refresh while keeping the cache blob small.
            if (key === 'notes') {
              const page = query.queryKey[2]; // ['notes', subjectId, page, limit, search]
              if (page !== 1 && page !== undefined) return false;
            }

            return true;
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
