import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { Brand } from '../types/models';

export type CatalogQuery = {
  page?: number;
  search?: string;
};

export async function getBrands(params: CatalogQuery = {}) {
  const res = await api.get<LaravelPaginator<Brand>>('/brands', { params });
  return res.data;
}

export type CreateBrandInput = {
  name: string;
  is_active?: boolean;
};

export async function createBrand(input: CreateBrandInput) {
  const res = await api.post<Brand>('/brands', input);
  return res.data;
}
