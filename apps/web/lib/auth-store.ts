import { create } from 'zustand';
import type { User } from '@ajitsir/shared';
import apiClient from './api-client';
import { pdfCacheClearAll } from './pdf-cache';

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
}

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    // Clear all cached PDFs so other users on shared devices cannot access them
    void pdfCache.clearAll();
    set({ user: null, accessToken: null });
  },

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });

    try {
      // Restore from localStorage on page load
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          const user = JSON.parse(storedUser) as User;
          set({ user, accessToken: storedToken });

          // Verify the token is still valid by hitting /me
          try {
            const { data } = await apiClient.get('/api/auth/me');
            set({ user: data.data, isLoading: false, isInitialized: true });
            localStorage.setItem('user', JSON.stringify(data.data));
            return;
          } catch {
            // Token invalid — try refresh (interceptor handles it)
          }
        }

        // Try silent refresh via httpOnly cookie
        try {
          const { data } = await apiClient.post('/api/auth/refresh');
          const newToken = data.data.accessToken;
          localStorage.setItem('accessToken', newToken);

          const meResponse = await apiClient.get('/api/auth/me');
          const user = meResponse.data.data as User;
          localStorage.setItem('user', JSON.stringify(user));
          set({ user, accessToken: newToken });
        } catch {
          // No valid session — user needs to log in
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          set({ user: null, accessToken: null });
        }
      }
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },
}));

export default useAuthStore;
