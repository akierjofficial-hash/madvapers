import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../auth/tokenStorage';

function isLocalLikeHost(host: string): boolean {
  const value = String(host ?? '').trim().toLowerCase();
  if (!value) return false;
  if (value === 'localhost' || value === '127.0.0.1' || value === '::1') return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function normalizeApiBaseUrlForLocalCookieAuth(rawBaseUrl: string): string {
  try {
    const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const resolved = new URL(rawBaseUrl, typeof window !== 'undefined' ? window.location.origin : undefined);

    // Sanctum cookie auth needs API and SPA on the same local host family
    // (localhost vs LAN IP mismatch commonly causes CSRF token mismatch).
    if (browserHost && isLocalLikeHost(browserHost) && isLocalLikeHost(resolved.hostname) && browserHost !== resolved.hostname) {
      resolved.hostname = browserHost;
    }

    if (!resolved.pathname || resolved.pathname === '/') {
      resolved.pathname = '/api';
    }

    return resolved.toString().replace(/\/$/, '');
  } catch {
    return rawBaseUrl;
  }
}

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

export const API_BASE_URL = normalizeApiBaseUrlForLocalCookieAuth(RAW_API_BASE_URL);

function deriveApiOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:8000';
  }
}

export const API_ORIGIN = deriveApiOrigin(API_BASE_URL);

export async function ensureCsrfCookie(options?: { force?: boolean }): Promise<void> {
  const force = options?.force === true;
  const existing = String(api.defaults.headers.common['X-CSRF-TOKEN'] ?? '').trim();
  if (!force && existing) {
    return;
  }

  await axios.get(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    withCredentials: true,
    headers: { Accept: 'application/json' },
  });

  // On cross-domain deployments (e.g. separate Railway frontend/backend subdomains),
  // the SPA can't read backend host-only cookies. Fetch a plain CSRF token value
  // from API and attach it as X-CSRF-TOKEN for subsequent mutation requests.
  const { data } = await axios.get<{ csrf_token?: string }>(`${API_BASE_URL}/auth/csrf-token`, {
    withCredentials: true,
    headers: { Accept: 'application/json' },
  });

  const csrfToken = String(data?.csrf_token ?? '').trim();
  if (csrfToken) {
    api.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

function isMutationMethod(method?: string): boolean {
  const m = (method ?? '').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const config = err.config as RetriableConfig | undefined;

    // Recover once from missing/expired CSRF cookie.
    if (status === 419 && config && isMutationMethod(config.method) && !config._csrfRetried) {
      config._csrfRetried = true;
      await ensureCsrfCookie({ force: true });
      return api.request(config);
    }

    const requestUrl = String(config?.url ?? '');
    const isAuthBootstrapRequest =
      requestUrl.includes('/auth/me') || requestUrl.includes('/auth/login');

    if (status === 401 && !isAuthBootstrapRequest) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    return Promise.reject(err);
  }
);
