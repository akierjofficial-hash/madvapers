import { AxiosError } from 'axios';

export function getLaravelValidationErrors(err: unknown): Record<string, string[]> | null {
  const ax = err as AxiosError<any>;
  if (!ax?.response) return null;
  if (ax.response.status !== 422) return null;
  const data = ax.response.data;
  if (data && typeof data === 'object' && data.errors && typeof data.errors === 'object') {
    return data.errors as Record<string, string[]>;
  }
  return null;
}

export function getApiMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const ax = err as AxiosError<any>;
  const data = ax?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
