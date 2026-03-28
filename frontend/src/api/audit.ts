import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';

export type AuditEvent = {
  id: number;
  event_type: string;
  entity_type?: string | null;
  entity_id?: number | null;
  branch_id?: number | null;
  user_id?: number | null;
  summary?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: {
    id: number;
    name?: string | null;
    email?: string | null;
  } | null;
  branch?: {
    id: number;
    code?: string | null;
    name?: string | null;
  } | null;
};

export type AuditEventsQuery = {
  page?: number;
  per_page?: number;
  branch_id?: number;
  event_type?: string;
  entity_type?: string;
  entity_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export async function getAuditEvents(params: AuditEventsQuery) {
  const res = await api.get<LaravelPaginator<AuditEvent>>('/audit/events', { params });
  return res.data;
}

