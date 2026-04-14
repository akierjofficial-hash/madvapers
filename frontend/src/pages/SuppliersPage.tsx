import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateSupplierMutation,
  useDeleteSupplierMutation,
  useSuppliersQuery,
  useUpdateSupplierMutation,
} from '../api/queries';
import type { Supplier } from '../api/suppliers';
import { useAuth } from '../auth/AuthProvider';

function toPositiveInt(value: string | null): number | null {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function SuppliersPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAuth();
  const canView = can('SUPPLIER_VIEW');
  const canManage = can('SUPPLIER_MANAGE');
  const canSeeActions = canManage;
  const suppliersQuery = useSuppliersQuery(canView);
  const createMut = useCreateSupplierMutation();
  const updateMut = useUpdateSupplierMutation();
  const deleteMut = useDeleteSupplierMutation();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<number>(() => toPositiveInt(searchParams.get('page')) ?? 1);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const rows = suppliersQuery.data ?? [];

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const pageSize = isCompact ? 12 : 20;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [page, pageSize, sorted]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const nextPage = toPositiveInt(searchParams.get('page')) ?? 1;
    if (nextPage !== page) setPage(nextPage);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [page, searchParams, setSearchParams]);

  const openNew = () => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: SUPPLIER_MANAGE', severity: 'error' });
      return;
    }
    setEditing(null);
    setName('');
    setOpen(true);
  };

  const openEdit = (s: Supplier) => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: SUPPLIER_MANAGE', severity: 'error' });
      return;
    }
    setEditing(s);
    setName(s.name);
    setOpen(true);
  };

  const submit = async () => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: SUPPLIER_MANAGE', severity: 'error' });
      return;
    }

    const n = name.trim();
    if (!n) {
      setSnack({ open: true, message: 'Supplier name is required.', severity: 'error' });
      return;
    }

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: { name: n } });
        setSnack({ open: true, message: `Updated supplier "${n}".`, severity: 'success' });
      } else {
        await createMut.mutateAsync({ name: n });
        setSnack({ open: true, message: `Created supplier "${n}".`, severity: 'success' });
      }
      setOpen(false);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        (e?.response?.data?.errors ? JSON.stringify(e.response.data.errors, null, 2) : null) ??
        'Failed to save supplier.';
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  const requestRemove = (s: Supplier) => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: SUPPLIER_MANAGE', severity: 'error' });
      return;
    }
    setDeleteConfirmTarget(s);
  };

  const confirmRemove = async () => {
    if (!deleteConfirmTarget) return;
    const target = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    try {
      await deleteMut.mutateAsync(target.id);
      setSnack({ open: true, message: `Deleted supplier "${target.name}".`, severity: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to delete supplier.';
      setSnack({ open: true, message: msg, severity: 'error' });
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view Suppliers (SUPPLIER_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Typography variant="h5">Suppliers</Typography>
        <Button
          variant="contained"
          onClick={openNew}
          sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'auto' } }}
          disabled={!canManage}
        >
          New Supplier
        </Button>
      </Stack>

      {!canManage && <Alert severity="info">You have view-only access for suppliers.</Alert>}

      {suppliersQuery.isLoading ? (
        <Alert severity="info">Loading suppliers...</Alert>
      ) : suppliersQuery.isError ? (
        <Alert severity="error">Failed to load suppliers.</Alert>
      ) : sorted.length === 0 ? (
        <Alert severity="warning">No suppliers yet. Create one.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {pagedRows.map((s) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID {s.id}
                  </Typography>
                </Stack>
                {canSeeActions && (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openEdit(s)}
                      sx={{ textTransform: 'none' }}
                      disabled={!canManage}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => requestRemove(s)}
                      disabled={deleteMut.isPending || !canManage}
                      sx={{ textTransform: 'none' }}
                    >
                      Delete
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={90}>ID</TableCell>
                <TableCell>Name</TableCell>
                {canSeeActions && (
                  <TableCell width={200} align="right">
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.id}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  {canSeeActions && (
                    <TableCell align="right">
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          onClick={() => openEdit(s)}
                          sx={{ textTransform: 'none' }}
                          disabled={!canManage}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => requestRemove(s)}
                          disabled={deleteMut.isPending || !canManage}
                          sx={{ textTransform: 'none' }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {sorted.length > 0 && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(_, next) => setPage(next)} showFirstButton showLastButton />
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              size="small"
              label="Supplier name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoFocus
              disabled={!canManage}
            />
          </Box>

          {(createMut.isError || updateMut.isError) && (
            <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-line' }}>
              {String(
                (createMut.error as any)?.response?.data?.message ??
                  JSON.stringify((createMut.error as any)?.response?.data?.errors ?? null, null, 2) ??
                  (updateMut.error as any)?.response?.data?.message ??
                  JSON.stringify((updateMut.error as any)?.response?.data?.errors ?? null, null, 2) ??
                  'Failed to save supplier.'
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={!canManage || createMut.isPending || updateMut.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete Supplier?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will move <b>{deleteConfirmTarget?.name ?? '-'}</b> to inactive status.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmTarget(null)} disabled={deleteMut.isPending}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmRemove} disabled={deleteMut.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
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
