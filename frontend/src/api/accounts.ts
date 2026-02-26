import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { User, UserRole } from '../types/models';

export type UsersQuery = {
  page?: number;
  search?: string;
  role_id?: number;
  branch_id?: number;
  include_inactive?: boolean;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role_id: number;
  branch_id?: number | null;
  branch_ids?: number[];
  is_active?: boolean;
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  role_id?: number | null;
  branch_id?: number | null;
  branch_ids?: number[];
  is_active?: boolean;
};

export async function getRoles() {
  const res = await api.get<UserRole[]>('/roles');
  return res.data;
}

export async function getUsers(params: UsersQuery) {
  const res = await api.get<LaravelPaginator<User>>('/users', { params });
  return res.data;
}

export async function createUser(input: CreateUserInput) {
  const res = await api.post<User>('/users', input);
  return res.data;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const res = await api.put<User>(`/users/${id}`, input);
  return res.data;
}

export async function setUserPassword(id: number, password: string) {
  const res = await api.post<{ status: string }>(`/users/${id}/password`, { password });
  return res.data;
}

export async function disableUser(id: number) {
  const res = await api.post<{ status: string }>(`/users/${id}/disable`);
  return res.data;
}

export async function enableUser(id: number) {
  const res = await api.post<{ status: string }>(`/users/${id}/enable`);
  return res.data;
}
