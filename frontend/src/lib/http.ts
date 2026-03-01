import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

function deriveApiOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:8000';
  }
}

export const API_ORIGIN = deriveApiOrigin(API_BASE_URL);

export async function ensureCsrfCookie(): Promise<void> {
  await axios.get(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    withCredentials: true,
    headers: { Accept: 'application/json' },
  });
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
      await ensureCsrfCookie();
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
