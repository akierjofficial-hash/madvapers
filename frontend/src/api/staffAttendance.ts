import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { StaffAttendance, User, UserBranch } from '../types/models';

export type StaffAttendanceQuery = {
  page?: number;
  per_page?: number;
  branch_id?: number;
  user_id?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  date_from?: string;
  date_to?: string;
  search?: string;
  mine?: boolean;
};

export type AttendanceNoteInput = {
  notes?: string | null;
};

export type StaffAttendanceMonthlySummary = {
  user_id: number;
  month: string;
  month_label: string;
  user?: User | null;
  branch?: UserBranch | null;
  present_days: number;
  approved_records: number;
  late_days: number;
  total_late_minutes: number;
  incomplete_logs: number;
  pending_requests: number;
  rejected_requests: number;
  worked_minutes: number;
  open_records: number;
  last_activity_at?: string | null;
};

export type StaffAttendanceMonthlySummaryResponse = LaravelPaginator<StaffAttendanceMonthlySummary> & {
  month: string;
  month_label: string;
};

export type StaffAttendanceMonthlyDetailResponse = {
  status: string;
  month: string;
  month_label: string;
  summary: StaffAttendanceMonthlySummary;
  logs: StaffAttendance[];
};

export async function getStaffAttendances(params: StaffAttendanceQuery) {
  const res = await api.get<LaravelPaginator<StaffAttendance>>('/staff-attendance', { params });
  return res.data;
}

export async function getStaffAttendanceMonthlySummary(params: StaffAttendanceQuery & { month?: string }) {
  const res = await api.get<StaffAttendanceMonthlySummaryResponse>('/staff-attendance/monthly-summary', { params });
  return res.data;
}

export async function getStaffAttendanceMonthlyDetail(
  userId: number,
  params: Pick<StaffAttendanceQuery, 'branch_id'> & { month?: string }
) {
  const res = await api.get<StaffAttendanceMonthlyDetailResponse>(`/staff-attendance/monthly-summary/${userId}`, {
    params,
  });
  return res.data;
}

export async function requestStaffTimeIn(input?: AttendanceNoteInput) {
  const res = await api.post<{ status: string; attendance: StaffAttendance }>(
    '/staff-attendance/time-in',
    input ?? {}
  );
  return res.data;
}

export async function requestStaffTimeOut(input?: AttendanceNoteInput) {
  const res = await api.post<{ status: string; attendance: StaffAttendance }>(
    '/staff-attendance/time-out',
    input ?? {}
  );
  return res.data;
}

export async function approveStaffAttendance(id: number, input?: AttendanceNoteInput) {
  const res = await api.post<{ status: string; attendance: StaffAttendance }>(
    `/staff-attendance/${id}/approve`,
    input ?? {}
  );
  return res.data;
}

export async function rejectStaffAttendance(id: number, input?: AttendanceNoteInput) {
  const res = await api.post<{ status: string; attendance: StaffAttendance }>(
    `/staff-attendance/${id}/reject`,
    input ?? {}
  );
  return res.data;
}

export async function closeStaffAttendance(id: number, input?: AttendanceNoteInput) {
  const res = await api.post<{ status: string; attendance: StaffAttendance }>(
    `/staff-attendance/${id}/close`,
    input ?? {}
  );
  return res.data;
}
