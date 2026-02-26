import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { InventoryBalance } from '../types/models';

export type InventoryQuery = {
  branch_id: number;
  page?: number;
  search?: string;
};

export async function getInventory(params: InventoryQuery): Promise<LaravelPaginator<InventoryBalance>> {
  const { data } = await api.get<LaravelPaginator<InventoryBalance>>('/inventory', { params });
  return data;
}
