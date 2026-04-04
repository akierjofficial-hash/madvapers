import { api } from '../lib/http';
import type { LaravelPaginator } from '../types/api';
import type { StaffAttendance } from '../types/models';

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

export async function getStaffAttendances(params: StaffAttendanceQuery) {
  const res = await api.get<LaravelPaginator<StaffAttendance>>('/staff-attendance', { params });
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
