import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type Supplier = { id: number; name: string };

export type PurchaseOrderItem = {
  id: number;
  purchase_order_id: number;
  product_variant_id: number;

  qty_ordered: string; // backend decimal string
  qty_received: string | null;
  unit_cost: string | null;
  notes: string | null;

  variant?: any; // present in GET /purchase-orders/{id}
};

export type PurchaseOrder = {
  id: number;
  branch_id: number;
  supplier_id: number;
  status: PurchaseOrderStatus;

  reference_no?: string | null;
  notes: string | null;

  created_at?: string;
  updated_at?: string;

  supplier?: Supplier | null;
  items?: PurchaseOrderItem[];
  branch?: { id: number; code?: string | null; name: string } | null;
};

export type PurchaseOrdersQuery = {
  page?: number;
  branch_id?: number;
  status?: string;
  search?: string;
};

export async function getPurchaseOrders(params: PurchaseOrdersQuery) {
  const res = await api.get<LaravelPaginator<PurchaseOrder>>('/purchase-orders', { params });
  return res.data;
}

export async function getPurchaseOrder(id: number) {
  const res = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return res.data;
}

export type CreatePurchaseOrderItemInput = {
  product_variant_id: number;
  qty_ordered: number;
  unit_cost: number; // required by backend
  notes?: string | null;
};

export type CreatePurchaseOrderInput = {
  branch_id: number;
  supplier_id: number;
  reference_no?: string | null;
  notes?: string | null;
  items: CreatePurchaseOrderItemInput[];
};

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const res = await api.post<PurchaseOrder>('/purchase-orders', input);
  return res.data;
}

export async function submitPurchaseOrder(id: number) {
  const res = await api.post<{ status: string; purchase_order: PurchaseOrder }>(`/purchase-orders/${id}/submit`);
  return res.data;
}

export async function approvePurchaseOrder(id: number) {
  const res = await api.post<{ status: string; purchase_order: PurchaseOrder }>(`/purchase-orders/${id}/approve`);
  return res.data;
}

export type ReceivePurchaseOrderPayload = {
  notes?: string | null;
  lines?: { product_variant_id: number; qty_received: number }[];
};

export async function receivePurchaseOrder(id: number, payload?: ReceivePurchaseOrderPayload) {
  const res = await api.post<{ status: string; purchase_order: PurchaseOrder }>(
    `/purchase-orders/${id}/receive`,
    payload ?? {}
  );
  return res.data;
}