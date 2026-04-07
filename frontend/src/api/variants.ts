import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { ProductVariant } from '../types/models';

export type VariantsQuery = {
  page?: number;
  search?: string;
  code?: string;
  product_id?: number;
  branch_id?: number;
  include_inactive?: boolean;
};

export type CreateVariantInput = {
  product_id: number;
  sku: string;
  barcode?: string | null;
  variant_name: string;
  flavor?: string | null;
  default_price: number;
};

export type UpdateVariantInput = {
  sku?: string;
  barcode?: string | null;
  variant_name?: string;
  flavor?: string | null;
  default_price?: number;
  default_cost?: number | null;
};

export async function getVariants(params: VariantsQuery) {
  const res = await api.get<LaravelPaginator<ProductVariant>>('/variants', { params });
  return res.data;
}

export async function createVariant(input: CreateVariantInput) {
  const res = await api.post<ProductVariant>('/variants', input);
  return res.data;
}

export async function updateVariant(id: number, input: UpdateVariantInput) {
  const res = await api.put<ProductVariant>(`/variants/${id}`, input);
  return res.data;
}

export async function disableVariant(id: number) {
  const res = await api.delete<{ status: string }>(`/variants/${id}`);
  return res.data;
}

export async function enableVariant(id: number) {
  const res = await api.post<{ status: string }>(`/variants/${id}/enable`);
  return res.data;
}

// NEW: permanent delete (safe purge)
export async function purgeVariant(id: number) {
  const res = await api.delete<{ status: string }>(`/variants/${id}/purge`);
  return res.data;
}
