import { api } from '../lib/http';
import type { Branch } from '../types/models';

export type BranchesQuery = {
  include_inactive?: boolean;
};

export type BranchInput = {
  code: string;
  name: string;
  address?: string | null;
  locator?: string | null;
  cellphone_no?: string | null;
  is_active?: boolean;
};

export type BranchUpdateInput = Partial<BranchInput>;

export async function getBranches(params: BranchesQuery = {}): Promise<Branch[]> {
  const { data } = await api.get<Branch[]>('/branches', { params });
  return data;
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const { data } = await api.post<Branch>('/branches', input);
  return data;
}

export async function updateBranch(id: number, input: BranchUpdateInput): Promise<Branch> {
  const { data } = await api.put<Branch>(`/branches/${id}`, input);
  return data;
}

