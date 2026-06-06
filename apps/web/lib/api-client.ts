import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Allow Neon a little time to resume from scale-to-zero.
  withCredentials: true, // sends cookies (refreshToken) automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

export const isAuthFailure = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  return error.response?.status === 401 || error.response?.status === 403;
};

export const isTransientAuthError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  const data = error.response?.data as { code?: string } | undefined;

  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    data?.code === 'DATABASE_WAKING' ||
    status === 408 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500)
  );
};

// ─── Request interceptor — inject access token ─────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor — auto refresh on 401 ───────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest.url || '';
    
    // Do not attempt to refresh if the request is the refresh itself or an auth callback
    const isAuthEndpoint = url.includes('/api/auth/refresh') || url.includes('/api/auth/google/callback');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue this request until token refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post('/api/auth/refresh');
        const newToken = data.data.accessToken;

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', newToken);
        }

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Only clear the browser session when the refresh token is actually invalid.
        if (isAuthFailure(refreshError) && typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
