import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { Product } from '../types/models';

export const PRODUCT_TYPES = [
  'DEVICE',
  'DISPOSABLE',
  'POD_CARTRIDGE',
  'JUICE_FREEBASE',
  'JUICE_SALT',
  'COIL_ACCESSORY',
] as const;

export type ProductType = string;

export type ProductsQuery = {
  page?: number;
  per_page?: number;
  search?: string;
  brand_id?: number;
  product_type?: ProductType;
  include_inactive?: boolean | 1;
  only_inactive?: boolean | 1;
};

export type CreateProductInput = {
  name: string;
  product_type: ProductType;
  brand_id: number;
  description?: string | null;
  base_price?: number | null;
  is_active?: boolean;
};

export type UpdateProductInput = {
  name?: string;
  product_type?: ProductType;
  brand_id?: number;
  description?: string | null;
  base_price?: number | null;
};

export async function getProducts(params: ProductsQuery) {
  const res = await api.get<LaravelPaginator<Product>>('/products', { params });
  return res.data;
}

export async function createProduct(input: CreateProductInput) {
  const res = await api.post<Product>('/products', input);
  return res.data;
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const res = await api.put<Product>(`/products/${id}`, input);
  return res.data;
}

export async function disableProduct(id: number) {
  const res = await api.delete<{ status: string }>(`/products/${id}`);
  return res.data;
}

export async function enableProduct(id: number) {
  const res = await api.post<{ status: string }>(`/products/${id}/enable`);
  return res.data;
}

export async function purgeProduct(id: number) {
  const res = await api.delete<{ status: string }>(`/products/${id}/purge`);
  return res.data;
}
