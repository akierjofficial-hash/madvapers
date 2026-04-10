import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type StockHistoryDay = {
  date: string;
  label: string;
  day: number;
};

export type StockHistoryRow = {
  product_variant_id: number;
  product_id: number;
  product_name: string;
  product_type?: string | null;
  brand_name?: string | null;
  sku: string;
  barcode?: string | null;
  variant_name?: string | null;
  flavor?: string | null;
  product_is_active: boolean;
  variant_is_active: boolean;
  opening_qty: number;
  month_net_qty: number;
  ending_qty: number;
  daily_net: Record<string, number>;
  closing_by_day: Record<string, number>;
};

export type StockHistoryResponse = LaravelPaginator<StockHistoryRow> & {
  month: string;
  month_label: string;
  branch_id: number;
  days: StockHistoryDay[];
};

export type StockHistoryQuery = {
  branch_id: number;
  month?: string;
  search?: string;
  page?: number;
  per_page?: number;
};

export async function getStockHistory(params: StockHistoryQuery): Promise<StockHistoryResponse> {
  const { data } = await api.get<StockHistoryResponse>('/stock-history', { params });
  return data;
}
