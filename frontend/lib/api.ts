import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  // The access/refresh tokens live in httpOnly cookies now, not localStorage --
  // this tells the browser to actually send them cross-port (localhost:3000 -> :5000).
  withCredentials: true,
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Queues concurrent 401s behind a single in-flight refresh call. This isn't
// just an optimization: the refresh token rotates on every use (single-use),
// so firing several refresh requests at once would make all but one of them
// fail, causing spurious logouts for a page that fires multiple API calls
// in parallel right as the access token expires.
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

function resolvePending() {
  pendingRequests.forEach((resolve) => resolve());
  pendingRequests = [];
}

// Only endpoints that would cause an infinite loop (or make no sense to
// retry) if refreshed. /auth/me deliberately is NOT here -- it's a normal
// protected read like any other, and should participate in the same
// refresh-and-retry flow if its access token has expired.
const NO_REFRESH_RETRY = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const skipRefresh = config?.url && NO_REFRESH_RETRY.some((path) => config.url!.includes(path));

    if (error.response?.status !== 401 || !config || config._retry || skipRefresh) {
      return Promise.reject(error);
    }

    config._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        pendingRequests.push(() => resolve(api(config)));
      });
    }

    isRefreshing = true;
    try {
      await api.post('/auth/refresh');
      isRefreshing = false;
      resolvePending();
      return api(config);
    } catch (refreshError) {
      isRefreshing = false;
      pendingRequests = [];
      // Deliberately no navigation here. This path also runs for the very
      // first /auth/me probe on a totally fresh, logged-out visit to /login
      // or /register -- forcing a redirect there would fight the page the
      // user is already on. Just update auth state; useAuthStore.logout()
      // flips isAuthenticated, and (dashboard)/layout.tsx's own effect
      // reactively redirects if the user turns out to be somewhere that
      // actually requires a session.
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    }
  }
);
