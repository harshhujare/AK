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
        // Token still valid → fire /me in background to get fresh plan/role data
        apiClient.get('/api/auth/me')
          .then(({ data }) => {
            const freshUser = data.data as User;
            localStorage.setItem('user', JSON.stringify(freshUser));
            set({ user: freshUser });
          })
          .catch((error) => {
            if (isTransientAuthError(error)) {
              // Transient error (network/DB wakeup) — keep showing stored user, retry later
              return;
            }
            // Real auth failure (token rejected server-side) → clear session
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
            set({ user: null, accessToken: null });
          });
      }
    } else {
      // No stored session — try a silent refresh via httpOnly cookie
      try {
        await get().refresh();
      } catch (error) {
        if (isTransientAuthError(error)) {
          // Transient: keep as logged-out but don't block
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          set({ user: null, accessToken: null });
        }
      } finally {
        set({ isInitialized: true });
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
}));

export default useAuthStore;
