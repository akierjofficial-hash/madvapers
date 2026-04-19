import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type SaleStatus = 'DRAFT' | 'POSTED' | 'VOIDED';
export type SalePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type SaleVoidRequestStatus = 'PENDING' | 'REJECTED' | 'APPROVED';

export type SaleItem = {
  id: number;
  sale_id: number;
  product_variant_id: number;
  qty: string | number;
  unit_price: string | number;
  line_discount: string | number;
  line_tax: string | number;
  line_total: string | number;
  unit_cost_snapshot?: string | number | null;
  line_cogs?: string | number | null;
  notes?: string | null;
  variant?: any;
};

export type SalePayment = {
  id: number;
  sale_id: number;
  method: string;
  amount: string | number;
  paid_at?: string | null;
  reference_no?: string | null;
  client_txn_id?: string | null;
  notes?: string | null;
  received_by_user_id?: number | null;
  received_by?: any;
  receivedBy?: any;
};

export type Sale = {
  id: number;
  sale_number?: string | null;
  branch_id: number;
  status: SaleStatus;
  payment_status: SalePaymentStatus;
  void_request_status?: SaleVoidRequestStatus | null;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  sf_charge?: string | number;
  grand_total: string | number;
  paid_total: string | number;
  change_given: string | number;
  cashier_user_id?: number | null;
  posted_by_user_id?: number | null;
  voided_by_user_id?: number | null;
  posted_at?: string | null;
  voided_at?: string | null;
  void_requested_at?: string | null;
  void_rejected_at?: string | null;
  void_request_notes?: string | null;
  void_rejection_notes?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  items_count?: number;
  total_qty?: string | number;
  branch?: { id: number; code?: string | null; name: string } | null;
  cashier?: { id: number; name: string } | null;
  posted_by?: { id: number; name: string } | null;
  postedBy?: { id: number; name: string } | null;
  voided_by?: { id: number; name: string } | null;
  voidedBy?: { id: number; name: string } | null;
  void_requested_by_user_id?: number | null;
  void_requested_by?: { id: number; name: string } | null;
  voidRequestedBy?: { id: number; name: string } | null;
  void_rejected_by_user_id?: number | null;
  void_rejected_by?: { id: number; name: string } | null;
  voidRejectedBy?: { id: number; name: string } | null;
  items?: SaleItem[];
  payments?: SalePayment[];
};

export type SalesQuery = {
  page?: number;
  branch_id?: number;
  status?: string;
  payment_status?: string;
  void_request_status?: string;
  search?: string;
  cashier_search?: string;
  date_from?: string;
  date_to?: string;
  include_items?: boolean | 0 | 1;
};

export type SaleDailyTotal = {
  sale_date: string;
  transactions_count: string | number;
  items_sold: string | number;
  gross_total: string | number;
  discount_total: string | number;
  net_sales: string | number;
  paid_total: string | number;
  unpaid_total: string | number;
};

export type CreateSaleInput = {
  branch_id: number;
  notes?: string | null;
  sf_charge?: number;
  items: Array<{
    product_variant_id: number;
    qty: number;
    unit_price: number;
    line_discount?: number;
    line_tax?: number;
    notes?: string | null;
  }>;
};

export type AddSalePaymentInput = {
  method: string;
  amount: number;
  apply_discount_to_settle?: boolean;
  paid_at?: string;
  reference_no?: string | null;
  client_txn_id?: string | null;
  notes?: string | null;
};

export async function getSales(params: SalesQuery) {
  const res = await api.get<LaravelPaginator<Sale>>('/sales', { params });
  return res.data;
}

export async function getSalesDailyTotals(params: SalesQuery) {
  const res = await api.get<LaravelPaginator<SaleDailyTotal>>('/sales/daily-totals', { params });
  return res.data;
}

export async function getSale(id: number) {
  const res = await api.get<Sale>(`/sales/${id}`);
  return res.data;
}

export async function createSale(input: CreateSaleInput) {
  const res = await api.post<Sale>('/sales', input);
  return res.data;
}

export async function postSale(id: number, payload?: { notes?: string | null }) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/post`, payload ?? {});
  return res.data;
}

export async function addSalePayment(id: number, input: AddSalePaymentInput) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/payments`, input);
  return res.data;
}

export async function voidSale(id: number, payload?: { notes?: string | null }) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/void`, payload ?? {});
  return res.data;
}

export async function requestSaleVoid(id: number, payload?: { notes?: string | null }) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/void-request`, payload ?? {});
  return res.data;
}

export async function approveSaleVoidRequest(id: number, payload?: { notes?: string | null }) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/void-approve`, payload ?? {});
  return res.data;
}

export async function rejectSaleVoidRequest(id: number, payload?: { notes?: string | null }) {
  const res = await api.post<{ status: string; sale: Sale }>(`/sales/${id}/void-reject`, payload ?? {});
  return res.data;
}
