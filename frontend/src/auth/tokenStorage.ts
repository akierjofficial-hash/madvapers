const AUTH_TOKEN_KEY = 'mv_access_token';

export const tokenStorage = {
  get(): string | null {
    const raw = localStorage.getItem(AUTH_TOKEN_KEY);
    const value = String(raw ?? '').trim();
    return value ? value : null;
  },
  set(token: string): void {
    const value = String(token ?? '').trim();
    if (!value) return;
    localStorage.setItem(AUTH_TOKEN_KEY, value);
  },
  clear(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },
};

