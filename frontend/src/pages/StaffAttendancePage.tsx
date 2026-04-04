import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { StaffAttendance } from '../types/models';
import {
  useApproveStaffAttendanceMutation,
  useBranchesQuery,
  useCloseStaffAttendanceMutation,
  useRejectStaffAttendanceMutation,
  useStaffAttendanceQuery,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
};

function parseError(error: unknown, fallback: string) {
  const e = error as ApiErrorLike;
  const status = Number(e?.response?.status ?? 0);
  if (status === 404) {
    return 'Attendance API endpoint not found. Backend may be outdated on this deployment.';
  }
  if (status === 403) {
    return 'You are not allowed to access this attendance view.';
  }

  const message = e?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;

  const errors = e?.response?.data?.errors;
  if (errors) {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    if (firstMsg) return firstMsg;
  }

  return fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function statusColor(status: string): 'default' | 'warning' | 'success' | 'error' {
  const key = String(status ?? '').toUpperCase();
  if (key === 'PENDING') return 'warning';
  if (key === 'APPROVED') return 'success';
  if (key === 'REJECTED') return 'error';
  return 'default';
}

function normalizeStatus(status?: string | null): string {
  const value = String(status ?? '').trim().toUpperCase();
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export function StaffAttendancePage() {
  const { can } = useAuth();
  const canView = can('STAFF_ATTENDANCE_VIEW');
  const canApprove = can('STAFF_ATTENDANCE_APPROVE');
  const canBranchView = can('BRANCH_VIEW');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED'>('');
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const branchesQuery = useBranchesQuery(canBranchView);

  const attendanceQuery = useStaffAttendanceQuery(
    {
      page,
      status: status || undefined,
      search: search.trim() || undefined,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
    },
    canView
  );
  const approveMut = useApproveStaffAttendanceMutation();
  const rejectMut = useRejectStaffAttendanceMutation();
  const closeMut = useCloseStaffAttendanceMutation();

  const rows = attendanceQuery.data?.data ?? [];
  const totalPages = attendanceQuery.data?.last_page ?? 1;
  const attendanceLoadError = attendanceQuery.isError
    ? parseError(attendanceQuery.error, 'Failed to load staff attendance records.')
    : '';
  const pendingByAdminCount = useMemo(
    () =>
      rows.filter((row) => String(row.clock_in_status ?? '').toUpperCase() === 'PENDING' && !row.clock_out_at)
        .length,
    [rows]
  );

  const showSnack = (message: string, severity: SnackState['severity']) => {
    setSnack({
      open: true,
      message,
      severity,
    });
  };

  const handleApprove = async (row: StaffAttendance) => {
    try {
      await approveMut.mutateAsync({ id: row.id });
      showSnack(`Approved time-in request #${row.id}.`, 'success');
    } catch (error) {
      showSnack(parseError(error, `Failed to approve request #${row.id}.`), 'error');
    }
  };

  const handleReject = async (row: StaffAttendance) => {
    try {
      await rejectMut.mutateAsync({ id: row.id });
      showSnack(`Rejected time-in request #${row.id}.`, 'info');
    } catch (error) {
      showSnack(parseError(error, `Failed to reject request #${row.id}.`), 'error');
    }
  };

  const handleClose = async (row: StaffAttendance) => {
    try {
      await closeMut.mutateAsync({ id: row.id });
      showSnack(`Closed time-in request #${row.id}.`, 'success');
    } catch (error) {
      showSnack(parseError(error, `Failed to close request #${row.id}.`), 'error');
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view staff attendance.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        alignItems={{ xs: 'stretch', lg: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack spacing={0.4}>
          <Typography variant="h5">Staff Attendance</Typography>
          <Typography variant="body2" color="text.secondary">
            Track time-in approvals, time-out, and lateness for payroll review.
          </Typography>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
          <TextField
            size="small"
            label="Search staff"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { md: 220 }, flex: 1 }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED');
              setPage(1);
            }}
            sx={{ width: { xs: '100%', md: 190 } }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="REJECTED">Rejected</MenuItem>
            <MenuItem value="CLOSED">Closed (timed out)</MenuItem>
          </TextField>
          {canBranchView && (
            <TextField
              select
              size="small"
              label="Branch"
              value={branchId}
              onChange={(e) => {
                const value = e.target.value;
                setBranchId(value === '' ? '' : Number(value));
                setPage(1);
              }}
              sx={{ width: { xs: '100%', md: 220 } }}
            >
              <MenuItem value="">All branches</MenuItem>
              {(branchesQuery.data ?? []).map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </Paper>

      {canApprove && (
        <Alert severity={pendingByAdminCount > 0 ? 'warning' : 'success'}>
          {pendingByAdminCount > 0
            ? `${pendingByAdminCount} pending request(s) in this view need approval.`
            : 'No pending time-in requests in this view.'}
        </Alert>
      )}

      {attendanceQuery.isLoading ? (
        <Alert severity="info">Loading staff attendance...</Alert>
      ) : attendanceQuery.isError ? (
        <Alert severity="error">{attendanceLoadError}</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No attendance records found for the selected filters.</Alert>
      ) : (
        <Stack spacing={1}>
          {rows.map((row) => {
            const statusKey = String(row.clock_in_status ?? '').toUpperCase();
            const isPending = statusKey === 'PENDING' && !row.clock_out_at;
            const isOpen = !row.clock_out_at && (statusKey === 'PENDING' || statusKey === 'APPROVED');
            const reviewerName = row.reviewed_by?.name || row.reviewedBy?.name || '-';
            return (
              <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
                <Stack spacing={0.7}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    spacing={1}
                  >
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                      ATT-{String(row.id).padStart(6, '0')}
                    </Typography>
                    <Stack direction="row" spacing={0.7}>
                      <Chip size="small" color={statusColor(statusKey)} label={normalizeStatus(statusKey)} />
                      {row.clock_out_at ? <Chip size="small" color="default" label="Timed Out" /> : null}
                    </Stack>
                  </Stack>

                  <Typography variant="body2">
                    Staff: <b>{row.user?.name ?? '-'}</b> ({row.user?.email ?? '-'})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Branch: {row.branch?.name ?? '-'} | Requested: {formatDateTime(row.clock_in_requested_at)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Scheduled start: {formatDateTime(row.scheduled_start_at)} | Lateness:{' '}
                    {row.late_minutes !== null && row.late_minutes !== undefined
                      ? row.late_minutes > 0
                        ? `${row.late_minutes} minute(s) late`
                        : 'On time'
                      : '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reviewed: {formatDateTime(row.reviewed_at)} by {reviewerName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Time out: {formatDateTime(row.clock_out_at)}
                  </Typography>
                  {row.request_notes ? (
                    <Typography variant="body2" color="text.secondary">
                      Request note: {row.request_notes}
                    </Typography>
                  ) : null}
                  {row.review_notes ? (
                    <Typography variant="body2" color="text.secondary">
                      Review note: {row.review_notes}
                    </Typography>
                  ) : null}

                  {canApprove && isPending && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={approveMut.isPending || rejectMut.isPending}
                        onClick={() => void handleReject(row)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        disabled={approveMut.isPending || rejectMut.isPending || closeMut.isPending}
                        onClick={() => void handleClose(row)}
                      >
                        {closeMut.isPending ? 'Closing...' : 'Close'}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={approveMut.isPending || rejectMut.isPending || closeMut.isPending}
                        onClick={() => void handleApprove(row)}
                      >
                        Approve
                      </Button>
                    </Stack>
                  )}
                  {canApprove && isOpen && !isPending && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        disabled={closeMut.isPending}
                        onClick={() => void handleClose(row)}
                      >
                        {closeMut.isPending ? 'Closing...' : 'Close Time In'}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            showFirstButton
            showLastButton
          />
        </Stack>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={2400}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
