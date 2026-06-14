import { create } from 'zustand';
import type { User } from '@ajitsir/shared';
import apiClient, { isTransientAuthError } from './api-client';
import { pdfCacheClearAll } from './pdf-cache';

// ─── Lazy queryClient import ─────────────────────────────────────────────────
// We import lazily to avoid a circular dep: query-provider → auth-store → query-provider.
// getQueryClient() is set once by QueryProvider after it creates its client.
let _clearRQCache: (() => void) | null = null;
export const registerRQCacheCleaner = (fn: () => void) => { _clearRQCache = fn; };

// ─── JWT token expiry check (client-side only, no signature verification) ────
// The server still validates the signature on every real request.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds; add a 30s buffer so we refresh slightly early
    return typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp - 30;
  } catch {
    return true; // malformed token → treat as expired
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setAccessToken: (accessToken: string) => void;
  refresh: () => Promise<void>;
  /** Re-fetches /me and updates Zustand + localStorage. Returns true if plan is PAID. */
  refreshUserPlan: () => Promise<boolean>;
}

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem('accessToken');
  const storedUser = localStorage.getItem('user');
  if (!accessToken || !storedUser) return null;

  try {
    return { accessToken, user: JSON.parse(storedUser) as User };
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    return null;
  }
};

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isInitialized: false,

  login: (accessToken: string, user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken, isLoading: false });
  },

  setAccessToken: (accessToken: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    set({ accessToken });
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Ignore errors on logout — clear state regardless
    }
    // Wipe cached PDFs — critical for shared/school computers
    await pdfCacheClearAll();

    // Wipe React Query in-memory + persisted cache (Fix 5)
    // Prevents a logged-out user on a shared device from seeing another user's data
    if (_clearRQCache) _clearRQCache();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rq-cache');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null });
  },

  initialize: async () => {
    if (get().isInitialized) return;

    if (typeof window === 'undefined') {
      set({ isInitialized: true });
      return;
    }

    const stored = readStoredSession();

    // ── Fix 4: Set isInitialized: true synchronously — no spinner on boot ──
    if (stored) {
      // Restore state immediately from localStorage → instant UI, no loading flash
      set({
        user: stored.user,
        accessToken: stored.accessToken,
        isLoading: false,
        isInitialized: true,
      });

      // Fire background validation based on token freshness
      if (isTokenExpired(stored.accessToken)) {
        // Token expired → try a silent refresh (non-blocking, fire-and-forget)
        get().refresh().catch((error) => {
          // ── Offline guard ────────────────────────────────────────────────
          // If the device is offline, the refresh request fails with ERR_NETWORK.
          // We must NOT clear the user state in this case — the stored user from
          // localStorage is still valid and lets the user access cached notes/PDFs.
          // Only clear the session on a real auth rejection (401/403 from the server).
          const isOfflineOrTransient =
            isTransientAuthError(error) ||
            (typeof navigator !== 'undefined' && !navigator.onLine);

          if (!isOfflineOrTransient) {
            // Server explicitly rejected the token (401/403) → clear stale session
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            set({ user: null, accessToken: null });
          }
          // If offline/transient: silently keep the stored user state — the app
          // stays functional with cached data. The next time the device is online,
          // the next page load will re-run initialize() and refresh properly.
        });
      } else {
        // Token still valid → fire /me in background to get fresh plan/role data.
        //
        // ── Bug 2 fix: add an 8 s AbortController timeout on this call ───────────
        // If Neon is cold (scale-to-zero), this call stalls for 10–25 s before the
        // DATABASE_WAKING 503 response arrives. Without a timeout shorter than the
        // 30 s axios default, the app silently hangs on every cold boot after a user
        // has been logged in for a while. With an 8 s timeout we abort early, keep
        // the stored user in Zustand, and let the user continue without blocking.
        const meController = new AbortController();
        const meTimer = setTimeout(() => meController.abort(), 8000);

        apiClient.get('/api/auth/me', { signal: meController.signal })
          .then(({ data }) => {
            clearTimeout(meTimer);
            const freshUser = data.data as User;

            // ── Plan-downgrade guard ──────────────────────────────────────────
            // This background /me was fired at page-load time (before payment).
            // On slow mobile connections it can take 10–30 s to resolve — long
            // enough for the user to pay and have refresh() upgrade the in-memory
            // plan to 'PAID'. If we blindly apply this stale response, it would
            // overwrite the PAID plan back to FREE and re-show the paywall.
            //
            // Rule: never let a background /me step the plan backwards.
            // If the current in-memory user is already on a more-privileged plan
            // than what this response reports, silently drop the update.
            const currentPlan = get().user?.plan;
            const isPlanDowngrade =
              currentPlan === 'PAID' && freshUser.plan !== 'PAID';

            if (isPlanDowngrade) {
              // The user paid while this request was in-flight — keep the
              // upgraded plan; discard the stale pre-payment response.
              return;
            }

            localStorage.setItem('user', JSON.stringify(freshUser));
            set({ user: freshUser });
          })
          .catch((error) => {
            clearTimeout(meTimer);
            if (isTransientAuthError(error) || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
              // Timed out or transient DB wakeup — keep showing stored user, retry on next load
              return;
            }
            // Real auth failure (token rejected server-side) → clear session
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            set({ user: null, accessToken: null });
          });
      }
    } else {
      // No stored session — try a silent refresh via httpOnly cookie.
      //
      // ── Bug 1 fix: set isInitialized: true optimistically before awaiting refresh()
      // Without this, isInitialized stays false until the finally block, blocking
      // all page rendering. On 3G / weak 4G, the axios default 30 s timeout means
      // the user sees a completely blank screen for up to 30 s on first visit.
      // Setting true here immediately lets the UI render a logged-out state while
      // the silent refresh runs in the background.
      set({ isInitialized: true });
      try {
        await get().refresh();
      } catch (error) {
        if (!isTransientAuthError(error)) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          set({ user: null, accessToken: null });
        }
        // Transient / offline: keep logged-out state, don't block
      }
    }
  },

  refresh: async () => {
    const { data } = await apiClient.post('/api/auth/refresh');
    const newToken = data.data.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', newToken);
    }

    const meResponse = await apiClient.get('/api/auth/me');
    const user = meResponse.data.data as User;
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken: newToken });
  },

  refreshUserPlan: async () => {
    const { accessToken } = get();
    if (!accessToken) return false;
    try {
      const meResponse = await apiClient.get('/api/auth/me');
      const freshUser = meResponse.data.data as User;
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
      set({ user: freshUser });
      return freshUser.plan === 'PAID';
    } catch {
      return false;
    }
  },
}));

export default useAuthStore;
