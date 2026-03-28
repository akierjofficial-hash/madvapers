import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAuditEvents, type AuditEvent } from '../api/audit';
import { useBranchesQuery } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

function toPositiveInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function toDateInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function eventLabel(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'UNKNOWN';
  return raw.replace(/_/g, ' ');
}

function eventTone(eventType: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const code = eventType.toUpperCase();
  if (code.includes('VOID') || code.includes('CANCEL') || code.includes('REJECT')) return 'error';
  if (code.includes('APPROVE') || code.includes('POST') || code.includes('RECEIVE')) return 'success';
  if (code.includes('REQUEST') || code.includes('SUBMIT')) return 'warning';
  return 'info';
}

function describeAuditQueryError(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  const status = Number(err?.response?.status ?? 0);
  const message = String(err?.response?.data?.message ?? '').trim();

  if (status === 403) {
    return 'Not authorized to read audit logs (AUDIT_VIEW).';
  }
  if (status === 500) {
    return message || 'Backend error while loading audit logs. Verify database migrations are up to date.';
  }
  if (status > 0) {
    return message || `Request failed with status ${status}.`;
  }
  return err?.message || 'Failed to load audit events.';
}

const PER_PAGE_OPTIONS = [10, 20, 30, 50, 100] as const;

export function AuditLogsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const canAuditView = can('AUDIT_VIEW');
  const canBranchView = can('BRANCH_VIEW');
  const [searchParams, setSearchParams] = useSearchParams();

  const [branchId, setBranchId] = useState<number | ''>(() => toPositiveInt(searchParams.get('branch_id')) ?? '');
  const [eventType, setEventType] = useState<string>(() => searchParams.get('event_type') ?? '');
  const [entityType, setEntityType] = useState<string>(() => searchParams.get('entity_type') ?? '');
  const [entityIdInput, setEntityIdInput] = useState<string>(() => searchParams.get('entity_id') ?? '');
  const [dateFrom, setDateFrom] = useState<string>(() => searchParams.get('date_from') ?? toDateInput(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)));
  const [dateTo, setDateTo] = useState<string>(() => searchParams.get('date_to') ?? toDateInput(new Date()));
  const [search, setSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [searchDebounced, setSearchDebounced] = useState<string>(() => searchParams.get('search') ?? '');
  const [page, setPage] = useState<number>(() => toPositiveInt(searchParams.get('page')) ?? 1);
  const [perPage, setPerPage] = useState<number>(() => {
    const candidate = toPositiveInt(searchParams.get('per_page')) ?? 30;
    return PER_PAGE_OPTIONS.includes(candidate as (typeof PER_PAGE_OPTIONS)[number]) ? candidate : 30;
  });
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const branchesQuery = useBranchesQuery(canBranchView);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchDebounced(search.trim());
    }, 260);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (canBranchView) return;
    const assigned = user?.branch_id ?? '';
    if (branchId !== assigned) {
      setBranchId(assigned);
      setPage(1);
    }
  }, [branchId, canBranchView, user?.branch_id]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (typeof branchId === 'number') next.set('branch_id', String(branchId));
    if (eventType.trim()) next.set('event_type', eventType.trim().toUpperCase());
    if (entityType.trim()) next.set('entity_type', entityType.trim());
    if (entityIdInput.trim()) next.set('entity_id', entityIdInput.trim());
    if (dateFrom) next.set('date_from', dateFrom);
    if (dateTo) next.set('date_to', dateTo);
    if (searchDebounced) next.set('search', searchDebounced);
    if (page > 1) next.set('page', String(page));
    if (perPage !== 30) next.set('per_page', String(perPage));

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, eventType, entityType, entityIdInput, dateFrom, dateTo, searchDebounced, page, perPage]);

  const parsedEntityId = toPositiveInt(entityIdInput);
  const hasDateError = !!dateFrom && !!dateTo && dateFrom > dateTo;

  const params = useMemo(
    () => ({
      page,
      per_page: perPage,
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      event_type: eventType.trim() ? eventType.trim().toUpperCase() : undefined,
      entity_type: entityType.trim() ? entityType.trim() : undefined,
      entity_id: parsedEntityId ?? undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: searchDebounced || undefined,
    }),
    [page, perPage, branchId, eventType, entityType, parsedEntityId, dateFrom, dateTo, searchDebounced]
  );

  const auditQuery = useQuery({
    queryKey: ['auditEvents', params],
    queryFn: () => getAuditEvents(params),
    enabled: canAuditView && !hasDateError,
    placeholderData: keepPreviousData,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  const rows = auditQuery.data?.data ?? [];
  const totalPages = auditQuery.data?.last_page ?? 1;

  const selectedMetaText = useMemo(() => {
    if (!selectedEvent?.meta) return '-';
    try {
      return JSON.stringify(selectedEvent.meta, null, 2);
    } catch {
      return String(selectedEvent.meta);
    }
  }, [selectedEvent]);

  const branchLabel =
    user?.branch?.name ?? (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');

  if (!canAuditView) {
    return <Alert severity="error">Not authorized to view audit logs.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Audit Logs</Typography>
        <Typography variant="body2" color="text.secondary">
          Timeline of critical actions across sales, inventory, purchasing, transfers, and expenses.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ md: 'center' }}>
          {canBranchView ? (
            <TextField
              select
              size="small"
              label="Branch"
              value={branchId === '' ? 'ALL' : String(branchId)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === 'ALL') {
                  setBranchId('');
                  setPage(1);
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed) && parsed > 0) {
                  setBranchId(parsed);
                  setPage(1);
                }
              }}
              sx={{ minWidth: { md: 240 } }}
            >
              <MenuItem value="ALL">All branches</MenuItem>
              {(branchesQuery.data ?? []).map((branch) => (
                <MenuItem key={branch.id} value={String(branch.id)}>
                  {branch.code} - {branch.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField size="small" label="Branch" value={branchLabel} disabled sx={{ minWidth: { md: 240 } }} />
          )}

          <TextField
            size="small"
            label="Event type"
            placeholder="SALE_VOIDED"
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value.toUpperCase());
              setPage(1);
            }}
            sx={{ minWidth: { md: 170 } }}
          />

          <TextField
            size="small"
            label="Entity type"
            placeholder="sale / transfer"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { md: 160 } }}
          />

          <TextField
            size="small"
            label="Entity ID"
            placeholder="123"
            value={entityIdInput}
            onChange={(event) => {
              setEntityIdInput(event.target.value.replace(/[^\d]/g, ''));
              setPage(1);
            }}
            sx={{ width: { xs: '100%', md: 120 } }}
          />

          <TextField
            size="small"
            label="Date from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', md: 160 } }}
          />

          <TextField
            size="small"
            label="Date to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: '100%', md: 160 } }}
          />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 1.2 }}>
          <TextField
            size="small"
            label="Search"
            placeholder="summary, event type, entity..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { md: 260 }, flex: 1 }}
          />

          <TextField
            select
            size="small"
            label="Rows"
            value={String(perPage)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (PER_PAGE_OPTIONS.includes(parsed as (typeof PER_PAGE_OPTIONS)[number])) {
                setPerPage(parsed);
                setPage(1);
              }
            }}
            sx={{ width: { xs: '100%', md: 110 } }}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <MenuItem key={option} value={String(option)}>
                {option}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            onClick={() => {
              setEventType('');
              setEntityType('');
              setEntityIdInput('');
              setSearch('');
              setSearchDebounced('');
              setPage(1);
            }}
          >
            Clear text filters
          </Button>
        </Stack>
      </Paper>

      {hasDateError && <Alert severity="error">Date from cannot be later than date to.</Alert>}
      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      {auditQuery.isLoading ? (
        <Alert severity="info">Loading audit events...</Alert>
      ) : auditQuery.isError ? (
        <Alert severity="error">{describeAuditQueryError(auditQuery.error)}</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No audit events found for the selected filters.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {rows.map((row) => (
            <Paper
              key={row.id}
              variant="outlined"
              sx={{ p: 1.2, borderRadius: 2, cursor: 'pointer' }}
              onClick={() => setSelectedEvent(row)}
            >
              <Stack spacing={0.65}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">
                    {dateTime(row.created_at)}
                  </Typography>
                  <Chip size="small" color={eventTone(row.event_type)} variant="outlined" label={eventLabel(row.event_type)} />
                </Stack>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {String(row.summary ?? '').trim() || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {row.entity_type ? `${row.entity_type} #${row.entity_id ?? '-'}` : '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {row.branch?.code
                    ? `${row.branch.code} - ${row.branch?.name ?? ''}`
                    : (row.branch?.name ?? row.branch_id ?? '-')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {row.user?.name ?? row.user?.email ?? row.user_id ?? '-'}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1080 }}>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>User</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedEvent(row)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateTime(row.created_at)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={eventTone(row.event_type)}
                      variant="outlined"
                      label={eventLabel(row.event_type)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                      {String(row.summary ?? '').trim() || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {row.entity_type ? `${row.entity_type} #${row.entity_id ?? '-'}` : '-'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {row.branch?.code ? `${row.branch.code} - ${row.branch?.name ?? ''}` : (row.branch?.name ?? row.branch_id ?? '-')}
                  </TableCell>
                  <TableCell>{row.user?.name ?? row.user?.email ?? row.user_id ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, next) => setPage(next)}
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      <Drawer
        anchor="right"
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        ModalProps={{ disableScrollLock: true }}
      >
        <Box sx={{ width: { xs: '100vw', sm: 560 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Audit Event Details</Typography>
            <Button onClick={() => setSelectedEvent(null)}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {!selectedEvent ? (
            <Alert severity="info">Select an event to view details.</Alert>
          ) : (
            <Stack spacing={1.1}>
              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <b>ID:</b> {selectedEvent.id}
                  </Typography>
                  <Typography variant="body2">
                    <b>Time:</b> {dateTime(selectedEvent.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Event:</b> {selectedEvent.event_type}
                  </Typography>
                  <Typography variant="body2">
                    <b>Summary:</b> {String(selectedEvent.summary ?? '').trim() || '-'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Entity:</b>{' '}
                    {selectedEvent.entity_type
                      ? `${selectedEvent.entity_type} #${selectedEvent.entity_id ?? '-'}`
                      : '-'}
                  </Typography>
                  <Typography variant="body2">
                    <b>Branch:</b>{' '}
                    {selectedEvent.branch?.code
                      ? `${selectedEvent.branch.code} - ${selectedEvent.branch?.name ?? ''}`
                      : (selectedEvent.branch?.name ?? selectedEvent.branch_id ?? '-')}
                  </Typography>
                  <Typography variant="body2">
                    <b>User:</b> {selectedEvent.user?.name ?? selectedEvent.user?.email ?? selectedEvent.user_id ?? '-'}
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.8 }}>
                  Meta
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: '#0f172a',
                    color: '#e2e8f0',
                    fontSize: 12,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedMetaText}
                </Box>
              </Paper>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Stack>
  );
}
