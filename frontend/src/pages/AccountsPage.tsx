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
  FormGroup,
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
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { UpdateUserInput } from '../api/accounts';
import {
  useBranchesQuery,
  useCreateUserMutation,
  useDisableUserMutation,
  useEnableUserMutation,
  useRolesQuery,
  useSetUserPasswordMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import type { User } from '../types/models';

type SnackState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
};

function parseError(error: unknown, fallback: string) {
  const e = error as ApiErrorLike;
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

export function AccountsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { user: me, can } = useAuth();

  const canView = can('USER_VIEW');
  const canCreate = can('USER_CREATE');
  const canUpdate = can('USER_UPDATE');
  const canDisable = can('USER_DISABLE');
  const canRoleView = can('ROLE_VIEW');
  const canBranchView = can('BRANCH_VIEW');

  const rolesQuery = useRolesQuery(canRoleView);
  const branchesQuery = useBranchesQuery(canBranchView);

  const createMut = useCreateUserMutation();
  const updateMut = useUpdateUserMutation();
  const setPasswordMut = useSetUserPasswordMutation();
  const disableMut = useDisableUserMutation();
  const enableMut = useEnableUserMutation();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | ''>('');
  const [branchFilter, setBranchFilter] = useState<number | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoleId, setCreateRoleId] = useState<number | ''>('');
  const [createBranchIds, setCreateBranchIds] = useState<number[]>([]);
  const [createIsActive, setCreateIsActive] = useState(true);

  const [openEdit, setOpenEdit] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | ''>('');
  const [editBranchIds, setEditBranchIds] = useState<number[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const [openPassword, setOpenPassword] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [disableConfirmTarget, setDisableConfirmTarget] = useState<User | null>(null);
  const [enableConfirmTarget, setEnableConfirmTarget] = useState<User | null>(null);

  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const usersQuery = useUsersQuery(
    {
      page,
      search: debouncedSearch || undefined,
      role_id: typeof roleFilter === 'number' ? roleFilter : undefined,
      branch_id: typeof branchFilter === 'number' ? branchFilter : undefined,
      include_inactive: includeInactive ? true : undefined,
    },
    canView
  );

  const rows = usersQuery.data?.data ?? [];
  const totalPages = usersQuery.data?.last_page ?? 1;
  const roleCodeById = new Map((rolesQuery.data ?? []).map((r) => [r.id, (r.code ?? '').toUpperCase()]));
  const branchNameById = new Map((branchesQuery.data ?? []).map((b) => [b.id, b.name]));
  const totalAvailableBranches = (branchesQuery.data ?? []).length;
  const createRoleCode = typeof createRoleId === 'number' ? roleCodeById.get(createRoleId) ?? '' : '';
  const editRoleCode = typeof editRoleId === 'number' ? roleCodeById.get(editRoleId) ?? '' : '';
  const createRequiresBranch =
    typeof createRoleId === 'number' && !['ADMIN', 'OWNER'].includes(createRoleCode);
  const editRequiresBranch = typeof editRoleId === 'number' && !['ADMIN', 'OWNER'].includes(editRoleCode);
  const toggleBranch = (current: number[], branchId: number, checked: boolean) => {
    if (checked) return Array.from(new Set([...current, branchId]));
    return current.filter((id) => id !== branchId);
  };

  const getUserBranchNames = (target: User): string[] => {
    const bucket = new Map<number, string>();

    (target.branches ?? []).forEach((branch) => {
      if (!branch || typeof branch.id !== 'number') return;
      const name = String(branch.name ?? branch.code ?? `Branch #${branch.id}`).trim();
      if (!name) return;
      bucket.set(branch.id, name);
    });

    (target.branch_ids ?? []).forEach((branchId) => {
      if (typeof branchId !== 'number' || !Number.isFinite(branchId)) return;
      if (bucket.has(branchId)) return;
      const fallbackName = branchNameById.get(branchId) ?? `Branch #${branchId}`;
      bucket.set(branchId, fallbackName);
    });

    if (bucket.size === 0 && typeof target.branch_id === 'number') {
      const fallbackName =
        String(target.branch?.name ?? '').trim() ||
        branchNameById.get(target.branch_id) ||
        `Branch #${target.branch_id}`;
      bucket.set(target.branch_id, fallbackName);
    }

    return Array.from(bucket.values());
  };

  const getUserBranchLabel = (target: User, mode: 'full' | 'compact' = 'full'): string => {
    const names = getUserBranchNames(target);
    if (names.length === 0) return '-';

    if (totalAvailableBranches > 0 && names.length >= totalAvailableBranches) {
      return mode === 'compact' ? 'All branches' : `All branches (${names.length})`;
    }

    if (mode === 'compact' && names.length > 2) {
      return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
    }

    return names.join(', ');
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateRoleId('');
    setCreateBranchIds([]);
    setCreateIsActive(true);
  };

  const handleOpenCreate = () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: USER_CREATE', severity: 'error' });
      return;
    }
    resetCreateForm();
    setOpenCreate(true);
  };

  const handleCreate = async () => {
    if (!canCreate) {
      setSnack({ open: true, message: 'Not authorized: USER_CREATE', severity: 'error' });
      return;
    }
    if (typeof createRoleId !== 'number') {
      setSnack({ open: true, message: 'Select a role.', severity: 'error' });
      return;
    }
    if (createPassword.length < 8) {
      setSnack({ open: true, message: 'Password must be at least 8 characters.', severity: 'error' });
      return;
    }
    if (createRequiresBranch && createBranchIds.length === 0) {
      setSnack({ open: true, message: 'Branch is required for this role.', severity: 'error' });
      return;
    }

    try {
      await createMut.mutateAsync({
        name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword,
        role_id: createRoleId,
        branch_id: createBranchIds[0] ?? null,
        branch_ids: createBranchIds,
        is_active: createIsActive,
      });

      setOpenCreate(false);
      setSnack({ open: true, message: 'Account created.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to create account.'),
        severity: 'error',
      });
    }
  };

  const openEditDialog = (target: User) => {
    const branchIdsFromRelations = (target.branches ?? []).map((b) => b.id);
    const branchIdsFromPayload = target.branch_ids ?? [];
    const primaryBranch = typeof target.branch_id === 'number' ? [target.branch_id] : [];
    const mergedBranchIds = Array.from(
      new Set([...branchIdsFromRelations, ...branchIdsFromPayload, ...primaryBranch])
    ).filter((id) => Number.isFinite(id));

    setEditUser(target);
    setEditName(target.name ?? '');
    setEditEmail(target.email ?? '');
    setEditRoleId(target.role_id ?? target.role?.id ?? '');
    setEditBranchIds(mergedBranchIds as number[]);
    setEditIsActive(target.is_active ?? true);
    setOpenEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!canUpdate || !editUser) {
      setSnack({ open: true, message: 'Not authorized: USER_UPDATE', severity: 'error' });
      return;
    }
    if (typeof editRoleId !== 'number') {
      setSnack({ open: true, message: 'Select a role.', severity: 'error' });
      return;
    }
    if (editRequiresBranch && editBranchIds.length === 0) {
      setSnack({ open: true, message: 'Branch is required for this role.', severity: 'error' });
      return;
    }

    const input: UpdateUserInput = {
      name: editName.trim(),
      email: editEmail.trim(),
      role_id: editRoleId,
      branch_id: editBranchIds[0] ?? null,
      branch_ids: editBranchIds,
      is_active: editIsActive,
    };

    try {
      await updateMut.mutateAsync({ id: editUser.id, input });
      setOpenEdit(false);
      setSnack({ open: true, message: 'Account updated.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to update account.'),
        severity: 'error',
      });
    }
  };

  const openPasswordDialog = (target: User) => {
    setPasswordUser(target);
    setNewPassword('');
    setConfirmPassword('');
    setOpenPassword(true);
  };

  const handleSetPassword = async () => {
    if (!canUpdate || !passwordUser) {
      setSnack({ open: true, message: 'Not authorized: USER_UPDATE', severity: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setSnack({ open: true, message: 'Password must be at least 8 characters.', severity: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnack({ open: true, message: 'Password confirmation does not match.', severity: 'error' });
      return;
    }

    try {
      await setPasswordMut.mutateAsync({ id: passwordUser.id, password: newPassword });
      setOpenPassword(false);
      setSnack({ open: true, message: 'Password reset successful.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to reset password.'),
        severity: 'error',
      });
    }
  };

  const handleDisable = async (target: User) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: USER_DISABLE', severity: 'error' });
      return;
    }
    if (target.id === me?.id) {
      setSnack({ open: true, message: 'You cannot disable your own account.', severity: 'error' });
      return;
    }

    try {
      await disableMut.mutateAsync(target.id);
      setSnack({ open: true, message: 'Account disabled.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to disable account.'),
        severity: 'error',
      });
    }
  };

  const requestDisable = (target: User) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: USER_DISABLE', severity: 'error' });
      return;
    }
    if (target.id === me?.id) {
      setSnack({ open: true, message: 'You cannot disable your own account.', severity: 'error' });
      return;
    }
    setDisableConfirmTarget(target);
  };

  const confirmDisable = async () => {
    if (!disableConfirmTarget) return;
    const target = disableConfirmTarget;
    setDisableConfirmTarget(null);
    await handleDisable(target);
  };

  const handleEnable = async (target: User) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: USER_DISABLE', severity: 'error' });
      return;
    }

    try {
      await enableMut.mutateAsync(target.id);
      setSnack({ open: true, message: 'Account enabled.', severity: 'success' });
    } catch (error) {
      setSnack({
        open: true,
        message: parseError(error, 'Failed to enable account.'),
        severity: 'error',
      });
    }
  };

  const requestEnable = (target: User) => {
    if (!canDisable) {
      setSnack({ open: true, message: 'Not authorized: USER_DISABLE', severity: 'error' });
      return;
    }
    setEnableConfirmTarget(target);
  };

  const confirmEnable = async () => {
    if (!enableConfirmTarget) return;
    const target = enableConfirmTarget;
    setEnableConfirmTarget(null);
    await handleEnable(target);
  };

  const actionsBusy =
    createMut.isPending ||
    updateMut.isPending ||
    setPasswordMut.isPending ||
    disableMut.isPending ||
    enableMut.isPending;

  const createReady =
    canCreate &&
    createName.trim().length > 0 &&
    createEmail.trim().length > 0 &&
    typeof createRoleId === 'number' &&
    (!createRequiresBranch || createBranchIds.length > 0) &&
    createPassword.length >= 8 &&
    !actionsBusy;

  const editReady =
    canUpdate &&
    editUser !== null &&
    editName.trim().length > 0 &&
    editEmail.trim().length > 0 &&
    typeof editRoleId === 'number' &&
    (!editRequiresBranch || editBranchIds.length > 0) &&
    !actionsBusy;

  if (!canView) {
    return <Alert severity="error">Not authorized to view users (USER_VIEW).</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Typography variant="h5">Account Management</Typography>
        <Button
          variant="contained"
          onClick={handleOpenCreate}
          disabled={!canCreate || actionsBusy}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          New Account
        </Button>
      </Stack>

      {!canCreate && !canUpdate && !canDisable && (
        <Alert severity="info">You have view-only access to user accounts.</Alert>
      )}

      {canRoleView && rolesQuery.isError && <Alert severity="error">Failed to load roles.</Alert>}
      {canBranchView && branchesQuery.isError && <Alert severity="error">Failed to load branches.</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          label="Search name/email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { md: 280 }, flex: 1 }}
        />

        <TextField
          select
          size="small"
          label="Role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value === '' ? '' : Number(e.target.value));
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 220 } }}
          disabled={!canRoleView || rolesQuery.isLoading}
        >
          <MenuItem value="">All roles</MenuItem>
          {(rolesQuery.data ?? []).map((role) => (
            <MenuItem key={role.id} value={role.id}>
              {role.name}
            </MenuItem>
          ))}
        </TextField>

        {canBranchView && (
          <TextField
            select
            size="small"
            label="Branch"
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value === '' ? '' : Number(e.target.value));
              setPage(1);
            }}
            sx={{ width: { xs: '100%', md: 220 } }}
            disabled={branchesQuery.isLoading}
          >
            <MenuItem value="">All branches</MenuItem>
            {(branchesQuery.data ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
            />
          }
          label="Include inactive"
        />
      </Stack>

      {usersQuery.isLoading ? (
        <Alert severity="info">Loading users...</Alert>
      ) : usersQuery.isError ? (
        <Alert severity="error">Failed to load users.</Alert>
      ) : rows.length === 0 ? (
        <Alert severity="warning">No users found.</Alert>
      ) : isCompact ? (
        <Stack spacing={1.1}>
          {rows.map((row) => {
            const isActive = row.is_active ?? true;
            return (
              <Paper key={row.id} variant="outlined" sx={{ p: 1.2, opacity: isActive ? 1 : 0.72, borderRadius: 2 }}>
                <Stack spacing={0.7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{row.name || '-'}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.2,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: isActive ? 'success.light' : 'warning.light',
                        color: isActive ? 'success.dark' : 'warning.dark',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                    {row.email || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Role: {row.role?.name ?? row.role?.code ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Branches: {getUserBranchLabel(row, 'compact')} | ID {row.id}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.3 }}>
                    {canUpdate && (
                      <Button size="small" variant="outlined" onClick={() => openEditDialog(row)} disabled={actionsBusy}>
                        Edit
                      </Button>
                    )}
                    {canUpdate && (
                      <Button size="small" variant="outlined" onClick={() => openPasswordDialog(row)} disabled={actionsBusy}>
                        Password
                      </Button>
                    )}
                    {canDisable &&
                      (isActive ? (
                        <Button
                          size="small"
                          color="warning"
                          variant="outlined"
                          onClick={() => requestDisable(row)}
                          disabled={actionsBusy || row.id === me?.id}
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="success"
                          variant="outlined"
                          onClick={() => requestEnable(row)}
                          disabled={actionsBusy}
                        >
                          Enable
                        </Button>
                      ))}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={90}>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Branches</TableCell>
                <TableCell width={120}>Status</TableCell>
                <TableCell align="right" width={320}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const isActive = row.is_active ?? true;
                return (
                  <TableRow key={row.id} hover sx={{ opacity: isActive ? 1 : 0.6 }}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.role?.name ?? row.role?.code ?? '-'}</TableCell>
                    <TableCell>{getUserBranchLabel(row)}</TableCell>
                    <TableCell>{isActive ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {canUpdate && (
                          <Button size="small" onClick={() => openEditDialog(row)} disabled={actionsBusy}>
                            Edit
                          </Button>
                        )}
                        {canUpdate && (
                          <Button size="small" onClick={() => openPasswordDialog(row)} disabled={actionsBusy}>
                            Password
                          </Button>
                        )}
                        {canDisable &&
                          (isActive ? (
                            <Button
                              size="small"
                              color="warning"
                              onClick={() => requestDisable(row)}
                              disabled={actionsBusy || row.id === me?.id}
                            >
                              Disable
                            </Button>
                          ) : (
                            <Button size="small" color="success" onClick={() => requestEnable(row)} disabled={actionsBusy}>
                              Enable
                            </Button>
                          ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Account</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={!canCreate || actionsBusy}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              disabled={!canCreate || actionsBusy}
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              helperText="Minimum 8 characters"
              disabled={!canCreate || actionsBusy}
              fullWidth
            />
            <TextField
              select
              label="Role"
              value={createRoleId}
              onChange={(e) => setCreateRoleId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!canCreate || actionsBusy || !canRoleView || rolesQuery.isLoading}
              fullWidth
            >
              <MenuItem value="">Select role</MenuItem>
              {(rolesQuery.data ?? []).map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack spacing={0.75}>
              <Typography variant="body2">
                Branch Access {createRequiresBranch ? '*' : '(optional)'}
              </Typography>
              {!canBranchView ? (
                <Alert severity="warning">Branch list is unavailable for this account.</Alert>
              ) : branchesQuery.isLoading ? (
                <Alert severity="info">Loading branches...</Alert>
              ) : (
                <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                  <FormGroup>
                    {(branchesQuery.data ?? []).map((branch) => (
                      <FormControlLabel
                        key={branch.id}
                        control={
                          <Checkbox
                            checked={createBranchIds.includes(branch.id)}
                            onChange={(e) =>
                              setCreateBranchIds((prev) => toggleBranch(prev, branch.id, e.target.checked))
                            }
                            disabled={!canCreate || actionsBusy}
                          />
                        }
                        label={branch.name}
                      />
                    ))}
                  </FormGroup>
                </Paper>
              )}
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {createRequiresBranch
                  ? 'Select one or more branches. First selected branch is used as the default branch.'
                  : 'Optional for admin/owner.'}
              </Typography>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={createIsActive}
                  onChange={(e) => setCreateIsActive(e.target.checked)}
                  disabled={!canCreate || actionsBusy}
                />
              }
              label="Active account"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} disabled={actionsBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createReady}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Account</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={!canUpdate || actionsBusy}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              disabled={!canUpdate || actionsBusy}
              fullWidth
            />
            <TextField
              select
              label="Role"
              value={editRoleId}
              onChange={(e) => setEditRoleId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!canUpdate || actionsBusy || !canRoleView || rolesQuery.isLoading}
              fullWidth
            >
              <MenuItem value="">Select role</MenuItem>
              {(rolesQuery.data ?? []).map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack spacing={0.75}>
              <Typography variant="body2">
                Branch Access {editRequiresBranch ? '*' : '(optional)'}
              </Typography>
              {!canBranchView ? (
                <Alert severity="warning">Branch list is unavailable for this account.</Alert>
              ) : branchesQuery.isLoading ? (
                <Alert severity="info">Loading branches...</Alert>
              ) : (
                <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                  <FormGroup>
                    {(branchesQuery.data ?? []).map((branch) => (
                      <FormControlLabel
                        key={branch.id}
                        control={
                          <Checkbox
                            checked={editBranchIds.includes(branch.id)}
                            onChange={(e) =>
                              setEditBranchIds((prev) => toggleBranch(prev, branch.id, e.target.checked))
                            }
                            disabled={!canUpdate || actionsBusy}
                          />
                        }
                        label={branch.name}
                      />
                    ))}
                  </FormGroup>
                </Paper>
              )}
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {editRequiresBranch
                  ? 'Select one or more branches. First selected branch is used as the default branch.'
                  : 'Optional for admin/owner.'}
              </Typography>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  disabled={!canUpdate || actionsBusy || editUser?.id === me?.id}
                />
              }
              label="Active account"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)} disabled={actionsBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={!editReady}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPassword} onClose={() => setOpenPassword(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Minimum 8 characters"
              disabled={!canUpdate || actionsBusy}
              fullWidth
            />
            <TextField
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!canUpdate || actionsBusy}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPassword(false)} disabled={actionsBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSetPassword}
            disabled={!canUpdate || actionsBusy || newPassword.length < 8 || confirmPassword.length < 8}
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!disableConfirmTarget} onClose={() => setDisableConfirmTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          Disable Account?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Disable <b>{disableConfirmTarget?.name ?? '-'}</b> ({disableConfirmTarget?.email ?? '-'})?
            </Typography>
            <Alert severity="info">
              The account will become inactive and won&apos;t be able to sign in until re-enabled.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableConfirmTarget(null)} disabled={actionsBusy}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={confirmDisable} disabled={actionsBusy}>
            Disable
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!enableConfirmTarget} onClose={() => setEnableConfirmTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Enable Account?</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Enable <b>{enableConfirmTarget?.name ?? '-'}</b> ({enableConfirmTarget?.email ?? '-'})?
            </Typography>
            <Alert severity="info">
              This account will be able to sign in and access permitted modules again.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnableConfirmTarget(null)} disabled={actionsBusy}>
            Cancel
          </Button>
          <Button variant="contained" color="success" onClick={confirmEnable} disabled={actionsBusy}>
            Enable
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}


