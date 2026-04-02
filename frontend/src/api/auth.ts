import { api } from '../lib/http';
import { tokenStorage } from '../auth/tokenStorage';
import type { User } from '../types/models';

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: User;
  permissions: string[];
  access_token?: string;
  token_type?: string;
};

export type MeResponse = {
  user: User;
  permissions: string[];
};

export async function login(payload: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  const token = String(data?.access_token ?? '').trim();
  if (token) {
    tokenStorage.set(token);
  }
  return data;
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export async function logout(): Promise<{ status: string }> {
  try {
    const { data } = await api.post<{ status: string }>('/auth/logout');
    return data;
  } finally {
    tokenStorage.clear();
    delete api.defaults.headers.common.Authorization;
  }
}
