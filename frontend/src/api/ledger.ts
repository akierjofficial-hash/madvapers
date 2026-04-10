import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { StockLedger } from '../types/models';

export type LedgerQuery = {
  branch_id: number;
  page?: number;
  per_page?: number;
  movement_type?: string;
  product_variant_id?: number;
  date_from?: string;
  date_to?: string;

  ref_type?: string;
  ref_id?: number;

  // ✅ NEW: server-side search
  search?: string;
};

export async function getLedger(params: LedgerQuery) {
  const res = await api.get<LaravelPaginator<StockLedger>>('/ledger', { params });
  return res.data;
}
