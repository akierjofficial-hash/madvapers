import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type TransferItem = {
  id: number;
  transfer_id: number;
  product_variant_id: number;
  qty: string; // decimal string from backend
  unit_cost: string | null;
  variant?: any; // present in GET /transfers/{id}
};

export type Transfer = {
  id: number;
  from_branch_id: number;
  to_branch_id: number;
  status: string;
  reference_no?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;

  items?: TransferItem[];
  fromBranch?: { id: number; code: string; name: string } | null;
  toBranch?: { id: number; code: string; name: string } | null;
};

export type TransferBranchOption = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
};

export type TransferBranchOptionsResponse = {
  from_branches: TransferBranchOption[];
  to_branches: TransferBranchOption[];
};

type TransferActionResponse = {
  status: string;
  transfer: Transfer;
};

function unwrapTransfer(payload: Transfer | TransferActionResponse): Transfer {
  if (payload && typeof payload === 'object' && 'transfer' in payload) {
    return payload.transfer;
  }

  return payload;
}

export type TransfersQuery = {
  page?: number;
  from_branch_id?: number;
  to_branch_id?: number;
  status?: string;
};

export async function getTransfers(params: TransfersQuery) {
  const res = await api.get<LaravelPaginator<Transfer>>('/transfers', { params });
  return res.data;
}

export async function getTransferBranchOptions() {
  const res = await api.get<TransferBranchOptionsResponse>('/transfers/branch-options');
  return res.data;
}

export async function getTransfer(id: number) {
  const res = await api.get<Transfer>(`/transfers/${id}`);
  return res.data;
}

export type CreateTransferItemInput = {
  product_variant_id: number;
  qty: number;
};

export type CreateTransferInput = {
  from_branch_id: number;
  to_branch_id: number;
  notes?: string | null;
  items: CreateTransferItemInput[];
};

export async function createTransfer(input: CreateTransferInput) {
  const res = await api.post<Transfer>('/transfers', input);
  return res.data;
}

export async function requestTransfer(id: number) {
  const res = await api.post<Transfer | TransferActionResponse>(`/transfers/${id}/request`);
  return unwrapTransfer(res.data);
}

export async function approveTransfer(id: number) {
  const res = await api.post<Transfer | TransferActionResponse>(`/transfers/${id}/approve`);
  return unwrapTransfer(res.data);
}

export async function dispatchTransfer(id: number) {
  const res = await api.post<Transfer | TransferActionResponse>(`/transfers/${id}/dispatch`);
  return unwrapTransfer(res.data);
}

export async function receiveTransfer(id: number) {
  const res = await api.post<Transfer | TransferActionResponse>(`/transfers/${id}/receive`);
  return unwrapTransfer(res.data);
}

export async function cancelTransfer(id: number) {
  const res = await api.post<Transfer | TransferActionResponse>(`/transfers/${id}/cancel`);
  return unwrapTransfer(res.data);
}
