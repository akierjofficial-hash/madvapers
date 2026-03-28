import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  DashboardAdjustmentQueueItem,
  DashboardPurchaseOrderQueueItem,
  DashboardSaleVoidRequestQueueItem,
  DashboardTransferQueueItem,
} from '../api/dashboard';
import {
  useApproveAdjustmentMutation,
  useApprovePurchaseOrderMutation,
  useApproveSaleVoidRequestMutation,
  useApproveTransferMutation,
  useBranchesQuery,
  useDashboardApprovalQueueQuery,
  useRejectSaleVoidRequestMutation,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { authStorage } from '../auth/authStorage';

const SURFACE_BORDER = alpha('#d9e2ec', 0.92);

const APPROVAL_TABS = [
  { key: 'adjustments', label: 'Adjustments' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'void_requests', label: 'Void Requests' },
] as const;

type ApprovalTabKey = (typeof APPROVAL_TABS)[number]['key'];

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatStatus(raw?: string | null): string {
  const value = String(raw ?? '').trim();
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function money(value: number): string {
  return Number(value ?? 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  });
}

function qtyFmt(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function statusChipColor(
  status?: string | null
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (String(status ?? '').toUpperCase()) {
    case 'SUBMITTED':
    case 'REQUESTED':
      return 'info';
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 'warning';
    case 'RECEIVED':
    case 'POSTED':
      return 'success';
    case 'VOIDED':
    case 'CANCELLED':
      return 'error';
    default:
      return 'default';
  }
}

function extractErrorMessage(error: any, fallback: string): string {
  return (
    error?.response?.data?.errors?.status?.[0] ??
    error?.response?.data?.errors?.void_request_status?.[0] ??
    error?.response?.data?.message ??
    fallback
  );
}

function QueueCountCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 1.1,
        cursor: 'pointer',
        borderColor: active ? alpha('#0f766e', 0.5) : SURFACE_BORDER,
        bgcolor: active ? alpha('#0f766e', 0.06) : 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {count.toLocaleString()}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        pending
      </Typography>
    </Paper>
  );
}

export function ApprovalsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can } = useAuth();

  const canBranchView = can('BRANCH_VIEW');
  const canAdjustmentsApprove = can('ADJUSTMENT_APPROVE');
  const canTransfersApprove = can('TRANSFER_APPROVE');
  const canPurchaseOrdersApprove = can('PO_APPROVE');
  const canVoidApprove = can('SALES_VOID');
  const canAnyApproval =
    canAdjustmentsApprove || canTransfersApprove || canPurchaseOrdersApprove || canVoidApprove;

  const branchesQuery = useBranchesQuery(canBranchView);
  const [branchId, setBranchId] = useState<number | ''>(() => {
    const fromStorage = authStorage.getLastBranchId();
    return fromStorage ?? (user?.branch_id ?? '');
  });
  const [tab, setTab] = useState<ApprovalTabKey>('void_requests');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    severity: 'success' | 'error' | 'info';
    message: string;
  }>({
    open: false,
    severity: 'success',
    message: '',
  });

  const approvalQueueQuery = useDashboardApprovalQueueQuery(
    { branch_id: typeof branchId === 'number' ? branchId : undefined },
    canAnyApproval
  );

  // Keep global branch context in sync so sidebar badges follow the same queue scope.
  useEffect(() => {
    if (typeof branchId === 'number' && branchId > 0) {
      authStorage.setLastBranchId(branchId);
    }
  }, [branchId]);

  const queueAdjustments = approvalQueueQuery.data?.approval_queue.adjustments ?? [];
  const queueTransfers = approvalQueueQuery.data?.approval_queue.transfers ?? [];
  const queuePurchaseOrders = approvalQueueQuery.data?.approval_queue.purchase_orders ?? [];
  const queueVoidRequests = approvalQueueQuery.data?.approval_queue.void_requests ?? [];

  const queueCounts = useMemo(
    () => ({
      adjustments: queueAdjustments.length,
      transfers: queueTransfers.length,
      purchase_orders: queuePurchaseOrders.length,
      void_requests: queueVoidRequests.length,
    }),
    [queueAdjustments.length, queuePurchaseOrders.length, queueTransfers.length, queueVoidRequests.length]
  );
  const totalPending =
    queueCounts.adjustments +
    queueCounts.transfers +
    queueCounts.purchase_orders +
    queueCounts.void_requests;

  const showSnack = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnack({ open: true, message, severity });
  };

  const removeQueueItemFromCache = (
    queueKey: 'adjustments' | 'transfers' | 'purchase_orders' | 'void_requests',
    id: number
  ) => {
    queryClient.setQueriesData({ queryKey: ['dashboardApprovalQueue'] }, (current: any) => {
      if (!current?.approval_queue) return current;
      const currentRows = Array.isArray(current.approval_queue?.[queueKey]) ? current.approval_queue[queueKey] : [];
      const nextRows = currentRows.filter((row: any) => Number(row?.id ?? 0) !== Number(id));
      if (nextRows.length === currentRows.length) return current;

      const nextApprovalQueue = {
        ...current.approval_queue,
        [queueKey]: nextRows,
      };

      const nextCounts = {
        ...(current.counts ?? {}),
      };
      const nextBucketCount = Math.max(
        0,
        Number(nextCounts[queueKey] ?? currentRows.length) - 1
      );
      nextCounts[queueKey] = nextBucketCount;

      const computedTotalFromRows =
        Number(nextApprovalQueue.adjustments?.length ?? 0) +
        Number(nextApprovalQueue.transfers?.length ?? 0) +
        Number(nextApprovalQueue.purchase_orders?.length ?? 0) +
        Number(nextApprovalQueue.void_requests?.length ?? 0);
      nextCounts.total = Math.max(0, Number(nextCounts.total ?? computedTotalFromRows));
      nextCounts.total = Math.min(nextCounts.total, computedTotalFromRows);
      nextCounts.total = computedTotalFromRows;

      return {
        ...current,
        approval_queue: nextApprovalQueue,
        counts: nextCounts,
      };
    });
  };

  const syncApprovalNotifications = async () => {
    await Promise.allSettled([
      approvalQueueQuery.refetch(),
      queryClient.refetchQueries({ queryKey: ['dashboardApprovalQueue'], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['dashboardSummary'], type: 'active' }),
    ]);
  };

  const openAdjustments = (targetBranchId?: number | null) => {
    const params = new URLSearchParams();
    params.set('status', 'SUBMITTED');
    const resolvedBranchId =
      typeof targetBranchId === 'number'
        ? targetBranchId
        : typeof branchId === 'number'
        ? branchId
        : null;
    if (resolvedBranchId) params.set('branch_id', String(resolvedBranchId));
    navigate(`/adjustments?${params.toString()}`);
  };

  const openTransfers = (targetFromBranchId?: number | null) => {
    const params = new URLSearchParams();
    params.set('status', 'REQUESTED');
    const resolvedFromId =
      typeof targetFromBranchId === 'number'
        ? targetFromBranchId
        : typeof branchId === 'number'
        ? branchId
        : null;
    if (resolvedFromId) params.set('from_branch_id', String(resolvedFromId));
    navigate(`/transfers?${params.toString()}`);
  };

  const openPurchaseOrders = (targetBranchId?: number | null) => {
    const params = new URLSearchParams();
    params.set('status', 'SUBMITTED');
    const resolvedBranchId =
      typeof targetBranchId === 'number'
        ? targetBranchId
        : typeof branchId === 'number'
        ? branchId
        : null;
    if (resolvedBranchId) params.set('branch_id', String(resolvedBranchId));
    navigate(`/purchase-orders?${params.toString()}`);
  };

  const openVoidRequests = (targetSaleId?: number | null, requestedAt?: string | null) => {
    if (targetSaleId && targetSaleId > 0) {
      authStorage.markSeenPending(user?.id, 'voidRequests', targetSaleId);
      authStorage.markSeenPendingAt(user?.id, 'voidRequests', requestedAt);
    }
    const params = new URLSearchParams();
    params.set('void_request_status', 'PENDING');
    if (typeof branchId === 'number') params.set('branch_id', String(branchId));
    navigate(`/sales?${params.toString()}`);
  };

  const openCurrentModule = () => {
    if (tab === 'adjustments') return openAdjustments();
    if (tab === 'transfers') return openTransfers();
    if (tab === 'purchase_orders') return openPurchaseOrders();
    return openVoidRequests();
  };

  const approveAdjustmentMut = useApproveAdjustmentMutation();
  const approveTransferMut = useApproveTransferMutation();
  const approvePurchaseOrderMut = useApprovePurchaseOrderMutation();
  const approveVoidMut = useApproveSaleVoidRequestMutation();
  const rejectVoidMut = useRejectSaleVoidRequestMutation();

  const runApproveAdjustment = async (row: DashboardAdjustmentQueueItem) => {
    if (!canAdjustmentsApprove) return;
    setBusyKey(`adj-approve-${row.id}`);
    try {
      await approveAdjustmentMut.mutateAsync(row.id);
      authStorage.markSeenPending(user?.id, 'adjustments', row.id);
      authStorage.pingApprovalQueue();
      removeQueueItemFromCache('adjustments', row.id);
      showSnack(`Adjustment #${row.id} approved.`, 'success');
      void syncApprovalNotifications();
    } catch (error: any) {
      showSnack(extractErrorMessage(error, `Failed to approve adjustment #${row.id}.`), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const runApproveTransfer = async (row: DashboardTransferQueueItem) => {
    if (!canTransfersApprove) return;
    setBusyKey(`transfer-approve-${row.id}`);
    try {
      await approveTransferMut.mutateAsync(row.id);
      authStorage.markSeenPending(user?.id, 'transfers', row.id);
      authStorage.pingApprovalQueue();
      removeQueueItemFromCache('transfers', row.id);
      showSnack(`Transfer #${row.id} approved.`, 'success');
      void syncApprovalNotifications();
    } catch (error: any) {
      showSnack(extractErrorMessage(error, `Failed to approve transfer #${row.id}.`), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const runApprovePurchaseOrder = async (row: DashboardPurchaseOrderQueueItem) => {
    if (!canPurchaseOrdersApprove) return;
    setBusyKey(`po-approve-${row.id}`);
    try {
      await approvePurchaseOrderMut.mutateAsync(row.id);
      authStorage.markSeenPending(user?.id, 'purchaseOrders', row.id);
      authStorage.pingApprovalQueue();
      removeQueueItemFromCache('purchase_orders', row.id);
      showSnack(`Purchase order #${row.id} approved.`, 'success');
      void syncApprovalNotifications();
    } catch (error: any) {
      showSnack(extractErrorMessage(error, `Failed to approve purchase order #${row.id}.`), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const runApproveVoidRequest = async (row: DashboardSaleVoidRequestQueueItem) => {
    if (!canVoidApprove) return;
    setBusyKey(`void-approve-${row.id}`);
    try {
      await approveVoidMut.mutateAsync({ id: row.id });
      authStorage.markSeenPending(user?.id, 'voidRequests', row.id);
      authStorage.markSeenPendingAt(user?.id, 'voidRequests', row.void_requested_at ?? null);
      authStorage.pingApprovalQueue();
      removeQueueItemFromCache('void_requests', row.id);
      showSnack(`Void request for sale #${row.id} approved.`, 'success');
      void syncApprovalNotifications();
    } catch (error: any) {
      showSnack(extractErrorMessage(error, `Failed to approve void request for sale #${row.id}.`), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const runRejectVoidRequest = async (row: DashboardSaleVoidRequestQueueItem) => {
    if (!canVoidApprove) return;
    setBusyKey(`void-reject-${row.id}`);
    try {
      await rejectVoidMut.mutateAsync({ id: row.id });
      authStorage.markSeenPending(user?.id, 'voidRequests', row.id);
      authStorage.markSeenPendingAt(user?.id, 'voidRequests', row.void_requested_at ?? null);
      authStorage.pingApprovalQueue();
      removeQueueItemFromCache('void_requests', row.id);
      showSnack(`Void request for sale #${row.id} rejected.`, 'success');
      void syncApprovalNotifications();
    } catch (error: any) {
      showSnack(extractErrorMessage(error, `Failed to reject void request for sale #${row.id}.`), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const renderQueueCards = () => {
    if (tab === 'adjustments') {
      if (queueAdjustments.length === 0) {
        return <Alert severity="success">No submitted adjustments waiting for approval.</Alert>;
      }

      return (
        <Stack spacing={1}>
          {queueAdjustments.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    ADJ #{row.id}
                  </Typography>
                  <Chip size="small" color="info" label="Submitted" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(row.created_at)} | {row.branch_name ?? row.branch_id}
                </Typography>
                <Typography variant="body2">
                  Ref: {row.reference_no?.trim() || `ADJ-${row.id}`} | Qty: {qtyFmt(row.total_qty_delta)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  By: {row.created_by ?? '-'}
                </Typography>
                <Stack direction="row" spacing={0.8} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={() => openAdjustments(row.branch_id)}>
                    Open
                  </Button>
                  {canAdjustmentsApprove && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void runApproveAdjustment(row)}
                      disabled={busyKey === `adj-approve-${row.id}`}
                    >
                      {busyKey === `adj-approve-${row.id}` ? 'Approving...' : 'Approve'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      );
    }

    if (tab === 'transfers') {
      if (queueTransfers.length === 0) {
        return <Alert severity="success">No transfer requests waiting for approval.</Alert>;
      }

      return (
        <Stack spacing={1}>
          {queueTransfers.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    TR #{row.id}
                  </Typography>
                  <Chip size="small" color={statusChipColor(row.status)} label={formatStatus(row.status)} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(row.created_at)}
                </Typography>
                <Typography variant="body2">
                  {`${row.from_branch_name ?? row.from_branch_id} -> ${row.to_branch_name ?? row.to_branch_id}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Qty: {qtyFmt(row.total_qty)} | By: {row.created_by ?? '-'}
                </Typography>
                <Stack direction="row" spacing={0.8} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={() => openTransfers(row.from_branch_id)}>
                    Open
                  </Button>
                  {canTransfersApprove && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void runApproveTransfer(row)}
                      disabled={busyKey === `transfer-approve-${row.id}`}
                    >
                      {busyKey === `transfer-approve-${row.id}` ? 'Approving...' : 'Approve'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      );
    }

    if (tab === 'purchase_orders') {
      if (queuePurchaseOrders.length === 0) {
        return <Alert severity="success">No purchase orders waiting for approval.</Alert>;
      }

      return (
        <Stack spacing={1}>
          {queuePurchaseOrders.map((row) => (
            <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    PO #{row.id}
                  </Typography>
                  <Chip size="small" color={statusChipColor(row.status)} label={formatStatus(row.status)} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(row.created_at)} | {row.branch_name ?? row.branch_id}
                </Typography>
                <Typography variant="body2">Supplier: {row.supplier_name ?? '-'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Qty: {qtyFmt(row.total_qty_ordered)}
                </Typography>
                <Stack direction="row" spacing={0.8} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                  <Button size="small" variant="outlined" onClick={() => openPurchaseOrders(row.branch_id)}>
                    Open
                  </Button>
                  {canPurchaseOrdersApprove && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void runApprovePurchaseOrder(row)}
                      disabled={busyKey === `po-approve-${row.id}`}
                    >
                      {busyKey === `po-approve-${row.id}` ? 'Approving...' : 'Approve'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      );
    }

    if (queueVoidRequests.length === 0) {
      return <Alert severity="success">No sale void requests waiting for approval.</Alert>;
    }

    return (
      <Stack spacing={1}>
        {queueVoidRequests.map((row) => (
          <Paper key={row.id} variant="outlined" sx={{ p: 1.2 }}>
            <Stack spacing={0.8}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                  {row.sale_number?.trim() || `Sale #${row.id}`}
                </Typography>
                <Chip
                  size="small"
                  color={String(row.void_request_status ?? '').toUpperCase() === 'PENDING' ? 'warning' : 'default'}
                  label={`${formatStatus(row.void_request_status)} / ${formatStatus(row.payment_status)}`}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(row.void_requested_at)} | {row.branch_name ?? row.branch_id}
              </Typography>
              <Typography variant="body2">By: {row.requested_by ?? row.cashier_name ?? '-'}</Typography>
              <Typography variant="caption" color="text.secondary">
                Grand total: {money(Number(row.grand_total ?? 0))}
              </Typography>
              <Stack direction="row" spacing={0.8} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openVoidRequests(row.id, row.void_requested_at ?? null)}
                  >
                    Open
                  </Button>
                {canVoidApprove && (
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => void runApproveVoidRequest(row)}
                    disabled={busyKey === `void-approve-${row.id}` || busyKey === `void-reject-${row.id}`}
                  >
                    {busyKey === `void-approve-${row.id}` ? 'Approving...' : 'Approve'}
                  </Button>
                )}
                {canVoidApprove && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void runRejectVoidRequest(row)}
                    disabled={busyKey === `void-approve-${row.id}` || busyKey === `void-reject-${row.id}`}
                  >
                    {busyKey === `void-reject-${row.id}` ? 'Rejecting...' : 'Reject'}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  };

  if (!canAnyApproval) {
    return <Alert severity="error">You do not have approval permissions.</Alert>;
  }

  const activeTabLabel = APPROVAL_TABS.find((item) => item.key === tab)?.label ?? 'Approvals';

  return (
    <Stack spacing={2}>
      <Paper sx={{ border: `1px solid ${SURFACE_BORDER}`, borderRadius: 2, p: { xs: 1.3, md: 1.6 } }}>
        <Stack spacing={1.2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={1}
          >
            <Box>
              <Typography variant="h5">Approval Center</Typography>
              <Typography variant="body2" color="text.secondary">
                Mobile-first queue for admin approvals and fast module navigation.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                color={totalPending > 0 ? 'warning' : 'default'}
                variant={totalPending > 0 ? 'filled' : 'outlined'}
                label={`Pending ${totalPending.toLocaleString()}`}
              />
              <Button size="small" variant="outlined" onClick={openCurrentModule}>
                Open {activeTabLabel}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => void approvalQueueQuery.refetch()}
                disabled={approvalQueueQuery.isFetching}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} alignItems={{ sm: 'center' }}>
            {canBranchView ? (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="approvals-branch-label">Branch</InputLabel>
                <Select
                  labelId="approvals-branch-label"
                  value={branchId}
                  label="Branch"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '') {
                      setBranchId('');
                      authStorage.clearLastBranchId();
                      return;
                    }
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setBranchId(parsed);
                      authStorage.setLastBranchId(parsed);
                    }
                  }}
                >
                  <MenuItem value="">All branches</MenuItem>
                  {(branchesQuery.data ?? []).map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Chip size="small" variant="outlined" label={user?.branch?.name ?? 'Assigned branch'} />
            )}
          </Stack>
        </Stack>
        {approvalQueueQuery.isFetching && <LinearProgress sx={{ mt: 1.2, borderRadius: 99, height: 5 }} />}
      </Paper>

      {approvalQueueQuery.isError && <Alert severity="error">Failed to load approval queue.</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {APPROVAL_TABS.map((item) => (
          <QueueCountCard
            key={item.key}
            label={item.label}
            count={queueCounts[item.key]}
            active={tab === item.key}
            onClick={() => setTab(item.key)}
          />
        ))}
      </Box>

      <Paper sx={{ border: `1px solid ${SURFACE_BORDER}`, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value: ApprovalTabKey) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ px: 1.2, minHeight: 42 }}
        >
          {APPROVAL_TABS.map((item) => (
            <Tab
              key={item.key}
              value={item.key}
              label={`${item.label} (${queueCounts[item.key]})`}
              sx={{ minHeight: 42, textTransform: 'none' }}
            />
          ))}
        </Tabs>
        <Box sx={{ p: 1.25 }}>{renderQueueCards()}</Box>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
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
