import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { Branch, ProductVariant, User } from '../types/models';

export type AdjustmentItemInput = {
  product_variant_id: number;
  qty_delta: number;
  unit_cost?: number | null;
  notes?: string | null;
};

export type CreateAdjustmentInput = {
  branch_id: number;
  reason_code: string;
  reference_no?: string | null;
  notes?: string | null;
  items: AdjustmentItemInput[];
};

export type StockAdjustmentItem = {
  id: number;
  stock_adjustment_id: number;
  product_variant_id: number;
  qty_delta: string; // backend decimal often comes as string
  unit_cost?: string | null;
  notes?: string | null;
  variant?: ProductVariant | null;
};

export type StockAdjustment = {
  id: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | string;
  branch_id: number;
  reason_code: string;
  reference_no?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;
  posted_at?: string | null;

  branch?: Branch | null;
  items?: StockAdjustmentItem[];

  createdBy?: User | null;
  created_by?: User | null;
  approvedBy?: User | null;
  approved_by?: User | null;
  postedBy?: User | null;
  posted_by?: User | null;
};

export type AdjustmentsQuery = {
  branch_id: number;
  status?: string;
  page?: number;
};

export async function getAdjustments(params: AdjustmentsQuery) {
  const res = await api.get<LaravelPaginator<StockAdjustment>>('/adjustments', { params });
  return res.data;
}

export async function getAdjustment(id: number) {
  const res = await api.get<StockAdjustment>(`/adjustments/${id}`);
  return res.data;
}

export async function createAdjustment(input: CreateAdjustmentInput) {
  const res = await api.post<StockAdjustment>('/adjustments', input);
  return res.data;
}

export async function submitAdjustment(id: number) {
  await api.post(`/adjustments/${id}/submit`);
}

export async function approveAdjustment(id: number) {
  await api.post(`/adjustments/${id}/approve`);
}

export async function postAdjustment(id: number) {
  await api.post(`/adjustments/${id}/post`);
}

/**
 * Convenience helper: create -> submit -> approve -> post
 */
export async function quickPostAdjustment(input: CreateAdjustmentInput) {
  const adj = await createAdjustment(input);
  await submitAdjustment(adj.id);
  await approveAdjustment(adj.id);
  await postAdjustment(adj.id);
  return adj;
}
