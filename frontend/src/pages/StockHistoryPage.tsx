import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
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
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBranchesQuery, useLedgerQuery, useStockHistoryQuery } from '../api/queries';
import type { StockHistoryRow } from '../api/stockHistory';
import { getTransfer, type Transfer } from '../api/transfers';
import { authStorage } from '../auth/authStorage';
import { useAuth } from '../auth/AuthProvider';
import { BranchSelect } from '../components/BranchSelect';

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function monthValueOrNow(value: string | null): string {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatQty(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

const STICKY_COLUMN_SX = {
  position: 'sticky',
  backgroundColor: '#fff',
  zIndex: 2,
  boxShadow: '1px 0 0 rgba(224, 224, 224, 0.9)',
} as const;

type HistoryDrawerState = {
  row: StockHistoryRow;
  date: string | null;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatMovementType(value: string | null | undefined): string {
  return String(value ?? '-')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReason(value: string | null | undefined): string {
  return String(value ?? '-')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StockHistoryPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');
  const branchesQuery = useBranchesQuery(canBranchView);
  const [searchParams, setSearchParams] = useSearchParams();

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [search, setSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [month, setMonth] = useState<string>(() => monthValueOrNow(searchParams.get('month')));
  const [selectedHistory, setSelectedHistory] = useState<HistoryDrawerState | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [branchId, branchesQuery.data, canBranchView, user?.branch_id]);

  useEffect(() => {
    if (canBranchView) return;
    const assigned = user?.branch_id ?? '';
    if (branchId !== assigned) setBranchId(assigned);
  }, [branchId, canBranchView, user?.branch_id]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (branchId !== '') next.set('branch_id', String(branchId));
    if (page !== 1) next.set('page', String(page));
    if (debouncedSearch) next.set('search', debouncedSearch);
    if (month) next.set('month', month);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, page, debouncedSearch, month]);

  const stockHistoryQuery = useStockHistoryQuery(
    {
      branch_id: branchId === '' ? 0 : branchId,
      page,
      month,
      search: debouncedSearch || undefined,
      per_page: 20,
    },
    branchId !== ''
  );

  const rows = stockHistoryQuery.data?.data ?? [];
  const days = stockHistoryQuery.data?.days ?? [];
  const totalPages = stockHistoryQuery.data?.last_page ?? 1;

  const monthLabel = stockHistoryQuery.data?.month_label ?? 'Monthly stock sheet';
  const visibleDays = useMemo(
    () => days.filter((day) => !day.is_future),
    [days]
  );
  const lastVisibleDate = visibleDays.length > 0 ? visibleDays[visibleDays.length - 1]?.date ?? null : null;

  const selectedBranchName = useMemo(() => {
    const branch = branchesQuery.data?.find((item) => item.id === branchId);
    if (branch) return `${branch.code} - ${branch.name}`;
    if (user?.branch?.id === branchId) return `${user.branch.code} - ${user.branch.name}`;
    return 'Selected branch';
  }, [branchId, branchesQuery.data, user?.branch]);

  const branchMap = useMemo(() => {
    const map = new Map<number, { id: number; code?: string | null; name: string }>();
    for (const branch of branchesQuery.data ?? []) {
      map.set(branch.id, branch);
    }
    if (user?.branch_id && user?.branch?.name) {
      map.set(user.branch_id, user.branch);
    }
    return map;
  }, [branchesQuery.data, user?.branch, user?.branch_id]);

  const branchLabel = (id?: number | null) => {
    if (!id) return '-';
    const branch = branchMap.get(id);
    if (!branch) return String(id);
    return branch.code ? `${branch.code} - ${branch.name}` : branch.name;
  };

  const historyRange = useMemo(() => {
    if (!selectedHistory) return null;
    if (selectedHistory.date) {
      return {
        date_from: selectedHistory.date,
        date_to: selectedHistory.date,
        label: `Movements on ${selectedHistory.date}`,
      };
    }

    const monthStart = `${month}-01`;
    const monthEnd = lastVisibleDate ?? monthStart;
    return {
      date_from: monthStart,
      date_to: monthEnd,
      label: `Month movements (${monthLabel})`,
    };
  }, [lastVisibleDate, month, monthLabel, selectedHistory]);

  const movementQuery = useLedgerQuery(
    {
      branch_id: branchId === '' ? 0 : branchId,
      product_variant_id: selectedHistory?.row.product_variant_id,
      date_from: historyRange?.date_from,
      date_to: historyRange?.date_to,
      per_page: 100,
    },
    branchId !== '' && !!selectedHistory && !!historyRange
  );

  const selectedMovementRows = movementQuery.data?.data ?? [];

  const transferIds = useMemo(() => {
    const ids = new Set<number>();
    for (const entry of selectedMovementRows) {
      if (entry.ref_type === 'transfers' && entry.ref_id) {
        ids.add(Number(entry.ref_id));
      }
    }
    return Array.from(ids);
  }, [selectedMovementRows]);

  const transferQueries = useQueries({
    queries: transferIds.map((id) => ({
      queryKey: ['transfer', id],
      queryFn: () => getTransfer(id),
      enabled: !!selectedHistory && branchId !== '' && !!id,
      staleTime: 60_000,
    })),
  });

  const transferById = useMemo(() => {
    const map = new Map<number, Transfer>();
    for (const query of transferQueries) {
      const transfer = query.data as Transfer | undefined;
      if (transfer?.id) {
        map.set(transfer.id, transfer);
      }
    }
    return map;
  }, [transferQueries]);

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h5">Stock History</Typography>
        <Typography variant="body2" color="text.secondary">
          Excel-style monthly stock tracker. Rows are product variants, columns are each day’s ending stock.
        </Typography>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            {canBranchView ? (
              <Box sx={{ minWidth: { xs: '100%', lg: 300 } }}>
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={branchId}
                  onChange={(nextBranchId) => {
                    setBranchId(nextBranchId);
                    authStorage.setLastBranchId(nextBranchId);
                    setPage(1);
                  }}
                />
              </Box>
            ) : (
              <TextField
                label="Branch"
                value={selectedBranchName}
                size="small"
                fullWidth
                InputProps={{ readOnly: true }}
              />
            )}

            <TextField
              label="Month"
              type="month"
              size="small"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value || monthValueOrNow(null));
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: '100%', lg: 180 } }}
            />

            <TextField
              label="Search product / variant / flavor / SKU"
              size="small"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              fullWidth
            />
          </Stack>

          <Alert severity="info">
            {isCompact
              ? 'Swipe horizontally to see all days. Tap a day stock cell to inspect its movement lines.'
              : 'Scroll horizontally if needed. Click a row for month movements or click a day stock cell for that exact day.'}
          </Alert>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {monthLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Branch: {selectedBranchName}
            </Typography>
          </Box>

          {stockHistoryQuery.isLoading ? (
            <Alert severity="info">Loading monthly stock history...</Alert>
          ) : stockHistoryQuery.isError ? (
            <Alert severity="error">Failed to load stock history.</Alert>
          ) : rows.length === 0 ? (
            <Alert severity="warning">No stock history found for the selected month.</Alert>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
                <Table size="small" stickyHeader sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...STICKY_COLUMN_SX, left: 0, minWidth: 220, zIndex: 4 }}>Product</TableCell>
                      <TableCell sx={{ ...STICKY_COLUMN_SX, left: 220, minWidth: 170, zIndex: 4 }}>Variant</TableCell>
                      <TableCell sx={{ ...STICKY_COLUMN_SX, left: 390, minWidth: 150, zIndex: 4 }}>Flavor</TableCell>
                      <TableCell sx={{ ...STICKY_COLUMN_SX, left: 540, minWidth: 170, zIndex: 4 }}>SKU</TableCell>
                      <TableCell sx={{ ...STICKY_COLUMN_SX, left: 710, minWidth: 110, zIndex: 4, textAlign: 'right' }}>
                        Opening
                      </TableCell>
                      {days.map((day) => (
                        <TableCell key={day.date} align="right" sx={{ minWidth: 92 }}>
                          {day.label}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ minWidth: 110 }}>
                        End
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.product_variant_id}
                        hover
                        onClick={() => setSelectedHistory({ row, date: null })}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ ...STICKY_COLUMN_SX, left: 0, minWidth: 220, zIndex: 3 }}>
                          <Stack spacing={0.3}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {row.product_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.brand_name || row.product_type || '-'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ ...STICKY_COLUMN_SX, left: 220, minWidth: 170, zIndex: 3 }}>
                          {row.variant_name || '-'}
                        </TableCell>
                        <TableCell sx={{ ...STICKY_COLUMN_SX, left: 390, minWidth: 150, zIndex: 3 }}>
                          {row.flavor || '-'}
                        </TableCell>
                        <TableCell sx={{ ...STICKY_COLUMN_SX, left: 540, minWidth: 170, zIndex: 3 }}>
                          <Stack spacing={0.2}>
                            <Typography variant="body2">{row.sku}</Typography>
                            {row.barcode ? (
                              <Typography variant="caption" color="text.secondary">
                                {row.barcode}
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ ...STICKY_COLUMN_SX, left: 710, minWidth: 110, zIndex: 3, textAlign: 'right' }}>
                          {formatQty(row.opening_qty)}
                        </TableCell>
                        {days.map((day) => (
                          <TableCell
                            key={`${row.product_variant_id}-${day.date}`}
                            align="right"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedHistory({ row, date: day.date });
                            }}
                            sx={{
                              cursor: 'pointer',
                              backgroundColor: day.is_future ? '#fafafa' : undefined,
                              color: day.is_future ? 'text.disabled' : 'inherit',
                            }}
                          >
                            {formatQty(row.closing_by_day?.[day.date])}
                          </TableCell>
                        ))}
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatQty(row.ending_qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="body2" color="text.secondary">
                  Showing {stockHistoryQuery.data?.from ?? 0} to {stockHistoryQuery.data?.to ?? 0} of{' '}
                  {stockHistoryQuery.data?.total ?? 0} variant row(s)
                </Typography>
                <Pagination
                  page={page}
                  count={totalPages}
                  onChange={(_, nextPage) => setPage(nextPage)}
                  color="primary"
                  shape="rounded"
                />
              </Stack>
            </>
          )}
        </Stack>
      </Paper>

      <Drawer anchor="right" open={!!selectedHistory} onClose={() => setSelectedHistory(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 460 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">Stock Movements</Typography>
              <Typography variant="body2" color="text.secondary">
                {historyRange?.label ?? 'Movement details'}
              </Typography>
            </Box>
            <Button onClick={() => setSelectedHistory(null)}>Close</Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {selectedHistory ? (
            <Stack spacing={1.5}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                <Stack spacing={0.6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {selectedHistory.row.product_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Variant: {selectedHistory.row.variant_name || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Flavor: {selectedHistory.row.flavor || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    SKU: {selectedHistory.row.sku}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Branch: {selectedBranchName}
                  </Typography>
                </Stack>
              </Paper>

              {movementQuery.isLoading ? (
                <Alert severity="info">Loading movement details...</Alert>
              ) : movementQuery.isError ? (
                <Alert severity="error">Failed to load movement details.</Alert>
              ) : selectedMovementRows.length === 0 ? (
                <Alert severity="warning">
                  No stock ledger entries found for this {selectedHistory.date ? 'day' : 'month'}.
                </Alert>
              ) : (
                <>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      size="small"
                      label={`Entries: ${selectedMovementRows.length}`}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`Net movement: ${formatQty(
                        selectedMovementRows.reduce((sum, entry) => sum + Number(entry.qty_delta ?? 0), 0)
                      )}`}
                      color="default"
                      variant="outlined"
                    />
                  </Stack>

                  <Stack spacing={1.1}>
                    {selectedMovementRows.map((entry) => (
                      <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
                        {(() => {
                          const transfer =
                            entry.ref_type === 'transfers' && entry.ref_id
                              ? transferById.get(Number(entry.ref_id))
                              : null;
                          const transferFrom =
                            (transfer as any)?.fromBranch?.id ?? (transfer as any)?.from_branch_id ?? null;
                          const transferTo =
                            (transfer as any)?.toBranch?.id ?? (transfer as any)?.to_branch_id ?? null;

                          return (
                        <Stack spacing={0.8}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                              <Chip
                                size="small"
                                label={formatMovementType(entry.movement_type)}
                                color="primary"
                                variant="outlined"
                              />
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {formatDateTime(entry.posted_at)}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color: Number(entry.qty_delta ?? 0) < 0 ? 'error.main' : 'success.main',
                              }}
                            >
                              {Number(entry.qty_delta ?? 0) > 0 ? '+' : ''}
                              {formatQty(entry.qty_delta)}
                            </Typography>
                          </Stack>

                          <Typography variant="body2">
                            <b>Reason:</b> {formatReason(entry.reason_code)}
                          </Typography>
                          <Typography variant="body2">
                            <b>Reference:</b>{' '}
                            {entry.ref_type
                              ? `${formatReason(entry.ref_type)}${entry.ref_id ? ` #${entry.ref_id}` : ''}`
                              : '-'}
                          </Typography>
                          {entry.ref_type === 'transfers' ? (
                            <>
                              <Typography variant="body2">
                                <b>From:</b>{' '}
                                {transfer ? branchLabel(transferFrom) : 'Loading transfer route...'}
                              </Typography>
                              <Typography variant="body2">
                                <b>To:</b>{' '}
                                {transfer ? branchLabel(transferTo) : 'Loading transfer route...'}
                              </Typography>
                            </>
                          ) : null}
                          <Typography variant="body2">
                            <b>Wholesale:</b> {entry.unit_cost ? Number(entry.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            {'  '}
                            <b>Retail:</b> {entry.unit_price ? Number(entry.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                          </Typography>
                          <Typography variant="body2">
                            <b>By:</b> {entry.performed_by?.name ?? entry.performedBy?.name ?? '-'}
                          </Typography>
                          <Typography variant="body2">
                            <b>Notes:</b> {entry.notes?.trim() ? entry.notes : '-'}
                          </Typography>
                        </Stack>
                          );
                        })()}
                      </Paper>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </Stack>
  );
}
