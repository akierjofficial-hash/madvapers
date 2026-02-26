import { api } from '../lib/http';

export type Supplier = {
  id: number;
  name: string;
};

export type SupplierInput = {
  name: string;
};

export async function getSuppliers(): Promise<Supplier[]> {
  const res = await api.get('/suppliers');
  return res.data;
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const res = await api.post('/suppliers', input);
  return res.data;
}

export async function updateSupplier(id: number, input: SupplierInput): Promise<Supplier> {
  const res = await api.put(`/suppliers/${id}`, input);
  return res.data;
}

export async function deleteSupplier(id: number): Promise<{ status: string }> {
  const res = await api.delete(`/suppliers/${id}`);
  return res.data;
}
