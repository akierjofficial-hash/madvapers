import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
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
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BranchSelect } from '../components/BranchSelect';
import { authStorage } from '../auth/authStorage';
import { useAuth } from '../auth/AuthProvider';
import {
  useBranchesQuery,
  useCreateExpenseMutation,
  useExpenseQuery,
  useExpensesQuery,
  useUpdateExpenseMutation,
  useVoidExpenseMutation,
} from '../api/queries';

const STATUSES = ['', 'POSTED', 'VOIDED'] as const;
const DEFAULT_CATEGORIES = ['OPERATIONS', 'UTILITIES', 'RENT', 'SALARY', 'MAINTENANCE', 'MARKETING', 'SF_EXPENSE'] as const;

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCategoryInput(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

function sanitizeCategoryForSelect(value: unknown): string {
  const normalized = normalizeCategoryInput(String(value ?? ''));
  if (!normalized || normalized === 'OTHER') return 'OPERATIONS';
  return normalized;
}

function money(v: unknown): string {
  return toNum(v).toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTime(v?: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function toDateInput(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDateTimeInput(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function startDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return toDateInput(d.toISOString());
}

function statusChipColor(status: string): 'default' | 'success' | 'error' {
  switch (String(status).toUpperCase()) {
    case 'POSTED':
      return 'success';
    case 'VOIDED':
      return 'error';
    default:
      return 'default';
  }
}

export function ExpensesPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const canBranchView = can('BRANCH_VIEW');
  const canExpenseView = can('EXPENSE_VIEW');
  const canExpenseCreate = can('EXPENSE_CREATE');
  const canExpenseUpdate = can('EXPENSE_UPDATE');
  const canExpenseVoid = can('EXPENSE_VOID');

  const [searchParams, setSearchParams] = useSearchParams();
  const branchesQuery = useBranchesQuery(canBranchView);

  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromUrl = toInt(searchParams.get('branch_id'));
    if (fromUrl) return fromUrl;
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });
  const [status, setStatus] = useState<string>(() => searchParams.get('status') ?? '');
  const [category, setCategory] = useState<string>(() => searchParams.get('category') ?? '');
  const [dateFrom, setDateFrom] = useState<string>(() => searchParams.get('date_from') ?? startDate(13));
  const [dateTo, setDateTo] = useState<string>(() => searchParams.get('date_to') ?? toDateInput(new Date().toISOString()));
  const [page, setPage] = useState<number>(() => toInt(searchParams.get('page')) ?? 1);
  const [search, setSearch] = useState<string>(() => searchParams.get('search') ?? '');
  const [searchDebounced, setSearchDebounced] = useState<string>(() => searchParams.get('search') ?? '');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const expenseQuery = useExpenseQuery(selectedId ?? 0, !!selectedId && canExpenseView);
  const selected = expenseQuery.data ?? null;
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() => [...DEFAULT_CATEGORIES]);

  const [openCreate, setOpenCreate] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<number | ''>(branchId);
  const [createCategory, setCreateCategory] = useState<string>('OPERATIONS');
  const [createCategoryInput, setCreateCategoryInput] = useState<string>('');
  const [createAmount, setCreateAmount] = useState<string>('');
  const [createPaidAt, setCreatePaidAt] = useState<string>(toDateTimeInput(new Date().toISOString()));
  const [createNotes, setCreateNotes] = useState<string>('');

  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<string>('OPERATIONS');
  const [editCategoryInput, setEditCategoryInput] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editPaidAt, setEditPaidAt] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const [snack, setSnack] = useState<{
    open: boolean;
    severity: 'success' | 'error' | 'info';
    message: string;
  }>({ open: false, severity: 'success', message: '' });

  const createMut = useCreateExpenseMutation();
  const updateMut = useUpdateExpenseMutation();
  const voidMut = useVoidExpenseMutation();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 260);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (canBranchView) return;
    const assignedBranchId = user?.branch_id ?? '';
    if (branchId !== assignedBranchId) {
      setBranchId(assignedBranchId);
    }
  }, [canBranchView, user?.branch_id, branchId]);

  useEffect(() => {
    if (!canBranchView) return;
    if (branchId !== '' || !branchesQuery.data?.length) return;
    const preferred = user?.branch_id ? branchesQuery.data.find((b) => b.id === user.branch_id) : null;
    const first = preferred ?? branchesQuery.data[0];
    setBranchId(first.id);
    authStorage.setLastBranchId(first.id);
  }, [canBranchView, branchId, branchesQuery.data, user?.branch_id]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (branchId) next.set('branch_id', String(branchId));
    if (status) next.set('status', status);
    if (category.trim()) next.set('category', category.trim());
    if (dateFrom) next.set('date_from', dateFrom);
    if (dateTo) next.set('date_to', dateTo);
    if (page !== 1) next.set('page', String(page));
    if (searchDebounced) next.set('search', searchDebounced);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, status, category, dateFrom, dateTo, page, searchDebounced]);

  useEffect(() => {
    if (!selected || !isEditing) return;
    setEditCategory(sanitizeCategoryForSelect(selected.category));
    setEditAmount(String(toNum(selected.amount)));
    setEditPaidAt(toDateTimeInput(selected.paid_at));
    setEditNotes(String(selected.notes ?? ''));
  }, [selected, isEditing]);

  const hasDateError = dateFrom > dateTo;

  const expensesQuery = useExpensesQuery(
    {
      page,
      branch_id: branchId === '' ? undefined : branchId,
      status: status || undefined,
      category: category.trim() || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: searchDebounced || undefined,
    },
    branchId !== '' && canExpenseView && !hasDateError
  );

  const rows = expensesQuery.data?.data ?? [];
  const totalPages = expensesQuery.data?.last_page ?? 1;

  useEffect(() => {
    const discovered = new Set<string>();
    for (const row of rows) {
      const normalized = normalizeCategoryInput(String((row as any)?.category ?? ''));
      if (normalized && normalized !== 'OTHER') discovered.add(normalized);
    }
    const selectedCategory = normalizeCategoryInput(String(selected?.category ?? ''));
    if (selectedCategory && selectedCategory !== 'OTHER') discovered.add(selectedCategory);

    if (discovered.size === 0) return;

    setCategoryOptions((prev) => {
      const merged = new Set(prev);
      for (const cat of discovered) merged.add(cat);
      return Array.from(merged);
    });
  }, [rows, selected?.category]);

  const showSnack = (message: string, severity: 'success' | 'error' | 'info' = 'error') => {
    setSnack({ open: true, message, severity });
  };

  const addCategoryOption = (rawValue: string): string | null => {
    const normalized = normalizeCategoryInput(rawValue);
    if (!normalized) {
      showSnack('Category name is required.');
      return null;
    }
    if (normalized === 'OTHER') {
      showSnack('OTHER category is disabled. Please use a specific category name.');
      return null;
    }
    if (normalized.length > 80) {
      showSnack('Category must be at most 80 characters.');
      return null;
    }

    setCategoryOptions((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    return normalized;
  };

  const resetCreateForm = () => {
    setCreateBranchId(branchId);
    setCreateCategory('OPERATIONS');
    setCreateCategoryInput('');
    setCreateAmount('');
    setCreatePaidAt(toDateTimeInput(new Date().toISOString()));
    setCreateNotes('');
  };

  const openNewExpense = () => {
    if (!canExpenseCreate) {
      showSnack('Not authorized: EXPENSE_CREATE');
      return;
    }
    resetCreateForm();
    setOpenCreate(true);
  };

  const submitCreateExpense = async () => {
    try {
      const b = typeof createBranchId === 'number' ? createBranchId : null;
      const amount = Number(createAmount);
      const normalizedCategory = normalizeCategoryInput(createCategory);

      if (!b) {
        showSnack('Please select a branch.');
        return;
      }
      if (!normalizedCategory) {
        showSnack('Category is required.');
        return;
      }
      if (normalizedCategory === 'OTHER') {
        showSnack('OTHER category is disabled. Please use a specific category name.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        showSnack('Amount must be greater than zero.');
        return;
      }

      const created = await createMut.mutateAsync({
        branch_id: b,
        category: normalizedCategory,
        amount,
        paid_at: createPaidAt || undefined,
        notes: createNotes.trim() || null,
      });

      setOpenCreate(false);
      setSelectedId(created.id);
      showSnack(`Expense #${created.id} recorded.`, 'success');
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to record expense.';
      showSnack(message);
    }
  };

  const beginEdit = () => {
    if (!selected) return;
    if (selected.status !== 'POSTED') {
      showSnack('Only POSTED expenses can be edited.');
      return;
    }
    if (!canExpenseUpdate) {
      showSnack('Not authorized: EXPENSE_UPDATE');
      return;
    }

    setEditCategory(sanitizeCategoryForSelect(selected.category));
    setEditCategoryInput('');
    setEditAmount(String(toNum(selected.amount)));
    setEditPaidAt(toDateTimeInput(selected.paid_at));
    setEditNotes(String(selected.notes ?? ''));
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;

    const amount = Number(editAmount);
    const normalizedCategory = normalizeCategoryInput(editCategory);

    if (!normalizedCategory) {
      showSnack('Category is required.');
      return;
    }
    if (normalizedCategory === 'OTHER') {
      showSnack('OTHER category is disabled. Please use a specific category name.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showSnack('Amount must be greater than zero.');
      return;
    }

    try {
      await updateMut.mutateAsync({
        id: selected.id,
        input: {
          category: normalizedCategory,
          amount,
          paid_at: editPaidAt || undefined,
          notes: editNotes.trim() || null,
        },
      });
      setIsEditing(false);
      showSnack(`Expense #${selected.id} updated.`, 'success');
      void expenseQuery.refetch();
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to update expense.';
      showSnack(message);
    }
  };

  const runVoid = async () => {
    if (!selected) return;
    if (!canExpenseVoid) {
      showSnack('Not authorized: EXPENSE_VOID');
      return;
    }
    if (selected.status === 'VOIDED') {
      showSnack('Expense is already voided.');
      return;
    }
    if (!window.confirm(`Void expense #${selected.id}?`)) return;

    try {
      await voidMut.mutateAsync(selected.id);
      setIsEditing(false);
      showSnack(`Expense #${selected.id} voided.`, 'success');
      void expenseQuery.refetch();
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to void expense.';
      showSnack(message);
    }
  };

  const branchLabel =
    user?.branch?.name ?? (typeof branchId === 'number' ? `Branch #${branchId}` : 'No branch assigned');

  if (!canExpenseView) {
    return <Alert severity="error">Not authorized to view expenses.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1, sm: 0 }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5">Expenses</Typography>
          <Typography variant="body2" color="text.secondary">
            Track operating expenses that reduce net income and net cashflow.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={openNewExpense}
          disabled={!canExpenseCreate}
          sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}
        >
          Record Expense
        </Button>
      </Stack>

      {!canExpenseCreate && <Alert severity="info">You have view-only access to expenses.</Alert>}

      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
        <Box sx={{ minWidth: { md: 260 }, flex: 1 }}>
          {canBranchView ? (
            <BranchSelect
              branches={branchesQuery.data ?? []}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                authStorage.setLastBranchId(id);
                setPage(1);
              }}
            />
          ) : (
            <TextField size="small" label="Branch" value={branchLabel} disabled fullWidth />
          )}
        </Box>

        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 150 } }}
        >
          {STATUSES.map((value) => (
            <MenuItem key={value || 'ALL'} value={value}>
              {value || 'All'}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="Category"
          placeholder="OPERATIONS"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value.toUpperCase());
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 170 } }}
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
          sx={{ width: { xs: '100%', md: 165 } }}
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
          sx={{ width: { xs: '100%', md: 165 } }}
        />

        <TextField
          size="small"
          label="Search"
          placeholder="Expense #, notes, id..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { md: 220 }, flex: 1 }}
        />
      </Stack>

      {hasDateError && <Alert severity="error">Date from cannot be later than date to.</Alert>}

      {branchId === '' ? (
        <Alert severity={canBranchView ? 'info' : 'error'}>
          {canBranchView ? 'Select a branch to view expenses.' : 'No branch assigned to your account.'}
        </Alert>
      ) : expensesQuery.isLoading ? (
        <Alert severity="info">Loading expenses...</Alert>
      ) : expensesQuery.isError ? (
        <Alert severity="error">Failed to load expenses.</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No expenses found for the selected filters.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {rows.map((row: any) => (
            <Paper
              key={row.id}
              variant="outlined"
              sx={{ p: 1.2, borderRadius: 2, cursor: 'pointer' }}
              onClick={() => setSelectedId(Number(row.id))}
            >
              <Stack spacing={0.65}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {row.expense_number ?? `EX-${row.id}`}
                  </Typography>
                  <Chip size="small" color={statusChipColor(String(row.status ?? ''))} label={row.status ?? '-'} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {dateTime(row.paid_at)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.category ?? '-'} • {row.branch?.name ?? row.branch_id}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{money(row.amount)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  By: {(row.created_by ?? row.createdBy)?.name ?? '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                  {String(row.notes ?? '').trim() || '-'}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Expense #</TableCell>
                <TableCell>Paid At</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedId(Number(row.id))}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.expense_number ?? `EX-${row.id}`}</TableCell>
                  <TableCell>{dateTime(row.paid_at)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusChipColor(String(row.status ?? ''))} label={row.status ?? '-'} />
                  </TableCell>
                  <TableCell>{row.category ?? '-'}</TableCell>
                  <TableCell>{row.branch?.name ?? row.branch_id}</TableCell>
                  <TableCell align="right">{money(row.amount)}</TableCell>
                  <TableCell>{(row.created_by ?? row.createdBy)?.name ?? '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
                      {String(row.notes ?? '').trim() || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {branchId !== '' && totalPages > 1 && (
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

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Record Expense</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <Box sx={{ minWidth: 260 }}>
              {canBranchView ? (
                <BranchSelect
                  branches={branchesQuery.data ?? []}
                  value={createBranchId}
                  onChange={(id) => setCreateBranchId(id)}
                />
              ) : (
                <TextField size="small" label="Branch" value={branchLabel} disabled fullWidth />
              )}
            </Box>

            <TextField
              select
              size="small"
              label="Category"
              value={createCategory}
              onChange={(event) => setCreateCategory(event.target.value)}
            >
              {categoryOptions.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="New Category Type"
                placeholder="e.g. DELIVERY, PACKAGING"
                value={createCategoryInput}
                onChange={(event) => setCreateCategoryInput(event.target.value)}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  const normalized = addCategoryOption(createCategoryInput);
                  if (!normalized) return;
                  setCreateCategory(normalized);
                  setCreateCategoryInput('');
                  showSnack(`Category ${normalized} added.`, 'success');
                }}
              >
                Add
              </Button>
            </Stack>

            <TextField
              size="small"
              label="Amount"
              value={createAmount}
              onChange={(event) => setCreateAmount(event.target.value)}
              placeholder="0.00"
            />

            <TextField
              size="small"
              type="datetime-local"
              label="Paid At"
              value={createPaidAt}
              onChange={(event) => setCreatePaidAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              multiline
              minRows={2}
              label="Notes (optional)"
              value={createNotes}
              onChange={(event) => setCreateNotes(event.target.value)}
            />

            {createMut.isError && <Alert severity="error">Failed to record expense.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitCreateExpense} disabled={createMut.isPending}>
            Save Expense
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={!!selectedId}
        onClose={() => {
          setSelectedId(null);
          setIsEditing(false);
        }}
        ModalProps={{ disableScrollLock: true }}
      >
        <Box sx={{ width: { xs: '100vw', sm: 520 }, maxWidth: '100vw', p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Expense Details</Typography>
            <Button
              onClick={() => {
                setSelectedId(null);
                setIsEditing(false);
              }}
            >
              Close
            </Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          {expenseQuery.isLoading ? (
            <Alert severity="info">Loading expense...</Alert>
          ) : expenseQuery.isError ? (
            <Alert severity="error">Failed to load expense.</Alert>
          ) : !selected ? (
            <Alert severity="warning">No expense selected.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Stack spacing={0.8}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                      {selected.expense_number ?? `EX-${selected.id}`}
                    </Typography>
                    <Chip size="small" color={statusChipColor(selected.status)} label={selected.status} />
                  </Stack>

                  <Typography variant="body2">
                    <b>Branch:</b> {selected.branch?.name ?? selected.branch_id}
                  </Typography>
                  <Typography variant="body2">
                    <b>Created:</b> {dateTime(selected.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Paid At:</b> {dateTime(selected.paid_at)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Recorded By:</b> {(selected.created_by ?? selected.createdBy)?.name ?? '-'}
                  </Typography>
                  {selected.status === 'VOIDED' && (
                    <Typography variant="body2">
                      <b>Voided By:</b> {(selected.voided_by ?? selected.voidedBy)?.name ?? '-'}
                    </Typography>
                  )}
                </Stack>
              </Paper>

              {isEditing ? (
                <Paper variant="outlined" sx={{ p: 1.2 }}>
                  <Stack spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Category"
                      value={editCategory}
                      onChange={(event) => setEditCategory(event.target.value)}
                    >
                      {categoryOptions.map((cat) => (
                        <MenuItem key={cat} value={cat}>
                          {cat}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        label="New Category Type"
                        placeholder="e.g. DELIVERY, PACKAGING"
                        value={editCategoryInput}
                        onChange={(event) => setEditCategoryInput(event.target.value)}
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        onClick={() => {
                          const normalized = addCategoryOption(editCategoryInput);
                          if (!normalized) return;
                          setEditCategory(normalized);
                          setEditCategoryInput('');
                          showSnack(`Category ${normalized} added.`, 'success');
                        }}
                      >
                        Add
                      </Button>
                    </Stack>
                    <TextField
                      size="small"
                      label="Amount"
                      value={editAmount}
                      onChange={(event) => setEditAmount(event.target.value)}
                    />
                    <TextField
                      size="small"
                      type="datetime-local"
                      label="Paid At"
                      value={editPaidAt}
                      onChange={(event) => setEditPaidAt(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      multiline
                      minRows={2}
                      label="Notes"
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                    />
                  </Stack>
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ p: 1.2 }}>
                  <Stack spacing={0.8}>
                    <Typography variant="body2">
                      <b>Category:</b> {selected.category}
                    </Typography>
                    <Typography variant="body2">
                      <b>Amount:</b> {money(selected.amount)}
                    </Typography>
                    <Typography variant="body2">
                      <b>Notes:</b> {String(selected.notes ?? '').trim() || '-'}
                    </Typography>
                  </Stack>
                </Paper>
              )}

              {(updateMut.isPending || voidMut.isPending) && <Alert severity="info">Saving changes...</Alert>}

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {isEditing ? (
                  <>
                    <Button variant="contained" onClick={saveEdit} disabled={updateMut.isPending}>
                      Save Changes
                    </Button>
                    <Button onClick={() => setIsEditing(false)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    {canExpenseUpdate && selected.status === 'POSTED' && (
                      <Button variant="outlined" onClick={beginEdit}>
                        Edit
                      </Button>
                    )}
                    {canExpenseVoid && selected.status === 'POSTED' && (
                      <Button color="error" variant="outlined" onClick={runVoid} disabled={voidMut.isPending}>
                        Void Expense
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Stack>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnack((prev) => ({ ...prev, open: false }));
        }}
      >
        <Alert
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
