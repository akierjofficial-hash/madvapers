import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { useMemo, useState } from 'react';
import {
  useBranchesQueryWithParams,
  useCreateBranchMutation,
  useUpdateBranchMutation,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import type { Branch } from '../types/models';

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

function parseError(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  const errors = error?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const firstKey = Object.keys(errors)[0];
    const firstMsg = firstKey ? errors[firstKey]?.[0] : null;
    if (firstMsg) return firstMsg;
  }
  return fallback;
}

export function BranchesPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { can } = useAuth();
  const canView = can('BRANCH_VIEW');
  const canManage = can('BRANCH_MANAGE');

  const branchesQuery = useBranchesQueryWithParams({ include_inactive: true }, canView);
  const createMut = useCreateBranchMutation();
  const updateMut = useUpdateBranchMutation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [locator, setLocator] = useState('');
  const [cellphoneNo, setCellphoneNo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const rows = useMemo(() => {
    return [...(branchesQuery.data ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  }, [branchesQuery.data]);

  const actionsBusy = createMut.isPending || updateMut.isPending;

  const resetForm = () => {
    setCode('');
    setName('');
    setAddress('');
    setLocator('');
    setCellphoneNo('');
    setIsActive(true);
  };

  const openNew = () => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: BRANCH_MANAGE', severity: 'error' });
      return;
    }
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (target: Branch) => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: BRANCH_MANAGE', severity: 'error' });
      return;
    }
    setEditing(target);
    setCode(target.code ?? '');
    setName(target.name ?? '');
    setAddress(target.address ?? '');
    setLocator(target.locator ?? '');
    setCellphoneNo(target.cellphone_no ?? '');
    setIsActive(target.is_active ?? true);
    setOpen(true);
  };

  const submit = async () => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: BRANCH_MANAGE', severity: 'error' });
      return;
    }

    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c || !n) {
      setSnack({ open: true, message: 'Code and name are required.', severity: 'error' });
      return;
    }

    const payload = {
      code: c,
      name: n,
      address: address.trim() || null,
      locator: locator.trim() || null,
      cellphone_no: cellphoneNo.trim() || null,
      is_active: isActive,
    };

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        setSnack({ open: true, message: `Updated branch "${n}".`, severity: 'success' });
      } else {
        await createMut.mutateAsync(payload);
        setSnack({ open: true, message: `Created branch "${n}".`, severity: 'success' });
      }
      setOpen(false);
    } catch (error: any) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to save branch.'),
        severity: 'error',
      });
    }
  };

  const toggleActive = async (target: Branch, next: boolean) => {
    if (!canManage) {
      setSnack({ open: true, message: 'Not authorized: BRANCH_MANAGE', severity: 'error' });
      return;
    }

    try {
      await updateMut.mutateAsync({ id: target.id, input: { is_active: next } });
      setSnack({
        open: true,
        message: `${target.name} is now ${next ? 'active' : 'inactive'}.`,
        severity: 'success',
      });
    } catch (error: any) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to update branch status.'),
        severity: 'error',
      });
    }
  };

  if (!canView) {
    return <Alert severity="error">Not authorized to view branches (BRANCH_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Typography variant="h5">Branches</Typography>
        <Button
          variant="contained"
          onClick={openNew}
          disabled={!canManage || actionsBusy}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          New Branch
        </Button>
      </Stack>

      {!canManage && <Alert severity="info">You have view-only access for branches.</Alert>}

      {branchesQuery.isLoading ? (
        <Alert severity="info">Loading branches...</Alert>
      ) : branchesQuery.isError ? (
        <Alert severity="error">Failed to load branches.</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No branches found.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {rows.map((row) => (
            <Paper
              key={row.id}
              variant="outlined"
              sx={{ p: 1.2, opacity: row.is_active ? 1 : 0.72, borderRadius: 2 }}
            >
              <Stack spacing={0.8}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{row.name}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: row.is_active ? 'success.light' : 'warning.light',
                      color: row.is_active ? 'success.dark' : 'warning.dark',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Typography>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {row.code} • ID {row.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.address || 'No address'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Locator: {row.locator || '-'} • Cellphone: {row.cellphone_no || '-'}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ pt: 0.3 }} useFlexGap flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openEdit(row)}
                    disabled={!canManage || actionsBusy}
                  >
                    Edit
                  </Button>
                  {row.is_active ? (
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => toggleActive(row, false)}
                      disabled={!canManage || actionsBusy}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="success"
                      variant="outlined"
                      onClick={() => toggleActive(row, true)}
                      disabled={!canManage || actionsBusy}
                    >
                      Activate
                    </Button>
                  )}
                </Stack>
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
                <TableCell width={130}>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Locator</TableCell>
                <TableCell>Cellphone</TableCell>
                <TableCell width={110}>Status</TableCell>
                <TableCell width={220} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ opacity: row.is_active ? 1 : 0.6 }}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.address || '-'}</Typography>
                  </TableCell>
                  <TableCell>{row.locator || '-'}</TableCell>
                  <TableCell>{row.cellphone_no || '-'}</TableCell>
                  <TableCell>{row.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => openEdit(row)} disabled={!canManage || actionsBusy}>
                        Edit
                      </Button>
                      {row.is_active ? (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => toggleActive(row, false)}
                          disabled={!canManage || actionsBusy}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="success"
                          onClick={() => toggleActive(row, true)}
                          disabled={!canManage || actionsBusy}
                        >
                          Activate
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Branch' : 'New Branch'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Stack spacing={2}>
              <TextField
                size="small"
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!canManage || actionsBusy || !!editing}
                helperText={editing ? 'Branch code cannot be changed after creation.' : 'Example: BAGACAY'}
              />
              <TextField
                size="small"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage || actionsBusy}
              />
              <TextField
                size="small"
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canManage || actionsBusy}
              />
              <TextField
                size="small"
                label="Locator"
                value={locator}
                onChange={(e) => setLocator(e.target.value)}
                disabled={!canManage || actionsBusy}
                helperText="Map hint or location descriptor shown in public locator."
              />
              <TextField
                size="small"
                label="Cellphone No."
                value={cellphoneNo}
                onChange={(e) => setCellphoneNo(e.target.value)}
                disabled={!canManage || actionsBusy}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={!canManage || actionsBusy}
                  />
                }
                label="Active branch"
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={actionsBusy}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!canManage || actionsBusy}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
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
