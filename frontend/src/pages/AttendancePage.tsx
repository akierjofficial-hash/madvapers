import {
  Alert,
  Box,
  Button,
  Chip,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useRequestStaffTimeInMutation, useRequestStaffTimeOutMutation, useStaffAttendanceQuery } from '../api/queries';
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
    return 'You are not allowed to view attendance records.';
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

export function AttendancePage() {
  const { can } = useAuth();
  const canView = can('STAFF_ATTENDANCE_VIEW');
  const canClock = can('STAFF_ATTENDANCE_CLOCK');

  const [page, setPage] = useState(1);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const attendanceQuery = useStaffAttendanceQuery(
    {
      page,
      mine: true,
      per_page: 20,
    },
    canView
  );

  const requestTimeInMut = useRequestStaffTimeInMutation();
  const requestTimeOutMut = useRequestStaffTimeOutMutation();
  const rows = attendanceQuery.data?.data ?? [];
  const totalPages = attendanceQuery.data?.last_page ?? 1;
  const attendanceLoadError = attendanceQuery.isError
    ? parseError(attendanceQuery.error, 'Failed to load attendance records.')
    : '';

  const openAttendance = useMemo(() => {
    return rows.find((row) => {
      const statusKey = String(row.clock_in_status ?? '').toUpperCase();
      return !row.clock_out_at && (statusKey === 'PENDING' || statusKey === 'APPROVED');
    });
  }, [rows]);

  const openStatus = String(openAttendance?.clock_in_status ?? '').toUpperCase();
  const hasPending = openStatus === 'PENDING';
  const hasApproved = openStatus === 'APPROVED';

  const showSnack = (message: string, severity: SnackState['severity']) => {
    setSnack({ open: true, message, severity });
  };

  const handleRequestTimeIn = async () => {
    try {
      await requestTimeInMut.mutateAsync(undefined);
      showSnack('Time-in request submitted. Waiting for admin approval.', 'success');
      setPage(1);
    } catch (error) {
      showSnack(parseError(error, 'Failed to request time-in.'), 'error');
    }
  };

  const handleTimeOut = async () => {
    try {
      await requestTimeOutMut.mutateAsync(undefined);
      showSnack('Time-out recorded.', 'success');
      setPage(1);
    } catch (error) {
      showSnack(parseError(error, 'Failed to record time-out.'), 'error');
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view attendance records.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Box>
          <Typography variant="h5">Attendance</Typography>
          <Typography variant="body2" color="text.secondary">
            Daily time record (DTR) for your time-in and time-out history.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            onClick={() => void handleRequestTimeIn()}
            disabled={!canClock || hasPending || hasApproved || requestTimeInMut.isPending}
          >
            {requestTimeInMut.isPending ? 'Submitting...' : 'Time In'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => void handleTimeOut()}
            disabled={!canClock || !hasApproved || requestTimeOutMut.isPending}
          >
            {requestTimeOutMut.isPending ? 'Saving...' : 'Time Out'}
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Typography variant="subtitle2">Current status:</Typography>
          <Chip
            size="small"
            color={statusColor(openStatus)}
            label={
              !openAttendance
                ? 'No active shift'
                : openStatus === 'PENDING'
                ? 'Pending admin approval'
                : 'Timed in'
            }
          />
          {openAttendance ? (
            <Typography variant="body2" color="text.secondary">
              Requested: {formatDateTime(openAttendance.clock_in_requested_at)}
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {attendanceQuery.isLoading ? (
        <Alert severity="info">Loading attendance records...</Alert>
      ) : attendanceQuery.isError ? (
        <Alert severity="error">{attendanceLoadError}</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No attendance records yet.</Alert>
      ) : (
        <Stack spacing={1}>
          {rows.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
              <Stack spacing={0.7}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    ATT-{String(row.id).padStart(6, '0')}
                  </Typography>
                  <Stack direction="row" spacing={0.7}>
                    <Chip size="small" color={statusColor(row.clock_in_status)} label={normalizeStatus(row.clock_in_status)} />
                    {row.clock_out_at ? <Chip size="small" label="Timed Out" /> : null}
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Branch: {row.branch?.name ?? '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Time in requested: {formatDateTime(row.clock_in_requested_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reviewed: {formatDateTime(row.reviewed_at)} by {row.reviewed_by?.name || row.reviewedBy?.name || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Time out: {formatDateTime(row.clock_out_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lateness:{' '}
                  {row.late_minutes !== null && row.late_minutes !== undefined
                    ? row.late_minutes > 0
                      ? `${row.late_minutes} minute(s) late`
                      : 'On time'
                    : '-'}
                </Typography>
              </Stack>
            </Paper>
          ))}
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
