import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type ExpenseStatus = 'POSTED' | 'VOIDED';

export type Expense = {
  id: number;
  expense_number?: string | null;
  branch_id: number;
  category: string;
  amount: string | number;
  paid_at?: string | null;
  status: ExpenseStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  branch?: { id: number; code?: string | null; name: string } | null;
  created_by?: { id: number; name: string } | null;
  createdBy?: { id: number; name: string } | null;
  voided_by?: { id: number; name: string } | null;
  voidedBy?: { id: number; name: string } | null;
};

export type ExpensesQuery = {
  page?: number;
  branch_id?: number;
  status?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type CreateExpenseInput = {
  branch_id: number;
  category: string;
  amount: number;
  paid_at?: string;
  notes?: string | null;
};

export type UpdateExpenseInput = {
  category?: string;
  amount?: number;
  paid_at?: string;
  notes?: string | null;
};

export async function getExpenses(params: ExpensesQuery) {
  const res = await api.get<LaravelPaginator<Expense>>('/expenses', { params });
  return res.data;
}

export async function getExpense(id: number) {
  const res = await api.get<Expense>(`/expenses/${id}`);
  return res.data;
}

export async function createExpense(input: CreateExpenseInput) {
  const res = await api.post<Expense>('/expenses', input);
  return res.data;
}

export async function updateExpense(id: number, input: UpdateExpenseInput) {
  const res = await api.put<Expense>(`/expenses/${id}`, input);
  return res.data;
}

export async function voidExpense(id: number) {
  const res = await api.post<{ status: string; expense: Expense }>(`/expenses/${id}/void`);
  return res.data;
}

