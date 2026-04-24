import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import type { StaffAttendance, User } from '../types/models';
import {
  useApproveStaffAttendanceMutation,
  useBranchesQuery,
  useCloseStaffAttendanceMutation,
  useRejectStaffAttendanceMutation,
  useStaffAttendanceMonthlyDetailQuery,
  useStaffAttendanceMonthlySummaryQuery,
  useStaffAttendanceQuery,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

type AttendanceTab = 'summary' | 'logs';

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

function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMinutes(minutes?: number | null): string {
  const total = Math.max(0, Number(minutes ?? 0));
  if (!Number.isFinite(total) || total <= 0) return '0m';
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  if (hours <= 0) return `${remaining}m`;
  if (remaining <= 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
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

function roleLabel(user?: User | null): string {
  const code = String(user?.role?.name ?? user?.role?.code ?? '').trim();
  return code || 'Staff';
}

export function StaffAttendancePage() {
  const { can } = useAuth();
  const canView = can('STAFF_ATTENDANCE_VIEW');
  const canApprove = can('STAFF_ATTENDANCE_APPROVE');
  const canBranchView = can('BRANCH_VIEW');

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [tab, setTab] = useState<AttendanceTab>('summary');
  const [summaryPage, setSummaryPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [status, setStatus] = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED'>('');
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState<number | ''>('');
  const [month, setMonth] = useState(currentMonth);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const branchesQuery = useBranchesQuery(canBranchView);

  const monthlySummaryQuery = useStaffAttendanceMonthlySummaryQuery(
    {
      page: summaryPage,
      month,
      search: search.trim() || undefined,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      per_page: 12,
    },
    canView && tab === 'summary'
  );

  const attendanceQuery = useStaffAttendanceQuery(
    {
      page: logsPage,
      status: status || undefined,
      search: search.trim() || undefined,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
    },
    canView && tab === 'logs'
  );

  const monthlyDetailQuery = useStaffAttendanceMonthlyDetailQuery(
    selectedUserId,
    {
      month,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
    },
    canView && !!selectedUserId
  );

  const approveMut = useApproveStaffAttendanceMutation();
  const rejectMut = useRejectStaffAttendanceMutation();
  const closeMut = useCloseStaffAttendanceMutation();

  const summaryRows = monthlySummaryQuery.data?.data ?? [];
  const summaryTotalPages = monthlySummaryQuery.data?.last_page ?? 1;
  const summaryLoadError = monthlySummaryQuery.isError
    ? parseError(monthlySummaryQuery.error, 'Failed to load monthly attendance summary.')
    : '';

  const logsRows = attendanceQuery.data?.data ?? [];
  const logsTotalPages = attendanceQuery.data?.last_page ?? 1;
  const attendanceLoadError = attendanceQuery.isError
    ? parseError(attendanceQuery.error, 'Failed to load staff attendance records.')
    : '';

  const pendingByAdminCount = useMemo(
    () =>
      logsRows.filter((row) => String(row.clock_in_status ?? '').toUpperCase() === 'PENDING' && !row.clock_out_at)
        .length,
    [logsRows]
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

  const selectedSummary = monthlyDetailQuery.data?.summary;

  return (
    <Stack spacing={2}>
      <Stack spacing={0.4}>
        <Typography variant="h5">Staff Attendance</Typography>
        <Typography variant="body2" color="text.secondary">
          Review monthly DTR totals for payroll, then drill into each staff member&apos;s daily logs when you need the details.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 0.6 }}>
        <Tabs
          value={tab}
          onChange={(_, next: AttendanceTab) => {
            setTab(next);
            if (next === 'summary') {
              setSummaryPage(1);
            } else {
              setLogsPage(1);
            }
          }}
          variant="fullWidth"
        >
          <Tab value="summary" label="Monthly Summary" />
          <Tab value="logs" label="Daily Logs / Approvals" />
        </Tabs>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
          {tab === 'summary' && (
            <TextField
              size="small"
              type="month"
              label="Month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setSummaryPage(1);
                setSelectedUserId(null);
              }}
              sx={{ width: { xs: '100%', md: 180 } }}
              InputLabelProps={{ shrink: true }}
            />
          )}
          <TextField
            size="small"
            label={tab === 'summary' ? 'Search staff' : 'Search staff'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSummaryPage(1);
              setLogsPage(1);
            }}
            sx={{ minWidth: { md: 220 }, flex: 1 }}
          />
          {canBranchView && (
            <TextField
              select
              size="small"
              label="Branch"
              value={branchId}
              onChange={(e) => {
                const value = e.target.value;
                setBranchId(value === '' ? '' : Number(value));
                setSummaryPage(1);
                setLogsPage(1);
                setSelectedUserId(null);
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
          {tab === 'logs' && (
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED');
                setLogsPage(1);
              }}
              sx={{ width: { xs: '100%', md: 190 } }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
              <MenuItem value="CLOSED">Closed (timed out)</MenuItem>
            </TextField>
          )}
        </Stack>
      </Paper>

      {tab === 'summary' ? (
        <>
          <Alert severity="info">
            Monthly Summary is built from approved time-ins, pending requests, rejections, lateness, and recorded time-outs. We are not calculating undertime yet because the current attendance setup has no shift-end rule stored.
          </Alert>

          {monthlySummaryQuery.isLoading ? (
            <Alert severity="info">Loading monthly attendance summary...</Alert>
          ) : monthlySummaryQuery.isError ? (
            <Alert severity="error">{summaryLoadError}</Alert>
          ) : summaryRows.length === 0 ? (
            <Alert severity="warning">No attendance records found for the selected month and filters.</Alert>
          ) : (
            <Stack spacing={1}>
              {summaryRows.map((row) => (
                <Paper
                  key={row.user_id}
                  variant="outlined"
                  sx={{ p: 1.3, cursor: 'pointer' }}
                  onClick={() => setSelectedUserId(row.user_id)}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {row.user?.name ?? 'Unknown Staff'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {row.user?.email ?? '-'} | {roleLabel(row.user)} | {row.branch?.name ?? 'Unassigned branch'}
                        </Typography>
                      </Box>
                      <Chip size="small" color={row.pending_requests > 0 ? 'warning' : 'default'} label={row.month_label} />
                    </Stack>

                    <Stack direction="row" flexWrap="wrap" gap={0.8}>
                      <Chip size="small" color="success" variant="outlined" label={`Present ${row.present_days}`} />
                      <Chip size="small" color="warning" variant="outlined" label={`Late days ${row.late_days}`} />
                      <Chip size="small" variant="outlined" label={`Late ${formatMinutes(row.total_late_minutes)}`} />
                      <Chip size="small" variant="outlined" label={`Worked ${formatMinutes(row.worked_minutes)}`} />
                      <Chip size="small" color={row.incomplete_logs > 0 ? 'warning' : 'default'} variant="outlined" label={`Incomplete ${row.incomplete_logs}`} />
                      <Chip size="small" color={row.pending_requests > 0 ? 'warning' : 'default'} variant="outlined" label={`Pending ${row.pending_requests}`} />
                      <Chip size="small" color={row.rejected_requests > 0 ? 'error' : 'default'} variant="outlined" label={`Rejected ${row.rejected_requests}`} />
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      Last activity: {formatDateTime(row.last_activity_at)}. Click to open daily DTR details.
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          {summaryTotalPages > 1 && (
            <Stack alignItems="center">
              <Pagination
                count={summaryTotalPages}
                page={summaryPage}
                onChange={(_, next) => setSummaryPage(next)}
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      ) : (
        <>
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
          ) : logsRows.length === 0 ? (
            <Alert severity="warning">No attendance records found for the selected filters.</Alert>
          ) : (
            <Stack spacing={1}>
              {logsRows.map((row) => {
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

          {logsTotalPages > 1 && (
            <Stack alignItems="center">
              <Pagination
                count={logsTotalPages}
                page={logsPage}
                onChange={(_, next) => setLogsPage(next)}
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      )}

      <Drawer
        anchor="right"
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 520 },
            p: 2,
          },
        }}
      >
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Daily DTR</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedSummary?.user?.name ?? 'Loading staff...'} | {monthlyDetailQuery.data?.month_label ?? month}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setSelectedUserId(null)}>
              Close
            </Button>
          </Stack>

          <Divider />

          {monthlyDetailQuery.isLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading monthly DTR details...
              </Typography>
            </Stack>
          ) : monthlyDetailQuery.isError ? (
            <Alert severity="error">
              {parseError(monthlyDetailQuery.error, 'Failed to load monthly DTR detail.')}
            </Alert>
          ) : monthlyDetailQuery.data ? (
            <>
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selectedSummary?.user?.name ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSummary?.user?.email ?? '-'} | {roleLabel(selectedSummary?.user)} |{' '}
                    {selectedSummary?.branch?.name ?? 'Unassigned branch'}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.8}>
                    <Chip size="small" color="success" variant="outlined" label={`Present ${selectedSummary?.present_days ?? 0}`} />
                    <Chip size="small" color="warning" variant="outlined" label={`Late ${selectedSummary?.late_days ?? 0}`} />
                    <Chip size="small" variant="outlined" label={`Late mins ${formatMinutes(selectedSummary?.total_late_minutes ?? 0)}`} />
                    <Chip size="small" variant="outlined" label={`Worked ${formatMinutes(selectedSummary?.worked_minutes ?? 0)}`} />
                    <Chip size="small" variant="outlined" label={`Incomplete ${selectedSummary?.incomplete_logs ?? 0}`} />
                    <Chip size="small" variant="outlined" label={`Pending ${selectedSummary?.pending_requests ?? 0}`} />
                    <Chip size="small" variant="outlined" label={`Rejected ${selectedSummary?.rejected_requests ?? 0}`} />
                  </Stack>
                </Stack>
              </Paper>

              <Typography variant="subtitle2">Daily Logs</Typography>
              <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5 }}>
                {monthlyDetailQuery.data.logs.length === 0 ? (
                  <Alert severity="warning">No attendance records found for this month.</Alert>
                ) : (
                  monthlyDetailQuery.data.logs.map((log) => (
                    <Paper key={log.id} variant="outlined" sx={{ p: 1.2 }}>
                      <Stack spacing={0.7}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Typography variant="subtitle2">
                            {formatDateOnly(log.attendance_date ?? log.clock_in_requested_at)}
                          </Typography>
                          <Stack direction="row" spacing={0.7}>
                            <Chip size="small" color={statusColor(log.clock_in_status)} label={normalizeStatus(log.clock_in_status)} />
                            {log.clock_out_at ? <Chip size="small" label="Timed Out" /> : null}
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Scheduled start: {formatDateTime(log.scheduled_start_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Time in requested: {formatDateTime(log.clock_in_requested_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Time out: {formatDateTime(log.clock_out_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Lateness: {log.late_minutes && log.late_minutes > 0 ? `${log.late_minutes} minute(s)` : 'On time'} | Worked: {formatMinutes(log.worked_minutes)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Reviewed: {formatDateTime(log.reviewed_at)} by {log.reviewed_by?.name || log.reviewedBy?.name || '-'}
                        </Typography>
                        {log.request_notes ? (
                          <Typography variant="body2" color="text.secondary">
                            Request note: {log.request_notes}
                          </Typography>
                        ) : null}
                        {log.review_notes ? (
                          <Typography variant="body2" color="text.secondary">
                            Review note: {log.review_notes}
                          </Typography>
                        ) : null}
                        {log.clock_out_notes ? (
                          <Typography variant="body2" color="text.secondary">
                            Time-out note: {log.clock_out_notes}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Drawer>

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
