'use client';

import { useEffect } from 'react';
import useAuthStore from '@/lib/auth-store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isInitialized } = useAuthStore();

  // ─── Initial session restore ────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // ─── Re-initialize on tab focus after idle ──────────────────────────────────
  // When a user opens the app after 30–60 min, the stored accessToken may be
  // expired and Render may be asleep. This listener re-validates the session
  // every time the user switches back to the tab, so they never see a ghost
  // (logged-out) state — the session is quietly re-confirmed in the background.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Reset flag so initialize() re-runs and re-validates the stored token.
        // The user is immediately shown as logged-in from localStorage (instant),
        // while the /me validation happens in the background — no flash of
        // logged-out state.
        useAuthStore.setState({ isInitialized: false });
        initialize();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [initialize]);

  return <>{children}</>;
}
