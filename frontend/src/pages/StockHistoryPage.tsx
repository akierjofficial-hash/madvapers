import {
  Alert,
  Box,
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
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBranchesQuery, useStockHistoryQuery } from '../api/queries';
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

  const selectedBranchName = useMemo(() => {
    const branch = branchesQuery.data?.find((item) => item.id === branchId);
    if (branch) return `${branch.code} - ${branch.name}`;
    if (user?.branch?.id === branchId) return `${user.branch.code} - ${user.branch.name}`;
    return 'Selected branch';
  }, [branchId, branchesQuery.data, user?.branch]);

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
              ? 'Swipe horizontally to see all days of the month.'
              : 'Scroll horizontally if needed to see all day columns for the selected month.'}
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
                      <TableRow key={row.product_variant_id} hover>
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
                          <TableCell key={`${row.product_variant_id}-${day.date}`} align="right">
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
    </Stack>
  );
}
