import { api } from '../lib/http';
import type { User } from '../types/models';

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
  permissions: string[];
};

export type MeResponse = {
  user: User;
  permissions: string[];
};

export async function login(payload: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  return data;
}

export async function me(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export async function logout(): Promise<{ status: string }> {
  const { data } = await api.post<{ status: string }>('/auth/logout');
  return data;
}